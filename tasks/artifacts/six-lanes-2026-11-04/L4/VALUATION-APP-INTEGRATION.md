# L4 — installed projected league-points component

2026-11-04. Branch `octoberBranch`, HEAD `5f6b4e7a3a893000fe31cc6928cd8736b56e5d39`. Chef reviewed original decision receipts and artifact adapter, then granted exactly `web/lib/tradeValue/valuationComponents.ts` and `valuationComponents.test.ts`. Both were absent, with no matching register/targeted L1 claim at the immediate pre-write check. No Git mutation by L4. Observation trio hashes still match `APP-MANIFEST.json` after this implementation.

## Actual behavior

`leagueValuationComponents` reuses the existing `scoreBoardStats` arithmetic and four-decimal rounding to expose one projected league-points component. It has no production caller. Combined trade value, VOR, season actuals/rank, ADP and the suggestion guard return unavailable reasons; no weights, replacement definition, normalizations or guard thresholds were invented. No observation/card/provider/roster/UI wiring was added.

The adapter requires typed outputs from the existing admitted-consumer → contribution-resolution → `buildGameExpectations` path at the decision cutoff. It does not authenticate that origin. A caller-supplied response, matching timestamp, source ID or allowed-use flag cannot prove admission; real upstream consumer admission/freshness remains mandatory. There are no fetches, database operations, new receipts or attempts to re-admit cached evidence.

Numerical projected-points gates:

- Nonblank league-profile ID/version and explicit points-scoring basis; nonzero finite scoring weights. Category utility and absent scoring remain unavailable. No silent default scoring.
- Finite decision cutoff equal to admitted-view read time; next-5/10/20 horizon only.
- Exactly one selected player with NHL identity, full requested-game coverage, unique game IDs, valid strictly future scheduled times.
- Every nonzero scored target has complete finite aggregate/game values, consistent non-null units and full coverage counts. The aggregate equals the sum of per-game unconditional expectations.
- Every scored game target explicitly has `basis: unconditional_game`, allowed totals and comparison use, and a nonempty source ID list. Conditional or unknown basis is withheld, including a conditional zero.
- Valid ordered cutoff/issue clocks, issue no later than decision cutoff, and expiry strictly after cutoff. Missing or unqualified inputs withhold, while a known qualified zero remains available.

No calibrated uncertainty or counterparty acceptance is produced. Future callers still must bind league season/identity and scoring-profile version to the actual request and use genuine admission output. The league-profile ID itself is not a validated scoring contract. No such caller exists in this slice.

## Verification

Passed under atomically acquired shared `/private/tmp/fhfh-heavy.lock`, released only by its L4 owner afterward:

- `npm test -- --run lib/tradeValue/valuationComponents.test.ts`: 9/9 Vitest cases, including unconditional-vs-conditional basis, invalid/past/cutoff-equal schedule times, valid zero, two league scoring profiles, missing view/target, denied uses, expiry, partial horizon, stale cutoff, inconsistent totals and unsupported scoring. Synthetic allowed-use inputs assert no real admission. Node emitted only the existing `punycode` deprecation warning.
- Targeted ESLint on both new files: exit 0, no output.
- Focused TypeScript program using parsed, unchanged `web/tsconfig.json` options (actual target **ES2015**, bundler resolution and app aliases), rooted at both new files plus existing `next-bootstrap.d.ts` and `yahoo-fantasy.d.ts`: **0 diagnostics**, exit 0. It checked their import graph; this is not a full-app typecheck. No permissive ES2022 override.
- Reviewed the installed source delta against the approved artifact: only app imports/documentation and the two requested qualification gates differ. No trailing whitespace found in either new file. Frozen observation trio hashes unchanged.

No full suite, build, browser, live provider/data/production, schema or collection operation occurred. One bounded implementation, no correction needed. Actual command outputs including the exact compiler invocation are in `VALUATION-APP-CHECKS.json`; `VALUATION-APP.patch` records the full two-file addition against absent baselines; `VALUATION-APP-MANIFEST.json` pins exact SHA-256s and current HEAD.

## Handoff

The primary PLAN §7 decision gap is closed by `DECISION-RECEIPTS.json`; the broader pipeline remains incomplete. Chef can review the two uncommitted application additions for the local candidate. Chef selected chronological development comparisons against VOR-only/actuals-only/projected-points baselines; the earlier method question is closed. Keep combined trade value and suggestions unavailable until qualified data, an accepted normalization/weight experiment specification and validation exist. This method choice does not authorize reserved-data runs or new app scope. Stop at this granted slice.
