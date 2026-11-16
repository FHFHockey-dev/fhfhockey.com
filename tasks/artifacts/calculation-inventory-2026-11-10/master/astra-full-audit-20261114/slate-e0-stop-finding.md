# Separate slate successor finding

Candidate `e0cbb19a8b800d95313b19722816c456baeaf52c`; outside frozen89da scope totals.

## CAP-SLATE-01 — P1: dispatch can occur after the whole-queue stop
- **Claim checked:** after the first save_unknown/ambiguous/timeout stop trigger, no additional game dispatches.
- **Location:** `web/lib/projections/pregameCapture/slateQueue.ts:421–440`; `handleReport` can set halt while `loadGate` awaits.
- **Evidence:** `slate-e0-stop-probe.cjs` and output, exact queue/deadline/time and extracted minimumRequiredMs with virtual clock/effect doubles. Both zero spacing and the production-default30-second spacing reproduce it; final retained probe uses30seconds and concurrency2. No difference candidate→currentHEAD at check.
- **Minimal scenario:** game1 is running. Game2 is due and awaits its health gate. Game1 then returns confirmed save_unknown, causing queue_stopped. Gate2 returns open. The loop calls dispatch(game2) without rereading halt. Retained event order is dispatch1, terminal1, queue_stopped, dispatch2.
- **Problem:** the new capture can claim and write custody after the agreed global stop has fired.
- **Suggested fix:** recheck halt after every awaited pre-dispatch step and immediately before dispatch; leave game2 pending for the stopped-queue closure path. Recheck readiness/deadline after the gate as appropriate. Add a deterministic asynchronous gate regression.
- **Readers affected:** private slate queue/operator receipts and capture runner. P1 missing reachable write/stop guard; no live queue or production incident asserted.
