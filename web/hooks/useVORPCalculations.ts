// hooks/useVORPCalculations.ts
import { useMemo } from "react";
import { ProcessedPlayer } from "hooks/useProcessedProjectionsData";

export type LeagueType = "points" | "categories";

// Minimal shape needed from DraftSettings for calculations
export interface DraftSettings {
  teamCount: number;
  rosterConfig: Record<string, number> & { utility?: number };
  leagueType?: LeagueType;
  categoryWeights?: Record<string, number>;
}

export interface PlayerVorpMetrics {
  value: number; // comparable single value (proj points for now)
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
  baselineMode?: "remaining" | "full"; // NEW: replacement baseline source
  categoryWeights?: Record<string, number>; // used when leagueType === 'categories'
  // NEW: forward grouping mode: split C/LW/RW or combined F
  forwardGrouping?: "split" | "fwd";
}

export interface UseVORPResult {
  playerMetrics: Map<string, PlayerVorpMetrics>; // key: String(playerId)
  replacementByPos: Record<string, { vorp: number; vols: number }>;
  // NEW: expected position run before next pick
  expectedTakenByPos?: Record<string, number>;
  expectedN?: number;
}

// Helper: parse eligible positions from displayPosition
const parseEligiblePositions = (displayPosition?: string | null): string[] => {
  if (!displayPosition) return [];
  const parts = displayPosition
    .split(",")
    .map((p) => p.trim().toUpperCase());
  const out: string[] = [];
  parts.forEach((p) => {
    if (p === "F") {
      // Treat F as skater forward eligibility (C/LW/RW)
      out.push("C", "LW", "RW");
    } else if (["C", "LW", "RW", "D", "G"].includes(p)) {
      out.push(p);
    }
  });
  // De-duplicate
  return Array.from(new Set(out));
};

export function useVORPCalculations({
  players,
  availablePlayers,
  draftSettings,
  picksUntilNext,
  leagueType = "points",
  baselineMode = "remaining",
  categoryWeights = {},
  forwardGrouping = "split"
}: UseVORPParams): UseVORPResult {
  return useMemo(() => {
    // Value per player (points or categories composite)
    const values = new Map<string, number>();
    const eligibility = new Map<string, string[]>();

    players.forEach((p) => {
      const id = String(p.playerId);
      // initialize eligibility; values will be set after we compute based on leagueType
      eligibility.set(
        id,
        parseEligiblePositions(p.displayPosition ?? undefined)
      );
    });

    // Compute player comparable values
    if (leagueType === "points") {
      players.forEach((p) => {
        const id = String(p.playerId);
        const val = p.fantasyPoints?.projected ?? 0;
        values.set(id, Number.isFinite(val) ? val : 0);
      });
    } else {
      // categories composite (z-score sum)
      const CAT_KEYS = [
        "GOALS",
        "ASSISTS",
        "PP_POINTS",
        "SHOTS_ON_GOAL",
        "HITS",
        "BLOCKED_SHOTS"
      ] as const;
      type CatKey = (typeof CAT_KEYS)[number];
      // choose pool: remaining skaters for dynamic z, else full skater pool
      const pool = (
        baselineMode === "remaining" ? availablePlayers : players
      ).filter((p) => !parseEligiblePositions(p.displayPosition).includes("G"));
      const stats: Record<CatKey, number[]> = {
        GOALS: [],
        ASSISTS: [],
        PP_POINTS: [],
        SHOTS_ON_GOAL: [],
        HITS: [],
        BLOCKED_SHOTS: []
      };
      pool.forEach((p) => {
        CAT_KEYS.forEach((k) => {
          const v = (p.combinedStats?.[k]?.projected as number | null) ?? null;
          if (typeof v === "number" && Number.isFinite(v)) {
            stats[k].push(v);
          }
        });
      });
      const mean: Record<CatKey, number> = {
        GOALS: 0,
        ASSISTS: 0,
        PP_POINTS: 0,
        SHOTS_ON_GOAL: 0,
        HITS: 0,
        BLOCKED_SHOTS: 0
      };
      const std: Record<CatKey, number> = {
        GOALS: 0,
        ASSISTS: 0,
        PP_POINTS: 0,
        SHOTS_ON_GOAL: 0,
        HITS: 0,
        BLOCKED_SHOTS: 0
      };
      CAT_KEYS.forEach((k) => {
        const arr = stats[k];
        if (arr.length > 0) {
          const m = arr.reduce((s, x) => s + x, 0) / arr.length;
          mean[k] = m;
          const variance =
            arr.reduce((s, x) => s + Math.pow(x - m, 2), 0) / arr.length;
          std[k] = Math.sqrt(variance) || 0;
        }
      });
      players.forEach((p) => {
        let sum = 0;
        CAT_KEYS.forEach((k) => {
          const raw =
            (p.combinedStats?.[k]?.projected as number | null) ?? null;
          const w =
            categoryWeights && typeof categoryWeights[k] === "number"
              ? (categoryWeights as any)[k]
              : 1;
          if (typeof raw === "number" && Number.isFinite(raw) && std[k] > 0) {
            const z = (raw - mean[k]) / std[k];
            sum += w * z;
          }
        });
        values.set(String(p.playerId), Number.isFinite(sum) ? sum : 0);
      });
    }

    const T = draftSettings.teamCount;
    const starters = draftSettings.rosterConfig; // C,LW,RW,D,G, utility, bench
    const utilSkater = starters.utility ?? 0;

    // Allocate UTIL across all skater positions (C/LW/RW/D) equally
    const utilAdj: Record<string, number> = { C: 0, LW: 0, RW: 0, D: 0, G: 0 };
    if (utilSkater > 0) {
      const share = utilSkater / 4; // distribute across C, LW, RW, D
      utilAdj.C = share;
      utilAdj.LW = share;
      utilAdj.RW = share;
      utilAdj.D = share;
    }

    // Group by position and sort by value desc (FULL POOL)
    const positions = ["C", "LW", "RW", "D", "G"] as const;
    const byPosFull: Record<string, Array<{ id: string; value: number }>> = {
      C: [],
      LW: [],
      RW: [],
      D: [],
      G: []
    };

    players.forEach((p) => {
      const id = String(p.playerId);
      const val = values.get(id) || 0;
      const elig = eligibility.get(id) || [];
      elig.forEach((pos) => {
        byPosFull[pos].push({ id, value: val });
      });
    });

    positions.forEach((pos) => {
      byPosFull[pos].sort((a, b) => b.value - a.value);
    });

    // If forward grouping is combined, build a merged forward pool (C+LW+RW)
    const fwdPoolFull = [...byPosFull.C, ...byPosFull.LW, ...byPosFull.RW]
      .sort((a, b) => b.value - a.value);

    // Replacement indices (0-based) for VORP and VOLS
    const idxVORP: Record<string, number> = {};
    const idxVOLS: Record<string, number> = {};

    positions.forEach((pos) => {
      const startersPos = (starters as any)[pos] || 0;
      const vorpRank1Based = T * (startersPos + (utilAdj[pos] || 0)) + 1; // as spec
      const volsRank1Based = T * startersPos; // last starter
      // Convert to 0-based indices with clamping >=1
      const vorpIdx = Math.max(0, Math.floor(vorpRank1Based) - 1);
      const volsIdx = Math.max(0, Math.floor(volsRank1Based) - 1);
      idxVORP[pos] = vorpIdx;
      idxVOLS[pos] = volsIdx;
    });

    // For combined forward mode, compute combined starter count for FWD pool
    const baseFwdStarters =
      (starters as any).C + (starters as any).LW + (starters as any).RW;
    const fwdUtilShare = utilAdj.C + utilAdj.LW + utilAdj.RW; // UTIL portion that can be filled by FWD
    const fwdStarters = baseFwdStarters + fwdUtilShare;
    const fwdIdxVORP = Math.max(0, Math.floor(T * fwdStarters + 1) - 1);
    const fwdIdxVOLS = Math.max(0, Math.floor(T * (baseFwdStarters + fwdUtilShare)) - 1);

    // Replacement values at indices (use last available if shorter)
    const replacementByPos: Record<string, { vorp: number; vols: number }> = {
      C: { vorp: 0, vols: 0 },
      LW: { vorp: 0, vols: 0 },
      RW: { vorp: 0, vols: 0 },
      D: { vorp: 0, vols: 0 },
      G: { vorp: 0, vols: 0 }
    };

    // AVAILABLE POOL for VONA: group and sort
    const byPosAvail: Record<string, Array<{ id: string; value: number }>> = {
      C: [],
      LW: [],
      RW: [],
      D: [],
      G: []
    };
    availablePlayers.forEach((p) => {
      const id = String(p.playerId);
      const val = values.get(id) || 0;
      const elig = eligibility.get(id) || [];
      elig.forEach((pos) => {
        byPosAvail[pos].push({ id, value: val });
      });
    });
    positions.forEach((pos) =>
      byPosAvail[pos].sort((a, b) => b.value - a.value)
    );

    const fwdPoolAvail = [...byPosAvail.C, ...byPosAvail.LW, ...byPosAvail.RW]
      .sort((a, b) => b.value - a.value);

    // Choose baseline source for replacement values
    const baselineArrs = baselineMode === "remaining" ? byPosAvail : byPosFull;

    positions.forEach((pos) => {
      if (forwardGrouping === "fwd" && (pos === "C" || pos === "LW" || pos === "RW")) {
        const arr = baselineMode === "remaining" ? fwdPoolAvail : fwdPoolFull;
        const vorpIdx = Math.min(fwdIdxVORP, Math.max(0, arr.length - 1));
        const volsIdx = Math.min(fwdIdxVOLS, Math.max(0, arr.length - 1));
        const vorpVal = arr[vorpIdx]?.value ?? 0;
        const volsVal = arr[volsIdx]?.value ?? 0;
        replacementByPos[pos] = { vorp: vorpVal, vols: volsVal };
      } else {
        const arr = baselineArrs[pos];
        const vorpIdx = Math.min(idxVORP[pos], Math.max(0, arr.length - 1));
        const volsIdx = Math.min(idxVOLS[pos], Math.max(0, arr.length - 1));
        const vorpVal = arr[vorpIdx]?.value ?? 0;
        const volsVal = arr[volsIdx]?.value ?? 0;
        replacementByPos[pos] = { vorp: vorpVal, vols: volsVal };
      }
    });

    // Build quick index lookup of current rank in available list per pos
    const currentRankIdx: Record<string, Record<string, number>> = {
      C: {},
      LW: {},
      RW: {},
      D: {},
      G: {}
    };
    positions.forEach((pos) => {
      byPosAvail[pos].forEach((p, idx) => {
        currentRankIdx[pos][p.id] = idx;
      });
    });

    // Estimate expected players taken per position in the next N picks using ADP shares
    const N = Math.max(0, Math.floor(picksUntilNext));
    const adpSorted = [...availablePlayers]
      .filter((p) => Number.isFinite(p.yahooAvgPick))
      .sort((a, b) => a.yahooAvgPick! - b.yahooAvgPick!);
    const topN = adpSorted.slice(0, N);

    const expectedTaken: Record<string, number> = {
      C: 0,
      LW: 0,
      RW: 0,
      D: 0,
      G: 0
    };
    if (forwardGrouping === "fwd") {
      // Count skaters (non-D, non-G) as FWD and distribute equally across C/LW/RW for display
      let fwdExpected = 0;
      topN.forEach((p) => {
        const elig = parseEligiblePositions(p.displayPosition);
        const isD = elig.includes("D");
        const isG = elig.includes("G");
        if (!isD && !isG && elig.length > 0) {
          fwdExpected += 1; // treat as forward slot
        } else if (isD) {
          expectedTaken.D += 1;
        } else if (isG) {
          expectedTaken.G += 1;
        }
      });
      const share = fwdExpected / 3;
      expectedTaken.C += share;
      expectedTaken.LW += share;
      expectedTaken.RW += share;
    } else {
      topN.forEach((p) => {
        const elig = parseEligiblePositions(p.displayPosition);
        const valid = elig.filter((pos) => positions.includes(pos as any));
        if (valid.length === 0) return;
        const frac = 1 / valid.length; // fractional allocation across elig positions
        valid.forEach((pos) => {
          expectedTaken[pos] += frac;
        });
      });
    }

    // Compute metrics per player, choose best eligible position
    const playerMetrics = new Map<string, PlayerVorpMetrics>();

    players.forEach((p) => {
      const id = String(p.playerId);
      const val = values.get(id) || 0;
      const elig = eligibility.get(id) || [];

      let bestVorp = 0;
      let bestVols = 0;
      let bestVona = 0;
      let bestPos = elig[0] || "";

      elig.forEach((pos) => {
        const rep = replacementByPos[pos] || { vorp: 0, vols: 0 };
        const vorp = Math.max(0, val - rep.vorp);
        const vols = Math.max(0, val - rep.vols);

        // VONA: predict next baseline given expectedTaken at position among N picks
        const arr = byPosAvail[pos];
        const curIdx = currentRankIdx[pos][id];
        if (arr && arr.length > 0 && Number.isFinite(curIdx)) {
          const nextRank = Math.min(
            arr.length - 1,
            Math.floor((curIdx as number) + (expectedTaken[pos] || 0))
          );
          const nextBaselineVal = arr[nextRank]?.value ?? 0;
          const vona = Math.max(0, val - nextBaselineVal);
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
          // If not in available list (already drafted), don't consider for VONA
          if (vorp > bestVorp || (vorp === bestVorp && vols > bestVols)) {
            bestVorp = vorp;
            bestVols = vols;
            bestPos = pos;
          }
        }
      });

      const vbd = 0.6 * bestVorp + 0.3 * bestVona + 0.1 * bestVols;

      playerMetrics.set(id, {
        value: val,
        vorp: bestVorp,
        vols: bestVols,
        vona: bestVona,
        vbd,
        bestPos,
        eligible: elig
      });
    });

    return {
      playerMetrics,
      replacementByPos,
      expectedTakenByPos: expectedTaken,
      expectedN: N
    };
  }, [
    players,
    availablePlayers,
    draftSettings,
    picksUntilNext,
    leagueType,
    baselineMode,
    categoryWeights,
    forwardGrouping
  ]);
}
