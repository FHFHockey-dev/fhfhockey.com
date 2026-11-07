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
