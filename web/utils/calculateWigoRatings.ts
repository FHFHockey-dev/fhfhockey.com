// web/utils/calculateWigoRatings.ts (or similar file)

import {
  PlayerStrengthStats,
  RawStatsCollection,
  Strength,
  CalculatedPlayerRatings,
  RatingWeightsConfig,
  RegressionConfig
} from "components/WiGO/types"; // Adjust path
import {
  RATING_WEIGHTS,
  REGRESSION_CONFIG
} from "components/WiGO/ratingWeights"; // Adjust path
import {
  buildPercentileLookup,
  calculateRankingResult
} from "./calculatePercentiles";

// --- Helper: Apply Regression ---
// (Keep this function as is - it receives the threshold)
function applyRegression(
  playerValue: number, // The value being regressed (in our case, the percentile)
  playerGP: number,
  regressionMean: number, // Mean value for players below threshold for THIS STAT
  gpThreshold: number // The threshold (now dynamic)
): number {
  // Formula: M’ = (GP * M + (P – GP) * mM) / P
  const regressedValue =
    (playerGP * playerValue + (gpThreshold - playerGP) * regressionMean) /
    gpThreshold;
  // Clamp the regressed value between 0 and 100 as it's applied to percentiles
  return Math.max(0, Math.min(100, regressedValue));
}

interface ComparisonRow {
  player_id: number;
  gp: number;
  value: number;
}

export type WigoPositionGroup = "F" | "D";

/** Forward or defenseman from a WGO position code; null when unknown or a goalie. */
export function wigoPositionGroup(code: string | null | undefined): WigoPositionGroup | null {
  const pos = (code ?? "").toUpperCase();
  if (pos === "D" || pos === "LD" || pos === "RD") return "D";
  if (["C", "L", "R", "LW", "RW", "W", "F"].includes(pos)) return "F";
  return null;
}

// Special-teams cohorts (decision 81): a per-strength minutes floor instead of games,
// and forwards and defensemen ranked apart. Default floors (decision 140, 2025-26
// split-half reliability, threshold .5 over a full season): PP 60 minutes (forwards
// .55, defense .63; 30 minutes gave only .37/.47) and PK 120 minutes (.52/.55, still
// weak, so PK ratings carry a low-reliability note). Users can lower either floor.
export const WIGO_SPECIAL_TEAMS_STRENGTHS = ["pp", "pk"] as const;
export type WigoSpecialTeamsStrength = (typeof WIGO_SPECIAL_TEAMS_STRENGTHS)[number];
export const WIGO_ST_MIN_MINUTES_DEFAULT: Record<WigoSpecialTeamsStrength, number> = {
  pp: 60,
  pk: 120
};
export const WIGO_ST_FLOOR_BASIS = "2025-26 split-half reliability (decision 140)";
export const WIGO_PK_LOW_RELIABILITY_NOTE =
  "Low reliability: PK percentiles stay only weakly stable even at 120 PK minutes (2025-26 split-half .52 forwards, .55 defense)";
export const isWigoSpecialTeamsStrength = (strength: string): strength is WigoSpecialTeamsStrength =>
  (WIGO_SPECIAL_TEAMS_STRENGTHS as readonly string[]).includes(strength);

export interface WigoCohortOptions {
  /** Minutes at this strength a row needs to enter the cohort (the selected player too). */
  minToiMinutes?: Partial<Record<Strength, number>>;
  /** Position group by player id; strengths in `separatePositions` rank F and D apart. */
  positionGroups?: ReadonlyMap<number, WigoPositionGroup> | null;
  separatePositions?: readonly Strength[];
}

/** The F/D-and-minutes rule special-teams cohorts use on the page (decision 81). */
export function wigoSpecialTeamsCohortOptions(
  positionGroups: ReadonlyMap<number, WigoPositionGroup> | null,
  minMinutes: Record<WigoSpecialTeamsStrength, number> = WIGO_ST_MIN_MINUTES_DEFAULT
): WigoCohortOptions {
  return {
    minToiMinutes: { pp: minMinutes.pp, pk: minMinutes.pk },
    positionGroups,
    separatePositions: WIGO_SPECIAL_TEAMS_STRENGTHS
  };
}

/** True when the row clears the strength's minutes floor (no floor → true). */
export function meetsWigoMinutesFloor(
  toiSeconds: number | null | undefined,
  floorMinutes: number | undefined
) {
  if (floorMinutes === undefined) return true;
  return typeof toiSeconds === "number" && Number.isFinite(toiSeconds) && toiSeconds / 60 >= floorMinutes;
}

function buildComparisonRows(
  playerDataArray: PlayerStrengthStats[],
  statKey: string,
  targetPlayerId: number,
  cohortMinGp: number,
  floorMinutes?: number,
  sameGroup?: (playerId: number) => boolean
): ComparisonRow[] {
  return playerDataArray
    .filter((player) => !sameGroup || sameGroup(player.player_id))
    .filter((player) => {
      // A minutes floor applies to everyone, the selected player included: below
      // it the sample is insufficient, so the stat is unranked (decision 81).
      if (floorMinutes !== undefined) return meetsWigoMinutesFloor(player.toi_seconds, floorMinutes);
      const playerGp = player.gp ?? 0;
      return player.player_id === targetPlayerId || playerGp >= cohortMinGp;
    })
    .map((player) => ({
      player_id: player.player_id,
      gp: player.gp ?? 0,
      value: player[statKey] as number | null
    }))
    .filter(
      (player): player is ComparisonRow =>
        typeof player.value === "number" &&
        !isNaN(player.value) &&
        isFinite(player.value)
    );
}

// A percentile against only a handful of qualifying peers is noise (one peer or none collapses to 50.0),
// so the page withholds a stat's percentile until this many other players qualify.
export const WIGO_RATING_MIN_COHORT_PEERS = 20;

// --- Main Calculation Function ---
export function calculatePlayerRatings(
  playerId: number,
  rawStats: RawStatsCollection,
  weightsConfig: RatingWeightsConfig = RATING_WEIGHTS,
  regressionConfig: RegressionConfig = REGRESSION_CONFIG,
  cohortMinGp = 0,
  minCohortPeers = 0,
  cohortOptions: WigoCohortOptions = {}
): CalculatedPlayerRatings | null {
  const strengths: Strength[] = ["as", "es", "pp", "pk"];
  const finalRatings: Partial<CalculatedPlayerRatings> & {
    offense: any;
    defense: any;
    overall: any;
    coverage: CalculatedPlayerRatings["coverage"];
  } = {
    offense: { as: null, es: null, pp: null, pk: null },
    defense: { as: null, es: null, pp: null, pk: null },
    overall: { as: null, es: null, st: null, final: null },
    coverage: { offense: {}, defense: {} },
    _debug: { percentiles: {}, regressedPercentiles: {} }
  };
  const targetGroup = cohortOptions.positionGroups?.get(playerId) ?? null;

  let foundPlayerData = false;

  const intermediatePercentiles: {
    [key in Strength]?: { [key: string]: number | null };
  } = {};
  const regressedPercentiles: {
    [key in Strength]?: { [key: string]: number | null };
  } = {};

  for (const strength of strengths) {
    const strengthData = rawStats[strength];
    const strengthWeights = weightsConfig[strength];
    if (!strengthData || !strengthWeights) continue;

    intermediatePercentiles[strength] = {};
    regressedPercentiles[strength] = {};

    const statTypes: ("offense" | "defense")[] = ["offense", "defense"];
    for (const type of statTypes) {
      const weights = strengthWeights[type];
      const playerDataArray = strengthData[type];

      if (
        !weights ||
        weights.length === 0 ||
        !playerDataArray ||
        playerDataArray.length === 0
      ) {
        continue;
      }

      const targetPlayerRow = playerDataArray.find(
        (p) => p.player_id === playerId
      );
      if (targetPlayerRow) foundPlayerData = true;

      const targetPlayerGP = targetPlayerRow?.gp ?? 0; // Player's GP for THIS strength
      const floorMinutes = cohortOptions.minToiMinutes?.[strength];
      const separate = cohortOptions.separatePositions?.includes(strength) ?? false;
      // F and D ranked apart; an unknown position cannot be placed, so it is unranked.
      const sameGroup = separate
        ? (id: number) => targetGroup !== null && cohortOptions.positionGroups?.get(id) === targetGroup
        : undefined;

      for (const weightInfo of weights) {
        const statKey = weightInfo.stat;
        const higherIsBetter = weightInfo.higherIsBetter;
        const comparisonRows = buildComparisonRows(
          playerDataArray,
          String(statKey),
          playerId,
          cohortMinGp,
          floorMinutes,
          sameGroup
        );

        const peerCount = comparisonRows.filter(
          (row) => row.player_id !== playerId
        ).length;
        const targetRanking =
          peerCount >= minCohortPeers
            ? calculateRankingResult(comparisonRows, playerId, higherIsBetter)
            : null;
        const percentile =
          targetRanking !== null ? targetRanking.percentile * 100 : null;
        intermediatePercentiles[strength]![String(statKey)] = percentile;

        let finalPercentileValue = percentile;

        if (
          regressionConfig.enabled &&
          percentile !== null &&
          targetPlayerRow &&
          targetPlayerGP < regressionConfig.minGPThreshold
        ) {
          // Rank the cohort once rather than rescanning it for every row.
          // A repeated id ranks with its first value, as a find would.
          const percentileOf = buildPercentileLookup(
            comparisonRows.map((row) => row.value),
            higherIsBetter
          );
          const firstValueById = new Map<number, number>();
          for (const row of comparisonRows) {
            if (!firstValueById.has(row.player_id)) {
              firstValueById.set(row.player_id, row.value);
            }
          }

          const regressionTargets = comparisonRows.filter(
            (row) =>
              row.player_id !== playerId &&
              row.gp >= regressionConfig.minGPThreshold
          );

          const regressionMeanPercentile =
            regressionTargets.length > 0
              ? regressionTargets.reduce(
                  (sum, row) =>
                    sum + percentileOf(firstValueById.get(row.player_id)!) * 100,
                  0
                ) / regressionTargets.length
              : 50;

          finalPercentileValue = applyRegression(
            percentile,
            targetPlayerGP,
            regressionMeanPercentile,
            regressionConfig.minGPThreshold
          );
        }

        regressedPercentiles[strength]![String(statKey)] = finalPercentileValue;
      }
    }
  }

  if (!foundPlayerData) {
    console.warn(
      `[calculatePlayerRatings] Player ${playerId} not found in any provided dataset.`
    );
    return null;
  }

  finalRatings._debug!.percentiles = intermediatePercentiles;
  finalRatings._debug!.regressedPercentiles = regressedPercentiles;

  // --- Step 3: Calculate Weighted Sums ---
  // A rating needs every weighted stat (decision 102, A3): with any stat missing
  // it is withheld and its weight coverage is reported, never rescaled over the
  // weights that happen to be available.
  for (const strength of strengths) {
    const strengthWeights = weightsConfig[strength];
    if (!strengthWeights) continue;

    for (const type of ["offense", "defense"] as const) {
      const weights = strengthWeights[type];
      if (!weights || weights.length === 0) continue;
      let available = 0;
      let total = 0;
      let weightedSum = 0;
      for (const weightInfo of weights) {
        total += weightInfo.weight;
        const percentile = regressedPercentiles[strength]?.[String(weightInfo.stat)];
        if (typeof percentile === "number") {
          weightedSum += percentile * weightInfo.weight;
          available += weightInfo.weight;
        }
      }
      finalRatings.coverage[type][strength] = { available, total };
      finalRatings[type][strength] =
        total > 0 && available === total ? weightedSum / total : null;
    }
  }

  // --- Step 4: Calculate Overall Ratings ---
  // Overall needs both sides; one side alone is not an overall rating (D9).
  const off = finalRatings.offense!;
  const def = finalRatings.defense!;
  const avg = (a: number | null, b: number | null): number | null =>
    a !== null && b !== null ? (a + b) / 2 : null;

  finalRatings.overall.as = avg(off.as, def.as);
  finalRatings.overall.es = avg(off.es, def.es);
  const ppOffenseRow = rawStats.pp?.offense.find(
    (p) => p.player_id === playerId
  );
  const pkDefenseRow = rawStats.pk?.defense.find(
    (p) => p.player_id === playerId
  );
  const ppTOI = ppOffenseRow?.toi_seconds ?? 0;
  const pkTOI = pkDefenseRow?.toi_seconds ?? 0;
  const totalStTOI = ppTOI + pkTOI;
  // Special teams = PP offense and PK defense weighted by their ice time. A side
  // with ice time but no rating makes the blend unknown; a side with no ice time
  // carries no weight (D9: no silent one-side fallback).
  let overallST: number | null = null;
  const ppKnown = ppTOI === 0 || off.pp !== null;
  const pkKnown = pkTOI === 0 || def.pk !== null;
  if (totalStTOI > 0 && ppKnown && pkKnown) {
    overallST =
      ((off.pp ?? 0) * ppTOI + (def.pk ?? 0) * pkTOI) / totalStTOI;
  }
  finalRatings.overall.st = overallST;
  const finalComponents = [
    finalRatings.overall.as,
    finalRatings.overall.es,
    finalRatings.overall.st
  ];
  const validComponents = finalComponents.filter(
    (r): r is number => r !== null
  );
  finalRatings.overall.final =
    validComponents.length === finalComponents.length
      ? validComponents.reduce((a, b) => a + b, 0) / validComponents.length
      : null;

  return finalRatings as CalculatedPlayerRatings;
}
