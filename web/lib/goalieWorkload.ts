import { teamsInfo } from "./teamsInfo";

/** Descriptive NHL summary appearances. Callers supply one complete season;
 * these rows do not establish official starts, eligibility or as-of availability. */
export interface GoalieGameRow {
  gameId: number;
  gameDate: string;
  teamAbbrev: string;
  playerId: number;
  goalieFullName: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  otLosses: number;
  saves: number | null;
  shotsAgainst: number | null;
  goalsAgainst: number | null;
  timeOnIce: number | null;
}

export type SpanType = "L10" | "L20" | "L30" | "Season";
export interface GoalieData {
  playerId: number;
  goalieFullName: string;
  gamesPlayed: number;
  timeOnIce: number | null;
  wins: number;
  losses: number;
  otLosses: number;
  savePct: number | null;
  goalsAgainstAverage: number | null;
}
export interface TeamGoalieStats {
  [teamAbbrev: string]: {
    goalies: GoalieData[];
    /** Distinct recorded team games, including games with a relief appearance. */
    totalGames: number;
    /** Pie denominator: a relief appearance adds one here, not to totalGames. */
    totalAppearances: number;
  };
}
const SPAN_GAMES: Record<SpanType, number | null> = { L10: 10, L20: 20, L30: 30, Season: null };

/** Stable pagination can still repeat a row while keeping lengths/totals equal. */
export function assertUniqueGoalieGameRows(rows: readonly GoalieGameRow[]): void {
  const identities = new Set<string>();
  for (const row of rows) {
    const key = `${row.teamAbbrev}:${row.gameId}:${row.playerId}`;
    if (identities.has(key)) throw new Error("Goalie game request failed: duplicate appearance in page set");
    identities.add(key);
  }
}

/** Last N distinct recorded team games. Appearance share includes relief and
 * is descriptive; a complete provider page set does not certify a schedule. */
export function buildGoalieShareByTeam(rows: readonly GoalieGameRow[], span: SpanType): TeamGoalieStats {
  const rowsByTeam = new Map<string, GoalieGameRow[]>();
  for (const row of rows) {
    const teamRows = rowsByTeam.get(row.teamAbbrev) ?? [];
    teamRows.push(row);
    rowsByTeam.set(row.teamAbbrev, teamRows);
  }
  const result: TeamGoalieStats = {};
  for (const teamAbbrev of Object.keys(teamsInfo).sort()) {
    const teamRows = rowsByTeam.get(teamAbbrev);
    if (!teamRows?.length) continue;
    const gameDates = new Map(teamRows.map(row => [row.gameId, row.gameDate]));
    const games = Array.from(gameDates).sort(([idA, dateA], [idB, dateB]) => dateA.localeCompare(dateB) || idA - idB);
    const limit = SPAN_GAMES[span];
    const windowGames = new Set((limit === null ? games : games.slice(-limit)).map(([gameId]) => gameId));
    const byGoalie = new Map<number, GoalieGameRow[]>();
    for (const row of teamRows) {
      if (!windowGames.has(row.gameId)) continue;
      const goalieRows = byGoalie.get(row.playerId) ?? [];
      goalieRows.push(row);
      byGoalie.set(row.playerId, goalieRows);
    }
    const goalies: GoalieData[] = Array.from(byGoalie, ([playerId, goalieRows]) => {
      const sum = (read: (row: GoalieGameRow) => number) => goalieRows.reduce((total, row) => total + (read(row) || 0), 0);
      const completeSum = (read: (row: GoalieGameRow) => number | null) => {
        let total = 0;
        for (const row of goalieRows) {
          const value = read(row);
          if (value == null || !Number.isFinite(value) || value < 0) return null;
          total += value;
        }
        return total;
      };
      const shotsAgainst = completeSum(row => row.shotsAgainst);
      const saves = completeSum(row => row.saves);
      const goalsAgainst = completeSum(row => row.goalsAgainst);
      const timeOnIce = completeSum(row => row.timeOnIce);
      return {
        playerId, goalieFullName: goalieRows[goalieRows.length - 1].goalieFullName,
        gamesPlayed: sum(row => row.gamesPlayed), timeOnIce,
        wins: sum(row => row.wins), losses: sum(row => row.losses), otLosses: sum(row => row.otLosses),
        savePct: shotsAgainst !== null && shotsAgainst > 0 && saves !== null && saves <= shotsAgainst ? saves / shotsAgainst : null,
        goalsAgainstAverage: timeOnIce !== null && timeOnIce > 0 && goalsAgainst !== null ? (goalsAgainst * 3600) / timeOnIce : null
      };
    }).sort((a, b) => b.gamesPlayed - a.gamesPlayed);
    result[teamAbbrev] = { goalies, totalGames: windowGames.size,
      totalAppearances: goalies.reduce((total, goalie) => total + goalie.gamesPlayed, 0) };
  }
  return result;
}
