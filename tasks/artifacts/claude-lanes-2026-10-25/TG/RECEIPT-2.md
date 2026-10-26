# TG S07 — shared run-store contract test kit (offline)

2026-10-25, Claude TG lane, `octoberBranch`. This is a local, uncommitted candidate for the orchestrator to commit. No Git use, server, live database, model or provider call. It builds on S06 ([RECEIPT.md](RECEIPT.md)), and the S06 files are unchanged.

## What it is

`describeRunStoreContract(name, createStore)` is one shared suite. It checks behaviour only through the `ExperimentRunStore` interface, and projections against the S06 `runProgressSchema`. It runs against the memory reference store today. A future durable adapter gets registered with a fresh, isolated, synthetic-only instance per test and must pass the same tests. It must throw `RunnerError` codes when it rejects something.

The suite has 8 contract tests:

1. **Acceptance:** idempotent acceptance per owner, with replay. A changed plan under the same key gives `idempotency_conflict`, and an invalid plan gives `invalid_plan`. The store reports its own storage mode.
2. **Owner scoping:** another owner gets `run_not_found` from progress, claim, cancel, results and reveal. `list` is owner-scoped.
3. **Listing:** newest first, strict projections, capped at `MAX_LISTED_RUNS` (tested with 51 runs).
4. **Leases:** a live lease blocks a second claim. Expiry re-fences the lease and the stale worker's finish returns `stale`. Each output is accepted once: a resend returns `already_accepted`, and a different payload gives `output_conflict`.
5. **Pending outcomes:** they are allowed only in evaluation, and they never count as completed coverage.
6. **Sealing:** results stay sealed through completion and before `notBefore`. The synthetic reveal at `notBefore` opens them, and the revealed outputs are exact.
7. **Real history:** `reconstructed_history_diagnostic` and `original_snapshot` runs never reveal from a date plus completion alone.
8. **Cancellation:** a cancel under a live lease leads to `cancelled_at_checkpoint`. Late finishes then return `stale`, there are no further claims, and coverage is not inflated.

There are no route, UI, page, API or schema changes, and no new export seams were needed.

## Files (new, next to `runStore.ts`, inside the TG namespace)

| Path | SHA-256 | Bytes |
|---|---|---|
| `web/lib/forge-testing-grounds/runStoreContract.ts` | `eb8eb68070b620ae570d9b27d729f2aa3cb082cb2df9fb367b73e2795160ceed` | 8997 |
| `web/lib/forge-testing-grounds/runStoreContract.test.ts` | `085624d5ba3689fd01e0ad270c911b8e60d0c1c2315d3cd50f206e2d9c383898` | 365 |

The S06 files are unchanged (`runStore.ts` `f23da1c6…`, `memoryRunStore.ts` `60fcfb59…`, `runnerContracts.ts` `cf0ee8c3…`, `ownerRoutes.test.ts` `c739b74b…`). The other leased files are untouched.

## Checks actually run

All checks ran from `web/`, under `/private/tmp/fhfh-heavy.lock`. The lock was taken with `mkdir` (never stolen) and released after each run. `GIT_DIR` was not set.

- `npm test -- --run lib/forge-testing-grounds`: **154/154 passed in 9 files**. That is the 146 earlier tests plus the 8 new contract tests, which passed on the first run.
- Scoped tsc, `npx --no-install tsc --noEmit --project ../tasks/artifacts/claude-lanes-2026-10-25/TG/tsconfig.json`: **passed**.
- Whole-project tsc, `NODE_OPTIONS=--max-old-space-size=8192 npx --no-install tsc --noEmit`: **passed, exit 0, no errors**.
- `npx --no-install eslint` on the 2 new files: **passed**.
- Not run: browser, build or E2E (no UI or route changes).

## Gates unchanged

- No durable adapter, database or schema exists yet. The kit is only the bar a future adapter must clear.
- No runner activation, owner config, env or auth claims.
- No statistical or model work.
