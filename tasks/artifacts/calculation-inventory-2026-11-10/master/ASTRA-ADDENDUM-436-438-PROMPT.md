# Astra addendum 3: releases #436, #437 and #438 and the 2026-11-13 evening production steps

You are **Astra**. This continues your #435 addendum. Same ground rules: read-only; production reads only with TJ's per-batch approval under read hygiene; ask TJ by pop-up; diary; never print secrets.

## Scope
- **Range:** master `6f1cb0767..ed2002161`.
  - #436 `4b45d8f1a`: candidate `353a73a31`.
  - #437 `b6d43efdc`: candidate `4cf33215a`.
  - #438 `ed2002161`: candidate `a9ab949f1`.
  - Verify the tree equalities.
- Codex items 1 and 2 and item 6's **application code** are still held. In #437, item 6's migration `20261113190000`, proof and rollback ship as **inert pending files** (authority order 147). Confirm nothing applies it and its code paths match the base.

## What to verify
| Item | Commits | Claim |
|---|---|---|
| Social rankings missing vs zero (your #433 follow-up) | F17 `f2df257b6` (#436) | The social share skater L5 score is withheld when any input stat is missing. |
| Batched /lines reader | F8 `3e7e42aa4` (#436) | `getLatestLineChanges` shares parsing, latest-snapshot and 5v5-or-legacy selection with the per-team path; equivalence and read-count tests; about 293 → about 10–12 reads per regeneration. |
| PP clock C1/C2 | F11 `de4650c77` (#436) | `buildTeamPpClock` qualifies only within ±2 s of a verified official total (decision 151). The audit skips the observations the clock refuses. There are no callers outside the module; PP share stays withheld. Report: `production/pp-clock-validation-2026-11-13/REPORT.md` §8–§9. |
| AF-07 penalty shots | F15 `30fa0f00a`, `8a4a7d8d1`, `2a9227343` (#437); `84b013054`, `e152575b5` (#438) | Migration 148 adds the split columns and v2 writer (v1 becomes a legacy wrapper). Builder, homepage, splits and parity add PS to all-situations only. Team summaries add PS once to allStrengths for both teams. Successful dry runs and diffs write no audit row. |
| Mahura NST alias | F18 `77a6e7592` (#437) | An aliased name resolves under either stored spelling. |
| CTPI beta same-games (your #435 P2) | `a32478cb0` (#437) | "Same N games" only when every 5-on-5 date matches the score's own dates. |

## Production steps (receipts in `production/PRODUCTION-QUEUE.md`; decisions 149–151)
- **Migration 148:** applied 17:28:45Z, with readback and grants; authority 113/7.
- **Penalty-shot 8-game derived rebuild:** 17:46–17:50Z. Dry run first; key-by-key readback; Chef readback of 16 team and 304 player rows split, totals equal to the official boxscores.
- **Player and goalie summary refresh:**
  - canary 065, then 7 games, 1,158 partitions; the 18 orphans unchanged;
  - served landing verified: `production/penalty-shot-rebuild-2026-11-13/verify-landing.py`, ALL_OK.
- **Team diff** (read-only, no audit row), **team refresh** (54 rows, equal to the diff), **served team landing** (`verify-team-landing.py`, 16/16 equal to the official boxscores).
- **F18 data repairs** (`production/data-repairs-2026-11-13/REPORT.md`): 14 WGO legacy-identity rows (guarded DO block), and the Mahura NST re-fetch, with one partial run that committed nothing followed by narrow re-runs.
- **Power ratings v4 runner P2 fix** `630127066` (artifact): the cron window is rechecked after the DB guard.
- **Legacy-route request-log check** and the **sKO gate**: already covered in your #435 scope.

## Output
Append "Addendum 3: #436–#438" with verdicts, findings and blockers; post or hand to TJ as before.
