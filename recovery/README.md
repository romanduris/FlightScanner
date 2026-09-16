# Local scan recovery

`local-data-2026-09-16.patch.gz` preserves the pre-existing, uncommitted changes
to `Data/airlines.json` and `Data/destinations_2026_09.json`. The base is commit
`fc1bd2e8b97327547d47b4cfe6964180c87cb85d`. It is a generated compressed Git diff,
not a replacement for production data. It contains no Codex sessions or credentials.

Restore with `bash scripts/restore-local-data.sh`. The new Codespace setup calls
this automatically. The script refuses incompatible changes and is idempotent.
Do not force it onto newer scan files; inspect the backup separately instead.

SHA-256 of the restored files:

```
d0450da1c9a3c6fd5f95e2abdf0596eba7d60f6ae2b1eed499418e2043960fb5  Data/airlines.json
8bf874a160ce6313c61410f0fb7ea28c9842f86b3cef8419afcbd4714f99a761  Data/destinations_2026_09.json
```
