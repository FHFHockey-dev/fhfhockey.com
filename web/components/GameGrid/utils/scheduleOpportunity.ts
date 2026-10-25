import type { ExtendedWeekData, GameData, TeamDataWithTotals } from "lib/NHL/types";
import type { OpponentMetricAverages, TeamStats } from "./useOpponentMetricsData";
import { isRegularScheduleGame } from "./helper";
import { toFourWeekMetricBands } from "./fourWeekMetricBands";

export const OPPONENT_RATING_VERSION = "xg-observed-percentile-v1";
export const OPPORTUNITY_VERSION = "remaining-utc-on-0.25-v1";
export const RATING_INFO = "Opponent strength: percentile (0–100) of the selected opponents — Attack by xGF/GP, Defense by xGA/GP inverted. Higher = stronger opponents. Descriptive, not a forecast.";
export const OPPORTUNITY_INFO = "4-Week Opportunity = remaining team games + 0.25 × off-night games, selected Mon–Sun week plus the next three. Line height = weekly opportunity on a shared scale, higher = more opportunity. Colour = skater matchup (green easier · yellow average · pink-red harder). Team schedule opportunity, not guaranteed roster starts.";
export type SkaterMatchup = "easier" | "average" | "harder" | "unknown" | "no_games";
export const MATCHUP_LABELS: Record<SkaterMatchup, string> = { easier: "Easy", average: "Avg", harder: "Hard", unknown: "Unknown", no_games: "No games" };

export type OpponentRating = { atk: number | null; def: number | null; sampleMin: number | null; sampleMax: number | null; reason: string };
export function percentileMap(values: { teamId: number; value: number | null }[]) {
  const sorted = values.filter((v): v is { teamId: number; value: number } => v.value != null && Number.isFinite(v.value)).sort((a, b) => a.value - b.value);
  const result = new Map<number, number>();
  for (let first = 0; first < sorted.length;) {
    let end = first + 1;
    while (end < sorted.length && sorted[end].value === sorted[first].value) end++;
    const percentile = sorted.length === 1 ? 50 : 100 * ((first + end - 1) / 2) / (sorted.length - 1);
    sorted.slice(first, end).forEach(({ teamId }) => result.set(teamId, percentile));
    first = end;
  }
  return result;
}

export function buildOpponentRatings(entries: { team: TeamDataWithTotals; averages: OpponentMetricAverages }[], stats: Record<string, TeamStats> = {}): Record<number, OpponentRating> {
  const valid = (entry: typeof entries[number], value: number | null) => {
    const coverage = entry.team.totals.scheduleCoverage;
    return entry.team.totals.gamesPlayed > 0 && coverage != null && coverage.expected > 0 && coverage.known === coverage.expected && value != null && value >= 0 ? value : null;
  };
  const off = percentileMap(entries.map((e) => ({ teamId: e.team.teamId, value: valid(e, e.averages.avgXgf) })));
  const allowance = percentileMap(entries.map((e) => ({ teamId: e.team.teamId, value: valid(e, e.averages.avgXga) })));
  return Object.fromEntries(entries.map(({ team }) => {
    const gp = team.totals.opponents.map((o) => stats[o.abbreviation]?.gp).filter((n): n is number => typeof n === "number" && Number.isFinite(n) && n > 0);
    return [team.teamId, { atk: off.get(team.teamId) ?? null, def: allowance.has(team.teamId) ? 100 - allowance.get(team.teamId)! : null,
      sampleMin: gp.length ? Math.min(...gp) : null, sampleMax: gp.length ? Math.max(...gp) : null,
      reason: !team.totals.gamesPlayed ? "No included games" : off.has(team.teamId) && allowance.has(team.teamId) ? "Provisional observed percentile" : "Requires complete schedule and opponent observations" }];
  }));
}

export function remainingEligibility(game: GameData, calculatedAt: string): "eligible" | "excluded" | "unknown" {
  const state = game.gameState?.toUpperCase();
  const scheduleState = game.gameScheduleState?.toUpperCase();
  if ([state, scheduleState].some((s) => s != null && ["PPD", "CNCL", "POSTPONED", "CANCELLED"].includes(s))) return "excluded";
  if (state && ["LIVE", "CRIT", "FINAL", "OFF", "OVER"].includes(state)) return "excluded";
  const start = typeof game.startTimeUTC === "string" && /(?:Z|[+-]\d{2}:\d{2})$/.test(game.startTimeUTC) ? Date.parse(game.startTimeUTC) : NaN;
  const cutoff = Date.parse(calculatedAt);
  if (!Number.isFinite(start) || !Number.isFinite(cutoff) || scheduleState !== "OK" || !state || !["FUT", "PRE"].includes(state)) return "unknown";
  return start > cutoff ? "eligible" : "excluded";
}

// UTC calendar arithmetic on date-only strings; viewer timezone never participates.
export function shiftNhlDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function fourWeekStart(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return shiftNhlDate(date, -((day + 6) % 7));
}
export type OpportunityWeek = {
  skaterMatchup: SkaterMatchup;
  weekNumber: number; start: string; end: string; gamesPlayed: number | null; offNights: number | null;
  opportunity: number | null; observedGP: number; observedON: number; excluded: number; unknown: number;
  coverage: { known: number; expected: number }; opponents: string[]; xgf: number | null; xga: number | null;
};
export type TeamOpportunity = {
  calculatedAt: string; weeks: OpportunityWeek[]; opportunity: number | null; teamData: TeamDataWithTotals;
};

export function buildScheduleOpportunity(rows: ExtendedWeekData[], teams: { id: number; abbreviation: string }[], selectedStart: string, calculatedAt: string,
  stats: Record<string, TeamStats> = {}, pointPct: Record<number, number> = {}): Record<number, TeamOpportunity> {
  const start = fourWeekStart(selectedStart);
  const byId = new Map(teams.map((t) => [t.id, t]));
  const slates = new Map<string, Set<number>>();
  rows.forEach((row) => Object.values(row).forEach((g: unknown) => {
    if (!g || typeof g !== "object" || !("id" in g)) return;
    const game = g as GameData;
    if (!game.gameDate || !isRegularScheduleGame(game)) return;
    if (!slates.has(game.gameDate)) slates.set(game.gameDate, new Set());
    slates.get(game.gameDate)!.add(game.id);
  }));
  const result: Record<number, TeamOpportunity> = Object.fromEntries(teams.map((team) => {
    const opponents: { abbreviation: string; teamId: number }[] = [];
    const weeks = Array.from({ length: 4 }, (_, index): OpportunityWeek => {
      const weekNumber = index + 1;
      const weekStart = shiftNhlDate(start, index * 7);
      const end = shiftNhlDate(weekStart, 6);
      const row = rows.find((r) => r.teamId === team.id && r.weekNumber === weekNumber);
      const coverage = row?.scheduleCoverage ?? { known: 0, expected: 7 };
      const complete = coverage.expected === 7 && coverage.known === 7;
      const games = new Map<number, GameData>();
      Object.values(row ?? {}).forEach((g: unknown) => { if (g && typeof g === "object" && "id" in g) games.set((g as GameData).id, g as GameData); });
      let gp = 0, on = 0, excluded = 0, unknown = 0;
      const weekOpponents: string[] = [], attack: number[] = [], allowance: number[] = [];
      games.forEach((game) => {
        if (game.gameType !== 2) return;
        if (!game.gameDate || game.gameDate < weekStart || game.gameDate > end) { unknown++; return; }
        const eligibility = remainingEligibility(game, calculatedAt);
        if (eligibility === "unknown") { unknown++; return; }
        if (eligibility === "excluded") { excluded++; return; }
        gp++; if ((slates.get(game.gameDate)?.size ?? 0) <= 8) on++;
        const opponentId = game.homeTeam.id === team.id ? game.awayTeam.id : game.homeTeam.id;
        const abbreviation = byId.get(opponentId)?.abbreviation ?? String(opponentId);
        weekOpponents.push(abbreviation); opponents.push({ abbreviation, teamId: opponentId });
        const source = stats[abbreviation];
        if (source && source.gp != null && Number.isFinite(source.gp) && source.gp > 0) {
          if (source.xgf != null && Number.isFinite(source.xgf) && source.xgf >= 0) attack.push(source.xgf / source.gp);
          if (source.xga != null && Number.isFinite(source.xga) && source.xga >= 0) allowance.push(source.xga / source.gp);
        }
      });
      const available = complete && unknown === 0;
      return { skaterMatchup: available && gp === 0 ? "no_games" : "unknown", weekNumber, start: weekStart, end, gamesPlayed: available ? gp : null, offNights: available ? on : null,
        opportunity: available ? gp + .25 * on : null, observedGP: gp, observedON: on, excluded, unknown, coverage, opponents: weekOpponents,
        xgf: available && gp > 0 && attack.length === gp ? attack.reduce((a, b) => a + b, 0) / gp : null,
        xga: available && gp > 0 && allowance.length === gp ? allowance.reduce((a, b) => a + b, 0) / gp : null };
    });
    const complete = weeks.every((w) => w.opportunity != null);
    const pcts = opponents.map((o) => pointPct[o.teamId]).filter((v) => Number.isFinite(v) && v >= 0 && v <= 1);
    const teamData: TeamDataWithTotals = { teamId: team.id, teamAbbreviation: team.abbreviation,
      weeks: weeks.map((w) => ({ weekNumber: w.weekNumber, gamesPlayed: w.observedGP, offNights: w.observedON,
        opponents: w.opponents.map((abbreviation) => ({ abbreviation, teamId: teams.find((t) => t.abbreviation === abbreviation)?.id ?? 0 })),
        scheduleCoverage: { known: w.opportunity == null ? 0 : 7, expected: 7 } })),
      totals: { opponents, gamesPlayed: weeks.reduce((s, w) => s + w.observedGP, 0), offNights: weeks.reduce((s, w) => s + w.observedON, 0),
        scheduleCoverage: { known: complete ? 28 : weeks.filter((w) => w.opportunity != null).length * 7, expected: 28 } },
      avgOpponentPointPct: complete && pcts.length > 0 && pcts.length === opponents.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null,
      opponentCoverage: { known: pcts.length, expected: opponents.length } };
    return [team.id, { calculatedAt, weeks, teamData, opportunity: complete ? weeks.reduce((s, w) => s + w.opportunity!, 0) : null }];
  }));
  for (let index = 0; index < 4; index++) {
    const bands = toFourWeekMetricBands(Object.entries(result).map(([teamId, team]) => ({ teamId: Number(teamId), value: team.weeks[index].xga })), "desc");
    Object.entries(result).forEach(([teamId, team]) => {
      const band = bands.get(Number(teamId));
      if (band) team.weeks[index].skaterMatchup = band === "high" ? "easier" : band === "low" ? "harder" : "average";
    });
  }
  return result;
}

export const opportunityScale = (teams: Record<number, TeamOpportunity>) => Math.max(1, Math.ceil(Math.max(0, ...Object.values(teams).flatMap((t) => t.weeks.flatMap((w) => w.opportunity == null ? [] : [w.opportunity])))));
export const formatOpportunity = (value: number | null | undefined) => value == null ? "—" : value.toFixed(1);
