#!/usr/bin/env python3
"""Isolated PostgreSQL regression. No downloads, TCP, credentials, or hosted SQL."""
import os
from pathlib import Path
import re
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[2]
BIN = Path(os.environ.get("GOALIE_PG_BIN", "/opt/homebrew/opt/postgresql@17/bin"))
ENV = {k: v for k, v in os.environ.items() if not k.startswith("PG")}


def run(name, *args, **kwargs):
    return subprocess.run([str(BIN / name), *args], env=ENV, check=True, **kwargs)


with tempfile.TemporaryDirectory(prefix="fhfh-goalie-pg-") as directory:
    tmp = Path(directory)
    socket = tmp / "socket"
    socket.mkdir(mode=0o700)
    started = False
    try:
        run("initdb", "-D", str(tmp / "data"), "--no-locale", "--encoding=UTF8",
            "--auth-local=trust", "--auth-host=reject", "-U", "goalie_test",
            stdout=subprocess.DEVNULL)
        run("pg_ctl", "-D", str(tmp / "data"), "-l", str(tmp / "server.log"),
            "-w", "-t", "10", "-o",
            f"-c listen_addresses='' -c unix_socket_directories='{socket}' "
            "-c fhfh.fixture=goalie-team-resolution-v1 -p 65441", "start",
            stdout=subprocess.DEVNULL)
        started = True
        connection = ["-h", str(socket), "-p", "65441", "-U", "goalie_test"]
        run("createdb", *connection, "fhfh_goalie_team_fixture")
        baseline = (ROOT / "supabase/migrations/20260716112908_production_schema_baseline.sql").read_text()

        def block(kind, name):
            pattern = rf"CREATE {kind} public\.{name}\b.*?;\n"
            match = re.search(pattern, baseline, re.S)
            if match is None:
                raise RuntimeError(f"Missing baseline object: {name}")
            return match.group()

        setup = """
create role anon; create role authenticated; create role service_role;
create schema internal_stats;
grant usage on schema internal_stats to anon,authenticated,service_role;
create table public.players(id bigint primary key, team_id smallint);
"""
        for name in ["teams", "wgo_goalie_stats", "team_franchise_alias"]:
            setup += block("TABLE", name)
        for family in ["5v5", "all", "ev", "pk", "pp"]:
            for variant in ["counts", "rates"]:
                setup += block("TABLE", f"nst_gamelog_goalie_{family}_{variant}")
        setup += """
alter table public.wgo_goalie_stats add column game_id bigint,
 add column opponent_team_abbrev text, add column home_road text;
create table public.games(id bigint primary key,date date,"seasonId" bigint,
 "homeTeamId" smallint,"awayTeamId" smallint);
"""
        setup += block("VIEW", "vw_goalie_stats_unified_source")
        setup += "alter view public.vw_goalie_stats_unified_source set (security_invoker=true);"
        run("psql", "-X", *connection, "-d", "fhfh_goalie_team_fixture",
            "-v", "ON_ERROR_STOP=1", input=setup, text=True, stdout=subprocess.DEVNULL)
        run("psql", "-X", *connection, "-d", "fhfh_goalie_team_fixture",
            "-v", "ON_ERROR_STOP=1", "-f", str(ROOT / "supabase/tests/goalie_team_resolution.sql"))
    finally:
        if started:
            run("pg_ctl", "-D", str(tmp / "data"), "-w", "-t", "10", "stop", "-m", "fast",
                stdout=subprocess.DEVNULL)
