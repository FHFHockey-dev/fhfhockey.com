import type { SelectionHorizon } from "lib/draftDashboard/availability";
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
import type { RecommendationCandidate } from "lib/draft-pro/recommendations";

export interface Recommendation {
  player: ProcessedPlayer;
  score: number; // ranking score (default based on VBD with optional need weighting)
  value?: number; // canonical player value used by schedule-fit DUST requests
  vorp?: number;
  vona?: number;
  vbd?: number;
  availability?: number; // 0-1 probability player is available by next pick
  fitScore?: number; // aggregated team-need fit metric
  reasonTags?: string[];
}

interface Args {
  selectionHorizon?: SelectionHorizon | null;
  availabilitySpread?: number;
  players: ProcessedPlayer[];
  vorpMetrics?: Map<string, PlayerVorpMetrics>;
  /** A separately calculated filled-roster replacement map; never mutate global table VORP. */
  personalizedVorpMetrics?: Map<string, PlayerVorpMetrics>;
  usePersonalizedReplacement?: boolean;
  posNeeds?: Record<string, number>; // by position (C,LW,RW,D,G)
  catNeeds?: Record<string, number>; // by category when in categories mode
  categoryWeights?: Record<string, number>;
  needWeightEnabled?: boolean;
  needAlpha?: number; // 0..1 weight toward needs
  limit?: number;
  baselineMode?: "remaining" | "full"; // for future context/labeling
  currentPick?: number; // absolute pick number
  teamCount?: number; // league size for availability heuristic
  leagueType?: "points" | "categories";
  forwardGrouping?: ForwardGrouping;
}

export function buildRecommendationCandidates({
  players,
  vorpMetrics,
  personalizedVorpMetrics,
  usePersonalizedReplacement,
  forwardGrouping,
}: Pick<Args, "players" | "vorpMetrics" | "personalizedVorpMetrics" | "usePersonalizedReplacement" | "forwardGrouping">): RecommendationCandidate[] {
  return players.map((player) => {
    const id = String(player.playerId);
    const globalVm = vorpMetrics?.get(id);
    const suggestionVm = (usePersonalizedReplacement ? personalizedVorpMetrics : undefined)?.get(id) ?? globalVm;
    const vbd = suggestionVm?.vbd ?? suggestionVm?.vorp ?? 0;
    const eligiblePositions = groupPlayerEligibility(
      normalizePlayerEligibility(player.displayPosition, player.eligiblePositions),
      forwardGrouping ?? "split",
    );
    return {
      id,
      name: player.fullName || id,
      role: eligiblePositions.includes("G") ? "goalie" : "skater",
      eligiblePositions,
      globalVorp: globalVm?.vorp ?? 0,
      rankValue: vbd,
      baselineScore: 0.7 * vbd + 0.3 * (suggestionVm?.vona ?? 0),
      tieBreaker: player.fantasyPoints?.projected ?? 0,
      categoryValues: Object.fromEntries(Object.entries(player.combinedStats ?? {}).flatMap(([key, value]) =>
        typeof value?.projected === "number" && Number.isFinite(value.projected) ? [[key, value.projected]] : [],
      )),
      adp: player.yahooAvgPick,
    };
  });
}

export function usePlayerRecommendations({
  players,
  vorpMetrics,
  personalizedVorpMetrics,
  usePersonalizedReplacement = false,
  posNeeds = {},
  catNeeds = {},
  categoryWeights = {},
  needWeightEnabled = false,
  needAlpha = 0.5,
  limit = 10,
  baselineMode,
  currentPick,
  teamCount,
  selectionHorizon,
  availabilitySpread,
  leagueType = "points",
  forwardGrouping = "split"
}: Args) {
  const recommendations = useMemo<Recommendation[]>(() => {
    if (!players || players.length === 0) return [];
    const candidates = buildRecommendationCandidates({ players, vorpMetrics, personalizedVorpMetrics, usePersonalizedReplacement, forwardGrouping });
    const personalized = buildPersonalizedRecommendations(candidates, {
      leagueType,
      positionNeeds: posNeeds,
      categoryNeeds: catNeeds,
      categoryWeights,
      needAlpha: needWeightEnabled ? needAlpha : 0,
      currentPick,
      teamCount,
      selectionHorizon,
      availabilitySpread,
      limit,
    });
    const playerById = new Map(players.map((player) => [String(player.playerId), player]));
    return personalized.flatMap((result) => {
      const player = playerById.get(result.candidate.id);
      if (!player) return [];
      const globalVm = vorpMetrics?.get(result.candidate.id);
      const suggestionVm = (usePersonalizedReplacement ? personalizedVorpMetrics : undefined)?.get(result.candidate.id) ?? globalVm;
      const tags = [`VBD ${(suggestionVm?.vbd ?? 0).toFixed(1)}`, `VONA ${(suggestionVm?.vona ?? 0).toFixed(1)}`];
      if (baselineMode) tags.push(baselineMode === "remaining" ? "Remaining pool" : "Full pool");
      return [{ player, score: result.recommendationScore, value: suggestionVm?.value ?? player.fantasyPoints?.projected ?? 0, vorp: result.globalVorp, vona: suggestionVm?.vona ?? 0, vbd: suggestionVm?.vbd ?? 0, availability: result.availabilityEstimate ?? undefined, reasonTags: [...tags, ...result.reasons] }];
    });
  }, [
    players,
    vorpMetrics,
    personalizedVorpMetrics,
    usePersonalizedReplacement,
    posNeeds,
    catNeeds,
    categoryWeights,
    needWeightEnabled,
    needAlpha,
    limit,
    baselineMode,
    currentPick,
    teamCount,
    selectionHorizon,
    availabilitySpread,
    leagueType,
    forwardGrouping
  ]);

  return { recommendations };
}
