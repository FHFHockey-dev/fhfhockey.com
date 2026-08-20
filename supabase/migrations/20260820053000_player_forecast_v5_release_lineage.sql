do $$
declare
  definition text;
  patched text;
begin
  definition := pg_catalog.pg_get_functiondef(
    'public.publish_player_forecast_season_release_atomic(uuid,text,text,jsonb,jsonb,jsonb,text,uuid,text)'::regprocedure
  );
  patched := pg_catalog.replace(definition, $old$
        and release.contract_version = 'player-forecasts-research-v4-season-fantasy'
        and release.contract_checksum = 'e0b10f508d4f3e96b93cb3b203930e05d15c1f75dcc969030e4a04f20de18150'
        and release.health_status = 'healthy'
$old$, $new$
        and release.health_status = 'healthy'
        and (
          (release.contract_version = 'player-forecasts-research-v4-season-fantasy'
           and release.contract_checksum = 'e0b10f508d4f3e96b93cb3b203930e05d15c1f75dcc969030e4a04f20de18150')
          or
          (release.contract_version = 'player-forecasts-research-v5-season-advanced'
           and release.contract_checksum = '9b91e7d1de540664f404cc518222e61fcb837127a25916ee735f37d7a185a435')
        )
$new$);
  if patched = definition then
    raise exception 'PLAYER_FORECAST_V5_RELEASE_LINEAGE_PATCH_FAILED';
  end if;
  execute patched;
end;
$$;
