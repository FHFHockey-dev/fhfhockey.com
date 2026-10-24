# Claude FORGE model lane (2026-10-22)

## Scope
FORGE model lane of `tasks/TASKS/forge-projections/tasks-forge-projection-improvements-2026-10-22.md`: task 2 (land + gate), release plan for Chef, then tasks 3, 4, 5, 9. Chef = `local_08a0bf1c`. Holds the `skater-stage.ts` lease.

## Where
- Branch `octoberBranch` (shared checkout). HEAD at start `cbb4f6836`.
- Task 2 files: `web/lib/projections/queries/skater-queries{,.test}.ts`, `calculators/skater-adjustments.ts`, `nativeGoalAccounting.test.ts`, `runProjectionV2.test.ts`, `web/scripts/qualify-native-players-offline.{ts,test.ts,md}`, `web/scripts/fixtures/native-player-offline-synthetic.json`.

## State
- All 9 task 2 files match `forge-task2-2026-10-22/r3-cache-recheck/SOURCE-PINS.json` byte for byte (the 23 mismatches there are foreign uncommitted files; pins hold their HEAD bytes).
- Hydration `6767073ea`, F3/F4 `b8fe1072e`/`34a5588db` and `6b4898a95` are on octoberBranch, not master. Task 2's uncommitted delta is the paired count/exposure repair + RPC-missing/reconstruction fallback + fixture checksum.
- Scoped Vitest: 315/315 (4 files).

- eslint clean; tsc clean (heavy lock). **Committed `721486d0f`** (9 explicit paths). Chef notified.
- TJ approved (this session, ~18:05Z): captures a + c (62 games, sequential, stop >500 reads/run, >4 h, >60k GETs); 20-player row-identity check (stop 3k GETs); migration 88 NOT applied, ship on F/D priors scale 1.
- Scratch `…/scratchpad/recon/`: `va` = master d45a287f0, `vc` = master + hydration (3-way) + F3/F4 (3-way) + task 2 source hunks. Pilot 1 game: 110/122 reads, replays matched. Full run started 18:11Z (`out/full-run.log`). Actuals reused from the 10-21 cohort (hashes 6b945b5a…, aab787fa…). Scorer `score_gate.py`.
- Row-identity script ready: `scratchpad/rowcheck/row-identity.ts` (season 20262027, 20 regulars from the cohort), run after captures.
- Release prototype `scratchpad/recon/rc` (shared clone): c + 6b4898a95 + octoberBranch goalie/market/NB files. Goalie files depend on 6e14053ff / 7f094c8e6 (nullable GF/W); tsc of the prototype running.

- Gate done (`29601891f`): c misses literal ±10% (HIT +10.9%, top 0.883; FP −10.7%) but beats master everywhere; TJ: release as improvement. Row identity: ≥10-07 identical; 09-29..10-06 stale (TJ refreshes later).
- Release plan `328f1ed2a`; Chef shipped **Release B = master `40b17b572`** (my prototype patch), octoberBranch synced `45839f872`. TJ adapted the 2 PPP qualify expectations on master only.
- Task 3: TJ approved one aggregate priors query (ran once, `tasks/artifacts/forge-priors-2026-10-22/`: PRIORS.json, league A/G ES 1.65 / PP 1.91, assist-share k ES ~258/309, PP ~58/84) and a per-gate capture budget (one variant × 62 games, same stop rules) for tasks 3/4/5/9.
- Task 3 candidate in `scratchpad/recon/vd` (c + assist share × team on-ice goals, reconciled to league A/G; select adds `ipp_all`). Pilot: team A/G 1.65 / 1.91 (c had PP 0.63–0.93). Full vd capture running; scorer `score_pair.py`.

- Task 3 gate (d vs c): A −26%→−4%, FP −10.7%→−1.2%, FP top 0.99; PPP +20% (top 0.77, D +52%). Variant e (d + HOLD PP usage e316db4c0) = identical to d: master already uses official PP targets; e stopped at game 18 (one read_failed), 2,192 GETs wasted. TJ: commit task 3, release only with task 4 after a combined gate. **Committed `23adcf713`** (port uses `allocateTeamAssists`; fixture adds `ipp_all`, rowsHash + checksum `7b8a39a4…`).
- Task 4 (variant f = d + F/D × ES/PP goal-conversion priors k 423/704/155/73 shots, SOG/60 priors k 8.4/12.3/10.3/5 h, single shrink for SOG). Dropping the second goal shrink (Q7) raised F sh% to 0.154 in the pilot because context goal multipliers compound ~1.3 (opp goalie 1.18 etc.); kept the small-sample shrink, toward the F/D prior. Q7 belongs with task 9. Full f capture running (`out/full-run-vf.log`).

- Task 4 gate (f, 7,666 GETs; 3 transient zero-read stops, resumed): 3+4 vs c FP −10.7%→−1.0%, RMSE −0.065, D G +46%→+2%, SOG MZ 0.78→0.99; PPP +17% (top 0.92). **Committed `7dee3cbed`**. TJ: hand 3+4 to Chef — sent; candidate `tasks/artifacts/forge-task4-gate-2026-10-22/release-candidate-tasks3-4.patch` (sha 9fc1f7af…) on master 40b17b572.
- Task 5 deferred by TJ (needs native ES+PP accounting contract versioned to include PK). Task 9 first.
- Task 9 analysis (offline, f captures + 10-21 `s5_pp_actuals.json` copied to `recon/cohort/`): PP TOI/SOG right; F PP sh% pred 0.200 vs act 0.170 (prior 0.159); ES SOG −11% = dilution over ~2 non-dressed projected skaters/team (ES TOI/shots reconciled to team targets, so role-stability only redistributes). Goalie quality double-counted (team-level `opponentSaveEdge*2.3` + opp-goalie GSAA ±18%, mean 1.034).
- Variant g = f + drop team save% term + opp goalie damped 50% + role stability → uncertainty volatility ×(2−stability). Pilot: F PP sh% 0.209→0.197; Q7 probe (no 2nd shrink) back to 0.213 → Q7 stays out. Full g capture running.

- Release C (tasks 3+4) shipped by Chef: master `d4c2632d3`, octoberBranch synced `782805fee`.
- Task 9 gate (g vs f, 7,544 GETs): neutral FP (RMSE +0.008, spans 0), HIT/BLK RMSE better, D top-decile share worse; not cleared, no code — verdict `5c6cadc84`.
- k re-fit (TJ): method-of-moments aggregate (`K-REFIT.json`); h (all k) neutral RMSE, G/A/FP slopes better, SOG over-dispersed (`fd3b0a2c9`); hybrid i (share + conversion k only) neutral RMSE, slopes slightly better, SOG unchanged → **committed `0dd535e0d`** (rides with next model release, not released alone).
- Production reads this session: captures ≈ 63k GETs over 10 gate/pilot runs (every run within its stop rules), row identity 1,207 GETs, 2 aggregate SQL queries — all TJ-approved here.

## Next (open)
- Task 5 (SH G/A + PK TOI): deferred by TJ; needs native goal-accounting contract versioned ES+PP+PK and its consumers (forecast-diagnostics, board scoring, start chart).
- Remaining model gaps: forward PP conversion (pred 0.20 vs act 0.17 per shot) → PPP +17%; small-sample second goal shrink capped at 0.76 compresses goals (kept because context goal multipliers inflate conversion; shot-quality multiplier double-counts finishing); ES dilution over ~2 non-dressed projected skaters per team (participation lane).
- Early-season rolling rows 09-29..10-06 stale: TJ refreshes from /db/runner (scope in task 2 gate VERDICT).

## Blockers / approvals
- None pending. Diary kept: task 5 unfinished.

## Blockers / approvals
- None open for the gate. Release push needs TJ; Review lane already committed 6f0c58471 / d65812dc2 (confirm done before freezing).

## Gotchas
- Heavy lock dir was present at 13:50 with no tsc running; wait, never remove.
