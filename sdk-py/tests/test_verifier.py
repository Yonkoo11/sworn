"""Unit tests for sworn_verify. Only deterministic logic (chat_id_from_input,
decrypt, hashing helpers) — the network paths are tested in integration tests."""

import hashlib

import pytest

from sworn_verify import chat_id_from_input
from sworn_verify.verifier import _aes256_ctr_decrypt


def test_chat_id_from_input_strips_sworn_scheme():
    assert chat_id_from_input("sworn://r/9a4f8d2b") == "9a4f8d2b"


def test_chat_id_from_input_strips_https_prefix():
    url = "https://yonkoo11.github.io/sworn/r/9a4f8d2b-1c3e?k=0xabc"
    assert chat_id_from_input(url) == "9a4f8d2b-1c3e"


def test_chat_id_from_input_passthrough():
    assert chat_id_from_input("9a4f8d2b") == "9a4f8d2b"


def test_aes_decrypt_round_trip():
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

    key = bytes.fromhex("ab" * 32)
    iv = bytes.fromhex("cd" * 16)
    plaintext = b'{"version":1,"chatId":"test"}'
    enc = Cipher(algorithms.AES(key), modes.CTR(iv)).encryptor()
    ciphertext = iv + enc.update(plaintext) + enc.finalize()
    out = _aes256_ctr_decrypt(ciphertext, key)
    assert out == plaintext


def test_aes_decrypt_wrong_key_size():
    with pytest.raises(ValueError, match="expected 32-byte key"):
        _aes256_ctr_decrypt(b"x" * 32, b"shortkey")


def test_aes_decrypt_short_ciphertext():
    with pytest.raises(ValueError, match="too short"):
        _aes256_ctr_decrypt(b"only-8-b", bytes.fromhex("ab" * 32))
