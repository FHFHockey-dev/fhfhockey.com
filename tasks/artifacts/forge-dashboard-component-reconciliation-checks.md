# FORGE Dashboard Component Reconciliation Checks

## Purpose

This artifact defines the required reconciliation method for each FORGE component family.

The goal is to make every later audit pass answer the same question in a concrete way:

> How do we prove that the UI is showing the data it is supposed to show?

Reconciliation must not stop at “the API returned something.”  
For each component family, the comparison path should be:

1. source tables or authoritative upstream datasets
2. serving API output
3. dashboard normalizer or helper output where applicable
4. rendered UI meaning

## Reconciliation Principles

### 1. Compare Meaning, Not Just Field Names

The audit should compare:

- the intended meaning of the value
- the transformed value used in the UI
- the raw value from the API or source table

This matters because some helpers compute derived labels, rankings, or context from multiple raw fields.

### 2. Use Existing Guards First

The current dashboard already has useful starting points:

- [invariants.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/invariants.ts)
- [normalizers.test.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/normalizers.test.ts)
- [dashboard-endpoints-invariants.test.ts](/Users/tim/Code/fhfhockey.com/web/tests/api/dashboard-endpoints-invariants.test.ts)
- [freshness.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/freshness.ts)
- [perfBudget.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/perfBudget.ts)
- [teamContext.test.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/teamContext.test.ts)
- [topAddsRanking.test.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/topAddsRanking.test.ts)
- [playerOwnership.test.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/playerOwnership.test.ts)

These checks do **not** replace source-to-UI reconciliation, but they define the current contract boundaries.

### 3. Every Reconciliation Should Produce Evidence

Each component-family audit should leave behind:

- the exact API request used
- the exact resolved date or snapshot date used
- the key source tables involved
- the sampled rows or values compared
- whether the result passed, failed, or was inconclusive

### 4. Reconciliation Can Be Manual Or Scripted, But It Must Be Repeatable

If a check cannot be automated yet, the artifact or later audit must still describe:

- what to query
- what to compare
- what counts as a match

## Shared Reconciliation Layers

These layers should be referenced in most component audits.

### Layer A: Source Table To API

Questions:

1. Does the API return rows that can be traced to the expected source tables?
2. Are key filters, resolved dates, snapshot dates, or fallback dates visible?
3. Are missing rows being silently replaced with misleading defaults?

### Layer B: API To Normalizer / Helper

Questions:

1. Does the normalizer preserve the fields the UI needs?
2. Are nulls, ranges, and enums handled safely?
3. Are any fields dropped, coerced, or recomputed in ways that change meaning?

### Layer C: Normalizer / Helper To UI

Questions:

1. Does the UI render the same resolved values and labels implied by the normalized payload?
2. Do derived labels match the helper contract?
3. Does filtering or sorting preserve the intended meaning?

## Component-Family Methods

### 1. Slate Context

Applicable surfaces:

- [SlateStripCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/SlateStripCard.tsx)
- FORGE slate preview in [FORGE.tsx](/Users/tim/Code/fhfhockey.com/web/pages/FORGE.tsx)

Primary comparison path:

1. `games`
2. `player_projections`
3. `goalie_start_projections`
4. `yahoo_nhl_player_map_mat`
5. `yahoo_players`
6. `team_ctpi_daily`
7. `team_power_ratings_daily` / `team_power_ratings_daily__new`
8. `/api/v1/start-chart`
9. `normalizeStartChartResponse(...)`
10. rendered slate tiles / hero

Current automated guardrails:

- `auditStartChartGames(...)` in [invariants.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/invariants.ts)
- start-chart normalization coverage in [normalizers.test.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/normalizers.test.ts)

Required reconciliation method:

1. Call `/api/v1/start-chart?date=YYYY-MM-DD`.
2. Record `dateUsed` and whether it differs from the requested date.
3. Pick at least one visible game row from the UI.
4. Confirm the following match the API payload and, where needed, the source tables:
   - game id
   - home and away team ids
   - top listed home goalie
   - top listed away goalie
   - starter probabilities
   - displayed ownership values if shown
   - home and away rating snippets
5. Confirm that any stale or fallback message shown in the UI matches the API-resolved date behavior.

What counts as a pass:

- visible matchup, goalie, and rating values match the API
- API can be traced back to the expected source tables
- fallback behavior is visible, not silent

### 2. Player Opportunity / Top Adds

Applicable surfaces:

- [TopAddsRail.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TopAddsRail.tsx)
- Top Adds preview in [FORGE.tsx](/Users/tim/Code/fhfhockey.com/web/pages/FORGE.tsx)
- [player/[playerId].tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/player/[playerId].tsx)

Primary comparison path:

1. `forge_runs`
2. `forge_player_projections`
3. `seasons`
4. `rosters`
5. `yahoo_players`
6. `/api/v1/forge/players`
7. `/api/v1/transactions/ownership-trends`
8. `/api/v1/transactions/ownership-snapshots`
9. `playerOwnership.ts`
10. `topAddsRanking.ts`
11. rendered Top Adds cards and player-detail opportunity surface

Current automated guardrails:

- ranking contract in [topAddsRanking.test.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/topAddsRanking.test.ts)
- ownership merge contract in [playerOwnership.test.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/playerOwnership.test.ts)

Required reconciliation method:

1. Call `/api/v1/forge/players?date=YYYY-MM-DD&horizon=N`.
2. Call `/api/v1/transactions/ownership-trends?window=5&...`.
3. If needed, call `/api/v1/transactions/ownership-snapshots?playerIds=...`.
4. Select a small visible Top Adds sample from the UI.
5. For each sampled player, verify:
   - player id and name
   - ownership band inclusion or exclusion
   - displayed ownership %
   - displayed 5-day delta
   - projection-derived stats shown on the card
   - rank order relative to neighboring cards
6. Recompute the ranking using `scoreTopAddsCandidate(...)` or `rankTopAddsCandidates(...)` inputs from the same API values.
7. Confirm the UI order matches the ranking helper output.
8. In week mode, confirm schedule labels and schedule-driven ordering use the intended helper output rather than arbitrary UI ordering.

What counts as a pass:

- displayed players match the filtered source inputs
- displayed ownership context matches Yahoo-derived inputs
- displayed rank order matches the ranking helper
- no silent inclusion of out-of-band ownership rows

### 3. Team Context

Applicable surfaces:

- [TeamPowerCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TeamPowerCard.tsx)
- [team/[teamId].tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/team/[teamId].tsx)

Primary comparison path:

1. `team_power_ratings_daily` / `team_power_ratings_daily__new`
2. `team_ctpi_daily` or fallback CTPI sources
3. Start Chart game slate data
4. `/api/team-ratings`
5. `/api/v1/trends/team-ctpi`
6. `/api/v1/start-chart`
7. `normalizeTeamRatings(...)`
8. `normalizeCtpiResponse(...)`
9. `normalizeStartChartResponse(...)`
10. `teamContext.ts`
11. rendered Team Trend Context and team-detail route

Current automated guardrails:

- `auditTeamRatings(...)` and `auditCtpiRows(...)` in [invariants.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/invariants.ts)
- helper contract checks in [teamContext.test.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/teamContext.test.ts)

Required reconciliation method:

1. Call `/api/team-ratings?date=YYYY-MM-DD`.
2. Call `/api/v1/trends/team-ctpi`.
3. Call `/api/v1/start-chart?date=YYYY-MM-DD`.
4. Choose at least one visible team from the dashboard and, if applicable, the team detail page.
5. Verify:
   - displayed power-related numbers come from the team-ratings response
   - CTPI score and delta come from CTPI data
   - matchup edge matches `buildSlateMatchupEdgeMap(...)`
   - any variance or warning language matches the actual rating row values
6. If values are derived, recompute them through `computeTeamPowerScore(...)` and `computeCtpiDelta(...)`.
7. Confirm team clicks and drill-ins preserve the same team identity and context.

What counts as a pass:

- displayed team numbers and labels align with the three source APIs
- helper-derived fields match recomputation
- mixed-source states are visible and not silently flattened

### 4. Sustainability

Applicable surfaces:

- [SustainabilityCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/SustainabilityCard.tsx)
- sustainability preview in [FORGE.tsx](/Users/tim/Code/fhfhockey.com/web/pages/FORGE.tsx)

Primary comparison path:

1. `sustainability_scores`
2. `player_baselines`
3. `yahoo_players`
4. `/api/v1/sustainability/trends`
5. ownership APIs where applicable
6. `normalizeSustainabilityResponse(...)`
7. `playerInsightContext.ts`
8. rendered sustainability cards

Current automated guardrails:

- `auditSustainabilityRows(...)` in [invariants.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/invariants.ts)
- sustainability normalization checks in [normalizers.test.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/normalizers.test.ts)

Required reconciliation method:

1. Call `/api/v1/sustainability/trends` with the exact date, window, direction, and position used by the UI.
2. Record `snapshot_date` and note whether it differs from the requested date.
3. Sample visible rows from both:
   - Sustainable Risers
   - Unsustainable Heaters
4. Verify:
   - player identity
   - `s_100`
   - `luck_pressure`
   - key z-signal drivers
   - ownership-band inclusion or exclusion if ownership filters are active
   - trust / overheated explanation language
5. If the UI derives explanation text from helpers, confirm the rendered label matches `describeSustainabilityBand(...)`, `describePlayerSignalFrame(...)`, and `resolveInsightTone(...)`.

What counts as a pass:

- displayed sustainability meaning matches the API rows and helper-derived labels
- snapshot fallback is visible when used
- ownership filtering does not change the underlying signal meaning

### 5. Trend Movement

Applicable surfaces:

- [HotColdCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/HotColdCard.tsx)

Primary comparison path:

1. `player_trend_metrics`
2. `players`
3. `yahoo_players`
4. `/api/v1/trends/skater-power`
5. ownership APIs where applicable
6. `normalizeSkaterTrendResponse(...)`
7. `playerInsightContext.ts`
8. rendered Hot / Cold and Trending Up / Down UI

Current automated guardrails:

- shape/invariant coverage in dashboard endpoint tests for skater-power-fed surfaces
- helper-language reuse from `playerInsightContext.ts`

Required reconciliation method:

1. Call `/api/v1/trends/skater-power` with the same filters used by the UI.
2. Sample visible rows from:
   - Hot
   - Cold
   - Trending Up
   - Trending Down
3. Verify:
   - player identity
   - current score / rank order
   - movement-related explanation text
   - team and position labels
   - ownership-band inclusion or exclusion if active
4. Confirm that the active tab is using the intended category logic and not reusing sustainability semantics.
5. If sparklines or trend-band labels are displayed, compare them to the normalized series used by the card.

What counts as a pass:

- rank order matches the skater-power response after normalization
- labels describe movement, not sustainability
- ownership filtering and tab semantics are applied consistently

### 6. Goalie Risk

Applicable surfaces:

- [GoalieRiskCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/GoalieRiskCard.tsx)

Primary comparison path:

1. `forge_runs`
2. `forge_goalie_projections`
3. `forge_projection_calibration_daily`
4. `games`
5. `/api/v1/forge/goalies`
6. `normalizeGoalieResponse(...)`
7. rendered goalie spotlight cards and lower table

Current automated guardrails:

- `auditGoalieRows(...)` in [invariants.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/invariants.ts)
- goalie normalization checks in [normalizers.test.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/normalizers.test.ts)

Required reconciliation method:

1. Call `/api/v1/forge/goalies?date=YYYY-MM-DD`.
2. Record the resolved run and as-of date if present.
3. Sample visible spotlight and table rows.
4. Verify:
   - goalie identity
   - starter probability
   - win and shutout probabilities
   - recommendation
   - confidence / volatility / risk labels
   - starter-selection driver text
5. Confirm label derivation from normalized fields rather than freehand UI interpretation.

What counts as a pass:

- displayed probabilities and labels match the normalized goalie payload
- no-goalie or no-games states are clearly represented
- resolved-date behavior is visible if fallback occurs

### 7. Route Family

Applicable surfaces:

- [FORGE.tsx](/Users/tim/Code/fhfhockey.com/web/pages/FORGE.tsx)
- [team/[teamId].tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/team/[teamId].tsx)
- [player/[playerId].tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/player/[playerId].tsx)

Primary comparison path:

1. originating dashboard component contract
2. route-specific API calls
3. route-specific helper transforms
4. rendered preview or drill-in semantics

Required reconciliation method:

1. Start from a known dashboard card or preview card.
2. Follow the route it links to.
3. Verify that the destination uses compatible data and meaning.
4. Confirm preview cards do not tell a materially different story than the full route.
5. Confirm drill-ins preserve:
   - player identity
   - team identity
   - active date context
   - semantic purpose of the originating card

What counts as a pass:

- preview and drill-in routes stay semantically aligned with the dashboard surfaces that link to them
- route-level fallback and stale behavior are not hiding contract drift

## Current Automated Check Coverage By Family

### Already Present

1. Start Chart normalization and start-chart invariant checks
2. Team ratings invariant checks
3. Sustainability normalization and invariant checks
4. Goalie normalization and probability-bound checks
5. Team context helper checks
6. Top Adds ranking helper checks
7. Yahoo ownership helper checks

### Still Likely Manual Or Weak

1. full source-table-to-API reconciliation for each family
2. mixed-cadence drift checks for Team Trend Context
3. preview-versus-dashboard drift checks for `FORGE.tsx`
4. destination-semantics checks for team/player drill-ins
5. explicit UI sampling against live payloads for Top Adds and Hot/Cold tabs

These should default to `yellow` or `red` if they cannot be performed credibly.

## Evidence Output For Each Reconciliation Run

Each later audit should record:

1. `component family`
2. `rendered surface`
3. `request parameters`
4. `resolved date or snapshot`
5. `source tables checked`
6. `API fields compared`
7. `helper or normalizer fields compared`
8. `UI fields compared`
9. `result`
   - `pass`
   - `fail`
   - `inconclusive`
10. `notes`

## Failure Interpretation Rules

Use these distinctions consistently:

1. `source failure`
   - the authoritative tables are stale, missing, or inconsistent
2. `API contract failure`
   - the API returns the wrong data or hides necessary context
3. `normalizer/helper failure`
   - the transformation layer changes meaning incorrectly
4. `UI rendering failure`
   - the right data is available but the rendered component shows it incorrectly
5. `route semantics failure`
   - preview or drill-in behavior changes the meaning promised by the source card

## Minimum Reconciliation Standard For Green

A component family cannot be `green` unless:

1. at least one representative live reconciliation path has been executed or clearly demonstrated
2. the required comparison path is explicit
3. the likely failure layer can be isolated if something is wrong
4. the result is reproducible by a junior developer
