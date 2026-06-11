# Website

FHFH website

## How to start the dev server

```bash
npm install
npm run dev
```

If local development starts reporting `EMFILE: too many open files, watch` or
generated `.next/server/*` files disappear during browser QA, use the polling
watcher fallback:

```bash
npm run dev:stable
```

The dev Webpack watcher is configured to ignore generated/cache-heavy paths such
as `.next`, `node_modules`, coverage output, and archived task artifacts. If a
previous watcher failure already corrupted generated output, stop the dev server
and remove `.next` once before restarting:

```bash
rm -rf .next
npm run dev:stable
```

## Browser E2E tests

Playwright is the repo-standard browser E2E runner for full-browser coverage.
It is separate from the existing `puppeteer-core` browserless/webhook runtime.

Install the Playwright-managed Chromium browser once, then run the rankings
smoke:

```bash
npm run e2e:install
npm run test:e2e:rankings
```

For sandboxed agents or environments where the default browser cache is not
writable, keep the browser binaries in the project or another writable path:

```bash
npm run e2e:install:workspace
npm run test:e2e:rankings:workspace
```

These scripts set `PLAYWRIGHT_BROWSERS_PATH=.ms-playwright`, and `.ms-playwright`
is git-ignored because it contains downloaded browser binaries.

The Playwright config starts `npm run dev:stable` on port `3100` by default.
Override with `PLAYWRIGHT_PORT` or point at an already-running app with
`PLAYWRIGHT_BASE_URL` and `PLAYWRIGHT_SKIP_WEB_SERVER=1`.

Current Codex macOS sandbox note: Chromium launch can fail before page load with
`MachPortRendezvousServer ... Permission denied`. In that case, verify discovery
with `npm run test:e2e:rankings -- --list` and run the browser spec on the host
machine or CI runner where Chromium can launch normally.

## How to generate types for your API and Supabase libraries

```bash
npx supabase login

npx supabase gen types typescript --project-id fyhftlxokyjtpndbkfse --schema public > ./lib/supabase/database-generated.types.ts
```

## Supabase CLI workflow

Run Supabase CLI commands from this `web/` directory.

For type generation, prefer the Management API path because it does not require direct Postgres access:

```bash
npx supabase gen types typescript --project-id fyhftlxokyjtpndbkfse --schema public > ./lib/supabase/database-generated.types.ts
```

If `npx supabase ...` is blocked by home-directory npm cache or Supabase telemetry write permissions in a sandboxed agent, use the safe wrapper. It disables Supabase telemetry and uses a writable temp npm cache:

```bash
npm run supabase:safe -- --version
npm run supabase:safe -- gen types typescript --project-id fyhftlxokyjtpndbkfse --schema public > ./lib/supabase/database-generated.types.ts
```

For remote migration work, link the local CLI state to the project and use the linked project path:

```bash
npx supabase link --project-ref fyhftlxokyjtpndbkfse
npx supabase db push --linked --dry-run
npx supabase db push --linked
```

Do not pass `--skip-pooler` unless you have verified direct Postgres connectivity from the current network. If direct database access is refused, use the linked CLI path instead of a direct host connection.

### Direct DB DNS fallback

The direct Supabase database hostname for this project can resolve as IPv6-only
from some networks:

- `db.fyhftlxokyjtpndbkfse.supabase.co` may return only an `AAAA` record.
- `aws-0-us-east-1.pooler.supabase.com` returns IPv4 `A` records.

If the current network does not support IPv6 to Supabase, use the linked CLI
pooler workflow above. For a one-off `psql` migration check, prefer environment
variables or an interactive password prompt so credentials are not printed in
the terminal history:

```bash
export PGHOST=aws-0-us-east-1.pooler.supabase.com
export PGPORT=5432
export PGDATABASE=postgres
export PGUSER=postgres.fyhftlxokyjtpndbkfse
psql "sslmode=require"
```

Use port `5432` for the session pooler. Avoid logging full connection strings,
especially strings that include `DATABASE_PASSWORD` or service-role keys.

## Contextual rankings pipeline

The skater rankings page currently reads from existing source tables and helpers;
do not add new rankings fact tables until the existing path has been verified for
the missing field.

Flow:

1. Ingestion updates NHL/WGO/NST source tables, including the `nst_gamelog_*`,
   `nst_gamelog_5v5_*`, WGO skater totals, line-combination, and special-teams
   context sources.
2. Normalization and rolling recompute run through
   `/api/v1/db/update-rolling-player-averages`, which writes
   `rolling_player_game_metrics`. Broad date-window recomputes must be bounded
   with `playerId`, `resumeFrom`, `maxPlayers`, `executionProfile=overnight`, or
   `confirmBroadRun=true`.
3. Runtime ranking APIs read the latest per-player rolling snapshot from
   `rolling_player_game_metrics` and calculate peer-relative percentiles for
   `/api/v1/contextual-rankings`, `/matrix`, `/deployment-tiers`, `/trending`,
   and `/splits`.
4. Composite publishing is separate:
   `/api/v1/db/update-skater-composite-ratings` builds and upserts
   `skater_composite_ratings` for MCM, BEAST, offense/defense composites, and
   archetype tags. The route defaults to `dryRun=true`; pass `dryRun=false` only
   for intentional publishes.

Operational status:

- `update-rolling-player-averages` is represented in
  `rules/context/cron-schedule.md`, runs through `withCronJobAudit`, and appears
  in the cron report route map.
- `update-skater-composite-ratings` is audited when invoked, but is not yet a
  scheduled post-game cron in the current inventory.
- Published contextual snapshot tables such as `entity_metric_rankings` and
  `skater_composite_ratings` have `methodology_version` plus `updated_at`
  triggers. `rolling_player_game_metrics` is a source/rolling table with
  `updated_at`; methodology metadata is supplied by the rankings metric registry
  and published snapshot tables.
- Use `/api/v1/db/cron-report` plus the ranking performance smokes to watch for
  failed recomputes, stale snapshots, and null-only source-dependent metrics.
