## trendsDebug pass-2 implementation gaps backlog

Sub-task: `4.8`

This artifact records the highest-value debug-surface gaps, payload omissions, and UX blockers still visible after the `4.1` through `4.7` implementation pass.

The concrete backlog items were added to [rpm-audit-action-items-pass-2.md](/Users/tim/Code/fhfhockey.com/tasks/rpm-audit-action-items-pass-2.md). The remaining gaps cluster into three implementation buckets.

### 1. Payload authority gaps

- the validation payload still returns `contracts`, `formulas`, `windows`, and `helpers` as `null`
- `trendsDebug.tsx` currently fills those holes with browser-side formula maps, family heuristics, and client-derived rolling-window membership
- this keeps the page useful, but it means the console is not yet rendering a fully server-authoritative contract surface

### 2. Audit-sweep ergonomics gaps

- the route exposes only one focused-metric diff at a time
- the page can compare a selected metric well, but it still lacks a row-wide or family-wide mismatch matrix for fast sweep audits
- mismatch-only row filtering therefore depends on the currently selected metric instead of a complete per-row diff inventory

### 3. Performance and loading-shape gaps

- the page currently requests stored rows, recomputed rows, source rows, and diagnostics together on every scope change
- the heavy validation payload is correct for full inspection, but it is not yet optimized for lighter metric pivots or family changes
- the legacy sustainability sandbox is still mounted on the same page and continues to consume focused-row state, which adds rendering weight to what should now be a validation-first route

### Result

The phase-4 implementation now meets the PRD’s baseline validation-console requirement, but the follow-up backlog should prioritize:

- moving formula / window / contract authority into the server payload
- adding family-wide mismatch summaries
- reducing overfetch and render weight for repeated audit use
