# Operational-table consumer trace — 2026-10-29

Read-only scope: `public.cron_job_audit`, `public.job_locks`, `public.acquire_lock(text,interval)`. No application data, request bodies, URLs with query strings, account identifiers, credentials, or raw job commands were retrieved. No hosted SQL, policy, setting, deployment or schedule was changed.

## Deployment and source boundaries

At the time of this trace, read-only Vercel metadata resolves the `fhfhockey.com` production alias to READY deployment `dpl_EWsgH9tqSEriPPS1iiNms4WF7vj3`, Git commit `fec2ba2d29873525d1bead853ee3ff659b892a5c` on `master`. The commit is available locally and deployed source was inspected with `git show`; no application request or deployment was made. The canonical checkout was `octoberBranch` HEAD `5453d2ecaa9399d3161fd6a150331d08107f0e4f`, with modified cron files and an untracked audit helper. Current local behavior is not automatically deployed behavior.

The deployed `web/vercel.json` contains 30 cron definitions; 28 entries map to 19 distinct route source files that directly call `withCronJobAudit`. The remaining two mapped source files do not directly reference that wrapper. This is a **source configuration inventory**, not independent proof that each Vercel schedule is enabled or ran.

## Confirmed paths and implications

| Consumer | Evidence and effective role | Impact of candidate table restrictions |
| --- | --- | --- |
| Shared cron audit wrapper | Deployed `web/lib/cron/withCronJobAudit.ts` imports `lib/supabase/server` and INSERTs audit rows. That client is built with `SUPABASE_SERVICE_ROLE_KEY`. | Candidate leaves service grants and BYPASSRLS unchanged. Audit INSERT must remain available; otherwise many wrapped jobs can lose audit reporting. |
| Cron report | Deployed `web/pages/api/v1/db/cron-report.ts` constructs a service-role client and SELECTs audit rows for the report and success history. | Service SELECT is retained. A browser/direct anonymous consumer of the table would lose SELECT; the service-backed report is not intended to lose it. |
| Rolling averages | `update-rolling-player-averages.ts` passes `supabaseServer` to `readRollingDailyResumeState`, which reads audit details for conditional continuation. These files match the deployed commit. | Service SELECT is retained. Losing it could interrupt resume admission; do not remove it. |
| NST gamelog | Deployed route explicitly constructs a service-role client, INSERTs audit events and SELECTs progress. | Service SELECT/INSERT are retained; do not narrow them. |
| WGO and shift charts | Deployed WGO goalie, skater, totals and shift-chart routes import the service client and directly INSERT audit rows. Local modified versions use a manual-audit helper for some of those paths. | Service INSERT is retained. Distinguish the deployed code from the uncommitted local helper. |
| Game-prediction health | `health.ts` passes `req.supabase` to a health reader that SELECTs the audit. Deployed `adminOnlyMiddleware.ts` attaches the service-role client after cron/local-dev admission or verified admin authorization. | Service SELECT is retained. No evidence here that the browser directly reads the audit table. |
| Yahoo, Fantrax, ESPN, Patreon and Google Sheets | Deployed integration route source for Yahoo live draft, Fantrax sync, ESPN sync, Patreon reconcile and Yahoo-to-sheet uses the shared audit wrapper. The source demonstrates an audit dependency, not that each integration was active or that a provider directly accesses the table. | Service INSERT remains necessary. No provider-specific privileges should be inferred. The hosted pg_cron Yahoo-to-sheet entry was inactive at inspection. |
| `acquire_lock` and `job_locks` | Hosted `acquire_lock(text,interval)` is SECURITY INVOKER; its body INSERTs/UPDATEs `job_locks`. The catalog source-text search found no other stored function literally naming these targets, and no repository application caller was found. | Table candidate denies browser roles; an invoker using either role loses table access. Service-role SELECT/INSERT/UPDATE/DELETE remain. Function candidate separately removes PUBLIC EXECUTE, potentially affecting every other role that inherited it. External SQL/RPC callers remain unknown. |

Read-only hosted `cron.job` metadata had 72 jobs, 58 active. No command text literally contained `cron_job_audit`, `job_locks` or `acquire_lock`. Active WGO goalie/skater/totals and weekly rolling jobs were identified as `net.http_get` calls to their corresponding FHFH routes; their job owner is `postgres`, while the routed application's database client is service-role. The old pg_cron `daily-cron-report` entry was inactive; the deployed Vercel source config also defines a cron-report schedule. None of this proves that HTTP calls succeeded or that dynamically constructed commands and untracked consumers do not exist.

Searches of the checked-in application, `functions/`, `cms/`, `web/scripts/`, `supabase/functions/`, SQL/migration sources and GitHub workflows found no additional literal app call to `job_locks` or `acquire_lock`. Literal-name and stored-body searches cannot discover aliases, dynamic SQL, jobs in another service, private scripts, or external consumers. The source file that mentions `acquire_lock` in the 2026-07-31 migration only pins its search path; it is not evidence of a caller.

## Observed request roles — bounded evidence

One aggregate query over Supabase `edge_logs` from **2026-10-28 13:42 UTC to 2026-10-29 13:42 UTC** selected only the exact Data API paths for the three targets and grouped by method, logged JWT/API-key role claim, HTTP status and client library family. It returned:

| Exact target | Method | Logged role claim | Status | Events |
| --- | --- | --- | --- | ---: |
| `cron_job_audit` | GET | `service_role` | 200 | 1 |
| `cron_job_audit` | GET | `service_role` | 206 | 17 |
| `cron_job_audit` | GET | `service_role` | 500 | 2 |
| `cron_job_audit` | POST | `service_role` | 201 | 9,477 |

All matching events carried a `supabase-js` client-info family. No `anon` or `authenticated` claim and no exact-path `job_locks` or `acquire_lock` event appeared in that window. These are logged HTTP events, not unique jobs or a guarantee of complete logs, and the client-info value is self-reported. The two 500s have not been attributed to a route or cause. Direct Postgres connections, alternate paths, older or less frequent requests, and dynamic calls are not covered. The result does **not** authorize removal of browser or PUBLIC access.

For reproducibility, the aggregation selected `source='edge_logs'`, the three exact `/rest/v1/...` paths, and only `request.path`, `request.method`, `request.sb.jwt.authorization.payload.role` (falling back to the API-key role claim), `response.status_code`, and the classified client-info family. It did not retrieve request IPs, request parameters, request bodies or individual events.

## Role and policy snapshot

At 13:51 UTC, each table still had RLS enabled and the single permissive `TO PUBLIC FOR SELECT USING (true)` policy. Their table ACL was `{postgres=arwdDxt/postgres,anon=arwdDxt/postgres,authenticated=arwdDxt/postgres,service_role=arwdDxt/postgres}`; no explicit column grants were found. `postgres`, `service_role` and `supabase_read_only_user` have BYPASSRLS. The candidate changes the policy for every role subject to it, so preflight all effective roles again, not just Data API roles.

The function's ACL was `{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}`. Removing PUBLIC EXECUTE affects other roles that inherit that grant, including currently visible non-superuser login roles such as `authenticator`, `cli_login_postgres`, `pgbouncer`, `supabase_auth_admin`, `supabase_functions_admin`, `supabase_read_only_user`, `supabase_replication_admin` and `supabase_storage_admin`, unless they have another effective route to EXECUTE. Their actual function use is unknown. The owner and directly granted service role keep EXECUTE. No role-level `pgrst.db_pre_request` setting was found, but this does not exclude configuration supplied elsewhere.

## Safe order, exact scripts and rollback

1. Parent/coordinator should relay this trace to the current cron/report and Claude owners without reallocating their paths or lock. Request a concrete inventory of direct browser clients, custom SQL roles, external consumers, retention/maintenance operations, and any scheduled use of the lock function. **No owner acknowledgment or approval has been obtained by this lane.**
2. Keep the [future-object proposal](01-future-forge-grant.sql) separate from these legacy changes. Coordinate the FORGE source owner and recheck post-October-30 creator defaults. Its SHA-256 is `c7c6e4c41d341a9d79293de8a44d2f714997cb0c5b9760bac53f097d4f1425b0`; its rollback depends on the actual pre-change ACL, as detailed in [CANDIDATE.md](CANDIDATE.md).
3. After consumers are resolved, re-snapshot target ACLs, column grants, roles/memberships, RLS policies, views and the function body; compare with this point-in-time evidence. Only then could the object-specific table candidate be reviewed: [02-legacy-operational-tables.sql](02-legacy-operational-tables.sql), SHA-256 `2a4ac67b7b26641d1d070d29e76a5e01c03260b7d4e8b4b124b715c3bf847fe3`. It leaves service grants unchanged. Its observed-state rollback is [02-legacy-operational-tables-rollback.sql](02-legacy-operational-tables-rollback.sql), SHA-256 `fbd635e22601ccf5a9168ab7c6a26ca2ab6c05f4a4c1566c52c955e8b9b6ad32`; rollback restores public SELECT and the original broad direct browser grants.
4. Treat [03-legacy-acquire-lock-function.sql](03-legacy-acquire-lock-function.sql), SHA-256 `93676c4af03cdce6a0e9794b4c492b039a87e091ecd9d944ce5f705d1e659852`, as a separate decision because PUBLIC covers non-browser roles. Its observed-state rollback is [03-legacy-acquire-lock-function-rollback.sql](03-legacy-acquire-lock-function-rollback.sql), SHA-256 `0d5fd4ebc48a708fa22f61a296058e84644ba4de6f2852c3e62a42561429fc11`; rollback restores PUBLIC and direct browser EXECUTE.
5. Before any later authorized change, rerun isolated role/rollback fixtures and app tests on the exact candidate and owners' accepted code. Existing [LOCAL-TEST-RECEIPT.md](LOCAL-TEST-RECEIPT.md) records a PostgreSQL 15 synthetic fixture pass, including service audit insert/read, service invoker lock, and rollback; it is not a PostgREST/JWT or full-production replay. Any hosted apply, rollback, production request, push or deployment needs its own explicit authorization with project, exact SQL/hash/order, impact and bounds. Do not trigger cron, ingestion, purge or production routes to test.

## Coordination and provenance

The coordination mailbox records an accepted/frozen cron-report packet and a separate October 29 Yahoo cron-health task. Claude's lease file still records the earlier T3-C3 cron investigation as active, but its status is dated and was not independently verified. At the checkpoint Claude BLSH owned the shared heavy lock; this trace neither acquired nor changed it. No shared mailbox, lease file, cron source, Claude-owned file, hosted ACL or setting was edited.

Deployed source SHA-256: `web/lib/supabase/server.ts` `fe4c82f9fd5dc0566eb6a5717c445cbb24f5e5b018061cfb1d1b224b57b4a0bc`; `web/utils/adminOnlyMiddleware.ts` `de749fa9e811aacbbd1c85a080140f380fd8c3d3794ad378caa9dd4025f444c5`; `web/lib/cron/withCronJobAudit.ts` `02790f98626c71accd9bdb0b01a2e9da95799a254c14b98ad82a94bfca635094`; `web/pages/api/v1/db/cron-report.ts` `2c3bfbd09db3562a22cf592c20cc7c0e3dd5fcb5a7a57a3fc6a586343644441b`; `web/vercel.json` `bcd2cab8174bead693c7a4268ce2dd44ea551c9dfa92736b347868a0ebac2d2b`. Other inspected deployed files and hashes are available from `git show <commit>:<path>`; the current working versions of the wrapper and report differ.
