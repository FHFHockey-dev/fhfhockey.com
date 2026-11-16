# Admin database page audit

Frozen `89da739cb45d7d572ed59bfa0b209c79c5d99299`; all 1,483 lines of `web/pages/db/index.tsx` read. `pages23-probe.cjs` passed once with inert database, POST, local storage/persistence and delay bindings. No real action was invoked.

## AFULL-DBPAGE1-01 — P1: failed counts are displayed as known zero

- Location: `web/pages/db/index.tsx:703–733`, displayed in the Players/Seasons/Teams/Games cards at 785, 822, 858 and 919–920.
- Claim checked: missing count support stays unknown; the number of stored records is not zero merely because a query failed.
- Evidence: exact frozen count effect receives `{count:null,error:{message:'finite failure'}}`; each captured setter receives 0. A successful exact count of 0 yields the identical values, while a successful count of 7 remains 7.
- Scenario: an admin opens the page during a failed player count query; the card claims the table contains data for 0 players. No hosted failure or actual empty table is asserted.
- Suggested fix: keep count/loading/error states distinct and display unavailable on failure; include successful zero, nonzero and failure controls.
- Readers affected: `/db` administrative inventory cards; the separate game count uses the same unchecked pattern. This does not assert that table data were altered.

## Complete source review

- The page is wrapped in AdminPageGate with no review-token exception. The bounded gate read confirms non-admin children are not mounted. Admin-only count/game effects check role; the game effect additionally requires season. No mount effect starts or resumes a backfill: stored pending state is read and presented, and Resume is an explicit click.
- A load is still not cheap: three full exact table counts, an exact season game count and a season's started-game metadata query can run, alongside current-season/auth and CronRouteRunner reads. The final-game filter uses the shared stored-state finality contract before selecting the latest 20 for stats updates. These read costs must be included or excluded explicitly in any live-page budget. No load was made.
- Forward/backward runners are sequential, persist the current cursor before a call, preserve the original start date, store the next cursor after a response, reject repeated cursors and explicit failure, and request 21,000 ms between continuation batches. Exact controls verify two finite forward calls, two backward calls with resumed count, one-call failure stop, no repeated request and zero calls on cancellation. Requested delay is not a measurement of actual time or combined NST traffic.
- A failed in-flight cursor can be retried on manual resume; API-level idempotence and the server's combined NST pacing remain separate contracts. Local state uses unchecked JSON shape casting, and each new run resets visited cursors. There is no cross-tab exclusion or finite total-batch limit beyond terminal response/cursor behavior. These are operational constraints; do not treat the UI as sufficient authorization or a global provider scheduler.
- Cancellation checks between 250 ms delay chunks, clears saved progress and aborts the current transport. Aborting a browser request does not prove an already-started server writer stopped. This cannot be inferred from the finite cancellation probe.
- Inputs distinguish incremental all, forward date and bounded backward range; the server validates dates further. Empty numeric game input can pass the UI's loose Number check, but the bounded PP route read shows missing game ID is rejected instead of expanded to all. No scope-expansion finding was added from the UI alone.
- Every updater/runner button remains an explicit action. Stats updates run sequentially over up to 20 source-final games; an explicit false result is displayed but does not by itself stop that loop. NST resume/update buttons are disabled during their own active run. Other actions are not covered by a shared mutual-exclusion gate. Live audit must not press any of them.
- Labels distinguish legacy game goal projections and current-season table updates. The admin-only debug Snackbar button can read an unbounded goalie table and log it, but is click-triggered, not public or load-triggered. Debug console behavior is gated by admin-page access rather than NODE_ENV; this is retained as a source limitation for the live debug check.
- SHIFTR1-01/02 remain inherited at the Shift Charts action; their producer proofs are not rerun. PP/standings/season/SKO update route behavior was audited separately. The present probe did not invoke their implementations or promise successful writes.

No application changes, actual browser/storage/timer/database/provider/write action, environment/client import, supplied suite or live qualification.
