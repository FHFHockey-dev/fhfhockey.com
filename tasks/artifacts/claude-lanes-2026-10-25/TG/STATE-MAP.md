# FORGE Testing Grounds — state map (Claude takeover, 2026-10-25)

Sources: the task list `tasks/tasks-prd-forge-testing-grounds.md` (all boxes still unchecked; nothing there is accepted end to end), the slice receipts in the recovery checkout (`…/clean-checkout-2026-10-25-1505/files/tasks/artifacts/forge-testing-grounds-2026-10-24/`), and the 25 leased files. All 25 matched their lease pins at takeover. This map is not an acceptance record. The receipts and the reviews they cite govern.

## Built slices

| Slice | Files | What it proves offline | Review status |
|---|---|---|---|
| S01 + R1 | `operationalProgress.ts`, `dataHealth.ts` (+ tests) | A strict operational envelope with reconciled stage counts and no percentage for fitting, and exact sub-ms timestamp ordering (R1). Input-only health separates zero from missing, malformed, duplicate, stale, identity, unit, strength and history problems. | R1 accepted within its limits |
| S02 | `ownerPolicy.ts` (+ test) | Fail-closed TJ-only policy: configured owner UUID plus a server-verified principal, re-verified on every call. | Reviewed |
| S03 + R1 | `runnerContracts.ts`, `runStore.ts`, `memoryRunStore.ts`, `boundedWorker.ts` (+ test) | Immutable plan and hashes. In memory: idempotent acceptance, capacity, leases and fencing, checkpoints, cancellation, retry and budgets, and a synthetic-only reveal. R1 adds a separate outcome-check cap (E+W claim bound). | R1 accepted within its limits |
| S04 + R1 | `preview/*` | A synthetic preview UI with 10 fixture states. Launch is disabled and review stays sealed. R1 adds honest "less than 100%" labels and exact `aria-valuetext`. | R1 accepted within its limits |
| S05 + R1 | `serverOwnerBoundary.ts`, `ownerRoutes.ts`, `TestingGroundsOwnerGate.tsx`, page, 3 API wrappers | Server owner boundary using `requireApiUser` → `getUser`. Routes split by method and operation, and every mutation is inactive. The client gate covers session, visibility and pagehide races (R1). The page is a locked SSR frame. | R1 accepted with limits (11 pass, 8 skipped) |
| Owner config | env only (not in lease) | The local owner key is set and local access now returns 401 instead of 503. TJ later reported the page opens. | Historical. Not an auth-verification claim |

## Task-list reconciliation (partial contributions only)

- **1.x discovery/decisions:** Runner direction A chosen (a dedicated bounded-step worker over the lease/CAS pattern). Model, event, PR-convention, clipping and uncertainty decisions are still open (S01 SOURCE-RESOLUTION items 2–5).
- **2.1–2.3 contracts:** run envelope, references and states exist. Candidate-versus-refit, target/event, cohort and revision contracts are open.
- **2.4–2.5 persistence/audit:** interface obligations only. No durable store, schema, audit or retention. *Gate.*
- **2.6 / 6.2–6.5 lifecycle:** proven synthetically on the memory store.
- **6.1 / 6.6 durable, browser-independent operation:** not started. *Gate.*
- **7.1 owner auth:** a local boundary exists. Live verification is not claimed.
- **7.2 mutations:** method, origin and CSRF shape exist; actions are deliberately inactive.
- **7.3 reads and sealing:** the route seam exists, but **its read adapter passes payloads through unvalidated** (S05 review, "Read-adapter limitation"). No adapter exists. ← next slice
- **7.4–7.5 reveal, logs, export:** reveal works on the synthetic memory store only. Logs and export are absent.
- **4.x chronology/health:** input health is partial (S01). Preflight, denominators and repair versions are open.
- **3.x, 5.x model adapters and metrics:** not started. *Scientific/model gates.*
- **8.x setup/monitoring UI:** preview states only (S04). No setup or launch wiring.
- **9.x results/history UI:** not started.
- **10.x pilot:** not started. *Gate.*

## Next offline slice chosen: S06, a validated run-store read adapter

`createRunStoreReadAdapter(store)` maps an `ExperimentRunStore` onto the routes' `OwnerReadStore` seam:

- It checks every operational projection against a strict schema: no unknown fields, a fixed event vocabulary, and counts and percentages that reconcile. Payloads are no longer passed through.
- Sealed reads require the store's own results channel to report a revealed run whose progress also shows `completed_revealed`.
- Operations the store cannot answer (health, manifest, logs, export) fail closed. Nothing is fabricated for them.
- A new owner-scoped `list` gives the store a reconnect/history listing.

The exported route wrappers stay unwired, so this adds no store, no runner and no reveal action.
