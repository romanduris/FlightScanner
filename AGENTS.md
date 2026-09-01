# Repository workflow

- Work directly on `main` unless the user explicitly requests another branch.
- After completing and verifying a requested change, commit its files to `main`.
- If work was performed on another task branch, merge it into `main` after verification. Do not create an empty merge when already on `main`.
- Inspect the working tree before staging and never include unrelated user changes.
- Use a concise commit message describing the completed result.
- Do not push to a remote unless the user explicitly requests it.
