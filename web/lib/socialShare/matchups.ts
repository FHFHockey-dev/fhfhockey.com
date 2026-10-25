import { percentileMap } from "components/GameGrid/utils/scheduleOpportunity";
import type { TeamStats } from "components/GameGrid/utils/useOpponentMetricsData";

/** The nst_team_stats columns the opponent layer reads (a subset of Game Grid's TeamStats). */
export type ShareTeamRateRow = Pick<TeamStats, "gp" | "xgf" | "xga" | "season" | "situation" | "updated_at"> & Partial<Pick<TeamStats, "gf" | "ga" | "sf" | "sa">>;
import { countsAsOpportunity } from "./mondayGrid";
import type { ShareGame, ShareOpponentStats, ShareTeam, ShareTeamRates, SocialShareSnapshot } from "./types";

/** NST team rows refresh daily; older than this, matchup cards stop ranking. */
export const OPPONENT_STATS_MAX_AGE_MS = 72 * 3600000;
export const EASIEST_LIMIT = 8;
/** Six tiles, each with room for its evidence (ticket 10). */
export const STREAM_LIMIT = 6;
/** Opponent DEF percentile at or below this is a "soft" defense (Game Grid's easier third). */
export const SOFT_DEFENSE_MAX = 33;
/** Streaming nights come from the top half of the Week Score ranking. */
export const STREAM_TEAM_RANK_MAX = 16;

const isRate = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const timestamp = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Date(Date.parse(value)).toISOString() : null;

/** Same row rules as Game Grid's loadCurrentSeasonStats plus a completeness and freshness gate. */
export function buildOpponentLayer(stats: Record<string, ShareTeamRateRow> | null, input: { season: number; teams: ShareTeam[]; fetchedAt: string; generatedAt: string }): ShareOpponentStats {
  const reasons: string[] = [];
  const teams: Record<string, ShareTeamRates> = {};
  let updatedAt: string | null = null;
  for (const team of input.teams) {
    const row = stats?.[team.abbreviation];
    if (!row || row.season !== input.season || (row.situation !== undefined && row.situation !== "all") || !isRate(row.gp) || row.gp <= 0 || !isRate(row.xgf) || !isRate(row.xga)) {
      if (stats) reasons.push(`Opponent rates are missing or invalid for ${team.abbreviation}.`);
      continue;
    }
    // Goals and shots per game back the streaming-matchup evidence; missing values stay absent.
    teams[team.abbreviation] = { gp: row.gp, xgf: row.xgf, xga: row.xga, ...Object.fromEntries((["gf", "ga", "sf", "sa"] as const).filter(key => isRate(row[key])).map(key => [key, row[key] as number])) };
    const updated = timestamp(row.updated_at);
    if (updated && (!updatedAt || updated > updatedAt)) updatedAt = updated;
  }
  let state: ShareOpponentStats["state"] = !stats ? "missing" : reasons.length ? "partial" : "ready";
  if (!stats) reasons.push("Opponent team stats are unavailable.");
  else if (!updatedAt) { state = state === "ready" ? "partial" : state; reasons.push("Opponent team stats have no update time."); }
  else if (Date.parse(updatedAt) > Date.parse(input.generatedAt)) { state = "missing"; reasons.push("Opponent team stats update time is in the future."); }
  else if (Date.parse(input.generatedAt) - Date.parse(updatedAt) > OPPONENT_STATS_MAX_AGE_MS) { state = "stale"; reasons.push("Opponent team stats are older than 72 hours."); }
  return { name: "NST team stats", season: input.season, fetchedAt: input.fetchedAt, updatedAt, state, reasons, teams };
}

export const opponentsReady = (snapshot: SocialShareSnapshot) => snapshot.opponents?.state === "ready";

/** Single-opponent Game Grid DEF: 100 − percentile of that team's xGA/GP. Higher = stronger defense. */
export function opponentDefense(snapshot: SocialShareSnapshot): Map<number, number> {
  const rates = snapshot.opponents?.teams ?? {};
  const allowance = percentileMap(snapshot.teams.map(team => {
    const rate = rates[team.abbreviation];
    return { teamId: team.id, value: rate ? rate.xga / rate.gp : null };
  }));
  return new Map([...allowance].map(([teamId, pct]) => [teamId, 100 - pct]));
}

export type MatchupGame = { id: number; date: string; opponent: ShareTeam; home: boolean; offNight: boolean; leagueGames: number; oppDef: number | null };
export type EasiestRow = {
  team: ShareTeam; rank: number; weekRank: number; remainingGames: number; offNightGames: number;
  /** Game Grid DEF over the counted opponents: 100 − percentile of their mean xGA/GP. Lower = softer schedule. */
  def: number; games: MatchupGame[];
};

function countedGames(snapshot: SocialShareSnapshot, team: ShareTeam, defense: Map<number, number>): MatchupGame[] {
  return snapshot.games.filter(game => (game.homeTeam.id === team.id || game.awayTeam.id === team.id) && countsAsOpportunity(snapshot, game))
    .sort((a, b) => Date.parse(a.startTimeUtc!) - Date.parse(b.startTimeUtc!) || a.id - b.id)
    .map((game: ShareGame) => {
      const home = game.homeTeam.id === team.id, opponent = home ? game.awayTeam : game.homeTeam;
      const day = snapshot.days.find(item => item.date === game.date)!;
      return { id: game.id, date: game.date, opponent, home, offNight: day.offNight, leagueGames: day.leagueGames, oppDef: defense.get(opponent.id) ?? null };
    });
}

/**
 * Easiest schedules: teams with at least `floor` remaining games, ranked by Game Grid's opponent
 * DEF rating over their counted opponents (softest first), then more games, then Week Score rank.
 * Returns no rows unless the schedule and opponent layer are both trusted.
 */
export function easiestSchedules(snapshot: SocialShareSnapshot, trusted: boolean): { floor: number; rows: EasiestRow[] } {
  // Three games is the floor for a full week; a shorter selection lowers it to the most games available.
  const floor = Math.max(1, Math.min(3, ...snapshot.rows.map(row => row.remainingGames).filter(games => games > 0).sort((a, b) => b - a).slice(0, 1)));
  if (!trusted || !opponentsReady(snapshot)) return { floor, rows: [] };
  const defense = opponentDefense(snapshot), rates = snapshot.opponents!.teams;
  const scheduled = snapshot.rows.filter(row => row.remainingGames > 0).map(row => {
    const games = countedGames(snapshot, row.team, defense);
    const allowances = games.map(game => rates[game.opponent.abbreviation]).filter(Boolean).map(rate => rate.xga / rate.gp);
    return { row, games, mean: allowances.length === games.length ? allowances.reduce((sum, value) => sum + value, 0) / games.length : null };
  });
  // Percentiles span every team with games, matching Game Grid's league-wide comparison.
  const allowance = percentileMap(scheduled.map(item => ({ teamId: item.row.team.id, value: item.mean })));
  const rows = scheduled.filter(item => item.row.remainingGames >= floor && allowance.has(item.row.team.id))
    .map(item => ({ team: item.row.team, rank: 0, weekRank: item.row.rank, remainingGames: item.row.remainingGames, offNightGames: item.row.offNightGames, def: 100 - allowance.get(item.row.team.id)!, games: item.games }))
    .sort((a, b) => a.def - b.def || b.remainingGames - a.remainingGames || a.weekRank - b.weekRank || a.team.abbreviation.localeCompare(b.team.abbreviation))
    .slice(0, EASIEST_LIMIT).map((row, i) => ({ ...row, rank: i + 1 }));
  return { floor, rows };
}

/** One per-game team rate with its league rank (1 = most per game among teams with data). */
export type RankedRate = { perGame: number; rank: number; of: number };
export type StormFlag = "goals" | "shots" | "blocks" | "tired";
export type StreamEvidence = {
  /** Streaming team's GF/GP vs the opponent's GA/GP. */
  goals: { team: RankedRate | null; opponent: RankedRate | null; storm: boolean };
  /** Streaming team's SF/GP vs the opponent's SA/GP. */
  shots: { team: RankedRate | null; opponent: RankedRate | null; storm: boolean };
  /** Shots-against tilt (ticket 22, TJ): the streaming team's SA/GP vs the opponent's SF/GP; storm → blockers. */
  blocks: { team: RankedRate | null; opponent: RankedRate | null; storm: boolean };
  /** Back-to-back on this date (played the day before); null when the day before is outside the week. */
  rest: { opponentSecondNight: boolean | null; teamSecondNight: boolean | null };
  flags: StormFlag[];
};
export type StreamNight = MatchupGame & { team: ShareTeam; weekRank: number; remainingGames: number; oppDef: number | null; evidence: StreamEvidence };

/** League rank of each team's per-game value for one nst_team_stats column (descending). */
function rateRanks(snapshot: SocialShareSnapshot, key: "gf" | "ga" | "sf" | "sa"): Map<string, RankedRate> {
  const values = Object.entries(snapshot.opponents?.teams ?? {}).flatMap(([team, rates]) => rates[key] === undefined || rates.gp <= 0 ? [] : [{ team, perGame: rates[key]! / rates.gp }])
    .sort((a, b) => b.perGame - a.perGame);
  return new Map(values.map(({ team, perGame }) => [team, { perGame, rank: 1 + values.findIndex(item => item.perGame === perGame), of: values.length }]));
}
/** Top third of the league: the "perfect storm" threshold for both sides of a pairing. */
const topThird = (rate: RankedRate | null | undefined) => !!rate && rate.rank <= Math.ceil(rate.of / 3);
const previousDay = (date: string) => new Date(Date.parse(`${date}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);

/**
 * Evidence for one team-night, from observed season rates and the schedule only:
 * goal storm (team GF/GP and opponent GA/GP both top third), shot storm (SF/GP vs SA/GP) and a
 * tired opponent (it played the day before and the streaming team did not).
 */
export function streamEvidence(snapshot: SocialShareSnapshot, team: ShareTeam, opponent: ShareTeam, date: string): StreamEvidence {
  const gf = rateRanks(snapshot, "gf"), ga = rateRanks(snapshot, "ga"), sf = rateRanks(snapshot, "sf"), sa = rateRanks(snapshot, "sa");
  const goals = { team: gf.get(team.abbreviation) ?? null, opponent: ga.get(opponent.abbreviation) ?? null, storm: false };
  goals.storm = topThird(goals.team) && topThird(goals.opponent);
  const shots = { team: sf.get(team.abbreviation) ?? null, opponent: sa.get(opponent.abbreviation) ?? null, storm: false };
  shots.storm = topThird(shots.team) && topThird(shots.opponent);
  const blocks = { team: sa.get(team.abbreviation) ?? null, opponent: sf.get(opponent.abbreviation) ?? null, storm: false };
  blocks.storm = topThird(blocks.team) && topThird(blocks.opponent);
  const before = previousDay(date), known = before >= snapshot.weekStart;
  const played = (id: number) => snapshot.games.some(game => game.date === before && game.gameType === 2 && !["postponed", "cancelled"].includes(game.status) && (game.homeTeam.id === id || game.awayTeam.id === id));
  const rest = { opponentSecondNight: known ? played(opponent.id) : null, teamSecondNight: known ? played(team.id) : null };
  const flags: StormFlag[] = [...(goals.storm ? ["goals" as const] : []), ...(shots.storm ? ["shots" as const] : []), ...(blocks.storm ? ["blocks" as const] : []), ...(rest.opponentSecondNight && !rest.teamSecondNight ? ["tired" as const] : [])];
  return { goals, shots, blocks, rest, flags };
}

/**
 * Streaming nights for top-half Week Score teams: a counted game against a soft defense (DEF ≤ 33)
 * or with at least one perfect-storm signal. Most signals first, then off-nights, the softest
 * opponent and the better schedule. One night per team; six tiles.
 */
const selectionFlags = (night: { evidence: StreamEvidence }) => night.evidence.flags.filter(flag => flag !== "blocks").length;
export function streamingNights(snapshot: SocialShareSnapshot, trusted: boolean): StreamNight[] {
  if (!trusted || !opponentsReady(snapshot)) return [];
  const defense = opponentDefense(snapshot);
  return snapshot.rows.filter(row => row.remainingGames > 0 && row.rank <= STREAM_TEAM_RANK_MAX)
    .flatMap(row => countedGames(snapshot, row.team, defense).map(game => ({ ...game, team: row.team, weekRank: row.rank, remainingGames: row.remainingGames, evidence: streamEvidence(snapshot, row.team, game.opponent, game.date) }))
      .filter(night => (night.oppDef !== null && night.oppDef <= SOFT_DEFENSE_MAX) || night.evidence.flags.some(flag => flag === "goals" || flag === "shots")))
    // The shots-against tilt (ticket 22) only drives player picks; it never changes which nights are chosen.
    .sort((a, b) => selectionFlags(b) - selectionFlags(a) || Number(b.offNight) - Number(a.offNight) || (a.oppDef ?? 100) - (b.oppDef ?? 100) || a.weekRank - b.weekRank || a.date.localeCompare(b.date) || a.id - b.id)
    .filter((night, index, nights) => nights.findIndex(item => item.team.id === night.team.id) === index)
    .slice(0, STREAM_LIMIT);
}
