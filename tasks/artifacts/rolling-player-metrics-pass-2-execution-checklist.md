# Rolling Player Metrics Pass-2 Execution Checklist

This checklist translates the pass-2 PRD into an execution artifact for the audit itself. It is not the final audit output. It exists to make sure the audit leaves behind all required artifacts and does not blur the boundary between the strict formula ledger, the actionable backlog, the main audit writeup, the freshness/runbook content, and the `trendsDebug.tsx` validation-console work.

## 1. Audit Artifact Gates

- [ ] The main audit artifact includes these sections in order:
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
- [ ] The main audit artifact keeps status inventories separate from rationale, schema recommendations, suggested additions, runbook content, and action backlog summaries.
- [ ] The main audit artifact includes field-level and family-level coverage for the full `rolling_player_game_metrics` row surface.

## 2. Formula Ledger Gates

- [ ] `tasks/rpm-audit-notes-pass-2.md` exists.
- [ ] Every audited metric has exactly one status/formula entry in the formula ledger.
- [ ] Each entry contains only:
  - emoji status
  - metric name
  - formula line
- [ ] The formula ledger contains no rationale.
- [ ] The formula ledger contains no action items.
- [ ] The formula ledger contains no freshness notes, dependency notes, or validation prose.

## 3. Action Backlog Gates

- [ ] `tasks/rpm-audit-action-items-pass-2.md` exists.
- [ ] Every concrete improvement opportunity discovered during the audit is captured in the action backlog when required by the PRD decision rule.
- [ ] Every backlog entry includes:
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
- [ ] Backlog items remain separate from the strict formula ledger.
- [ ] The main audit artifact summarizes the highest-value backlog items in its `Actionable Findings Backlog` section.

## 4. Validation Evidence Gates

- [ ] The audit defines and uses a player validation matrix that includes:
  - healthy full-season skater
  - injured or missed-games skater
  - traded or multi-team skater
  - heavy-PP skater
  - line-context validation skater
  - TOI / fallback validation skater
- [ ] Live validation examples include source rows used, intended formula, actual code path, stored value, reconstructed value, match result, and mismatch cause bucket.
- [ ] Validation never treats stale source data or stale `rolling_player_game_metrics` rows as correctness evidence.

## 5. Freshness and Runbook Gates

- [ ] The runbook documents every relevant source table and refresh dependency.
- [ ] The runbook documents every known refresh endpoint or operational command available from the current environment.
- [ ] The runbook includes recommended refresh order.
- [ ] The runbook includes metric-family-specific refresh prerequisites.
- [ ] The runbook includes stale-tail and dependency-chain blocker rules.
- [ ] The runbook defines what freshness status `trendsDebug.tsx` must expose.

## 6. `trendsDebug.tsx` Validation Console Gates

- [ ] The `trendsDebug.tsx` work is explicitly scoped as a validation console, not just a stats or sustainability page.
- [ ] Required selectors are defined:
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
- [ ] Required panels are defined:
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
- [ ] Required copy helpers are defined for formula-ledger entries, validation snippets, and refresh prerequisites.

## 7. Completion Gates

- [ ] The audit leaves behind both:
  - `tasks/rpm-audit-notes-pass-2.md`
  - `tasks/rpm-audit-action-items-pass-2.md`
- [ ] The remediation plan explicitly says the action-items backlog becomes the source for implementation sequencing after the audit.
- [ ] The final audit confirms that each audited metric produced the appropriate outputs:
  - formula/status ledger entry
  - rationale/validation entry where needed
  - action backlog entry when a concrete next action was required
