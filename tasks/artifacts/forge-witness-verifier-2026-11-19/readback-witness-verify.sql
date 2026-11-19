-- Read-only: for one game, the cron fires, each pg_net response, the armed target, its verdict and the publisher gate
-- for that verdict's exact hashes. Run as postgres:  psql -v game=2026020123 -f readback-witness-verify.sql
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on
with g(game) as (select (:'game')::bigint),
target as (select t from g, jsonb_array_elements(forge_witness.status_v1()->'targets') t where (t->>'gameId')::bigint = g.game),
verdict as (select t->'verdict' v from target)
select json_build_object(
  'gameId', (select game from g),
  'fires', (select coalesce(json_agg(json_build_object('fire', f.fire, 'firedAt', f.fired_at, 'requestId', f.request_id,
      'statusCode', r.status_code, 'timedOut', r.timed_out, 'error', r.error_msg, 'body', left(r.content, 4000)) order by f.fire), '[]')
    from g join forge_witness_ops.fires f on f.game_id = g.game left join net._http_response r on r.id = f.request_id),
  'target', (select t from target),
  'gate', (select forge_witness.publication_gate_v1((v->>'claim_id')::uuid, v->>'raw_sha256', v->>'canonical_sha256', v->>'tsa_token_sha256')
    from verdict where v is not null and v <> 'null'::jsonb),
  'registeredJobs', (select count(*) from cron.job, g where jobname = 'forge-witness-verify-' || g.game));
