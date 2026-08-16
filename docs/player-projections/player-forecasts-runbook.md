# Player Forecasts operator runbook

This runbook operates the authenticated `player_forecasts` shadow system. It never promotes a model, changes FORGE consumers, or enables production inference implicitly.

## Safety boundaries

- Run database commands from `web/`; there is no root package manifest.
- Use local Supabase for migrations, fixtures, and acceptance testing by default.
- Never repair, reset, merge, or push production migration history from this runbook.
- Never print or commit service-role keys, cron secrets, inference secrets, database URLs, or request headers.
- `PLAYER_FORECAST_ENABLE_INFERENCE` remains unset/false through contract-only proof.
- Production migration, any remote build/deployment, cron activation, and champion promotion require separate explicit approval.
- The operating budget is `$0` incremental. Do not create a paid Supabase branch, add a paid service, or exceed an existing included allocation.
- Player Forecast API routes reject non-local Supabase targets when `NODE_ENV` is not `production`; this prevents a localhost page from silently reading or mutating the hosted project.
- Historical features require `available_at <= forecast cutoff`; event date alone is insufficient.

## Required configuration

Web server-only variables:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLIC_KEY
SUPABASE_SERVICE_ROLE_KEY
CRON_SECRET
RESEND_API_KEY
PLAYER_FORECAST_INFERENCE_URL
PLAYER_FORECAST_INFERENCE_SECRET
PLAYER_FORECAST_ENABLE_INFERENCE=false
PLAYER_FORECAST_REVIEW_TOKEN_SECRET
```

Python Function variables:

```text
PLAYER_FORECAST_INFERENCE_SECRET
PLAYER_FORECAST_ENABLE_INFERENCE=false
SUPABASE_URL                 # required only for approved model artifact reads
SUPABASE_SERVICE_ROLE_KEY    # required only for approved model artifact reads
```

The web and functions processes must use the same inference secret. Keep all local proof pointed at local Supabase.

## Local startup

1. Start and inspect Supabase:

   ```bash
   cd web
   npm run supabase:safe -- start
   npm run supabase:safe -- status
   npm run supabase:safe -- migration list --local
   ```

2. Replay migrations on local Supabase:

   ```bash
   npm run supabase:safe -- migration up --local
   ```

3. Start the Python worker locally from the repository root. This is the
   no-deployment proof path and serves the same Flask application Vercel wraps:

   ```bash
   cd functions
   PLAYER_FORECAST_INFERENCE_SECRET="${PLAYER_FORECAST_INFERENCE_SECRET}" \
   PLAYER_FORECAST_ENABLE_INFERENCE=false \
     python -m flask --app api.player_forecasts.infer run \
       --host 127.0.0.1 --port 3003
   ```

   Configure the web worker URL as:

   ```text
   http://127.0.0.1:3003/
   ```

   `yarn vercel dev --cwd functions --listen 3003` remains an optional routing
   parity check; it is not required for local acceptance and must not deploy.

4. In a separate shell, derive the current local Supabase credentials without
   copying them into a file, then start Next.js on an isolated port/build tree:

   ```bash
   cd web
   npm run dev:player-forecasts
   ```

   The launcher fails closed unless the Supabase CLI reports a localhost API,
   derives the local anonymous/service/database credentials in memory, and
   starts Next.js at `http://localhost:3101`. When no editor allowlist is
   supplied, it enables editing only if the local database contains exactly one
   admin profile. The equivalent manual command is:

   ```bash
   pf_status_json="$(npm run --silent supabase:safe -- status -o json)"
   pf_local_api="$(jq -r '.API_URL' <<<"$pf_status_json")"
   pf_local_anon="$(jq -r '.ANON_KEY' <<<"$pf_status_json")"
   pf_local_service="$(jq -r '.SERVICE_ROLE_KEY' <<<"$pf_status_json")"

   NEXT_PUBLIC_SUPABASE_URL="$pf_local_api" \
   NEXT_PUBLIC_SUPABASE_PUBLIC_KEY="$pf_local_anon" \
   SUPABASE_SERVICE_ROLE_KEY="$pf_local_service" \
   PLAYER_FORECAST_ISOLATED_NEXT=1 \
   PLAYER_FORECAST_INFERENCE_URL=http://127.0.0.1:3003/ \
   PLAYER_FORECAST_ENABLE_INFERENCE=false \
     npm run dev -- -H 0.0.0.0 -p 3101
   ```

   The isolated `.next-player-forecasts` directory prevents a second development process or stale browser tab from mixing HMR manifests with the main `.next` directory.

5. Confirm the worker contract without printing the secret:

   ```bash
   curl --fail --silent \
     -H "Authorization: Bearer ${PLAYER_FORECAST_INFERENCE_SECRET}" \
     "${PLAYER_FORECAST_INFERENCE_URL}" | jq '{success,mode,researchGate,contractVersion,contractChecksum,inferenceEnabled}'
   ```

6. Run readiness:

   ```bash
   cd web
   npm run check:player-forecast-readiness
   ```

   Inspect `sourceFreshness` for the latest generic, goalie-start, and lineup
   availability timestamps. A negative `ageSeconds`/`futureDated=true` is a
   clock or fixture condition, not fresh production evidence. Before enabling
   inference, `artifactStorage.servingArtifactReady`, `receiptBound`, and
   `evidenceBound` must all be true.

   Confirm `runtimeBoundary.databaseTarget` is `local`, `runtimeBoundary.allowed` is `true`, and `database.missingTables` is empty. Readiness deliberately uses non-HEAD table probes so missing PostgREST relations cannot be reported as present.

## Deterministic fixtures

Fixtures are branch/local-only and idempotent. They create one forward,
defenseman, and goalie; multiple pregame revisions; a post-start observation;
a goalie conflict; provisional/corrected outcomes; and fixture-only aggregate
accountability checkpoints. The skater fixture also records game-time roster
identity so the runtime context RPC produces team/position and
opponent-allowed rates instead of silently substituting a player's current
team into historical games. Fixture metadata explicitly says
`notModelAccuracy=true`.

```bash
cd web
PLAYER_FORECAST_FIXTURE_CONFIRM=local-only \
  npm run fixture:player-forecasts
```

Reject fixture execution when the Supabase URL is not local or explicitly identified as an approved branch. Never run fixtures against production.

Verify the cutoff-safe context features with the local database URL reported
by Supabase (replace the fixture IDs only when using a non-fixture game):

```sql
select player_id,
       population,
       features->'hits'->>'team_position_rate' as team_position_rate,
       features->'hits'->>'opponent_allowed_position_rate' as opponent_allowed_rate
from public.build_player_forecast_runtime_features(
  901, 902, 20262027, '2099-01-01T00:00:00Z'
)
order by player_id;
```

The fixture returns `2` for its forward and `1` for its defenseman in both
context columns. The RPC is executable only by `service_role`; anonymous and
authenticated clients must receive a permission error.

## Contract-only smoke test

All job calls require an admin access token or exact `CRON_SECRET` bearer value.

```bash
export PF_WEB_URL=http://127.0.0.1:3101

curl --fail --silent \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -X POST "${PF_WEB_URL}/api/v1/player-forecasts/jobs/daily" | jq

curl --fail --silent \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -X POST "${PF_WEB_URL}/api/v1/player-forecasts/jobs/drain?dryRun=true&limit=50" | jq

curl --fail --silent \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "${PF_WEB_URL}/api/v1/player-forecasts/readiness" | jq
```

Expected contract-only result:

- H1–H10 jobs are seeded for both teams in each future game.
- Repeated events coalesce for five minutes.
- Runs record approved-contract receipts with zero model outputs.
- A source watermark arriving during a lease returns the scope to `pending`.
- Post-puck-drop jobs fail closed while observations remain archived.
- The dashboard says the contract is approved but does not label fixtures as model accuracy.

## Event-driven queueing

Trusted parsing determines whether an IFTTT event is forecast-relevant. Do not accept a client-supplied `forecast_relevant` flag as authorization to enqueue work.

- Raw IFTTT rows remain immutable evidence and enter the existing line-source parser.
- Accepted goalie and lineup records are written to normalized `player_forecast_*` observation tables.
- Database triggers enqueue the affected game/team through `enqueue_player_forecast_job` in the same transaction.
- Injury observations enqueue the team's next ten regular-season games; other observations enqueue the affected matchup.
- Repeated observations coalesce behind a five-minute `not_before` window.
- Observations at or after actual puck drop remain archived but the trigger does not enqueue them.
- The application also calls the idempotent enqueue RPC during the transition period. The unique scope key makes this safe and preserves compatibility if application and database revisions are rolled out separately.

Verify locally after loading fixtures:

```bash
cd web
npm run supabase:safe -- db query --local \
  'select scope_key, team_game_horizon, reason, status, not_before, source_high_watermark from public.player_forecast_inference_queue order by scope_key'
```

If the installed CLI does not support `db query`, use local `psql` with the database URL reported by `npm run supabase:safe -- status`. Never print a remote database URL in logs.

## Local Vault and Cron proof

The database container reaches the web process through
`host.docker.internal`, not `127.0.0.1`. Configure only the local Vault with a
throwaway local secret:

```bash
cd web
pf_db_url="$(npm run --silent supabase:safe -- status -o json | jq -r '.DB_URL')"
psql "$pf_db_url" <<'SQL'
select vault.create_secret('local-player-forecast-cron', 'cron_secret')
where not exists (select 1 from vault.secrets where name = 'cron_secret');
select vault.update_secret(id, 'local-player-forecast-cron')
from vault.secrets where name = 'cron_secret';

select vault.create_secret('http://host.docker.internal:3101', 'site_url')
where not exists (select 1 from vault.secrets where name = 'site_url');
select vault.update_secret(id, 'http://host.docker.internal:3101')
from vault.secrets where name = 'site_url';
SQL
```

Start the web process with `CRON_SECRET=local-player-forecast-cron`. The
migrations register a 10:00 UTC daily seed, a five-minute dry-run queue drain,
and hourly settlement at minute 20. Trigger and inspect a local request without
printing the Vault values:

```bash
psql "$pf_db_url" -c \
  "select fhfh_internal.invoke_player_forecast_endpoint('/api/v1/player-forecasts/jobs/drain?dryRun=true')"
psql "$pf_db_url" -c \
  "select jobname,status,return_message,end_time from cron.job_run_details where jobname like 'player-forecasts-%' order by start_time desc limit 10"
```

Keep the drain URL at `dryRun=true` until statistical inference is separately
approved.

### Local deterministic serving proof

This proof is local-only and does not activate hosted inference. With local
Supabase running and the frozen artifact already reviewed:

```bash
cd web
pf_status_json="$(npm run --silent supabase:safe -- status -o json)"
pf_local_api="$(jq -r '.API_URL' <<<"$pf_status_json")"
pf_local_service="$(jq -r '.SERVICE_ROLE_KEY' <<<"$pf_status_json")"

PLAYER_FORECAST_ARTIFACT_CONFIRM=local-only \
PLAYER_FORECAST_PYTHON=.venv/bin/python \
NEXT_PUBLIC_SUPABASE_URL="$pf_local_api" \
SUPABASE_SERVICE_ROLE_KEY="$pf_local_service" \
  npm run register:player-forecast-artifact -- \
    --artifact=/private/tmp/player-forecast-lockbox-ready.json \
    --primary-receipt=/private/tmp/player-forecast-lockbox-receipt.json \
    --evidence=/private/tmp/player-forecast-lockbox-evidence.json

# Validation-only challenger (no lockbox receipt is attached or reopened):
PLAYER_FORECAST_ARTIFACT_CONFIRM=local-only \
PLAYER_FORECAST_PYTHON=.venv/bin/python \
NEXT_PUBLIC_SUPABASE_URL="$pf_local_api" \
SUPABASE_SERVICE_ROLE_KEY="$pf_local_service" \
  npm run register:player-forecast-artifact -- \
    --artifact=/private/tmp/player-forecast-validation-v2/validation-challenger-artifact.json

PLAYER_FORECAST_SERVING_PROOF_CONFIRM=local-only \
NEXT_PUBLIC_SUPABASE_URL="$pf_local_api" \
SUPABASE_SERVICE_ROLE_KEY="$pf_local_service" \
  npm run fixture:player-forecast-serving-proof
```

Start the Flask worker with `PLAYER_FORECAST_ENABLE_INFERENCE=true`, then invoke
the local queue drain with the same flag and `dryRun=false`. A passing proof has
one successful immutable run. The v1 serving bundle emits 14 conditional skater
outputs for the fixture; the assists/hits validation challenger emits four.
Repeating an identical scope and watermark must retain one run and the same
outputs. Both scripts
reject hosted Supabase URLs. Register the reviewed artifact whose checksum is
recorded in the primary receipt; do not substitute an earlier development
artifact left in a working freeze directory. The validation challenger is the
explicit exception: its own verifier requires `consumedLockboxRead=false`,
`promotionEligible=false`, and `validation_not_blind_evidence`. Registration
verifies and stores
the artifact, primary receipt, and evidence companion in the private
checksum-addressed bucket and records all three identities in the registry.

After fixtures, settlement, conflict resolution, and at least one local serving
run have completed, execute the read-only acceptance check:

```bash
pf_status_json="$(npm run --silent supabase:safe -- status -o json)"
pf_local_api="$(jq -r '.API_URL' <<<"$pf_status_json")"
pf_local_anon="$(jq -r '.ANON_KEY' <<<"$pf_status_json")"
pf_db_url="$(jq -r '.DB_URL' <<<"$pf_status_json")"

PLAYER_FORECAST_ACCEPTANCE_CONFIRM=local-only \
PLAYER_FORECAST_DATABASE_URL="$pf_db_url" \
NEXT_PUBLIC_SUPABASE_URL="$pf_local_api" \
NEXT_PUBLIC_SUPABASE_PUBLIC_KEY="$pf_local_anon" \
  npm run verify:player-forecast-local-acceptance
```

This command opens a read-only transaction and refuses non-local targets. It
checks migration presence, forced RLS and anonymous denial, Cron ownership,
observation triggers, private artifact/evidence storage, queue leases,
receipt-bound or validation-guarded inference persistence, conflicts, provisional/corrected
settlement, both candle datasets, and the post-start leakage invariant.

## Conflict workflow

1. Open `/db/player-forecast-review` as an admin or through a signed review link.
2. Confirm the conflict contains immutable evidence members and degraded provenance.
3. Append a resolution; do not edit source observations.
4. Confirm the affected game/team scope is requeued immediately.
5. Confirm later contradictory evidence creates a new conflict version.

## Historical audit and lockbox

Use the bundled workspace Python or a Python 3.12 environment with the modeling package installed.

```bash
python -m modeling.player_forecasts audit --output /private/tmp/player-forecast-audit.json
python -m modeling.player_forecasts freeze --output /private/tmp/player-forecast-freeze
python -m modeling.player_forecasts build-features --freeze /private/tmp/player-forecast-freeze
python -m modeling.player_forecasts train --freeze /private/tmp/player-forecast-freeze
python -m modeling.player_forecasts evaluate-development --freeze /private/tmp/player-forecast-freeze
python -m modeling.player_forecasts seal-for-lockbox --freeze /private/tmp/player-forecast-freeze
```

Development includes regular-season games through 2026-01-02. Training, tuning, feature selection, and calibration commands reject rows from 2026-01-03 onward.

The primary lockbox may be opened once, but only after the reviewed artifact is checksum-sealed with `lockboxReady=true`. Development baseline artifacts deliberately carry `lockboxReady=false`, so copying the confirmation command alone cannot open the lockbox:

```bash
PLAYER_FORECAST_LOCKBOX_CONFIRM=2025-26-primary-once \
  python -m modeling.player_forecasts evaluate-lockbox \
  --freeze /private/tmp/player-forecast-freeze \
  --receipt /private/tmp/player-forecast-lockbox-receipt.json
```

The primary receipt is immutable and refuses a second run. Complete its fixed,
checksum-bound baseline and gate comparison once, without changing the model:

```bash
python -m modeling.player_forecasts complete-lockbox-evidence \
  --freeze /private/tmp/player-forecast-freeze \
  --receipt /private/tmp/player-forecast-lockbox-receipt.json \
  --output /private/tmp/player-forecast-lockbox-evidence.json
```

After a lockbox receipt exists, a second primary evaluation fails. The evidence
companion also refuses replacement and records `tuningPermitted=false`. Any
model changed after viewing the receipt is a validation model and requires
untouched 2026–27 prospective confirmation.

### Post-lockbox validation challenger

The 2025–26 primary lockbox is consumed. The following workflow never opens it
again and every artifact is labeled `validation_not_blind_evidence`. It uses
official NHL first- and second-assist identities as settled outcome/history
labels, preserves official total assists as `A1 + A2`, reconstructs issued
H1–H10 checkpoints from the final schedule, and fits only inside the original
development window.

```bash
set -a
source web/.env.local
set +a

PLAYER_FORECAST_DATABASE_URL="$SUPABASE_DB_URL" \
  .venv/bin/python -m modeling.player_forecasts freeze-validation-challenger \
  --output /private/tmp/player-forecast-validation-v2

.venv/bin/python -m modeling.player_forecasts build-validation-features \
  --freeze /private/tmp/player-forecast-validation-v2 \
  --target assists \
  --target primary_assists \
  --target secondary_assists \
  --target hits

.venv/bin/python -m modeling.player_forecasts train-validation-challenger \
  --freeze /private/tmp/player-forecast-validation-v2
```

The target-limited feature build is intentional: it evaluates the two failed
or questioned segments without spending local disk and CPU on unchanged
targets. The output remains local, checksum-bound, non-promotable, and may be
deleted after the artifact and validation report are reviewed. Do not pass the
old lockbox confirmation variable to any validation command.

The validation artifact reports every H1–H10 checkpoint separately. It does
not force intervals to widen: residual quantiles and variance are fitted per
population, target, and horizon. Missing horizon support uses an explicitly
flagged pooled fallback. Historical schedule revisions are unavailable, so
these horizon results are validation evidence, not blind promotion evidence.

Rest-of-season records live separately from H1–H10 outputs in
`player_forecast_rest_of_season_outputs`. Conditional totals sum the
conditional game distributions. Unconditional totals require a playing
probability for every component game and fail closed when one is missing. The
dashboard adds season-to-date actuals only for display; fantasy scoring remains
downstream. Do not label a next-10 partial aggregate as rest of season: an ROS
row is valid only when its component manifest covers every remaining scheduled
game under one schedule-revision hash.

When an immutable 2026–27 freeze exists, record prospective evidence once with
the unchanged primary artifact:

```bash
PLAYER_FORECAST_DATABASE_URL="$pf_db_url" \
  python -m modeling.player_forecasts freeze-prospective \
  --output /private/tmp/player-forecast-2026-27-freeze \
  --artifact /private/tmp/player-forecast-lockbox-ready.json \
  --primary-receipt /private/tmp/player-forecast-lockbox-receipt.json

python -m modeling.player_forecasts build-features \
  --freeze /private/tmp/player-forecast-2026-27-freeze

PLAYER_FORECAST_PROSPECTIVE_CONFIRM=2026-27-fixed-artifact-once \
  python -m modeling.player_forecasts evaluate-prospective \
  --freeze /private/tmp/player-forecast-2026-27-freeze \
  --primary-receipt /private/tmp/player-forecast-lockbox-receipt.json \
  --output /private/tmp/player-forecast-2026-27-prospective.json \
  --start 2026-10-01 \
  --end 2026-10-31
```

The command rejects a non-2026–27 freeze, a changed artifact, an invalid primary
receipt, an overlapping historical lockbox range, or an existing output. It
always records `tuningPermitted=false` and does not itself authorize promotion.

## 2026–27 season projection workflow

The season platform is a permanent raw-hockey projection system, not a one-off
test. Python trains and generates complete releases locally. The existing web
application verifies the portable artifact, serves published releases, and
provides the sole-editor workflow. All season records use the
`player-forecasts-research-v3-season` contract and checksum
`29c6766f63ba9a8dbf8890cb6a388418945134b70217d58e9d8645b34dc36b93`.

Configure the owner allowlist without printing the UUID:

```text
PLAYER_FORECAST_EDITOR_USER_IDS=<one owner UUID>
PLAYER_FORECAST_SEASON_INFERENCE_ENABLED=false
```

Production rejects zero or multiple editor UUIDs. Cron authorization never
satisfies the season-editor middleware.

Run the reproducible local pipeline from the repository root. Output paths must
remain outside the repository:

```bash
PLAYER_FORECAST_DATABASE_URL="$pf_readonly_database_url" \
  .venv/bin/python -m modeling.player_forecasts season-audit \
  --output /private/tmp/fhfh-season-audit-v3.json

PLAYER_FORECAST_DATABASE_URL="$pf_readonly_database_url" \
  .venv/bin/python -m modeling.player_forecasts season-freeze \
  --history-season 20232024 --history-season 20242025 \
  --history-season 20252026 --history-season 20262027 \
  --output /private/tmp/fhfh-season-freeze-v3

pf_season_freeze=/private/tmp/fhfh-season-freeze-v3

# When the local proof database does not contain the sealed historical tables,
# refresh only current identity/official state from local Supabase and inherit
# checksum-verified historical files from an existing immutable freeze:
PLAYER_FORECAST_DATABASE_URL="$pf_local_database_url" \
  .venv/bin/python -m modeling.player_forecasts season-freeze \
  --base-freeze /private/tmp/fhfh-season-freeze-v3 \
  --output /private/tmp/fhfh-season-freeze-v3-refreshed

# Use this refreshed freeze for the remaining commands in that workflow.
pf_season_freeze=/private/tmp/fhfh-season-freeze-v3-refreshed

jq '{sourceCounts, unresolvedRows, invalidIdentityRows,
  resolvedBoxScoreDisagreements, predictiveFeatureUse}' \
  "$pf_season_freeze/assist-label-audit.json"
jq '.publicationBlockers' "$pf_season_freeze/manifest.json"

.venv/bin/python -m modeling.player_forecasts season-train \
  --freeze "$pf_season_freeze" \
  --output /private/tmp/fhfh-season-artifact-v3

.venv/bin/python -m modeling.player_forecasts season-project \
  --freeze "$pf_season_freeze" \
  --artifact /private/tmp/fhfh-season-artifact-v3/season-artifact.json \
  --output /private/tmp/fhfh-season-opening-v3 \
  --view opening --cutoff 2026-09-29T20:59:59Z

.venv/bin/python -m modeling.player_forecasts season-verify \
  --bundle /private/tmp/fhfh-season-opening-v3

.venv/bin/python -m modeling.player_forecasts season-project \
  --freeze "$pf_season_freeze" \
  --artifact /private/tmp/fhfh-season-artifact-v3/season-artifact.json \
  --output /private/tmp/fhfh-season-current-v3 \
  --view current --cutoff 2026-08-13T10:00:00Z

.venv/bin/python -m modeling.player_forecasts season-project \
  --freeze "$pf_season_freeze" \
  --artifact /private/tmp/fhfh-season-artifact-v3/season-artifact.json \
  --output /private/tmp/fhfh-season-ros-v3 \
  --view ros --cutoff 2026-08-13T10:00:00Z

.venv/bin/python -m modeling.player_forecasts season-verify \
  --bundle /private/tmp/fhfh-season-current-v3

.venv/bin/python -m modeling.player_forecasts season-verify \
  --bundle /private/tmp/fhfh-season-ros-v3
```

`opening` contains all scheduled games after the cutoff. `ros` contains every
remaining game after its cutoff. `current` adds cutoff-safe season actuals to
the remaining-game distributions. None of these paths scales H1 by 84 or uses
an H1–H10 subtotal as ROS. Historical participation is normalized to the
82-game schedule used in 2023–24 through 2025–26; projection aggregation and
GP/start interval caps use the 84 scheduled opportunities in 2026–27 (and the
actual smaller remaining-game count after games are completed).

Import a verified release into local Supabase only:

```bash
cd web
pf_status_json="$(npm run --silent supabase:safe -- status -o json)"

NEXT_PUBLIC_SUPABASE_URL="$(jq -r '.API_URL' <<<"$pf_status_json")" \
NEXT_PUBLIC_SUPABASE_PUBLIC_KEY="$(jq -r '.ANON_KEY' <<<"$pf_status_json")" \
SUPABASE_SERVICE_ROLE_KEY="$(jq -r '.SERVICE_ROLE_KEY' <<<"$pf_status_json")" \
PLAYER_FORECAST_DATABASE_URL="$(jq -r '.DB_URL' <<<"$pf_status_json")" \
PLAYER_FORECAST_SEASON_IMPORT_CONFIRM=local-only \
PLAYER_FORECAST_PYTHON="$PWD/../.venv/bin/python" \
  npm run import:player-forecast-season -- \
  --bundle=/private/tmp/fhfh-season-opening-v3
```

The importer independently verifies every checksum and row count, invokes the
Python bundle verifier, seeds only the local reference rows needed for the
proof, uploads the artifact to its private checksum path, and imports in
bounded conflict-safe chunks. Re-running a complete bundle returns the existing
run; re-running an interrupted draft resumes missing chunks and reports success
only after all three exact row counts match the manifest.

After importing regenerated `current` and `ros` bundles, reconcile due local
queue jobs only when a newer imported run covers each job's source watermark
and requested player/team scope:

```bash
eval "$(npm run --silent supabase:safe -- status -o env 2>/dev/null)"

NEXT_PUBLIC_SUPABASE_URL="$API_URL" \
NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY" \
SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
PLAYER_FORECAST_SEASON_IMPORT_CONFIRM=local-only \
  npm run reconcile:player-forecast-season-local-queue
```

The local-only command claims and finishes jobs through the lease RPCs. It
never deletes or blindly clears queue rows. Missing run, watermark, or scope
coverage leaves the job failed and publication blocked.

Validate and publish a local run with the same sole-editor allowlist and admin
role checks as the web route:

```bash
NEXT_PUBLIC_SUPABASE_URL="$API_URL" \
NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY" \
SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
PLAYER_FORECAST_EDITOR_USER_IDS="$pf_editor_user_id" \
PLAYER_FORECAST_SEASON_IMPORT_CONFIRM=local-only \
  npm run publish:player-forecast-season-local -- \
  --run-id="$pf_run_id" \
  --label="2026–27 beta current v1" \
  --reason="Local checksum-verified projection release."
```

Run this once for each intended opening/current/ROS run. The script is
idempotent for an already-published run and fails unless validation reports no
schedule, roster, identity, component-manifest, arithmetic, or queue issues.

### Latest local acceptance evidence

The final August 14, 2026 identity-resolved replay produced artifact checksum
`11f21dfafd3a46c55b7ac8d8dbe588b0077eb43423423980d4c90a8391bbce53`.
It contains 1,090 players and 32 roster-adjusted team contexts. Its frozen
141,488 skater-game rows have zero unresolved or invalid assist labels; 98,612
use frozen WGO settled labels, 42,688 complete normalized play-by-play, 27
official-boxscore zero evidence, and 161 final Gamecenter resolutions. The
reconciliation detected 149 source conflicts, checked 203 rows against final
Gamecenter payloads, corrected 161, retained 42 official-supported
selected-label/box-score disagreements, and left zero unresolved. Opening,
current, and ROS each verified with 91,560 player-game components, 1,090 player
aggregates, and 32 team aggregates. All eight previously unresolved official
roster identities are mapped, player-pool review is empty, all 16 identity
resolution queue jobs are succeeded, and no dirty job remains. Each view passed
publication validation with 1,344 schedule games and zero issues, then became
local beta release number 4 while releases 1 through 3 remained immutable
rollback targets. The public local API returned the active current v4 release; Nathan
MacKinnon was 132.79 points in 81.94 expected games, and every player's GP/start
p90 was at most 84. No hosted Cron job, hosted migration, Vercel deployment, or
blind-test claim was created.

Raw WGO game-log metadata is not an eligible join key. In the source audit,
347,791 of 441,274 `wgo_skater_stats` rows lacked `game_id`, and 253,362 rows
tagged as 2024–25 fell outside that official season window. The freeze ignores
WGO `game_id` and `season_id`, joins player plus game date to a unique official
NHL game, and derives the season from that official game. The required settled
outcome columns themselves passed completeness, identity, nonnegative-value,
and duplicate-key checks.

After normalized Gamecenter results are captured, build and verify a cutoff-safe
settlement bundle. The command includes only final games whose immutable source
capture was available by the supplied cutoff. A zero-game outcome is derived
from complete-boxscore absence only for a player who had an issued forecast:

```bash
.venv/bin/python -m modeling.player_forecasts season-settle \
  --freeze /private/tmp/fhfh-season-freeze-v3 \
  --output /private/tmp/fhfh-season-settlement-v3 \
  --cutoff 2026-10-09T10:00:00Z

.venv/bin/python -m modeling.player_forecasts season-settlement-verify \
  --bundle /private/tmp/fhfh-season-settlement-v3

cd web
pf_status_json="$(npm run --silent supabase:safe -- status -o json)"

NEXT_PUBLIC_SUPABASE_URL="$(jq -r '.API_URL' <<<"$pf_status_json")" \
NEXT_PUBLIC_SUPABASE_PUBLIC_KEY="$(jq -r '.ANON_KEY' <<<"$pf_status_json")" \
SUPABASE_SERVICE_ROLE_KEY="$(jq -r '.SERVICE_ROLE_KEY' <<<"$pf_status_json")" \
PLAYER_FORECAST_SEASON_SETTLEMENT_IMPORT_CONFIRM=local-only \
PLAYER_FORECAST_PYTHON=.venv/bin/python \
  npm run import:player-forecast-season-settlement -- \
  --bundle=/private/tmp/fhfh-season-settlement-v3
```

The importer appends outcome revisions, compares every published release's
model and editorial values independently, and records raw point, probability,
and interval losses beside the versioned baseline-relative skill index.
Corrections within 48 hours append revisions; earlier records are immutable.

Inspect operations at:

- `/api/v1/player-forecasts/season-readiness`
- `/api/v1/player-forecasts/jobs/season-drain?dryRun=true`
- `/api/v1/player-forecasts/jobs/season-settlement?dryRun=true`
- `/api/v1/player-forecasts/jobs/season-daily?dryRun=true`
- `/db/player-forecast-season-editor`
- `/fantasy-projections`

The editor maps or explicitly excludes every unresolved official-roster
identity, then creates overrides, validates the draft, and manually publishes
the opening release. Public APIs and `/fantasy-projections` remain empty until
an immutable release becomes the active pointer. Eight unresolved identities
were present in the August 12 freeze and were resolved in the August 13 replay;
future unresolved identities remain hard publication blockers.

Use **Resolve identity** to search canonical names, verified aliases, and
external IDs with fuzzy matching. An existing match may be selected only when
its NHL ID is empty or equals the official-review NHL ID; a different attached
NHL ID is surfaced as a conflict and cannot be mapped directly. When no safe
match exists, choose the lifecycle and use **Create verified identity & map**.
The server re-fetches the official NHL player landing record, rejects missing
or mismatched required fields, and atomically creates or updates the stable
identity, records the NHL mapping, supersedes the review, and enqueues current
and ROS reruns. Never paste the displayed NHL API ID into an FHFH-ID field.

Role-probability overrides replace one complete family and use JSON such as
`{"F1":0.7,"other":0.3}`; every value must be within `[0,1]` and the family
must sum to one. Team line, pair, special-team, and goalie-order overrides use
bounded JSON arrays of FHFH player IDs. Derived statistics remain read-only,
and direct primitive-stat edits remain separate from the untouched model mean.

Supabase Cron is intentionally absent after migration replay. After a capacity
audit and explicit hosted-activation approval, register it with
`select fhfh_internal.register_player_forecast_season_cron(true);`. This uses
`cron.schedule`; do not write `cron.job` directly. Keep `true` until a separate
non-dry-run activation is approved.

Rollback is an atomic pointer change in the editor. It never deletes releases,
artifacts, model values, overrides, or release events.

## Optional hosted activation checklist

Hosted activation is optional and is not part of local acceptance. Before requesting it:

1. Perform a read-only capacity audit of the existing Supabase and Vercel projects.
2. Record that Cron, database, function invocations, duration, storage, and bandwidth fit existing included allocations with conservative headroom.
3. Leave `PLAYER_FORECAST_ENABLE_INFERENCE=false` and queue draining at `dryRun=true`.
4. Request explicit approval for the exact migration and deployment targets.
5. Stop if activation would create a branch charge, paid add-on, new subscription, or likely overage.

## Budget and operational policy

The approved incremental infrastructure budget is `$0`. Local Supabase, local Next.js, and the local Python worker are the proof environment. Existing hosted allocations may be used only after a read-only capacity audit and explicit activation approval. Initial queue batches remain at eight jobs, maximum fifty, with 240-second leases and ten-minute maximum queue age. Five-minute polling is deliberate: together with the five-minute debounce it meets that bound without creating an idle request every minute. Raise limits only from measured evidence.

## Settlement and corrections

- The next-morning run appends provisional outcomes and evaluations.
- Corrections append new outcome/evaluation revisions for 48 hours.
- The final pass marks the latest revision final without rewriting history.
- Aggregate accountability is grouped by slate, model artifact, scoring version, position, target, and horizon; always inspect raw losses beside the 0–100 index.

## Troubleshooting

| Symptom | Check | Safe action |
| --- | --- | --- |
| Missing forecast tables | Migration list and readiness `missingTables` | Replay only on local/approved branch |
| Worker unreachable | Preview URL and variable presence booleans | Correct preview-scoped configuration |
| Contract mismatch | Contract version/checksum in readiness | Rebuild both previews from the same revision |
| Queue remains running | Lease expiry and owner-safe finish RPC | Let the lease expire; do not edit queue rows |
| No outputs | `dryRun`, inference flag, artifact/feature availability | Expected before inference activation |
| Conflict email absent | Resend presence and review API status | Use admin review page; preserve evidence |
| Forecast after puck drop | Run cutoff metadata | Treat as a release blocker |
| Lockbox command refused | Artifact not approved, existing receipt, checksum mismatch, or wrong confirmation | Do not edit the artifact or delete a receipt; complete review or use prospective validation |

## Rollback

- Local proof: stop the local processes; retain source changes and test evidence.
- Production shadow: set `PLAYER_FORECAST_ENABLE_INFERENCE=false`, restore the cron drain to `dryRun=true`, and retain all records.
- Champion: use the audited atomic rollback action only after explicit approval.
- Never delete observations, forecasts, outcomes, evaluations, artifacts, or lockbox receipts as rollback behavior.
