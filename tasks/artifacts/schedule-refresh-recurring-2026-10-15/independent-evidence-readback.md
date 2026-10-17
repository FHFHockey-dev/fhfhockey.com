# Independent evidence readback — recurring schedule refresh V2

Recorded 2026-10-16T01:37:15.644585+00:00.

**Verdict: ACCEPT the bounded evidence package. No concrete actionable finding.** The prior V2 source/SQL acceptance is preserved unchanged. This updates the record of completed local verification; it grants no integration, source acquisition, database/schema, release, scheduler or recurring-write authority.

## Exact accepted evidence

- `APPROVAL-PACKAGE-PINS.json`: `2abe7fa1fc7eecbf9527823e658e76200cbf2f34e091e40d80031c15424ba4b5`.
- `APPROVAL-PACKAGE.md`: `cb16d7324f89843c392976a701ec06ab87199ed645712ca7b442f742680a8c85`.
- `NATIVE-WRAPPER-RESULT.json`: `b384cb0162b870644a4e40cc1670dc5417b21d06672003b3f07dda5712a916dc`.
- `NATIVE-WRAPPER-PINS.json`: `46e4679a7772c44f5b80d8c49fddb6d16eadf49c16bd219106654bd649636de2`.
- `native-wrapper-verification.cjs`: `cd9c7e2b70dba4215f40e5e55766610bc4f340d6619ba4ac4622104c73702f43`.
- `native-wrapper-verification.tap`: `57fd63b28bbb7bba1d14d85cf2e2d6e3828da6f30d41008a5f46fc68bd277e44`.
- `native-wrapper-initial-harness-error.tap`: `5dcbfc5f917dbcd97e30b4b21e34d232b3ad4e6b0e345b75237b0ad11e849707`.
- Accepted `FROZEN-V2.json`: `2515e4b9e1391484656cf6a0a81d8f74c3ed6589d6309532df95edee2e8ebc41`.
- Prior `independent-review-v2.md`: `e4ac84c60b6cb9bcb4f8b3c91d481658bab5a6d6280062bc797928b06e8cd895`.
- `POSTGRESQL-VERIFICATION.md`: `c44692642145dad194240a9ba6488830f6c0f676d2efdecaed64052e70d14a2f`.
- Reused `postgres-preparation/ESCALATED-EXECUTION-RESULT.json`: `c9529906827670be492a83ab16e71b18225f82508c3c0448b1afa526c49ff01d`.
- `postgres-preparation/execution-pins.json`: `64e789bbd994ee8fb3608317e6e632923b9a4dcd2ecd3c8993a49b3239a96ba6`.
- `EVIDENCE-READBACK-REQUEST.md`: `252080b451b5f5af51dd92c56c07026d852ba9fc510bea9066d8cde078e997eb`.

All 12 package-bound files and all 22 prior V2 frozen files hash correctly. The five native wrapper source pins, four unapplied application anchors and all 15 original source bindings match current disk. The proposed route and recurring helper remain absent from their application paths. This supports the package's local unapplied-state claim; no live deployment/schema/job inspection was performed.

## New native wrapper evidence

Inspected the complete new harness and retained 11/11 TAP result. Each of the 11 TAP case names matches the structured result, with zero failures. The harness verifies its own hash and frozen files, reuses only the existing fixture preamble before its first test registration, and replaces the prior wrapper shim with the real pinned `withOperationalRouteAuth`, `adminOnlyMiddleware`, `withCronJobAudit`, `timingContract` and `formatDuration` module sources. Candidate source is transpiled and evaluated unchanged in the VM. The added `utils/` seam maps to the actual pinned administrator middleware, not a substitute auth implementation.

The synthetic Supabase service client, bearer verification/role responses, database RPC/model, source fetch, environment and response object remain explicit test substitutes. The loader denies unexpected imports and forbids the old unbounded NHL readers. No real SDK client is imported; no server, database connection or real credential is needed. These are real wrapper-code integration checks with synthetic transports, not deployed HTTP/JWT/PostgREST verification or another SQL engine run.

Assertions establish:

- Exact synthetic cron credential success and verified synthetic-admin role flow; missing/invalid/unverified/non-admin/empty-secret denial before source/RPC/audit; spoofed localhost header from a remote peer denial.
- Authentication before POST method enforcement; no audit or source work for rejected methods; inspection through authentication with no commit/audit; malformed explicit write audited as not-attempted before source/RPC work.
- One exact job audit with row count and audit timing/source fields on acknowledged application success; audit acknowledgement awaited before the response flushes once.
- HTTP 200 and cache `acknowledged` remain true when the separate audit transport fails/throws, with finalAudit explicitly `failed`, one insertion attempt and no invented persisted row. A healthy scheduled observation therefore requires both acknowledged exact-count application and persisted final audit.
- Explicit stale/busy/rejected transaction receipts remain HTTP409/not_applied with zero rows; a model commit followed by a lost RPC acknowledgement remains `unknown`, with null audited row count and a failure audit. The test does not pretend its transaction model is PostgreSQL.

The fixed synthetic clock and delayed acknowledgement gate verify wrapper behavior/order, not real elapsed-duration accuracy, audit transport deadlines or deployed cancellation. The package does not claim those were established. The initial 11 failures from the missing utils alias remain intact and are correctly classified as harness setup failures; correcting the resolver and synthetic auth response required no candidate change.

## Reused evidence and completed engine status

The package correctly distinguishes the new 11 wrapper tests from retained 32 VM/model/static checks, 50 prior guarded-route/source tests, five-root virtual no-emit typecheck, patch applicability and the separate 12-case PostgreSQL result. Those older checks were not repeated in this readback. Original frozen status fields describe their creation time and are not silently rewritten.

Read the PostgreSQL summary/structured receipts, isolation metadata, pinned runner's setup/hash/cleanup boundaries and retained startup/case/shutdown evidence. All engine receipt evidence hashes and three fixture hashes match. The log contains 12 PASS entries agreeing with the structured result: ordering across supported isolation levels, equality, mixed batch, contention, both direct/recurring directions, late-row rollback, moved identity, missing identity and role denial. It records PostgreSQL17.11, a new synthetic Unix-only cluster and the exact accepted SQL. The original zero-case initdb denial remains separately retained. This readback reuses that actual engine evidence; it did not rerun or connect to PostgreSQL.

The retained server log records shutdown, and both recorded owned temporary paths are currently absent. No server-state probe, process/cluster action or cleanup was performed by this reviewer. Synthetic schema/role/isolation success does not establish hosted PostgreSQL/version/RLS/trigger/advisory-key/cancellation parity.

## Action and resource boundaries

The package keeps four separate pending decisions: five-path local integration/testing through the repository migration workflow; bounded parity preflight plus shared four-function/two-trigger DDL and owner handback; exact integrated SHA/project/branch/environment release with cross-project Vercel build inventory; and a single recurring job activation after secret-reference/report-owner/delivery reconciliation. Existing consumed one-day repair authority is not reused. No real job ID or integrated release SHA is fabricated.

Scheduled write allocation remains at most five sequential 1MiB/8s NHL pages, four bounded metadata reads (193 accepted/194 overflow-sentinel rows), one pre-capture database clock RPC, one commit RPC (1000 sides/1MiB input; internal cache read at most1001) and one separate audit attempt: seven external database operations per cron invocation, at most14/day for two slots. Internal SQL/index/trigger work and extra authenticated calls are additional. The90s handler timer,120s proposed pg_net timeout and240s function ceiling are distinct and do not prove server cancellation or SQL/audit CPU/time bounds. The normal three-page/six-daily-page number is a horizon assumption, not observed initial game population or measured dollar savings.

The proposed one-time inspection separately permits five array reads (1193 accepted/1194 sentinel rows) plus clock, the same bounded source pages and no commit/audit. Five database-parity queries/1000 metadata rows, eight deployment/scheduler/report metadata/log actions, and three first-natural-run readback queries remain finite proposals pending authorization. Unknown acknowledgement or failed/missing final audit requires separate bounded reconciliation before retry. Proposed cadence, warning ages, owner response and report matching/delivery remain conditional, with no blanket whole-week or forecast readiness claim.

## Checks actually performed and remaining limits

Performed read-only source/harness/log inspection, SHA-256 verification and structured-result/TAP/count consistency checks, plus absence checks for named unapplied application files and removed owned temporary directories. No test suite, compiler, SQL engine, HTTP route, provider, database, scheduler, deployment or build was executed. No private one-time approval/attempt/pilot, environment or credential data was opened. Only this new exclusive report was written; all earlier reports/frozen artifacts remain unchanged.

Remaining gates: actual production schema/roles/cancellation, current horizon population/source freshness, deployed auth/transport integration, exact release identity, duplicate scheduler/secret-reference parity and named report/incident-owner delivery. Acceptance of this evidence package supplies no action authority. Runtime model/reasoning settings were not exposed or independently verified.
