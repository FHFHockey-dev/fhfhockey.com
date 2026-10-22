# P05 ownership boundary — local review handoff

Implemented the reserved route/client slice only. Independent review is pending; this is not release or whole-P05 acceptance. Canonical `octoberBranch`; tested HEAD `d3f057c6c849d5d5474bc912a6f461f617c65b15`. During packaging HEAD advanced to `716896be8325a64f5cbd3ece9a1fdab48c50733f` through unrelated admin/route-runner work. The committed difference touches none of the packet or retained dependency files; all fixed bytes still match the tested snapshot. This worker made no commits and did not edit or operate ingestion/runner code or processes.

## Exact application inventory

- `web/pages/api/v1/transactions/ownership-snapshots.ts`: strict 0–100/plain-decimal parsing; each result carries the date of its own latest valid timeline value. Undated percent fallback stays undated. Invalid newer points cannot refresh an older observation's date. Unresolved NHL IDs no longer become Yahoo IDs, conflicting direct/name matches remain unknown, and input is deduplicated/capped at 500 valid NHL IDs. Fixed-range database reads require exact row-count completeness, failing rather than silently accepting truncation.
- `web/lib/dashboard/playerOwnership.ts`: carries `ownershipEvidence` (value, observedOn, provider, freshness status) through context/trend results. Only valid, nonfuture observations at most three days old remain numeric current `ownership`; older values remain dated evidence. Uses per-player dates rather than response/fetch time, does not attach an older trend delta to a newer snapshot, rejects failed envelopes, and makes duplicate/missing responses unknown. The existing numeric snapshot-map signature is preserved for callers; it returns null for stale/undated observations.
- `web/lib/dashboard/playerOwnership.test.ts`: clocked fresh-zero/stale/undated/future cases, per-player provenance, cache/JSON transport, aging, newer snapshot vs older trend, missing trend value, invalid envelope and duplicate cases.
- `web/__tests__/pages/api/v1/transactions/ownership-trends.test.ts`: extends the existing snapshot-handler tests with malformed/zero ownership, dated timeline values, identity ambiguity/fallback, truncation, input bounds, deduplication and positive 500-player/name-fallback controls. The trends route itself is unchanged.

All four files were clean at P05 start. Existing dirty work was preserved. A5/A10's two accepted hashes remain unchanged, as recorded in `FILE-HASHES.json`. No billing, retention, category, ingestion, schema, dependency, lockfile or shared-register edit occurred. The shared pickup table was not edited.

## Before/after and exact checks

All execution used Node **v22.11.0**, npm **10.9.0**, the queue's sanitized snapshot recipe, synthetic `.invalid` configuration, one Vitest worker and socket/HTTP(S)/fetch denial. No ignored env/credential files were copied. No network, database, NST, provider or paid service call was made.

- Original-source snapshot: `/tmp/fhfh-queue-check-9u5zuqsb/isolation/snapshot/web`.
- Tests-first red snapshot: `/tmp/fhfh-queue-check-a9lzfg32/isolation/snapshot/web`; **18 failed / 19 passed**. Failures reproduce malformed ownership, absent source provenance, stale trend replacement, unresolved/ambiguous identity, silent truncation and uncapped input.
- Final fixed snapshot: `/tmp/fhfh-queue-check-e79jo9g0/isolation/snapshot/web`; **41 passed / 0 failed** (33 route tests, 8 client tests). An earlier 37-case green pass is superseded by this final receipt.
- Final scoped TypeScript and ESLint both exit **0**, no diagnostics. Canonical `git diff --check` also exits **0**. No full suite, full-project type-check, browser, application server or build ran.

The following commands ran from each named snapshot, under the `env -i` wrapper in [VERIFY.md](../claude-audit-fix-queue-2026-10-22/VERIFY.md), with snapshot-local HOME/TMPDIR and the network-denial preload:

```sh
npm test -- --run --config audit.vitest.config.mts __tests__/pages/api/v1/transactions/ownership-trends.test.ts lib/dashboard/playerOwnership.test.ts
npm exec --offline -- eslint --report-unused-disable-directives-severity warn pages/api/v1/transactions/ownership-snapshots.ts lib/dashboard/playerOwnership.ts lib/dashboard/playerOwnership.test.ts __tests__/pages/api/v1/transactions/ownership-trends.test.ts
npm exec --offline -- tsc --noEmit -p audit-p05.tsconfig.json
```

`audit-p05.tsconfig.json` extends the repository config and includes only the four owned files plus existing declaration entrypoints (imports follow normally). A copy is included; place it in a fresh snapshot's `web/` directory to rerun. `p05-red.log`, `p05-green.log`, `p05-lint.log`, and `p05-types.log` preserve results. `candidate.patch` contains only this packet's four-file diff against tested HEAD. `FILE-HASHES.json` records original/fixed hashes, snapshot paths, evidence hashes, retained A5/A10 hashes and the HEAD movement. Verify current packet/retained bytes from repository root:

```sh
shasum -a 256 -c tasks/artifacts/p05-ownership-2026-10-22/SHA256SUMS
git diff --check -- web/pages/api/v1/transactions/ownership-snapshots.ts web/lib/dashboard/playerOwnership.ts web/lib/dashboard/playerOwnership.test.ts web/__tests__/pages/api/v1/transactions/ownership-trends.test.ts
```

## Bounds and remaining custody

The snapshot route has at most 500 distinct input IDs and at most nine sequential database queries: one mapping, one NHL-name lookup, up to five 100-name lookup batches, and requested-season plus optional fallback ownership reads. Every query is capped at 1,000 returned rows and requires exact count equality. The positive 500-player fixture uses two queries. Exact counts can add database work; hosted cost/performance was not measured. The unchanged ownership-trends route still paginates its own broader source population; this packet does not claim a bound for that route's internal work.

The evidence preserves the source's day precision, not an invented observation time. JSON round-trip and subsequent cache/refetch aging are tested. Full persisted RSO restore/revalidation and cross-surface stale labels are outside this lease and are not accepted by these fixtures. Existing consumers can use `ownershipEvidence`, but UI labeling was not changed. No ownership/reclaim probability or new caution threshold was introduced.

**Pending file-custody blocker:** `web/components/PlayerPickupTable/PlayerPickupTable.tsx` still has the analogous coercion. Its edit was **not attempted**, because WORK-PACKETS P05 reserves it with billing until an explicit handoff. The independent route/client work above is complete. No tool action was denied, no tool approval is pending, and no external outcome is uncertain. Parent should coordinate that shared-file continuation and separate RSO saved-state acceptance.

Administrative files: this handoff, hash manifest, checksum list, patch, four log receipts, scoped tsconfig, and `tasks/diaries/2026-10-22-codex-p05-ownership.md`. The diary remains for continuity and is excluded from release candidates.
