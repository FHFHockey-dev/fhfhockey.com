# Rolling Player Metrics Pass-2 Execution Checklist

This checklist translates the pass-2 PRD into an execution artifact for the audit itself. It is not the final audit output. It exists to make sure the audit leaves behind all required artifacts and does not blur the boundary between the strict formula ledger, the actionable backlog, the main audit writeup, the freshness/runbook content, and the `trendsDebug.tsx` validation-console work.

## 1. Audit Artifact Gates

- [x] The main audit artifact includes these sections in order:
  - `Upstream Tables`
  - `Metric Families`
  - `Column-by-Column Inventory`
  - `WORKING`
  - `BROKEN`
  - `ALMOST`
  - `NEEDS REVIEW`
  - `Explanation / Rationale`
  - `Live Validation Examples`
  - `Actionable Findings Backlog`
  - `Freshness and Recompute Runbook`
  - `trendsDebug.tsx Optimization Plan`
  - `Schema Change Recommendations`
  - `Suggested Metric Additions`
  - `Remediation Plan`
- [x] The main audit artifact keeps status inventories separate from rationale, schema recommendations, suggested additions, runbook content, and action backlog summaries.
- [x] The main audit artifact includes field-level and family-level coverage for the full `rolling_player_game_metrics` row surface.

## 2. Formula Ledger Gates

- [x] `tasks/rpm-audit-notes-pass-2.md` exists.
- [x] Every audited metric has exactly one status/formula entry in the formula ledger.
- [x] Each entry contains only:
  - emoji status
  - metric name
  - formula line
- [x] The formula ledger contains no rationale.
- [x] The formula ledger contains no action items.
- [x] The formula ledger contains no freshness notes, dependency notes, or validation prose.

## 3. Action Backlog Gates

- [x] `tasks/rpm-audit-action-items-pass-2.md` exists.
- [x] Every concrete improvement opportunity discovered during the audit is captured in the action backlog when required by the PRD decision rule.
- [x] Every backlog entry includes:
  - title
  - category
  - priority
  - affected metric(s) or field(s)
  - affected file(s)
  - problem summary
  - recommended action
  - expected benefit
  - blocker status
  - source of discovery
  - status
- [x] Backlog items remain separate from the strict formula ledger.
- [x] The main audit artifact summarizes the highest-value backlog items in its `Actionable Findings Backlog` section.

## 3A. Artifact Boundary Gates

- [x] The current state of the two standalone audit outputs is checked against `/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-artifact-boundary-check.md`.
- [x] `tasks/rpm-audit-notes-pass-2.md` contains only formula-ledger entries and no implementation guidance.
- [x] `tasks/rpm-audit-action-items-pass-2.md` contains implementation-oriented findings and no formula-ledger-only filler entries.
- [x] Any newly discovered correctness, naming, fallback, observability, recompute-friction, performance, compatibility, test, or optional-enhancement finding is written to the backlog file instead of the formula ledger.

## 4. Validation Evidence Gates

- [x] The audit defines and uses a player validation matrix that includes:
  - healthy full-season skater
  - injured or missed-games skater
  - traded or multi-team skater
  - heavy-PP skater
  - line-context validation skater
  - TOI / fallback validation skater
- [x] Live validation examples include source rows used, intended formula, actual code path, stored value, reconstructed value, match result, and mismatch cause bucket.
- [x] Validation never treats stale source data or stale `rolling_player_game_metrics` rows as correctness evidence.

## 5. Freshness and Runbook Gates

- [x] The runbook documents every relevant source table and refresh dependency.
- [x] The runbook documents every known refresh endpoint or operational command available from the current environment.
- [x] The runbook includes recommended refresh order.
- [x] The runbook includes metric-family-specific refresh prerequisites.
- [x] The runbook includes stale-tail and dependency-chain blocker rules.
- [x] The runbook defines what freshness status `trendsDebug.tsx` must expose.

## 6. `trendsDebug.tsx` Validation Console Gates

- [x] The `trendsDebug.tsx` work is explicitly scoped as a validation console, not just a stats or sustainability page.
- [x] Required selectors are defined:
  - player
  - strength
  - season
  - optional team
  - game/date range
  - row selector
  - metric family
  - metric
  - canonical/legacy toggle
  - mismatch-only toggle
  - stale-only toggle
  - support-columns toggle
- [x] Required panels are defined:
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
- [x] Required copy helpers are defined for formula-ledger entries, validation snippets, and refresh prerequisites.

## 7. Completion Gates

- [x] The audit leaves behind both:
  - `tasks/rpm-audit-notes-pass-2.md`
  - `tasks/rpm-audit-action-items-pass-2.md`
- [x] The remediation plan explicitly says the action-items backlog becomes the source for implementation sequencing after the audit.
- [x] The final audit confirms that each audited metric produced the appropriate outputs:
  - formula/status ledger entry
  - rationale/validation entry where needed
  - action backlog entry when a concrete next action was required
