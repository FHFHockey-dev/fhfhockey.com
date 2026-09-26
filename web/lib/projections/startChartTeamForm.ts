export type TeamFormGame = { date: string; goalsFor: number; goalsAgainst: number };
export type StartChartTeamForm = {
  seasonId: number;
  beforeDate: string;
  source: "nhl_final_scores";
  teams: Array<{ team: string; games: TeamFormGame[] }>;
};

// Final NHL scores include shootout deciding goals. Regular season and playoffs
// are eligible within the resolved season; preseason and earlier seasons are not.
// The caller reads completed PBP games; conditional playoff schedule rows that
// were never played do not enter the window.
export function selectTeamFormGames(rows: Array<Record<string, unknown>>, seasonId: number, beforeDate: string, teamId: number): TeamFormGame[] {
  const seen = new Set<unknown>();
  return rows.filter((row) => row.season_id === seasonId && (row.home_team_id === teamId || row.away_team_id === teamId)
    && [2, 3].includes(Number(row.game_type)) && ["OFF", "FINAL"].includes(String(row.game_state))
    && typeof row.game_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.game_date) && row.game_date < beforeDate
    && Number.isSafeInteger(row.game_id)
    && typeof row.home_team_score === "number" && Number.isInteger(row.home_team_score) && row.home_team_score >= 0
    && typeof row.away_team_score === "number" && Number.isInteger(row.away_team_score) && row.away_team_score >= 0)
    .filter((row) => Number(row.home_team_score) + Number(row.away_team_score) > 0)
    .sort((a, b) => String(b.game_date).localeCompare(String(a.game_date)))
    .filter((row) => { if (seen.has(row.game_id)) return false; seen.add(row.game_id); return true; })
    .slice(0, 10).map((row) => ({ date: String(row.game_date),
      goalsFor: Number(row.home_team_id === teamId ? row.home_team_score : row.away_team_score),
      goalsAgainst: Number(row.home_team_id === teamId ? row.away_team_score : row.home_team_score) }));
}

export function summarizeTeamForm(form: StartChartTeamForm | undefined, count: number) {
  return (form?.teams ?? []).map(({ team, games }) => {
    const sample = games.slice(0, count);
    return { team, games: sample.length,
      goalsFor: sample.length ? sample.reduce((sum, game) => sum + game.goalsFor, 0) / sample.length : null,
      goalsAgainst: sample.length ? sample.reduce((sum, game) => sum + game.goalsAgainst, 0) / sample.length : null };
  });
}
