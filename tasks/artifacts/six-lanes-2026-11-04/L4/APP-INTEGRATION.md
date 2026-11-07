# L4 installed observation-only v1 — frozen for L5

2026-11-04. Chef granted exactly three new application files after reviewing the corrected offline slice. L1 `CUSTODY-DELTA-02` confirmed absence/no conflicting claims; L4 rechecked directory absence and both registers immediately before exclusive creation. `octoberBranch` HEAD at implementation/verification: `5f6b4e7a3a893000fe31cc6928cd8736b56e5d39`. Chef independently verified worker Sol/medium. No Git mutation by L4.

## Installed contract

- `web/lib/tradeValue/contracts.ts`: `Result`, `Scope`, `EventScope`, `Asset`, `SourceUse`, `Observation`, `Coverage`. Observation/coverage version strings remain `trade-observation-v1` / `trade-coverage-v1`. Every side, unresolved identity, unknown asset and nullable pick field survives. Event identity is explicitly scoped by source/game/season/league. Missing coverage differs from verified empty.
- `web/lib/tradeValue/observationEvidence.ts`: `selectObservationEvidence(rows, { asOf, sample })`. Public Trade Market evidence only; no audience option, private-league authorization, fetch/storage or page/card adapter. Returns available records with sighting/proven-event counts, or unavailable reasons. Duplicate sightings are idempotent, scoped event conflicts are withheld, identical bundles do not imply one event. Input and output records retain references; readonly types do not deep-freeze data.
- `web/lib/tradeValue/observationEvidence.test.ts`: 12 Vitest cases adapted from the reviewed synthetic checks using existing `describe`/`it`/`expect` conventions.

This is the frozen installed interface for L5. Shared application paths outside this trio were not edited. Any consumer requiring another type or behavior must bring that dependency back to Chef rather than mutate this interface concurrently.

## Trusted-input and product limits

This helper accepts typed outputs from a future trusted adapter. It does not parse untrusted provider JSON or authenticate permission, identity mapping, attribution, event scope or source evidence. Nonempty receipt strings/source flags are assertions, not validated proof. A future adapter must verify source-use and event identity before supplying observed records. The helper's `provenEvents` count is conditional on that upstream verification; synthetic tests establish no real trades.

Only observation/coverage types were installed. Numerical valuation and roster-impact types remain in the offline proposal; no scorer, normalization, weights, plausibility guard, legal roster engine, roster consequence calculation or counterparty acceptance model is exported. L5 must retain explicit unavailable states for those capabilities until qualified implementations exist. No bundle-derived scalar market price, real coverage estimate or qualified forecast has been created.

The primary user-message provenance gap for PLAN §7 D1–D4 remains documented in `HANDOFF.md`. This pure observation installation does not apply the reported ADP amendment or authorize collection/storage/schedules. No Supabase, provider, protected-data, production, migration, push, deploy or full build operation occurred.

## Verification and review evidence

All commands ran from `web/` on Node `v22.11.0`, sequentially under an atomically acquired `/private/tmp/fhfh-heavy.lock`; L4 released only its own lock afterward.

```sh
npm test -- --run lib/tradeValue/observationEvidence.test.ts
./node_modules/.bin/eslint lib/tradeValue/contracts.ts lib/tradeValue/observationEvidence.ts lib/tradeValue/observationEvidence.test.ts
./node_modules/.bin/tsc --noEmit --strict --skipLibCheck --target ES2022 --module ESNext --moduleResolution bundler --types node,vitest/globals lib/tradeValue/contracts.ts lib/tradeValue/observationEvidence.ts lib/tradeValue/observationEvidence.test.ts
```

Passed: 12/12 focused Vitest cases, lint with no output/errors, strict isolated TypeScript check including all three files. The test process emitted a Node `punycode` deprecation warning. No implementation correction was needed. No full suite, full app typecheck, browser, production or source-admission check ran. Scoped content inspection found no trailing whitespace; all three new files were inspected after verification.

`APP-CHECKS.json` records actual command outputs/exit codes. `APP.patch` is the full three-file addition against absent baselines, with no staging/index changes. `APP-MANIFEST.json` pins all three SHA-256 hashes and HEAD. Earlier offline receipts remain historical preparation; this receipt supersedes their “no app files installed” status.

## Handoff and stop

Chef may review/install these three uncommitted additions into its candidate and relay the frozen interface to L5. There is no runtime call site yet, so no live product behavior is claimed. L4 stops after this one bounded application implementation and passing narrow checks; broader adapters, valuation, roster consequences and release remain separate work.
