# Post-Drift Retry Verification

## Purpose

This document records the operational verification run for task `8.3` after:

- the live drift audit concluded no corrective migration was needed
- Supabase types were regenerated from the current target project
- sampled NHL raw ingest was retried against the recon game set

Verification date:

- March 30, 2026

## Actions Performed

### 1. Corrective Migration Decision

Result:

- no corrective migration was applied to the current target project

Reason:

- `tasks/corrective-migration-decision.md` recorded that the target project already matches the phase-1 migration contract

### 2. Supabase Type Regeneration

Executed:

- `npx supabase gen types typescript --project-id fyhftlxokyjtpndbkfse --schema public`

Target file:

- `web/lib/supabase/database-generated.types.ts`

Result:

- completed successfully

### 3. Sampled Raw-Ingest Retry

Executed:

- `node web/scripts/ingest-nhl-api-raw.mjs 2025021018 2025021103 2025021003 2025021119 2025021171 2025021140 2025020982 2025021172 2025021170 2025021169`

Result:

- completed successfully
- no schema-drift error occurred
- all sampled games returned successful ingest summaries

## Returned Ingest Summary

| gameId | roster rows | event rows | shift rows | raw endpoints stored |
| ---: | ---: | ---: | ---: | ---: |
| 2025021018 | 40 | 389 | 782 | 4 |
| 2025021103 | 40 | 318 | 706 | 4 |
| 2025021003 | 40 | 366 | 776 | 4 |
| 2025021119 | 40 | 280 | 744 | 4 |
| 2025021171 | 40 | 353 | 708 | 4 |
| 2025021140 | 40 | 336 | 683 | 4 |
| 2025020982 | 40 | 350 | 718 | 4 |
| 2025021172 | 40 | 280 | 735 | 4 |
| 2025021170 | 40 | 351 | 772 | 4 |
| 2025021169 | 40 | 327 | 662 | 4 |

## Direct Database Verification

Verified directly in the target Postgres catalog:

- each sampled game has exactly `1` raw row for each endpoint:
  - `play-by-play`
  - `boxscore`
  - `landing`
  - `shiftcharts`
- each sampled game has exactly `40` roster rows
- event-row counts match the ingest return payload
- shift-row counts match the ingest return payload

## Conclusion

Task `8.3` verification passed for the current target project.

The earlier schema-drift failure path is no longer present in this environment.

Operationally:

- live schema is aligned
- generated types are aligned
- sampled raw ingest is aligned
- direct table counts confirm the rerun succeeded
