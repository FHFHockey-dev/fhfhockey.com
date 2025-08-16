// filepath: /Users/tim/Desktop/fhfhockey.com/web/hooks/usePlayerRecommendations.ts
// Computes top-N recommended players based on VORP/VBD and optional team needs weighting.
// Lightweight and memoized. Safe in absence of some fields.

import { useMemo } from "react";
import type { ProcessedPlayer } from "./useProcessedProjectionsData";
import type { PlayerVorpMetrics } from "./useVORPCalculations";

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
  currentPick?: number; // absolute pick number
  teamCount?: number; // league size for availability heuristic
  leagueType?: "points" | "categories";
}

const CAT_KEYS = [
  "GOALS",
  "ASSISTS",
  "PP_POINTS",
  "SHOTS_ON_GOAL",
  "HITS",
  "BLOCKED_SHOTS"
] as const;

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function logistic(x: number) {
  return 1 / (1 + Math.exp(-x));
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
  leagueType = "points"
}: Args) {
  const recommendations = useMemo<Recommendation[]>(() => {
    if (!players || players.length === 0) return [];

    const items: Recommendation[] = players.map((p) => {
      const id = String(p.playerId);
      const vm = vorpMetrics?.get(id);
      const vbd = vm?.vbd ?? vm?.vorp ?? 0; // fallback if needed
      const vorp = vm?.vorp;
      const vona = vm?.vona;

      // Team needs fit: categories or positional
      let fit = 0;
      if (leagueType === "categories") {
        for (const k of CAT_KEYS) {
          const playerVal = safeNum((p.combinedStats as any)?.[k]?.projected);
          const w = safeNum(catNeeds[k]);
          fit += playerVal * w;
        }
      } else {
        // positional need: average need across eligible positions
        const elig = (p.displayPosition || "")
          .split(",")
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean);
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
      const adp = safeNum((p as any).yahooAvgPick ?? (p as any).adp);
      if (currentPick && teamCount && teamCount > 0 && adp > 0) {
        const picksUntilNext = teamCount;
        const targetPick = currentPick + picksUntilNext;
        const delta = adp - targetPick; // positive = likely to be available
        const sd = 12;
        availability = clamp01(logistic(delta / sd));
        availability = Math.min(0.99, Math.max(0.01, availability));
      }

      return {
        player: p,
        score: vbd,
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
      const fitNorm = (r.fitScore || 0) / maxAbsFit; // -1..1 or 0..1
      if (needWeightEnabled) {
        r.score = (1 - needAlpha) * (r.vbd ?? 0) + needAlpha * fitNorm * 10; // scale
      } else {
        r.score = r.vbd ?? 0;
      }
      const tags: string[] = [];
      if ((r.vbd ?? 0) > 0) tags.push("High VBD");
      if (
        (r.vorp ?? 0) > 0 &&
        (baselineMode === "remaining" || baselineMode === "full")
      )
        tags.push(
          baselineMode === "remaining"
            ? "Remaining Baseline"
            : "Full-Pool Baseline"
        );
      if (r.fitScore && Math.abs(r.fitScore) > 0.1 * maxAbsFit)
        tags.push(leagueType === "categories" ? "Cat Fit" : "Team Need Fit");
      if (typeof (r.player as any).yahooAvgPick === "number") {
        const adp = (r.player as any).yahooAvgPick as number;
        const expPick = currentPick
          ? currentPick + (teamCount || 0)
          : undefined;
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
    leagueType
  ]);

  return { recommendations };
}
