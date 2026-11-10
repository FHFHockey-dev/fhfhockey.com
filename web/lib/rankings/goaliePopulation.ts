export type GoalieGameSourceRow = {
  game_id?: number | null;
  populationWarnings?: string[];
  relativeSavePopulationComplete?: boolean;
  player_id: number;
  date: string;
  season_id: number;
  team_id: number | null;
  team_id_source?: string | null;
  player_name: string | null;
  games_played: number | null;
  games_started: number | null;
  wins: number | null;
  saves: number | null;
  goals_against: number | null;
  shots_against: number | null;
  time_on_ice: number | null;
  quality_start: number | null;
  nst_5v5_counts_toi: number | null;
  nst_5v5_counts_xg_against: number | null;
  nst_5v5_counts_goals_against: number | null;
  nst_5v5_counts_gsaa: number | null;
  nst_5v5_counts_saves?: number | null;
  nst_5v5_counts_shots_against?: number | null;
  nst_5v5_counts_hd_saves?: number | null;
  nst_5v5_counts_hd_shots_against?: number | null;
  nst_5v5_counts_hd_sv_percentage?: number | null;
};

export type GoalieScheduleRow = {
  id: number;
  seasonId: number;
  type: number;
  date: string;
  homeTeamId: number | null;
  awayTeamId: number | null;
};

export type OfficialGoalieAppearanceRow = {
  goalie_id: number;
  goalie_name: string | null;
  game_id: number | null;
  date: string;
  season_id: number;
  team_abbreviation: string | null;
  home_road: string | null;
  games_played: number | null;
  games_started: number | null;
  wins: number | null;
  saves: number | null;
  shots_against: number | null;
  goals_against: number | null;
  time_on_ice: number | null;
  quality_start: number | null;
};

export type CompletedGoalieTeamGameRow = {
  game_id: number | null;
  date: string;
  season_id: number;
  team_id: number | null;
};

type TeamIdentity = { id: number; abbreviation: string | null };

// Keep this explicit: these three diagnostics identify a source game team or
// a source abbreviation resolved uniquely, including its season-scoped alias.
// Current-player metadata and unknown future diagnostics are not historical proof.
export function isHistoricalGoalieTeamSource(source: string | null | undefined) {
  return source === "wgo_game_team" || source === "wgo_team_abbreviation" ||
    source === "wgo_season_team_alias";
}

const EMPTY_ADVANCED_SOURCE = {
  nst_5v5_counts_toi: null,
  nst_5v5_counts_xg_against: null,
  nst_5v5_counts_goals_against: null,
  nst_5v5_counts_gsaa: null,
  nst_5v5_counts_saves: null,
  nst_5v5_counts_shots_against: null,
  nst_5v5_counts_hd_saves: null,
  nst_5v5_counts_hd_shots_against: null,
  nst_5v5_counts_hd_sv_percentage: null,
} as const;

/** Official player/game appearances anchor eligibility; NST enrichment cannot
 * add phantom players, remove relief goalies, or overwrite official totals.
 * The schedule supplies regular-season membership and historical participants.
 */
export function reconcileGoaliePopulation(args: {
  season: number;
  through: string;
  official: readonly OfficialGoalieAppearanceRow[];
  unified: readonly GoalieGameSourceRow[];
  games: readonly GoalieScheduleRow[];
  completedTeamGames: readonly CompletedGoalieTeamGameRow[];
  teams: ReadonlyMap<number, TeamIdentity>;
}) {
  const scopedGames = args.games.filter((game) =>
    game.seasonId === args.season && game.date <= args.through,
  );
  const games = scopedGames.filter((game) => game.type === 2);
  const gamesById = new Map<number, GoalieScheduleRow>();
  for (const game of scopedGames) {
    if (gamesById.has(game.id)) throw new Error("Duplicate regular-season game identity in goalie population.");
    gamesById.set(game.id, game);
  }
  const sourceWarnings = new Set<string>();
  const excluded = { outsideScope: 0, nonAppearance: 0, missingGameIdentity: 0, nonRegular: 0, missingSchedule: 0, dateMismatch: 0 };
  const official = args.official.filter((row) => {
    if (row.season_id !== args.season || row.date > args.through) { excluded.outsideScope++; return false; }
    if (row.games_played === 0) { excluded.nonAppearance++; return false; }
    if (row.game_id == null) { excluded.missingGameIdentity++; sourceWarnings.add("partial_goalie_population_identity"); return false; }
    const game = gamesById.get(row.game_id);
    if (!game) { excluded.missingSchedule++; sourceWarnings.add("partial_goalie_population_schedule"); return false; }
    if (game.type !== 2) { excluded.nonRegular++; return false; }
    if (game.date !== row.date) { excluded.dateMismatch++; sourceWarnings.add("partial_goalie_population_identity"); return false; }
    return true;
  });
  const appearanceGamesByPlayerDate = new Map<string, Set<number>>();
  // Even a nonregular appearance can make a player/date-only advanced row
  // ambiguous. Count all verified game identities before selecting type 2.
  for (const row of args.official) {
    const game = row.game_id == null ? null : gamesById.get(row.game_id);
    if (row.season_id !== args.season || row.date > args.through || row.games_played === 0 || !game || game.date !== row.date) continue;
    const key = `${row.goalie_id}:${row.date}`;
    const ids = appearanceGamesByPlayerDate.get(key) ?? new Set<number>();
    ids.add(game.id);
    appearanceGamesByPlayerDate.set(key, ids);
  }
  const seen = new Set<string>();
  for (const row of official) {
    const key = `${row.goalie_id}:${row.game_id}`;
    if (seen.has(key)) throw new Error("Duplicate official goalie player/game appearance.");
    seen.add(key);
  }
  const unifiedByPlayerDate = new Map<string, GoalieGameSourceRow[]>();
  for (const row of args.unified) {
    if (row.season_id !== args.season || row.date > args.through) continue;
    const key = `${row.player_id}:${row.date}`;
    const current = unifiedByPlayerDate.get(key) ?? [];
    current.push(row);
    unifiedByPlayerDate.set(key, current);
  }

  const observedTeamGames = new Set<string>();
  let missingAdvancedAppearances = 0;
  const rows: GoalieGameSourceRow[] = official.map((row) => {
    const game = gamesById.get(row.game_id!)!;
    const candidates = [game.homeTeamId, game.awayTeamId].filter((id): id is number =>
      id != null && args.teams.get(id)?.abbreviation === row.team_abbreviation,
    );
    const sideTeam = row.home_road === "H" ? game.homeTeamId
      : row.home_road === "R" ? game.awayTeamId : null;
    const teamId = row.home_road === "H" || row.home_road === "R"
      ? (sideTeam != null && candidates.includes(sideTeam) ? sideTeam : null)
      : row.home_road == null && candidates.length === 1 ? candidates[0] : null;
    const warnings: string[] = [];
    if (row.games_played == null) warnings.push("partial_goalie_appearance_classification");
    if (teamId == null) warnings.push("partial_goalie_team_attribution");
    else observedTeamGames.add(`${teamId}:${game.id}`);

    const dateKey = `${row.goalie_id}:${row.date}`;
    const matches = unifiedByPlayerDate.get(dateKey) ?? [];
    const candidate = matches.length === 1 && appearanceGamesByPlayerDate.get(dateKey)?.size === 1
      ? matches[0] : null;
    const advanced = candidate && (teamId == null ||
      !isHistoricalGoalieTeamSource(candidate.team_id_source) || candidate.team_id === teamId)
      ? candidate : null;
    if (!advanced) {
      missingAdvancedAppearances++;
      warnings.push(matches.length === 0 ? "partial_goalie_advanced_appearance_source" : "partial_goalie_advanced_identity");
    }
    return {
      ...EMPTY_ADVANCED_SOURCE,
      ...(advanced ?? {}),
      game_id: game.id,
      player_id: row.goalie_id,
      player_name: row.goalie_name,
      date: row.date,
      season_id: row.season_id,
      team_id: teamId,
      team_id_source: teamId == null ? "unmapped" : "wgo_game_team",
      games_played: row.games_played,
      games_started: row.games_started,
      wins: row.wins,
      saves: row.saves,
      shots_against: row.shots_against,
      goals_against: row.goals_against,
      time_on_ice: row.time_on_ice,
      quality_start: row.quality_start,
      populationWarnings: warnings,
    };
  }).sort((a, b) => b.date.localeCompare(a.date) || (a.game_id! - b.game_id!) || a.player_id - b.player_id);

  let latestObservationDate = rows[0]?.date ?? null;
  const missingCompletedTeamGames: string[] = [];
  const completedKeys = new Set<string>();
  for (const row of args.completedTeamGames) {
    if (row.season_id !== args.season || row.game_id == null || row.team_id == null || row.date > args.through) continue;
    const game = gamesById.get(row.game_id);
    if (!game || game.type !== 2 || game.date !== row.date || (game.homeTeamId !== row.team_id && game.awayTeamId !== row.team_id)) continue;
    const key = `${row.team_id}:${row.game_id}`;
    if (completedKeys.has(key)) throw new Error("Duplicate completed goalie team/game identity.");
    completedKeys.add(key);
    if (latestObservationDate == null || row.date > latestObservationDate) latestObservationDate = row.date;
    if (!observedTeamGames.has(key)) missingCompletedTeamGames.push(key);
  }
  if (missingCompletedTeamGames.length) sourceWarnings.add("partial_goalie_official_game_coverage");
  // If a materialization still contains an in-scope player/date with no
  // official appearance, expose the disagreement instead of seeding a player.
  const officialKeys = new Set(appearanceGamesByPlayerDate.keys());
  const regularDates = new Set(games.map((game) => game.date));
  const unmatchedUnifiedKeys = [...unifiedByPlayerDate.keys()].filter((key) =>
    !officialKeys.has(key) && regularDates.has(unifiedByPlayerDate.get(key)![0].date),
  );
  if (unmatchedUnifiedKeys.length) sourceWarnings.add("partial_goalie_population_reconciliation");
  const uncertainRelativeTeamGames = new Set<string>();
  for (const key of unmatchedUnifiedKeys) {
    for (const unmatched of unifiedByPlayerDate.get(key) ?? []) {
      for (const game of games.filter((game) => game.date === unmatched.date)) {
        const knownTeam = isHistoricalGoalieTeamSource(unmatched.team_id_source) ? unmatched.team_id : null;
        for (const teamId of [game.homeTeamId, game.awayTeamId]) {
          if (teamId != null && (knownTeam == null || knownTeam === teamId)) uncertainRelativeTeamGames.add(`${teamId}:${game.id}`);
        }
      }
    }
  }
  for (const row of rows) {
    if (row.team_id != null && uncertainRelativeTeamGames.has(`${row.team_id}:${row.game_id}`)) {
      row.relativeSavePopulationComplete = false;
      row.populationWarnings = [...(row.populationWarnings ?? []), "partial_goalie_relative_population"];
    }
  }

  return {
    rows,
    teamGames: latestObservationDate == null ? [] : games.filter((game) => game.date <= latestObservationDate),
    latestObservationDate,
    sourceWarnings: [...sourceWarnings],
    diagnostics: { excluded, officialAppearances: official.length, missingAdvancedAppearances, missingCompletedTeamGames, unmatchedUnifiedKeys },
  };
}
