import { z } from "zod";
import { isInvertedCategory } from "lib/scoring/categoryScores";
import { draftProSnapshotSchema, type DraftProSnapshot } from "./contracts";
import { player, projection } from "./scenariosContract";
import { scenarioFingerprint, summarizeScenarioRoster, type ScenarioDustResult, type ScenarioInput, type ScenarioPlayer, type ScenarioRosterSummary } from "./scenarios";

export type DraftProReportType = "draft_summary" | "scenario_comparison";
export type ReportInput = Readonly<{
  roster: readonly ScenarioPlayer[];
  categoryWeights?: Readonly<Record<string, number>>;
  leagueType: "points" | "categories";
  season: string;
  source: ScenarioInput["source"];
  scoring: Readonly<Record<string, number>>;
  sourceWeights?: unknown;
  referenceRoster?: readonly ScenarioPlayer[];
  referenceBasis?: string;
}>;
export const reportInputSchema = z.object({
  roster: z.array(player).max(60),
  categoryWeights: z.record(z.string().max(100), z.number().finite().min(-1_000_000).max(1_000_000)).refine((value) => Object.keys(value).length <= 80).optional(),
  leagueType: z.enum(["points", "categories"]), season: z.string().trim().regex(/^\d{8}$/),
  source: z.object({ projection, schedule: z.object({ season: z.string().regex(/^\d{8}$/), gameKey: z.string().max(40).optional(), startWeek: z.number().int().min(1).max(40), endWeek: z.number().int().min(1).max(40), lineupMode: z.enum(["daily", "weekly"]), rosterSlots: z.record(z.string(), z.number().int().min(0).max(30)).refine((value) => Object.keys(value).length <= 30) }).strict() }).strict(),
  scoring: z.record(z.string().max(100), z.number().finite().min(-1_000_000).max(1_000_000)).refine((value) => Object.keys(value).length <= 80), sourceWeights: z.unknown().optional(),
  referenceRoster: z.array(player).max(60).optional(),
  referenceBasis: z.string().trim().min(1).max(160).optional(),
}).strict().superRefine((value, context) => {
  if (value.season !== value.source.schedule.season) context.addIssue({ code: z.ZodIssueCode.custom, message: "Report and schedule seasons must match." });
  if (value.source.schedule.endWeek < value.source.schedule.startWeek) context.addIssue({ code: z.ZodIssueCode.custom, message: "The matchup-week range is invalid." });
  for (const group of [value.roster, value.referenceRoster ?? []]) if (new Set(group.map((item) => item.id)).size !== group.length) context.addIssue({ code: z.ZodIssueCode.custom, message: "Roster player IDs must be distinct." });
  for (const player of [...value.roster, ...(value.referenceRoster ?? [])]) if (player.projectionSeason !== value.season) context.addIssue({ code: z.ZodIssueCode.custom, message: "Player projection seasons must match the report season." });
  if (Boolean(value.referenceRoster) !== Boolean(value.referenceBasis)) context.addIssue({ code: z.ZodIssueCode.custom, message: "A reference roster and its comparison label must be supplied together." });
});
export type DraftProReport = Readonly<{
  schemaVersion: 1;
  reportType: DraftProReportType;
  sourceFingerprint: string;
  createdAt: string;
  season: string;
  roster: Readonly<{ count: number; players: readonly Readonly<{ id: string; name: string; positions: readonly string[]; role: ScenarioPlayer["role"]; team: string | null }>[] }>;
  totals: ScenarioRosterSummary;
  strengths: readonly string[];
  weaknesses: readonly string[];
  comparisonBasis: string | null;
  schedule: { state: string; window: ScenarioDustResult["window"] | null; conflicts: readonly { date: string; teams: readonly string[]; games: number }[]; diagnostics: readonly string[] };
  analyticalInput: ReportInput;
  provenance: { projectionId: string; projectionVersion: string; projectionOrigin: string; season: string; scoring: Readonly<Record<string, number>>; sourceWeights: unknown; freshness: { oldestFetchedAt: string | null; latestFetchedAt: string | null } };
}>;

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const label = (key: string) => key.replaceAll("_", " ").toLowerCase();

export function buildDraftProReport(type: DraftProReportType, input: ReportInput, now = new Date(), dust: ScenarioDustResult | null = null): DraftProReport {
  const totals = summarizeScenarioRoster(input.roster, input.categoryWeights ?? {});
  const reference = input.referenceRoster ? summarizeScenarioRoster(input.referenceRoster, input.categoryWeights ?? {}) : null;
  const categories = Object.entries(totals.categories).filter(([, value]) => value !== null && finite(value));
  const comparison = (key: string, value: number, baseline: number) => isInvertedCategory(key) ? baseline - value : value - baseline;
  const strengths = reference ? categories.filter(([key, value]) => reference.categories[key] !== null && comparison(key, value as number, reference.categories[key] as number) > 0).map(([key]) => `${label(key)} is stronger than ${input.referenceBasis}`) : [];
  const weaknesses = reference ? categories.filter(([key, value]) => reference.categories[key] !== null && comparison(key, value as number, reference.categories[key] as number) < 0).map(([key]) => `${label(key)} is weaker than ${input.referenceBasis}`) : [];
  const unavailableComparisons = reference ? Object.keys(totals.categories).filter((key) => totals.categories[key] === null || reference.categories[key] === null).map((key) => `${label(key)} comparison is unavailable because required projections are missing`) : [];
  const sourceFingerprint = scenarioFingerprint({ type, roster: input.roster.map((player) => ({ ...player, eligiblePositions: [...player.eligiblePositions].sort() })).sort((a, b) => a.id.localeCompare(b.id)), referenceRoster: input.referenceRoster ?? [], categoryWeights: input.categoryWeights ?? {}, leagueType: input.leagueType, season: input.season, source: input.source, scoring: input.scoring, sourceWeights: input.sourceWeights ?? {}, schedule: dust ? { state: dust.state, freshness: dust.freshness, window: dust.window, baseline: dust.baseline, diagnostics: dust.diagnostics } : null });
  return {
    schemaVersion: 1, reportType: type, sourceFingerprint, createdAt: now.toISOString(), season: input.season, analyticalInput: input,
    roster: { count: input.roster.length, players: input.roster.map((player) => ({ id: player.id, name: player.name, positions: [...player.eligiblePositions], role: player.role, team: player.teamAbbreviation })) },
    totals, comparisonBasis: input.referenceBasis ?? null, strengths: [...strengths, ...unavailableComparisons].length ? [...strengths, ...unavailableComparisons] : [reference ? `No category is stronger than ${input.referenceBasis}.` : "Category strengths are unavailable without a comparison roster."], weaknesses: [...weaknesses, ...unavailableComparisons].length ? [...weaknesses, ...unavailableComparisons] : [reference ? `No category is weaker than ${input.referenceBasis}.` : "Category weaknesses are unavailable without a comparison roster."],
    schedule: { state: dust?.state ?? "schedule_unavailable", window: dust?.window ?? null, conflicts: dust?.baseline?.daily.filter((day) => day.benchGames > 0).map((day) => ({ date: day.date, teams: [], games: day.benchGames })) ?? [], diagnostics: dust?.diagnostics ?? ["Schedule conflicts require the server schedule optimizer context."] },
    provenance: { projectionId: input.source.projection.id, projectionVersion: input.source.projection.version, projectionOrigin: input.source.projection.origin, season: input.season, scoring: input.scoring, sourceWeights: input.sourceWeights ?? {}, freshness: { oldestFetchedAt: dust?.freshness.oldestFetchedAt ?? null, latestFetchedAt: dust?.freshness.latestFetchedAt ?? null } },
  };
}

export function buildScenarioReportInput(input: ScenarioInput): ReportInput {
  return { roster: input.roster, categoryWeights: input.categoryWeights, leagueType: input.leagueType, season: input.source.schedule.season, source: input.source, scoring: input.categoryWeights ?? {}, sourceWeights: {} };
}

const numericRecord = z.record(z.string(), z.number().finite());
const snapshotShape = z.object({ settings: z.object({ draftSettings: z.object({ teamCount: z.number().int().min(1).max(40), rosterConfig: z.record(z.string(), z.number().int().min(0).max(40)), leagueType: z.enum(["points", "categories"]), scoringCategories: numericRecord, categoryWeights: numericRecord.optional() }).passthrough() }).passthrough(), team: z.object({ myTeamId: z.string().min(1) }).passthrough(), picks: z.array(z.object({ playerId: z.string().min(1), teamId: z.string().min(1), pickNumber: z.number().int().positive() }).passthrough()), keepers: z.array(z.object({ playerId: z.string().min(1), teamId: z.string().min(1) }).passthrough()), sourceWeights: z.object({ skater: z.record(z.string(), z.object({ isSelected: z.boolean(), weight: z.number().finite().min(0).max(2) })), goalie: z.record(z.string(), z.object({ isSelected: z.boolean(), weight: z.number().finite().min(0).max(2) })), goaliePointValues: numericRecord }).passthrough() }).passthrough();
const reportError = (message: string, statusCode = 409) => Object.assign(new Error(message), { statusCode, code: "saved_input_mismatch" });
export function assertReportSnapshotMatch(snapshotValue: unknown, input: ReportInput, requireCompleted: boolean) {
  const snapshot = snapshotShape.parse(draftProSnapshotSchema.parse(snapshotValue));
  const settings = snapshot.settings.draftSettings; const teamId = snapshot.team.myTeamId;
  if (!settings || !teamId || !settings.rosterConfig || !Number.isInteger(settings.teamCount)) throw reportError("Saved draft report context is incomplete.", 400);
  const selected = new Set([...snapshot.picks, ...snapshot.keepers].filter((item) => item.teamId === teamId && typeof item.playerId === "string").map((item) => item.playerId as string));
  if (new Set(snapshot.picks.map((pick) => pick.playerId)).size !== snapshot.picks.length || new Set(snapshot.picks.map((pick) => pick.pickNumber)).size !== snapshot.picks.length) throw reportError("Saved draft picks contain duplicates.", 400);
  const reported = new Set(input.roster.map((item) => item.id));
  if (selected.size !== reported.size || [...selected].some((id) => !reported.has(id))) throw reportError("The analytical roster does not exactly match the selected draft team.");
  const weights = snapshot.sourceWeights as { goaliePointValues?: unknown };
  const expectedScoring = { ...(settings.scoringCategories as Record<string, number> ?? {}), ...(weights.goaliePointValues as Record<string, number> ?? {}) };
  const same = (left: unknown, right: unknown) => scenarioFingerprint(left) === scenarioFingerprint(right);
  if (settings.leagueType !== input.leagueType || !same(expectedScoring, input.scoring) || (input.leagueType === "categories" && !same(settings.categoryWeights ?? {}, input.categoryWeights ?? {})) || !same(snapshot.sourceWeights, input.sourceWeights ?? {})) throw reportError("The analytical scoring or source configuration does not match the saved draft.");
  const total = Object.values(settings.rosterConfig).reduce((sum, value) => sum + value, 0) * (settings.teamCount ?? 0);
  if (requireCompleted && snapshot.picks.length + snapshot.keepers.filter((keeper) => !snapshot.picks.some((pick) => pick.playerId === keeper.playerId)).length < total) throw reportError("Reports are available after the draft is complete.", 400);
  return snapshot as DraftProSnapshot;
}
