"""L15 (2026-11-12): execute the season label SQL on fixture tables.

Opt-in: set L15_PG_DSN to a disposable local Postgres (never production).
The test creates and drops its own tables inside one transaction.
"""
from __future__ import annotations

import os

import pytest

psycopg = pytest.importorskip("psycopg")
from psycopg.rows import dict_row  # noqa: E402

from modeling.player_forecasts.season import GOALIE_QUERY, SKATER_QUERY  # noqa: E402

DSN = os.environ.get("L15_PG_DSN")
pytestmark = pytest.mark.skipif(not DSN, reason="L15_PG_DSN not set (disposable local Postgres only)")

SCHEMA = """
create table public.games (
  id bigint primary key, date date, "seasonId" integer, type integer,
  "homeTeamId" integer, "awayTeamId" integer, "startTime" timestamptz
);
create table public.nhl_api_shift_rows (
  game_id bigint, player_id integer, team_id integer, season_id integer,
  period integer, start_seconds integer, end_seconds integer,
  duration_seconds integer, updated_at timestamptz
);
create table public.nhl_api_game_payloads_raw (
  game_id bigint, season_id integer, endpoint text, fetched_at timestamptz
);
create table public.nhl_api_pbp_events (
  game_id bigint, season_id integer, event_id integer, period_type text,
  created_at timestamptz, is_goal boolean, is_shot_like boolean,
  scoring_player_id integer, assist1_player_id integer, assist2_player_id integer,
  strength_state text, event_owner_team_id integer, period_number integer,
  period_seconds_elapsed integer
);
create table public."goaliesGameStats" (
  "gameId" bigint, "playerId" integer, toi text, "saveShotsAgainst" text,
  "goalsAgainst" integer, created_at timestamptz
);
create table public.wgo_goalie_stats (
  id serial, goalie_id integer, date date, games_started integer, wins integer,
  losses integer, ot_losses integer, shutouts integer
);
create table public."skatersGameStats" (
  "gameId" bigint, "playerId" integer, position text, toi text,
  "powerPlayToi" text, "shorthandedToi" text, goals integer, assists integer,
  "plusMinus" integer, shots integer, hits integer, "blockedShots" integer,
  pim integer, faceoffs text, created_at timestamptz
);
create table public.wgo_skater_stats (
  id serial, player_id integer, date date, game_id bigint, assists integer,
  total_primary_assists integer, total_secondary_assists integer,
  pp_goals integer, pp_primary_assists integer, pp_secondary_assists integer,
  sh_goals integer, sh_primary_assists integer, sh_secondary_assists integer,
  takeaways integer, giveaways integer, missed_shots integer,
  penalties_drawn integer, penalties integer, gw_goals integer,
  ot_goals integer, empty_net_goals integer, empty_net_points integer
);
"""

T = "2025-01-01T00:00:00Z"


@pytest.fixture()
def cursor():
    with psycopg.connect(DSN, row_factory=dict_row) as connection:
        with connection.cursor() as cur:
            cur.execute(SCHEMA)
            yield cur
        connection.rollback()


def _seed_games(cur) -> None:
    cur.executemany(
        'insert into public.games values (%s, %s, 20242025, 2, 10, 20, %s)',
        [(1, "2024-11-01", T), (2, "2024-11-03", T)],
    )
    shifts = []
    for game in (1, 2):
        for player, team in ((101, 10), (102, 10), (201, 20), (11, 10), (12, 10), (21, 20)):
            shifts.append((game, player, team, 20242025, 1, 0, 100, 100, T))
    cur.executemany(
        "insert into public.nhl_api_shift_rows values (%s,%s,%s,%s,%s,%s,%s,%s,%s)", shifts
    )


def test_goalie_labels_use_credited_starts_decisions_and_vollman_qs(cursor):
    _seed_games(cursor)
    cursor.executemany(
        'insert into public."goaliesGameStats" values (%s,%s,%s,%s,%s,%s)',
        [
            # Game 1, team 10: 101 starts, pulled after 10:00; 102 relieves 50:00.
            (1, 101, "10:00", "4/8", 4, T),
            (1, 102, "50:00", "20/20", 0, T),
            # Game 1, team 20: 201 plays the whole game, 16 of 18 saved.
            (1, 201, "60:00", "16/18", 2, T),
            # Game 2, team 10: 101 plays the whole game but has no WGO label.
            (2, 101, "60:00", "30/31", 1, T),
            (2, 201, "60:00", "25/27", 2, T),
        ],
    )
    cursor.executemany(
        "insert into public.wgo_goalie_stats (goalie_id, date, games_started, wins, losses, ot_losses, shutouts)"
        " values (%s,%s,%s,%s,%s,%s,%s)",
        [
            (101, "2024-11-01", 1, 0, 0, 0, 0),
            (102, "2024-11-01", 0, 1, 0, 0, 0),
            (201, "2024-11-01", 1, 0, 1, 0, 0),
            (201, "2024-11-03", 1, 1, 0, 0, 0),
        ],
    )
    seasons = [20242025]
    cursor.execute(GOALIE_QUERY, (seasons, seasons, seasons, seasons))
    rows = {(row["game_id"], row["nhl_player_id"]): row for row in cursor.fetchall()}
    starter, reliever = rows[(1, 101)], rows[(1, 102)]
    # BC W1-8 A: the credited starter, not the 50-minute reliever.
    assert starter["GAMES_STARTED"] == 1 and reliever["GAMES_STARTED"] == 0
    # Decision 63: the reliever's credited win stays his.
    assert reliever["WINS_GOALIE"] == 1 and starter["WINS_GOALIE"] == 0
    assert reliever["QUALITY_STARTS_GOALIE"] == 0  # relief counts no quality start
    # League SV% pooled: (4+20+16+30+25) / (8+20+18+31+27) = 95/104 = .9135.
    # 201 game 1: .889 < league, but <= 20 shots and >= .885 => Vollman QS.
    assert rows[(1, 201)]["QUALITY_STARTS_GOALIE"] == 1
    assert rows[(1, 201)]["LOSSES_GOALIE"] == 1
    # 101 game 1: .500 => no QS.
    assert starter["QUALITY_STARTS_GOALIE"] == 0
    # Game 2, team 10: no credited label => start, decisions and QS unknown.
    unknown = rows[(2, 101)]
    assert unknown["GAMES_STARTED"] is None
    assert unknown["WINS_GOALIE"] is None and unknown["QUALITY_STARTS_GOALIE"] is None
    # 201 game 2: .926 >= league => QS.
    assert rows[(2, 201)]["QUALITY_STARTS_GOALIE"] == 1


def test_skater_labels_keep_placeholders_unknown_and_drop_shootout_goals(cursor):
    _seed_games(cursor)
    cursor.executemany(
        'insert into public."skatersGameStats" values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)',
        [
            # Game 1 carries real strength TOI and faceoffs (2023-24 style).
            (1, 11, "C", "18:00", "03:00", "00:00", 1, 0, 0, 3, 1, 0, 0, "9/22", T),
            (1, 12, "L", "15:00", "00:00", "02:00", 0, 0, 0, 1, 0, 0, 0, "0/0", T),
            (1, 21, "C", "17:00", "02:00", "01:00", 0, 0, 0, 2, 0, 0, 0, "5/10", T),
            # Game 2: placeholders only (the 2024-25+ writer), plus NULLs.
            (2, 11, "C", "18:00", "00:00", "00:00", 0, 0, 0, 3, 1, 0, 0, "0/0", T),
            (2, 12, "L", "15:00", None, None, 0, 0, 0, 1, 0, 0, 0, None, T),
            (2, 21, "C", "17:00", "00:00", "00:00", 0, 0, 0, 2, 0, 0, 0, "0/0", T),
        ],
    )
    cursor.executemany(
        "insert into public.nhl_api_pbp_events (game_id, season_id, event_id, period_type, created_at,"
        " is_goal, scoring_player_id, strength_state, event_owner_team_id)"
        " values (%s,20242025,%s,%s,%s,true,%s,'EV',10)",
        [(1, 1, "REG", T, 11), (1, 2, "SO", T, 12)],
    )
    cursor.execute(SKATER_QUERY, ([20242025],))
    rows = {(row["game_id"], row["nhl_player_id"]): row for row in cursor.fetchall()}
    real, real_zero = rows[(1, 11)], rows[(1, 12)]
    assert real["PP_TOI"] == 180 and real["PK_TOI"] == 0 and real["EV_TOI"] == 900
    assert real["FACEOFFS_WON"] == 9 and real["FACEOFFS_LOST"] == 13
    # A '00:00' / '0/0' in a game with real values is a measured zero.
    assert real_zero["PP_TOI"] == 0 and real_zero["FACEOFFS_WON"] == 0
    # Placeholder-only game: unknown, never 0, and EV TOI is not TOTAL_TOI.
    for key in ((2, 11), (2, 12), (2, 21)):
        row = rows[key]
        assert row["PP_TOI"] is None and row["PK_TOI"] is None and row["EV_TOI"] is None
        assert row["FACEOFFS_WON"] is None and row["FACEOFFS_LOST"] is None
        assert row["TOTAL_TOI"] > 0
    # The shootout "goal" by 12 is not a goal.
    assert rows[(1, 12)]["GOALS"] == 0
