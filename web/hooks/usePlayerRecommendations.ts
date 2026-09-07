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
import { buildPersonalizedRecommendations } from "lib/draft-pro/recommendations";

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
  /** A separately calculated filled-roster replacement map; never mutate global table VORP. */
  personalizedVorpMetrics?: Map<string, PlayerVorpMetrics>;
  usePersonalizedReplacement?: boolean;
  posNeeds?: Record<string, number>; // by position (C,LW,RW,D,G)
  catNeeds?: Record<string, number>; // by category when in categories mode
  needWeightEnabled?: boolean;
  needAlpha?: number; // 0..1 weight toward needs
  limit?: number;
  baselineMode?: "remaining" | "full"; // for future context/labeling
  currentPick?: number; // absolute pick number
  teamCount?: number; // league size for availability heuristic
  leagueType?: "points" | "categories";
  forwardGrouping?: ForwardGrouping;
}

export function usePlayerRecommendations({
  players,
  vorpMetrics,
  personalizedVorpMetrics,
  usePersonalizedReplacement = false,
  posNeeds = {},
  catNeeds = {},
  needWeightEnabled = false,
  needAlpha = 0.5,
  limit = 10,
  baselineMode,
  currentPick,
  teamCount,
  leagueType = "points",
  forwardGrouping = "split"
}: Args) {
  const recommendations = useMemo<Recommendation[]>(() => {
    if (!players || players.length === 0) return [];
    const candidates = players.map((p) => {
      const id = String(p.playerId);
      const vm = (usePersonalizedReplacement ? personalizedVorpMetrics : undefined)?.get(id) ?? vorpMetrics?.get(id);
      const vbd = vm?.vbd ?? vm?.vorp ?? 0;
      return {
        id,
        name: p.fullName || id,
        role: groupPlayerEligibility(
          normalizePlayerEligibility(p.displayPosition, p.eligiblePositions),
          forwardGrouping,
        ).includes("G") ? "goalie" as const : "skater" as const,
        eligiblePositions: groupPlayerEligibility(
          normalizePlayerEligibility(p.displayPosition, p.eligiblePositions),
          forwardGrouping,
        ),
        globalVorp: vm?.vorp ?? 0,
        rankValue: vbd,
        baselineScore: 0.7 * vbd + 0.3 * (vm?.vona ?? 0),
        categoryValues: Object.fromEntries(Object.entries(p.combinedStats ?? {}).flatMap(([key, value]) =>
          typeof value?.projected === "number" && Number.isFinite(value.projected) ? [[key, value.projected]] : [],
        )),
        adp: p.yahooAvgPick,
      };
    });
    const personalized = buildPersonalizedRecommendations(candidates, {
      leagueType,
      positionNeeds: posNeeds,
      categoryNeeds: catNeeds,
      // The current dashboard sends category need pressure; category scoring
      // weights arrive with the VORP metrics and will be passed by W07.
      categoryWeights: leagueType === "categories" ? Object.fromEntries(Object.keys(catNeeds).map((key) => [key, 1])) : undefined,
      needAlpha: needWeightEnabled ? needAlpha : 0,
      currentPick,
      teamCount,
      limit,
    });
    const playerById = new Map(players.map((player) => [String(player.playerId), player]));
    return personalized.flatMap((result) => {
      const player = playerById.get(result.candidate.id);
      if (!player) return [];
      const vm = (usePersonalizedReplacement ? personalizedVorpMetrics : undefined)?.get(result.candidate.id) ?? vorpMetrics?.get(result.candidate.id);
      const tags = [`VBD ${(vm?.vbd ?? 0).toFixed(1)}`, `VONA ${(vm?.vona ?? 0).toFixed(1)}`];
      if (baselineMode) tags.push(baselineMode === "remaining" ? "Remaining pool" : "Full pool");
      return [{ player, score: result.recommendationScore, vorp: result.globalVorp, vona: vm?.vona ?? 0, vbd: vm?.vbd ?? 0, availability: result.availabilityEstimate ?? undefined, reasonTags: [...tags, ...result.reasons] }];
    });
  }, [
    players,
    vorpMetrics,
    personalizedVorpMetrics,
    usePersonalizedReplacement,
    posNeeds,
    catNeeds,
    needWeightEnabled,
    needAlpha,
    limit,
    baselineMode,
    currentPick,
    teamCount,
    leagueType,
    forwardGrouping
  ]);

  return { recommendations };
}
