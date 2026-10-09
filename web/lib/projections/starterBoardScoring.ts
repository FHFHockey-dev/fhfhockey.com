import { DEFAULT_GOALIE_FANTASY_POINTS, DEFAULT_SKATER_FANTASY_POINTS } from "lib/projectionsConfig/fantasyPointsConfig";
import { addStartChartPositionRanks } from "./startChartFantasyScoring";
import type { SeasonBootstrapDisclosure } from "./seasonBootstrap";
import type { DailyBoardEvidence } from "./dailyBoardEvidence";
import type { GameForecast } from "../rosterScheduleOptimizer/planningTypes";
import { acceptedNewsSupersedes } from "./evidenceTime";

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

export type BoardEvidenceContext = {
  gameId: number; teamId: number; playerId: number; horizonGames: number;
  cutoffAt: string | null;
  evidence?: DailyBoardEvidence;
};

/** Resolved evidence still needs exact identity/time binding when decoded from storage. */
function scopedEvidence(value: DailyBoardEvidence | undefined, identity: {
  gameId: number; teamId: number; playerId: number; cutoffAt: string | null;
}): DailyBoardEvidence | null {
  const cutoff = identity.cutoffAt;
  if (![identity.gameId, identity.teamId, identity.playerId].every(id => Number.isSafeInteger(id) && id > 0)
    || !cutoff || acceptedNewsSupersedes(cutoff, cutoff)
    || !value?.informationCutoffAt || acceptedNewsSupersedes(value.informationCutoffAt, cutoff)
    || acceptedNewsSupersedes(cutoff, value.informationCutoffAt)
    || !Array.isArray(value.assertions) || !Array.isArray(value.conflicts)
    || value.assertions.length > 20000 || value.conflicts.length > 2000
    || value.assertions.some(item => !item || ![item.gameId, item.teamId, item.playerId].every(id => Number.isSafeInteger(id) && id > 0))
    || value.conflicts.some(item => !item || ![item.gameId, item.teamId].every(id => Number.isSafeInteger(id) && id > 0)
      || item.playerId !== null && (!Number.isSafeInteger(item.playerId) || item.playerId <= 0))) return null;
  const assertions = value.assertions.filter(item => item.gameId === identity.gameId && item.teamId === identity.teamId && item.playerId === identity.playerId);
  const conflicts = value.conflicts.filter(item => item.gameId === identity.gameId && item.teamId === identity.teamId
    && (item.playerId === null || item.playerId === identity.playerId));
  if (assertions.some(item => typeof item.evidenceId !== "string" || !item.evidenceId || typeof item.sourceKey !== "string" || !item.sourceKey
    || typeof item.value !== "string" || !item.value || typeof item.confirmed !== "boolean"
    || !["ev", "pp", "availability", "goalie"].includes(item.dimension)
    || acceptedNewsSupersedes(item.publishedAt, cutoff) || acceptedNewsSupersedes(item.receivedAt, cutoff)
    || acceptedNewsSupersedes(item.publishedAt, item.receivedAt))
    || conflicts.some(item => !["ev", "pp", "availability", "goalie"].includes(item.dimension) || !Array.isArray(item.evidenceIds)
      || item.evidenceIds.some(id => typeof id !== "string" || !id))) return null;
  return { informationCutoffAt: cutoff, assertions, conflicts };
}

function assertionKeys(evidence: DailyBoardEvidence): string[] {
  return evidence.assertions.map(item => JSON.stringify([item.gameId, item.teamId, item.playerId, item.dimension, item.value,
    item.confirmed, item.evidenceId, item.sourceKey, item.sourceUrl, item.publishedAt, item.receivedAt])).sort();
}

/** A confirmed return/PP role is not a confirmed appearance. Only a confirmed
 * full-strength lineup or explicit exclusion can establish this evidence branch. */
export function skaterParticipationFromEvidence(evidence: DailyBoardEvidence | undefined,
  identity: { gameId: number; teamId: number; playerId: number }) {
  evidence = scopedEvidence(evidence, { ...identity, cutoffAt: evidence?.informationCutoffAt ?? null }) ?? undefined;
  const relevant = (item: { gameId: number; teamId: number; playerId: number | null }) =>
    item.gameId === identity.gameId && item.teamId === identity.teamId && (item.playerId === null || item.playerId === identity.playerId);
  if (!evidence || evidence.conflicts.some(item => relevant(item) && ["ev", "availability"].includes(item.dimension))) return null;
  const assertions = evidence.assertions.filter(item => relevant(item) && item.confirmed);
  const out = assertions.filter(item => item.dimension === "availability" && item.value === "out");
  const playing = assertions.filter(item => item.dimension === "ev");
  if (out.length && playing.length || !out.length && !playing.length) return null;
  return { version: "skater-participation-v1", probability: out.length ? 0 : 1,
    status: "confirmed_evidence", evidenceIds: (out.length ? out : playing).map(item => item.evidenceId).sort() };
}

export function boardSkaterForecast(row: any, uncertainty: any, context?: BoardEvidenceContext): BoardForecast {
  const selection = uncertainty?.model?.skater_selection;
  const conditional = selection?.production_conditioning === "conditional_playing";
  const explicitOut = selection?.production_conditioning === "explicit_out";
  const participation = selection?.participation;
  const identity = context ?? { ...row.identity, gameId: row.identity?.gameId ?? row.game_id,
    teamId: row.identity?.teamId ?? row.team_id, playerId: row.identity?.playerId ?? row.player_id,
    horizonGames: row.identity?.horizonGames ?? row.horizon_games, cutoffAt: selection?.evidence_cutoff_at ?? null };
  const rowIdentity = row.identity ?? { gameId: row.game_id, teamId: row.team_id, playerId: row.player_id, horizonGames: row.horizon_games };
  const identityMatches = (["gameId", "teamId", "playerId", "horizonGames"] as const)
    .every(key => rowIdentity[key] === undefined || rowIdentity[key] === identity[key]);
  const stored = identityMatches && identity.horizonGames === 1 ? scopedEvidence({ ...selection?.same_day_evidence,
    informationCutoffAt: selection?.evidence_cutoff_at }, identity) : null;
  const source = context && Object.hasOwn(context, "evidence") ? scopedEvidence(context.evidence, identity) : stored;
  const matchingAssertions = stored && source && JSON.stringify(assertionKeys(stored)) === JSON.stringify(assertionKeys(source));
  const recomputed = matchingAssertions ? skaterParticipationFromEvidence({ ...source,
    conflicts: [...source.conflicts, ...stored.conflicts] }, identity) : null;
  const idsMatch = Array.isArray(participation?.evidenceIds)
    && participation.evidenceIds.every((id: unknown) => typeof id === "string" && id)
    && JSON.stringify([...participation.evidenceIds].sort()) === JSON.stringify(recomputed?.evidenceIds);
  const scalarMatches = participation?.version === "skater-participation-v1" && participation.status === "confirmed_evidence"
    && participation.probability === recomputed?.probability
    && (selection.participation_probability === undefined || selection.participation_probability === recomputed?.probability);
  const probability = recomputed && idsMatch && scalarMatches && (conditional || explicitOut && recomputed.probability === 0)
    ? recomputed.probability : null;
  const stats = { GOALS: row.proj_goals, ASSISTS: row.proj_assists, PP_POINTS: row.proj_pp_points,
    SHOTS_ON_GOAL: row.proj_shots, HITS: row.proj_hits, BLOCKED_SHOTS: row.proj_blocks,
    PENALTY_MINUTES: row.proj_pim, TIME_ON_ICE_PER_GAME: row.proj_toi_minutes };
  return {
    conditioning: probability !== null ? "unconditional" : conditional ? "conditional_playing" : "legacy_unclassified",
    participationProbability: probability, probabilityStatus: probability !== null ? "confirmed_evidence" : "missing", expected: probability !== null ? integrateBoardParticipation(stats, probability) : null,
    conditional: conditional ? stats : null, legacy: conditional || explicitOut ? null : stats,
    distributionStatus: "means_only_unvalidated", ppRole: selection?.pp_role ?? null,
    evidence: (source?.assertions ?? []).map((item: any) => ({
      dimension: String(item.dimension), value: String(item.value), publishedAt: String(item.publishedAt), receivedAt: String(item.receivedAt),
    })),
    conflicts: (source?.conflicts ?? []).map((item: any) => String(item.dimension)),
    seasonBootstrap: selection?.season_bootstrap ?? null,
  };
}

export function goalieConfirmationFromEvidence(evidence: DailyBoardEvidence | undefined,
  identity: { gameId: number; teamId: number; playerId: number; cutoffAt: string | null }) {
  const scoped = scopedEvidence(evidence, identity);
  if (!scoped) return [];
  const otherConfirmed = Array.isArray(evidence?.assertions) && evidence.assertions.some(item => item.gameId === identity.gameId && item.teamId === identity.teamId
    && item.playerId !== identity.playerId && item.dimension === "goalie" && item.value === "confirmed" && item.confirmed);
  return !otherConfirmed && !scoped.conflicts.some(item => item.dimension === "goalie")
    ? scoped.assertions.filter(item => item.dimension === "goalie" && item.value === "confirmed" && item.confirmed) : [];
}

export function boardGoalieForecast(candidate: any, context?: BoardEvidenceContext): BoardForecast | null {
  if (!candidate?.conditional || typeof candidate.startingProbability !== "number" || !Number.isFinite(candidate.startingProbability)
    || candidate.startingProbability < 0 || candidate.startingProbability > 1) return null;
  const identity = context ?? { gameId: candidate.gameId, teamId: candidate.teamId, playerId: candidate.playerId,
    horizonGames: candidate.horizonGames, cutoffAt: candidate.evidenceCutoffAt ?? null };
  const evidence = context && Object.hasOwn(context, "evidence") ? context.evidence
    : { ...candidate.sameDayEvidence, informationCutoffAt: candidate.evidenceCutoffAt };
  const identityMatches = (["gameId", "teamId", "playerId", "horizonGames"] as const)
    .every(key => candidate[key] === undefined || candidate[key] === identity[key]);
  const confirmation = identityMatches && identity.horizonGames === 1 ? goalieConfirmationFromEvidence(evidence, identity) : [];
  const conditional: BoardStats = Object.fromEntries(BOARD_CATEGORIES.filter((key) => key.endsWith("_GOALIE"))
    .map((key) => [key, typeof candidate.conditional[key] === "number" && Number.isFinite(candidate.conditional[key]) ? candidate.conditional[key] : null]));
  return { conditioning: "unconditional", participationProbability: candidate.startingProbability,
    probabilityStatus: confirmation.length ? "confirmed_evidence" : "uncalibrated_model",
    conditional, expected: integrateBoardParticipation(conditional, candidate.startingProbability),
    nonStartAssumption: "zero_relief_minutes", distributionStatus: "means_only_unvalidated",
    evidence: confirmation.map(item => ({ dimension: item.dimension, value: item.value, publishedAt: item.publishedAt, receivedAt: item.receivedAt })), conflicts: [],
    seasonBootstrap: candidate.seasonBootstrap ?? null };
}

/** Public goalie output uses the shared admitted verdict, never re-decodes candidate confirmation. */
export function admittedBoardGoalieForecast(candidate: any, admitted: GameForecast | undefined): BoardForecast | null {
  if (!admitted || admitted.conditioning !== "unconditional" || admitted.startProbability == null
    || !Number.isFinite(admitted.startProbability) || admitted.startProbability < 0 || admitted.startProbability > 1) return null;
  return { conditioning: admitted.conditioning, participationProbability: admitted.startProbability,
    probabilityStatus: admitted.confirmedStart === true ? "confirmed_evidence" : "uncalibrated_model",
    conditional: admitted.conditionalStats ?? null, expected: admitted.stats,
    nonStartAssumption: "zero_relief_minutes", distributionStatus: "means_only_unvalidated",
    // Admission exports its verdict, not private source assertions; do not restore candidate evidence.
    evidence: [], conflicts: [], seasonBootstrap: candidate?.seasonBootstrap ?? null };
}

export function boardSkaterStatsFromProjection(row: any) {
  const sum = (prefix: string) => {
    const values = ["es", "pp", "pk"].map((strength) => row[`${prefix}_${strength}`]).filter((value) => typeof value === "number" && Number.isFinite(value));
    return values.length ? values.reduce((a, b) => a + b, 0) : null;
  };
  return { identity: { gameId: row.game_id, teamId: row.team_id, playerId: row.player_id, horizonGames: row.horizon_games },
    proj_goals: sum("proj_goals"), proj_assists: sum("proj_assists"), proj_shots: sum("proj_shots"),
    proj_pp_points: typeof row.proj_goals_pp === "number" && typeof row.proj_assists_pp === "number" ? row.proj_goals_pp + row.proj_assists_pp : null,
    proj_hits: row.proj_hits ?? null, proj_blocks: row.proj_blocks ?? null, proj_pim: row.proj_pim ?? null,
    proj_toi_minutes: [row.proj_toi_es_seconds, row.proj_toi_pp_seconds, row.proj_toi_pk_seconds].every((value) => typeof value === "number")
      ? (row.proj_toi_es_seconds + row.proj_toi_pp_seconds + row.proj_toi_pk_seconds) / 60 : null };
}

/** Public full-game targets require all strength components, including PK. */
export function completeBoardSkaterStatsFromProjection(row: any) {
  const stats = boardSkaterStatsFromProjection(row);
  for (const prefix of ["proj_goals", "proj_assists", "proj_shots"] as const) {
    if (["es", "pp", "pk"].some(strength => typeof row[`${prefix}_${strength}`] !== "number"
      || !Number.isFinite(row[`${prefix}_${strength}`]))) stats[prefix] = null;
  }
  return stats;
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
