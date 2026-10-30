# Tuesday Trends production-read approval (TJ, direct pop-up, 2026-10-26T15:23:10Z)

TJ chose "Approve ceiling" in a direct AskUserQuestion in the chef session (local_9c175312…).

Scope: one genuine-data capture run plus one re-run after fixes, executed only after the chef has checked READ-PLAN.md.
- Read-only anon SELECTs on rolling_player_game_metrics, powerPlayCombinations, Yahoo ownership history/timeline (yahoo_player_ownership_history or yahoo_players timeline) and yahoo_nhl_player_map_read.
- At most 40 statements per run, each at most 1000 rows, concurrency 2, from a local script.
- Snapshot JSON rendered offline afterward.
- Excluded: writes, Vercel builds/deploys/requests, NST, Yahoo API, PROJECTIONS_* tables, any other table.

## Addendum (2026-10-26T15:57:19Z, TJ direct pop-up in chef session)
TJ chose "Add players": one extra read-only SELECT of players (id, fullName, position) for at most 100 shortlisted ids (READ-PLAN N1), inside the same 40-statement ceiling. The chef checked READ-PLAN.md (≤~18 statements, pages ≤1,000, concurrency 2) against this ceiling: within bounds.
