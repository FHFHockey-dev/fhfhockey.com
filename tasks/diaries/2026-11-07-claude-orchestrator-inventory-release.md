# 2026-11-07 Claude orchestrator: inventory, release, relaunch

## Scope
Chef session local_c4e6c533. Ask 7 top-level threads (brand style, X scraper, Lines redesign, Web pages lines,
social share, game grid mobile, orchestrator setup) for nested-thread inventories + diary state; pop up TJ
decisions; commit + push the dirty tree, merge to master (gated); then relaunch one fresh lane per remaining task.

## Where
- Branch octoberBranch @ 691819d58; origin/master 194d55e72; 82 dirty paths at start.
- Inventory reports: ~/Library/Application Support/Claude/side-session-notes/local_c4e6c533-96aa-4670-aedf-8a5331a449da/inventories/

## State
- All 7 inventories on disk (inventories/ folder); 3 replies timed out on permission mode but files were written.
- Verified: 691819d58, d33d2c8a5 in branch; 08344ca14 on master; X Layer 3 files blob-equal to master 194d55e72;
  HEAD Luna reservation still 233M (fix only in 43b3c87b = 234M).
- HEAD vs master: ~443 app paths differ, incl. Codex's unreleased player-cards/BLSH/NST/FORGE/cron work.
- Codex lanes active (cron pipeline candidate b4033ad65 on 194d55e7; fxtwitter dedupe; yahoo refresh hardening;
  wigo repair applied). Their dirty files are Codex-owned, not the 7 Claude threads'.

## Next
Collect inventories, verify against git/diaries, pop up decisions.

## Blockers / approvals
Push + master merge need TJ pop-up approval (Vercel builds).

## Checkpoint 16:15 ET: release candidate
- octoberBranch commits: 825323cf7 chrome tokens+checkbox, 8de873e78 X L3, bf5d36294 roster last-seen, ef6e9deac Luna fix,
  4f5b21f4b/47a4beb90 task records, c1119f3de ours-merge of master 194d55e72.
- Master moved to b4033ad65 (Codex cron repair, released by TJ via Codex ~20:10Z; fhfhockey BUILDING at check).
- Candidate built with merge-tree cherry-pick chain (scratchpad release/chain.py) + overlay (L4/L5 libs, migrations, registry):
  57fb03f4e on 194d55e72 (gated: vitest 16589 pass; 6 env-only fails resolved; eslint 0 errors; CSS pure 27/27), rebased
  as 40189da81 on b4033ad65 (= old cand + master's 33 paths exactly). Excluded: blshTrade, TradeAnalyzer page/component.
- Gotcha: zsh doesn't word-split vars (use arrays); git archive export needs `git init` for git-grep tests.

## Checkpoint: release #414 + lane relaunch
- Pushed octoberBranch fb7d6601e..c1119f3de: 0 Vercel deployments, 0 checks.
- PR #414 squash-merged: master 00ea36b39, tree == candidate ecbe36a3c (58ef50209). fhfhockey prod build started ~21:30Z; watch + smoke pending.
- Lanes started (fresh, shared checkout, effort medium; rules in side-session-notes/.../LANE-RULES.md):
  x-l3-secrets local_19c7b993, lines-followups local_bff011c1, beat-reporters local_dfde2a8c, lines-superstyle local_73ae8339,
  toenail-backlog local_a6ce3579, gamegrid-desktop local_61c5521b, data-checks local_d3f00f87, cleanup-stage2 local_800ca158.
- Waiting: Codex handoff files (prompts 0, 5-11); Scout cron files before octoberBranch sync with b4033ad65/00ea36b39.
- #414 prod: fhfhockey dpl_Eq1QaL9XDs1Bp3oWd3v9NV3TCEJW READY; cms/functions/fhfhockey.com CANCELED. Smoke (5 GETs, seq): / 200, /stats 200,
  /lines 200, /game-grid 307 (route redirects to /game-grid/[mode]), /underlying-stats 200. Release done.
- 11-07 late: outbox sent (PP gaps → data-checks; X diary); nst-writer lane started local_3bb2755d.
- forge-pp-fix lane started local_237a0955 (strengthForTeam + /api/toi PP TOI; RC + rebuild sizing).

## Incident 11-07 ~22:52-23:03 UTC: production Supabase unreachable
- postgres_logs: statement timeouts + "current transaction is aborted" from 22:52, advisory-lock wait at 22:52, logs stop 23:02.
  edge_logs ~13-14k/5min 22:40-22:50, then ~10/5min. get_project ACTIVE_HEALTHY; MCP SELECT = connection timeout; site / and /stats time out.
- Load at onset: data-checks rolling rebuild (update-rolling-player-averages, bypassFreshnessBlockers, conc 1, ~3 min calls, 504s at 23:03/23:08);
  NST step 1 admission SQL sent once ~23:08-23:10 (outcome unknown, bounded lock 5s / stmt 30s); UI lanes' dev servers read prod.
- Actions: rebuild paused (resume 8477989, 211/752 players); NST held; UI + FORGE lanes told no DB requests. TJ restarting the DB.
- After restart: 1 read-only pg_stat_activity + 3 page GETs; then NST readback; then decide rebuild resume (smaller maxRuntime / spacing).
- 23:21 UTC: TJ restarted Supabase. Healthy: 23/60 conns, 0 idle-in-tx; / /stats /lines 200 (<0.5 s).
  Cleared: NST readback (read-only, then stop), FORGE exact count (once), UI lanes resume gently.
  TJ chose "Resume gently now" for the rolling rebuild: maxRuntimeMs 60000, 60 s gaps, conn check (>40 wait), stop on first 5xx/timeout.
- Combined RC refs/rc/claude-release-20261107-02 = 457de21bf (NST a1f7916b1 + FORGE 1bdcf6e3e merged cleanly on 00ea36b39, 72 files).
  Gate: vitest 16864 pass / 1 fail (homepageTime CST/CDT, fails identically on master export2 -> pre-existing, not RC), tsc 0, eslint 0, pytest 169/169.
  TJ: re-run NST steps 1+2 now (lane go sent); one combined release after DB steps pass; FORGE 2025-26 = flag only, rebuild 2026-27.
- NST DB steps 1+2 applied ~23:25/23:30 UTC (lane), my readback: ledger 1, 17 nst_* fns, service_role EXECUTE, goalie control off. Registry 2bc947f2c.
- PR #415 squash-merged: master a68f9b3d2, tree == 457de21bf. Builds expected: fhfhockey + functions-fhfhockey; watch + smoke pending.
- Cleanup stage 2 verified (0c5b07da6, 366 PNG to ~/Archive/...-stage2); diary retired 45dbc7b1d. FORGE 2025-26 flag 8167c379a.
- #415 prod: fhfhockey dpl_3UJ2Vx1N READY, functions-fhfhockey dpl_38jzTQQR READY, cms/fhfhockey.com CANCELED. Smoke 5/5 200 (/, /stats, /underlying-stats, /stats/player/8478402, /lines/EDM). FORGE rebuild waits for rolling to finish.

## Incident 2 ~00:00 UTC 11-08: same collapse. Root cause = Lines P3 processor
- edge_logs 23:40-23:58: line_game_state_observations ~22k, games 5k, claim/entry/pp/append_line_decisions ~3k each, many Vercel us-east-1 IPs.
  processLineSnapshotEvidence loops all scheduled teams on every update-line-sources/update-lines-ccc call (pg_cron each minute + webhooks), even with 0 sources.
- TJ chose "Both, pause jobs, turn off p3 and fix". Done: Vercel env LINES_OBSERVATIONS_ENABLED=false (id aabhELMTcSBLRYIo, dormant until deploy).
  Pending: TJ restart; pause the pg_cron jobs; CLI deploy of clean export a68f9b3d2 (scratchpad/p3off, .vercel at root) AFTER DB is up (build may read DB);
  lines-followups ticket 4 = processor fix (only teams with new evidence + per-team interval + load test).
- ~00:20 UTC TJ restart #2. Finding: NO pg_cron job calls update-line-sources/ccc (399 = route-runner-tick, 400 = x-timeline-poll);
  they're event-driven from lineSourceIftttReceiver (IFTTT/FxTwitter posts). Nothing to pause; P3-off CLI deploy of a68f9b3d2 started (scratchpad/p3off).
- Lines fix c74e53c03 (processor bounded; empty call 0 DB) verified; next ticket = bound the P4 GET path. Not released.
- 00:26 UTC P3-off CLI deploy dpl_6vNa94RXT live (aliased fhfhockey.com); line_* traffic 180 appends + 1365 lgso/min -> 0; site 200. Memory lines-p3-db-overload saved.
- TJ: rebuild resume gently (sent to data-checks); next release tomorrow (one gated release, P3 stays off); home-times lane approved but blocked by Remote Control (OUTBOX-PENDING).
- Rolling rebuild DONE 00:38 UTC (f195b3950; my count 47,515 rows / 752 players). team_unit_toi L/R winger fix 4bca8ed17 (backfill held by TJ; needs release; pin one snapshot_date).
  Radar NST wiring e82812741 (+ helper 738f5e383). All unreleased -> tomorrow's release.

## End-of-night state (~00:55 UTC 11-08)
- All lanes done: x-l3 (parked on X 403), lines-followups (+P3 fixes c74e53c03/a7a7466ad), beat-reporters, lines-superstyle, toenail-backlog,
  gamegrid-desktop, cleanup-stage2, nst-writer (released #415), forge-pp-fix (2026-27 rebuild handed to Codex), data-checks (check 4 after 02:00 UTC).
  :3110 and :3120 dev servers gone; TJ's :3000 untouched.
- NEXT (11-08): compose + gate ONE release from octoberBranch on master a68f9b3d2: Lines P3 fixes, Lines superstyle (7), Game Grid desktop (9),
  toenail backlog (13), Lines follow-ups (swaps/beat/AHL/goalie handle), radar e82812741+738f5e383, team_unit_toi 4bca8ed17, fonts.
  Exclude Scout's dirty files. Check e2e/player-pickup.spec.ts (stale at 37/120) + draft-layout.spec selectors. P3 stays off.
- After release: team_unit_toi backfill (pop-up, pin snapshot_date), P3 re-enable decision after a game night, P4 later.
- Pending TJ/Codex: home-times lane (OUTBOX-PENDING; start from desktop), Codex handoff prompts 0,5-11, FORGE 2026-27 rebuild (Codex),
  octoberBranch sync with master (b4033ad65/00ea36b39/a68f9b3d2 ancestry) once Scout's cron files are settled.
- TJ: compose the combined release 'tomorrow' (next working session on 11-08). Holding until then.

## 11-08 ~01:10 UTC: TJ asked to release now
- Candidate refs/rc/claude-release-20261108-01 = 4ca36df87 on master a68f9b3d2: 43 app commits (chain.py, EXC tasks + baseline test),
  task paths removed, + one added token `$radius-pill` in vars.scss (3 picked sheets used it; it was defined only by unreleased trends commits;
  trends' button-mixin changes deliberately NOT included). 135 files, all web/. CSS pure 46/46. Vitest/tsc/eslint running.
- PR #416 squash-merged: master 46f971753, tree == 4ca36df87. Gate: pure 46/46, vitest 16917/1 existing fail, tsc 0, eslint 0 errors. Build watch pending.
- #416 prod (11-08 ~08:25 UTC): fhfhockey dpl_DuzWLXvM READY; cms/functions/fhfhockey.com CANCELED. Smoke 5/5 200 (/, /stats, /lines/EDM, /game-grid/7-Day-Forecast, /stats/player/8478402). P3 still off.
