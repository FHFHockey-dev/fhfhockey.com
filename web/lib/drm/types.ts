import type { AggregatedMatrixPlayer, AggregatedMatrixSeasonData, ScopedCardStats } from "components/DateRangeMatrix/fetchAggregatedData";
import type { MatrixStrength, ObservedDeploymentUnit } from "./observedDeployment";

type WireSeason = Omit<AggregatedMatrixSeasonData, "gamesPlayed"> & { gamesPlayed: number[] };
export type WireMatrixPlayer = Omit<AggregatedMatrixPlayer, "regularSeasonData" | "playoffData"> & {
  regularSeasonData: WireSeason;
  playoffData: WireSeason;
};
export type MatrixGameCoverage = {
  gameId: number;
  date: string;
  state: "accepted" | "notFinal" | "unverified" | "missing" | "stale" | "invalid";
  reason: string;
  verifiedZeroToiPlayers?: number[];
};
export type DeploymentMatrixResponse = {
  byStrength: Record<MatrixStrength, Record<number, WireMatrixPlayer>>;
  units: ObservedDeploymentUnit[];
  matchedGameIds: number[];
  cardStats: ScopedCardStats;
  checkedAt: string;
  coverage: {
    inputRows: number;
    rosterRows: number;
    skippedRows: number;
    scheduledGames: number;
    knownFinalGames: number;
    acceptedGames: number;
    games: MatrixGameCoverage[];
    unrepresentedFiveOnFiveSeconds: number;
    excludedSpecialTeamsSeconds: number;
  };
};
