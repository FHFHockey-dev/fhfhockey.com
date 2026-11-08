# GS receipt 4: no further in-lease defect of real value; no change

Tickets 1–3 are released. For ticket 4 I made **no source or test edits**, and there is nothing to commit.

## Pins (unchanged since ticket 3)

| Path | SHA-256 |
| --- | --- |
| `web/lib/goalieWorkload.ts` | `ab0219c0df5e4c102981aa983a5383489c81c151549dda026bec39c7cf7a218d` |
| `web/components/GoalieShareChart/index.tsx` | `9d819064174781c02486909ac9504c39f22efaac1f52e4e352134b19002fcfda` |
| `web/components/GoalieShareChart/GoalieShareChart.test.ts` | `403d366075c856c638706569a1d846db80e21d3d2bc872f13d40d3418b3a9742` |
| `web/components/GoalieShareChart/GoalieShareChart.pagination.test.tsx` | `964670a05a726fd4299e4fcc7dc89a557ed768909fe3babdf141d08dfd2ac4c9` |
| `web/lib/projections/goalie/workloadEvidence.ts` | `8d9ae620a65f7f4a528f766cd4629eeb0bf422cac57844ede384e7e4bb07fa43` |
| `web/lib/projections/goalie/workloadEvidence.test.ts` | `fcd8305829c5f0871bde6c86fb54aec8179934e9afa782c7e373c88ba5e9c167` |

## Remaining candidates I looked at and rejected

| Candidate | Why I didn't fix it |
| --- | --- |
| A goalie with only explicit `gamesPlayed: 0` rows shows as "Name (0.0%)" in the legend | The per-game goalie summary only lists goalies who played, so this is theoretical. |
| The pie shows only the top 5 goalies; a 6th or later goalie is left out | This is rare and long-standing, and choosing an "Other" slice is a product decision. Ask TJ if it's wanted. |
| Team abbreviations missing from `teamsInfo` are dropped | The chart only shows the current season, and all 32 current teams are present. |
| The newest season id from the API may be a season that hasn't started, leaving the chart empty in the offseason | This can't be confirmed without a live read. The empty state already says "No goalie data". |

## Checks

None were run this ticket because nothing changed. The tree is green from ticket 3: 49 focused tests, scoped tsc exit 0, and lint 0 errors.

## Still outside the lease

These need other files or real data, as listed in the handover:
- an authoritative starter and opportunity source for the forecast,
- team, season and trade timing,
- null-safe prior handling in the projection stages,
- held-out calibration.
