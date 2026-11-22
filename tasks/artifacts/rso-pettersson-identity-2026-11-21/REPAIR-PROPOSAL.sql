-- PROPOSAL ONLY. NOT EXECUTED. Do not run without TJ's explicit approval of this exact file.
-- Lane RSO-CUSTOMER-BUGS-1121 (2026-11-21). Two verified Yahoo crosswalk rows for the 2026-27 game (477):
--   477.p.32762 (Yahoo D, VAN)  -> canonical 10377 / NHL 8483678  Elias Pettersson (D)
--   477.p.7520  (Yahoo C, VAN)  -> canonical 9780  / NHL 8480012  Elias Pettersson (C)
-- Evidence (read-only SELECTs, TJ-approved, 2026-11-21): both canonical identities verified + active_nhl, team 23,
-- with ZERO Yahoo crosswalk rows in any season; yahoo_players holds both keys for games 453/465/477, and each Yahoo
-- player_id keeps its position across all three games (32762 = D; 7520 = C / C,LW). The match is by stable Yahoo
-- player_id + position + NHL id, reviewed. The shared name and team are NOT used to choose (both are VAN).
-- Not included: Sebastian Aho D (477.p.7654 -> canonical 8589 / NHL 8480222) is lifecycle 'inactive', so a crosswalk
-- alone would not bring him into the planning catalog; that needs its own identity review.
-- No application deploy, roster change, provider refresh or bulk matching. Readers ignore is_primary; the existing
-- 477 rollover rows use false, so these do too.
begin;
set local statement_timeout = '3000ms';
set local lock_timeout = '1000ms';
do $repair$
declare inserted integer;
begin
  -- Canonical evidence, both players, unchanged since the read.
  if (select count(*) from public.fhfh_player_identities
      where (id, nhl_player_id, canonical_position) in ((10377, 8483678, 'D'), (9780, 8480012, 'C'))
        and canonical_name = 'Elias Pettersson' and current_nhl_team_id = 23
        and verification_status = 'verified' and lifecycle_status = 'active_nhl' and merged_into_id is null) <> 2 then
    raise exception 'Canonical evidence changed';
  end if;
  -- Yahoo evidence for this season's keys, positions distinct.
  if (select count(*) from public.yahoo_players
      where game_id = 477 and season = 2026 and full_name = 'Elias Pettersson' and editorial_team_abbreviation = 'VAN'
        and ((player_key = '477.p.32762' and player_id = '32762' and display_position = 'D')
          or (player_key = '477.p.7520' and player_id = '7520' and display_position = 'C'))) <> 2 then
    raise exception 'Yahoo evidence changed';
  end if;
  -- Nothing may already claim either key or either player for Yahoo, in any season (incl. a crossed namesake row).
  if exists (select 1 from public.fhfh_player_external_identities
      where provider = 'yahoo'
        and (external_player_id in ('477.p.32762', '32762', '465.p.32762', '453.p.32762', '477.p.7520', '7520', '465.p.7520', '453.p.7520')
          or fhfh_player_id in (10377, 9780))) then
    raise exception 'A Yahoo mapping now exists for one of these keys or players; inspect before retry';
  end if;
  insert into public.fhfh_player_external_identities
    (fhfh_player_id, provider, external_player_id, context_key, season_id, is_primary,
     match_method, verification_status, source_provenance, verified_at, verified_by_system)
  values
    (10377, 'yahoo', '477.p.32762', 'yahoo:game:477:season:2026', 20262027, false,
     'manual_review_stable_yahoo_id_position', 'verified',
     jsonb_build_object('repair', 'rso-pettersson-identity-2026-11-21', 'nhl_player_id', 8483678, 'yahoo_player_key', '477.p.32762',
       'yahoo_position', 'D', 'canonical_position', 'D', 'namesake_excluded', jsonb_build_object('fhfh_player_id', 9780, 'nhl_player_id', 8480012),
       'evidence', 'Yahoo player_id 32762 is D in games 453/465/477; canonical 10377 is the only verified active D of this name'),
     now(), 'chef:rso-pettersson-reviewed-repair-v1'),
    (9780, 'yahoo', '477.p.7520', 'yahoo:game:477:season:2026', 20262027, false,
     'manual_review_stable_yahoo_id_position', 'verified',
     jsonb_build_object('repair', 'rso-pettersson-identity-2026-11-21', 'nhl_player_id', 8480012, 'yahoo_player_key', '477.p.7520',
       'yahoo_position', 'C', 'canonical_position', 'C', 'namesake_excluded', jsonb_build_object('fhfh_player_id', 10377, 'nhl_player_id', 8483678),
       'evidence', 'Yahoo player_id 7520 is C (C,LW earlier) in games 453/465/477; canonical 9780 is the only verified active C of this name'),
     now(), 'chef:rso-pettersson-reviewed-repair-v1');
  get diagnostics inserted = row_count;
  if inserted <> 2 then raise exception 'Expected two inserted mappings'; end if;
  -- The RSO legacy reader must expose exactly the two right pairs and never a crossed one.
  if (select count(*) from public.yahoo_nhl_player_map_read
      where (yahoo_player_id, nhl_player_id::text) in (('477.p.32762', '8483678'), ('477.p.7520', '8480012'))) <> 2 then
    raise exception 'RSO reader did not expose both exact mappings';
  end if;
  if exists (select 1 from public.yahoo_nhl_player_map_read
      where (yahoo_player_id = '477.p.32762' and nhl_player_id::text <> '8483678')
         or (yahoo_player_id = '477.p.7520' and nhl_player_id::text <> '8480012')) then
    raise exception 'RSO reader exposes a crossed namesake mapping';
  end if;
end
$repair$;
commit;

-- ROLLBACK (separate, only if the repair must be undone; also NOT EXECUTED). Removes exactly the two rows above.
-- BEGIN ROLLBACK
-- begin;
-- set local statement_timeout = '3000ms';
-- set local lock_timeout = '1000ms';
-- do $rollback$
-- declare removed integer;
-- begin
--   delete from public.fhfh_player_external_identities
--   where provider = 'yahoo' and context_key = 'yahoo:game:477:season:2026' and season_id = 20262027
--     and verified_by_system = 'chef:rso-pettersson-reviewed-repair-v1'
--     and source_provenance ->> 'repair' = 'rso-pettersson-identity-2026-11-21'
--     and ((fhfh_player_id = 10377 and external_player_id = '477.p.32762')
--       or (fhfh_player_id = 9780 and external_player_id = '477.p.7520'));
--   get diagnostics removed = row_count;
--   if removed <> 2 then raise exception 'Expected to remove exactly the two repair rows, found %', removed; end if;
-- end
-- $rollback$;
-- commit;
-- END ROLLBACK

-- LIVE PRECONDITIONS (read-only; run once, right before the repair, only with TJ's approval). Every *_ok must be true.
-- The two md5 values come from the disposable PostgreSQL 15.19 rehearsal built from the migrations
-- (function 495ccc4353268f60559dc3db197698d0, view 88f9440fcf64a968772b12215785ed70). A different value can be
-- server-version formatting or real drift: fetch both definitions and diff them before running anything.
-- BEGIN PRECONDITIONS
-- begin transaction read only;
-- set local statement_timeout = '3000ms';
-- select
--   (select count(*) from public.fhfh_player_identities
--     where (id, nhl_player_id, canonical_position) in ((10377, 8483678, 'D'), (9780, 8480012, 'C'))
--       and canonical_name = 'Elias Pettersson' and current_nhl_team_id = 23
--       and verification_status = 'verified' and lifecycle_status = 'active_nhl' and merged_into_id is null) = 2 as canonical_ok,
--   (select count(*) from public.yahoo_players
--     where game_id = 477 and season = 2026 and full_name = 'Elias Pettersson' and editorial_team_abbreviation = 'VAN'
--       and ((player_key = '477.p.32762' and player_id = '32762' and display_position = 'D')
--         or (player_key = '477.p.7520' and player_id = '7520' and display_position = 'C'))) = 2 as yahoo_ok,
--   not exists (select 1 from public.fhfh_player_external_identities
--     where provider = 'yahoo'
--       and (external_player_id in ('477.p.32762', '32762', '465.p.32762', '453.p.32762', '477.p.7520', '7520', '465.p.7520', '453.p.7520')
--         or fhfh_player_id in (10377, 9780))) as unclaimed_ok,
--   (select count(*) from pg_constraint where conrelid = 'public.fhfh_player_external_identities'::regclass
--     and conname in ('fhfh_player_external_provider_context_id_unique', 'fhfh_player_external_player_provider_context_id_unique')) = 2 as uniques_ok,
--   md5(pg_get_functiondef('public.verified_yahoo_player_identities_read()'::regprocedure)) as reader_function_md5,
--   md5(pg_get_viewdef('public.yahoo_nhl_player_map_read'::regclass, true)) as reader_view_md5;
-- commit;
-- END PRECONDITIONS
