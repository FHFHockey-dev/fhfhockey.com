import type { ProcessedPlayer } from "hooks/useProcessedProjectionsData";
import type { PlayerVorpMetrics } from "hooks/useVORPCalculations";
import { normalizePlayerEligibility } from "lib/draftDashboard/forwardGrouping";
import type { SessionCsvEntry } from "lib/draftDashboard/csvImportSession";
import type { ProjectionSourceControls } from "lib/draftDashboard/sourceControlPreferences";
import type { DraftProSnapshot } from "./contracts";
import type { ReportInput } from "./reports";
import { serializeSavedDraft, toNormalizedPrivateImports, type BrowserDraftSnapshot, type NormalizedPrivateImport } from "./savedDrafts";
import { scenarioFingerprint, type ScenarioPlayer, type ScenarioSource } from "./scenarios";
import type { ScenarioSavedImportContext } from "./scenarioDashboardAdapter";

export type { ReportInput } from "./reports";

export type OpenedReportDraft = Readonly<{
  id: string;
  snapshot: DraftProSnapshot;
  privateImports: readonly NormalizedPrivateImport[];
}>;

export type ReportDashboardAdapterArgs = Readonly<{
  players: readonly ProcessedPlayer[];
  rosterAssignments: readonly Readonly<{ playerId: string; teamId: string }>[];
  myTeamId: string;
  vorpMetrics: ReadonlyMap<string, PlayerVorpMetrics>;
  leagueType: "points" | "categories";
  scoring: Readonly<Record<string, number>>;
  goaliePointValues: Readonly<Record<string, number>>;
  categoryWeights?: Readonly<Record<string, number>>;
  season: string | null;
  schedule: Omit<ScenarioSource["schedule"], "season"> | null;
  sourceControls: ProjectionSourceControls;
  goalieSourceControls: ProjectionSourceControls;
  customCsvList: readonly SessionCsvEntry[];
  current: Readonly<{ snapshot: BrowserDraftSnapshot; complete: boolean; savedImportContext: ScenarioSavedImportContext | null }> | null;
  openedDraft: OpenedReportDraft | null;
  reference: Readonly<{ teamId: string; teamName: string; complete: boolean }> | null;
}>;

export type ReportDashboardAdapterResult = Readonly<{
  input: ReportInput | null;
  snapshot?: DraftProSnapshot;
  draftId?: string;
  privateImportDraftId?: string;
  context: "current" | "opened_saved" | null;
  unavailableReason: string | null;
}>;

const ratioParts: Readonly<Record<string, readonly string[]>> = {
  SAVE_PERCENTAGE: ["SAVES_GOALIE", "SHOTS_AGAINST_GOALIE"],
  GOALS_AGAINST_AVERAGE: ["GOALS_AGAINST_GOALIE", "TOTAL_TOI"],
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const unavailable = (reason: string): ReportDashboardAdapterResult => ({ input: null, context: null, unavailableReason: reason });
const canonical = (value: unknown): string => Array.isArray(value)
  ? `[${value.map(canonical).join(",")}]`
  : value && typeof value === "object"
    ? "{" + Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(",") + "}"
    : JSON.stringify(value);
const importContent = (entry: NormalizedPrivateImport) => ({ name: entry.name, sourceId: entry.sourceId, mapping: entry.mapping, rows: entry.rows });

function enabledKeys(weights: Readonly<Record<string, number>>) {
  return Object.entries(weights).flatMap(([key, weight]) => Number.isFinite(weight) && weight !== 0 ? ratioParts[key] ?? [key] : []);
}

function reportPlayer(player: ProcessedPlayer, metrics: ReadonlyMap<string, PlayerVorpMetrics>, season: string, categories: readonly string[]): ScenarioPlayer | string {
  const metric = metrics.get(String(player.playerId));
  if (!metric || !Number.isFinite(metric.vorp) || !Number.isFinite(metric.value)) return `Report capture is unavailable because ${player.fullName} has no current league VORP.`;
  const eligiblePositions = normalizePlayerEligibility(player.displayPosition, player.eligiblePositions);
  if (!eligiblePositions.length) return `Report capture is unavailable because ${player.fullName} has no eligible position.`;
  const projectedPoints = player.fantasyPoints.projected;
  const categoryValues = Object.fromEntries([...new Set(categories)].map((key) => {
    const value = player.combinedStats[key]?.projected;
    return [key, typeof value === "number" && Number.isFinite(value) ? value : null];
  }));
  return {
    id: String(player.playerId), name: player.fullName, role: eligiblePositions.includes("G") ? "goalie" : "skater", eligiblePositions,
    teamAbbreviation: player.displayTeam, projectionSeason: season, globalVorp: metric.vorp, rankValue: metric.value,
    ...(typeof projectedPoints === "number" && Number.isFinite(projectedPoints) ? { projectedPoints } : {}), categoryValues, drafted: true, available: false,
  };
}

export function adaptReportDashboard(args: ReportDashboardAdapterArgs): ReportDashboardAdapterResult {
  if (!args.season || !/^\d{8}$/.test(args.season)) return unavailable("Report capture is unavailable until the projection season is loaded.");
  if (!args.schedule) return unavailable("Report capture is unavailable until the current matchup-week range is loaded.");
  if (args.schedule.endWeek < args.schedule.startWeek) return unavailable("Report capture is unavailable because the matchup-week range is invalid.");
  const context = args.openedDraft ? "opened_saved" : args.current ? "current" : null;
  if (!context) return unavailable("Save or open a draft before preparing a report.");
  if (context === "current" && !args.current!.complete) return unavailable("Complete the current draft before creating a new report.");
  let snapshot: DraftProSnapshot;
  try { snapshot = context === "current" ? serializeSavedDraft(args.current!.snapshot) : args.openedDraft!.snapshot; }
  catch (cause) { return unavailable(cause instanceof Error ? cause.message : "The current draft snapshot is invalid."); }
  if (context === "opened_saved" && canonical({ skater: args.sourceControls, goalie: args.goalieSourceControls, goaliePointValues: args.goaliePointValues }) !== canonical(snapshot.sourceWeights)) {
    return unavailable("Save current source and goalie scoring changes first before preparing a report from this saved draft.");
  }
  const enabledScoring = args.leagueType === "categories" ? args.categoryWeights ?? {} : args.scoring;
  if (Object.values(args.scoring).some((value) => !Number.isFinite(value)) || Object.values(enabledScoring).some((value) => !Number.isFinite(value))) return unavailable("Report capture is unavailable because scoring settings are invalid.");
  const playersById = new Map(args.players.map((player) => [String(player.playerId), player]));
  const selectedRoster = (teamId: string) => args.rosterAssignments.filter((assignment) => assignment.teamId === teamId).map((assignment) => playersById.get(assignment.playerId));
  const rosterPlayers = selectedRoster(args.myTeamId);
  if (!rosterPlayers.length || rosterPlayers.some((player) => !player)) return unavailable("Report capture is unavailable because the selected team's roster is incomplete.");
  const categories = enabledKeys(enabledScoring);
  const convert = (players: readonly ProcessedPlayer[]) => players.map((player) => reportPlayer(player, args.vorpMetrics, args.season!, categories));
  const roster = convert(rosterPlayers as ProcessedPlayer[]);
  const rosterError = roster.find((player): player is string => typeof player === "string");
  if (rosterError) return unavailable(rosterError);
  const selectedSources = ([
    ...Object.entries(args.sourceControls).map(([id, control]) => ({ id, playerType: "skater" as const, ...control })),
    ...Object.entries(args.goalieSourceControls).map(([id, control]) => ({ id, playerType: "goalie" as const, ...control })),
  ]).filter((control) => control.isSelected && control.weight > 0).map(({ id, playerType, weight }) => ({ id, playerType, weight })).sort((left, right) => left.id.localeCompare(right.id) || left.playerType.localeCompare(right.playerType));
  if (!selectedSources.length) return unavailable("Report capture is unavailable until at least one projection source is enabled.");
  const selectedCustomIds = [...new Set(selectedSources.map(({ id }) => id).filter((id) => id.startsWith("custom_csv_")))];
  let currentImports: NormalizedPrivateImport[];
  try { currentImports = toNormalizedPrivateImports(args.customCsvList.filter((entry) => selectedCustomIds.includes(entry.id))); }
  catch (cause) { return unavailable(cause instanceof Error ? cause.message : "A selected private projection is missing imported rows."); }
  const savedImports = context === "current" ? args.current!.savedImportContext?.privateImports : args.openedDraft!.privateImports;
  const savedDraftId = context === "current" ? args.current!.savedImportContext?.draftId : args.openedDraft!.id;
  const currentBySource = new Map(currentImports.map((entry) => [entry.sourceId, entry]));
  const privateImports: { id: string; contentFingerprint: string }[] = [];
  if (selectedCustomIds.length) {
    if (!savedImports || !savedDraftId || !UUID.test(savedDraftId)) return unavailable("Save the selected private projection imports to the current account draft before preparing a report.");
    for (const sourceId of selectedCustomIds) {
      const current = currentBySource.get(sourceId);
      const stored = savedImports.find((entry) => entry.sourceId === sourceId);
      if (!current) return unavailable(`The selected private projection ${sourceId} has no imported rows.`);
      if (!stored || !stored.id || !UUID.test(stored.id) || canonical(importContent(stored)) !== canonical(importContent(current))) return unavailable(`The selected private projection ${current.name} has changed or is not saved to this account draft.`);
      privateImports.push({ id: stored.id, contentFingerprint: scenarioFingerprint(current.rows) });
    }
  }
  let referenceRoster: ScenarioPlayer[] | undefined;
  let referenceBasis: string | undefined;
  if (args.reference?.complete && args.reference.teamId !== args.myTeamId) {
    const referencePlayers = selectedRoster(args.reference.teamId);
    if (referencePlayers.length && referencePlayers.every(Boolean)) {
      const convertedReference = convert(referencePlayers as ProcessedPlayer[]);
      if (convertedReference.every((player): player is ScenarioPlayer => typeof player !== "string")) {
        referenceRoster = convertedReference;
        referenceBasis = args.reference.teamName;
      }
    }
  }
  const projectionConfiguration = { season: args.season, sources: selectedSources, scoring: args.scoring, categoryWeights: args.categoryWeights ?? {} };
  const input: ReportInput = {
    roster: roster as ScenarioPlayer[], leagueType: args.leagueType, season: args.season, scoring: { ...args.scoring }, sourceWeights: snapshot.sourceWeights,
    categoryWeights: { ...enabledScoring },
    ...(referenceRoster && referenceBasis ? { referenceRoster, referenceBasis } : {}),
    source: { projection: { id: selectedCustomIds.length ? "dashboard-saved-private-blend" : "dashboard-server-blend", version: scenarioFingerprint(projectionConfiguration), origin: selectedCustomIds.length ? "saved_private_import" : "server", ...(selectedCustomIds.length ? { privateImports } : {}) }, schedule: { ...args.schedule, season: args.season } },
  };
  return context === "current"
    ? { input, snapshot, ...(selectedCustomIds.length ? { privateImportDraftId: savedDraftId } : {}), context, unavailableReason: null }
    : { input, draftId: args.openedDraft!.id, context, unavailableReason: null };
}
