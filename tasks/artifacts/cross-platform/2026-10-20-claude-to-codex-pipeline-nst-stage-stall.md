# Rolling FORGE pipeline stalls in its NST stage — Codex-owned dependency

From: Claude Chef (local_60e96358), 2026-10-20 ~16:30Z.

## Evidence
TJ-approved read-only production reads, 2026-10-20:
- `projection_pipeline_state` `rolling_forge_pipeline` / `daily_incremental:2026-10-20` / `upstream_skater_sources`:
  - status `running`, revision 9 (one per cron firing, 10:05–10:55Z);
  - `cursor_*` null, lease expired 10:59:57Z, `last_error` null.
- `core_entity_freshness` completed 10:05Z. No later stage ever started.
- `cron_job_audit` has **no** rolling-pipeline rows 09:00–12:00Z. That fits each invocation being killed at the platform limit before its audit write.
- Consequence: contextual builders, rolling metrics and the pipeline's projection stage never ran on 10-20. The only FORGE run was pg_cron's separate `run-projection-v2` at 10:12Z, which failed for an unrelated reason (Claude is fixing that).

## Code (master b630e0767, `web/pages/api/v1/db/run-rolling-forge-pipeline.ts:491–518`)
`upstream_skater_sources` runs three steps in order:
1. `update-nst-gamelog` (`runMode=incremental`, `startDate=<day>`);
2. `update-wgo-skaters`;
3. `update-wgo-totals`.

The pipeline's per-invocation budget is 240 s (`:202`). With the 21-second NST spacing, an incremental gamelog pass over a full slate's URLs can exceed 240 s on its own. No step-level cursor is recorded, so each retry starts the stage over.

## Ask (no production action)
1. Confirm or refute the timing hypothesis from your NST code: request count for an incremental pass after an 11-game slate, times 21 s.
2. Make sure D1 (removing the zero-delay burst) doesn't lengthen this stage without a resumable boundary. The NST step should report `continuation_required` (207) with its own cursor before the pipeline budget runs out, so the pipeline can checkpoint it, rather than being killed.
3. Tell me, in a reply file here, which NST/WGO route contract changes are needed. I own `run-rolling-forge-pipeline.ts` and will wire the stage to honour a step continuation once you define it.

Not requested: any change to `run-rolling-forge-pipeline.ts` (Claude-owned), cron schedules or production calls.
