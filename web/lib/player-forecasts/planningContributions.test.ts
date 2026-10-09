import { afterEach, describe, expect, it, vi } from "vitest";
import { resolvePlanningContributions } from "./planningContributions";
import { inspectCalendarConsumerCoverage, parseCalendarCoverageProfile, summarizeCalendarConsumerCoverage } from "./calendarCoverage";
import * as publicPlanning from "../rosterScheduleData/planning";
import type { PlayerForecastCalendarScope } from "./schedule";
import { forecastCalendarPolicy, type ContributionSource } from "./contributions";
import type { GameForecast, PlanningSnapshot } from "../rosterScheduleOptimizer/planningTypes";
import { buildForgeCalendarManifest, parseForgeCalendarArgs } from "../../scripts/run-forge-calendar-local";

const now = "2026-09-29T00:00:00Z";
const rate: ContributionSource = {
  kind: "baseline", sourceId: "baseline-old", policyVersion: "rate-v1", released: true,
  allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: true },
  playerId: 7, nhlPlayerId: 77, seasonId: 20262027, teamId: 1,
  targetKey: "GOALS", unit: "count", basis: "per_appearance", mean: 1,
  participationIntegrated: false, cutoffAt: "2026-09-27T00:00:00Z",
  issuedAt: "2026-09-28T00:00:00Z", expiresAt: "2026-10-10T00:00:00Z",
  sourceWatermark: "w", scheduleRevision: "schedule-a", rosterRevision: "roster-a",
};
const issuedContext: NonNullable<GameForecast["issuedContext"]> = {
  version: "forge-issued-context-v1", playerId: "7", gameId: "30", nhlPlayerId: 77,
  seasonId: 20262027, teamId: 1, scheduledAt: "2026-10-08T23:00:00Z",
  scheduleRevision: "schedule-a", rosterRevision: "roster-a", observedAt: "2026-09-28T11:30:00Z",
  scheduleSourceUpdatedAt: "2026-09-28T10:00:00Z", scheduleFetchedAt: "2026-09-28T11:00:00Z",
  identityUpdatedAt: "2026-09-27T00:00:00Z", membershipCreatedAt: ["2026-09-01T00:00:00Z"],
};

function fixture(baselines: ContributionSource[], forecasts: GameForecast[] = []): PlanningSnapshot {
  return {
    id: "fixture", context: { provider: "manual", seasonId: 20262027, leagueId: "l", teamId: "t",
      startDate: "2026-10-08", endDate: "2026-10-08", timeZone: "UTC", asOf: now },
    players: [{ id: "7", nhlId: 77, nhlTeamId: 1, rosterRevision: "roster-a", name: "Player",
      teamAbbreviation: "MIN", eligiblePositions: ["LW"], playerClass: "skater",
      availability: "unknown", ownership: null, canDrop: null, holdValue: null,
      reserveEligibility: [] }],
    games: [{ id: "30", date: "2026-10-08", startsAt: "2026-10-08T23:00:00Z",
      teamAbbreviation: "MIN", opponent: "TOR", home: true, status: "scheduled",
      scheduleRevision: "schedule-a" }],
    forecasts, baselineSources: baselines, roster: [], rules: {} as PlanningSnapshot["rules"],
    lockedAssignments: [], realized: {}, opponent: null, evidence: {},
  };
}

function detailed(overrides: Partial<GameForecast> = {}): GameForecast {
  return { sourceKind: "detailed", sourceWatermark: "captured-reads", issuedContext, playerId: "7", gameId: "30", stats: { GOALS: 1 },
    conditionalStats: { GOALS: 2 }, appearanceProbability: 0.5,
    conditioning: "unconditional", startProbability: null, confirmedStart: false,
    allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: true },
    revisionId: "detail-1", issuedAt: "2026-09-28T12:00:00Z",
    cutoffAt: "2026-09-28T11:00:00Z", expiresAt: "2026-10-09T00:00:00Z",
    modelVersion: "forge-v1", limitations: [], ...overrides };
}

function calendarManifestFixture() {
  const options = parseForgeCalendarArgs(["--game-ids", "30", "--skater-targets", "GOALS", "--out", "/tmp/calendar",
    "--artifact", "/tmp/code.json"]);
  const data = fixture([], [detailed()]);
  data.players.push({ ...data.players[0], id: "8", nhlId: 88, nhlTeamId: 2, teamAbbreviation: "TOR", rosterRevision: "roster-b" });
  data.games.push({ ...data.games[0], teamAbbreviation: "TOR", opponent: "MIN", home: false, scheduleRevision: "schedule-b" });
  data.forecasts.push(detailed({ playerId: "8", issuedContext: { ...issuedContext, playerId: "8", nhlPlayerId: 88,
    teamId: 2, scheduleRevision: "schedule-b", rosterRevision: "roster-b" } }));
  data.forecastManifest = { version: "planning-forecasts-v1", id: "scope-snapshot", calendarPolicy: forecastCalendarPolicy(),
    seasonId: 20262027, asOf: now, scheduleRevision: "schedule", rosterRevision: "roster", issuedRevisionIds: ["detail-1"],
    baselineChecksum: null, requiredOpportunities: 2, forecastedOpportunities: 2, exclusionCounts: {} };
  data.evidence = Object.fromEntries(["schedule", "identities"].map(key => [key,
    { source: "fixture", asOf: now, completeness: "complete" as const, seasonId: 20262027, limitations: [] }]));
  const scopes: PlayerForecastCalendarScope[] = [1, 2].map(teamId => ({ scopeKey: `game:30:team:${teamId}`,
    gameId: 30, teamId, opponentTeamId: teamId === 1 ? 2 : 1, teamGameHorizon: 1, calendarLeadDay: 9,
    scheduledStartAt: issuedContext.scheduledAt, gameDate: "2026-10-08", seasonId: 20262027, homeTeamId: 1, awayTeamId: 2,
    queueCompatible: true, teamAbbreviation: teamId === 1 ? "MIN" : "TOR", scheduleRevision: teamId === 1 ? "schedule-a" : "schedule-b" }));
  return { options, data, now: new Date(now), origin: "https://db.example", deadlineMs: Date.parse(now) + 600000,
    requests: { reads: 5, writes: 0 }, artifact: { codeVersion: `local:${"a".repeat(64)}`, contentHash: "b".repeat(64) },
    revisions: [{ id: "detail-1", game_id: 30, published_at: "2026-09-28T12:00:00Z" }],
    calendar: { calendarDays: 14, calendarPolicy: forecastCalendarPolicy(), scopes, workload: [],
      queueCompatibleScopes: 2, queueIncompatibleScopes: 0, dryRun: true as const,
      scheduleCoverage: { readStatus: "complete" as const, discoveredGames: 1, eligibleGames: 1,
        excludedGames: [], staleGameIds: [] as number[], sourceWatermark: "schedule-source" } } };
}

describe("local calendar scope manifest", () => {
  it("binds current detailed competitor coverage, prior revisions, policy, expiry and artifact without granting execution", async () => {
    const args = calendarManifestFixture();
    const manifest = await buildForgeCalendarManifest(args);
    expect(manifest).toMatchObject({ mode: "read_only", allowedActions: ["inspect"], consistency: "bounded_independent_reads",
      recommendationReadiness: "not_evaluated", games: [{ expectedPriorRevisionId: "detail-1", decision: "skip_eligible_detailed",
        expiresAt: "2026-10-09T00:00:00.000Z", required: [{ playerId: "7", target: "GOALS" }, { playerId: "8", target: "GOALS" }] }] });
    args.data.players.reverse(); args.data.forecasts.reverse(); args.calendar.scopes.reverse();
    expect(await buildForgeCalendarManifest(args)).toEqual(manifest);
    args.artifact.contentHash = "c".repeat(64);
    expect((await buildForgeCalendarManifest(args)).checksum).not.toBe(manifest.checksum);
  });

  it.each(["missing", "expired", "target", "permission", "prior", "schedule", "policy", "disabled", "unmapped"])(
    "does not skip historical issuance with %s evidence", async mode => {
      const args = calendarManifestFixture();
      if (mode === "missing") args.data.forecasts.pop();
      if (mode === "expired") args.data.forecasts[0].expiresAt = now;
      if (mode === "target") args.options.profile.skaterTargets.push("HITS");
      if (mode === "permission") args.data.forecasts[0].allowedUses!.comparison = false;
      if (mode === "prior") args.revisions.push({ id: "newer-unusable", game_id: 30, published_at: "2026-09-28T13:00:00Z" });
      if (mode === "schedule") args.calendar.scheduleCoverage.staleGameIds.push(30);
      if (mode === "policy") args.data.forecastManifest!.calendarPolicy = forecastCalendarPolicy(7);
      if (mode === "disabled") { args.data.forecasts = []; args.data.forecastManifest!.exclusionCounts.serving_disabled = 1; }
      if (mode === "unmapped") args.data.players.push({ ...args.data.players[0], id: "9", nhlId: null, nhlTeamId: undefined });
      const manifest = await buildForgeCalendarManifest(args);
      expect(manifest.games[0].decision).toBe("requires_generation_or_readiness_repair");
      expect(manifest.games[0].expectedPriorRevisionId).not.toBeNull();
    });

  it("retains selected-player requirements without hiding an unforecasted competitor", async () => {
    const args = calendarManifestFixture();
    args.options.playerIds = ["7"];
    args.data.forecasts.pop();
    const game = (await buildForgeCalendarManifest(args)).games[0];
    expect(game.required).toHaveLength(1);
    expect(game.required[0].playerId).toBe("7");
    expect(game.coverage).toMatchObject({ requiredPlayerGameTargets: 2, eligiblePlayerGameTargets: 1 });
    expect(game.decision).toBe("requires_generation_or_readiness_repair");
  });

  it("rejects missing games, changed schedule identities, incomplete player scopes and write receipts", async () => {
    for (const mode of ["game", "schedule", "player", "write", "policy", "requests", "started"]) {
      const args = calendarManifestFixture();
      if (mode === "game") args.options.gameIds.push(31);
      if (mode === "schedule") args.data.games[0].scheduleRevision = "changed";
      if (mode === "player") args.options.playerIds = ["999"];
      if (mode === "write") args.requests.writes = 1;
      if (mode === "policy") args.calendar.calendarPolicy.overlapDays = 6 as 7;
      if (mode === "requests") args.requests.reads = 501;
      if (mode === "started") args.calendar.scopes[0].scheduledStartAt = now;
      await expect(buildForgeCalendarManifest(args)).rejects.toThrow(/scope|schedule|incomplete/i);
    }
  });
});

describe("planning contribution adapter", () => {
  it.each([7, 14, 21])("uses the manifest's %i-day policy with and without a baseline", (days) => {
    const manifest: NonNullable<PlanningSnapshot["forecastManifest"]> = { version: "planning-forecasts-v1",
      id: `policy-${days}`, calendarPolicy: forecastCalendarPolicy(days), seasonId: 20262027, asOf: now,
      scheduleRevision: "schedule-a", rosterRevision: "roster-a", issuedRevisionIds: ["detail-1"],
      baselineChecksum: "rate", requiredOpportunities: 1, forecastedOpportunities: 1, exclusionCounts: {} };
    const expected = days === 7 ? 0.5 : days === 14 ? (1 + 5 / 7) * 0.5 : 1;
    const original = fixture([rate], [detailed()]);
    const fresh = resolvePlanningContributions({ ...original, forecastManifest: manifest });
    const retained = resolvePlanningContributions(original);
    const refreshed = resolvePlanningContributions({ ...retained, forecastManifest: manifest });
    expect(fresh.forecasts[0].stats.GOALS).toBeCloseTo(expected);
    expect(refreshed.forecasts[0].stats.GOALS).toBeCloseTo(expected);
    expect(refreshed.forecasts[0].contributions?.GOALS.inputs?.calendarPolicy).toEqual(manifest.calendarPolicy);
    expect(resolvePlanningContributions(JSON.parse(JSON.stringify(refreshed))).forecasts).toEqual(refreshed.forecasts);
    const raw = resolvePlanningContributions({ ...fixture([], [detailed()]), forecastManifest: manifest });
    expect(raw.forecasts[0].stats.GOALS).toBe(days === 7 ? null : 1);
    if (days === 7) expect(raw.forecastInputExclusions?.[0].reasons).toContain("outside_horizon");
  });
  it("selects the latest usable baseline and keeps conditional rates out of totals", () => {
    const stale = { ...rate, sourceId: "baseline-newer-stale", mean: 9,
      issuedAt: "2026-09-28T23:00:00Z", expiresAt: "2026-09-28T23:30:00Z" };
    const forecast = resolvePlanningContributions(fixture([stale, rate])).forecasts[0];
    expect(forecast.stats.GOALS).toBeNull();
    expect(forecast.tieBreakStats?.GOALS).toBe(1);
    expect(forecast.issuedAt).toBe(rate.issuedAt);
    expect(forecast.expiresAt).toBe(rate.expiresAt);
    expect(forecast.revisionId).toBe(rate.sourceId);
    expect(forecast.contributions?.GOALS.allowedUses.totals).toBe(false);
  });

  it("does not emit a synthetic forecast after every baseline expires", () => {
    const stale = { ...rate, expiresAt: "2026-09-28T23:00:00Z" };
    expect(resolvePlanningContributions(fixture([stale])).forecasts).toEqual([]);
  });

  it("blends conditional detail before applying participation once", () => {
    const forecast = resolvePlanningContributions(fixture([rate], [detailed()])).forecasts[0];
    expect(forecast.sourceKind).toBe("blended");
    expect(forecast.stats.GOALS).toBeCloseTo((1 + 5 / 7) * 0.5);
    expect(forecast.contributions?.GOALS.participationRevisionId).toBe("detail-1:participation");
    expect(forecast.expiresAt).toBe("2026-10-09T00:00:00Z");
    expect(forecast.contributions?.GOALS.inputs?.detailed?.sourceWatermark).toBe("captured-reads");
  });

  it("replays retained blended inputs without multiplying participation or blending twice", () => {
    const original = fixture([rate], [detailed()]);
    const resolved = resolvePlanningContributions(original);
    const retained = JSON.parse(JSON.stringify(resolved)) as PlanningSnapshot;
    expect(retained.baselineSources).toBeUndefined();
    expect(resolvePlanningContributions(retained).forecasts).toEqual(resolved.forecasts);
    retained.forecasts[0].stats.GOALS = 999;
    expect(resolvePlanningContributions(retained).forecasts[0].stats.GOALS).toBeCloseTo((1 + 5 / 7) * 0.5);
    retained.context.asOf = "2026-09-30T00:00:00Z";
    original.context.asOf = retained.context.asOf;
    expect(resolvePlanningContributions(retained).forecasts[0].stats.GOALS)
      .toBe(resolvePlanningContributions(original).forecasts[0].stats.GOALS);
  });

  it("reconciles new targets from a refreshed catalog without changing retained targets", () => {
    const resolved = resolvePlanningContributions(fixture([rate], [detailed()]));
    const assists = { ...rate, targetKey: "ASSISTS", sourceId: "assists-rate", mean: 4 };
    const refreshed = resolvePlanningContributions({ ...resolved, baselineSources: [rate, assists] });
    expect(refreshed.forecasts[0].contributions?.GOALS).toEqual(resolved.forecasts[0].contributions?.GOALS);
    expect(refreshed.forecasts[0].stats.ASSISTS).toBe(2);
    expect(refreshed.forecasts[0].contributions?.ASSISTS.sourceIds).toEqual(["assists-rate"]);
    expect(refreshed.forecasts[0].contributions?.ASSISTS.participationRevisionId).toBe("detail-1:participation");
    expect(resolvePlanningContributions(JSON.parse(JSON.stringify(refreshed))).forecasts).toEqual(refreshed.forecasts);
    expect(resolvePlanningContributions({ ...resolved, baselineSources: [assists, rate] }).forecasts).toEqual(refreshed.forecasts);
    expect(resolvePlanningContributions({ ...resolved, baselineSources: [rate, assists] },
      { playerIds: new Set(["other"]) }).forecasts[0].contributions?.ASSISTS).toBeUndefined();
    const revoked = resolvePlanningContributions({ ...refreshed, baselineSources: [rate] });
    expect(revoked.forecasts[0].stats.ASSISTS).toBeNull();
    expect(revoked.forecasts[0].contributions?.ASSISTS.allowedUses.comparison).toBe(false);
  });

  it("keeps newly added target participation and permissions bounded by the retained evidence", () => {
    const resolved = resolvePlanningContributions(fixture([rate], [detailed({
      expiresAt: "2026-09-30T00:00:00Z",
      allowedUses: { assignment: true, totals: false, comparison: false, conditionalTieBreak: true },
    })]));
    const assists = { ...rate, targetKey: "ASSISTS", sourceId: "assists-rate", mean: 4 };
    const refreshed = resolvePlanningContributions({ ...resolved, baselineSources: [assists] });
    expect(refreshed.forecasts[0].assignmentStats?.ASSISTS).toBe(2);
    expect(refreshed.forecasts[0].stats.ASSISTS).toBeNull();
    expect(refreshed.forecasts[0].contributions?.ASSISTS.allowedUses.comparison).toBe(false);
    const expired = resolvePlanningContributions({ ...resolved, baselineSources: [assists],
      context: { ...resolved.context, asOf: "2026-10-01T00:00:00Z" } });
    expect(expired.forecasts[0].assignmentStats?.ASSISTS).toBeNull();
    expect(expired.forecasts[0].tieBreakStats?.ASSISTS).toBe(4);
    const traded = structuredClone(resolved);
    traded.players[0].rosterRevision = "new-roster";
    const changed = resolvePlanningContributions({ ...traded,
      baselineSources: [{ ...assists, rosterRevision: "new-roster" }] });
    expect(changed.forecasts[0].stats.ASSISTS).toBeNull();
    expect(changed.forecasts[0].tieBreakStats?.ASSISTS).toBe(4);
    const revoked = resolvePlanningContributions({ ...resolved, baselineSources: [assists],
      forecastManifest: { version: "planning-forecasts-v1", id: "revoked", seasonId: 20262027, asOf: now,
        scheduleRevision: "schedule-a", rosterRevision: "roster-a", issuedRevisionIds: [], baselineChecksum: "rates",
        requiredOpportunities: 1, forecastedOpportunities: 0, exclusionCounts: {} } });
    expect(revoked.forecasts[0].assignmentStats?.ASSISTS).toBeNull();
    expect(revoked.forecasts[0].tieBreakStats?.ASSISTS).toBe(4);
  });

  it("adds independently unconditional targets without inventing participation", () => {
    const resolved = resolvePlanningContributions(fixture([rate]));
    const assists = { ...rate, targetKey: "ASSISTS", sourceId: "assists-rate", mean: 4,
      basis: "unconditional_game" as const, participationIntegrated: true };
    const refreshed = resolvePlanningContributions({ ...resolved, baselineSources: [rate, assists] });
    expect(refreshed.forecasts[0].stats.GOALS).toBeNull();
    expect(refreshed.forecasts[0].stats.ASSISTS).toBe(4);
    expect(refreshed.forecasts[0].contributions?.ASSISTS.participationRevisionId).toBeNull();
    expect(resolvePlanningContributions(refreshed).forecasts).toEqual(refreshed.forecasts);
  });

  it("keeps newly added targets conditional when retained participation receipts conflict", () => {
    const shots = { ...rate, targetKey: "SHOTS", sourceId: "shots-rate" };
    const resolved = resolvePlanningContributions(fixture([rate, shots], [detailed()]));
    const assists = { ...rate, targetKey: "ASSISTS", sourceId: "assists-rate", mean: 4 };
    // The same issued probability has :participation and :appearance aliases
    // when one target has detail and another borrows appearance evidence.
    expect(resolvePlanningContributions({ ...resolved, baselineSources: [rate, shots, assists] })
      .forecasts[0].stats.ASSISTS).toBe(2);
    resolved.forecasts[0].contributions!.SHOTS.inputs!.participation!.probability = 0.75;
    const refreshed = resolvePlanningContributions({ ...resolved, baselineSources: [rate, shots, assists] });
    expect(refreshed.forecasts[0].stats.ASSISTS).toBeNull();
    expect(refreshed.forecasts[0].tieBreakStats?.ASSISTS).toBe(4);
    expect(refreshed.forecasts[0].contributions?.ASSISTS.participationRevisionId).toBeNull();
  });

  it("does not borrow start participation for newly added appearance-based goalie components", () => {
    const saves = { ...rate, targetKey: "SAVES_GOALIE", basis: "per_start" as const, mean: 20 };
    const snapshot = fixture([saves], [detailed({ stats: { SAVES_GOALIE: 10 },
      conditionalStats: { SAVES_GOALIE: 20 }, startProbability: 0.5, appearanceProbability: null })]);
    snapshot.players[0].playerClass = "goalie";
    const resolved = resolvePlanningContributions(snapshot);
    const against = { ...rate, targetKey: "GOALS_AGAINST_GOALIE", sourceId: "against-rate", mean: 2 };
    const refreshed = resolvePlanningContributions({ ...resolved, baselineSources: [saves, against, rate] });
    expect(refreshed.forecasts[0].stats.SAVES_GOALIE).toBe(10);
    expect(refreshed.forecasts[0].stats.GOALS_AGAINST_GOALIE).toBeNull();
    expect(refreshed.forecasts[0].contributions?.GOALS_AGAINST_GOALIE.exclusionReasons)
      .toContain("incompatible_component_basis");
    expect(refreshed.forecasts[0].contributions?.GOALS_AGAINST_GOALIE.participationRevisionId).toBeNull();
    expect(refreshed.forecasts[0].contributions?.GOALS).toBeUndefined();
    expect(resolvePlanningContributions(refreshed).forecasts).toEqual(refreshed.forecasts);
  });

  it("expires borrowed participation before a longer-lived baseline and retains only conditional ability", () => {
    const pim = { ...rate, targetKey: "PENALTY_MINUTES", mean: 2 };
    const resolved = resolvePlanningContributions(fixture([pim], [detailed({ stats: {}, conditionalStats: {},
      expiresAt: "2026-09-30T00:00:00Z" })]));
    expect(resolved.forecasts[0].stats.PENALTY_MINUTES).toBe(1);
    expect(resolved.forecasts[0].issuedContext).toEqual(issuedContext);
    expect(resolved.forecasts[0].expiresAt).toBe("2026-09-30T00:00:00Z");
    resolved.context.asOf = "2026-10-01T00:00:00Z";
    const refreshed = resolvePlanningContributions(resolved).forecasts[0];
    expect(refreshed.stats.PENALTY_MINUTES).toBeNull();
    expect(refreshed.tieBreakStats?.PENALTY_MINUTES).toBe(2);
    expect(refreshed.appearanceProbability).toBeNull();
    expect(refreshed.contributions?.PENALTY_MINUTES.allowedUses.totals).toBe(false);
  });

  it("requires participation use approval even when the rate allows totals", () => {
    const original = detailed({ stats: {}, conditionalStats: {}, allowedUses: {
      assignment: true, totals: false, comparison: false, conditionalTieBreak: true } });
    const forecast = resolvePlanningContributions(fixture([rate], [original])).forecasts[0];
    expect(forecast.stats.GOALS).toBeNull();
    expect(forecast.assignmentStats?.GOALS).toBe(0.5);
    expect(forecast.contributions?.GOALS.allowedUses.comparison).toBe(false);
  });

  it("invalidates retained context and accepts only an independently compatible refreshed rate", () => {
    const resolved = resolvePlanningContributions(fixture([rate], [detailed()]));
    resolved.players[0].rosterRevision = "roster-b";
    const invalid = resolvePlanningContributions(resolved).forecasts[0];
    expect(invalid.stats.GOALS).toBeNull();
    expect(invalid.tieBreakStats?.GOALS).toBeNull();
    resolved.baselineSources = [{ ...rate, rosterRevision: "roster-b", sourceId: "fresh-rate" }];
    const fallback = resolvePlanningContributions(resolved).forecasts[0];
    expect(fallback.stats.GOALS).toBeNull();
    expect(fallback.tieBreakStats?.GOALS).toBe(1);
    expect(fallback.contributions?.GOALS.participationRevisionId).toBeNull();
    expect(fallback.sourceKind).toBe("baseline");
  });

  it("rechecks current release permissions and rejects legacy resolved rows without inputs", () => {
    const integrated = { ...rate, basis: "unconditional_game" as const, participationIntegrated: true };
    const resolved = resolvePlanningContributions(fixture([integrated]));
    for (const currentSources of [[], [{ ...integrated, released: false }], [{ ...integrated,
      allowedUses: { assignment: false, totals: false, comparison: false, conditionalTieBreak: false } }]]) {
      const result = resolvePlanningContributions({ ...resolved, baselineSources: currentSources }).forecasts[0];
      expect(result.stats.GOALS).toBeNull();
      expect(result.assignmentStats?.GOALS).toBeNull();
    }
    delete resolved.forecasts[0].contributions!.GOALS.inputs;
    expect(resolvePlanningContributions(resolved).forecasts[0].stats.GOALS).toBeNull();
  });

  it("revalidates retained postponements and season changes without carrying old participation", () => {
    const resolved = resolvePlanningContributions(fixture([rate], [detailed()]));
    const postponed = structuredClone(resolved);
    postponed.games[0] = { ...postponed.games[0], startsAt: "2026-10-09T23:00:00Z",
      date: "2026-10-09", scheduleRevision: "postponed" };
    postponed.context.endDate = "2026-10-09";
    const fallback = resolvePlanningContributions(postponed).forecasts[0];
    expect(fallback.stats.GOALS).toBeNull();
    expect(fallback.tieBreakStats?.GOALS).toBe(1);
    expect(fallback.contributions?.GOALS.participationRevisionId).toBeNull();
    expect(fallback.issuedContext).toBeUndefined();
    const nextSeason = structuredClone(resolved);
    nextSeason.context.seasonId = 20272028;
    const rejected = resolvePlanningContributions(nextSeason).forecasts[0];
    expect(rejected.stats.GOALS).toBeNull();
    expect(rejected.tieBreakStats?.GOALS).toBeNull();
    expect(rejected.contributions?.GOALS.allowedUses.comparison).toBe(false);
  });

  it("does not reinterpret a retained contribution from an unknown resolver policy", () => {
    const resolved = resolvePlanningContributions(fixture([rate], [detailed()]));
    resolved.forecasts[0].contributions!.GOALS.resolverVersion = "unknown-policy" as never;
    const rejected = resolvePlanningContributions(resolved).forecasts[0];
    expect(rejected.stats.GOALS).toBeNull();
    expect(rejected.contributions?.GOALS.allowedUses.assignment).toBe(false);
  });

  it("does not reuse detailed or borrowed participation from a revoked issued revision", () => {
    const resolved = resolvePlanningContributions(fixture([rate], [detailed()]));
    resolved.forecastManifest = { version: "planning-forecasts-v1", id: "refreshed", seasonId: 20262027,
      asOf: now, scheduleRevision: "schedule-a", rosterRevision: "roster-a", issuedRevisionIds: [],
      baselineChecksum: "baseline", requiredOpportunities: 1, forecastedOpportunities: 0, exclusionCounts: {} };
    const result = resolvePlanningContributions(resolved).forecasts[0];
    expect(result.stats.GOALS).toBeNull();
    expect(result.tieBreakStats?.GOALS).toBe(1);
    expect(result.contributions?.GOALS.participationRevisionId).toBeNull();
  });

  it("rejects trade or roster conflicts and clears known stale detailed values", () => {
    const wrongTeam = { ...rate, teamId: 2 };
    const staleDetail = detailed({ stats: { GOALS: 5 }, conditionalStats: undefined,
      expiresAt: "2026-09-28T23:00:00Z" });
    const snapshot = resolvePlanningContributions(fixture([wrongTeam], [staleDetail]));
    const result = snapshot.forecasts[0];
    expect(result.stats.GOALS).toBeNull();
    expect(snapshot.forecastInputExclusions).toContainEqual({ gameId: "30", playerId: "7", reasons: ["stale_source"] });
    expect(result.contributions?.GOALS.exclusionReasons).toContain("identity_conflict");
  });

  it("clears known expired detail even without a baseline", () => {
    const expired = detailed({ stats: { GOALS: 5 }, assignmentStats: { GOALS: 5 }, conditionalStats: { GOALS: 10 }, startProbability: 1, confirmedStart: true,
      expiresAt: "2026-09-28T23:00:00Z" });
    const rejected = resolvePlanningContributions(fixture([], [expired])).forecasts[0];
    expect(rejected.stats.GOALS).toBeNull();
    expect(rejected.assignmentStats?.GOALS).toBeNull();
    expect(rejected.allowedUses).toEqual({ assignment: false, totals: false,
      comparison: false, conditionalTieBreak: false });
    expect(rejected.conditionalStats).toBeUndefined();
    expect(rejected.startProbability).toBeNull();
    expect(rejected.confirmedStart).toBe(false);
  });

  it.each([{ baselines: [] }, { baselines: [rate] }])("withholds unclassified legacy means and participation with $baselines.length baseline sources", ({ baselines }) => {
    const legacy = detailed({ sourceKind: undefined, issuedContext: undefined, sourceWatermark: undefined,
      cutoffAt: undefined, expiresAt: undefined, stats: { GOALS: 999 }, appearanceProbability: 1 });
    const input = fixture(baselines, [legacy]);
    const output = resolvePlanningContributions(input);
    expect(output.forecasts[0].stats.GOALS).toBeNull();
    expect(output.forecasts[0].contributions?.GOALS.participationRevisionId ?? null).toBeNull();
    expect(output.forecasts[0].allowedUses?.totals).toBe(false);
    expect(output.forecasts[0].tieBreakStats?.GOALS ?? null).toBe(baselines.length ? 1 : null);
    expect(output.forecastInputExclusions).toContainEqual({ gameId: "30", playerId: "7", reasons: ["identity_conflict"] });
    expect(resolvePlanningContributions(JSON.parse(JSON.stringify(output))).forecasts).toEqual(output.forecasts);
    expect(input.forecasts[0]).toEqual(legacy);
  });

  it.each([
    { sourceKind: undefined }, { sourceKind: "baseline" }, { sourceKind: "blended" },
    { issuedContext: undefined }, { sourceWatermark: undefined },
    { revisionId: "" }, { modelVersion: null },
    { cutoffAt: undefined }, { expiresAt: undefined },
    { issuedAt: "2026-09-30T00:00:00Z" },
  ] satisfies Partial<GameForecast>[])("rejects incomplete raw forecast readiness %j", (overrides) => {
    const rejected = resolvePlanningContributions(fixture([], [detailed(overrides)])).forecasts[0];
    expect(rejected.stats.GOALS).toBeNull();
    expect(rejected.allowedUses).toEqual({ assignment: false, totals: false, comparison: false, conditionalTieBreak: false });
    expect(rejected.appearanceProbability).toBeNull();
  });

  it("does not apply skater rates to a goalie", () => {
    const snapshot = fixture([rate]);
    snapshot.players[0].playerClass = "goalie";
    expect(resolvePlanningContributions(snapshot).forecasts).toEqual([]);
  });

  it.each([false, true])("validates the entire goalie cohort before requested scope with baselines=%s", (withBaselines) => {
    const make = (probabilities: number[], confirmed = false) => {
      const data = fixture([], probabilities.map((probability, index) => detailed({ playerId: String(7 + index),
        issuedContext: { ...issuedContext, playerId: String(7 + index), nhlPlayerId: 77 + index * 11 },
        stats: { SAVES_GOALIE: probability * 20 }, conditionalStats: { SAVES_GOALIE: 20 },
        appearanceProbability: null, startProbability: probability, confirmedStart: confirmed })));
      data.players[0].playerClass = "goalie";
      data.players.push({ ...data.players[0], id: "8", nhlId: 88 });
      if (withBaselines) data.baselineSources = data.players.map(member => ({ ...rate, playerId: Number(member.id),
        nhlPlayerId: member.nhlId!, sourceId: `saves-${member.id}`, targetKey: "SAVES_GOALIE", basis: "per_start" }));
      return data;
    };
    for (const [probabilities, confirmed] of [[[0.8, 0.8], false], [[1, 1], true], [[-0.1, 0.4], false],
      [[1.1, 0], false], [[0.4, 0.4], true]] as const) {
      const data = make([...probabilities], confirmed);
      for (const forecasts of [data.forecasts, [...data.forecasts].reverse()]) {
        const result = resolvePlanningContributions({ ...data, forecasts }, { playerIds: new Set(["7"]) });
        expect(result.forecasts.every(row => row.stats.SAVES_GOALIE === null)).toBe(true);
        expect(result.forecasts.every(row => !row.confirmedStart && row.startProbability === null)).toBe(true);
        expect(result.forecastInputExclusions).toEqual(expect.arrayContaining(data.players.map(member => ({
          gameId: "30", playerId: member.id, reasons: ["unsupported_conditioning"] }))));
        const replayed = resolvePlanningContributions(JSON.parse(JSON.stringify(result)));
        expect(replayed.forecasts.every(row => row.stats.SAVES_GOALIE === null)).toBe(true);
      }
    }
    const valid = resolvePlanningContributions(make([0.4, 0.4]));
    expect(valid.forecasts.every(row => row.stats.SAVES_GOALIE !== null && row.startProbability === 0.4)).toBe(true);
    expect(valid.forecasts.reduce((sum, row) => sum + row.startProbability!, 0)).toBe(0.8);
    expect(valid.forecastInputExclusions).toEqual([]);
  });

  it("rebuilds retained goalie competition and ignores expired competing evidence", () => {
    const source = { ...rate, targetKey: "SAVES_GOALIE", basis: "per_start" as const };
    const data = fixture([source, { ...source, playerId: 8, nhlPlayerId: 88, sourceId: "second-rate" }],
      [detailed({ stats: { SAVES_GOALIE: 8 }, conditionalStats: { SAVES_GOALIE: 20 }, startProbability: 0.4 }),
        detailed({ playerId: "8", issuedContext: { ...issuedContext, playerId: "8", nhlPlayerId: 88 },
          stats: { SAVES_GOALIE: 8 }, conditionalStats: { SAVES_GOALIE: 20 }, startProbability: 0.4 })]);
    data.players[0].playerClass = "goalie";
    data.players.push({ ...data.players[0], id: "8", nhlId: 88 });
    const retained = resolvePlanningContributions(data);
    const corrupted = JSON.parse(JSON.stringify(retained)) as PlanningSnapshot;
    corrupted.forecasts.forEach(row => { row.contributions!.SAVES_GOALIE.inputs!.participation!.probability = 0.8; });
    expect(resolvePlanningContributions(corrupted).forecasts.every(row => row.stats.SAVES_GOALIE === null)).toBe(true);
    const expired = JSON.parse(JSON.stringify(retained)) as PlanningSnapshot;
    expired.forecasts[1].contributions!.SAVES_GOALIE.inputs!.detailed!.expiresAt = "2026-09-28T23:00:00Z";
    expired.forecasts[1].contributions!.SAVES_GOALIE.inputs!.participation!.expiresAt = "2026-09-28T23:00:00Z";
    expired.forecasts[1].startProbability = 0.9;
    const refreshed = resolvePlanningContributions(expired);
    expect(refreshed.forecasts[0].stats.SAVES_GOALIE).not.toBeNull();
    expect(refreshed.forecasts[0].startProbability).toBe(0.4);
    expect(refreshed.forecasts[1].stats.SAVES_GOALIE).toBeNull();
    expect(refreshed.forecasts[1].startProbability).toBeNull();
  });

  it("rejects absent or changed issued identity without borrowing current context", () => {
    for (const context of [undefined,
      { ...issuedContext, teamId: 2 }, { ...issuedContext, seasonId: 20252026 },
      { ...issuedContext, rosterRevision: "old-roster" },
      { ...issuedContext, scheduledAt: "2026-10-09T23:00:00Z" },
    ]) {
      const original = detailed({ issuedContext: context });
      const rejected = resolvePlanningContributions(fixture([], [original]));
      expect(rejected.forecasts[0].stats.GOALS).toBeNull();
      expect(rejected.forecasts[0].allowedUses?.assignment).toBe(false);
      expect(rejected.forecastInputExclusions).toContainEqual({ gameId: "30", playerId: "7", reasons: ["identity_conflict"] });
      const fallback = resolvePlanningContributions(fixture([rate], [original])).forecasts[0];
      expect(fallback.sourceKind).toBe("baseline");
      expect(fallback.stats.GOALS).toBeNull();
      expect(fallback.tieBreakStats?.GOALS).toBe(1);
      expect(fallback.contributions?.GOALS.participationRevisionId).toBeNull();
      expect(fallback.issuedContext).toBeUndefined();
    }
  });

  it("accepts the same scheduled instant in different ISO representations", () => {
    const original = detailed({ issuedContext: { ...issuedContext, scheduledAt: "2026-10-08T23:00:00.000+00:00" } });
    expect(resolvePlanningContributions(fixture([], [original])).forecasts[0].stats.GOALS).toBe(1);
  });

  it("expands only explicitly requested player IDs when bounded", () => {
    expect(resolvePlanningContributions(fixture([rate]), { playerIds: new Set(["other"]) }).forecasts).toEqual([]);
    expect(resolvePlanningContributions(fixture([rate]), { playerIds: new Set(["7"]) }).forecasts).toHaveLength(1);
  });

  it("uses an independent appearance probability for a baseline-only skater target", () => {
    const pim = { ...rate, targetKey: "PENALTY_MINUTES", mean: 2 };
    const original = detailed({ stats: {}, conditionalStats: {} });
    const forecast = resolvePlanningContributions(fixture([pim], [original])).forecasts[0];
    expect(forecast.stats.PENALTY_MINUTES).toBe(1);
    expect(forecast.contributions?.PENALTY_MINUTES.participationRevisionId)
      .toBe("detail-1:appearance");
  });

  it("propagates separate assignment, totals, comparison and tie permissions", () => {
    const scoped = { ...rate, allowedUses: { assignment: true, totals: false,
      comparison: false, conditionalTieBreak: false } };
    const original = detailed({ stats: {}, conditionalStats: {} });
    const forecast = resolvePlanningContributions(fixture([scoped], [original])).forecasts[0];
    expect(forecast.stats.GOALS).toBeNull();
    expect(forecast.assignmentStats?.GOALS).toBe(0.5);
    expect(forecast.tieBreakStats?.GOALS).toBeNull();
    expect(forecast.contributions?.GOALS.allowedUses).toEqual({ assignment: true, totals: false,
      comparison: false, conditionalTieBreak: false });
    const conditional = resolvePlanningContributions(fixture([{ ...rate,
      allowedUses: { assignment: false, totals: false, comparison: false,
        conditionalTieBreak: true } }])).forecasts[0];
    expect(conditional.stats.GOALS).toBeNull();
    expect(conditional.assignmentStats?.GOALS).toBeNull();
    expect(conditional.tieBreakStats?.GOALS).toBe(1);
  });
});


describe("calendar consumer target coverage", () => {
  afterEach(() => vi.restoreAllMocks());
  const profile = { skaterTargets: ["GOALS", "ASSISTS"], goalieTargets: [] };
  const scopes = [1, 2].map(teamId => ({ scopeKey: `game:30:team:${teamId}`, gameId: 30, teamId,
    opponentTeamId: teamId === 1 ? 2 : 1, teamGameHorizon: 1, scheduledStartAt: "2026-10-08T23:00:00Z",
    gameDate: "2026-10-08", seasonId: 20262027, homeTeamId: 1, awayTeamId: 2, calendarLeadDay: 9,
    queueCompatible: true, teamAbbreviation: teamId === 1 ? "MIN" : "TOR", scheduleRevision: "schedule-a",
  })) satisfies PlayerForecastCalendarScope[];
  const input = (baselines: ContributionSource[] = [], forecasts: GameForecast[] = []) => {
    const snapshot = fixture(baselines, forecasts);
    snapshot.games.push({ ...snapshot.games[0], teamAbbreviation: "TOR", opponent: "MIN", home: false });
    snapshot.players[0].name = "Kaprizov";
    snapshot.players.push(...[8, 9].map(id => ({ ...snapshot.players[0], id: String(id), nhlId: id * 11,
      name: id === 8 ? "Knies" : "Batherson" })));
    return snapshot;
  };
  it("requires an explicit bounded profile without guessing scoring or target support", () => {
    expect(parseCalendarCoverageProfile({})).toBeUndefined();
    expect(parseCalendarCoverageProfile({ skaterTargets: "GOALS,ASSISTS,GOALS", goalieTargets: "SAVES_GOALIE,GOALIE_MINUTES" }))
      .toEqual({ skaterTargets: ["ASSISTS", "GOALS"], goalieTargets: ["GOALIE_MINUTES", "SAVES_GOALIE"] });
    for (const query of [{ skaterTargets: "" }, { skaterTargets: ["GOALS"] }, { goalieTargets: "GOALS" },
      { skaterTargets: "SAVES_GOALIE" }, { skaterTargets: "x" }, { skaterTargets: Array(21).fill("GOALS").join(",") }]) {
      expect(() => parseCalendarCoverageProfile(query)).toThrow();
    }
  });
  it("counts every unforecasted competitor and missing target without inventing verified eligibility", () => {
    const data = input([], [detailed()]);
    const coverage = summarizeCalendarConsumerCoverage(data, scopes, profile, data.context);
    expect(coverage).toMatchObject({ status: "evaluated", requiredPlayerGameTargets: 6,
      eligiblePlayerGameTargets: 1, assignmentEligiblePlayerGameTargets: 1, totalsEligiblePlayerGameTargets: 1,
      comparisonEligiblePlayerGameTargets: 1, recommendationReadiness: "not_evaluated",
      exclusions: { no_issued_revision: 4, missing_target: 1 } });
    expect(data.players.every(player => player.eligibilityVerified !== true)).toBe(true);
    expect(summarizeCalendarConsumerCoverage(input(), scopes, profile, data.context)).toMatchObject({
      requiredPlayerGameTargets: 6, eligiblePlayerGameTargets: 0, exclusions: { no_issued_revision: 6 } });
    expect(coverage.teamsWithoutTargetPopulation).toEqual([{ teamId: 2, population: "skater" }]);
  });
  it("joins unique required targets to queue and immutable issuance receipts without asserting readiness", () => {
    const data = input([], [detailed()]);
    const manifest = { version: "forge-issued-targets-v1", outputHash: "a".repeat(64), unmappedOutputs: 0,
      opportunities: [7, 8].map(id => ({ playerId: id, nhlPlayerId: id * 11, gameId: 30, teamId: 1,
        seasonId: 20262027, population: "skater", targetKeys: ["GOALS"], conditioning: "conditional_playing" })) };
    const receipts = { gameIds: [30], queue: [{ gameId: 30, status: "pending" }],
      revisions: [{ gameId: 30, revisionId: "detail-1", publishedAt: detailed().issuedAt, targetManifest: manifest },
        { gameId: 30, revisionId: "duplicate-issuance", publishedAt: detailed().issuedAt, targetManifest: manifest },
        { gameId: 30, revisionId: "legacy", publishedAt: detailed().issuedAt, targetManifest: null }] };
    const coverage = summarizeCalendarConsumerCoverage(data, scopes, profile, data.context, receipts as any);
    expect(coverage).toMatchObject({ requiredPlayerGameTargets: 6, eligiblePlayerGameTargets: 1,
      recommendationReadiness: "not_evaluated", storageCoverage: { inspectedPlayerGameTargets: 6,
        queueReceiptPlayerGameTargets: 6, pendingQueuePlayerGameTargets: 6,
        historicallyIssuedPlayerGameTargets: 2, unverifiedIssuedPlayerGameTargets: 4,
        missingIssuedPlayerGameTargets: 0, uninspectedPlayerGameTargets: 0,
        queueStatusPlayerGameTargets: { pending: 6 } } });
    expect(summarizeCalendarConsumerCoverage(data, scopes, { ...profile, skaterTargets: ["GOALS", "GOALS", "ASSISTS"] },
      data.context, { ...receipts, revisions: receipts.revisions.slice(0, 2) } as any)).toMatchObject({
      requiredPlayerGameTargets: 6, storageCoverage: { historicallyIssuedPlayerGameTargets: 2,
        unverifiedIssuedPlayerGameTargets: 0, missingIssuedPlayerGameTargets: 4 } });
    expect(summarizeCalendarConsumerCoverage(data, scopes, profile, data.context,
      { ...receipts, gameIds: [], queue: [], revisions: [] } as any).storageCoverage).toMatchObject({
      inspectedPlayerGameTargets: 0, uninspectedPlayerGameTargets: 6, missingIssuedPlayerGameTargets: 0 });
    expect(summarizeCalendarConsumerCoverage(data, scopes, profile, data.context).storageCoverage)
      .toMatchObject({ status: "not_evaluated" });
    const known = { ...receipts, revisions: receipts.revisions.slice(0, 2) };
    expect(summarizeCalendarConsumerCoverage(data, scopes, profile, data.context,
      { ...known, queue: [{ gameId: 30, status: "failed" }] } as any).storageCoverage).toMatchObject({
      queueReceiptPlayerGameTargets: 6, pendingQueuePlayerGameTargets: 0, queueStatusPlayerGameTargets: { failed: 6 } });
    expect(summarizeCalendarConsumerCoverage(data, scopes, profile, data.context, { ...known,
      revisions: known.revisions.map(row => ({ ...row, publishedAt: "2026-10-01T00:00:00Z" })) } as any)
      .storageCoverage).toMatchObject({ historicallyIssuedPlayerGameTargets: 0, unverifiedIssuedPlayerGameTargets: 6 });
    expect(summarizeCalendarConsumerCoverage(data, scopes, profile, data.context, { ...known,
      revisions: known.revisions.map(row => ({ ...row, targetManifest: { ...manifest, unmappedOutputs: 1 } })) } as any)
      .storageCoverage).toMatchObject({ historicallyIssuedPlayerGameTargets: 2, unverifiedIssuedPlayerGameTargets: 4 });
    for (const changed of [{ seasonId: 20252026 }, { teamId: 999 }, { playerId: 999 }, { nhlPlayerId: 999 }]) {
      expect(summarizeCalendarConsumerCoverage(data, scopes, profile, data.context, { ...known,
        revisions: known.revisions.map(row => ({ ...row, targetManifest: { ...manifest,
          opportunities: manifest.opportunities.map(value => ({ ...value, ...changed })) } })) } as any)
        .storageCoverage).toMatchObject({ historicallyIssuedPlayerGameTargets: 0, missingIssuedPlayerGameTargets: 6 });
    }
    const extraScopes = [...scopes, ...scopes.map(scope => ({ ...scope, gameId: 31, scopeKey: scope.scopeKey.replace("30", "31") }))];
    const extraData = { ...data, games: [...data.games, ...data.games.map(game => ({ ...game, id: "31" }))] };
    expect(summarizeCalendarConsumerCoverage(extraData, extraScopes, profile, data.context, known as any)).toMatchObject({
      requiredPlayerGameTargets: 12, storageCoverage: { inspectedPlayerGameTargets: 6, uninspectedPlayerGameTargets: 6 } });
    for (const invalid of [{ ...known, gameIds: [999] }, { ...known, queue: [...known.queue, ...known.queue] },
      { ...known, revisions: [...known.revisions, known.revisions[0]] }]) {
      expect(() => summarizeCalendarConsumerCoverage(data, scopes, profile, data.context, invalid as any)).toThrow("receipt scope");
    }
    const mismatch = summarizeCalendarConsumerCoverage(data, scopes, profile, data.context,
      { ...known, revisions: [] } as any);
    expect(mismatch).toMatchObject({ inputStatus: "partial", storageCoverage: { consumerRevisionMismatches: 1 } });
    expect(() => summarizeCalendarConsumerCoverage({ ...data, players: [...data.players, data.players[0]] },
      scopes, profile, data.context)).toThrow("duplicate players");
  });
  it("uses resolved permission, stale, conflict and conditional-baseline rules", () => {
    const assignmentOnly = input([], [detailed({ allowedUses: { assignment: true, totals: false, comparison: false, conditionalTieBreak: false } })]);
    expect(summarizeCalendarConsumerCoverage(assignmentOnly, scopes, profile, assignmentOnly.context)).toMatchObject({
      eligiblePlayerGameTargets: 0, assignmentEligiblePlayerGameTargets: 1, totalsEligiblePlayerGameTargets: 0, comparisonEligiblePlayerGameTargets: 0 });
    const conditional = input([rate]);
    expect(summarizeCalendarConsumerCoverage(conditional, scopes, profile, conditional.context)).toMatchObject({
      eligiblePlayerGameTargets: 0, conditionalOnlyTieBreakCandidatePlayerGameTargets: 1,
      exclusions: { missing_participation: 1 } });
    const stale = input([], [detailed({ expiresAt: "2026-09-28T00:00:00Z" })]);
    expect(summarizeCalendarConsumerCoverage(stale, scopes, profile, stale.context).eligiblePlayerGameTargets).toBe(0);
    const conflict = input([], [detailed(), detailed({ stats: { GOALS: 99 } })]);
    expect(summarizeCalendarConsumerCoverage(conflict, scopes, profile, conflict.context)).toMatchObject({
      eligiblePlayerGameTargets: 0, exclusions: { conflicting_forecast: 2 } });
  });
  it("counts goalie denominator gaps and rejects overfull starter competition", () => {
    const goalieProfile = { skaterTargets: [], goalieTargets: ["SAVES_GOALIE", "GOALIE_MINUTES"] };
    const data = input([], [detailed({ stats: { SAVES_GOALIE: 30 }, conditionalStats: { SAVES_GOALIE: 60 },
      startProbability: 0.5, appearanceProbability: null })]);
    data.players.forEach(player => { player.playerClass = "goalie"; });
    expect(summarizeCalendarConsumerCoverage(data, scopes, goalieProfile, data.context)).toMatchObject({
      requiredPlayerGameTargets: 6, eligiblePlayerGameTargets: 1, exclusions: { missing_target: 1 } });
    const first = detailed({ stats: { SAVES_GOALIE: 30 }, conditionalStats: { SAVES_GOALIE: 60 }, startProbability: 0.7 });
    const second = { ...first, playerId: "8", issuedContext: { ...issuedContext, playerId: "8", nhlPlayerId: 88 } };
    data.forecasts = [first, second];
    expect(summarizeCalendarConsumerCoverage(data, scopes, goalieProfile, data.context)).toMatchObject({
      eligiblePlayerGameTargets: 0, totalsEligiblePlayerGameTargets: 0, exclusions: { unsupported_conditioning: 6 } });
  });
  it("keeps unmapped players and incomplete inputs visible and rejects lost or changed schedule sides", () => {
    const data = input();
    data.players[0] = { ...data.players[0], nhlTeamId: undefined, rosterRevision: undefined, teamAbbreviation: null };
    data.evidence.schedule = { source: "test", asOf: now, seasonId: 20262027, completeness: "partial", limitations: ["stale"] };
    expect(summarizeCalendarConsumerCoverage(data, scopes, profile, data.context)).toMatchObject({
      inputStatus: "partial", unmappedPlayers: 1, incompleteInputs: ["schedule", "identities"] });
    expect(() => summarizeCalendarConsumerCoverage(data, scopes.slice(0, 1), profile, data.context)).toThrow("both team-game sides");
    const changed = input();
    changed.games[0].scheduleRevision = "new-schedule";
    expect(() => summarizeCalendarConsumerCoverage(changed, scopes, profile, changed.context)).toThrow("Consumer schedule");
  });
  it("uses the sanitized reader with its serving flags/canaries and retains their exclusions", async () => {
    const data = input();
    data.forecastManifest = { version: "planning-forecasts-v1", id: "manifest", seasonId: 20262027, asOf: now,
      calendarPolicy: forecastCalendarPolicy(), scheduleRevision: "schedule-a", rosterRevision: "roster-a",
      issuedRevisionIds: [], baselineChecksum: null, requiredOpportunities: 3, forecastedOpportunities: 0,
      exclusionCounts: { canary_excluded: 1 }, exclusions: [{ gameId: "30", reasons: ["canary_excluded"] }] };
    const reader = vi.spyOn(publicPlanning, "loadPlanningData").mockResolvedValue(data);
    const db = {} as any;
    const result = await inspectCalendarConsumerCoverage(db, scopes, profile, new Date(now), 14);
    expect(reader).toHaveBeenCalledWith(db, { seasonId: 20262027, startDate: "2026-09-29", endDate: "2026-10-12", timeZone: "UTC" }, { now: new Date(now) });
    expect(result).toMatchObject({ requiredPlayerGameTargets: 6, eligiblePlayerGameTargets: 0,
      exclusions: { canary_excluded: 6 }, manifestId: "manifest" });
  });
  it("reports a genuinely empty horizon without fetching a population or hiding inconsistent receipts", async () => {
    const reader = vi.spyOn(publicPlanning, "loadPlanningData");
    const db = {} as any;
    const receipts = { gameIds: [], queue: [], revisions: [] };
    expect(await inspectCalendarConsumerCoverage(db, [], profile, new Date(now), 14, receipts)).toMatchObject({
      status: "empty_scope", requiredPlayerGameTargets: 0, assignmentEligiblePlayerGameTargets: 0,
      conditionalOnlyTieBreakCandidatePlayerGameTargets: 0, storageCoverage: { status: "empty_scope",
        queueReceiptPlayerGameTargets: 0, historicallyIssuedPlayerGameTargets: 0, unverifiedIssuedPlayerGameTargets: 0 } });
    expect(reader).not.toHaveBeenCalled();
    await expect(inspectCalendarConsumerCoverage(db, [], profile, new Date(now), 14,
      { ...receipts, gameIds: [30] })).rejects.toThrow("empty calendar");
  });
});
