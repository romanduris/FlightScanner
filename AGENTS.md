# Repository workflow

- At the start of a new session, read `WORKSPACE_HANDOFF.md` and `TODO.txt` for saved project context. These notes are not a transcript or a guarantee of chat-history recovery.
- Speak Slovak with the user. Confirm proposed UI changes before implementing unless already approved or explicitly requested immediately.
- Preserve local scan changes. Do not regenerate flight data or run live scans merely to test a UI change.
- Run `node --test tests/*.test.js` for dashboard changes, and check mobile layouts when modifying the UI.
- After pushing, monitor the relevant GitHub Actions deployment and verify the production and GitHub Pages URLs.
- Preview uses `python3 -m http.server 8000 --directory HTML`. Derive the preview URL from the current `CODESPACE_NAME`; old preview URLs are not permanent.

- Work directly on `main` unless the user explicitly requests another branch.
- After completing and verifying a requested change, commit its files to `main`.
- If work was performed on another task branch, merge it into `main` after verification. Do not create an empty merge when already on `main`.
- Inspect the working tree before staging and never include unrelated user changes.
- Use a concise commit message describing the completed result.
- After completing and verifying changes, always push `main` to `origin`.
