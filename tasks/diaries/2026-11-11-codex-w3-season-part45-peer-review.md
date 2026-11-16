# W3 season forecasts part 4–5 peer review

- Scope: Independent offline peer review of Fable audit commit `8d95393baa`, especially TS/Python parity, goalie pace/outcomes, missing targets, aggregate intervals and settlement scores. No source edits or production/provider operations.
- Where: Canonical `/Users/tim/Code/fhfhockey.com`, current checkout; report will live in `tasks/artifacts/calculation-inventory-2026-11-10/master/W1-Astra-PR/`.
- Start: Read repository instructions and recorded existing dirty/untracked work; preserving it all. Initial HEAD `ef9fc5f547fb99d6aef920e1fdb586c91c73ac4c`.
- Next: Read named audit, packets and upstream Astra review, then run bounded offline fixtures.
- Blockers: None.

## Offline evidence checkpoint
- Actual TS helpers and AST-extracted Python helpers passed targeted synthetic assertions. No application/service imports for Python and network transports blocked.
- Confirmed v5 aggregate POINTS band changes on no-override publication: [297.65548,303.30645] becomes [296.58092,304.15847]. The "v5 unaffected" exemption is false at the final reader.
- Confirmed both languages scale two 0.5 goalie win means to total 1.2 at pace 1.2. Missing rate/target fallbacks become zero; Poisson fallback variance is double-context-scaled.
- Settlement confirms the zero-rewarding score, false [0,0] coverage for null endpoints, clipped rather than unbounded log-loss input, and current-view allocation mismatch.
- Next: qualify findings and write distinct peer review. No production or provider calls; no source edits.

## Completed
- Review saved at `master/W1-Astra-PR/w3-season-part45-crosscheck.md` beneath the calculation-inventory artifact directory, with CJS/Python fixtures and JSON results alongside it.
- All final synthetic assertions passed, including Python missing-variance multiplication and advanced-assist overlay mismatch. Source hashes, JSON, relative links and whitespace verified. Reviewed implementation remains identical to `8d95393baa`.
- No source edits, production/provider requests, application builds, commits or pushes. Existing unrelated work preserved.
- Next: Parent integrates the review into the audit/fix-plan handoff. No blocker or pending permission for this completed review.
