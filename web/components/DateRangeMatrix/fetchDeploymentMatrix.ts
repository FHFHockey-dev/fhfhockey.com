import type { AggregatedMatrixPlayers } from "./fetchAggregatedData";
import type { DeploymentMatrixResponse } from "lib/drm/types";
import type { MatrixStrength } from "lib/drm/observedDeployment";

export type DeploymentMatrixResult = Omit<DeploymentMatrixResponse, "byStrength"> & {
  byStrength: Record<MatrixStrength, AggregatedMatrixPlayers>;
};

export async function fetchDeploymentMatrix(args: {
  teamId: number;
  seasonId: number;
  startDate: string;
  endDate: string;
  seasonType: "regularSeason" | "playoffs";
  homeOrAway: "home" | "away" | "";
  opponentTeamAbbreviation: string;
}): Promise<DeploymentMatrixResult> {
  const { opponentTeamAbbreviation, ...scope } = args;
  const query = new URLSearchParams(Object.entries({ ...scope, opponent: opponentTeamAbbreviation }).map(([key, value]) => [key, String(value)]));
  const response = await fetch(`/api/v1/drm?${query}`);
  if (!response.ok) throw new Error("Unable to load qualified matrix data.");
  const result: DeploymentMatrixResponse = await response.json();
  const byStrength = Object.fromEntries(Object.entries(result.byStrength).map(([strength, players]) => [strength,
    Object.fromEntries(Object.entries(players).map(([id, player]) => [id, {
      ...player,
      regularSeasonData: { ...player.regularSeasonData, gamesPlayed: new Set(player.regularSeasonData.gamesPlayed) },
      playoffData: { ...player.playoffData, gamesPlayed: new Set(player.playoffData.gamesPlayed) },
    }])),
  ])) as DeploymentMatrixResult["byStrength"];
  return { ...result, byStrength };
}
