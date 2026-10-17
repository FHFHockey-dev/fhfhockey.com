# Independent offline review — proposed recurring schedule refresh

Verdict: **REJECT this candidate as a deployable recurring writer pending one P2 overlap/ordering correction.** The twice-daily horizon addresses the demonstrated early-week freshness gap, and most proposed scope/resource/auth boundaries are sound. No patch was applied and no invocation, deployment or scheduling activation was performed.

## P2 — concurrent writers can silently restore an older schedule observation

At `candidate/web/pages/api/v1/db/refresh-roster-optimizer-schedule.ts:69–81` (future application path `web/pages/api/v1/db/refresh-roster-optimizer-schedule.ts`), the existing-cache check reads identities only and the subsequent unconditional upsert has no shared writer lease, slot deduplication or atomic stored-revision/freshness condition. Two authenticated invocations can both validate and both returnHTTP200 while an earlier source observation commits last, replaces newer LIVE state with FUT and moves fetched_at backward. The same conflict identity does not prevent this: it chooses which rows are overwritten, not which observation may win.

One focused independent offline regression reproduced that interleaving against the actual candidate handler/normalizer/guard in the supplied isolated VM fixture. An earlier12:00:00 FUT observation was paused at fake commit; a12:00:01 LIVE observation completed; releasing the earlier commit reverted the shared synthetic cache to FUT. Both candidate responses were200. The preservation assertion failed as expected. No application code, source response, real transport or database was involved.

The proposal's preactivation FORGE handback and duplicate-job reconciliation are necessary, but they do not mechanically serialize concurrent authenticated route calls or enforce ordering against the unchanged legacy/manual writer. The stated concurrency-one envelope currently means sequential I/O inside a single invocation. Add an enforceable shared exclusivity/atomic revision or monotonic-observation condition across overlapping writers, with a deterministic concurrent/duplicate regression and honest skipped/unknown outcomes. If exclusivity is instead a required external guarantee, freeze a mechanism that actually enforces it and narrow the policy claims accordingly; a one-time inventory/ownership check alone does not supply that guarantee. Preserve the exact one-time route's reviewed contract while coordinating any shared write-boundary change.

## Scope, horizon and deletion assessment

For each New York date in October12–18 the full current/next Monday–Sunday horizon plus one-day padding is October11–26 inclusive,16dates/3source pages. MondayOctober12 remains in the refresh through Sunday, unlike D−2. The active Yahoo period is incorporated in full; invalid dates, missing/ambiguous active periods and horizons over31days reject. Intl derives the New York calendar date, while date offsets use calendar strings/noonUTC; ordinary DST day-length changes do not shift the selected scoring dates. The hard477/2026/20262027 pin and season-boundary check stop rather than silently roll seasons. This is not all-timezone/arbitrary-selection freshness, as the proposal already states.

The source seam retains default behavior for existing callers. The bounded reader still checks every requested date and rejects conflicting duplicates. The candidate adds bounded JSON streaming, exact-count DB reads, source season/type/team/status checks, reciprocal side validation and whole-payload rejection rather than favorable truncation. There is no delete call. Cached identities disappearing from the range reject the cycle; present cancelled/postponed rows become non-countable. That conservative missing-game behavior is a policy tradeoff already disclosed, not automatic reschedule repair.

09:50/21:50UTC is a12-hour cadence. One skipped cycle ordinarily gives24hours between successes, below the36-hour reader gate. Two missed cycles approach36hours; failures/delay/report delivery still matter. The proposal correctly retains separate6-hour/2-hour warnings and makes no availability guarantee. No consumer rule or forecast is changed.

## Bounds and the1000-side choice

The31-day range implies at most5sequential seven-day source pages, each capped1MiB/8seconds with redirects prohibited; the ordinary16dates imply3pages. Five exact-count DB reads cap accepted arrays at64+1+64+64+1000=1193rows. One serialized upsert is capped1000sides/1MiB, with zero deletes; write-mode attempts use the existing separate audit. The90-second controller covers handler work, not the full audit wrapper; the existing240-second configuration/120-second pg_net proposal and acknowledgement ambiguity must remain distinct. DB response-byte caps and hard memory/cost estimates are not implemented or claimed. No proposed budget was exercised against production.

1000 is enforced, but the retained fixtures do not demonstrate that it is a necessary normal workload. A defensible conditional ceiling is31dates×32clubs×at most one game per club/date=992team-sides (ordinary16dates would be512). The code does not derive that bound from a pinned32-club/per-day invariant; treat1000 as an explicitly approved hard allocation, not a proven population or expected count. Add the rationale and expected observed count range to the policy decision before activation. The additional1MiB cap may reject earlier and must not truncate.

Small resource-accounting correction: read() uses limit(maximum+1). If the first four reads accept their maxima and the final cache read returns its1001st overflow sentinel,1194rows may be returned before rejection. The proposal's1193 is an accepted-result ceiling, not an absolute returned-row ceiling for rejected reads. Document the sentinel or enforce the literal budget. This does not create an extra request or permit an oversized write.

## Auth, reporting and activation limits

Inspected the real withOperationalRouteAuth/adminOnly/withCronJobAudit dependencies. Authentication precedes POST enforcement, handler and audit; the cron fast path requires exact nonempty CRON_SECRET parity. The existing development bypass requires development mode plus actual loopback peer and local Host. Ordinary bearer requests still require verified admin role. Default query behavior is dry-run inspection without audit, and only scalar dryRun=false chooses the audited write wrapper; unsupported/repeated query values reject. The activation SQL references Vault by name only; no secret value was read. Actual deployed secret parity and installed scheduler behavior remain preflight gates.

Distinct job/route aliases avoid crediting a one-time manual repair as the scheduled job. Current report code handles the combined-hour cron with latest-required/closest-slot helpers and a completion grace; the retained21-check harness verifies helper slots, not actual report delivery. Missing/failed audit acknowledgement cannot be treated as schedule-write failure proof or as overall healthy success. Unknown acknowledgements need bounded existing evidence before any manual retry. The proposal properly keeps actual report matching/delivery, named incident ownership, native wrapper integration, duplicate-job reconciliation and release/activation authorization pending. Those gates remain in addition to the P2 above.

## Verification and exact rejected candidate

Reconstructed the complete five-path patch in memory against its12 pinned originals; all candidate and original hashes match. Source-binding manifest SHA256: `dc8a877f37fdc2440eae50487d4c43d04d4d03e3e0932e3624103a3d1f7153e3`.

| Proposed future source | SHA256 |
| --- | --- |
| `web/lib/cron/cronInventory.ts` | `7ce3f8cd67c3dc5749018591899f88885e724d17352247c5bab770b145b9d8eb` |
| `web/lib/rosterScheduleData/recurring.ts` | `e876ef82ec720744588bbc4dc3e984db8669b1861229666b6637d6de1ae46136` |
| `web/lib/rosterScheduleData/source.ts` | `1aad10ae23f6a3585900b79f918d71872db3fbe28c9a9c2233011c02797406c5` |
| `web/pages/api/v1/db/cron-report.ts` | `04db8f08d9cc86bc1ad474cc3aaa33971905a33dfd747966a4e8e01ea0048b55` |
| `web/pages/api/v1/db/refresh-roster-optimizer-schedule.ts` | `073d7b0f8bde2140c7470199f38a2cd4d8124aea5cc798cfd71e2906ca73b402` |

- `implementation.patch`: `21c3b1e756bb757fe6a21386aa44c1ec7b94965f75289594946a96c64e747ef2`.
- `PROPOSAL.md`: `22e8d9a9cc2304e8e76ea740224387e876409d61fe8743b693b3ba85c1dadea3`.
- `source-bindings.json`: `dc8a877f37fdc2440eae50487d4c43d04d4d03e3e0932e3624103a3d1f7153e3`.
- `canonical-register-activation.patch`: `fccd5ab25aa872cdd990f5d3d282eb5bce17aab4937664d6457386373ab50d09`.
- `canonical-entry.proposed.json`: `3df3fa64591a49d92febfb14b31c475a58f0893cbe1afd0571936aff52cf20d2`.
- `activation-reference.sql`: `5feb1c87c783693cd551b5d2bd6182d30fb8ade590630ac2a3c881791ee0e85a`.
- `verify-offline.cjs`: `511bf2abbb02f6110a73d5560cf2ffa92e6066977317cf294642ea069b6dc256`.
- `offline-verification.tap`: `ceb8e108772d3b79be314bb4d2ca32f44807c8bceba24a87b4ffa890d73f3612`.
- `existing-tests.log`: `e313f2202fdcd8a7874b1b767fcbda06eaae17c5e0d20bc8c186b25c8720c43f`.
- `candidate-typecheck.log`: `b9d90137023d7d279746df887d18848dbcd84d0a6440405c60e9b66a218f1827`.
- Reviewer overlap reproducer/evidence `/tmp/schedule-recurring-overlap-review.test.cjs`: `caa0a4540ef62e55664acfccedb3c86c62eef5d81ced3a316983d0949a36de0a`.
- Reviewer overlap reproducer/evidence `/tmp/schedule-recurring-overlap-review.log`: `0f74c08f5baef030081abc3518486754f69bf64956bfa7cd37795e76ebf5d9bc`.

The single reviewer regression failed as expected and establishes the finding. Author-retained21/21 offline checks,50/50 existing tests and five-root candidate typecheck were inspected, not rerun. No full compiler/build/browser, private FORGE approval/attempt/source/outcome artifact, SQL/network/provider/DB request, application edit, patch application, scheduler action, secret lookup, Git publish or deployment occurred. Only this report and the temporary synthetic reproducer/log were written. The active one-time lane was not invoked or modified.
