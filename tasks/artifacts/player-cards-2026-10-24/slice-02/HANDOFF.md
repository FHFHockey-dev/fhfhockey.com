# Player cards slice 02 — pure contracts frozen for review

Worker evidence only; Scout retains independent acceptance/integration and product decisions. Exact four-file lease: CODEX-PLAYER-CARDS-S02-20261024, recorded2026-10-24T16:54:13.548386+00:00. S01 source/artifacts and existing static server preserved. No visual-approval wait, new workers, service calls or Library retries.

## Implemented source

- `web/lib/player-cards/windows.ts`: explicit proposed settings validation; unique played appearances with supplied final-game/time/reference proof; complete history through one UTC cutoff; cutoff/season/game type before ownL5/L10/L20; inclusive UTC calendar option; actual GP/game IDs/span; known short season separate from incomplete history; caller-selected allow-short/full-N policy. Zero selected-strength time never removes an official appearance. No implicit final signal, carryover, dates-as-games or live defaults.
- `aggregation.ts`: pooled per60 from count totals and TOIseconds; pooled ratios and ATOI; fractional xG; valid-zero, zero-denominator undefined and missing-component states. Joins exact selected identities rather than independently taking source rows. Rejects duplicate/wrong-season/strength/source-version/time joins, stale/error/null-overwrite records and incompatible TOI units. Metric input gaps stay specific where a row is present but a component is missing.
- `adapter.ts`: typed supplied-local-snapshot boundary only; no fetch/credentials/WiGO/entitlement access. Explicit source/model definition gates, expected all-NHL membership/coverage contract, metric-specific valid/known-undefined/missing/known-short counts, same-definition rank pools and retrospective capture label. Valid player values survive unknown pool coverage, with league rank withheld. Live and premium activation remain false.
- `domain.test.ts`:19 hand-checkable synthetic cases, independent of task artifacts. The artifact-only `verify-local-evidence.cjs` reconciles previously approved captured data against the actual pure source. No production/mock-service transport.

## Checks and evidence

Passed, after final source changes, from `web/`:

1. `npm test -- --run lib/player-cards/domain.test.ts` —19/19 tests, one file. First18/18 also passed before adding same-date ordering coverage; original log retained.
2. `npx tsc --noEmit --project ../tasks/artifacts/player-cards-2026-10-24/slice-02/tsconfig.json` —passed, no shared generated-file write.
3. `npx eslint lib/player-cards/windows.ts lib/player-cards/aggregation.ts lib/player-cards/adapter.ts lib/player-cards/domain.test.ts` —passed.
4. Exact S01 source and artifact pins rechecked unchanged; final receipts in EVIDENCE.json. No S01 test/browser rerun because frozen sources did not change.

Tests cover cutoff before N, season isolation, same-date completion ordering, inclusive calendar boundaries, differing own spans/common cutoff, unknown completion/participation/history, duplicate games, full-N versus known short, zero PP exposure/GP, pooled versus averaged rates/ratios, fractional xG, valid zeros, zero denominators, missing/null/nonfinite/impossible components, source alignment/error states, no hidden GP/TOI filter, metric-specific N, unknown/narrow/incomplete pools and snapshot/identity rejection. S01 frozen tests already cover competition ties, near-equal precision, singleton/empty pools and all ties.

Approved local capture: `tasks/artifacts/wigo-player-card-investigation-2026-10-24/production-diagnostic/query-2-rows.json` (canonical source path and SHA in local-evidence-inspection.json). Artifact command `node tasks/artifacts/player-cards-2026-10-24/slice-02/verify-local-evidence.cjs` verifies four pooled results and two unavailable gates against actual source. Reconciled L5 TOI6313seconds, ATOI1262.6seconds, SOG/60=11.975289086, ixG/60=1.037858387 and iCF/60=19.958815143. This is arithmetic over prior approved rows, not current readiness or league coverage. Current-seasonL10 has the documented Oct5 source gap. The bounded20-row capture has neither full-season history nor final-game proof, and cannot establish that current-seasonL20 is honestly short. Negative tests require unavailable selection for those missing proofs. Production unit tests do not depend on these task artifacts.

No new failed check, denied action or uncertain operation in S02. No whole-app check/build, browser/server request, production/service read/write, source repair/backfill, Git/index operation, install or deployment. No GIT_DIR. Existing Node22.11.0/npm10.9.0.

## Scope and remaining gates

- This completes pure domain and local adapter/unavailable-state slices (task2 and4.2–4.4), not observed source verification4.1 or production activation. Evidence references/verification flags are explicit inputs for a future inspected adapter; their contents are not independently proven by nonempty strings. No real-data-ready or all-NHL-complete claim.
- Source completion/history/model definitions/strength coverage/full all-position population and rights remain unverified. The separate WiGO owner controls upstream fixes; no fixes duplicated here.
- S01 remains at http://127.0.0.1:3125/player-cards, PID54140. It still displays fixed labeled proposedL10 fixture data; S02 does not silently wire domain contracts into the frozen UI.
- Next independent implementation can connect supplied synthetic multi-player/game fixtures to period controls/search/export in a new exact leased component, after parent chooses integration sequencing. Candidate app route remains ungranted. Real public search/shared auth and entitlement boundaries still require reviewed interfaces and exact ownership transfers.
- Product policy proposals and exact free/premium allocation remain undecided; all dependent observed/premium behavior stays disabled. Comparison/export policy is not inferred.
- Library output blocker from S01 remains unchanged. Parent explicitly directed no retry or TLS/security workaround; no Library action attempted in S02.

Sources/patch and dependency/evidence hashes: EVIDENCE.json. Local tasklist progress and root requirement/steer ledger updated; original Library tasklist version remains unmodified remotely. Diary retained for unfinished broader task.
