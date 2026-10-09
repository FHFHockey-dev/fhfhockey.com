# Website

FHFH website

## How to start the dev server

Use Node 22.11.0 from `.nvmrc`. npm and `package-lock.json` are the sole
package-manager authority for this application.

```bash
npm ci
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

Next writes the active workflow's route declaration path to the generated,
git-ignored `next-env.d.ts`. The tracked `next-bootstrap.d.ts` supplies stable
core declarations; this Pages Router project does not enable Next's typed-route
feature, so `tsconfig.json` excludes workflow-specific `.next*` declarations.
Switching between `npm run dev` and `npm run dev:player-forecasts` therefore must
not produce tracked-file churn or expand a standalone type check with stale
generated trees.

## SQL refresh validation configuration

`scripts/sql-refresh-validation.ts` and
`scripts/sql-refresh-team-power-validation.ts` execute operational SQL and are
not setup or test commands. They require `NEXT_PUBLIC_SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` in the invoking process. To load an environment file
intentionally, set `SQL_REFRESH_ENV_FILE` to a path relative to the repository
root, such as `web/.env.local`; neither script searches for environment files.
Absolute paths and paths outside the repository are rejected, and configuration
errors report variable names without values.

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
- `POST /api/v1/sustainability/process-recompute-queue` is the protected resumable worker. It claims at most one eligible job, runs one bounded canonical stage, transactionally finalizes complete score distributions/quintiles, and requeues, completes, or applies fixed-error capped exponential backoff. It is intentionally not scheduled while cross-provider ownership remains under review.
- A future A/B candidate must use a new model/config identity and offline comparison first. It becomes active only through the same RPC after explicit methodology approval; historical rows remain unchanged unless the queued bounded recompute is separately executed.
- Deploy the schema migration before publishing code that reads the new first-class columns. Migration application, queued worker execution, and retro history writes remain separate approval gates.
- `GET /api/v1/sustainability/leaderboard` accepts `window_type=l3|l5|l10|l20`, `min_games`, `min_score`, `rookie_only`, `page`, and `page_size` (maximum 100). Results use the latest snapshot for the selected window, score-descending/player-ID ordering, and complete Supabase range pagination before response pagination.
- `min_games` uses current-season `player_totals_unified.games_played`. `rookie_only=true` means the player has no games in either of the two prior canonical NHL seasons.
- Public leaderboard responses emit deterministic `ETag` and shared-cache headers. Send `If-None-Match` for `304` responses.
- The leaderboard endpoint returns stored score components for `include=components` only through the existing admin/cron authorization boundary and uses `private, no-store`; missing or invalid authorization fails closed.

The exact latest-snapshot query is covered by the production composite index `idx_susscore_date_win (snapshot_date, window_code)`. Read-only `EXPLAIN (FORMAT JSON)` on 2026-07-23 selected an index-only backward scan for snapshot discovery and an index scan with exact `snapshot_date`/`window_code` conditions for the leaderboard rows.

## Start Chart operations

`GET /api/v1/start-chart` is a read-only one-date presentation adapter over the latest succeeded canonical FORGE run. It accepts a real `date=YYYY-MM-DD`, `mode=points`, `profile=fhfh-default-skater-v1`, `model_version=latest`, optional `position=C|LW|RW|D|G`, and optional `page`/`page_size` (maximum 200). Tau, category, alternate profile, risk, and pinned model-version overrides fail with a structured `422` because Start Chart does not own a second projection model.

For a bounded local FORGE run, invoke `scripts/run-forge-local.ts` from `web/` with Node 22 and an existing private parent directory outside this repository:

```bash
NODE_PATH=. npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node","target":"ES2022"}' scripts/run-forge-local.ts --date YYYY-MM-DD --game-id GAME_ID --out /private/parent/new-receipt-directory
```

This defaults to a read-only scope preview and retains `code.json`, pinning loaded repository/dependency files, the lockfile, TypeScript configuration, actual compiler settings, Node version/binary and nonsecret model configuration. Inspect and retain that artifact before adding `--write --artifact /private/parent/preview-directory/code.json` to the same Node/ts-node command, using a new output directory. An initial pin mismatch prevents reservation/generation; changes before snapshot storage or publication withhold issuance. Any existing issued revision is still skipped unless `--refresh` is supplied; that skip is not proof of current target coverage or freshness. A preview does not run the model.

`web/.env.local` or the process environment must supply `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. The CLI confines network requests to Supabase REST, leaves the shared queue untouched, and disables scheduler and public serving flags in its process. Keep private receipts: write mode retains repository source bytes, captured inputs and issued payloads. Failure receipts retain known run/input identities and publication state; request counts distinguish attempted writes from acknowledged, rejected and unknown outcomes. A lost response can follow a committed write: reconcile the scoped hosted state before retrying. No automatic retry or horizon scheduling is performed. These checks are local artifact guards, not predictive validation, production activation or an immutable execution host; the resumable coordinator and capacity/recovery acceptance remain in FE-05f.

Optional bounds are `--max-requests` (default 1000, maximum 10000 total HTTP attempts), `--max-writes` (default 100, maximum 2000 attempted HTTP writes), `--runtime-ms` (default 150000, maximum 600000) and `--request-timeout-ms` (default 10000, maximum 60000). All must be positive integers. The shared deadline starts before scope reads and artifact loading; each request includes response-body receipt and uses the remaining budget. Cancelled or exhausted work is rejected before transport; in-flight interruption leaves a write outcome unknown. Receipts retain these limits. The runtime deadline bounds I/O and cooperative model checks; it cannot preempt synchronous work or prove cancellation of a server transaction. The calendar supervisor below adds OS supervision for its children. These defaults are operating ceilings, not measured capacity or billing headroom.

Write mode flushes a private `attempts.jsonl` before each HTTP write and after its outcome, alongside scope, artifact, limits and known run/input checkpoints. It retains resource paths and payload hashes without request headers, query strings or raw bodies. If a process dies before `receipt.json`, preserve this journal for reconciliation; an acknowledged HTTP response still needs semantic readback. Journal failure before transport prevents that write. A pending attempt or missing response never proves zero writes, and an absent revision in one read is not permission to retry while a prior request might still commit. The forward local-execution migration supplies database-side ownership; automatic restart/coordinator recovery remains unfinished.

Intentional writes acquire a private scope under `~/.fhfh/forge-local-ownership`, keyed by Supabase origin and game ID, before inspecting existing revisions. `FORGE_LOCAL_OWNERSHIP_DIR` can select an operator directory outside the repository; it must be private to that operator, shared by all its local invocations/coordinators and unchanged between preview and write. The artifact pin includes this directory. Each scope retains an operation UUID, host/PID, original receipt directory and flushed write-intent marker. Ownership remains held through calculation, publication and readback; matching captured input/revision identities release it after verified issuance. A no-write skip/setup failure also releases it. Failures after a prepared write or process death retain the scope and block retries before database access. A missing PID or incomplete ownership file does not authorize automatic reclamation. Inspect the original private receipts and positively reconcile hosted state before any recovery; do not delete the scope or change directories to bypass unresolved work. Filesystem guards cover cooperating local invocations only. Database fencing has isolated local acceptance in [the forward migration](../supabase/migrations/20261002021651_forge_local_execution_fence.sql), which remains unapplied to hosted Supabase. The new write path requires its `begin_forge_local_run` RPC and fails closed if unavailable; it binds the local UUID, scope, artifact, expected prior revision and bounded server lease to an immutable private observation. Legacy/queue reservations and publication take the same game locks; mutable run metrics cannot remove this ownership. No queue entry, scheduler or serving flag is created by local reservation. Full horizon/restart operation remains gated in FE-05f.

Read-only recovery uses the same Node/ts-node command with `--reconcile UUID`, the operation UUID from the original `owner.json`/journal, original date/game and a new private output directory. It cannot be combined with write, refresh or an artifact argument. It reads `inspect_forge_local_attempt` via GET, then verifies matching captured input/revision identities and the input hash when issuance exists. `verified_issued` establishes retained issuance, not current serving or recommendation readiness; mutable run status is reported separately. Active, expired or absent attempts remain `unresolved`, with `automaticRetryAllowed: false`. Reconciliation never deletes ownership, regenerates or changes a database row. A transaction that passed publication checks before lease expiry may commit later; negative expired readback is therefore not proof of terminal failure. Attempts created before this contract have no database-bound local UUID and need separate scoped investigation.

To exercise the new SQL contract locally, run `FORGE_POSTGRES_BIN=/opt/homebrew/opt/postgresql@17/bin npm test -- scripts/run-forge-local.test.ts` (or provide another installed PostgreSQL bin directory). The existing test file starts/stops its own private socket-only server and named empty database; [the fixture](../supabase/tests/forge_local_execution.sql) rejects a server without its explicit marker and cannot use the existing SSH tunnel. It tests actual existing publication/reservation/news SQL together with the new migration. It does not verify the full deployed schema, hosted concurrency, current billing or predictive quality.

For the calendar coordinator's read-only scope inspection, use an explicit future game set, declared target profile and the retained single-game preview artifact:

```bash
NODE_PATH=. npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node","target":"ES2022"}' scripts/run-forge-calendar-local.ts --game-ids GAME_ID_1,GAME_ID_2 --skater-targets GOALS,ASSISTS --artifact /private/parent/preview-directory/code.json --out /private/parent/new-calendar-directory
```

Replace the game-ID placeholders with canonical numeric IDs. `--days` defaults to 14 UTC calendar dates; optional `--player-ids` selects canonical player requirements. The private `scope.json` binds games/seasons, team-game ordinals, schedule/roster/news context, required targets, current prior revisions, admitted contribution expiry and artifact identity. Skip eligibility uses all stored competitors on both game sides and the existing public resolver without baselines, respecting current gates; historical rows alone cannot satisfy it. It does not establish NHL roster completeness or an atomic source snapshot. `--max-games` defaults to 16 (maximum 500), `--max-requests` to 500 (maximum 10000), `--max-writes` to 200 (maximum 2000), `--runtime-ms` to 600000 (maximum 3600000), and `--request-timeout-ms` to 10000 (maximum 60000). Concurrency is one. The write limit is recorded for the future execution contract; inspection enables zero writes.

The parent supervises a separate Node process, bounds its private log, and stops synchronous work at the original shared deadline or cancellation, escalating to SIGKILL after 250 ms. Intent, copied code artifact, inspection and process receipts remain private. Serving-disabled, canary-excluded, expired or incompatible evidence stays unresolved. Inspection does not run forecasts, seed a queue, release ownership or alter serving settings. These ceilings are not measured Supabase headroom or a billing guarantee.

After the source, measured-capacity and hosted local-fence gates in FE-05b/05f pass, a separately explicit write invocation can consume the reviewed private scope:

```bash
NODE_PATH=. npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node","target":"ES2022"}' \
  scripts/run-forge-calendar-local.ts --write \
  --scope /private/operator/calendar-preview/scope.json \
  --out /private/operator/new-calendar-execution
```

To resume that execution, use the same scope, a new `--out` directory, and `--resume /private/operator/new-calendar-execution`. Resume does not extend the original deadline or change budgets, artifact, origin, games or profile. The coordinator flushes each grant and child PID before the IPC start handshake allows Supabase access. It revalidates current calendar context, passes a pinned operation UUID/prior revision/scope checksum to each single-game calculation, and checks captured schedule/roster identity before and after calculation. It rejects concurrent coordinators/live children. Terminal measured receipts can release unused allocation; missing receipts retain the full request/write grant. Prior attempts require positive read-only issued reconciliation; missing/expired attempts remain unresolved without generation retry. Per-game ownership is retained after an unverified write and is never deleted on a negative read.

On resume, positive reconciliation also verifies the retained captured-input hash and exact issued revision against the original operation, code, prior revision and Supabase origin. The recorded local writer must have stopped. Matching retained ownership is moved to a private recovery archive with its write intent and proof; a live/foreign writer, incomplete evidence or replacement owner blocks cleanup. Reconciliation runs before current-context validation, so old issuance can be accounted for after a source change, but that change still stops generation. Standalone `--reconcile` remains read-only. The original calendar deadline and allocations still apply: expired/exhausted scopes cannot resume generation, and unknown allocations are never reset. Use a separate recovery-only invocation to investigate original operations after those limits:

```bash
NODE_PATH=. npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node","target":"ES2022"}' \
  scripts/run-forge-calendar-local.ts --recover \
  --scope /private/operator/calendar-preview/scope.json \
  --resume /private/operator/new-calendar-execution \
  --out /private/operator/new-calendar-recovery \
  --max-requests 1000 --runtime-ms 150000 --request-timeout-ms 10000
```

Recovery rejects generation/write flags and permits zero Supabase writes. Its new private read-only ledger separately bounds requests (maximum 10000), runtime (maximum 600000 ms) and request timeout (maximum 60000 ms); all bounds are positive integers. A zero-allocation reference in the original ledger retains investigator/child identity and blocks competing recovery/resume while either is live. Original generation limits, consumption and deadline stay unchanged; missing read receipts retain their separate full allocation. Preserve both linked ledgers and archives. The original scope/artifact, Supabase origin and ownership directory must match. Positive readback can archive only matching ownership after the original writer stops; negative/expired facts never authorize cleanup, retry or a new write. Investigation completeness and issuance resolution do not establish current serving or recommendation readiness. Direct reads consume Supabase resources; these bounds are not measured billing headroom.

New ownership recovery publishes a complete, fsynced investigator/proof record exclusively before archival. Its bounded append-only claim chain retains prior proofs and permits takeover only after the latest local investigator has stopped, retained proof agrees with freshly verified operation/input/revision evidence and the original directory/owner is unchanged. Published claims remain on failure and are preserved in the final archive. Keep any unpublished private `recovery-proof-*` records left by a killed process for investigation; they do not establish a published claim or authorize a retry. Legacy `verified-recovery` directories without investigator identity and corrupt/missing proof chains still fail closed. Ledger checkpoint publication and complete-ready-record recovery have local acceptance below; unready/legacy evidence, guardian-loss/escaped-process containment, immutable-host acceptance and the hosted fence contract remain unfinished. Automatic termination after coordinator death has local acceptance below. Do not remove ownership or change directories to bypass them. This path has local process/filesystem/HTTP fixture acceptance, not hosted generation or serving acceptance.


Ledger checkpoints use private drafts and fsynced ready hard links before exclusive canonical publication; complete grant directories enter the sequence atomically. If a canonical record is missing, exactly one complete ready record may be read passively only after its original local writer has stopped and all recipe/grant/terminal-child checks pass. This preserves payloads, original budgets/deadline and unknown allocations; it never starts a child or rewrites a recipe. Only the original allocating coordinator can record activation. Missing, partial, foreign, live or ambiguous preparations remain unresolved. Keep `.draft-*`, `.ready-*` and `.grant-prepared-*` artifacts and both linked ledgers. An unpublished prepared grant cannot have activated a child; a published unfinished grant retains its full allocation. These are local process/IPC checks, not hosted transaction cancellation, billing headroom or serving readiness.

The POSIX supervisor launches an independent [process guardian](scripts/forge-process-guardian.ts) as a dedicated group leader. The worker and ordinary descendants inherit its group. The guardian remains responsive during synchronous model work, stops its own group on coordinator IPC loss or the original deadline, escalates resistant work and is itself reaped after cleanup. A nonce-bound start handshake flushes the actual worker/guardian identities before permitting I/O. Completion observes group termination; recovery never signals saved/foreign/reused PIDs. Live or unresolved worker, guardian or group evidence blocks completion and overlapping grants. If the guardian itself is killed or a dependency escapes the group, automatic containment is not established: retain ownership/unknown allocations and investigate rather than retry. These local checks cannot cancel server transactions or prove that a lost write failed. Windows process groups are unsupported. Source changes require a newly reviewed artifact/preview; old receipts are not retroactively upgraded.

`executionComplete` records issued/verified/skipped operations, while `eligibleCoverageComplete` separately requires current sanitized consumer coverage. Issuance cannot enable serving flags, promote a model or establish recommendation readiness. Parent-death termination, unresolved-group blocking and positive ownership recovery have local subprocess acceptance; model/database issuance in those calendar fixtures is simulated. Hosted contract/source/capacity, immutable execution host, remaining recovery acceptance and actual horizon serving remain open. Do not invoke it against hosted data until those gates pass. No Vercel queue or endpoint dispatch is used.

For a read-only audit of the forecast catalog against current official rosters and exact player profiles:

```bash
NODE_PATH=. npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/audit-forecast-population-local.ts --season SEASON_ID --out /private/parent/new-population-receipt-directory
```

This uses the same Supabase variables and private-directory requirements, with no write mode. It compares verified/unmerged `active_nhl` identities and current-season memberships against all 32 current NHL rosters, then checks up to 25 candidate profiles by default (`--limit 1..500`). Resume profile review using `--after-profile NHL_ID` and the returned `nextProfile` cursor; compare candidate/catalog hashes before combining pages from different runs. The transport permits metadata GETs and scoped official NHL reads only, with four concurrent requests, eight-second request deadlines and a shared 120-second I/O deadline. Exact-count pagination rejects missing/duplicate/drifting metadata; matching before/after catalog reads do not establish transactional isolation. Private receipts retain original response content, hashes, classifications, failed/unread profiles and aggregate request/byte counts without request credentials. `readStatus` describes the requested reads; `profileCoverage` and `populationStatus` disclose unfinished review. An active profile's organization is not roster assignment or participation evidence, roster absence does not authorize deactivation, and missing birth dates remain unverified rather than contradictory. The audit never repairs records, generates forecasts, invokes a queue/function or enables serving. Supabase compute/egress still applies; no Vercel invocation is needed.

The authenticated `/api/internal/forecast-calendar?preview=true&days=14` endpoint is also read-only. Its `coverage.complete` and `readStatus` mean the bounded diagnostic reads finished; `coverageBasis: storage_receipts` distinguishes queued games, historical issued revisions and skater/goalie projection rows. These do not establish usable target coverage. With no target profile, `consumerCoverage.status: not_evaluated` leaves required/eligible player-game-target counts null. To inspect an explicit statistical profile, append `&skaterTargets=GOALS,ASSISTS&goalieTargets=SAVES_GOALIE,GOALIE_MINUTES`. The sanitized public reader respects serving flags/canaries and reports all catalog competitors' required targets plus separate assignment/totals/comparison eligibility; league scoring, verified eligibility and locks remain unevaluated. Unknown mappings or incomplete inputs prevent a full-population coverage claim. Missing counts, truncated reads, failed queries or canonical/authoritative schedule conflicts return unavailable rather than zero coverage. `scheduleCoverage` discloses excluded statuses and stale evidence; queue writes require matching authoritative team-game sides and schedule evidence no older than 36 hours. Preview never seeds a queue or runs a forecast. Visit the endpoint on a local server to avoid a Vercel request; use the local CLI above for separately authorized generation without a Vercel invocation. Supabase resource usage still applies.

A rejected schedule returns HTTP 503 with `scheduleCoverage.validationStatus: rejected`, safe per-game reason codes and checked/unread counts. `readStatus: complete` can coexist with rejected validation; it describes reads, not readiness. Unknown discovery counts remain null. If seeding succeeds but later coverage fails, `queueReceipt` retains the acknowledged result and `coverageUnavailable` is true; do not interpret that 503 as zero inserts. Upstream refreshes use NHL scoring-day dates, including the prior source day when a UTC/league-local range crosses midnight; refreshing only the UTC date strings can leave a relevant boundary game stale.

Start Chart responses retain `date`/`dateUsed` and add standardized `requestedDate`, `resolvedDate`, `serving`, `sourceStatus`, and `coverage`. Serving is `exact` for an exact scheduled slate with usable one-game rows, `partial` when scheduled games are missing usable rows, `fallback` only when the requested date has no games and an earlier same-season run has a matching schedule, and `no_games` when no eligible fallback exists. Player rows include stable run/game/player/horizon identity plus nullable stat/context fields. Rank is determined only from the selected run's one-game FORGE values under `fhfh-default-skater-v1`; ownership and weekly games never alter rank. Historical ratings, CTPI, goalies, and ownership are selected on or before the resolved date, and unavailable values remain null.

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
