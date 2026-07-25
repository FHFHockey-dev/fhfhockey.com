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

## Sustainability read API

- `GET /api/v1/sustainability/player/:playerId` retains the existing single-window response. Add `summary=true` for the deterministic latest `l3`, `l5`, `l10`, and `l20` scores plus stored model/config provenance.

### Sustainability version/config policy

- `sustainability_score_v2` is the canonical TypeScript score model. Its compatible configuration revision uses stable recursive-key hashing; revision 2 is `fnv1a_91691726`.
- Every new `sustainability_scores` and `sustainability_player_priors` row carries first-class `model_version` and `config_hash`. Existing rows keep embedded component provenance where present; otherwise migration labels them `legacy_unversioned` without rewriting values.
- Configuration changes use the service-role-only `activate_sustainability_config` RPC. It requires an exact +1 revision, validates the canonical nested weight shape, deactivates the previous row, activates one new row, and enqueues one recompute receipt transactionally.
- A future A/B candidate must use a new model/config identity and offline comparison first. It becomes active only through the same RPC after explicit methodology approval; historical rows remain unchanged unless the queued bounded recompute is separately executed.
- Deploy the schema migration before publishing code that reads the new first-class columns. Migration application, queued worker execution, and retro history writes remain separate approval gates.
- `GET /api/v1/sustainability/leaderboard` accepts `window_type=l3|l5|l10|l20`, `min_games`, `min_score`, `rookie_only`, `page`, and `page_size` (maximum 100). Results use the latest snapshot for the selected window, score-descending/player-ID ordering, and complete Supabase range pagination before response pagination.
- `min_games` uses current-season `player_totals_unified.games_played`. `rookie_only=true` means the player has no games in either of the two prior canonical NHL seasons.
- Public leaderboard responses emit deterministic `ETag` and shared-cache headers. Send `If-None-Match` for `304` responses.
- The leaderboard endpoint returns stored score components for `include=components` only through the existing admin/cron authorization boundary and uses `private, no-store`; missing or invalid authorization fails closed.

The exact latest-snapshot query is covered by the production composite index `idx_susscore_date_win (snapshot_date, window_code)`. Read-only `EXPLAIN (FORMAT JSON)` on 2026-07-23 selected an index-only backward scan for snapshot discovery and an index scan with exact `snapshot_date`/`window_code` conditions for the leaderboard rows.

## Start Chart operations

`GET /api/v1/start-chart` is a read-only one-date presentation adapter over the latest succeeded canonical FORGE run. It accepts a real `date=YYYY-MM-DD`, `mode=points`, `profile=fhfh-default-skater-v1`, `model_version=latest`, optional `position=C|LW|RW|D|G`, and optional `page`/`page_size` (maximum 200). Tau, category, alternate profile, risk, and pinned model-version overrides fail with a structured `422` because Start Chart does not own a second projection model.

The canonical refresh is `GET /api/v1/db/run-rolling-forge-pipeline`. It requires an admin bearer token or the exact `CRON_SECRET`, uses server-only `NEXT_PUBLIC_SUPABASE_URL` plus `SUPABASE_SERVICE_ROLE_KEY`, and writes one `cron_job_audit` row through `withCronJobAudit`. The active Vercel caller runs `daily_incremental` at `05 10 * * *` UTC with downstream reconciliation enabled, accuracy disabled, and non-blocking-stage continuation enabled.

- `daily_incremental` is the normal bounded current-date refresh.
- `overnight` is the broader operator profile and must be invoked intentionally.
- `targeted_repair` requires explicit `date`, `startDate`, and `endDate` bounds.

Use a value-free read smoke without authorization:

```bash
curl --fail --silent --show-error \
  "https://fhfhockey.com/api/v1/start-chart?date=2026-02-07&mode=points&model_version=latest&page=1&page_size=100" \
  | jq '{dateUsed, projectionRunId, projections, pagination, serving}'
```

For an authorized bounded repair, keep the credential in the environment and do not print it:

```bash
curl --fail --silent --show-error \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "https://fhfhockey.com/api/v1/db/run-rolling-forge-pipeline?mode=targeted_repair&date=2026-02-07&startDate=2026-02-07&endDate=2026-02-07&includeDownstream=true&includeAccuracy=false&stopOnFailure=true" \
  | jq '{success, mode, dateWindow, durationMs, runtimeBudget, scanSummary, stages}'
```

A `200` means every blocking stage succeeded; `207` is an intentional partial-success receipt and must be reviewed by stage before retry. Retry the same bounded window only after confirming no stage widened its requested scope. Verify the matching `cron_job_audit` row, expected player/run counts, source freshness, and `/api/v1/start-chart` resolved date/run before treating the repair as complete. Roll back application behavior by restoring the prior exact deployment; persisted projection repair requires a separately approved, date/run-scoped correction rather than a destructive blanket delete.

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
