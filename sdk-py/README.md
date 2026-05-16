# sworn-verify (Python)

Read-only Python SDK for verifying Sworn receipts. Same 11-check chain as the
browser verifier — runs without holding the issuer's wallet, against the live
0G Galileo testnet.

## Install

```bash
pip install sworn-verify
```

## Verify one receipt

```python
from sworn_verify import verify

result = verify(
    chat_id="543f06b4-84c0-d19b-59ca-6b22afabd8d3",
    rpc_url="https://evmrpc-testnet.0g.ai",
    registry="0xf35bE6FFEBF91AcC27A78696cf912595C6b08AAA",
    revocation="0xf9e5a9E147856D9B26aB04202D79C2c3dA4a326B",
    decrypt_key="0x6c60cf51ed0986f3334f5b33e6de53809a138aa765d5e3d5da95c19f3f9e21f2",
)

print(f"{result.status.upper()} — {result.passed} of {result.total} checks passed")
for c in result.checks:
    print(f"  {c.status:5}  {c.name:36}  {c.detail}")
```

## Checks (all run locally)

The Python verifier runs the same 11 checks as the browser verifier; the
authoritative spec is at <https://yonkoo11.github.io/sworn/spec>.

1. `anchor.exists`
2. `storage.retrievable`
3. `storage.rootHashBinding`
4. `storage.decrypts`
5. `body.parses` (refuses unknown schema versions)
6. `body.promptHash`
7. `body.responseHash`
8. `body.teeSignature`
9. `body.processResponseResult`
10. `anchor.modelHash`
11. `provider.notRevoked`

## Audience

Anyone who builds AI agents in Python and wants to verify Sworn receipts in
LangChain pipelines, FastAPI services, Jupyter notebooks, or batch jobs.

## License

MIT.
