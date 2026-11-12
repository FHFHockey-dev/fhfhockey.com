import type { GameData } from "lib/NHL/types";
import { timestampMicros } from "lib/projections/evidenceTime";

export const GOALIE_GRID_VERSION = "goalie-grid-v1" as const;
export const GOALIE_WIN_DEFINITION = "Win % is this goalie's chance of receiving the credited win if they start.";
export const GOALIE_START_DEFINITION = "Start % is this goalie's chance of being the official starter.";
export type GoalieProbabilityTarget = "official_starter" | "credited_win_if_starting";
export type GoalieSource = {
  source: string; artifactId: string; revision: string;
  /** availableAt is the observation/input availability, not forecast publication. */
  observedAt: string | null; availableAt: string | null; cutoffAt: string | null; issuedAt: string; expiresAt: string;
  basis?: "starter_observation" | "model_issuance";
  freshnessBasis?: string;
};
export type GoalieProbability = {
  playerId: number; gameId: number; teamId: number; selectionRevision: string;
  target: GoalieProbabilityTarget; value: number | null;
  basis: "individual_goalie_game" | "team_slot";
  source: GoalieSource;
  publishedAt: string;
  /** An upstream qualification receipt, never inferred from numeric values or fixtures. */
  qualification: { status: "qualified" | "unqualified"; reportId: string | null;
    artifactId: string; population: "pregame_as_issued_goalie_game" | "unknown" };
  unavailableReason?: string;
};
export type GoalieCandidate = {
  playerId: number; name: string; surname: string;
  status: "confirmed" | "projected" | "unknown" | "stale" | "conflicting";
  source: GoalieSource;
  start: GoalieProbability | null; winIfStarting: GoalieProbability | null;
};
export type GoalieGameBoard = {
  gameId: number; seasonId: number; teamId: number; opponentId: number; startsAt: string;
  selectionRevision: string; selectedPlayerId: number | null;
  candidateCoverage: "complete" | "partial" | "unknown";
  candidates: readonly GoalieCandidate[];
};
export type GoalieGridSnapshot = {
  version: typeof GOALIE_GRID_VERSION;
  /** Independently requested schedule context; changing it invalidates the entire old response. */
  contextKey: string; boards: readonly GoalieGameBoard[];
  requestedRange?: { from: string; through: string };
};
export type GoalieMetric = { value: number | null; reason: string | null };
export type GoalieCellView = {
  phase: "pregame" | "in_progress" | "final" | "unavailable";
  candidate: GoalieCandidate | null; candidates: readonly GoalieCandidate[];
  candidateMetrics: Record<number, { start: GoalieMetric; win: GoalieMetric; reason: string | null }>;
  start: GoalieMetric; win: GoalieMetric; reason: string | null;
  candidateCoverage: GoalieGameBoard["candidateCoverage"];
  unresolvedStartMass: number | null;
};
const unavailable = (reason: string): GoalieMetric => ({ value: null, reason });
const instant = (s: string | null) => s == null ? null : timestampMicros(s);
const nonempty = (s: unknown): s is string => typeof s === "string" && s.trim().length > 0;

export function goalieScheduleKey(games: readonly GameData[], revision: string): string {
  return JSON.stringify([revision, [...new Map(games.map(g => [g.id, g])).values()]
    .sort((a, b) => a.id - b.id).map(g => [g.id, g.season, g.gameDate, g.startTimeUTC,
      g.gameState, g.gameScheduleState, g.homeTeam.id, g.awayTeam.id])]);
}

function sourceReason(source: GoalieSource, now: bigint | null, start: bigint | null, identityOnly = false): string | null {
  if (!source || ![source.source, source.artifactId, source.revision].every(nonempty)) return "Source lineage unavailable.";
  if (identityOnly && source.basis === "model_issuance") {
    const issued = instant(source.issuedAt), expires = instant(source.expiresAt), cutoff = instant(source.cutoffAt);
    if (now === null || start === null || issued === null || expires === null || issued > now || issued >= start || expires <= issued
      || source.cutoffAt !== null && (cutoff === null || cutoff > issued)) return "Selection was not issued before this game and view's cutoff.";
    return expires <= now ? "Source is stale." : null;
  }
  const times = [source.observedAt, source.availableAt, source.cutoffAt, source.issuedAt, source.expiresAt].map(instant);
  const [observed, available, cutoff, issued, expires] = times;
  if (now === null || start === null || observed === null || available === null || cutoff === null || issued === null || expires === null
    || observed > available || available > cutoff || cutoff > issued
    || issued > now || issued >= start || expires <= issued) return "Source was not available at the declared pregame cutoff.";
  return expires <= now ? "Source is stale." : null;
}

export function goalieMetric(candidate: GoalieCandidate, board: GoalieGameBoard,
  target: GoalieProbabilityTarget, now: bigint | null): GoalieMetric {
  const metric = target === "official_starter" ? candidate.start : candidate.winIfStarting;
  if (!metric) return unavailable("No qualified goalie-specific forecast is available.");
  if (metric.playerId !== candidate.playerId || metric.gameId !== board.gameId || metric.teamId !== board.teamId
    || metric.selectionRevision !== board.selectionRevision) return unavailable("Forecast identity or starter revision does not match.");
  if (metric.target !== target || metric.basis !== "individual_goalie_game") return unavailable("Forecast does not describe this individual goalie outcome.");
  const q = metric.qualification;
  if (!q || q.status !== "qualified" || !nonempty(q.reportId) || q.artifactId !== metric.source?.artifactId
    || q.population !== "pregame_as_issued_goalie_game") return unavailable(metric.unavailableReason || "This probability has not been qualified.");
  const reason = sourceReason(metric.source, now, instant(board.startsAt));
  if (reason) return unavailable(reason);
  const published = instant(metric.publishedAt), issued = instant(metric.source.issuedAt);
  if (published === null || issued === null || now === null || published < issued || published > now) return unavailable("Forecast was not published by this view's cutoff.");
  if (metric.value == null || !Number.isFinite(metric.value) || metric.value < 0 || metric.value > 1) return unavailable("Probability is missing or invalid.");
  return { value: metric.value, reason: null };
}

/** Presentation admission only. This never calibrates, renormalizes, or invents a forecast. */
export function resolveGoalieCell(game: GameData, teamId: number, snapshot: GoalieGridSnapshot | null | undefined,
  contextKey: string, asOf: string): GoalieCellView {
  const empty = (phase: GoalieCellView["phase"], reason: string): GoalieCellView => ({ phase, reason,
    candidate: null, candidates: [], candidateMetrics: {}, start: unavailable(reason), win: unavailable(reason), candidateCoverage: "unknown", unresolvedStartMass: null });
  const now = instant(asOf), start = instant(game.startTimeUTC ?? "");
  if (["OFF", "FINAL"].includes(game.gameState ?? "")) return empty("final", "Final game. Current forecasts are not historical forecasts.");
  if (["PPD", "CNCL", "SUSP"].includes(game.gameScheduleState ?? "")) return empty("unavailable", "Schedule changed. A new matching pregame forecast is required.");
  if (["LIVE", "CRIT"].includes(game.gameState ?? "") || start !== null && now !== null && now >= start) return empty("in_progress", "Game has started or reached its scheduled start. Pregame forecasts are no longer displayed.");
  if (!["FUT", "PRE"].includes(game.gameState ?? "") || game.gameScheduleState !== "OK" || now === null || start === null
    || ![game.homeTeam.id, game.awayTeam.id].includes(teamId)) return empty("unavailable", "Game status or schedule identity is unavailable.");
  if (!snapshot || snapshot.version !== GOALIE_GRID_VERSION || snapshot.contextKey !== contextKey) return empty("pregame", "Matching starter evidence is unavailable.");
  if (snapshot.requestedRange && (!game.gameDate || game.gameDate < snapshot.requestedRange.from || game.gameDate > snapshot.requestedRange.through))
    return empty("pregame", "This game is outside the requested ten-date forecast coverage. No forecast was requested for this game.");
  const boards = snapshot.boards.filter(b => b.gameId === game.id && b.teamId === teamId);
  const board = boards.length === 1 ? boards[0] : null;
  const opponentId = teamId === game.homeTeam.id ? game.awayTeam.id : game.homeTeam.id;
  if (!board || board.seasonId !== game.season || board.opponentId !== opponentId || instant(board.startsAt) !== start
    || !nonempty(board.selectionRevision)) return empty("pregame", "Starter evidence does not match the current schedule.");
  if (new Set(board.candidates.map(c => c.playerId)).size !== board.candidates.length) return empty("pregame", "Conflicting candidate identities.");
  const candidateMetrics = Object.fromEntries(board.candidates.map(c => {
    const reason = sourceReason(c.source, now, start, true) || (["stale", "conflicting"].includes(c.status) ? `Starter status: ${c.status}.` : null);
    return [c.playerId, { reason, start: reason ? unavailable(reason) : goalieMetric(c, board, "official_starter", now),
      win: reason ? unavailable(reason) : goalieMetric(c, board, "credited_win_if_starting", now) }];
  }));
  const candidate = board.candidates.find(c => c.playerId === board.selectedPlayerId);
  const base = { ...empty("pregame", "Projected goalie is unknown."), candidates: board.candidates, candidateMetrics, candidateCoverage: board.candidateCoverage };
  if (!candidate) return base;
  const evidenceReason = sourceReason(candidate.source, now, start, true);
  if (evidenceReason || !["confirmed", "projected"].includes(candidate.status)
    || !nonempty(candidate.name) || !nonempty(candidate.surname)) return { ...base, reason: evidenceReason || `Starter status: ${candidate.status}.` };
  const startMetric = goalieMetric(candidate, board, "official_starter", now);
  const win = goalieMetric(candidate, board, "credited_win_if_starting", now);
  const starts = board.candidates.map(c => candidateMetrics[c.playerId].start.value);
  const sum = starts.reduce<number>((total, p) => total + (p ?? 0), 0);
  // This is unresolved mass across all supplied candidates, never a guessed backup probability.
  const mass = starts.every(p => p !== null) && sum <= 1 ? Math.max(0, 1 - sum) : null;
  if (sum > 1) for (const metrics of Object.values(candidateMetrics)) metrics.start = unavailable("Candidate start probabilities exceed 100%.");
  return { ...base, candidate, start: sum > 1 ? unavailable("Candidate start probabilities exceed 100%.") : startMetric,
    win, reason: null, unresolvedStartMass: mass };
}

export const formatGoaliePercent = (value: number | null) => value == null ? "—" : `${Math.round(value * 100)}%`;
