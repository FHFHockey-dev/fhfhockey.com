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
