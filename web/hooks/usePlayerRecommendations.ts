// filepath: /Users/tim/Desktop/fhfhockey.com/web/hooks/usePlayerRecommendations.ts
// Computes top-N recommended players based on VORP/VBD and optional team needs weighting.
// Lightweight and memoized. Safe in absence of some fields.

import { useMemo } from "react";
import type { ProcessedPlayer } from "./useProcessedProjectionsData";
import type { PlayerVorpMetrics } from "./useVORPCalculations";
import {
  groupPlayerEligibility,
  normalizePlayerEligibility,
  type ForwardGrouping
} from "lib/draftDashboard/forwardGrouping";
import { STATS_MASTER_LIST } from "lib/projectionsConfig/statsMasterList";

export interface Recommendation {
  player: ProcessedPlayer;
  score: number; // ranking score (default based on VBD with optional need weighting)
  vorp?: number;
  vona?: number;
  vbd?: number;
  availability?: number; // 0-1 probability player is available by next pick
  fitScore?: number; // aggregated team-need fit metric
  reasonTags?: string[];
}

interface Args {
  players: ProcessedPlayer[];
  vorpMetrics?: Map<string, PlayerVorpMetrics>;
  posNeeds?: Record<string, number>; // by position (C,LW,RW,D,G)
  catNeeds?: Record<string, number>; // by category when in categories mode
  needWeightEnabled?: boolean;
  needAlpha?: number; // 0..1 weight toward needs
  limit?: number;
  baselineMode?: "remaining" | "full"; // for future context/labeling
  currentPick?: number;
  teamCount?: number;
  nextPickNumber?: number;
  riskSd?: number;
  leagueType?: "points" | "categories";
  categoryWeights?: Record<string, number>;
  categoryTeamTotals?: readonly Record<string, number | null | undefined>[];
  myCategoryTotals?: Record<string, number | null | undefined>;
  categoryPlayerPool?: ProcessedPlayer[];
  forwardGrouping?: ForwardGrouping;
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

export function normalCdf(z: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = Math.exp((-z * z) / 2) / Math.sqrt(2 * Math.PI);
  const p =
    d *
    (0.31938153 * t -
      0.356563782 * Math.pow(t, 2) +
      1.781477937 * Math.pow(t, 3) -
      1.821255978 * Math.pow(t, 4) +
      1.330274429 * Math.pow(t, 5));
  return z >= 0 ? 1 - p : p;
}

export function estimateAvailability(
  adp: unknown,
  actualNextPick: unknown,
  riskSd = 12,
): number | undefined {
  if (
    typeof adp !== "number" ||
    !Number.isFinite(adp) ||
    adp <= 0 ||
    typeof actualNextPick !== "number" ||
    !Number.isFinite(actualNextPick) ||
    actualNextPick <= 0
  ) {
    return undefined;
  }
  const sd = Number.isFinite(riskSd) ? Math.max(2, Math.min(40, riskSd)) : 12;
  return clamp01(normalCdf((adp - actualNextPick) / sd));
}

function safeNum(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export function usePlayerRecommendations({
  players,
  vorpMetrics,
  posNeeds = {},
  catNeeds = {},
  needWeightEnabled = false,
  needAlpha = 0.5,
  limit = 10,
  baselineMode,
  currentPick,
  teamCount,
  nextPickNumber,
  riskSd = 12,
  leagueType = "points",
  categoryWeights = {},
  categoryTeamTotals = [],
  myCategoryTotals = {},
  categoryPlayerPool = players,
  forwardGrouping = "split"
}: Args) {
  const recommendations = useMemo<Recommendation[]>(() => {
    if (!players || players.length === 0) return [];

    const categoryFitByPlayerId = new Map<string, number>();
    if (leagueType === "categories") {
      for (const [key, weight] of Object.entries(categoryWeights)) {
        if (!Number.isFinite(weight) || weight === 0) continue;
        const definition = STATS_MASTER_LIST.find((stat) => stat.key === key);
        if (!definition) continue;
        const eligiblePool = categoryPlayerPool.filter((player) => {
          const isGoalie = normalizePlayerEligibility(
            player.displayPosition,
            player.eligiblePositions,
          ).includes("G");
          return definition.isGoalieStat && !definition.isSkaterStat
            ? isGoalie
            : definition.isSkaterStat && !definition.isGoalieStat
              ? !isGoalie
              : true;
        });
        const teamValues = categoryTeamTotals
          .map((totals) => totals[key])
          .filter((value): value is number =>
            typeof value === "number" && Number.isFinite(value),
          );
        const myValue = myCategoryTotals[key];
        if (
          teamValues.length < 2 ||
          typeof myValue !== "number" ||
          !Number.isFinite(myValue)
        ) continue;
        const teamMean = teamValues.reduce((sum, value) => sum + value, 0) /
          teamValues.length;
        const teamVariance = teamValues.reduce(
          (sum, value) => sum + (value - teamMean) ** 2,
          0,
        ) / (teamValues.length - 1);
        const teamDeviation = Math.sqrt(teamVariance);
        if (!Number.isFinite(teamDeviation) || teamDeviation <= 0) continue;
        const direction =
          (definition.higherIsBetter ? 1 : -1) * Math.sign(weight);
        const deficit = Math.max(
          0,
          (direction * (teamMean - myValue)) / teamDeviation,
        );
        if (deficit <= 0) continue;
        const playerValues = eligiblePool
          .map((player) => (player.combinedStats as any)?.[key]?.projected)
          .filter((value): value is number =>
            typeof value === "number" && Number.isFinite(value),
          );
        if (playerValues.length < 2) continue;
        const playerMean = playerValues.reduce((sum, value) => sum + value, 0) /
          playerValues.length;
        const playerVariance = playerValues.reduce(
          (sum, value) => sum + (value - playerMean) ** 2,
          0,
        ) / (playerValues.length - 1);
        const playerDeviation = Math.sqrt(playerVariance);
        if (!Number.isFinite(playerDeviation) || playerDeviation <= 0) continue;
        const eligiblePlayerIds = new Set(
          eligiblePool.map((player) => String(player.playerId)),
        );
        for (const player of players) {
          if (!eligiblePlayerIds.has(String(player.playerId))) continue;
          const value = (player.combinedStats as any)?.[key]?.projected;
          if (typeof value !== "number" || !Number.isFinite(value)) continue;
          const contribution = Math.max(
            0,
            (direction * (value - playerMean)) / playerDeviation,
          );
          if (contribution <= 0) continue;
          const id = String(player.playerId);
          categoryFitByPlayerId.set(
            id,
            (categoryFitByPlayerId.get(id) ?? 0) +
              deficit * contribution * Math.abs(weight),
          );
        }
      }
    }

    const items: Recommendation[] = players.map((p) => {
      const id = String(p.playerId);
      const vm = vorpMetrics?.get(id);
      const vbd = vm?.vbd ?? vm?.vorp ?? 0;
      const vorp = vm?.vorp ?? 0;
      const vona = vm?.vona ?? 0;

      // Team needs fit: categories or positional
      let fit = 0;
      if (leagueType === "categories") {
        fit = categoryFitByPlayerId.get(id) ?? 0;
      } else {
        // positional need: average need across eligible positions
        const elig = groupPlayerEligibility(
          normalizePlayerEligibility(p.displayPosition, p.eligiblePositions),
          forwardGrouping
        );
        if (elig.length > 0) {
          const sum = elig.reduce(
            (acc, pos) => acc + safeNum(posNeeds[pos]),
            0
          );
          fit = sum / elig.length;
        } else {
          fit = 0;
        }
      }

      // Availability heuristic: probability player survives until next pick
      let availability: number | undefined = undefined;
      const adp = (p as any).yahooAvgPick ?? (p as any).adp;
      availability = estimateAvailability(adp, nextPickNumber, riskSd);

      return {
        player: p,
        score: 0.7 * vbd + 0.3 * vona,
        vorp,
        vona,
        vbd,
        availability,
        fitScore: fit,
        reasonTags: []
      } as Recommendation;
    });

    // Normalize fit and blend
    const maxAbsFit =
      items.reduce((m, r) => Math.max(m, Math.abs(r.fitScore || 0)), 0) || 1;
    for (const r of items) {
      const fitNorm = clamp01((r.fitScore || 0) / maxAbsFit);
      const baseValue = 0.7 * (r.vbd ?? 0) + 0.3 * (r.vona ?? 0);
      if (needWeightEnabled) {
        r.score = baseValue * (1 + clamp01(needAlpha) * fitNorm);
      } else {
        r.score = baseValue;
      }
      const tags: string[] = [];
      tags.push(`VBD ${(r.vbd ?? 0).toFixed(1)}`);
      tags.push(`VONA ${(r.vona ?? 0).toFixed(1)}`);
      if (baselineMode === "remaining" || baselineMode === "full") {
        tags.push(
          baselineMode === "remaining" ? "Remaining pool" : "Full pool"
        );
      }
      if (needWeightEnabled && fitNorm > 0) {
        tags.push(
          `${leagueType === "categories" ? "Category" : "Roster"} need ${Math.round(fitNorm * 100)}%`
        );
      }
      if (typeof (r.player as any).yahooAvgPick === "number") {
        const adp = (r.player as any).yahooAvgPick as number;
        const expPick = nextPickNumber;
        if (expPick && adp > expPick + 5) tags.push("ADP Value");
      }
      r.reasonTags = tags;
    }

    // Sort by score desc; tie-breaker by fantasy points then name
    items.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const afp = safeNum(a.player.fantasyPoints?.projected);
      const bfp = safeNum(b.player.fantasyPoints?.projected);
      if (bfp !== afp) return bfp - afp;
      const an = (a.player as any).fullName || String(a.player.playerId);
      const bn = (b.player as any).fullName || String(b.player.playerId);
      return an.localeCompare(bn);
    });

    return items.slice(0, limit);
  }, [
    players,
    vorpMetrics,
    posNeeds,
    catNeeds,
    needWeightEnabled,
    needAlpha,
    limit,
    baselineMode,
    currentPick,
    teamCount,
    nextPickNumber,
    riskSd,
    leagueType,
    categoryWeights,
    categoryTeamTotals,
    myCategoryTotals,
    categoryPlayerPool,
    forwardGrouping
  ]);

  return { recommendations };
}
