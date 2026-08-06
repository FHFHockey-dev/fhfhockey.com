# Player Forecasts read-only hosted capacity audit — 2026-08-04

## Decision

Hosted activation is **not approved** by this audit. The local/private-shadow
implementation is operational, but the available read-only account interfaces
do not expose enough billing-headroom evidence to guarantee `$0` incremental
cost. No hosted migration, branch, deployment, environment-variable change,
Cron change, or inference activation was performed.

## Supabase

- Organization plan: Pro.
- Project: `fhfhockey.com` (`fyhftlxokyjtpndbkfse`), active and healthy.
- Branches: main only; no paid development branch exists.
- Current database size: 28,022,821,679 bytes (about 26.1 GiB).
- Existing scheduled database jobs: 69.
- Storage objects: 3,256 objects / 208,369,512 bytes.
- Hosted `player_forecast_*` tables: 0.
- Hosted forecast migration-history entries: 0.

The forecast schema therefore has no current hosted storage or Cron footprint.
The database is already large enough that plan name alone cannot prove unused
included capacity. The account connector does not expose invoice-period disk,
compute, egress, or overage headroom, so `$0` cannot be certified.

Security and performance advisors were read only. They report broad preexisting
project findings, including service-only tables with RLS and no client policy
and duplicate legacy indexes. Because the forecast migration is not hosted,
there are no forecast-table advisor results yet.

## Vercel

- Web project: `fhfhockey` (`prj_LV0wbwH5gRjOsZlowzEFNGRuX7Lw`).
- Functions project: `functions-fhfhockey`
  (`prj_q9tnoe1pF6WAe9zPcBzBLBPZx5mQ`).
- Observed production runtime-log counts over the prior seven days:
  - Web: 2,910 function-source entries.
  - Functions: 8 function-source entries.

Runtime-log counts are not invoice usage and do not expose duration, memory,
bandwidth, or credit consumption. The optimized Supabase schedule would add at
most 2,191 coordinator requests per week before retries: 2,016 five-minute
drains, 168 hourly settlements, and seven daily seeds. Statistical inference
would add separate function invocations and remains disabled.

## `$0` activation gate

Before any hosted activation, obtain a current billing-period usage export or
dashboard capture for both providers showing conservative headroom for:

- Supabase database size/compute, egress, storage, and Cron/`pg_net` activity.
- Vercel function invocations, duration, memory, data transfer, and remaining
  infrastructure credit.

If that evidence cannot guarantee no new charge or likely overage, remain
local-only. If it does, request explicit approval for the exact hosted migration
and deployment targets while keeping inference disabled and queue draining at
`dryRun=true`.
