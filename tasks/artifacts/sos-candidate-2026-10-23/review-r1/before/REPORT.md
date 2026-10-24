# SoS offline candidate — completed research packet

Implemented a pure, versioned past/future calculation plus explicit contract, research inventory and synthetic validation. No production formula is selected. No NHL predictive or fantasy-utility improvement is claimed.

Start with [CONTRACT.md](CONTRACT.md) for exact semantics and [EVIDENCE-AND-PLAN.md](EVIDENCE-AND-PLAN.md) for inherited research, current code findings and minimal GameGrid/WeekScore integration. [sos_candidate.py](sos_candidate.py) is the pure calculation; [run_candidate.py](run_candidate.py) is a local JSON CLI. The unchanged October20 record core is pinned in [CORE-PROVENANCE.json](CORE-PROVENANCE.json).

## Verification actually completed

- **41/41 tests pass together**, including balanced/unbalanced leagues, published Colley arithmetic, schedule confounding, focal exclusions and naive negative control, missing/zero-GP teams, duplicate IDs, repeated opponents, strict result/schedule cutoffs, season boundaries, points systems, regulation ties, graph components, rank ties/churn, no-volume bonus, and retained-pregame replay. See [tests-final.log](tests-final.log).
- The corrected stability test uses exact Fraction checks for direct/RPI differences and a12-decimal comparison for the Colley solver. It verifies every team's score change and resulting competition rank. It replaces a mathematically false strict `<.1` bound that happened to pass through binary floating-point rounding.
- [example-input.json](example-input.json) runs through the file CLI and produces [EXAMPLE-RESULT.json](EXAMPLE-RESULT.json), including an input SHA256. [SYNTHETIC-REPORT.json](SYNTHETIC-REPORT.json) records all demonstration results. Two independent CLI demo invocations produced byte-identical JSON.
- Final input/output consistency, preserved-core provenance, source pins, artifact integrity and Markdown links are checked separately. Authored source/docs pass whitespace checks; the frozen imported core retains one inherited blank line at EOF to preserve its exact source hash. No application suite, build or browser test is warranted for this unimported offline artifact.

Initial failed/test-harness receipts remain historical evidence. Earlier interrupted continuations did not execute their commands. The final combined passing run supersedes the earlier40/41-plus-targeted status. The artifact lease was explicitly acknowledged by the release owner at14:00:52UTC, as relayed by the parent; older ledger pending text is historical.

## Results and limits

| Synthetic observation | Result | What it establishes |
|---|---|---|
| Balanced six-team league | All three schedule indices=.5 and tied rank1 | Symmetry and tie handling. |
| Unequal opponent record lengths | Per-fixture direct mean=.625; repeated-record pooling would=.520 | Denominator pooling changes the estimand. |
| Confounded A/B records | Shrunk own records A=.4615, B=.5385; global adjusted indices A=.5977, B=.4023 | Adjustment can reverse raw-record order under the stipulated schedule. Not proof of true NHL ability. |
| One AB result reverses, future AC/BD/EF | C changes−1/10 direct,−1/15 RPI,−1/12 Colley; D changes equally upward; A/B/E/F unchanged | Exact self-exclusion and propagation behavior, not an empirical stability guarantee. |
| Tied baseline after that perturbation | C rank1→6; D remains1; others become2 | Large rank movement may reflect a tie, not large uncertainty-adjusted separation. |
| Extreme Colley chain | A≈1.225822, D≈−.225822; residual≈3.91e−14 | The outcome index is not bounded to[0,1]; no probability/clamp claim. |

Per-fixture means keep game volume separate. RPI is a proposed finite two-hop baseline; Colley is an adjusted outcome benchmark. Different outcome targets, scales and exclusion policies can change rankings. A passing solver or test suite does not establish optimal weights, credible probability calibration, NHL skill recovery or fantasy benefit.

Past retrospective estimates use results known at the selected cutoff; faced-then requires actual retained pregame snapshots. Future estimates use only pre-cutoff results and a pre-cutoff schedule snapshot. Completeness is explicitly attested by the caller and cannot be established by pure code. Prior-only/disconnected states are exposed; no calibrated intervals are manufactured.

## Practical next step

Review the contract and obtain a qualified retained game-level dataset before fitting/tuning. Keep four-week Opportunity unchanged and expose any later SoS as separate per-game context. Shadow-test a replacement for WeekScore's existing matchup term only after explicit integration approval; do not double-count GP, off-nights, odds or FORGE matchup effects.

No environment/lease blocker remains for this completed offline packet. Independent review, historical-data eligibility, empirical qualification, TJ's metric/display decisions and runtime integration remain separate future work. No application files, original research, model/reference paths, dependencies, migrations, Git state, production data, captures, pushes or deployments were changed by this lane.

## Reproduce

Run in this artifact directory using Python3 and the standard library only:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest -v test_sos_candidate
PYTHONDONTWRITEBYTECODE=1 python3 run_candidate.py --demo --output /tmp/sos-demo.json
PYTHONDONTWRITEBYTECODE=1 python3 run_candidate.py --input example-input.json --output /tmp/sos-example.json
```

The canonical artifact lives under `/Users/tim/Code/fhfhockey.com/tasks/artifacts/sos-candidate-2026-10-23/`. The task-workspace package is a pinned delivery mirror, not a second application editing checkout. See CANDIDATE.json and SHA256SUMS for exact deliverable bytes.
