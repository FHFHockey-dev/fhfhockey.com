import { teamsInfo, activeTeamAbbreviations } from "lib/teamsInfo";
import { weekDates } from "./schedule";
import type { TeamStats } from "components/GameGrid/utils/useOpponentMetricsData";
import type { SocialScheduleData, SocialScheduleGame } from "./types";

/** Fictional slate sizes: four off-nights (<= 8 games) around three busy nights. */
export const FICTIONAL_DAILY_GAMES = [6, 12, 4, 13, 5, 12, 7] as const;

/**
 * Deterministic, fictional league-wide week for tests and design evidence only.
 * Real team identities, invented matchups: never presented as an NHL schedule.
 */
export function fictionalLeagueWeek(weekStart: string, fetchedAt: string, seed = 20261026): SocialScheduleData {
  const dates = weekDates(weekStart);
  const year = Number(weekStart.slice(0, 4)) - (Number(weekStart.slice(5, 7)) < 8 ? 1 : 0);
  const teams = [...activeTeamAbbreviations].map(abbrev => ({ id: teamsInfo[abbrev].id, abbrev: String(abbrev) }));
  let state = seed >>> 0;
  const random = () => ((state = Math.imul(state ^ (state >>> 15), 2246822519) + 0x9e3779b9 >>> 0) / 4294967296);
  const played = new Map(teams.map(team => [team.id, 0]));
  const games: SocialScheduleGame[] = [];
  dates.forEach((date, day) => {
    // Fewer games so far plays first, with enough noise to spread weekly totals from two to five.
    const order = teams.map(team => ({ team, key: played.get(team.id)! + random() * 2.2 })).sort((a, b) => a.key - b.key).map(item => item.team);
    for (let i = 0; i < FICTIONAL_DAILY_GAMES[day]; i++) {
      const [first, second] = [order[2 * i], order[2 * i + 1]];
      const [home, away] = random() < 0.5 ? [first, second] : [second, first];
      played.set(home.id, played.get(home.id)! + 1); played.set(away.id, played.get(away.id)! + 1);
      games.push({
        id: year * 1000000 + 20100 + games.length, season: year * 10000 + year + 1, gameType: 2,
        gameDate: date, startTimeUTC: `${date}T23:00:00Z`, gameState: "FUT", gameScheduleState: "OK",
        homeTeam: { id: home.id, abbrev: home.abbrev }, awayTeam: { id: away.id, abbrev: away.abbrev },
      } as SocialScheduleGame);
    }
  });
  return { data: {}, games, fetchedAt, coveredDates: dates, numGamesPerDay: [...FICTIONAL_DAILY_GAMES] };
}

/**
 * Deterministic, fictional nst_team_stats rows (situation "all") for every active team.
 * Rates are invented: never presented as real team results.
 */
export function fictionalTeamStats(season: number, updatedAt: string, seed = 7031): Record<string, TeamStats> {
  let state = seed >>> 0;
  const random = () => ((state = Math.imul(state ^ (state >>> 13), 1597334677) + 0x6d2b79f5 >>> 0) / 4294967296);
  return Object.fromEntries([...activeTeamAbbreviations].map(abbrev => {
    const gp = 11, xgf = Math.round((2.3 + random() * 1.2) * gp * 100) / 100, xga = Math.round((2.3 + random() * 1.2) * gp * 100) / 100;
    // Goals and shots track expected goals loosely, so "perfect storm" pairings occur naturally.
    const gf = Math.round(xgf * (0.85 + random() * 0.35)), ga = Math.round(xga * (0.85 + random() * 0.35));
    const sf = Math.round(gp * (25 + (xgf / gp - 2.3) * 8 + random() * 3)), sa = Math.round(gp * (25 + (xga / gp - 2.3) * 8 + random() * 3));
    return [String(abbrev), { team_abbreviation: String(abbrev), team_name: teamsInfo[abbrev].name, gp, sf, sa, gf, ga, xgf, xga, points: null, season, situation: "all", updated_at: updatedAt }];
  }));
}
