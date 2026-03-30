# NHL Manual Audit

Date: 2026-03-30
Environment: local workspace plus live Supabase project
Audit scope: event parsing, strength mapping, and on-ice attribution

Version context:

- `parser_version = 1`
- `strength_version = 1`
- `feature_version = 1`
- `parity_version = 1`

## Sampled Games

| label | gameId | audit reason |
| --- | ---: | --- |
| overtime | `2025021018` | OT and `3v3` validation |
| empty-net | `2025021103` | empty-net and EN-goal validation |
| heavy-special-teams | `2025021003` | PP and rare-manpower validation |
| regulation-control | `2025021140` | clean EV baseline |

## Raw And Normalized Count Checks

All sampled games had the expected four raw endpoints present:

- `play-by-play`
- `boxscore`
- `landing`
- `shiftcharts`

Count spot-checks:

| gameId | raw plays | normalized events | raw shifts | normalized shifts | result |
| ---: | ---: | ---: | ---: | ---: | --- |
| `2025021018` | 389 | 389 | 782 | 782 | pass |
| `2025021103` | 318 | 318 | 706 | 706 | pass |
| `2025021003` | 366 | 366 | 776 | 776 | pass |
| `2025021140` | 336 | 336 | 683 | 683 | pass |

No count drift was observed in the sampled games.

## Event Parsing Spot Checks

### Overtime `3v3`

Game: `2025021018`
Event: `1077`

- type: `faceoff`
- period: `4` (`OT`)
- exact strength: `3v3`
- canonical strength: `EV`
- owner team id: `5` (away)
- event second: `0`

Result:

- parser preserved OT period metadata
- normalized strength fields matched the OT `3v3` expectation
- no contradiction found between `period_type`, `situationCode`, and normalized strength

### Empty-Net Goal

Game: `2025021103`
Event: `1125`

- type: `goal`
- exact strength: `5v6`
- canonical strength: `EN`
- owner team id: `4` (away)
- `goalie_in_net_id = null`
- scorer id: `8477948`
- score after event: home `1`, away `3`
- shot type: `wrist`
- zone code: `D`

Result:

- parser correctly preserved an empty-net goal without forcing a goalie id
- score fields advanced plausibly
- EN labeling matched the zero-goalie state

### Power-Play Goal

Game: `2025021003`
Event: `198`

- type: `goal`
- exact strength: `4v5`
- canonical strength: `PP`
- owner team id: `7` (home)
- scorer id: `8482659`
- assist ids: `8479420`, `8481524`
- goalie id: `8477992`
- shot type: `wrist`
- zone code: `O`
- score after event: home `1`, away `0`

Result:

- parser preserved scorer, assists, goalie, score, and shot metadata correctly
- owner-relative PP classification was correct for the home team

### Rare-Manpower Power Play

Game: `2025021003`
Event: `116`

- type: `faceoff`
- exact strength: `3v5`
- canonical strength: `PP`
- owner team id: `7` (home)

Result:

- rare manpower was preserved as `3v5`
- the event was not collapsed into a generic PP-only label
- owner-relative PP classification remained correct

### Even-Strength Baseline

Game: `2025021140`
Event: `51`

- type: `faceoff`
- exact strength: `5v5`
- canonical strength: `EV`
- owner team id: `13` (home)
- zone code: `N`

Result:

- baseline EV parsing looked correct

## On-Ice Attribution Spot Checks

On-ice player sets were inspected using reconstructed shift stints for representative events.

Important interpretation:

- player-set counts below are goalie-inclusive
- `6` players for a team can mean `5 skaters + goalie`
- `4` players for a team in OT can mean `3 skaters + goalie`
- manpower validation must come from `situationCode`, not raw player-set length alone

### Overtime `3v3` Faceoff

Game: `2025021018`
Event: `1077`

- stint found: yes
- home on-ice players: `4`
- away on-ice players: `4`

Interpretation:

- this matches `3 skaters + goalie` on each side
- OT stint reconstruction looked correct

### Empty-Net `6v5` Event

Game: `2025021103`
Event: `588`

- type: `blocked-shot`
- exact strength: `6v5`
- stint found: yes
- home on-ice players: `6`
- away on-ice players: `6`

Interpretation:

- this is plausible because player sets are goalie-inclusive
- one side can be `6 skaters`
- the other side can be `5 skaters + goalie`
- no contradiction was found once player-inclusive counting was applied

### Empty-Net Goal

Game: `2025021103`
Event: `1125`

- stint found: yes
- home on-ice players: `6`
- away on-ice players: `6`

Interpretation:

- same goalie-inclusive rule applies
- the EN goal did not expose a missing-stint or obvious team-set inversion

### Rare `3v5` Power-Play Faceoff

Game: `2025021003`
Event: `116`

- stint found: yes
- home on-ice players: `6`
- away on-ice players: `4`

Interpretation:

- this matches `5 skaters + goalie` for the PP team and `3 skaters + goalie` for the PK team
- rare-manpower on-ice attribution looked consistent with `situationCode`

### Standard `5v5` Event

Game: `2025021140`
Event: `51`

- stint found: yes
- home on-ice players: `6`
- away on-ice players: `6`

Interpretation:

- standard EV attribution looked correct

## Findings

### Passes

- raw and normalized event counts matched exactly for all four sampled games
- normalized shift-row counts matched the raw shiftchart row counts for all four sampled games
- OT `3v3`, EN, EV, PP, and rare-manpower examples all produced the expected `strength_exact` and `strength_state` combinations
- sampled goal events preserved scorer, assist, shot, goalie, and score details as expected
- reconstructed on-ice attribution found a valid stint for every sampled event inspected

### Important Caveat

- on-ice player sets are goalie-inclusive
- human reviewers must not treat player-set length as skater manpower
- skater manpower remains an interpretation of `situationCode`

This is not a bug. It is the correct reading of player-level shift attribution.

## Conclusion

Manual audit result: pass

No sampled contradiction was found across:

- event parsing
- strength mapping
- shift-based on-ice attribution

The main operator note is interpretive, not corrective:

- use `situationCode` for manpower labels
- use on-ice player sets for player attribution
- do not derive manpower directly from goalie-inclusive player-set counts
