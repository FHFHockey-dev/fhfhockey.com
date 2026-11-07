# 2026-11-07 data checks after release #414 (Claude)

## Scope
Bounded read-only production checks (SELECT only, one Vercel deployment-metadata read) plus sizing (not running)
the PP units rerun and the NST goalie HD/GS backfill. Started by Chef local_c4e6c533. Results:
`tasks/artifacts/data-checks-2026-11-07/RESULTS.md`. Stay out of Scout's cron/FORGE, WiGO, Yahoo refresh/ownership,
FxTwitter dedupe files.

## Where
octoberBranch, sole checkout. Files I may commit: RESULTS.md, this diary, migration-authority.json rows 115-117,
supportedBaselineMigration.test.ts counts, super-goal-final-summary.md count, Yahoo sticky CLEANUP-PLAN.md + diary.

## Planned queries (written before running)
Q1 ledger:
`select version, name from supabase_migrations.schema_migrations where version in ('20261106210000','20261106220000','20261106233000') order by 1;`
Q2 catalog:
`select p.proname, md5(pg_get_functiondef(p.oid)) md5, position('test_alert' in pg_get_functiondef(p.oid))>0 has_test_alert, position('🚨' in pg_get_functiondef(p.oid))>0 has_siren, p.prosecdef, p.proconfig, has_function_privilege('anon',p.oid,'execute') anon_exec, has_function_privilege('service_role',p.oid,'execute') svc_exec from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('x_timeline_watchdog','x_timeline_watchdog_label');`
`select jobid, jobname, schedule, active, command from cron.job where jobname like 'x-timeline%';`
`select i.indexrelid::regclass, x.indisvalid, x.indisready, pg_get_indexdef(i.indexrelid) from pg_index i join pg_index x on x.indexrelid=i.indexrelid where i.indexrelid='public.cron_job_audit_run_time_idx'::regclass;`

## State
- Start 21:20 UTC. Lane rules read. NST diary says TJ ran the 10-28..10-31 backfill on 11-01; check 6 re-verifies.

## Next
Run Q1/Q2.

## Checkpoint 21:27 UTC: check 1 done
- Q1: 0 ledger rows for all three. Q2: x_timeline_watchdog present (secdef, search_path '', service_role only); no
  x_timeline_watchdog_label, no test_alert/🚨 → loud alerts NOT applied. Cron 401 x-timeline-watchdog */5 active.
  Index cron_job_audit_run_time_idx valid+ready, def matches. Registry states unchanged (unknown/pending/unknown);
  appended readback to stateEvidence of rows 115-117. Counts unchanged (119/79/10); summary unchanged.
  supportedBaselineMigration 21/21.

## Planned queries, check 2 (Yahoo step 5) and check 4 (rosters)
Q3 `select job_name, run_time, status, rows_affected, details->>'durationMs' as dur from public.cron_job_audit where job_name ilike '%yahoo-players%' and run_time > now() - interval '4 days' order by run_time desc limit 10;`
Q4 the four step-5 SELECTs from CLEANUP-PLAN.md with :run_start_utc = the latest full run's start.
Q5 `select jobid, jobname, schedule, active from cron.job where jobname ilike '%update-players%' or command ilike '%update-players%';`
Q6 `select job_name, run_time, status, rows_affected from public.cron_job_audit where job_name ilike '%update-players%' and run_time > now() - interval '2 days' order by run_time desc limit 5;`
Q7 `select count(*) total, count(official_seen_at) stamped, max(official_seen_at) from public.rosters where is_current;`

## Checkpoint 21:35 UTC: check 2 done, check 4 waiting
- Yahoo: 11-07 08:40:01Z run (status 'partial' only from ownershipOmitted 1031, Scout's lane; 1610/1610 upserted,
  providerOmitted 0, deferred 0). Step 5: refreshed 1610/1610, residual flags 0; NA 791, none 694, IR 66, IR-LT 18,
  IR-NR 18, DTD 13, O 10 (was NA 888, DTD 118, IR 102, O 40, IR-NR 28, IR-LT 22, none 410). McAvoy, Bedard null.
- Rosters: update-players-job jobid 6 '0 2 * * *' active. Q7 is_current 5227, stamped 0 → first run after apply is
  02:00 UTC 11-08. Check 4 can't complete yet.
- Check 3 git: origin/master = 00ea36b39 (#414, 21:16 UTC); contains web/pages/api/internal/luna-binding-check.ts,
  luna-review.ts.
Planned Vercel read (the one approved): list_deployments teamId team_KVFicHhQJARTbO6wRD2x6jpq,
projectId prj_LV0wbwH5gRjOsZlowzEFNGRuX7Lw, sha 00ea36b39ee0c541fd6050b79703d2c054e97f1d, target production.
- Vercel read result: dpl_Eq1QaL9XDs1Bp3oWd3v9NV3TCEJW, production, READY, sha 00ea36b39, created 1794086207455 ms
  (~21:16 UTC 11-07). Check 3 done (Luna routes are in that tree).
Planned Q8 (NST coverage by date since 10-25, the card's join):
`select w.date, count(*) wgo, count(n.player_id) nst from public.wgo_goalie_stats w left join public.nst_gamelog_goalie_all_counts n on n.player_id=w.goalie_id and n.date_scraped=w.date where w.date >= '2026-10-25' and w.date < current_date group by 1 order by 1;`
Q9 latest date per 10 NST goalie tables: `select '<t>', max(date_scraped) from public.<t>` union all for each table.

## Checkpoint 21:45 UTC: check 6 sized (not run)
- Q8: NST all_counts vs WGO: 10-25..11-03 complete (11-01 backfill held). 11-04 8/0, 11-05 22/0, 11-06 7/0 → new gap.
- Q9: all tables max 11-03 except 5v5_counts 11-04. No update-nst-goalies audit rows since 11-01 15:09 (cron 08:30
  runs unaudited again). origin/master route still calls fetchNstTextByUrl with no requestControl (fix unreleased).
- Backfill: 29 URLs (11-04 x9 excl 5v5Counts, 11-05 x10, 11-06 x10). Released client forces 21 s spacing, so no
  true burst: ~10 min, 5 chained 6-URL runs. Needs TJ pop-up.
Planned Q10 (PP sizing): games and stored rows per date, and PPTOI-vs-WGO match per date, 09-29..11-06:
`select g.date, count(distinct g.id) games, count(c.*) rows, count(*) filter (where abs(c."PPTOI"-w.pp_toi)<=2) matched, count(w.player_id) joined from games g left join "powerPlayCombinations" c on c."gameId"=g.id left join wgo_skater_stats w on w.player_id=c."playerId" and w.date=g.date where g.date between '2026-09-29' and '2026-11-06' and g.id >= 2026020000 group by 1 order by 1;`

## Checkpoint 21:55 UTC: check 5 sized (not run)
- Q10: 10-31..11-06 PPTOI matches WGO 100% every day (fixed writer live since #402, 11-01 18:20 UTC).
  09-29..10-30: 32 dates, 216 games, 6,098 stored rows, 2,948 matched (48%). Max 16 games/day (10-13).
- Nightly PP audit: ~2.4 s per game, 4 at once. Rerun = 32 one-day calls in sequence, 648 NHL requests
  (3/game, no NST/Yahoo), ≤12 concurrent; est. 3-6 min. Writes: 216 upserts (~6.1k rows) + ≤216 deletes (guarded).
- Derived rebuilds (rolling averages, team_unit_toi, lineup tallies) are NOT sized here; separate approval.
- Pop-up to TJ next: approve PP rerun and NST 29-URL backfill.

## Checkpoint 21:31 UTC (clock-corrected): TJ approved both via pop-up ("Run it now" x2)
- PP: 09-29 run alone first: HTTP 200, 5 processed, 0 failed, keptUnproven 2; matched 84/135 → 118/120. Then
  09-30..10-30 started in background, sequential, stop on non-200 (scratchpad runs/pp.sh).
- NST: chained update-nst-goalies startDate=2026-11-04 maxDays=3 maxUrls=6 requestIntervalMs=21000, ≤6 calls,
  sequential (scratchpad runs/nst.sh). 29 URLs expected.
- Auth: Bearer CRON_SECRET from web/.env.local, never echoed. Host https://fhfhockey.com.
- 21:30 UTC PP rerun complete: 32 days HTTP 200, 216 processed, 0 failed, 15 keptUnproven. 09-29..10-30 now 5,046/5,085
  matched (99.2%), 1,013 stale rows deleted. Derived rebuilds not run (unsized).
- 21:40 UTC NST run done: 5 calls, all HTTP 200, fixed URL each call (startDate 11-04, maxDays 3); 29 processed,
  5v5Counts 11-04 skipped (already present). Chef relayed TJ's constraints (fixed window, verify all 30 combos).
Planned Q11 (30 combos): per table × date 11-04..11-06: rows, goalies matching WGO, non-null hd_shots_against
(counts tables) / non-null toi; plus 11-07 rows (must be 0 from this run).
- Q11: all 30 combos present; 11-04 8/8, 11-05 22/22, 11-06 7/7 (pp_* 6/7, no-PP goalie); every row matches WGO;
  toi and counts-HD non-null; 0 rows for 11-07. RESULTS.md complete.

## Next / left
- Check 4 after 02:00 UTC 11-08: rerun Q7 and the Schwindt/Hryckowian read-only replay.
- NST writer fix still unreleased → gap regrows daily (NST lane, Claude-owned).
- PP derived rebuilds 09-29..10-30 unsized; inspect 10-27 (238/250) and 10-22 (272/280).
- Loud-alerts migration unapplied; ledger repair for 210000/233000 needs approval.
