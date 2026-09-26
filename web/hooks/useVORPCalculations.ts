// hooks/useVORPCalculations.ts
import { useMemo } from "react";
import { ProcessedPlayer } from "hooks/useProcessedProjectionsData";
import {
  buildPositionPools,
  getEffectiveRosterConfig,
  getRosterPositions,
} from "lib/draftDashboard/forwardGrouping";
import { buildPlayerValues } from "lib/draftDashboard/playerValues";

export type LeagueType = "points" | "categories";

// Minimal shape needed from DraftSettings for calculations
export interface DraftSettings {
  teamCount: number;
  rosterConfig: Record<string, number> & { utility?: number };
  leagueType?: LeagueType;
  categoryWeights?: Record<string, number>;
}

export interface PlayerVorpMetrics {
  value: number; // comparable single value (fp for points; Z-sum for categories)
  unweightedValue?: number; // preserves projection sorting when position weights apply
  vorp: number;
  vols: number;
  vona: number;
  vbd: number;
  bestPos: string;
  eligible: string[];
}

export interface UseVORPParams {
  players: ProcessedPlayer[]; // full pool
  availablePlayers: ProcessedPlayer[]; // exclude drafted
  draftSettings: DraftSettings;
  picksUntilNext: number; // estimated picks before user's next turn
  leagueType?: LeagueType;
  baselineMode?: "remaining" | "full"; // replacement baseline source
  categoryWeights?: Record<string, number>; // used when leagueType === 'categories'
  //  forward grouping mode: split C/LW/RW or combined F
  forwardGrouping?: "split" | "fwd";
  // personalized replacement context
  myFilledSlots?: Record<string, number>;
  personalizeReplacement?: boolean;
  // Full-season proration toggle for skater counting stats (points leagues only)
  prorate84?: boolean;
  // Optional fantasy scoring overrides (will merge with defaults inside helper)
  fantasyPointSettings?: Record<string, number>;
  // Draft Pro multipliers resolved from the selected position source, not roster slots.
  positionWeightMultipliers?: ReadonlyMap<string, number>;
}

export interface UseVORPResult {
  playerMetrics: Map<string, PlayerVorpMetrics>;
  replacementByPos: Record<string, { vorp: number; vols: number }>;
  expectedTakenByPos?: Record<string, number>;
  expectedN?: number;
}

const UTIL_TO_DEF_ENABLED = false; // if true, allocate UTIL to D as well
const EMPTY_NUMERIC_RECORD: Record<string, number> = {};

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

export function useVORPCalculations({
  players,
  availablePlayers,
  draftSettings,
  picksUntilNext,
  leagueType = "points",
  baselineMode = "remaining",
  categoryWeights = EMPTY_NUMERIC_RECORD,
  forwardGrouping = "split",
  myFilledSlots = EMPTY_NUMERIC_RECORD,
  personalizeReplacement = false,
  prorate84 = false,
  fantasyPointSettings = EMPTY_NUMERIC_RECORD,
  positionWeightMultipliers,
}: UseVORPParams): UseVORPResult {
  return useMemo(() => {
    const { values, eligibility, unweightedValues } = buildPlayerValues({ players, draftSettings, leagueType, categoryWeights, forwardGrouping, prorate84, fantasyPointSettings, positionWeightMultipliers });

    const T = draftSettings.teamCount;
    const starters = getEffectiveRosterConfig(
      draftSettings.rosterConfig,
      forwardGrouping,
    );
    const positions = getRosterPositions(forwardGrouping, starters);
    const utilSkater = starters.utility ?? 0;
    const utilAdj: Record<string, number> = Object.fromEntries(
      positions.map((position) => [position, 0]),
    );
    if (utilSkater > 0) {
      if (forwardGrouping === "fwd") {
        utilAdj.FWD = utilSkater;
      } else {
        const groupCount = UTIL_TO_DEF_ENABLED ? 4 : 3;
        const share = utilSkater / groupCount;
        utilAdj.C = share;
        utilAdj.LW = share;
        utilAdj.RW = share;
        utilAdj.D = UTIL_TO_DEF_ENABLED ? share : 0;
      }
    }

    const byPosFull = buildPositionPools(
      players.map((player) => String(player.playerId)),
      values,
      eligibility,
      forwardGrouping,
      starters,
    );
    const byPosAvail = buildPositionPools(
      availablePlayers.map((player) => String(player.playerId)),
      values,
      eligibility,
      forwardGrouping,
      starters,
    );

    const idxVORP: Record<string, number> = {};
    const idxVOLS: Record<string, number> = {};
    for (const position of positions) {
      const starterCount = Math.max(0, Number(starters[position]) || 0);
      const filled = personalizeReplacement
        ? Math.max(0, Number(myFilledSlots[position]) || 0)
        : 0;
      const remainingStarters = Math.max(0, starterCount - filled);
      idxVORP[position] = Math.max(
        0,
        Math.floor(T * (remainingStarters + (utilAdj[position] || 0)) + 1) - 1,
      );
      idxVOLS[position] = Math.max(0, Math.floor(T * remainingStarters) - 1);
    }

    const replacementByPos: Record<string, { vorp: number; vols: number }> = {};
    const replacementPools = baselineMode === "full" ? byPosFull : byPosAvail;
    for (const position of positions) {
      const pool = replacementPools[position] ?? [];
      const vorpIndex = Math.min(
        idxVORP[position],
        Math.max(0, pool.length - 1),
      );
      const volsIndex = Math.min(
        idxVOLS[position],
        Math.max(0, pool.length - 1),
      );
      replacementByPos[position] = {
        vorp: pool[vorpIndex]?.value ?? 0,
        vols: pool[volsIndex]?.value ?? 0,
      };
    }

    const currentRankIdx: Record<
      string,
      Record<string, number>
    > = Object.fromEntries(positions.map((position) => [position, {}]));
    for (const position of positions) {
      (byPosAvail[position] ?? []).forEach((player, index) => {
        currentRankIdx[position][player.id] = index;
      });
    }

    const N = Math.max(0, Math.floor(picksUntilNext));
    const topN = [...availablePlayers]
      .filter((player) => Number.isFinite(player.yahooAvgPick))
      .sort((left, right) => left.yahooAvgPick! - right.yahooAvgPick!)
      .slice(0, N);
    const expectedTaken: Record<string, number> = Object.fromEntries(
      positions.map((position) => [position, 0]),
    );
    for (const player of topN) {
      const valid = (eligibility.get(String(player.playerId)) ?? []).filter(
        (position) => positions.includes(position),
      );
      if (!valid.length) continue;
      const share = 1 / valid.length;
      for (const position of valid) expectedTaken[position] += share;
    }

    // Compute metrics per player, choose best eligible position
    const playerMetrics = new Map<string, PlayerVorpMetrics>();

    players.forEach((p) => {
      const id = String(p.playerId);
      const val = values.get(id) || 0;
      const elig = eligibility.get(id) || [];
      const unweightedValue = unweightedValues.has(id) ? { unweightedValue: unweightedValues.get(id)! } : {};

      if (elig.length === 0) {
        playerMetrics.set(id, {
          value: val,
          ...unweightedValue,
          vorp: 0,
          vols: 0,
          vona: 0,
          vbd: 0,
          bestPos: "",
          eligible: elig,
        });
        return;
      }

      let bestVorp = -Infinity;
      let bestVols = -Infinity;
      let bestVona = -Infinity;
      let bestPos = elig[0] || "";

      elig.forEach((pos) => {
        const rep = replacementByPos[pos] || { vorp: 0, vols: 0 };
        const vorp = val - rep.vorp;
        const vols = val - rep.vols;

        const arr = byPosAvail[pos];
        const curIdx = currentRankIdx[pos][id];
        if (arr && arr.length > 0) {
          const baselineIndex = Number.isFinite(curIdx)
            ? (curIdx as number) + (expectedTaken[pos] || 0)
            : expectedTaken[pos] || 0;
          const nextRank = Math.min(
            arr.length - 1,
            Math.floor(baselineIndex),
          );
          const nextBaselineVal = arr[nextRank]?.value ?? 0;
          const vona = val - nextBaselineVal;
          if (
            vorp > bestVorp ||
            (vorp === bestVorp &&
              (vona > bestVona || (vona === bestVona && vols > bestVols)))
          ) {
            bestVorp = vorp;
            bestVols = vols;
            bestVona = vona;
            bestPos = pos;
          }
        } else {
          const vona = val;
          if (
            vorp > bestVorp ||
            (vorp === bestVorp &&
              (vona > bestVona || (vona === bestVona && vols > bestVols)))
          ) {
            bestVorp = vorp;
            bestVols = vols;
            bestVona = vona;
            bestPos = pos;
          }
        }
      });

      const vbd = 0.6 * bestVorp + 0.3 * bestVona + 0.1 * bestVols;

      playerMetrics.set(id, {
        value: val,
        ...unweightedValue,
        vorp: bestVorp,
        vols: bestVols,
        vona: bestVona,
        vbd,
        bestPos,
        eligible: elig,
      });
    });

    return {
      playerMetrics,
      replacementByPos,
      expectedTakenByPos: expectedTaken,
      expectedN: N,
    };
  }, [
    players,
    availablePlayers,
    draftSettings,
    picksUntilNext,
    leagueType,
    baselineMode,
    categoryWeights,
    forwardGrouping,
    personalizeReplacement,
    myFilledSlots,
    prorate84,
    fantasyPointSettings,
    positionWeightMultipliers,
  ]);
}
