import { z } from "zod";
import { completeBoardSkaterStatsFromProjection, boardSkaterForecast } from "../projections/starterBoardScoring";
import { projectionInputHash } from "../projections/inputCapture";

export const TEAM_GOALS_VERSION = "empirical-full-game-goals-v1";
export const TEAM_GOALS_FEATURES = ["own_goals_for_per_game", "opponent_goals_against_per_game"] as const;
export const TEAM_GOALS_PARAMETERS = { historyLimit: 20, minimumGames: 1, ownWeight: 0.5, opponentWeight: 0.5 } as const;
const instant = z.string().datetime({ offset: true });
const id = z.number().int().positive();
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const mean = z.number().finite().nonnegative();
export const provenanceSchema = z.object({
  revisionId: z.string().min(1), payloadHash: hash, source: z.string().min(1),
  firstReceivedAt: instant, verifiedAt: instant,
  publishedAt: instant.nullable(),
  availabilityBasis: z.enum(["original_source", "retained_capture"]),
  correctionOf: z.string().min(1).nullable(),
}).strict().superRefine((row, ctx) => {
  if (Date.parse(row.verifiedAt) < Date.parse(row.firstReceivedAt)) ctx.addIssue({ code: "custom", message: "Verification precedes receipt" });
  if (row.availabilityBasis === "original_source" && row.publishedAt === null) ctx.addIssue({ code: "custom", message: "Original publication time is required" });
  // Correction chains need their own linked retained revisions; this first runner does not accept them.
  if (row.correctionOf !== null) ctx.addIssue({ code: "custom", message: "Correction chain is not supported by this runner" });
});
export type InputProvenance = z.infer<typeof provenanceSchema>;
export function availableBefore(row: InputProvenance, cutoffAt: string): boolean {
  return Math.max(Date.parse(row.firstReceivedAt), Date.parse(row.verifiedAt),
    row.publishedAt === null ? -Infinity : Date.parse(row.publishedAt)) < Date.parse(cutoffAt);
}
export const historicalGameSchema = z.object({
  gameId: id, seasonId: id, phase: z.literal(2), teamId: id, opponentId: id,
  startedAt: instant, completedAt: instant, status: z.literal("final"),
  completionBasis: z.enum(["authoritative_timestamp", "observed_final_upper_bound"]),
  strength: z.literal("all"), periods: z.literal("regulation_and_overtime"),
  emptyNet: z.literal("included"), shootout: z.literal("excluded"),
  goalsFor: z.number().int().nonnegative(), goalsAgainst: z.number().int().nonnegative(),
  provenance: provenanceSchema,
}).strict().superRefine((row, ctx) => {
  if (row.teamId === row.opponentId || Date.parse(row.completedAt) <= Date.parse(row.startedAt)
    || Date.parse(row.provenance.firstReceivedAt) < Date.parse(row.completedAt))
    ctx.addIssue({ code: "custom", message: "Invalid identity, completion or receipt order" });
});
export type HistoricalGoalGame = z.infer<typeof historicalGameSchema>;

/** A retained official final play-by-play establishes a completion upper bound at receipt, never an invented earlier finish. */
export function goalHistoryFromOfficialFinal(payload: any, provenance: InputProvenance): HistoricalGoalGame[] {
  provenanceSchema.parse(provenance);
  if (projectionInputHash(payload) !== provenance.payloadHash || !["OFF", "FINAL"].includes(payload?.gameState)
    || payload.gameType !== 2 || !Array.isArray(payload.plays)) throw new Error("Unverified official completed regular-season game");
  const homeId = payload.homeTeam?.id, awayId = payload.awayTeam?.id;
  const goals = new Map<number, number>([[homeId, 0], [awayId, 0]]);
  const eventIds = new Set<number>();
  for (const play of payload.plays) {
    if (!Number.isSafeInteger(play.eventId) || eventIds.has(play.eventId) || !["REG", "OT", "SO"].includes(play.periodDescriptor?.periodType))
      throw new Error("Ambiguous official event identity or period");
    eventIds.add(play.eventId);
    if (play.typeDescKey !== "goal" || play.periodDescriptor.periodType === "SO") continue;
    const teamId = play.details?.eventOwnerTeamId;
    if (!goals.has(teamId)) throw new Error("Unmapped official goal");
    goals.set(teamId, goals.get(teamId)! + 1);
  }
  const shootout = payload.periodDescriptor?.periodType === "SO";
  const homeScore = payload.homeTeam.score, awayScore = payload.awayTeam.score;
  const homeGoals = goals.get(homeId)!, awayGoals = goals.get(awayId)!;
  if (homeGoals !== homeScore - (shootout && homeScore > awayScore ? 1 : 0)
    || awayGoals !== awayScore - (shootout && awayScore > homeScore ? 1 : 0)) throw new Error("Official goal events do not reconcile to full final score");
  return [homeId, awayId].map(teamId => historicalGameSchema.parse({ gameId: payload.id, seasonId: payload.season,
    phase: 2, teamId, opponentId: teamId === homeId ? awayId : homeId, startedAt: payload.startTimeUTC,
    completedAt: provenance.firstReceivedAt, completionBasis: "observed_final_upper_bound", status: "final",
    strength: "all", periods: "regulation_and_overtime", emptyNet: "included", shootout: "excluded",
    goalsFor: goals.get(teamId), goalsAgainst: goals.get(teamId === homeId ? awayId : homeId), provenance }));
}
export const pairScopeSchema = z.object({ gameId: id, seasonId: id, phase: z.literal(2),
  homeTeamId: id, awayTeamId: id, gameDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), startAt: instant, cutoffAt: instant, horizonGames: z.literal(1) }).strict()
  .superRefine((row, ctx) => {
    if (row.homeTeamId === row.awayTeamId || Date.parse(row.cutoffAt) >= Date.parse(row.startAt))
      ctx.addIssue({ code: "custom", message: "Invalid teams or pregame cutoff" });
  });
export type PairScope = z.infer<typeof pairScopeSchema>;

/** Independent, unfitted baseline. No win probability, FORGE input, or fallback prior. */
export function scoreTeamGoals(scope: PairScope, observations: HistoricalGoalGame[]) {
  pairScopeSchema.parse(scope);
  if (observations.length > 200) throw new Error("History exceeds bounded population");
  const seen = new Set<string>();
  const histories = observations.map(row => historicalGameSchema.parse(row)).filter(row => {
    if (![scope.homeTeamId, scope.awayTeamId].includes(row.teamId) || row.gameId === scope.gameId || row.seasonId !== scope.seasonId || !availableBefore(row.provenance, scope.cutoffAt)
      || Date.parse(row.completedAt) >= Date.parse(scope.cutoffAt)) throw new Error("Ineligible pregame history");
    const key = `${row.gameId}:${row.teamId}`;
    if (seen.has(key)) throw new Error("Duplicate team-game observation");
    seen.add(key);
    return true;
  });
  for (const row of histories) {
    const other = histories.find(candidate => candidate.gameId === row.gameId && candidate.teamId === row.opponentId);
    if (other && (other.opponentId !== row.teamId || other.goalsAgainst !== row.goalsFor || other.goalsFor !== row.goalsAgainst))
      throw new Error("Conflicting two-team game accounting");
  }
  const history = (teamId: number) => histories.filter(row => row.teamId === teamId)
    // Receipt-based completion upper bounds prove eligibility, not event ordering.
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt) || b.gameId - a.gameId)
    .slice(0, TEAM_GOALS_PARAMETERS.historyLimit);
  const home = history(scope.homeTeamId), away = history(scope.awayTeamId);
  const score = (own: HistoricalGoalGame[], opponent: HistoricalGoalGame[]) => {
    if (!own.length || !opponent.length) return null;
    return TEAM_GOALS_PARAMETERS.ownWeight * own.reduce((sum, row) => sum + row.goalsFor, 0) / own.length
      + TEAM_GOALS_PARAMETERS.opponentWeight * opponent.reduce((sum, row) => sum + row.goalsAgainst, 0) / opponent.length;
  };
  return { modelVersion: TEAM_GOALS_VERSION, calibration: "none", researchOnly: true,
    homeMean: score(home, away), awayMean: score(away, home),
    homeGameIds: home.map(row => row.gameId), awayGameIds: away.map(row => row.gameId),
    features: { home: home.length && away.length ? [home.reduce((n, row) => n + row.goalsFor, 0) / home.length,
      away.reduce((n, row) => n + row.goalsAgainst, 0) / away.length] : null,
    away: home.length && away.length ? [away.reduce((n, row) => n + row.goalsFor, 0) / away.length,
      home.reduce((n, row) => n + row.goalsAgainst, 0) / home.length] : null } };
}

export const modelFreezeSchema = z.object({
  codeCommit: z.string().regex(/^[a-f0-9]{40}$/), sourceTreeHash: hash, lockfileHash: hash,
  nodeVersion: z.string().min(1), modelVersion: z.string().min(1),
  featureSchemaVersion: z.string().min(1), featureNames: z.array(z.string().min(1)).min(1),
  parameters: z.record(z.unknown()), parametersHash: hash,
  calibration: z.discriminatedUnion("kind", [z.object({ kind: z.literal("none") }).strict(),
    z.object({ kind: z.literal("artifact"), version: z.string().min(1), payloadHash: hash }).strict()]),
}).strict().superRefine((row, ctx) => {
  if (new Set(row.featureNames).size !== row.featureNames.length || projectionInputHash(row.parameters) !== row.parametersHash)
    ctx.addIssue({ code: "custom", message: "Invalid frozen features or parameter checksum" });
});
export type ModelFreeze = z.infer<typeof modelFreezeSchema>;
export function validateTeamFreeze(freeze: ModelFreeze) {
  modelFreezeSchema.parse(freeze);
  if (freeze.modelVersion !== TEAM_GOALS_VERSION || freeze.featureSchemaVersion !== TEAM_GOALS_VERSION
    || projectionInputHash(freeze.featureNames) !== projectionInputHash(TEAM_GOALS_FEATURES)
    || projectionInputHash(freeze.parameters) !== projectionInputHash(TEAM_GOALS_PARAMETERS) || freeze.calibration.kind !== "none")
    throw new Error("Team registry/checkpoint artifact mismatch");
}

export type ForgeGoalCoverage = {
  /** IDs must be the actual frozen roster, not just the players whose rows survived. */
  rosterPlayerIds: number[]; residualMean: number | null;
  strengthPartition: "exclusive_es_pp_pk" | "unknown";
  overtime: "included" | "unknown"; emptyNet: "included" | "unknown";
  proofRevisionIds: string[];
};
export function accountForgeTeamGoals(rows: Array<Record<string, any>>, coverage: ForgeGoalCoverage) {
  const reasons: string[] = [];
  if (coverage.strengthPartition !== "exclusive_es_pp_pk") reasons.push("unproved_strength_partition");
  if (coverage.overtime !== "included") reasons.push("unproved_overtime_coverage");
  if (coverage.emptyNet !== "included") reasons.push("unproved_empty_net_coverage");
  if (!coverage.proofRevisionIds.length) reasons.push("missing_endpoint_proof");
  if (coverage.residualMean === null || !mean.safeParse(coverage.residualMean).success) reasons.push("unknown_residual");
  const ids = rows.map(row => row.player_id);
  if (!coverage.rosterPlayerIds.length || new Set(coverage.rosterPlayerIds).size !== coverage.rosterPlayerIds.length
    || new Set(ids).size !== ids.length || projectionInputHash([...ids].sort()) !== projectionInputHash([...coverage.rosterPlayerIds].sort()))
    reasons.push("incomplete_or_duplicate_roster");
  const contributors = rows.map(row => {
    const stats = completeBoardSkaterStatsFromProjection(row);
    const prediction = boardSkaterForecast(stats, row.uncertainty);
    if (stats.proj_goals === null) reasons.push(`missing_strength_goal:${row.player_id}`);
    if (["es", "pp", "pk"].some(state => typeof row[`proj_goals_${state}`] === "number" && row[`proj_goals_${state}`] < 0))
      reasons.push(`negative_strength_goal:${row.player_id}`);
    if (prediction.participationProbability === null) reasons.push(`unknown_participation:${row.player_id}`);
    else if (stats.proj_goals !== null && !mean.safeParse(prediction.expected?.GOALS).success) reasons.push(`invalid_goal_mean:${row.player_id}`);
    return { playerId: row.player_id, conditionalMean: prediction.conditional?.GOALS ?? null,
      expectedMeanGivenGamePlayed: prediction.expected?.GOALS ?? null, conditioning: prediction.conditioning };
  });
  const total = reasons.length ? null : contributors.reduce((sum, row) => sum + row.expectedMeanGivenGamePlayed!, coverage.residualMean!);
  if (total !== null && !Number.isFinite(total)) reasons.push("nonfinite_team_total");
  return { mean: reasons.length ? null : total, meanSemantics: "conditional_on_game_played" as const,
    contributors, reasons: [...new Set(reasons)] };
}
