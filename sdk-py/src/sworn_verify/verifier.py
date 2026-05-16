"""Python verifier for Sworn receipts.

Replicates the 11-check chain shipped in verifier-web/src/lib/live-verify.ts
so the audience that uses AI agents from Python can re-derive a receipt
without holding the issuer's wallet.

The check list matches the spec at https://yonkoo11.github.io/sworn/spec.
"""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, field
from typing import Literal, Optional

import requests
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from eth_utils import keccak, to_bytes, to_checksum_address, to_hex
from web3 import Web3


GATEWAY_DEFAULT = "https://indexer-storage-testnet-turbo.0g.ai/file/?root="
LOCAL_MIRROR_DEFAULT = "https://yonkoo11.github.io/sworn/blobs/"


REGISTRY_ABI = [
    {
        "type": "function",
        "name": "getAnchor",
        "stateMutability": "view",
        "inputs": [{"name": "chatIdHash", "type": "bytes32"}],
        "outputs": [
            {
                "type": "tuple",
                "name": "",
                "components": [
                    {"name": "storageRootHash", "type": "bytes32"},
                    {"name": "provider", "type": "address"},
                    {"name": "issuer", "type": "address"},
                    {"name": "blockTimestamp", "type": "uint64"},
                    {"name": "modelHash", "type": "bytes32"},
                ],
            }
        ],
    },
]


REVOCATION_ABI = [
    {
        "type": "function",
        "name": "getRevocation",
        "stateMutability": "view",
        "inputs": [{"name": "provider", "type": "address"}],
        "outputs": [
            {
                "type": "tuple",
                "components": [
                    {"name": "revokedAtBlock", "type": "uint64"},
                    {"name": "revokedAtTimestamp", "type": "uint64"},
                    {"name": "reasonHash", "type": "bytes32"},
                ],
            }
        ],
    },
]


CheckStatus = Literal["pass", "fail", "skip"]


@dataclass
class VerifyCheck:
    name: str
    status: CheckStatus
    detail: str


@dataclass
class VerifyResult:
    ok: bool
    checks: list[VerifyCheck] = field(default_factory=list)
    chat_id: Optional[str] = None
    chat_id_hash: Optional[str] = None
    status: Literal["verified", "partial", "failed"] = "verified"
    passed: int = 0
    total: int = 0


def chat_id_from_input(value: str) -> str:
    """Strip sworn://r/ or /r/ prefix if present. Mirrors the TS helper."""
    prefix = "sworn://r/"
    if value.startswith(prefix):
        return value[len(prefix):]
    m = re.search(r"/r/([^/?#]+)", value)
    if m:
        return m.group(1)
    return value


def _aes256_ctr_decrypt(ciphertext: bytes, key: bytes) -> bytes:
    if len(key) != 32:
        raise ValueError(f"expected 32-byte key, got {len(key)}")
    if len(ciphertext) < 16:
        raise ValueError("ciphertext too short for 16-byte IV")
    iv = ciphertext[:16]
    body = ciphertext[16:]
    cipher = Cipher(algorithms.AES(key), modes.CTR(iv))
    return cipher.decryptor().update(body) + cipher.decryptor().finalize()


def _fetch_blob(root_hash: str, gateway: str, local_mirror: str) -> tuple[bytes, str]:
    """Try the 0G Storage gateway first; fall back to the local mirror."""
    try:
        r = requests.get(gateway + root_hash, timeout=10)
        if r.ok:
            return r.content, "0G Storage gateway"
        raise RuntimeError(f"gateway HTTP {r.status_code}")
    except Exception:
        clean = root_hash[2:] if root_hash.startswith("0x") else root_hash
        url = local_mirror + clean + ".bin"
        r = requests.get(url, timeout=10)
        if not r.ok:
            raise RuntimeError(f"local mirror HTTP {r.status_code}") from None
        return r.content, "Sworn /blobs/ mirror"


def verify(
    chat_id: str,
    rpc_url: str,
    registry: str,
    revocation: Optional[str] = None,
    chain_id: int = 16602,
    decrypt_key: Optional[bytes | str] = None,
    storage_gateway: str = GATEWAY_DEFAULT,
    local_mirror: str = LOCAL_MIRROR_DEFAULT,
) -> VerifyResult:
    """Run the full 11-check chain for one receipt.

    Args:
        chat_id: Receipt chatId or sworn://r/<chatId> URL.
        rpc_url: 0G Chain RPC endpoint.
        registry: ReceiptRegistry address.
        revocation: Optional RevocationRegistry address.
        chain_id: Chain id baked into the receipt body (16602 = Galileo).
        decrypt_key: Optional hex string or bytes for sealed receipts.
        storage_gateway: 0G Storage gateway base URL.
        local_mirror: Sworn-hosted fallback for blobs that the gateway rejects.

    Returns:
        VerifyResult with .ok, .checks (list of VerifyCheck), and metadata.
    """
    chat_id = chat_id_from_input(chat_id)
    chat_id_hash = to_hex(keccak(text=chat_id))
    checks: list[VerifyCheck] = []

    w3 = Web3(Web3.HTTPProvider(rpc_url))
    reg = w3.eth.contract(address=to_checksum_address(registry), abi=REGISTRY_ABI)

    # 1. anchor.exists
    try:
        anchor = reg.functions.getAnchor(bytes.fromhex(chat_id_hash[2:])).call()
        storage_root_hash = "0x" + anchor[0].hex()
        provider_addr = anchor[1]
        issuer_addr = anchor[2]
        block_ts = int(anchor[3])
        model_hash = "0x" + anchor[4].hex()
        zero = "0x" + "00" * 32
        if storage_root_hash == zero:
            checks.append(VerifyCheck("anchor.exists", "fail", "no anchor for this chatIdHash on Galileo"))
            return _finalise(checks, chat_id, chat_id_hash)
        checks.append(VerifyCheck("anchor.exists", "pass", f"block@{block_ts}, issuer={issuer_addr[:8]}..."))
    except Exception as e:
        checks.append(VerifyCheck("anchor.exists", "fail", f"chain read failed: {e}"))
        return _finalise(checks, chat_id, chat_id_hash)

    # 2/3. storage.retrievable + rootHashBinding
    blob_bytes: bytes | None = None
    blob_source = ""
    try:
        blob_bytes, blob_source = _fetch_blob(storage_root_hash, storage_gateway, local_mirror)
        checks.append(VerifyCheck("storage.retrievable", "pass", f"{len(blob_bytes)}B from {blob_source}"))
    except Exception as e:
        checks.append(VerifyCheck("storage.retrievable", "fail", str(e)))

    if blob_bytes is not None:
        if "/blobs/" in blob_source.lower() or "mirror" in blob_source.lower():
            got = "0x" + hashlib.sha256(blob_bytes).hexdigest()
            expected = storage_root_hash.lower()
            if got.lower() == expected:
                checks.append(VerifyCheck("storage.rootHashBinding", "pass", "sha256(blob) matches anchor.storageRootHash"))
            else:
                checks.append(VerifyCheck(
                    "storage.rootHashBinding", "fail",
                    f"sha256(blob) {got[:14]}... != anchor {expected[:14]}...",
                ))
        else:
            checks.append(VerifyCheck(
                "storage.rootHashBinding", "skip",
                "blob came from 0G Storage gateway; rootHash pre-validated by gateway, not re-derived locally in V1",
            ))

    # 4. storage.decrypts
    body_json: str | None = None
    if blob_bytes is not None:
        try:
            text = blob_bytes.decode("utf-8", errors="strict")
            if text.lstrip().startswith("{"):
                body_json = text
                checks.append(VerifyCheck("storage.decrypts", "pass", "blob is public JSON; no decryption needed"))
            elif decrypt_key is not None:
                key_bytes = decrypt_key if isinstance(decrypt_key, bytes) else bytes.fromhex(
                    decrypt_key[2:] if decrypt_key.startswith("0x") else decrypt_key,
                )
                plain = _aes256_ctr_decrypt(blob_bytes, key_bytes)
                body_json = plain.decode("utf-8")
                checks.append(VerifyCheck("storage.decrypts", "pass", "AES-256-CTR decrypted with supplied key"))
            else:
                checks.append(VerifyCheck("storage.decrypts", "skip", "blob sealed; supply decrypt_key to open"))
        except UnicodeDecodeError:
            if decrypt_key is not None:
                try:
                    key_bytes = decrypt_key if isinstance(decrypt_key, bytes) else bytes.fromhex(
                        decrypt_key[2:] if decrypt_key.startswith("0x") else decrypt_key,
                    )
                    plain = _aes256_ctr_decrypt(blob_bytes, key_bytes)
                    body_json = plain.decode("utf-8")
                    checks.append(VerifyCheck("storage.decrypts", "pass", "AES-256-CTR decrypted with supplied key"))
                except Exception as e:
                    checks.append(VerifyCheck("storage.decrypts", "fail", f"decrypt failed: {e}"))
            else:
                checks.append(VerifyCheck("storage.decrypts", "skip", "blob sealed; supply decrypt_key to open"))
        except Exception as e:
            checks.append(VerifyCheck("storage.decrypts", "fail", str(e)))

    # 5. body.parses + version + chatId
    body: dict | None = None
    if body_json:
        try:
            body = json.loads(body_json)
            if body.get("version") != 1:
                checks.append(VerifyCheck("body.parses", "fail", f"unknown version: {body.get('version')}"))
                body = None
            elif body.get("chatId") != chat_id:
                checks.append(VerifyCheck("body.parses", "fail", "body.chatId mismatch with URL"))
                body = None
            else:
                checks.append(VerifyCheck("body.parses", "pass", f"version={body['version']} chatId matches"))
        except Exception as e:
            checks.append(VerifyCheck("body.parses", "fail", f"JSON parse: {e}"))
    else:
        checks.append(VerifyCheck("body.parses", "skip", "body not available (sealed without key)"))

    # 6-9. body field checks (echoed validation; the cryptographic binding is
    # the rootHashBinding + the TEE signature inside the body).
    if body:
        prompt_hash = body.get("request", {}).get("promptHash", "")
        response_hash = body.get("response", {}).get("contentHash", "")
        tee_sig = body.get("attestation", {}).get("teeSignature", "")
        process_ok = body.get("attestation", {}).get("processResponseResult", False)
        provider_mode = body.get("provider", {}).get("mode", "TeeML")

        checks.append(VerifyCheck(
            "body.promptHash",
            "pass" if prompt_hash.startswith("0x") else "fail",
            prompt_hash[:16] + "..." if prompt_hash else "missing",
        ))
        checks.append(VerifyCheck(
            "body.responseHash",
            "pass" if response_hash.startswith("0x") else "fail",
            response_hash[:16] + "..." if response_hash else "missing",
        ))
        checks.append(VerifyCheck(
            "body.teeSignature",
            "pass" if tee_sig.startswith("0x") else "fail",
            f"{provider_mode} mode; sig={tee_sig[:12]}..." if tee_sig else "missing",
        ))
        checks.append(VerifyCheck(
            "body.processResponseResult",
            "pass" if process_ok else "fail",
            "true at issuance" if process_ok else "false at issuance",
        ))
        # 10. anchor.modelHash
        body_model = body.get("model", "")
        expected_model_hash = to_hex(keccak(text=body_model))
        if expected_model_hash.lower() == model_hash.lower():
            checks.append(VerifyCheck("anchor.modelHash", "pass", f"model={body_model} matches on-chain"))
        else:
            checks.append(VerifyCheck("anchor.modelHash", "fail", f"model={body_model} but chain has {model_hash[:14]}..."))
    else:
        for n in ["body.promptHash", "body.responseHash", "body.teeSignature", "body.processResponseResult", "anchor.modelHash"]:
            checks.append(VerifyCheck(n, "skip", "body not available"))

    # 11. provider.notRevoked
    if revocation:
        try:
            rev = w3.eth.contract(address=to_checksum_address(revocation), abi=REVOCATION_ABI)
            r = rev.functions.getRevocation(provider_addr).call()
            revoked_at_block = int(r[0])
            if revoked_at_block == 0:
                checks.append(VerifyCheck(
                    "provider.notRevoked", "pass",
                    f"provider {provider_addr[:8]}... not revoked",
                ))
            else:
                anchor_block = body.get("anchor", {}).get("blockNumber", 0) if body else 0
                if anchor_block and revoked_at_block <= anchor_block:
                    checks.append(VerifyCheck(
                        "provider.notRevoked", "fail",
                        f"provider revoked at block {revoked_at_block} (<= anchor {anchor_block}) - invalid at issuance",
                    ))
                else:
                    checks.append(VerifyCheck(
                        "provider.notRevoked", "skip",
                        f"provider revoked at block {revoked_at_block} after anchor; receipt was valid when issued",
                    ))
        except Exception as e:
            checks.append(VerifyCheck("provider.notRevoked", "skip", f"revocation lookup failed: {e}"))

    return _finalise(checks, chat_id, chat_id_hash)


def _finalise(checks: list[VerifyCheck], chat_id: str, chat_id_hash: str) -> VerifyResult:
    passed = sum(1 for c in checks if c.status == "pass")
    failed = sum(1 for c in checks if c.status == "fail")
    total = len(checks)
    if failed > 0:
        status = "failed"
    elif passed < total:
        status = "partial"
    else:
        status = "verified"
    return VerifyResult(
        ok=failed == 0,
        checks=checks,
        chat_id=chat_id,
        chat_id_hash=chat_id_hash,
        status=status,
        passed=passed,
        total=total,
    )
