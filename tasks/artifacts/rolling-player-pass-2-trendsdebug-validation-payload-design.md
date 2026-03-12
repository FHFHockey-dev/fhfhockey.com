# Rolling Player Pass-2 `trendsDebug.tsx` Validation Payload Design

## Purpose

This artifact defines the server-side validation payload contract required by pass-2 task `4.2`.

It is the bridge between:

- the rolling recompute pipeline
- the helper / contract modules
- the diagnostics suite
- the `trendsDebug.tsx` validation-console UI

The goal is to replace the current narrow latest-row fetch with one payload that is sufficient for:

- stored-vs-recomputed comparison
- source-row inspection
- formula display
- rolling-window membership inspection
- freshness and blocker labeling
- copyable audit helpers

## Design Goals

- One payload should power the page without browser-side rolling recomputation.
- The payload must be keyed by validation selectors rather than hardcoded to latest all-strength row.
- The payload must surface both:
  - row-level evidence for the selected row
  - enough history to inspect windows, freshness, and drift
- The payload must preserve canonical-versus-legacy visibility instead of collapsing everything into one displayed value.
- The payload must expose contract metadata, not just raw fields.

## Proposed Surface

Primary route:

- [rolling-player-metrics.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/debug/rolling-player-metrics.ts)

Primary consumer:

- [trendsDebug.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trendsDebug.tsx)

Suggested transport:

- `GET` for shareable deterministic inspection links
- optional `POST` later if request size or selector complexity grows

## Request Contract

### Query parameters

- `playerId`
  - required
  - number
- `season`
  - required
  - number
- `strength`
  - optional
  - one of: `all`, `ev`, `pp`, `pk`
  - default: `all`
- `teamId`
  - optional
  - used for traded-player inspection and targeted context lookup
- `gameDate`
  - optional
  - identifies the focused row
- `gameId`
  - optional
  - preferred when known because it disambiguates same-date edge cases
- `startDate`
  - optional
  - limits row history and source pulls
- `endDate`
  - optional
  - limits row history and source pulls
- `metric`
  - optional
  - focuses formula, support, and diff panels on one metric
- `metricFamily`
  - optional
  - focuses family-scoped panels and summaries
- `includeStoredRows`
  - optional boolean
  - default: `true`
- `includeRecomputedRows`
  - optional boolean
  - default: `true`
- `includeSourceRows`
  - optional boolean
  - default: `true`
- `includeDiagnostics`
  - optional boolean
  - default: `true`
- `includeWindowMembership`
  - optional boolean
  - default: `true`
- `includeContractMetadata`
  - optional boolean
  - default: `true`

### Selection rules

- If `gameId` is provided, it should select the focused row directly.
- If `gameDate` is provided without `gameId`, the payload should focus the latest row for that date and selected strength.
- If neither is provided, the payload should focus the latest available row for the selected strength.
- If `metric` is omitted, the payload should still return row-level data and family metadata for general inspection.
- If `metricFamily` is omitted, the payload should derive it from `metric` when possible.

## Response Contract

```ts
type RollingPlayerMetricsValidationPayload = {
  generatedAt: string;
  request: ValidationRequestEcho;
  selected: SelectedContext;
  readiness: ValidationReadiness;
  stored: StoredRowsPayload | null;
  recomputed: RecomputedRowsPayload | null;
  sourceRows: SourceRowsPayload | null;
  diagnostics: DiagnosticsPayload | null;
  contracts: ContractMetadataPayload | null;
  formulas: FormulaMetadataPayload | null;
  windows: WindowMembershipPayload | null;
  comparisons: ComparisonPayload | null;
  helpers: CopyHelperPayload | null;
};
```

## Top-Level Sections

### 1. `request`

Echo the normalized request so the UI can display the exact scope under inspection.

```ts
type ValidationRequestEcho = {
  playerId: number;
  season: number;
  strength: "all" | "ev" | "pp" | "pk";
  teamId: number | null;
  gameId: number | null;
  gameDate: string | null;
  startDate: string | null;
  endDate: string | null;
  metric: string | null;
  metricFamily: string | null;
};
```

### 2. `selected`

UI-friendly selected-row context.

```ts
type SelectedContext = {
  player: {
    id: number;
    fullName: string;
    position: string | null;
  };
  focusedRow: {
    rowKey: string;
    gameId: number | null;
    gameDate: string;
    strength: "all" | "ev" | "pp" | "pk";
    season: number;
    teamId: number | null;
  } | null;
  metric: {
    key: string | null;
    family: string | null;
    canonicalField: string | null;
    legacyFields: string[];
    supportFields: string[];
  };
};
```

### 3. `readiness`

Single summary used by the page’s freshness banner and blocker badge.

```ts
type ValidationReadiness = {
  status: "READY" | "READY_WITH_CAUTIONS" | "BLOCKED";
  blockerReasons: string[];
  cautionReasons: string[];
  nextRecommendedAction: string | null;
};
```

This section should be derived from:

- source-tail freshness
- coverage gaps
- derived-window completeness
- suspicious-output summary
- target-row freshness
- recompute success or failure state

### 4. `stored`

Stored-row history and focused stored row.

```ts
type StoredRowsPayload = {
  focusedRow: Record<string, unknown> | null;
  rowHistory: Array<Record<string, unknown>>;
  canonicalMetricValues: Record<string, number | string | null>;
  legacyMetricValues: Record<string, number | string | null>;
  supportFieldValues: Record<string, number | string | null>;
};
```

Requirements:

- `rowHistory` should cover at least the selected strength and date range
- `focusedRow` should preserve the full row object for raw inspection
- canonical, legacy, and support maps should be broken out for UI convenience

### 5. `recomputed`

Recomputed rolling rows produced server-side through the validation path.

```ts
type RecomputedRowsPayload = {
  focusedRow: Record<string, unknown> | null;
  rowHistory: Array<Record<string, unknown>>;
  diagnosticsGenerated: boolean;
  sourceTracking: {
    additiveSources?: Record<string, unknown>;
    toiSources?: Record<string, unknown>;
    toiTrustTiers?: Record<string, unknown>;
    toiFallbackSeeds?: Record<string, unknown>;
    rateReconstructions?: Record<string, unknown>;
    ixgPer60Sources?: Record<string, unknown>;
  } | null;
  recomputeMeta: {
    status: "SUCCESS" | "FAILED" | "PARTIAL";
    phase: string | null;
    error: string | null;
  };
};
```

Requirements:

- if the recompute path fails, the payload must still return the failure metadata rather than silently omitting recomputed rows
- the UI needs this to distinguish stale target from recompute blockage

### 6. `sourceRows`

All upstream source rows needed for source-input panels and reconstruction.

```ts
type SourceRowsPayload = {
  wgo: Array<Record<string, unknown>>;
  counts: Array<Record<string, unknown>>;
  rates: Array<Record<string, unknown>>;
  countsOi: Array<Record<string, unknown>>;
  powerPlay: Array<Record<string, unknown>>;
  lineCombinations: Array<Record<string, unknown>>;
  games: Array<Record<string, unknown>>;
};
```

Requirements:

- rows should already be narrowed to the selected player / range
- `games` should include the team-game ledger slice needed for availability panels
- `powerPlay` and `lineCombinations` should include the focused game even if no row exists, via empty arrays rather than omission

### 7. `diagnostics`

Direct output of the diagnostics helpers plus a few UI-ready derived summaries.

```ts
type DiagnosticsPayload = {
  coverage: {
    allStrengths: unknown | null;
    selectedStrength: unknown | null;
  };
  sourceTailFreshness: {
    allStrengths: unknown | null;
    selectedStrength: unknown | null;
  };
  derivedWindowCompleteness: {
    selectedStrength: unknown | null;
  };
  suspiciousOutputs: {
    selectedStrength: {
      issueCount: number;
      warnings: string[];
    } | null;
  };
  targetFreshness: {
    latestStoredRowDate: string | null;
    latestWgoDate: string | null;
    targetFreshnessOk: boolean;
  };
};
```

Requirements:

- do not compress these into a single status string only
- the UI needs raw diagnostics summaries for panel display and copy helpers

### 8. `contracts`

Helper-contract metadata used to explain the selected metric.

```ts
type ContractMetadataPayload = {
  windowContract: {
    family: string | null;
    selectionUnit: string | null;
    aggregationMethod: string | null;
    missingNumeratorPolicy: string | null;
    missingDenominatorPolicy: string | null;
  } | null;
  availabilityContract: unknown | null;
  ppShareContract: unknown | null;
  ppUnitContract: unknown | null;
  lineContextContract: unknown | null;
  toiContract: unknown | null;
  sourceSelectionContract: unknown | null;
};
```

Requirements:

- this should be normalized for UI use rather than dumping module internals verbatim
- the payload should explain contract semantics in page-ready language

### 9. `formulas`

Focused metric formula metadata and family-level formula catalog.

```ts
type FormulaMetadataPayload = {
  selectedMetric: {
    key: string | null;
    family: string | null;
    intendedMeaning: string | null;
    canonicalFormula: string | null;
    sourceTables: string[];
    sourceFields: string[];
    codePaths: string[];
    scaleContract: string | null;
  } | null;
  familyFormulas: Array<{
    metric: string;
    formula: string;
  }>;
};
```

Requirements:

- `selectedMetric` should always be present when `metric` is provided
- `familyFormulas` helps the UI render metric-family tables and copy helpers

### 10. `windows`

Exact rolling-window membership and denominator support for the focused row.

```ts
type WindowMembershipPayload = {
  focusedRowKey: string | null;
  appearanceWindows: Record<
    "last3" | "last5" | "last10" | "last20",
    Array<{
      rowKey: string;
      gameId: number | null;
      gameDate: string;
      included: boolean;
      selectedSlot: boolean;
      numeratorPresent: boolean | null;
      denominatorPresent: boolean | null;
      excludedReason: string | null;
    }>
  >;
  availabilityWindows: Record<
    "last3" | "last5" | "last10" | "last20",
    Array<{
      gameId: number | null;
      gameDate: string;
      teamId: number | null;
      playerAppeared: boolean;
      countsTowardDenominator: boolean;
    }>
  >;
};
```

Requirements:

- this section is mandatory for the rolling-window membership panel
- ratio and weighted-rate metrics need `numeratorPresent` and `denominatorPresent`
- availability panels need team-game ledger membership

### 11. `comparisons`

Focused stored-versus-recomputed diff bundle.

```ts
type ComparisonPayload = {
  selectedMetric: {
    metric: string | null;
    storedValue: number | string | null;
    recomputedValue: number | string | null;
    absoluteDiff: number | null;
    signedDiff: number | null;
    percentDiff: number | null;
    valuesMatch: boolean | null;
    mismatchCauseBucket:
      | "stale source"
      | "stale target"
      | "logic defect"
      | "schema-contract issue"
      | "source-gap issue"
      | "fallback-side effect"
      | "unit/scale mismatch"
      | "unresolved verification blocker"
      | null;
  } | null;
  canonicalVsLegacy: Array<{
    field: string;
    canonicalValue: number | string | null;
    legacyValue: number | string | null;
    valuesMatch: boolean;
  }>;
  supportComparisons: Array<{
    field: string;
    storedValue: number | string | null;
    recomputedValue: number | string | null;
    valuesMatch: boolean;
  }>;
};
```

Requirements:

- this section drives the diff panel
- `canonicalVsLegacy` should be separate from selected metric diff because alias drift is a first-class audit concern

### 12. `helpers`

Page-ready copy helpers.

```ts
type CopyHelperPayload = {
  formulaLedgerEntry: string | null;
  validationComparisonBlock: string | null;
  refreshPrerequisitesBlock: string | null;
};
```

Requirements:

- `formulaLedgerEntry` must match the exact `rpm-audit-notes-pass-2.md` format
- `validationComparisonBlock` should be suitable for the main audit rationale section

## Source-Trace Requirements by Contract

### TOI trace

The payload must expose, at minimum:

- chosen TOI source
- trust tier
- rejected candidate sources
- fallback seed source
- WGO normalization mode
- suspicious-value rejection notes

This should come from the recompute path, not from client-side inference.

### Additive source precedence trace

The payload must expose, at minimum:

- counts-row value
- WGO fallback value
- chosen source per relevant additive metric

This matters for:

- goals
- assists
- shots
- hits
- blocks
- points
- PP points
- ixG-derived families

### PP-share source trace

The payload must expose, at minimum:

- per-game `player_pp_toi`
- per-game inferred `team_pp_toi`
- denominator source:
  - builder
  - WGO fallback
  - missing
- mixed-source window flag

### Line-context trace

The payload must expose, at minimum:

- source row present or absent
- trusted assignment boolean
- raw builder arrays for the focused game

## Minimal UI Mapping

### Controls enabled by this payload

- player selector
- season selector
- strength selector
- optional team selector
- date-range selector
- row selector
- metric-family selector
- metric selector
- canonical-versus-legacy toggle
- mismatch-only toggle
- stale-only toggle
- support-columns toggle

### Panels enabled by this payload

- freshness banner
  - from `readiness` and `diagnostics`
- stored value panel
  - from `stored`
- formula panel
  - from `formulas` and `contracts`
- source-input panel
  - from `sourceRows`
- rolling-window membership panel
  - from `windows`
- availability denominator panel
  - from `windows.availabilityWindows`
- numerator / denominator component panel
  - from `stored.supportFieldValues`, `comparisons.supportComparisons`, and `sourceRows`
- source precedence / fallback panel
  - from `recomputed.sourceTracking`
- TOI trust panel
  - from `recomputed.sourceTracking` and `contracts.toiContract`
- PP context panel
  - from `sourceRows.powerPlay`, `stored.focusedRow`, `recomputed.focusedRow`
- line context panel
  - from `sourceRows.lineCombinations`, `stored.focusedRow`, `recomputed.focusedRow`
- diagnostics panel
  - from `diagnostics`
- stored-vs-reconstructed diff panel
  - from `comparisons`

## Implementation Notes for `4.3`

- Prefer a server-side helper that the route calls, rather than writing the full query/recompute logic inline in the API handler.
- The helper should reuse:
  - `recomputePlayerRowsForValidation(...)`
  - the diagnostics helpers
  - the existing field inventory / formula metadata artifacts as implementation guidance
- The route should not mutate production data.
- Recompute for validation must run in read-only comparison mode.
- If recompute fails, the payload should still return:
  - stored rows
  - source rows
  - diagnostics
  - recompute failure metadata

## Non-Goals of the Payload

- It should not expose every possible rolling row in the league.
- It should not re-implement projections or sustainability scoring.
- It should not silently hide legacy aliases.
- It should not depend on browser-side joins across Supabase tables.

## Design Takeaway

The payload should be treated as the authoritative pass-2 validation contract for `trendsDebug.tsx`.

If the route returns this shape, the page can become:

- a real validation console
- a trustworthy source-inspection surface
- a direct producer of audit-ready notes and comparison snippets

without moving rolling logic into the browser.
