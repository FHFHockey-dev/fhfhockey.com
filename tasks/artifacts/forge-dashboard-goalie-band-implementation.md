# Forge Dashboard Goalie Band Implementation

## Purpose

Turn the lower goalie band into a real fantasy decision surface instead of a thin projection table.

## What Changed

- Expanded the dashboard goalie normalizer to preserve:
  - `modeled_save_pct`
  - `confidence_tier`
  - `quality_tier`
  - `reliability_tier`
  - `recommendation`
  - starter-selection driver context from the uncertainty payload
- Rebuilt the goalie band around two layers:
  - lead spotlight cards for first-glance goalie decisions
  - a compact table for the broader pool

## Spotlight Card Contract

Each lead goalie card now shows:

- goalie name
- matchup opponent
- starter-risk label
- confidence tier
- volatility label
- model recommendation
- starter probability
- win probability
- shutout probability
- modeled save percentage
- starter-confidence driver badges such as recency, L10 starts, back-to-back pressure, and opponent context

## Why

- The old table had the numbers, but not the reasons.
- The dashboard PRD calls for starter probability, risk/volatility, confidence drivers, and matchup context.
- Spotlight cards make the goalie band feel like part of the command surface instead of a leftover table module.

## Structural Rule

- The goalie band stays decision-first.
- Only the lead goalies get the richer explanatory footprint.
- The lower table remains compact so the section does not become another full-page module.
