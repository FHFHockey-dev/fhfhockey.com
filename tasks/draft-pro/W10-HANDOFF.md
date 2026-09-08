# W10 handoff

Commits: `926009b57`, `008ee0456`, `cd36f1ac3`, `d7e54dc48`, plus the final correction reported in the task message (and required W09 helper `05b53678b`, cherry-picked from `aa11de9de`)

Implemented deterministic analytical reports in `web/lib/draft-pro/reports.ts`, the owner-scoped reports API, `useDraftProReports`, and `AnalyticalReportsPanel`. Reports contain roster composition, shared raw VORP/projected-point/category totals, reference-based strengths/weaknesses or explicit unavailable state, server-computed schedule state/conflicts, scoring/source configuration, season, freshness, and a stable source fingerprint. No LLM, grades, probabilities, or mock-draft output is generated.

The POST contract is:

```ts
{
  reportType: "draft_summary" | "scenario_comparison",
  draftId?: string | null,
  privateImportDraftId?: string | null, // current context with account-saved private imports
  scenarioId?: string | null,
  input: ReportInput,
  snapshot?: DraftProSnapshot, // required for current-draft reports only
}
```

W07 should build `ReportInput` from the current dashboard or selected saved-draft restore context. It includes `roster`, `categoryWeights`, `leagueType`, `season`, canonical `source`, merged skater/goalie numeric `scoring`, exact serialized `sourceWeights`, and optional paired `referenceRoster`/`referenceBasis` from an actual completed comparison team. For a current draft, also pass `serializeSavedDraft(getBrowserSnapshot())` as `snapshot`; the server validates completion. If that current context uses unchanged account-saved private imports, pass their owning draft as `privateImportDraftId` while leaving `draftId` empty. For a saved draft, send the capture with `draftId`; the API reads the owned snapshot and requires an exact selected-team roster (including keepers), scoring/category/source match, without requiring completion. A saved `scenarioId` uses its owned stored input and derives its draft. Never send client-computed results, freshness/conflicts, or fingerprints.

Mount `AnalyticalReportsPanel` from W07 with:

```tsx
<AnalyticalReportsPanel
  eligible={canUseProReports}
  input={currentCompletedReportInput}
  snapshot={currentSerializedSnapshot}
  privateImportDraftId={currentSavedImportDraftId}
  draftId={openedSavedDraftId}
  scenarioId={openedScenarioId}
/>
```

`input` should be `null` until required projection/source context is available. The panel owns independent names/action lifecycle and context invalidation. Print opens an isolated, escaped report-only document. Inactive users still receive names-only GET summaries; report payload GET is capability-protected.

Verification: focused reports API, hook lifecycle, rendered panel/print, and calculation tests plus `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` (see final task message for exact command/count).

Dependency: cherry-picked W09 helper `aa11de9de` (shared roster DUST evaluation and analysis-reference validation).
