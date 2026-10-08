// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { boundedWorker } from "../../scripts/run-frozen-forecast-pair";
import { projectionInputHash, replayProjectionInputs, interceptProjectionQuery } from "../projections/inputCapture";
import { projectionForecastRows, projectionWritesHash } from "../projections/gameRevisions";
import { buildNativePlayerGoalAccounting, buildNativeTeamGoalAccounting, buildNativeRosterContributorCoverage } from "../projections/nativeGoalAccounting";
import { accountForgeTeamGoals, goalHistoryFromOfficialFinal, scoreTeamGoals, TEAM_GOALS_FEATURES, TEAM_GOALS_PARAMETERS,
  TEAM_GOALS_VERSION, validateTeamFreeze, type ModelFreeze } from "./pairedInputs";
import { assembleFrozenPairFromCapture, computeFrozenPair, frozenPairDiagnosticReport, validateFrozenPair, verifyPairReplay, type FrozenPair } from "./frozenPairRunner";
import { forecastDiagnosticsJson, forecastDiagnosticsMarkdown } from "./contract";
import { loadLocalFrozenPairDiagnostics } from "./loader";
import { frozenPairOutcome, frozenPairOutcomeMarkdown, officialOutcomeSourceFromRetainedFiles } from "./frozenPairOutcome";
import { readFrozenForecastOutcome } from "../../scripts/read-frozen-forecast-outcome";

const cutoff = "2026-10-07T22:30:00.000Z";
const receiptAt = "2026-10-06T02:00:00.000Z";
const scope = { gameId: 2026020053, seasonId: 20262027, phase: 2 as const, homeTeamId: 15, awayTeamId: 5,
  gameDate: "2026-10-07", startAt: "2026-10-07T23:30:00.000Z", cutoffAt: cutoff, horizonGames: 1 as const };
function fixture() {
  const payload = { id: 2026020001, season: 20262027, gameType: 2, gameState: "OFF",
    startTimeUTC: "2026-10-05T23:00:00.000Z", periodDescriptor: { periodType: "OT" },
    homeTeam: { id: 15, score: 3 }, awayTeam: { id: 5, score: 1 },
    plays: [15, 15, 5, 15].map((team, index) => ({ eventId: index + 1, typeDescKey: "goal",
      periodDescriptor: { periodType: index === 3 ? "OT" : "REG" }, details: { eventOwnerTeamId: team } })) };
  const provenance = { revisionId: "official:1", payloadHash: projectionInputHash(payload), source: "official NHL play-by-play",
    firstReceivedAt: receiptAt, verifiedAt: receiptAt, publishedAt: null,
    availabilityBasis: "retained_capture" as const, correctionOf: null };
  const history = goalHistoryFromOfficialFinal(payload, provenance);
  const common = { codeCommit: "a".repeat(40), sourceTreeHash: "b".repeat(64), lockfileHash: "c".repeat(64), nodeVersion: process.version };
  const teamFreeze: ModelFreeze = { ...common, modelVersion: TEAM_GOALS_VERSION, featureSchemaVersion: TEAM_GOALS_VERSION,
    featureNames: [...TEAM_GOALS_FEATURES], parameters: TEAM_GOALS_PARAMETERS, parametersHash: projectionInputHash(TEAM_GOALS_PARAMETERS), calibration: { kind: "none" } };
  const forgeFreeze: ModelFreeze = { ...teamFreeze, modelVersion: "fixture-forge", featureSchemaVersion: "fixture-queries" };
  const read = { request: [{ method: "from", args: ["rates"] }, { method: "select", args: ["*"] }], result: { data: [], error: null }, receivedAt: receiptAt };
  const packet: FrozenPair = { version: "frozen-pair-v1", evidenceKind: "synthetic_fixture",
    pairId: "11111111-1111-4111-8111-111111111111", forgeRunId: "22222222-2222-4222-8222-222222222222",
    teamRunId: "33333333-3333-4333-8333-333333333333", frozenAt: "2026-10-07T22:20:00.000Z", scope,
    teamFreeze, forgeFreeze, history, retainedHistorySources: [{ revisionId: provenance.revisionId, payload,
      bodyUtf8: JSON.stringify(payload), rawBytesHash: createHash("sha256").update(JSON.stringify(payload)).digest("hex") }],
    forgeSnapshot: { version: "forge-inputs-v1", runId: "22222222-2222-4222-8222-222222222222", slateDate: "2026-10-07",
      decisionAsOf: cutoff, inputCutoff: cutoff, capturedAt: receiptAt, codeVersion: common.codeCommit, modelMode: "baseline",
      horizonGames: 1, gameIds: [scope.gameId], replayClassification: "historical_reconstruction", reads: [read],
      outputHash: projectionInputHash([]), goalieStarts: [] }, forgeSnapshotHash: "",
    forgeReadProvenance: [{ ...provenance, revisionId: "forge-read:1", payloadHash: projectionInputHash(read) }],
    forgeCoverage: { home: { rosterPlayerIds: [100], residualMean: null, strengthPartition: "unknown", overtime: "unknown", emptyNet: "unknown", proofRevisionIds: [] },
      away: { rosterPlayerIds: [200], residualMean: null, strengthPartition: "unknown", overtime: "unknown", emptyNet: "unknown", proofRevisionIds: [] } } };
  packet.forgeSnapshotHash = projectionInputHash(packet.forgeSnapshot);
  return packet;
}
const freeze = (packet: FrozenPair) => ({ team: packet.teamFreeze, forge: packet.forgeFreeze });

async function outcomeFixture() {
  const packet = fixture();
  const forecasts = await computeFrozenPair(packet, freeze(packet), { forge: async () => ({ runId: packet.forgeRunId,
    outputHash: packet.forgeSnapshot.outputHash, matched: true, writes: [] }) });
  const original = { issuedAt: cutoff, inputHash: projectionInputHash(packet), forecastHash: projectionInputHash(forecasts), forecasts };
  const payload = { ...structuredClone(packet.retainedHistorySources[0].payload) as any,
    id: scope.gameId, gameDate: scope.gameDate, startTimeUTC: scope.startAt };
  payload.awayTeam.score = 2;
  payload.plays = [15, 15, 5, 5, 15].map((team, index) => ({ eventId: index + 1, typeDescKey: "goal",
    periodDescriptor: { periodType: index === 4 ? "OT" : "REG" }, details: { eventOwnerTeamId: team } }));
  payload.plays[0].situationCode = "1550"; // Empty defending net; this goal is still part of the full official-play count.
  const source = { revisionId: "final-outcome-fixture", url: "https://api-web.nhle.com/v1/gamecenter/" + scope.gameId + "/play-by-play",
    payload, bodyUtf8: JSON.stringify(payload), rawBytesHash: "", provenance: { revisionId: "final-outcome-fixture",
      payloadHash: projectionInputHash(payload), source: "", firstReceivedAt: "2026-10-08T02:00:00Z", verifiedAt: "2026-10-08T02:00:01Z",
      publishedAt: null as string | null, availabilityBasis: "retained_capture" as const, correctionOf: null } };
  source.provenance.source = source.url;
  const rehash = () => { source.bodyUtf8 = JSON.stringify(source.payload);
    source.rawBytesHash = createHash("sha256").update(source.bodyUtf8).digest("hex"); source.provenance.payloadHash = projectionInputHash(source.payload); };
  rehash();
  return { packet, original, source, rehash, observedAt: "2026-10-08T02:05:00Z" };
}
function outcomeSourceReceipt(f: Awaited<ReturnType<typeof outcomeFixture>>) {
  return { revisionId: f.source.revisionId, url: f.source.url, method: "GET", beganAt: "2026-10-08T01:59:59Z",
    receivedAt: f.source.provenance.firstReceivedAt, httpStatus: 200, bytes: Buffer.byteLength(f.source.bodyUtf8),
    rawBytesSha256: f.source.rawBytesHash, payloadHash: f.source.provenance.payloadHash };
}

describe("retained final-outcome readback", () => {
  it("normalizes retained receipt/body with distinct original receipt and actual offline verification times", async () => {
    const f = await outcomeFixture(), receipt = outcomeSourceReceipt(f), before = JSON.stringify(receipt);
    const source = officialOutcomeSourceFromRetainedFiles(receipt, f.source.bodyUtf8, f.observedAt);
    expect(source.provenance).toMatchObject({ firstReceivedAt: receipt.receivedAt, verifiedAt: f.observedAt,
      publishedAt: null, availabilityBasis: "retained_capture" });
    expect(source.retainedReceipt).toEqual(receipt);
    expect(source.bodyUtf8).toBe(f.source.bodyUtf8);
    expect(JSON.stringify(receipt)).toBe(before);
    expect(frozenPairOutcome(f.packet, f.original, source, f.observedAt).teams.map(team => team.actualOfficialPlayGoals)).toEqual([3, 2]);
  });
  it.each(["raw_hash", "byte_count", "payload_hash", "missing_receipt", "future_receipt", "request_chronology", "failed_http", "mutation_method"])(
    "rejects invalid retained sidecar %s", async change => {
      const f = await outcomeFixture(), receipt: any = outcomeSourceReceipt(f);
      if (change === "raw_hash") receipt.rawBytesSha256 = "0".repeat(64);
      if (change === "byte_count") receipt.bytes++;
      if (change === "payload_hash") receipt.payloadHash = "0".repeat(64);
      if (change === "missing_receipt") delete receipt.receivedAt;
      if (change === "future_receipt") receipt.receivedAt = "2026-10-08T03:00:00Z";
      if (change === "request_chronology") receipt.beganAt = "2026-10-08T02:01:00Z";
      if (change === "failed_http") receipt.httpStatus = 503;
      if (change === "mutation_method") receipt.method = "POST";
      expect(() => officialOutcomeSourceFromRetainedFiles(receipt, f.source.bodyUtf8, f.observedAt)).toThrow();
    });
  it("reads separate retained receipt/body offline, includes both in the manifest and rejects LIVE without output", async () => {
    const f = await outcomeFixture(), directory = mkdtempSync(join(tmpdir(), "frozen-outcome-sidecar-")), issued = join(directory, "issued");
    mkdirSync(issued);
    const receiptFile = join(directory, "final.json"), bodyFile = join(directory, "final.body"), output = join(directory, "outcome");
    const original = JSON.stringify(f.original), inputs = JSON.stringify(f.packet), receipt = JSON.stringify(outcomeSourceReceipt(f));
    writeFileSync(join(issued, "inputs.json"), inputs); writeFileSync(join(issued, "original.json"), original);
    writeFileSync(receiptFile, receipt); writeFileSync(bodyFile, f.source.bodyUtf8);
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(f.observedAt));
    try {
      const report = readFrozenForecastOutcome([issued, receiptFile, bodyFile, output]);
      expect(report.finalSource.provenance).toMatchObject({ firstReceivedAt: f.source.provenance.firstReceivedAt,
        verifiedAt: new Date(f.observedAt).toISOString(), publishedAt: null });
      expect(readFileSync(join(output, "outcome.json"), "utf8")).toBe(JSON.stringify(report, null, 2) + "\n");
      expect(readFileSync(join(output, "outcome.md"), "utf8")).toBe(frozenPairOutcomeMarkdown(report));
      const manifest = JSON.parse(readFileSync(join(output, "manifest.json"), "utf8"));
      expect(manifest.sourceFiles.map((item: any) => item.path)).toEqual([join(realpathSync(issued), "inputs.json"), join(realpathSync(issued), "original.json"), receiptFile, bodyFile]);
      expect(readFileSync(receiptFile, "utf8")).toBe(receipt); expect(readFileSync(bodyFile, "utf8")).toBe(f.source.bodyUtf8);
      expect(readFileSync(join(issued, "inputs.json"), "utf8")).toBe(inputs); expect(readFileSync(join(issued, "original.json"), "utf8")).toBe(original);
      f.source.payload.gameState = "LIVE"; f.rehash();
      writeFileSync(receiptFile, JSON.stringify(outcomeSourceReceipt(f))); writeFileSync(bodyFile, f.source.bodyUtf8);
      const nonfinal = join(directory, "nonfinal");
      expect(() => readFrozenForecastOutcome([issued, receiptFile, bodyFile, nonfinal])).toThrow("Unverified official completed regular-season game");
      expect(existsSync(nonfinal)).toBe(false);
    } finally { vi.useRealTimers(); rmSync(directory, { recursive: true, force: true }); }
  });
  it("preserves the original and reports OT/empty-net goals separately from unsupported forecast comparisons", async () => {
    const f = await outcomeFixture(), before = JSON.stringify(f);
    const report = frozenPairOutcome(f.packet, f.original, f.source, f.observedAt);
    expect(report).toMatchObject({ evidenceKind: "synthetic_fixture", originalIssuedAt: cutoff,
      acceptanceEligible: false, accuracyAssessment: "not_established_single_exploratory_game",
      completionBasis: "observed_final_upper_bound", observedFinalUpperBoundAt: f.source.provenance.firstReceivedAt });
    expect(report.teams.map(team => [team.actualOfficialPlayGoals, team.rawExploratoryTeamMean])).toEqual([[3, 3], [2, 1]]);
    expect(report.teams.map(team => [team.actualScoreboardGoals, team.shootoutAdjustment])).toEqual([[3, 0], [2, 0]]);
    expect(report.teams.every(team => team.qualifiedDifference === null && team.qualifiedFullGameMean === null)).toBe(true);
    expect(frozenPairOutcomeMarkdown(report)).toContain("shootout awards are excluded");
    expect(frozenPairOutcomeMarkdown(report)).toContain("One observed game does not establish model accuracy");
    expect(JSON.stringify(f)).toBe(before);
  });
  it("separates a shootout award from the official-play goals", async () => {
    const f = await outcomeFixture();
    f.source.payload.periodDescriptor.periodType = "SO";
    f.source.payload.homeTeam.score = 4; f.source.payload.awayTeam.score = 3;
    f.source.payload.plays = [15, 5, 15, 5, 15, 5, 15].map((team, index) => ({ eventId: index + 1,
      typeDescKey: "goal", periodDescriptor: { periodType: index === 6 ? "SO" : "REG" }, details: { eventOwnerTeamId: team } }));
    f.rehash();
    const report = frozenPairOutcome(f.packet, f.original, f.source, f.observedAt);
    expect(report.teams.map(team => team.actualOfficialPlayGoals)).toEqual([3, 3]);
    expect(report.teams.map(team => [team.actualScoreboardGoals, team.shootoutAdjustment])).toEqual([[4, 1], [3, 0]]);
    expect(report.finalPeriodType).toBe("SO"); expect(report.winnerTeamId).toBe(15);
    expect(frozenPairOutcomeMarkdown(report)).toContain("Shootout adjustment");
  });
  it.each(["reg_off", "reg_final", "away_so"])("accepts valid final %s and retains the separate scoreboard", async change => {
    const f = await outcomeFixture(), payload = f.source.payload;
    payload.plays.forEach((play: any) => { play.periodDescriptor.periodType = "REG"; });
    payload.periodDescriptor.periodType = "REG";
    if (change === "reg_final") payload.gameState = "FINAL";
    if (change === "away_so") {
      payload.periodDescriptor.periodType = "SO"; payload.homeTeam.score = 3; payload.awayTeam.score = 4;
      payload.plays.push({ eventId: 6, typeDescKey: "goal", periodDescriptor: { periodType: "REG" }, details: { eventOwnerTeamId: 5 } });
      payload.plays.push({ eventId: 7, typeDescKey: "goal", periodDescriptor: { periodType: "SO" }, details: { eventOwnerTeamId: 5 } });
    }
    f.rehash(); const report = frozenPairOutcome(f.packet, f.original, f.source, f.observedAt);
    expect(report.winnerTeamId).toBe(change === "away_so" ? 5 : 15);
    expect(report.teams.map(team => team.shootoutAdjustment)).toEqual(change === "away_so" ? [0, 1] : [0, 0]);
  });
  it.each(["so_without_award", "so_unequal_play_goals", "reg_tie", "reg_with_ot", "ot_two_goal_margin", "ot_missing_winner_goal", "ot_losing_goal", "unknown_period"])(
    "rejects impossible final %s even when counted goals match scoreboard arithmetic", async change => {
      const f = await outcomeFixture(), payload = f.source.payload;
      if (change === "so_without_award" || change === "reg_tie") {
        payload.plays = [15, 5, 15, 5, 15, 5].map((team, index) => ({ eventId: index + 1, typeDescKey: "goal",
          periodDescriptor: { periodType: "REG" }, details: { eventOwnerTeamId: team } }));
        payload.homeTeam.score = payload.awayTeam.score = 3;
        payload.periodDescriptor.periodType = change === "reg_tie" ? "REG" : "SO";
      }
      if (change === "so_unequal_play_goals") {
        payload.periodDescriptor.periodType = "SO"; payload.homeTeam.score++;
        payload.plays.forEach((play: any) => { play.periodDescriptor.periodType = "REG"; });
      }
      if (change === "reg_with_ot") payload.periodDescriptor.periodType = "REG";
      if (change === "ot_two_goal_margin") { payload.awayTeam.score--; payload.plays.splice(3, 1); }
      if (change === "ot_missing_winner_goal") payload.plays.forEach((play: any) => { play.periodDescriptor.periodType = "REG"; });
      if (change === "ot_losing_goal") {
        payload.plays.forEach((play: any) => { play.periodDescriptor.periodType = "REG"; });
        payload.plays[3].periodDescriptor.periodType = "OT";
      }
      if (change === "unknown_period") payload.periodDescriptor.periodType = "UNKNOWN";
      f.rehash();
      expect(() => frozenPairOutcome(f.packet, f.original, f.source, f.observedAt)).toThrow("Impossible official final");
    });
  it.each(["missing", "orphan", "tampered"])("binds %s native summaries to original serialized rows", async change => {
    const f = await outcomeFixture();
    if (change === "tampered") {
      const native = nativeWrites(f.packet);
      f.packet.forgeSnapshot.outputHash = projectionWritesHash(native.writes);
      f.packet.forgeSnapshotHash = projectionInputHash(f.packet.forgeSnapshot);
      f.original.forecasts = await computeFrozenPair(f.packet, freeze(f.packet), { forge: async () => ({ runId: f.packet.forgeRunId,
        outputHash: f.packet.forgeSnapshot.outputHash, matched: true, writes: native.writes }) });
      f.original.inputHash = projectionInputHash(f.packet);
      expect(frozenPairOutcome(f.packet, { ...f.original, forecastHash: projectionInputHash(f.original.forecasts) }, f.source, f.observedAt)
        .teams[0].rawNativeReportedEsPpMean).toBeCloseTo(0.6);
    }
    if (change === "missing") delete (f.original.forecasts as any).native;
    else (f.original.forecasts.native as any).home = { ...(f.original.forecasts.native.home ?? {}), reportedEsPpMean: 999 };
    f.original.forecastHash = projectionInputHash(f.original.forecasts);
    expect(() => frozenPairOutcome(f.packet, f.original, f.source, f.observedAt)).toThrow("native summary differs");
  });
  it.each(["so_without_award", "orphan_native"])("rejects %s before writing direct-file outcomes", async change => {
    const f = await outcomeFixture(), directory = mkdtempSync(join(tmpdir(), "frozen-outcome-invalid-")), issued = join(directory, "issued");
    if (change === "so_without_award") {
      f.source.payload.periodDescriptor.periodType = "SO";
      f.source.payload.awayTeam.score = 3;
      f.source.payload.plays[4].periodDescriptor.periodType = "REG";
      f.source.payload.plays.push({ eventId: 6, typeDescKey: "goal", periodDescriptor: { periodType: "REG" }, details: { eventOwnerTeamId: 5 } });
      f.rehash();
    } else {
      (f.original.forecasts.native as any).home = { reportedEsPpMean: 999 };
      f.original.forecastHash = projectionInputHash(f.original.forecasts);
    }
    mkdirSync(issued);
    const receiptFile = join(directory, "receipt.json"), bodyFile = join(directory, "response.body"), output = join(directory, "outcome");
    const original = JSON.stringify(f.original), inputs = JSON.stringify(f.packet);
    writeFileSync(join(issued, "inputs.json"), inputs); writeFileSync(join(issued, "original.json"), original);
    writeFileSync(receiptFile, JSON.stringify(outcomeSourceReceipt(f))); writeFileSync(bodyFile, f.source.bodyUtf8);
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(f.observedAt));
    try {
      expect(() => readFrozenForecastOutcome([issued, receiptFile, bodyFile, output])).toThrow(change === "so_without_award" ? "Impossible official final" : "native summary differs");
      expect(existsSync(output)).toBe(false);
      expect(readFileSync(join(issued, "original.json"), "utf8")).toBe(original); expect(readFileSync(join(issued, "inputs.json"), "utf8")).toBe(inputs);
    } finally { vi.useRealTimers(); rmSync(directory, { recursive: true, force: true }); }
  });
  it.each(["live", "wrong_game", "wrong_team", "wrong_start", "wrong_date", "wrong_url", "raw_bytes", "score_mismatch",
    "duplicate_event", "pregame_receipt", "future_receipt", "future_publication", "original_hash", "late_original"])("rejects %s without synthesizing a final", async change => {
    const f = await outcomeFixture();
    if (change === "live") f.source.payload.gameState = "LIVE";
    if (change === "wrong_game") f.source.payload.id++;
    if (change === "wrong_team") f.source.payload.homeTeam.id++;
    if (change === "wrong_start") f.source.payload.startTimeUTC = "2026-10-08T00:00:00Z";
    if (change === "wrong_date") f.source.payload.gameDate = "2026-10-08";
    if (change === "wrong_url") f.source.url = f.source.provenance.source = "https://example.invalid/final";
    if (change === "score_mismatch") f.source.payload.homeTeam.score++;
    if (change === "duplicate_event") f.source.payload.plays[1].eventId = f.source.payload.plays[0].eventId;
    if (change === "pregame_receipt") f.source.provenance.firstReceivedAt = f.source.provenance.verifiedAt = cutoff;
    if (change === "future_receipt") f.source.provenance.firstReceivedAt = f.source.provenance.verifiedAt = "2026-10-08T03:00:00Z";
    if (change === "future_publication") f.source.provenance.publishedAt = "2026-10-08T03:00:00Z";
    if (change === "original_hash") f.original.forecastHash = "0".repeat(64);
    if (change === "late_original") f.original.issuedAt = scope.startAt;
    f.rehash();
    if (change === "raw_bytes") f.source.bodyUtf8 += " ";
    expect(() => frozenPairOutcome(f.packet, f.original, f.source, f.observedAt)).toThrow();
  });
  it("writes exclusive offline JSON/Markdown readback and rejects original-directory aliases and failed issuance", async () => {
    const f = await outcomeFixture(), directory = mkdtempSync(join(tmpdir(), "frozen-outcome-")), issued = join(directory, "issued");
    mkdirSync(issued);
    const inputs = JSON.stringify(f.packet), original = JSON.stringify(f.original), source = join(directory, "final.json"), output = join(directory, "outcome");
    writeFileSync(join(issued, "inputs.json"), inputs); writeFileSync(join(issued, "original.json"), original);
    writeFileSync(source, JSON.stringify(f.source));
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(f.observedAt));
    try {
      const report = readFrozenForecastOutcome([issued, source, output]);
      expect(readFileSync(join(output, "outcome.json"), "utf8")).toBe(JSON.stringify(report, null, 2) + "\n");
      expect(readFileSync(join(output, "outcome.md"), "utf8")).toBe(frozenPairOutcomeMarkdown(report));
      expect(JSON.parse(readFileSync(join(output, "manifest.json"), "utf8"))).toMatchObject({ originalsUnchanged: true, networkDenied: true, acceptanceEligible: false });
      expect(readFileSync(join(issued, "inputs.json"), "utf8")).toBe(inputs);
      expect(readFileSync(join(issued, "original.json"), "utf8")).toBe(original);
      expect(() => readFrozenForecastOutcome([issued, source, output])).toThrow();
      expect(() => readFrozenForecastOutcome([issued, source, join(issued, "..outcome")])).toThrow("inside");
      symlinkSync(issued, join(directory, "issued-alias"));
      expect(() => readFrozenForecastOutcome([issued, source, join(directory, "issued-alias", "nested")])).toThrow("inside");
      writeFileSync(join(issued, "failed.json"), "{}");
      expect(() => readFrozenForecastOutcome([issued, source, join(directory, "failed-outcome")])).toThrow("Failed issuance");
      expect(existsSync(join(directory, "failed-outcome"))).toBe(false);
    } finally { vi.useRealTimers(); rmSync(directory, { recursive: true, force: true }); }
  });
});
const row = (id = 100) => ({ player_id: id, proj_goals_es: 0.4, proj_goals_pp: 0.2, proj_goals_pk: 0.1,
  uncertainty: { model: { skater_selection: { production_conditioning: "conditional_playing", participation: {
    version: "skater-participation-v1", probability: 1, status: "confirmed_evidence", evidenceIds: ["lineup:1"] } } } } });

function nativeWrites(packet: FrozenPair, playerIds = [100], currentRosterPlayerIds = playerIds) {
  const players = playerIds.map(id => {
    const player: any = { ...row(id), run_id: packet.forgeRunId, game_id: scope.gameId, team_id: scope.homeTeamId,
    as_of_date: scope.gameDate, horizon_games: 1, proj_goals_pk: null };
    player.uncertainty.native_goal_accounting = buildNativePlayerGoalAccounting(player);
    return player;
  });
  const accounted = buildNativeTeamGoalAccounting({ gameId: scope.gameId, teamId: scope.homeTeamId,
    asOfDate: scope.gameDate, horizonGames: 1, currentRosterPlayerIds, playerRows: players });
  const team: any = { run_id: packet.forgeRunId, game_id: scope.gameId, team_id: scope.homeTeamId,
    as_of_date: scope.gameDate, horizon_games: 1, proj_goals_es: accounted.reportedComponents.esMean,
    proj_goals_pp: accounted.reportedComponents.ppMean, proj_goals_pk: null, uncertainty: { native_goal_accounting: accounted } };
  return { player: players[0], team, writes: [[{ method: "from", args: ["forge_player_projections"] }, { method: "upsert", args: [players] }],
    [{ method: "from", args: ["forge_team_projections"] }, { method: "upsert", args: [[team]] }]] };
}

function nativeRosterWrites(packet: FrozenPair) {
  const ids = [100, 101, 102, 103, 104, 105], native = nativeWrites(packet, [100], ids);
  const assertion = { gameId: scope.gameId, teamId: scope.homeTeamId, playerId: 100, dimension: "ev" as const, value: "L1",
    evidenceId: "synthetic-lineup", sourceKey: "fixture", sourceUrl: null, publishedAt: receiptAt, receivedAt: receiptAt, confirmed: true };
  native.team.uncertainty.native_roster_contributor_coverage = buildNativeRosterContributorCoverage({
    gameId: scope.gameId, teamId: scope.homeTeamId, currentRosterPlayerIds: ids, projectedPlayerIds: [100], selection: {
      candidatePlayerIds: [100, 103, 104, 105], eligiblePlayerIds: [100, 105], unavailablePlayerIds: [104], knownGoaliePlayerIds: [101],
      playerMetaById: new Map([100, 103, 104, 105].map(id => [id, { team_id: scope.homeTeamId, position: "C" }])),
      excludedPlayerIds: { teamOrPosition: [], missingRecentMetrics: [], hardStale: [103], invalidSeasonEvidence: [] }, compute: true,
      evidence: { assertions: [assertion, { ...assertion, playerId: 104, dimension: "availability", value: "out" }], conflicts: [] },
    },
  });
  return native;
}

function retainedCaptureFixture() {
  const packet = fixture(), writes = nativeWrites(packet).writes;
  const snapshot = { ...packet.forgeSnapshot, outputHash: projectionWritesHash(writes) };
  return { packet, capture: { evidenceKind: "synthetic_fixture" as const, snapshot,
    snapshotHash: projectionInputHash(snapshot), writes },
    history: { scope: packet.scope, history: packet.history, retainedHistorySources: packet.retainedHistorySources,
      capturedAt: receiptAt, acceptanceEligible: false as const } };
}

describe("retained capture assembly", () => {
  it("preserves source hashes/run identity and uses actual verification time with explicit unknown coverage", () => {
    const { packet, capture, history } = retainedCaptureFixture();
    const before = JSON.stringify({ capture, history });
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(packet.frozenAt));
    try {
      const assembled = assembleFrozenPairFromCapture(capture, history, freeze(packet));
      expect(assembled.forgeSnapshotHash).toBe(capture.snapshotHash);
      expect(assembled.forgeSnapshot).toEqual(capture.snapshot);
      expect(assembled.forgeRunId).toBe(capture.snapshot.runId);
      expect(new Set([assembled.pairId, assembled.teamRunId, assembled.forgeRunId]).size).toBe(3);
      expect(assembled.forgeReadProvenance[0]).toMatchObject({ firstReceivedAt: receiptAt,
        verifiedAt: packet.frozenAt, publishedAt: null, availabilityBasis: "retained_capture" });
      expect(assembled.forgeCoverage.home).toEqual({ rosterPlayerIds: [], residualMean: null,
        strengthPartition: "unknown", overtime: "unknown", emptyNet: "unknown", proofRevisionIds: [] });
      expect(assembled.evidenceKind).toBe("synthetic_fixture");
      expect(JSON.stringify({ capture, history })).toBe(before);
    } finally { vi.useRealTimers(); }
  });
  it.each(["late_assembly", "early_capture", "output_hash", "wrong_scope", "missing_label", "historical_label"])("rejects %s instead of relabeling retained evidence", change => {
    const { packet, capture, history } = retainedCaptureFixture();
    if (change === "early_capture") capture.snapshot.capturedAt = "2026-10-06T01:00:00.000Z";
    if (change === "output_hash") capture.writes = [];
    if (change === "wrong_scope") history.scope = { ...history.scope, gameId: 2026020055 };
    if (change === "missing_label") delete (capture as any).evidenceKind;
    if (change === "historical_label") (capture as any).evidenceKind = "prospective_capture";
    if (change === "early_capture") capture.snapshotHash = projectionInputHash(capture.snapshot);
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(change === "late_assembly" ? cutoff : packet.frozenAt));
    try { expect(() => assembleFrozenPairFromCapture(capture, history, freeze(packet))).toThrow(); }
    finally { vi.useRealTimers(); }
  });
});

describe("independent full-game baseline and records", () => {
  it("uses two full-game histories and includes OT; it needs no FORGE or win input", () => {
    const packet = fixture(); const result = scoreTeamGoals(scope, packet.history);
    expect([result.homeMean, result.awayMean]).toEqual([3, 1]);
    expect(result.calibration).toBe("none");
    expect(packet.history[0].completedAt).toBe(receiptAt);
  });
  it("returns unavailable without either history instead of inventing a prior", () => {
    expect(scoreTeamGoals(scope, fixture().history.slice(0, 1)).homeMean).toBeNull();
  });
  it("orders the window by game time rather than the order final responses were captured", () => {
    const packet = fixture(), older = structuredClone(packet.history[0]);
    older.gameId = 2026020002; older.startedAt = "2026-10-04T23:00:00.000Z";
    older.completedAt = "2026-10-06T03:00:00.000Z";
    older.provenance.firstReceivedAt = older.completedAt; older.provenance.verifiedAt = older.completedAt;
    expect(scoreTeamGoals(scope, [...packet.history, older]).homeGameIds).toEqual([2026020001, 2026020002]);
  });
  it("rejects later receipt, unfinished game, cumulative duplicate and incomplete final events", () => {
    const packet = fixture();
    expect(() => scoreTeamGoals(scope, [...packet.history, packet.history[0]])).toThrow("Duplicate");
    expect(() => scoreTeamGoals(scope, [{ ...packet.history[0], provenance: { ...packet.history[0].provenance, firstReceivedAt: cutoff, verifiedAt: cutoff } }])).toThrow("Ineligible");
    const source = packet.retainedHistorySources[0].payload as any;
    for (const altered of [{ ...source, gameState: "LIVE" }, { ...source, plays: source.plays.slice(0, 3) }]) {
      expect(() => goalHistoryFromOfficialFinal(altered, { ...packet.history[0].provenance, payloadHash: projectionInputHash(altered) })).toThrow();
    }
  });
  it("excludes the shootout winner's standings goal", () => {
    const packet = fixture(), source = packet.retainedHistorySources[0].payload as any;
    source.periodDescriptor.periodType = "SO"; source.homeTeam.score = 2; source.awayTeam.score = 1;
    source.plays = source.plays.slice(1, 3);
    const history = goalHistoryFromOfficialFinal(source, { ...packet.history[0].provenance, payloadHash: projectionInputHash(source) });
    expect(history.map(game => game.goalsFor)).toEqual([1, 1]);
  });
  it("rejects a v4/v5 logistic feature manifest instead of relabeling it v6", () => {
    expect(() => validateTeamFreeze({ ...fixture().teamFreeze, featureSchemaVersion: "game_features_v5" })).toThrow("mismatch");
  });
});

describe("FORGE team goal accounting", () => {
  const coverage = { rosterPlayerIds: [100], residualMean: 0, strengthPartition: "exclusive_es_pp_pk" as const,
    overtime: "included" as const, emptyNet: "included" as const, proofRevisionIds: ["proof:1"] };
  it("integrates participation once using the existing native semantics", () => {
    const accounting = accountForgeTeamGoals([row()], coverage);
    expect(accounting.mean).toBeCloseTo(0.7);
    expect(accounting.meanSemantics).toBe("conditional_on_game_played");
    expect(accounting.contributors[0].expectedMeanGivenGamePlayed).toBeCloseTo(0.7);
    const out = row(); out.uncertainty.model.skater_selection.production_conditioning = "explicit_out";
    expect(accountForgeTeamGoals([out], coverage).mean).toBe(0);
  });
  it("keeps missing PK, participation, OT, EN and residuals explicit", () => {
    const missingPk = accountForgeTeamGoals([{ ...row(), proj_goals_pk: null }], coverage);
    expect(missingPk.reasons).toContain("missing_strength_goal:100");
    expect(missingPk.reasons).not.toContain("unknown_participation:100");
    const partial: any = row(); partial.proj_goals_pk = null; partial.uncertainty = null;
    const result = accountForgeTeamGoals([partial], { ...coverage, overtime: "unknown", emptyNet: "unknown", residualMean: null });
    expect(result.mean).toBeNull();
    expect(result.reasons).toEqual(expect.arrayContaining(["missing_strength_goal:100", "unknown_participation:100", "unproved_overtime_coverage", "unproved_empty_net_coverage", "unknown_residual"]));
  });
  it("rejects duplicate players, incomplete rosters and negative components", () => {
    expect(accountForgeTeamGoals([row(), row()], coverage).mean).toBeNull();
    expect(accountForgeTeamGoals([row()], { ...coverage, rosterPlayerIds: [100, 101] }).mean).toBeNull();
    expect(accountForgeTeamGoals([{ ...row(), proj_goals_pk: -0.1 }], coverage).mean).toBeNull();
    expect(accountForgeTeamGoals([{ ...row(), proj_goals_es: Number.MAX_VALUE, proj_goals_pp: Number.MAX_VALUE }], coverage).mean).toBeNull();
  });
});

describe("bounded frozen pair mechanics", () => {
  it("rejects a failed local packet even when its retained report is otherwise valid", async () => {
    const packet = fixture(), directory = mkdtempSync(join(tmpdir(), "failed-pair-"));
    const forecasts = await computeFrozenPair(packet, freeze(packet), { forge: async () => ({
      runId: packet.forgeRunId, outputHash: packet.forgeSnapshot.outputHash, matched: true, writes: [] }) });
    const original = { issuedAt: cutoff, inputHash: projectionInputHash(packet), forecastHash: projectionInputHash(forecasts), forecasts };
    const report = frozenPairDiagnosticReport(packet, forecasts, cutoff);
    try {
      for (const [name, value] of [["inputs.json", packet], ["original.json", original], ["diagnostics.json", report]] as const)
        writeFileSync(join(directory, name), JSON.stringify(value), { mode: 0o600 });
      expect(await loadLocalFrozenPairDiagnostics(directory, { gameId: scope.gameId, cutoffAt: cutoff })).toEqual(report);
      writeFileSync(join(directory, "failed.json"), JSON.stringify({ status: "failed" }), { mode: 0o600 });
      await expect(loadLocalFrozenPairDiagnostics(directory, { gameId: scope.gameId, cutoffAt: cutoff })).rejects.toMatchObject({ status: 503 });
    } finally { rmSync(directory, { force: true, recursive: true }); }
  });
  it("retains verified native partial accounting without populating the full-game comparison", async () => {
    const packet = fixture();
    let native = nativeWrites(packet, [100, 101]);
    const canonicalIds = projectionForecastRows(native.writes).filter(row => row.table === "forge_player_projections").map(row => row.row.player_id);
    if (JSON.stringify(canonicalIds) === JSON.stringify(native.team.uncertainty.native_goal_accounting.projectedPlayerIds))
      native = nativeWrites(packet, [101, 100]);
    const { writes } = native;
    packet.forgeSnapshot.outputHash = projectionWritesHash(writes);
    packet.forgeSnapshotHash = projectionInputHash(packet.forgeSnapshot);
    const result = await computeFrozenPair(packet, freeze(packet), { forge: async () => ({ runId: packet.forgeRunId,
      outputHash: packet.forgeSnapshot.outputHash, matched: true, writes }) });
    expect(result.native.home).toMatchObject({ reportedEsPpMean: 1.2, expectedListedEsPpMeanGivenGamePlayed: 1.2,
      fullOfficialPlayMean: null, fullGameEligible: false });
    expect(result.native.home!.projectedPlayerIds).toEqual(native.team.uncertainty.native_goal_accounting.projectedPlayerIds);
    expect(result.native.home!.projectedPlayerIds).not.toEqual(canonicalIds);
    const report = frozenPairDiagnosticReport(packet, result, cutoff);
    expect(report.comparisons[0]).toMatchObject({ forgeMean: null, difference: null, forge: { rawMean: null,
      nativeGoalAccounting: result.native.home }, reasons: expect.arrayContaining(["missing_native_pk_goal_estimator", "unproved_game_time_roster"]) });
    expect(forecastDiagnosticsMarkdown(report)).toContain('"reportedEsPpMean": 1.2');
    const changed = structuredClone(result); changed.native.home!.reportedEsPpMean = 9;
    expect(() => frozenPairDiagnosticReport(packet, changed, cutoff)).toThrow("native accounting");
  });
  it.each(["player_metadata", "team_components", "team_scope", "missing_team", "player_identity"])("rejects altered native %s despite a consistent output checksum", async change => {
    const packet = fixture(), native = nativeWrites(packet);
    if (change === "player_metadata") native.player.uncertainty.native_goal_accounting.fullGameEligible = true;
    if (change === "team_components") native.team.proj_goals_es = 9;
    if (change === "team_scope") native.team.as_of_date = "2026-10-08";
    if (change === "missing_team") native.writes.pop();
    if (change === "player_identity") native.team.uncertainty.native_goal_accounting.projectedPlayerIds = [101];
    packet.forgeSnapshot.outputHash = projectionWritesHash(native.writes);
    packet.forgeSnapshotHash = projectionInputHash(packet.forgeSnapshot);
    await expect(computeFrozenPair(packet, freeze(packet), { forge: async () => ({ runId: packet.forgeRunId,
      outputHash: packet.forgeSnapshot.outputHash, matched: true, writes: native.writes }) })).rejects.toThrow(/Native/);
  });
  it("exports retained roster selection causes while keeping full goals, residuals and discrepancy unknown", async () => {
    const packet = fixture(), native = nativeRosterWrites(packet);
    packet.forgeSnapshot.outputHash = projectionWritesHash(native.writes); packet.forgeSnapshotHash = projectionInputHash(packet.forgeSnapshot);
    const result = await computeFrozenPair(packet, freeze(packet), { forge: async () => ({ runId: packet.forgeRunId,
      outputHash: packet.forgeSnapshot.outputHash, matched: true, writes: native.writes }) });
    const report = frozenPairDiagnosticReport(packet, result, cutoff), retained = native.team.uncertainty.native_roster_contributor_coverage;
    const expected = { ...retained, contributors: retained.contributors.map((row: any) => row.playerId === 104 ? { ...row,
      participationProbabilityGivenGamePlayed: null, participationReason: "omitted_participation_evidence_not_bound", goalContributionStatus: "unknown" } : row),
      unknownResidualPlayerIds: [101, 102, 103, 104, 105] };
    expect(report.comparisons[0].forge!.nativeRosterContributorCoverage).toEqual(expected);
    expect(report.comparisons[0]).toMatchObject({ forgeMean: null, difference: null, forge: { rawMean: null, residualMean: null } });
    expect(expected).toMatchObject({ unmodeledGoaliePlayerIds: [101], unevaluatedRosterPlayerIds: [102],
      eligibleUnprojectedSkaterPlayerIds: [105], unknownResidualPlayerIds: [101, 102, 103, 104, 105], residualMean: null });
    expect(retained.contributors[4]).toMatchObject({ participationProbabilityGivenGamePlayed: 0, goalContributionStatus: "confirmed_out_given_game_played" });
    expect(JSON.parse(forecastDiagnosticsJson(report)).comparisons[0].forge.nativeRosterContributorCoverage).toEqual(expected);
    const markdown = forecastDiagnosticsMarkdown(report);
    expect(markdown).toContain(JSON.stringify(report.comparisons[0].forge, null, 2));
    expect(markdown).toContain('"selectionReason": "hard_stale_rate_history"');
    expect(result.acceptanceEligible).toBe(false);
  });
  it.each([0, 1])("keeps omitted-player probability %s unverified when scalar, reason and status change together", async probability => {
    const packet = fixture(), native = nativeRosterWrites(packet), coverage = native.team.uncertainty.native_roster_contributor_coverage;
    Object.assign(coverage.contributors[2], { participationProbabilityGivenGamePlayed: probability, participationReason: null,
      goalContributionStatus: probability === 0 ? "confirmed_out_given_game_played" : "unknown" });
    if (probability === 0) coverage.unknownResidualPlayerIds = coverage.unknownResidualPlayerIds.filter((id: number) => id !== 102);
    packet.forgeSnapshot.outputHash = projectionWritesHash(native.writes); packet.forgeSnapshotHash = projectionInputHash(packet.forgeSnapshot);
    const before = JSON.stringify(native.writes);
    const result = await computeFrozenPair(packet, freeze(packet), { forge: async () => ({ runId: packet.forgeRunId,
      outputHash: packet.forgeSnapshot.outputHash, matched: true, writes: native.writes }) });
    const report = frozenPairDiagnosticReport(packet, result, cutoff), exported = JSON.parse(forecastDiagnosticsJson(report));
    expect(exported.comparisons[0].forge.nativeRosterContributorCoverage.contributors[2]).toMatchObject({
      participationProbabilityGivenGamePlayed: null, participationReason: "omitted_participation_evidence_not_bound", goalContributionStatus: "unknown" });
    expect(exported.comparisons[0].forge.nativeRosterContributorCoverage.unknownResidualPlayerIds).toContain(102);
    expect(forecastDiagnosticsMarkdown(report)).toContain("omitted_participation_evidence_not_bound");
    expect(JSON.stringify(native.writes)).toBe(before);
    expect(result.acceptanceEligible).toBe(false);
  });
  it.each([[0, "outside_skater_estimator"], [3, "passed"], [2, "passed"], [5, "failed"], [4, "not_evaluated"]])
    ("rejects contradictory native rate eligibility for contributor %s", async (index, rateEligibility) => {
      const packet = fixture(), native = nativeRosterWrites(packet);
      native.team.uncertainty.native_roster_contributor_coverage.contributors[Number(index)].rateEligibility = rateEligibility;
      packet.forgeSnapshot.outputHash = projectionWritesHash(native.writes); packet.forgeSnapshotHash = projectionInputHash(packet.forgeSnapshot);
      await expect(computeFrozenPair(packet, freeze(packet), { forge: async () => ({ runId: packet.forgeRunId,
        outputHash: packet.forgeSnapshot.outputHash, matched: true, writes: native.writes }) })).rejects.toThrow(/Native roster/);
    });
  it.each(["identity", "duplicate", "summary", "probability", "full_mean", "residual", "projected_status", "appearance", "orphan",
    "goalie_probability", "unknown_out", "missing_reason"])
    ("rejects unsupported native roster %s even when the output hash is recomputed", async change => {
      const packet = fixture(), native = nativeRosterWrites(packet), coverage = native.team.uncertainty.native_roster_contributor_coverage;
      if (change === "identity") coverage.contributors[1].playerId = 999;
      if (change === "duplicate") coverage.contributors[1].playerId = 100;
      if (change === "summary") coverage.unmodeledGoaliePlayerIds = [];
      if (change === "probability") coverage.contributors[0].participationProbabilityGivenGamePlayed = 0.5;
      if (change === "full_mean") coverage.contributors[1].fullOfficialPlayMean = 0;
      if (change === "residual") coverage.residualMean = 0;
      if (change === "projected_status") coverage.contributors[0].goalContributionStatus = "unknown";
      if (change === "appearance") coverage.contributors[0].participationProbabilityGivenGamePlayed = 0;
      if (change === "goalie_probability") coverage.contributors[1].participationProbabilityGivenGamePlayed = 0;
      if (change === "unknown_out") coverage.contributors[3].participationProbabilityGivenGamePlayed = 0;
      if (change === "missing_reason") coverage.contributors[2].participationReason = null;
      if (change === "orphan") { delete native.team.uncertainty.native_goal_accounting; delete native.player.uncertainty.native_goal_accounting; }
      packet.forgeSnapshot.outputHash = projectionWritesHash(native.writes); packet.forgeSnapshotHash = projectionInputHash(packet.forgeSnapshot);
      await expect(computeFrozenPair(packet, freeze(packet), { forge: async () => ({ runId: packet.forgeRunId,
        outputHash: packet.forgeSnapshot.outputHash, matched: true, writes: native.writes }) })).rejects.toThrow(/Native roster/);
    });
  it("kills its worker at the hard deadline and reports malformed private packets", async () => {
    const directory = mkdtempSync(join(tmpdir(), "frozen-pair-test-"));
    const path = join(directory, "invalid.json"); writeFileSync(path, "invalid JSON", { mode: 0o600 });
    try {
      await expect(boundedWorker(path, 100)).rejects.toThrow("hard deadline");
      await expect(boundedWorker(path, 5000)).rejects.toThrow("Frozen runner failed");
      expect(() => boundedWorker(path, 600001)).toThrow("timeout");
    } finally { rmSync(directory, { recursive: true }); }
  });
  it("pairs exactly one game and cutoff, preserves originals, and never grants synthetic acceptance", async () => {
    const packet = fixture();
    const scorer = async () => ({ runId: packet.forgeRunId, outputHash: packet.forgeSnapshot.outputHash, matched: true, writes: [] });
    const first = await computeFrozenPair(packet, freeze(packet), { forge: scorer });
    const original = { inputHash: projectionInputHash(packet), forecastHash: projectionInputHash(first), forecasts: first };
    const before = JSON.stringify(original);
    const replay = await computeFrozenPair(packet, freeze(packet), { forge: scorer });
    expect(verifyPairReplay(original, packet, replay).matched).toBe(true);
    expect(JSON.stringify(original)).toBe(before);
    expect(first.acceptanceEligible).toBe(false);
    expect(first.forge.home.mean).toBeNull();
  });
  it("exports preserved model outputs through the shared report format without certifying acceptance", async () => {
    const packet = fixture();
    const writes = [[{ method: "from", args: ["forge_player_projections"] }, { method: "upsert", args: [[
      { ...row(), game_id: scope.gameId, team_id: scope.homeTeamId, horizon_games: 1 },
    ]] }]];
    packet.forgeSnapshot.outputHash = projectionWritesHash(writes);
    packet.forgeSnapshotHash = projectionInputHash(packet.forgeSnapshot);
    const result = await computeFrozenPair(packet, freeze(packet), { forge: async () => ({
      runId: packet.forgeRunId, outputHash: packet.forgeSnapshot.outputHash, matched: true, writes }) });
    const before = JSON.stringify(result);
    const report = frozenPairDiagnosticReport(packet, result, cutoff, true);
    expect(report.evidenceKind).toBe("synthetic_fixture");
    expect(report.replay.status).toBe("not_verified");
    expect(report.comparisons[0]).toMatchObject({ teamMean: null, difference: null,
      forge: { meanSemantics: "unknown" }, team: { rawMean: 3 },
      reasons: expect.arrayContaining(["unknown_game_occurrence_probability", "exploratory_team_baseline_not_accepted", "player_contract_not_certified"]) });
    expect(report.comparisons[0].forge!.contributors[0]).toMatchObject({ playerId: 100, semantics: "unknown" });
    expect(report.comparisons[0].forge!.contributors[0].mean).toBeCloseTo(0.7);
    expect(report.exposure.map(row => row.correctedTotals)).toEqual([{ gp: 1, gf: 3, ga: 1 }, { gp: 1, gf: 1, ga: 3 }]);
    expect(JSON.parse(forecastDiagnosticsJson(report))).toEqual(report);
    const markdown = forecastDiagnosticsMarkdown(report);
    expect(markdown).toContain("Exact frozen-input replay mechanics verified; acceptance remains open.");
    expect(markdown).toContain("| 15 | Unavailable | 3 | Unavailable | Unavailable | Unavailable | incompatible |");
    expect(JSON.stringify(result)).toBe(before);
    expect(() => frozenPairDiagnosticReport(packet, { ...result, inputHash: "wrong" }, cutoff)).toThrow("does not match");
    expect(() => frozenPairDiagnosticReport(packet, result, packet.scope.startAt)).toThrow("issuance");
    expect(() => frozenPairDiagnosticReport(packet, result, cutoff.replace("Z", ""))).toThrow("issuance");
    const altered = structuredClone(result); altered.team.homeMean = 9;
    expect(() => frozenPairDiagnosticReport(packet, altered, cutoff)).toThrow("differs");
  });
  it.each(["cutoff", "code", "hash", "late", "rpc", "query_error", "facts", "historical_label", "freeze"])("rejects %s before executing either scorer", async change => {
    const packet = fixture(), expected = structuredClone(freeze(packet));
    if (change === "cutoff") packet.forgeSnapshot.inputCutoff = receiptAt;
    if (change === "code") packet.forgeFreeze.codeCommit = "f".repeat(40);
    if (change === "hash") packet.forgeSnapshot.reads[0].result = { data: [42] };
    if (change === "late") packet.forgeReadProvenance[0].verifiedAt = cutoff;
    if (change === "rpc") { packet.forgeSnapshot.reads[0].request[0].method = "rpc"; packet.forgeSnapshotHash = projectionInputHash(packet.forgeSnapshot); }
    if (change === "facts") packet.history[0].goalsFor = 99;
    if (change === "historical_label") packet.evidenceKind = "prospective_capture";
    if (change === "freeze") packet.frozenAt = cutoff;
    if (change === "query_error") {
      packet.forgeSnapshot.reads[0].result = { data: null, error: { message: "fixture unavailable input" } };
      packet.forgeSnapshotHash = projectionInputHash(packet.forgeSnapshot);
      packet.forgeReadProvenance[0].payloadHash = projectionInputHash(packet.forgeSnapshot.reads[0]);
    }
    const scorer = vi.fn();
    await expect(computeFrozenPair(packet, expected, { forge: scorer })).rejects.toThrow();
    expect(scorer).not.toHaveBeenCalled();
  });
  it("detects changed originals and replay outputs", async () => {
    const packet = fixture(), original = { inputHash: projectionInputHash(packet), forecastHash: projectionInputHash({ home: 3 }), forecasts: { home: 3 } };
    expect(() => verifyPairReplay(original, packet, { home: 4 })).toThrow("differs");
    original.forecasts.home = 9;
    expect(() => verifyPairReplay(original, packet, { home: 3 })).toThrow("differs");
  });
  it("reuses exact query interception, consumes every read and suppresses writes", async () => {
    const packet = fixture();
    const live = vi.fn(() => { throw new Error("live access"); });
    const replay = await replayProjectionInputs(packet.forgeSnapshot.reads, async () => {
      const result = await interceptProjectionQuery("from", ["rates"], live).select("*");
      await interceptProjectionQuery("from", ["forge_player_projections"], live).upsert([row()]);
      return result;
    });
    expect(live).not.toHaveBeenCalled(); expect(replay.writes).toHaveLength(1);
    await expect(replayProjectionInputs(packet.forgeSnapshot.reads, async () => null)).rejects.toThrow("every captured");
    await expect(replayProjectionInputs(packet.forgeSnapshot.reads, async () => interceptProjectionQuery("from", ["unknown"], live))).rejects.toThrow("Unrecorded");
  });
  it("validates an unchanged packet independently", () => {
    const packet = fixture(); expect(() => validateFrozenPair(packet, freeze(packet))).not.toThrow();
  });
});
