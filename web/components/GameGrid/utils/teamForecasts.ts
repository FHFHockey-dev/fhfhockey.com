export const TEAM_FORECAST_CATEGORIES = ["G", "A", "SOG", "HIT", "BLK", "PPP", "PIM"] as const;
export type TeamForecastCategory = typeof TEAM_FORECAST_CATEGORIES[number];

export type CategorySummary = {
  status: "available" | "partial" | "unavailable" | "no_games";
  /** A partial mean is the known subtotal, never an extrapolated full total. */
  mean: number | null;
  knownGames: number;
  expectedGames: number;
  limitations: string[];
};

/** Fantasy event credits; scoreboard shootout goals and PP goal counts do not qualify. */
export const TEAM_FORECAST_CREDITS: Readonly<Record<TeamForecastCategory, string>> = {
  G: "individual_goals_excluding_shootout",
  A: "awarded_assists",
  SOG: "individual_shots_on_goal",
  HIT: "individual_hits",
  BLK: "individual_blocked_shots",
  PPP: "power_play_goals_plus_assists",
  PIM: "individual_penalty_minutes",
};

export type TeamForecastContext = {
  seasonId: number;
  scheduleRevision: string;
  rosterRevision: string;
  rosterScope: "skaters" | "all_players";
  games: readonly {
    gameId: number;
    startsAt: string;
    state: "scheduled" | "started" | "completed" | "postponed" | "cancelled";
  }[];
};

/** Inputs must come from an admitted public reader; this module grants no serving permission. */
export type TeamForecastRecord = {
  teamId: number;
  gameId: number;
  seasonId: number;
  category: TeamForecastCategory;
  mean: number | null;
  unit: string;
  scope: string;
  conditioning: string;
  creditDefinition: string;
  rosterScope: "skaters" | "all_players";
  rosterRevision: string;
  scheduleRevision: string;
  startsAt: string;
  status: "qualified" | "unavailable";
  allowedUses: { totals: boolean; comparison: boolean };
  revisionId: string;
  modelVersion: string;
  /** Qualified shared run/input manifest; output revision IDs may differ. */
  comparisonLineageId: string;
  sourceWatermark: string;
  sourceAvailableAt: string;
  cutoffAt: string;
  issuedAt: string;
  availableAt: string;
  expiresAt: string;
  limitations?: readonly string[];
};

export type TeamForecastInput = {
  teamId: number;
  gameIds: readonly number[];
  asOf: string;
  records?: readonly TeamForecastRecord[];
  context?: TeamForecastContext;
};

const nonempty = (value: string) => typeof value === "string" && value.trim().length > 0;
const sameTime = (left: string, right: string) => Number.isFinite(Date.parse(left))
  && Date.parse(left) === Date.parse(right);
const unique = (values: string[]) => [...new Set(values)];

function assessRecord(record: TeamForecastRecord, input: TeamForecastInput,
  category: TeamForecastCategory, gameId: number, comparison = false): string[] {
  const context = input.context;
  if (!context) return ["Forecast schedule and roster context unavailable."];
  const games = context.games.filter(game => game.gameId === gameId);
  const game = games.length === 1 ? games[0] : undefined;
  const reasons: string[] = [];
  if (!Number.isInteger(input.teamId) || input.teamId <= 0 || !Number.isInteger(gameId) || gameId <= 0
    || !Number.isInteger(context.seasonId) || context.seasonId <= 0 || record.teamId !== input.teamId
    || record.gameId !== gameId || record.seasonId !== context.seasonId
    || record.category !== category || !nonempty(context.scheduleRevision)
    || !nonempty(context.rosterRevision) || record.scheduleRevision !== context.scheduleRevision
    || record.rosterRevision !== context.rosterRevision || record.rosterScope !== context.rosterScope
    || !game || !sameTime(record.startsAt, game.startsAt)) {
    reasons.push("Forecast game, schedule or roster identity does not match.");
  }
  const now = Date.parse(input.asOf), start = Date.parse(game?.startsAt ?? "");
  if (game?.state !== "scheduled" || !Number.isFinite(start) || start <= now) {
    reasons.push("Only future scheduled full-game forecasts are supported.");
  }
  if (record.scope !== "full_game_regulation_overtime" || record.conditioning !== "unconditional"
    || record.unit !== (category === "PIM" ? "minutes" : "count")
    || record.creditDefinition !== TEAM_FORECAST_CREDITS[category]) {
    reasons.push("Forecast scope, conditioning, units or event credits do not match.");
  }
  if (record.status !== "qualified" || record.allowedUses?.totals !== true
    || comparison && record.allowedUses?.comparison !== true) {
    reasons.push("Forecast use is not admitted.");
  }
  if (!nonempty(record.revisionId) || !nonempty(record.modelVersion)
    || !nonempty(record.comparisonLineageId) || !nonempty(record.sourceWatermark)) {
    reasons.push("Forecast lineage is unavailable.");
  }
  const source = Date.parse(record.sourceAvailableAt), cutoff = Date.parse(record.cutoffAt);
  const issued = Date.parse(record.issuedAt), available = Date.parse(record.availableAt);
  const expires = Date.parse(record.expiresAt);
  if (![now, source, cutoff, issued, available, expires].every(Number.isFinite)
    || source > cutoff || cutoff > issued || issued > available || available > now
    || issued >= start || cutoff >= start) {
    reasons.push("Forecast issuance or source availability is not safe at this cutoff.");
  }
  if (!Number.isFinite(expires) || expires <= now || expires <= issued) {
    reasons.push("Forecast is stale or its expiry is unknown.");
  }
  if (record.mean == null || !Number.isFinite(record.mean) || record.mean < 0) {
    reasons.push("Category mean unavailable.");
  }
  return reasons;
}

export function summarizeTeamForecasts(input: TeamForecastInput): Record<TeamForecastCategory, CategorySummary> {
  const gameIds = [...new Set(input.gameIds)];
  return Object.fromEntries(TEAM_FORECAST_CATEGORIES.map(category => {
    const limitations: string[] = [];
    let knownGames = 0, subtotal = 0;
    for (const gameId of gameIds) {
      const records = (input.records ?? []).filter(record => record.teamId === input.teamId
        && record.gameId === gameId && record.category === category);
      if (records.length !== 1) {
        limitations.push(records.length ? "Duplicate category records require reader resolution."
          : "Qualified team category forecast unavailable.");
        continue;
      }
      const record = records[0];
      const reasons = assessRecord(record, input, category, gameId);
      limitations.push(...reasons, ...(record.limitations ?? []));
      if (reasons.length) continue;
      knownGames += 1;
      subtotal += record.mean!;
    }
    const expectedGames = gameIds.length;
    if (knownGames && !Number.isFinite(subtotal)) {
      limitations.push("Category subtotal is not finite.");
      knownGames = 0;
    }
    const status: CategorySummary["status"] = !expectedGames ? "no_games" : !knownGames ? "unavailable"
      : knownGames === expectedGames ? "available" : "partial";
    if (status === "partial") limitations.push(`Known subtotal, ${knownGames} of ${expectedGames} games; missing games are not zero.`);
    return [category, { status, mean: status === "no_games" ? 0 : knownGames ? subtotal : null,
      knownGames, expectedGames, limitations: unique(limitations) }];
  })) as Record<TeamForecastCategory, CategorySummary>;
}

export type PlayerForecastRecord = TeamForecastRecord & { playerId: number };
export type TeamPlayerReconciliation = {
  status: "available" | "partial" | "unavailable";
  teamMean: number | null;
  knownPlayerSubtotal: number | null;
  /** Team minus known player credits; includes uncovered players/unassigned events. */
  residual: number | null;
  knownPlayers: number;
  expectedPlayers: number;
  limitations: string[];
};

/** Compare an explicit roster for one category/game. No participation adjustment or rescaling occurs. */
export function reconcileTeamPlayerForecast(input: {
  team: TeamForecastRecord;
  players: readonly PlayerForecastRecord[];
  expectedPlayerIds: readonly number[];
  asOf: string;
  context: TeamForecastContext;
}): TeamPlayerReconciliation {
  const { team } = input;
  const admission: TeamForecastInput = { teamId: team.teamId, gameIds: [team.gameId],
    asOf: input.asOf, context: input.context };
  const limitations = assessRecord(team, admission, team.category, team.gameId, true);
  const expectedIds = [...new Set(input.expectedPlayerIds)];
  const unavailable: TeamPlayerReconciliation = { status: "unavailable", teamMean: null,
    knownPlayerSubtotal: null, residual: null, knownPlayers: 0, expectedPlayers: expectedIds.length,
    limitations };
  if (!expectedIds.length || expectedIds.some(id => !Number.isInteger(id) || id <= 0)) {
    limitations.push("Declared player roster unavailable.");
  }
  if (limitations.length) return unavailable;
  let knownPlayers = 0, subtotal = 0;
  for (const playerId of expectedIds) {
    const records = input.players.filter(player => player.playerId === playerId);
    if (records.length !== 1) {
      limitations.push(records.length ? "Duplicate player records require reader resolution."
        : "Player forecast missing from the declared roster.");
      continue;
    }
    const player = records[0];
    const reasons = assessRecord(player, admission, team.category, team.gameId, true);
    if (!sameTime(player.cutoffAt, team.cutoffAt)) reasons.push("Team/player decision cutoffs do not match.");
    if (player.comparisonLineageId !== team.comparisonLineageId) {
      reasons.push("Team/player comparison lineage does not match.");
    }
    if (player.modelVersion !== team.modelVersion) reasons.push("Team/player model versions do not match.");
    limitations.push(...reasons, ...(player.limitations ?? []));
    if (reasons.length) continue;
    knownPlayers += 1;
    subtotal += player.mean!;
  }
  if (input.players.some(player => !expectedIds.includes(player.playerId))) {
    limitations.push("Players outside the declared roster were excluded.");
  }
  limitations.push(...(team.limitations ?? []));
  if (!knownPlayers || !Number.isFinite(subtotal)) return { ...unavailable, teamMean: team.mean,
    limitations: unique([...limitations, "No finite admitted player subtotal."]) };
  limitations.push("Residual compares the team with known player credits and may include missing players or unassigned events; no rescaling.");
  return { status: knownPlayers === expectedIds.length ? "available" : "partial", teamMean: team.mean,
    knownPlayerSubtotal: subtotal, residual: team.mean! - subtotal, knownPlayers,
    expectedPlayers: expectedIds.length, limitations: unique(limitations) };
}
