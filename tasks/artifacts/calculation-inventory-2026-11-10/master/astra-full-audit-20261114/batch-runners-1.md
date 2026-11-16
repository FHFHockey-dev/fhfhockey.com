# Production artifacts audit, bounded batch 1

2026-11-14 · worker `gpt-6-astra/high` · Chef `gpt-6-astra/xhigh` · source-only audit plus isolated offline probes.

**Completed:** all six files in path order through `ctpi-v2-validation-2026-11-13/`, 3,015 lines. Inventory is exactly **54** eligible files, matching the requested count; the remaining **48 are pending**, not audited. The first four are retained pre-sync source/tests, not executable production runners. The two CTPI harnesses match `89da739cb` byte-for-byte. The four retained pre-sync files are absent from that tree; findings about those copies do not describe the released runtime.

Companion `batch-runners-1.tsv` inventories 228 symbol/test/file rows, including 48 explicit pending files. Named internal helpers and individual retained test cases have separate rows. Anonymous mapping/reduction callbacks are covered by their enclosing symbol. Source inspection is not an executed test or a statistical qualification.

## Findings for Chef review

Severity reconciled with Chef under governing §5: all four findings are P2 in this bounded group. AFULL-OPS-01/03 block trustworthy research qualification, but no automatic admission, live serving or production-write path was established. Their conditional wrong outputs are reproduced; promotion to P1 requires evidence of an affected runtime path.

### AFULL-OPS-01 — P2 — Formal checkpoint readiness trusts the exported schedule population and past dates

- **Location:** `production/ctpi-v2-validation-2026-11-13/ctpi-v2-checkpoints.ts:121` (`buildSchedule`), `:182` (`buildForecasts`), `:469` (complete-batch checks), `:480` (allTeamsReached40), `:540` (formalReady).
- **Claim:** CHECKPOINT-PROTOCOL.md:9–14,27–37 requires completed games, all 32 teams, and a formal refusal until every team completes game 40. Rules 18/23 require actual finality and exact coverage.
- **Evidence:** checked source SHA-256 below; isolated exact-source probe `/tmp/astra-prod1-probe.cjs`, `checkpointCases`, passed. The score producers and CI function were deliberately stubbed; schedule construction, checkpoint indexing, target maturity, eligibility, completeness and final decision code ran unchanged. This pins the readiness defect, not a CTPI inference result.
- **Wrong behavior:** only season is filtered; neither expected team membership nor game type/finality/unique game identity is validated. A checkpoint exists when the k-th scheduled row's date is before `asOf`. The whole-league denominator is `schedule.size`, so a partial schedule defines its own completeness. Results are required for target games 11–40, but not for games 1–10 that establish the issuance checkpoint.
- **Concrete input → output:** 32 teams each have 40 past-dated scheduled rows; the first game has no completed result and the next 39 do. Scores are available; each controlled CI is `[-0.01,0.01]`. Output: `formalReady:true`, 21 matured batches, 672 eligible forecasts, and `decision:"pass: ..."`, although each team has only 39 completed games. Separately, a truncated 16-team schedule with 40 results per team produces `formalReady:true`, 336 eligible forecasts and the same pass. Expected: refuse an incomplete league or unverified game-40 milestone. The complete 32×40 fixture serves as the positive control.
- **Suggested fix:** require a frozen season/game-type schedule manifest with the expected team set, unique game identities and verified completed-game ordinals. Reject partial/duplicate/non-final inputs; anchor targets to those identities and separately require all teams' game-40 completion. Do not infer completion from a date or from availability of later target rows.
- **Readers affected:** local checkpoint JSON/console, CHECKPOINT-PROTOCOL/report and a future approval proposal. No automatic production approval writer or live wrong number was demonstrated.

### AFULL-OPS-02 — P2 — Reference-only mode also emits a formal decision

- **Location:** `ctpi-v2-checkpoints.ts:60–64`, `:540–556`, `:563–566` (same directory).
- **Claim:** CHECKPOINT-PROTOCOL.md:3,53–64 freezes every game 10–30; `--batches-only` is reference only.
- **Evidence:** exact-source `checkpointCases` probe. Retained `checkpoints-2025-26-rehearsal-batches.json` also has `formalRequested:true`, `formalReady:true` and a formal outcome on the reference-only set. The retained historical dense rehearsal emits `pass`; protocol line 63 correctly denies its use as approval evidence.
- **Wrong/ambiguous output:** `--formal --batches-only` evaluates the formal gate against three batches instead of the adopted 21, then emits the same `pass`/`inferior` decision vocabulary. There is no separate rehearsal decision field or refusal. `formalSet` does disclose “reference only”, so this is a label/interface guard issue, not evidence that an approval was granted. Chef should retain this lower severity unless a consumer ignoring that field is found.
- **Concrete input → output:** complete synthetic 32×40 input plus `--formal --batches-only`, controlled CIs `[-0.01,0.01]` → `formalSet:"batches 10/20/30 (reference only)"`, `formalReady:true`, `decision:"pass: ..."`, 96 eligible forecasts. Expected: a reference comparison may pass its hypothetical criterion, but it cannot be labeled a formal decision on the adopted set.
- **Suggested fix:** separate `rehearsalOutcome` from formal eligibility; reject `--formal --batches-only`, or explicitly force `formalReady:false` and an informational decision. Preserve the useful historical rehearsal and its labels.
- **Readers affected:** human/machine consumers of checkpoint result fields and later approval packets. No such automatic promotion consumer was established in this bounded group.

### AFULL-OPS-03 — P2 — Missing result rows change the next-N-game target

- **Location:** `ctpi-v2-validation.ts:133–146` (`loadSeasons`), `:281–295` (`buildSamples`), `:851` (sample assembly).
- **Claim:** REPORT.md:49 and the script's `design.targets` promise the team's next N games; rules 13/23 require the same observations and exact coverage.
- **Evidence:** actual `readCsv`, `num`, `loadSeasons` and `buildSamples` executed in a denied-import VM on synthetic CSV; no model producer was called. `/tmp/astra-prod1-probe.cjs` `missingTarget` output retained below.
- **Wrong behavior:** a count row missing GF, GA or points is removed before target selection. `future.slice(0,horizon)` then takes the next N *available results*, silently replacing a missing scheduled game with a later one. It also shifts `lastN`, which is used in the training embargo.
- **Concrete input → output:** six successive games October 1–6; game 2 GF missing; games 1,3,4,5 have GD 0; game 6 GD 10. At an October 1 snapshot, `gd5=2`, `pts5=1`, `last5=20261006`. The promised games 1–5 target is incomplete and should remain unavailable; game 6 must not enter it. The result list proves October 2 was dropped.
- **Suggested fix:** construct fixed next-N game identities from a validated schedule (or retain all count-row identities including null results), then require complete target values for precisely those games. Keep missing targets unavailable and keep their true final target identity/date for embargo accounting. Add a regression with an internal missing result and a distinct N+1 outcome.
- **Readers affected:** seasonal cross-sectional comparisons, pooled correlations, held-out calibration, team sensitivity, issued-v1 comparisons and historical REPORT conclusions generated by this harness. `ctpi-v2-checkpoints.ts` uses scheduled target slots and does not perform this specific replacement; it has AFULL-OPS-01 instead. No claim that the retained result files actually contained this pattern is made without raw inputs.

### AFULL-OPS-04 — P2 — Stability labels assume consecutive calendar dates

- **Location:** `ctpi-v2-checkpoints.ts:346–383` (`stability`).
- **Claim:** daily movement after a team game versus no team game, and weekly change, describe elapsed calendar periods (CHECKPOINT-PROTOCOL.md:73–76).
- **Evidence:** actual `stability` executed offline. Two snapshots at October 1 and October 3, scores 50 and 60, with a game on October 2 → `dailyAbsChangeAfterTeamGame:null`, `dailyAbsChangeNoTeamGame:{n:1,median:10,p90:10,max:10}`.
- **Wrong behavior:** it checks only whether the team played on the earlier snapshot date. With a missing snapshot day, a change caused by an intervening game is labeled “no team game”. Weekly differences use `dates[i-7]`, seven available records, not necessarily seven calendar days. `asOf` is not passed into stability, so later stored rows can also appear in a historical-as-of report.
- **Suggested fix:** require consecutive calendar dates for daily comparisons, or explicitly inspect all games in the full interval and label elapsed days. Join weekly comparisons to date minus seven days. Apply the requested as-of cutoff before summarizing.
- **Readers affected:** informational checkpoint stability fields and protocol display-stability claims; no predictive decision uses these fields. No claim of a date gap in the retained current receipt is made.

## Operational guard assessment

| File/group | Bounds and stops | Resume / idempotence | Dry-run / write gate | NST / secrets |
|---|---|---|---|---|
| Pre-sync `startChartPipeline.test.ts` | Historical fixtures and tests; not runnable in this archive because relative imports point to missing siblings | Test assertions reviewed, not executed; CLI fixture subprocess assumes original `web/` layout | Contains a CLI export test and dispatch mocks; importing the whole test closure was not approved as a safe isolated harness | No provider invocation performed. CLI test spreads `process.env`; do not use it as a credential-free runner without restoring/reviewing its actual import closure |
| Pre-sync `verifiedForgeReleases.test.ts` | Historical admission tests and receipt hashes; archive-relative repo-root assumption does not identify the live repo | Tests not run in archive | Read-only test intent; no publish path | No network in direct test operations; current imported closure not executed |
| Pre-sync `verifiedForgeReleases.ts` | Exact lowercase 40/64-character identifiers and finite allowlists | Deterministic exact membership, no prefix/range admission | Static archive admission list, no I/O | No network/env/secret use; pure selectors exercised |
| Pre-sync `next-env.d.ts` | Six lines of generated type references | Not runtime | No writes | Not applicable |
| `ctpi-v2-checkpoints.ts` | Selected season, past as-of dates, k=10–40, next ten slots, 2,000 draws; missing args/no season throw. Input file size/rows/runtime not capped; CLI modes can change protocol. AFULL-OPS-01/02 | Deterministic analytical results for same inputs/modes/seed except `generatedAt`; no checkpoint resume. Re-running overwrites `--out` | Offline CSV reads and one local JSON write; no DB/provider writer. No dry-run switch needed for production safety. Output is not create-only or manifest-bound | Direct imports are fs/path, validation helpers and CTPI producer. VM denied unknown imports and mocked producer imports. No NST pacing applicable; no secrets printed. Real imported producer graph was not executed |
| `ctpi-v2-validation.ts` | Two hard-coded seasons; horizons 5/10/20; paired availability; >=16 teams/date; CIs withheld below 40 dates; 2,000 replicates. Malformed CSV width throws. No row/runtime budget; source contracts assumed | Seeded offline recomputation, not issued historical replay; no resume. Overwrites selected JSON | Local output only; no database mutation. No output version/hash gate | Direct fs/path plus CTPI producer imports. No provider calls in inspected file; import graph not executed. All probe environments empty |

CLI error/JSON refusal semantics are distinct: a premature `--formal` request writes a refusal decision and normally exits successfully, rather than throwing. A caller must inspect result fields. `--partial` exists and bypasses complete-batch grading for informational runs; it is disclosed in output but absent from the protocol's normal command. It should not be used as a sealed look without a separately recorded protocol change.

## Definitions, mathematics, selection and limits

- **Definitions inspected:** both variants use dates strictly before D; current v1 formula is recomputed, not silently equated to historically issued v1. PDO ablations add/subtract the declared 0.1 hypothesis weight. Missing v2 PDO in the exploratory addition falls back to zero by its stated exploratory convention. Target GD is a per-game mean; points are divided by `2N`. No percent/fraction conversion error was found in those equations.
- **Rank/estimation checks:** average ranks for ties; ordinary Pearson on ranks; equal-weight mean of per-batch/per-date correlations; paired deltas share resamples. OLS uses training data only. Within-season training requires the entire target window to end before January 1; testing starts January 1. Cross-season training and testing remain separate. These safeguards are source-confirmed, subject to AFULL-OPS-03's target membership issue.
- **Uncertainty:** source matches the stated moving-block and team-cluster mechanisms. The checkpoint dependency graph links same-team forecasts and target/target-or-input intersections; it uses an independent jackknife floor and the envelope of team/graph intervals. An equal-variant synthetic check gives point and both bounds zero. This is a sanity check only. The claimed 95% coverage, graph assumptions, league re-centering dependence, block-length adequacy and finite-sample calibration have not been independently established here. A construction identity does not qualify the model (rule 15).
- **Selection:** the already-inspected 2025–26 rehearsal was used to choose dense 10–30 checkpoints, and the record explicitly denies it as independent approval evidence. The prior seasonal analysis also examined early 2026–27 outcomes; the protocol records a discarded 16-team partial run. These are known selection boundaries, not newly discovered concealed runs. Future qualification must use the frozen adopted protocol and retain the separate TJ approval gate.
- **Provenance:** source rows set `sourceUpdatedAt:null`; date cutoffs alone do not prove knowledge-time availability (rules 10/25). Offline reconstruction of current inputs/formulas is not proof of historical issuance. Issued-v2 match counts are reported, not hard failures; missing/mismatched stored rows do not independently block `isEligible`. The imported `ctpi.ts` and `recentTeamFormV2Provenance` implementations are outside this six-file batch; their formulas, writer consistency and all live readers remain the relevant app-lane audit, not certified by these test artifacts.
- **Edge assumptions:** scalar CSV splitting has no quoted-field parser; selected current columns are simple scalars. Export uniqueness, regular-season filter, valid dates, finality and finite stored raw scores are largely assumed rather than asserted. Blank stored scores pass through `Number('')=0` in stored comparisons/stability; schema-level reachability was not established in this batch, so no separate live-data defect is claimed. Empty/single-date stability can serialize non-finite summary arithmetic as JSON null; labels should not turn this into evidence of stability.

## Offline checks and retained receipts

Command actually run, exit 0:

```sh
env -i PATH=/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin node /tmp/astra-prod1-probe.cjs
```

The second run added equal-variant interval and stability-gap probes and wrote `/tmp/astra-prod1-probe-output.json`. Probe SHA-256: `6e0bb193e12310046d2c789ccde7cdfbb93070d22fc17190ae4e599a38ee9e80`; output SHA-256: `f2cf72322f90bb2b0b015e5574d25bd827a977cf5b79835c70e93977f93b16a6`. These temporary reproductions are not repository tests. The probe uses the installed TypeScript compiler solely to transpile source into an isolated VM. Only explicit mocks are importable, the VM sees `process.env={}`, no application producer imports execute, and output writes inside the VM are captured in memory. Host reads are exact source and receipt files. No provider/DB/application request, app suite, server, production script main with real imports, commit, or code/test change occurred.

Passed exact synthetic assertions: tied ranks `[2,1,2,4] → [2.5,1,2.5,4]`; inverse Spearman `-1`; constant-vector Pearson `null`; interpolated quartile `[0,10] → 2.5`; OLS `y=1+2x`; deterministic bounded moving-block indices; equal-variant checkpoint uncertainty `[0,0]`. Negative probes reproduce AFULL-OPS-01/02/03/04. Gate probes explicitly stub CTPI scores and intervals; they are not numerical qualification of those producers.

All 13 paths named by the archived FORGE registry were checked locally: 12 receipt SHA-256 pins match, `verified:true`, zero findings, and matching closure identifiers. The final historical candidate entry at archive lines 137–143 expects receipt hash `6af75de826208e15ea86f7f2bc851d988a91da8d213bac0f462d190118209390` / closure `10aefb04aaf9f02bbe4041669063fecba7e7bba2e38853d1025fea22100fc147` / commit `975e67b47cafb7d54e3613ab43344fbad731f886`. The same receipt path now holds integrated commit `6c7f78154b49fca56a807a61dd0628b1b861d8ca`, hash `2c3ab77f6863dcd49a97fd444ace6fcfc3a8ad6da1ac4a8b2d718f270f5d32b6`, closure `dfab4f52f55d0f67bd16d613df000a794e4280611719c5d0e8daedf712479da6`. Current `web/lib/projections/verifiedForgeReleases.ts:137–143` names the latter consistently. **Historical archive evidence no longer reproduces its last receipt pin; this is not a current admission mismatch.** Exact/full lowercase selector rejection checks passed. Verifier implementation and full 192–229-module closure hashes were not rerun.

Retained CTPI aggregate receipts were inspected, not regenerated:

- `results.json`: 1,102/1,102 current v2 and 1,425/1,425 current v1 comparisons exact; historical v1 32/8,019 exact, 45 stored-only, max difference 2.103022372. This matches REPORT's explicit reproducibility limitation; it is not dismissed as a rounding error.
- `checkpoints-2026-27-game10-look.json`: formal false/not-ready, no matured batches, zero graded eligible forecasts; no predictive pass.
- `checkpoints-2025-26-rehearsal-batches.json`: 96 forecasts, three batches, formal-ready reference result inconclusive.
- `checkpoints-2025-26-rehearsal-dense.json`: 672 forecasts, 21 batches, formal-ready historical result pass. Protocol calls this a power rehearsal, not approval evidence.

The raw CSVs are not retained in this directory (REPORT.md:162). Consequently neither the full historical results nor source-export finality/uniqueness and all missing-result patterns were independently reproduced. No broadened retrieval was attempted. Reading records for the written packets and receipt hashes remain in `readfirst-production.md`.

## Full 54-file inventory

Paths below are relative to `master/production/`. `audited-source` means this bounded source pass; `pending-next-batch` means no implementation audit by this worker. Tree comparison is against `89da739cb`; hashes are actual local bytes. Line count includes no artificial trailing empty line.

| Path | Lines | SHA-256 | Target tree | Status |
|---|---:|---|---|---|
| `codex-adoption/pre-sync/web_lib_projections_startChartPipeline.test.ts` | 1181 | `dbeb76b012f4891588d1213fbf014f95ab6a9fca8fd88f2d026fd5c557edfc19` | absent | audited-source |
| `codex-adoption/pre-sync/web_lib_projections_verifiedForgeReleases.test.ts` | 94 | `a387c66f58c6791cb27d56827fbe9f5044c1cec46413886f7b0f34aeb3d11571` | absent | audited-source |
| `codex-adoption/pre-sync/web_lib_projections_verifiedForgeReleases.ts` | 159 | `862c9106383c8e6e0a3bcdda2dadfbfe09e4bd0402f09d4efbd58d027fc885c9` | absent | audited-source |
| `codex-adoption/pre-sync/web_next-env.d.ts` | 6 | `ced3cb1bdbb8082cae388902481ba6a8a1e454ec7daed6125b368118f06e4a77` | absent | audited-source |
| `ctpi-v2-validation-2026-11-13/ctpi-v2-checkpoints.ts` | 592 | `d3fdb516bddcd414aceeef38a2dc061c041f1cb52eab8eea9e7dfdd5da1ffcf6` | same | audited-source |
| `ctpi-v2-validation-2026-11-13/ctpi-v2-validation.ts` | 983 | `b943845aa6ef6bbf8d9f4d650444788236f3b16e90a21522eda982b2d7877a3c` | same | audited-source |
| `data-repairs-2026-11-13/wgo-legacy-identity-14-rows.sql` | 86 | `1af10085dcdbd7a771c382fb2be38a696c353cf9232763111532523b02076b7f` | same | pending-next-batch |
| `penalty-shot-rebuild-2026-11-13/ps-rebuild.py` | 403 | `b6fbc6cb91da7ef0ff697a48640ba63643efdc7dfd21ca65579bd8d1b83d0910` | same | pending-next-batch |
| `penalty-shot-rebuild-2026-11-13/summary-refresh.py` | 503 | `eba89e149346cb5000fe2342390b72645378c3fba21a6963ef6e9f13b0e88749` | same | pending-next-batch |
| `penalty-shot-rebuild-2026-11-13/team-refresh.py` | 408 | `4c5ec17bd5078d70d5617202409b45acbda5f35743083c1d639208f54691d2d2` | same | pending-next-batch |
| `penalty-shot-rebuild-2026-11-13/test_ps_rebuild.py` | 206 | `a0249953013082f32b751f39fd83911f59641f938cb93e3f24a2a7f0bba9623c` | same | pending-next-batch |
| `penalty-shot-rebuild-2026-11-13/test_summary_refresh.py` | 213 | `d5e95a6a7aa2de870b92a764c7a251a50d6684d36ab34912994a42e6cc2eea97` | same | pending-next-batch |
| `penalty-shot-rebuild-2026-11-13/test_team_refresh.py` | 294 | `80042326e4fffab4edd08f487f278d191de9fdceeb6ff2eafd70ca73f6fb659f` | same | pending-next-batch |
| `penalty-shot-rebuild-2026-11-13/verify-landing-strict.py` | 231 | `9bc6f2059eb78ef9cf4263df9f1d578af92a3b2019e550952a0ff4e437db00c0` | same | pending-next-batch |
| `penalty-shot-rebuild-2026-11-13/verify-landing.py` | 30 | `2cc9fdb67cb3dde05c4dd6a8c8c04a9c550767367d9cf245e204ff060dc4e9bc` | same | pending-next-batch |
| `penalty-shot-rebuild-2026-11-13/verify-team-landing.py` | 21 | `d905215383c2503755f6760d3c2050e790d7750e1e53ee7410107abae34f50e3` | same | pending-next-batch |
| `power-g5v5-2026-11-13/carry-manifest.sql` | 18 | `a0a7753d17344a38bf4d34a296218d5fd50a2b1e7b57cfec673310af25621eed` | same | pending-next-batch |
| `power-g5v5-2026-11-13/en-games-shots-toi-reconciliation.sql` | 28 | `c86aaba0c83478da7e8f810e22807aca5f2e8222c45186eef91e9b4903517584` | same | pending-next-batch |
| `power-g5v5-2026-11-13/en-goals-reconciliation.sql` | 26 | `336fd3ea0ddd48cab73f219cc2234e5f28a4d302c568912c68a84099e5aea131` | same | pending-next-batch |
| `power-g5v5-2026-11-13/power-g5v5-loop.py` | 579 | `c01d2e7069e1522fcea46efcfe403c37d30ee5daa4a761b5e5ed7be6d7f4f0e7` | same | pending-next-batch |
| `power-g5v5-2026-11-13/preflight-carried-keys.sql` | 40 | `debb4d2c68d9c330d112f3a5ba30419ee72fe12041aa59f62f88994eb68c3b2f` | same | pending-next-batch |
| `power-g5v5-2026-11-13/preflight-window-checks.sql` | 48 | `47bb26178da936a4ad11fb08a42484ec83562bf40c54017e638b4ceb9b183a05` | same | pending-next-batch |
| `power-g5v5-2026-11-13/test_power_g5v5_loop.py` | 111 | `d288b874adbc1431c50f70ef78bff068589ffb67a212c4c1f962864e0cc85e58` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/01-season-inventory.sql` | 8 | `f1a19e87743705131c239962836606c1fb1bd68f572afda63b52317740865ae4` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/02-pbp-coverage.sql` | 8 | `5af4f6b5e6ae95436c30f02b1db1c688878797eacd07946d45c8af4fc6679bb4` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/03-classify-teamgamestats.sql` | 42 | `a81258a412b929dcc5dee9d0bea0282e5e52a56888fc239cdc22df138c81ac6c` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/03-run-summary.sql` | 8 | `2356956db2ecfb09f31c664a7360717585ea0bfdf279227406a46c4554b8f03b` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/04-fetch-pbp.sh` | 29 | `eb374bbf120415a995a5e804893c8c1fe4c5221e88e329fcd1d66fdff44de4dc` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/05-compare-clock.ts` | 313 | `0a2a7a191fbf4b9a18500f23369a89607f3f7049ce88bbd8bcffc524f5f7c7a4` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/06-inspect-games.ts` | 87 | `bad476e68e1a3485c7bb4b929f4715abde7f1575ebdf9685c9524c2ecfd675ab` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/07-coverage-status.sql` | 8 | `562c378c00f9ebee5a47964e74d009a3ed5a158957c11095b1b4fac40a54604b` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/08-raw-endpoints.sql` | 8 | `4fd111c9e651629bff91161761aea1dc86530c15987dde12c46a34a390b56295` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/09-repair-source-probe.sql` | 14 | `46d376538bd6270adb67f881b70e1943a4e05d49402251399b8a7d7e533ff361` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/10-fetch-shifts.sh` | 29 | `7e045d326e7b5e4cc15c7e0383d36bc52f72fe837ed53663b0a2040f8c3c5b3d` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/11-shift-numerator-check.ts` | 89 | `ff647dfe4d0253c2de0028da79db9c63f2b2278a3a226f7ac1962883de869607` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/12-fetch-pp-combinations.sh` | 29 | `c546ba0e66fc04c59f5b3bf3605aae27d1e9cab137a2bc5869f32a8c52b998c3` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/13-fetch-penalty-summaries.sh` | 20 | `ed3a3126727ea33ae8b3fb90d65f16320d65f16eb0c66367688e7c7c4aae7605` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/14-share-coverage.ts` | 170 | `34be1c247cc77dd7c92656ad189a5d060db5370617ea6cc26fa68603625efeeb` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/15-parse-penalty-summary.py` | 58 | `60e3e87bdd58a91195cd026784a2ef2395c61da54e0e60f8b0885ffb614ca805` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/16-fetch-numerator-provenance.sh` | 37 | `461dbe7e5548ddb3f49e04364e1d47e2033a97142452840671a312c503b2edb9` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/16-numerator-compare.ts` | 240 | `4ed6c7f67d93aa92e9dc10f833f11bbeabec3e0482d16a71ce19f672fc26948a` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/17-cost-probe.sql` | 76 | `088fcd90d050b647339ef2c6cbb6086cc0271805600b1187ad864eb1ced09505` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/18-compute-timing.ts` | 40 | `78fe36383fbb0a3c99ce7b0b0856b3897fe01be2c5cb59a0eb3669f5940b7b69` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/19-production-pairwise-check.ts` | 27 | `ea15072fe3ed5e7f1ec49b2ee92c527dbd038e98bc1f76857c6cf61cbb3f3e7f` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/20-refresh-runner.py` | 338 | `b86a75715047d7e2592a35b36bea8baabda623bd49cf3b384fa67f6a73583275` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/21-export-dry-run-inputs.py` | 110 | `015653d064d8762b1a5e074fc9532d3017ce25c5a31b04250774c9d4ef5528a3` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/22-local-dry-run.stubs.ts` | 8 | `40336ac7df6b8c8f985f9a0a473979454584e2a8bef7b8190d8ac75ffa3b4f33` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/22-local-dry-run.ts` | 114 | `62db3adad2bf0495cf416fb9f2ef1ec469344212b1783afee6d802517ba78848` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/23-reconcile-local-dry-run.py` | 98 | `cfd71c35e738ef849aae44e2803558afcd8788514e10bd9ceed50234b5d60744` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/hygiene.sh` | 8 | `d772fc1d04bbcaf791d52bfa27c4d9936cdd6f8c4ee8e8c634eee60463313d32` | same | pending-next-batch |
| `pp-clock-validation-2026-11-13/hygiene.sql` | 5 | `8cd8776ecc42ce611ed5373883395602c5afcc12173fa00837b724950f77461b` | same | pending-next-batch |
| `release-433-followups/post-release.py` | 77 | `77e23560adfa84ec6ef92cd689be25f5f3bfcf1c063b30a4e1bb43090d7d1088` | same | pending-next-batch |
| `rolling-resume/rolling-resume-slow.py` | 113 | `c655915db71fb993326a5af39ff21000e088f7f489c9a5922e35b3c1c8bb7869` | same | pending-next-batch |
| `trend-bands-2026-11-13/trend-bands-history.py` | 113 | `5fa8432214ab53024649aa822492ac0b797f996104c46563d26f0331e9e12f6d` | same | pending-next-batch |

