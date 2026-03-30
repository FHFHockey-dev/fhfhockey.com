# NHL PbP Recon

Generated: 2026-03-30T13:38:25.081Z
Recon date anchor: 2026-03-30

## Sample Games

| label | gameId | date | matchup | OT | EN goals | penalties | shot-like | zero-goalie events |
| --- | ---: | --- | --- | --- | ---: | ---: | ---: | ---: |
| overtime | 2025021018 | 2026-03-10 | PIT @ CAR | yes | 0 | 12 | 158 | 22 |
| empty-net | 2025021103 | 2026-03-21 | PHI @ SJS | no | 2 | 13 | 112 | 17 |
| heavy-special-teams | 2025021003 | 2026-03-08 | TBL @ BUF | no | 0 | 28 | 124 | 16 |
| low-event | 2025021119 | 2026-03-23 | OTT @ NYR | no | 0 | 10 | 87 | 17 |
| high-event | 2025021171 | 2026-03-29 | CHI @ NJD | no | 1 | 5 | 154 | 16 |
| regulation-control | 2025021140 | 2026-03-26 | MIN @ FLA | no | 0 | 2 | 129 | 18 |
| goalie-pulled | 2025020982 | 2026-03-05 | NYI @ LAK | no | 0 | 6 | 153 | 51 |
| fill-8 | 2025021172 | 2026-03-29 | DAL @ PHI | yes | 0 | 5 | 94 | 1 |
| fill-9 | 2025021170 | 2026-03-29 | BOS @ CBJ | yes | 0 | 12 | 140 | 26 |
| fill-10 | 2025021169 | 2026-03-29 | MTL @ CAR | no | 0 | 7 | 142 | 23 |

## Event Dictionary

### 502 faceoff (573 events)

| detail key | presence % | examples |
| --- | ---: | --- |
| eventOwnerTeamId | 100 | 25, 4, 1 |
| losingPlayerId | 100 | 8477989, 8481533, 8475168 |
| winningPlayerId | 100 | 8482740, 8475168, 8480015 |
| xCoord | 100 | 0, -20, -69 |
| yCoord | 100 | 0, -22, 22 |
| zoneCode | 100 | N, O, D |

### 503 hit (467 events)

| detail key | presence % | examples |
| --- | ---: | --- |
| eventOwnerTeamId | 100 | 4, 25, 16 |
| hitteePlayerId | 100 | 8481581, 8482142, 8476278 |
| hittingPlayerId | 100 | 8478439, 8475168, 8480220 |
| xCoord | 100 | -94, 96, -79 |
| yCoord | 100 | 25, 13, 39 |
| zoneCode | 100 | O, D, N |

### 504 giveaway (290 events)

| detail key | presence % | examples |
| --- | ---: | --- |
| eventOwnerTeamId | 100 | 4, 25, 16 |
| playerId | 100 | 8480220, 8476372, 8480027 |
| xCoord | 100 | -46, 94, 73 |
| yCoord | 100 | 41, -24, -35 |
| zoneCode | 100 | O, D, N |

### 505 goal (71 events)

| detail key | presence % | examples |
| --- | ---: | --- |
| assist1PlayerId | 85.9 | 8484387, 8481546, 8485391 |
| assist1PlayerTotal | 85.9 | 24, 22, 3 |
| assist2PlayerId | 67.6 | 8477499, 8481035, 8481806 |
| assist2PlayerTotal | 67.6 | 9, 1, 14 |
| awayScore | 100 | 0, 1, 2 |
| discreteClip | 94.4 | 6392096567112, 6392100423112, 6392102789112 |
| discreteClipFr | 94.4 | 6392097745112, 6392098186112, 6392101820112 |
| eventOwnerTeamId | 100 | 4, 25, 16 |
| goalieInNetId | 95.8 | 8479193, 8481035, 8474596 |
| highlightClip | 95.8 | 6392099110112, 6392097794112, 6392103875112 |
| highlightClipFr | 91.5 | 6392096569112, 6392100626112, 6392102916112 |
| highlightClipSharingUrl | 95.8 | https://nhl.com/video/dal-phi-konecny-scores-ppg-against-casey-desmith-6392099110112, https://nhl.com/video/dal-phi-hyry-scores-shg-against-samuel-ersson-6392097794112, https://nhl.com/video/dal-phi-zegras-scores-goal-against-casey-desmith-6392103875112 |
| highlightClipSharingUrlFr | 91.5 | https://nhl.com/fr/video/dal-phi-konecny-marque-un-but-en-a-n-contre-casey-desmith-6392096569112, https://nhl.com/fr/video/dal-phi-hyry-marque-un-but-en-i-n-contre-samuel-ersson-6392100626112, https://nhl.com/fr/video/dal-phi-zegras-marque-un-but-contre-casey-desmith-6392102916112 |
| homeScore | 100 | 1, 2, 0 |
| scoringPlayerId | 100 | 8478439, 8484938, 8481533 |
| scoringPlayerTotal | 91.5 | 26, 1, 23 |
| shotType | 98.6 | wrist, snap, deflected |
| xCoord | 100 | 85, -67, 73 |
| yCoord | 100 | 0, -19, -23 |
| zoneCode | 100 | O, D |

### 506 shot-on-goal (553 events)

| detail key | presence % | examples |
| --- | ---: | --- |
| awaySOG | 100 | 0, 1, 2 |
| eventOwnerTeamId | 100 | 4, 25, 16 |
| goalieInNetId | 100 | 8479193, 8481035, 8474596 |
| homeSOG | 100 | 1, 2, 3 |
| shootingPlayerId | 100 | 8477499, 8482740, 8484938 |
| shotType | 100 | wrist, snap, tip-in |
| xCoord | 100 | -87, 74, 40 |
| yCoord | 100 | -5, -12, -24 |
| zoneCode | 100 | O, N, D |

### 507 missed-shot (341 events)

| detail key | presence % | examples |
| --- | ---: | --- |
| eventOwnerTeamId | 100 | 25, 4, 1 |
| goalieInNetId | 97.4 | 8481035, 8479193, 8481519 |
| reason | 100 | wide-left, hit-right-post, above-crossbar |
| shootingPlayerId | 100 | 8477454, 8484142, 8482740 |
| shotType | 100 | wrap-around, wrist, tip-in |
| xCoord | 100 | 87, -79, 68 |
| yCoord | 100 | -5, -9, 14 |
| zoneCode | 100 | O, N, D |

### 508 blocked-shot (328 events)

| detail key | presence % | examples |
| --- | ---: | --- |
| blockingPlayerId | 100 | 8476902, 8481533, 8484829 |
| eventOwnerTeamId | 100 | 4, 25, 1 |
| reason | 100 | blocked, teammate-blocked |
| shootingPlayerId | 100 | 8477499, 8481581, 8480220 |
| xCoord | 100 | -81, 34, -70 |
| yCoord | 100 | -3, -7, -8 |
| zoneCode | 100 | D, O, N |

### 509 penalty (100 events)

| detail key | presence % | examples |
| --- | ---: | --- |
| committedByPlayerId | 94 | 8482740, 8476461, 8478420 |
| descKey | 100 | tripping, holding-the-stick, high-sticking |
| drawnByPlayerId | 86 | 8481546, 8478047, 8477499 |
| duration | 100 | 2, 5, 4 |
| eventOwnerTeamId | 100 | 25, 4, 16 |
| servedByPlayerId | 11 | 8482809, 8484984, 8480188 |
| typeCode | 100 | MIN, MAJ, BEN |
| xCoord | 100 | 96, 60, 66 |
| yCoord | 100 | 18, -39, -1 |
| zoneCode | 100 | O, D, N |

### 516 stoppage (431 events)

| detail key | presence % | examples |
| --- | ---: | --- |
| reason | 100 | offside, puck-frozen, icing |
| secondaryReason | 23.2 | tv-timeout, rink-repair, visitor-timeout |

### 520 period-start (35 events)

No `details` keys observed.

### 521 period-end (35 events)

No `details` keys observed.

### 523 shootout-complete (2 events)

No `details` keys observed.

### 524 game-end (10 events)

No `details` keys observed.

### 525 takeaway (91 events)

| detail key | presence % | examples |
| --- | ---: | --- |
| eventOwnerTeamId | 100 | 4, 25, 1 |
| playerId | 100 | 8484142, 8482142, 8473994 |
| xCoord | 100 | -20, 89, 39 |
| yCoord | 100 | 37, -32, -36 |
| zoneCode | 100 | N, D, O |

### 535 delayed-penalty (23 events)

| detail key | presence % | examples |
| --- | ---: | --- |
| eventOwnerTeamId | 100 | 25, 4, 6 |

## Situation Code Inference

Empirical samples are consistent with situationCode = awayGoalie, awaySkaters, homeSkaters, homeGoalie.

### emptyNetExamples

| gameId | matchup | type | situationCode | exact | state | emptyNet | ownerTeamId |
| ---: | --- | --- | --- | --- | --- | --- | ---: |
| 2025021171 | CHI @ NJD | goal | 0651 | 6v5 | EN | null | 1 |
| 2025021103 | PHI @ SJS | goal | 1560 | 5v6 | EN | null | 4 |
| 2025021103 | PHI @ SJS | goal | 1560 | 5v6 | EN | null | 4 |

### threeOnThreeExamples

| gameId | matchup | type | situationCode | exact | state | emptyNet | ownerTeamId |
| ---: | --- | --- | --- | --- | --- | --- | ---: |
| 2025021172 | DAL @ PHI | period-start | 1331 | 3v3 | EV | null |  |
| 2025021172 | DAL @ PHI | faceoff | 1331 | 3v3 | EV | null | 4 |
| 2025021172 | DAL @ PHI | shot-on-goal | 1331 | 3v3 | EV | null | 4 |
| 2025021172 | DAL @ PHI | shot-on-goal | 1331 | 3v3 | EV | null | 4 |

### sixOnFiveExamples

| gameId | matchup | type | situationCode | exact | state | emptyNet | ownerTeamId |
| ---: | --- | --- | --- | --- | --- | --- | ---: |
| 2025021171 | CHI @ NJD | shot-on-goal | 0651 | 6v5 | EN | null | 16 |
| 2025021171 | CHI @ NJD | stoppage | 0651 | 6v5 | EN | null |  |
| 2025021171 | CHI @ NJD | faceoff | 0651 | 6v5 | EN | null | 16 |
| 2025021171 | CHI @ NJD | blocked-shot | 0651 | 6v5 | EN | null | 16 |
| 2025021171 | CHI @ NJD | blocked-shot | 0651 | 6v5 | EN | null | 16 |
| 2025021171 | CHI @ NJD | blocked-shot | 0651 | 6v5 | EN | null | 16 |

## Endpoint Notes

- `https://api-web.nhle.com/v1/gamecenter/{gameId}/play-by-play` for raw event stream.
- `https://api-web.nhle.com/v1/gamecenter/{gameId}/boxscore` for game rosters and goalie context.
- `https://api-web.nhle.com/v1/gamecenter/{gameId}/landing` for additional game summary metadata.
- `https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId={gameId}` for shifts and on-ice attribution.

