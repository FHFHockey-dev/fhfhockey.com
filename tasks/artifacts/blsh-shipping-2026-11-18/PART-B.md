# November 19 disabled-path readback

For the existing Claude BLSH Chef and hosted operator. Read the two naturally occurring firings for November 19, 2026 (UTC). Registration and the switch-off readback are recorded in the [November 16 receipt](../blsh-pilot-readiness-2026-11-14/v6-schedule/SCHEDULE-APPLY-RECEIPT.md). This checklist calls for passive evidence only.

| Job | Scheduled UTC | Method and path | Expected application result |
| --- | --- | --- | --- |
| 404, blsh-native-capture | 12:05 | POST /api/v1/db/blsh-native-capture | HTTP 200, success true, skipped disabled, sourceDate 2026-11-18 |
| 405, blsh-native-capture-backup | 12:20 | Same | Same. Record this response separately. |

1. Read each job's existing row in `cron.job_run_details` for its slot. Preserve jobid, runid, start/end UTC, status and sanitized return_message. Record the actual dispatch time and any queue delay. Use job 404 and 405 and the two slot windows, bounded to 12:05–12:30 UTC. If the job is absent, label it missing. If failed, record the scheduler failure.
2. While pg_net's response is retained, correlate to the actual HTTP request ID if the logs have it. Read that response's id, created, status_code, timed_out, error_msg and the whitelisted JSON outcome fields. Check the production Vercel route log, method, UTC, deployment ID, Git SHA, region and request ID. The invoker enqueues asynchronously and the schedule does not persist its return value in a job-to-request mapping. pg_cron runid and pg_net request id have different meanings. Without an explicit ID require a unique match across the slot, path, time, application body and runtime log. Multiple plausible matches or missing application evidence leave the application disposition unknown. Do not retain headers, keys or unrelated response bodies.
3. Record each result as observed. The native route wrapper can write its normal cron_job_audit row even on a skip; that row may corroborate time and response. It is separate from a native date claim. The expected response demonstrates bearer acceptance, clock gate, required environment, runtime precheck and a readable off switch. The handler returns there, before the observer self-test, claim, schedule GET or NST admission. A cron success or HTTP status alone does not establish those prechecks. A fence skip, timeout, refusal, different source date, unacknowledged claim or unexpected enabled work gets its own disposition. On any unexpected work stop and alert the existing operator/Scout; do not invoke the route.
4. Return two sanitized rows and their receipt pins to Scout/BLSH. Jobs 406 and 407 at 12:50 and 12:52 are separate reconciliation jobs. Keep the existing jobs and switch in their current operator-owned state. Do not initiate a retry, fallback, provider request or manual probe.

November 17 v5 remains unknown. Its operator's terminal attestation, exit record or consumed-date evidence is the only basis to update that disposition.
