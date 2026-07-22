# SKO Compatibility Pipeline Runbook

Date: 2026-07-22

Status: inventory and failure-response runbook only. There is no approved executable SKO modeling pipeline.

## Ownership and boundaries

- Supported Trends and FORGE do not use this pipeline. They retain their separate canonical contracts.
- `update-sko-stats` is the protected compatibility source writer. Production pg_cron job 321 calls it at `30 10 * * *` with the Vault-backed `cron_secret` Authorization header.
- `update-predictions-sko` is the protected moving-average v0.2 compatibility writer. Production pg_cron job 327 calls it at `45 10 * * *` with the same header source.
- `functions/lib/sko_pipeline.py` is only an HTTP sequencer. It contains no feature, training, scoring, metric, upload, cleanup, queue, lock, or persistence implementation.
- `functions/api/index.py` contains dormant Flask routes. The exact Production functions deployment currently serves `/api/healthz` but not `/sko/pipeline`; the configured pipeline destination is absent and returns Vercel 404.
- Restoring a route, stage executor, modeling implementation, schedule, or consumer requires the NEW 9.3 ownership decision and separate deployment/data authorization.

## Environment names

Values must never appear in this runbook or logs.

| Runtime | Name | Required behavior |
| --- | --- | --- |
| Next.js compatibility writers | `CRON_SECRET` | Required by the shared fail-closed admin/cron boundary. |
| Python HTTP sequencer | `SKO_PIPELINE_ENDPOINT` | Required nonblank endpoint; absence stops before any request. |
| Python inbound/outbound auth | `SKO_PIPELINE_SECRET` | Required nonblank bearer; absence stops inbound and outbound work. |
| Supabase scheduled callers | Vault `cron_secret` | Header source for jobs 321/327; value is never returned or recorded. |

## Stage inventory

| Named stage | HTTP timeout | Current executor | Historical artifacts | Expected rows/state |
| --- | ---: | --- | --- | --- |
| `backfill` | 120s | Absent | `sko_backfill_state.json`, feature parquet files | Unknown; no current manifest/run identity contract. |
| `train` | 240s | Absent | `sko_metrics.parquet`, holdout parquet files | Unknown; deleted scripts/models are not executable evidence. |
| `score` | 120s | Absent | `sko_predictions.parquet` and nested older copies | Unknown; live moving-average writer is a different implementation. |
| `upload` | 120s | Absent | None proving a current upload run | Unknown; no current metric table or upload owner. |

The enclosing Python function has a 240-second platform limit and 1,024 MB memory. Sequential default timeouts total 600 seconds, so the full four-stage sequence cannot be claimed platform-safe. There is no cleanup stage, retry, durable cursor, run ID, checksum, lock, lease, resume state, partial-failure persistence, or stale-run recovery.

## Commands and safe checks

No operational stage command is approved because no stage executor exists.

Safe local verification:

```bash
python3 -m pytest -q functions/tests/test_sko_pipeline.py
python3 -m py_compile functions/api/index.py functions/lib/sko_pipeline.py functions/tests/test_sko_pipeline.py
```

Safe deployed health check: `GET https://functions-fhfhockey.vercel.app/api/healthz`.

Do not POST to `/sko/pipeline` or `/sko/pipeline-step`, invoke the compatibility writers, restore deleted scripts, or replay retained artifacts as operational input without explicit authorization and an approved owner.

## Failure contract

- Missing pipeline endpoint: return failure with zero requested steps.
- Missing inbound or outbound pipeline secret: fail closed before dependency or network work.
- Missing/invalid bearer: return 401.
- Unknown stage: fail before an outbound request.
- Placeholder stage route after valid auth: return 501 with `implemented=false`; never return accepted/success.
- External non-2xx or request exception: mark the step failed and stop the sequence. No automatic retry occurs.
- Current deployed `/sko/pipeline`: Vercel 404 because the configured destination does not exist. This is reachability evidence, not a healthy pipeline.

## Artifacts and retention

- `web/scripts/output/sko_*` is retained historical evidence from the deleted local implementation.
- `web/web/scripts/output/sko_*` contains four older unreferenced copies governed by NEW 9.12.
- No retained parquet/CSV/JSON file is a current model, stage checkpoint, recovery cursor, or publishable source of truth.
- Archive/removal requires version/checksum provenance under 8.4 and the existing B-DEAD decision; no artifact cleanup is implied here.

## Rollback and recovery

- The local hardening changes no database row, schema, deployment alias, route mapping, schedule, artifact, or credential. A code rollback is a normal reviewed revert, but must never restore fail-open auth or false-success behavior.
- There is no data rollback procedure because no approved stage writes exist. Any future stage owner must define atomic outputs, run identity, idempotency, partial-failure recovery, and rollback before first execution.
- Production route restoration must first prove fail-closed 401 behavior, honest unavailable-stage behavior, exact source deployment, bounded runtime, and zero unintended stage work.
