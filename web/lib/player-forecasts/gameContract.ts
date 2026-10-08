import { z } from "zod";
import type { GOALIE_SCORING_TARGETS, SKATER_SCORING_TARGETS } from "../fantasy-projections/contracts";
import type { ContributionGame } from "./contributions";

/** Additive research boundary; it does not grant release or serving permission. */
export const GAME_FORECAST_CONTRACT_VERSION = "player-forecast-game-accounting-v2" as const;
export const GAME_FORECAST_TARGETS = [
  "GOALS", "PRIMARY_ASSISTS", "SECONDARY_ASSISTS", "ASSISTS", "PP_GOALS",
  "PP_PRIMARY_ASSISTS", "PP_SECONDARY_ASSISTS", "PP_POINTS", "SHOTS_ON_GOAL",
  "HITS", "BLOCKED_SHOTS", "PENALTY_MINUTES", "TOTAL_TOI", "SHOTS_AGAINST_GOALIE",
  "SAVES_GOALIE", "GOALS_AGAINST_GOALIE", "WINS_GOALIE", "SHUTOUTS_GOALIE",
] as const satisfies readonly (typeof SKATER_SCORING_TARGETS[number] | typeof GOALIE_SCORING_TARGETS[number])[];
export type GameForecastTarget = typeof GAME_FORECAST_TARGETS[number];

const text = z.string().trim().min(1);
const timestamp = z.string().datetime({ offset: true });
const id = z.number().int().positive().safe();
const count = z.number().finite().nonnegative();
const probability = count.max(1);
const target = z.enum(GAME_FORECAST_TARGETS);
const unsupportedOutput = z.object({ value: z.null(), reason: text }).strict();
const meansSchema = z.object(Object.fromEntries(GAME_FORECAST_TARGETS.map(key => [key, count.nullable()])) as
  Record<GameForecastTarget, z.ZodNullable<typeof count>>).strict();
export type GameForecastMeans = z.infer<typeof meansSchema>;

// Keep the same FHFH/NHL identity, schedule and roster revision vocabulary as the resolver.
const contributionGameSchema = z.object({
  seasonId: id, gameId: id, teamId: id, scheduledAt: timestamp,
  scheduleRevision: text, rosterRevision: text, playerId: id, nhlPlayerId: id,
}).strict() satisfies z.ZodType<ContributionGame>;

const qualitySchema = z.object({
  freshness: z.enum(["fresh", "stale", "unknown"]),
  completeness: z.enum(["complete", "partial", "unknown"]),
  conflict: z.enum(["clear", "unresolved"]),
}).strict();
const sourceSchema = z.object({
  sourceId: text, reference: text, publisher: text, revisionId: text,
  supersedesRevisionId: text.nullable(), publishedAt: timestamp, effectiveAt: timestamp,
  firstReceivedAt: timestamp, verifiedAt: timestamp,
  components: z.array(z.enum(["model", "features", "identity", "confirmation"])).min(1),
  accessStatus: z.enum(["available", "restricted", "unknown"]),
  rightsStatus: z.enum(["verified_for_intended_use", "pending", "restricted", "unknown"]),
  quality: qualitySchema,
}).strict();
const confirmationLabel = z.enum(["confirmed", "expected", "projected", "unknown", "disputed", "stale"]);
const confirmationSchema = z.object({
  playerId: id, nhlPlayerId: id, teamId: id, gameId: id,
  label: confirmationLabel, currentRevisionId: text.nullable(),
  history: z.array(z.object({
    revisionId: text, supersedesRevisionId: text.nullable(), sourceId: text,
    label: confirmationLabel, evidenceStatus: z.enum(["direct_inspected", "inference", "unverified"]),
    verifiedAt: timestamp, expiresAt: timestamp,
  }).strict()),
}).strict();
const commonPlayer = {
  game: contributionGameSchema,
  identity: z.object({ mappingVersion: text, teamValidFrom: timestamp, teamValidUntil: timestamp.nullable() }).strict(),
  sourceIds: z.array(text).min(1),
  meanBasis: z.literal("unconditional_game"),
  means: meansSchema, conditionalMeans: meansSchema.nullable(),
  unsupportedReasons: z.record(target, text),
  goalsWithoutShotMean: count, conditionalGoalsWithoutShotMean: count.nullable(),
  goalsResidualContributorId: text.nullable(),
};
const commonParticipation = {
  conditioning: z.literal("given_game_played"),
  pDress: probability, pPositiveMinutes: probability, pGamePlayedCredited: probability,
};
const playerSchema = z.discriminatedUnion("population", [
  z.object({
    ...commonPlayer, population: z.enum(["forward", "defense"]),
    conditionalBasis: z.literal("on_statistical_credit_given_game_played"),
    participation: z.object(commonParticipation).strict(),
  }).strict(),
  z.object({
    ...commonPlayer, population: z.literal("goalie"),
    conditionalBasis: z.literal("on_start_or_relief_given_game_played"),
    participation: z.object({ ...commonParticipation,
      pStart: probability, pReliefOnly: probability, pNoAppearance: probability,
    }).strict(),
    goalsAgainstWithoutShotMean: count, conditionalGoalsAgainstWithoutShotMean: count.nullable(),
    pOfficialShutoutEligibleGivenAppearance: probability.nullable(),
    shutoutEligibilityRuleVersion: text.nullable(),
    startConfirmation: confirmationSchema,
  }).strict(),
]);
export type PlayerGameForecastRecord = z.infer<typeof playerSchema>;

const goalieOutcomeSchema = z.object({ WINS_GOALIE: count.nullable(), SHUTOUTS_GOALIE: count.nullable() }).strict();
const residualSchema = z.object({
  contributorId: text, description: text, reason: text,
  goalsForMean: count, guardedNetShotsAgainstMean: count, guardedNetSavesMean: count,
  guardedNetGoalsAgainstMean: count, guardedNetGoalsAgainstWithoutShotMean: count,
  goalieMinutesMean: count,
  pGoalieAppearanceGivenGamePlayed: probability,
  goalieOutcomeMeans: goalieOutcomeSchema, conditionalGoalieOutcomeMeans: goalieOutcomeSchema.nullable(),
  goalieOutcomeUnsupportedReasons: z.record(z.enum(["WINS_GOALIE", "SHUTOUTS_GOALIE"]), text),
  pOfficialShutoutEligibleGivenAppearance: probability.nullable(), shutoutEligibilityRuleVersion: text.nullable(),
}).strict();

const artifactSchema = z.object({
  contractVersion: z.literal(GAME_FORECAST_CONTRACT_VERSION), forecastId: text,
  use: z.literal("research_only"), outputKind: z.literal("count_means_only"),
  asOf: timestamp, generatedAt: timestamp, modelCutoff: timestamp, featureCutoff: timestamp,
  modelVersion: text, featureSchemaVersion: text, sourceWatermark: text,
  rulesVersion: text, eventDefinitionVersion: text,
  // Other competitions need their own verified rule scope before being supported.
  competitionType: z.literal("regular_season"),
  eventScope: z.literal("official_play_excluding_shootout"), toiUnit: z.literal("seconds"),
  starterSelectionKind: z.literal("exclusive_categorical_given_game_played"),
  game: z.object({
    seasonId: id, gameId: id, teamId: id, opponentTeamId: id,
    scheduledAt: timestamp, scheduleRevision: text, pGamePlayed: probability,
  }).strict(),
  sources: z.array(sourceSchema).min(1), quality: qualitySchema,
  fallback: z.object({
    status: z.enum(["none", "applied", "unavailable"]), modelVersion: text.nullable(),
    reasonCodes: z.array(text), displayLabel: text,
  }).strict(),
  unsupportedOutputs: z.object({
    countDistributions: unsupportedOutput, jointDistribution: unsupportedOutput, covariance: unsupportedOutput,
    expectedRealizedRatios: unsupportedOutput, positiveDenominatorProbability: unsupportedOutput, decisionUtility: unsupportedOutput,
  }).strict(),
  players: z.array(playerSchema).min(1), residualContributors: z.array(residualSchema).min(1),
  unknownStarter: z.object({ residualContributorId: text, probabilityGivenGamePlayed: probability }).strict(),
  teamAccounting: z.object({
    officialGoalsForMean: count, officialGoalsAgainstMean: count, opponentShotsOnGoalMean: count,
    emptyNetGoalsAgainstMean: count, emptyNetShotsAgainstMean: count,
    unassignedAwardedGoalsAgainstMean: count, guardedNetMinutesMean: count,
    shootoutStandingsAdjustmentForMean: probability, shootoutStandingsAdjustmentAgainstMean: probability,
  }).strict(),
}).strict();

const time = (value: string) => Date.parse(value);
const equal = (a: number, b: number) => Number.isFinite(a) && Number.isFinite(b)
  && Math.abs(a - b) <= 1e-8 * Math.max(1, Math.abs(a), Math.abs(b));
function issue(ctx: z.RefinementCtx, path: (string | number)[], invariant: string, message: string) {
  ctx.addIssue({ code: z.ZodIssueCode.custom, path, message, params: { invariant } });
}
function checkMeans(ctx: z.RefinementCtx, means: GameForecastMeans, path: (string | number)[],
  nonShotGoals: number, nonShotGoalsAgainst: number) {
  const equation = (total: GameForecastTarget, parts: GameForecastTarget[]) => {
    if (means[total] !== null && (parts.some(key => means[key] === null)
      || !equal(means[total]!, parts.reduce((sum, key) => sum + (means[key] ?? 0), 0)))) {
      issue(ctx, [...path, total], "count_identity", `${total} requires the sum of supported ${parts.join(" + ")}.`);
    }
  };
  equation("ASSISTS", ["PRIMARY_ASSISTS", "SECONDARY_ASSISTS"]);
  equation("PP_POINTS", ["PP_GOALS", "PP_PRIMARY_ASSISTS", "PP_SECONDARY_ASSISTS"]);
  for (const [part, total] of [["PP_GOALS", "GOALS"], ["PP_PRIMARY_ASSISTS", "PRIMARY_ASSISTS"],
    ["PP_SECONDARY_ASSISTS", "SECONDARY_ASSISTS"]] as const) {
    if (means[part] !== null && (means[total] === null || means[part]! > means[total]! + 1e-8)) {
      issue(ctx, [...path, part], "subset_credit", `${part} must be a subset of supported ${total} in the same event scope.`);
    }
  }
  if (nonShotGoals > (means.GOALS ?? 0) + 1e-8 || means.GOALS !== null
    && (means.SHOTS_ON_GOAL === null || means.GOALS - nonShotGoals > means.SHOTS_ON_GOAL + 1e-8)) {
    issue(ctx, [...path, "GOALS"], "goals_subset_shots", "Shot-universe goals cannot exceed shots on goal; non-shot awards must be explicit.");
  }
  if (nonShotGoalsAgainst > (means.GOALS_AGAINST_GOALIE ?? 0) + 1e-8) {
    issue(ctx, [...path, "GOALS_AGAINST_GOALIE"], "guarded_net_identity", "Non-shot goals against cannot exceed credited goals against.");
  }
  if (means.SHOTS_AGAINST_GOALIE !== null && (means.SAVES_GOALIE === null || means.GOALS_AGAINST_GOALIE === null
    || !equal(means.SHOTS_AGAINST_GOALIE, means.SAVES_GOALIE + means.GOALS_AGAINST_GOALIE - nonShotGoalsAgainst))) {
    issue(ctx, [...path, "SHOTS_AGAINST_GOALIE"], "guarded_net_identity", "Guarded-net SA = SV + GA excluding explicitly credited non-shot awards.");
  }
}

export const gameForecastContractSchema = artifactSchema.superRefine((artifact, ctx) => {
  const { game } = artifact;
  if (game.teamId === game.opponentTeamId) issue(ctx, ["game"], "game_identity", "Team and opponent must differ.");
  if (time(artifact.asOf) > time(artifact.generatedAt) || time(artifact.modelCutoff) > time(artifact.asOf)
    || time(artifact.featureCutoff) > time(artifact.asOf) || time(artifact.asOf) >= time(game.scheduledAt)) {
    issue(ctx, ["asOf"], "forecast_cutoff", "Model/feature cutoffs must precede as-of, generation must follow it, and this is a pregame forecast.");
  }
  const sources = new Map(artifact.sources.map(source => [source.sourceId, source]));
  const revisions = new Map(artifact.sources.map(source => [source.revisionId, source]));
  if (sources.size !== artifact.sources.length || revisions.size !== artifact.sources.length) {
    issue(ctx, ["sources"], "duplicate_source", "Source and revision identifiers must be unique.");
  }
  artifact.sources.forEach((source, index) => {
    const path = ["sources", index];
    const availableAt = Math.max(time(source.publishedAt), time(source.firstReceivedAt), time(source.verifiedAt));
    if (time(source.publishedAt) > time(source.firstReceivedAt) || time(source.firstReceivedAt) > time(source.verifiedAt)
      || source.components.some(component => availableAt > time(component === "model" ? artifact.modelCutoff
        : component === "confirmation" ? artifact.asOf : artifact.featureCutoff))) {
      issue(ctx, path, "source_availability", "Publication, receipt and verification must establish availability by each contributing component's cutoff.");
    }
    if (source.supersedesRevisionId !== null) {
      const earlier = revisions.get(source.supersedesRevisionId);
      if (!earlier || time(earlier.firstReceivedAt) >= time(source.firstReceivedAt)) {
        issue(ctx, path, "source_revision", "A correction must retain an earlier received source revision.");
      }
    }
  });
  for (const dimension of ["freshness", "completeness", "conflict"] as const) {
    const best = dimension === "freshness" ? "fresh" : dimension === "completeness" ? "complete" : "clear";
    if (artifact.quality[dimension] === best && artifact.sources.some(source => source.quality[dimension] !== best)) {
      issue(ctx, ["quality", dimension], "quality_overclaim", "Aggregate quality cannot hide a degraded contributing source.");
    }
  }
  if (artifact.fallback.status === "none" && (artifact.fallback.modelVersion !== null || artifact.fallback.reasonCodes.length)
    || artifact.fallback.status !== "none" && (!artifact.fallback.reasonCodes.length
      || artifact.fallback.status === "applied" && artifact.fallback.modelVersion === null)) {
    issue(ctx, ["fallback"], "fallback_lineage", "An applied fallback needs a version and reasons; absence of fallback cannot carry one.");
  }
  const playerIds = new Set<number>(), nhlIds = new Set<number>();
  let starterMass = artifact.unknownStarter.probabilityGivenGamePlayed;
  let goalsFor = 0, shotsAgainst = 0, goalsAgainst = 0, goalieMinutes = 0, goalieMinutesGivenPlayed = 0;
  let goalieWins = 0, goalieShutouts = 0, goalieWinsGivenPlayed = 0, goalieShutoutsGivenPlayed = 0;
  artifact.players.forEach((player, index) => {
    const path = ["players", index];
    if (playerIds.has(player.game.playerId) || nhlIds.has(player.game.nhlPlayerId)) {
      issue(ctx, path, "duplicate_player", "One record per canonical player and NHL mapping is required in a team-game.");
    }
    playerIds.add(player.game.playerId); nhlIds.add(player.game.nhlPlayerId);
    if (player.game.gameId !== game.gameId || player.game.seasonId !== game.seasonId || player.game.teamId !== game.teamId
      || time(player.game.scheduledAt) !== time(game.scheduledAt) || player.game.scheduleRevision !== game.scheduleRevision
      || time(player.identity.teamValidFrom) > time(game.scheduledAt)
      || player.identity.teamValidUntil !== null && time(player.identity.teamValidUntil) <= time(game.scheduledAt)) {
      issue(ctx, [...path, "game"], "player_game_identity", "Canonical identity and time-valid team membership must match this exact game and schedule revision.");
    }
    if (new Set(player.sourceIds).size !== player.sourceIds.length || player.sourceIds.some(sourceId => !sources.has(sourceId))) {
      issue(ctx, [...path, "sourceIds"], "player_source", "Retained, unique source records are required.");
    }
    const participation = player.participation;
    const appearance = player.population === "goalie" ? player.participation.pStart + player.participation.pReliefOnly
      : participation.pGamePlayedCredited;
    const exposure = game.pGamePlayed * appearance;
    if (participation.pPositiveMinutes > participation.pDress + 1e-8
      || participation.pPositiveMinutes > participation.pGamePlayedCredited + 1e-8
      || player.population === "goalie" && (appearance > participation.pDress + 1e-8
        || participation.pPositiveMinutes > appearance + 1e-8)) {
      issue(ctx, [...path, "participation"], "participation_exposure", "Positive minutes require dressing and statistical credit; goalie appearance mass must also be compatible.");
    }
    if (appearance === 0 && player.conditionalMeans !== null || appearance > 0 && player.conditionalMeans === null) {
      issue(ctx, [...path, "conditionalMeans"], "conditional_basis", "Conditional means require a positive conditioning probability; zero-probability conditions are undefined.");
    }
    for (const key of GAME_FORECAST_TARGETS) {
      const mean = player.means[key], conditional = player.conditionalMeans?.[key];
      if ((mean === null) !== Boolean(player.unsupportedReasons[key])) {
        issue(ctx, [...path, "means", key], "unsupported_head", "Every unsupported mean is null with a reason; a supported zero is not missing data.");
      }
      if (mean !== null && (appearance === 0 ? mean !== 0 : conditional == null || !equal(mean, exposure * conditional))
        || mean === null && conditional != null) {
        issue(ctx, [...path, "means", key], "participation_integration", "Unconditional means must integrate game occurrence and declared participation exactly once.");
      }
    }
    if (player.means.GOALS === null ? !artifact.residualContributors.some(residual => residual.contributorId === player.goalsResidualContributorId)
      : player.goalsResidualContributorId !== null) {
      issue(ctx, [...path, "goalsResidualContributorId"], "scorer_coverage", "Unsupported scoring must be covered by a named residual; supported scoring cannot also be allocated there.");
    }
    const required: GameForecastTarget[] = player.population === "goalie"
      ? ["TOTAL_TOI", "SHOTS_AGAINST_GOALIE", "SAVES_GOALIE", "GOALS_AGAINST_GOALIE"]
      : ["TOTAL_TOI", "GOALS", "SHOTS_ON_GOAL"];
    if (required.some(key => player.means[key] === null)) {
      issue(ctx, [...path, "means"], "minimum_capability", "This slice requires skater goals/shots/time and goalie SA/SV/GA/time; other heads may be unsupported.");
    }
    if (player.population !== "goalie" && GAME_FORECAST_TARGETS.some(key => key.endsWith("_GOALIE") && player.means[key] !== null)) {
      issue(ctx, [...path, "means"], "population_target", "Goalie counts require a goalie participation/accounting record; mixed emergency roles are unsupported.");
    }
    const timeGivenPlayed = appearance * (player.conditionalMeans?.TOTAL_TOI ?? 0);
    if (participation.pPositiveMinutes === 0 && player.means.TOTAL_TOI !== 0
      || participation.pPositiveMinutes > 0 && !(timeGivenPlayed > 0)
      || player.means.TOTAL_TOI! > 65 * 60 * game.pGamePlayed * participation.pPositiveMinutes + 1e-8
      || timeGivenPlayed > 65 * 60 * participation.pPositiveMinutes + 1e-8
      || (player.conditionalMeans?.TOTAL_TOI ?? 0) > 65 * 60 + 1e-8) {
      issue(ctx, [...path, "means", "TOTAL_TOI"], "minutes_exposure", "Expected time must agree with the probability of positive minutes; penalty-only credit can still have PIM.");
    }
    const nonShotGA = player.population === "goalie" ? player.goalsAgainstWithoutShotMean : 0;
    const conditionalNonShotGA = player.population === "goalie" ? player.conditionalGoalsAgainstWithoutShotMean : 0;
    const exceptions = [["goalsWithoutShotMean", player.goalsWithoutShotMean, player.conditionalGoalsWithoutShotMean],
      ...(player.population === "goalie" ? [["goalsAgainstWithoutShotMean", nonShotGA, conditionalNonShotGA] as const] : [])] as const;
    for (const [key, mean, conditional] of exceptions) {
      if (appearance === 0 ? conditional !== null || mean !== 0 : conditional === null || !equal(mean, exposure * conditional)) {
        issue(ctx, [...path, key], "participation_integration", "Non-shot exceptions retain their declared conditional amount and integrate occurrence/participation once.");
      }
    }
    checkMeans(ctx, player.means, [...path, "means"], player.goalsWithoutShotMean, nonShotGA);
    if (player.conditionalMeans) checkMeans(ctx, player.conditionalMeans, [...path, "conditionalMeans"],
      player.conditionalGoalsWithoutShotMean ?? 0, conditionalNonShotGA ?? 0);
    goalsFor += player.means.GOALS ?? 0;
    if (player.population !== "goalie") return;
    starterMass += player.participation.pStart;
    if (!equal(appearance + player.participation.pNoAppearance, 1)) {
      issue(ctx, [...path, "participation"], "goalie_states", "Start, relief-only and no-appearance probabilities must sum to one, given the game is played.");
    }
    shotsAgainst += player.means.SHOTS_AGAINST_GOALIE!;
    goalsAgainst += player.means.GOALS_AGAINST_GOALIE!;
    goalieMinutes += player.means.TOTAL_TOI! / 60;
    goalieMinutesGivenPlayed += timeGivenPlayed / 60;
    goalieWins += player.means.WINS_GOALIE ?? 0;
    goalieShutouts += player.means.SHUTOUTS_GOALIE ?? 0;
    goalieWinsGivenPlayed += appearance * (player.conditionalMeans?.WINS_GOALIE ?? 0);
    goalieShutoutsGivenPlayed += appearance * (player.conditionalMeans?.SHUTOUTS_GOALIE ?? 0);
    if ((player.means.WINS_GOALIE ?? 0) > exposure + 1e-8 || (player.conditionalMeans?.WINS_GOALIE ?? 0) > 1 + 1e-8) {
      issue(ctx, [...path, "means", "WINS_GOALIE"], "goalie_win", "A goalie win requires an appearance.");
    }
    if (player.means.SHUTOUTS_GOALIE !== null && (player.pOfficialShutoutEligibleGivenAppearance === null
      || player.shutoutEligibilityRuleVersion === null
      || player.means.SHUTOUTS_GOALIE > exposure * player.pOfficialShutoutEligibleGivenAppearance + 1e-8
      || (player.conditionalMeans?.SHUTOUTS_GOALIE ?? 0) > player.pOfficialShutoutEligibleGivenAppearance + 1e-8)) {
      issue(ctx, [...path, "means", "SHUTOUTS_GOALIE"], "official_shutout", "Shutouts need explicit official eligibility under a versioned rule; zero personal GA does not establish it.");
    }
    const confirmation = player.startConfirmation;
    if (confirmation.playerId !== player.game.playerId || confirmation.nhlPlayerId !== player.game.nhlPlayerId
      || confirmation.teamId !== game.teamId || confirmation.gameId !== game.gameId) {
      issue(ctx, [...path, "startConfirmation"], "confirmation_identity", "Confirmation must name this exact canonical player, team and game.");
    }
    const history = new Map<string, typeof confirmation.history[number]>();
    confirmation.history.forEach((entry, revisionIndex) => {
      const source = sources.get(entry.sourceId);
      const previous = confirmation.history[revisionIndex - 1];
      if (history.has(entry.revisionId) || !source || !source.components.includes("confirmation")
        || time(entry.verifiedAt) < time(source.verifiedAt) || time(entry.verifiedAt) > time(artifact.asOf)
        || time(entry.expiresAt) <= time(entry.verifiedAt)
        || (previous ? entry.supersedesRevisionId !== previous.revisionId || time(entry.verifiedAt) < time(previous.verifiedAt)
          : entry.supersedesRevisionId !== null)) {
        issue(ctx, [...path, "startConfirmation", "history", revisionIndex], "confirmation_history", "Keep available source evidence and ordered corrections with an explicit expiry.");
      }
      history.set(entry.revisionId, entry);
    });
    const current = confirmation.history[confirmation.history.length - 1];
    if (!current ? confirmation.currentRevisionId !== null || confirmation.label !== "unknown"
      : confirmation.currentRevisionId !== current.revisionId || (confirmation.label !== current.label
        && !(confirmation.label === "stale" && time(current.expiresAt) <= time(artifact.asOf)))) {
      issue(ctx, [...path, "startConfirmation"], "confirmation_current", "The current label must follow the last retained correction or its expiry.");
    }
    if (confirmation.label === "confirmed") {
      const source = current ? sources.get(current.sourceId) : undefined;
      if (!current || current.evidenceStatus !== "direct_inspected" || !source
        || source.accessStatus !== "available" || source.quality.conflict !== "clear"
        || source.quality.freshness !== "fresh" || time(current.expiresAt) <= time(artifact.asOf)) {
        issue(ctx, [...path, "startConfirmation"], "confirmed_evidence", "Confirmed needs fresh, direct inspected, available evidence without unresolved conflict; probability is separate.");
      }
    }
  });
  const residualIds = new Set<string>();
  artifact.residualContributors.forEach((residual, index) => {
    const path = ["residualContributors", index];
    if (residualIds.has(residual.contributorId)) issue(ctx, ["residualContributors", index], "duplicate_residual", "Residual contributor IDs must be unique.");
    residualIds.add(residual.contributorId);
    if (residual.guardedNetGoalsAgainstWithoutShotMean > residual.guardedNetGoalsAgainstMean + 1e-8
      || !equal(residual.guardedNetShotsAgainstMean, residual.guardedNetSavesMean
        + residual.guardedNetGoalsAgainstMean - residual.guardedNetGoalsAgainstWithoutShotMean)) {
      issue(ctx, ["residualContributors", index], "guarded_net_identity", "Residual goalies must obey the same guarded-net accounting.");
    }
    goalsFor += residual.goalsForMean; shotsAgainst += residual.guardedNetShotsAgainstMean;
    goalsAgainst += residual.guardedNetGoalsAgainstMean; goalieMinutes += residual.goalieMinutesMean;
    const appearance = residual.pGoalieAppearanceGivenGamePlayed, exposure = game.pGamePlayed * appearance;
    if (appearance === 0 ? residual.conditionalGoalieOutcomeMeans !== null : residual.conditionalGoalieOutcomeMeans === null) {
      issue(ctx, path, "conditional_basis", "Residual goalie outcome kernels require positive played-game appearance probability.");
    }
    for (const key of ["WINS_GOALIE", "SHUTOUTS_GOALIE"] as const) {
      const mean = residual.goalieOutcomeMeans[key], conditional = residual.conditionalGoalieOutcomeMeans?.[key];
      if ((mean === null) !== Boolean(residual.goalieOutcomeUnsupportedReasons[key])) {
        issue(ctx, [...path, "goalieOutcomeMeans", key], "unsupported_head", "Unsupported residual outcomes remain null with a reason, never a hidden zero.");
      }
      if (mean !== null && (appearance === 0 ? mean !== 0 : conditional == null || !equal(mean, exposure * conditional))
        || mean === null && conditional != null) {
        issue(ctx, [...path, "goalieOutcomeMeans", key], "participation_integration", "Residual goalie outcomes must integrate their declared appearance and game occurrence once.");
      }
      if ((mean ?? 0) > exposure + 1e-8 || (conditional ?? 0) > 1 + 1e-8) {
        issue(ctx, [...path, "goalieOutcomeMeans", key], "residual_goalie_outcome", "A residual goalie outcome requires an appearance and cannot exceed one per appearance.");
      }
    }
    const shutouts = residual.goalieOutcomeMeans.SHUTOUTS_GOALIE;
    if (shutouts !== null && appearance > 0 && (residual.pOfficialShutoutEligibleGivenAppearance === null
      || residual.shutoutEligibilityRuleVersion === null
      || shutouts > exposure * residual.pOfficialShutoutEligibleGivenAppearance + 1e-8
      || (residual.conditionalGoalieOutcomeMeans?.SHUTOUTS_GOALIE ?? 0) > residual.pOfficialShutoutEligibleGivenAppearance + 1e-8)) {
      issue(ctx, path, "official_shutout", "Supported residual shutouts need the same explicit official eligibility and rule version as named goalies.");
    }
    if (residual.goalieMinutesMean > 65 * exposure + 1e-8 || appearance === 0
      && [residual.guardedNetShotsAgainstMean, residual.guardedNetSavesMean, residual.guardedNetGoalsAgainstMean].some(value => value !== 0)) {
      issue(ctx, path, "participation_exposure", "Residual goalie shots, goals and minutes require declared goalie exposure.");
    }
    goalieWins += residual.goalieOutcomeMeans.WINS_GOALIE ?? 0;
    goalieShutouts += shutouts ?? 0;
    goalieWinsGivenPlayed += appearance * (residual.conditionalGoalieOutcomeMeans?.WINS_GOALIE ?? 0);
    goalieShutoutsGivenPlayed += appearance * (residual.conditionalGoalieOutcomeMeans?.SHUTOUTS_GOALIE ?? 0);
  });
  const unknownGoalie = artifact.residualContributors.find(residual => residual.contributorId === artifact.unknownStarter.residualContributorId);
  if (!residualIds.has(artifact.unknownStarter.residualContributorId) || !equal(starterMass, 1)) {
    issue(ctx, ["unknownStarter"], "team_starter", "Exactly one starter is required per played team-game, including a named unknown-goalie branch.");
  }
  if (unknownGoalie && artifact.unknownStarter.probabilityGivenGamePlayed > unknownGoalie.pGoalieAppearanceGivenGamePlayed + 1e-8) {
    issue(ctx, ["unknownStarter"], "participation_exposure", "The unknown starter branch requires at least its own residual goalie appearance mass.");
  }
  if (goalieWins > game.pGamePlayed + 1e-8 || goalieShutouts > game.pGamePlayed + 1e-8
    || goalieWinsGivenPlayed > 1 + 1e-8 || goalieShutoutsGivenPlayed > 1 + 1e-8) {
    issue(ctx, ["teamAccounting"], "team_goalie_outcomes", "Supported named and residual goalie wins and individual shutouts are each bounded by played-game mass, separately; W and SO may co-occur.");
  }
  const ledger = artifact.teamAccounting;
  if (game.pGamePlayed === 0 && (Object.values(ledger).some(value => value !== 0)
    || artifact.residualContributors.some(residual => Object.entries(residual)
      .some(([key, value]) => key.endsWith("Mean") && typeof value === "number" && value !== 0)))) {
    issue(ctx, ["teamAccounting"], "participation_integration", "All unconditional team and residual means must be zero when the game cannot occur.");
  }
  if (!equal(goalsFor, ledger.officialGoalsForMean)
    || !equal(goalsAgainst + ledger.emptyNetGoalsAgainstMean + ledger.unassignedAwardedGoalsAgainstMean, ledger.officialGoalsAgainstMean)
    || !equal(shotsAgainst + ledger.emptyNetShotsAgainstMean, ledger.opponentShotsOnGoalMean)
    || !equal(goalieMinutes, ledger.guardedNetMinutesMean)
    || ledger.emptyNetGoalsAgainstMean > ledger.emptyNetShotsAgainstMean + 1e-8
    || goalieMinutes > 65 * game.pGamePlayed + 1e-8 || goalieMinutesGivenPlayed > 65 + 1e-8) {
    issue(ctx, ["teamAccounting"], "team_accounting", "Official-play totals must include all named contributors, empty-net events and separate non-shot awards; both unconditional minutes and the named played-game kernel exclude pulls and obey the game limit.");
  }
  if (ledger.shootoutStandingsAdjustmentForMean + ledger.shootoutStandingsAdjustmentAgainstMean > game.pGamePlayed + 1e-8) {
    issue(ctx, ["teamAccounting"], "shootout_adjustment", "At most one standings goal is added per played game; shootout credit is outside player/official-play means.");
  }
});
export type GameForecastContract = z.infer<typeof gameForecastContractSchema>;

export function goalieRatioOfExpectations(means: GameForecastMeans) {
  const ratio = (numeratorMean: number | null, denominatorMean: number | null, multiplier: number) => {
    let value: number | null = null;
    if (numeratorMean !== null && denominatorMean !== null && denominatorMean > 0) {
      // Scale before multiplying large counts; divide first if a tiny denominator overflows the scale.
      const scale = multiplier / denominatorMean;
      value = Number.isFinite(scale) ? numeratorMean * scale : numeratorMean / denominatorMean * multiplier;
      if (!Number.isFinite(value)) throw new Error("Derived goalie ratio must be finite.");
    }
    return { kind: "ratio_of_expectations" as const, numeratorMean, denominatorMean, multiplier, value,
      expectedRealizedRatio: null, positiveDenominatorProbability: null };
  };
  return {
    goalieMinutesMean: means.TOTAL_TOI === null ? null : means.TOTAL_TOI / 60,
    savePercentage: ratio(means.SAVES_GOALIE, means.SHOTS_AGAINST_GOALIE, 1),
    goalsAgainstAverage: ratio(means.GOALS_AGAINST_GOALIE, means.TOTAL_TOI === null ? null : means.TOTAL_TOI / 60, 60),
  };
}

/** Explicit ordered remaining games only. No actuals, independence assumption or ratio averaging. */
export function aggregatePlayerGameMeans(input: { artifacts: unknown[]; playerId: number; gameIds: number[] }) {
  const artifacts = input.artifacts.map(value => gameForecastContractSchema.parse(value));
  if (!input.gameIds.length || new Set(input.gameIds).size !== input.gameIds.length || artifacts.length !== input.gameIds.length
    || new Set(artifacts.map(artifact => artifact.forecastId)).size !== artifacts.length) {
    throw new Error("Aggregation requires one artifact for every explicitly selected unique game.");
  }
  const byGame = new Map(artifacts.map(artifact => [artifact.game.gameId, artifact]));
  const first = artifacts[0];
  const records = input.gameIds.map(gameId => {
    const artifact = byGame.get(gameId);
    const player = artifact?.players.find(record => record.game.playerId === input.playerId);
    if (!artifact || !player || byGame.size !== artifacts.length) throw new Error("Missing or duplicate player-game forecast.");
    if (["asOf", "modelCutoff", "featureCutoff", "modelVersion", "featureSchemaVersion", "eventDefinitionVersion", "rulesVersion"]
      .some(key => artifact[key as keyof GameForecastContract] !== first[key as keyof GameForecastContract])
      || artifact.game.seasonId !== first.game.seasonId) throw new Error("Aggregation requires the same as-of, versions and season.");
    return player;
  });
  if (records.some((record, index) => index > 0 && time(record.game.scheduledAt) < time(records[index - 1].game.scheduledAt))) {
    throw new Error("Selected game IDs must follow scheduled time order.");
  }
  if (records.some(record => record.game.nhlPlayerId !== records[0].game.nhlPlayerId
    || record.identity.mappingVersion !== records[0].identity.mappingVersion || record.population !== records[0].population)) {
    throw new Error("Aggregation requires one canonical player mapping and population.");
  }
  const means = meansSchema.parse(Object.fromEntries(GAME_FORECAST_TARGETS.map(key => [key,
    records.some(record => record.means[key] === null) ? null : records.reduce((sum, record) => sum + record.means[key]!, 0),
  ])));
  const unsupportedReasons = Object.fromEntries(GAME_FORECAST_TARGETS.filter(key => means[key] === null)
    .map(key => [key, [...new Set(records.map(record => record.unsupportedReasons[key]).filter(Boolean))].join("; ")]));
  return { playerId: input.playerId, gameIds: [...input.gameIds], meanBasis: "unconditional_game_sum" as const,
    means, unsupportedReasons, ratios: records[0].population === "goalie" ? goalieRatioOfExpectations(means) : null,
    componentForecastIds: input.gameIds.map(gameId => byGame.get(gameId)!.forecastId) };
}
