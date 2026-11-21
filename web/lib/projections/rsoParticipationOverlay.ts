import type { SupabaseClient } from "@supabase/supabase-js";
import type { DailyBoardEvidence } from "./dailyBoardEvidence";
import { acceptedNewsSupersedes } from "./evidenceTime";

/**
 * Detailed RSO read-time availability overlay (TJ 2026-11-21, rev 2). The issued FORGE row is never changed: it keeps its
 * "if he plays" line, its issued coverage state (injury history, IR designation), revision and timestamps. At read time
 * the overlay replays each later availability change from immutable, timestamped sources (roster events, official
 * appearances, accepted game-specific news), newest last, and reports each one separately. Nothing here runs FORGE.
 */
export type RsoParticipationBasis = "confirmed_playing" | "confirmed_out" | "assumed_playing" | "assumed_out";
export type OverlayRosterEvent = { event_id: number; team_id: number | null; player_id: number | null; event_type: string;
  effective_from: string; effective_to: string | null; payload: Record<string, unknown> | null };
export type OverlayAppearance = { id: number; player_id: number; date: string; games_played: number | null; toi_per_game: number | null };
export type RsoParticipationSources = { readAt: string; rosterEvents: OverlayRosterEvent[]; appearances: OverlayAppearance[];
  news: DailyBoardEvidence };
export type OverlayChange = { at: string; source: string; effect: RsoParticipationBasis | "no_change"; detail: string };
export type OverlayResult = { basis: RsoParticipationBasis; changes: OverlayChange[]; conflict: boolean; lineRoleChanged: boolean };

export const INJURY_EVENTS = new Set(["DTD", "INJURY_OUT", "INJURY_IR", "IR", "LTIR"]);
const EXCLUSION_EVENTS = new Set(["SCRATCH", "SUSPENSION", "NON_ROSTER", "SENDDOWN"]);
const COVERAGE_STATES = new Set(["projected_lineup", "confirmed_out", "uncertain", "unknown"]);
/** How far back official appearances are read: the latest appearance after an injury is all the overlay needs. */
export const RSO_APPEARANCE_LOOKBACK_DAYS = 60;
const MAX_ROSTER_EVENTS = 5000, MAX_APPEARANCES = 20000;

const after = (value: string, than: string | null) => than === null || acceptedNewsSupersedes(value, than);
const onOrBefore = (value: string, than: string) => !acceptedNewsSupersedes(value, than);
const projectedReturn = (event: OverlayRosterEvent) =>
  [event.payload?.subcategory, event.payload?.category].some(value => typeof value === "string" && /PROJECTED/i.test(value));
/** A wgo row is stamped by date only; it stands for the end of that day so same-day reports sort before it. */
const appearanceTime = (date: string) => `${date}T23:59:59Z`;

/**
 * Replays availability for one skater and one target game. Null when the issued row carries no valid coverage state
 * (no roster status to start from); the caller then keeps the decision 3/47 default.
 */
export function applyRsoParticipationOverlay(args: {
  coverage: any; playerNhlId: number; teamId: number; gameId: number; gameDate: string; gameStartsAt: string;
  revisionCutoff: string; teamGameStarts: readonly string[]; sources: RsoParticipationSources;
}): OverlayResult | null {
  const { coverage, playerNhlId, teamId, gameId, gameDate, gameStartsAt, revisionCutoff, sources } = args;
  if (coverage?.version !== "forge-skater-coverage-v1" || coverage.game_id !== gameId || coverage.line_conditioning !== "if_plays"
    || !COVERAGE_STATES.has(coverage.state)) return null;
  const mine = (event: OverlayRosterEvent) => event.player_id === playerNhlId && (event.team_id === null || event.team_id === teamId);
  const baseType = typeof coverage.event_type === "string" ? coverage.event_type as string : null;
  const baseEvent = coverage.event_id != null ? sources.rosterEvents.find(event => event.event_id === coverage.event_id && mine(event)) : undefined;
  // Base: the issued roster status. A RETURN on the issued row is itself replayed below; until then the injury it
  // reports on stands. When the issued event cannot be found, only changes after the revision cutoff can move it.
  let basis: RsoParticipationBasis, cause: "injury" | "exclusion" | null = null, baseAt: string | null;
  if (baseType && (INJURY_EVENTS.has(baseType) || baseType === "RETURN")) { basis = "assumed_out"; cause = "injury"; }
  else if (baseType && EXCLUSION_EVENTS.has(baseType) && coverage.state === "confirmed_out") { basis = "confirmed_out"; cause = "exclusion"; }
  else basis = "assumed_playing";
  baseAt = cause ? baseEvent?.effective_from ?? revisionCutoff : null;
  // A RETURN base reports on an earlier injury: its time bounds which reports could clear it.
  if (baseType === "RETURN") {
    const injury = baseEvent && sources.rosterEvents.filter(event => mine(event) && INJURY_EVENTS.has(event.event_type)
      && !acceptedNewsSupersedes(event.effective_from, baseEvent.effective_from))
      .sort((a, b) => acceptedNewsSupersedes(a.effective_from, b.effective_from) ? -1 : 1)[0];
    baseAt = injury?.effective_from ?? baseEvent?.effective_from ?? revisionCutoff;
  }

  type Item = { at: string; order: number; source: string; apply: () => { effect: RsoParticipationBasis | "no_change"; detail: string } | null };
  const items: Item[] = [];
  let lineRoleChanged = false, conflict = false;
  const set = (next: RsoParticipationBasis, nextCause: typeof cause, detail: string) => { basis = next; cause = nextCause; return { effect: next, detail }; };

  for (const event of sources.rosterEvents) {
    // Roster events up to the revision cutoff are already in the issued base; only later ones replay, plus a RETURN
    // base itself.
    const baseReturn = baseType === "RETURN" && event.event_id === baseEvent?.event_id;
    if (!mine(event) || event.event_id === baseEvent?.event_id && !baseReturn) continue;
    if (!baseReturn && !acceptedNewsSupersedes(event.effective_from, revisionCutoff)) continue;
    if (!onOrBefore(event.effective_from, gameStartsAt)) continue;
    // An expired event no longer applies (the producer drops it the same way).
    if (event.effective_to !== null && acceptedNewsSupersedes(gameStartsAt, event.effective_to)) continue;
    const type = event.event_type, source = `roster event ${event.event_id} (${type})`;
    if ((type === "LINE_CHANGE" || type === "PP_UNIT_CHANGE") && acceptedNewsSupersedes(event.effective_from, revisionCutoff)) {
      lineRoleChanged = true; continue;
    }
    items.push({ at: event.effective_from, order: 0, source, apply: () => {
      if (INJURY_EVENTS.has(type)) return set("assumed_out", "injury", "injury reported; assumed out until a confirmed return");
      if (type === "SCRATCH") return event.payload?.game_id === gameId ? set("confirmed_out", "exclusion", "scratched for this game") : null;
      if (EXCLUSION_EVENTS.has(type)) return set("confirmed_out", "exclusion", `${type.toLowerCase().replace("_", "-")}: excluded`);
      if (type === "CALLUP") return cause === "exclusion" ? set("assumed_playing", null, "called up to the active roster") : null;
      if (type !== "RETURN") return null;
      if (projectedReturn(event)) return { effect: "no_change", detail: "possible return reported; does not clear the injury" };
      // A confirmed return speaks for the team's first game after the report only.
      const earlier = args.teamGameStarts.some(start => acceptedNewsSupersedes(start, event.effective_from) && acceptedNewsSupersedes(gameStartsAt, start));
      return earlier ? { effect: "no_change", detail: "confirmed return applies to an earlier game only" }
        : set("confirmed_playing", null, "confirmed back in the lineup for this game");
    } });
  }
  for (const row of sources.appearances) {
    const played = (row.games_played ?? 0) > 0 || (row.toi_per_game ?? 0) > 0;
    // Future games only: an appearance never changes the forecast of its own game or an earlier one.
    if (row.player_id !== playerNhlId || !played || !(row.date < gameDate)) continue;
    const at = appearanceTime(row.date);
    if (!after(at, baseAt)) continue;
    items.push({ at, order: 2, source: `official appearance ${row.date} (wgo_skater_stats ${row.id})`, apply: () =>
      cause === "injury" ? set("assumed_playing", null, "played after the injury; assumed playing for later games") : null });
  }
  for (const item of sources.news.assertions) {
    if (item.gameId !== gameId || item.teamId !== teamId || item.playerId !== playerNhlId) continue;
    const source = `accepted news ${item.evidenceId} (${item.dimension}:${item.value}${item.confirmed ? ", confirmed" : ""})`;
    if ((item.dimension === "ev" || item.dimension === "pp") && !item.confirmed && acceptedNewsSupersedes(item.publishedAt, revisionCutoff)) lineRoleChanged = true;
    if (!after(item.publishedAt, baseAt)) {
      const clears = item.confirmed && (item.dimension === "ev" || item.dimension === "availability" && item.value === "return");
      if (clears && cause) items.push({ at: item.publishedAt, order: 1, source, apply: () =>
        ({ effect: "no_change", detail: "older than the injury it would clear; ignored" }) });
      continue;
    }
    items.push({ at: item.publishedAt, order: 1, source, apply: () => {
      if (!item.confirmed) return null;
      if (item.dimension === "ev" || item.dimension === "availability" && item.value === "return") {
        return set("confirmed_playing", null, "confirmed in this game's lineup");
      }
      if (item.dimension === "availability" && item.value === "out") return set("confirmed_out", "exclusion", "ruled out of this game");
      return null;
    } });
  }
  conflict = sources.news.conflicts.some(item => item.gameId === gameId && item.teamId === teamId
    && (item.playerId === null || item.playerId === playerNhlId) && (item.dimension === "ev" || item.dimension === "availability"));

  const changes: OverlayChange[] = [];
  items.sort((a, b) => acceptedNewsSupersedes(a.at, b.at) ? 1 : acceptedNewsSupersedes(b.at, a.at) ? -1 : a.order - b.order);
  for (const item of items) {
    const applied = item.apply();
    if (applied) changes.push({ at: item.at, source: item.source, ...applied });
  }
  return { basis, changes, conflict, lineRoleChanged };
}

type Db = SupabaseClient<any>;
async function pagedRead<T>(label: string, maximum: number, deadlineMs: number,
  query: (from: number, to: number, signal: AbortSignal) => PromiseLike<{ data: unknown; error: unknown; count: number | null }>): Promise<T[]> {
  const rows: T[] = [];
  let total: number | null = null;
  do {
    const remaining = deadlineMs - Date.now();
    if (remaining <= 0) throw new Error(`${label} read exceeded its deadline`);
    const response = await query(rows.length, rows.length + 499, AbortSignal.timeout(Math.ceil(remaining)));
    if (response.error || !Array.isArray(response.data) || !Number.isSafeInteger(response.count) || response.count! > maximum
      || total !== null && response.count !== total || !response.data.length && response.count! > rows.length) {
      throw new Error(`${label} read is incomplete`);
    }
    total = response.count!;
    rows.push(...response.data as T[]);
  } while (rows.length < total);
  return rows;
}

/** Bounded read of every overlay source as of `readAt`. Throws when any source is incomplete: the caller then withholds
 * the affected rows rather than serve an assumption a late scratch may already have overturned. */
export async function loadRsoParticipationSources(db: Db, args: { gameIds: number[]; playerNhlIds: number[]; readAt: string;
  deadlineMs: number }): Promise<RsoParticipationSources> {
  const players = [...new Set(args.playerNhlIds)].sort((a, b) => a - b);
  const gameIds = [...new Set(args.gameIds)].sort((a, b) => a - b);
  if (players.length > 2000 || players.some(id => !Number.isSafeInteger(id) || id <= 0)) throw new Error("Invalid overlay scope");
  // Imported lazily: the evidence module binds the server client at import time.
  const { loadDailyBoardEvidence } = await import("./dailyBoardEvidence");
  const news = gameIds.length ? await loadDailyBoardEvidence(gameIds, args.readAt, db as never) : { assertions: [], conflicts: [] };
  const since = new Date(Date.parse(args.readAt) - RSO_APPEARANCE_LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 10);
  const rosterEvents: OverlayRosterEvent[] = [], appearances: OverlayAppearance[] = [];
  for (let start = 0; start < players.length; start += 100) {
    const batch = players.slice(start, start + 100);
    rosterEvents.push(...await pagedRead<OverlayRosterEvent>("Roster events", MAX_ROSTER_EVENTS, args.deadlineMs, (from, to, signal) =>
      db.from("forge_roster_events").select("event_id,team_id,player_id,event_type,effective_from,effective_to,payload", { count: "exact" })
        .in("player_id", batch).lte("created_at", args.readAt).lte("effective_from", args.readAt)
        .order("event_id").range(from, to).abortSignal(signal)));
    appearances.push(...await pagedRead<OverlayAppearance>("Official appearances", MAX_APPEARANCES, args.deadlineMs, (from, to, signal) =>
      db.from("wgo_skater_stats").select("id,player_id,date,games_played,toi_per_game", { count: "exact" })
        .in("player_id", batch).gte("date", since).lte("date", args.readAt.slice(0, 10))
        .order("id").range(from, to).abortSignal(signal)));
  }
  return { readAt: args.readAt, rosterEvents, appearances, news };
}
