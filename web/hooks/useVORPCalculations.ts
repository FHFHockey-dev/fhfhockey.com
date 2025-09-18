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
  value: number; // comparable single value (fp for points; Z-sum for categories)
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
  // 82-game proration toggle for skater counting stats (affects points-league value only)
  prorate82?: boolean;
  // Optional fantasy scoring overrides (will merge with defaults inside helper)
  fantasyPointSettings?: Record<string, number>;
}

export interface UseVORPResult {
  playerMetrics: Map<string, PlayerVorpMetrics>;
  replacementByPos: Record<string, { vorp: number; vols: number }>;
  expectedTakenByPos?: Record<string, number>;
  expectedN?: number;
}

// Helper: parse eligible positions from displayPosition
const parseEligiblePositions = (displayPosition?: string | null): string[] => {
  if (!displayPosition) return [];
  const parts = displayPosition.split(",").map((p) => p.trim().toUpperCase());
  const out: string[] = [];
  parts.forEach((p) => {
    if (p === "F") {
      // Treat F as skater forward eligibility (C/LW/RW)
      out.push("C", "LW", "RW");
    } else if (["C", "LW", "RW", "D", "G"].includes(p)) {
      out.push(p);
    }
  });
  return Array.from(new Set(out));
};

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
const isFiniteNumber = (x: any): x is number =>
  typeof x === "number" && Number.isFinite(x);

// Category helpers
const isGoalieKey = (k: string) =>
  k.endsWith("_GOALIE") ||
  k === "GOALS_AGAINST_AVERAGE" ||
  k === "SAVE_PERCENTAGE" ||
  k === "GOALS_AGAINST_GOALIE" ||
  k === "SHOTS_AGAINST_GOALIE" ||
  k === "SHUTOUTS_GOALIE" ||
  k === "WINS_GOALIE" ||
  k === "LOSSES_GOALIE" ||
  k === "OTL_GOALIE";

const isInverted = (k: string) =>
  k === "GOALS_AGAINST_AVERAGE" ||
  k === "GOALS_AGAINST_GOALIE" ||
  k === "LOSSES_GOALIE";

const isGoalieRate = (k: string) =>
  k === "SAVE_PERCENTAGE" || k === "GOALS_AGAINST_AVERAGE";

// Stats access
const getProjected = (p: ProcessedPlayer, key: string): number | null => {
  const v = (p.combinedStats as any)?.[key]?.projected;
  return isFiniteNumber(v) ? (v as number) : null;
};

// Mean / StdDev
const mean = (arr: number[]): number =>
  arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0;
const stdev = (arr: number[]): number => {
  if (arr.length < 2) return 0;
  const mu = mean(arr);
  const v = arr.reduce((s, x) => s + (x - mu) * (x - mu), 0) / (arr.length - 1);
  return Math.sqrt(v);
};

export function useVORPCalculations({
  players,
  availablePlayers,
  draftSettings,
  picksUntilNext,
  leagueType = "points",
  baselineMode = "remaining",
  categoryWeights = {},
  forwardGrouping = "split",
  myFilledSlots = {},
  personalizeReplacement = false,
  prorate82 = false,
  fantasyPointSettings = {}
}: UseVORPParams): UseVORPResult {
  return useMemo(() => {
    // Value per player (points or categories composite)
    const values = new Map<string, number>();
    const eligibility = new Map<string, string[]>();

    players.forEach((p) => {
      const id = String(p.playerId);
      const prefer = Array.isArray((p as any).eligiblePositions)
        ? ((p as any).eligiblePositions as string[])
        : undefined;
      const parsed = parseEligiblePositions(p.displayPosition ?? undefined);
      const elig = prefer && prefer.length ? prefer : parsed;
      eligibility.set(id, elig);
    });

    // Compute player comparable values
    if (leagueType === "points") {
      // Points leagues: optionally recompute fantasy points using prorated 82G pace for skaters.
      let computeProrated:
        | ((
            p: ProcessedPlayer,
            enable: boolean,
            scoring?: Record<string, number>
          ) => number | null)
        | null = null;
      if (prorate82) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const mod = require("lib/projectionsConfig/proration");
          computeProrated = mod.computeProratedFantasyPoints;
        } catch {
          computeProrated = null;
        }
      }
      players.forEach((p) => {
        const id = String(p.playerId);
        let val = p.fantasyPoints?.projected ?? 0;
        if (prorate82 && computeProrated) {
          const fp = computeProrated(p, true, fantasyPointSettings);
          if (fp != null && Number.isFinite(fp)) val = fp;
        }
        values.set(id, Number.isFinite(val) ? val : 0);
      });
    } else {
      // ===============================
      // Categories: per-role Z-score model on FULL pool (stable)
      // ===============================
      const DEFAULT_CATS = [
        "GOALS",
        "ASSISTS",
        "PP_POINTS",
        "SHOTS_ON_GOAL",
        "HITS",
        "BLOCKED_SHOTS"
      ];
      const allKeys: string[] = Object.keys(categoryWeights || {}).length
        ? Object.keys(categoryWeights || {})
        : DEFAULT_CATS;

      // Build role-specific arrays from the FULL pool
      const arraysSkater: Record<string, number[]> = {};
      const arraysGoalie: Record<string, number[]> = {};
      allKeys.forEach((k) => {
        arraysSkater[k] = [];
        arraysGoalie[k] = [];
      });

      players.forEach((p) => {
        const elig = parseEligiblePositions(p.displayPosition);
        const isG = elig.includes("G");
        allKeys.forEach((k) => {
          if (isGoalieKey(k) !== isG) return;
          const v = getProjected(p, k);
          if (isFiniteNumber(v)) {
            if (isG) arraysGoalie[k].push(v!);
            else arraysSkater[k].push(v!);
          }
        });
      });

      // Means and std devs per role/category
      const muSkater: Record<string, number> = {};
      const sdSkater: Record<string, number> = {};
      const muGoalie: Record<string, number> = {};
      const sdGoalie: Record<string, number> = {};

      allKeys.forEach((k) => {
        muSkater[k] = mean(arraysSkater[k]);
        sdSkater[k] = stdev(arraysSkater[k]);
        muGoalie[k] = mean(arraysGoalie[k]);
        sdGoalie[k] = stdev(arraysGoalie[k]);
      });

      // Priors for rate regression (tunable)
      const PRIOR_SHOTS = 1200; // shots prior for SV%
      const PRIOR_STARTS = 25; // starts prior for GAA

      // Helpers: estimate goalie workloads
      const estimateShots = (p: ProcessedPlayer): number => {
        const cs = (p.combinedStats as any) || {};
        const shots = cs["SHOTS_AGAINST_GOALIE"]?.projected;
        const saves = cs["SAVES_GOALIE"]?.projected;
        const ga = cs["GOALS_AGAINST_GOALIE"]?.projected;
        if (isFiniteNumber(shots)) return shots as number;
        if (isFiniteNumber(saves) && isFiniteNumber(ga))
          return (saves as number) + (ga as number);
        return 0;
      };
      const estimateStarts = (p: ProcessedPlayer): number => {
        const cs = (p.combinedStats as any) || {};
        const keys = [
          "STARTS_GOALIE",
          "GAMES_STARTED_GOALIE",
          "GAMES_GOALIE",
          "GAMES_PLAYED_GOALIE",
          "GP_GOALIE"
        ];
        for (const k of keys) {
          const v = cs[k]?.projected;
          if (isFiniteNumber(v)) return v as number;
        }
        return 0;
      };

      // Compute composite Z-sum per player
      players.forEach((p) => {
        const id = String(p.playerId);
        const elig = parseEligiblePositions(p.displayPosition);
        const isG = elig.includes("G");
        const keysForPlayer = allKeys.filter((k) =>
          isG ? isGoalieKey(k) : !isGoalieKey(k)
        );
        if (keysForPlayer.length === 0) {
          values.set(id, 0);
          return;
        }

        let zsum = 0;

        keysForPlayer.forEach((k) => {
          let raw = getProjected(p, k);
          if (!isFiniteNumber(raw)) return;

          // Regress goalie rates to mean by workload
          if (isG && isGoalieRate(k)) {
            if (k === "SAVE_PERCENTAGE") {
              const shots = estimateShots(p);
              const mu = muGoalie[k] || 0;
              const w = Math.max(0, shots);
              raw =
                (w * (raw as number) + PRIOR_SHOTS * mu) /
                Math.max(1, w + PRIOR_SHOTS);
            } else if (k === "GOALS_AGAINST_AVERAGE") {
              const starts = estimateStarts(p);
              const mu = muGoalie[k] || 0;
              const w = Math.max(0, starts);
              raw =
                (w * (raw as number) + PRIOR_STARTS * mu) /
                Math.max(1, w + PRIOR_STARTS);
            }
          }

          const wUser = isFiniteNumber((categoryWeights as any)[k])
            ? (categoryWeights as any)[k]
            : 1;

          // Choose role stats
          const mu = isG ? muGoalie[k] : muSkater[k];
          const sd = isG ? sdGoalie[k] : sdSkater[k];
          if (!isFiniteNumber(sd) || sd === 0) return; // no variance; contribution ~ 0

          // Z-score (invert where lower is better)
          const z = isInverted(k)
            ? (mu - (raw as number)) / sd
            : ((raw as number) - mu) / sd;

          zsum += wUser * z;
        });

        values.set(id, Number.isFinite(zsum) ? zsum : 0);
      });
    }

    const T = draftSettings.teamCount;
    const starters = draftSettings.rosterConfig; // C,LW,RW,D,G, utility, bench
    const utilSkater = starters.utility ?? 0;

    // Allocate UTIL across skater forward positions (C/LW/RW) equally (not D)
    const utilAdj: Record<string, number> = { C: 0, LW: 0, RW: 0, D: 0, G: 0 };
    if (utilSkater > 0) {
      const share = utilSkater / 3; // distribute across C, LW, RW
      utilAdj.C = share;
      utilAdj.LW = share;
      utilAdj.RW = share;
      utilAdj.D = 0; // do not allocate UTIL to D by default
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
    const fwdPoolFull = [...byPosFull.C, ...byPosFull.LW, ...byPosFull.RW].sort(
      (a, b) => b.value - a.value
    );

    // Replacement indices (0-based) for VORP and VOLS
    const idxVORP: Record<string, number> = {};
    const idxVOLS: Record<string, number> = {};

    positions.forEach((pos) => {
      const startersPos = (starters as any)[pos] || 0;
      let effectiveStarters = startersPos;
      if (personalizeReplacement) {
        const filled = myFilledSlots[pos] || 0;
        effectiveStarters = Math.max(0, startersPos - filled);
      }
      const vorpRank1Based = T * (effectiveStarters + (utilAdj[pos] || 0)) + 1;
      const volsRank1Based = T * effectiveStarters;
      const vorpIdx = Math.max(0, Math.floor(vorpRank1Based) - 1);
      const volsIdx = Math.max(0, Math.floor(volsRank1Based) - 1);
      idxVORP[pos] = vorpIdx;
      idxVOLS[pos] = volsIdx;
    });

    // For combined forward mode, compute combined starter count for FWD pool
    const baseFwdStarters =
      (starters as any).C + (starters as any).LW + (starters as any).RW;
    const fwdUtilShare = utilAdj.C + utilAdj.LW + utilAdj.RW;
    const fwdStarters = baseFwdStarters + fwdUtilShare;
    const fwdIdxVORP = Math.max(0, Math.floor(T * fwdStarters + 1) - 1);
    const fwdIdxVOLS = Math.max(
      0,
      Math.floor(T * (baseFwdStarters + fwdUtilShare)) - 1
    );

    // Replacement values at indices
    const replacementByPos: Record<string, { vorp: number; vols: number }> = {
      C: { vorp: 0, vols: 0 },
      LW: { vorp: 0, vols: 0 },
      RW: { vorp: 0, vols: 0 },
      D: { vorp: 0, vols: 0 },
      G: { vorp: 0, vols: 0 }
    };

    // AVAILABLE POOL for VONA
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

    const fwdPoolAvail = [
      ...byPosAvail.C,
      ...byPosAvail.LW,
      ...byPosAvail.RW
    ].sort((a, b) => b.value - a.value);

    // Choose baseline source for replacement values
    const baselineArrs = baselineMode === "remaining" ? byPosAvail : byPosFull;

    positions.forEach((pos) => {
      if (
        forwardGrouping === "fwd" &&
        (pos === "C" || pos === "LW" || pos === "RW")
      ) {
        const arr = baselineMode === "remaining" ? fwdPoolAvail : fwdPoolFull;
        const vorpIdx = Math.min(idxVORP[pos], Math.max(0, arr.length - 1));
        const volsIdx = Math.min(idxVOLS[pos], Math.max(0, arr.length - 1));
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
      let fwdExpected = 0;
      topN.forEach((p) => {
        const elig = parseEligiblePositions(p.displayPosition);
        const isD = elig.includes("D");
        const isG = elig.includes("G");
        if (!isD && !isG && elig.length > 0) {
          fwdExpected += 1;
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
        const frac = 1 / valid.length;
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
        if (arr && arr.length > 0 && Number.isFinite(curIdx)) {
          const nextRank = Math.min(
            arr.length - 1,
            Math.floor((curIdx as number) + (expectedTaken[pos] || 0))
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
    forwardGrouping,
    personalizeReplacement,
    myFilledSlots,
    prorate82,
    fantasyPointSettings
  ]);
}
