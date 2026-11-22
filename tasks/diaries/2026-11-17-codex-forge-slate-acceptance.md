# FORGE served-snapshot slate acceptance

- Scope: local response counters and focused tests in the existing served-forecast snapshot and ledger builder, on `octoberBranch` at `2493d5e9e`. Chef owns integration.
- Start: the ledger already builds the independent identified pregame player-game universe and persists separate source row counts. Add response-only bridge outcome counts using that universe and the actual supplied bridge row after the existing external-input proof check.
- Next: classify each member once, preserve persistence and math, cover empty slate, re-aims, confirmed zero, unavailable proof and conditional rows. Verify locally with mocked route and pure ledger tests.

- Handoff: `bridgeAcceptance` is emitted from the successful response, including an all-zero shape on an empty slate. Counts use the independent pregame universe and the same supplied bridge row as the ledger. Exact/re-aimed report the existing run-slate-date comparison; absent run date is unavailable in the receipt. Unknown upstream absence and observed proof withholding have separate reasons. Conditional rates and confirmed out are separate categories from usable unconditional lines. Persistence, formulas, and eligibility gates are untouched.
- Verification: 63 tests across ledger and mocked snapshot route passed, targeted ESLint and exact-path `git diff --check` passed. No external actions; Chef owns integration.
