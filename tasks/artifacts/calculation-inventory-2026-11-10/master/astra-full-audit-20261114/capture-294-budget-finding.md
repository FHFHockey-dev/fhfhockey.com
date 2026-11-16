# Separate successor finding: custody RPC wait budget

Candidate `29451c57304866d54abd2a3302625f0696472ab0`; not part of frozen89da source totals.

## CAP-294-01 — P1: custody RPC budget is declared but not enforced
- **Claim checked:** `CaptureBudget.rpcMs` bounds each custody RPC other than save, and `minimumRequiredMs` reserves seven such waits before T−60.
- **Location:** `web/lib/projections/pregameCapture/custody.ts:28–35,110–123,219–224`; `runner.ts:143–148`; `rpc.ts:67–118`.
- **Evidence:** exact-source `capture-294-budget-probe.cjs` and output. With rpcMs10, a controlled claim remains pending at simulated10,000ms, with no timer installed; on resolution claimMs10000 is reported. Runner creates custody clients with auth options only; wrappers attach an AbortSignal only to save. Runner/rpc have no diff candidate→currentHEAD at review.
- **Problem:** claim, settle, readback, witness, outcome and reconciliation lookup can wait beyond the advertised per-RPC budget. SQL lock_timeout only bounds lock acquisition, not HTTP/socket wait or whole execution. A stalled response can prevent the runner from finishing and consume the remaining capture window; sequential slate work may be delayed.
- **Minimal scenario:** claim request reaches the server but response remains pending beyond configured rpcMs. No local abort or timeout runs. The attempted write may have committed, leaving no timely local receipt.
- **Suggested fix:** enforce an abortable per-RPC transport deadline for both custody clients, bound reconciliation too, retain ambiguous-commit handling and never retry claim/save/witness/outcome. Add a fake-timer test of a stalled RPC at the production wiring boundary.
- **Affected readers:** private pilot runner and subsequent slate orchestration. No wrong projection, late qualification or actual stalled pilot is asserted; SQL/verifier deadline checks still contain late qualification. P1 under the prompt's missing guard on a reachable write path rule.
- **Validation boundary:** no Vitest suite, live runner, provider, database or credential use; exact custody module with effect doubles. Remaining capture successor review is in progress.
