import type { FakeDb } from "./fakeSupabase";

export const GOALIE_SEASON = 20262027;
export const OPPONENT_TEAM_ID = 99;

export type GoalieAppearanceSpec = {
  goalieId: number;
  teamId: number;
  gameId: number;
  date: string;
  started: boolean;
  shots?: number;
  saves?: number;
  wins?: number;
  hdShots?: number;
  hdSaves?: number;
};

export type GoalieTeamSpec = { id: number; abbreviation: string; name: string };

/**
 * Builds a consistent official (WGO) + enrichment (unified/NST) + schedule
 * fixture. Every team game is a home game against a team with no rows, so
 * only the declared teams carry workload/coverage context.
 */
export function seedGoalieDb(
  db: FakeDb,
  args: {
    teams: GoalieTeamSpec[];
    appearances: GoalieAppearanceSpec[];
    projections?: Array<Record<string, unknown>>;
  },
) {
  const teamById = new Map(args.teams.map((team) => [team.id, team]));
  const games = new Map<number, Record<string, unknown>>();
  for (const appearance of args.appearances) {
    games.set(appearance.gameId, {
      id: appearance.gameId,
      date: appearance.date,
      seasonId: GOALIE_SEASON,
      type: 2,
      homeTeamId: appearance.teamId,
      awayTeamId: OPPONENT_TEAM_ID,
    });
  }
  const official = args.appearances.map((appearance) => {
    const shots = appearance.shots ?? 30;
    const saves = appearance.saves ?? 27;
    return {
      goalie_id: appearance.goalieId,
      goalie_name: `Goalie ${appearance.goalieId}`,
      game_id: appearance.gameId,
      date: appearance.date,
      season_id: GOALIE_SEASON,
      team_abbreviation: teamById.get(appearance.teamId)!.abbreviation,
      home_road: "H",
      games_played: 1,
      games_started: appearance.started ? 1 : 0,
      wins: appearance.wins ?? 1,
      saves,
      shots_against: shots,
      goals_against: shots - saves,
      time_on_ice: 3600,
      quality_start: null,
    };
  });
  const unified = args.appearances.map((appearance) => {
    const shots = appearance.shots ?? 30;
    const saves = appearance.saves ?? 27;
    const nst = {
      toi: 50,
      xg_against: 2.5,
      goals_against: shots - saves,
      saves,
      shots_against: shots,
      hd_saves: appearance.hdSaves ?? 6,
      hd_shots_against: appearance.hdShots ?? 8,
    };
    return {
      player_id: appearance.goalieId,
      player_name: `Goalie ${appearance.goalieId}`,
      date: appearance.date,
      season_id: GOALIE_SEASON,
      team_id: appearance.teamId,
      team_id_source: "wgo_game_team",
      games_played: 1,
      games_started: appearance.started ? 1 : 0,
      wins: appearance.wins ?? 1,
      saves,
      goals_against: shots - saves,
      shots_against: shots,
      time_on_ice: 3600,
      quality_start: null,
      ...Object.fromEntries(
        Object.entries(nst).flatMap(([suffix, value]) => [
          [`nst_5v5_counts_${suffix}`, value],
          [`nst_all_counts_${suffix}`, value],
        ]),
      ),
      nst_5v5_counts_gsaa: null,
      nst_5v5_counts_hd_sv_percentage: null,
    };
  });
  const teamGameKeys = new Set<string>();
  const completedTeamGames = args.appearances.flatMap((appearance) => {
    const key = `${appearance.teamId}:${appearance.gameId}`;
    if (teamGameKeys.has(key)) return [];
    teamGameKeys.add(key);
    return [{
      game_id: appearance.gameId,
      date: appearance.date,
      season_id: GOALIE_SEASON,
      team_id: appearance.teamId,
    }];
  });
  db.tables.games = [...games.values()];
  db.tables.wgo_goalie_stats = official;
  db.tables.goalie_stats_unified = unified;
  db.tables.wgo_team_stats = completedTeamGames;
  db.tables.teams = args.teams.map((team) => ({ ...team }));
  db.tables.players = [
    ...new Set(args.appearances.map((appearance) => appearance.goalieId)),
  ].map((id) => ({ id, fullName: `Goalie ${id}`, image_url: null }));
  db.tables.goalie_start_projections = args.projections ?? [];
}

/** ISO date `offset` days after 2026-10-01. */
export function seasonDay(offset: number) {
  const date = new Date(Date.UTC(2026, 9, 1 + offset));
  return date.toISOString().slice(0, 10);
}
