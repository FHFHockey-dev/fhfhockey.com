-- Proposed one-row production data repair. DO NOT EXECUTE without TJ's approval.
-- No application deployment, roster modification, refresh, or bulk matching.
begin;
set local statement_timeout = '3000ms';
set local lock_timeout = '1000ms';
do $repair$
declare inserted integer;
begin
  if (select count(*) from public.fhfh_player_identities
      where id=7531 and nhl_player_id=8481538 and canonical_name='Judd Caulfield'
        and canonical_position='R' and current_nhl_team_id=24 and verification_status='verified'
        and lifecycle_status='active_nhl' and merged_into_id is null) <> 1 then
    raise exception 'Canonical evidence changed';
  end if;
  if (select count(*) from public.fhfh_player_identities where canonical_name='Judd Caulfield') <> 1 then
    raise exception 'Canonical name is no longer unique';
  end if;
  if (select count(*) from public.yahoo_players
      where player_key='477.p.31129' and player_id='31129'
        and full_name='Judd Caulfield' and editorial_team_abbreviation='ANA'
        and game_id=477 and season=2026) <> 1 then
    raise exception 'Yahoo evidence changed';
  end if;
  if exists (select 1 from public.fhfh_player_external_identities
      where provider='yahoo' and (external_player_id in ('477.p.31129','31129')
        or (fhfh_player_id=7531 and season_id=20262027))) then
    raise exception 'Mapping now exists; inspect before retry';
  end if;
  insert into public.fhfh_player_external_identities
    (fhfh_player_id,provider,external_player_id,context_key,season_id,is_primary,
     match_method,verification_status,source_provenance,verified_at,verified_by_system)
  values (7531,'yahoo','477.p.31129','yahoo:game:477:season:2026',20262027,true,
    'manual_review_exact_name_team','verified',
    jsonb_build_object('repair','rso-caulfield-2026-11-12','nhl_player_id',8481538,
      'yahoo_player_key','477.p.31129','canonical_name','Judd Caulfield',
      'team','ANA','evidence','Current stored Yahoo row and verified canonical NHL identity; exact unique full name and team reviewed'),
    now(),'scout:rso-caulfield-reviewed-repair-v1');
  get diagnostics inserted = row_count;
  if inserted <> 1 then raise exception 'Expected one inserted mapping'; end if;
  if (select count(*) from public.yahoo_nhl_player_map_read
      where yahoo_player_id='477.p.31129' and nhl_player_id='8481538') <> 1 then
    raise exception 'RSO reader did not expose exact mapping';
  end if;
end
$repair$;
commit;
