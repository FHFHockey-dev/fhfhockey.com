# SKO Compatibility Pipeline Runbook

Date: 2026-07-22

Status: inventory and failure-response runbook only. The owner authorized the absent modeling pipeline as historical-only on 2026-07-28; there is no approved executable SKO modeling pipeline.

## Ownership and boundaries

- Supported Trends and FORGE do not use this pipeline. They retain their separate canonical contracts.
- `update-sko-stats` is the protected compatibility source writer. Production pg_cron job 321 calls it at `30 10 * * *` with the Vault-backed `cron_secret` Authorization header.
- `update-predictions-sko` is the protected moving-average v0.2 compatibility writer. Production pg_cron job 327 calls it at `45 10 * * *` with the same header source.
- The local release candidate runs prediction publication only for an `asOfDate` inside the official regular-season boundaries returned by the canonical season owner. Offseason requests finish as successful no-write manifests before source queries; an in-season source lag over 72 hours finishes with a stable warning and zero prediction upserts. Explicit historical in-season dates remain available only for an independently authorized one-off population manifest.
- Local candidate migration `20260728225806` adds a service-only per-model/date/horizon execution lease and latest-run manifest for this compatibility writer. The route rejects overlap with 409, heartbeats long runs, owner-safely records completion, and returns/persists/logs stable failure, partial-write, and selected-versus-written health verdicts. Warning verdicts are retained by `withCronJobAudit` and surfaced as warning counts in the existing daily cron operator email. Do not claim the control live until the migration and matching code are published and observed.
- Local candidate migration `20260729205048` changes `predictions_sko` identity to player/date/horizon/model-name/model-version and explicitly leaves `anon`/`authenticated` with SELECT only. The compatibility writer uses that exact conflict target; the reader accepts bounded model filters and adds model identity to stable ordering. Existing rows need no backfill rewrite, but do not claim history preservation live until the migration is applied and verified.
- `functions/lib/sko_pipeline.py` is only an HTTP sequencer. It contains no feature, training, scoring, metric, upload, cleanup, queue, lock, or persistence implementation.
- `functions/api/index.py` contains dormant Flask routes. The exact Production functions deployment currently serves `/api/healthz` but not `/sko/pipeline`; the configured pipeline destination is absent and returns Vercel 404.
- Restoring a route, stage executor, modeling implementation, schedule, or consumer would require a new approved initiative plus separate deployment/data authorization; NEW 9.3 closed by choosing no restoration.

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

## Offseason Production evidence cohort

The owner accepts one explicit historical in-season population as the seasonal writer's temporary Production evidence until the next official season opens. Once the acceptance controls below pass, this cohort satisfies the writer's otherwise unavailable in-season Production evidence gate for the offseason. This is an operator-invoked compatibility run, not a natural scheduled run and not a model promotion.

- Exact target: `asOfDate=2026-03-22`, `horizon=5`, `lookbackDays=120`, `model_name=baseline-moving-average`, `model_version=v0.2`.
- Read-only hosted preflight: 324 same-day source rows/players; 851 distinct qualifying lookback players; 27,359 qualifying lookback rows; zero existing rows at the exact target identity; value-free input-player digest `0ab825ccbf3a185d1c72f3fc7eb72227`.
- Prerequisites: apply `20260728225806_add_sko_prediction_run_control.sql` and `20260729205048_preserve_sko_model_history.sql` before publishing the matching code. Then run the protected route once with `dryRun=true` and require 851 would-write rows, zero upserts, zero stale-source warning, and a retained SHA-256 identity-scope digest.
- Mutation gate: request separate authorization quoting the dry-run digest/count. The authorized call must omit `dryRun`, return the same scope digest, write exactly 851 rows, and leave unrelated date/horizon/model identities unchanged.
- Rollback: because the exact target has zero preexisting rows, delete only `(as_of_date='2026-03-22', horizon_games=5, model_name='baseline-moving-average', model_version='v0.2')` after matching the retained digest/count. A rollback authorization is required before deletion.
- Acceptance: exact post-count/digest parity, idempotent replay with no count change, successful run-manifest/cron-audit receipts, empty bounded runtime-error evidence, and a separate natural offseason no-write observation. Preserve these receipts as the writer's Production evidence until the first successful natural in-season run supersedes them.

## Rollback and recovery

- The local hardening changes no database row, schema, deployment alias, route mapping, schedule, artifact, or credential. A code rollback is a normal reviewed revert, but must never restore fail-open auth or false-success behavior.
- There is no data rollback procedure because no approved stage writes exist. Any future stage owner must define atomic outputs, run identity, idempotency, partial-failure recovery, and rollback before first execution.
- Production route restoration must first prove fail-closed 401 behavior, honest unavailable-stage behavior, exact source deployment, bounded runtime, and zero unintended stage work.

## Latest bounded deployment evidence

- Exact checkpoint `053f3558fdd1d99759aa087a60f369e21813fb64` is READY as branch deployment `dpl_EDiTZFRS1LASCS5iLFC4SWpqHQVm` (`target=null`).
- GET-only checks on its branch alias return 200 for `/api/healthz` and Vercel 404 for `/sko/pipeline`; no POST, auth-path request, or stage execution occurred.
- Customer Production remains on the separately recorded older source and was not changed. The branch proof validates buildability and preserved non-reachability, not an operational pipeline.
