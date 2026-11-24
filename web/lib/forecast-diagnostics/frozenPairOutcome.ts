import { createHash } from "node:crypto";
import { z } from "zod";
import { projectionInputHash } from "../projections/inputCapture";
import { frozenPairSchema, validateFrozenPair, verifyPairReplay, type FrozenPair, type FrozenPairOutput } from "./frozenPairRunner";
import { goalHistoryFromOfficialFinal, provenanceSchema, scoreTeamGoals } from "./pairedInputs";

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const instant = z.string().datetime({ offset: true });
const mean = z.number().finite().nonnegative().nullable();
const originalSchema = z.object({ issuedAt: instant, inputHash: hash, forecastHash: hash,
  forecasts: z.object({}).passthrough() }).strict();
const finalSourceSchema = z.object({ url: z.string().url(), revisionId: z.string().min(1), payload: z.unknown(),
  bodyUtf8: z.string(), rawBytesHash: hash, provenance: provenanceSchema }).passthrough();
const retainedReceiptSchema = z.object({ revisionId: z.string().min(1), url: z.string().url(), method: z.literal("GET"),
  beganAt: instant, receivedAt: instant, httpStatus: z.literal(200), bytes: z.number().int().nonnegative(),
  rawBytesSha256: hash, payloadHash: hash }).passthrough();
const partialNativeSchema = z.object({ version: z.literal("forge-native-goal-accounting-v1"), unit: z.literal("expected_goal_count"),
  scope: z.literal("one_game"), gameId: z.number().int().positive(), teamId: z.number().int().positive(), horizonGames: z.literal(1),
  rollingHistoryGameDateBefore: z.string(), reportedBasis: z.literal("sum_of_serialized_player_components"),
  reportedComponents: z.object({ esMean: z.number().finite().nonnegative(), ppMean: z.number().finite().nonnegative(), pkMean: z.null() }).passthrough(),
  reportedEsPpMean: z.number().finite().nonnegative(), fullOfficialPlayMean: z.null(), fullGameEligible: z.literal(false),
  projectedPlayerIds: z.array(z.number().int().positive()), currentRosterPlayerIds: z.array(z.number().int().positive()) }).passthrough();

/** Bind the retained v1 summary without regenerating old participation metadata under today's helpers. */
function retainedNativeAccounting(rows: FrozenPairOutput["forgeProjectionRows"], packet: FrozenPair, teamId: number) {
  const scoped = rows.filter(value => value.row.game_id === packet.scope.gameId && value.row.team_id === teamId);
  const players = scoped.filter(value => value.table === "forge_player_projections").map(value => value.row as Record<string, any>);
  const teams = scoped.filter(value => value.table === "forge_team_projections").map(value => value.row as Record<string, any>);
  if (![...players, ...teams].some(row => row.uncertainty?.native_goal_accounting != null)) return null;
  if (teams.length !== 1 || [...players, ...teams].some(row => row.run_id !== packet.forgeRunId
    || row.horizon_games !== 1 || row.as_of_date !== packet.scope.gameDate)) throw new Error("Frozen native row scope differs");
  const team = teams[0], native = partialNativeSchema.parse(team.uncertainty?.native_goal_accounting);
  const ids = players.map(row => row.player_id);
  const component = (state: "es" | "pp") => Number(players.reduce((total, row) => {
    const value = z.number().finite().nonnegative().parse(row["proj_goals_" + state]);
    if (value !== Number(value.toFixed(3))) throw new Error("Frozen native component is not serialized to three decimals");
    return total + value;
  }, 0).toFixed(3));
  const es = component("es"), pp = component("pp");
  if (native.gameId !== packet.scope.gameId || native.teamId !== teamId || native.rollingHistoryGameDateBefore !== packet.scope.gameDate
    || new Set(ids).size !== ids.length || new Set(native.projectedPlayerIds).size !== native.projectedPlayerIds.length
    || new Set(native.currentRosterPlayerIds).size !== native.currentRosterPlayerIds.length
    || projectionInputHash([...ids].sort()) !== projectionInputHash([...native.projectedPlayerIds].sort())
    || native.reportedComponents.esMean !== es || native.reportedComponents.ppMean !== pp
    || team.proj_goals_es !== es || team.proj_goals_pp !== pp || team.proj_goals_pk !== null
    || native.reportedEsPpMean !== Number((es + pp).toFixed(3))) throw new Error("Frozen native summary or serialized components differ");
  return native;
}

/** Normalize the acquisition owner's existing receipt/body without inventing publication or earlier verification times. */
export function officialOutcomeSourceFromRetainedFiles(receiptInput: unknown, bodyUtf8: string,
  verifiedAt = new Date().toISOString()) {
  const receipt = retainedReceiptSchema.parse(receiptInput), verifiedTime = Date.parse(instant.parse(verifiedAt));
  if (Date.parse(receipt.beganAt) > Date.parse(receipt.receivedAt) || Date.parse(receipt.receivedAt) > verifiedTime)
    throw new Error("Retained response receipt chronology differs");
  const rawBytesHash = createHash("sha256").update(bodyUtf8).digest("hex");
  if (Buffer.byteLength(bodyUtf8) > 8 * 1024 * 1024 || Buffer.byteLength(bodyUtf8) !== receipt.bytes
    || rawBytesHash !== receipt.rawBytesSha256) throw new Error("Retained response bytes differ from receipt");
  const payload = JSON.parse(bodyUtf8);
  if (projectionInputHash(payload) !== receipt.payloadHash) throw new Error("Retained response payload differs from receipt");
  return { url: receipt.url, revisionId: receipt.revisionId, payload, bodyUtf8, rawBytesHash, retainedReceipt: receipt,
    provenance: provenanceSchema.parse({ revisionId: receipt.revisionId, source: receipt.url, payloadHash: receipt.payloadHash,
      firstReceivedAt: receipt.receivedAt, verifiedAt, publishedAt: null, availabilityBasis: "retained_capture", correctionOf: null }) };
}

/** Postgame readback only. Neither an observed outcome nor this report changes an original forecast or its qualification. */
export function frozenPairOutcome(packetInput: unknown, originalInput: unknown, sourceInput: unknown,
  observedAt = new Date().toISOString()) {
  const packet = frozenPairSchema.parse(packetInput), original = originalSchema.parse(originalInput);
  const source = finalSourceSchema.parse(sourceInput), observationTime = Date.parse(instant.parse(observedAt));
  validateFrozenPair(packet, { team: packet.teamFreeze, forge: packet.forgeFreeze });
  verifyPairReplay(original, packet, original.forecasts);
  if (Date.parse(original.issuedAt) < Date.parse(packet.scope.cutoffAt)
    || Date.parse(original.issuedAt) >= Date.parse(packet.scope.startAt)) throw new Error("Original was not issued in its pregame window");
  const forecasts = original.forecasts as unknown as FrozenPairOutput;
  if (forecasts?.version !== "frozen-pair-output-v1" || forecasts.pairId !== packet.pairId
    || forecasts.inputHash !== original.inputHash || projectionInputHash(forecasts.scope) !== projectionInputHash(packet.scope)
    || forecasts.forgeRunId !== packet.forgeRunId || forecasts.teamRunId !== packet.teamRunId
    || forecasts.forgeOutputHash !== packet.forgeSnapshot.outputHash
    || projectionInputHash(forecasts.forgeProjectionRows) !== packet.forgeSnapshot.outputHash
    || projectionInputHash(forecasts.team) !== projectionInputHash(scoreTeamGoals(packet.scope, packet.history))
    || forecasts.acceptanceEligible !== false) throw new Error("Original exploratory forecast identity or content differs");
  const boundNative = { home: retainedNativeAccounting(forecasts.forgeProjectionRows, packet, packet.scope.homeTeamId),
    away: retainedNativeAccounting(forecasts.forgeProjectionRows, packet, packet.scope.awayTeamId) };
  if (!forecasts.native || projectionInputHash(forecasts.native) !== projectionInputHash(boundNative))
    throw new Error("Original native summary differs from frozen serialized accounting");
  const url = "https://api-web.nhle.com/v1/gamecenter/" + packet.scope.gameId + "/play-by-play";
  if (source.url !== url || source.provenance.source !== url || source.revisionId !== source.provenance.revisionId
    || Buffer.byteLength(source.bodyUtf8) > 8 * 1024 * 1024
    || createHash("sha256").update(source.bodyUtf8).digest("hex") !== source.rawBytesHash
    || projectionInputHash(JSON.parse(source.bodyUtf8)) !== projectionInputHash(source.payload)
    || projectionInputHash(source.payload) !== source.provenance.payloadHash) throw new Error("Final source bytes or identity differ");
  if (Date.parse(source.provenance.firstReceivedAt) < Date.parse(packet.scope.startAt)
    || Math.max(Date.parse(source.provenance.firstReceivedAt), Date.parse(source.provenance.verifiedAt),
      source.provenance.publishedAt === null ? -Infinity : Date.parse(source.provenance.publishedAt)) > observationTime)
    throw new Error("Final receipt is pregame or later than the outcome observation");
  const payload = source.payload as Record<string, any>;
  if (payload.id !== packet.scope.gameId || payload.season !== packet.scope.seasonId || payload.gameType !== packet.scope.phase
    || payload.gameDate !== packet.scope.gameDate || payload.homeTeam?.id !== packet.scope.homeTeamId
    || payload.awayTeam?.id !== packet.scope.awayTeamId || Date.parse(payload.startTimeUTC) !== Date.parse(packet.scope.startAt))
    throw new Error("Final source does not match the original game scope");
  const facts = goalHistoryFromOfficialFinal(payload, source.provenance);
  const period = payload.periodDescriptor?.periodType;
  const homeGoals = facts.find(row => row.teamId === packet.scope.homeTeamId)!.goalsFor;
  const awayGoals = facts.find(row => row.teamId === packet.scope.awayTeamId)!.goalsFor;
  const homeScore = payload.homeTeam.score, awayScore = payload.awayTeam.score;
  const goals = payload.plays.filter((play: any) => play.typeDescKey === "goal" && play.periodDescriptor.periodType !== "SO");
  const overtimeGoals = goals.filter((play: any) => play.periodDescriptor.periodType === "OT");
  const winnerTeamId = homeScore > awayScore ? packet.scope.homeTeamId : packet.scope.awayTeamId;
  if (!["REG", "OT", "SO"].includes(period) || !Number.isSafeInteger(homeScore) || !Number.isSafeInteger(awayScore)
    || homeScore === awayScore
    || period === "REG" && payload.plays.some((play: any) => play.periodDescriptor.periodType !== "REG")
    || period === "OT" && (Math.abs(homeGoals - awayGoals) !== 1 || overtimeGoals.length !== 1
      || overtimeGoals[0].details.eventOwnerTeamId !== winnerTeamId || goals[goals.length - 1] !== overtimeGoals[0]
      || payload.plays.some((play: any) => play.periodDescriptor.periodType === "SO"))
    || period === "SO" && (homeGoals !== awayGoals || Math.abs(homeScore - awayScore) !== 1 || overtimeGoals.length !== 0
      || homeScore - homeGoals !== (winnerTeamId === packet.scope.homeTeamId ? 1 : 0)
      || awayScore - awayGoals !== (winnerTeamId === packet.scope.awayTeamId ? 1 : 0)))
    throw new Error("Impossible official final period, winner or shootout adjustment");
  const teams = (["home", "away"] as const).map(side => {
    const teamId = side === "home" ? packet.scope.homeTeamId : packet.scope.awayTeamId;
    const fact = facts.find(row => row.teamId === teamId)!;
    const scoreboardGoals = side === "home" ? homeScore : awayScore;
    return { teamId, actualOfficialPlayGoals: fact.goalsFor, actualScoreboardGoals: scoreboardGoals,
      shootoutAdjustment: scoreboardGoals - fact.goalsFor,
      rawExploratoryTeamMean: mean.parse(side === "home" ? forecasts.team.homeMean : forecasts.team.awayMean),
      rawNativeReportedEsPpMean: mean.parse(boundNative[side]?.reportedEsPpMean ?? null),
      qualifiedFullGameMean: null, qualifiedDifference: null,
      reasons: ["independent_baseline_acceptance_open", "native_full_game_basis_not_certified", "partial_es_pp_is_not_a_full_game_estimate"] };
  });
  return { version: "frozen-pair-outcome-v1" as const, pairId: packet.pairId,
    evidenceKind: packet.evidenceKind === "prospective_capture" ? "retained_records" as const : "synthetic_fixture" as const,
    scope: packet.scope, observedAt, finalPeriodType: period, winnerTeamId,
    originalIssuedAt: original.issuedAt, originalInputHash: original.inputHash,
    originalForecastHash: original.forecastHash, originalCodePins: { forge: packet.forgeFreeze.codeCommit, team: packet.teamFreeze.codeCommit },
    actualGoalDefinition: { periods: "regulation_and_overtime", emptyNet: "included", shootout: "excluded" },
    completionBasis: "observed_final_upper_bound" as const, observedFinalUpperBoundAt: source.provenance.firstReceivedAt,
    finalSource: { revisionId: source.revisionId, url: source.url, rawBytesHash: source.rawBytesHash, provenance: source.provenance },
    teams, acceptanceEligible: false as const, accuracyAssessment: "not_established_single_exploratory_game" as const,
    limitations: ["Final outcome receipts are postgame observations, not knowledge available to the original pregame forecast.",
      "Raw exploratory and partial means are preserved separately; qualified full-game differences remain unavailable.",
      "One observed game does not establish model accuracy or change model acceptance."] };
}

export function frozenPairOutcomeMarkdown(report: ReturnType<typeof frozenPairOutcome>) {
  const rows = ["# Exploratory forecast outcome readback", "", "Game: " + report.scope.gameId,
    "Pair: " + report.pairId, "Original issued: " + report.originalIssuedAt, "Outcome observed: " + report.observedAt,
    "Final observed upper bound: " + report.observedFinalUpperBoundAt, "Evidence: " + report.evidenceKind,
    "Acceptance eligible: false", "", "Official-play goals include OT and empty net; shootout awards are excluded.", "",
    "| Team | Actual official-play goals | Scoreboard goals | Shootout adjustment | Original raw exploratory team mean | Original partial ES/PP mean | Qualified difference |",
    "| --- | --- | --- | --- | --- | --- | --- |"];
  for (const team of report.teams) rows.push("| " + [team.teamId, team.actualOfficialPlayGoals, team.actualScoreboardGoals, team.shootoutAdjustment,
    team.rawExploratoryTeamMean ?? "Unavailable", team.rawNativeReportedEsPpMean ?? "Unavailable", "Unavailable"].join(" | ") + " |");
  rows.push("", ...report.limitations.map(item => "- " + item), "", "Final source: " + report.finalSource.url,
    "Source revision: " + report.finalSource.revisionId, "Raw response SHA-256: " + report.finalSource.rawBytesHash,
    "Original forecast hash: " + report.originalForecastHash, "");
  return rows.join("\n");
}
