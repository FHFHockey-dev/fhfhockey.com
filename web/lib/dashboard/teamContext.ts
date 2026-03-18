import type { NormalizedStartChartGameRow, NormalizedCtpiTeamRow } from "./normalizers";
import { getTeamMetaById } from "./teamMetadata";

export type TeamPowerSnapshotLike = {
  offRating: number | null;
  defRating: number | null;
  paceRating: number | null;
  ppTier: number | null;
  pkTier: number | null;
  trend10: number | null;
};

export type TeamPowerSnapshot = {
  offRating: number;
  defRating: number;
  paceRating: number;
  ppTier: number | null;
  pkTier: number | null;
  trend10: number;
};

export type TeamMatchupEdge = {
  opponentAbbr: string;
  edge: number;
};

const SPECIAL_TEAM_STEP = 1.5;

export const normalizeSpecialTeamTier = (value: number | null | undefined): 1 | 2 | 3 => {
  if (value === 1 || value === 2 || value === 3) return value;
  return 2;
};

export const computeTeamPowerScore = (team: TeamPowerSnapshotLike): number => {
  const base =
    ((team.offRating ?? 0) + (team.defRating ?? 0) + (team.paceRating ?? 0)) / 3;
  const ppAdj = (3 - normalizeSpecialTeamTier(team.ppTier)) * SPECIAL_TEAM_STEP;
  const pkAdj = (3 - normalizeSpecialTeamTier(team.pkTier)) * SPECIAL_TEAM_STEP;
  return base + ppAdj + pkAdj;
};

export const computeCtpiDelta = (
  row: Pick<NormalizedCtpiTeamRow, "ctpi_0_to_100" | "sparkSeries">
): number | null => {
  if (row.sparkSeries.length < 2) return null;
  const first = row.sparkSeries[0]?.value ?? row.ctpi_0_to_100;
  const last =
    row.sparkSeries[row.sparkSeries.length - 1]?.value ?? row.ctpi_0_to_100;
  return last - first;
};

export const buildSlateMatchupEdgeMap = (
  games: NormalizedStartChartGameRow[]
): Map<string, TeamMatchupEdge> => {
  const matchupByTeam = new Map<string, TeamMatchupEdge>();

  games.forEach((game) => {
    const home = getTeamMetaById(game.homeTeamId)?.abbr ?? null;
    const away = getTeamMetaById(game.awayTeamId)?.abbr ?? null;
    if (!home || !away || !game.homeRating || !game.awayRating) return;

    const homePower = computeTeamPowerScore(game.homeRating);
    const awayPower = computeTeamPowerScore(game.awayRating);

    matchupByTeam.set(home, { opponentAbbr: away, edge: homePower - awayPower });
    matchupByTeam.set(away, { opponentAbbr: home, edge: awayPower - homePower });
  });

  return matchupByTeam;
};

export const getGamePowerEdge = (
  game: Pick<NormalizedStartChartGameRow, "homeRating" | "awayRating">
): number | null => {
  if (!game.homeRating || !game.awayRating) return null;
  return computeTeamPowerScore(game.homeRating) - computeTeamPowerScore(game.awayRating);
};
