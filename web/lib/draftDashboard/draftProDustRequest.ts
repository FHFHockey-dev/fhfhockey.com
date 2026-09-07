import type { ProcessedPlayer } from "hooks/useProcessedProjectionsData";
import type { PlayerVorpMetrics } from "hooks/useVORPCalculations";
import type { DraftProDustRequestInput } from "hooks/useDraftProDust";
import {
  groupPlayerEligibility,
  normalizePlayerEligibility,
  type ForwardGrouping,
} from "./forwardGrouping";

export function buildDraftProDustRequest({
  season,
  lineupMode,
  sort,
  inputOrigin,
  allPlayers,
  availablePlayers,
  rosterAssignments,
  myTeamId,
  forwardGrouping,
  vorpMetrics,
  rosterSlots,
}: {
  season: string | null;
  lineupMode: "daily" | "weekly";
  sort: "ordinary" | "schedule_fit";
  inputOrigin: "draft" | "private_import";
  allPlayers: readonly ProcessedPlayer[];
  availablePlayers: readonly ProcessedPlayer[];
  rosterAssignments: readonly { playerId: string; teamId: string }[];
  myTeamId: string;
  forwardGrouping: ForwardGrouping;
  vorpMetrics: ReadonlyMap<string, PlayerVorpMetrics>;
  rosterSlots: Readonly<Record<string, number>>;
}): DraftProDustRequestInput | null {
  if (!season) return null;
  const toDustPlayer = (player: ProcessedPlayer) => ({
    id: String(player.playerId),
    name: player.fullName || undefined,
    teamAbbreviation: player.displayTeam || null,
    eligiblePositions: groupPlayerEligibility(
      normalizePlayerEligibility(player.displayPosition, player.eligiblePositions),
      forwardGrouping,
    ),
    value: vorpMetrics.get(String(player.playerId))?.value ?? player.fantasyPoints.projected ?? 0,
    available: true,
    projectionSeason: season,
  });
  const playerById = new Map(allPlayers.map((player) => [String(player.playerId), player]));
  const roster = rosterAssignments.flatMap((assignment) => {
    if (assignment.teamId !== myTeamId) return [];
    const player = playerById.get(assignment.playerId);
    return player ? [{ ...toDustPlayer(player), available: false }] : [];
  });
  return {
    season,
    lineupMode,
    sort,
    inputOrigin,
    privateImportAccountSaved: false,
    startWeek: 1,
    endWeek: 30,
    roster,
    candidates: availablePlayers
      .slice()
      .sort((left, right) => {
        const byValue = (vorpMetrics.get(String(right.playerId))?.value ?? right.fantasyPoints.projected ?? 0) - (vorpMetrics.get(String(left.playerId))?.value ?? left.fantasyPoints.projected ?? 0);
        return byValue || String(left.playerId).localeCompare(String(right.playerId));
      })
      .slice(0, 500)
      .map(toDustPlayer),
    rosterSlots,
  };
}
