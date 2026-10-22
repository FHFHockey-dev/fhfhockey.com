# WGO labels — 2026-10-20

- Scope: historical season repair plans only; forward skater ingest guard and existing tests. No data fix, migration or provider call.
- Where: `octoberBranch` base `9695a2fe65e4`; skater route/tests. D2 owns completed separate goalie retry diff.
- Finding: current mapper already validates game ID against season and optional source gameDate against requested date. A missing source gameDate still permits a historical requested date to be paired with a modern season/game ID.
- Next: reject requested calendar years outside the season's two years before upserts; retain delayed 2020 playoffs. Report API relabel versus constraint choice and hold the 105-row fix for direct go.
- Checks: pending focused route test; no production reads/writes authorized.
