# Player Forecasts 2025–26 Lockbox Evidence

The primary 2025–26 lockbox was evaluated exactly once on 2026-08-04. This is
blind evidence for the reviewed conditional-skater artifact, not promotion
authorization. The model was not changed after the primary receipt, and tuning
against these results is prohibited.

## Immutable identities

- Reviewed artifact: `/private/tmp/player-forecast-lockbox-ready-v2.json`
- Artifact SHA-256: `fa25eefe4c87c10521b289cb7dedc6f5c96dc493d52caefb3a626c3593adea18`
- Primary receipt: `/private/tmp/player-forecast-lockbox-receipt-v2.json`
- Receipt SHA-256: `f821898c5e5af48631b0966fb379a60c8b3d989cbb035e2c267982cdbccb3c4d`
- Evidence companion: `/private/tmp/player-forecast-lockbox-evidence-v2.json`
- Evidence SHA-256: `b1a4b29f6dbd1f9918e0a6019ff3ef7cede0ba6150e229267d5e931dd6354e4f`
- Evaluation window: 2026-01-03 through 2026-04-16, regular season only
- Evaluation ordinal: 1
- `modelChangedAfterPrimaryReceipt`: `false`
- `tuningPermitted`: `false`

The primary receipt contains an early generic blocker saying the candidate
tournament and calibration were incomplete. The append-only companion is the
later, more specific gate record and does not rewrite that immutable receipt.

## Result

Twelve of fourteen included population/target segments passed every
preregistered lift, paired-bootstrap, interval-coverage, and sparse-history
gate. Two sparse-history gates failed:

| Population | Target | Overall relative MAE lift | Sparse-history regression | Limit | Result |
| --- | --- | ---: | ---: | ---: | --- |
| Defense | Assists | 8.7064% | 5.0801% | 5% | Fail |
| Forward | Hits | 20.1151% | 14.4253% | 5% | Fail |

All fourteen segments passed the minimum overall relative lift, positive paired
slate-bootstrap lower bound, and 80% interval-coverage gates. Because the two
sparse-history failures are part of the preregistered policy,
`allIncludedSegmentsPass=false` and the artifact is not promotion eligible.

Playing probability, goalie-start probability, and conditional goalie targets
remain excluded because reconstructable historical labels were unavailable.
They require authentic prospective observations rather than synthesized
timestamps or retrospective current-state data.

## Required next evidence

Do not alter the reviewed artifact based on lockbox results and call the result
blind. The unchanged artifact may collect untouched 2026–27 prospective shadow
evidence using the runbook's `freeze-prospective` and `evaluate-prospective`
commands. Any newly tuned candidate is validation-only and needs a distinct
artifact plus an untouched prospective comparison before promotion can be
considered.
