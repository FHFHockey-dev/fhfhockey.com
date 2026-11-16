-- P2 + P3, TJ-approved 2026-11-09. Run once in the Supabase SQL editor (project fhfhockey.com).
-- P2: delete the 978 season-cumulative rows (98 x 8 tables + 97 x 2 pk tables) dated 2026-04-17 (no NHL games that day) from the 10 NST goalie gamelog tables.
-- P3: re-key the NSH Matt Murray 2026-10-10 row from 8476899 (wrong Murray) to 8483575.
-- Aborts with no changes if any count differs from the 2026-11-09 dry count.
do $$
declare t text; n int; total_del int := 0; total_upd int := 0;
begin
  if exists (select 1 from games where date='2026-04-17') then raise exception 'games exist on 2026-04-17; abort'; end if;
  foreach t in array array['5v5_counts','5v5_rates','ev_counts','ev_rates','all_counts','all_rates','pp_counts','pp_rates','pk_counts','pk_rates'] loop
    execute format('delete from public.nst_gamelog_goalie_%s where date_scraped=%L and season=20252026', t, '2026-04-17');
    get diagnostics n = row_count; total_del := total_del + n;
    execute format('update public.nst_gamelog_goalie_%s set player_id=8483575 where date_scraped=%L and player_id=8476899 and team=%L', t, '2026-10-10', 'NSH');
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'murray update % rows in %', n, t; end if;
    total_upd := total_upd + n;
  end loop;
  if total_del <> 978 then raise exception 'deleted % rows, expected 978', total_del; end if;
  raise notice 'deleted %, updated %', total_del, total_upd;
end $$;

-- Verify (expect 0 and 1):
select
  (select count(*) from nst_gamelog_goalie_5v5_counts where date_scraped='2026-04-17') as left_0417,
  (select count(*) from nst_gamelog_goalie_all_counts where date_scraped='2026-10-10' and player_id=8483575) as murray_new;

-- The goalie matrix reads internal_stats.goalie_stats_unified, so Murray's game shows up after its next refresh (last ran 09:05 UTC).
