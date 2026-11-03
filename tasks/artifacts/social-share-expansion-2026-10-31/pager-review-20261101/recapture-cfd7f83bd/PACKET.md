# Integrated packet at cfd7f83bd (2026-11-03)

This packet is from the Social Share owner (session `local_c4fd32c8`) to the pager reviewer, thread `01a198a0-979b-71c9-a442-3d0218479035`. It follows `CLAUDE-SS-PAGER-PACKET-20261101` (pin `e152ce5bc`).

## Pin

The release candidate is `cfd7f83bddce17964671238efa72b704b7101227` on `octoberBranch`.

- **Since the release sync `10b7584df`:** 24 commits (`COMMITS.txt`), changing 69 application files (+2,174, −473) under `web/`. They match the set that differs from merged `295b384da` exactly.
- **Manifest:** `MANIFEST.txt` gives the SHA-256 of each blob at the pin. No file is deleted.
- **Outside Social Share:** only `web/lib/supabase/Upserts/fetchWGOdata.js` and its test.

## What joined the batch since e152ce5bc

All of this is from TJ's 2026-11-03 notes, and TJ reviewed each change on real or fixture renders.

- **Late feeds** (`387a6df7f` and module adoptions):
  - `shared/completeThrough.ts`: a card whose newest night or nights are incomplete ends at its last complete date, stays ready and exportable, and says so in `pageNotes` beside the preview, never on the PNG.
  - An older gap still makes the post partial. No complete night makes it missing.
  - Applied to What Changed and Role Watch, Player vs Player, Crease Shift, GSAx, Goalie of the Period, Risky Starts and Start/Sit (via the inventory), Off-Night Edge (results window only), Standouts and the three skater boards, Busy and Quiet, Goalie Rescue, and Team Games.
- **F2 surface: the studio** (`3665e335e`, `cfd7f83bd`):
  - The Refresh post button is removed, and settings apply on their own. Selects and the pager load at once.
  - Typed fields wait 500 ms and are sent only when valid. Responses for older settings are dropped.
  - `f56ba565c` is kept: the edition prop, the refresh-failed alert and Retry weeks.
  - Options start collapsed, with a changed count, and open on an error.
  - An expired edition shows "Load a new edition".
- **F3 surface: Standouts** (`e9a2c8b2d`, `e7e1eda35`):
  - Slates come from scheduled regular-season `games`. A night is available when the view's own skater or goalie rows cover every scheduled game, so a late team feed no longer blanks it.
  - Missing skater rows still mean "not available", never an off day. Codex's F3 test is kept.
  - A blank slate falls back to the last complete night, at most 7 back, with a page note.
- **Risky Starts** (`575d61df2`, `a3357e88a`, `e8de2a3fa`):
  - Labels replace Unknown: a source report for this exact game shows PROJECTED or CONFIRMED; otherwise L10 share gives LIKELY STARTER or LIKELY BACKUP, with tiebreaks; a B2B against the weaker opponent is labelled.
  - Only DraftKings lines print.
  - Labels are coloured text that passes AA on #1a1d21.
- **Off-Night Edge** (`b0cce1011`, `832eab6a3`, `e0afb17c6`, `ed0d26c3c`):
  - HOT pickups come first, then the score, then a Short Sample chip.
  - A skater who played one of his team's last 2 games stays pickable despite a sticky Yahoo status.
  - Opponent logos fill the day grid, and export waits for them.
  - Reasons move to page notes. The HOT chip is red.
- **Spec date pins:** the pager now takes its cutoff from the edition, so five e2e fixtures stamped with today's date failed from Nov 2 on. `04a20ed91`, `23c364191`, `bd83418e2` and `3665e335e` pin each fixture's `generatedAt` to its calendar mock.
- **NHL.com writer** (`59bb2d95c`, `154757b27`), the cause of the 11-03 missing Nov 2 team rows:
  - Each request now has a 20 s timeout and 3 attempts on network errors, timeouts, 429 and 5xx.
  - A 210 s run budget applies.
  - Recent and all-dates modes stop at the first date that still fails, so the next nightly run retries it and leaves no gap. `main` rejects naming it.

## Gate on a clean clone at the pin

The clone is `release-check-cfd7f83bd`. Its only dirty file is `next-env.d.ts`, which the Next dev server rewrote.

| Check | Result |
|---|---|
| `npm run test:full` | 1,198 files and 15,793 tests passed, 61 skipped |
| `npm run typecheck` | exit 0 |
| `npm run lint` | 0 errors, 69 warnings |
| CSS Modules pure check | 54 files, 0 impure |
| `npm run build` | exit 0 |
| `e2e/social-share*` on port 3125, fictional `.invalid` env | 137 passed, 1 skipped, 1 failed |

The one failure was `skater-boards:302`, a `page.goto` timeout during a cold compile. Its spec then passed 16 of 16 on rerun.

## Real-calendar recapture at the pin

The scripts are the same as before: `run35.sh` and `run36.sh`, with `rr31.test.ts`, `rr31.spec.ts` and `rr36.test.ts`.

- **Calendar:** read fresh through `loadMatchupWeeks`. One request to `yahoo_matchup_weeks` returned 200, `0-26/27`. Body SHA-256 `96f7e60a…f193c1`, the same bytes as at `e152ce5bc`.
- **Pagers:** 13 of 13 pager posts show real labels, with 0 "Weeks unavailable", 0 "could not be read" and 0 refresh-failed. Each stepped Prior then Next and returned, with every calendar call returning 200.
  - 9 posts come from `render-report.json`.
  - Team Games is in `render-report-team-games.json`. The worker restarted after a failure and reset the shared report, so it was rerun alone.
  - Rescue is in `-regenerated.json`.
  - Off-Night ×2 and Risky are in `-regenerated-1103.json`.
- **Editions regenerated at the pin:** retained editions predate two shape changes.
  - Busy/Quiet and Rescue predate `adba00bba`'s min-starts, as before.
  - Off-Night Edge (weeks 6 and 4) and Risky Starts (week 6) predate the 11-03 role and opponent fields. Replaying the old shape threw in Risky Starts' alt text ("reading 'label'") and never showed the card.
  - Editions are never stored (`SOCIAL_SHARE_CACHE_CONTROL` is `private, no-store`, and no table holds them), so the server always builds them with the current code. I regenerated all three with 37 bounded reads (`inputs-regenerated-1103/`). All three are ready, pass and export.
- **PNGs:** every post with a pool exported. `risky-past` has an empty pool by design.
- **Hashes:** in `SHA256SUMS`.

## Not claimed

- **F2:** a browser midnight rollover is not exercised. The PostStudio unit cases cover it.
- **F3:** the browser has run only on fixtures and on the Nov 2 real render (lane B, `ui-1103/standouts/`).

## Ask

I ask that the same reviewer review the integrated delta at `cfd7f83bd`, especially:
- the studio's auto refresh against the F2 cases;
- the Standouts slate rule against F3;
- `completeThrough` adoption;
- the writer's stop-at-first-failure.

No duplicate audit, hosted build, push or deployment is requested. TJ approves the release separately.

## Production actions

- 1 + 37 Supabase reads through the public client, SELECT only and bounded, plus the earlier review renders' reads.
- No NST or Yahoo provider calls.
- No push, build, deploy, migration or rollback.
