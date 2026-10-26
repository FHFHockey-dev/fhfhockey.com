# 2026-10-26 Claude — Tuesday Trends worker (lane TT)

## Scope
Make `/social-share/tuesday-trends` a truthful, data-backed edition from native data. Offline only (fixtures shaped like real columns). Stop after READ-PLAN and message the chef (local_9c175312…). No production reads.

## Where
- Checkout `/Users/tim/Code/fhfhockey.com` on `octoberBranch`, base HEAD cd73cbd69.
- Write paths: lease TT in CLAUDE-LEASES.json.
- Artifacts: `tasks/artifacts/tuesday-trends-2026-10-26/`.

## Decisions (checkpoint 1)
- Ownership source: `yahoo_player_ownership_history` (PK player_key+ownership_date, anon SELECT policy, date index). Two global dates: latest D and latest date <= D-5.
- Movers mapped to NHL ids via `yahoo_nhl_player_map_read`; team from the latest rolling row's per-game `team_id`.
- PP unknown vs none from `powerPlayCombinations` (PK gameId+playerId): game has rows + player absent = none; no rows = unknown.
- PP TOI from the all-strength row's `pp_toi_seconds_*` columns (same writer); EV TOI from `ev` rows for shown deployment players only.
- Server computes the lists; only shown players leave the server. Tuesday branch runs before the UPSTREAM_READ_FORMATS gate, so the format registry in types.ts is untouched.
- Stale sources: not ranked; the reason names the as-of date.

## State (checkpoint 2, ~16:00Z)
- Built: trends.ts (sections, contract), trendsFixture.ts (real-column-shaped rows), trendSources.ts (bounded loader), server.ts Tuesday branch, TrendCard UI, export token.
- Checks: Vitest 215/215 (lib/socialShare + components/SocialShare), eslint 0, full tsc 0, CSS pure OK, E2E 31/31 on :3110 with the deny preload. Monday 9 and Wednesday 9 PNG pins are byte-identical once the committed OTT.png is served (the dirty OTT.png changes only the Ottawa logo cells). New Tuesday pins are in run/tuesday-pins.txt.
- READ-APPROVAL.md (chef/TJ) appeared in the artifact folder: the ceiling is ≤40 statements, ≤1000 rows each, concurrency 2, and approved tables only. Fixed concurrency to 2 (asserted in the test). The `players` names read is outside the approved tables, so it is an open question for the chef.

## Next
- RECEIPT-1, commit with explicit pathspecs, message the chef. Then wait for the capture ticket and the decision on `players`.

## Blockers / approvals
- Genuine capture needs a chef ticket. The `players` table needs approval, or the names must come from the map (READ-PLAN.md).

## Gotchas
- The dirty `web/public/teamLogos/OTT.png` (not ours) breaks the Monday grid/easiest and Wednesday grid pins. Use `SOCIAL_SHARE_LOGO_OVERRIDE_DIR` with `git show HEAD:web/public/teamLogos/OTT.png` to verify the pins.
- The Playwright runner cannot import SocialShare.tsx (SCSS), so the shared strings live in trends.ts.

## Checkpoint 3 (TT-2, ~16:20Z)
- Committed 82490cd45 (offline build). TT-2 ticket: TJ approved N1 (`players`) via the chef pop-up; addendum in READ-APPROVAL.md.
- Label fix: "PCT PTS ROSTERED" and "pct pts = …". Monday 9 and Wednesday 9 pins are byte-identical; the Tuesday movers pin changed.
- One genuine capture at 16:00:00Z: 11 statements, max 2 in flight, max 1,000 rows, 0 errors. Facts are in RECEIPT-2. Re-run NOT used.
- Found: the per-row freshness rule dropped 55 current skaters (the writer writes each row once). Fixed offline with a regression test. The captured layer predates the fix.
- Found: hot/cold is empty on Oct 26 because nobody has ≥ 15 GP. That is a contract minimum, so the decision belongs to the chef/TJ.
- Next: chef decides the hot/cold minimum and whether to spend the one re-run (with the freshness fix).

## Checkpoint 4 (TT-3, ~16:45Z)
- TJ (chef pop-up): hot/cold → Recent Form `recent-form-v1-early` (last 5 vs preceding 5 appearances, all 10 this season). Derived as last10 − last5 from R1 (one extra column, no new statement); proof uses season GP ≥ 10 and whole season points.
- Deployment: abs(TOI) ≥ 1:00 sets the column by its sign; role-only rows follow the role; mixed role-only rows are left out; the hero never contradicts the column.
- Movers show integer precision.
- The one approved re-run is used: 11 statements, 0 errors, 439 Recent Form qualifiers, footer updated Oct 26 10:15 UTC. E2E 33/33 with pins. Vitest 221.
- tsc: 3 errors, all in other lanes' dirty files (player-cards, rosterScheduleData); 0 in social-share.
- No more approved reads remain. Any new capture needs a new TJ approval.
