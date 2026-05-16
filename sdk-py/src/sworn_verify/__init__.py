"""Sworn receipt verifier (read-only, Python).

Mirrors the verifier-web's 11-check chain. Reads anchors from 0G Chain via
web3.py, fetches the encrypted blob over HTTP, decrypts with AES-256-CTR,
and re-derives every hash locally.

Usage:
    from sworn_verify import verify
    result = verify(
        chat_id="9a4f8d2b-1c3e-4f5a-b6d7-8e9f0a1b2c3d",
        rpc_url="https://evmrpc-testnet.0g.ai",
        registry="0xf35bE6FFEBF91AcC27A78696cf912595C6b08AAA",
        revocation="0xf9e5a9E147856D9B26aB04202D79C2c3dA4a326B",
        decrypt_key=None,
    )
    assert result.ok, result.checks
"""

from .verifier import (
    VerifyCheck,
    VerifyResult,
    verify,
    chat_id_from_input,
)

__all__ = ["verify", "VerifyCheck", "VerifyResult", "chat_id_from_input"]
__version__ = "0.1.0"
