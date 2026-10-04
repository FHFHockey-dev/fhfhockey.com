begin;
set lock_timeout='5s';
set statement_timeout='30s';

-- Preserve the existing selected-revision contract without requiring access to
-- the private queue/control schema. CREATE OR REPLACE preserves the RPC ACL.
create or replace function public.read_forge_game_revisions(p_slate_date date)
returns table(id uuid,run_id uuid,game_id bigint,decision_as_of timestamptz,published_at timestamptz,payload jsonb)
language sql stable security invoker set search_path='' as $$
  with selected as (
    select chosen.* from (
      select distinct on(game_id) * from public.forge_game_revisions where slate_date=p_slate_date
        order by game_id,decision_as_of desc,published_at desc,id desc
    ) latest
    left join public.forge_final_pregame_revisions frozen on frozen.game_id=latest.game_id
    left join lateral(select revision_id from public.forge_game_selection_events where game_id=latest.game_id
      order by created_at desc,id desc limit 1) selection on true
    join public.forge_game_revisions chosen on chosen.id=coalesce(frozen.revision_id,selection.revision_id,latest.id)
  )
  select r.id,r.run_id,r.game_id,r.decision_as_of,r.published_at,
    r.payload||pg_catalog.jsonb_build_object('previousRevision',(
      select pg_catalog.jsonb_build_object('id',p.id,'codeVersion',p.payload->>'codeVersion','modelMode',p.payload->>'modelMode',
        'players',p.payload->'players','goalies',p.payload->'goalies')
      from public.forge_game_revisions p where p.game_id=r.game_id and p.slate_date=r.slate_date
        and (p.decision_as_of,p.published_at,p.id)<(r.decision_as_of,r.published_at,r.id)
      order by p.decision_as_of desc,p.published_at desc,p.id desc limit 1))
    from selected r;
$$;

commit;
