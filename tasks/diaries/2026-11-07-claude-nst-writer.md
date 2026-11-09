# NST goalie writer release candidate — 2026-11-07 (Claude)

- Scope: get the unreleased NST goalie writer (bbc707815: catch-up, freshness, preparation, job lifecycle, shared admission, requestControl) release-ready; fix audit-ordering bug; check migration 20261101161622 in prod (read-only); build `refs/rc/nst-writer-20261107-01` on origin/master and gate it. No push, release, NST requests, cron runs or prod writes.
- Where: octoberBranch, start HEAD c25bc76db; origin/master 00ea36b39 (#414).
- Accepted vs in progress: no `07-nst.md` handoff exists. Codex independent review (11-01) found P1/P2/P3; focused re-review closed all three for the disabled candidate (457 JS / 107 Py pass). Remaining gates per Codex: hosted schema/ACL, activation, live qualification. Lifecycle stays off unless `NST_JOB_LIFECYCLE_ENABLED=true`.
- Source commit: bbc707815 (33 NST files in scope; same commit also touches ~57 unrelated files, dropped by path filter). 738f5e383 (radarSeasonStats) is the player-radar lane, excluded. Older listed commits (e89dfdde5, 6ea6f3bdd…) are already in master content-wise.
- Dependency note: route uses `withCronJobAudit(..., { includeFinalAuditReceipt: true })`; master already has that option. HEAD's extra audit hardening (Scout) is not required.
- Bug: `withNstJobLifecycle` wraps outside `withCronJobAudit`; a failed `nst_job_begin_v1` returns 503 with no audit row. Fix plan: lifecycle option `auditUnadmitted` (route passes `withCronJobAudit`) used only when the handler never ran. No edit to withCronJobAudit.ts.

## Planned read-only query (pre-approved)
```sql
select version, name from supabase_migrations.schema_migrations where version = '20261101161622';
select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname like 'nst\_%' order by 1;
```

## Log
- (start) diary created.
- Fix committed a9badf7aa (jobLifecycle `auditUnadmitted`, goalie route passes withCronJobAudit, 2-case regression test; proven to fail without the route line). NST route+lifecycle tests 76/76 pass.
- Prod read-only (3 SELECTs, project fyhftlxokyjtpndbkfse): 20261101161622 NOT in ledger, no nst_* functions, no nst_request_admission_state. Ledger latest 20261107192933 (so this migration is out of order; push needs care). Postgres default ACLs in public are postgres-only (Codex packet step-1 privilege blocker appears resolved in effect; 20261020224500 has no ledger row).
- BLOCKER for deploy: client.ts sends every NST web request through admitSharedNstAttempt -> nst_admit_attempt_v1 with no flag (Python nst_get likewise). Releasing the app before DB steps 2-3 of Codex's APPROVAL-PACKET (rollout-approval-20261101) breaks every NST fetch. Order: admission SQL (envelope c262a450…) -> migration -> paired web+functions deploy.
- Closure gap: scope list missed bbc707815's NST callers. Without them the goalie route's new goalie_url_cursor resume breaks the route runner (registry still next_start_date), and functions/api/index.py imports names fetch_team_table.py no longer exports. Narrow 38-path RC: 17 Py + ~18 NST Vitest failures. Expanded to 62 paths (paths-all list in report): + functions/api/index.py, 5 legacy NST .py scrapers, web/scripts/fetch_team_table.py, TS NST callers (Teams, fetch_team_table, Averages x5, helpers, check-missing-goalie-data), routeRunner core/registry/tick (+tests), nst burst/policy tests. Excluded: cron-report/withCronJobAudit/manualCronAudit/reportSource/CronAuditEmail (Scout), rolling-forge pipeline (Scout/FORGE), starter-board, replay-player-aliases, shift-charts, wgo files/migration, runner.tsx, radarSeasonStats (radar lane).
- RC refs/rc/nst-writer-20261107-01 = d9a1c8ca8 (parent 2-commit chain on origin/master 00ea36b39); blobs equal HEAD on all 62 paths; nothing else changed.
- Gates on RC export: pytest functions 169/169; eslint changed TS exit 0; local PG15 fixture 18/18 PASS, 0 hosted calls (needs LC_ALL=C on macOS). Full Vitest + typecheck running.
- Master baseline: update-line-sources replay, rosterScheduleOptimizer 1000-player, tweetLunaReview CLI fail on master too (pre-existing).
- RC2 gate: typecheck failed (runner.tsx CONTRACT_LABELS needs goalie_url_cursor, bbc707815 1 line) and cron-audit-wrappers auth-ordering test failed (also fails on HEAD): current-season, team-daily, nst-team-stats had the same lifecycle-outside-audit gap. Fixed in a5e68fa51 (auditUnadmitted on all three; static test accepts the lifecycle layer only with auditUnadmitted). 317/317 affected tests pass in canonical checkout.
- RC now a1f7916b1 (4-commit chain on 00ea36b39, 64 files). Re-gating (pytest, eslint, full Vitest, typecheck).
- Final gate on a1f7916b1: tsc 0, eslint 0, pytest 169/169, Vitest 16839 pass / 3 load flakes (pass in isolation on RC and master), PG15 18/18. Hand-over: side-session-notes/<chef>/nst-writer/HANDOFF.md.
- Next: Chef/TJ approve DB steps 2-3 then paired web+functions release. Diary kept until release lands.
- 2026-11-07 Chef relayed TJ approval for DB steps 2-3; TJ confirmed by my own pop-up ("Run both steps"). Plan: (1) execute PROPOSED-admission-install.sql verbatim (envelope c262a450… verified, body == accepted aefd3c20… byte-for-byte) + readback of definition/singleton/ACLs; (2) execute migration 20261101161622 (d99730b4… verified) plus INSERT into supabase_migrations.schema_migrations in one transaction + readback (controls false, no jobs/claims, service_role grants). No activation/env/NST/deploy.
- 23:11 UTC step 1 execute_sql returned 'Connection terminated due to connection timeout' (outcome UNCERTAIN). Readback SELECTs timed out on both Supabase connectors; project ACTIVE_HEALTHY. Not replaying until readback shows the state.
- 23:12 UTC Chef: prod Supabase degraded since ~22:05 UTC; HOLD. Reported exact state. Holding: no retry, no step 2; next = one read-only readback when DB recovers and Chef says go. Registry not updated (nothing confirmed applied).
- 23:21 UTC Chef GO for one readback after TJ's Supabase restart. Result: nst_request_admission_state absent, no nst_admit* functions, 0 nst_* functions, 0 nst_goalie_*/nst_job* tables, no 20261101161622 ledger row -> step 1 did NOT commit; prod unchanged. STOPPED awaiting TJ decision via Chef.
- 23:30 UTC TJ re-approved by my pop-up: re-run step 1 once, then step 2 only if 1 reads back; stop at first failure/timeout, no retry.
- ~23:25 UTC step 1 re-run: success. Readback: table RLS on, ACL postgres + service_role=rw; singleton {attempts [], 22000}; nst_admit_attempt_v1 body md5 b1821941 = file; EXECUTE service_role only.
- ~23:30 UTC step 2: migration verbatim + ledger row in one transaction: success. Readback: ledger 20261101161622:nst_goalie_catchup_v1; all 17 nst_* function md5s match the file (budget fn keeps b1821941); RLS on all new tables; both controls false/null; 0 jobs/claims/cohorts/units; service_role EXECUTE on admit + admit_job, anon/authenticated none; service_role cannot update enabled/enforced/qualified_at, delete receipts, or update/delete evidence.
- Registry: migration-authority row -> applied (83 applied / 28 unknown / 8 pending); supportedBaselineMigration.test.ts 21/21; super-goal summary count.
- Next: Chef does paired web+functions release of RC a1f7916b1. Lifecycle stays off. Keep diary until release lands.

## 2026-11-09 ~00:50 UTC — post-release verification (Chef ticket, TJ pop-up "NST: verify 08:30 run")
Read-only, light SELECTs only (team_unit_toi rebuild running). Planned:
1. `select column_name from information_schema.columns where table_name='cron_job_audit'`; then `select job_name,status,<start/duration cols>,rows_affected,details->>'statusCode' from cron_job_audit where job_name like '%update-nst-goalies%' and <start> >= '2026-11-08' order by <start>`.
2. `select attempts, last_spacing_ms from nst_request_admission_state` -> min gap between consecutive attempts, max count in any 60s/300s/900s/3600s window (computed in SQL over unnest(attempts); note the array only keeps the last 3601 s).
3. For game dates 2026-11-06..2026-11-08: WGO goalies (wgo_goalie_stats games_played>0) vs row count and WGO-id matches in each of the 10 nst_gamelog_goalie_* tables; list any table x date short.
Results (6 SELECTs, all light):
1. cron_job_audit: one 08:30 run since release: 2026-11-08 08:30:05.9 -> 08:30:24.8 UTC, status success, HTTP 200, 18.9 s; response complete=true, operationStatus complete, requiresReview false, 10 URLs processed (11-07), 10 skipped (11-06 already present), stoppedEarly false, requestIntervalMs 0 (burst; plan 10 < 40). No other NST audit rows 08:25-08:35. (The 5 rows on 11-07 21:29-21:40 are the data-checks backfill.) No admission-refusal row needed: lifecycle is off.
2. Admission: nst_request_admission_state keeps only the last 3601 s, so 08:30 attempts are pruned; ledger now holds 3 attempts 11-08 23:40:21-23:41:05 (another paced job), gaps 22.09-22.13 s, max 3 in any window, last_spacing_ms 22000. From the 08:30 audit's urlProgress: 10 requests between 08:30:08.9 and ~08:30:24 -> max 10 in any 60s/5m/15m/1h window (caps 39/80/100/180). Gotcha: no durable admission receipts exist; window proof after the hour needs the audit urlProgress.
3. Coverage vs WGO (games_played>0): 11-06 7 goalies -> 7/7 in 8 tables, pp 6/6; 11-07 26 -> 26/26 in 6 tables, pk 23/23, pp 22/22; every row matches a WGO id; 0 null toi/HD. 11-08: WGO 0 rows yet (loads 11-09 07:35; goalie run 11-09 08:30). No missing table x date. Gap no longer regrowing.
