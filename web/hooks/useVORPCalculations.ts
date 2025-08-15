// hooks/useVORPCalculations.ts
import { useMemo } from "react";
import { DraftSettings } from "components/DraftDashboard/DraftDashboard";
import { ProcessedPlayer } from "hooks/useProcessedProjectionsData";

export type ScoringMode = "points"; // categories not implemented yet

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
  scoringMode?: ScoringMode;
}

export interface UseVORPResult {
  playerMetrics: Map<string, PlayerVorpMetrics>; // key: String(playerId)
  replacementByPos: Record<string, { vorp: number; vols: number }>;
}

// Helper: parse eligible positions from displayPosition
const parseEligiblePositions = (displayPosition?: string | null): string[] => {
  if (!displayPosition) return [];
  return displayPosition
    .split(",")
    .map((p) => p.trim().toUpperCase())
    .filter((p) => ["C", "LW", "RW", "D", "G"].includes(p));
};

export function useVORPCalculations({
  players,
  availablePlayers,
  draftSettings,
  picksUntilNext,
  scoringMode = "points"
}: UseVORPParams): UseVORPResult {
  return useMemo(() => {
    // Value per player (points mode only for now)
    const values = new Map<string, number>();
    const eligibility = new Map<string, string[]>();

    players.forEach((p) => {
      const id = String(p.playerId);
      const val = p.fantasyPoints?.projected ?? 0;
      values.set(id, isFinite(val) ? val : 0);
      eligibility.set(
        id,
        parseEligiblePositions(p.displayPosition ?? undefined)
      );
    });

    const T = draftSettings.teamCount;
    const starters = draftSettings.rosterConfig; // C,LW,RW,D,G, utility, bench
    const utilSkater = starters.utility ?? 0;

    // Allocate utility across skater positions C/LW/RW equally (robust heuristic)
    const utilAdj: Record<string, number> = { C: 0, LW: 0, RW: 0, D: 0, G: 0 };
    if (utilSkater > 0) {
      const share = utilSkater / 3; // distribute across C/LW/RW only
      utilAdj.C = share;
      utilAdj.LW = share;
      utilAdj.RW = share;
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

    // Replacement values at indices (use last available if shorter)
    const replacementByPos: Record<string, { vorp: number; vols: number }> = {
      C: { vorp: 0, vols: 0 },
      LW: { vorp: 0, vols: 0 },
      RW: { vorp: 0, vols: 0 },
      D: { vorp: 0, vols: 0 },
      G: { vorp: 0, vols: 0 }
    };

    positions.forEach((pos) => {
      const arr = byPosFull[pos];
      const vorpIdx = Math.min(idxVORP[pos], Math.max(0, arr.length - 1));
      const volsIdx = Math.min(idxVOLS[pos], Math.max(0, arr.length - 1));
      const vorpVal = arr[vorpIdx]?.value ?? 0;
      const volsVal = arr[volsIdx]?.value ?? 0;
      replacementByPos[pos] = { vorp: vorpVal, vols: volsVal };
    });

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
    topN.forEach((p) => {
      const elig = parseEligiblePositions(p.displayPosition);
      const valid = elig.filter((pos) => positions.includes(pos as any));
      if (valid.length === 0) return;
      const frac = 1 / valid.length; // fractional allocation across elig positions
      valid.forEach((pos) => {
        expectedTaken[pos] += frac;
      });
    });

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

    return { playerMetrics, replacementByPos };
  }, [players, availablePlayers, draftSettings, picksUntilNext, scoringMode]);
}
