# Event Dictionary

## Purpose

This document is the living catalog of observed NHL play-by-play event types, their `typeCode` and `typeDescKey` pairs, the keys observed in `details`, and known payload-shape notes that matter for parsing and parity work.

Current baseline source:

- `tasks/artifacts/nhl-pbp-recon-2026-03-30.md`
- `tasks/artifacts/nhl-pbp-recon-2026-03-30.json`

Last validated sample date:

- `2026-03-30`

## Baseline Sample Games

The March 30, 2026 reconnaissance sample intentionally included:

- overtime
- empty-net
- heavy special teams
- low-event
- high-event
- regulation-control
- goalie-pulled

Representative game IDs in the baseline sample:

- `2025021018`
- `2025021103`
- `2025021003`
- `2025021119`
- `2025021171`
- `2025021140`
- `2025020982`
- `2025021172`
- `2025021170`
- `2025021169`

## Top-Level Payload Notes

Observed top-level keys in `gamecenter/{id}/play-by-play` include:

- `id`
- `season`
- `gameType`
- `gameDate`
- `venue`
- `startTimeUTC`
- `gameState`
- `periodDescriptor`
- `awayTeam`
- `homeTeam`
- `clock`
- `plays`
- `rosterSpots`
- `summary`

Important baseline observations:

- `play-by-play` already includes `rosterSpots`, and this is currently a more useful roster shape than relying only on `boxscore`.
- `play-by-play.plays` exposes both `eventId` and `sortOrder`.
- `sortOrder` is the canonical in-game sequencing field for deterministic ordering.
- `eventId` should still be preserved as the upstream event identifier and row key.
- `period-start`, `period-end`, `shootout-complete`, and `game-end` do not currently expose `details`.

## Endpoint Shape Notes

The current upstream endpoint shapes are not interchangeable and should not be treated as redundant copies of the same contract.

### `gamecenter/{id}/play-by-play`

Observed strengths:

- includes the raw event stream in `plays`
- includes `rosterSpots`
- includes enough event-level context to normalize participants, coordinates, shot types, score progression, and raw manpower state

Current parser guidance:

- `play-by-play` is the canonical source for normalized event rows
- `play-by-play.rosterSpots` is currently the most useful roster source in the sampled games

### `gamecenter/{id}/boxscore`

Observed limitation in the sampled games:

- `boxscore` did not expose the expected roster sections in the same directly usable shape as `play-by-play.rosterSpots`

Current parser guidance:

- store the raw `boxscore` payload for audit and future enrichment
- do not depend on `boxscore` as the primary roster-normalization source for phase 1
- use `boxscore` opportunistically for goalie or game-summary context if needed, but not as the roster authority

### `gamecenter/{id}/landing`

Observed strengths:

- useful for additional game summary metadata
- useful for score, shots, summary context, and other game-level reporting fields

Current parser guidance:

- store raw `landing` for auditability and later enrichment
- do not use `landing` as the canonical event or roster source

### Contract Summary

Current phase 1 source preference is:

1. `play-by-play` for normalized events and roster spots
2. `shiftcharts` for shift rows and on-ice attribution
3. `landing` for auxiliary game-summary context
4. `boxscore` for auxiliary audit or later enrichment, not as the roster authority

If upstream endpoint shapes change, this section must be updated before parser assumptions are changed.

## Event Catalog

### 502 `faceoff`

Observed count in baseline sample:

- `573`

Observed `details` keys:

| detail key | presence % | example values |
| --- | ---: | --- |
| `eventOwnerTeamId` | 100 | `25`, `4`, `1` |
| `losingPlayerId` | 100 | `8477989`, `8481533`, `8475168` |
| `winningPlayerId` | 100 | `8482740`, `8475168`, `8480015` |
| `xCoord` | 100 | `0`, `-20`, `-69` |
| `yCoord` | 100 | `0`, `-22`, `22` |
| `zoneCode` | 100 | `N`, `O`, `D` |

Parser notes:

- Faceoff location and `zoneCode` should support zone-start and zone-faceoff derivations.
- Winning and losing player IDs are directly available.

### 503 `hit`

Observed count in baseline sample:

- `467`

Observed `details` keys:

| detail key | presence % | example values |
| --- | ---: | --- |
| `eventOwnerTeamId` | 100 | `4`, `25`, `16` |
| `hitteePlayerId` | 100 | `8481581`, `8482142`, `8476278` |
| `hittingPlayerId` | 100 | `8478439`, `8475168`, `8480220` |
| `xCoord` | 100 | `-94`, `96`, `-79` |
| `yCoord` | 100 | `25`, `13`, `39` |
| `zoneCode` | 100 | `O`, `D`, `N` |

### 504 `giveaway`

Observed count in baseline sample:

- `290`

Observed `details` keys:

| detail key | presence % | example values |
| --- | ---: | --- |
| `eventOwnerTeamId` | 100 | `4`, `25`, `16` |
| `playerId` | 100 | `8480220`, `8476372`, `8480027` |
| `xCoord` | 100 | `-46`, `94`, `73` |
| `yCoord` | 100 | `41`, `-24`, `-35` |
| `zoneCode` | 100 | `O`, `D`, `N` |

### 505 `goal`

Observed count in baseline sample:

- `71`

Observed `details` keys:

| detail key | presence % | example values |
| --- | ---: | --- |
| `assist1PlayerId` | 85.9 | `8484387`, `8481546`, `8485391` |
| `assist1PlayerTotal` | 85.9 | `24`, `22`, `3` |
| `assist2PlayerId` | 67.6 | `8477499`, `8481035`, `8481806` |
| `assist2PlayerTotal` | 67.6 | `9`, `1`, `14` |
| `awayScore` | 100 | `0`, `1`, `2` |
| `discreteClip` | 94.4 | `6392096567112`, `6392100423112`, `6392102789112` |
| `discreteClipFr` | 94.4 | `6392097745112`, `6392098186112`, `6392101820112` |
| `eventOwnerTeamId` | 100 | `4`, `25`, `16` |
| `goalieInNetId` | 95.8 | `8479193`, `8481035`, `8474596` |
| `highlightClip` | 95.8 | `6392099110112`, `6392097794112`, `6392103875112` |
| `highlightClipFr` | 91.5 | `6392096569112`, `6392100626112`, `6392102916112` |
| `highlightClipSharingUrl` | 95.8 | NHL clip URLs |
| `highlightClipSharingUrlFr` | 91.5 | NHL FR clip URLs |
| `homeScore` | 100 | `1`, `2`, `0` |
| `scoringPlayerId` | 100 | `8478439`, `8484938`, `8481533` |
| `scoringPlayerTotal` | 91.5 | `26`, `1`, `23` |
| `shotType` | 98.6 | `wrist`, `snap`, `deflected` |
| `xCoord` | 100 | `85`, `-67`, `73` |
| `yCoord` | 100 | `0`, `-19`, `-23` |
| `zoneCode` | 100 | `O`, `D` |

Parser notes:

- Goals should count as shot attempts, unblocked attempts, and shots on goal.
- `goalieInNetId` is usually present but not universal; empty-net detection cannot rely on this field alone.

### 506 `shot-on-goal`

Observed count in baseline sample:

- `553`

Observed `details` keys:

| detail key | presence % | example values |
| --- | ---: | --- |
| `awaySOG` | 100 | `0`, `1`, `2` |
| `eventOwnerTeamId` | 100 | `4`, `25`, `16` |
| `goalieInNetId` | 100 | `8479193`, `8481035`, `8474596` |
| `homeSOG` | 100 | `1`, `2`, `3` |
| `shootingPlayerId` | 100 | `8477499`, `8482740`, `8484938` |
| `shotType` | 100 | `wrist`, `snap`, `tip-in` |
| `xCoord` | 100 | `-87`, `74`, `40` |
| `yCoord` | 100 | `-5`, `-12`, `-24` |
| `zoneCode` | 100 | `O`, `N`, `D` |

### 507 `missed-shot`

Observed count in baseline sample:

- `341`

Observed `details` keys:

| detail key | presence % | example values |
| --- | ---: | --- |
| `eventOwnerTeamId` | 100 | `25`, `4`, `1` |
| `goalieInNetId` | 97.4 | `8481035`, `8479193`, `8481519` |
| `reason` | 100 | `wide-left`, `hit-right-post`, `above-crossbar` |
| `shootingPlayerId` | 100 | `8477454`, `8484142`, `8482740` |
| `shotType` | 100 | `wrap-around`, `wrist`, `tip-in` |
| `xCoord` | 100 | `87`, `-79`, `68` |
| `yCoord` | 100 | `-5`, `-9`, `14` |
| `zoneCode` | 100 | `O`, `N`, `D` |

Parser notes:

- Miss reasons must remain preserved in raw form because some downstream rules may treat miss subtypes differently.

### 508 `blocked-shot`

Observed count in baseline sample:

- `328`

Observed `details` keys:

| detail key | presence % | example values |
| --- | ---: | --- |
| `blockingPlayerId` | 100 | `8476902`, `8481533`, `8484829` |
| `eventOwnerTeamId` | 100 | `4`, `25`, `1` |
| `reason` | 100 | `blocked`, `teammate-blocked` |
| `shootingPlayerId` | 100 | `8477499`, `8481581`, `8480220` |
| `xCoord` | 100 | `-81`, `34`, `-70` |
| `yCoord` | 100 | `-3`, `-7`, `-8` |
| `zoneCode` | 100 | `D`, `O`, `N` |

### 509 `penalty`

Observed count in baseline sample:

- `100`

Observed `details` keys:

| detail key | presence % | example values |
| --- | ---: | --- |
| `committedByPlayerId` | 94 | `8482740`, `8476461`, `8478420` |
| `descKey` | 100 | `tripping`, `holding-the-stick`, `high-sticking` |
| `drawnByPlayerId` | 86 | `8481546`, `8478047`, `8477499` |
| `duration` | 100 | `2`, `5`, `4` |
| `eventOwnerTeamId` | 100 | `25`, `4`, `16` |
| `servedByPlayerId` | 11 | `8482809`, `8484984`, `8480188` |
| `typeCode` | 100 | `MIN`, `MAJ`, `BEN` |
| `xCoord` | 100 | `96`, `60`, `66` |
| `yCoord` | 100 | `18`, `-39`, `-1` |
| `zoneCode` | 100 | `O`, `D`, `N` |

Parser notes:

- Penalty subtype is split across `descKey` and `typeCode`.
- Bench and served penalties must preserve both the committed and served-by semantics when available.

### 516 `stoppage`

Observed count in baseline sample:

- `431`

Observed `details` keys:

| detail key | presence % | example values |
| --- | ---: | --- |
| `reason` | 100 | `offside`, `puck-frozen`, `icing` |
| `secondaryReason` | 23.2 | `tv-timeout`, `rink-repair`, `visitor-timeout` |

### 520 `period-start`

Observed count in baseline sample:

- `35`

Observed `details` keys:

- none

### 521 `period-end`

Observed count in baseline sample:

- `35`

Observed `details` keys:

- none

### 523 `shootout-complete`

Observed count in baseline sample:

- `2`

Observed `details` keys:

- none

### 524 `game-end`

Observed count in baseline sample:

- `10`

Observed `details` keys:

- none

### 525 `takeaway`

Observed count in baseline sample:

- `91`

Observed `details` keys:

| detail key | presence % | example values |
| --- | ---: | --- |
| `eventOwnerTeamId` | 100 | `4`, `25`, `1` |
| `playerId` | 100 | `8484142`, `8482142`, `8473994` |
| `xCoord` | 100 | `-20`, `89`, `39` |
| `yCoord` | 100 | `37`, `-32`, `-36` |
| `zoneCode` | 100 | `N`, `D`, `O` |

### 535 `delayed-penalty`

Observed count in baseline sample:

- `23`

Observed `details` keys:

| detail key | presence % | example values |
| --- | ---: | --- |
| `eventOwnerTeamId` | 100 | `25`, `4`, `6` |

## Known Parsing Notes

- Shot-like event family for phase 1:
  - `goal`
  - `shot-on-goal`
  - `missed-shot`
  - `blocked-shot`
- Empty-net detection should use validated `situationCode` goalie digits and the absence of a goalie-in-net value when relevant, not only an explicit `emptyNet` boolean.
- Canonical event ordering should use `sortOrder`.
- `eventId` should be preserved alongside `sortOrder` as the upstream event identifier and primary event key for idempotent upserts.
- Parser logic must not infer event sequence from period/time strings alone when `sortOrder` is available.
- All nullable `details` keys should remain preserved in raw JSON even when promoted to typed columns.

## Phase 1 Feature Coverage Confirmation

The March 30, 2026 sampled NHL data is sufficient for phase 1 parity and feature generation, with the caveats below.

### Supported Directly

- Coordinates
  - `xCoord`, `yCoord`, and `zoneCode` were present on sampled shot-like events at effectively full coverage.
  - Faceoffs, hits, giveaways, takeaways, and penalties also carried location in the sample.
- Shot types
  - `shotType` was present on:
    - `goal` at `98.6%`
    - `shot-on-goal` at `100%`
    - `missed-shot` at `100%`
- Participant IDs
  - shooter, scorer, blocker, hitter, hittee, faceoff winner/loser, penalized player, and drawn-by player fields were observed at usable coverage for their event classes.
- Team attribution
  - `eventOwnerTeamId` was present at `100%` for the sampled offensive and player-attributed event classes used for parity work.
- Score state
  - `goal` carried `homeScore` and `awayScore` at `100%`.
  - `shot-on-goal` carried cumulative `homeSOG` and `awaySOG` at `100%`.
- Strength inputs
  - `situationCode` was present and sufficient to decode goalie/skater state for canonical strength labeling.

### Supported With Required Derived Logic

- On-ice attribution
  - supported only when `play-by-play` is joined with `shiftcharts`
  - `eventOwnerTeamId` alone is not enough for on-ice player attribution
- Exact score progression for every event
  - supported by replaying normalized event order and goal events
  - score fields are not present on every event class
- Empty-net detection
  - supported via `situationCode`
  - must not rely only on `goalieInNetId`
- Attacking-direction normalization
  - supported when event coordinates are combined with `homeTeamDefendingSide`, period context, and normalization rules

### Important Caveats

- `goalieInNetId` is not universal on `goal` and `missed-shot`, so goalie context must tolerate nulls.
- `blocked-shot` did not expose `shotType` in the baseline sample, so blocked attempts should preserve null `shotType` unless future upstream evidence changes that assumption.
- `servedByPlayerId` on penalties is sparse and must remain nullable.
- `eventOwnerTeamId` should not be assumed on stoppages or period-boundary events.

### Phase 1 Conclusion

The sampled NHL public data supports the required:

- coordinates,
- shot types,
- participant IDs,
- score progression inputs,
- team attribution,
- strength decoding,
- and shift-based on-ice reconstruction

for phase 1 NST parity and xG-feature groundwork.

The remaining work is parser design and documented fallback handling, not an upstream data-availability blocker.

## Maintenance Rules

- Do not replace this file wholesale when a new recon run is performed.
- Append or revise only the sections that changed.
- If a new event type appears, add a new section with the observed key coverage and parser notes.
- If an existing event type changes shape, record the date of the new observation and update the presence percentages and notes.
