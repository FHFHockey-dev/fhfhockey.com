# BLSH provenance timing re-review

Disposition: **P2 resolved in the isolated precision-fix-01 candidate. No new actionable finding.** This closes the prior timing defect; it does not accept real NST evidence or approve score computation/application installation.

Reviewed candidate: `/Users/tim/Documents/Codex/2026-10-27/task-3/current-process-provenance-gate-20261101-01/precision-fix-01/candidate/currentProcessEvidence.server.ts`, SHA-256 `28bd6807e0ab103af6065c1bf5f6731320035d633b6f6ac359ff51c4f8a7d4f8`. Reviewed tests SHA-256 `7ec79313bb997b98ca62561c62177daae7cf3cff2e5b2f564fb21ccb628232f7`.

The exact parser and duration conversion at lines 51–95 retain integer microseconds, require explicit offsets and valid calendar components, reject unsupported precision and unknown -00:00, and normalize offsets independently of process timezone. The request comparison and evidence/freshness checks use these exact values. Availability output preserves the sixth fractional digit where needed. Legacy raw age metadata remains unchanged; provenance admission independently enforces exact timing.

Independent checks actually run:

- All 45 candidate tests pass under UTC; the 30 timing tests pass again under America/New_York. These cover equality, explicit offsets, the repeated DST hour, invalid dates/times/offsets, unsupported fractional precision and nonintegral microsecond duration budgets.
- Reused the original independent synthetic fixture and six probes, changing their expectation from reproduction to rejection. Future native receipt, future official frame, observation before completion, evaluation before source request, future feed capture and capture age beyond its budget now all fail closed at **1µs**. The six 1ms controls also reject. Both timezones produce identical 12-probe records and zero unexpected admissions. See `TIMING-UTC.json`, `TIMING-America-New_York.json`, and `timing-probes.cjs`.
- Strict TypeScript compilation passes; independently compiled gate and qualifier are byte-identical to producer `compiled-02`. Positive fixtures remain explicitly fictional. All returned probe results retain null score, false trusted and false productionAdopted.
- 86 source, original/fixed packet and audit-copy pins authenticated before and after checks. The qualifier hash remains `58a87ea119a98b33d7d67fb6849a269e375c22210610b607dfa30ba034c76232`; captured request remains `c6d1d13dc7327baa54742c3eb7efe0a1e5d96c6ef6ffefc66de23f4092c12ba2`. Ten shared preview/scoring pins and the original gate packet are unchanged.

The fixed real closed-policy replay was inspected and authenticated, not executed again. Its source/runtime lineage is supported by the independently identical compiled output. Its JSON differs from the prior replay only in evaluation time: 8,135 rows, 3,461 selected records, 740 profiles, 20 zero-shot profiles, 7,855 raw production-complete/280 incomplete, zero individual/on-ice admissions and zero scores. The 700/702 Crotty discrepancy, Deslauriers captured 445 seconds and captured Dvorak/Dubois faceoffs remain unchanged. This does not resolve the separate official 445/444 exposure hold. Retained lint evidence was authenticated; lint was not independently rerun.

Remaining gates: actual native NST receipts and exact native-cell/scope/conversion/model review; trusted server acceptance registration; coordinator ownership/installation of the two proposed paths; any later scoring, application or release approval. The real acceptance policy remains empty. Neither proposed source path is installed. No source/held-file edits, production/provider/DB requests, holdout reads, builds or deployments were performed. Own tests and artifacts only; all owned locks/processes ended.

The separately reviewed Game Score missingness preview is documented in `missingness/REVIEW.md`.
