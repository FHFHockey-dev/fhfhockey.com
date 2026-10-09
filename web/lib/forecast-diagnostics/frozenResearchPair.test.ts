// @vitest-environment node
import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { projectionInputHash } from "../projections/inputCapture";
import { goalHistoryFromOfficialFinal } from "./pairedInputs";
import { assembleFrozenResearchPair, researchPairFreezes, replayResearchPairInputs, validateResearchPairFreeze,
  researchPairDiagnosticReport, researchPairDiagnosticsMarkdown } from "./frozenResearchPair";
import { isResearchDiagnosticsReport } from "./researchContract";
function researchPairFixture() {
  const oldScope = { gameId: 2026020099, seasonId: 20262027, phase: 2 as const, homeTeamId: 10, awayTeamId: 11,
    startAt: "2026-10-08T23:00:00Z", cutoffAt: "2026-10-08T22:00:00Z", horizonGames: 1 as const };
  const source = (revisionId: string, payload: any, url: string, extra: any = {}) => {
    const bodyUtf8 = JSON.stringify(payload);
    return { revisionId, payload, bodyUtf8, rawBytesHash: createHash("sha256").update(bodyUtf8).digest("hex"), url, httpStatus: 200, ...extra,
      provenance: { revisionId, payloadHash: projectionInputHash(payload), source: url, firstReceivedAt: "2026-10-07T19:00:00Z",
        verifiedAt: "2026-10-07T19:00:00.010Z", publishedAt: null, availabilityBasis: "retained_capture" as const, correctionOf: null } };
  };
  const games = [10, 11].map((teamId, i) => ({ id: 2026020001 + i, season: oldScope.seasonId, gameType: 2, gameState: "OFF",
    startTimeUTC: "2026-10-01T23:00:00Z", homeTeam: { id: teamId, score: 1, sog: 1 }, awayTeam: { id: teamId + 10, score: 0, sog: 0 },
    periodDescriptor: { number: 3, periodType: "REG" }, rosterSpots: [teamId, teamId + 10].flatMap(t => [
      { teamId: t, playerId: t * 100 + 1, positionCode: "C" }, { teamId: t, playerId: t * 100 + 99, positionCode: "G" }]),
    plays: [{ eventId: 1, typeDescKey: "goal", periodDescriptor: { number: 1, periodType: "REG" }, timeInPeriod: "03:21", situationCode: "1551",
      details: { eventOwnerTeamId: teamId, scoringPlayerId: teamId * 100 + 1, shotType: "wrist", goalieInNetId: (teamId + 10) * 100 + 99 } },
    { eventId: 99, typeDescKey: "game-end", periodDescriptor: { number: 3, periodType: "REG" }, timeInPeriod: "20:00" }] }));
  const pbps = games.map(g => source(`pbp-${g.id}`, g, `https://api-web.nhle.com/v1/gamecenter/${g.id}/play-by-play`));
  const oldTarget = { id: oldScope.gameId, season: oldScope.seasonId, gameType: 2, gameState: "FUT", startTimeUTC: oldScope.startAt,
    homeTeam: { id: 10 }, awayTeam: { id: 11 } };
  const schedules = games.map((g, i) => source(`old-schedule-${i}`, { games: [g, oldTarget] }, `https://example.test/old/${i}`));
  const history = pbps.map((s, i) => goalHistoryFromOfficialFinal(s.payload, s.provenance).find(g => g.teamId === 10 + i)!);
  const historyBundle = { scope: oldScope, history, retainedHistorySources: pbps, scheduleSources: schedules,
    capturedAt: "2026-10-07T19:01:00Z", acceptanceEligible: false,
    population: [10, 11].map((teamId, i) => ({ teamId, selectedGameIds: [games[i].id], incompleteGameIds: [] })) };
  const parserSourceHash = createHash("sha256").update(readFileSync(join(__dirname, "../supabase/Upserts/nhlStrengthState.ts"), "utf8")).digest("hex");
  const attributeAudit = { version: "retained-goal-attribute-audit-v1", codeCommit: "a".repeat(40), parserHash: parserSourceHash, prospectiveScope: oldScope,
    acceptanceEligible: false, goalCount: 2, games: pbps.map(s => ({ gameId: s.payload.id, revisionId: s.revisionId, rawBytesHash: s.rawBytesHash,
      firstReceivedAt: s.provenance.firstReceivedAt, originalVerifiedAt: s.provenance.verifiedAt, officialPlayGoalCount: 1,
      ledgerCounts: { "REG:both_present:equal_skaters": 1 }, excludedGoals: [], events: [{ eventId: 1,
        teamId: s.payload.homeTeam.id, scoringPlayerId: s.payload.homeTeam.id * 100 + 1, period: "REG", rawSituationCode: "1551",
        goalieInNetId: s.payload.awayTeam.id * 100 + 99, attackingGoalie: 1, defendingGoalie: 1, attackingSkaters: 5, defendingSkaters: 5,
        ledgerCell: "REG:both_present:equal_skaters", gaps: [] }] })) };
  const abbrev = (id: number) => id === 10 ? "BOS" : id === 11 ? "UTA" : "NJD";
  const boxes = games.map(g => {
    const stats = (id: number) => ({ forwards: [{ playerId: id * 100 + 1, position: "C", toi: "10:00", goals: id === g.homeTeam.id ? 1 : 0 }],
      defense: [], goalies: [{ playerId: id * 100 + 99, position: "G", toi: "60:00" }] });
    return source(`box-${g.id}`, { ...g, homeTeam: { ...g.homeTeam, abbrev: abbrev(g.homeTeam.id) },
      awayTeam: { ...g.awayTeam, abbrev: abbrev(g.awayTeam.id) }, playerByGameStats: { homeTeam: stats(g.homeTeam.id), awayTeam: stats(g.awayTeam.id) } },
      `https://api-web.nhle.com/v1/gamecenter/${g.id}/boxscore`, { kind: "official_boxscore", httpStatus: 200, gameId: g.id });
  });
  const rosters = [10, 11].map(id => source(`roster-${id}`, { forwards: [{ id: id * 100 + 1, positionCode: "C" }], defensemen: [],
    goalies: [{ id: id * 100 + 99, positionCode: "G" }] }, `https://api-web.nhle.com/v1/roster/${abbrev(id)}/current`,
    { kind: "official_current_team_roster", httpStatus: 200, teamId: id, teamAbbrev: abbrev(id), seasonId: oldScope.seasonId, requestedAt: "2026-10-07T18:59:59Z" }));
  const targetScope = { ...oldScope, gameId: 2026020199, gameDate: "2026-10-08" };
  const targetSchedules = [10, 11].map((id, i) => source(`new-schedule-${id}`, { games: [games[i], { ...oldTarget, id: targetScope.gameId, gameDate: targetScope.gameDate }] },
    `https://api-web.nhle.com/v1/club-schedule-season/${abbrev(id)}/${oldScope.seasonId}`, { httpStatus: 200 }));
  const spec = { evidenceKind: "synthetic_fixture" as const, scope: targetScope, abilityCutoffAt: "2026-10-07T20:00:00Z",
    featureCutoffAt: "2026-10-07T20:00:00Z", sources: { historyBundle, attributeAudit, ledgerRevisions: [...pbps, ...schedules],
      boxscoreRevisions: boxes, rosterRevisions: rosters, targetScheduleRevisions: targetSchedules } };
  const execution = researchPairFreezes({ codeCommit: "a".repeat(40), sourceTreeHash: "b".repeat(64), lockfileHash: "c".repeat(64), nodeVersion: process.version }, parserSourceHash);
  return { spec, execution, frozenAt: "2026-10-07T21:00:00Z" };
}

describe("explicit prospective research pair", () => {
  it.each(["nominal", "conflicting_envelope", "duplicate_within_role", "non_schedule_reuse", "unbound_history_schedule"])(
    "permits only identical schedule-observation role reuse: %s", fault => {
      const f = researchPairFixture(), sources = f.spec.sources;
      sources.historyBundle.scope.gameId = f.spec.scope.gameId;
      sources.historyBundle.scheduleSources = [...sources.targetScheduleRevisions];
      sources.ledgerRevisions = [...sources.ledgerRevisions.filter(source => source.revisionId.startsWith("pbp-")), ...sources.targetScheduleRevisions];
      if (fault === "conflicting_envelope") sources.targetScheduleRevisions[0] = { ...sources.targetScheduleRevisions[0], requestedAt: "different retained request" };
      if (fault === "duplicate_within_role") sources.ledgerRevisions.push(sources.targetScheduleRevisions[0]);
      if (fault === "non_schedule_reuse") sources.boxscoreRevisions[0] = sources.ledgerRevisions[0];
      if (fault === "unbound_history_schedule") sources.historyBundle.scheduleSources[0] = { ...sources.historyBundle.scheduleSources[0], revisionId: "unbound-history-schedule" };
      if (fault !== "nominal") {
        expect(() => assembleFrozenResearchPair(f.spec, f.execution, f.frozenAt)).toThrow("Duplicate research source revision");
        return;
      }
      const packet = assembleFrozenResearchPair(f.spec, f.execution, f.frozenAt);
      const forecasts = replayResearchPairInputs(packet);
      const report = researchPairDiagnosticReport(packet, forecasts, packet.scope.cutoffAt, false);
      expect(report.sources).toHaveLength(8);
      expect(new Set(report.sources.map(source => source.revisionId)).size).toBe(report.sources.length);
      expect(isResearchDiagnosticsReport(report)).toBe(true);
      expect(forecasts.acceptanceEligible).toBe(false);
      expect(forecasts.qualifiedDifference).toBeNull();
      expect(forecasts.forecast.models).toHaveLength(3);
    },
  );
  it.each(["baseline", "history", "cells", "participation", "game", "qualification", "observed_negative", "observed_fractional", "observed_object", "observed_missing", "conditional_negative", "conditional_infinite", "conditional_object", "conditional_missing"])("rejects incomplete research responses for %s", fault => {
    const f = researchPairFixture(), packet = assembleFrozenResearchPair(f.spec, f.execution, f.frozenAt);
    const report: any = researchPairDiagnosticReport(packet, replayResearchPairInputs(packet), packet.scope.cutoffAt, false);
    if (fault === "baseline") delete report.researchForecast.baseline;
    if (fault === "history") delete report.researchForecast.forecast.models[0].teams[0].historyGameIds;
    if (fault === "cells") delete report.researchForecast.forecast.models[0].teams[0].cellMeansGivenGamePlayed;
    if (fault === "participation") report.researchForecast.forecast.models[0].teams[0].players[0].participation.confirmed = true;
    if (fault === "game") report.researchForecast.forecast.scope.gameId++;
    if (fault === "qualification") report.researchForecast.qualifiedDifference = 0;
    const player = report.researchForecast.forecast.models[0].teams[0].players[0];
    if (fault === "observed_negative") player.observedPositiveToiAppearances = -1;
    if (fault === "observed_fractional") player.observedPositiveToiAppearances = 0.5;
    if (fault === "observed_object") player.observedPositiveToiAppearances = { confirmed: true };
    if (fault === "observed_missing") delete player.observedPositiveToiAppearances;
    if (fault === "conditional_negative") player.conditionalGoalsPerPlayingAppearance = -123;
    if (fault === "conditional_infinite") player.conditionalGoalsPerPlayingAppearance = Infinity;
    if (fault === "conditional_object") player.conditionalGoalsPerPlayingAppearance = {};
    if (fault === "conditional_missing") delete player.conditionalGoalsPerPlayingAppearance;
    expect(isResearchDiagnosticsReport(report)).toBe(false);
  });
  it("preserves an explicitly unavailable conditional player mean", () => {
    const f = researchPairFixture(), packet = assembleFrozenResearchPair(f.spec, f.execution, f.frozenAt);
    const report = researchPairDiagnosticReport(packet, replayResearchPairInputs(packet), packet.scope.cutoffAt, false);
    report.researchForecast.forecast.models[0]!.teams[0]!.players[0]!.conditionalGoalsPerPlayingAppearance = null;
    expect(isResearchDiagnosticsReport(report)).toBe(true);
  });
  it.each(["invalid_start", "missing_start", "live_invalid_start"])("rejects unclassifiable prior schedule games: %s", fault => {
    const f = researchPairFixture(), source = f.spec.sources.targetScheduleRevisions[0];
    const added: any = { ...source.payload.games[0], id: 2026020003, startTimeUTC: "invalid" };
    if (fault === "missing_start") delete added.startTimeUTC;
    if (fault === "live_invalid_start") added.gameState = "LIVE";
    source.payload.games.push(added); source.bodyUtf8 = JSON.stringify(source.payload);
    source.rawBytesHash = createHash("sha256").update(source.bodyUtf8).digest("hex"); source.provenance.payloadHash = projectionInputHash(source.payload);
    expect(() => assembleFrozenResearchPair(f.spec, f.execution, f.frozenAt)).toThrow();
  });
  it.each(["unofficial_endpoint", "failed_http", "unknown_http"])("rejects unqualified historical PBP: %s", fault => {
    const f = researchPairFixture(), source = f.spec.sources.ledgerRevisions[0];
    if (fault === "unofficial_endpoint") {
      source.url = source.provenance.source = "https://example.test/unverified-pbp";
      f.spec.sources.historyBundle.history[0].provenance.source = source.url;
    } else if (fault === "failed_http") source.httpStatus = 500;
    else delete source.httpStatus;
    expect(() => assembleFrozenResearchPair(f.spec, f.execution, f.frozenAt)).toThrow("Historical PBP");
  });
  it("replays raw evidence for a different target while preserving the old history scope and all variants", () => {
    const f = researchPairFixture(), before = projectionInputHash(f.spec);
    const packet = assembleFrozenResearchPair(f.spec, f.execution, f.frozenAt);
    const out = replayResearchPairInputs(packet);
    expect(out.scope.gameId).toBe(2026020199);
    expect(out.historicalScopePreserved.gameId).toBe(2026020099);
    expect(out.forecast.models).toHaveLength(3);
    for (const model of out.forecast.models) for (const team of model.teams) {
      expect(Object.keys(team.cellMeansGivenGamePlayed)).toHaveLength(24);
      expect(team.unconditionalGoalsMean).toBeNull();
      expect(team.fullGameEligible).toBe(false);
    }
    expect(out.forecast.scope.pGamePlayed).toBeNull();
    expect(out.qualifiedDifference).toBeNull();
    expect(out.acceptanceEligible).toBe(false);
    expect(projectionInputHash(f.spec)).toBe(before);
    const report = researchPairDiagnosticReport(packet, out, packet.scope.cutoffAt, true);
    expect(researchPairDiagnosticsMarkdown(report)).toContain(JSON.stringify(report, null, 2));
    expect(() => researchPairDiagnosticReport(packet, out, packet.scope.startAt, true)).toThrow("issuance");
  });
  it.each(["late_roster", "corrupt_body", "duplicate_source", "wrong_target", "schedule_failed", "future_freeze", "late_training", "same_run", "mutated_parameters"])("rejects %s before issuance", fault => {
    const f = researchPairFixture(), packet = assembleFrozenResearchPair(f.spec, f.execution, f.frozenAt);
    if (fault === "late_roster") packet.sources.rosterRevisions[0].provenance.verifiedAt = packet.featureCutoffAt;
    if (fault === "corrupt_body") packet.sources.boxscoreRevisions[0].bodyUtf8 += " ";
    if (fault === "duplicate_source") packet.sources.targetScheduleRevisions[1] = packet.sources.targetScheduleRevisions[0];
    if (fault === "wrong_target") packet.scope.gameId++;
    if (fault === "schedule_failed") packet.sources.targetScheduleRevisions[0].httpStatus = 500;
    if (fault === "future_freeze") packet.frozenAt = packet.scope.cutoffAt;
    if (fault === "late_training") packet.abilityCutoffAt = "2026-10-07T19:00:00Z";
    if (fault === "same_run") packet.teamRunId = packet.researchRunId;
    if (fault === "mutated_parameters") {
      packet.researchFreeze.parameters.parserSourceHash = "0".repeat(64);
      expect(() => validateResearchPairFreeze(packet, f.execution)).toThrow("differ");
    } else expect(() => replayResearchPairInputs(packet)).toThrow();
  });
  it("rejects an otherwise coherent stale window against the explicit target's newer schedule", () => {
    const f = researchPairFixture(), source = f.spec.sources.targetScheduleRevisions[0];
    source.payload.games.push({ ...source.payload.games[0], id: 2026020003, startTimeUTC: "2026-10-02T23:00:00Z" });
    source.bodyUtf8 = JSON.stringify(source.payload);
    source.rawBytesHash = createHash("sha256").update(source.bodyUtf8).digest("hex");
    source.provenance.payloadHash = projectionInputHash(source.payload);
    expect(() => assembleFrozenResearchPair(f.spec, f.execution, f.frozenAt)).toThrow("stale or incomplete");
  });
});

describe("research report issuance timestamp", () => {
  it.each(["", "not-a-time", "2026-10-08", "2026-10-08T22:15:00"])("rejects malformed or timezone-free issuance %s", issuedAt => {
    const f = researchPairFixture(), packet = assembleFrozenResearchPair(f.spec, f.execution, f.frozenAt);
    const out = replayResearchPairInputs(packet);
    expect(() => researchPairDiagnosticReport(packet, out, issuedAt, true)).toThrow();
  });
});
