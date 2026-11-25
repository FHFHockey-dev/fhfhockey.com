# Parity oracle diff from the FORGE projection-math fixes H4, L1, M3 (2026-11-25)

**Approval status: APPROVED by TJ, 2026-11-25.** TJ answered in the Chef's pop-up. TJ approved this oracle change and chose to keep the `pbp_games` coverage-guard allowlist entry rather than extend the fixture.

**Why:** `parity.test.ts` and `computeOff.test.ts` compare the writer with recorded oracles that "must never be re-recorded to fit a change". The audit fixes H4, L1 and M3 change reads and writes on purpose. This note lists every difference, so nothing else is masked.

**Candidate:** fix commit `b917b59319d358a80fd363339d4e5e6deb7b14fc`, on master `1dab9b518`. It is the clean rebase of the 2026-11-16 lane commits 95711cd2c (L1), ebfe8fb1d (M3), fb833ddb2 (H4) and d578bfe80 (tests).

## Method
Three `git archive` exports ran the same scratch dump tests against the fixture world. The tests are not committed.
- master `1dab9b518` (before).
- master plus L1 and M3 only: merge-tree `56f94a616`.
- the fix commit (after).

L1+M3 versus before is the L1 and M3 effect. After versus L1+M3 is the H4 effect.

**Re-record:** `RECORD_FORGE_ORACLE=1` ran on the fix commit. A structural check compared every re-recorded file with the committed one.
- Reads: in each scenario and invocation, the only difference is one block at the same position. The 3 target-game reads (`pbp_games`, 2 `pbp_plays` counts) become 8 previous-game reads: per team, `games` lookup, `pbp_games`, 2 `pbp_plays` counts.
- Writes: in each scenario, the tables whose hash changed are exactly the tables the dumps show changing.
- Unchanged: candidates, and the compute-off invocation results.

**Two files patched, not re-recorded:** `goalie-model-reorders-candidates.json` and its compute-off twin, following the 2026-11-15 precedent. Their tests require the writer's goalie-input reads to differ from the pre-split order, so each file keeps its old reads.
- Only the 3-read block is replaced by the recorded 8-read block, at the same position.
- Writes and `outputHash` come from the recording. The writes were asserted identical except `forge_runs`.
- Candidates and results were asserted unchanged.
- The splice was checked on six non-reorder files, where it reproduces the recording byte for byte.

**M3: no oracle change.** No fixture lineup skater lacks a roster row. The new keys (`filtered_skater_not_on_team_current_roster`, `_ids`) are lazy, so they are absent from every oracle and every dump.

## The 23 failing comparisons, one line each
On the fix commit before the re-record: parity.test.ts 18 (writer vs oracle 9, collector vs oracle 9), computeOff.test.ts 5.

The 9 collector tests fail only because they compare the collector's reads with the oracle. The collector's reads still equal the writer's.

| test | scenario | cause | what moved |
|---|---|---|---|
| writer + collector | normal-one-game | L1 | reads 120→125; `missing_pbp_games` 1→2; 2 warnings |
| writer + collector | skater-pool-recovery | L1 | reads 128→133; same |
| writer + collector | season-bootstrap | L1 | reads 105→110; same (previous games 2025021200, 2025021250) |
| writer + collector | reserve-pass-on | L1 | reads 134→139; same; reserve rows identical |
| writer + collector | target-pbp-pregame | L1 | reads 120→125; same |
| writer + collector | goalie-override-multi-candidate | L1 + H4 | reads 139→144; L1 metrics; team 10 (17 skaters) capped pool, see below |
| writer + collector | opponent-shots-gate | L1 | reads 67→72; same |
| writer + collector | goalie-model-reorders-candidates | L1 | reads 134→139; same (patched file) |
| writer + collector | lineup-evidence-gate | L1 + H4 | reads 135→140; L1 metrics; team 10 (17 skaters) capped pool, see below |
| compute-off | normal-one-game | L1 | reads 111→116; `forge_runs` metrics only; result identical |
| compute-off | reserve-pass-on | L1 | reads 125→130; same |
| compute-off | goalie-override-multi-candidate | L1 + H4 | reads 130→135; same H4 rows as the writer scenario |
| compute-off | goalie-model-reorders-candidates | L1 | reads 125→130; same (patched file) |
| compute-off | resumed-run | L1 | inv0 reads 51→56 (no write change); inv1 reads 112→117, `forge_runs` metrics |

**The L1 effect, everywhere:**
- `forge_runs.metrics.data_quality.missing_pbp_games` goes 1→2.
- Two warnings are added at the head of `metrics.warnings`: "previous game 2026020100 of team=10 …" and "previous game 2026020150 of team=6 … has no complete stored PBP". Older warnings shift down 2 places.
- The old 1 was the target game itself, which is always pregame. The fixture stores no PBP for either team's previous game, so the new count is 2.
- `missing_shift_totals` stays 0.

## H4: team 10 at 17 skaters (the cap binds)
In both scenarios the pool's own pre-allocation exposure exceeds the 17,000 s ceiling (17/18 × 18,000 s), so every skater scales by about ×0.944.
- In goalie-override-multi-candidate, 8471002 is out of the lineup. In lineup-evidence-gate, 8471003 is out.
- Team 6 player rows are identical.
- The team row's TOI and shots columns are identical (full team).
- The opposing goalie's shots against, saves and goals allowed are identical.
- Reserve rows are identical.
- A new `uncertainty.missing_skater_coverage` block records the shortfall: modeled_share 0.9444; unmodeled TOI ES 803 / PP 95 / PK 102 s.

TOI in minutes, old → new.

### goalie-override-multi-candidate
| player_id | TOI min ES / PP / PK (old → new) | TOI total min | shots ES/PP/PK total | goals total | assists total | hits | blocks |
|---|---|---|---|---|---|---|---|
| 8471023 | 20.50→19.35 / 2.62→2.47 / 2.70→2.55 | 25.82 → 24.37 | 2.276 → 2.148 | 0.150 → 0.140 | 0.482 → 0.454 | 1.948 → 1.838 | 1.538 → 1.452 |
| 8471021 | 20.28→19.17 / 2.32→2.18 / 2.95→2.78 | 25.55 → 24.13 | 2.314 → 2.185 | 0.141 → 0.134 | 0.489 → 0.462 | 2.027 → 1.915 | 1.534 → 1.449 |
| 8471022 | 19.58→18.50 / 2.55→2.42 / 2.88→2.72 | 25.02 → 23.63 | 2.333 → 2.202 | 0.149 → 0.141 | 0.500 → 0.473 | 1.920 → 1.815 | 1.526 → 1.442 |
| 8471024 | 18.30→17.28 / 2.20→2.08 / 2.40→2.27 | 22.90 → 21.63 | 2.006 → 1.893 | 0.133 → 0.126 | 0.443 → 0.418 | 1.443 → 1.363 | 1.408 → 1.330 |
| 8471001 | 15.82→14.95 / 2.45→2.30 / 2.72→2.57 | 20.98 → 19.82 | 2.486 → 2.345 | 0.328 → 0.309 | 0.456 → 0.430 | 1.360 → 1.284 | 0.437 → 0.412 |
| 8471025 | 16.73→15.80 / 0.00→0.00 / 2.75→2.60 | 19.48 → 18.40 | 1.673 → 1.584 | 0.091 → 0.086 | 0.251 → 0.236 | 1.490 → 1.407 | 1.174 → 1.108 |
| 8471005 | 14.30→13.52 / 2.32→2.20 / 2.77→2.60 | 19.38 → 18.32 | 2.579 → 2.434 | 0.340 → 0.322 | 0.428 → 0.404 | 1.419 → 1.342 | 0.398 → 0.377 |
| 8471026 | 16.18→15.28 / 0.00→0.00 / 2.22→2.08 | 18.40 → 17.37 | 1.505 → 1.426 | 0.085 → 0.081 | 0.238 → 0.225 | 1.522 → 1.437 | 1.091 → 1.031 |
| 8471007 | 12.90→12.18 / 2.10→1.98 / 2.47→2.33 | 17.47 → 16.50 | 2.086 → 1.968 | 0.264 → 0.251 | 0.386 → 0.364 | 1.189 → 1.123 | 0.364 → 0.344 |
| 8471006 | 12.87→12.15 / 2.20→2.07 / 2.33→2.20 | 17.40 → 16.42 | 2.535 → 2.392 | 0.319 → 0.302 | 0.400 → 0.376 | 1.214 → 1.145 | 0.345 → 0.326 |
| 8471003 | 12.32→11.63 / 2.32→2.20 / 2.38→2.25 | 17.02 → 16.08 | 2.185 → 2.061 | 0.295 → 0.278 | 0.385 → 0.364 | 1.335 → 1.262 | 0.342 → 0.324 |
| 8471004 | 10.43→9.85 / 2.28→2.15 / 2.12→2.00 | 14.83 → 14.00 | 1.962 → 1.851 | 0.255 → 0.241 | 0.361 → 0.341 | 1.233 → 1.163 | 0.301 → 0.284 |
| 8471009 | 11.17→10.53 / 2.33→2.20 / 0.00→0.00 | 13.50 → 12.73 | 1.879 → 1.773 | 0.249 → 0.234 | 0.342 → 0.322 | 0.931 → 0.878 | 0.265 → 0.250 |
| 8471008 | 10.52→9.93 / 2.73→2.58 / 0.00→0.00 | 13.25 → 12.52 | 1.880 → 1.774 | 0.255 → 0.241 | 0.366 → 0.345 | 0.859 → 0.812 | 0.261 → 0.247 |
| 8471010 | 10.73→10.13 / 0.00→0.00 / 0.00→0.00 | 10.73 → 10.13 | 1.441 → 1.365 | 0.179 → 0.170 | 0.207 → 0.195 | 0.757 → 0.715 | 0.211 → 0.200 |
| 8471011 | 9.20→8.68 / 0.00→0.00 / 0.00→0.00 | 9.20 → 8.68 | 1.248 → 1.184 | 0.155 → 0.147 | 0.180 → 0.170 | 0.710 → 0.670 | 0.189 → 0.178 |
| 8471012 | 9.08→8.58 / 0.00→0.00 / 0.00→0.00 | 9.08 → 8.58 | 1.234 → 1.170 | 0.152 → 0.144 | 0.176 → 0.166 | 0.600 → 0.567 | 0.174 → 0.164 |
| **team 10 pool (17)** | | 300.02 → 283.32 | 33.622 → 31.755 | 3.540 → 3.347 | 6.090 → 5.745 | 21.957 → 20.736 | 11.558 → 10.918 |

- forge_team_projections team=10 goalie=None: `proj_goals_es` 2.5460 → 2.5480; `proj_goals_pk` 0.0450 → 0.0470; `proj_goals_pp` 0.9490 → 0.9500; uncertainty fields changed: 22
- forge_team_projections team=6 goalie=None: identical
- forge_goalie_projections team=10 goalie=8471031: `proj_win_prob` 0.5241 → 0.5246; uncertainty fields changed: 23
- forge_goalie_projections team=6 goalie=8470632: `proj_win_prob` 0.4599 → 0.4594; uncertainty fields changed: 16
- game_prediction_outputs team=None goalie=None: `home_expected_goals` 3.5400 → 3.5450; `spread_projection` 0.3080 → 0.3130; `total_expected_goals` 6.7720 → 6.7770
- `forge_runs` (H4): skater_pool_emergency_toi_target_caps_applied 0→1; toi_scale_max 1.0151→0.9651; toi_scale_min 0.9651→0.9645; reconciliation_top_es_share_max 0.0851→0.0850; reconciliation_top_pp_share_max 0.0962→0.0963; new warning "skater pool coverage cap for game=2026020250 team=10; projected_count=17 of 18 canonical_target=18000 pool_ceiling=17000 capped_target=17000".
- Team native goal accounting: the sum of modeled player goals is 3.540 → 3.347.

### lineup-evidence-gate
| player_id | TOI min ES / PP / PK (old → new) | TOI total min | shots ES/PP/PK total | goals total | assists total | hits | blocks |
|---|---|---|---|---|---|---|---|
| 8471023 | 20.62→19.47 / 2.62→2.48 / 2.72→2.57 | 25.95 → 24.52 | 2.214 → 2.091 | 0.146 → 0.136 | 0.477 → 0.450 | 1.958 → 1.850 | 1.546 → 1.461 |
| 8471021 | 20.40→19.27 / 2.32→2.18 / 2.97→2.80 | 25.68 → 24.25 | 2.253 → 2.126 | 0.137 → 0.129 | 0.483 → 0.457 | 2.038 → 1.925 | 1.543 → 1.457 |
| 8471022 | 19.70→18.60 / 2.57→2.42 / 2.90→2.75 | 25.17 → 23.77 | 2.270 → 2.141 | 0.144 → 0.136 | 0.495 → 0.468 | 1.932 → 1.824 | 1.536 → 1.450 |
| 8471024 | 18.42→17.38 / 2.20→2.08 / 2.42→2.28 | 23.03 → 21.75 | 1.953 → 1.842 | 0.129 → 0.122 | 0.437 → 0.414 | 1.451 → 1.371 | 1.416 → 1.337 |
| 8471001 | 15.92→15.03 / 2.45→2.32 / 2.75→2.58 | 21.12 → 19.93 | 2.418 → 2.282 | 0.318 → 0.301 | 0.473 → 0.446 | 1.368 → 1.292 | 0.439 → 0.415 |
| 8471025 | 18.23→17.22 / 0.00→0.00 / 2.78→2.62 | 21.02 → 19.83 | 1.759 → 1.665 | 0.096 → 0.091 | 0.271 → 0.255 | 1.607 → 1.517 | 1.266 → 1.195 |
| 8471002 | 14.72→13.90 / 2.25→2.13 / 2.77→2.62 | 19.73 → 18.65 | 2.478 → 2.338 | 0.300 → 0.283 | 0.440 → 0.416 | 1.622 → 1.533 | 0.419 → 0.396 |
| 8471005 | 14.38→13.58 / 2.33→2.20 / 2.78→2.63 | 19.50 → 18.42 | 2.512 → 2.371 | 0.331 → 0.313 | 0.424 → 0.399 | 1.428 → 1.348 | 0.401 → 0.379 |
| 8471026 | 16.28→15.37 / 0.00→0.00 / 2.23→2.10 | 18.52 → 17.47 | 1.469 → 1.390 | 0.083 → 0.079 | 0.239 → 0.226 | 1.532 → 1.446 | 1.098 → 1.037 |
| 8471006 | 12.95→12.22 / 2.20→2.08 / 2.35→2.22 | 17.50 → 16.52 | 2.468 → 2.330 | 0.310 → 0.293 | 0.395 → 0.372 | 1.221 → 1.153 | 0.347 → 0.328 |
| 8471004 | 11.23→10.62 / 2.28→2.15 / 2.13→2.02 | 15.65 → 14.78 | 2.001 → 1.888 | 0.260 → 0.245 | 0.382 → 0.361 | 1.300 → 1.228 | 0.318 → 0.300 |
| 8471007 | 9.77→9.23 / 2.10→1.98 / 1.88→1.77 | 13.75 → 12.98 | 1.918 → 1.811 | 0.247 → 0.233 | 0.330 → 0.312 | 0.935 → 0.884 | 0.287 → 0.271 |
| 8471009 | 11.22→10.60 / 2.35→2.22 / 0.00→0.00 | 13.57 → 12.82 | 2.055 → 1.939 | 0.274 → 0.259 | 0.344 → 0.325 | 0.936 → 0.884 | 0.266 → 0.251 |
| 8471008 | 10.58→10.00 / 2.75→2.58 / 0.00→0.00 | 13.33 → 12.58 | 2.028 → 1.913 | 0.276 → 0.261 | 0.369 → 0.348 | 0.864 → 0.816 | 0.263 → 0.248 |
| 8471011 | 9.25→8.75 / 0.00→0.00 / 0.00→0.00 | 9.25 → 8.75 | 1.216 → 1.153 | 0.152 → 0.144 | 0.172 → 0.163 | 0.714 → 0.675 | 0.190 → 0.179 |
| 8471012 | 9.13→8.63 / 0.00→0.00 / 0.00→0.00 | 9.13 → 8.63 | 1.202 → 1.140 | 0.148 → 0.141 | 0.169 → 0.160 | 0.603 → 0.570 | 0.175 → 0.165 |
| 8471010 | 8.12→7.67 / 0.00→0.00 / 0.00→0.00 | 8.12 → 7.67 | 1.413 → 1.338 | 0.174 → 0.165 | 0.160 → 0.151 | 0.573 → 0.541 | 0.160 → 0.151 |
| **team 10 pool (17)** | | 300.02 → 283.32 | 33.627 → 31.758 | 3.525 → 3.331 | 6.060 → 5.723 | 22.082 → 20.857 | 11.670 → 11.020 |

- forge_team_projections team=10 goalie=None: `proj_goals_pk` 0.0450 → 0.0460; `proj_goals_pp` 0.9420 → 0.9430; uncertainty fields changed: 23
- forge_team_projections team=6 goalie=None: identical
- forge_goalie_projections team=10 goalie=8471031: `proj_win_prob` 0.5225 → 0.5227; uncertainty fields changed: 19
- forge_goalie_projections team=6 goalie=8470631: `proj_win_prob` 0.4614 → 0.4612; uncertainty fields changed: 18
- game_prediction_outputs team=None goalie=None: `home_expected_goals` 3.5250 → 3.5270; `spread_projection` 0.2930 → 0.2950; `total_expected_goals` 6.7570 → 6.7590
- `forge_runs` (H4): skater_pool_emergency_toi_target_caps_applied 0→1; toi_scale_max 1.0205→0.9696; reconciliation_top_pp_share_max 0.0968→0.0963; the same coverage-cap warning.
- Team native goal accounting: 3.525 → 3.331.

### compute-off-goalie-override-multi-candidate
Every player row, team, goalie and game value is identical to goalie-override-multi-candidate above, as are the forge_runs H4 metrics. The invocation result is unchanged.

## Read this first: what "unchanged" means
- Team goals move by up to ±0.002 and goalie win probability by up to ±0.0005.
  - Team goals are sums of three-decimal player rows, rescaled to the full team at the pool's per-shot rates. Rounding cannot leave them byte-identical.
  - The game total and spread follow: +0.002 to +0.005.
- Team TOI and shots, the opposing goalie's shots against, saves and goals allowed, and reserve rows are byte-identical.
- These values match the lane's 2026-11-16 expectation diff (measured on 3dc9ae1ba). Master's later changes did not move them.

## Coverage guard: one test-only allowlist entry (approved by TJ, 2026-11-25)
- After the re-record, "fixture world coverage > every read relation returns rows in at least one scenario" failed with `['pbp_games']`.
- The old writer read the target game's `pbp_games` row. The `target-pbp-pregame` scenario seeded that row, so it was the one place the relation returned data.
- Under L1 the writer reads only each team's previous game, and the fixture stores no PBP for any previous game. So in the parity world:
  - `pbp_games` is now always empty;
  - the healthy path (complete previous-game PBP, then the `shift_charts` read) never runs;
  - the `targetPbpPregameRow` world flag no longer changes any read.
- This commit lists `pbp_games` in `INTENTIONALLY_EMPTY`, with that reason, and rewords the stale `pbp_plays` reason.
- The healthy path is covered by `run-forge-projections.projection-math.test.ts`: "moves a previous game with complete stored PBP on to the shift-total check" and "counts nothing on a healthy slate, and the capture's strict transport accepts the previous-game reads".
- **Alternative, declined by TJ on 2026-11-25:** extend the fixture world so one scenario stores complete PBP and shift charts for a previous game. Parity would then exercise the healthy path too. It is a larger change and moves that scenario's oracle again (`missing_pbp_games`, plus a `shift_charts` read). Not done here.

## Result
After the re-record, and with the two files patched, the parity and compute-off suites pass unrecorded. The gate results are in the Chef report (`forge-math-h4l1m3/REPORT.md` in the session notes folder).
