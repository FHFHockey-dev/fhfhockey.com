import { z } from "zod";
import type { PlanningSnapshot, PlanningWorkspace } from "lib/rosterScheduleOptimizer/planningTypes";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
});
const instant = z.string().datetime({ offset: true });
const id = z.string().trim().min(1).max(200);
const seasonId = z.number().int().refine((value) => { const first = Math.floor(value / 10000); return first >= 2000 && first <= 2199 && value % 10000 === first + 1; }, "Expected an NHL season ID such as 20262027.");
const timeZone = id.refine((value) => { try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; } }, "Invalid time zone.");
const nullableNumber = z.number().finite().nullable();
const positiveInteger = z.number().int().positive();
const stringArray = z.array(id).max(1000);
const statLine = z.record(z.string().min(1).max(50), nullableNumber);
const evidence = z.object({ source: id, asOf: instant.nullable(), completeness: z.enum(["complete", "partial", "unknown"]), seasonId: z.number().int().nullable(), limitations: stringArray }).strict();

const contextObjectSchema = z.object({
  provider: z.enum(["manual", "yahoo", "fantrax"]),
  seasonId, leagueId: id, teamId: id,
  startDate: date, endDate: date, timeZone, asOf: instant,
}).strict();
const validHorizon = (context: { startDate: string; endDate: string }) => context.endDate >= context.startDate && Date.parse(context.endDate) - Date.parse(context.startDate) <= 366 * 86400000;
export const contextSchema = contextObjectSchema.refine(validHorizon, "Planning range must be at most 367 days.");
const player = z.object({
  id, nhlId: positiveInteger.nullable(), nhlTeamId: positiveInteger.optional(), rosterRevision: id.optional(),
  providerId: id.nullable().optional(), name: id,
  teamAbbreviation: id.nullable(), eligiblePositions: stringArray, eligibilityVerified: z.boolean().optional(),
  playerClass: z.enum(["skater", "goalie"]), availability: z.enum(["free_agent", "waivers", "rostered", "manager_available", "unknown"]),
  ownership: z.number().finite().min(0).max(100).nullable(), canDrop: z.boolean().nullable(), holdValue: nullableNumber,
  reserveEligibility: z.array(z.enum(["IR", "IR+", "NA"])), waiverClearsAt: instant.nullable().optional(),
  form: z.object({ label: id, games: z.number().int().nonnegative(), points: z.number().finite(), includedInForecast: z.boolean().nullable() }).strict().optional(),
}).strict();
const rosterEntry = z.object({ playerId: id, position: z.enum(["active", "bench", "IR", "IR+", "NA"]) }).strict();
const lockedAssignment = z.object({ date, playerId: id, slotId: id.nullable(), source: z.enum(["provider", "manager"]).optional() }).strict();
const game = z.object({ id, date, startsAt: instant.nullable(), scheduleRevision: id.optional(), teamAbbreviation: id, opponent: id, home: z.boolean(), status: z.enum(["scheduled", "live", "final", "postponed", "cancelled"]) }).strict();
const contributionGame = z.object({ seasonId, gameId: positiveInteger, teamId: positiveInteger,
  scheduledAt: instant, scheduleRevision: id, rosterRevision: id,
  playerId: positiveInteger, nhlPlayerId: positiveInteger }).strict();
const allowedUses = z.object({ assignment: z.boolean(), totals: z.boolean(), comparison: z.boolean(), conditionalTieBreak: z.boolean() }).strict();
const calendarPolicy = z.object({ version: z.literal("forecast-calendar-v1"),
  calendarDays: z.number().int().min(1).max(21), overlapDays: z.literal(7), timeZone: z.literal("UTC") }).strict();
const contributionSource = z.object({ kind: z.enum(["detailed", "baseline"]), sourceId: id,
  policyVersion: id, released: z.boolean(), allowedUses: allowedUses.optional(), playerId: positiveInteger, nhlPlayerId: positiveInteger,
  seasonId, teamId: positiveInteger, gameId: positiveInteger.optional(), scheduledAt: instant.optional(), targetKey: id,
  unit: z.enum(["count", "minutes"]), basis: z.enum(["per_appearance", "per_start", "per_team_game", "unconditional_game"]),
  mean: z.number().finite(), participationIntegrated: z.boolean(), cutoffAt: instant,
  issuedAt: instant, expiresAt: instant, sourceWatermark: id, scheduleRevision: id,
  rosterRevision: id, legacyAvailabilityAdjustment: z.boolean().optional(), limitations: stringArray.optional() }).strict();
const resolvedContribution = z.object({ resolverVersion: z.literal("contribution-resolver-v1"),
  inputs: z.object({ detailed: contributionSource.optional(), baseline: contributionSource.optional(),
    participation: z.object({ playerId: positiveInteger, nhlPlayerId: positiveInteger, seasonId, gameId: positiveInteger,
      teamId: positiveInteger, scheduledAt: instant.optional(), scheduleRevision: id, rosterRevision: id,
      basis: z.enum(["appearance", "start"]), probability: z.number().finite().min(0).max(1), revisionId: id,
      released: z.boolean(), allowedUses: allowedUses.optional(), issuedAt: instant, cutoffAt: instant,
      expiresAt: instant, competitionId: id.optional() }).strict().optional(),
    horizonDays: positiveInteger, calendarPolicy: calendarPolicy.optional(), servingEnabled: z.boolean() }).strict().optional(),
  game: contributionGame, targetKey: id, sourceKind: z.enum(["detailed", "baseline", "blended"]).nullable(),
  conditionalMean: nullableNumber, unconditionalMean: nullableNumber,
  basis: z.enum(["per_appearance", "per_start", "per_team_game", "unconditional_game"]).nullable().optional(),
  unit: z.enum(["count", "minutes"]).nullable(),
  allowedUses,
  sourceIds: stringArray, participationRevisionId: id.nullable(), blendWeight: z.number().finite().min(0).max(1).nullable(),
  exclusionReasons: z.array(z.enum(["serving_disabled", "no_issued_revision", "unreleased_source",
    "identity_conflict", "missing_target", "stale_source", "future_input", "unsupported_conditioning",
    "missing_participation", "incompatible_overlap", "incompatible_component_basis", "outside_horizon", "use_not_approved"])).max(100), limitations: stringArray }).strict();
const forecast = z.object({ playerId: id, gameId: id, stats: statLine,
  sourceWatermark: id.optional(),
  issuedContext: z.object({ version: z.literal("forge-issued-context-v1"), playerId: id, gameId: id,
    nhlPlayerId: positiveInteger, seasonId, teamId: positiveInteger, scheduledAt: instant,
    scheduleRevision: id, rosterRevision: id, observedAt: instant,
    scheduleSourceUpdatedAt: instant.nullable(), scheduleFetchedAt: instant.nullable(),
    identityUpdatedAt: instant.nullable(), membershipCreatedAt: z.array(instant).max(100) }).strict().optional(),
  allowedUses: allowedUses.optional(), assignmentStats: statLine.optional(),
  sourceKind: z.enum(["detailed", "baseline", "blended"]).optional(),
  conditionalStats: statLine.optional(), tieBreakStats: statLine.optional(),
  appearanceProbability: z.number().finite().min(0).max(1).nullable().optional(),
  contributions: z.record(z.string().min(1).max(50), resolvedContribution).optional(),
  cutoffAt: instant.optional(), expiresAt: instant.optional(),
  conditioning: z.literal("unconditional"), startProbability: z.number().finite().min(0).max(1).nullable(),
  confirmedStart: z.boolean(), revisionId: z.string().min(1).max(4096), issuedAt: instant, modelVersion: id.nullable(), limitations: stringArray }).strict();
const forecastExclusionReason = z.enum(["serving_disabled", "no_issued_revision", "unreleased_source",
  "identity_conflict", "missing_target", "stale_source", "future_input", "unsupported_conditioning",
  "missing_participation", "incompatible_overlap", "incompatible_component_basis", "outside_horizon",
  "use_not_approved", "canary_excluded", "discovery_timeout", "discovery_failed", "incomplete_refresh", "eligibility_unverified",
  "game_mismatch", "invalid_cutoff", "no_usable_target", "conflicting_forecast"]);
const forecastManifest = z.object({ version: z.literal("planning-forecasts-v1"), id,
  calendarPolicy: calendarPolicy.optional(),
  acceptedNewsRevision: id.nullable().optional(),
  seasonId, asOf: instant, scheduleRevision: id, rosterRevision: id, issuedRevisionIds: stringArray,
  exclusions: z.array(z.object({ gameId: id, playerId: id.optional(), targetKey: id.optional(), reasons: z.array(forecastExclusionReason).max(100) }).strict()).max(15000).optional(),
  baselineChecksum: id.nullable(), requiredOpportunities: z.number().int().nonnegative(),
  forecastedOpportunities: z.number().int().nonnegative(),
  exclusionCounts: z.record(z.string().min(1).max(50), z.number().int().nonnegative()) }).strict();
const period = z.object({ id, start: instant, end: instant, remaining: z.number().int().nonnegative().nullable(), source: z.enum(["provider", "manager", "unknown"]), lineupLockAt: instant.nullable().optional() }).strict().refine((value) => Date.parse(value.start) < Date.parse(value.end) && (!value.lineupLockAt || Date.parse(value.lineupLockAt) <= Date.parse(value.end)), "Invalid acquisition period bounds.");
const goalieMinimum = z.object({ required: z.number().int().nonnegative().nullable(), credited: z.number().int().nonnegative().nullable(), periodStart: date.nullable().optional(), periodEnd: date.nullable().optional(), counts: z.enum(["starts", "appearances", "unknown"]), penalty: z.enum(["lose_goalie_categories", "none", "unknown"]) }).strict();
const goaliePeriodOrdered = (value: { periodStart?: string | null; periodEnd?: string | null }) => !value.periodStart || !value.periodEnd || value.periodStart <= value.periodEnd;
const rules = z.object({
  lineupMode: z.enum(["daily", "weekly", "unsupported"]), rosterSlots: z.record(z.string().min(1), z.number().int().nonnegative()),
  lineupPeriods: z.array(z.object({ id, start: instant, end: instant, lockAt: instant.nullable() }).strict().refine((value) => Date.parse(value.start) < Date.parse(value.end) && (!value.lockAt || Date.parse(value.lockAt) <= Date.parse(value.end)), "Invalid lineup period bounds.")).max(100).optional(),
  acquisitionTiming: z.enum(["same_day", "next_day", "unknown"]), acquisitionCost: z.number().int().nonnegative().nullable(), periods: z.array(period).max(100),
  waivers: z.object({ mode: z.enum(["priority", "budget", "unknown"]), remainingBudget: z.number().finite().nonnegative().nullable() }).strict().optional(),
  scoring: z.object({ mode: z.enum(["points", "categories"]), weights: z.record(z.string().min(1), z.number().finite()), categories: z.array(z.object({ key: id, direction: z.enum(["higher", "lower"]), numerator: id.optional(), denominator: id.optional(), multiplier: z.number().finite().optional() }).strict()) }).strict(),
  goalieMinimum: goalieMinimum.refine(goaliePeriodOrdered, "Goalie minimum period ends before it starts."),
  unsupported: stringArray,
}).strict();
const managerRuleOverrides = rules.partial().extend({
  scoring: rules.shape.scoring.partial().optional(),
  goalieMinimum: goalieMinimum.partial().refine(goaliePeriodOrdered, "Goalie minimum period ends before it starts.").optional(),
});
const opponent = z.object({ roster: z.array(rosterEntry), realized: statLine, remaining: statLine.nullable() }).strict().nullable();
const step = z.object({ id, type: z.enum(["add", "drop", "reserve"]), playerId: id, dropPlayerId: id.optional(), reservePosition: z.enum(["IR", "IR+", "NA"]).optional(), at: instant, effectiveAt: instant, conditional: z.boolean(), waiverSpend: z.number().finite().nonnegative().nullable().optional(), dependsOn: stringArray }).strict();
const intent = z.object({ revision: z.number().int().nonnegative(), steps: z.array(step).max(500), protectedPlayerIds: stringArray, excludedPlayerIds: stringArray, goalieCoverage: z.enum(["accept_risk", "cover"]), goalieWindow: z.enum(["early", "late", "any"]), goalieSplit: z.enum(["mon_thu", "mon_wed"]), alternativeCount: z.union([z.literal(5), z.literal(10), z.literal(20)]) }).strict();
export const workspaceSchema: z.ZodType<PlanningWorkspace> = z.object({ version: z.literal(1), context: contextSchema, rules, managerRuleOverrides: managerRuleOverrides.optional(), roster: z.array(rosterEntry).max(200), lockedAssignments: z.array(lockedAssignment).max(1000).optional(), intent, manualPlayers: z.array(player).max(1000), unresolvedNames: stringArray, realized: statLine, opponent }).strict();
const acquisitionEvidence = z.object({ source: id, fetchedAt: instant, asOf: instant.nullable(),
  counter: z.object({ present: z.boolean(), coverageType: z.string().max(100).nullable(), coverageWeek: z.number().int().positive().nullable(),
    reportedValue: z.union([z.string().max(100), z.number().finite(), z.boolean()]).nullable(), used: z.number().int().nonnegative().nullable() }).strict(),
  limit: z.object({ present: z.boolean(), reportedValue: z.union([z.string().max(100), z.number().finite(), z.boolean()]).nullable(), verified: z.boolean() }).strict(),
  period: z.object({ week: z.number().int().positive().nullable(), startDate: date.nullable(), endDate: date.nullable(), containsHorizon: z.boolean() }).strict(),
  remaining: z.number().int().nonnegative().nullable(), limitations: stringArray }).strict();
export const snapshotSchema: z.ZodType<PlanningSnapshot> = z.object({ id, context: contextSchema, acquisitionEvidence: acquisitionEvidence.optional(),
  players: z.array(player).max(3000), roster: z.array(rosterEntry).max(200), games: z.array(game).max(5000),
  forecasts: z.array(forecast).max(15000), baselineSources: z.array(contributionSource).max(15000).optional(),
  forecastInputExclusions: forecastManifest.shape.exclusions,
  forecastManifest: forecastManifest.optional(), rules, lockedAssignments: z.array(lockedAssignment).max(1000),
  realized: statLine, opponent, evidence: z.record(z.string().min(1), evidence) }).strict();

export const saveWorkspaceSchema = z.object({ workspace: workspaceSchema, snapshot: snapshotSchema.nullable(), expectedVersion: z.number().int().positive().nullable() }).strict().superRefine((value, ctx) => {
  if (value.snapshot && JSON.stringify(value.snapshot.context) !== JSON.stringify(value.workspace.context)) ctx.addIssue({ code: "custom", message: "Snapshot context differs from workspace context." });
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > 10_000_000) ctx.addIssue({ code: "custom", message: "Workspace exceeds the save limit." });
});
export const workspaceQuerySchema = contextObjectSchema.pick({ provider: true, seasonId: true, leagueId: true, teamId: true, startDate: true, endDate: true }).strict().refine(validHorizon, "Planning range must be at most 367 days.");
