-- Must run only via run_goalie_team_resolution.py against its disposable server.
\set ON_ERROR_STOP on
select current_database()='fhfh_goalie_team_fixture'
 and current_setting('fhfh.fixture',true)='goalie-team-resolution-v1'
 and current_setting('listen_addresses')='' as fixture_allowed \gset
\if :fixture_allowed
\else
  \quit 3
\endif
\ir goalie_unified_prior_view.sql

insert into public.teams(id,name,abbreviation) values
 (59,'Utah Hockey Club','UTA'),(68,'Utah Mammoth','UTA'),
 (53,'Arizona Coyotes','ARI'),(27,'Phoenix Coyotes','PHX'),
 (6,'Boston Bruins','BOS'),(16,'Chicago Blackhawks','CHI');
-- Copy the observed, misleading ARI alias to prove it is not used globally.
insert into public.team_franchise_alias values
 ('UTA','ARI',2000,2024,59),('UTA','UTA',2025,2099,68);
insert into public.players values (8478872,68),(1,6);
insert into public.games values
 (2026020013,'2026-10-01',20262027,68,16),
 (2024020001,'2024-10-01',20242025,59,6),
 (2023020001,'2023-10-01',20232024,53,6),
 (2013020001,'2013-10-01',20132014,27,6),
 (2026020002,'2026-10-02',20262027,6,16);
insert into public.wgo_goalie_stats(goalie_id,goalie_name,date,season_id,games_played,
 team_abbreviation,game_id,home_road,saves) values
 (8478872,'Karel Vejmelka','2026-10-01',20262027,1,'UTA',2026020013,'H',20),
 (8478872,'Karel Vejmelka','2024-10-01',20242025,1,'UTA',2024020001,'H',21),
 (8478872,'Karel Vejmelka','2023-10-01',20232024,1,'ARI',2023020001,'H',22),
 (1,'Control','2026-10-02',20262027,1,'BOS',2026020002,'H',23),
 (1,'Legacy no game identity','2023-01-01',20222023,1,null,null,null,24);
create materialized view internal_stats.goalie_stats_unified as
 select v.*,CURRENT_TIMESTAMP as materialized_at from public.vw_goalie_stats_unified v with no data;
create unique index goalie_stats_unified_player_id_date_idx
 on internal_stats.goalie_stats_unified(player_id,date);
create view public.goalie_stats_unified with(security_invoker=true) as
 select * from internal_stats.goalie_stats_unified;
grant select on all tables in schema public to anon,authenticated,service_role;
grant select on internal_stats.goalie_stats_unified to anon,authenticated,service_role;
create temp table contract_before as
 select attnum,attname,atttypid,atttypmod from pg_attribute
 where attrelid='public.vw_goalie_stats_unified'::regclass and attnum>0;
create temp table object_before as
 select oid,relacl,reloptions,pg_get_viewdef(oid,true) definition from pg_class
 where oid in ('public.vw_goalie_stats_unified'::regclass,
 'public.vw_goalie_stats_unified_source'::regclass,
 'internal_stats.goalie_stats_unified'::regclass,'public.goalie_stats_unified'::regclass);
create temp table values_before as select to_jsonb(v)-'view_generated_at'-'team_id'-'team_id_source' payload
 from public.vw_goalie_stats_unified v;

do $$ begin
 if (select count(*) from public.vw_goalie_stats_unified
     where player_id=8478872 and date='2026-10-01')<>2 then
   raise exception 'fixture did not reproduce exact duplicate'; end if;
 begin
   refresh materialized view internal_stats.goalie_stats_unified;
   raise exception 'expected unique-index failure';
 exception when unique_violation then null; end;
end $$;

begin;
\ir ../migrations/20261002140500_resolve_goalie_unified_game_team.sql
commit;

create function pg_temp.assert_team(a text,s integer,d date,g bigint,h text,expected smallint)
returns void language plpgsql as $$
declare ids smallint[]; begin
 select array_agg(resolved_team_id) into ids
 from internal_stats.resolve_goalie_game_team(a,s,d,g,h);
 if cardinality(ids)<>1 or ids[1] is distinct from expected then
   raise exception 'unexpected mapping % %: % expected %',a,s,ids,expected; end if;
end $$;
create function pg_temp.expect_error(a text,s integer,d date,g bigint,h text,expected text)
returns void language plpgsql as $$
begin
 begin
   perform * from internal_stats.resolve_goalie_game_team(a,s,d,g,h);
 exception when raise_exception then
   if strpos(SQLERRM,expected)=0 then raise; end if; return;
 end;
 raise exception 'expected error %',expected;
end $$;

select pg_temp.assert_team('UTA',20262027,'2026-10-01',2026020013,'H',68::smallint);
select pg_temp.assert_team('UTA',20242025,'2024-10-01',2024020001,'H',59::smallint);
select pg_temp.assert_team('ARI',20232024,'2023-10-01',2023020001,'H',53::smallint);
select pg_temp.assert_team('PHX',20132014,'2013-10-01',2013020001,'H',27::smallint);
select pg_temp.assert_team('BOS',20262027,'2026-10-02',2026020002,'H',6::smallint);
select pg_temp.assert_team('BOS',20262027,'2026-10-02',null,null,6::smallint);
select pg_temp.assert_team('CHI',20262027,'2026-10-01',2026020013,'R',16::smallint);
select pg_temp.assert_team('UTA',20262027,'2026-10-01',2026020013,null,68::smallint);
select pg_temp.assert_team('UTA',20252026,'2025-10-01',null,null,68::smallint);
select pg_temp.assert_team('UTA',20992100,'2099-10-01',null,null,68::smallint);
select pg_temp.expect_error('UTA',20242025,'2024-10-01',null,null,'ALIAS_MISSING');
select pg_temp.expect_error('UTA',21002101,'2100-10-01',null,null,'ALIAS_MISSING');
select pg_temp.expect_error('UTA',null,'2026-10-01',null,null,'SEASON_INVALID');
select pg_temp.expect_error('XXX',20262027,'2026-10-01',null,null,'TEAM_MISSING');
select pg_temp.expect_error(null,20262027,'2026-10-01',2026020013,'H','TEAM_MISSING');
select pg_temp.expect_error('UTA',20262027,'2026-10-01',2026020013,'X','GAME_SIDE_INVALID');
insert into public.games values (2024020002,'2024-10-02',20242025,59,68);
select pg_temp.expect_error('UTA',20242025,'2024-10-02',2024020002,null,'GAME_AMBIGUOUS');
select pg_temp.expect_error('UTA',20262027,'2026-10-02',2026020013,'H','GAME_MISMATCH');
select pg_temp.expect_error('UTA',20252026,'2026-10-01',2026020013,'H','GAME_MISMATCH');
select pg_temp.expect_error('UTA',20262027,'2026-10-01',999,'H','GAME_MISMATCH');
select pg_temp.expect_error('UTA',20262027,'2026-10-01',2026020013,'R','GAME_CONFLICT');
insert into public.team_franchise_alias values ('other','UTA',2025,2026,68);
select pg_temp.expect_error('UTA',20262027,'2026-10-01',2026020013,'H','ALIAS_OVERLAP');
delete from public.team_franchise_alias where franchise_key='other';
update public.team_franchise_alias set nhl_team_id=59 where abbrev='UTA';
select pg_temp.expect_error('UTA',20262027,'2026-10-01',2026020013,'H','GAME_CONFLICT');
update public.team_franchise_alias set nhl_team_id=53 where abbrev='UTA';
select pg_temp.expect_error('UTA',20262027,'2026-10-01',null,null,'ALIAS_CONFLICT');
update public.team_franchise_alias set nhl_team_id=null where abbrev='UTA';
select pg_temp.expect_error('UTA',20262027,'2026-10-01',null,null,'ALIAS_CONFLICT');
update public.team_franchise_alias set nhl_team_id=68 where abbrev='UTA';

refresh materialized view internal_stats.goalie_stats_unified;
refresh materialized view concurrently internal_stats.goalie_stats_unified;
do $$ begin
 if exists ((select * from contract_before) except
   (select attnum,attname,atttypid,atttypmod from pg_attribute
    where attrelid='public.vw_goalie_stats_unified'::regclass and attnum>0))
 or (select count(*) from contract_before)<>(select count(*) from pg_attribute
    where attrelid='public.vw_goalie_stats_unified'::regclass and attnum>0) then
   raise exception 'column/type contract changed'; end if;
 if exists (select 1 from object_before b join pg_class c using(oid)
   where b.relacl is distinct from c.relacl or b.reloptions is distinct from c.reloptions
   or (c.oid<>'public.vw_goalie_stats_unified'::regclass and b.definition<>pg_get_viewdef(c.oid,true)))
 or (select count(*) from object_before b join pg_class c using(oid))<>4 then
   raise exception 'object/ACL/security/dependency contract changed'; end if;
 if (select count(*) from public.vw_goalie_stats_unified)<>5
 or exists(select 1 from public.vw_goalie_stats_unified group by player_id,date having count(*)>1) then
   raise exception 'cardinality changed'; end if;
 if exists((select distinct payload from values_before) except
   (select to_jsonb(v)-'view_generated_at'-'team_id'-'team_id_source'
    from public.vw_goalie_stats_unified v)) then raise exception 'nonidentity fields changed'; end if;
 if (select team_id from public.goalie_stats_unified where player_id=8478872 and date='2026-10-01')<>68
 or (select team_id from public.goalie_stats_unified where player_id=8478872 and date='2024-10-01')<>59
 or (select team_id from public.goalie_stats_unified where player_id=8478872 and date='2023-10-01')<>53
 or (select team_id_source from public.goalie_stats_unified where date='2023-01-01')<>'players_team_id_fallback' then
   raise exception 'identity/history/legacy preservation failed'; end if;
end $$;
set role anon;
select count(*) as invoker_read_count from public.vw_goalie_stats_unified;
reset role;
-- Definition rollback preserves the retained materialization, and deliberately
-- does not refresh the broken prior view.
do $$ declare prior text; begin
 select definition into prior from object_before where oid='public.vw_goalie_stats_unified'::regclass;
 execute 'create or replace view public.vw_goalie_stats_unified with(security_invoker=true) as '||prior;
end $$;
drop function internal_stats.resolve_goalie_game_team(text,integer,date,bigint,text);
do $$ begin
 if md5(pg_get_viewdef('public.vw_goalie_stats_unified'::regclass,true))<>'34db6b958ee0d820179611188eaeb269'
 or (select count(*) from public.goalie_stats_unified)<>5 then
   raise exception 'definition rollback failed'; end if;
end $$;
select 'PASS: duplicate reproduction, identities, boundaries, conflicts, columns/types, ACLs, refresh and unique index' as result;
