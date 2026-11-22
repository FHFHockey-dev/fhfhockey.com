#!/usr/bin/env bash
# In-order rehearsal of the two Rankings publisher migrations on a disposable, socket-only PostgreSQL cluster.
#   LC_ALL=C bash rehearse-migrations.sh <exported candidate root> [pg bin dir]
# Production-shaped tables come from the candidate's own checked-in migrations. Each migration runs in one
# transaction, readiness before dispatch. The script then exercises the cutoff and claim functions with marker
# shapes like the Nov 14 and Nov 19 production pairs, rolls back in reverse order, proves the schema returns to
# its pre-migration dump, and re-applies both. Nothing here connects to a hosted database.
set -euo pipefail
root=$(cd "$1" && pwd)
pgbin=${2:-/opt/homebrew/opt/postgresql@15/bin}
export LC_ALL=C LANG=C TZ=UTC PGTZ=UTC
scratch=$(mktemp -d /tmp/rkpg.XXXXXX)
trap '"$pgbin/pg_ctl" -D "$scratch/data" -m fast stop >/dev/null 2>&1 || true; rm -rf "$scratch"' EXIT
"$pgbin/initdb" -D "$scratch/data" -A trust -U postgres --no-locale >/dev/null
"$pgbin/pg_ctl" -D "$scratch/data" -o "-c listen_addresses='' -k $scratch -c timezone=UTC" -l "$scratch/pg.log" -w start >/dev/null
psql=("$pgbin/psql" -X -q -v ON_ERROR_STOP=1 -h "$scratch" -U postgres -d postgres)
dump() { "$pgbin/pg_dump" -h "$scratch" -U postgres -d postgres --schema-only --no-owner -n public | grep -v -e '^--' -e '^\\restrict ' -e '^\\unrestrict ' | sed '/^$/d' > "$1"; }
readiness=$root/supabase/migrations/20261118151903_rankings_publication_readiness.sql
dispatch=$root/supabase/migrations/20261118160000_rankings_daily_dispatch.sql
echo "server $("${psql[@]}" -Atc 'show server_version') timezone $("${psql[@]}" -Atc 'show timezone')"

# Base schema: the readiness fixture's production-shaped tables plus composites and ranking_publications.
python3 -I - "$root" > "$scratch/base.sql" <<'PY'
import re, sys
from pathlib import Path
m = Path(sys.argv[1]) / "supabase/migrations"
baseline = (m / "20260716112908_production_schema_baseline.sql").read_text()
projection = (m / "20260720105524_add_projection_materialization_transactions.sql").read_text()
game_state = (m / "20261113180000_games_game_state.sql").read_text()
print("create extension if not exists pgcrypto;")
print("create role anon; create role authenticated; create role service_role bypassrls;")
print("create schema supabase_migrations; create table supabase_migrations.schema_migrations (version text primary key, name text);")
for table in ("games", "nhl_api_game_payloads_raw", "cron_job_audit", "wgo_skater_stats", "entity_metric_rankings",
              "skater_composite_ratings", "nst_gamelog_5v5_counts", "nst_gamelog_5v5_counts_oi",
              "rolling_player_game_metrics", "rolling_player_metric_support_payloads"):
    print(re.search(rf"CREATE TABLE public\.{table} \(.*?\n\);", baseline, re.S)[0])
    for c in re.findall(rf"ALTER TABLE ONLY public\.{table}\n    ADD CONSTRAINT [^;]+;", baseline):
        if " FOREIGN KEY " not in c:
            print(c)
    print(f"grant select, insert, update on public.{table} to service_role;")
for t in ("nst_gamelog_5v5_counts", "nst_gamelog_5v5_counts_oi"):
    print(re.search(rf"ALTER TABLE public\.{t} ALTER COLUMN id ADD GENERATED[^;]+;", baseline)[0])
for s in re.findall(r"alter table public\.games\b[^;]+;", game_state, re.I):
    print(s)
print(re.search(r"create unique index nhl_api_game_payloads_raw_snapshot_identity_idx[^;]+;", projection)[0])
for table in ("nhl_api_game_payload_snapshot_heads", "projection_pipeline_state"):
    print(re.search(rf"create table public\.{table} \(.*?\n\);", projection, re.S)[0])
    print(re.search(rf"grant select, insert, update on table public\.{table}\s+to service_role;", projection)[0])
print(re.search(r"CREATE INDEX idx_entity_metric_rankings_lookup [^;]+;", baseline)[0])
print((m / "20261115210000_ranking_publications.sql").read_text())
print("insert into supabase_migrations.schema_migrations values ('20261115210000','ranking_publications');")
PY
"${psql[@]}" -f "$scratch/base.sql" >/dev/null
dump "$scratch/before.sql"

apply() {
  "${psql[@]}" --single-transaction -f "$readiness" -c "insert into supabase_migrations.schema_migrations values ('20261118151903','rankings_publication_readiness')"
  "${psql[@]}" --single-transaction -f "$dispatch" -c "insert into supabase_migrations.schema_migrations values ('20261118160000','rankings_daily_dispatch')"
}
apply
echo "PASS applied readiness then dispatch, one transaction each"

"${psql[@]}" -At <<'SQL'
do $$
declare r jsonb; d date;
begin
  if (select count(*) from pg_proc where proname in ('read_rankings_publication_readiness','latest_ranking_publication_cutoff',
      'claim_ranking_publication_dispatch','record_ranking_publication_dispatch','reconcile_ranking_publication_dispatch')) <> 5
    or to_regclass('public.ranking_publication_dispatches') is null
    or to_regclass('public.ranking_dispatch_existing_5v5_rows') is null then
    raise exception 'objects missing';
  end if;
  if has_function_privilege('anon','public.read_rankings_publication_readiness(integer,date,date)','execute')
    or has_function_privilege('authenticated','public.claim_ranking_publication_dispatch(integer,date,text,boolean,date[])','execute')
    or not has_function_privilege('service_role','public.claim_ranking_publication_dispatch(integer,date,text,boolean,date[])','execute')
    or has_table_privilege('service_role','public.ranking_publication_dispatches','delete') then
    raise exception 'unexpected grants';
  end if;
end $$;
set role service_role;
-- Nov 14 and Nov 19 pairs shaped like production: Rankings windows complete before the composite starts.
insert into public.ranking_publications (surface,season_id,snapshot_date,strength_state,window_type,window_size,
  peer_group_type,peer_group_key,min_gp,min_toi_seconds,methodology_version,status,expected_rows,db_written_rows,
  expected_entities,written_entities,started_at,completed_at)
select s, 20262027, d, '5v5', w, n, 'all_skaters', 'all', 1, 300, 'rehearsal', 'complete',
  case when s = 'entity_metric_rankings' then e * 17 else e end, case when s = 'entity_metric_rankings' then e * 17 else e end,
  e, e, t + case when s = 'entity_metric_rankings' then interval '0' else interval '3 minutes' end,
  t + case when s = 'entity_metric_rankings' then interval '1 minute' else interval '4 minutes' end
from (values ('2026-11-14'::date, 775, '2026-11-15 20:29Z'::timestamptz), ('2026-11-19', 784, '2026-11-21 17:50Z')) p(d, e, t)
cross join (values ('entity_metric_rankings','season',0), ('entity_metric_rankings','last_5',5),
  ('entity_metric_rankings','last_10',10), ('entity_metric_rankings','last_20',20),
  ('skater_composite_ratings','season',0)) w(s, w, n);
do $$
declare d date; r jsonb;
begin
  d := public.latest_ranking_publication_cutoff(20262027, '2026-11-21');
  if d is distinct from '2026-11-19' then raise exception 'cutoff % not Nov 19', d; end if;
  -- The database cutoff also requires all four windows: losing one Nov 19 window falls back to Nov 14.
  update public.ranking_publications set status = 'writing' where snapshot_date = '2026-11-19' and window_type = 'last_10';
  d := public.latest_ranking_publication_cutoff(20262027, '2026-11-21');
  if d is distinct from '2026-11-14' then raise exception 'three-window pair served: %', d; end if;
  update public.ranking_publications set status = 'complete' where snapshot_date = '2026-11-19' and window_type = 'last_10';
  r := public.claim_ranking_publication_dispatch(20262027, '2026-11-21', 'scheduled', true, array['2026-11-21']::date[]);
  if r->>'outcome' <> 'claimed' or r->>'priorCutoff' <> '2026-11-19' then raise exception 'first claim %', r; end if;
  perform public.record_ranking_publication_dispatch((r->>'id')::uuid, 'readback', 'blocked', 'no_slate', '{}'::jsonb);
  r := public.claim_ranking_publication_dispatch(20262027, '2026-11-21', 'scheduled', true, array['2026-11-21']::date[]);
  if r->>'outcome' <> 'duplicate' then raise exception 'scheduled day replayed: %', r; end if;
  r := public.read_rankings_publication_readiness(20262027, '2026-11-19', '2026-11-21');
  if r->>'status' <> 'blocked' then raise exception 'empty sources admitted: %', r; end if;
end $$;
SQL
echo "PASS Nov 19 cutoff, four-window fallback to Nov 14, single-use scheduled claim, empty sources blocked"

# Rollback in reverse order (only valid before any production dispatch row exists; see PACKET.md).
"${psql[@]}" --single-transaction <<'SQL'
delete from public.ranking_publications where methodology_version = 'rehearsal';
drop function public.reconcile_ranking_publication_dispatch(uuid,text,timestamptz,text,jsonb);
drop function public.record_ranking_publication_dispatch(uuid,text,text,text,jsonb);
drop function public.claim_ranking_publication_dispatch(integer,date,text,boolean,date[]);
drop function public.latest_ranking_publication_cutoff(integer,date);
drop table public.ranking_publication_dispatches;
drop index public.ranking_dispatch_existing_5v5_rows;
delete from supabase_migrations.schema_migrations where version = '20261118160000';
drop function public.read_rankings_publication_readiness(integer,date,date);
delete from supabase_migrations.schema_migrations where version = '20261118151903';
SQL
dump "$scratch/after.sql"
diff "$scratch/before.sql" "$scratch/after.sql" && echo "PASS rollback restores the pre-migration public schema exactly"
apply
echo "PASS re-applied both after rollback"
