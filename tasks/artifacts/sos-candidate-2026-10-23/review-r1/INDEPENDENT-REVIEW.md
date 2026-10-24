# Independent SoS candidate review — 2026-10-23

**ACCEPT for the declared offline research scope.** No substantive arithmetic, cutoff, exclusion, missingness or evidence-selection defect found. This accepts implementation consistency and the proposed integration boundaries; it does not select a production method, validate NHL predictive performance, or authorize runtime integration.

Reviewed the actual Python, all 41 supplied tests, contract, report, plan, manifests, retained receipts and relevant current application formulas. All review execution used isolated local copies. No live data, application edits, dependency changes, captures, commits, pushes or deployments.

## Two nonblocking corrections

1. **Provenance wording is not byte-exact.** [CORE-PROVENANCE.json](/Users/tim/Code/fhfhockey.com/tasks/artifacts/sos-candidate-2026-10-23/CORE-PROVENANCE.json:4) and VERIFICATION.json say the core is the exact source prefix. The literal prefix before `def weighting_games()` is 7,725 bytes; `record_core.py` is 7,724. The only difference is one removed trailing newline (`return output\n\n\n` versus `return output\n\n`). Arithmetic and all other bytes match, and the declared core SHA correctly pins the delivered file. Correct the extraction wording; this does not block calculation acceptance.

2. **A past diagnostic retains a future label.** [sos_candidate.py:263](/Users/tim/Code/fhfhockey.com/tasks/artifacts/sos-candidate-2026-10-23/sos_candidate.py:263) passes an explicit opponent list for both horizon kinds. The inherited [record_core.py:107](/Users/tim/Code/fhfhockey.com/tasks/artifacts/sos-candidate-2026-10-23/record_core.py:107) interprets any explicit list as `future=True`, so a valid `past_retrospective` output contains `record_components.window="future_fixture_list"`. The top-level horizon and actual fixture/rating semantics are correct, and suppressing full RPI is intentional. Normalize or document this diagnostic label before any consumer treats it as temporal authority. Reproduced on the independent AB/BC retrospective example: only AB selected; direct SoS=2/3; top-level past label correct.

## Findings against the requested scope

| Concern | Observed behavior and evidence |
|---|---|
| Temporal cutoff / leakage | Results require both end and revision availability strictly before cutoff (sos_candidate.py:182–196). Future snapshots must predate cutoff, each fixture revision must be no newer than its snapshot, future kickoff must be strictly later, and horizon end is exclusive (208–242). Independent exact-cutoff/later-revision injections leave team outputs unchanged; a later schedule revision is rejected. The caller must truthfully supply revision times and full-cohort coverage; code does not prove those attestations. |
| Retrospective versus faced then | Retrospective selects the past fixture window while estimating opponents through the declared cutoff. The independent AB/BC example gives 2/3 retrospective versus 1/2 at the retained pregame cutoff; the later BC result is excluded when injected into the earlier snapshot. Missing pregame snapshots return null. The replay checks matching identity/start, pre-kickoff cutoff, identical metric config/cohort/season and exactly the named fixture for both teams (296–335). |
| Fixture weighting / denominators | Outer and inner weights count fixture occurrences, including repeats. Independent repeated-opponent example yields `(3*.8+.1)/4 = .625`; it does not pool record denominators or average unique opponents. Adding an opponent with an undefined rate at kappa=0 makes the composite null with fixture count still five. Repeating the same opponent changes volume, not mean difficulty. |
| Self influence / RPI | Direct rates exclude the focal team's games; second-hop rates exclude both focal and intermediary. The independent implementation expands each fixture rather than reusing candidate Counters or core helpers. It matches the declared `(2*OWP+OOWP)/3` over 36 graph/outcome/prior configurations. Own-result flips preserve focal schedule scores. Full `.25/.50/.25` RPI is deliberately absent from exposed schedule scores. |
| Missingness | Incomplete history withholds every team's quality/SoS; incomplete schedule/status withholds affected schedule metrics. Empty horizon, observed zero, prior-only and zero-denominator unavailability remain distinct. An empty second-hop history explicitly uses structural prior even at kappa=0; that is documented and reported, not silently observed evidence. No missing-rate renormalization found. |
| Actual Colley math | Actual implementation builds `2I + graph Laplacian` and `1 + sum(credit-.5)`, removes focal node and games before each schedule fit, and solves by Cholesky with a residual check (84–126, 267–269). Reviewer Fraction Gaussian elimination independently agrees for global and leave-out ratings on sparse, repeated and disconnected graphs. Points credit is excluded from Colley; regulation-equivalent ties are a named extension. Unbounded indices are neither clamped nor advertised as probabilities. |
| Corrected stability oracles | Independent exact record arithmetic and exact Gaussian elimination give C deltas `(-1/10,-1/15,-1/12)`, D their opposites, A/B/E/F zero. Candidate floating outputs agree to 12 decimal places. Competition ranks become C=6, D=1, others=2 from all tied at 1. The obsolete strict `<.1` assertion is absent; the initial failed receipt remains preserved. |
| Synthetic evidence / selection | The new demo is explicitly invented-fixture characterization and says no model selected. The earlier JS generator actually uses `sigmoid(latentA-latentB)` and fixed `sigmoid(4*(ratingA-ratingB))` for other scales (benchmark.mjs:19,130). The plan correctly rejects using that comparison to choose an NHL winner. No empirical NHL qualification was performed in this review. |
| 4WG / WeekScore / FORGE plan | Current code matches the plan: Opportunity=`GP+.25*ON`; WeekScore=`6*(GP-leagueGames/16)+4*ON+matchupBonus+crowding`. The proposed SoS display stays separate from Opportunity, weekly means combine by fixture counts, and any WeekScore experiment replaces the existing matchup term while holding GP/ON/crowding fixed. The plan explicitly forbids multiplying already matchup-conditioned FORGE by another generic SoS factor and requires category/effect ownership and equal-support chronological qualification (EVIDENCE-AND-PLAN.md:64–74). This is a sound experimental boundary, not an implemented integration. |

## Verification performed

- Supplied suite: **41/41 pass**, isolated, once. [candidate-tests.log](/Users/tim/Documents/Codex/2026-10-23/task-9/sos-review/candidate-tests.log).
- Reviewer suite: **7/7 pass**, including 36 deterministic graph/mode/prior configurations and the independent exact stability solve. It imports the candidate entry points but neither candidate test fixtures nor core arithmetic helpers. [test_independent_review.py](/Users/tim/Documents/Codex/2026-10-23/task-9/sos-review/isolated/test_independent_review.py), [independent-tests.log](/Users/tim/Documents/Codex/2026-10-23/task-9/sos-review/independent-tests.log).
- CLI demo and exact-input example regenerated once each; both are byte-identical to the retained SYNTHETIC-REPORT.json and EXAMPLE-RESULT.json. The example's input SHA also matches the exact local input bytes.
- All **15 manifest payload entries**, **16 SHA256SUMS entries**, and **17 delivery-mirror files** match. The extra canonical `tests-initial.log` is retained historical evidence, not an unlisted new deliverable.
- All **18 canonical packet files** are unchanged before/after this review. All **8 reviewed source pins** still match. HEAD remains `2a5092d37cb863ec92a2a4e609999cf226bfa4a5` on the observed `octoberBranch` checkout.

The mirror inspected was `/Users/tim/Documents/Codex/2026-10-23/task-11/package`. [mirror-check.json](/Users/tim/Documents/Codex/2026-10-23/task-9/sos-review/mirror-check.json), [pins-before.json](/Users/tim/Documents/Codex/2026-10-23/task-9/sos-review/pins-before.json), [pins-after.json](/Users/tim/Documents/Codex/2026-10-23/task-9/sos-review/pins-after.json), [source-pins-verified.json](/Users/tim/Documents/Codex/2026-10-23/task-9/sos-review/source-pins-verified.json).

## Key pins

| File | SHA256 |
|---|---|
| CANDIDATE.json | `8d398f05ba46c6d0b6ad3bba13aaa4c3ca90fb4c0f2534eee3289277da485a70` |
| SHA256SUMS | `d9658d0ac77408909a1cf67a23627dc02bf2525e489d50f3d3834bfab4fa95dc` |
| sos_candidate.py | `722d6db9fa982f8384713c1c8976e1093b89f903f43f7ba32430ab56a9588126` |
| record_core.py | `eb886d1aa79ec8b49d23ed9f0c3e82a16c0b3ad693cea461bc45c3c3f0350258` |
| test_sos_candidate.py | `95bc15b997947d320d900db05197939380bfcc11c4090a553e3740ceb932d701` |
| example-input.json | `6d0ec79052f85ec37e71b578f27198db248986355afafe00442a2f5789c90349` |
| SYNTHETIC-REPORT.json | `fc08f579836ec9f3ec4a6411d23a9e28b88ceb9768630b9f3a60509b4e8bf67a` |

No review execution blocker remains. Data eligibility, prior/display choices, empirical NHL/category qualification and any runtime integration remain separate gates explicitly preserved by the candidate.
