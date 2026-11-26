import type { OfficialPowerPlayEvidence } from "./officialPowerPlay";
import type { PenaltyClue } from "./ppClue";
import { instant, type LineClaim, type LineGame } from "./types";

export type PPCorroboration =
  /** `metadata` is stored with the binding but kept out of the claim ID (it can change as the report fills in). */
  | { status: "bound"; gameId: number; scheduleIdentity: string; evidence: string[]; metadata?: string[] }
  | { status: "unresolved" | "pending"; evidence: string[] };

const SLACK_MS = 60_000;
/** A claim the binder may consider: an explicitly numbered, resolved, in-game PP five with a verified original time, still unbound. */
export function qualifiesForPPCorroboration(claim: LineClaim): boolean {
  const unit = claim.unit;
  // Phase "unknown" with no stated context qualifies: TJ 2026-11-25, session context comes from timing (in game = confirmed).
  const timedPhase = claim.phase === "in_game" || claim.phase === "unknown" && (claim.context == null || claim.context === "game");
  return claim.kind === "pp" && timedPhase && claim.binding.status === "unresolved" && claim.gameId == null
    && claim.identityStatus === "resolved_at_event" && !!unit && unit.situation === "pp" && unit.explicitNumber && (unit.number === 1 || unit.number === 2)
    && unit.group == null && unit.players.length === 5 && unit.players.every((player) => Number.isSafeInteger(player.playerId) && player.playerId > 0)
    && new Set(unit.players.map((player) => player.playerId)).size === 5 && instant(claim.time.originalPublishedAt) != null
    // A relay's own post clock is never the original's publication time.
    && !claim.publicationEvidence?.includes("relay_own_post_clock") && claim.provenance?.attributionStatus !== "pending";
}
const clockSeconds = (value: string) => { const [m, s] = value.split(":").map(Number); return (m ?? NaN) * 60 + (s ?? NaN); };
const infractionMatches = (clue: string, descKey: string) => descKey === clue || descKey.startsWith(clue + "-");

/**
 * Bind an in-game PP report to its game. With a penalty clue in the original (optional extra evidence), the clue must match
 * exactly one NHL power-play opportunity and the five must be on the ice at a faceoff inside it. Without one, the
 * post must fall inside an official period and the five must be on the team's power play together in that game (bindByPeriodTime). The reporter's number stands; NHL data
 * only verifies personnel. The result depends only on the evidence (no read clock), so identical evidence gives an identical result.
 */
export function corroborateInGamePP(
  claim: LineClaim,
  games: LineGame[],
  evidence: (gameId: number) => OfficialPowerPlayEvidence | null,
  clue: PenaltyClue | null | ((gameId: number) => PenaltyClue | null),
): PPCorroboration {
  if (!qualifiesForPPCorroboration(claim)) return { status: "unresolved", evidence: ["not_qualifying"] };
  const published = instant(claim.time.originalPublishedAt)!;
  // 1. Exactly one team game live at the original publication time (official anchors or stored actual start; never scheduled).
  const live: LineGame[] = [];
  let unknownGame = false;
  for (const game of games.filter((candidate) => [candidate.homeTeamId, candidate.awayTeamId].includes(claim.teamId) && candidate.phase !== "postponed")) {
    const official = game.actualStart == null || game.phase === "final" ? evidence(game.id) : null;
    const anchor = official?.periods.find((period) => period.period === 1)?.startedAt;
    const puckDrop = instant(game.actualStart) ?? (anchor ? instant(anchor) : null);
    if (puckDrop == null) { if (game.phase === "live" || game.phase === "final") unknownGame = true; continue; }
    if (puckDrop > published) continue;
    const ended = official?.gameEndedAt ? instant(official.gameEndedAt)! + SLACK_MS : game.phase === "live" ? Infinity : null;
    if (ended == null) { unknownGame = true; continue; }
    if (published <= ended) live.push(game);
  }
  if (live.length !== 1) return unknownGame && !live.length ? { status: "pending", evidence: ["nhl_corroboration_pending"] } : { status: "unresolved", evidence: [`live_game_count:${live.length}`] };
  const game = live[0]!;
  // 2–3. NHL data for that game, then the clue (read on that game's roster).
  const official = evidence(game.id);
  if (!official) return { status: "pending", evidence: ["nhl_corroboration_pending"] };
  const specific = typeof clue === "function" ? clue(game.id) : clue;
  if (!specific) return bindByPeriodTime(claim, game, official, published);
  const teamObservations = official.observations.filter((item) => item.teamId === claim.teamId);
  if (!teamObservations.length) return { status: "pending", evidence: ["nhl_corroboration_pending"] };
  // Earliest possible wall time of a clock event (official period start + elapsed − 60 s); null without that period's anchor.
  const earliestAt = (period: number, elapsed: string) => {
    const start = official.periods.find((item) => item.period === period)?.startedAt;
    return start ? instant(start)! + clockSeconds(elapsed) * 1000 - SLACK_MS : null;
  };
  // 4. Exactly one opponent penalty fits every named part of the clue. A penalty that cannot precede the post is not its clue,
  // so a later pass over a fuller report gives the same answer.
  const penalties = official.penalties.filter((penalty) => (earliestAt(penalty.period, penalty.elapsed) ?? -Infinity) <= published
    && penalty.penalizedTeamId !== claim.teamId
    && (specific.committedByPlayerId == null || penalty.committedByPlayerId === specific.committedByPlayerId)
    && (specific.drawnByPlayerId == null || penalty.drawnByPlayerId === specific.drawnByPlayerId)
    && (specific.infraction == null || infractionMatches(specific.infraction, penalty.infraction)));
  if (penalties.length !== 1) return { status: "unresolved", evidence: [`clue_match_count:${penalties.length}`] };
  const penalty = penalties[0]!;
  // 5. The opportunity's span from play-by-play strength.
  const span = official.opportunities.find((item) => item.penaltyEventId === penalty.eventId && item.beneficiaryTeamId === claim.teamId);
  if (!span || span.endedBy === "unknown") return { status: "pending", evidence: ["opportunity_end_unknown"] };
  // 6. The reported five together at a faceoff inside that span.
  const five = new Set(claim.unit!.players.map((player) => player.playerId));
  const faceoffs = new Set(official.faceoffEventIds);
  const matched = teamObservations.filter((item) => item.order > span.fromOrder && item.order < span.toOrder && faceoffs.has(item.eventId)
    && item.players.length === 5 && item.players.every((player) => five.has(player.playerId)))
    .sort((a, b) => a.order - b.order);
  if (!matched.length) return { status: "unresolved", evidence: ["five_not_on_ice"] };
  // 7. The earliest matched faceoff could have happened before publication (anchor + elapsed − 60 s). Ordering stays unverified (P2).
  const earliest = matched[0]!;
  const earliestWall = earliestAt(earliest.period, earliest.elapsed);
  if (earliestWall == null) return { status: "pending", evidence: ["period_anchor_missing"] };
  if (earliestWall > published) return { status: "unresolved", evidence: ["faceoff_after_publication"] };
  // 8. Bound. Only faceoffs that could precede the post are listed, so a fuller report later keeps the same evidence.
  const listed = matched.filter((item) => (earliestAt(item.period, item.elapsed) ?? Infinity) <= published);
  return { status: "bound", gameId: game.id, scheduleIdentity: game.scheduleIdentity, evidence: [
    `live_game:${game.id}`, `nhl_penalty:${penalty.eventId}`, ...listed.map((item) => `nhl_pp_faceoff:${item.eventId}`),
    `nhl_report:${earliest.sourceUrl.replace(/#.*$/, "")}`, "faceoff_before_publication:unverified"] };
}

/**
 * TJ 2026-11-25: no clue needed. The original publication time falls inside an official period of the team's one live game
 * (PSTR/PEND anchors, minute precision, never the scheduled start) and the official on-ice report has the exact five together
 * on the team's power play in that game. Only on-ice events that could precede the post are listed (else the earliest one),
 * so a fuller report later gives the same result. NHL data verifies personnel only; the reporter's number stands.
 */
function bindByPeriodTime(claim: LineClaim, game: LineGame, official: OfficialPowerPlayEvidence, published: number): PPCorroboration {
  const anchored = official.periods.filter((period) => instant(period.startedAt) != null).sort((a, b) => a.period - b.period);
  if (!anchored.length) return { status: "pending", evidence: ["period_anchor_missing"] };
  // An anchor is the minute the event happened in: the period surely started by start + 60 s and surely ran until its end anchor.
  const last = anchored.at(-1)!;
  const open = (period: (typeof anchored)[number]) => period === last && period.endedAt == null && official.gameEndedAt == null && game.phase === "live";
  const inside = anchored.find((period) => instant(period.startedAt)! + SLACK_MS <= published
    && (period.endedAt != null ? published <= instant(period.endedAt)! : open(period)));
  if (!inside) {
    const unknownEnd = anchored.some((period) => period.endedAt == null && !open(period) && instant(period.startedAt)! <= published);
    return unknownEnd ? { status: "pending", evidence: ["period_end_unknown"] } : { status: "unresolved", evidence: ["publication_outside_period"] };
  }
  const five = new Set(claim.unit!.players.map((player) => player.playerId));
  const matched = official.observations.filter((item) => item.teamId === claim.teamId && item.players.length === 5 && item.players.every((player) => five.has(player.playerId)))
    .sort((a, b) => a.order - b.order);
  // A live report can still be catching up; a final one cannot.
  if (!matched.length) return game.phase === "live" ? { status: "pending", evidence: ["nhl_corroboration_pending"] } : { status: "unresolved", evidence: ["five_not_on_ice"] };
  const startOf = (period: number) => instant(official.periods.find((item) => item.period === period)?.startedAt);
  const earliestAt = (period: number, elapsed: string) => { const start = startOf(period); return start == null ? Infinity : start + clockSeconds(elapsed) * 1000 - SLACK_MS; };
  const before = matched.filter((item) => earliestAt(item.period, item.elapsed) <= published);
  const listed = before.length ? before : matched.slice(0, 1);
  return { status: "bound", gameId: game.id, scheduleIdentity: game.scheduleIdentity, evidence: [
    `live_game:${game.id}`, "binding_basis:period_time", `nhl_period:${inside.period}:${inside.startedAt}`,
    ...listed.map((item) => `nhl_pp_on_ice:${item.eventId}`), `nhl_report:${listed[0]!.sourceUrl.replace(/#.*$/, "")}`,
    "personnel_verified_no_penalty_clue", "faceoff_before_publication:unverified"],
  metadata: [`nhl_period_window:${inside.period}:${inside.startedAt}/${inside.endedAt ?? "open"}`] };
}
