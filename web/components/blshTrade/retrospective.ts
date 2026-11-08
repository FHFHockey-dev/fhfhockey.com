/**
 * Retrospective fallback for the trade view: recorded FHFH Standard points per game from each
 * player's BLSH window. Recorded history, never a forward estimate; a missing player withholds the side.
 */
import type { DisplayProfile } from "lib/buyLowSellHigh/displayProfile";
import { FHFH_STANDARD_SCORING, type TradeScoring } from "lib/buyLowSellHigh/trade";

export type RetrospectivePlayer = {
  playerId: string; recordedPerGame: number | null; referencePerGame: number | null; games: number | null;
  freshnessText: string | null; reason: string | null;
};
type Side = { value: number | null; missingPlayerIds: string[] };
export type RetrospectiveComparison = {
  available: boolean; reason: string | null; players: RetrospectivePlayer[];
  give: Side; receive: Side;
  /** receive − give, recorded points per game. */
  net: number | null;
};

export function retrospectivePlayer(playerId: string, profile: DisplayProfile | undefined): RetrospectivePlayer {
  const none = (reason: string): RetrospectivePlayer => ({ playerId, recordedPerGame: null, referencePerGame: null, games: null, freshnessText: null, reason });
  if (!profile) return none("No BLSH evidence for this player");
  // The headline track is FHFH Standard points; it is null (never zero) when the track is missing.
  const headline = profile.score.headline;
  if (!headline) return none(profile.score.reasonText ?? "The FHFH Standard points track is unavailable");
  const games = profile.evidence.window.games;
  if (!(games > 0)) return none("The BLSH window has no recorded games");
  return { playerId, recordedPerGame: headline.observed / games, referencePerGame: headline.referenceAtCurrentTOI / games, games,
    freshnessText: profile.evidence.window.freshnessText, reason: null };
}

const isFhfhStandard = (scoring: TradeScoring) => scoring.mode === "points" && scoring.scoringBasis === FHFH_STANDARD_SCORING.scoringBasis;

export function retrospectiveComparison(give: string[], receive: string[], scoring: TradeScoring,
  evidence: Readonly<Record<string, DisplayProfile | undefined>>): RetrospectiveComparison {
  const players = [...give, ...receive].map(id => retrospectivePlayer(id, Object.prototype.hasOwnProperty.call(evidence, id) ? evidence[id] : undefined));
  let invalidReason: string | null = null;
  if (!give.length || !receive.length) invalidReason = "Add at least one player to each side of the trade.";
  else if (new Set(give).size !== give.length) invalidReason = "A player appears more than once on the give side.";
  else if (new Set(receive).size !== receive.length) invalidReason = "A player appears more than once on the receive side.";
  else if (give.some(id => receive.includes(id))) invalidReason = "A player appears on both sides of the trade.";
  if (invalidReason) return { available: false, reason: invalidReason, players,
    give: { value: null, missingPlayerIds: [] }, receive: { value: null, missingPlayerIds: [] }, net: null };
  const side = (ids: string[]): Side => {
    const rows = players.filter(player => ids.includes(player.playerId));
    const missing = rows.filter(player => player.recordedPerGame === null).map(player => player.playerId);
    return { value: !ids.length || missing.length ? null : rows.reduce((sum, player) => sum + player.recordedPerGame!, 0), missingPlayerIds: missing };
  };
  if (!isFhfhStandard(scoring)) return { available: false, players, give: side([]), receive: side([]), net: null,
    reason: "BLSH records FHFH Standard points only, so no retrospective comparison exists under this scoring." };
  const g = side(give), r = side(receive);
  const available = g.value !== null && r.value !== null;
  return { available, players, give: g, receive: r, net: available ? r.value! - g.value! : null,
    reason: available ? null : "A player on one side has no recorded BLSH track; that side's total is withheld." };
}
