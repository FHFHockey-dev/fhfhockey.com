import type { ProcessedPlayer } from "hooks/useProcessedProjectionsData";
import type { EspnDraftState } from "lib/integrations/espn/contracts";

export type EspnReconciledDraftedPlayer = {
  playerId: string;
  teamId: string;
  pickNumber: number;
  round: number;
  pickInRound: number;
  isKeeper?: boolean;
  source: "espn";
  espnSessionId: string;
  espnPlayerId: string;
  espnDisplayName: string;
  espnMappingStatus: "mapped" | "unresolved" | "review_required";
  auctionCost?: number | null;
};

export type EspnDraftReconciliation = {
  draftedPlayers: EspnReconciledDraftedPlayer[];
  unresolved: Array<{
    pickNumber: number;
    espnPlayerId: string;
    displayName: string;
    reason: string;
  }>;
  currentPick: number;
};

function firstMissingPick(picks: EspnDraftState["picks"]) {
  const numbers = new Set(picks.map((pick) => pick.pickNumber));
  let candidate = 1;
  while (numbers.has(candidate)) candidate += 1;
  return candidate;
}

export function reconcileEspnDraftState(
  state: EspnDraftState | null,
  players: ProcessedPlayer[],
): EspnDraftReconciliation {
  if (!state) return { draftedPlayers: [], unresolved: [], currentPick: 1 };
  const byNhlId = new Map(
    players.map((player) => [String(player.playerId), player] as const),
  );
  const draftedPlayers: EspnReconciledDraftedPlayer[] = [];
  const unresolved: EspnDraftReconciliation["unresolved"] = [];
  for (const pick of [...state.picks].sort(
    (left, right) => left.pickNumber - right.pickNumber,
  )) {
    const matched =
      pick.nhlPlayerId != null ? byNhlId.get(String(pick.nhlPlayerId)) : undefined;
    const reviewRequired = pick.mappingStatus === "review_required";
    const displayName =
      pick.playerName || `Unresolved ESPN player #${pick.externalPlayerId}`;
    if (!matched || reviewRequired) {
      unresolved.push({
        pickNumber: pick.pickNumber,
        espnPlayerId: pick.externalPlayerId,
        displayName,
        reason: reviewRequired
          ? "The stored identity requires review and was not applied automatically."
          : "No verified ESPN identity resolved to a projection player.",
      });
    }
    draftedPlayers.push({
      playerId:
        matched && !reviewRequired
          ? String(matched.playerId)
          : String(-1_000_000 - pick.pickNumber),
      teamId: pick.externalTeamKey,
      pickNumber: pick.pickNumber,
      round: pick.roundNumber,
      pickInRound: pick.pickInRound,
      isKeeper: pick.isKeeper,
      source: "espn",
      espnSessionId: state.session.id,
      espnPlayerId: pick.externalPlayerId,
      espnDisplayName: displayName,
      espnMappingStatus: reviewRequired
        ? "review_required"
        : matched
          ? "mapped"
          : "unresolved",
      auctionCost: pick.bidAmount,
    });
  }
  return {
    draftedPlayers,
    unresolved,
    currentPick: firstMissingPick(state.picks),
  };
}

export function espnDraftDashboardConfiguration(state: EspnDraftState) {
  const settings = state.league.settings;
  const draftOrder = settings.draftOrder;
  const teamNames = new Map(
    settings.teams.map((team) => [team.externalTeamKey, team.name]),
  );
  return {
    teamCount: settings.teamCount ?? draftOrder.length,
    draftOrder,
    customTeamNames: Object.fromEntries(
      draftOrder.map((teamKey) => [
        teamKey,
        teamNames.get(teamKey) ?? `ESPN Team ${teamKey}`,
      ]),
    ),
    myTeamId:
      settings.teams.find((team) => team.isOwned)?.externalTeamKey ??
      draftOrder[0] ??
      "Team 1",
    isSnakeDraft: settings.draftOrderType !== "straight",
    rosterConfig: settings.rosterConfig,
    leagueType: settings.leagueType,
    scoringCategories: settings.skaterScoringCategories,
    goalieScoringCategories: settings.goalieScoringCategories,
    categoryWeights: settings.categoryWeights,
  };
}
