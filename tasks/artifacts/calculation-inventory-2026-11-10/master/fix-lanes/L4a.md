# L4a · NST SQL views, migrations and NST game-log ingest

**Stage 1 (definitions).** Depends on: nothing. Feeds: L4b (views and game predicate), L9a and L11 (`nhl_team_data`), L2 (OZS% SQL copy). Read `_COMMON.md` first. **Every migration is written and tested locally only; applying it is a production step for Chef and TJ.**

## Owned files
- New migration files under `supabase/migrations/` named `20261111xxxxxx_fix_<topic>.sql` (one topic per file). Check which tree `web/lib/supabase/supportedBaselineMigration.test.ts` and `tasks/TASKS/repository-audit-remediation/migration-authority.json` expect before adding; keep that test green. Do **not** edit existing applied migrations.
- `web/sql/functions/**`
- `web/pages/api/v1/db/update-nst-gamelog.ts` and its tests.

## Findings
| ID | P | Reach | Fix (corrected wording) | Source |
|---|---|---|---|---|
| W2-P0-1 | P0 | live | `nst_seasonlong_*_counts(_oi)` views include playoff and mis-tagged games: regular season only, game type 2 (decision 69). A type filter cannot repair rows whose GP > 1: the view test must include an aggregate row that looks like a regular-season game and prove it is rejected or reconstructed. | W2 §W2-1 A D1 (C7); decision 69 |
| W2-1 F1 | P0 (root) | live | `update-nst-gamelog.ts` admits a GP = 2 row as one game and stamps the requested date and season: validate requested vs returned scope, keep canonical appearance identity, **quarantine** aggregate rows (never write them as a game). | W2 §W2-1 A D1 F1 |
| W2-1 D3, PR-SQL-3 | P1 | cond. | Game Score RPC filters `wgo_skater_stats` by `season_id` only; the 20242025 label carries 2010–2017 dates: filter by game id/date within the season and game type. The chart calendar (`fetchWigoPlayerStats.ts:925-944`) is L4b's reader of the same fix. | W2 §W2-1 A D3 |
| W2-1 D4, PR-SQL-2, F3 | P1 | live (masked) / cond. | `nhl_team_data` returns one row per NST season: expose an exact season key (and as-of date) so readers join on season identity, not inferred GP. Not "deterministic first-row tie-break". | W2 §W2-1 A D4, B |
| W2-1 PR-SQL-1 | P1 | cond. | `COALESCE(ixg,0)` with independent `SUM(toi)`; `player_totals_unified` divides WGO counts by NST-only TOI; `bool_or(has_nst_counts)` = any support: pair counts and exposure per game; publish a rate only on complete support or as a labelled covered subset (rule 13). | W2 §W2-1 B |
| W2-1 D9 | P2 | live | OZS% / OZFO% in `nst_seasonlong_*_rates_oi` include neutral zone; zero denominators return 0/50/100: OZ/(OZ+DZ), null on zero; `goalie_weekly_aggregates` league SV% null when all shots zero. | W2 §W2-1 A D9; decision 9 |
| W2-1 D8, D10–D14, D16 | P2 | mixed | `get_skaters_avg_stats` game-type filter; `player_totals_unified` columns; `gameOutcomes` final-state filter and **team loss ≠ goalie credited loss**; current-team `percent_games` (decision 16); inventory only for D16 (no deletion). D15 Human Mock ADP **withdrawn**; M-SUS-001 weight argument **withdrawn**. | W2 §W2-1 A |
| W2-1 D6 | P1 | live | Game Score goal terms are all-strength: label "FHFH Game Score (all-situation goals)" with its formula (Q2); no 5v5 claim. | W2 §W2-1 A D6 |
| W2-1 D7 (forward slot) | P1 | live | Lineup deployment share labels forwards by current roster position; two centres on one line: use line slot. Denominator per **decision 86**: publish both labelled measures (share of games with a recorded PP-unit assignment; share of games dressed), each with its verified denominator and coverage; missing assignments stay unknown. | W2 §W2-1 A D7 |
| W3-7 D9 / A5 | P2 | dormant | `rpc_sko_player_series` streaks: only if kept in use (no caller); runs after baseline, scale and onset are defined; tests L = 1–3, interrupted runs, zero MAD. Default: leave, record as deferred. | W3 §W3-7 A D9, B A5, E #6 |
| BA W1-2 B | P2 | — | Migration `20261109015836` header still reads DRAFT though applied 2026-11-09: header comment fix is **not allowed** in an applied file; note it in the authority JSON instead (ask Chef). | BA §W1-2 B |

## Decisions and rules
9, 10, 16, 40, 69; rules 5, 6, 13, 14, 17, 19, 21. **Traps:** a team/date join is safe only after game identity and historical team are proven; never delete views or RPCs (rule 6). Definition equivalence needs full function identity, not whitespace-stripped hashes.

## Readers and tests
Readers: WiGO percentiles and ratings (L4b), radar (L4b), Roster Matrix (L3), Game Score chart (L4b), FORGE team prior and RSO bridge prior (L9a, L11), sustainability league reference (L7). Tests: SQL fixtures in a local Postgres (or the repo's existing SQL test harness; find it with `rg -l "supabase start|pg_tmp|pglite" web`) proving playoff and aggregate rows are excluded; parser unit tests for the GP = 2 row; `nhl_team_data` both input permutations, a one-game lag against an old exact match, missing current season, historical cutoff.

## Production steps (TJ approval, one migration per pop-up)
Each new migration file (NST season views, Game Score RPC, `nhl_team_data`, `goalie_weekly_aggregates`, `player_totals_unified`, `gameOutcomes`, others) applied singly via the IPv4 session pooler with psql and recorded in `schema_migrations` and `migration-authority.json`. The `wgo_skater_stats` 2010–2017 label repair (data repair, own approval). Physical-totals migration `20261020211500` only after its season/cutoff guard (Q3, with L9a). Unapplied index migrations `20261109210000`, `20261109213000` (Chef confirms still needed).

## Tier B questions
Answered 2026-11-11: decision 85 (Q2 house Game Score, labelled), decision 86 (Q4 both PP share measures), decision 87 (Q40 leave trigger for cleanup).

## Out of scope
NST admission cadence (decision 14: `web/lib/cron/nstRateLimitPolicy.ts` and `web/lib/nst/**` admission are Codex/coordination); WiGO TS readers (L4b); applying anything.

## Done
Migrations and parser fix written with local tests; each migration's apply plan (file, readback query, rollback) in your report for Chef.
