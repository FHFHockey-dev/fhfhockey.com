# Slice 03 handoff — dedicated runner reference

2026-10-24. `octoberBranch`, base HEAD `2a5092d37cb863ec92a2a4e609999cf226bfa4a5`. Sole Testing Grounds worker. **Frozen for independent Sol review; Scout retains acceptance.**

Five new application files, all under `web/lib/forge-testing-grounds/`:

| File | Result |
| --- | --- |
| `runnerContracts.ts` | Strict immutable manifest envelope, source/history guards, explicit limits, canonical hashes, deterministic unit IDs and validated executor results. |
| `runStore.ts` | Internal atomic/durable-acceptance obligations, trusted-owner worker seam, safe progress and separate sealed-results API. |
| `memoryRunStore.ts` | Explicit memory-reference implementation: idempotency, capacity, leases/fencing, checkpoints, accepted-output counters, cancellation, bounded failures and synthetic-only reveal. |
| `boundedWorker.ts` | One bounded executor call, cooperative abort, late-result rejection and generic failure handling. |
| `boundedWorker.test.ts` | Sixteen synthetic acceptance/lifecycle/race/sealing/resource controls. |

Only these application paths changed in this slice. New evidence files: `OWNERSHIP.md`, `OPERATING-PLAN.md`, `HANDOFF.md`, `checks.log`, `EVIDENCE.json` here. Existing task diary updated outside the delivery candidate. No shared-file, schema, package/lock, auth, route, cron, model or production change. No server, heavy suite, new worker or Git/index mutation.

## Verification actually performed

- Initial focused Vitest: 15/15 passed. Then explicit memory-mode reporting and a blocked-timer late-result guard were added, with one focused control. Final same-file run: **16/16 passed**, 23 ms tests / 204 ms Vitest duration. These are tiny synthetic timings, not a model/runtime/cost benchmark.
- Scoped strict TypeScript and ESLint over the five new files: **passed**, no output. Full commands and original iteration output in `checks.log`; no slice03 failing checks.
- Whitespace inspection of all five new files: passed. Thirty-five frozen slice01/review/R1/slice02 source/evidence pins compared: unchanged. Requirements still match parent-approved hashes. Exact new candidate, test/config/runtime dependency and read-only design-reference pins are in `EVIDENCE.json`.
- No real fit, model/data capture, provider/production call, persistent process restart, browser continuation or mobile UI was tested.

The earlier timestamp failure evidence is preserved. Scout separately accepted R1 within timestamp-ordering limits after independent review; that acceptance does not extend to this runner or owner/auth/sealing integration.

## Requirement disposition

| Target | Disposition |
| --- | --- |
| 1.5–1.6 runner choice/capability/operating plan | A selected by TJ; local evidence and concrete persistence/operating gates supplied. Hosting capacity, cost and pilot approval remain incomplete. |
| 2.1–2.3 immutable identity/source/operational contracts | Partial local implementation. Version/hash references and immutable run envelope exist; complete candidate-versus-refit, target/event, cohort, revision/observation-time and scientific contracts remain incomplete. Draft/preflight-blocked states belong to the future setup/preflight layer; store acceptance begins queued. |
| 2.4 protected persistence | Interface obligation only. Actual DB transactions, durability, access policies and object storage are not implemented or tested. |
| 2.5 audit/redaction/retention | Safe allowlisted progress and retained checkpoints/output references locally; full durable audit/event/export/retention primitives incomplete. |
| 2.6, 6.2–6.5 lifecycle and recovery | Local synthetic boundaries implemented/tested: uniqueness, owner scoping, fencing, pending outcomes, restart, cancellation and resource budgets. Scheduler/process durability and real-workload semantics remain unproven. |
| 6.1, 6.6 browser-independent durable operation | Incomplete. Store is explicitly in-memory; no live scheduling, process recovery, mid-step heartbeat renewal or remote monitoring is represented as working. |
| 8–9 UI/review/history | Small operational/results seam only; no UI, charts, metric engine, export or historical comparison delivered here. |
| Real holdout protection | Preserved. Real-history reveal denied; synthetic completion/time/owner reveal only. Production policy integration remains blocked on authoritative receipts and review. |
| Full v1/real paired count and probability pilot | Incomplete; not attempted or authorized. |

No original requirement is intentionally superseded. The only narrowed behavior is this fixture store's real-history reveal denial, pending the full planned reveal policy. Work counters measure completed logical units; no score/accuracy claim or model-improvement shortcut is made.

## Handoff and remaining gates

Read `OPERATING-PLAN.md` for the concrete DB atomicity design, measured fixture limits, honest limitations, verified controls and binary target. The few next gates are an exact model-adapter lease/bounds, reviewed scientific contract, and measured persistence/runtime/storage/cost plan before hosted approval. All real infrastructure/configuration/schema/owner activation/pilot actions remain pending and were not attempted; no denied or uncertain mutation occurred. No process or server is left running.

Suggested independent review: inspect these exact five pins, exercise adversarial logical-output/cancellation/lease/sealed-projection cases, and check the non-durability disclosures. Do not retest accepted timestamp work or run broad suites/live data. Review may assess this bounded reference slice only; it must not certify the full dashboard or hosted runner ready.
