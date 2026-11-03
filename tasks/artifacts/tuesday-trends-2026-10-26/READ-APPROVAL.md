# Tuesday Trends production-read approval (TJ, direct pop-up, 2026-10-26T15:23:10Z)

TJ chose "Approve ceiling" in a direct AskUserQuestion in the chef session (local_9c175312…).

Scope: one genuine-data capture run plus one re-run after fixes, executed only after the chef has checked READ-PLAN.md.
- Read-only anon SELECTs on rolling_player_game_metrics, powerPlayCombinations, Yahoo ownership history/timeline (yahoo_player_ownership_history or yahoo_players timeline) and yahoo_nhl_player_map_read.
- At most 40 statements per run, each at most 1000 rows, concurrency 2, from a local script.
- Snapshot JSON rendered offline afterward.
- Excluded: writes, Vercel builds/deploys/requests, NST, Yahoo API, PROJECTIONS_* tables, any other table.

## Addendum (2026-10-26T15:57:19Z, TJ direct pop-up in chef session)
TJ chose "Add players": one extra read-only SELECT of players (id, fullName, position) for at most 100 shortlisted ids (READ-PLAN N1), inside the same 40-statement ceiling. The chef checked READ-PLAN.md (≤~18 statements, pages ≤1,000, concurrency 2) against this ceiling: within bounds.

## Addendum 2 (2026-10-26T19:08:43Z, TJ direct in chef session)
TJ: "Approved: READ-PLAN v2 S1/M2 (typical about 14 statements, worst about 21, ceiling 40, pages at most 1,000, concurrency 2). Release with SOCIAL_SHARE_TUESDAY_SPARKLINES on, after the Ottawa re-pin, via a new gated RC on current master."
- This covers the production runtime reads that each signed-in editor load of /social-share/tuesday-trends issues under READ-PLAN v2.
- It does not cover any capture script or other production read by Claude.
- To avoid changing Vercel project settings, sparklines will default ON in code, and SOCIAL_SHARE_TUESDAY_SPARKLINES=0 turns them off.

## Addendum 3 (2026-10-26T22:41:20Z, TJ direct pop-up in chef session)
TJ chose "Approve M3": READ-PLAN v3 adds one runtime statement per signed-in editor load.
- M3 reads `yahoo_nhl_player_map_read` for at most 27 shown non-mover players (cap ids×4 rows), so their rostered % can be taken from the ownership rows O3 already reads at date D.
- Totals: about 15 typical, about 22 worst; ceiling 40, pages ≤1,000, concurrency 2.
- No new tables. Line/PP chips need no new read.
- It does not cover any capture script or other production read by Claude.

## Addendum 4 (2026-10-27T01:09:43Z, TJ direct pop-up in chef session)
TJ chose "Approve run-3": one local genuine capture of the Tuesday layer with the current code (TT-16), within READ-PLAN v3 bounds:
- about 15 statements typical, at most about 22;
- pages ≤1,000 rows, concurrency 2;
- read-only anon, no retries, approved tables only;
- saved as JSON with a statement log.
Purpose: diagnose the real leading sparkline gaps TJ saw on his local dev server (live data). No re-run is included; another capture needs a new approval.
