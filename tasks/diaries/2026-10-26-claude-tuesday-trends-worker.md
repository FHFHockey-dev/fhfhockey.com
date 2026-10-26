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
