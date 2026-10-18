import type { GameExpectationsResponse, GameExpectationTarget } from "lib/player-forecasts/gameExpectations";
import { TEAM_FORECAST_CATEGORIES, type TeamForecastCategory } from "./teamForecasts";

/** Native FORGE targets behind each Game Grid category (shared with RSO and Start Chart). */
export const TEAM_CATEGORY_TARGETS: Readonly<Record<TeamForecastCategory, string>> = {
  G: "GOALS", A: "ASSISTS", SOG: "SHOTS_ON_GOAL", HIT: "HITS",
  BLK: "BLOCKED_SHOTS", PPP: "PP_POINTS", PIM: "PENALTY_MINUTES"
};

/** G, A and PPP share event credits (a PP goal is G and PPP); they are never disjoint. */
const OVERLAPPING = new Set<TeamForecastCategory>(["G", "A", "PPP"]);
export function overlappingCategories(categories: readonly TeamForecastCategory[]) {
  const shared = [...new Set(categories)].filter((category) => OVERLAPPING.has(category));
  return shared.length > 1 ? shared : [];
}

export type TeamExpectationKey = { gameId: string; playerId: string; target: string };
export type TeamExpectationSummary = {
  status: "available" | "partial" | "unavailable" | "no_games";
  /** Sum of admitted unconditional player expectations; never a team total or extrapolation. */
  knownPlayerSubtotal: number | null;
  covered: TeamExpectationKey[];
  missing: (TeamExpectationKey & { reasons: string[] })[];
  /** Latest original cutoff and earliest expiry across covered keys. */
  cutoffAt: string | null;
  expiresAt: string | null;
  limitations: string[];
};

type Player = GameExpectationsResponse["players"][number];
const time = (value: string | null | undefined) => Date.parse(value ?? "");

function admit(target: GameExpectationTarget | undefined, scheduledAt: string, asOf: number) {
  if (!target) return ["missing_target"];
  const reasons = [...target.reasons];
  const start = time(scheduledAt), cutoff = time(target.cutoffAt), issued = time(target.issuedAt), expires = time(target.expiresAt);
  if (!target.allowedUses.totals) reasons.push("use_not_approved");
  if (target.expected == null || !Number.isFinite(target.expected) || target.expected < 0) reasons.push("expected_unavailable");
  if (!Number.isFinite(start) || start <= asOf) reasons.push("game_not_future");
  if (![cutoff, issued, expires].every(Number.isFinite)) reasons.push("clocks_unavailable");
  else {
    if (cutoff > issued || cutoff >= start || issued >= start || issued > asOf) reasons.push("unsafe_cutoff");
    if (expires <= asOf) reasons.push("expired");
  }
  if (!target.sources.length) reasons.push("lineage_unavailable");
  return [...new Set(reasons)];
}

/**
 * Remaining-horizon skater subtotals for one team from the shared native
 * catalog. Every (game, player, target) key in scope is either covered or
 * carries missing reasons; partial coverage is never rescaled.
 */
export function summarizeTeamGameExpectations(input: {
  response: GameExpectationsResponse | null;
  team: string;
  gameIds: readonly string[];
  asOf: string;
}): Record<TeamForecastCategory, TeamExpectationSummary> {
  const asOf = time(input.asOf);
  const gameIds = [...new Set(input.gameIds)];
  const players = (input.response?.players ?? []).filter((player) => player.team === input.team && player.playerClass === "skater");
  const duplicateIds = new Set(players.map((p) => p.playerId).filter((id, i, ids) => ids.indexOf(id) !== i));
  const base = !input.response ? ["Shared FORGE game expectations unavailable."]
    : !Number.isFinite(asOf) ? ["Read time unavailable."] : !players.length && gameIds.length ? ["No skaters for this team in the shared reader."] : [];

  return Object.fromEntries(TEAM_FORECAST_CATEGORIES.map((category) => {
    const target = TEAM_CATEGORY_TARGETS[category];
    const covered: TeamExpectationKey[] = [], missing: TeamExpectationSummary["missing"] = [];
    let subtotal = 0, cutoffAt: string | null = null, expiresAt: string | null = null;
    const limitations = [...base];
    for (const player of players as Player[]) for (const gameId of gameIds) {
      const key = { gameId, playerId: player.playerId, target };
      const games = player.games.filter((game) => game.gameId === gameId);
      if (duplicateIds.has(player.playerId) || games.length > 1) { missing.push({ ...key, reasons: ["duplicate_key"] }); continue; }
      if (!games.length) { missing.push({ ...key, reasons: ["game_not_in_reader"] }); continue; }
      const reasons = Number.isFinite(asOf) ? admit(games[0].targets[target], games[0].scheduledAt, asOf) : ["read_time_unavailable"];
      if (reasons.length) { missing.push({ ...key, reasons }); continue; }
      const t = games[0].targets[target];
      covered.push(key);
      subtotal += t.expected!;
      if (cutoffAt == null || time(t.cutoffAt) > time(cutoffAt)) cutoffAt = t.cutoffAt;
      if (expiresAt == null || time(t.expiresAt) < time(expiresAt)) expiresAt = t.expiresAt;
    }
    const status: TeamExpectationSummary["status"] = !gameIds.length ? "no_games"
      : !covered.length ? "unavailable" : missing.length ? "partial" : "available";
    if (status === "partial") limitations.push(`Known subtotal: ${covered.length} of ${covered.length + missing.length} player-games; missing keys are not zero.`);
    limitations.push("Skaters listed by the shared reader only; not a team total.");
    return [category, { status, knownPlayerSubtotal: status === "no_games" ? 0 : covered.length ? subtotal : null,
      covered, missing, cutoffAt, expiresAt, limitations }];
  })) as Record<TeamForecastCategory, TeamExpectationSummary>;
}
