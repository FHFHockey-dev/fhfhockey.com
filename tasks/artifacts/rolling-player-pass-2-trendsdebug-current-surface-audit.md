# Rolling Player Pass-2 `trendsDebug.tsx` Current Surface Audit

## Purpose

This artifact documents the current implementation of [trendsDebug.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trendsDebug.tsx) for task `4.1`.

It separates:

- what is still sustainability-sandbox-specific
- what is reusable for the pass-2 validation console
- what is missing relative to the PRD-defined debug-console scope

This is a current-state audit only. It does not yet implement the redesigned validation console.

## Current Product Role

The current page is still a sustainability-model workbench with light rolling-data hydration, not a rolling-metrics validation console.

Evidence from the current page:

- the `<title>` is `Trends Debug | Sustainability Workbench`
- the hero copy says the page exists to inspect how the sustainability model turns rolling values into:
  - probabilities
  - score / flags
  - projections
  - explanation bullets
- the right-hand results column is dominated by:
  - predicted state
  - sustainability score
  - count projection bands
  - FO% projection bands
  - feature-driver explanations

## Current Data Flow

### Actual data the page loads from Supabase

The page does load real data, but only a very narrow snapshot:

- player search from `players`
- one latest `strength_state = "all"` row from `rolling_player_game_metrics`
- one latest row from `wgo_skater_stats_totals`

Current data-loading functions:

- `searchPlayersByName(...)`
- `fetchLatestPlayerSnapshot(...)`

Current page data shape:

- `PlayerDebugSnapshot`
  - one player id
  - one player name / position
  - one `gameDate`
  - a narrow metric pick list
  - faceoff totals-derived helpers

Current data-query limitations:

- no season selector
- no strength selector
- no team selector
- no row-history fetch
- no multi-row validation payload
- no source-row fetches from WGO, NST, PP builder, or line builder
- no recomputed comparison payload
- no diagnostics payload

### Current compatibility behavior

The page already uses [rollingPlayerMetricCompatibility.ts](/Users/tim/Code/fhfhockey.com/web/lib/rollingPlayerMetricCompatibility.ts):

- `canonicalOrLegacyFinite(...)`

This is one genuinely reusable part of the current implementation because the pass-2 validation console will still need to show canonical-versus-legacy compatibility drift.

## Sustainability-Sandbox-Specific Surface

These parts are specific to the current sustainability workbench and should not be the primary experience of the pass-2 validation console.

### 1. Demo model and derived scoring pipeline

Current imports:

- `trainSustainabilityProbabilityModel(...)`
- `predictSustainabilityProbabilities(...)`
- `buildSustainabilityScore(...)`
- `derivePerformanceFlags(...)`
- `extractFeatureImportance(...)`
- `generateExplanationText(...)`
- `generateExplanationBullets(...)`

Current page-specific state:

- `shotsPer60`
- `ixgPer60`
- `ppToiPct`
- `usageDelta`
- `pdo`
- `recentDelta`
- `recentZScore`

Why this is sandbox-specific:

- these are model inputs, not audit selectors
- the page uses rolling data mainly to seed manual model sliders and numeric inputs
- the sustainability model is not part of the pass-2 validation contract

### 2. Manual projection controls and opponent inputs

Current page-specific state:

- `projectionMetric`
- `ratePer60`
- `foWinPct`
- `foAttemptsPerGame`
- `oppXgaPer60`
- `oppCaPer60`
- `oppHdcaPer60`
- `oppSvPct`
- `oppPkTier`
- `oppGamesPlayed`

Current outputs:

- projected per-game count
- 5-game and 10-game projection bands
- FO% projection bands
- opponent defense score

Why this is sandbox-specific:

- these controls exist to explore projection behavior
- they do not inspect stored metric formulas, source rows, freshness, window membership, or reconstruction

### 3. Sustainability-first summary cards

Current headline cards:

- `Predicted State`
- `Sustainability Score`
- `Per-Game {projectionMetric}`
- `FO Win %`

Current secondary cards:

- `Score Components`
- `{projectionMetric} Projection Bands`
- `FO% Projection Bands`
- `Feature Drivers`

Why this is sandbox-specific:

- they prioritize downstream model output over audit evidence
- none of these cards answer the pass-2 questions:
  - what was stored
  - what source rows were used
  - what formula was intended
  - what recomputed value was produced
  - whether the two match

### 4. Explanation-oriented narrative output

Current explanation surfaces:

- `Feature Drivers`
- explanation bullets
- explanation text generated from model feature importances

Why this is sandbox-specific:

- it explains the sustainability model, not the rolling pipeline
- pass-2 requires formula panels, source-precedence visibility, and diff panels instead

## Reusable Surface

These parts can be carried forward into the validation console with limited or moderate refactoring.

### 1. Player search and selection shell

Reusable pieces:

- `searchPlayersByName(...)`
- player suggestion list
- selected-player state
- selected-player banner

Why reusable:

- the validation console still needs a player-first workflow
- the existing search UX is already wired to real Supabase player rows

Required refactor:

- this selection flow must expand to include:
  - season
  - strength
  - optional team
  - date range
  - specific row selection

### 2. Basic latest-snapshot hydration pattern

Reusable idea:

- load one player snapshot and seed the page from real data instead of static mock values

Why reusable:

- the validation console still needs a first load path keyed by selected player

Required refactor:

- replace the current narrow `fetchLatestPlayerSnapshot(...)` query with a server-side validation payload that returns:
  - stored rolling rows
  - recomputed rows
  - source rows
  - diagnostics
  - formula metadata
  - fallback / precedence traces

### 3. Canonical-versus-legacy field fallback helper

Reusable piece:

- `canonicalOrLegacyFinite(...)`

Why reusable:

- pass-2 explicitly requires comparison between canonical and legacy aliases
- the validation console will still need compatibility-aware rendering in some panels

Required refactor:

- this helper should become one of several display strategies rather than the page’s dominant data model
- the page must show both values explicitly when they differ, not silently collapse one into the other everywhere

### 4. Card-and-panel layout shell

Reusable pieces:

- high-level two-column layout
- panel framing
- section grouping
- summary-card visual treatment

Why reusable:

- the page already has an internal-debug presentation pattern with panel structure that can host a richer audit console

Required refactor:

- the existing layout should be repurposed for:
  - selectors
  - freshness banner
  - source-input panels
  - formula panels
  - diff panels
  - diagnostics panels
- the current sustainability-specific cards should not remain the default top-level summary

## Partially Reusable But Needs Reframing

### 1. `Live Player Snapshot` card

Current behavior:

- shows player, position, latest rolling date, and one baseline metric

Why partially reusable:

- the validation console still needs a top-level identity / selected-row summary

Why it needs reframing:

- it currently summarizes one latest all-strength row only
- it does not show:
  - selected strength
  - selected row key
  - freshness state
  - validation status
  - stored-vs-recomputed outcome

### 2. `Optional Snapshot Fields` card

Current behavior:

- shows a handful of optional rolling fields
- includes PP context as raw JSON

Why partially reusable:

- it proves the page can show extra rolling fields from the stored row

Why it needs reframing:

- the field selection is arbitrary and model-driven
- PP context is rendered as a JSON blob instead of a validation panel
- there is no formula or source context attached to the displayed values

### 3. `Raw Snapshot` card

Current behavior:

- prints JSON blobs for the current model probabilities, flags, and selected rolling snapshot fields

Why partially reusable:

- raw payload inspection is useful on a debug page

Why it needs reframing:

- the current raw JSON is model-centric
- the pass-2 page needs raw inspection for:
  - stored row
  - recomputed row
  - source rows
  - diagnostics summaries
  - source precedence / fallback traces

## Missing Relative to the Pass-2 PRD

The current page is missing nearly every first-class pass-2 console requirement.

### Required selectors that do not exist yet

- strength selector
- season selector
- optional team selector
- game/date range selector
- row selector
- metric-family filter
- metric selector
- canonical-versus-legacy toggle
- mismatch-only toggle
- stale-only toggle
- support-columns toggle

### Required data surfaces that do not exist yet

- stored row history
- recomputed row payload
- WGO source rows
- NST count / rate / on-ice source rows
- PP builder rows
- line builder rows
- freshness summaries
- coverage summaries
- derived-window completeness summaries
- suspicious-output summaries
- source precedence / fallback traces
- TOI trust traces

### Required panels that do not exist yet

- freshness banner
- stored value panel
- formula panel
- source-input panel
- rolling-window membership panel
- availability denominator panel
- numerator / denominator panel
- source precedence / fallback panel
- TOI trust panel
- PP context panel
- line context panel
- diagnostics panel
- stored-vs-reconstructed diff panel

### Required audit helpers that do not exist yet

- copy formula-ledger entry
- copy validation comparison block
- copy refresh prerequisites for selected metric family
- mismatch classification helper output

## Current Implementation Risks

### 1. The current route shape biases the page toward false confidence

Why:

- it fetches only the latest `strength_state = "all"` row
- it does not fetch freshness or recompute status
- it does not show whether the selected row is comparison-ready

Risk:

- a user could inspect a clean-looking snapshot without knowing whether the relevant source families or target row are stale

### 2. The page silently collapses canonical and legacy values

Why:

- it uses `canonicalOrLegacyFinite(...)` as the display path for most metrics

Risk:

- compatibility drift becomes harder to notice
- the page optimizes for “show a value” rather than “show whether the contract surfaces agree”

### 3. The page turns rolling metrics into model features instead of validation evidence

Why:

- rolling metrics are immediately normalized into:
  - shots per 60
  - ixG per 60
  - PP share
  - usage delta
  - PDO
- then consumed by the sustainability model

Risk:

- the user sees downstream interpretations rather than the raw audit objects
- it becomes difficult to validate whether a rolling value itself is trustworthy

## Pass-2 Reuse Recommendation

### Keep

- player search pattern
- debug-oriented panel shell
- compatibility helper usage, but only where explicitly helpful
- raw-inspection mindset

### Rework heavily

- snapshot fetch path
- selected-player hydration effect
- summary-card layer
- optional snapshot display
- raw JSON display

### Move out of the primary surface

- sustainability demo model
- manual model sliders
- projection controls
- opponent context controls
- projection band cards
- feature-driver explanations

## Implementation Takeaway

`trendsDebug.tsx` should not be incrementally tweaked as if it were already close to the pass-2 target.

The current page contains a small reusable shell:

- player selection
- debug layout scaffolding
- compatibility-aware field reading

But the primary product role, data path, and output panels are still sustainability-sandbox-specific.

The pass-2 implementation should treat this as:

- preserve the useful shell
- replace the data contract
- replace the primary summary layer
- replace the majority of the right-column output surface with validation-console panels
