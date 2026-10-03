import { instant, LINE_SELECTOR_VERSION, type LineGame } from "./types";

type BindingInput = { teamId: number; gameId?: number | null; opponentId?: number | null; date?: string | null; relative?: "yesterday" | "today" | "tonight" | "tomorrow" | null; originalPublishedAt?: string | null; timezone?: string | null; quotedTimeUnresolved?: boolean };

export function sourceLocalDate(timestamp: string | null | undefined, timezone: string | null | undefined): string | null {
  if (instant(timestamp) == null || !timezone) return null;
  try { return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(timestamp!)); }
  catch { return null; }
}

export function bindLineGame(input: BindingInput, games: LineGame[]) {
  const evidence: string[] = [];
  let date = input.date;
  if (input.quotedTimeUnresolved) return { gameId: null, status: "unresolved" as const, evidence: ["quoted_publication_time_unresolved"], resolverVersion: LINE_SELECTOR_VERSION, scheduleIdentity: null };
  if (input.relative) {
    const local = sourceLocalDate(input.originalPublishedAt, input.timezone);
    if (!local) return { gameId: null, status: "unresolved" as const, evidence: ["relative_date_timezone_unresolved"], resolverVersion: LINE_SELECTOR_VERSION, scheduleIdentity: null };
    const shifted = new Date(`${local}T12:00:00Z`);
    shifted.setUTCDate(shifted.getUTCDate() + (input.relative === "tomorrow" ? 1 : input.relative === "yesterday" ? -1 : 0));
    const relativeDate = shifted.toISOString().slice(0, 10);
    if (date && date !== relativeDate) return { gameId: null, status: "ambiguous" as const, evidence: ["conflicting_dates"], resolverVersion: LINE_SELECTOR_VERSION, scheduleIdentity: null };
    date = relativeDate; evidence.push(`source_timezone:${input.timezone}`, `relative_date:${input.relative}:${date}`);
  }
  const candidates = games.filter((game) => [game.homeTeamId, game.awayTeamId].includes(input.teamId)
    && (!input.gameId || game.id === input.gameId) && (!date || game.date === date)
    && (!input.opponentId || [game.homeTeamId, game.awayTeamId].includes(input.opponentId) && input.opponentId !== input.teamId));
  if (input.gameId) evidence.push(`explicit_game:${input.gameId}`);
  if (date && input.opponentId) evidence.push(`opponent_date:${input.opponentId}:${date}`);
  if (!input.gameId && !(date && input.opponentId) && !input.relative) return { gameId: null, status: "unresolved" as const, evidence: ["no_game_binding_evidence"], resolverVersion: LINE_SELECTOR_VERSION, scheduleIdentity: null };
  if (candidates.length !== 1) return { gameId: null, status: candidates.length > 1 ? "ambiguous" as const : "unresolved" as const, evidence: [...evidence, `candidate_count:${candidates.length}`], resolverVersion: LINE_SELECTOR_VERSION, scheduleIdentity: null };
  const game = candidates[0]!;
  return { gameId: game.id, status: "bound" as const, evidence: [...evidence, `team_participation:${input.teamId}`], resolverVersion: LINE_SELECTOR_VERSION, scheduleIdentity: game.scheduleIdentity };
}
