# FHFH consolidated checkpoint diary — handoff to the next top orchestrator

Compiled 2026-10-20 ~15:20Z by the outgoing orchestrator, "Code handoff review and project recommendation" (`local_08a0bf1c-fda1-4d08-9f56-8ff961d00e41`). Sources:
- 32 per-thread diaries in [`diaries/`](diaries/): 11 written by the sessions themselves, 21 compiled from transcripts;
- the outgoing orchestrator's own context;
- TJ's master task list ([`MASTER-TASKLIST-2026-10-20.md`](MASTER-TASKLIST-2026-10-20.md), Codex audit of 10-20, also appended to `HANDOFF-2026-10-20.md`).

Where this file and the master task list disagree, this file has fresher evidence. Each disagreement is called out in §8.

---

## 1. World state (verified 2026-10-20 15:18Z unless marked)

| Item | Value |
|---|---|
| Production (`origin/master`) | **`b630e0767` = R6f** (Vercel `dpl_CB3xkpyVPYz9yFU1NhQGde1uj5wm`). Local `master` ref is STALE (`457435eb3`). Always use `origin/master`. |
| Development (`origin/octoberBranch`) | **`392c02af2`**, a sync merge from R6f. Contains TJ's checkpoint `b8fe1072e` (774 files, multi-session WIP, unreviewed; a pattern-based secret scan found nothing real) and lots of unreleased native FORGE work. master is an ancestor (0 / 48 commits ahead; 559 web files differ). **Never merge octoberBranch into master.** |
| Uncommitted in the canonical checkout | 15 paths: <br>• the hits/blocks league-to-date rescale (9 `web/lib/projections/*` files) plus the **untracked migration `20261020211500_forge_league_skater_physical_totals.sql`** (authority order 88, not applied), owner `local_d181f1c6`; <br>• `supportedBaselineMigration.test.ts` and `migration-authority.json` / `super-goal-final-summary.md` count lines (same lane); <br>• Chef's `CHEF-REGISTER-2026-10-19.md` and `release-r6-2026-10-19/PLAN.md` additions; <br>• this `tasks/handoff-2026-10-20/` folder. |
| Freeze | Native FORGE files listed in `tasks/prd-forge-daily-pipeline.md:88–89` are frozen until **2026-10-20 17:00Z**. |
| 10-20 production FORGE run | Pipeline cron `5,10,15,20,30,35,40,45,55 10 * * *` UTC with per-game resume (R5/R6a). **UNVERIFIED by anyone:** check `forge_runs` for as_of 2026-10-20 (status, git_sha). |
| Scheduled tasks on TJ's Mac | `forge-projection-fallback-20261020`: DISABLED. `forge-daily-live-20261020`: ran 10-19 11:50Z; publish HELD on `native_target_scope_mismatch`. |
| Production DB changes on 10-19/20 | • Migration 86 `20261019172842` (HTML-report shift snapshots) applied. <br>• Migration 87 `20261019211444` (`opponent_skater_allowed_by_position` matview, 128 rows, service_role SELECT, cron `42 9 * * *`) applied. <br>• `rolling_player_game_metrics` bounded recompute: 214 players × 5 strengths, 2026-09-29..10-18, 7,460 rows, 0 mismatches, run 00:16–00:58Z on 10-20. <br>• WGO data itself UNCHANGED (still mislabelled). |
| TJ | Flying 10-20 (IND 06:01 ET → PHL 12:58 ET), so unreachable ~10:00–17:00Z. He reviews via the master task list. |

### Release history (each built as a temp-`GIT_INDEX_FILE` + `commit-tree` candidate on master, gated in a `git archive` export; never a merge)

| Release | Commit | Contents | Notes |
|---|---|---|---|
| R2–R4 | `fa950fd29`, `7294e3847`, `ad93e2887` | Sustainability batch skip, shift-charts preseason isolation, Gamecenter re-normalize, sweep | shift-charts lane |
| R5 | `bb21d5942` | A-01 resumable pipeline; A-02 stale readers; A-05 rolling runtime budget; A-07 sweep; A-08 modeledHeadTotals; A-12 NST queue; A-19 cron alerts; A-20 sustainability; 207 "continued" audit; ingest per-game isolation; option-A stored-snapshot shifts | Several files hand-ported (master ≠ octoberBranch versions) |
| R6a | `3755308fa` | Per-game resumable `run-projection-v2`; team-context sign fix; `nhl_team_data` row choice | |
| R6c | `707f60e83` | RSO port onto master contracts (legacy + interim FORGE daily bridge), RSO UI, planner fixes, Yahoo `min_games_played` | R6b was dropped |
| R6d | `ccfe5e57b` | Started-game lineup lock (`a855c9fe6`); bridge PP-blank → 0 when PP TOI ≤ 6 s (`79d3b792f`); rolling writer season from game date (`5c3be7a0f`) | |
| R6e | `2a74489af` | Compact bridge wire | **HELD/superseded**: expanded rows could exceed 4.5 MB saves |
| R6f | `b630e0767` | Compact wire packed at every snapshot boundary + 4 MB expanded cap | Smoke: `/data` 2.43 → 1.01 MB. **Signed-in save/load NOT verified** |

---

## 2. Operating rules the next orchestrator must keep (from AGENTS.md, memory, and incidents)

**Branches**
- Sole editing checkout is `/Users/tim/Code/fhfhockey.com` on `octoberBranch`. `master` = release.
- Port to master with temp-index candidates, then gate them:
  - export the candidate tree to a throwaway `git init`;
  - symlink `web/node_modules`;
  - include `supabase/`, `migrations/` and `sql/` (the migration tests read them);
  - run tsc with an 8–12 GB heap under `/private/tmp/fhfh-heavy.lock`;
  - compare full Vitest against a pristine master export.

**Contract trap**
- octoberBranch's `consumerRevisionAdmission` / `calibrationEligibility` / `issuedContext` / `gameRevisions` / `startChartContract` / `nativeGoalAccounting` must NOT reach master before writers stamp `external_fantasy_input_contract`. Otherwise Start Chart admits no games.
- R5/R6c used master-compatible hand-ports. Don't copy octoberBranch readers (`forge/players.ts`, `goalies.ts`, `start-chart.ts`, `cron-report.ts`, `withCronJobAudit.ts`, the rolling writer) to master wholesale.

**Pushing (memory: push-octoberbranch-together)**
1. Get TJ's go. "Send it" / "SKO" approve only the action just proposed.
2. Check all 4 Vercel projects (fhfhockey, fhfhockey.com, cms-fhfhockey, functions-fhfhockey): `previewDeploymentsDisabled: true`, production branch `master`.
3. Record the latest deployments, then push.
4. Wait ~90 s, then confirm there are no deployments, GitHub statuses or check runs.

Notes:
- The CLI is at `/Users/tim/.npm/_npx/69f9afb961c37556/node_modules/.bin/vercel`, team `team_KVFicHhQJARTbO6wRD2x6jpq`. The Vercel MCP returns 403.
- A master push gives 1 web build plus 3 CANCELED.
- After a READY build, the edge may serve the old deployment for ~10 s, so confirm with `vercel logs requests … --json` (deploymentId).

**Approvals**
- Production reads, writes, migrations, cron/env changes and releases all need TJ's explicit approval.
- Data-writing and release sessions accept TJ's approval only when given **directly in their own session**. Relayed approvals are refused, correctly; the auto-mode classifier blocks them.
- Code, commit and read-only work can be relayed.

**Never**
- Call `truncate_rolling_player_game_metrics`.
- Make Yahoo transactions.
- Set GIT_DIR or GIT_WORK_TREE in test runs (the 10-19 fixture-commit incident).
- Bypass a permission block.
- Commit TJ's private league exports.

**Limits**
- NST requests at least 21 s apart.
- Cross-session messages: at most 10 per user turn from one session; send one at a time and keep them under ~2,000 chars.

**Dev server**
- TJ's localhost:3000 dev server runs the **working tree** (octoberBranch code) against production data. The "approved localhost runs" therefore execute unreleased code. That is how the 10-13..10-19 FORGE runs got null PP heads (§3B).
- Keep half-edited route files out of the tree while production calls go through it.

**Gotchas**
- CSS Modules pure mode: impure selectors break `next build` while Vitest passes. Run the pure check.
- zsh doesn't word-split `$VAR`, has no `PIPESTATUS` (use `${pipestatus[1]}`), and treats `"$X:path"` as a `:` modifier (use `${X}:path`).

---

## 3. Workstream checkpoints

### A. RSO (Roster Schedule Optimizer). Owner was the outgoing orchestrator. Diaries: `orchestrator-code-handoff-review`, `keep-rso-saves-small-as`, `daily-rso-schedule-refre`, `rso-decision-replay`.

**Live (R6c→R6f)**
- **Interim FORGE daily bridge** (`web/lib/rosterScheduleData/forgeDailyBridge.ts`). Each player's latest FORGE v2 line from the last 7 days is re-aimed per game using:
  - FORGE team strength with last season blended at 20 games;
  - rest and home effects;
  - opponent F/D tilt from matview 87;
  - season rates for PIM/+/-/SHP/GWG/FO;
  - IFTTT goalie news;
  - a Poisson win estimate.

  Notes: `RSO_FORGE_DAILY_BRIDGE=off` disables it. Compact wire: `bridgeForecastWire.ts`. Packing at every snapshot boundary: R6f.
- **UI:** by-position grid with optimize animation, bench days, candidate cards, lineup-goal toggle, injury flags, one navbar.
- **Planner (`web/lib/rosterScheduleOptimizer/planning.ts`):**
  - IR/O players are not lined up or auto-dropped (planner only);
  - reserve moves go only into open slots;
  - reserve-slot players are never drop candidates;
  - started games today are locked display rows;
  - activeGames counts remaining games only.

**Open / defects (all real; map to master list R1–R3)**
- **R2 is a regression from `ed949622d`.** `prepareEvaluation` skips IR/O players before plays exist, so a provider-locked injured starter's slot frees up and gets reassigned. Fix: keep locked occupancy; exclude only contribution.
- **R1:** `planningTimeline.ts:66–75` lets drop and reserve steps happen after puck drop the same day. Daily locks should run to the next league-local midnight. `a855c9fe6` fixed only assignment/occupancy.
- **R3:** the `lineupGaps.ts` DROP chip lacks the planner's no-auto-drop injury predicate.

**Coverage**
- On 10-19, 420 of 1,007 players had projections. Root causes (Q1–Q5, read-only, verified):
  - **(1) Blank heads (~209 skaters):** octoberBranch commit `6e14053ff` (not in master) writes null PP and sometimes ES heads when there is no aligned NST pair. All 7 runs the RSO used (as_of 10-13..10-19) were made 10-19 18:04–19:12Z through localhost with git_sha null. 648 of 1,807 rows were blank: 533 PP-only, 112 PP+ES, 3 ES-only. The 6 s rule rescued only 19; 151 with real PP time stay dropped.
  - **(2) Stale rule (54 skaters):** they sat out their team's last game.
  - **(3) Not projected (~282):** outside the last-game lineup (by design).
- Production master code writes full heads, so coverage should heal as teams play from 10-20. **UNVERIFIED:** read the `/data` limitation lines.
- **Provenance hole:** readers exclude only `git_sha like 'local:%'`, but `run-lifecycle-queries.ts:226` writes null when no SHA env is set. Localhost-made runs are therefore served to users (relates to F1).

**Schedule freshness (lane `local_e4329c76`)**
- Daily cron route `update-roster-optimizer-schedule-daily` is built and tested, in `b8fe1072e`, not on master. A proposed `vercel.json` line `52 8,14 * * *` awaits TJ.
- It must ship together with the octoberBranch witness slice (`source.ts`, `normalize.ts`, `types.ts`, `update-roster-optimizer-schedule.ts`, `planningInputs.ts`). The witness check exists only on octoberBranch, so production RSO doesn't depend on it.
- Local witness stamps expire ~**2026-10-21 08:00Z**. That affects only TJ's local octoberBranch RSO, which falls back to estimates.
- D3 (timeout without cancellation) applies to this route.

**To verify**
- R6f signed-in save/load (PUT ≈ 1 MB).
- The RSO grid during a live game.
- A fresh real-account acceptance window (REGISTER #24/#27; the 10-12..18 window expired).
- Ranking ties break by step ID; suggested: lowest baseline contribution first (rso-decision-replay).

**Private:** TJ's RSO planning-evidence export exists only in the outgoing session's scratchpad. Never commit it.

### B. FORGE v2 daily pipeline / serving. Diaries: `chef-resume-1019`, `resume-forge-projection`, `a01-forge-pipeline-resum`, `treat-continuation-207s`, `isolate-per-game-failure`, `diagnose-shift-charts-ro`, `fix-stale-forge-readers`, `a08-missing-head-contrac`, `fix-forge-team-strength`, `r6-s1-serving-source`, `native-serving-plan`.

**Released**
- **Resumable pipeline (A-01, R5):** a state row per stage per day, a lease, and 207 `continuation_required`.
- **Per-game resumable `run-projection-v2` (R6a):** lease in `forge_runs.metrics.resume`; 207 `partial`.
- **Cron audit:** stores continuation 207s as `continued` and the report shows "In progress".
- **Ingest:** isolates bad NHL shift-data games, but the run still returns `success:false`, which stops later stages.
- **shift-charts:** stored-snapshot relationships; HTML fallback present with flag `PROJECTION_SHIFT_HTML_FALLBACK_ENABLED` OFF.
- **Readers:** stale-reader age cap (3 days); shared missing-head rule.
- **Team-context:** sign fix; `nhl_team_data` is a VIEW, 3 rows per team.

**Open**
- **Resume vs Starter Board:** resume works only when Starter Board capture/compute are off. **TJ must check `STARTER_BOARD_COMPUTE_ENABLED` in production.**
- **Second writer:** pg_cron's own `run-projection-v2` (~10:12Z) writes inside the pipeline window.
- **F4 (master list):** late writers can corrupt after a takeover (reproduced with the actual runner).
- **Remaining limits:**
  - `CronAuditEmail.tsx` has no "continued" label (shows OK);
  - range mode doesn't stop at a timed-out date;
  - the goalie step reruns on each resumed invocation;
  - `nhl_team_data` returns latest-only data, which leaks future data into backtests (a view migration is ask-first).
- **Reader follow-ups:**
  - `apiHelpers.requireLatestSucceededRunId` and goalie fallback have no local/single-game filter (F1);
  - `featureBuilder.ts:1233–1240` still sums partial heads;
  - `?? 0` remains in `FORGE.tsx`, `TopAddsRail.tsx` and `forge/player/[id].tsx`;
  - accuracy treats a missing shutout probability as 0.
- **S-1 server-side forecast source** (`forecastServingSource.ts`, octoberBranch `5ae65fc13`): done, not released, activates via `PLAYER_FORECAST_NATIVE_CATALOG_HEAD_ID`. Native serving plan decisions: D-1 serve-and-flag and D-2 empty (chosen); D-3..D-7 open. The plan is stale vs R5/R6.

### C. FORGE model quality. Diaries: `find-why-forge-projects`, `calibrate-forge-hit-bloc`, `forge-hits-blocks-recenc`, `find-why-forge-skips-reg`, `review-forge-model-82-ga`, `forge-baseline-v2-prior`.

**Hits/blocks zeros**
- **Cause:** EV rolling counts come only from NST gamelogs, which covered ~26% of 2026-27 skater-games (ops-health P-I backlog). A thin last-5 window with 0 events gave exactly 0, with no fallback.
- **Fix:** in `b8fe1072e` (octoberBranch, NOT master). FORGE reads the all-strength row (WGO fallback, includes PK) and blends last-5 with a three-season baseline shrunk to F/D priors. Calibrated: priors F 4.9/2.1, D 3.2/4.4; KP 50/300; KR 120/1000; TOI cap 1.3.
- **Follow-up (uncommitted, `local_d181f1c6`):** a league-to-date rescale. Prior seasons are weighted 0.5 and scaled by clamp(Ltd*/Lp, 0.7, 1.3); hits KR 240. It uses the new SQL function `forge_league_skater_physical_totals`, migration 88, not applied; the code falls back to r=1 if the function is missing.
  - Backtest: hits −240 and blocks −69 deviance; established-D hits calibration 1.13 → 1.04–1.05.
  - Checks: 231 focused, 1,322 wider and tsc pass.
  - **Needs TJ:** commit/release, then the hosted migration apply.
  - **Migration-numbering conflict:** IFTTT SQL6–8 drafts now need 89–91.
- **Next for this lane:** an optional read-only Q9 re-run to confirm deciles 9–10 ≈ 1.0 after the recompute; then optionally refit KR on corrected rows. Games 6–10 of 2025-26 overpredict ~5% under all variants (not addressed).

**Shrinkage (F3)**
- `sampleWeight` uses per-game average TOI plus history-wide shots, so w ≈ 0.7 for any veteran.
- The season bootstrap runs only on scoped Starter Board runs.
- The Larkin/Wood anomaly is probably driven more by the NST gap. Not verified row by row.

**PP/ES blank-head policy (A-08 / `6e14053ff`)**
- Decide: keep withholding heads, or fall back to a shrunk prior tagged `prior_only`.
- Also stamp non-Vercel runs `local:unknown`.
- The stale rule could keep a one-game absentee with no availability event.

**82 → 84 games**
- All current sites are correct for 2026-27.
- `previousAppearanceWindow: 82` breaks in 2027-28. It needs a versioned baseline v2 that keeps the v1 hash pinned.
- Session `local_1a6919f9` is waiting to be **messaged after 17:00Z** (not urgent).

### D. Data integrity / feeds. Diaries: `diagnose-inflated-rollin`, `audit-readers-of-mislabe`, `a05-rolling-batches`, `a07-sweep-fix`, `fix-nst-team-daily-queue`, `a19-cron-alerts`, `a20-sustainability-skip`.

**WGO season labels**
- 253,257 `wgo_skater_stats` rows dated 2010-12-20..2017-01-16 are labelled `season_id=20242025`, plus 105 rows dated 1959/1967.
- **Writer guard released (R6d) and 2026-27 rolling recompute done.** The data fix is ON HOLD:
  - NOT VALID checks require a non-null game_id matching the season;
  - the rows have a null game_id and team_abbrev.
- **Remaining routes:** NHL API game logs, or a constraint change.
- **105 rows:** an exact fix is proposed (5 game-id lookups), awaiting a go.
- **Optional:** historical recompute of 2024-25/2025-26 rows (~740k).
- **Prevention:** an ingest/DB check. This is the second occurrence (April 2023 was the first).
- **Live exposure:** `/stats/player/[id]?season=20242025`.
- **Rule:** always bound `wgo_skater_stats` reads by date, not only `season_id`.

**Rolling writer**
- 180 s budget plus a `continueDailyWindow` cursor (R5).
- The 6 proposed pg_cron `continueDailyWindow` entries (08:20–08:45Z) were never applied.
- The writer's `season` option truncates history; bound recomputes by startDate/endDate.
- `updated_at` is set only on insert.

**NST**
- A-12 queue fixed (R5).
- **Pre-existing UTC date shift:** `formatEstDate(parseISO(date))` maps X→X−1 on Vercel. It is fixed in incremental/forward modes, NOT in reverse mode. TJ's manual 09-29..10-18 catch-up dates may have landed a day early (unverified).
- D1: the zero-delay burst violates the 21 s rule.

**Other feeds**
- WGO goalies: D2, partial-date skip.
- Sweep: summaries for games touched 10-19 may still be unrefreshed (unverified).
- Sustainability: whether degraded rows were re-run is unverified.
- `GAME_DATA_ROUTES` in `cron-report.ts` is hand-maintained.

### E. Native FORGE pipeline (v1/v2). Diaries: `forge-v1-fix-native-targ`, `apply-means-only-filter`, `v2-prerollout-gates`, `native-serving-plan`, `chef-resume-1019`.

**v1 live run 10-19**
- All gates passed, but the publish dry run held with `native_target_scope_mismatch`: 9 means-only players, 75 sources, no target.
- TJ chose **option (a)**: serve only players with participation targets; the standing approval covers the narrowed issuance.

**Patches (committed as artifacts, NOT applied)**
- `tasks/artifacts/forge-target-scope-fix-2026-10-19/`: 01, 01b, 02, 03b.
- `tasks/artifacts/forge-v2-target-scope-fix-2026-10-19/`: 05. It competes with 03b; Chef keeps one.
- `tasks/artifacts/forge-v2-prerollout-gates-2026-10-19/`: 06 (A-13..A-18).
- `tasks/artifacts/forge-v2-integration-2026-10-18/`: 01–04.

**Apply order (after 17:00Z):** v2 01→04, 01b, 03b, 02, then 06.
- Verified only in scratch at `865cbbf12`.
- N2: patch 02 now FAILS `git apply --check` on the planning files against current HEAD, so a rebase is needed. Preserve the injury and objective schema additions and the bridge.

**Decisions for TJ**
- A-14: split skater/goalie materializations (1,520 > 1,500 limit).
- A-18: approval-ref and policy terms.
- A-17: means ceiling.
- A-15: boxscore budget.

**Timing**
- The v1 standing approval covers cutoffs only until **2026-10-27 04:00Z**.
- First rolling v2 issuance is planned around 10-27.
- Activation needs two clean consecutive issuances on one head, plus env/redeploy approval.

### F. Platform / ops misc. Diaries: `s09-npm-ci-check`, `chef-resume-1019`.
- **S-09:** removal of 7 dependencies (`317f8f57e`, octoberBranch only). Verified safe (npm ci and tsc pass, no references). Ready to port into a master candidate.
- **npm audit:** 57 vulnerabilities, untriaged.
- **Chef open items:**
  - ignoreCommand fix (cms/functions built unplanned in R5);
  - `nhl_team_data` view migration;
  - A-21 ESPN decision;
  - `STARTER_BOARD_COMPUTE_ENABLED`;
  - migration 88 numbering.
- **D4 (master list):** Supabase Data API default-grant change on **October 30**. Explicit grants are needed for new/recreated objects; review by 10-29.

---

## 4. Decisions waiting on TJ (deduplicated across all diaries + master list)
1. **Release scope and order.** The next candidate: F2 null-win port, R1–R3 RSO fixes, S-09. Optionally the hits/blocks model (`b8fe1072e` + lgTD) and its migration 88, which must be renumbered against IFTTT 89–91.
2. **Native rollout (after 17:00Z).**
   - 03b vs 05;
   - patch 06 decisions A-14/A-15/A-17/A-18;
   - N1/N2 integration;
   - native serving D-3..D-7: activation, head-ID process, B2 cron, expiry window, dashboard scope.
3. **RSO schedule cron** `52 8,14 * * *`, shipped with the witness slice. Accept or reject the overlap risk.
4. **FORGE blank-head policy:** withhold vs `prior_only` fallback. Also stamp local runs and decide the stale-rule exception.
5. **WGO data:** NHL-API relabel route or a constraint change; the 105-row fix; historical recompute; an ingest guard.
6. **Ops:**
   - apply the A-05 `continueDailyWindow` pg_cron entries;
   - turn on `PROJECTION_SHIFT_HTML_FALLBACK_ENABLED`;
   - check `STARTER_BOARD_COMPUTE_ENABLED`;
   - add a CronAuditEmail "continued" label;
   - pipeline behaviour when ingest isolates games (`success:false` stops later stages).
7. **Continuation safety (F4):** quiescent-only vs forced fencing.
8. **WGO-goalie recovery (D2):** checkpoint vs overlap.
9. **A new real-account RSO acceptance window.**
10. **Research-to-product choices** (master list item 7): VuDu interpretation, ownership caution (R7: 0% ≠ unknown, confirmed), player-page direction.

## 5. Check first (unverified facts that change decisions)
1. The 10-20 production FORGE chain: `forge_runs` (2026-10-20), cron audit rows, the pipeline state table. Then bridge coverage via the `/data` limitation lines. Production reads need TJ's OK.
2. R6f signed-in workspace save/load, plus the RSO grid during a live game.
3. Whether TJ's manual NST team-daily catch-up landed on the intended dates (UTC shift).
4. Whether the sustainability degraded rows and the sweep summaries were re-run.
5. `STARTER_BOARD_COMPUTE_ENABLED` value in production.

## 6. Suggested first moves for the next orchestrator
1. **Read** `HANDOFF-2026-10-20.md` (this file plus the master list) and the per-thread `diaries/`. Don't redo settled analysis.
2. **Before 17:00Z (read-only):** ask TJ for the production-read OK, then run the §5 checks.
3. **Settle uncommitted work.** With TJ's go, the hits/blocks owner (`local_d181f1c6`) commits its lgTD rescale with the migration renumbered. The Chef commits its register/PLAN additions.
4. **At 17:00Z:** the Chef integrates native patches (N1/N2) after re-running `git apply --check` against HEAD. Message `local_1a6919f9` (baseline v2) only after the Chef sequences it.
5. **RSO correctness, in parallel** (exact file ownership: `planning.ts`, `planningTimeline.ts`, `lineupGaps.ts`): R1/R2/R3 with failing regressions first.
6. **Then** cut one batched master candidate: F2 + R1–R3 + S-09 (+ hits/blocks if approved). Gate it and get TJ's direct go in the Chef/release session.
7. **Follow the master list's top 10** for the remaining sessions: F4, F1, D1, D2, D3, F3, N1.

## 7. Session directory (for follow-ups; all idle as of 15:20Z)

| Session | ID |
|---|---|
| Chef (releases, register, migrations) | `local_4317ea20-8f4b-4c25-bb6f-64fa68c091b7` |
| hits/blocks lgTD owner | `local_d181f1c6-dfc5-4ea8-aa10-cfc6cd89d06d` |
| Rolling / WGO repair | `local_c39098ae-b2c5-45e1-b651-da2f9abf6347` |
| hits/blocks calibration | `local_24b29608-…` |
| hits/blocks diagnosis | `local_90b997f5-…` |
| Coverage diagnosis | `local_85a0ba2f-…` |
| RSO save-size | `local_b3174028-…` |
| RSO schedule cron | `local_e4329c76-…` |
| Baseline v2 (waiting) | `local_1a6919f9-…` |
| Native target-scope | `local_582cd0e7-…` |
| Means-only v2 | `local_50f8bd81-…` |
| v2 gates (patch 06) | `local_c44fc688-…` |
| Native serving plan | `local_e0302afc-…` |
| S-1 source | `local_65d983ec-…` |

Other workers (A-xx/S-xx) are done; their diaries are in `diaries/`.

## 8. Corrections and additions to the master task list (`MASTER-TASKLIST-2026-10-20.md`)
- **R1/R2/R3:** confirmed. R2 is a regression introduced by `ed949622d` (IR/O skip in `prepareEvaluation`). R1 is not covered by `a855c9fe6`, which handled only assignment occupancy for started games.
- **F5:** the 214-player recompute is now **verified** (DB check: 1,492 rows per strength, 0 rows with 3ya TOI > 6,000 min or GP > 180), not merely user-reported. The lgTD rescale and migration 88 exist **uncommitted** locally. The migration-number conflict with IFTTT is real.
- **F6:** root cause pinned to `6e14053ff` (octoberBranch) plus off-release localhost runs. Q5 counts are verified by read-only query: 648/1,807 blank (533/112/3). The localhost runs were the TJ-approved `run-projection-v2` backfills, executed through the dev server on octoberBranch code.
- **F1:** extend to the RSO bridge and `apiHelpers`. Null `git_sha` (not just `local:%`) marks runs made off the release path.
- **N1/N2:** keep only one of 03b/05. Patch 06 also needs post-freeze application and TJ's A-14/15/17/18 answers.
- **Release readiness:** S-09 (dependency removal) is a ready, low-risk port to add to the next batch.
- **Start Chart NEW 19.0:** stale on both branches (agrees with the list).
- **R6:** R6f already enforces a 4 MB expanded cap and packs saves. Remaining work is exact UTF-8 envelope measurement only.
