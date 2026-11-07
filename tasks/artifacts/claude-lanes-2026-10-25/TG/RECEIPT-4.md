# TG ticket 4 — hash-bound manifest read (offline)

2026-10-25, Claude TG lane, `octoberBranch`. Local and uncommitted; the orchestrator commits. No Git use, server, live database, model or provider call. This builds on the released TG 1–3.

## What changed

- **Store interface:** `ExperimentRunStore.manifest(owner, runId)` returns the run's accepted, immutable plan. It holds configuration references only, never outputs or outcomes. In `MemoryExperimentRunStore` it returns the plan frozen at acceptance, with owner scoping.
- **Read adapter:** `createRunStoreReadAdapter` now answers `readOperational("manifest")`, which used to fail closed.
  - It re-parses the store's plan with `parsePlan`, a strict schema check.
  - It requires `contentHash(plan)` to equal that run's own progress `planHash`. A mismatched or unknown-field plan becomes a generic 503 with nothing reflected.
  - Reply: `{ runId, planHash, plan }`.
- **Still fail closed:** health, logs and export.
- **Contract kit:** a new test, "returns the accepted plan as the hash-bound, owner-scoped manifest". The manifest equals the accepted plan before and after completion, it hashes to the progress `planHash`, and another owner gets `run_not_found`. Every future durable adapter must pass this test.
- The routes are still unwired, and there are no UI, page or schema changes.

## Files (under `web/lib/forge-testing-grounds/`)

| Path | SHA-256 | Bytes |
|---|---|---|
| `runStore.ts` | `daee41fe45479b3dcc8a81ee5d259632eb468e8006c0fdc8797e4b43d8aa6085` | 6297 |
| `memoryRunStore.ts` | `4e24d844688164400fb5875341a167e4aec3968040b6ca486a29cd030c8904b1` | 12875 |
| `runStoreContract.testkit.ts` | `cac3f60f0b1000c2d54ecc6f64a21c69eb1b0e7fa70c2f0706a0277129ad340d` | 10459 |
| `ownerRoutes.test.ts` | `a7f80cd3d3fff9fe157b22c08c3086e3e17be5100c7821948aebcb6eb33d1cb6` | 18611 |

No new files. Everything else from TG 1–3 is untouched.

## Checks actually run

All checks ran from `web/`, under `/private/tmp/fhfh-heavy.lock`. The lock was taken with `mkdir` and released afterwards; it was never stolen. `GIT_DIR` was not set.

- `npm test -- --run lib/forge-testing-grounds`: **166/166 passed in 9 files, first run.** That is the 163 earlier tests, plus 1 contract test and 2 poisoned-manifest route tests (a different plan, an unknown field). The S06 route test now expects the bound manifest instead of 503.
- Scoped tsc, `npx --no-install tsc --noEmit --project ../tasks/artifacts/claude-lanes-2026-10-25/TG/tsconfig.json`: **exit 0**.
- Whole-project tsc, `NODE_OPTIONS=--max-old-space-size=8192 npx --no-install tsc --noEmit`: **exit 0, no errors**.
- `npx --no-install eslint` on the 4 touched files: **exit 0**.
- **Not run:** browser, build or E2E (no UI changes).

## Gates unchanged

- No runner, durable store, owner config or env, or auth claims.
- No statistical or model work.
- Reveal stays synthetic-only and is not reachable over HTTP.
