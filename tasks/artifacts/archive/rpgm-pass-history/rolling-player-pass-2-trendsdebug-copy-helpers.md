## trendsDebug pass-2 copy helpers

Sub-task: `4.6`

This step adds direct audit-output copy helpers to [trendsDebug.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trendsDebug.tsx) so the validation console can produce pass-2 artifacts without manual reformatting.

### Implemented helpers

- formula-only audit entry copy
  - output shape matches [rpm-audit-notes-pass-2.md](/Users/tim/Code/fhfhockey.com/tasks/rpm-audit-notes-pass-2.md)
  - uses readiness plus focused-row diff to derive the status emoji
  - includes only emoji, metric name, and formula
- stored-vs-reconstructed comparison block copy
  - captures player, season, strength, focused row, metric, stored value, reconstructed value, diff, and readiness
  - intended for the main audit rationale and validation-example sections
- metric-family refresh prerequisites copy
  - emits the family-specific refresh checklist needed before trusting a comparison
  - uses the selected metric family or inferred family from the focused field

### Supporting implementation details

- added `REFRESH_PREREQUISITES` mapping for all pass-2 metric families
- added `deriveAuditStatusEmoji(...)` helper to keep the formula ledger preview aligned with readiness and diff state
- added `copyText(...)` clipboard helper with transient success/failure feedback
- added a dedicated `Copy Helpers` panel with preview blocks for:
  - formula-only audit entry
  - comparison block
  - refresh prerequisites

### Validation-console impact

- the page now produces a strict formula-ledger entry without pulling rationale into the output
- the page now produces a copy-ready comparison block for the main audit artifact
- the page now produces a copy-ready family refresh checklist for freshness/runbook work
- the copy surface keeps the audit ledger and implementation/rationale content separate, matching the PRD artifact-boundary requirement
