# sKO score model v3: database change (prepared, not run)

Status: **not executed**. Each statement below is a production write that needs TJ's explicit approval in the thread that runs it.

## What changes

| Identity | v2 (live) | v3 (code at the bump commit) |
| --- | --- | --- |
| `score_model_version` | `sustainability_score_v2` | `sustainability_score_v3` |
| `config_hash` | `fnv1a_91691726` | `fnv1a_e11d5c91` |
| config revision (`model_sustainability_config.model_version`) | 2 | 3 |
| weights, toggles, constants, sd mode, freshness | unchanged | unchanged |

The hash changes only because `buildSustainabilityConfigIdentity` hashes `modelVersion` along with the weights. `web/lib/sustainability/config.ts` reads the single `active = true` row of `public.model_sustainability_config`. It rejects the row when `score_model_version` differs from the code constant, or when `config_hash` differs from the hash it recomputes. Code and DB therefore have to flip together.

Only `rebuild-priors` and `rebuild-score` load the active config. `rebuild-window-z` and `rebuild-trend-bands` do not, so they keep running under either identity.

## 1. Pre-check (read-only)

```sql
select model_version as config_revision, score_model_version, config_hash, active
from public.model_sustainability_config
order by model_version desc
limit 3;

select id, config_revision, model_version, config_hash, status
from public.sustainability_recompute_queue
where status in ('queued', 'running');
```

Proceed only if the highest revision is 2 and it is the active row, with values `sustainability_score_v2` / `fnv1a_91691726`. Otherwise stop. The RPC also enforces this: it raises `config revision must advance exactly once` if the highest revision is not 2.

## 2. Activate v3

Use the existing service-role RPC, the same path the 2026-07-25 migration used for v2. In one transaction it deactivates revision 2, inserts revision 3 as active, and enqueues one recompute receipt.

```sql
select public.activate_sustainability_config(
  3,
  'sustainability_score_v3',
  'fnv1a_e11d5c91',
  '{
    "luck": {"shp": -1.2, "oishp": -1, "ipp": -0.8, "ppshp": -0.4},
    "skill": {"ixg60": 0.9, "icf60": 0.7, "hdcf60": 0.6}
  }'::jsonb,
  '{}'::jsonb,
  '{
    "scorePrecision": 2,
    "exactScoreProbabilityThresholds": {"lower": 0.005, "upper": 0.995},
    "windowCodes": ["l3", "l5", "l10", "l20"]
  }'::jsonb,
  'fixed',
  45,
  'config_change'
);
```

Expected return: `{"configRevision": 3, "modelVersion": "sustainability_score_v3", "configHash": "fnv1a_e11d5c91", "queueId": <id>, "queueStatus": "queued"}`.

`fnv1a_e11d5c91` was computed with the repo's hash function over the identity above; the same script reproduces v2 as `fnv1a_91691726`. `canonicalSustainabilityConfigSeed()` throws if the constant drifts, and `config.test.ts` checks that a row built from the seed parses.

### The queued recompute receipt

The RPC enqueues a `config_change` job (`stage: priors`, `season: current`, `snapshotDate: current`). `process-recompute-queue` is not scheduled, so the job waits until someone runs it. Leave it queued. Do not run the worker on the cutover day: a same-day rerun under revision 3 writes `sustainability_distribution_snapshots` rows next to that date's revision-2 rows, and `health.ts` would then flag `ambiguous_distribution_identity` for that date. The next scheduled cron chain produces the first all-v3 snapshot date without it. Running or retiring the job later is a separate approval.

## 3. Post-check (read-only)

```sql
select model_version as config_revision, score_model_version, config_hash, active
from public.model_sustainability_config
where active;
```

Expect exactly one row: `3 | sustainability_score_v3 | fnv1a_e11d5c91 | true`. After the next 10:42 to 11:16 UTC chain, `rebuild-priors` and `rebuild-score` receipts should report `model_version: sustainability_score_v3`.

## 4. Rollback

Roll back only together with a code rollback to a v2 deployment, because v2 code rejects the v3 row. The RPC cannot reactivate revision 2: it only advances. This direct flip runs in one transaction; the partial unique index allows only one active row, so the deactivation must come first.

```sql
begin;

update public.model_sustainability_config
set active = false, updated_at = now()
where model_version = 3 and score_model_version = 'sustainability_score_v3' and active;

update public.model_sustainability_config
set active = true, updated_at = now()
where model_version = 2 and score_model_version = 'sustainability_score_v2'
  and config_hash = 'fnv1a_91691726';

update public.sustainability_recompute_queue
set status = 'failed', last_error = 'rolled back to revision 2', completed_at = now()
where config_revision = 3 and model_version = 'sustainability_score_v3'
  and status in ('queued', 'running');

-- Expect exactly one active row: revision 2. Otherwise run ROLLBACK.
select model_version, score_model_version, config_hash, active
from public.model_sustainability_config where active;

commit;
```

Revision 3 stays in the table as an inactive row. A later re-activation must use revision 4 through the RPC. Score and prior rows already written as v3 are not deleted. They carry `model_version = sustainability_score_v3` and can be found by that column.

## 5. Safe deploy order relative to the 10:42 UTC cron

Daily chain (`web/vercel.json`): `rebuild-priors` 10:42, `rebuild-window-z` 10:43/10:48/10:53/10:58, `rebuild-score` 11:00/11:06/11:12/11:16, `rebuild-trend-bands` 11:18/11:23/11:28/11:33 UTC.

1. Wait until today's chain is finished (after 11:35 UTC) or start well before 10:42 UTC. Never flip either side between 10:42 and 11:16 UTC; that would split one snapshot date across identities.
2. Deploy the v3 code to production first (TJ approves separately). Wait until the deployment is Ready and serving.
3. Run section 1, then section 2, right away in the same window.
4. Let the next 10:42 UTC chain write the first v3 snapshot date. Run section 3 after it.

Code goes first because a failed or canceled deploy then leaves the DB untouched, and v2 code keeps working with the v2 row. If the SQL went first and the deploy failed, every priors and score run would fail until the rollback SQL ran.

## 6. If code and DB are mismatched for one cron cycle

Either direction fails closed. `loadActiveSustainabilityConfig` throws `Unsupported active Sustainability model: …` inside `rebuild-priors` and `rebuild-score`.

- **v3 code, v2 row** (deploy landed, SQL not run): the 10:42 priors run and the four score batches error and write nothing. `rebuild-window-z` and `rebuild-trend-bands` still run on the new code. Window-z reads the existing priors rows, which were last written under v2 semantics, so that day's window-z rows mix v3 code with v2-era priors. No `sustainability_scores` row is written for that date. Readers (`read.ts`, `trends.ts`, leaderboard) pick the latest `snapshot_date`, so they keep serving the previous day's v2 scores, one day stale. Running section 2 before the next 10:42 heals it.
- **v2 code, v3 row** (SQL ran, deploy missing or rolled back): same failure in priors and score. If someone ran the queued job, its priors stage would also fail and back off. Fix by deploying v3 code, or by running section 4.
- Neither case writes rows under the wrong identity. Cron audit rows will record the failures.

## 7. What v2 history looks like after the flip

- No reader filters `sustainability_scores` by `model_version`. Readers choose by `snapshot_date` (latest, or nearest ≤ requested), so every date before the cutover stays v2, and every date after it is v3.
- Player trend history and summaries spanning the cutover will show the change in meaning as a step on that date. The rows carry `model_version`, so a UI annotation or filter is possible later; nothing does that today.
- `sustainability_player_priors` upserts on `(player_id, season_id, position_group, stat_code)` and `sustainability_scores` on `(player_id, snapshot_date, window_code)`. The first v3 run overwrites current-season priors in place and writes new score dates. Past v2 score dates are untouched.
- Trend bands (`sustainability_trend_bands_v2`) are independent of the score model and do not change.

## 8. Fresh-replay gap (open question)

`supabase/migrations/20260725223034_add_sustainability_version_provenance.sql` ends by activating revision 2 / v2, so a fresh baseline replay yields a DB that v3 code rejects. A follow-up migration that runs section 2, guarded by `where not exists (… score_model_version = 'sustainability_score_v3')`, would close that gap. It was not added here, because a `supabase db push` would then apply the production flip outside the order above.
