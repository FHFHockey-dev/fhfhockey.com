// hooks/useVORPCalculations.ts
import { useMemo } from "react";
import { ProcessedPlayer } from "hooks/useProcessedProjectionsData";
import {
  buildPositionPools,
  getEffectiveRosterConfig,
  getRosterPositions,
  groupPlayerEligibility,
  normalizePlayerEligibility
} from "lib/draftDashboard/forwardGrouping";

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

// Tunables: goalie rate regression and UTIL distribution
const PRIOR_SHOTS = 1200; // shots prior for SV% regression
const PRIOR_STARTS = 25; // starts prior for GAA regression
const UTIL_TO_DEF_ENABLED = false; // if true, allocate UTIL to D as well

// Debug guard; logs only in development
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const __DEV__ = process.env.NODE_ENV !== "production";

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
const isFiniteNumber = (x: any): x is number =>
  typeof x === "number" && Number.isFinite(x);

// Category helpers
// Goalie category identification: map common keys to goalie role
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

// Inversions: categories where lower is better (e.g., GAA, GA, Losses)
const isInverted = (k: string) =>
  k === "GOALS_AGAINST_AVERAGE" ||
  k === "GOALS_AGAINST_GOALIE" ||
  k === "LOSSES_GOALIE";

// Goalie rate stats to regress by workload before z-scoring
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
      const parsed = normalizePlayerEligibility(
        p.displayPosition,
        Array.isArray(p.eligiblePositions) ? p.eligiblePositions : undefined
      );
      const elig = groupPlayerEligibility(parsed, forwardGrouping);
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
        const elig = eligibility.get(String(p.playerId)) ?? [];
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
        const elig = eligibility.get(String(p.playerId)) ?? [];
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
          // rate* = (w*rate + w0*mu) / (w + w0)
          // SV% uses projected shots as w; GAA uses projected starts as w.
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

      // Dev-only: log a couple μ/σ for sanity on first render
      // Avoid noise by logging once per module load
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if (__DEV__ && !globalThis.__VORP_Z_DEBUG_LOGGED__) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        globalThis.__VORP_Z_DEBUG_LOGGED__ = true;
        const sampleSkaterCats = ["GOALS", "ASSISTS", "SHOTS_ON_GOAL"];
        const sampleGoalieCats = [
          "SAVE_PERCENTAGE",
          "GOALS_AGAINST_AVERAGE",
          "WINS_GOALIE"
        ];
        const skaterDump = sampleSkaterCats
          .filter((k) => k in muSkater)
          .map((k) => ({ k, mu: muSkater[k], sd: sdSkater[k] }));
        const goalieDump = sampleGoalieCats
          .filter((k) => k in muGoalie)
          .map((k) => ({ k, mu: muGoalie[k], sd: sdGoalie[k] }));
        // eslint-disable-next-line no-console
        console.log("[VORP] Z-scale (skater):", skaterDump);
        // eslint-disable-next-line no-console
        console.log("[VORP] Z-scale (goalie):", goalieDump);
      }
    }

    const T = draftSettings.teamCount;
    const starters = getEffectiveRosterConfig(
      draftSettings.rosterConfig,
      forwardGrouping
    );
    const positions = getRosterPositions(forwardGrouping);
    const utilSkater = starters.utility ?? 0;
    const utilAdj: Record<string, number> = Object.fromEntries(
      positions.map((position) => [position, 0])
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
      forwardGrouping
    );
    const byPosAvail = buildPositionPools(
      availablePlayers.map((player) => String(player.playerId)),
      values,
      eligibility,
      forwardGrouping
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
        Math.floor(T * (remainingStarters + (utilAdj[position] || 0)) + 1) - 1
      );
      idxVOLS[position] = Math.max(0, Math.floor(T * remainingStarters) - 1);
    }

    const replacementByPos: Record<
      string,
      { vorp: number; vols: number }
    > = {};
    const replacementPools =
      baselineMode === "full" ? byPosFull : byPosAvail;
    for (const position of positions) {
      const pool = replacementPools[position] ?? [];
      const vorpIndex = Math.min(
        idxVORP[position],
        Math.max(0, pool.length - 1)
      );
      const volsIndex = Math.min(
        idxVOLS[position],
        Math.max(0, pool.length - 1)
      );
      replacementByPos[position] = {
        vorp: pool[vorpIndex]?.value ?? 0,
        vols: pool[volsIndex]?.value ?? 0
      };
    }

    const currentRankIdx: Record<string, Record<string, number>> =
      Object.fromEntries(positions.map((position) => [position, {}]));
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
      positions.map((position) => [position, 0])
    );
    for (const player of topN) {
      const valid = (eligibility.get(String(player.playerId)) ?? []).filter(
        (position) => positions.includes(position)
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
