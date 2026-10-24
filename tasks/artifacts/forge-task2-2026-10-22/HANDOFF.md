# Task 2: local hydration + F/D physical-prior candidate

Local implementation and offline regressions complete. **Not release qualified.** The skater-stage editing lease is released for the next assigned task; preserve this candidate's fallback changes. No migration, hosted data read/write, paid call, commit, push or deployment was performed.

## Candidate

Compared historical `6767073ea`, the FORGE-only hunks of `b8fe1072e`, and `34a5588db` with canonical `octoberBranch` HEAD `84cb1229cd1c1cdd037c43e660d2a181304ada51` and local master `457435eb3010c5b3dd92d2e1a46d9c75d851780a` (R23). The canonical checkout already contains the full latest-row RPC/sidecar hydration, all-strength physical history selects, F/D priors, weighted current/prior seasons, physical helper and stage wiring. Retained these with the newer native count-support admission controls; no broad cherry-pick or replacement from master.

New changes:

- `skater-queries.ts`: physical totals use the read-only GET form, validate real ISO dates, distinguish missing RPC (`PGRST202` → `rpc_missing`) from provider/transport failures, and bypass RPC dispatch entirely during read-only reconstruction (`read_only_reconstruction`). The last change fixes an actual offline boundary violation previously swallowed by the fallback.
- `skater-stage.ts`: keep one cached physical read per season/date, count unavailable totals safely and emit `physical_league_totals_rpc_missing:without_league_rescale` once on the missing-RPC path. The established helper uses constant F/D priors and scale 1 when league totals are absent. Migration 88 remains unapplied.
- Query/stage tests: exact all-strength sidecar hydration feeds independently checked F/D weighted formulas with scale 1; missing RPC, denied/failed RPC, impossible dates, zero dispatch in reconstruction and two-team fallback caching are covered.
- Native synthetic fixture: all 72 rolling rows explicitly carry the nine newly requested physical columns as null, plus a declared empty support table. Updated its row hash, immutable byte checksum and documented command; removed test-only injection of the missing table. No history values were fabricated. Existing compact formatting preserved.

The patch is an **octoberBranch working-tree delta**, not a clean master release candidate. `SOURCE-PINS.json` identifies the eight edited files and five retained historical dependencies. `task2-source.tar.gz` freezes edited source; `task2.patch` preserves the exact local changes. Release reconciliation must also include the already-present hydration/physical hunks and resolve dependencies through the respective owners, especially the concurrently owned runner. Do not apply the full branch-to-master diff.

## Verification

Node 22.11.0, npm/Vitest; no application build or installation.

| Check | Result |
|---|---|
| Query, physical helper, native stage, native offline suites | **311 passed**, 4 files (`FOCUSED-TESTS.log`) |
| Ranking query/window aggregation/trending, trends player page, rolling writer, reconstruction scorer | **118 passed**, 6 files (`RELATED-TESTS.log`) |
| Native offline suite after preserving fixture formatting/final checksum | **56 passed**, repeat verification (`NATIVE-FINAL.log`) |
| Scoped ESLint on edited TypeScript | **Passed**, no diagnostics (`LINT.log`) |
| Full `npx --no-install tsc --noEmit --incremental false`, 8 GiB heap, shared `/private/tmp/fhfh-heavy.lock` | **Failed**: 11 diagnostics in concurrent `web/lib/rosterScheduleOptimizer/gameForecastPoints.test.ts` only (`TYPECHECK.log`); no task-2 diagnostics; lock released |
| Scoped `git diff --check` | **Passed** |

There are 429 distinct passing cases across the focused and related suites; the final 56-case rerun is not counted twice. Synthetic results establish mechanics, not predictive skill.

## Real cohort and remaining gates

Re-ran the existing local reconstruction scorer with seed 1 and 2,000 cluster-bootstrap replicates against the retained four historical variants. It reproduced **62 games, 2,074 dressed skater-games**, no dropped games (`HISTORICAL-62-GAME-RESCORE.md`). Its labels a/b/a0/b0 refer to the historical R18 reconstructions, not current master or this candidate.

Checked every retained capture: a/b/a0/b0 each contain 62 files, all captured on October 21, with only EV/PP rolling reads and the old 25-column select. All lack the nine physical fields and all-strength history. Variant **c has zero captures** (`COHORT-AVAILABILITY.json`).

Attempted current-code replay of the first hydrated retained capture under the offline transport/process fence. It stopped with `Rolling skater history read incomplete: read_failed`, caused by `Unrecorded projection input: from rolling_player_game_metrics`. **Zero network/process attempts**, snapshots unchanged (`CURRENT-REPLAY.json`; reproducible probe `replay-retained.cjs`, run from web with ts-node transpile-only). This is a data/query-version blocker, not an approval denial or uncertain execution.

- **Task 2.3 blocked:** no post-R19 c input/output cohort exists locally. Need matched captures with the current 34-column EV/PP/all history and support rows, plus retained actuals; current code may require further source queries absent from the older captures. No live fetch was attempted. FP/HIT/SOG bias and top-decile ±10% gates, all-head bias/RMSE/calibration, and target-specific review remain open.
- **Task 2.5 real 20-player × 5-strength row-identical recompute blocked:** those raw writer inputs/reference outputs are not supplied by this projection cohort. Related writer/rankings/trends tests passed, but do not satisfy the real-data recompute gate.
- **Task 2.6 release and production Q5/Q6 not run:** outside this task's authorization. No coefficient or predictive-quality claim is qualified by these tests.

Final synthetic fixture SHA256: `12953ed69ad7ab160c91f712bee24b3f891ce62092ce12ac7d0962a489d538fe`.
