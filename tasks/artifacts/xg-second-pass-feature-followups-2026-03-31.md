# Second-Pass xG Feature Follow-Ups

Date: `2026-03-31`
Task: `8.2`

## Purpose

This document lists the feature work that should happen before a stronger second-pass xG model is attempted.

It separates:

- contract repairs that must happen before any trustworthy rerun
- real feature additions that are worth evaluating once the feature contract is clean

## 1. Mandatory Repair Before Any Stronger Model Attempt

This is not an optional improvement. It must be fixed before the next meaningful baseline comparison.

### Remove direct label leakage from shot-event context

- remove `shotEventType:goal` from the baseline feature set
- more broadly, stop using current-shot event-class information in any way that trivially reveals the label
- reissue the feature contract under a new training artifact version after the leakage fix

Why this comes first:

- the current benchmark and calibration story are contaminated by this feature
- no second-pass feature expansion matters if the training matrix itself is leaking the answer

## 2. High-Priority Second-Pass Feature Additions

These are the first additions worth evaluating after the leakage repair and rerun.

### Richer rebound geometry

- source-shot to current-shot angle change
- source-shot to current-shot lateral displacement
- rebound-shot distance delta relative to the source attempt

Why:

- the current rebound logic is strong enough for flags, but not rich enough for a more expressive shot-quality model

### Possession-chain context

- explicit possession-sequence id
- chain length before the shot
- number of same-team events in the current chain
- offensive-zone entry or regain markers inside the chain

Why:

- current prior-event context is immediate-event based
- a stronger model likely needs short-chain context, not only the single previous event

### Score-state context

- home-goal differential at shot time
- away-goal differential at shot time
- shooter-team score differential bucket
- late-game score-state interaction flags

Why:

- score effects and game state likely matter for shot selection and defensive posture
- this is already called out in the post-foundation queue and is still absent from the first-pass matrix

### Shooter and goalie handedness joins

- shooter handedness
- goalie catching hand
- shooter-hand vs goalie-hand interaction

Why:

- these are plausible public-data joins with real shot-quality signal
- they especially matter once geometry and shot type are already in place

### Roster-position context

- shooter roster position
- defenseman vs forward shot indicator
- optional coarse role bucket if available from stable roster metadata

Why:

- this adds a compact way to capture systematic shot-profile differences without introducing player identity leakage

## 3. Medium-Priority Second-Pass Additions

These should be evaluated only after the high-priority set above is cleanly versioned.

### Deployment and matchup context

- shooter line deployment bucket
- opponent line/pairing matchup bucket
- own-team and opposing-team skater role mix on ice

Why:

- this may help, but it also expands complexity quickly and depends on stable on-ice reconstruction joins

### Stronger shift-fatigue context

- shooter prior-shift recency
- team-average prior workload in the last shift window
- opponent workload pressure window

Why:

- the current shift-age features are useful first-pass proxies
- a second-pass model can test whether more granular fatigue history adds signal beyond current shift age

### Score-effects by game time

- trailing/leading bucket interacted with game-time segment
- pull-the-goalie and late-third score-pressure flags beyond the current empty-net marker

Why:

- score state alone is probably not enough without time context

## 4. Lower-Priority Or Research-Only Additions

These are plausible, but they should not block the first credible second-pass rerun.

### Blocked-shot cohort expansion

- decide whether blocked attempts should become a modeled class, contextual class, or remain excluded

Why:

- this is more a modeling-scope change than a straightforward feature addition

### Goalie-specific context expansion

- rebound-control proxy
- handedness interactions beyond a simple catch-hand join
- goalie workload trend features

Why:

- useful later, but it should follow a stable skater-shot baseline rather than precede it

## 5. Recommended Order

1. repair the leaked `shotEventType:goal` feature contract
2. rerun the current three-family benchmark on the repaired contract
3. if the repaired benchmark is stable enough, evaluate:
   - richer rebound geometry
   - possession-chain context
   - score-state context
   - handedness joins
   - roster-position context
4. version the new feature family as a new training artifact configuration
5. rerun benchmark and calibration again before claiming a stronger second-pass model

## Summary

The most important follow-up is not a new feature. It is repairing the current leaked feature contract.

After that, the most promising second-pass additions are:

- richer rebound geometry
- possession-chain context
- score-state context
- handedness joins
- roster-position context

Those are the additions most worth testing before attempting a stronger second-pass xG model.
