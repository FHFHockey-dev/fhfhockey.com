import { describe, expect, it } from "vitest";
import { buildGameExpectations, type GameExpectationScope } from "./gameExpectations";
import type { ContributionParticipation, ContributionSource } from "./contributions";
import type { GameForecast, PlanningData } from "../rosterScheduleOptimizer/planningTypes";

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
