import { describe, expect, it } from "vitest";
import { buildGameExpectationView, decodeGameExpectationView, GAME_EXPECTATION_VIEW_LIMITS, GameExpectationViewLimitError } from "./gameExpectationView";
import { parseGameExpectationScope } from "./gameExpectationReader";
import { buildGameExpectations, type GameExpectationScope } from "./gameExpectations";
import type { ContributionParticipation, ContributionSource } from "./contributions";
import type { GameForecast, PlanningData } from "../rosterScheduleOptimizer/planningTypes";
import { resolvePlanningContributions } from "./planningContributions";
import { startChartFromGameExpectations } from "../projections/startChartContract";
import { encodePlanningDataTransport, decodePlanningDataTransport } from "../rosterScheduleData/planningDataTransport";

import { previewSeasonBaseline } from "../../scripts/preview-native-baseline";
import { FANTASY_PROJECTION_CONTRACT_VERSION, FANTASY_PROJECTION_CONTRACT_CHECKSUM } from "../fantasy-projections/contracts";
import type { PortableSeasonArtifact } from "../fantasy-projections/evaluator";

function seasonArtifact(): PortableSeasonArtifact {
  return { schemaVersion: "player-forecast-season-artifact-v1", seasonId: 20262027,
    contractVersion: FANTASY_PROJECTION_CONTRACT_VERSION, contractChecksum: FANTASY_PROJECTION_CONTRACT_CHECKSUM,
    artifactVersion: "synthetic-season-v1", featureSchemaVersion: "synthetic-v1", codeVersion: "fixture",
    trainingCutoffAt: "2026-10-15T10:00:00Z", teams: {}, players: { "7": { fhfhPlayerId: 7, nhlPlayerId: 77,
      teamId: 1, population: "forward", position: "L", playProbability: 0.5,
      conditionalRates: { GOALS: 2, PRIMARY_ASSISTS: 1, SECONDARY_ASSISTS: 1, PENALTY_MINUTES: 4, TOTAL_TOI: 1200 },
      conditionalVariances: {}, ratings: {}, deployment: {} } } };
}
const now = new Date("2026-10-15T12:00:00Z");
const scope: GameExpectationScope = { seasonId: 20262027, startDate: "2026-10-15", endDate: "2026-10-21", timeZone: "UTC", mode: "next_n", games: 2 };
const uses = { assignment: true, totals: true, comparison: true, conditionalTieBreak: true };
function fixture(): PlanningData {
  return { players: [{ id: "7", nhlId: 77, nhlTeamId: 1, name: "Synthetic Skater", rosterRevision: "roster-a",
    teamAbbreviation: "MIN", eligiblePositions: ["LW"], playerClass: "skater", availability: "unknown", ownership: null,
    canDrop: null, holdValue: null, reserveEligibility: [] }],
    games: ["2026-10-15", "2026-10-17"].map((date, i) => ({ id: String(30 + i), date,
      startsAt: `${date}T23:00:00Z`, teamAbbreviation: "MIN", opponent: "TOR", home: true,
      status: "scheduled", scheduleRevision: `schedule-${i}` })), forecasts: [], evidence: {
        schedule: { source: "synthetic", asOf: now.toISOString(), seasonId: 20262027, completeness: "complete", limitations: [] } } };
}
function detail(data: PlanningData, index: number, stats: Record<string, number | null>, probability: number | null = 1): GameForecast {
  const game = data.games[index], player = data.players[0];
  return { playerId: player.id, gameId: game.id, stats, sourceKind: "detailed", sourceWatermark: `input-${index}`,
    conditioning: "unconditional", appearanceProbability: probability, startProbability: player.playerClass === "goalie" ? probability : null,
    confirmedStart: false, revisionId: `issued-${index}`, modelVersion: "native-fixture-v1", allowedUses: uses,
    issuedAt: "2026-10-15T11:00:00Z", cutoffAt: "2026-10-15T10:00:00Z", expiresAt: "2026-10-20T12:00:00Z", limitations: [],
    issuedContext: { version: "forge-issued-context-v1", playerId: player.id, gameId: game.id, nhlPlayerId: 77,
      seasonId: 20262027, teamId: 1, scheduledAt: game.startsAt!, scheduleRevision: game.scheduleRevision!,
      rosterRevision: "roster-a", observedAt: "2026-10-15T10:00:00Z", scheduleFetchedAt: null,
      scheduleSourceUpdatedAt: null, identityUpdatedAt: null, membershipCreatedAt: [] } };
}
function baseline(overrides: Partial<ContributionSource> = {}): ContributionSource {
  return { kind: "baseline", sourceId: "baseline-fixture", policyVersion: "native-rate-fixture-v1", released: true,
    playerId: 7, nhlPlayerId: 77, seasonId: 20262027, teamId: 1, rosterRevision: "roster-a", scheduleRevision: "catalog-schedule",
    targetKey: "SHOTS_ON_GOAL", unit: "count", basis: "per_appearance", mean: 4, participationIntegrated: false,
    cutoffAt: "2026-10-15T09:00:00Z", issuedAt: "2026-10-15T09:10:00Z", expiresAt: "2026-10-20T12:00:00Z",
    sourceWatermark: "native-input-hash", allowedUses: uses, ...overrides };
}

describe("shared per-game expectation view (synthetic engineering fixtures)", () => {
  it("keeps PP deployment explicitly unknown independently of admitted PPP means and legacy role strings", () => {
    const data = fixture();
    data.forecasts = [Object.assign(detail(data, 0, { PP_POINTS: 0.8 }), { ppRole: "PP1" })];
    const result = buildGameExpectations(data, { ...scope, games: 1 }, now).players[0];
    expect(result.games[0].powerPlayRole).toEqual({ value: null, status: "unavailable",
      reason: "current_role_evidence_unavailable", source: null });
    expect(result.games[0].targets.PP_POINTS.expected).toBe(0.8);
    expect(result.totals.PP_POINTS.expected).toBe(0.8);
    const board = startChartFromGameExpectations(buildGameExpectations(data, { ...scope, games: 1 }, now));
    expect(board.players[0].gameExpectation?.powerPlayRole).toEqual(result.games[0].powerPlayRole);
    expect(board.players[0].gameExpectation?.targets.PP_POINTS.expected).toBe(0.8);
    data.forecasts = [];
    expect(buildGameExpectations(data, { ...scope, games: 1 }, now).players[0].games[0].powerPlayRole)
      .toEqual(result.games[0].powerPlayRole);
    data.players[0].playerClass = "goalie";
    expect(buildGameExpectations(data, { ...scope, games: 1 }, now).players[0].games[0].powerPlayRole)
      .toEqual({ value: null, status: "not_applicable", reason: "not_applicable", source: null });
  });
  it.each(["frozen-window", "roster-observation", "rolling-14d"] as const)("retains independent %s modeled starts through the shared view and StartChart without reweighting appearance means", method => {
    const data = fixture(), game = data.games[0]; data.players[0].playerClass = "goalie";
    data.baselineSources = [baseline({ policyVersion: "native-goalie-appearance-volume-rates-v1", targetKey: "SAVES_GOALIE", mean: 20 })];
    const appearance: ContributionParticipation = { playerId: 7, nhlPlayerId: 77, seasonId: 20262027, teamId: 1,
      gameId: Number(game.id), scheduledAt: game.startsAt!, scheduleRevision: game.scheduleRevision!, rosterRevision: "roster-a",
      basis: "appearance", probability: 0.5, revisionId: "synthetic-appearance", released: true, allowedUses: uses,
      cutoffAt: "2026-10-15T10:00:00Z", issuedAt: "2026-10-15T11:00:00Z", expiresAt: "2026-10-15T18:00:00Z",
      model: { version: `goalie-${method}-appearance-frequency-v1`, event: "positive_minutes", calibration: "unavailable",
        probabilityStatus: "uncalibrated_model", inputHash: "a".repeat(64), evidenceHashes: ["b".repeat(64)],
        numerator: 1, denominator: 2, selectedGameIds: [10, 11], limitations: ["Synthetic finite frequency."] } };
    const start: ContributionParticipation = { ...appearance, basis: "start", probability: 0.25, revisionId: "synthetic-start",
      allowedUses: { ...uses },
      expiresAt: "2026-10-15T13:00:00Z", model: { ...appearance.model!, version: `goalie-${method}-start-frequency-v1`,
        event: "official_starter", numerator: 1, denominator: 4, selectedGameIds: [10, 11, 12, 13] } };
    data.participationSources = [appearance, start];
    const read = (input = data, at = now) => buildGameExpectations(input, { ...scope, games: 1 }, at);
    const view = read(), result = view.players[0].games[0];
    expect(result).toMatchObject({ appearanceProbability: 0.5, startProbability: 0.25,
      startParticipation: { revisionId: "synthetic-start", model: { event: "official_starter", sampleSize: 4 } } });
    expect(result.targets.SAVES_GOALIE.expected).toBe(10);
    const board = startChartFromGameExpectations(view);
    expect(board.players[0].gameExpectation?.startParticipation?.revisionId).toBe("synthetic-start");
    expect(board.gameExpectations?.expiresAt).toBe(start.expiresAt);
    expect(board.players[0].gameExpectation?.targets.SAVES_GOALIE.participation?.model?.version)
      .toBe(`goalie-${method}-appearance-frequency-v1`);
    const resolved = resolvePlanningContributions({ ...data, context: { ...scope, asOf: now.toISOString() } });
    expect(resolved.forecasts[0].confirmedStart).toBe(false);
    expect(read(JSON.parse(JSON.stringify(resolved))).players[0].games[0].startProbability).toBe(0.25);
    const refreshed = read({ ...data, ...resolved, participationSources: [appearance] }).players[0].games[0];
    expect(refreshed.startProbability).toBeNull(); expect(refreshed.targets.SAVES_GOALIE.expected).toBe(10);
    for (const kind of ["revoked", "expired", "identity", "permission", "duplicate", "event", "ratio"]) {
      const changed = structuredClone(data), row = changed.participationSources![1];
      if (kind === "revoked") changed.participationSources = [appearance];
      if (kind === "expired") row.expiresAt = now.toISOString();
      if (kind === "identity") row.nhlPlayerId++;
      if (kind === "permission") row.allowedUses!.totals = false;
      if (kind === "duplicate") changed.participationSources!.push(structuredClone(row));
      if (kind === "event") row.model!.event = "positive_minutes";
      if (kind === "ratio") row.probability = 0.3;
      const invalid = read(changed).players[0].games[0];
      expect(invalid.startProbability, kind).toBeNull();
      expect(invalid.targets.SAVES_GOALIE.expected, kind).toBe(10);
    }
    const expired = read(data, new Date(start.expiresAt)).players[0].games[0];
    expect(expired.startProbability).toBeNull(); expect(expired.targets.SAVES_GOALIE.expected).toBe(10);
    const raw = { ...data, baselineSources: undefined, participationSources: [],
      forecasts: [{ ...detail(data, 0, { SAVES_GOALIE: 10 }, 0.6),
        startParticipation: { ...start, released: false, expiresAt: now.toISOString() } }] };
    const rawView = read(raw).players[0].games[0];
    expect(rawView.startProbability).toBe(0.6); expect(rawView.startParticipation).toBeUndefined();
    const competingRaw = structuredClone(raw);
    competingRaw.players.push({ ...data.players[0], id: "8", nhlId: 88 });
    competingRaw.forecasts.push({ ...competingRaw.forecasts[0], playerId: "8",
      issuedContext: { ...competingRaw.forecasts[0].issuedContext!, playerId: "8", nhlPlayerId: 88 } });
    const rawConflict = read(competingRaw);
    expect(rawConflict.players.every(player => player.games[0].startProbability === null)).toBe(true);
    expect(rawConflict.players.every(player => player.games[0].targets.SAVES_GOALIE.expected === null)).toBe(true);
    const teammate = { ...data.players[0], id: "8", nhlId: 88 }; data.players.push(teammate);
    data.participationSources.push({ ...start, playerId: 8, nhlPlayerId: 88, probability: 1,
      model: { ...start.model!, numerator: 4 }, revisionId: "synthetic-competing-start" });
    const conflict = read().players[0].games[0];
    expect(conflict.startProbability).toBeNull(); expect(conflict.targets.SAVES_GOALIE.expected).toBe(10);
  });
  it("reuses the existing seasonal evaluator through local preview and the shared view on one original revision", () => {
    const data = fixture(), game = data.games[0];
    const binding = { playerId: 7, nhlPlayerId: 77, seasonId: 20262027, teamId: 1, gameId: Number(game.id),
      scheduledAt: game.startsAt!, scheduleRevision: game.scheduleRevision!, rosterRevision: "roster-a",
      opponentTeamId: 2, isHome: true, observedAt: "2026-10-15T11:00:00Z" };
    const reviewedScope = { seasonId: 20262027, scheduleRevision: game.scheduleRevision!,
      games: [{ gameId: Number(game.id), scheduledAt: game.startsAt! }], players: [binding] };
    const preview = previewSeasonBaseline(seasonArtifact(), [binding], reviewedScope, "2026-10-15T22:00:00Z", now);
    const candidate = preview.candidates[0];
    expect(preview.publicUsesApproved).toBe(false);
    expect(candidate.forecast.stats).toMatchObject({ GOALS: 1, ASSISTS: 1, POINTS: 2, PENALTY_MINUTES: 2, TIME_ON_ICE_PER_GAME: 10, SHOTS_ON_GOAL: null });
    expect(candidate.forecast.conditionalStats).toMatchObject({ GOALS: 2, TIME_ON_ICE_PER_GAME: 20 });
    data.forecasts = [candidate.forecast];
    expect(buildGameExpectations(data, { ...scope, games: 1 }, now).players[0].totals.GOALS.expected).toBeNull();
    // Synthetic approval only exercises downstream compatibility; the preview never grants this permission.
    data.forecasts[0] = { ...candidate.forecast, allowedUses: uses };
    const target = buildGameExpectations(data, { ...scope, games: 1 }, now).players[0].games[0].targets.GOALS;
    expect(target).toMatchObject({ expected: 1, conditional: 2, sourceIds: [candidate.forecast.revisionId],
      sourceWatermarks: [candidate.artifactChecksum], cutoffAt: "2026-10-15T10:00:00Z", issuedAt: now.toISOString() });
    expect(candidate.missingTargets.some(row => row.targetKey === "SHOTS_ON_GOAL")).toBe(true);
    const unknown = seasonArtifact(); unknown.players["7"].playProbability = undefined as never;
    expect(previewSeasonBaseline(unknown, [binding], reviewedScope, "2026-10-15T22:00:00Z", now).candidates[0].forecast.stats.GOALS).toBeNull();
    expect(() => previewSeasonBaseline(seasonArtifact(), [{ ...binding, nhlPlayerId: 88 }], reviewedScope, "2026-10-15T22:00:00Z", now)).toThrow();
    const goalie = seasonArtifact();
    Object.assign(goalie.players["7"], { population: "goalie", position: "G", startProbability: 0.4,
      conditionalRates: { TOTAL_TOI: 3600, SHOTS_AGAINST_GOALIE: 30, GOALS_AGAINST_GOALIE: 3, WINS_GOALIE: 0.4, SHUTOUTS_GOALIE: 0.1 } });
    const preparedGoalie = () => previewSeasonBaseline(goalie, [binding], reviewedScope, "2026-10-15T22:00:00Z", now).candidates[0].forecast;
    data.players[0].playerClass = "goalie";
    data.forecasts = [{ ...preparedGoalie(), allowedUses: uses }];
    const goalieView = buildGameExpectations(data, { ...scope, games: 1 }, now).players[0];
    expect(goalieView.games[0]).toMatchObject({ appearanceProbability: 0.5, startProbability: 0.4 });
    expect(goalieView.totals.GOALIE_MINUTES.expected).toBe(30);
    expect(goalieView.totals.SAVES_GOALIE.expected).toBe(13.5);
    expect(goalieView.ratios.SAVE_PERCENTAGE.value).toBeCloseTo(0.9);
    expect(goalieView.ratios.GOALS_AGAINST_AVERAGE.value).toBeCloseTo(3);
    delete goalie.players["7"].conditionalRates.TOTAL_TOI;
    delete goalie.players["7"].startProbability;
    expect(preparedGoalie()).toMatchObject({ startProbability: null, stats: { GOALIE_MINUTES: null } });
    goalie.players["7"].conditionalRates.GOALS_AGAINST_GOALIE = 31;
    goalie.players["7"].playProbability = 0;
    expect(preparedGoalie).toThrow(/consistency/);
  });
  it("accepts up to twenty scheduled team games while preserving read-window bounds", () => {
    const query = { seasonId: "20262027", startDate: "2026-10-15", endDate: "2026-12-13", timeZone: "UTC", games: "20" };
    expect(parseGameExpectationScope(query, now).games).toBe(20);
    expect(() => parseGameExpectationScope({ ...query, games: "21" }, now)).toThrow(/1–20/);
    expect(() => parseGameExpectationScope({ ...query, games: "1.5" }, now)).toThrow();
    expect(() => parseGameExpectationScope({ ...query, endDate: "2026-12-14" }, now)).toThrow(/bound/);
    expect(() => parseGameExpectationScope({ ...query, mode: "calendar" }, now)).toThrow(/bound/);
  });
  it("counts twenty scheduled games independently of appearances and withholds incomplete or expired targets", () => {
    const data = fixture();
    data.games = Array.from({ length: 21 }, (_, i) => {
      const date = new Date(Date.parse("2026-10-15T23:00:00Z") + i * 2 * 86400000).toISOString();
      return { ...data.games[0], id: String(30 + i), date: date.slice(0, 10), startsAt: date, scheduleRevision: `schedule-${i}` };
    });
    data.forecasts = data.games.map((_, i) => detail(data, i, { SHOTS_ON_GOAL: 2 }, 0.5));
    const longScope = { ...scope, endDate: "2026-12-01", games: 20 };
    const complete = buildGameExpectations(data, longScope, now).players[0];
    expect(complete.scheduledOpportunities).toBe(20);
    expect(complete.games.at(-1)?.gameId).toBe("49");
    expect(complete.expectedAppearances).toBeNull();
    expect(complete.totals.SHOTS_ON_GOAL).toMatchObject({ expected: null, requiredGames: 20, coveredGames: 7, coveredSum: 14 });
    expect(complete.games[19].targets.SHOTS_ON_GOAL.limitations.join(" ")).toContain("outside the declared calendar policy");
    // A next-N request must preserve the producer's shorter admitted calendar policy.
    data.forecasts[6].stats.SHOTS_ON_GOAL = null;
    const missing = buildGameExpectations(data, longScope, now).players[0];
    expect(missing.totals.SHOTS_ON_GOAL).toMatchObject({ expected: null, coveredSum: 12, coveredGames: 6, reason: "incomplete_target" });
    data.forecasts[0].expiresAt = now.toISOString();
    expect(buildGameExpectations(data, longScope, now).players[0].games[0].targets.SHOTS_ON_GOAL.expected).toBeNull();
    data.forecasts[1].cutoffAt = "2026-10-15T12:00:01Z";
    expect(buildGameExpectations(data, longScope, now).players[0].games[1].targets.SHOTS_ON_GOAL.expected).toBeNull();
    expect(() => buildGameExpectations(data, { ...longScope, games: 21 }, now)).toThrow();
  });
  it("reads per-game modeled baseline expectations consistently across next-N/calendar and preserves calibration/permissions", () => {
    const data = fixture(); data.baselineSources = [baseline({ policyVersion: "skater-baseline-rates-v1" })];
    data.participationSources = data.games.map((game, i): ContributionParticipation => ({
      playerId: 7, nhlPlayerId: 77, seasonId: 20262027, teamId: 1, gameId: Number(game.id), scheduledAt: game.startsAt!,
      scheduleRevision: game.scheduleRevision!, rosterRevision: "roster-a", basis: "appearance", probability: (i + 1) / 2,
      revisionId: `participation:fixture-${i}`, released: true, allowedUses: uses,
      cutoffAt: "2026-10-15T10:00:00Z", issuedAt: "2026-10-15T11:00:00Z", expiresAt: "2026-10-15T18:00:00Z",
      model: { version: "skater-participation-frequency-v1", event: "positive_minutes", calibration: "unavailable",
        probabilityStatus: "uncalibrated_model", inputHash: "a".repeat(64), evidenceHashes: ["b".repeat(64)],
        numerator: i + 1, denominator: 2, selectedGameIds: [10, 11], limitations: ["Synthetic-only model estimate; not confirmation."] } }));
    const player = buildGameExpectations(data, scope, now).players[0];
    expect(player.totals.SHOTS_ON_GOAL.expected).toBe(6); expect(player.expectedAppearances).toBe(1.5);
    expect(player.games.map(game => game.targets.SHOTS_ON_GOAL.expected)).toEqual([2, 4]);
    const target = player.games[0].targets.SHOTS_ON_GOAL;
    expect(target.participation?.model).toMatchObject({ probabilityStatus: "uncalibrated_model", calibration: "unavailable", sampleSize: 2 });
    expect(target.participation?.model).not.toHaveProperty("numerator");
    expect(target.participation?.model).not.toHaveProperty("selectedGameIds");
    expect(buildGameExpectations(data, { ...scope, mode: "calendar" }, now).players[0].games).toEqual(player.games);
    data.participationSources[0].allowedUses = { ...uses, totals: false };
    const denied = buildGameExpectations(data, scope, now).players[0].games[0].targets.SHOTS_ON_GOAL;
    expect(denied.expected).toBeNull(); expect(denied.participation?.probability).toBeNull();
    expect(denied.participation?.model?.sampleSize).toBeNull();
    data.participationSources = data.participationSources.slice(0, 1);
    expect(buildGameExpectations(data, scope, now).players[0].totals.SHOTS_ON_GOAL.expected).toBeNull();
  });
  it("sums unequal game forecasts, retains original clocks, and never treats opportunities as appearances", () => {
    const data = fixture();
    data.forecasts = [detail(data, 0, { SHOTS_ON_GOAL: 3 }, 0.75), detail(data, 1, { SHOTS_ON_GOAL: 8 }, 0.5)];
    data.games.reverse();
    const result = buildGameExpectations(data, scope, now), player = result.players[0];
    expect(player.games.map(game => game.gameId)).toEqual(["30", "31"]);
    expect(player.totals.SHOTS_ON_GOAL).toMatchObject({ expected: 11, coveredGames: 2, requiredGames: 2 });
    expect(player.scheduledOpportunities).toBe(2); expect(player.expectedAppearances).toBe(1.25);
    expect(player.games[0].targets.SHOTS_ON_GOAL).toMatchObject({ issuedAt: "2026-10-15T11:00:00Z", cutoffAt: "2026-10-15T10:00:00Z", sourceIds: ["issued-0"] });
    expect(result.readAsOf).toBe(now.toISOString());
    expect(player.totals.PP_POINTS.expected).toBeNull();
  });
  it("keeps a released baseline conditional with unknown participation, without inventing a revision or total", () => {
    const data = fixture(); data.baselineSources = [baseline()];
    const player = buildGameExpectations(data, scope, now).players[0];
    expect(player.games[0].targets.SHOTS_ON_GOAL).toMatchObject({ expected: null, conditional: 4, basis: "per_appearance",
      sourceKind: "baseline", sourceIds: ["baseline-fixture"], methodVersions: ["native-rate-fixture-v1"], sourceWatermarks: ["native-input-hash"],
      issuedAt: "2026-10-15T09:10:00Z", cutoffAt: "2026-10-15T09:00:00Z", participationRevisionId: null });
    expect(player.games[0].targets.SHOTS_ON_GOAL.reasons).toContain("missing_participation");
    expect(player.expectedAppearances).toBeNull(); expect(player.totals.SHOTS_ON_GOAL.expected).toBeNull();
    expect(player.games[0].targets.GOALS.sourceIds).toEqual([]);
    expect(player.games[0].targets.GOALS.issuedAt).toBeNull();
  });
  it("retains the baseline's original issue separately from a later participation receipt", () => {
    const data = fixture(); data.baselineSources = [baseline()];
    data.forecasts = [detail(data, 0, { GOALS: 1 }, 0.5)];
    const target = buildGameExpectations(data, { ...scope, games: 1 }, now).players[0].games[0].targets.SHOTS_ON_GOAL;
    expect(target.expected).toBe(2); expect(target.conditional).toBe(4);
    expect(target.sources).toMatchObject([{ sourceId: "baseline-fixture", issuedAt: "2026-10-15T09:10:00Z" }]);
    expect(target.participation).toMatchObject({ issuedAt: "2026-10-15T11:00:00Z", probability: 0.5 });
    expect(target.issuedAt).toBe("2026-10-15T11:00:00Z");
  });
  it("uses catalog expiry for shared consumers while preserving original source expiry", () => {
    const catalogExpiresAt = "2026-10-15T13:00:00Z", data = fixture();
    data.baselineSources = [baseline({ catalogExpiresAt })];
    data.forecasts = [detail(data, 0, { GOALS: 1 }, 0.5)];
    const response = buildGameExpectations(data, { ...scope, games: 1 }, now);
    const target = response.players[0].games[0].targets.SHOTS_ON_GOAL;
    expect(target.expiresAt).toBe(catalogExpiresAt);
    expect(target.sources[0].expiresAt).toBe("2026-10-20T12:00:00Z");
    expect(startChartFromGameExpectations(response).gameExpectations?.expiresAt).toBe(catalogExpiresAt);
    const resolved = resolvePlanningContributions({ ...data, context: { ...scope, asOf: now.toISOString() } });
    expect(resolved.forecasts[0].expiresAt).toBe(catalogExpiresAt);
    expect(decodeGameExpectationView(buildGameExpectationView(response))).toEqual(response);
    const expired = buildGameExpectations(data, { ...scope, games: 1 }, new Date(catalogExpiresAt))
      .players[0].games[0].targets.SHOTS_ON_GOAL;
    expect(expired.expected).toBeNull(); expect(expired.conditional).toBeNull();
    expect(expired.allowedUses.totals).toBe(false);
  });
  it.each(["skater", "goalie"] as const)("retains explicit %s PP-role missingness across shared and RSO snapshot transport", playerClass => {
    const data = fixture(); data.players[0].playerClass = playerClass;
    data.forecasts = [detail(data, 0, { GOALS: 1, PP_POINTS: 1 })];
    const shared = buildGameExpectations(data, { ...scope, games: 1 }, now);
    const resolved = resolvePlanningContributions({ ...data, context: { ...scope, asOf: now.toISOString() } });
    const role = playerClass === "goalie"
      ? { value: null, status: "not_applicable", reason: "not_applicable", source: null }
      : { value: null, status: "unavailable", reason: "current_role_evidence_unavailable", source: null };
    expect(shared.players[0].games[0].powerPlayRole).toEqual(role);
    expect(resolved.forecasts[0].powerPlayRole).toEqual(role);
    const restored = decodePlanningDataTransport(JSON.parse(JSON.stringify(encodePlanningDataTransport({ ...data,
      forecasts: resolved.forecasts }))));
    expect(restored.forecasts[0].powerPlayRole).toEqual(role);
    expect(JSON.parse(JSON.stringify(resolved)).forecasts[0].powerPlayRole).toEqual(role);
    const malformed = JSON.parse(JSON.stringify(encodePlanningDataTransport({ ...data, forecasts: resolved.forecasts })));
    malformed.data.forecasts[0].powerPlayRole.value = "PP1";
    expect(() => decodePlanningDataTransport(malformed)).toThrow("Invalid planning response");
  });
  it("withholds participation probability without totals permission while retaining its receipt clocks", () => {
    const data = fixture(); data.baselineSources = [baseline()];
    data.forecasts = [detail(data, 0, { GOALS: 1 }, 0.5)];
    data.forecasts[0].allowedUses = { ...uses, totals: false };
    const player = buildGameExpectations(data, { ...scope, games: 1 }, now).players[0];
    expect(player.games[0].targets.SHOTS_ON_GOAL.participation)
      .toMatchObject({ probability: null, issuedAt: "2026-10-15T11:00:00Z" });
    expect(player.games[0].appearanceProbability).toBeNull();
  });
  it.each(["unreleased", "expired", "wrong_roster", "unapproved"])("withholds %s baseline values", reason => {
    const data = fixture();
    data.baselineSources = [baseline(reason === "unreleased" ? { released: false } : reason === "expired"
      ? { expiresAt: now.toISOString() } : reason === "wrong_roster" ? { rosterRevision: "other" }
        : { allowedUses: { assignment: false, totals: false, comparison: false, conditionalTieBreak: false } })];
    const row = buildGameExpectations(data, scope, now).players[0].games[0].targets.SHOTS_ON_GOAL;
    expect(row.expected).toBeNull(); expect(row.conditional).toBeNull();
  });
  it("withholds a full target total if any selected game is missing, while reporting partial coverage", () => {
    const data = fixture(); data.forecasts = [detail(data, 0, { SHOTS_ON_GOAL: 3 })];
    expect(buildGameExpectations(data, scope, now).players[0].totals.SHOTS_ON_GOAL)
      .toEqual({ expected: null, coveredSum: 3, coveredGames: 1, requiredGames: 2, unit: "count", reason: "incomplete_target" });
    const short = buildGameExpectations(data, { ...scope, games: 3 }, now).players[0];
    expect(short.horizonComplete).toBe(false); expect(short.totals.SHOTS_ON_GOAL.expected).toBeNull();
  });
  it("uses the same game expectations in next-game and selected calendar views", () => {
    const data = fixture(); data.forecasts = [detail(data, 0, { SHOTS_ON_GOAL: 3 }), detail(data, 1, { SHOTS_ON_GOAL: 8 })];
    const next = buildGameExpectations(data, { ...scope, games: 1 }, now).players[0];
    const day = buildGameExpectations(data, { ...scope, mode: "calendar", endDate: scope.startDate }, now).players[0];
    expect(next.games).toEqual(day.games); expect(next.totals).toEqual(day.totals);
  });
  it("forms goalie ratios from summed primitives, never from averaged game ratios", () => {
    const data = fixture(); data.players[0].playerClass = "goalie";
    data.forecasts = [detail(data, 0, { SAVES_GOALIE: 18, SHOTS_AGAINST_GOALIE: 20, GOALS_AGAINST_GOALIE: 2, GOALIE_MINUTES: 60 }),
      detail(data, 1, { SAVES_GOALIE: 38, SHOTS_AGAINST_GOALIE: 40, GOALS_AGAINST_GOALIE: 2, GOALIE_MINUTES: 30 })];
    const player = buildGameExpectations(data, scope, now).players[0];
    expect(player.ratios.SAVE_PERCENTAGE.value).toBeCloseTo(56 / 60);
    expect(player.ratios.GOALS_AGAINST_AVERAGE.value).toBeCloseTo(60 * 4 / 90);
    data.forecasts[1].stats.GOALIE_MINUTES = null;
    expect(buildGameExpectations(data, scope, now).players[0].ratios.GOALS_AGAINST_AVERAGE.value).toBeNull();
  });
  it("rejects duplicate games and forecast revisions instead of double counting", () => {
    const data = fixture(); data.games.push({ ...data.games[0] });
    expect(() => buildGameExpectations(data, scope, now)).toThrow(/Duplicate/);
    data.games.pop(); data.forecasts = [detail(data, 0, { SHOTS_ON_GOAL: 3 })]; data.forecasts.push({ ...data.forecasts[0] });
    expect(() => buildGameExpectations(data, scope, now)).toThrow(/Conflicting/);
  });
  it("withholds full horizons when schedule evidence or start times are incomplete", () => {
    const data = fixture(); data.forecasts = [detail(data, 0, { SHOTS_ON_GOAL: 3 })];
    data.games[1].startsAt = null;
    let player = buildGameExpectations(data, { ...scope, mode: "calendar" }, now).players[0];
    expect(player.horizonComplete).toBe(false); expect(player.totals.SHOTS_ON_GOAL.expected).toBeNull();
    data.games.pop(); data.evidence.schedule.completeness = "partial";
    player = buildGameExpectations(data, { ...scope, mode: "calendar" }, now).players[0];
    expect(player.horizonComplete).toBe(false); expect(player.totals.SHOTS_ON_GOAL.coveredSum).toBe(3);
  });
  it("retains admitted penalty-minute units in the aggregate", () => {
    const data = fixture(); data.baselineSources = [baseline()];
    data.forecasts = [detail(data, 0, { PENALTY_MINUTES: 2 }), detail(data, 1, { PENALTY_MINUTES: 3 })];
    const player = buildGameExpectations(data, scope, now).players[0];
    expect(player.games[0].targets.PENALTY_MINUTES.unit).toBe("minutes");
    expect(player.totals.PENALTY_MINUTES).toMatchObject({ expected: 5, unit: "minutes" });
  });
});

describe("bounded browser expectation delivery", () => {
  it("preserves values, unknowns, permissions, ratio estimands and original clocks while keeping proofs server-side", () => {
    const data = fixture(); data.forecasts = [detail(data, 0, { SHOTS_ON_GOAL: 2 })];
    const raw = buildGameExpectations(data, scope, now), target = raw.players[0].games[0].targets.SHOTS_ON_GOAL;
    target.participation = { revisionId: "display-fixture", basis: "appearance", probability: 0.5,
      cutoffAt: "2026-10-15T09:00:00.123456Z", issuedAt: "2026-10-15T10:00:00.123456Z", expiresAt: "2026-10-15T18:00:00.123456Z",
      model: { version: "skater-participation-frequency-v1", event: "positive_minutes", probabilityStatus: "uncalibrated_model",
        calibration: "unavailable", sampleSize: 2, inputHash: "private-input-proof", evidenceHashes: ["private-evidence-proof"], limitations: ["Uncalibrated fixture."] } };
    raw.players[0].games[0].startParticipation = { ...target.participation, basis: "start", revisionId: "separate-start" };
    const encoded = buildGameExpectationView(raw), decoded = decodeGameExpectationView(JSON.parse(JSON.stringify(encoded)));
    expect(decoded).toEqual(JSON.parse(JSON.stringify(raw, (key, value) => key === "inputHash" || key === "evidenceHashes" ? undefined : value)));
    expect(JSON.stringify(encoded)).not.toContain("private-input-proof");
    expect(JSON.stringify(encoded)).not.toContain("private-evidence-proof");
    expect(target.participation.model?.inputHash).toBe("private-input-proof");
    expect(decoded.players[0].games[0].targets.GOALS.expected).toBeNull();
    expect(decoded.players[0].games[1].targets.SHOTS_ON_GOAL.allowedUses.totals).toBe(false);
    expect(decoded.players[0].games[1].targets.SHOTS_ON_GOAL.expected).toBeNull();
    expect(decoded.players[0].totals.SHOTS_ON_GOAL.expected).toBeNull();
    expect(decoded.players[0].games[0].targets.SHOTS_ON_GOAL.participation?.expiresAt).toBe("2026-10-15T18:00:00.123456Z");
    expect(encoded.catalogs.targets.length).toBeLessThan(18);
  });
  it.each(["version", "schedule", "roster", "targets", "source", "participation", "limitations", "aggregate", "clock", "proof", "missing target", "duplicate game", "missing aggregate", "extra ratio", "metadata", "revision", "model"])("rejects malformed %s instead of filling missing references", kind => {
    const data = fixture(); data.forecasts = [detail(data, 0, { SHOTS_ON_GOAL: 2 })];
    const encoded: any = buildGameExpectationView(buildGameExpectations(data, scope, now));
    if (kind === "version") encoded.version = "unknown-v2";
    if (kind === "schedule") encoded.players[0].games[0][0] = 999999;
    if (kind === "roster") encoded.players[0].games[0][1] = -1;
    if (kind === "targets") encoded.players[0].games[0][6] = 999999;
    if (kind === "metadata") encoded.catalogs.targets[0][0] = 999999;
    if (kind === "revision") encoded.catalogs.targets[0][2] = 999999;
    if (kind === "model") {
      encoded.catalogs.revisions.push("fixture-model");
      encoded.catalogs.participation.push({ revisionId: encoded.catalogs.revisions.length - 1, basis: "appearance", probability: null, cutoffAt: now.toISOString(), issuedAt: now.toISOString(), expiresAt: now.toISOString(), model: 999999 });
    }
    if (kind === "source") encoded.catalogs.targetMetadata[0].sources = [999999];
    if (kind === "participation") encoded.catalogs.targets[0][1] = 999999;
    if (kind === "limitations") encoded.limitations = 999999;
    if (kind === "aggregate") encoded.players[0].aggregate = 999999;
    if (kind === "clock") encoded.catalogs.sources[0].expiresAt = "not-a-clock";
    if (kind === "proof") encoded.catalogs.targetMetadata[0].inputHash = "unexpected-proof";
    if (kind === "missing target") delete encoded.catalogs.targetSets[0].GOALS;
    if (kind === "duplicate game") encoded.players[0].games[1] = encoded.players[0].games[0];
    if (kind === "missing aggregate") delete encoded.catalogs.aggregates[0].totals.GOALS;
    if (kind === "extra ratio") encoded.catalogs.aggregates[0].ratios.UNSUPPORTED = { value: null, numerator: "G", denominator: "A", interpretation: "ratio_of_expected_totals", reason: "missing" };
    expect(() => decodeGameExpectationView(encoded)).toThrow("Invalid forecast display response");
  });
  it("preserves explicit unknown start participation separately from an absent receipt", () => {
    const raw = buildGameExpectations(fixture(), scope, now);
    raw.players[0].games[0].startParticipation = null;
    expect(decodeGameExpectationView(buildGameExpectationView(raw))).toEqual(raw);
    expect(raw.players[0].games[1]).not.toHaveProperty("startParticipation");
  });
  it("bounds the complete JSON envelope including its success wrapper", () => {
    const raw = buildGameExpectations(fixture(), scope, now);
    const initial = JSON.stringify({ success: true, data: buildGameExpectationView(raw) });
    raw.players[0].name += "x".repeat(GAME_EXPECTATION_VIEW_LIMITS.bytes - new TextEncoder().encode(initial).byteLength);
    const exact = buildGameExpectationView(raw);
    expect(new TextEncoder().encode(JSON.stringify({ success: true, data: exact })).byteLength).toBe(GAME_EXPECTATION_VIEW_LIMITS.bytes);
    expect(decodeGameExpectationView(exact).players[0].name).toBe(raw.players[0].name);
    raw.players[0].name += "x";
    expect(() => buildGameExpectationView(raw)).toThrow(GameExpectationViewLimitError);
    exact.players[0].name += "x";
    expect(() => decodeGameExpectationView(exact)).toThrow(GameExpectationViewLimitError);
  });
  it("reports a capacity failure without trimming any player", () => {
    const raw = buildGameExpectations(fixture(), scope, now);
    raw.players = Array.from({ length: GAME_EXPECTATION_VIEW_LIMITS.players + 1 }, () => raw.players[0]);
    expect(() => buildGameExpectationView(raw)).toThrow(GameExpectationViewLimitError);
  });
  it("keeps catalog capacity above the v1 per-game participation scale", () => {
    // v1 is about 1,050 covered player-games × 9 skater targets, each with its own revision.
    const raw = buildGameExpectations(fixture(), scope, now), [game] = raw.players[0].games;
    raw.players[0].games = Array.from({ length: 1400 }, (_, index) => ({ ...game, gameId: String(10000 + index), targets: Object.fromEntries(
      Object.entries(game.targets).map(([key, target]) => [key, { ...target, participationRevisionId: `participation-${index}-${key}` }])) }));
    raw.players[0].scheduledOpportunities = raw.players[0].games.length;
    const view = buildGameExpectationView(raw);
    expect(view.catalogs.revisions.length).toBeGreaterThan(10000);
    expect(view.catalogs.revisions.length).toBeLessThanOrEqual(GAME_EXPECTATION_VIEW_LIMITS.catalogEntries);
    expect(decodeGameExpectationView(JSON.parse(JSON.stringify(view)))).toEqual(raw);
  });
});
