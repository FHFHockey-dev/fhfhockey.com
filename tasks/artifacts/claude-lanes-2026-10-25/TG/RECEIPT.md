# TG S06 — validated run-store read adapter (offline)

2026-10-25, Claude TG lane, `octoberBranch`, lease base head `ac98431aa`. Local only: no commit, no Git, no server, and no live, database, model or provider call. **Frozen for orchestrator review and commit.** Independent review has not happened.

## Why this slice

The S05 review left one gap before any store could be wired to the owner routes ("Read-adapter limitation"). `listOwned`, `readOperational` and `readSealed` passed store payloads straight through, so a planted `unsafeAdapterMarker` came back unchanged. S06 closes that gap for the memory reference store. It does not wire any store into the exported routes. State map: [STATE-MAP.md](STATE-MAP.md).

## Behavior

- `createRunStoreReadAdapter(store)` (in `runStore.ts`) maps an `ExperimentRunStore` onto the routes' `OwnerReadStore` seam.
  - **Operational reads** return only the progress projection, checked against `runProgressSchema`. The schema rejects unknown fields and accepts only the closed `RUN_EVENTS` vocabulary, so no free-form text gets through. Stage counts must reconcile: successful + failed + pending = total. Each percentage must be exact, and fitting has none. Stages must be ordered and unique. Terminal states must have a finish time and others must not. The run ID and storage mode must match the request and the store. Anything else becomes a generic 503 and nothing from it is reflected back.
  - **Sealed reads** need two things to agree: progress shows `completed_revealed`, and the store's results channel strictly parses as revealed. Either one alone stays 403 `results_sealed`.
  - **Not available:** health, manifest, logs and export have no store source, so they fail closed with 503. Nothing is fabricated for them.
  - A missing run, or another owner's run, returns 404.
- `ExperimentRunStore.list(owner)` and `MemoryExperimentRunStore.list` return the owner's runs, newest first, capped at `MAX_LISTED_RUNS` = 50, as projections only. This gives the store a reconnect/history listing.
- Store events are now typed as `RunEvent`, so the memory store and the schema share one vocabulary at compile time.
- `jsonValue` is exported from `runnerContracts.ts` so revealed payloads can be validated. Its schema is unchanged, and so are plan hashes.
- **Inert:** `testingGroundsRoutes` is still created without a store, and every mutation still returns `runner_not_connected`. A test confirms that installing the adapter calls no accept, claim, finish, cancel or reveal.

## Changed paths (all inside lane TG; the other 20 leased files are byte-identical to their pins)

| Path | Baseline SHA-256 | New SHA-256 | Bytes |
|---|---|---|---|
| `web/lib/forge-testing-grounds/runStore.ts` | `07f197bf59d44187a8d93c98488b711e0e28edd6ba7db80f12962a6c5628fa8c` | `f23da1c621004a45940a13f9e6fc42983b7250170996778a77a1f7bf6ed1a178` | 7334 |
| `web/lib/forge-testing-grounds/memoryRunStore.ts` | `085abad213e05d0d2a973d54197896cd54a2d72c2d218ede70b3f95d5ccb9fdc` | `60fcfb59dc2e9b9075118e89067efe43ce9b83ded42dde6a7383bd65deb5a9cc` | 12718 |
| `web/lib/forge-testing-grounds/runnerContracts.ts` | `eaefa7e188004b89fc305f886f9673316e1650107179795d0994caea81777eeb` | `cf0ee8c328a61769f7a75014ffeb1227eafa86e5847976fabf7d204ab5d5d0aa` | 6343 |
| `web/lib/forge-testing-grounds/ownerRoutes.test.ts` | `54476cd5db0cb4505544ea91d1e0559164845cb08951a6a690588ddec6c0dad3` | `c739b74bf97be06abdd03ad6dd4f0879cc48426783a02c08f5092a909c0741e2` | 17765 |

New lane artifacts: `tasks/artifacts/claude-lanes-2026-10-25/TG/{STATE-MAP.md, RECEIPT.md, tsconfig.json}`. The diary is `tasks/diaries/2026-10-25-claude-tg-testing-grounds.md`; it is working notes and not part of the candidate.

## Checks actually run

All were run from `web/` under `/private/tmp/fhfh-heavy.lock` with no `GIT_DIR`.

- `npm test -- --run lib/forge-testing-grounds`: **146/146 passed in 8 files.** The 133 existing tests are unchanged, and none were weakened or skipped.
- `ownerRoutes.test.ts` alone: 45/45 passed. That is the 32 original tests plus 13 new S06 controls.
- First runs failed 8 and then 1. Both were test-side problems, and no source change was needed:
  - The helper read the first `res.status` call. The route evaluates `status(200)` before the awaited read throws and then overwrites it with 503, so the helper now reads the last call.
  - Listings carry no expected run ID, so the "another run's identity" poison could not fail on the list path. It moved to its own per-run test, alongside a repeated-run listing case.
- `npx --no-install tsc --noEmit --project ../tasks/artifacts/claude-lanes-2026-10-25/TG/tsconfig.json`: **passed** across the whole namespace, the page and the API wrappers.
- `npx --no-install eslint` on the 4 changed files: **passed**.
- **Whole-project tsc** (follow-up to C3's report of 8 errors in this namespace).
  - A plain `npx --no-install tsc --noEmit` ran out of heap (exit 134). I reran it with the repo's `typecheck` heap setting: `NODE_OPTIONS=--max-old-space-size=8192 npx --no-install tsc --noEmit`.
  - Result: exit 2 with **0 errors in `forge-testing-grounds`**. All 3 remaining errors are outside this lane, in `lib/player-cards/evidenceLoader.ts:106` and `evidenceLoader.test.ts:25,81` (Buffer vs BinaryLike, files last modified 12:47).
  - The 4 TG files are byte-identical to the hashes above and have not been edited since 12:44:15. C3's run most likely overlapped my edits between 12:41 and 12:44, when `runStore.ts` already declared `list` but `memoryRunStore.ts` and the test were not finished yet. No TG source change was needed.
- **Not run:** browser, build, full suite or E2E. No UI changed, and the client bundle does not import `runStore.ts`.

## Gates unchanged

- No runner activation, durable store, schema, captures, cost or retention work.
- No owner config or env values were read.
- No auth verification is claimed, and the 0/1 historical auth-read receipt is not a budget.
- No statistical or model work.
- Health, manifest, logs and export still have no source.
- Reveal remains synthetic-only, inside the memory store, and is not reachable over HTTP.
- A future durable store must meet the same schema and must still prove atomicity and sealing on its own.
