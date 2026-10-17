# Recurring schedule refresh — decision package

**Ready for local integration approval; production DDL, release and recurring activation remain separate decisions.** Accepted V2 is still an unapplied artifact. Its 22-file freeze and rejected V1 evidence are unchanged. This package updates verification status without rewriting those historical records. No production access, provider request, application edit, DDL, scheduler change, build or deployment occurred in this focused verification.

## Candidate and completed verification

The accepted [five-file implementation patch](implementation.patch) has 216 additions / one deletion. It adds the separate authenticated POST route and fixed profile, an optional bounded source-page reader, and two reporting aliases. The existing guarded repair route stays unchanged. [Four functions / two triggers](database-prerequisite.sql) are a separate shared database prerequisite, not part of the application patch.

| Evidence | Actual result | Reuse / scope |
| --- | --- | --- |
| [Independent V2 engineering review](independent-review-v2.md) | ACCEPT | Static/offline acceptance of the frozen proposal; no production authority |
| [V2 VM/model/static checks](offline-verification-v2.tap) | 32/32 passed | Prior result retained; not repeated for this task |
| [Existing guarded-route/source tests](existing-tests.log) | 50/50 passed | Unchanged V1 test result retained; not repeated |
| [Five-root candidate TypeScript check](candidate-typecheck-v2.log) | Passed | Virtual paths / no emit; prior result retained |
| Application/register patch applicability | Passed previously | Check-only; neither patch applied |
| [Real isolated PostgreSQL result](POSTGRESQL-VERIFICATION.md) | 12/12 passed, exit 0 | Exact accepted SQL on PostgreSQL 17.11, synthetic new cluster; stopped and owned tree removed; not repeated |
| [Native-wrapper result](NATIVE-WRAPPER-RESULT.json) | **11/11 passed, exit 0** | Newly completed; unchanged candidate plus real auth, method, audit and timing modules, synthetic transports |

The native check covers exact cron authentication and administrator verification, denied callers, method ordering, inspection without writes/audit, persisted audit before response, delayed audit acknowledgement, failed/thrown audit insertion, stale/busy/rejected zero-change receipts, malformed write rejection and committed-but-lost acknowledgement. Supabase/auth/NHL transports are in-memory mocks; no SDK client, network listener, HTTP server or provider is used. It is not deployed JWT, PostgREST or report-delivery verification. The initial harness failed because its module resolver lacked the `utils/` alias; that harness-only failure is retained in [native-wrapper-initial-harness-error.tap](native-wrapper-initial-harness-error.tap). The resolver and realistic synthetic user response were corrected; no candidate correction was necessary.

**Confirmed audit limit:** the existing wrapper retains HTTP 200 / cache acknowledgement when a separate audit insert fails, returning `finalAudit.status=failed`. Therefore HTTP status or pg_net submission alone is insufficient. A healthy scheduled observation needs acknowledged exact-count application success **and** a persisted final audit for the correct job/slot. Unknown commit acknowledgement requires bounded receipt/readback before retry; no automatic retry is proposed.

Primary SHA-256 pins:

- Accepted `FROZEN-V2.json`: `2515e4b9e1391484656cf6a0a81d8f74c3ed6589d6309532df95edee2e8ebc41`.
- SQL prerequisite: `2175a73ba14f776547303721ec06554a65fe6e32b00882a5a18e53c97eff4570`.
- Implementation patch: `c8ff0740e81dd0760da2a5a6588e1dfe3fed5205bc9f1ce9e95916452c67e276`.
- Real-engine execution receipt: `c9529906827670be492a83ab16e71b18225f82508c3c0448b1afa526c49ff01d`.

[APPROVAL-PACKAGE-PINS.json](APPROVAL-PACKAGE-PINS.json) binds this package, native harness/result/log/source pins and PostgreSQL receipts for independent evidence readback. Original proposal/review statements that these tests were pending describe their creation time; this package records their completion.

## Recurring policy to approve

One `refresh-roster-optimizer-schedule` pg_cron → pg_net POST job at **09:50 / 21:50 UTC**, expression `50 9,21 * * *`:

`https://fhfhockey.com/api/v1/db/refresh-roster-optimizer-schedule?profile=current-next-v1&dryRun=false`

The profile pins Yahoo game key 477 / season 2026 / NHL 20262027 regular season. It refreshes full current + next New York Monday–Sunday weeks, extends to include the entire active Yahoo period, then pads one source day each side. It rejects horizons over 31 dates. For the selected October 12–18 week, ordinary periods yield **October 11–26 inclusive**, three sequential source pages. This covers the whole current week instead of allowing early-week rows to age out. Twelve-hour cadence tolerates one missed cycle at about 24 hours under the existing 36-hour gate; it does not satisfy or suppress the provisional 6-hour / near-game 2-hour warnings.

Acceptance includes conservative database capture-start receipts; >90-second recurring receipt rejection; >5-second future-clock rejection; whole-batch stale/equal no-op; missing cached identity rejection; zero recurring deletions; and shared rejection of stale/equal/contending ordinary legacy writes. DELETE statements serialize but have no monotonic tombstone protection. The old multi-statement full-maintenance route is not made atomic. Fixed season and horizon require deliberate renewal, not silent rollover. Arbitrary RSO dates, every manager timezone, separate canonical slates and forecast readiness are outside this policy.

Per scheduled invocation: at most **5 sequential NHL GETs**, 1 MiB decoded / 8 seconds per page, no redirects/retries; four metadata reads (193 accepted rows / 194 with overflow sentinel); one database clock RPC before capture; one commit RPC (at most 1000 sides, 1 MiB row JSON, internal cache read at most 1001 identities); and one separate audit attempt. Handler timer is 90 seconds, proposed pg_net timeout 120 seconds, existing configured function ceiling 240 seconds. Abort does not prove database cancellation. SQL's one-second lock timeout does not supply a general statement-duration or SQL CPU bound.

Two scheduled invocations/day allocate normally **6 / at most 10 NHL GETs**, at most 10 MiB decoded source, **14 external database requests**, and at most 2000 upserted sides / 2 MiB row JSON. Internal SQL/index/trigger work is additional; extra authenticated calls are outside the daily schedule allocation. Dollar cost, production CPU/memory, actual source population and deployed cancellation behavior were not measured. The 1000-side cap is a hard allocation, not an observed count or cost saving.

## Separate decisions and execution order

| Action | Exact target and bound | Current status |
| --- | --- | --- |
| **1. Local integration** | Apply only the five paths in `implementation.patch` in the canonical checkout; port focused mocked-wrapper regression coverage into the owning web tests; prepare the exact SQL through the repository's migration-authority workflow. Preserve concurrent work and accepted semantics. No dependency installation, schema execution, remote request or build. | Pending authorization; not attempted. The frozen artifact is the reviewable candidate. |
| **2. Shared DDL** | After bounded production parity preflight and explicit owner handback, install the four reviewed functions, two triggers and execute grants in one approved migration transaction on `public.roster_optimizer_team_games`. No table/column/index addition, existing-row rewrite, schedule repair or scheduler activation. Triggers also affect the unchanged manual route. | Pending separate authorization; not attempted. Real synthetic engine verification passed. FORGE reported its sole Oct15 writer exited; that is not DDL approval. |
| **3. Release** | Identify the integrated candidate SHA and exact web project / environment / branch. Inventory every linked Vercel project, roots, branch triggers and ignored-build behavior; record expected entries and actual builds before any push/merge/deploy. Reuse a suitable existing deployment if available. Approve the concrete candidate and expected build budget only then. | Pending; exact integrated SHA/project/build inventory cannot be supplied while integration and live metadata inspection remain prohibited. No release command or remote build occurred. |
| **4. Recurring activation** | After released-route identity, DDL, duplicate-job reconciliation, secret-reference parity and report ownership/delivery are established, register exactly the single job above using the existing Vault `cron_secret` reference. Record the real returned job ID and publish its canonical entry through the approved workflow. No secret-value retrieval, manual ingestion invocation, retry loop or second scheduler. | Pending separate recurring-write approval; not attempted. Proposed register has no real job ID. |

The DDL precedes enabling any recurring writer. Local patch application alone is insufficient. Removing the recurring job is the operational rollback; preserve cache rows/audits and leave shared guards installed unless a separate coordinated DDL change is approved.

## Finite operational preflight proposed for approval

These actions were **not performed** by this lane and are not authorized by this document. Stop on mismatch/overflow; do not expand the budget silently.

1. **Database parity:** at most five sequential, read-only catalog/settings queries, at most 1000 total returned metadata rows. Limit to the named table's columns/constraints/indexes/triggers, four proposed function names, service/anon/authenticated privileges, pg_cron/pg_net availability, advisory-key ownership evidence and effective statement/cancellation settings. No game rows, secret values, schema writes or source calls. If catalog/config evidence cannot establish a fact, record it as unresolved rather than executing a write probe.
2. **Deployment/scheduler/report parity:** at most eight sequential read-only metadata/log actions covering linked-project inventory, exact released SHA, existing matching schedules across known providers, existing secret **reference** configuration, the report's two-slot matching and delivery to one named incident owner. Unknown external scheduling remains unresolved until reconciled. No application ingestion request, deployment, setting change, notification send or raw secret output. Any required inventory beyond this cap needs a revised finite budget.
3. **Initial horizon inspection:** separately authorize one authenticated POST to the new route with `profile=current-next-v1&dryRun=true`, after release/DDL. It performs at most five sequential source GETs with the same page limits, five array reads (1193 accepted / 1194 sentinel rows) plus one clock RPC; **no commit or audit write**. Record actual horizon, source-derived count and hash as initial operational evidence, not a permanent human-approved per-cycle hash. This is the only proposed provider acquisition outside natural scheduled cycles.
4. **First natural-run readback:** at most three sequential read-only record queries, one matching cron run, pg_net response and distinct-job audit, each limited to the first scheduled invocation. Check body acknowledgement, range/count and persisted final audit; do not manually trigger the writer. On `unknown` or failed/missing final audit, hold this job as needed and seek a separately bounded cache readback before any retry.

The current report conventions provide a 13:00 UTC check that could detect two misses around 27h10m after the previous morning success, about 8h50m before 36 hours, **if report matching and delivery work**. Activation requires a named owner who receives that evidence and can act in time; no new monitoring job is included. The native wrapper results do not prove this delivery.

## Remaining boundary and ownership

The current blocker is **pending authorization for local integration and the separately bounded production actions above**, with actual production parity and exact release identity still unobserved. It is not another missing local test matrix. Engineering review and synthetic verification do not grant deployment, schema or recurring-write permission. Nothing was denied in this focused task; the older initdb sandbox block was resolved by the explicitly approved isolated run and its original failed receipt remains preserved.

FORGE's Oct15 repair is owner-reported metadata only: 22 sides / 11 games, writer exited and lease consumed. It does not establish Oct12–18 whole-week, Yahoo-period, next-game or forecast-to-page readiness. This lane holds no real Oct11–19 game inventory or allowlist; its game examples are synthetic. FORGE owns its separate planning-only whole-week guarded-route proposal, while this lane owns only these recurring artifacts. No approval/attempt/private pilot files were read or altered.
