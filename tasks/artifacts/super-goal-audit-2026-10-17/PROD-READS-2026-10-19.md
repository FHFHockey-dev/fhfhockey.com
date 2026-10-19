# Super Goal audit: production reads, 2026-10-19

TJ approved this batch in chat on 2026-10-19 ("Audit: yes"). It ran from about 05:19Z to 05:29Z, well before the 13:00Z hard stop.

**Budget used:**
- **SQL:** 20 of 20 `execute_sql` calls on `fyhftlxokyjtpndbkfse`. Every call was a single SELECT. Three of them errored: two statement timeouts (57014) and one wrong column name. They count against the budget and are listed under Skipped.
- **Logs:** 1 of 1 `query_logs` call.
- **Vercel:** 8 of 8 read-only CLI GETs: 1 production-deployment list, 2 env-name reads and 5 deployment records. The second env read was an accidental duplicate. Its output was discarded unread, and it consumed one GET.

**Not done:** no application HTTP requests, cron or ETL calls, NST or Yahoo traffic. No env values were requested or printed; only key, target and type were kept. User-related tables were read only as catalog or policy metadata.

**Connector status:** no "not responding" failures. The two timeouts were Postgres `statement_timeout` errors, and each was re-planned once as a lighter query.

Verdict key: **confirmed** means production matches the audit finding (or the claim, where the row tests a claim). **Contradicted** means production disagrees with it. **Inconclusive** means the read could not settle it.

---

## Current production deployment (shared context)

**GET 1.** `vercel api "/v6/deployments?target=production&limit=12&teamId=…"`, projected to uid, name, state, sha and ref.

- The current production web deployment is `dpl_6ccUfnYgqnueRsNEbSESqZmSbzPu` on project `fhfhockey` (`prj_LV0wbwH5gRjOsZlowzEFNGRuX7Lw`). It is READY, from `master` @ `457435eb3`, created 2026-10-16 04:52Z.
- The companion projects `functions-fhfhockey`, `cms-fhfhockey` and `fhfhockey.com` were CANCELED (ignored) for the same SHA, and also for `90d3d5963` and `59be1dbff`.
- `fhfhockey` production at `59be1dbff` (2026-10-13 02:22Z) is in **ERROR**. It was followed by `90d3d5963`, which is READY.

---

## G1: auth and Draft Ranker

### G1-d1. Token vault columns and user FKs (rows 7.1, 12.2)

**Question:** Does `private.connected_account_tokens` store only Vault secret ids, with no plaintext token columns? Are there 11 `%_user_fk` constraints?

**Query:** SQL #2 (information_schema.columns for the table) and SQL #12:
```sql
count(*) from pg_constraint where conname like '%\_user\_fk'
string_agg(column_name) ... where table_schema='private' and table_name='connected_account_tokens'
  and column_name ilike '%token%' and column_name not ilike '%secret_id' and column_name <> 'token_type'
```

**Result:**
- The columns include `access_token_secret_id` and `refresh_token_secret_id`. No plaintext token column was found.
- `user_fk_count` = 11.
- The `private` schema exists in production.

**Verdict:** confirmed.

### G1-d2. Browser grants and RLS on the provider tables (P2-7, "problem 5")

**Question:** Do `anon` and `authenticated` hold full grants on the provider tables? Does RLS allow a user to insert a `connected_accounts` row claiming another person's identity? Is the restrictive `user_entitlements` policy present?

**Query:** SQL #12 (`information_schema.role_table_grants`, `pg_class.relrowsecurity`, `pg_policies` counts) and SQL #13 (`pg_policies` qual and with_check for `connected_accounts` and `user_entitlements`).

**Result:**
- **Grants:** `anon` and `authenticated` each hold DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE and UPDATE on `connected_accounts`, `user_entitlements`, `external_leagues`, `external_teams`, `provider_sync_runs` and `user_provider_preferences`.
- **RLS:** enabled on all six tables, not forced.
- **Policies:** each table has 4 permissive policies for the `public` role. `user_entitlements` has 5, including the RESTRICTIVE `user_entitlements_draft_pro_service_only`. That policy blocks `complimentary`, `draft_pro` and `patreon_supporter` rows.
- **The gap:** the `connected_accounts_insert_own` WITH CHECK is only `auth.uid() = user_id`. Nothing constrains the provider identity columns, so a signed-in user can insert their own row naming any provider account. Uniqueness constraints were not read.
- **Fix not applied:** the local fix migration `20261018184229_restrict_provider_linkage_browser_writes` is **not** in the production ledger (see G1-d3).

**Verdict:** confirmed. The identity-claim path is open live, subject to any unique constraint on the provider id, which was not read.

### G1-d3. Migration ledger parity (runbook C0002, 35.3, NSR NEW 4.1 etc.)

**Query:** SQL #13. It compares `supabase_migrations.schema_migrations` with the 85 local versions in `supabase/migrations/`.

**Result:**
- The production ledger has 75 rows. The latest is `20261017183611`.
- 11 production versions since 2026-07-16 have no matching local file.
- **21 local versions are not applied in production:** 20260818150256, 20260820013124, 20260820014700, 20260820031500, 20260820041500, 20260820050000, 20260820052000, 20260820053000, 20260826123000, 20260826131500, 20260826133000, 20260828130824, 20260828142331, 20260917133519, 20261002021651, 20261002134400, 20261004181455, 20261011115124, 20261011160000, 20261018184229 and 20261018190022.

**Verdict:** contradicted. The ledger and the repository are not in parity.

### G1-d4. Draft Ranker env flags (DR-072.x, 3.19)

**Query:** GET 2, `/v10/projects/prj_LV0wbwH5gRjOsZlowzEFNGRuX7Lw/env`, filtered with jq to key, target and type only.

**Result:**
- **Present:** `DRAFT_RANKER_ENABLED`, `DRAFT_RANKER_HOMEPAGE_ENABLED`, `DRAFT_RANKER_ROLLOUT_STAGE` and `DRAFT_RANKER_STAFF_USER_IDS`. All are production-only and sensitive.
- **Absent:** `DRAFT_RANKER_DISCOVERY_ENABLED`, `DRAFT_RANKER_COMMUNITY_CONTRIBUTION_ENABLED`, `COMMUNITY_DRAFT_RANKINGS_ENABLED`, and any `DRAFT_RANKER_*BETA*` allowlist variable.

**Verdict:**
- Confirmed that the discovery, community and beta variables are unset.
- Inconclusive whether `ROLLOUT_STAGE` equals `authenticated`, because values were not read.

### G1-d5 to d8

Hosted Auth config, advisors, tracked env files and `/api/createComment` logs: **skipped** (see the end of this file).

---

## G2: cron, ops and lines

### G2-d1. CRON_SECRET and Vault conversion (NSR/EML NEW 10.x, 9.0)

**Query:** SQL #4. For each job it checks the command shape without printing the command:
- `command ~* 'bearer\s+[A-Za-z0-9_\-\.]{16,}'` (a literal bearer token)
- `command ilike '%vault%'`

GET 2 supplied the env names.

**Result:**
- 0 active jobs carry a literal bearer token.
- 50 of 58 active jobs reference Vault. Jobs 394, 396 and 397 do not, and appear to be SQL-only.
- `CRON_SECRET` exists for production, preview and development (encrypted).

**Verdict:**
- Confirmed: no literal secrets, and the variable is present.
- Not checked: 401/200 parity, because the probe was skipped.

### G2-d3. Exact deployments (NSR NEW 45/49/51/53)

**Result:** see the shared deployment context and the dpl reads under G5a, G5b and G6. Every cited deployment is a superseded July production deployment.

**Verdict:** inconclusive per row. The records exist, but each row's specific claim needs the row text.

### G2-d4. CCC::C0094 build log

**Result:** skipped, because build logs are outside this batch. Note that `fhfhockey` production `dpl_e5bYjw8qLrQTW424aCidErNMpoXz` (`59be1dbff`, 2026-10-13) is in ERROR.

**Verdict:** inconclusive.

### G2-d5. Lines SQL applied (GDL::C0066, CCC::C0034)

**Query:**
- SQL #1: `to_regclass` for `lines_ccc`, `line_source_snapshots`, `line_source_ifttt_events` and `lines_ccc_ifttt_events`.
- SQL #14: index count on those tables, and `has_function_privilege` on `upsert_line_combinations_from_source`.

**Result:**
- All four tables exist, with 26 indexes between them.
- The RPC exists. `anon` and `authenticated` cannot execute it; `service_role` can.

**Verdict:** confirmed.

### G2-d6. IFTTT receiver secrets (GDL NEW 13–22)

**Query:** GET 2 (names only).

**Result:** `IFTTT_CCC_WEBHOOK_SECRET`, `IFTTT_GAMEDAYGOALIES_WEBHOOK_SECRET`, `IFTTT_GAMEDAYLINES_WEBHOOK_SECRET` and `IFTTT_GAMEDAYNEWSNHL_WEBHOOK_SECRET` are all present for production and preview (sensitive).

**Verdict:**
- Presence is confirmed.
- Rotation and the applet headers are inconclusive.

### G2-d7. Sustainability coverage (P1-1)

See G6 U-1. **Verdict:** confirmed.

### G2-d8. update-shift-charts failures (P1-2)

**Query:** SQL #5.
```sql
select run_time::date, status, rows_affected, left(details::text,160) from cron_job_audit
 where job_name ilike '%shift%chart%' order by run_time desc limit 16;
count(*) ... where details::text ilike '%Conflicting relationship position%';
count(*) ... where details::text ilike '%Pettersson%';
```

**Result:**
- 16 of 16 runs from 2026-10-03 to 2026-10-18 are `failure`. Most have `rows_affected` = 0; 10-06 has 40 and 10-12 has 38.
- 7 audit rows contain "Conflicting relationship position".
- 0 rows name "Pettersson". The detail text doesn't say which player caused the failure.
- `cron_job_report` shows the pg_cron dispatch "succeeded" 14 of 14, so dispatch is not the failure point.

**Verdict:**
- Confirmed: the job fails every day.
- Inconclusive: the stated duplicate-Pettersson cause, which the stored details do not show.
- The relationship-position closure (DRM NEW 48.0, 4.13) is **contradicted** by the 7 rows.

### G2-d9. cron.job active count (5.1.1)

**Query:** SQL #4 (`count(*)` where active, total count, and the list of active ids).

**Result:**
- 58 jobs are active, out of 72.
- Active ids: 1, 2, 3, 5, 6, 7, 8, 9, 14, 16, 23, 24, 43, 44, 76, 79, 99, 104, 106, 201, 220, 231, 233, 247, 248, 271, 272, 278, 279, 283, 305, 318, 321, 323, 326, 327, 328, 329, 361, 363, 364, 365, 374, 381, 383–394, 396 and 397.
- 394, 396 and 397 are active.
- 234 (`daily-cron-report`) is **inactive**.

**Verdict:**
- Confirmed: 58 active, as the audit found, against 55 in the schedule doc.
- Confirmed: job 234 is inactive, so EML C0005/C0007 and SCH C0042 are false.

---

## G3: rankings and rolling metrics

### G3-d1. Trends rolling fields pruned (P1-3)

**Query:** SQL #9.
```sql
select season, strength_state, (updated_at >= '2026-06-11') written_after_0611, count(*),
  count(goals_avg_last5), count(goals_avg_season), count(goals_avg_last3),
  count(shooting_pct_last5), count(goals_total_last5)
from rolling_player_game_metrics where player_id = 8478402 and season >= 20252026 group by 1,2,3;
-- plus, for strength_state='all' and game_date >= '2026-10-14': count(*) and count(goals_avg_last5) per date
```

**Result:**
- **Before 2026-06-11:** rows for player 8478402 in season 20252026 (`all`, `ev`, `pk`, `pp`, 80 rows each) have `goals_avg_last5` populated in 72–78 of 80 rows.
- **5v5 rows:** every one has `*_avg_*` = 0 populated, whether written before 06-11 (38 rows) or after (42 rows). The ratio column `shooting_pct_last5` and the totals are fully populated.
- **2026-10 all-strength rows:** 10-14 (4 rows), 10-16 (6) and 10-17 (14) all have `goals_avg_last5` = 0 populated.
- **Schema:** the wide table has 1,114 columns. 729 of them match the pruned patterns (`_avg_`, `_last3`, `_all`, `_3ya`, `_career`).
- **Side observation:** only 4–14 all-strength rows per in-season date suggests very low writer coverage. Not investigated.

**Verdict:** confirmed. The Trends HTML fetch was skipped, as no application requests were allowed.

### G3-d2. PP Points/60 season window

**Query:** SQL #11. Counts `pp_points_avg_season` and `pp_toi_seconds_avg_season` non-null for pp rows on 2026-10-17 and 2026-04-16. The original form timed out in SQL #10.

**Result:**
- 2026-10-17: 10 of 14 rows populated.
- 2026-04-16 (end of the 2025-26 season): 0 of 216 rows populated.

**Verdict:** inconclusive. The field is populated on new rows but empty on the late 2025-26 rows.

### G3-d3. Ranking relations

**Query:**
- SQL #17: `reltuples` estimates, plus `order by snapshot_date desc limit 1` per table.
- SQL #12: grants, RLS and policies, and `has_function_privilege` on `truncate_rolling_player_game_metrics`.

**Result:**

| Table | Latest snapshot | Est. rows |
|---|---|---|
| `entity_metric_rankings` | 2026-04-16 | ~52.8k |
| `skater_composite_ratings` | 2026-04-16 | ~3.1k |
| `team_unit_toi` | 2026-06-22 | ~12.9k |

- **Grants:** `anon` and `authenticated` hold full write grants (including TRUNCATE) on `entity_metric_rankings` and `skater_composite_ratings`, and SELECT only on `team_unit_toi`.
- **RLS:** enabled on all three. The first two have 0 policies, so the API denies access. `team_unit_toi` has one SELECT policy for anon and authenticated.
- Neither `anon` nor `authenticated` can execute the truncate function.
- No ranking snapshot has been written for 2026-27.

**Verdict:**
- Confirmed: RLS is on and the truncate function is not executable by browser roles.
- The full table grants on two ranking tables are a hardening gap. RLS makes them non-exploitable through the API, but TRUNCATE is not subject to RLS. Whether PostgREST could reach TRUNCATE is not established.

### G3-d4. Percentile semantics (ecosystem 17.2, 17.3)

**Query:** SQL #18.
```sql
min(percentile), max(percentile) from entity_metric_rankings
 where snapshot_date='2026-04-16' and metric_key='goals_per_60' and peer_group_type='all_skaters'
```

**Result:** n = 3,104, min = 0, max = 100.

**Verdict:** confirmed.

### G3-d5. True 5v5 volume (22.1)

**Query:**
- The original season-wide count timed out (SQL #10).
- The substitute, SQL #11, counted 5v5 and all-strength rows between 2026-04-01 and 2026-04-16.

**Result:** 4,500 5v5 rows and 4,500 all-strength rows.

**Verdict:** inconclusive for the exact season count. 5v5 rows are fully populated relative to all-strength rows.

### G3-d6. Postgres errors

**Query:** the one `query_logs` call, on `postgres_logs`, 2026-10-18 05:30Z to 2026-10-19 05:29Z. The API caps the window at 24 hours, so the requested 7-day window was not possible. It grouped messages matching `does not exist` or `invalid input syntax for type`.

**Result:**
- "goals does not exist": **0** in 24 hours.
- `invalid input syntax for type smallint: "null"`: **9** occurrences, from 10-18 07:43Z to 10-19 02:44Z.
- The only other match was this audit's own wrong-column error.

**Verdict:**
- "goals does not exist": inconclusive. It is absent for 24 hours; 7 days was not readable.
- The `smallint "null"` cast is confirmed as still occurring.

### G3-d9. Cron job 278 parameters

**Query:** SQL #4, which checks for `season=` and `fullRefresh` in the command.

**Result:** job 278 is active, runs at `15 8 * * *`, and has neither parameter.

**Verdict:** confirmed.

### G3-d7 and G3-d8

Skipped. They need Vercel function logs or application GETs.

---

## G4: underlying stats and site UX

### G4-d1. Final 2025-26 standings (3.6, SOS C0014)

**Query:** SQL #15, on the max date for season 20252026: count, min and max of `games_played`, and counts of `goal_differential`, `home_goal_differential` and `road_goal_differential`.

**Result:** on 2026-04-17, 32 teams, min and max GP both 82, and all three differentials populated for all 32.

**Verdict:** confirmed.

### G4-d2. Team landing freshness (5.3.2)

**Query:** SQL #15. `max(game_date)`, `count(distinct game_id)` and `max(updated_at)` where `strength='allStrengths'` and `score_state='allScores'`.

**Result:** max `game_date` 2026-10-16, 1,432 games, last updated 2026-10-17 22:40Z.

**Verdict:**
- Confirmed: the catch-up is reflected in production.
- Inconclusive: whether the scheduled team rebuild is deployed.

### G4-d3. `team_power_ratings_daily` trend repair (SOS C0033)

**Query:** SQL #15. `count(*)` and `count(*) filter (where trend10 <> 0)` per date over the last 30 days.

**Result:** every date from 10-11 to 10-18 has 32 rows and **0** with non-zero `trend10`.

**Verdict:** inconclusive. It can't be told apart from early-season behaviour (fewer than 10 games), but the value is worth a code check.

### G4-d4. Deployment `457435eb`

**Query:** GET 1.

**Result:** `dpl_6ccUf…` is READY and is the current production deployment.

**Verdict:** confirmed. `tsc` was not run, as it is out of scope for production reads.

### G4-d6. Yahoo players (DRAFT C0055)

**Query:** SQL #15. `season, count(*)` from `yahoo_players`.

**Result:** 2025: 1,494 rows. 2026: 1,600. Null season: 1,333.

**Verdict:** confirmed (1,494).

### G4-d5

Skipped, because it needs application requests.

---

## G5a: FORGE model and Start Chart

### G5a-d1. `dpl_HCFwiK4yAPeXUG3QzC3R28NtYvsc`

**Query:** GET 4, `/v13/deployments/dpl_HCFwiK4…`.

**Result:** READY, production, `96ccea804` (`octoberBranch`), created 2026-07-30, alias assigned. It is **not** the current production deployment, which is `457435eb3`.

**Verdict:**
- The record is confirmed.
- The "current production" premise is contradicted.
- The Start Chart GET was skipped.

### G5a-d2 / G5b-d1. Provenance label on `forge_runs` (P1-4)

**Query:** SQL #7.
```sql
select count(*), count(*) filter (where metrics->'input_provenance' ? 'external_fantasy_input_contract'),
  count(*) filter (where ...->>'external_fantasy_input_contract'='excluded_from_native_inputs_v1')
from forge_runs where status='succeeded';
-- plus the 10 most recent runs with the label value
```

**Result:**
- 382 runs succeeded. **0** have the key and **0** have the `excluded_from_native_inputs_v1` label.
- All 10 most recent runs have a null label.
- The latest run (as of 2026-10-05) is `failed`. The latest succeeded run is as of 2026-09-29, and no run has succeeded since 2026-10-01.

**Verdict:** confirmed (P1-4). The release slice's gate would drop every production run.

### G5a-d3. Support payloads

**Query:** SQL #7. `payload_schema_version, count(*), max(game_date)` from `rolling_player_metric_support_payloads`.

**Result:** the table exists with only `payload_schema_version` = 1, 50,101 rows, through 2026-10-17.

**Verdict:** confirmed.

### G5a-d4. Shadow gate dates

**Query:** SQL #7. Distinct `as_of_date` and `actual_date` in `forge_projection_results`.

**Result:** 7,241 rows over 119 distinct dates. The latest `as_of_date` is 2026-04-15, and there are 0 rows since 2026-10-01.

**Verdict:** confirmed. No in-season matched dates, so the 14-date gate remains unmet.

### G5a-d6. Staged migrations

**Query:** SQL #13 (ledger difference).

**Result:**
- `20260828130824_start_chart_yahoo_overlay_reader`: unapplied.
- `20260828142331_recent_team_form_nullable_components`: unapplied.
- `20260828162000_add_sustainability_repair_versions`: **applied**.

**Verdict:**
- Confirmed for the first two.
- **Contradicted** for 20260828162000.

### G5a-d5

Skipped (a repository review artifact, not a production read).

---

## G5b: FORGE dashboards and Trends

### G5b-d1

See G5a-d2. **Verdict:** confirmed.

### G5b-d2. Hosted max rows and goalie trend truncation (4.15, trends 3.1)

**Query:**
- SQL #18. `pg_db_role_setting` for `authenticator`, `anon` and `authenticated`, filtered to `pgrst.%` and excluding secret or key settings.
- SQL #17 and #18. The latest goalie `game_date` and per-metric counts on 2026-10-17.

**Result:**
- The only `pgrst` role override is `pgrst.db_aggregates_enabled=true`. There is no `db_max_rows` override; the hosted API max-rows setting lives in project settings and SQL can't read it.
- The latest goalie trend date is 2026-10-17, with 29 goalies per metric.
- The endpoint GET was skipped.

**Verdict:** inconclusive.

### G5b-d3. CTPI coverage (row 3.2)

**Query:**
- SQL #15. `date`, `count(*) filter (where payload->>'publicationStatus'='approved')` and `count(*)` from `team_ctpi_daily`, latest 3 dates.
- SQL #20. 14 days of `cron_job_audit` for `%ctpi%`.

**Result:**
- **The latest date is 2026-06-15**, with 0 of 32 approved. 06-14 and 06-13 are the same.
- Job 279 (`update-team-ctpi-daily`) is active. The audit shows 14 of 14 `success` in 14 days with `rows_affected` = 0.

**Verdict:** contradicted. CTPI is four months stale and has no approved teams, and the cron reports success while writing nothing. This is a **new finding**, not in the audit's P1 or P2 lists.

### G5b-d4. Cited deployments (5.7.16, C0081, C0083, combo NEW 8.0, 3.13)

**Query:** GETs 5–7, `/v13/deployments/<id>`.

**Result:**

| Deployment | State | SHA | Created |
|---|---|---|---|
| `dpl_vU1c1yvbDQJMXEzK1rLT373Qndwy` | READY, production | `1f9a54d1c` | 2026-07-31 |
| `dpl_2DyH68oEiUhfsakGfRcHMAFdmumA` | READY, production | `589b0241d` | 2026-07-30 |
| `dpl_4q8GM1wqTbHR3NbnxRxAakdLEvJr` | READY, production | `b4aeea8f9` | 2026-07-23 |

All three are superseded. `dpl_9upPoBLks2mqM2ny6KHpHy8tqaHB` and the runtime-error queries were **skipped** because the GET budget ran out.

**Verdict:**
- The three records are confirmed.
- Inconclusive for the runtime-error rows.

### G5b-d5. Cron owners (remediation 3.1, 3.4, 13.0, 15.3, 17.0)

**Query:** SQL #4.

**Result:**
- Active: 44 (`update-wgo-teams`), 279 (CTPI), 283 (`update-team-power-ratings`), 329 (`update-nst-team-stats-all`), 392 (`update-player-trend-metrics`) and 393 (`run-forge-projection-v2-weekly`).
- Inactive: 275 (`update-nst-team-daily`) and 308 (`run-forge-projection-v2`).

**Verdict:** confirmed as the live state. Each row's expected value needs the row text to compare.

### G5b-d6

Skipped, because it needs an application GET.

---

## G6: sustainability, variance and sKO

### U-1. Sustainability player coverage (P1-1)

**Query:** SQL #3.
```sql
select snapshot_date, window_code, count(*), count(distinct player_id), min(player_id), max(player_id),
  count(*) filter (where sustainability_quintile is null),
  count(*) filter (where s_100 is null or s_100<0 or s_100>100 or s_100='NaN')
from sustainability_scores where snapshot_date >= '2026-09-25' group by 1,2 order by 1 desc,2 limit 60;
```

**Result:**
- Every snapshot date from 2026-10-04 to 2026-10-18 has exactly **250** players per window (l3, l5, l10, l20), with player ids 8470613–8479346.
- The exception is **2026-10-16, with 642 players**, ids up to 8486189. That is consistent with a one-off full run or catch-up.
- The latest date, 10-18, has 250 rows for l10.

**Verdict:** confirmed (P1-1). The 0–249 truncation is live.

### U-2. Sustainability jobs (P2-13)

**Query:** SQL #4 (jobs 370, 371, 372, 376) and SQL #20 (14 days of `cron_job_audit` for `%sustainab%`).

**Result:**
- Jobs 370, 371, 372 and 376 are all **inactive**.
- Their endpoints still ran successfully over the last 14 days through another trigger:

  | Endpoint | Successes |
  |---|---|
  | `/api/v1/sustainability/rebuild-score` | 42 (15,568 rows) |
  | `rebuild-window-z` | 42 |
  | `rebuild-trend-bands` | 56 |
  | `rebuild-sustainability-priors` | 14 |
  | `rebuild-baselines` (job 326) | 13, plus 1 failure on 10-17 |

**Verdict:**
- Confirmed: the pg_cron jobs are inactive.
- Contradicted: "doesn't run" for the score, window-z and trend-band steps, which do run.
- See U-3 for the drift and quintile outputs.

### U-3. Quintiles, distribution snapshots and value range

**Query:** SQL #3. Null quintiles, out-of-range `s_100`, `max(snapshot_date)` from `sustainability_distribution_snapshots`, and the `reltuples` estimate (SQL #18).

**Result:**
- `sustainability_quintile` is null on **100%** of rows since 2026-09-25.
- `sustainability_distribution_snapshots` has **no rows** (max date null).
- 0 out-of-range or NaN `s_100` values were found in that window.
- `sustainability_scores` holds about 263k rows (estimate).

**Verdict:**
- Confirmed: no quintile or drift output is produced. The nightly drift check is not effective.
- Confirmed for the dates read: values are finite and in [0, 100].
- Inconclusive: the 247,024 and 249,520 counts, because only an estimate was read.

### U-4. Migrations and run-control RPCs (barometer 9.x, sKO 2.2)

**Query:** SQL #13 (ledger) and SQL #14 (`has_function_privilege` on the sustainability RPCs).

**Result:**
- `20260725223034`, `20260728225806` and `20260729205048` are all **applied**.
- `claim_sustainability_recompute_queue`, `advance_sustainability_recompute_queue`, `finalize_sustainability_score_snapshot` and `activate_sustainability_config` are all service-role-only. `anon` and `authenticated` cannot execute them.

**Verdict:** confirmed.

### U-5. `dpl_5uhfJXZagLhhhDLq2brn56xJpBTa` and `dpl_4q8GM…`

**Query:** GET 8, plus GET 7 for `dpl_4q8GM…`.

**Result:** `dpl_5uhfJ…` is READY, production, `2a1438925`, created 2026-07-22. `dpl_4q8GM…` is as shown in G5b-d4.

**Verdict:**
- The records are confirmed.
- The 401/401/405 probes were skipped.

### U-8. Parlay (13.1, 13.2)

**Query:**
- GET 2 (env names).
- SQL #18. `source_rank, count(*)` from `market_prices_daily`, where `provenance` or `source_payload` contains "parlay". The `provider` column does not exist.

**Result:**
- **`PARLAY_API_KEY` is not present** in the `fhfhockey` project env.
- 54 rows with `source_rank` = 1 mention parlay.

**Verdict:**
- 13.1 (key present) is **contradicted** for the web project. Shared or team-level env was not read.
- 13.2 is inconclusive.

### U-9. sKO receipts

**Query:** SQL #18 (`predictions_sko` counts) and SQL #4 (jobs 321 and 327).

**Result:**
- `predictions_sko` has 21,736 rows. The latest `as_of_date` is 2026-10-18, with 10,976 rows since October.
- **851 rows exist for 2026-03-22.**
- Jobs 321 and 327 are both active.

**Verdict:**
- The jobs and the 851 figure are confirmed.
- "Written and rolled back" is inconclusive. The 851 rows exist now, which fits either a restore or a rollback that never happened.

### U-6 and U-7

Skipped.

---

## G7: xG and game prediction

### G7-d1. Prediction and xG crons (P2-5, problem #4)

**Query:** SQL #4 (jobname matches `game-predictions%` and `%xg%`).

**Result:**
- Jobs 383–386 (`game-predictions-forecast-h7/h3/h1/h0`) and 387 (`game-predictions-score-recent`) are **active**.
- No xG job exists.

**Verdict:** confirmed. The jobs are active, contradicting 5.7.9 and 14.0, which call them inactive.

### G7-d2. Production model rows (C0104, 3.14)

**Query:** SQL #6.

**Result:**
- 8 rows in `game_prediction_model_versions`, all `candidate`.
- **0 `production` rows.**

**Verdict:** confirmed.

### G7-d3. Forecast writes nothing while reporting success (P2-5)

**Query:** SQL #6 (`game_prediction_outputs` counts) and SQL #20 (14 days of `cron_job_audit` for `game-predictions%`).

**Result:**
- 0 outputs since 2026-10-01. The table holds 94 rows in all, the last computed 2026-09-28.
- `game-predictions-forecast` logged **70 of 70 `success`** in 14 days.
- `game-predictions-ingest-espn-odds` logged **42 failures** in 14 days, the last at 10-18 21:10Z.

**Verdict:**
- Confirmed (P2-5).
- The ESPN-odds failures are an additional observation.

### G7-d4. xG champion and leakage features (P2-6, C0159)

**Query:** SQL #6, reading `nhl_xg_model_registry` with `selected_features::text ilike '%missReasonBucket%'` and `'%isShortSideMiss%'`.

**Result:**
- **Champion:** `logistic_l2-s20252026-p1-st1-f1-cfg9bac2706` is approved, active and `is_champion`, with alias `champion`. Its selected features **include both `missReasonBucket` and `isShortSideMiss`**.
- **Corrected candidate:** `…cfg2afcf561` (`corrected-shadow`, candidate, `model_approved=true`) has neither feature.
- `cfgf81a5112` is **not** in the registry; there are only 2 rows.
- `NHL_XG_MODEL_ARTIFACT_PATH` is absent from the project env.

**Verdict:**
- Confirmed (P2-6): the live champion uses the leaky features.
- The "`cfgf81a5112` stays eligible" part is contradicted, because that artifact is not registered.
- The artifact path is inconclusive; the code default is presumably used.

### G7-d5. Atomic promotion migration (C0116, C0117)

**Query:** SQL #6, checking `pg_proc` and `pg_indexes`.

**Result:** `promote_game_prediction_model_version_atomic` exists (1), and so does the `game_prediction_model_versions_one_production_per_model` index (1).

**Verdict:** confirmed (applied).

### G7-d6. Flurry-adjusted xG columns (C0163, C0164)

**Query:** SQL #20. Columns matching `flurry_adjusted_xg%`, plus a ledger check for `20260712234959` (SQL #13).

**Result:**
- **Columns found in 4 tables, not 6:**

  | Table | Columns |
  |---|---|
  | `nhl_xg_goalie_game_aggregates` | 1 |
  | `nhl_xg_goalie_rolling_aggregates` | 1 |
  | `nhl_xg_team_game_aggregates` | 2 |
  | `nhl_xg_team_rolling_aggregates` | 2 |

- `20260712234959` is not in `supabase_migrations` (it may belong to another migration tree).
- Population counts were not read.

**Verdict:** inconclusive.

### G7-d7. Metrics and history (C0066, C0068, C0111)

**Query:** SQL #6.

**Result:**
- `game_prediction_model_metrics`, max evaluated games per version:

  | Model version | Feature set | Max games | Rows |
  |---|---|---|---|
  | v6 | v4 | 31 | 55 |
  | v6 | v5 | 0 | 98 |
  | v4 | v2 | 0 | 27 |
  | v1 | v1 | 0 | 1 |

- `game_prediction_history` has **277 rows**, not 53.

**Verdict:** inconclusive. The table has grown, so the 53-row hash can't be checked against current data.

### G7-d8

Skipped (401 probes).

---

## G8: Draft, Yahoo, cleanup and DRM

### Deployments (NEW 30, 41, 46, 50; YH NEW 9.x)

**Result:** see the shared deployment context. Current production is `457435eb3`.

**Verdict:** inconclusive per row.

### Migrations

**Query:** SQL #13.

**Result:** 20260720105524, 20260721013821, 20260722010355, 20260730091500, 20260723040553 and 20260725200808 are all **applied**.

**Verdict:** confirmed.

### Yahoo writer RPC privileges

**Query:** SQL #14.

**Result:**
- All Yahoo writer and lease RPCs deny execute to `anon` and `authenticated`, and allow `service_role`: `upsert_yahoo_players_atomic`, `upsert_yahoo_players_v3`, `replace_yahoo_*_snapshot`, `claim_yahoo_*`, `consume_yahoo_oauth_transaction` and others.
- Two exceptions are expected:
  - `verified_yahoo_player_identities_read` is executable by `anon` and `authenticated`; it is a read.
  - Two trigger functions are not executable by `service_role`.

**Verdict:** confirmed.

### Materialization state tables

**Query:** SQL #12.

**Result:** `projection_game_materialization_status` has RLS enabled and **forced**, with 0 policies, so it is service-only.

**Verdict:** confirmed. The completed-row count was skipped because the guessed `status` column does not exist (SQL #19 errored).

### Scheduler state

**Query:** SQL #4.

**Result:**

| Job | Name | State | Notes |
|---|---|---|---|
| 16 | `update-shift-charts` | active | |
| 104 | `update-pbp` | active | timeout_milliseconds 100,000, i.e. 100 s, under the 210 s budget |
| 106 | `update-yahoo-players` | active | no `gameId=465` |
| 234 | daily cron report | inactive | |
| 308 | | inactive | |
| 393 | | active | |

**Verdict:** confirmed (308 inactive, 393 active, 106 clean, 234 disabled).

### Relationship-position failures

**Result:** see G2-d8. 7 `cron_job_audit` rows contain "Conflicting relationship position".

**Verdict:** confirmed (failures exist), which **contradicts** DRM NEW 48.0.

### Shift-chart invalid positions (32,397 legacy-invalid rows)

Skipped, because the SQL budget was exhausted.

---

## Verdict tally

Counted once per read above. A read with two parts can count in two columns.

| Verdict | Count |
|---|---|
| Confirmed | 36 |
| Contradicted | 9 |
| Inconclusive | 19 |
| Skipped | 22 |

The contradicted reads are:
- the migration ledger
- G2-d8 / DRM 48.0 (relationship position)
- G5a-d1 (current-production premise)
- G5a-d6 (20260828162000)
- G5b-d3 (CTPI)
- U-2 "doesn't run"
- U-8 / 13.1 (`PARLAY_API_KEY`)
- G7-d4 (`cfgf81a5112`)
- G8 relationship position

**P1 outcomes:**
- **P1-1:** confirmed.
- **P1-2:** confirmed. The failure is live; the Pettersson cause is not visible in the audit details.
- **P1-3:** confirmed.
- **P1-4:** confirmed. 0 of 382 succeeded runs carry the label.

**New findings outside the audit:**
- CTPI is stale since 2026-06-15 while job 279 reports success with 0 rows.
- `game-predictions-ingest-espn-odds` has failed 42 times in 14 days.
- No `forge_runs` has succeeded since 2026-09-29; the 10-05 run failed.
- Only 4–14 all-strength rolling rows are written per in-season date.
- The 10-13 production deployment `dpl_e5bYjw8…` is in ERROR.
- The local fixes `20261018184229` (provider linkage) and `20261018190022` (token vault) are unapplied in production.

---

## Skipped reads and why

1. **Application HTTP requests and 401/405 probes:** G2-d1, G3-d1 HTML, G3-d7, G3-d8, G4-d5, G5a-d1 Start Chart, G5b-d2 goalie-power, G5b-d6, U-5, U-6, G7-d8 and the G8 unauthenticated GETs. Excluded by the bounds; no application requests.
2. **G1-d5 hosted Auth config and G1-d6 advisors:** not among the approved read types (only `execute_sql`, one log call and Vercel GETs).
3. **G1-d7 tracked env files:** a local file inspection for Chef or the owner, not a production read.
4. **G1-d8 `/api/createComment` volume:** Vercel runtime logs and Sanity are outside the approved read types.
5. **G2-d4 build log (CCC C0094):** build logs are outside the approved GETs.
6. **G2-d6 IFTTT applet headers and the provider thread:** external service, out of scope.
7. **G5b-d4 `dpl_9upPoBLks2mqM2ny6KHpHy8tqaHB` and runtime-error metadata:** the 8-GET budget ran out. One GET went on an accidental duplicate env-name read, whose output was discarded.
8. **G5a-d5 reviewer record:** a repository artifact, not a production read.
9. **G3-d2 and G3-d5 original season-wide forms:** statement timeout (SQL #10). They were re-planned once as the narrower SQL #11 rather than retried as-is.
10. **G3-d3 per-table exact counts and the goalie per-metric group-by:** statement timeout (SQL #16). Re-planned once as SQL #17, using `reltuples` estimates and latest dates.
11. **G8 `projection_game_materialization_status` completed count:** SQL #19 errored because the `status` column does not exist. It was not retried, to preserve budget.
12. **G8 shift-chart invalid `primary_position`/`player_type` count, U-7 NEW 15 repair counts and the inverse manifest, U-8 lineup archive counts, G7-d6 flurry population counts, and exact sustainability counts (C0077, NEW 13.0):** the SQL budget of 20 was exhausted.
13. **Postgres logs over 7 days:** the logs API caps a query at 24 hours, and only one log call was allowed, so only 24 hours were read.
14. **Hosted PostgREST `max_rows`:** not readable through SQL; it lives in project API settings.

## Cross-check reads E-1 to E-6 (2026-10-19, ~12:30–12:40Z, Chef `local_4317ea20`)

**Approval:** TJ, relayed by `local_08a0bf1c`: "Approved: have the Chef run read-only checks E-1 to E-6 from CROSS-CHECK-AUDIT.md, one at a time with an 8 s statement timeout, outside scheduled runs, and record the results in PROD-READS-2026-10-19.md."

**Method:**
- E-3 was later held: "I need to look into the nst-team-stats one. pause that one only until I can confirm".
- Run after the FORGE v1 live run ended (LEDGER §13). Each SQL check was one SELECT inside `begin read only; set local statement_timeout = '8s'`, against `fyhftlxokyjtpndbkfse`, sequentially. None timed out.
- E-6 used the Vercel CLI (`GET /v10/projects/fhfhockey/env`), printing names, targets and types only. Values were dropped before printing.
- No application, cron or API requests, no writes.

### E-1 (A-01): pipeline stages over the last 4 days

**Query:** `select run_time, job_name, status, details->>'statusCode', left(details->>'response',300) from cron_job_audit where run_time > now()-interval '4 days' and job_name in ('run-rolling-forge-pipeline','run-projection-v2','update-shift-charts','/api/v1/db/update-rolling-player-averages','/api/v1/db/ingest-projection-inputs') order by run_time;`

**Result:** 8 rows, all failures.

| Date | `update-shift-charts` (07:45Z) | `run-projection-v2` (10:12Z) |
|---|---|---|
| 10-16 | 500 "Conflicting relationship position for player 8483678", rowsAffected 0 | 422 "Preflight freshness checks failed" |
| 10-17 | same, rowsAffected 0 | 422, same |
| 10-18 | same, rowsAffected 0 | 422, same |
| 10-19 (first run on R2 code, 07:45Z) | 500 **"Invalid relationship roster scope for game 2026010007"**, rowsAffected 39, rowsVerified 39 | 422, same |

- No rows match `run-rolling-forge-pipeline`, `/api/v1/db/update-rolling-player-averages` or `/api/v1/db/ingest-projection-inputs` under those exact names. Those stages audit under other names, or they write nested rows only.
- The 300-character truncation cuts off the failing gate's key in the 422 preflight.

**Verdict: confirmed (A-01).** The pipeline is still failing.
- R2's namesake fix did clear the 10-16 to 10-18 Pettersson conflict: today's run wrote 39 verified rows before stopping.
- Shift charts now fail on a **new** error, a roster-scope check for game `2026010007`, which is a type-01 (preseason) game id.
- `projection_input_ingest` was **not** reached, because `run-projection-v2` fails preflight first.

**Follow-up:**
- one read of today's full `run-projection-v2` preflight `gates` array, to name the failing gate
- a code look at the relationship-roster-scope check for preseason game types

### E-2 (A-05): rolling-metric coverage against WGO, 2026-10-14..17

**Query:** per date, `count(*)` of `wgo_skater_stats` (`date`), `count(*)` and `max(player_id)` of `rolling_player_game_metrics` (`game_date`, `strength_state='all'`).

**Result:**

| Date | WGO skater rows | rolling `all` rows | max player_id |
|---|---|---|---|
| 10-14 | 72 | 4 | 8474574 |
| 10-15 | 36 | 0 | — |
| 10-16 | 72 | 6 | 8474578 |
| 10-17 | 504 | 16 | 8474586 |

**Verdict: confirmed (A-05).** Coverage is 0–8% of WGO, and the writes stop at the lowest player ids (847457x–847458x). That matches a run being cut off part-way while iterating in id order.

### E-3 (A-12): held at TJ's request

`nst_team_gamelogs_as_rates` was not read. The NST team-daily and CTPI jobs are untouched.

### E-4 (A-21): last 3 ESPN odds runs

**Query:** `select run_time, job_name, status, details->>'statusCode', left(details->>'response',300) from cron_job_audit where job_name='game-predictions-ingest-espn-odds' order by run_time desc limit 3;`

**Result:** all 3 runs (10-18 17:34Z, 10-18 21:10Z, 10-19 11:34Z) returned 502 `ESPN_ODDS_ACCESS_DENIED` / "ESPN odds request failed with 403" from `site.api.espn.com/.../scoreboard?dates=…`.

**Verdict: confirmed (A-21), 403 branch.** ESPN refuses the request. This is a source decision, not an `allSettled` fix. Pausing 2 of the 3 jobs needs approval.

### E-5 (A-02(c)): scoped and local runs among succeeded `forge_runs`

**Query:** counts over `forge_runs where status='succeeded'` of non-empty `metrics->execution_scope->requested_game_ids`, of `git_sha like 'local:%'`, and of either.

**Result:** 382 succeeded runs: **3** game-scoped, **0** `local:`.

**Verdict: confirmed in part (A-02(c)).** Single-game scoped runs do exist in production, so the readers' lack of an `execution_scope` filter can matter. This read did not establish whether any scoped run was ever the newest run for its date.

### E-6 (A-06, A-11): Vercel env names and targets, project `fhfhockey` (93 entries)

| Name | Present | Target | Type |
|---|---|---|---|
| `DRAFT_PRO_PRIVATE_IMPORTS_ENABLED` | yes | production | encrypted |
| `PLAYER_FORECAST_BASELINE_RELEASE_IDS` | **absent** | — | — |
| `PLAYER_FORECAST_NATIVE_CATALOG_HEAD_ID` | **absent** | — | — |
| `STARTER_BOARD_COMPUTE_ENABLED` | yes | production | plain |

**Verdicts:**
- **A-06: inconclusive.** The flag exists in production, but whether it is on needs its value, which TJ can check in the dashboard. If it is on, A-06 is "fix now".
- **A-11: confirmed.** There is no native catalog head or baseline-release env in production, so nothing native is served there.

## Shift-charts follow-up reads R-1 to R-3 (2026-10-19, ~13:55Z, Chef `local_4317ea20`)

**Approval:** TJ in chat: "Read only checks: yes", for R-1 to R-3 from `tasks/artifacts/shift-charts-scope-2026-10-19/DIAGNOSIS.md`. Each read was one SELECT in `begin read only; set local statement_timeout='8s'`, run sequentially; no writes, no app requests.

### R-1: today's `run-projection-v2` preflight gates

**Method:** the first attempt, a JSON parse of `details->>'response'`, failed. The stored response is truncated at 4,000 characters and ends with "…", so it isn't valid JSON. It was re-planned once as a regex over the text.

**Result** (10:12:12Z run, asOfDate 2026-10-19):

| Gate | Status | Detail |
|---|---|---|
| `projection_derived_v2` | **FAIL** | player_latest=none, team_latest=none, goalie_latest=none |
| `skater_derived_freshness` | **FAIL** | 8 of 8 teams missing recent skater derived rows (7-day window) |
| `stale_goalie_game_rows` | **FAIL** | 6 of 8 teams missing recent goalie rows (30-day window) |
| `projection_input_ingest` | PASS | scheduled_recent_games=97, actual_pbp_games=51, shifted_actual_games=51, shift_coverage=1.00, shift_rows=1949 |
| `core_roster_schedule`, `goalie_start_priors_v2`, `line_combinations`, `outdated_player_team_assignments` (1 drift warning), `skater_line_freshness`, `skater_role_coverage` | PASS | — |

**Verdict:** the diagnosis's hypothesis is **contradicted**. Shift-chart coverage is complete and passes. The 422 comes from the **derived tables**, which have no rows at all (`forge_player_game_strength`, `forge_team_game_strength`, `forge_goalie_game`). By the diagnosis's own downstream note, `selectPendingProjectionDerivedDates` only builds games whose relationship materialization is current. A relationship queue stuck on preseason games therefore starves the derived build, which fits these failures. Not proven by this read.

### R-2: season game types

**Result:**
- type 1 (preseason): 2026-09-19 to 09-26, 65 games, all played
- type 2 (regular season): 2026-09-29 to 2027-04-10, 1,344 games, 140 played or today

**Verdict:** preseason is already outside the 14-day `projection_input_ingest` window. The regular season started 09-29.

### R-3: game 2026010007 roster scope

**Result:**
- `projection_game_materialization_status`: input_status `complete`, hash `38596e61…`
- `nhl_api_game_roster_spots`: **0 rows under any hash**

**Verdict: confirmed.** The game has an empty roster scope: its preseason play-by-play stored no `rosterSpots`. This is not a hash mismatch, so it does not point to an ingest bug that would also hit regular-season games.

## R3 catch-up run 1 and roster-hash read (2026-10-19, ~13:20Z, Chef)

- **Catch-up run 1** (TJ ran `update-shifts?action=all&maxGames=50`; curl got 500). Audit row at 13:19:39Z: failure, 500, 8.8 s, "Invalid relationship roster scope for game 2026020001". rowsAffected 0, `skippedGames: []`.
  - R3's queue rule worked: the regular-season opener is now first.
  - The regular-season game also has no roster scope, so it fails closed as designed.
  - Runs 2 and 3 were not started.
- **Read** (one SELECT, 8 s timeout), per game type, over `projection_game_materialization_status` against `nhl_api_game_roster_spots`:

| Type | Status rows | No roster rows (any hash) | No roster rows under current `pbp_raw_payload_hash` |
|---|---|---|---|
| 01 preseason | 42 | 26 | 27 |
| 02 regular | 87 | **0** | **53** |

**Verdict:** for 53 of the 87 regular-season games, the roster rows exist only under an older play-by-play hash. The stored PBP payload hash advanced (a re-capture) without the roster spots being re-written for it. This is an ingest or normalization defect, and it blocks the relationship queue for the regular season. Preseason has the same plus genuinely empty rosters.

### Q-1: direction of the roster-hash mismatch (Chef, one SELECT, 8 s timeout)

**Read:** the 53 regular-season games with no roster rows under their current status hash, grouped by status = head, normalisation status, normalisation hash = status hash, and roster hash = normalisation hash.

**Result:** one group covers all **53** games (2026020001–2026020120): `status_matches_head = true`, normalisation `stale`, `norm_matches_status = false`, `roster_matches_norm = true`.

**Verdict:** every game is the expected stale-normalisation case from `shift-charts-scope-2026-10-19/R3-ROSTER-HASH.md`. The DB-only `sweep-gamecenter-normalization` can repair all of them, and none needs a re-capture.

## Migration 86 preflight: hosted `capture_projection_raw_source_snapshots_v1` (Chef, ~18:10Z, one read-only SELECT)

TJ, quoted exactly: "Yes: run the read-only preflight comparing the hosted capture_projection_raw_source_snapshots_v1 body with the 20261011115124 version, and report before applying anything."

**Hosted function:**
- prosrc md5 `990b756c5c6499f7101741bf316311e1`, 7,423 characters. This equals the **`20260720105524`** body.
- Same 9-argument signature as the local files.
- EXECUTE: service_role only.
- Not SECURITY DEFINER; config `search_path=""`, `lock_timeout=5s`, `statement_timeout=60s`.

**Ledger:** `20260720105524` is present. **`20261011115124` and `20261011160000` are absent.**

**Local bodies:**

| Migration | prosrc md5 | Length |
|---|---|---|
| `20260720105524` | `990b756c…` | 7,423 |
| `20261011115124` | `f3b89dd8…` | 7,031 |
| `20261019180000` (order 86) | `4750518d…` | 7,080 |

**What `20261011115124` changes:** it drops the duplicate-row check (`v_shift_distinct_count <> v_shift_count`), so raw shift snapshots may contain exact duplicate occurrences. That is a relaxation: everything accepted today is still accepted.

**Implication:** migration 86 is a full-body `create or replace` built on `20261011115124`. Applying it alone would also apply that duplicate-row relaxation and leave the ledger skipping `20261011115124`. Nothing has been applied.
