# P07 R1 independent review — HELD

**The original C08 bridge-impersonation defect is closed on the reviewed bytes. Hold the R1 mechanism candidate for two reproduced boundary defects below.** The correction substantially improves provenance: saved forecast graphs are replaced by an actual current GET, process authority does not survive serialization, and raw saved goalie displays no longer confer authority.

Review began at HEAD `16bada8670d3d1f536cdae928f69b5294bc12e81` on `octoberBranch`; concurrent HEAD ended at `84cb1229cd1c1cdd037c43e660d2a181304ada51`. All32 candidate and3 unchanged reserved source/test pins matched before and after. Both archives and all3372 fixed-snapshot hashes verified. Nine additional caller/transport/access files exactly match the tested snapshot. Acceptance attaches to these hashes, not the moving branch.

## R1-01 — P2: ordinary browser/server clock skew rejects a valid current read

**High confidence; current-path availability regression; integration hold.**

Evidence: `web/lib/rosterScheduleOptimizer/currentPlanningRead.ts:65` samples browser time; lines75–79 require the server manifest timestamp to fall between browser request/receipt times and after the saved browser context timestamp. These clocks are independent. Line96 also sets the forecast evaluation clock from browser receipt time, and source/permission expiry elsewhere uses browser wall time, so the correction must address clock domains consistently.

Reproduction: unchanged valid synthetic bridge response generated at server12:00:00, with the browser at11:59:55 or12:00:05. The actual adapter rejects both with `Current read does not match this planning generation.`; expected fresh approved value7 is unavailable. The tests change only the client clock/context time, not the server payload or source selection. See `p07IndependentBoundary.test.ts`, first two cases, and `independent-boundary.log`.

User impact: a small device clock offset greater than the applicable request latency disables current numerical planning even though the same-origin server returned valid evidence. This fails closed; it is not a permission escalation or private-data leak. We did not measure real users' clock offsets.

Surgical scope: current-read freshness correlation/evaluation clock, data-route contract and their tests; expiry conversion at the hook/authority boundary if needed. Correlate a current request using an adapter-generated generation nonce echoed by the live server (or an equivalently explicit existing transport freshness guarantee), and use server evaluation time plus bounded monotonic elapsed time for forecast/review deadlines. Preserve separate manager/provider timestamps. Do not simply allow arbitrary old/future manifests or delete freshness checks. No signing key, secret, database or schema is required.

Acceptance: valid responses under positive/negative client skew remain usable; old request generations, stale/revoked policy, expired sources and future server evidence still fail closed. Verify server-clock to local-deadline conversion, not only a wider timestamp tolerance.

## R1-02 — P2: review expiry during calculation leaves an authorized result/display

**High confidence; reproduced with a synthetic positive native review; held future-positive path. Production review catalog remains empty.**

Evidence: `web/lib/rosterScheduleOptimizer/executionAdapter.ts:26–31`. After calculation, only source expiry causes reevaluation. Review deadlines are collected afterward and filtered to values still in the future. A review that expired during calculation therefore neither invalidates the already-computed display/result nor becomes its next expiry deadline.

Reproduction: synthetic exact-scope GOALS review expires12:00:01; actual planning and candidate calculation start at12:00:00. A wrapper calls the real candidate function then advances the fake clock to12:00:02, modeling elapsed computation without replacing its result. The current policy resolver correctly denies the now-expired review, but the returned display still permits totals. See the final test in `p07IndependentBoundary.test.ts` and `independent-review-expiry.log`. Source-expiry-during-calculation control passes, which isolates the missing review-expiry handling.

User impact: once positive native reviews are added, a result can remain presented as authorized after its applicable review deadline. This is not evidence of a current production exposure: this packet has zero production target reviews, and positive native producer identity/qualification gates remain open.

Surgical scope: execution adapter and focused tests. Capture applicable permission deadlines before evaluating and check them again immediately before publishing. If a relevant source or review expires, rebuild/withhold affected numerical output and its display/metrics consistently; do not silently discard an expired deadline. Coordinate with R1-01's clock model. Preserve per-target/use permissions and the empty production catalog.

Acceptance: the synthetic review-expiry case passes along with source expiry, revocation on the next read, and existing independent assignment/totals/comparison/tie-break cases. No native approval may bypass this gate.

## Verified improvements and limits

- Unchanged original C08 passes. The actual adapter replaces forged means, participation flags, bridge lists, target bindings, retained contributions and packed saved graphs. JSON copies cannot regain permission.
- Additional adversarial controls passed: same-stats-reference lineage/player/game/participation transplants rejected; immutable current rows required; async continuation loses authority; source expiry during synchronous work clears forecasts.
- Worker handler and fallback use the same execution adapter. Existing obsolete-read abort, generation invalidation, requested-candidate changes, worker failure and expiry tests pass.
- Independent React test exercised the actual component, hook, broker, adapter, planner and policy, with only external reads/auth/calendar stubbed. Plan and candidate consumers shared one current data GET. Separate existing access/workspace GETs were correctly distinguished; an initial reviewer assertion counted all fetch calls, was corrected, and is not a product finding. Its diagnostic log is retained.
- The selected real-component goalie test passes both raw-input gates. Its remaining numerical presentation controls mock policy/admission, as disclosed by the owner; they are not provenance acceptance evidence.
- Targeted loader tests preserve approved bridge conditions, deny unreviewed native use after selection without bridge escalation, and preserve explicit Start Chart separation. Production target reviews remain empty. Positive native configuration/artifact identity and predictive qualification remain unapproved.
- All22 workspace route tests passed, including anonymous denial, owner scoping after entitlement expiry, current save capability, other-account update denial, preservation/CAS and packed save budgets.
- All25 prior P02/P02-R1/A7–A9 stats pins remain exact in the canonical checkout. All28 billing source/test paths have zero overlap with P07:27 match the R1 baseline commit; the sole differing test exactly matches the previously reviewed billing relocation bytes (only the SQL fixture path moved). This preserves prior evidence; it does not approve billing's separate remaining gates. See the preservation JSON receipts.
- The tested isolated tree intentionally excludes unrelated newer P01–P05/CTPI/Luna work. Hash preservation in the canonical checkout is distinct from testing a combined release.

## Verification receipts

**81 distinct selected tests passed;3 adversarial assertions/tests failed across two findings.** This comprises47 policy/adapter/hook/C08 tests,29 selected loader/data-route/workspace-route tests,3 extra passing boundary controls,1 real UI integration test, and1 selected goalie-display test. The three failures are two clock-skew cases and one review-expiry case. Filter-skipped tests are explicitly shown in logs; the807 owner executions were not indiscriminately repeated.

Node22.11.0/npm10.9.0; ordinary private scratch directory; existing dependencies; clean synthetic environment; network preload/setup deny external calls. Exact commands and test-copy instructions are in `COMMANDS.md`. Source files were not edited. Only independent artifacts/diary and scratch fixtures were written.

Not run: browser Worker bundling/runtime, production build, full repository typing/lint, full807 suite, database/provider/NST/API/network operations, SQL or live billing. Owner application-TS/lint receipts remain owner evidence. No credentials accessed, dependencies installed, commits/pushes/deployments made, or outside agents contacted.

**Next action:** one narrowly owned R2 correction for the two clock/expiry issues, then rerun the unchanged C08 and these independent fixtures plus affected tests. Keep predictive, historical/as-of, positive-native, runtime/build and release gates separate. Review is complete. No execution action was denied, pending or uncertain.

