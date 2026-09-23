import type { ProcessedPlayer } from "hooks/useProcessedProjectionsData";
import type { FantraxDraftState } from "lib/integrations/fantrax/contracts";

export function reconcileFantraxDraftState(
  state: FantraxDraftState | null,
  players: ProcessedPlayer[],
  localDraftOrder: string[],
) {
  if (!state) return { draftedPlayers: [], unresolved: [], currentPick: 1, nextTeamId: null, nextRound: null, nextPickInRound: null, nextPickByTeam: {}, safe: false };
  const safe = state.draftOrder.length === localDraftOrder.length &&
    state.draftOrder.length > 0 && new Set(state.draftOrder).size === state.draftOrder.length;
  const byNhlId = new Set(players.map((player) => String(player.playerId)));
  const teamByFantraxId = new Map(state.draftOrder.map((id, index) => [id, localDraftOrder[index]]));
  const unresolved: Array<{ pickNumber: number; playerId: string }> = [];
  const draftedPlayers = safe ? state.picks.flatMap((pick) => {
    const teamId = teamByFantraxId.get(pick.teamId);
    if (!teamId) return [];
    const matched = pick.nhlPlayerId != null && byNhlId.has(String(pick.nhlPlayerId));
    if (!matched) unresolved.push({ pickNumber: pick.pickNumber, playerId: pick.playerId });
    return [{
      playerId: matched ? String(pick.nhlPlayerId) : String(-2_000_000 - pick.pickNumber),
      teamId,
      pickNumber: pick.pickNumber,
      round: pick.roundNumber,
      pickInRound: pick.pickInRound,
      source: "fantrax" as const,
      fantraxPlayerId: pick.playerId,
      fantraxDisplayName: matched ? "" : `Fantrax player ${pick.playerId}`,
      fantraxMappingStatus: matched ? "mapped" as const : "unresolved" as const,
    }];
  }) : [];
  const completed = new Set(state.picks.map((pick) => pick.pickNumber));
  let currentPick = 1;
  while (completed.has(currentPick)) currentPick += 1;
  const nextSlot = state.slots.find((slot) => slot.pickNumber === currentPick);
  const nextPickByTeam = safe ? Object.fromEntries(state.draftOrder.map((externalId, index) => [
    localDraftOrder[index],
    state.slots.find((slot) => slot.pickNumber >= currentPick && slot.teamId === externalId && slot.playerId === null)?.pickNumber ?? Infinity,
  ])) : {};
  return {
    draftedPlayers,
    unresolved,
    currentPick,
    nextTeamId: safe && nextSlot ? teamByFantraxId.get(nextSlot.teamId) ?? null : null,
    nextRound: safe && nextSlot ? nextSlot.roundNumber : null,
    nextPickInRound: safe && nextSlot ? nextSlot.pickInRound : null,
    nextPickByTeam,
    safe,
  };
}
