import type { ProcessedPlayer } from "hooks/useProcessedProjectionsData";
import type { PlayerVorpMetrics } from "hooks/useVORPCalculations";
import { normalizePlayerEligibility } from "lib/draftDashboard/forwardGrouping";
import type { SessionCsvEntry } from "lib/draftDashboard/csvImportSession";
import type { ProjectionSourceControls } from "lib/draftDashboard/sourceControlPreferences";
import { toNormalizedPrivateImports, type NormalizedPrivateImport } from "./savedDrafts";
import { scenarioFingerprint, type ScenarioInput, type ScenarioPlayer, type ScenarioSource } from "./scenarios";

export type ScenarioSavedImportContext = Readonly<{
  draftId: string;
  privateImports: readonly NormalizedPrivateImport[];
}>;

export type ScenarioDashboardAdapterArgs = Readonly<{
  players: readonly ProcessedPlayer[];
  availablePlayers: readonly ProcessedPlayer[];
  rosterAssignments: readonly Readonly<{ playerId: string; teamId: string }>[];
  myTeamId: string;
  candidateIds: readonly string[];
  vorpMetrics: ReadonlyMap<string, PlayerVorpMetrics>;
  leagueType: "points" | "categories";
  scoring: Readonly<Record<string, number>>;
  categoryWeights?: Readonly<Record<string, number>>;
  positionNeeds: Readonly<Record<string, number>>;
  season: string | null;
  schedule: Omit<ScenarioSource["schedule"], "season">;
  sourceControls: ProjectionSourceControls;
  goalieSourceControls: ProjectionSourceControls;
  customCsvList: readonly SessionCsvEntry[];
  savedImportContext: ScenarioSavedImportContext | null;
}>;

export type ScenarioDashboardAdapterResult = Readonly<{
  input: ScenarioInput | null;
  draftId: string | null;
  unavailableReason: string | null;
}>;

const ratioParts: Readonly<Record<string, readonly string[]>> = {
  SAVE_PERCENTAGE: ["SAVES_GOALIE", "SHOTS_AGAINST_GOALIE"],
  GOALS_AGAINST_AVERAGE: ["GOALS_AGAINST_GOALIE", "TOTAL_TOI"],
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`);
    return "{" + entries.join(",") + "}";
  }
  return JSON.stringify(value);
};

const importContent = (entry: NormalizedPrivateImport) => ({
  name: entry.name,
  sourceId: entry.sourceId,
  mapping: entry.mapping,
  rows: entry.rows,
});

const unavailable = (reason: string): ScenarioDashboardAdapterResult => ({ input: null, draftId: null, unavailableReason: reason });

function playerCategoryValues(player: ProcessedPlayer, enabled: readonly string[]) {
  const keys = new Set(enabled.flatMap((key) => ratioParts[key] ?? [key]));
  return Object.fromEntries([...keys].map((key) => {
    const projected = player.combinedStats[key]?.projected;
    return [key, typeof projected === "number" && Number.isFinite(projected) ? projected : null];
  }));
}

function scenarioPlayer(
  player: ProcessedPlayer,
  metrics: ReadonlyMap<string, PlayerVorpMetrics>,
  season: string,
  leagueType: "points" | "categories",
  enabledCategories: readonly string[],
): ScenarioPlayer | string {
  const id = String(player.playerId);
  const metric = metrics.get(id);
  if (!metric || !Number.isFinite(metric.vorp) || !Number.isFinite(metric.value)) return `Scenario data is unavailable because ${player.fullName} has no current league VORP.`;
  const eligiblePositions = normalizePlayerEligibility(player.displayPosition, player.eligiblePositions);
  if (!eligiblePositions.length) return `Scenario data is unavailable because ${player.fullName} has no eligible position.`;
  const projectedPoints = player.fantasyPoints.projected;
  if (leagueType === "points" && (typeof projectedPoints !== "number" || !Number.isFinite(projectedPoints))) return `Scenario data is unavailable because ${player.fullName} has no projected fantasy points.`;
  return {
    id,
    name: player.fullName,
    role: eligiblePositions.includes("G") ? "goalie" : "skater",
    eligiblePositions,
    teamAbbreviation: player.displayTeam,
    projectionSeason: season,
    globalVorp: metric.vorp,
    rankValue: metric.value,
    ...(typeof projectedPoints === "number" && Number.isFinite(projectedPoints) ? { projectedPoints } : {}),
    categoryValues: playerCategoryValues(player, enabledCategories),
  };
}

export function adaptScenarioDashboard(args: ScenarioDashboardAdapterArgs): ScenarioDashboardAdapterResult {
  if (!args.season || !/^\d{8}$/.test(args.season)) return unavailable("Scenario analysis is unavailable until the projection season is loaded.");
  if (args.schedule.endWeek < args.schedule.startWeek) return unavailable("Scenario analysis is unavailable because the matchup-week range is invalid.");
  if (args.candidateIds.length !== 2 || args.candidateIds[0] === args.candidateIds[1]) return unavailable("Choose two distinct available players to compare.");

  const availableById = new Map(args.availablePlayers.map((player) => [String(player.playerId), player]));
  const candidatePlayers = args.candidateIds.map((id) => availableById.get(id));
  if (candidatePlayers.some((player) => !player)) return unavailable("Both comparison players must still be available and undrafted.");

  const playersById = new Map(args.players.map((player) => [String(player.playerId), player]));
  const rosterPlayers = args.rosterAssignments.filter((assignment) => assignment.teamId === args.myTeamId).map((assignment) => playersById.get(assignment.playerId));
  if (rosterPlayers.some((player) => !player)) return unavailable("Scenario analysis is unavailable because a current roster player has no projection data.");

  const enabledScoring = args.leagueType === "categories" ? args.categoryWeights ?? {} : args.scoring;
  const enabledCategories = Object.entries(enabledScoring).filter(([, weight]) => Number.isFinite(weight) && weight !== 0).map(([key]) => key);
  const converted = [...(rosterPlayers as ProcessedPlayer[]), ...(candidatePlayers as ProcessedPlayer[])].map((player) => scenarioPlayer(player, args.vorpMetrics, args.season!, args.leagueType, enabledCategories));
  const conversionError = converted.find((player): player is string => typeof player === "string");
  if (conversionError) return unavailable(conversionError);
  const roster = converted.slice(0, rosterPlayers.length) as ScenarioPlayer[];
  const [candidateA, candidateB] = converted.slice(rosterPlayers.length) as ScenarioPlayer[];

  const selected = ([
    ...Object.entries(args.sourceControls).map(([id, control]) => ({ id, playerType: "skater" as const, ...control })),
    ...Object.entries(args.goalieSourceControls).map(([id, control]) => ({ id, playerType: "goalie" as const, ...control })),
  ]).filter((control) => control.isSelected && control.weight > 0).map(({ id, playerType, weight }) => ({ id, playerType, weight })).sort((left, right) => left.id.localeCompare(right.id) || left.playerType.localeCompare(right.playerType));
  if (!selected.length) return unavailable("Scenario analysis is unavailable until at least one projection source is enabled.");
  const selectedCustomIds = [...new Set(selected.map(({ id }) => id).filter((id) => id.startsWith("custom_csv_")))];
  let currentImports: NormalizedPrivateImport[];
  try { currentImports = toNormalizedPrivateImports(args.customCsvList.filter((entry) => selectedCustomIds.includes(entry.id))); }
  catch (cause) { return unavailable(cause instanceof Error ? cause.message : "A selected private projection is missing imported rows."); }
  const currentBySource = new Map(currentImports.map((entry) => [entry.sourceId, entry]));
  const privateImports: { id: string; contentFingerprint: string }[] = [];
  if (selectedCustomIds.length) {
    if (!args.savedImportContext || !UUID.test(args.savedImportContext.draftId)) return unavailable("Save the selected private projection imports to the current account draft before running a scenario.");
    for (const sourceId of selectedCustomIds) {
      const current = currentBySource.get(sourceId);
      if (!current) return unavailable(`The selected private projection ${sourceId} has no imported rows.`);
      const stored = args.savedImportContext.privateImports.find((entry) => entry.sourceId === sourceId);
      if (!stored || !stored.id || !UUID.test(stored.id) || canonical(importContent(stored)) !== canonical(importContent(current))) return unavailable(`The selected private projection ${current.name} has changed or is not saved to this account draft.`);
      privateImports.push({ id: stored.id, contentFingerprint: scenarioFingerprint(current.rows) });
    }
  }

  const projectionConfiguration = {
    season: args.season,
    sources: selected,
    scoring: args.scoring,
    categoryWeights: args.categoryWeights ?? {},
  };
  const source: ScenarioSource = {
    projection: {
      id: selectedCustomIds.length ? "dashboard-saved-private-blend" : "dashboard-server-blend",
      version: scenarioFingerprint(projectionConfiguration),
      origin: selectedCustomIds.length ? "saved_private_import" : "server",
      ...(selectedCustomIds.length ? { privateImports } : {}),
    },
    schedule: { ...args.schedule, season: args.season },
  };
  return {
    input: {
      roster,
      candidateA: { ...candidateA, available: true, drafted: false },
      candidateB: { ...candidateB, available: true, drafted: false },
      leagueType: args.leagueType,
      categoryWeights: enabledScoring,
      positionNeeds: { ...args.positionNeeds },
      source,
    },
    draftId: selectedCustomIds.length ? args.savedImportContext!.draftId : null,
    unavailableReason: null,
  };
}
