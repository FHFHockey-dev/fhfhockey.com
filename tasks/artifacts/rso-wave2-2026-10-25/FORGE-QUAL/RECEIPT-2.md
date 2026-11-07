# FORGE-EXTIN receipt 2 (Claude, 2026-10-26)

TJ's redirect: "We should not be using fantasy projection tables at all from the draft dashboard."
- That replaced option 1 with option 2: the fantasy prior is removed from FORGE.
- The read-log-derived exclusion claim and its allowlist test (built under option 1) stay as defence in depth.
- Base: `octoberBranch` at `e8d223cc2`. Lease: FORGE-EXTIN plus `seasonBootstrap.ts`, `stages/skater-stage.ts`, `nativeInputEligibility.test.ts` and the bootstrap's tests.
- Code only, offline. Nothing is committed.
- No production, DB, provider or Vercel actions, and no GIT_DIR.

## Before / after

| | Before (HEAD `e8d223cc2`) | After |
|---|---|---|
| Season-opening skater prior | 0.6 × (1 − GP/20) from the average of 4 public fantasy projection tables (A&G, Cullen, DTZ, 5v5) + 0.4 × (1 − GP/20) from NHL previous-season history, blended into G, A, **SOG**, PPP, hits, blocks | NHL previous-season history only, at its unchanged 0.4 × (1 − GP/20) weight. The fantasy share is dropped, not reassigned. Every skater now gets what Release C gave a skater with no projection rows |
| Goalie prior | history only (`allowCurrentFantasy = false`) | history only (the parameter is gone). The limitation text no longer promises win/shutout priors, which only the fantasy branch supplied |
| FORGE imports of `PROJECTION_SOURCES_CONFIG` / `FANTASY_PROJECTION_SEASON_ID` | `seasonBootstrap.ts` | none, enforced by a test over every `lib/projections` module |
| `PROJECTIONS_*` reads in a live run (bootstrap on) | 4 skater tables | none |
| Live snapshot exclusion label | never claimed | claimed exactly when the captured reads are all audited and include no `PROJECTIONS_*` table: now true for every live run |
| Reconstruction snapshot and run-start `forge_runs.metrics` label | never | never (unchanged; see the decisions below) |
| Bootstrap disclosure | `fantasyWeight` 0–0.6, `sourceIds` = sources used | `fantasyWeight: 0`, `sourceIds: []`; still tagged `season-bootstrap-v1`, so Start Chart keeps parsing it |
| `inputProvenance` type | no `modelIdentity` | declares `modelIdentity?: { version; artifact; configurationHash; artifactHash }` |
| Version | — | per TJ's pop-up, the release `codeVersion` (git sha) marks the change. It changes `artifactHash`, so the FORGE-QUAL scope resets (D4). `modelMode` (a baseline/candidate rollout selector) and the disclosure version are unchanged |

Draft dashboard untouched: `lib/projectionsConfig`, `lib/fantasy-projections` and draft code are unchanged.

## Files (sha256)

| File | Baseline (HEAD) | Final |
|---|---|---|
| web/lib/projections/seasonBootstrap.ts | 3ff0c0f3bb7c2af79ce0419575349d46c1d87a5c113d25e82a7976c0630638db | 8f957a23846bdf096df6255b5152b6ea9cff2f14ba271f3885289b2eecd70977 |
| web/lib/projections/stages/skater-stage.ts | 6adc2f970899251775587c08c906a8121eb8f38ed3394549abf2bc9774086b56 | 958c3e5bf3ffab4efe1cf67d42bc063a308e9aeac7de11e712ab297f6cbf9faa |
| web/lib/projections/stages/goalie-stage.ts | 894f7169f383d1aeb3124c7d25b3934eb9ae3098088af7f054879b2bb873b154 | 588098919858f116e1bdd931fc0c32632bd598d14970df52b2dac1f5c23d8451 |
| web/lib/projections/run-forge-projections.ts | c7614e43248455020a107f715cd2d3b6aaa9f3f11a6648f8772c1fce86fc34ce | 37125f7bcca6f634fe801df2676ccb145a935725262e1812ab6428b8f936e3b7 |
| web/lib/projections/gameRevisions.ts | 2b16ffb05973d007798e46329720579bf12b25c409daaf750d2cca8cf0841e95 | 52228ce0a762b2770fd256b79787b32966e41b95d8a852fcea084dfb81a8c18a |
| web/lib/projections/nativeInputEligibility.test.ts | 03f09ffba40fe9b671a68a4158f8f347d10b6d125983dccbb9decf630766a1c8 | 4c121ea8448ef109c1490eaccd36df68597d2b177e7fd3942d2e9fb2c1f38c43 |
| web/lib/projections/startChartPipeline.test.ts (bootstrap cases only) | c41b46cc72a9283fa0c63454d34d662e173044aa86d35bd704d337aec21ae97d | 4bbcbc39061e67bf48a4cf4cc383b1190efcc81341116d74cc04454c18b4abcb |
| web/lib/projections/run-forge-projections.local-attempt.test.ts | 01eef5495bba434761bf542aaa67877977e7ef6c12ee0337994257212b552bbe | 15fe6f0801986618ad8a2bb6d87b9e4e45a0a6c9e9295458f6492a74d2593b8b |
| web/lib/projections/run-forge-projections.external-inputs.test.ts (new) | — | 2b5508ddc514b98e9b5efa42d9437180b9dd08c9b22f0ad55b2a0a53b09385c3 |
| FORGE-QUAL/EXTERNAL-INPUT-AUDIT.md (§4a, §4b) | — | 626847a67208e177424daee3759a2cb25f832cefcc6d9ccf4031164ed8d1ccc8 |

Diff on the eight existing files: +125 / −133.

## Tests

**`nativeInputEligibility.test.ts`**
- The "Release C bootstrap policy" pin is replaced by a test that fails if any `lib/projections` module references the projection-source config, `fantasy-projections/contracts`, `draftDashboard/`, a `PROJECTIONS_*` table, a source id, or the `PROJECTION_SOURCES_CONFIG` / `FANTASY_PROJECTION_SEASON_ID` identifiers. It scans more than 50 files.
- That test also pins that both stages call `loadSeasonBootstrap` with 4 arguments.
- The dynamic tests assert, for skaters and goalies in the 2026–27 season, that only `skatersGameStats` / `goaliesGameStats` are read, that zero `PROJECTIONS_*` tables are read, that the prior has only history fields, and that its limitations don't mention fantasy.

**`startChartPipeline.test.ts`** (bootstrap cases)
- The `fantasySourcePerGame` cases are removed.
- The blend expectations now follow history-only weights: game one 0.5, ten games 0.3/0.7, settled 0.4, disclosure `fantasyWeight 0`.
- The goalie case uses a history prior.

**`run-forge-projections.external-inputs.test.ts`** (13 tests)
- Claim and allowlist behaviour.
- The audited dynamic query sites no longer include the bootstrap's `source.tableName`, so a fantasy read site reappearing fails the test.

**`run-forge-projections.local-attempt.test.ts`:** the real producer's captured reads all pass the allowlist, and the snapshot claims the label.

**Baseline logs:**
- `baseline-extin.txt`: option-1 tests, 13/13 failed on HEAD.
- `baseline-extin-removal.txt`: removal tests against the pre-removal source, 7 failed / 115 passed. The skater-line case passed as a pin.

## Checks (from `web/`; GIT_DIR unset)
- **Passed:** vitest, 110 files, 3287 passed and 8 skipped (pre-existing):
  - all of `lib/projections` and `lib/player-forecasts`;
  - `scripts/run-forge-local.test.ts`, `qualify-native-players-offline.test.ts`, `forge-local-failure-evidence.test.ts` and `forge-counterfactual-backtest.test.ts`;
  - all of `lib/rosterScheduleData`;
  - rosterScheduleOptimizer `planning.test.ts` and `gameForecastPoints.test.ts`;
  - `__tests__/pages/api/v1/start-chart.test.ts`.
- **Passed:** scoped `tsc --noEmit` (the 9 touched files) and whole-project `npx tsc --noEmit`, both exit 0. Both ran with an 8 GB heap under `/private/tmp/fhfh-heavy.lock` (noclobber, removed on exit). Log: `tsc-extin.log`.
- **Passed:** `npx eslint` on the 9 touched files, exit 0.

## Decisions
- **Version** (TJ pop-up: "Rely on codeVersion"): no `modelMode` or disclosure-version change.
- **Taken without asking:**
  - The history prior keeps its Release C weight rather than taking over the dropped fantasy share. That is the minimal change and the behaviour already shipped for players without projection rows. Reweighting would be a new, unevaluated model choice.
  - The reconstruction snapshot still never claims the label. Claiming there breaks the native-qualification lane's offline tests (`scripts/qualify-native-players-offline.test.ts`, outside this lease), which assert rejection through unlabelled provenance.
  - The run-start metrics are written before any read, so they can't claim.

## Owed and follow-ups (not done)
1. **Early-season SOG retrospective evidence for this change is still owed.** EXTERNAL-INPUT-AUDIT.md §4b lists the bounded reads, not run: at most about 58 sequential requests over Oct 7–22, excluding the sealed Oct 23–30 block. It also lists the offline replay-harness change the counterfactual needs.
2. **The native baseline stack still uses these four fantasy sources** for its frozen means (`lib/player-forecasts/baselinePolicy.ts:20-35` and the baseline capture, rate and lineage modules). TJ's directive reaches it, but this lease doesn't.
3. **Start Chart UI cleanup:** `pages/start-chart.tsx:1278-1279` now reads "Public fantasy prior 0% (unavailable)" for new runs. That line should go, but the file isn't leased.
4. **`forge_runs.metrics.input_provenance`**, which the public projection APIs check, could be relabelled at finalize from the same transcript.
5. **Stale comment:** `lib/projections/apiHelpers.test.ts:77-79` ("stages still blend external fantasy priors") is now out of date. Its assertions still hold, and the file isn't leased.
6. **Production effect after release:** live revisions will carry the exclusion label, so admission's provenance gate (`consumerRevisionAdmission.ts:88-90`) stops blocking them. The serving flag, canary, RSO review catalog and the other admission gates still apply. Pin `scope.json` identity from the first post-release revision.
