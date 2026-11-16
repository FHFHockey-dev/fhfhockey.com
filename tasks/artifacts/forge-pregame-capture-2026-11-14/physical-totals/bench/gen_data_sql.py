"""Emit an INSERT ... SELECT that fills every column of a local public.wgo_skater_stats with plausible values.

Usage: python3 -I gen_data_sql.py <columns.tsv> <first season start year> <last season start year> <rows per game-day>
columns.tsv: name<TAB>data_type, from information_schema.columns on the local copy (production DDL).
Rows are per player-game (games_played = 1), dated inside each regular season (Oct 5 .. Apr 15). Shaped on the
production catalog read of 2026-11-16 00:54Z: about 8 rows per heap page, 46% null toi_per_game, and date correlation
about 0.4 (61% of past-season rows land in random positions). The current season (last year) stops at 2026-11-14 and
is appended last, as the daily upserts do. Local benchmark only; never production.
"""
import sys

cols = [line.rstrip("\n").split("\t") for line in open(sys.argv[1]) if line.strip()]
first, last, per_day = int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4])
special = {
    "id": "nextval('bench_id')::integer",
    "player_id": "8470000 + (r % 1400)",
    "player_name": "'Player ' || (r % 1400)",
    "date": "d",
    "season_id": "y * 10000 + y + 1",
    "games_played": "1",
    "position_code": "(array['C','L','R','D','D','C'])[1 + (r % 6)]",
    "toi_per_game": "case when r % 100 < 46 then null when r % 97 = 0 then 0 else 300 + (r % 1200) end",
    "hits": "case when r % 13 = 0 then null else r % 7 end",
    "blocked_shots": "case when r % 17 = 0 then null else r % 4 end",
    "game_id": "(y * 1000000 + 20000 + (r % 1312))::bigint",
    "team_abbrev": "(array['ANA','BOS','BUF','CGY','CAR','CHI','COL','CBJ','DAL','DET','EDM','FLA'])[1 + (r % 12)]",
}
exprs = []
for name, typ in cols:
    if name in special:
        exprs.append(special[name])
    elif typ in ("integer", "bigint", "smallint"):
        exprs.append(f"(r * {len(exprs) + 7}) % 50")
    elif typ in ("double precision", "numeric", "real"):
        # about half the float columns are null on a given row, to land near production's ~8 rows per page
        exprs.append(f"case when (r + {len(exprs)}) % 2 = 0 then null else ((r * {len(exprs) + 3}) % 1000) / 10.0 end")
    elif typ == "date":
        exprs.append("d")
    elif typ.startswith("timestamp"):
        exprs.append("d::timestamp + interval '1 day'")
    elif typ == "boolean":
        exprs.append("r % 2 = 0")
    elif typ in ("text", "character varying"):
        exprs.append("'v' || (r % 100)")
    elif typ in ("jsonb", "json"):
        exprs.append("null")
    else:
        exprs.append("null")
names = ", ".join(f'"{n}"' for n, _ in cols)
print("create sequence if not exists bench_id;")
print(f"insert into public.wgo_skater_stats ({names})")
print("select " + ", ".join(exprs))
print(f"""from generate_series({first}, {last}) as y
cross join lateral generate_series(make_date(y, 10, 5), least(make_date(y + 1, 4, 15), date '2026-11-14'), interval '1 day') as g(dd)
cross join lateral (select g.dd::date as d) as dd
cross join lateral generate_series(1, {per_day}) as k
cross join lateral (select (extract(doy from d)::int * 1000 + k + y * 7) as r) as rr
order by case when y = {last} then 2 + (d - date '1900-01-01') / 47482.0
              when (hashint4(r + y)::bigint % 100 + 100) % 100 < 61 then random()
              else (d - date '1900-01-01') / 47482.0 end;""")
