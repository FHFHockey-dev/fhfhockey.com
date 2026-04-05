# Underlying Stats Landing Page SoS Predictive Component (`2.3`)

Date: 2026-04-05

## Goal

Define the predictive/context 50% of landing-page `SoS` using the inputs that best match the current `/underlying-stats` landing-page model.

## Chosen Source

Primary source:

- `team_power_ratings_daily`

Reason:

- it is current through the landing-page snapshot date (`2026-04-05`)
- it is the exact source behind the landing page’s team rows
- it already expresses opponent strength in the same league-centered scale the page uses

## Core Predictive Signal

The predictive half of `SoS` will use:

`opponent_power_score = computeTeamPowerScore(opponent_snapshot)`

Where `computeTeamPowerScore()` is the same landing-page formula from:

- `/Users/tim/Code/fhfhockey.com/web/lib/dashboard/teamContext.ts`

That score is already built from:

- `offRating`
- `defRating`
- `paceRating`
- `ppTier`
- `pkTier`

So the predictive half is not just a generic legacy power ranking. It is a direct reuse of the current landing-page model.

## Team-Level Predictive SoS Raw Score

For each team on the selected snapshot date:

1. read `past_opponents` from `sos_standings`
2. count how many times each opponent appears
3. look up each opponent’s `team_power_ratings_daily` row on the selected snapshot date
4. compute that opponent’s landing-page `Power Score`
5. average those opponent Power Scores weighted by games faced

Formula:

`predictive_raw = weighted_mean(opponent_power_score, weights = games_faced_vs_opponent)`

Interpretation:

- this measures how strong the opponents already faced look in the current landing-page model
- repeated opponents are weighted naturally by games played

## Why Current Snapshot Opponent Strength Was Chosen

The landing page is a current snapshot page, not a historical replay of what each opponent looked like on the day of each game.

Using current-snapshot opponent ratings means:

- `SoS` answers “how hard has this played schedule been, judged by what those opponents currently are”
- the result stays consistent with the rest of the landing page, which is itself snapshot-based

This is an implementation choice, not a stored formula.

## Normalization

Normalize `predictive_raw` across all 32 teams on the selected snapshot date using the same scale as the rest of the landing-page rating system:

`predictive_component_score = 100 + 15 * z(predictive_raw)`

Expanded:

`predictive_component_score = 100 + 15 * ((predictive_raw - league_mean_predictive_raw) / league_stddev_predictive_raw)`

Edge case:

- if league standard deviation is `0`, the predictive component score is `100`

## Why Additional Component Fields Were Not Added To The Core Predictive Formula

Verified available on `2026-04-05`:

- `goalie_rating`
- `danger_rating`
- `special_rating`
- `discipline_rating`

All 32 teams had non-null values for these fields on the latest snapshot.

However, the live snapshot test showed that adding a simple extra context blend such as:

`0.8 * opponent_power_score + 0.1 * goalie_rating + 0.1 * danger_rating`

barely changed the league ordering versus pure average opponent Power Score.

That means promoting those fields into the core predictive formula right now would:

- add complexity
- increase double-counting risk
- not clearly improve signal quality on the live snapshot

Conclusion:

- keep the predictive core centered on current snapshot opponent Power Score
- evaluate optional context separately in task `2.4`

## Live Snapshot Check

Using the proposed predictive formula on `2026-04-05`:

- league mean predictive raw score: `103.91909902832961`
- league stddev predictive raw score: `0.5498102717303986`

Sample top predictive-component teams after normalization:

- `SJS 126.55`
- `PHI 120.99`
- `NJD 119.41`
- `NYR 119.02`
- `CBJ 116.68`

Sample bottom predictive-component teams after normalization:

- `EDM 82.71`
- `VAN 82.20`
- `VGK 78.57`
- `CGY 73.52`
- `COL 56.44`

Comparison check:

- a trial blend of `0.8 power + 0.1 goalie + 0.1 danger` produced very similar ordering and spread
- that supports keeping the core predictive formula simple

## Verified vs Inferred

Verified:

- `team_power_ratings_daily` is current through `2026-04-05`
- `computeTeamPowerScore()` is the actual landing-page ranking formula
- all 32 teams have non-null `goalie_rating`, `danger_rating`, `special_rating`, and `discipline_rating` on the latest snapshot
- the proposed predictive formula produces a usable spread on the live snapshot
- a tested additive context blend did not materially improve separation

Inferred / implementation choice:

- using current snapshot opponent ratings rather than ratings as-of-game-date is a design choice made to match the landing page’s snapshot model
- using only opponent Power Score for the predictive core is a simplicity/consistency decision, not a stored database formula

## Recommendation Carried Forward

For later implementation:

- make the predictive half of final `SoS` exactly the normalized weighted mean of current snapshot opponent Power Scores
- keep optional adjustments out of the core until task `2.4` confirms they are worth including
