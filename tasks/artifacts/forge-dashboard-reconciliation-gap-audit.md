# FORGE Dashboard Reconciliation Gap Audit

## Status

- `red`

## Goal

Identify where source-to-UI reconciliation for the audited FORGE components is:

- manual
- missing
- duplicated
- too weak to justify `green`

## Stronger Existing Areas

### Mocked UI Contract Coverage

- page tests confirm that many rendered labels, links, and degraded-state messages appear when mocked payloads have expected shapes
- helper/unit tests cover:
  - ranking math
  - team-context math
  - ownership helper behavior
  - normalization shape assumptions

These are useful, but they are not enough on their own to prove live reconciliation.

## Main Reconciliation Gaps

### 1. Live Source Freshness Versus Rendered Date

Repeated manual audit pattern:

- compare source-table max dates
- compare API payload effective dates
- compare rendered route/component labels

This had to be done manually for:

- slate / goalie
- team context
- sustainability
- trend movement
- route family

Gap:

- there is no unified automated check that says “this route rendered data from multiple effective dates and mislabeled the result as current”

### 2. Ownership Overlay Reconciliation

Repeated manual audit pattern:

- compare dashboard player rows
- compare Yahoo ownership trend/snapshot responses
- inspect whether null ownership removed rows silently

Gap:

- there is no automated reconciliation proving that ownership filtering is removing players for the right reason rather than due to season mismatch, truncation, or broken joins

### 3. Route Continuity Reconciliation

Repeated manual audit pattern:

- inspect card hrefs
- compare clicked destination route semantics
- inspect whether date/mode/context survived

Gap:

- current tests mostly prove that links exist, not that the destination preserves the originating contract

### 4. Derived Dashboard-Owned Interpretation Layers

The current audit repeatedly found routes/components whose displayed values are one interpretation layer removed from the source API:

- trend-movement composite scores
- player-detail add score versus dashboard week-mode scoring
- sustainability confidence labels versus raw `luck_pressure`

Gap:

- these interpretive layers do not currently have end-to-end reconciliation tests proving that the displayed explanation still matches the intended underlying metric scale

## Duplication Problem

Several reconciliation steps are now duplicated across audit artifacts:

- source max-date inspection
- date-context mismatch reasoning
- route click/context reasoning
- ownership overlay mismatch reasoning

That duplication is useful for audit evidence, but it is a sign that the repo still lacks reusable reconciliation tooling for the audited chains.

## Overall Assessment

Reconciliation maturity is `red`.

Why:

- the current audit could only reach trustworthy verdicts by doing repeated manual live checks
- existing automated tests are stronger at mocked rendering than at proving live-source integrity
- route-family and ownership-overlay reconciliation are especially under-automated

## Required Follow-Ups

- add reusable source-date versus rendered-date reconciliation checks
- add ownership-overlay reconciliation checks that distinguish true empty bands from null/truncated ownership failures
- add route-continuity checks for preserving selected date and mode across drill-ins
- add explicit tests for dashboard-owned interpretation layers whose displayed labels or scores can drift from raw source meaning
