import { z } from "zod";
import { createHash, randomUUID } from "node:crypto";
import { buildNativePlayerGoalAccounting, buildNativeTeamGoalAccounting, type NativeSkaterGoalRow } from "../projections/nativeGoalAccounting";
import { projectionForecastRows, projectionWritesHash, type ForgeInputSnapshot } from "../projections/gameRevisions";
import { projectionInputHash } from "../projections/inputCapture";
import { accountForgeTeamGoals, availableBefore, historicalGameSchema, modelFreezeSchema, pairScopeSchema,
  provenanceSchema, goalHistoryFromOfficialFinal, scoreTeamGoals, validateTeamFreeze, type ForgeGoalCoverage, type ModelFreeze } from "./pairedInputs";
import { compareForecastBases, FORECAST_DIAGNOSTICS_VERSION, type ForecastBase, type ForecastDiagnosticsReport,
  type SourceEvidence } from "./contract";

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const coverageSchema = z.object({ rosterPlayerIds: z.array(z.number().int().positive()).max(100),
  residualMean: z.number().finite().nonnegative().nullable(), strengthPartition: z.enum(["exclusive_es_pp_pk", "unknown"]),
  overtime: z.enum(["included", "unknown"]), emptyNet: z.enum(["included", "unknown"]),
  proofRevisionIds: z.array(z.string().min(1)).max(100) }).strict();
export const frozenPairSchema = z.object({
  version: z.literal("frozen-pair-v1"), evidenceKind: z.enum(["prospective_capture", "synthetic_fixture"]),
  pairId: z.string().uuid(), forgeRunId: z.string().uuid(), teamRunId: z.string().uuid(),
  frozenAt: z.string().datetime({ offset: true }), scope: pairScopeSchema,
  teamFreeze: modelFreezeSchema, forgeFreeze: modelFreezeSchema,
  history: z.array(historicalGameSchema).max(200),
  forgeSnapshot: z.object({ version: z.literal("forge-inputs-v1"), runId: z.string().uuid(), codeVersion: z.string(),
    slateDate: z.string(), inputCutoff: z.string().datetime({ offset: true }), horizonGames: z.literal(1),
    gameIds: z.array(z.number().int().positive()).length(1), outputHash: hash,
    reads: z.array(z.object({ request: z.array(z.object({ method: z.string(), args: z.array(z.unknown()) })).min(1),
      result: z.unknown(), receivedAt: z.string().datetime({ offset: true }), failure: z.string().optional() })).min(1).max(2000)
  }).passthrough().transform(value => value as ForgeInputSnapshot), forgeSnapshotHash: hash,
  // One receipt per captured query binds availability to the exact read payload.
  forgeReadProvenance: z.array(provenanceSchema).min(1).max(2000),
  retainedHistorySources: z.array(z.object({ revisionId: z.string().min(1), payload: z.unknown(),
    bodyUtf8: z.string().max(8 * 1024 * 1024), rawBytesHash: hash }).strict()).max(200),
  forgeCoverage: z.object({ home: coverageSchema, away: coverageSchema }).strict(),
}).strict();
export type FrozenPair = z.infer<typeof frozenPairSchema>;
type ForgeScore = { runId: string; outputHash: string; matched: boolean;
  writes: Array<Array<{ method: string; args: unknown[] }>> };
export type PairScorers = {
  forge: (snapshot: ForgeInputSnapshot, hash: string) => Promise<ForgeScore>;
  retainExecutionWrites?: (writes: ForgeScore["writes"]) => void;
};

/** Assemble retained evidence only. Verification uses the actual assembly clock, never the source's earlier receipt time. */
export function assembleFrozenPairFromCapture(captureInput: unknown, historyInput: unknown,
  executionFreeze: { team: ModelFreeze; forge: ModelFreeze }): FrozenPair {
  const capture = z.object({ evidenceKind: frozenPairSchema.shape.evidenceKind,
    snapshot: frozenPairSchema.shape.forgeSnapshot, snapshotHash: hash,
    writes: z.array(z.array(z.object({ method: z.string(), args: z.array(z.unknown()) }))).min(1).max(2000),
  }).parse(captureInput);
  const history = z.object({ scope: pairScopeSchema, history: frozenPairSchema.shape.history,
    retainedHistorySources: frozenPairSchema.shape.retainedHistorySources,
    capturedAt: z.string().datetime({ offset: true }), acceptanceEligible: z.literal(false),
  }).parse(historyInput);
  const verifiedAt = new Date().toISOString();
  const capturedAt = z.string().datetime({ offset: true }).parse(capture.snapshot.capturedAt);
  if (Date.parse(capturedAt) > Date.parse(verifiedAt) || Date.parse(history.capturedAt) > Date.parse(verifiedAt)
    || capture.snapshot.reads.some(read => Date.parse(read.receivedAt) > Date.parse(capturedAt))
    || history.history.some(row => Date.parse(row.provenance.verifiedAt) > Date.parse(history.capturedAt)))
    throw new Error("Retained capture precedes its reads or is dated after assembly");
  if (projectionInputHash(capture.snapshot) !== capture.snapshotHash
    || projectionWritesHash(capture.writes) !== capture.snapshot.outputHash)
    throw new Error("Retained native capture or suppressed output hash differs");
  const unknownCoverage: ForgeGoalCoverage = { rosterPlayerIds: [], residualMean: null,
    strengthPartition: "unknown", overtime: "unknown", emptyNet: "unknown", proofRevisionIds: [] };
  const packet = frozenPairSchema.parse({ version: "frozen-pair-v1", evidenceKind: capture.evidenceKind,
    pairId: randomUUID(), teamRunId: randomUUID(), forgeRunId: capture.snapshot.runId, frozenAt: verifiedAt,
    scope: history.scope, teamFreeze: executionFreeze.team, forgeFreeze: executionFreeze.forge,
    history: history.history, retainedHistorySources: history.retainedHistorySources,
    forgeSnapshot: capture.snapshot, forgeSnapshotHash: capture.snapshotHash,
    forgeReadProvenance: capture.snapshot.reads.map(read => ({ revisionId: randomUUID(),
      payloadHash: projectionInputHash(read), source: `retained FORGE table read:${String(read.request[0]?.args[0])}`,
      firstReceivedAt: read.receivedAt, verifiedAt, publishedAt: null, availabilityBasis: "retained_capture", correctionOf: null })),
    // Forecast contributors cannot establish a complete roster or certify unsupported goal components.
    forgeCoverage: { home: unknownCoverage, away: unknownCoverage } });
  validateFrozenPair(packet, executionFreeze);
  return packet;
}

export function validateFrozenPair(packet: FrozenPair, executionFreeze: { team: ModelFreeze; forge: ModelFreeze }) {
  frozenPairSchema.parse(packet);
  validateTeamFreeze(packet.teamFreeze);
  if (packet.forgeRunId === packet.teamRunId || packet.pairId === packet.forgeRunId || packet.pairId === packet.teamRunId)
    throw new Error("Pair and run IDs must be distinct");
  if (projectionInputHash(packet.teamFreeze) !== projectionInputHash(executionFreeze.team)
    || projectionInputHash(packet.forgeFreeze) !== projectionInputHash(executionFreeze.forge)) throw new Error("Frozen code/features/parameters/calibration differ from execution");
  if (Date.parse(packet.frozenAt) >= Date.parse(packet.scope.cutoffAt)) throw new Error("Inputs were not frozen before cutoff");
  if (packet.evidenceKind === "prospective_capture" && packet.forgeSnapshot.replayClassification !== "prospective_frozen")
    throw new Error("Historical reconstruction cannot become prospective evidence");
  const snapshot = packet.forgeSnapshot;
  if (projectionInputHash(snapshot) !== packet.forgeSnapshotHash || snapshot.version !== "forge-inputs-v1"
    || snapshot.runId !== packet.forgeRunId || snapshot.codeVersion !== packet.forgeFreeze.codeCommit
    || snapshot.inputCutoff !== packet.scope.cutoffAt || snapshot.horizonGames !== 1
    || snapshot.gameIds.length !== 1 || snapshot.gameIds[0] !== packet.scope.gameId
    || snapshot.slateDate !== packet.scope.gameDate || snapshot.controlledScenario && packet.evidenceKind !== "synthetic_fixture")
    throw new Error("FORGE snapshot scope, code or checksum mismatch");
  if (snapshot.reads.length !== packet.forgeReadProvenance.length || snapshot.reads.length > 2000
    || !snapshot.reads.length) throw new Error("Missing or excessive FORGE input receipts");
  snapshot.reads.forEach((read, index) => {
    const receipt = packet.forgeReadProvenance[index];
    if (read.failure || (read.result && typeof read.result === "object" && "error" in read.result && read.result.error != null)
      || read.request[0]?.method !== "from" || read.request.some(op => ["rpc", "insert", "update", "upsert", "delete"].includes(op.method)))
      throw new Error("Only successful recorded table reads are permitted");
    if (receipt.payloadHash !== projectionInputHash(read) || receipt.firstReceivedAt !== read.receivedAt
      || !availableBefore(receipt, packet.scope.cutoffAt) || Date.parse(receipt.verifiedAt) > Date.parse(packet.frozenAt))
      throw new Error("Unverified, later or substituted FORGE input");
  });
  const proofs = new Set(packet.forgeReadProvenance.map(row => row.revisionId));
  for (const coverage of Object.values(packet.forgeCoverage)) {
    if (coverage.proofRevisionIds.some(revision => !proofs.has(revision))) throw new Error("Unretained goal endpoint proof");
  }
  for (const row of packet.history) {
    if (Date.parse(row.provenance.verifiedAt) > Date.parse(packet.frozenAt)) throw new Error("History was verified after freeze");
    const sources = packet.retainedHistorySources.filter(source => source.revisionId === row.provenance.revisionId);
    if (sources.length !== 1 || projectionInputHash(sources[0].payload) !== row.provenance.payloadHash)
      throw new Error("Historical input bytes are missing or substituted");
    if (createHash("sha256").update(sources[0].bodyUtf8).digest("hex") !== sources[0].rawBytesHash
      || projectionInputHash(JSON.parse(sources[0].bodyUtf8)) !== row.provenance.payloadHash)
      throw new Error("Historical raw response checksum mismatch");
    const derived = goalHistoryFromOfficialFinal(sources[0].payload, row.provenance).find(candidate => candidate.teamId === row.teamId);
    if (!derived || projectionInputHash(derived) !== projectionInputHash(row)) throw new Error("Historical facts differ from retained official final");
  }
  scoreTeamGoals(packet.scope, packet.history);
}

function projectionRows(score: ForgeScore, gameId: number, teamId: number) {
  const rows: Array<Record<string, any>> = [];
  for (const operations of score.writes) {
    if (operations[0]?.method !== "from" || operations[0]?.args[0] !== "forge_player_projections") continue;
    const value = operations.find(op => ["insert", "upsert"].includes(op.method))?.args[0];
    for (const row of Array.isArray(value) ? value : value ? [value] : []) {
      if (row.game_id === gameId && row.team_id === teamId && row.horizon_games === 1) rows.push(row);
    }
  }
  return rows;
}

const nativeRosterCoverageSchema = z.object({
  version: z.literal("native-roster-contributor-coverage-v1"),
  contributors: z.array(z.object({ playerId: z.number().int().positive(),
    population: z.enum(["skater", "goalie", "position_unverified"]),
    selectionReason: z.enum(["projected_partial_skater", "outside_skater_estimator", "outside_candidate_pool",
      "unavailable_by_producer_gate", "team_or_position_filtered", "missing_rate_history", "hard_stale_rate_history",
      "invalid_rate_recency_source", "eligible_skater_not_projected", "unclassified_producer_omission"]),
    rateEligibility: z.enum(["outside_skater_estimator", "passed", "failed", "not_evaluated"]),
    participationProbabilityGivenGamePlayed: z.union([z.literal(0), z.literal(1)]).nullable(),
    participationReason: z.string().nullable(), goalContributionStatus: z.enum(["modeled_partial", "confirmed_out_given_game_played", "unknown"]),
    fullOfficialPlayMean: z.null(),
  }).strict()).max(100),
  unmodeledGoaliePlayerIds: z.array(z.number().int().positive()).max(100),
  unevaluatedRosterPlayerIds: z.array(z.number().int().positive()).max(100),
  eligibleUnprojectedSkaterPlayerIds: z.array(z.number().int().positive()).max(100),
  unknownResidualPlayerIds: z.array(z.number().int().positive()).max(100), residualMean: z.null(),
}).strict();

/** Check retained selection identities and internal labels; causes remain producer provenance. */
function nativeRosterCoverage(team: Record<string, any>, players: Record<string, any>[], accounting: ReturnType<typeof buildNativeTeamGoalAccounting>) {
  const value = team.uncertainty?.native_roster_contributor_coverage;
  if (value == null) return null;
  const parsed = nativeRosterCoverageSchema.safeParse(value);
  if (!parsed.success) throw new Error("Native roster coverage has unsupported values");
  const coverage = parsed.data, ids = coverage.contributors.map(row => row.playerId);
  if (new Set(ids).size !== ids.length || projectionInputHash(ids) !== projectionInputHash(accounting.currentRosterPlayerIds)
    || players.some(player => !ids.includes(player.player_id))) throw new Error("Native roster coverage differs from retained contributor identities");
  for (const row of coverage.contributors) {
    const player = players.find(player => player.player_id === row.playerId);
    const rateEligibility = row.selectionReason === "outside_skater_estimator" ? ["outside_skater_estimator"]
      : row.selectionReason === "outside_candidate_pool" ? ["not_evaluated"]
        : ["projected_partial_skater", "eligible_skater_not_projected"].includes(row.selectionReason) ? ["passed"]
          : row.selectionReason === "unavailable_by_producer_gate" ? ["passed", "failed"] : ["failed"];
    if (Boolean(player) !== (row.selectionReason === "projected_partial_skater")
      || Boolean(player) !== (row.goalContributionStatus === "modeled_partial")
      || player && (row.population !== "skater"
        || row.participationProbabilityGivenGamePlayed !== player.uncertainty.native_goal_accounting.participationProbabilityGivenGamePlayed
        || row.participationReason !== player.uncertainty.native_goal_accounting.participationReason)
      || !player && row.goalContributionStatus !== (row.participationProbabilityGivenGamePlayed === 0 ? "confirmed_out_given_game_played" : "unknown")
      || (row.participationProbabilityGivenGamePlayed === null) !== (row.participationReason !== null)
      || (row.population === "goalie") !== (row.selectionReason === "outside_skater_estimator")
      || !rateEligibility.includes(row.rateEligibility)
      || row.population === "goalie" && (row.rateEligibility !== "outside_skater_estimator" || row.participationProbabilityGivenGamePlayed !== null))
      throw new Error("Native roster coverage differs from partial player accounting");
  }
  const subsets = {
    unmodeledGoaliePlayerIds: coverage.contributors.filter(row => row.population === "goalie"),
    unevaluatedRosterPlayerIds: coverage.contributors.filter(row => row.selectionReason === "outside_candidate_pool"),
    eligibleUnprojectedSkaterPlayerIds: coverage.contributors.filter(row => row.selectionReason === "eligible_skater_not_projected"),
    unknownResidualPlayerIds: coverage.contributors.filter(row => row.goalContributionStatus === "unknown"),
  };
  for (const [name, rows] of Object.entries(subsets))
    if (projectionInputHash(coverage[name as keyof typeof subsets]) !== projectionInputHash(rows.map(row => row.playerId)))
      throw new Error("Native roster coverage summary differs from retained members");
  // v1 retains omitted-player scalar claims without their scoped assertion IDs or
  // conflict receipts. Preserve the original forecasts, but never expose those
  // claims as verified appearance/nonappearance or remove their unknown residual.
  const contributors = coverage.contributors.map(row => !players.some(player => player.player_id === row.playerId)
    && row.participationProbabilityGivenGamePlayed !== null ? { ...row,
      participationProbabilityGivenGamePlayed: null, participationReason: "omitted_participation_evidence_not_bound",
      goalContributionStatus: "unknown" as const } : row);
  return { ...coverage, contributors,
    unknownResidualPlayerIds: contributors.filter(row => row.goalContributionStatus === "unknown").map(row => row.playerId) };
}

/** Verify native metadata against the exact serialized contributors; legacy rows supply no such proof. */
function nativeAccounting(rows: ReturnType<typeof projectionForecastRows>, packet: FrozenPair, teamId: number) {
  const scoped = rows.filter(value => value.row.game_id === packet.scope.gameId && value.row.team_id === teamId);
  const players = scoped.filter(value => value.table === "forge_player_projections").map(value => value.row as Record<string, any>);
  const teams = scoped.filter(value => value.table === "forge_team_projections").map(value => value.row as Record<string, any>);
  if (![...players, ...teams].some(row => row.uncertainty?.native_goal_accounting != null)) {
    if (teams.some(row => row.uncertainty?.native_roster_contributor_coverage != null)) throw new Error("Native roster coverage lacks accounting scope");
    return null;
  }
  if (teams.length !== 1 || [...players, ...teams].some(row => row.run_id !== packet.forgeRunId
    || row.horizon_games !== 1 || row.as_of_date !== packet.scope.gameDate))
    throw new Error("Native accounting requires one team row and exact run/game/date/horizon scope");
  for (const row of players) {
    if (projectionInputHash(row.uncertainty?.native_goal_accounting)
      !== projectionInputHash(buildNativePlayerGoalAccounting(row as NativeSkaterGoalRow)))
      throw new Error("Native player accounting differs from serialized inputs");
  }
  const row = teams[0], metadata = row.uncertainty?.native_goal_accounting;
  if (!Array.isArray(metadata?.currentRosterPlayerIds) || !Array.isArray(metadata.projectedPlayerIds))
    throw new Error("Native roster accounting is missing");
  if (metadata.projectedPlayerIds.length !== players.length || new Set(metadata.projectedPlayerIds).size !== players.length
    || metadata.projectedPlayerIds.some((id: number) => !players.some(player => player.player_id === id)))
    throw new Error("Native contributor identities differ from serialized players");
  // Forecast hashing sorts rows; retain the producer's declared contributor order after proving a bijection.
  const orderedPlayers = metadata.projectedPlayerIds.map((id: number) => players.find(player => player.player_id === id)!);
  const expected = buildNativeTeamGoalAccounting({ gameId: packet.scope.gameId, teamId, asOfDate: packet.scope.gameDate,
    horizonGames: 1, currentRosterPlayerIds: metadata.currentRosterPlayerIds, playerRows: orderedPlayers as NativeSkaterGoalRow[] });
  if (projectionInputHash(metadata) !== projectionInputHash(expected) || row.proj_goals_es !== expected.reportedComponents.esMean
    || row.proj_goals_pp !== expected.reportedComponents.ppMean || row.proj_goals_pk !== null)
    throw new Error("Native team accounting differs from serialized contributors");
  nativeRosterCoverage(row, players, expected);
  return expected;
}

/** Core is deterministic. The CLI bounds runtime and blocks network in its worker process. */
export async function computeFrozenPair(packet: FrozenPair, executionFreeze: { team: ModelFreeze; forge: ModelFreeze }, scorers: PairScorers) {
  validateFrozenPair(packet, executionFreeze);
  const team = scoreTeamGoals(packet.scope, packet.history);
  const forge = await scorers.forge(packet.forgeSnapshot, packet.forgeSnapshotHash);
  if (!forge.matched || forge.runId !== packet.forgeRunId || forge.outputHash !== packet.forgeSnapshot.outputHash
    || projectionWritesHash(forge.writes) !== forge.outputHash)
    throw new Error("FORGE original frozen output did not reproduce");
  scorers.retainExecutionWrites?.(forge.writes);
  const stableRows = projectionForecastRows(forge.writes);
  const account = (teamId: number, coverage: ForgeGoalCoverage) => accountForgeTeamGoals(projectionRows(forge, packet.scope.gameId, teamId), coverage);
  return { version: "frozen-pair-output-v1", pairId: packet.pairId, scope: packet.scope,
    inputHash: projectionInputHash(packet), forgeRunId: packet.forgeRunId, teamRunId: packet.teamRunId,
    forgeOutputHash: forge.outputHash, forgeProjectionRows: stableRows, team,
    native: { home: nativeAccounting(stableRows, packet, packet.scope.homeTeamId),
      away: nativeAccounting(stableRows, packet, packet.scope.awayTeamId) },
    forge: { home: account(packet.scope.homeTeamId, packet.forgeCoverage.home), away: account(packet.scope.awayTeamId, packet.forgeCoverage.away) },
    acceptanceEligible: false, acceptanceReasons: ["exploratory_baseline_not_accepted",
      ...(packet.evidenceKind === "synthetic_fixture" ? ["synthetic_evidence"] : [])] };
}

export function verifyPairReplay(original: { inputHash: string; forecastHash: string; forecasts: unknown }, packet: FrozenPair, replay: unknown) {
  if (original.inputHash !== projectionInputHash(packet) || original.forecastHash !== projectionInputHash(original.forecasts)
    || original.forecastHash !== projectionInputHash(replay)) throw new Error("Paired replay differs from preserved original");
  return { matched: true, forecastHash: original.forecastHash };
}

export type FrozenPairOutput = Awaited<ReturnType<typeof computeFrozenPair>>;

/** Adapts the preserved forecast content to the same report the admin page exports. No missing evidence is repaired here. */
export function frozenPairDiagnosticReport(packet: FrozenPair, forecasts: FrozenPairOutput, issuedAt: string,
  mechanicsVerified = false): ForecastDiagnosticsReport {
  validateFrozenPair(packet, { team: packet.teamFreeze, forge: packet.forgeFreeze });
  if (projectionInputHash(forecasts.forgeProjectionRows) !== packet.forgeSnapshot.outputHash
    || projectionInputHash(forecasts.team) !== projectionInputHash(scoreTeamGoals(packet.scope, packet.history)))
    throw new Error("Diagnostic forecast content differs from frozen model outputs");
  if (forecasts.inputHash !== projectionInputHash(packet) || forecasts.pairId !== packet.pairId
    || projectionInputHash(forecasts.scope) !== projectionInputHash(packet.scope)) throw new Error("Diagnostic output does not match frozen inputs");
  if (!z.string().datetime({ offset: true }).safeParse(issuedAt).success || Date.parse(issuedAt) < Date.parse(packet.scope.cutoffAt)
    || Date.parse(issuedAt) >= Date.parse(packet.scope.startAt)) throw new Error("Diagnostic original issuance is outside the pregame window");
  const scope = { gameId: packet.scope.gameId, seasonId: packet.scope.seasonId, phase: packet.scope.phase,
    gameDate: packet.scope.gameDate, startAt: packet.scope.startAt, cutoffAt: packet.scope.cutoffAt, horizonGames: 1 as const };
  const evidence = (row: z.infer<typeof provenanceSchema>): SourceEvidence => ({ source: row.source,
    revisionId: row.revisionId, payloadHash: row.payloadHash, observedAt: null,
    availableAt: new Date(Math.max(Date.parse(row.firstReceivedAt), Date.parse(row.verifiedAt),
      row.publishedAt === null ? -Infinity : Date.parse(row.publishedAt))).toISOString(), retrievedAt: row.firstReceivedAt,
    availabilityBasis: row.availabilityBasis, immutable: true, hashVerified: true });
  const forgeLineage = packet.forgeReadProvenance.map(evidence);
  const teamLineage = [...new Map(packet.history.map(row => [row.provenance.revisionId, evidence(row.provenance)])).values()];
  const sides = ["home", "away"] as const;
  const comparisons = sides.map(side => {
    const teamId = side === "home" ? packet.scope.homeTeamId : packet.scope.awayTeamId;
    // Abbreviations are not captured in the current packet contract; display canonical IDs instead of guessing names.
    const abbreviation = String(teamId), coverage = packet.forgeCoverage[side];
    const native = nativeAccounting(forecasts.forgeProjectionRows, packet, teamId);
    if (!forecasts.native || projectionInputHash(native) !== projectionInputHash(forecasts.native[side]))
      throw new Error("Diagnostic native accounting differs from preserved output");
    const scopedRows = forecasts.forgeProjectionRows.filter(value => value.row.game_id === scope.gameId && value.row.team_id === teamId);
    const nativeRoster = native ? nativeRosterCoverage(scopedRows.find(value => value.table === "forge_team_projections")!.row,
      scopedRows.filter(value => value.table === "forge_player_projections").map(value => value.row), native) : null;
    const accounting = accountForgeTeamGoals(forecasts.forgeProjectionRows.filter(value => value.table === "forge_player_projections"
      && value.row.game_id === scope.gameId && value.row.team_id === teamId && value.row.horizon_games === 1).map(value => value.row), coverage);
    const rosterScenarioId = coverage.rosterPlayerIds.length ? `frozen-roster:${projectionInputHash(coverage.rosterPlayerIds)}` : null;
    const common = { contractVersion: FORECAST_DIAGNOSTICS_VERSION, forecastSetId: packet.pairId,
      gameId: scope.gameId, teamId, seasonId: scope.seasonId, phase: scope.phase, horizonGames: 1,
      cutoffAt: scope.cutoffAt, issuedAt, workloadByStrength: null, appearanceProbability: null, emptyNetMean: null };
    const forge: ForecastBase = { ...common, source: "forge", modelVersion: packet.forgeFreeze.modelVersion,
      calibrationVersion: packet.forgeFreeze.calibration.kind === "none" ? "none" : packet.forgeFreeze.calibration.version,
      featureNames: packet.forgeFreeze.featureNames, rosterScenarioId,
      strengthStates: coverage.strengthPartition === "exclusive_es_pp_pk" ? ["es", "pp", "pk"] : [],
      goalDefinition: coverage.overtime === "included" && coverage.emptyNet === "included"
        ? { periods: "regulation_and_overtime", shootout: "excluded", emptyNet: "included" } : null,
      // The native participation branch supplies no probability that the game occurs.
      // The diagnostic contract cannot express this conditional basis as unconditional.
      rawMean: accounting.mean, meanSemantics: "unknown", residualMean: coverage.residualMean,
      coverage: accounting.mean !== null ? "complete" : accounting.contributors.length ? "partial" : "unsupported",
      ...(native ? { nativeGoalAccounting: native } : {}),
      ...(nativeRoster ? { nativeRosterContributorCoverage: nativeRoster } : {}),
      contributors: accounting.contributors.map(row => ({ playerId: row.playerId, scenarioId: rosterScenarioId ?? "",
        mean: row.expectedMeanGivenGamePlayed ?? row.conditionalMean,
        semantics: "unknown",
        appearanceProbability: null })), lineage: forgeLineage };
    const team: ForecastBase = { ...common, source: "team", modelVersion: packet.teamFreeze.modelVersion,
      calibrationVersion: "none", featureNames: packet.teamFreeze.featureNames, rosterScenarioId: null,
      strengthStates: ["all"], goalDefinition: { periods: "regulation_and_overtime", shootout: "excluded", emptyNet: "included" },
      rawMean: side === "home" ? forecasts.team.homeMean : forecasts.team.awayMean, meanSemantics: "unknown",
      residualMean: null, coverage: forecasts.team.homeMean !== null && forecasts.team.awayMean !== null ? "complete" : "unsupported",
      contributors: [], lineage: teamLineage };
    const comparison = compareForecastBases({ scope, teamId, abbreviation, forge, team });
    return { ...comparison, status: "incompatible" as const, forgeMean: null, teamMean: null, difference: null,
      reasons: [...new Set([...comparison.reasons, ...accounting.reasons, ...(native?.reasons ?? []), "unknown_game_occurrence_probability",
        "exploratory_team_baseline_not_accepted", "player_contract_not_certified"])] };
  });
  const exposure = sides.map(side => {
    const teamId = side === "home" ? packet.scope.homeTeamId : packet.scope.awayTeamId;
    const games = packet.history.filter(row => row.teamId === teamId)
      .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt) || b.gameId - a.gameId);
    const totals = { gp: games.length, gf: games.reduce((sum, row) => sum + row.goalsFor, 0), ga: games.reduce((sum, row) => sum + row.goalsAgainst, 0) };
    return { teamId, abbreviation: String(teamId), seasonId: scope.seasonId, source: "retained_official_final_play_by_play_window",
      sourceRowCount: games.length, legacyTotals: totals, correctedTotals: totals,
      lastFiveGameIds: games.slice(0, 5).map(row => row.gameId), actualLastFiveCount: Math.min(5, games.length),
      acceptedGameIds: games.map(row => row.gameId), coverage: games.length ? "partial" as const : "unavailable" as const, exclusions: [] };
  });
  return { contractVersion: FORECAST_DIAGNOSTICS_VERSION, forecastSetId: packet.pairId, generatedAt: issuedAt,
    evidenceKind: packet.evidenceKind === "synthetic_fixture" ? "synthetic_fixture" : "retained_records", scope, comparisons,
    exposure, sources: [...forgeLineage, ...teamLineage], replay: { status: "not_verified",
      blockers: ["Qualifying real-game acceptance is open.", "Independent baseline is exploratory.", ...comparisons.flatMap(row => row.reasons)] },
    limitations: [mechanicsVerified ? "Exact frozen-input replay mechanics verified; acceptance remains open." : "Paired replay mechanics have not yet been verified.",
      "Exposure describes the retained verified window; whole-season population completeness is not certified.",
      "The exploratory baseline assumes the scheduled game is played; game-occurrence probability is not modeled.",
      "Legacy FORGE outputs are not certified as the foundation player-game contract.", "No model accuracy or forecast publication is established."] };
}
