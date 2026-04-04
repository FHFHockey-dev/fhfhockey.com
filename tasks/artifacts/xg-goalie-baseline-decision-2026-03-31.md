# Goalie Baseline Decision

Date: `2026-03-31`
Task: `8.3`

## Decision

- goalie-facing modeling should `reuse skater-shot baseline`

## Meaning

The first goalie-facing xGA-style work should use the eventual approved skater-shot xG baseline as its shot-value engine.

This means:

- no separate first-pass goalie baseline will be approved ahead of the skater-shot baseline
- goalie-facing work should inherit the same underlying shot-value contract once the skater-shot baseline is repaired and approved
- goalie-specific adjustments remain a later layer, not a separate first-pass modeling track

## Why

- the skater-shot shot-value layer should be the canonical public-data foundation first
- this avoids duplicated baseline-model work while the skater-shot contract is still being stabilized
- it preserves one coherent shot-value methodology across shooting and goalie-facing downstream uses

## Boundary

This does not mean goalie-specific follow-up work disappears.

It means:

- first establish the approved skater-shot baseline
- then evaluate goalie-facing additions such as dedicated calibration, rebound-control context, handedness interactions, and goalie workload refinements on top of that shared baseline
