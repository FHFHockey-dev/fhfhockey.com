# Task 2 R2 — coherent combined source; integration remains held

The packet-integrity defect is corrected in this new version. The complete source archive, its manifest, and the executed tests describe identical bytes, including the newer skater stage and its market/NB dependencies. **The combined candidate is not accepted: 393 tests passed and one unchanged native receipt-reproducibility test failed.** A separate diagnostic passed and isolated the failure to the new goalie league-save cache. No canonical application code was changed for R2.

## Exact candidate and provenance

- Fixed base: `b9f993b3522376805f82eeda1c84b7df39c7129f`, which contains Claude's model/market/NB commit `6b4898a9540d046236dc851c7ac6239627830db1`.
- Overlay: original eight-file task-2 archive, excluding its superseded skater stage, plus the independently accepted exact two-file R1 repair. No unrelated uncommitted canonical work was copied.
- Stage: `fe8357390ed4d5ed599bbd0429df5ea6150f703c9f8b121819198d6b4fc8c05b`.
- Market dependency: `1daa4512af0109f4aa99bbff6ed97065a9516a34446d52f7a3f57d79b9067b43`. All four required exports are included, along with devig, uncertainty, dispersion, goalie and runner sources.
- Archive: [combined-source.tar.gz](combined-source.tar.gz), SHA-256 `416c54bda8b28e48611fbdd3f9499d82b610aa6d1794d96b0283f89693eacd85`.
- [SOURCE-PINS.json](SOURCE-PINS.json) pins all 1,975 exported source/config/verification files, not only changed files. [INTEGRITY.json](INTEGRITY.json) confirms every source byte was unchanged across testing, all archived bytes match, and all 54 pre-existing task-2/review evidence files remain unchanged.

R1's combined manifest was my assembly error: I generated its pins from the live checkout after testing the older frozen stage. Concurrent code was legitimate work; it should have been included and verified coherently. The historical R1 manifest and receipts are preserved as evidence, not silently repaired or relaxed. R2 does not inherit their combined-candidate passing claim.

## Receipt failure: isolated cause

`web/lib/projections/goalie/leagueSavePct.ts:82–105` adds a module-lifetime Map keyed only by as-of date. `web/lib/projections/stages/goalie-stage.ts:179` calls that loader. Both changes arrived in the foreign goalie/model commit above; the original frozen task-2 candidate had neither. See [FOREIGN-CAUSAL-DIFF.patch](FOREIGN-CAUSAL-DIFF.patch).

On an immutable snapshot in a fresh process:

1. The first qualification reads `forge_goalie_game`, selecting `game_date,shots_against,goals_allowed` across the bounded previous/current season interval. Its receipt reports 100 in-memory reads.
2. The next same-date qualification reuses the module cache and omits exactly that query. It reports 99 reads. Its ordered query hash therefore differs.
3. The third qualification matches the second. Source hashes, projection output hash, modeled values, admission and every other result field remain identical across the first two runs.

[TWO-RECEIPTS.json](TWO-RECEIPTS.json) retains both full receipts. [CACHE-CAUSE.json](CACHE-CAUSE.json) identifies the exact missing query and hashes. The passing [cache-cause.test.ts](cache-cause.test.ts) checks the entire ordered query trace after removing that one known query, confirms identical forecast outputs and source hashes, proves the two differing result fields account for the result-hash change, and checks the third run. This is a diagnostic decomposition, not a weakened acceptance assertion. The original test remains unchanged and red.

Thus a moving tree is not necessary to cause this failure: it reproduces on fixed source and comes from the foreign goalie cache, not the skater physical-rate repair or NB/market stage change. The earlier live run retained only its failed hash assertion, not both full receipts or a complete source snapshot. Its exact `92a0969c…` / `5646b1aa…` values cannot be reconstructed from that log alone; the R2 reproduction establishes the concrete same-assertion failure and causal mechanism without claiming unavailable historical byte-level evidence.

**Required owner action:** repair cache lifetime/provenance in `web/lib/projections/goalie/leagueSavePct.ts`, with any directly needed run-context wiring owned by Claude/root. A reconstruction must not reuse another invocation's retained-input result or omit its captured input. Prefer a run-scoped cache; a carefully bounded reconstruction-specific path is another option. Retest repeated same-input qualification and two different retained-input fixtures at the same as-of date. Do not make the public test ignore query hashes or read counts. This application edit is outside the explicit helper-only lease, so it was not attempted. No approval tool denied it; ownership authorization is the blocker.

## Verification and independent recheck

Node 22.11.0/npm 10.9.0, existing dependencies, one Vitest worker, clean synthetic environment and transport-denial preload. [COMBINED-COMMAND.json](COMBINED-COMMAND.json) records exact command/environment; [COMBINED-TESTS.log](COMBINED-TESTS.log) reports **393 passed, 1 failed across 12 files**. Included are all 112 helper cases, 110 query cases, 37 native-stage cases, 11 unchanged independent oracles, four independent parity matrices and the actual market/NB/goalie dependency tests. The 56-case offline suite has 55 passes and the one reproducibility failure. The separate cache-cause diagnostic passed once. The isolated original reproduction was also red before diagnosis.

Archive extraction and all 1,975 hashes were checked in a second fresh directory. To independently extract, verify and execute the unchanged combined suite:

```sh
python3 tasks/artifacts/forge-task2-2026-10-22/r2/verify.py --dependencies /Users/tim/Code/fhfhockey.com/web/node_modules
```

The command currently exits 1 on the known reproducibility failure; `--check-only` validates/extracts without tests. No dependency installation, real environment file, Git write or network access is used. Full TypeScript/lint were not repeated for this artifact-only R2; R1's scoped lint evidence remains historical evidence. No TypeScript heavy lock was needed.

Parent should route the cache correction to its owner and then request an independent combined recheck against a newly pinned corrected version. R2 is ready to review for coherent source and causal findings, not a passing release candidate.

## Operational and model limits

The accepted paired-count/exposure repair remains intact: missing current-season counts/exposure do not become observed zeros. The decision tree in [R1 OPERATIONS.md](../r1/OPERATIONS.md) still applies: repair a reader that loses present source data; backfill only verified missing authoritative data; preserve true observed zero and paired exposure; issue corrected future forecasts as new revisions rather than overwrite immutable history. Production impact and affected run versions require separately authorized bounded read-only evidence; no blanket production impact is established here.

Current-query real physical/all-strength cohort and variant c remain unavailable; real 20-player × five-strength comparison, target-specific bias/RMSE/calibration and FP/HIT/SOG/top-decile ±10% gates remain open. Synthetic correctness tests establish no predictive qualification. No production request, database execution, migration, backfill, forecast rerun, paid call, commit, push or deployment was performed.
