# TG ticket 3 — C7 nit T1 fixed, T2 added, preview saved-run listing (offline)

2026-10-25, Claude TG lane, `octoberBranch`. Local and uncommitted; the orchestrator commits. No Git use, server, live database, model or provider call. This builds on `63654c308` (C7 accepted it in RECEIPT-R20).

## 1. C7 RECEIPT-R20 items

- **T1 (nit), fixed.**
  - The kit is renamed `runStoreContract.ts` → **`runStoreContract.testkit.ts`**, and its header says it is test-only and must not be imported from app code. Vitest's default include doesn't match `*.testkit.ts`, and the only importer is `runStoreContract.test.ts`.
  - No lint rule was added: the ESLint config is outside the TG lease.
- **T2 (info), added.** New contract test "binds revealed results to their own run, even for identical plans". Two runs with identical plans (so identical unit IDs) each return only their own revealed payloads. Every future durable adapter must pass it too.

## 2. Preview: saved-run listing (reconnect state)

- **`runProjection.ts` (new), a browser-safe module.** It imports only zod and a type from `runnerContracts`, with no `node:crypto`.
  - It now holds `RUN_PHASES`, `RUN_STATES`, `RUN_EVENTS`/`RunEvent`, `MAX_LISTED_RUNS` and `runProgressSchema`.
  - The schema code is unchanged, just moved.
  - `runStore.ts` and `runnerContracts.ts` import from it and re-export it, so their existing exports are unchanged.
- **`RunHistoryPanel({ listing })`** (preview) checks a collection-route listing `{ runs: [...] }` against the strict schema (at most `MAX_LISTED_RUNS`, no unknown fields).
  - **For each run it shows:** the state, created time, a label for the last event, the revision, processed / total per stage (fitting shows "No percentage"), the storage note ("Memory reference: not durable…"), and whether results are sealed or revealed.
  - **Messages:** an empty listing shows "No saved runs yet.". An invalid listing shows only a generic alert, and none of its contents are reflected.
  - **No buttons and no fetch.** The preview renders it from a fixed synthetic listing of 3 runs (running, completed sealed, cancelled).
- The panel uses existing SCSS classes, so the stylesheet is unchanged.

## Files

| Path (under `web/lib/forge-testing-grounds/`) | Status | SHA-256 | Bytes |
|---|---|---|---|
| `runProjection.ts` | **new** | `ef192f2327578b5a9b512bd28a259ba65c9fd5e7d50d51eea61fac4de81d0dcf` | 2249 |
| `runStoreContract.testkit.ts` | **renamed** from `runStoreContract.ts` (`eb8eb680…`), + T2 | `b9fef7cb037b6d7de1ad3575c931b331bc0ab479718313c95397f4374ad37b32` | 9924 |
| `runStoreContract.test.ts` | import path | `bbb10e5fb89273160e9b0c300fd161606f3234f4cbef871cfb22b5a559851761` | 373 |
| `runStore.ts` | schema moved out, re-exported | `c3d96ff5ad874c49d08d1588cc5ef3d7e01893b50203d85f0fdfdd42542af753` | 5568 |
| `runnerContracts.ts` | `RUN_PHASES` imported and re-exported | `36fbc1ce243962219f5adbdbf5c5fbe6c610c7cbe75cd24f433a5e2743629aef` | 6325 |
| `preview/TestingGroundsPreview.tsx` | + `RunHistoryPanel` | `9dea120511c112fef10bfe4a00ba2a02fa9b9ccb3ed094dd0246ffc7df3b6901` | 15290 |
| `preview/previewFixtures.ts` | + `createHistoryFixture` | `335f2c647991d6325170acdfc03360192aa5507270e331a0a8dd5435e0e0ac86` | 7639 |
| `preview/TestingGroundsPreview.test.tsx` | + 8 tests | `c0dac25362ed7c40aae11caa4cca8f0fb80ca9b40ed549f60adbffb87c4590dc` | 11293 |

The commit must record the deletion of `runStoreContract.ts` along with the new `.testkit.ts`. `memoryRunStore.ts`, `ownerRoutes.test.ts`, the routes, page and SCSS are unchanged.

## Checks actually run

All checks ran from `web/`, under `/private/tmp/fhfh-heavy.lock`. The lock was taken with `mkdir` and released afterwards; it was never stolen. `GIT_DIR` was not set.

- `npm test -- --run lib/forge-testing-grounds`: **163/163 passed in 9 files.** That is 154 + 1 (T2) + 8 preview (listing, empty, 6 poisoned listings). The existing "every scenario has no alert / no network" test still passes with the panel mounted.
- Scoped tsc, `npx --no-install tsc --noEmit --project ../tasks/artifacts/claude-lanes-2026-10-25/TG/tsconfig.json`: **exit 0**.
- Whole-project tsc, `NODE_OPTIONS=--max-old-space-size=8192 npx --no-install tsc --noEmit`: **exit 0, no errors**.
- `npx --no-install eslint` on all 8 touched files: **exit 0**.
- **Not run:** browser, visual check, build or E2E. The panel is checked through the jsdom DOM only, not in a real browser. The stylesheet is unchanged.

## Gates unchanged

- The routes are still unwired, and the preview still makes no fetch and has launch disabled.
- No durable store, runner, owner config or env, auth claims, or statistical or model work.
