# 2026-11-13 · Claude · Recent Team Form descriptive beta card (F5b)

## Scope
Build the display-only "Recent Team Form" beta card per
`tasks/artifacts/calculation-inventory-2026-11-10/master/production/ctpi-v2-validation-2026-11-13/DISPLAY-PLAN.md`
(TJ approved 2026-11-13). Commit only; no push, release, migration or writes.

## Where
- Branch `octoberBranch`, sole checkout. Base HEAD `9e2bfd98a`.
- Files: `web/lib/trends/ctpiVersions.ts`, `web/lib/trends/ctpi.test.ts`,
  new `web/components/TeamDashboard/RecentTeamFormBeta.{tsx,module.scss,test.tsx}`,
  `useRecentTeamFormBeta.ts`, mount in `TeamDashboard.tsx`.
- Mailbox claim appended: `CLAUDE-FIX-F5B-CLAIM-20261113` (not committed; the file holds other lanes' uncommitted claims).

## State
- Read plan, report, protocol. No mailbox claims on `components/TeamDashboard/**`.
- Migration 144 (`ctpi_version` column) is applied in production (release #433 records);
  generated DB types do not have the column yet, so the hook casts its select result.

## Decisions
- Predicate takes the row's `ctpi_version` as `ctpiVersion` beside the payload paths
  (stored payloads carry no version); it requires 2.
- Read filters: `ctpi_version = 2` and `payload->>formulaVersion = v2` (same as the readers).
- "Today" = America/New_York date.
- No row: count 5-on-5 games before today (limit 5) to show "Not enough games yet (n of 5)";
  5+ games and no row → "not available" (e.g. 2025-26, which has no v2 rows).

## Checks (pre-superstyle)
- Vitest: `components/TeamDashboard` + `lib/trends/ctpi.test.ts`: 6 files, 78 passed
  (RecentTeamFormBeta 11, ctpi 22; TeamDashboard.test.tsx got a child mock for the new card).
- `npm run typecheck`: exit 0. ESLint on 7 changed files: exit 0.
- CSS Modules pure check on the new module: OK (negative control rejects `td {}`).
- Live render on TJ's :3000 (PHI): score 56, window Oct 21 – Nov 11, matches timeline; puck luck PDO 0.983.

## /superstyle (card only, PHI on TJ's :3000, 390 + 1440)
Backlog rows: `tasks/artifacts/Toenail-Audit-Visual-Enhancements.md` (Recent Team Form beta).
States not in live data are forced with a local Playwright response rewrite
(scratchpad `qa/states.cjs`: partial, notenough, mismatch, short, unavailable, info).

| card \ pass | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| Recent Team Form beta | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

- Pass 0: clean (rendered detector both viewports, static check).
- Pass 1 (approved): mismatch window line says "games through <score's last game>" (+ regression test);
  SD unit as a muted condensed suffix; `text-wrap: pretty` on prose lines.
- Pass 2 (approved): 4-size type ladder + weight tokens; info button and divider tokens.
- Commit `122dd880b` (passes 0–2 + build; typecheck exit 0, 79 tests).
- Pass 3 (approved): axe clean both viewports, focus sweep clean; negative bars → `$danger-color`
  (2.77 → 5.26:1); `aria-busy` while loading (+ test).
- Pass 4 (approved): plain mismatch note (3 cases); SD caption naming the parts list.
  Plan-fixed strings (badge, tip, scale, window, as-of, puck-luck heading) untouched.
- Commit `17b342f76` (passes 3–4; typecheck exit 0, 80 tests).
- Pass 5 (approved): slop audit no hits on the card; direction confirmed (exact, rink-side,
  candid; moment = score + bars; signature = neutral beta pill); trailing periods dropped.
- Pass 6: wider bars wrapped the notes → reverted; closed with no change (TJ).
- Pass 7 (approved): negative bar red re-stepped for red-green CVD (#d04e5a mix, ΔE 10.5,
  3.42:1 on measured track #26292d) — corrects the pass-3 pick; clipped bars (> ±2 SD) get a
  squared end + single slanted cut (TJ rejected the notch as phallic, then a fade; chose single "/").
- Pass 8 (approved): toenails, axe (390 + 1440), focus clean; slop audit 0 card hits;
  fixed own regression (SD caption orphan at 390). Typecheck exit 0.
- Gotcha: dataviz validator lives in the bundled dataviz skill dir; its "lightness band"
  FAIL is a categorical check and does not apply to a two-arm diverging pair.

- Commit `3b6d82edc` (passes 5–8). Release #434 (`496ab3766`) does not contain the card.
- Screenshots sent to TJ; copies + hand-over note in the shared notes folder
  (`F5b-recent-team-form-beta-card.md`, `F5b-screenshots/`).

## Follow-up: Astra #435 P2 (Chef, 2026-11-13)
- Bug: equal-count 5-on-5 rows from other dates showed "same 10 games" beside the mismatch
  warning (card compared counts only). No game ids exist anywhere (games keyed team + date)
  and the CTPI row stores only its last game date, so identity needs the score's own dates.
- TJ approved (pop-up) a third anon read: `nst_team_gamelogs_as_rates` (`public_read`),
  `date` with exact count, team/season/gp = 1/date < snapshot, limit recentGameCount.
  Dates confirmed only if newest = sourceThroughDate, length = recentGameCount and exact
  count = sourceGameCount (catches rows added after issue). Read error → unconfirmed.
- Card: window line uses confirmed score dates (else "games through"); puck luck says
  "same N games" only when every 5-on-5 date matches; else "separate sample: N games, A – B".
- Regressions (both failed on the old code): equal-count shifted dates; same count + same last
  game with one inner date different. Live PHI still confirms "same 10 games".

## Next
Release only with TJ's separate approval, batched (one fhfhockey build). Predictive use stays
gated until the game-40 checkpoint (~2027-01-04).

## Gotchas
- Never set GIT_DIR in test runs. Use `npm run typecheck`, not plain `npx tsc`.
- Second `next dev` must use `PLAYWRIGHT_ISOLATED_NEXT=1`; stop servers by exact PID.
