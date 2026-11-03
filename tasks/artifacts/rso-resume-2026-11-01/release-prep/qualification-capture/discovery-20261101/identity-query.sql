-- PREPARED ONLY. Requires the separate bounded production-read authorization in PROTOCOL.md.
-- Metadata discovery: no forecast values, captured input bodies, player rows or outcomes.
-- Dates are deliberately fixed. If this window is missed, replace the proposal before execution.
begin read only;
set local statement_timeout = '5s';
set local lock_timeout = '1s';

with latest as (
  select distinct on (game_id)
    id, run_id, game_id, slate_date, input_snapshot_id, decision_as_of, published_at, payload
  from public.forge_game_revisions
  where slate_date = date '2026-11-01'
  order by game_id, decision_as_of desc, published_at desc, id desc
), bounded as (
  select * from latest order by game_id limit 17
)
select r.id as "revisionId", r.run_id as "runId", r.game_id as "gameId",
  r.slate_date as "gameDate", r.published_at as "issuedAt",
  coalesce(r.payload->>'inputCutoff', r.decision_as_of::text) as "cutoffAt",
  g."startTime" as "scheduledAt", r.input_snapshot_id as "snapshotId",
  r.payload->>'modelMode' as method, r.payload->>'codeVersion' as "codeVersion",
  r.payload #> '{inputProvenance,modelIdentity}' as "modelIdentity",
  s.payload->>'version' as "snapshotVersion", s.payload->>'runId' as "snapshotRunId",
  s.payload->>'slateDate' as "snapshotSlateDate", s.payload->>'modelMode' as "snapshotMethod",
  s.payload->>'codeVersion' as "snapshotCodeVersion",
  s.payload->'modelEnvironment' as "modelEnvironment",
  s.payload #> '{inputProvenance,modelIdentity}' as "snapshotModelIdentity",
  s.payload->>'replayClassification' as "replayClassification",
  s.payload->'horizonGames' as horizon, s.payload_hash as "snapshotPayloadHash",
  f.status as "runStatus", f.git_sha as "runGitSha",
  f.metrics->'producer_identity' as "producerIdentity",
  f.metrics #>> '{resume,invocations}' as "runInvocations"
from bounded r
left join public.player_forecast_source_observations s
  on s.id = r.input_snapshot_id and s.provider = 'forge' and s.dataset_key = 'forge-run-inputs-v1'
left join public.forge_runs f on f.run_id = r.run_id
left join public.games g on g.id = r.game_id
order by r.game_id;


rollback;

