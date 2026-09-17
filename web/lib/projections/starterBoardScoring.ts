import { DEFAULT_GOALIE_FANTASY_POINTS, DEFAULT_SKATER_FANTASY_POINTS } from "lib/projectionsConfig/fantasyPointsConfig";
import { addStartChartPositionRanks } from "./startChartFantasyScoring";
import type { SeasonBootstrapDisclosure } from "./seasonBootstrap";

export type BoardStats = Record<string, number | null>;
export type BoardScoringProfile = { skater: Record<string, number>; goalie: Record<string, number> };
export const DEFAULT_BOARD_SCORING: BoardScoringProfile = { skater: DEFAULT_SKATER_FANTASY_POINTS, goalie: DEFAULT_GOALIE_FANTASY_POINTS };
export const BOARD_CATEGORIES = ["GOALS", "ASSISTS", "PP_POINTS", "SHOTS_ON_GOAL", "HITS", "BLOCKED_SHOTS", "PENALTY_MINUTES", "TIME_ON_ICE_PER_GAME", "SAVES_GOALIE", "GOALS_AGAINST_GOALIE", "WINS_GOALIE", "SHUTOUTS_GOALIE", "SHOTS_AGAINST_GOALIE"] as const;
export type BoardScoringRequest = { profile: BoardScoringProfile; mode: "points" | "categories"; category: string | null; goalieSort: "fantasy" | "start_probability" };
export type BoardForecast = {
  conditioning: "conditional_playing" | "unconditional" | "legacy_unclassified";
  participationProbability: number | null;
  probabilityStatus: "missing" | "uncalibrated_model" | "confirmed_evidence";
  conditional: BoardStats | null;
  expected: BoardStats | null;
  legacy?: BoardStats | null;
  distributionStatus: "means_only_unvalidated";
  nonStartAssumption?: "zero_relief_minutes";
  ppRole?: string | null;
  evidence: Array<{ dimension: string; value: string; publishedAt: string; receivedAt: string }>;
  conflicts: string[];
  seasonBootstrap?: SeasonBootstrapDisclosure | null;
  previous?: { revisionId: string; stats: BoardStats; changedInputs: string[] } | null;
};

export function parseBoardScoringRequest(input: unknown): BoardScoringRequest {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Scoring request must be an object");
  const body = input as Record<string, any>;
  const mode = body.mode ?? "points";
  if (!["points", "categories"].includes(mode)) throw new Error("Unknown scoring mode");
  if (mode === "categories" && !BOARD_CATEGORIES.includes(body.category)) throw new Error("Unsupported or missing category");
  const profile: BoardScoringProfile = { skater: {}, goalie: {} };
  for (const population of ["skater", "goalie"] as const) {
    const weights = body.profile?.[population] ?? DEFAULT_BOARD_SCORING[population];
    if (!weights || typeof weights !== "object" || Array.isArray(weights)) throw new Error("Scoring weights must be an object");
    for (const [key, value] of Object.entries(weights)) {
      if (!Object.prototype.hasOwnProperty.call(DEFAULT_BOARD_SCORING[population], key)) throw new Error(`Unsupported scoring category: ${key}`);
      if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > 100) throw new Error(`Invalid scoring weight: ${key}`);
      profile[population][key] = value;
    }
  }
  const goalieSort = body.goalieSort ?? "fantasy";
  if (goalieSort !== "fantasy" && goalieSort !== "start_probability") throw new Error("Unknown goalie sort");
  return { profile, mode, category: mode === "categories" ? body.category : null, goalieSort };
}

export function scoreBoardStats(stats: BoardStats | null, weights: Record<string, number>) {
  const missingCategories: string[] = [];
  let points = 0;
  for (const [key, weight] of Object.entries(weights)) {
    if (weight === 0) continue;
    const value = stats?.[key];
    if (value == null || !Number.isFinite(value)) missingCategories.push(key);
    else points += value * weight;
  }
  return { points: missingCategories.length ? null : Number(points.toFixed(4)), missingCategories };
}

export function integrateBoardParticipation(conditional: BoardStats, probability: number | null): BoardStats | null {
  if (probability == null) return null;
  if (!Number.isFinite(probability) || probability < 0 || probability > 1) throw new Error("Invalid participation probability");
  return Object.fromEntries(Object.entries(conditional).map(([key, value]) => [key, value == null ? null : value * probability]));
}

export function boardSkaterForecast(row: any, uncertainty: any): BoardForecast {
  const selection = uncertainty?.model?.skater_selection;
  const conditional = selection?.production_conditioning === "conditional_playing";
  const explicitOut = selection?.production_conditioning === "explicit_out";
  const stats = { GOALS: row.proj_goals, ASSISTS: row.proj_assists, PP_POINTS: row.proj_pp_points,
    SHOTS_ON_GOAL: row.proj_shots, HITS: row.proj_hits, BLOCKED_SHOTS: row.proj_blocks,
    PENALTY_MINUTES: row.proj_pim, TIME_ON_ICE_PER_GAME: row.proj_toi_minutes };
  return {
    conditioning: explicitOut ? "unconditional" : conditional ? "conditional_playing" : "legacy_unclassified",
    participationProbability: explicitOut ? 0 : null, probabilityStatus: explicitOut ? "confirmed_evidence" : "missing", expected: explicitOut ? stats : null,
    conditional: conditional ? stats : null, legacy: conditional || explicitOut ? null : stats,
    distributionStatus: "means_only_unvalidated", ppRole: selection?.pp_role ?? null,
    evidence: (selection?.same_day_evidence?.assertions ?? []).map((item: any) => ({
      dimension: String(item.dimension), value: String(item.value), publishedAt: String(item.publishedAt), receivedAt: String(item.receivedAt),
    })),
    conflicts: (selection?.same_day_evidence?.conflicts ?? []).map((item: any) => String(item.dimension)),
    seasonBootstrap: selection?.season_bootstrap ?? null,
  };
}

export function boardGoalieForecast(candidate: any): BoardForecast | null {
  if (!candidate?.conditional || typeof candidate.startingProbability !== "number") return null;
  const conditional: BoardStats = Object.fromEntries(BOARD_CATEGORIES.filter((key) => key.endsWith("_GOALIE"))
    .map((key) => [key, typeof candidate.conditional[key] === "number" && Number.isFinite(candidate.conditional[key]) ? candidate.conditional[key] : null]));
  return { conditioning: "unconditional", participationProbability: candidate.startingProbability,
    probabilityStatus: candidate.probabilityStatus === "confirmed_evidence" ? "confirmed_evidence" : "uncalibrated_model",
    conditional, expected: integrateBoardParticipation(conditional, candidate.startingProbability),
    nonStartAssumption: "zero_relief_minutes", distributionStatus: "means_only_unvalidated", evidence: [], conflicts: [],
    seasonBootstrap: candidate.seasonBootstrap ?? null };
}

export function boardSkaterStatsFromProjection(row: any) {
  const sum = (prefix: string) => {
    const values = ["es", "pp", "pk"].map((strength) => row[`${prefix}_${strength}`]).filter((value) => typeof value === "number" && Number.isFinite(value));
    return values.length ? values.reduce((a, b) => a + b, 0) : null;
  };
  return { proj_goals: sum("proj_goals"), proj_assists: sum("proj_assists"), proj_shots: sum("proj_shots"),
    proj_pp_points: typeof row.proj_goals_pp === "number" && typeof row.proj_assists_pp === "number" ? row.proj_goals_pp + row.proj_assists_pp : null,
    proj_hits: row.proj_hits ?? null, proj_blocks: row.proj_blocks ?? null, proj_pim: row.proj_pim ?? null,
    proj_toi_minutes: [row.proj_toi_es_seconds, row.proj_toi_pp_seconds, row.proj_toi_pk_seconds].every((value) => typeof value === "number")
      ? (row.proj_toi_es_seconds + row.proj_toi_pp_seconds + row.proj_toi_pk_seconds) / 60 : null };
}

export function attachPreviousBoardForecast(current: BoardForecast | null, previous: BoardForecast | null, revisionId: string) {
  if (!current || !previous || current.conditioning !== previous.conditioning) return;
  const stats = previous.expected ?? previous.conditional ?? previous.legacy;
  if (!stats) return;
  current.previous = { revisionId, stats,
    changedInputs: [...new Set([...current.evidence, ...previous.evidence].map((item) => item.dimension))]
      .filter((dimension) => current.evidence.find((item) => item.dimension === dimension)?.value !== previous.evidence.find((item) => item.dimension === dimension)?.value),
  };
  if (current.participationProbability !== previous.participationProbability) current.previous.changedInputs.push("participation_probability");
}

export function scoreStarterBoardPayload<T extends { players: any[] }>(payload: T, request: BoardScoringRequest) {
  const players = payload.players.map((player) => {
    const goalie = player.positions.includes("G");
    const forecast: BoardForecast | undefined = player.forecast;
    const stats = forecast?.expected ?? forecast?.conditional ?? forecast?.legacy ?? null;
    const weights = request.profile[goalie ? "goalie" : "skater"];
    const score = scoreBoardStats(stats, weights);
    const previousPoints = forecast?.previous ? scoreBoardStats(forecast.previous.stats, weights).points : null;
    const categoryValue = request.category ? stats?.[request.category] ?? null : null;
    const previousValue = request.mode === "categories" && request.category ? forecast?.previous?.stats[request.category] ?? null : previousPoints;
    const currentValue = request.mode === "categories" ? categoryValue : score.points;
    const sortValue = request.mode === "categories" ? categoryValue
      : goalie && request.goalieSort === "start_probability" ? player.start_probability : score.points;
    return { ...player, proj_fantasy_points: score.points, boardScore: {
      points: score.points, missingCategories: score.missingCategories,
      change: currentValue != null && previousValue != null ? Number((currentValue - previousValue).toFixed(4)) : null,
      basis: forecast?.conditioning ?? "legacy_unclassified", categoryValue,
      sortValue: sortValue == null ? null : (request.category === "GOALS_AGAINST_GOALIE" ? -sortValue : sortValue),
    } };
  });
  return { ...payload,
    scoringProfile: { ...request, id: JSON.stringify([Object.entries(request.profile.skater).sort(), Object.entries(request.profile.goalie).sort()]) },
    rankingContract: { version: "starter-board-ranking-v3", scope: "eligible_position", tieMethod: "competition",
      scoreFields: { skater: request.mode === "categories" ? "category_value" : "proj_fantasy_points", goalie: request.mode === "categories" ? "category_value" : request.goalieSort === "fantasy" ? "proj_fantasy_points" : "start_probability" },
      unavailable: { categoryMode: false, riskP75: true } },
    players: addStartChartPositionRanks(players, (player) => player.boardScore.sortValue),
  };
}
