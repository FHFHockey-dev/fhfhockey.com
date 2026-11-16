# Four-file modeling audit — target 89da739cb

Worker: Astra/high, verified from current rollout turn_context. Chef owns canonical ledger and severity reconciliation. This is a bounded source/fixture review, not production qualification. All four assigned files were read fully and independently byte-compared with `git show 89da739cb:<path>`: all match. Existing checkout state preserved. No code/test edits, training, DB/provider/network/page calls, commits or deployments.

## Result and evidence boundary

Four provisional findings: three feature-builder failures, plus missing selection evidence accepted as selected. All are **P2 under §5's dormant/research/label rule**: traced reach is private offline validation or private issuer metadata; no live serving reach verified. Reachable failures become release blockers if these artifacts are promoted. L15's older P1 convention means pre-release blockers and is not evidence of live serving.

The TSV inventories every class/function including nested helpers and the each module configuration constant. `audited` means the named source logic was reviewed, not that all runtime branches or downstream consumers were independently exercised. `no-math` means a reviewed serialization/hash/CLI helper. Test pointers indicate relevant coverage, not proof of complete branch coverage. No assigned source sections remain unread; reader depth outside this batch remains explicitly bounded below.

| Source | Read range | Bytes | SHA256 |
|---|---|---:|---|
| `modeling/player_forecasts/challenger_features.py` | 1–270 (full) | 13870 | `79b7bad8020be327956e1b87c9a3fac350592a5d16c105801929f388e743a5df` |
| `modeling/player_forecasts/daily_board_baseline_issuance.py` | 1–213 (full) | 14437 | `7fb377f56c36896811752272d01874f1542eaa02161ee2e1721515c25a04c361` |
| `modeling/player_forecasts/forge_walk_forward.py` | 1–1071 (full) | 67976 | `af9da7c0cb25408479152a323b7b5a55b2b0c6725c269ccef43e18d070dd05f8` |
| `modeling/player_forecasts/pp_shot_support.py` | 1–205 (full) | 12665 | `33da5d3bbc235c0cf6158f4fbe0038d685a002d598b5883af4d7315489881adc` |

## Provisional findings

### AFULL-PY-01 — unavailable assist history crashes before its exclusion guard (P2)

- **Location:** `challenger_features.py:136-140,182-185,230-233`.
- **Claim checked:** L15 M-PFC-110 and unknown-is-not-zero: incomplete A1/A2 histories are excluded, preserving valid total-assist/other targets.
- **Evidence:** target89da739cb; synthetic two-game fixture in `/tmp/astra-modeling-small/probe.py`, result `missing_all_assist_splits`; existing partial-history test at `tests/test_l15_season_evaluator.py:378` passes.
- **Wrong behavior/scenario:** one player has two valid games with total assists=1 but `official_assist_decomposition_complete=False` and split fields null. Default target request raises `KeyError((10, 'primary_assists'))` at182. Series never exists because ingestion correctly skips all unavailable splits; builder indexes it before the output exclusion at230. Also vulnerable when only the current-season series or the position split series is absent. A missing split prevents all valid targets from completing.
- **Suggested fix:** represent absent split history as empty/unknown; use guarded series access and omit split-derived features/labels while still processing total assists and unrelated targets. Add a player with no complete splits in any/current season; do not replace missing with zero.
- **Affected readers:** `__main__.py:62-64,307-311` build-validation-features CLI; `challenger_model.py:172-176` validation-feature loader and its groups/scoring. No live reader established.

### AFULL-PY-02 — legal restricted target request omits unconditional TOI dependency (P2)

- **Location:** `challenger_features.py:111-115,196`.
- **Claim checked:** CLI accepts individual target selections and builder emits their cutoff features.
- **Evidence:** same pin/probe; `goals_only` case.
- **Wrong behavior/scenario:** two fully populated games with complete splits, call `build_validation_features(freeze, targets=('goals',))`. The dependency list adds TOI only for hits. Every feature branch nevertheless indexes the TOI series at196, yielding `KeyError((10, 'time_on_ice_seconds'))`. Goals/SOG/blocks/etc individual CLI requests can fail despite valid TOI in source rows.
- **Suggested fix:** always include TOI in calculation dependencies when projected TOI is emitted (or explicitly gate that feature). Extend the existing feature-vintage test to individual advertised targets.
- **Affected readers:** same CLI and downstream feature artifact consumers as AFULL-PY-01. No existing restricted-target regression found.

### AFULL-PY-03 — missing counts become measured zero labels and history (P2)

- **Location:** `challenger_features.py:85-96,128-153,245`; nullable source projection in `challenger_freeze.py:52-55`.
- **Claim checked:** unknown stays unknown, including history denominators and labels (rules digest7; L15 missing-actuals/split contract).
- **Evidence:** same pin/probe; `null_goals` case. Source reader selects raw nullable goal/count fields without a completeness filter; no production data prevalence checked.
- **Wrong behavior/scenario:** first of two valid player games has `goals=None`, TOI18:00; second has goals1. Builder emits first game's goals `outcome=0.0`; second-game one-game horizon has `history_count=1`, `career_rate=0.0`, `prior_events=0.0`, `prior_time_on_ice_seconds=1080.0`. The absent outcome is treated as observed scoring failure and depresses both label and event/exposure rate. Same `or 0` pattern affects other count fields and missing/unparseable TOI; A1/A2 have a separate completeness gate but AFULL-PY-01 undermines it.
- **Suggested fix:** retain per-target availability and finite-value validation. Omit unavailable labels and their paired event/exposure support; preserve explicit numeric zero. Test unknown versus measured zero separately. No need to impute an unknown count from TOI alone.
- **Affected readers:** feature artifact → `challenger_model.py` groups/training/scoring (private, not run). Existing tests cover unavailable split rows, not null raw goals/counts.

### AFULL-PY-04 — selected-policy label does not require selection evidence (P2)

- **Location:** `daily_board_baseline_issuance.py:32-54,167-170`.
- **Claim checked:** decision66 requires each issuance to record exact selected version, training cutoff and selection evidence; absent qualification remains an explicitly named fixed baseline.
- **Evidence:** same pin/probe; `selection_without_evidence`. Full decision66 read at `OWNER-DECISIONS.md:232-235`.
- **Wrong behavior/scenario:** JSON with `selectedPolicyVersion=POLICY.version`, `selectedPolicy=POLICY`, and an earlier `trainingCutoffAt`, but no `selectionEvidence`, returns `status='selected_artifact'` with `selectionEvidence=None`. Caller then stores that selected status in the issuance manifest. A policy copy plus arbitrary historical cutoff is enough to assert selected status without any documented process evidence. No numeric forecast difference claimed.
- **Suggested fix:** validate a versioned selection evidence schema and its linkage to policy/training cutoff before using selected status; otherwise refuse or retain the explicit unselected fixed-baseline state. Record selection/artifact creation time if pre-cutoff selection is required. Define freshness externally; this review does **not** invent a maximum artifact age.
- **Affected readers:** private `issue_baselines` manifest; `daily_board_daily.py:115-160` issuance/settlement orchestration; `daily_board_settlement.py:205-209` baseline artifact verification. Default orchestrator supplies no artifact and correctly gets fixed-baseline status. `verify_issued_baselines:185-199` replays numeric forecasts, not selection evidence; not independently tamper-probed. Existing test at `test_l15_season_evaluator.py:284` covers exact policy mismatch and post-cutoff training, but not absent selection evidence.

## Contract and numeric review notes

- **Challenger histories:** prefix and exposure arrays use identical chronological support; `bisect_left` excludes the cutoff itself. Recent5/10/20 means and configured EWMAs use prior data; empty histories yield None. Current/prior season weighting is .7/.3 when both exist. Labels remain explicitly reconstructed-validation and nonpromotable, not original pregame issuance. The three findings above prevent a blanket correctness claim. Tests do not establish prospective feature availability.
- **Issuer:** validated frozen history range/hash, candidate capture before cutoff, cutoff≤issue<start, verified membership, integer finite nonnegative counts, goal≤shots and PP≤points. `historical_baselines` uses the disclosed lag, season/recent/role/EB support; output fantasy values use shared weights. Private output is immutable, stamped with the actual completion clock, and loses completion manifest if publication crosses puck drop. Inputs/forecast replay does not imply production freshness, optimal-lineup quality, participation qualification, or selected-policy evidence.
- **Walk-forward:** 17-player finite pilot, exact schedule/date boundaries, source/availability clocks, duplicate rejection, protected dates, positive-TOI label support and explicit missingness reviewed. A/native/Ball/Clast5 share paired eligible scores and disclosed fallback; nearest-rank bands are descriptive, not calibrated predictive intervals. Source attempts reserve budget before an injected/real fetch; interrupted/missed attempts remain terminal. Issuance requires durable completion before deadline; final lock requires evaluator review; readout is sealed and checks frozen dependencies before labels. No actual provider branch, native process, training or final readout was invoked. Existing historical MAE pilot is preserved under rule21; decision65's proper score appears only as explicitly versioned opt-in `PROPER_SCORE_SELECTION`, tested against a mean/median counterexample. Do not call legacy MAE a newly selected proper-score experiment.
- **PP support:** selected last5/all rate and cumulative seconds use the same window; canonical zero beats a legacy alias; missing/unverified exposure keeps baseline. Exposure minutes/(minutes+prior) controls the candidate. Rate formula matches historical `web/lib/projections/stages/skater-stage.ts:2069-2108` at6551974b: raw × context × weight +8×(1−weight), clamped2..28 before role bounds. Five pinned historical dependencies are intentionally distinct from BASE_SHA and current working-tree files. Export is an engineering fixture grid; its qualified-data/split/MSE/holdout gates are declared future requirements, not results. No live integration or scientific qualification claim made.

## Checks actually run

Imports/fixtures were inspected before execution: selected tests use temporary local files, fake clocks, local historical git blobs, injected native/transport callbacks. Database connection is lazy, no selected case calls it. Automatic third-party pytest plugins and bytecode/cache writes disabled. Import-graph AST scans were safety aids, not an audit substitute.

1. From repository root: `PYTHONDONTWRITEBYTECODE=1 PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python3 -m pytest -p no:cacheprovider modeling/player_forecasts/tests/test_harness.py modeling/player_forecasts/tests/test_l15_season_evaluator.py -q -k 'pp_support or forge_walk_forward or daily_board_baseline_issuance or issuer_ or squared_error_selection or unavailable_assist_split or validation_features_are_rebuilt'` → **exit1:49 passed,2 failed,166 deselected**. Two issuer tests failed importing `tests.test_harness` from the wrong cwd; no product assertion failure.
2. Changed cwd to `modeling/player_forecasts`; reran only the two failed tests: `PYTHONDONTWRITEBYTECODE=1 PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python3 -m pytest -p no:cacheprovider tests/test_l15_season_evaluator.py -q -k 'issuer_'` → **exit0:2 passed,17 deselected**. Thus51 distinct selected existing cases passed. No successful case was repeated.
3. `PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=/Users/tim/Code/fhfhockey.com python3 /tmp/astra-modeling-small/probe.py` → **exit0**, four recorded outputs above (expected defect demonstrations, not passing regression tests).

No new repository tests, full suite, build, lint, typecheck, production smoke, model training or remote checks. One supplemental historical-file read used an incorrect `web/src/...` path and returned fatal path-not-found; corrected to declared `web/lib/projections/stages/skater-stage.ts` and read2060–2115. That read error is not a product finding.

## Bounded reader and supplemental read record

Previously completed governing and lane files, including full L15, are enumerated/hash-bound in `readfirst-lanes.md`. For this batch, relevant owner decisions7,10,38,39,40,46,63,65,66,69,70,71,78,83,121,122,123,127 were read as full numbered blocks; RULES-DIGEST read fully; wave2 rules13–21 and wave3 rules22–26 read. This does not re-open all owner decisions already read by Chef. Decision40's historical wording is not treated as current credited-start authority; no QS calculation occurs in this batch.

Direct consumer/source tracing: challenger CLI and feature loader/grouping; challenger freeze SQL; private daily-board orchestrator/settlement verifier; historical baseline arithmetic; candidate verifier; entire native bridge `web/scripts/forge-walk-forward-native.ts`. Imported native `baselineRates`/`sourceLineage` implementations were **not** recursively audited here. PP evidence capture only imports BASE_SHA/PROTOCOL at17; the rest of that consumer remains unread. No external issued artifact, serving release, production data or predictive accuracy was verified. Root may route remaining reader checks to their owning scope; no whole-reader audited label is implied.

Supplemental files below include explicit read ranges. A hash describes the current complete file for reproducibility; a partial range does not claim its remaining contents were read. Some supporting modules were inspected only for top-level/import safety (marked AST), and are not numerically audited. More specific fragment ranges take precedence over any general wording above.

| Supplemental source | Read extent | Bytes | SHA256 |
|---|---|---:|---|
| `modeling/player_forecasts/challenger_freeze.py` | 1–120 (full relevant freeze producer) | 4542 | `f1757ee0a06d75957e30eb3de87b5fa66c2ac7dbce1860fb4b46831481a1312d` |
| `modeling/player_forecasts/__main__.py` | 62–64,307–311 (CLI target/delegation) | 18120 | `8cfabab7eac3c29e3fb13aacb6f45cd62a1910d93943ad1896039eed18254ff1` |
| `modeling/player_forecasts/challenger_model.py` | 100–115,172–176; imports/top-level AST | 26028 | `489be12d7056feca031cfa7495838d23753381ff7e34cc7739b900a10b24b032` |
| `modeling/player_forecasts/daily_board_daily.py` | 115–160 | 21872 | `3339017f7fe92a7d87e157e088586dd2ff82dd9a81704a41b116210c1004d68e` |
| `modeling/player_forecasts/daily_board_models.py` | 22–94; imports/top-level AST | 10629 | `5f077d93450ff3f10cf568fab06dc5d79c6d5e55069f9bca007fa88d2c07ee68` |
| `modeling/player_forecasts/daily_board_candidates.py` | 1–100 | 17013 | `d205f8eaa788aee22df7367e105f5d5fab4e73fab098aae6e265484641e3f1e7` |
| `modeling/player_forecasts/daily_board_settlement.py` | 1–43,195–222 | 30808 | `e945df5519af80d7618e193c2c6ee56b595feb0ad553a1a8e02104acb96ac8bc` |
| `modeling/player_forecasts/tests/test_harness.py` | 1–129,707–752,1747–1770,1790–1855,3967–4006,4165–4490; imports/top-level AST | 237987 | `caff68ff6e975c8450f8641558d3b37f5ee982268fd69423f1cc125ba9848810` |
| `modeling/player_forecasts/tests/test_l15_season_evaluator.py` | 1–45,255–335,378–411,427–461; imports/top-level AST | 22729 | `4f9917b51b16ac5a6d33989818d2ee3a6dd62c3ef2f145a52dde89b3fd8e8e43` |
| `modeling/player_forecasts/tests/conftest.py` | full | 177 | `d63364cb70237270b04feb2d371fc37315b44f0204d10677de814060e176abac` |
| `modeling/player_forecasts/pyproject.toml` | full | 267 | `2627fc75b436fec4bc85f25e19e09f895af3df39e164cd487e6c204975d77449` |
| `modeling/player_forecasts/__init__.py` | full | 175 | `4453832ffa91fb61eca758d19b05511d00d7fd82113e578c7fd9bfa73930af7b` |
| `modeling/player_forecasts/database.py` | full safety read | 999 | `9bbdccac105b9b075ac257aeb9caab0c2e2302e29c6808ade15c442449409425` |
| `modeling/player_forecasts/io.py` | full safety read | 1733 | `9a2f72ce5b1271157a7c9409dec65550010de292034f350ab4f593f1b60d2b8f` |
| `modeling/player_forecasts/daily_board_training.py` | imports/top-level AST only | 7941 | `1e5cf475d66b4fdf52b46909d1c2318a45d4f3cca65409c30e91c2172885e240` |
| `modeling/player_forecasts/challenger_math.py` | imports/top-level AST only | 4712 | `9394ad8577b4e2d834f5f5f6d018c94431d32b7444fe72dd4d9cb60869e22d9f` |
| `modeling/player_forecasts/lockbox.py` | imports/top-level AST only | 7501 | `f3ac342aaa97a49adfb7d7dcf2caafa10bab43d4f4b45f125ddd407b5b0d06cc` |
| `modeling/player_forecasts/rookies.py` | imports/top-level AST only | 27974 | `0c151a6dbc3f5008a6da73e6e71506ea7e61c03a49b8b1480e2af01b3614b58e` |
| `modeling/player_forecasts/model.py` | imports/top-level AST only | 17178 | `6df171df99d7031f4855135a5b00ff4c7e5233b866279e3fa2aa4981fe08f93e` |
| `modeling/player_forecasts/season.py` | imports/top-level AST; harmless module-level constant calculation only (Chef owns numeric audit) | 255390 | `04b8421f9f2da96246bc8561ade9cc58c192459dbd9aa185ecd8d977f2904265` |
| `modeling/player_forecasts/pp_evidence_capture.py` | 17 import only | 52857 | `2c4ffe2f566401c97824b283e049219bc93c16894dcc0772c8848655bd0e7ecf` |
| `web/scripts/forge-walk-forward-native.ts` | full | 13004 | `cecc0a69f97befc0f3cca6a48333fbe7713590ed12919481202f2bf89111efd0` |
| `web/lib/projections/calculators/skater-adjustments.ts` | bounded rg raw PP support occurrences only; not full | 42269 | `ae120b556adba8d689c54b572346e7c09134e3fad1178fb1f2404d06080dea60` |
| `tasks/artifacts/calculation-inventory-2026-11-10/master/OWNER-DECISIONS.md` | numbered blocks listed above | 67656 | `f27b30d4b74355f7f957171444783c16096c1d68030296358fe406657d838497` |
| `tasks/artifacts/calculation-inventory-2026-11-10/master/RULES-DIGEST.md` | full | 11650 | `fd01301176e68fca8b61d4711c6ce117142bd42e74b3469d49a55697bdd75fad` |

| `modeling/player_forecasts/daily_board.py` | imports/top-level AST safety only | 16895 | `95f2befeb2afa548ffef6d78e88b39e06e9542dc298a4e56e448abb1a168968d` |
| `tasks/artifacts/calculation-inventory-2026-11-10/master/WAVE2-CONSOLIDATED.md` | 36–44, rules13–21 only | 92997 | `d08a9e4de86d177bce4e7744cc686fcbbbe067f5b00782fdbb0311e6e6a392f6` |
| `tasks/artifacts/calculation-inventory-2026-11-10/master/WAVE3-CONSOLIDATED.md` | 37–41, rules22–26 only | 86544 | `115b6fc82717ad717fecba1f896ee5c1a3bca51bbc0e2b3c3352a8f51cbcb96f` |
| `web/lib/projections/stages/skater-stage.ts` at6551974b | 2060–2115 only | 128411 | `fc28ab78fd9c57bf6e1d76bae7acaea9b0ebc3cb228a7b219881c9f5342ab4ab` |

Synthetic probe files remain under `/tmp/astra-modeling-small`; they are not a retained release artifact. Findings include the minimal inputs/outputs so they can be rebuilt without that temporary directory. No pending section in the four assigned files; unreviewed transitive consumers and production qualification remain outside this completed batch.
