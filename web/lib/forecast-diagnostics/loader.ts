import { projectionInputHash } from "lib/projections/inputCapture";
import type { GameRow, NstTeamGamelogRow, TeamRow } from "lib/game-predictions/featureBuilder";
import { normalizeTeamGameFacts } from "lib/game-predictions/teamGameNormalization";
import { compareForecastBases, FORECAST_DIAGNOSTICS_VERSION, type DiagnosticScope, type ForecastBase, type ForecastDiagnosticsReport, type GoalContributor, type GoalDefinition, type SourceEvidence } from "./contract";
import { readFile, stat } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { frozenPairSchema, frozenPairDiagnosticReport, type FrozenPairOutput } from "./frozenPairRunner";

type Row = Record<string, unknown>;
type ReadResult = { data: unknown; error: unknown; count?: number | null };
export type DiagnosticReadQuery = PromiseLike<ReadResult> & {
  select(columns: string, options?: { count: "exact" }): DiagnosticReadQuery;
  eq(column: string, value: unknown): DiagnosticReadQuery;
  in(column: string, values: unknown[]): DiagnosticReadQuery;
  lte(column: string, value: string): DiagnosticReadQuery;
  lt(column: string, value: string): DiagnosticReadQuery;
  or(filter: string): DiagnosticReadQuery;
  order(column: string, options: { ascending: boolean }): DiagnosticReadQuery;
  range(from: number, to: number): DiagnosticReadQuery;
  limit(count: number): DiagnosticReadQuery;
  maybeSingle(): DiagnosticReadQuery;
  abortSignal(signal: AbortSignal): DiagnosticReadQuery;
};
/** This loader has no mutation or RPC capability. */
export type DiagnosticReadClient = { from(table: string): DiagnosticReadQuery };

export class DiagnosticReadError extends Error {
  constructor(public status: 400 | 404 | 503, message: string) { super(message); }
}

/** Explicit local-only packet mode. The caller's admin authorization and GET guard remain mandatory. */
export async function loadLocalFrozenPairDiagnostics(directory: string, query: { gameId: number; cutoffAt: string }): Promise<ForecastDiagnosticsReport> {
  if (process.env.NODE_ENV === "production" || !isAbsolute(directory))
    throw new DiagnosticReadError(503, "Local packet diagnostics require an absolute private directory in a local development runtime.");
  const readJson = async (name: string) => {
    const path = join(directory, name);
    if ((await stat(path)).size > 32 * 1024 * 1024) throw new Error("Oversized private packet");
    return JSON.parse(await readFile(path, "utf8"));
  };
  try {
    const failed = await stat(join(directory, "failed.json")).then(() => true, error => {
      if (error.code !== "ENOENT") throw error;
      return false;
    });
    if (failed) throw new Error("Failed packet execution");
    const packet = frozenPairSchema.parse(await readJson("inputs.json"));
    if (packet.scope.gameId !== query.gameId || Date.parse(packet.scope.cutoffAt) !== Date.parse(query.cutoffAt))
      throw new DiagnosticReadError(404, "The configured local packet does not match the requested game and cutoff.");
    const original = await readJson("original.json");
    if (original.inputHash !== projectionInputHash(packet) || original.forecastHash !== projectionInputHash(original.forecasts))
      throw new Error("Changed original or input packet");
    const derived = frozenPairDiagnosticReport(packet, original.forecasts as FrozenPairOutput, original.issuedAt, false);
    const stored = await readJson("diagnostics.json");
    if (projectionInputHash(stored) !== projectionInputHash(derived)) throw new Error("Diagnostic report differs from preserved forecasts");
    return stored;
  } catch (error) {
    if (error instanceof DiagnosticReadError) throw error;
    throw new DiagnosticReadError(503, "The local frozen packet is missing, changed or incompatible. No database evidence was queried.");
  }
}

const object = (value: unknown): Row => value != null && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const array = (value: unknown): Row[] => Array.isArray(value) ? value.map(object) : [];
const string = (value: unknown): string | null => typeof value === "string" && value.length > 0 ? value : null;
const number = (value: unknown): number | null =>
  (typeof value === "number" || typeof value === "string" && value.trim() !== "") && Number.isFinite(Number(value)) ? Number(value) : null;

export function parseDiagnosticQuery(query: { gameId?: unknown; cutoffAt?: unknown }): { gameId: number; cutoffAt: string } {
  if (typeof query.gameId !== "string" || !/^\d{10}$/.test(query.gameId)) throw new DiagnosticReadError(400, "gameId must be a canonical ten-digit NHL game ID.");
  if (typeof query.cutoffAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/i.test(query.cutoffAt)) throw new DiagnosticReadError(400, "cutoffAt must be an ISO timestamp with an explicit timezone.");
  const [year, month, day] = query.cutoffAt.slice(0, 10).split("-").map(Number);
  const parsed = Date.parse(query.cutoffAt);
  if (!Number.isFinite(parsed) || month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) throw new DiagnosticReadError(400, "cutoffAt is not a valid timestamp.");
  return { gameId: Number(query.gameId), cutoffAt: new Date(parsed).toISOString() };
}

async function read(query: DiagnosticReadQuery, source: string): Promise<{ data: unknown; retrievedAt: string }> {
  const result = await query.abortSignal(AbortSignal.timeout(12_000));
  if (result.error) throw new DiagnosticReadError(503, `Cannot read ${source}; diagnostic evidence is unavailable.`);
  if (result.count != null && result.count > 1000) throw new DiagnosticReadError(503, `${source} exceeds the bounded diagnostic inventory; coverage cannot be claimed.`);
  return { data: result.data, retrievedAt: new Date().toISOString() };
}

function evidence(source: string, row: Row, retrievedAt: string, immutable: boolean): SourceEvidence {
  const payload = row.payload ?? row.feature_payload ?? row;
  const digest = projectionInputHash(payload);
  const storedHash = string(row.payload_hash);
  return { source, revisionId: string(row.id ?? row.prediction_id ?? row.feature_snapshot_id), payloadHash: digest,
    observedAt: string(row.observed_at ?? row.decision_as_of),
    // Only retained observation/capture timestamps prove availability. Dated mutable rows do not.
    availableAt: source === "player_forecast_source_observations" ? string(row.available_at) : null,
    retrievedAt, availabilityBasis: source === "player_forecast_source_observations" ? "retained_capture" : "unknown",
    immutable, hashVerified: storedHash != null && storedHash === digest };
}

function definition(value: unknown): GoalDefinition | null {
  const row = object(value);
  return row.periods === "regulation_and_overtime" && row.shootout === "excluded" && ["included", "excluded", "unknown"].includes(String(row.emptyNet))
    ? row as GoalDefinition : null;
}

function meanSemantics(value: unknown): ForecastBase["meanSemantics"] {
  return value === "unconditional" || value === "conditional_on_appearance" ? value : "unknown";
}

function goals(row: Row): number | null {
  const total = number(row.proj_goals_total ?? row.proj_goals);
  if (total != null) return total;
  const components = [row.proj_goals_es, row.proj_goals_pp, row.proj_goals_pk].map(number);
  // A missing strength component cannot silently become zero.
  return components.every(value => value != null) ? components.reduce((sum, value) => sum! + value!, 0) : null;
}

function adaptedBase(args: { source: "forge" | "team"; record: Row; scope: DiagnosticScope; teamId: number; forecastSetId: string; lineage: SourceEvidence[] }): ForecastBase {
  const { source, record, scope, teamId, forecastSetId, lineage } = args;
  const payload = source === "forge" ? object(record.payload) : record;
  const metadata = object(source === "forge" ? payload.forecastDiagnostics : object(record.metadata).forecastDiagnostics);
  const players = source === "forge" ? array(payload.players).filter(row => number(row.team_id) === teamId && number(row.horizon_games) === 1) : [];
  const contributors: GoalContributor[] = players.map(row => ({ playerId: number(row.player_id) ?? 0,
    scenarioId: string(row.scenario_id ?? metadata.rosterScenarioId) ?? "", mean: goals(row),
    semantics: meanSemantics(row.mean_semantics ?? metadata.meanSemantics), appearanceProbability: number(row.appearance_probability) }));
  const rawMean = source === "team" ? number(teamId === number(record.home_team_id) ? record.home_expected_goals : record.away_expected_goals)
    : contributors.length > 0 && contributors.every(row => row.mean != null) ? contributors.reduce((sum, row) => sum + row.mean!, 0) : null;
  return { source, contractVersion: FORECAST_DIAGNOSTICS_VERSION, forecastSetId, gameId: number(record.game_id) ?? scope.gameId,
    teamId, seasonId: scope.seasonId, phase: scope.phase,
    horizonGames: source === "forge" && players.length > 0 && players.every(row => number(row.horizon_games) === 1) ? 1 : number(metadata.horizonGames),
    cutoffAt: string(source === "forge" ? payload.inputCutoff ?? record.decision_as_of : record.prediction_cutoff_at),
    issuedAt: string(source === "forge" ? record.published_at : record.computed_at),
    modelVersion: string(source === "forge" ? payload.modelVersion ?? metadata.modelVersion : record.model_version),
    calibrationVersion: string(metadata.calibrationVersion),
    featureNames: Array.isArray(metadata.featureNames) && metadata.featureNames.every(value => typeof value === "string") ? metadata.featureNames : null,
    rosterScenarioId: string(metadata.rosterScenarioId),
    strengthStates: Array.isArray(metadata.strengthStates) && metadata.strengthStates.every(value => typeof value === "string") ? metadata.strengthStates : [],
    workloadByStrength: Object.keys(object(metadata.workloadByStrength)).length > 0 ? Object.fromEntries(Object.entries(object(metadata.workloadByStrength)).map(([key, value]) => [key, number(value)])) : null,
    goalDefinition: definition(metadata.goalDefinition), rawMean, meanSemantics: meanSemantics(metadata.meanSemantics), appearanceProbability: null,
    residualMean: number(metadata.residualMean), emptyNetMean: number(metadata.emptyNetMean),
    coverage: metadata.coverage === "complete" ? "complete" : rawMean == null ? "unsupported" : "partial", contributors, lineage };
}

/** Reads existing retained records only; never invokes forecast generation or a queue. */
export async function loadForecastDiagnostics(client: DiagnosticReadClient, input: { gameId: number; cutoffAt: string }): Promise<ForecastDiagnosticsReport> {
  const gameRead = await read(client.from("games").select("id,date,startTime,seasonId,homeTeamId,awayTeamId,type").eq("id", input.gameId).maybeSingle(), "games");
  const game = object(gameRead.data);
  if (!Object.keys(game).length) throw new DiagnosticReadError(404, "Canonical game not found.");
  const startAt = string(game.startTime);
  if (!startAt || !/T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(startAt) || !Number.isFinite(Date.parse(startAt))) throw new DiagnosticReadError(503, "Game start has no verified timezone-qualified timestamp.");
  if (Date.parse(input.cutoffAt) >= Date.parse(startAt)) throw new DiagnosticReadError(400, "cutoffAt must be before the scheduled game start.");
  const teamIds = [number(game.homeTeamId), number(game.awayTeamId)];
  if (teamIds.some(id => id == null) || teamIds[0] === teamIds[1] || number(game.seasonId) == null || number(game.type) == null) throw new DiagnosticReadError(503, "Canonical game identity is incomplete.");
  const scope: DiagnosticScope = { gameId: input.gameId, seasonId: number(game.seasonId)!, phase: number(game.type)!, gameDate: string(game.date) ?? "", startAt, cutoffAt: input.cutoffAt, horizonGames: 1 };
  const [teamsRead, forgeRead, teamRead, previousGamesRead] = await Promise.all([
    read(client.from("teams").select("id,abbreviation,name").in("id", teamIds).order("id", { ascending: true }), "teams"),
    read(client.from("forge_game_revisions").select("id,run_id,game_id,input_snapshot_id,decision_as_of,published_at,payload").eq("game_id", input.gameId).lte("decision_as_of", input.cutoffAt).order("decision_as_of", { ascending: false }).order("published_at", { ascending: false }).limit(1), "forge_game_revisions"),
    read(client.from("game_prediction_history").select("*").eq("game_id", input.gameId).lte("prediction_cutoff_at", input.cutoffAt).order("prediction_cutoff_at", { ascending: false }).order("computed_at", { ascending: false }).limit(1), "game_prediction_history"),
    read(client.from("games").select("id,date,startTime,seasonId,homeTeamId,awayTeamId,type", { count: "exact" }).eq("seasonId", scope.seasonId).eq("type", 2).lt("date", scope.gameDate).or(`homeTeamId.in.(${teamIds.join(",")}),awayTeamId.in.(${teamIds.join(",")})`).order("id", { ascending: true }).range(0, 999), "prior games"),
  ]);
  const teams = array(teamsRead.data) as unknown as TeamRow[];
  if (teams.length !== 2 || teamIds.some(id => !teams.some(team => team.id === id))) throw new DiagnosticReadError(503, "Both canonical team identities are required.");
  const forge = array(forgeRead.data)[0] ?? null;
  const team = array(teamRead.data)[0] ?? null;
  const snapshotId = forge ? string(forge.input_snapshot_id) : null;
  const [nstRead, observationRead, featureRead] = await Promise.all([
    read(client.from("nst_team_gamelogs_as_counts").select("*", { count: "exact" }).eq("season_id", scope.seasonId).in("team_abbreviation", teams.map(row => row.abbreviation)).lte("date", scope.gameDate).order("date", { ascending: true }).order("team_abbreviation", { ascending: true }).range(0, 999), "NST all-situations counts"),
    snapshotId ? read(client.from("player_forecast_source_observations").select("id,observed_at,available_at,payload_hash,payload").eq("id", snapshotId).maybeSingle(), "FORGE input observation") : Promise.resolve({ data: null, retrievedAt: forgeRead.retrievedAt }),
    team && string(team.feature_snapshot_id) ? read(client.from("game_prediction_feature_snapshots").select("*").eq("feature_snapshot_id", team.feature_snapshot_id).maybeSingle(), "team feature snapshot") : Promise.resolve({ data: null, retrievedAt: teamRead.retrievedAt }),
  ]);
  const observation = object(observationRead.data);
  const feature = object(featureRead.data);
  const sources: SourceEvidence[] = [evidence("games", game, gameRead.retrievedAt, false)];
  if (forge) sources.push(evidence("forge_game_revisions", forge, forgeRead.retrievedAt, true));
  if (Object.keys(observation).length) sources.push(evidence("player_forecast_source_observations", observation, observationRead.retrievedAt, true));
  if (team) sources.push(evidence("game_prediction_history", team, teamRead.retrievedAt, true));
  if (Object.keys(feature).length) sources.push(evidence("game_prediction_feature_snapshots", feature, featureRead.retrievedAt, true));
  const nstRows = array(nstRead.data) as unknown as NstTeamGamelogRow[];
  sources.push(evidence("nst_team_gamelogs_as_counts", { id: `season:${scope.seasonId}`, payload: nstRead.data }, nstRead.retrievedAt, false));
  const forecastSetId = `diagnostic:${projectionInputHash({ scope, records: { forge, team, observation, feature }, nst: nstRows, previousGames: previousGamesRead.data })}`;
  const comparisons = teams.map(identity => compareForecastBases({ scope, teamId: identity.id, abbreviation: identity.abbreviation,
    forge: forge ? adaptedBase({ source: "forge", record: forge, scope, teamId: identity.id, forecastSetId, lineage: sources.filter(row => ["forge_game_revisions", "player_forecast_source_observations"].includes(row.source)) }) : null,
    team: team ? adaptedBase({ source: "team", record: team, scope, teamId: identity.id, forecastSetId, lineage: sources.filter(row => ["game_prediction_history", "game_prediction_feature_snapshots"].includes(row.source)) }) : null,
  }));
  const exposure = teams.map(identity => {
    const rows = nstRows.filter(row => row.team_abbreviation === identity.abbreviation);
    const normalized = normalizeTeamGameFacts({ rows, games: array(previousGamesRead.data) as unknown as GameRow[], teams, cutoffAt: scope.cutoffAt, phase: 2, strength: "all" });
    const totals = (field: "gp" | "gf" | "ga") => normalized.facts.length > 0 && normalized.facts.every(fact => number(fact[field]) != null) ? normalized.correctedTotals[field] : null;
    return { teamId: identity.id, abbreviation: identity.abbreviation, seasonId: scope.seasonId, source: "nst_team_gamelogs_as_counts", sourceRowCount: rows.length,
      legacyTotals: normalized.legacyTotals, correctedTotals: { gp: totals("gp"), gf: totals("gf"), ga: totals("ga") },
      lastFiveGameIds: normalized.facts.slice(0, 5).map(row => row.game_id), actualLastFiveCount: Math.min(5, normalized.facts.length), acceptedGameIds: normalized.facts.map(row => row.game_id),
      coverage: normalized.facts.length === 0 ? "unavailable" as const : normalized.exclusions.length > 0 ? "partial" as const : "complete" as const, exclusions: normalized.exclusions };
  });
  const blockers = [...new Set(comparisons.flatMap(row => row.reasons))];
  if (exposure.some(row => row.coverage !== "complete")) blockers.push("canonical_exposure_not_fully_qualified");
  blockers.push("original_executable_model_replay_not_verified");
  return { contractVersion: FORECAST_DIAGNOSTICS_VERSION, forecastSetId, generatedAt: new Date().toISOString(), evidenceKind: "retained_records", scope, comparisons, exposure, sources,
    replay: { status: "not_verified", blockers }, limitations: [
      "Raw estimates are retained source values; unknown goal endpoints and participation cannot be rescaled into agreement.",
      "Legacy NST storage dates do not prove original availability or completed-game identity; exclusions are evidence gaps, not zero exposure.",
      "A canonical database schedule alone does not independently authenticate a real NHL result.",
      "No source refresh, prediction generation, database mutation, model selection or serving activation was performed.",
      "Alignment and content hashes do not prove model accuracy or executable serving/replay parity.",
    ] };
}
