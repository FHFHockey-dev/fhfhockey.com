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

## Checkpoint: TJ confirmed in this session ("Run both"): apply loud alerts + 2 ledger rows
- Method: psql (SUPABASE_DB_URL, not echoed), one transaction: \i 20261106220000 file (sha c8556d20… matches
  registry) + insert schema_migrations rows 20261106210000/220000/233000 (version, name, created_by).
- psql failed (db host IPv6-only, no DNS here); nothing ran. Applied instead via Supabase connector execute_sql, one
  transaction (file body verbatim + 3 ledger inserts), about 22:15 UTC. Readback: md5(prosrc) watchdog 4ded5d0a…,
  label 823e0673… = file bodies; secdef/search_path/grants correct; test_alert present; ledger has all 3; cron 401
  runs 22:10-22:20 succeeded. Registry 115-117 → applied; counts 119/82 applied/28 unknown/9 pending; summary line
  updated (exact format the test checks). supportedBaselineMigration 21/21.
- Gotcha: the summary sentence is asserted verbatim by the test; don't add clauses.

## Checkpoint ~22:35 UTC: PP derived routes sized (Explore subagent read origin/master; all 3 DB-only, maxDuration 240)
- Q12 (read-only): team_unit_toi 0 rows in window; whole table 12,929 rows, 2025-26 only, last write 06-22.
  tallies season 20262027: 2,982 rows. rpgm 09-29..10-30: 34,244 rows / 724 players; 10-31..11-06: 5,320 rows.
- Q13 audit: nightly rolling 1-day windows: 60 players/300 rows in 4-29 s.
- Tallies: no date params; RPC refresh_player_lineup_deployment_tallies deletes+inserts the whole season; pg_cron 391
  09:55 UTC daily action=current → tomorrow's run rebuilds from fixed PP rows automatically.
- team_unit_toi: never populated for 2026-27, no schedule; dryRun defaults true; nothing stale to rebuild.
- Rolling: rows after 10-30 also carry stale PP history in their windows → recommend 09-29..11-06.
  executionProfile=overnight, maxRuntimeMs 180000 + deadlineAt, 207 resume loop; est 8-15 calls, 15-30 min.
- TJ pop-up: rolling "Run 09-29 → 11-06"; tallies "Let the 09:55 run do it"; team_unit_toi "Dry run first".
  Rolling started in background (scratchpad runs/rolling.sh; overnight, 180 s budget, ≤25 calls, stop on non-200/207).
  team_unit_toi: one call ?season=20262027&startDate=2026-09-29&endDate=2026-10-30&dryRun=true.
- team_unit_toi dry run: HTTP 400 after 21 s, "Failed to fetch nhl_api_shift_rows: canceling statement due to
  statement timeout". No writes (dryRun). Not retried; a 32-day window is too big for one read (rolling run was
  running at the same time). Needs TJ: smaller windows or skip.
- Rolling call 1 (22:31 UTC): HTTP 422 freshness gate FAIL (6 blockers, not bypassed) but rowsUpserted 2,295 for
  34 players in 194 s; resume 8475171, 718 remaining of 752. Re-sized: ~22 calls, ~70 min.
- TJ pop-up: "Continue with bypass"; team_unit_toi "One 1-day dry run" (after rolling).
  rolling2.sh: resume 8475171, bypassFreshnessBlockers=true, maxRuntimeMs 160000, calls 2..31.

## Ticket (Chef, 11-07): /stats/player radar league comparison for NST stats
- Lock: PlayerRadarChart.tsx is the toenail lane's until it commits; do source + helper/tests first.
- Radar reads player AND league season rows from wgo_skater_stats_per_game; game log NST comes from
  nst_gamelog_as_{counts,counts_oi,rates,rates_oi} (usePlayerStats.ts). Need a season-level all-strength NST source.
Q14 `select table_schema, table_name, table_type from information_schema.tables where table_schema in ('public','analytics') and table_name ilike 'nst%' and table_name not ilike 'nst_gamelog_goalie%' order by 2;`
Q15 columns of nst_seasonlong_as_counts / _rates / _counts_oi and nst_seasonal_individual_* (information_schema).
Q16 coverage: count(*), count(distinct player_id) for season 20262027 in candidates vs wgo_skater_stats_per_game; plus
    `explain` cost of the view read.
- Q15/Q16: nst_seasonlong_as_rates 752 players, nst_seasonlong_as_counts_oi 751, = wgo_skater_stats_per_game 752 for
  20262027 (nst_seasonal_* stale, 530). anon SELECT true on both views + WGO. Sample McDavid sane.
- Helper web/lib/nst/radarSeasonStats.ts + test (8/8, eslint 0): shares from on-ice for/against (league min events),
  per-60 from rates view (league min 1 h TOI; hdcf_per_60 → ihdcf_per_60), hdca_per_60 = hdca*3600/toi_seconds_oi.
  Position filter via WGO player_id/position_code. Errors/missing → unranked ("No comparison data").
- Next: wire into PlayerRadarChart.tsx once toenail lane (local_a6ce3579) commits it.

## Ticket (Chef, 11-07): PP data gaps diagnosis (read-only)
- forge_player_game_strength writer: build-projection-derived-v2 → lib/projections/derived/buildStrengthTablesV2.ts;
  goal strength = situation.ts strengthForTeam (skater count only; pulled goalie 6v5 → "pp" — hypothesis).
Q17 skatersGameStats columns (information_schema).
Q18 McDavid/Draisaitl per game 2026020133..2026020260: forge goals_pp/assists_pp vs skatersGameStats PP fields.
Q19 pbp_plays goals in those games where McDavid scored/assisted: situationcode, eventownerteamid, home/away.
- Q18: skatersGameStats == WGO on every McDavid/Draisaitl row; forge differs in 163, 239, 260. powerPlayToi "00:00" on all.
- Q19: diffs = goals at situationcode 1560 (home goalie pulled, 6v5 → "pp") and shootout goal period 5 "0101".
Q20 league-wide 2026-27: forge sum(goals_pp), sum(assists_pp) vs skatersGameStats sum(powerPlayGoals),
    sum(powerPlayPoints - powerPlayGoals) per season since the table starts; count of mismatched player-games.
Q21 pbp goals 2026-27 with a pulled goalie (digit 0) or period>=5, by category.
Q22 skatersGameStats powerPlayToi distribution ('00:00' share) by season, and shorthandedToi.
- Q20: forge vs skatersGameStats PPG 2025 prefix 985 vs 789, 2026 prefix 448 vs 368 (incl. preseason rows).
- Q21: 2026-27 regular PBP goals by forge rule: 450 "pp" = 37 shootout + 46 extra-attacker + 367 true (NHL 368).
  Preseason: 83 = 20 extra-attacker + 63 true.
- Gap 2 writer: pages/api/v1/db/update-stats/[gameId].ts:671-672 hardcodes powerPlayToi/shorthandedToi "00:00"
  (since 2b260940f, 2025-04-08); team PP TOI is scraped from HTML separately (:486).
Q23 `select endpoint/kind columns of nhl_api_game_payloads_raw` + for one 2026 game the jsonb_object_keys of the
    first boxscore skater (keys only, no values).
- Q23: boxscore skater keys have no PP/SH TOI. skatersGameStats powerPlayToi "00:00" on 100% of rows every season
  except 2022 (35%) / 2023 (53%); faceoffs "0/0" likewise. Reader: /api/toi → TimeOnIceChart.
- RESULTS.md §7 written. Diagnosis done; no code/data changes.
- Rolling calls 2-10: HTTP 207, 177 players; call 11 (23:03) HTTP 504 (240 s cap). Total 211/752 players, ~15k rows.
  TJ pop-up: "Continue, smaller budget" → rolling3.sh: resume 8477989, maxRuntimeMs 110000, calls 12..46,
  one retry on 504, stop on second.
- ~23:10 UTC Chef URGENT: prod Supabase degraded since ~23:05 UTC. Paused: killed rolling3.sh loop (PID 17121);
  call 12 was a 504; call 13 (resume 8477989) left to finish/time out by ~23:13, not retried. Resume point
  8477989, 211/752 done. Do NOT resume without Chef go-ahead. team_unit_toi 1-day dry run on hold.
- 23:12:29 UTC call 13 ended FUNCTION_INVOCATION_TIMEOUT (504). Zero lane requests in flight. Holding for Chef.
- Chef relays TJ pop-up "Resume gently now" after the Supabase restart. rolling4.sh: resume 8477989, maxRuntimeMs
  60000, concurrency 1, 60 s gap, pre-call `select count(*) from pg_stat_activity where datname=current_database()`
  via IPv4 pooler (aws-0-us-east-1, read-only; first check = 24), wait if > 40, stop on any non-200/207, no retry,
  checkpoint exit every ~100 players.
- Gentle leg A (23:26-23:33 UTC): calls 14-17 HTTP 207, activity 24-28, +121 players (~7.8k rows); total 332/752, next 8479941. Leg B started.
- Leg B (23:35-23:42 UTC): calls 18-21 HTTP 207, activity 23-26, +102 players (~6.6k rows); total 434/752, next 8481186. Leg C started.
- Leg C (23:45-00:01 UTC): calls 22-26 HTTP 207 (+44 players, slowing: 11,12,11,4,6); call 27 HTTP 504 → STOP, no retry. Total 478/752, resume 8481716. Q24 health: pg_stat_activity state counts + longest active query age (read-only, pooler).
- 00:02 UTC health read failed (pooler auth timeout 15 s). Reported to Chef; holding. Nothing in flight.
- Chef: outage root cause = Lines P3 (off since 00:26 UTC). TJ pop-up 'Resume gently now'. rolling5.sh = rolling4 + stop if call > 120 s or < 5 players twice in a row. Resume 8481716, call 28.
- Guarded leg A (00:30-00:34 UTC): calls 28-29 HTTP 207, activity 10-17, +144 players (~8.3k rows); total 622/752, next 8483490.
- 00:38 UTC rolling DONE: call 31 HTTP 200. 752/752 players, 47,515 rows (= all window rows). pp_unit vs powerPlayCombinations.unit 6,181/6,181. updated_at not bumped by upserts (no trigger).
- team_unit_toi 1-day dry run: ?season=20262027&startDate=2026-09-29&endDate=2026-09-29&dryRun=true (activity=9)
- team_unit_toi 1-day dry run: HTTP 200 1 s, 34 rows (30 PP, 2 F, 2 D for 10 team-games). TJ pop-up: 'Stop; log the coverage gap'. Not populated.

## TJ (direct, 11-08): hold the team_unit_toi backfill; diagnose ES-unit gap
- Builder positionGroup (teamUnitToiBuilder.ts:94) maps C/LW/RW/F → forward, D → defense. Hypothesis: players.position uses L/R.
Q25 `select position, count(*) from players where id in (select distinct player_id from nhl_api_shift_rows where game_id=2026020003) group by 1;`
Q26 league-wide `select position, count(*) from players group by 1 order by 2 desc;`
Q27 export for replay (read-only, pooler): nhl_api_shift_rows (builder columns) + players(id,position) + powerPlayCombinations(gameId,playerId,unit,PPTOI) for game 2026020003 → scratchpad replay/game-2026020003.json
Q28 export 09-29 five games' builder inputs (shift rows season 20262027 game_date 2026-09-29, players, PP rows) → scratchpad replay/day-2026-09-29.json; replay HEAD vs fixed builder locally (no writes).
- Replay 09-29 (5 games, inputs identical to the prod dry run): HEAD 34 rows (F2 D2 PP30, ES on 2/10 team-games);
  FIXED 656 rows (F486 D140 PP30, ES on 10/10). 0 unrecognised positions. Builder test 6/6 (2 new).
Q29 coverage: games 2026-27 by type vs games with nhl_api_shift_rows (both teams) and with powerPlayCombinations;
    per-game shift seconds per team (min/median) for 09-29..11-06.
Q30 existing team_unit_toi: game types and snapshot_date values present (2025-26).
- Q29: 2026-27 regular 264/264 games have shifts (both teams) + PP rows; window 216/216; min 41,765 skater-s.
  Preseason 31/65 with shifts. Q30: existing team_unit_toi = 2025-26 types 02/03, one snapshot 2026-06-22, 9.5 rows/game
  (F 2,514 / D 2,744 over 1,308 games) → built with the same broken mapping.
- Fix: positionGroup + L/R; partial coverage on unclassified skaters; writer coverage counters. eslint 0, rankings tests
  32 files/246, typecheck exit 0. Reader takes latest snapshot for the whole season → pin one snapshot_date.
- Backfill HELD (TJ). Needs release first.
- Radar wiring (lock free: f65875019, file clean): PlayerRadarChart.tsx fetchPercentiles routes skater NST stats
  (isNstRadarStat) to fetchNstRadarSeason/nstRadarComparison in parallel with the WGO league reads; shared
  rankAgainst(). Tests: 2 NST lower-is-better (pim/hdca), cf_pct + position filter, NST error → "No comparison data";
  ixg game-log no-borrow test now asserts the NST read. Radar 60/60, PlayerStats + helper 156/156, eslint 0,
  typecheck exit 0.

## 11-08: release #416 live (46f971753, includes 4bca8ed17). Chef: prod dry run + sizing + check 4.
Q31 cron.job_run_details for jobid 6 since 2026-11-08 00:00; cron_job_audit rows for update-players since then.
Q7 rosters is_current stamp counts; Q32 stamps by team (newest stamp per team, count non-null) for current NHL teams.
- Check 4: update-players 02:00:00 UTC cron succeeded; audit success dryRun=false 2.85 s. rosters is_current 5227,
  stamped 795 across 32 teams (02:00:22-24). Cole Schwindt FLA + Justin Hryckowian DAL stamped; Kai/Dylan not
  (dup older-season rows null; Cole's stale VGK row null). Matches the simulated replay → FLA 15/16→Cole,
  DAL 16/16→Justin (inference, same inputs). tweet_pattern_review_items mentioning them: pending DAL 19, FLA 4,
  CAR 1, untagged 51 — resolve only via replay/alias review (write → TJ pop-up).
- Prod dry run (#416): ?season=20262027&startDate=2026-09-29&endDate=2026-09-29&dryRun=true, conn check first.
- Prod dry run #416 (activity 20): HTTP 200 2 s, generated 656 (F486 D140 PP30), teamGamesWithoutES 0, partial 0,
  rowsUpserted 0 — identical to local replay.
- Sizing: regular-season games with shifts 09-29..11-06 = 264/264 (11-07: 10/12 missing shifts → excluded), 39 dates,
  max 16 games/day. ~131 rows/game → ~34.6k rows. Route param snapshot_date (route :82) pinned 2026-11-08 on every call.
- Pop-up TJ with exact plan.
- TJ pop-up 'Run it as planned'. Pre-check: 0 rows season 20262027. tut-fill.sh started (39 days, snapshot 2026-11-08 pinned).
- 08:41-08:48 UTC fill DONE: 39/39 HTTP 200, 34,630 rows; readback 34,630 / 264 games / 528 team-games, single
  snapshot 2026-11-08, all complete, F1+D1 on 528/528, 0 non-regular. RESULTS §4 + §8 follow-ups written.
- Left: queue replay for Schwindt/Hryckowian items (write → TJ); 2025-26 team_unit_toi rebuild (separate decision);
  no cron writes team_unit_toi (new dates need runs with the same snapshot).

## 11-08 (c) nightly team_unit_toi (TJ via Chef: "Nightly route-runner job")
- New lib/rankings/teamUnitToiNightly.ts: planner (reuse latest snapshot; oldest completed reg/playoff games
  before today ET lacking top F line for both teams; cap 40; no snapshot → no_snapshot), completeGameIds,
  paged loader (Supabase 1,000-row cap). Route update-team-unit-toi mode=nightly (dryRun default true; 409 when
  no snapshot; writes only games with F1+D1 for both teams; skipped games retried next run; asOf/maxGames).
  Registered in routeRunner registry ("once", requires season) + tick handler map + runner page options.
- Tests: nightly module 8, route 3, rankings+routeRunner 37 files/337; eslint 0; typecheck exit 0.
- Schedule NOT added (activation is its own TJ pop-up after release); suggested pg_cron:
  GET /api/v1/db/update-team-unit-toi?season=<current>&mode=nightly&dryRun=false after shift ingest (~10:30 UTC).
- (b) 2025-26 one-date prod dry run: ?season=20252026&startDate=2025-10-07&endDate=2025-10-07&dryRun=true (conn check first).
- (b) 2025-10-07 prod dry run: HTTP 200 1 s, 3 games, 396 rows (F294 D84 PP18), partial 0, noES 0.
  Sizing: reg 1,312 games (1,311 with shifts both teams), 167 dates; playoffs 105 sched / 82 with shifts, 51 dates;
  ~184k rows, 218 one-day calls, ~45-55 min. Old snapshot 2026-06-22: 12,929 rows (1,390 games), winger bug.
  Proposed: NEW snapshot 2026-11-08 (rollback = delete it; readers fall back to 2026-06-22); partial view during run.
- TJ (~09:15 UTC 11-08): closing laptop, flying; resume ~12:30 CDT (17:30 UTC). 2025-26 decision PENDING. NOT run.
- (a) not started: list Schwindt/Hryckowian tweet_pattern_review_items IDs, dry-run released resolver, pop-up TJ.
## Next (on TJ's return)
1. Re-ask the 2025-26 snapshot pop-up; if approved run with the tut-fill guards (scratchpad runs/tut-fill.sh pattern).
2. (a) bounded replay: list IDs (DAL 19, FLA 4, CAR 1, untagged 51), dry-run resolver, pop-up, replay only on OK.
3. Schedule activation for nightly team_unit_toi after release (own TJ pop-up).
