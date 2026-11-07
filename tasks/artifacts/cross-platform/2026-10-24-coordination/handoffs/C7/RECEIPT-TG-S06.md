# C7 independent review — TG S06 validated run-store read adapter (uncommitted)

**Verdict: accepted with limits.**
- **Holds:**
  - the adapter validates every store output it can check;
  - it fails closed on the channels it has no source for;
  - it activates nothing;
  - the 8 whole-project typecheck errors C3 reported are gone from the TG namespace: my scoped `tsc` over `lib/forge-testing-grounds` (which includes both previously failing files), the page and the API wrappers exits **0**.
- **Limits:** two binding gaps that any future durable store must close (L1, L2).

**Reviewer:** Claude C7 lane session (not the author). Read-only: no edits, no Git, no live reads. Tests ran under the outbound network-deny preload. The scoped `tsc` ran under the heavy lock, which I took and released. Evidence is in `r18-evidence/tg/`.

## Pins

The four changed paths equal `RECEIPT.md`:

| Path | Hash |
| --- | --- |
| `runStore.ts` | `f23da1c6…` |
| `memoryRunStore.ts` | `60fcfb59…` |
| `runnerContracts.ts` | `cf0ee8c3…` |
| `ownerRoutes.test.ts` | `c739b74b…` |

These are the only `forge-testing-grounds` files modified against HEAD.

## The typecheck gate

- **C3's report:** after C3d, C3's whole-project `tsc` showed 8 errors (`boundedWorker.test.ts` ×6, `memoryRunStore.ts` ×2).
- **TG's updated receipt (12:51):** C3's run overlapped TG's mid-edit window (12:41–12:44). The finished files type-check with no source change, and the remaining whole-project errors are 3 in `lib/player-cards/evidenceLoader*`, another lane's file.
- **My check:** `tsc --noEmit -p tasks/artifacts/claude-lanes-2026-10-25/TG/tsconfig.json`, which covers the whole `forge-testing-grounds` namespace plus the page and API wrappers, gives **exit 0, 0 errors** (`tg-tsc.log`). I didn't run the whole-project `tsc`; the player-cards errors belong to that lane's review.

## Code read (`createRunStoreReadAdapter`)

- **`readOperational`:**
  - only `progress` is allowed, and it must pass the strict `runProgressSchema`: no unknown fields, the closed `RUN_EVENTS` vocabulary, stage counts that add up, the exact percent formula, ordered unique phases, and a finish time only when terminal;
  - `runId` must equal the requested run, and `storageMode` must equal the store's;
  - anything else throws `invalid_projection` (a generic 503);
  - other operations throw `operation_not_supported`.
- **`readSealed` / `authorizeSealedRead`:** need `state === completed_revealed` **and** a strict `{status:"revealed", outputs:[{unitId: sha256, payload: JSON}]}` from the store's results channel. Either one alone gives `results_sealed`.
- **`listOwned`:** an array of at most 50 projections, each strictly parsed, with duplicate run ids refused.
- **`findOwned`:** `run_not_found` gives `null`, so the route returns 404. The memory store's `owned()` refuses another owner's run.
- **Not reachable:** the exported route wrappers are still built without a store, and mutations return `runner_not_connected`. A test proves that installing the adapter calls no accept, claim, finish, cancel or reveal.

## Tests

**147/147 pass** (`tg.json`).
- **SS1's 146 in 8 files** reproduce the receipt's figure: ownerRoutes 45, boundedWorker 19, serverOwnerBoundary 19, operationalProgress 17, TestingGroundsOwnerGate 14, Preview 12, dataHealth 10, ownerPolicy 10.
- **My T1** (`tgAdapter.test.ts`) adds 1, using a poisoned fake store:
  - an extra field and another run's progress are refused as `invalid_projection`;
  - sealed results and a not-revealed state give `results_sealed`;
  - **another run's revealed outputs are accepted** (see L1).
- **Run 1 is kept** (`tg-run1.json`). My include glob there missed the two `.tsx` test files.

## Limits (to TG, for the durable-store step)

| # | Item |
| --- | --- |
| **L1** | **Results aren't bound to the run.** `revealedResultsSchema` carries no `runId` or `planHash`, so the adapter can't tell this run's outputs from another run's that the store returns for the same request (T1 `resultsWithoutRunBinding`). The memory store is correct by construction, but a durable store's results should carry the run id and plan hash, and the adapter should compare them with the projection. |
| **L2** | **The listing isn't owner-checked at the seam.** Projections have no owner field, so `listOwned` relies entirely on `store.list(owner)` scoping. Same note for a durable store: either the store proves owner scoping, or the projection carries an owner reference the adapter can check. |
| **O1** | Health, manifest, logs and export fail closed (503) with no fabricated data, which is correct. Reveal remains synthetic and memory-only, not reachable over HTTP. |
