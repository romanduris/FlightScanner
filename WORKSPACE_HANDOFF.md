# FlightScanner: continuation notes

Saved 2026-09-16 before deleting the original Codespace.

## Restore the workspace

1. Create a new Codespace from `romanduris/FlightScanner`, branch `main`.
2. Let `.devcontainer/devcontainer.json` finish setup. It requests Python 3.12,
   Node 24, the Codex VS Code extension and Python extension. The setup installs
   contact-worker dependencies, Codex CLI if missing, and restores the saved
   local data changes without overwriting incompatible changes.
   Saved non-secret Codex model/effort preferences are copied only when no config
   already exists. Model access still depends on the signed-in account.
3. Sign into the Codex extension again if requested. For CLI, use
   `codex login --device-auth`; see `CODEX_CODESPACES_NAVOD.md`.
4. Ask Codex: "Precitaj AGENTS.md, WORKSPACE_HANDOFF.md a TODO.txt a pokracuj."
5. Run `node --test tests/*.test.js` (19 tests passed at handoff).
6. Preview: `python3 -m http.server 8000 --directory HTML`, then open port 8000
   from the Codespaces Ports panel. Its URL changes with the Codespace.

This is saved project context, NOT a backup of the complete Codex conversation.
Local Codex sessions, approvals, login, other settings, running terminals, browser
state, temporary screenshots and installed caches do not survive deletion via
this repository. For the same live environment/chat, stop the Codespace rather
than delete it. Do not assume account sync restores a locally stored chat.
Never commit `~/.codex/auth.json`, session logs, tokens or Cloudflare credentials.
Cloudflare/GitHub access may need reauthentication; deployed services are separate.

## Preserved local work

- `TODO.txt` is the user's original note, saved unchanged. It asks why the Wizz
  horizon was only October 25 while Ryanair had the full period. Investigate
  current data before treating this older observation as a confirmed bug.
- The two pre-existing modified scan JSON files are in the recovery patch.
  They are deliberately NOT committed over the main data files or published.
- Ignored caches (`__pycache__`, `.wrangler/cache`, `node_modules`) can be rebuilt.
- The repo workflow previously lived partly in a home-directory Codex skill;
  durable essential rules are now in root `AGENTS.md`.

## Current product behavior

- Static dashboard: `HTML/index.html`, `dashboard.js`, `dashboard.css` and SK/EN
  translations under `HTML/i18n`. No frontend build step.
- Main branch is deployed by `.github/workflows/refresh-dashboard.yml` to
  https://btsflightscaner.rodulab.com/ (GitHub Pages custom domain).
- Ordinary pushes preserve the latest production scan. Do not use
  `[refresh-data]` in a commit unless a new live scan is intended.
- Search contains destination, departure popover, stay, sorting, weekend,
  price and duration. No country selector or sharing buttons. All filters
  collapse together. Popover marks holidays and regional school holidays,
  defaults to west Slovakia; no separate calendar section.
- Results start from the selected date through the available scan horizon.
  Display 30 rows, then load 30 more. No end-date slider or 30-day restriction.
- Pagination: 11px normal grey count, blue 12px semibold button, white background,
  compact spacing; mobile button remains full width and 44px high.
- Separate compact Ryanair/Wizz cards always sit side by side. Collapsed overview
  shows total flights; map legend stays top-right even when map is expanded.
- Detail has a red-dot destination-airport minimap (no tooltip), wider on desktop,
  below prices on mobile. Return rows show only the round-trip total, with a
  separate Booking.com link beside them even on mobile. Whole flight row is
  clickable, no redundant blue booking strip. Row minimum height is 80px.
- Statistics UI was also customized: four interaction tiles, category selection
  for chart labels, grey offers/green Booking/blue Ryanair/pink Wizz; audience
  and performance closed by default; compact performance metrics and paginated
  GitHub runs. Inspect existing statistics code before changing it.

## Performance: preserve these optimizations

`15463e1` caches return lists by date and filter configuration, reuses Intl.Collator,
and skips unnecessary map reconstruction. Traveller changes update prices without
refiltering/resorting or collapsing loaded rows. Open map popups update prices
and retain working detail links. On 4,535 production flights measured processing
fell from ~180ms to ~8ms for travellers and ~871ms to ~42ms for first weekend toggle.
Full order, return choices and prices matched the original in four scenarios.
Browser timings are environment-specific, not a latency guarantee.

## Verification and tools

- `node --test tests/*.test.js`
- `npm --prefix contact-worker test` for worker changes.
- Python scanner uses the standard library; do not run `Main.py` just to test UI.
- Playwright was installed in a temporary npm cache. That absolute path will not
  survive. Reinstall explicitly for browser checks (e.g. `npm exec --yes
  --package=playwright -- playwright install chromium`). Test 320px and desktop,
  SK/EN, filter correctness, pagination and no horizontal overflow.
- `gh run list`, `gh run watch <id> --exit-status` to verify deployment.
- Main site and Pages survive Codespace deletion; the Codespaces preview does not.

## Codex references

- Project instructions: https://learn.chatgpt.com/docs/agent-configuration/agents-md
- Authentication: https://learn.chatgpt.com/docs/auth
- IDE extension: https://learn.chatgpt.com/docs/codex/ide

The separate device-diagnostics page request was explicitly CANCELLED. Do not
implement it as pending work. No further UI change is currently approved/pending.
