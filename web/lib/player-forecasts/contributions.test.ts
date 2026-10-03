// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { PROJECTION_SOURCES_CONFIG } from "../projectionsConfig/projectionSourcesConfig";
import { BASELINE_CANDIDATE_DEFINITION_HASH, BASELINE_CANDIDATE_POLICY,
  baselineDefinitionHash, baselineProjectionSchemas } from "./baselinePolicy";
import { playerForecastSourcePayloadHash } from "./sourceSnapshot";
import { baselineAppearanceFromBoxscore, baselineProjectionContentHash } from "./baselineSourceLineage";
import { buildSkaterBaselineRates, type BaselineAppearanceInput } from "./baselineRates";
import { buildBaselineBundleFromCapturedInputs, buildBaselineContributionBundle,
  dryRunBaselineContributionBundle, dryRunCapturedBaselineBundle } from "./baselineGeneration";
import { forecastCalendarPolicy, resolveContribution, summarizeContributionCoverage,
  type ContributionGame, type ContributionSource } from "./contributions";
import { captureCurrentSkaterBaselineInputs, persistCapturedBaselineInputs, readBounded,
  readBaselineHistoricalManifests } from "./baselineInputCapture";
import { buildCalendarGameScopes } from "./schedule";

const game: ContributionGame = {
  seasonId: 20262027, gameId: 30, teamId: 1, playerId: 7, nhlPlayerId: 77,
  scheduledAt: "2026-10-08T23:00:00Z", scheduleRevision: "schedule-a", rosterRevision: "roster-a",
};
const source: ContributionSource = {
  kind: "detailed", sourceId: "revision-1", policyVersion: "model-v1", released: true,
  allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: true },
  playerId: 7, nhlPlayerId: 77, seasonId: 20262027, teamId: 1, gameId: 30,
  targetKey: "GOALS", unit: "count", basis: "per_appearance", mean: 2,
  participationIntegrated: false, cutoffAt: "2026-09-28T00:00:00Z",
  issuedAt: "2026-09-28T01:00:00Z", expiresAt: "2026-10-09T00:00:00Z",
  sourceWatermark: "watermark-a", scheduleRevision: "schedule-a", rosterRevision: "roster-a",
};
const participationIdentity = { playerId: 7, nhlPlayerId: 77, seasonId: 20262027,
  gameId: 30, teamId: 1, released: true, allowedUses: source.allowedUses,
  scheduleRevision: game.scheduleRevision, rosterRevision: game.rosterRevision,
  issuedAt: "2026-09-29T00:00:00Z" };

describe("shared contribution resolver", () => {
  it.each([7, 14, 21])("retains the %i-day UTC policy and measures its discrete overlap boundary", (days) => {
    const policy = forecastCalendarPolicy(days);
    const baseline = { ...source, kind: "baseline" as const, sourceId: "rate", mean: 1,
      expiresAt: "2026-11-01T00:00:00Z" };
    const at = (lead: number) => new Date(Date.parse("2026-10-01T00:00:00Z") + lead * 86400000).toISOString();
    const resolve = (lead: number) => resolveContribution({ game: { ...game, scheduledAt: at(lead) },
      targetKey: "GOALS", now: "2026-10-01T00:00:00Z", calendarPolicy: policy,
      detailed: { ...source, expiresAt: baseline.expiresAt }, baseline });
    const inside = resolve(days - 1), outside = resolve(days);
    const scopes = buildCalendarGameScopes({ now: new Date("2026-10-01T00:00:00Z"), days: policy.calendarDays,
      games: [days - 1, days].map((lead, index) => ({ id: 30 + index, seasonId: game.seasonId,
        date: at(lead).slice(0, 10), startTime: at(lead), homeTeamId: 1, awayTeamId: 2, type: 2 })) });
    expect(scopes.map(scope => scope.gameId)).toEqual([30, 30]);
    expect(scopes.every(scope => scope.calendarLeadDay === days - 1 && scope.teamGameHorizon === 1)).toBe(true);
    expect(inside.conditionalMean).toBeCloseTo(1 + 1 / 7);
    expect(inside.blendWeight).toBeCloseTo(1 / 7);
    expect(outside.conditionalMean).toBe(1);
    expect(outside.sourceKind).toBe("baseline");
    expect(inside.inputs?.calendarPolicy).toEqual(policy);
    expect(resolveContribution({ ...inside.inputs, game: inside.game, targetKey: "GOALS",
      now: "2026-09-30T20:00:00-04:00" })).toEqual(inside);
    expect(resolveContribution({ ...inside.inputs, calendarPolicy: { ...policy, overlapDays: 8 } as never,
      game: inside.game, targetKey: "GOALS", now: "2026-10-01T00:00:00Z" }).sourceKind).toBeNull();
  });
  it("fails closed without explicit use permission and keeps the four uses independent", () => {
    const now = "2026-10-01T00:00:00Z";
    const unconditional = { ...source, basis: "unconditional_game" as const, participationIntegrated: true };
    const unreviewed = resolveContribution({ game, targetKey: "GOALS", now,
      detailed: { ...unconditional, allowedUses: undefined } });
    expect(unreviewed.unconditionalMean).toBe(2);
    expect(Object.values(unreviewed.allowedUses).every((value) => value === false)).toBe(true);
    const scoped = resolveContribution({ game, targetKey: "GOALS", now,
      detailed: { ...unconditional, allowedUses: { assignment: true, totals: false,
        comparison: false, conditionalTieBreak: false } } });
    expect(scoped.allowedUses).toEqual({ assignment: true, totals: false,
      comparison: false, conditionalTieBreak: false });
    expect(scoped.exclusionReasons).toContain("use_not_approved");
  });

  it("intersects blended use scopes and requires separate approval for conditional ties", () => {
    const now = "2026-09-29T00:00:00Z";
    const baseline: ContributionSource = { ...source, kind: "baseline", gameId: undefined,
      sourceId: "baseline-1", mean: 1, allowedUses: { assignment: false, totals: true,
        comparison: false, conditionalTieBreak: false } };
    const participation = { ...participationIdentity, basis: "appearance" as const,
      probability: 0.5, revisionId: "p", cutoffAt: now, expiresAt: "2026-10-09T00:00:00Z" };
    const blended = resolveContribution({ game, targetKey: "GOALS", now, detailed: source,
      baseline, participation });
    expect(blended.sourceKind).toBe("blended");
    expect(blended.unconditionalMean).not.toBeNull();
    expect(blended.allowedUses).toEqual({ assignment: false, totals: true,
      comparison: false, conditionalTieBreak: false });
    const conditional = resolveContribution({ game, targetKey: "GOALS", now,
      detailed: { ...source, allowedUses: { assignment: true, totals: true,
        comparison: true, conditionalTieBreak: false } } });
    expect(conditional.conditionalMean).toBe(2);
    expect(conditional.allowedUses.conditionalTieBreak).toBe(false);
  });
  it("keeps conditional ability out of totals until compatible participation is supplied", () => {
    const conditional = resolveContribution({ game, targetKey: "GOALS", now: "2026-10-01T00:00:00Z", detailed: source });
    expect(conditional.conditionalMean).toBe(2);
    expect(conditional.unconditionalMean).toBeNull();
    expect(conditional.allowedUses).toEqual({ assignment: false, totals: false, comparison: false, conditionalTieBreak: true });
    const resolved = resolveContribution({ game, targetKey: "GOALS", now: "2026-10-01T00:00:00Z",
      detailed: source, participation: { ...participationIdentity,
        basis: "appearance", probability: 0.5, revisionId: "participation-1",
        cutoffAt: "2026-09-29T00:00:00Z", expiresAt: "2026-10-09T00:00:00Z" } });
    expect(resolved.unconditionalMean).toBe(1);
    expect(resolved.participationRevisionId).toBe("participation-1");
    expect(resolved.allowedUses.totals).toBe(true);
  });

  it("rejects ambiguous legacy adjustments and unreleased, stale or mismatched sources", () => {
    const now = "2026-10-01T00:00:00Z";
    for (const changed of [
      { legacyAvailabilityAdjustment: true }, { released: false },
      { expiresAt: "2026-09-30T00:00:00Z" }, { teamId: 2 },
    ]) {
      const resolved = resolveContribution({ game, targetKey: "GOALS", now, detailed: { ...source, ...changed } });
      expect(resolved.allowedUses.assignment).toBe(false);
      expect(resolved.unconditionalMean).toBeNull();
    }
  });

  it("tapers compatible detailed residuals once before participation", () => {
    const now = "2026-09-29T00:00:00Z";
    const baseline: ContributionSource = { ...source, kind: "baseline", gameId: undefined,
      sourceId: "baseline-1", mean: 1 };
    const resolved = resolveContribution({ game, targetKey: "GOALS", now, detailed: source, baseline,
      participation: { ...participationIdentity, basis: "appearance", probability: 0.5, revisionId: "p",
        cutoffAt: now, expiresAt: "2026-10-09T00:00:00Z" } });
    expect(resolved.sourceKind).toBe("blended");
    expect(resolved.blendWeight).toBeCloseTo(5 / 7);
    expect(resolved.unconditionalMean).toBeCloseTo((1 + 5 / 7) / 2);
  });

  it("uses a released unconditional baseline when detailed participation is unknown", () => {
    const now = "2026-10-01T00:00:00Z";
    const baseline: ContributionSource = { ...source, kind: "baseline", gameId: undefined,
      sourceId: "baseline-1", basis: "per_team_game", participationIntegrated: true, mean: 0.7 };
    const resolved = resolveContribution({ game, targetKey: "GOALS", now, detailed: source, baseline });
    expect(resolved.sourceKind).toBe("baseline");
    expect(resolved.unconditionalMean).toBe(0.7);
    const wrongPlayer = resolveContribution({ game, targetKey: "GOALS", now, detailed: source,
      participation: { ...participationIdentity, gameId: 999, basis: "appearance", probability: 1,
        revisionId: "p", cutoffAt: now, expiresAt: "2026-10-09T00:00:00Z" } });
    expect(wrongPlayer.allowedUses.totals).toBe(false);
  });

  it("counts required missing bench opportunities and keeps their manifest entries", () => {
    const resolved = resolveContribution({ game, targetKey: "GOALS", now: "2026-10-01T00:00:00Z",
      detailed: { ...source, basis: "unconditional_game", participationIntegrated: true } });
    const competitor = { ...game, playerId: 8, nhlPlayerId: 88 };
    const coverage = summarizeContributionCoverage([
      { game, targetKey: "GOALS" }, { game: competitor, targetKey: "GOALS" },
    ], [resolved]);
    expect(coverage.requiredCount).toBe(2);
    expect(coverage.comparisonEligibleCount).toBe(1);
    expect(coverage.exclusions).toEqual([{ gameId: 30, playerId: 8,
      targetKey: "GOALS", reasons: ["no_issued_revision"] }]);
    expect(coverage.snapshotManifest.entries).toHaveLength(2);
    expect(() => summarizeContributionCoverage([{ game, targetKey: "GOALS" }],
      [resolved, resolved])).toThrow(/duplicate resolved/i);
  });

  it("accepts signed plus-minus and limits detailed use to its calendar horizon", () => {
    const signed = resolveContribution({ game, targetKey: "PLUS_MINUS", now: "2026-10-01T00:00:00Z",
      detailed: { ...source, targetKey: "PLUS_MINUS", mean: -1,
        basis: "unconditional_game", participationIntegrated: true } });
    expect(signed.unconditionalMean).toBe(-1);
    const outOfHorizon = resolveContribution({ game, targetKey: "GOALS", now: "2026-09-28T02:00:00Z",
      horizonDays: 7, detailed: source });
    expect(outOfHorizon.exclusionReasons).toContain("outside_horizon");
  });

  it("reuses conditional rates across schedules but invalidates integrated rates", () => {
    const changedGame = { ...game, scheduleRevision: "schedule-b" };
    const now = "2026-10-01T00:00:00Z";
    const baseline: ContributionSource = { ...source, kind: "baseline", gameId: undefined,
      sourceId: "baseline-rate" };
    const participation = { ...participationIdentity, basis: "appearance" as const,
      scheduleRevision: changedGame.scheduleRevision, issuedAt: now,
      probability: 0.5, revisionId: "p", cutoffAt: now, expiresAt: "2026-10-09T00:00:00Z" };
    expect(resolveContribution({ game: changedGame, targetKey: "GOALS", now,
      baseline, participation }).unconditionalMean).toBe(1);
    const integrated = { ...baseline, basis: "per_team_game" as const,
      participationIntegrated: true };
    expect(resolveContribution({ game: changedGame, targetKey: "GOALS", now,
      baseline: integrated }).exclusionReasons).toContain("identity_conflict");
  });
});

describe("skater baseline rate candidate", () => {
  it("pins the candidate independently of dashboard defaults and source additions", async () => {
    const original = PROJECTION_SOURCES_CONFIG;
    vi.resetModules();
    vi.doMock("../projectionsConfig/projectionSourcesConfig", () => ({ PROJECTION_SOURCES_CONFIG: [
      ...original.map(row => ({ ...row, defaultSelected: row.id.includes("blake") })),
      { ...original[0], id: "new_dashboard_source", defaultSelected: true },
    ] }));
    try {
      const loaded = await import("./baselinePolicy");
      expect(loaded.BASELINE_CANDIDATE_DEFINITION_HASH).toBe(BASELINE_CANDIDATE_DEFINITION_HASH);
      expect(playerForecastSourcePayloadHash(loaded.BASELINE_CANDIDATE_POLICY)).toBe(BASELINE_CANDIDATE_DEFINITION_HASH);
      expect(Object.isFrozen(loaded.BASELINE_CANDIDATE_POLICY.sourceIds.skater)).toBe(true);
      expect(loaded.baselineProjectionSchemas("skater", 20262027).map(row => row.id))
        .toEqual(["ag_skaters", "cullen_skaters", "dtz_skaters", "5v5_skaters"]);
    } finally { vi.doUnmock("../projectionsConfig/projectionSourcesConfig"); vi.resetModules(); }
  });

  it("rejects an altered source mapping under the pinned candidate definition", async () => {
    vi.resetModules();
    vi.doMock("../projectionsConfig/projectionSourcesConfig", () => ({ PROJECTION_SOURCES_CONFIG:
      PROJECTION_SOURCES_CONFIG.map(source => ({ ...source, statMappings: source.statMappings.map(mapping =>
        source.id === "ag_skaters" && mapping.key === "GOALS"
          ? { ...mapping, dbColumnName: "New_Goals_Column" } : mapping) })) }));
    try {
      await expect(import("./baselinePolicy")).rejects.toThrow(/version and review the definition/);
    } finally { vi.doUnmock("../projectionsConfig/projectionSourcesConfig"); vi.resetModules(); }
  });

  it("keeps season-specific sources, missing priors and per-target renormalization explicit", () => {
    const seasonId = 20252026;
    const input = { playerId: 7, nhlPlayerId: 77, seasonId, cutoffAt: "2026-10-01T00:00:00Z",
      sourceWatermark: "w", appearances: [], projections: [
        { sourceId: "ag_skaters", sourceRowId: "a", seasonId, availableAt: "2025-09-01T00:00:00Z",
          projectedAppearances: 80, totals: { GOALS: 40, HITS: null, PP_GOALS: 8 } },
        { sourceId: "cullen_skaters", sourceRowId: "c", seasonId, availableAt: "2025-09-01T00:00:00Z",
          projectedAppearances: 80, totals: { GOALS: 80, HITS: 160 } },
        { sourceId: "dtz_skaters", sourceRowId: "no-schema", seasonId, availableAt: "2025-09-01T00:00:00Z",
          projectedAppearances: 80, totals: { GOALS: 800 } },
        { sourceId: "ag_skaters", sourceRowId: "wrong-season", seasonId: 20262027,
          availableAt: "2025-09-01T00:00:00Z", projectedAppearances: 80, totals: { GOALS: 800 } },
      ] };
    const result = buildSkaterBaselineRates(input);
    expect(result.definitionHash).toBe(baselineDefinitionHash("skater", seasonId));
    expect(result.targets.find(row => row.targetKey === "GOALS")?.ratePerAppearance).toBe(0.75);
    expect(result.targets.find(row => row.targetKey === "HITS")).toMatchObject({ ratePerAppearance: 2,
      missingSourceIds: ["ag_skaters", "dtz_skaters", "5v5_skaters"] });
    expect(result.missingTargetKeys).toContain("PP_GOALS");
    expect(result.missingSourceIds).toEqual(["dtz_skaters", "5v5_skaters"]);
    const future = buildSkaterBaselineRates({ ...input, seasonId: 20272028 });
    expect(future.targets).toEqual([]);
    expect(future.missingSourceIds).toEqual([...BASELINE_CANDIDATE_POLICY.sourceIds.skater]);
    expect(future.definitionHash).not.toBe(result.definitionHash);
    expect(baselineProjectionSchemas("skater", 20272028)[0].tableName).toBe("PROJECTIONS_20272028_AG_SKATERS");
    expect(() => baselineProjectionSchemas("skater", 20262028)).toThrow(/versioned/);
    const recentOnly = buildSkaterBaselineRates({ ...input, projections: [], appearances: [{
      gameId: 1, seasonId, gameDate: "2026-04-01", availableAt: input.cutoffAt,
      teamId: 1, regularSeason: true, targets: { GOALS: 8 } }] });
    expect(recentOnly.targets).toEqual([]);
  });

  it("bounds history/recent windows and shrinks a cold streak without treating missing targets as zero", () => {
    const cutoffAt = "2026-10-01T00:00:00Z";
    const result = buildSkaterBaselineRates({ playerId: 7, nhlPlayerId: 77, seasonId: 20262027,
      cutoffAt, sourceWatermark: "w", projections: [{ sourceId: "ag_skaters", sourceRowId: "a",
        seasonId: 20262027, availableAt: cutoffAt, projectedAppearances: 80, totals: { GOALS: 80 } }],
      appearances: [
        ...Array.from({ length: 83 }, (_, index) => ({ gameId: index + 1, seasonId: 20252026,
          gameDate: "2025-10-01", availableAt: cutoffAt, teamId: 1, regularSeason: true,
          targets: { GOALS: index === 0 ? 1000 : 2 } })),
        ...Array.from({ length: 21 }, (_, index) => ({ gameId: index + 100, seasonId: 20262027,
          gameDate: "2026-09-01", availableAt: cutoffAt, teamId: 1, regularSeason: true,
          targets: { GOALS: index === 0 ? 1000 : index === 20 ? null : 0 } })),
      ] });
    const goals = result.targets.find(row => row.targetKey === "GOALS")!;
    const recentWeight = Array.from({ length: 19 }, (_, index) => 0.9 ** (index + 1))
      .reduce((sum, weight) => sum + weight, 0);
    expect(goals.previousGameIds).toHaveLength(82);
    expect(goals.previousGameIds).not.toContain(1);
    expect(goals.recentGameIds).toHaveLength(19);
    expect(goals.recentGameIds).not.toContain(100);
    expect(goals.recentGameIds).not.toContain(120);
    expect(goals.previousSeasonRate).toBe(2);
    expect(goals.ratePerAppearance).toBeCloseTo(20 * (0.6 + 0.4 * 2) / (20 + recentWeight));
  });

  it("uses approved source consensus, prior shrinkage and cutoff-safe observations", () => {
    const cutoffAt = "2026-10-01T00:00:00Z";
    const result = buildSkaterBaselineRates({ playerId: 7, nhlPlayerId: 77, seasonId: 20262027,
      cutoffAt, sourceWatermark: "w", projections: [
        { sourceId: "ag_skaters", sourceRowId: "ag", seasonId: 20262027, availableAt: cutoffAt,
          projectedAppearances: 80, totals: { GOALS: 80, HITS: null } },
        { sourceId: "cullen_skaters", sourceRowId: "c", seasonId: 20262027, availableAt: cutoffAt,
          projectedAppearances: 80, totals: { GOALS: 160 } },
        { sourceId: "blake_ag_skaters", sourceRowId: "component", seasonId: 20262027, availableAt: cutoffAt,
          projectedAppearances: 80, totals: { GOALS: 800 } },
      ], appearances: [
        { gameId: 1, seasonId: 20252026, gameDate: "2026-03-01", availableAt: cutoffAt,
          teamId: 1, regularSeason: true, targets: { GOALS: 0 } },
        { gameId: 2, seasonId: 20262027, gameDate: "2026-09-29", availableAt: cutoffAt,
          teamId: 1, regularSeason: true, targets: { GOALS: 2 } },
        { gameId: 3, seasonId: 20262027, gameDate: "2026-09-30", availableAt: "2026-10-02T00:00:00Z",
          teamId: 1, regularSeason: true, targets: { GOALS: 50 } },
      ] });
    const goals = result.targets.find((target) => target.targetKey === "GOALS")!;
    expect(goals.consensusRate).toBe(1.5);
    expect(goals.previousSeasonRate).toBe(0);
    expect(goals.ratePerAppearance).toBeCloseTo((20 * 0.9 + 2) / 21);
    expect(goals.sourceRowIds).toEqual(["ag", "c"]);
    expect(result.targets.some((target) => target.targetKey === "HITS")).toBe(false);
  });

  it("uses a same-day appearance only with final boxscore evidence available by cutoff", () => {
    const cutoffAt = "2026-09-28T12:00:00Z";
    const appearance = { gameId: 30, seasonId: 20262027, gameDate: "2026-09-28",
      availableAt: cutoffAt, teamId: 1, regularSeason: true, targets: { GOALS: 2 } };
    const input = { playerId: 7, nhlPlayerId: 77, seasonId: 20262027, cutoffAt,
      sourceWatermark: "w", projections: [{ sourceId: "ag_skaters", sourceRowId: "ag",
        seasonId: 20262027, availableAt: cutoffAt, projectedAppearances: 80,
        totals: { GOALS: 40 } }] };
    const goals = (appearances: BaselineAppearanceInput[]) => buildSkaterBaselineRates({ ...input, appearances })
      .targets.find((row) => row.targetKey === "GOALS")!;
    expect(goals([appearance]).recentGameIds).toEqual([]);
    const final = { ...appearance, finalBoxscore: { payloadHash: "a".repeat(64),
      fetchedAt: "2026-09-28T11:00:00Z" } };
    expect(goals([final]).recentGameIds).toEqual([30]);
    expect(goals([final]).recentObservations[0].finalBoxscore).toEqual(final.finalBoxscore);
    expect(goals([{ ...final, finalBoxscore: { ...final.finalBoxscore,
      fetchedAt: "2026-09-28T13:00:00Z" } }]).recentGameIds).toEqual([]);
  });

  it("builds reproducible unreleased bundles and validates through dry-run persistence", async () => {
    const cutoffAt = "2026-09-28T00:00:00Z";
    const captured = {
      seasonId: 20262027, cutoffAt, issuedAt: "2026-09-28T01:00:00Z",
      expiresAt: "2026-09-29T01:00:00Z", scheduleRevision: "schedule-a",
      players: [{ playerId: 7, nhlPlayerId: 77, teamId: 1, rosterRevision: "roster-a",
        definitionHash: baselineDefinitionHash("skater", 20262027), projectionSources: [],
        sourceWatermark: "w", projections: [{ sourceId: "ag_skaters", sourceRowId: "ag",
          seasonId: 20262027, availableAt: "2026-09-27T00:00:00Z",
          projectedAppearances: 80, totals: { GOALS: 40 } }], appearances: [] }],
    };
    const first = buildBaselineBundleFromCapturedInputs(captured);
    const second = buildBaselineBundleFromCapturedInputs(captured);
    expect(first).toEqual(second);
    expect(first.manifest.released).toBe(false);
    expect(first.manifest.reviewId).toBeNull();
    expect(first.sources[0].mean).toBe(0.5);
    expect(first.sources[0].participationIntegrated).toBe(false);
    const snapshot = buildSkaterBaselineRates({ ...captured.players[0],
      seasonId: captured.seasonId, cutoffAt });
    expect(snapshot.targets[0].recentAppearanceCount).toBe(0);
    const databaseMustNotRun = new Proxy({}, { get() { throw new Error("database access in dry run"); } });
    const receipt = await dryRunBaselineContributionBundle(databaseMustNotRun as never, {
      ...captured, snapshots: [{ snapshot, teamId: 1, rosterRevision: "roster-a" }],
    });
    expect(receipt.receipt.dryRun).toBe(true);
    expect(receipt.receipt.snapshotId).toBeNull();
    expect(receipt.manifest.checksum).toBe(first.manifest.checksum);
    expect(() => buildBaselineContributionBundle({ ...captured,
      snapshots: [{ snapshot: { ...snapshot, cutoffAt: "2026-09-29T00:00:00Z" },
        teamId: 1, rosterRevision: "roster-a" }] })).toThrow(/cutoff/);
    expect(() => buildBaselineContributionBundle({ ...captured,
      snapshots: [{ snapshot: { ...snapshot, definitionHash: "legacy" },
        teamId: 1, rosterRevision: "roster-a" }] })).toThrow(/identity|cutoff/);
    expect(() => buildBaselineBundleFromCapturedInputs({ ...captured,
      players: [{ ...captured.players[0], definitionHash: undefined as never }] })).toThrow(/definition/);
  });

  it("rejects captured projection rows with no availability receipt", () => {
    expect(() => buildBaselineBundleFromCapturedInputs({
      seasonId: 20262027, cutoffAt: "2026-09-28T00:00:00Z",
      issuedAt: "2026-09-28T01:00:00Z", expiresAt: "2026-09-29T01:00:00Z",
      scheduleRevision: "schedule-a", players: [{ playerId: 7, nhlPlayerId: 77,
        teamId: 1, rosterRevision: "roster-a", sourceWatermark: "w",
        definitionHash: baselineDefinitionHash("skater", 20262027), projectionSources: [],
        projections: [{ sourceId: "ag_skaters", sourceRowId: "ag", seasonId: 20262027,
          availableAt: "", projectedAppearances: 80, totals: { GOALS: 40 } }],
        appearances: [] }],
    })).toThrow(/availability timestamps/);
  });
});

describe("current baseline input capture", () => {
  function fakeDb(rows: Record<string, any[]>, calls: Array<{ table: string; method: string; args: unknown[] }>, pageCap = 500,
    errors: Record<string, { code: string }> = {}) {
    for (const history of rows.skatersGameStats ?? []) {
      if (!history.games) continue;
      const game = history.games;
      Object.assign(game, { startTime: game.startTime ?? `${game.date}T01:00:00Z`,
        homeTeamId: game.homeTeamId ?? 4, awayTeamId: game.awayTeamId ?? 5 });
      const retained = rows.nhl_api_game_payloads_raw ??= [];
      if (!retained.some(row => Number(row.game_id) === Number(history.gameId))) retained.push({
        id: Number(history.gameId) * 100 + 1, game_id: history.gameId, season_id: game.seasonId,
        payload_hash: "a".repeat(64), fetched_at: `${game.date}T10:00:00Z`, payload: {} });
      for (const [index, raw] of retained.filter(row => Number(row.game_id) === Number(history.gameId)).entries()) {
        raw.id ??= Number(history.gameId) * 100 + index + 1;
        raw.payload = { id: history.gameId, season: game.seasonId, gameDate: game.date, gameType: 2,
          gameState: "FINAL", homeTeam: { id: game.homeTeamId }, awayTeam: { id: game.awayTeamId },
          playerByGameStats: { homeTeam: { forwards: [{ playerId: history.playerId, toi: history.toi,
            goals: history.goals, assists: history.assists, points: history.points, sog: history.shots,
            plusMinus: history.plusMinus, pim: history.pim, hits: history.hits, blockedShots: history.blockedShots }],
            defense: [], goalies: [{ playerId: 1001 }] },
          awayTeam: { forwards: [{ playerId: 1002 }], defense: [], goalies: [{ playerId: 1003 }] } }, ...raw.payload };
      }
    }
    return { from(table: string) {
      const query: Record<string, (...args: any[]) => any> = {};
      const filters: Array<[string, unknown[]]> = [];
      for (const method of ["select", "in", "eq", "lt", "lte", "order", "limit"]) {
        query[method] = (...args) => { calls.push({ table, method, args });
          if (method === "in" && (table === "nhl_api_game_payloads_raw" || table === "games"
            || table === "nhl_api_game_normalization_status"
            || args[0] === "upload_batch_id")) filters.push([args[0], args[1]]);
          return query; };
      }
      const selected = () => (rows[table] ?? []).filter(row => filters.every(([column, values]) => values.includes(row[column])));
      query.range = (from: number, to: number) => {
        calls.push({ table, method: "range", args: [from, to] });
        return Promise.resolve({ data: selected().slice(from, Math.min(to + 1, from + pageCap)), count: selected().length, error: errors[table] ?? null });
      };
      query.then = (resolve: (value: unknown) => void) => resolve({ data: selected().slice(0, pageCap), count: selected().length, error: errors[table] ?? null });
      return query;
    } };
  }

  function normalizedHistoryFixture() {
    const rows: Record<string, any[]> = { PROJECTIONS_20262027_AG_SKATERS: [{ player_id: 77,
      upload_batch_id: "ag", Games_Played: 80, Goals: 40 }],
    skatersGameStats: [30, 31, 32].map(gameId => ({ playerId: 77, gameId, goals: 2, toi: "14:02",
      games: { id: gameId, date: "2026-09-27", seasonId: 20262027, type: 2 } })),
    nhl_api_game_roster_spots: [30, 31, 32].map(game_id => ({ game_id, player_id: 77, team_id: 4,
      season_id: 20262027, game_date: "2026-09-27", source_play_by_play_hash: "a".repeat(64), parser_version: 1 })),
    nhl_api_game_normalization_status: [30, 31].map(game_id => ({ game_id, season_id: 20262027,
      game_date: "2026-09-27", status: game_id === 30 ? "complete" : "stale", normalization_version: 2,
      normalization_fingerprint: "b".repeat(64), source_fingerprint: "c".repeat(64), parser_fingerprint: "d".repeat(64),
      parser_version: 1, strength_version: 1, materializer_version: "normalization-v1", pbp_raw_payload_id: 4001,
      pbp_raw_snapshot_version: 1, pbp_raw_payload_hash: "a".repeat(64), shift_raw_payload_id: 4002,
      shift_raw_snapshot_version: 1, shift_raw_payload_hash: "e".repeat(64), roster_fingerprint: "f".repeat(64),
      event_fingerprint: "1".repeat(64), shift_fingerprint: "2".repeat(64), expected_roster_rows: 4, observed_roster_rows: 4,
      expected_event_rows: 100, observed_event_rows: 100, expected_shift_rows: 200, observed_shift_rows: 200,
      completed_at: "2026-09-27T10:00:00Z", updated_at: "2026-09-27T10:01:00Z" })) };
    const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
    const args = { db: fakeDb(rows, calls, 1) as never, seasonId: 20262027,
      players: [{ playerId: 7, nhlPlayerId: 77, teamId: 1, rosterRevision: "r" }],
      now: () => new Date("2026-09-28T12:00:00Z") };
    return { rows, calls, args };
  }

  it("binds complete, stale and missing normalization lineage without claiming complete historical discovery", async () => {
    const { rows, calls, args } = normalizedHistoryFixture();
    rows.nhl_api_game_roster_spots[1].source_play_by_play_hash = "9".repeat(64);
    const capture = await captureCurrentSkaterBaselineInputs(args);
    expect(capture.players[0].historicalSources).toMatchObject({ version: "baseline-history-sources-v1",
      populationCoverage: "unverified", nhlPlayerId: 77, seasonId: 20262027 });
    expect(capture.players[0].historicalSources?.games.map(row => [row.game.id, row.normalization?.status ?? "missing"]))
      .toEqual([[30, "complete"], [31, "stale"], [32, "missing"]]);
    const summary = "Historical normalization lineage: 1 complete, 1 stale, 1 missing among 3 discovered games.";
    expect(capture.players[0].limitations).toContain(summary);
    expect(capture.players[0].historicalSources?.games[0].normalization).toMatchObject({ normalization_version: 2,
      pbp_raw_payload_hash: "a".repeat(64), expected_roster_rows: 4 });
    const queries = calls.filter(row => row.table === "nhl_api_game_normalization_status" && row.method === "in");
    expect(queries.length).toBeGreaterThanOrEqual(2);
    expect(queries.every(row => JSON.stringify(row.args) === JSON.stringify(["game_id", [30, 31, 32]]))).toBe(true);
    const bundle = await dryRunCapturedBaselineBundle({} as never, { capture, seasonId: 20262027,
      issuedAt: "2026-09-28T12:01:00Z", expiresAt: "2026-10-20T12:00:00Z", scheduleRevision: "s" });
    expect(bundle.sources.find(row => row.targetKey === "GOALS")?.limitations).toContain(summary);
    expect(bundle.sources.find(row => row.targetKey === "GOALS")?.limitations?.join(" "))
      .toContain("appearance-population completeness remains unverified");
  });

  it.each([
    { observed_roster_rows: 3 }, { parser_version: 2 }, { pbp_raw_payload_hash: "8".repeat(64) },
    { expected_roster_rows: 0, observed_roster_rows: 0 },
    { status: "unknown" }, { normalization_version: 0 }, { normalization_fingerprint: "unbound" },
    { season_id: 20252026 }, { game_date: "2026-09-26" },
  ])("rejects contradictory complete normalization before raw capture: %j", async correction => {
    const { rows, calls, args } = normalizedHistoryFixture();
    Object.assign(rows.nhl_api_game_normalization_status[0], correction);
    await expect(captureCurrentSkaterBaselineInputs(args)).rejects.toThrow(/normalization manifest/);
    expect(calls.some(row => row.table === "nhl_api_game_payloads_raw")).toBe(false);
  });

  it("rejects same-count normalization-version drift and failed manifest reads", async () => {
    const { rows, args } = normalizedHistoryFixture();
    const base = args.db as ReturnType<typeof fakeDb>;
    let reads = 0;
    const db = { from(table: string) {
      if (table === "nhl_api_game_normalization_status" && ++reads === 3) rows[table][0].normalization_version = 3;
      return base.from(table);
    } };
    await expect(captureCurrentSkaterBaselineInputs({ ...args, db: db as never })).rejects.toThrow(/changed during reads/);
    const failed = normalizedHistoryFixture();
    await expect(captureCurrentSkaterBaselineInputs({ ...failed.args,
      db: fakeDb(failed.rows, [], 500, { nhl_api_game_normalization_status: { code: "42501" } }) as never }))
      .rejects.toThrow(/read failed/);
  });

  it("rejects stripped, forged and future historical receipts at dry-run persistence", async () => {
    const { args } = normalizedHistoryFixture();
    const capture = await captureCurrentSkaterBaselineInputs(args);
    for (const change of [
      (player: typeof capture.players[number]) => { delete player.historicalSources; },
      (player: typeof capture.players[number]) => { player.historicalSources!.populationCoverage = "complete" as never; },
      (player: typeof capture.players[number]) => { player.historicalSources!.games.shift(); },
      (player: typeof capture.players[number]) => { player.historicalSources!.games[0].normalization!.updated_at = "2026-09-28T12:00:00.000001Z"; },
      (player: typeof capture.players[number]) => { player.historicalSources!.games[0].roster!.parser_version = 9; },
      (player: typeof capture.players[number]) => { player.limitations = []; },
    ]) {
      const forged = structuredClone(capture), player = forged.players[0];
      change(player);
      const { sourceWatermark: _old, ...identity } = player;
      player.sourceWatermark = playerForecastSourcePayloadHash({ basis: forged.basis, capturedAt: forged.capturedAt, ...identity });
      await expect(persistCapturedBaselineInputs({ db: {} as never, seasonId: 20262027, capture: forged }))
        .rejects.toThrow(/historical/);
    }
  });

  it("batches manifest reads and rejects overlapping or unscoped backend rows", async () => {
    const histories = Array.from({ length: 101 }, (_, index) => ({ gameId: index + 1 }));
    const rows = { nhl_api_game_normalization_status: histories.map(row => ({ game_id: row.gameId })) };
    const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
    expect(await readBaselineHistoricalManifests(fakeDb(rows, calls, 1) as never, histories, Date.now() + 5000)).toHaveLength(101);
    const batches = [...new Set(calls.filter(row => row.table === "nhl_api_game_normalization_status" && row.method === "in")
      .map(row => JSON.stringify(row.args[1])))].map(value => JSON.parse(value) as number[]);
    expect(batches).toEqual([histories.slice(0, 100).map(row => row.gameId), [101]]);
    rows.nhl_api_game_normalization_status.push({ game_id: 1 });
    await expect(readBaselineHistoricalManifests(fakeDb(rows, [], 1) as never, histories, Date.now() + 5000))
      .rejects.toThrow(/duplicated/);
    const db = { from() { const query: any = { select: () => query, in: () => query, order: () => query,
      range: () => Promise.resolve({ data: [{ game_id: 999 }], count: 1 }) }; return query; } };
    await expect(readBaselineHistoricalManifests(db as never, histories, Date.now() + 5000)).rejects.toThrow(/outside its scope/);
  });

  it("keeps an empty discovered scope unverified rather than certifying absent history", async () => {
    const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
    const capture = await captureCurrentSkaterBaselineInputs({ db: fakeDb({}, calls) as never, seasonId: 20262027,
      players: [{ playerId: 7, nhlPlayerId: 77, teamId: 1, rosterRevision: "r" }],
      now: () => new Date("2026-09-28T12:00:00Z") });
    expect(capture.players[0].historicalSources).toMatchObject({ populationCoverage: "unverified", games: [] });
    expect(capture.players[0].limitations?.join(" ")).toContain("appearance-population completeness remains unverified");
    expect(calls.some(row => row.table === "nhl_api_game_normalization_status")).toBe(false);
  });

  it("selects an explicit projection row and rejects changes to its pinned content", async () => {
    const rows = { PROJECTIONS_20262027_AG_SKATERS: [
      { player_id: 77, upload_batch_id: "old-row", Games_Played: 80, Goals: 800 },
      { player_id: 77, upload_batch_id: "selected-row", Games_Played: 80, Goals: 40 },
    ] };
    const schema = baselineProjectionSchemas("skater", 20262027)[0];
    const projectionSelection = { ag_skaters: { 77: { rowId: "selected-row",
      contentHash: baselineProjectionContentHash(schema, rows.PROJECTIONS_20262027_AG_SKATERS[1]) } } };
    const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
    const args = { db: fakeDb(rows, calls) as never, seasonId: 20262027,
      players: [{ playerId: 7, nhlPlayerId: 77, teamId: 1, rosterRevision: "r" }],
      now: () => new Date("2026-10-01T12:00:00Z") };
    await expect(captureCurrentSkaterBaselineInputs(args)).rejects.toThrow(/Ambiguous/);
    const captured = await captureCurrentSkaterBaselineInputs({ ...args, projectionSelection });
    expect(captured.players[0].projections[0]).toMatchObject({ sourceRowId: "selected-row",
      sourceContentHash: projectionSelection.ag_skaters[77].contentHash, totals: { GOALS: 40 } });
    expect(captured.players[0].projectionSelection).toMatchObject({ version: "baseline-projection-selection-v1",
      publicationAt: null, importCompleteness: "unverified" });
    expect(captured.players[0].projectionSelection?.sources).toHaveLength(4);
    expect(captured.players[0].projectionSelection?.sources[0]).toMatchObject({ sourceId: "ag_skaters",
      selectionMode: "explicit", requestedRow: projectionSelection.ag_skaters[77],
      row: { upload_batch_id: "selected-row", Goals: 40 } });
    expect(calls.some(row => row.method === "in" && row.args[0] === "upload_batch_id")).toBe(true);
    await expect(persistCapturedBaselineInputs({ db: {} as never, seasonId: 20262027, capture: captured }))
      .resolves.toMatchObject({ dryRun: true });
    rows.PROJECTIONS_20262027_AG_SKATERS[1].Goals = 41;
    await expect(captureCurrentSkaterBaselineInputs({ ...args, projectionSelection })).rejects.toThrow(/missing or changed/);
    await expect(captureCurrentSkaterBaselineInputs({ ...args, projectionSelection: { unapproved: {} } }))
      .rejects.toThrow(/outside the pinned/);
  });

  it("retains excluded and unusable projection rows without inventing zero ability or import completion", async () => {
    const row = { player_id: 77, upload_batch_id: "zero-appearances", Games_Played: 0, Goals: 40 };
    const db = fakeDb({ PROJECTIONS_20262027_AG_SKATERS: [row] }, []);
    const args = { db: db as never, seasonId: 20262027,
      players: [{ playerId: 7, nhlPlayerId: 77, teamId: 1, rosterRevision: "r" }],
      now: () => new Date("2026-09-28T12:00:00Z") };
    const capture = await captureCurrentSkaterBaselineInputs(args);
    expect(capture.players[0].projections).toEqual([]);
    expect(capture.players[0].projectionSelection?.sources[0]).toMatchObject({ selectionMode: "unique_current",
      row: { Games_Played: 0, Goals: 40 }, contentHash: baselineProjectionContentHash(baselineProjectionSchemas("skater", 20262027)[0], row) });
    await expect(persistCapturedBaselineInputs({ db: {} as never, seasonId: 20262027, capture }))
      .resolves.toMatchObject({ dryRun: true });
    const excluded = await captureCurrentSkaterBaselineInputs({ ...args, projectionSelection: { ag_skaters: {} } });
    expect(excluded.players[0].projectionSelection?.sources[0]).toMatchObject({ selectionMode: "excluded", row: null, contentHash: null });
    expect(excluded.players[0].limitations).toContain("Excluded 1 projection sources by explicit row selection.");
    expect(excluded.players[0].sourceWatermark).not.toBe(capture.players[0].sourceWatermark);
  });

  it("keeps selection mode and publication limits in rate bundles", async () => {
    const { args, rows } = normalizedHistoryFixture();
    const automatic = await captureCurrentSkaterBaselineInputs(args);
    const row = rows.PROJECTIONS_20262027_AG_SKATERS[0];
    const explicit = await captureCurrentSkaterBaselineInputs({ ...args, projectionSelection: { ag_skaters: {
      77: { rowId: row.upload_batch_id, contentHash: baselineProjectionContentHash(baselineProjectionSchemas("skater", 20262027)[0], row) } } } });
    expect(explicit.players[0].projections).toEqual(automatic.players[0].projections);
    expect(explicit.players[0].sourceWatermark).not.toBe(automatic.players[0].sourceWatermark);
    const bundle = await dryRunCapturedBaselineBundle({} as never, { capture: explicit, seasonId: 20262027,
      issuedAt: "2026-09-28T12:01:00Z", expiresAt: "2026-10-20T12:00:00Z", scheduleRevision: "s" });
    expect(bundle.sources[0].limitations?.join(" ")).toContain("complete imports and original publication times remain unverified");
  });

  it("rejects stripped, relabeled and inconsistent projection selection after an outer rehash", async () => {
    const { args } = normalizedHistoryFixture(), capture = await captureCurrentSkaterBaselineInputs(args);
    for (const change of [
      (player: typeof capture.players[number]) => { delete player.projectionSelection; },
      (player: typeof capture.players[number]) => { player.projectionSelection!.importCompleteness = "complete" as never; },
      (player: typeof capture.players[number]) => { player.projectionSelection!.publicationAt = "2026-09-01T00:00:00Z" as never; },
      (player: typeof capture.players[number]) => { player.projectionSelection!.sources.reverse(); },
      (player: typeof capture.players[number]) => { player.projectionSelection!.sources[0].selectionMode = "excluded"; },
      (player: typeof capture.players[number]) => { player.projectionSelection!.sources[0].contentHash = "f".repeat(64); },
      (player: typeof capture.players[number]) => {
        const source = player.projectionSelection!.sources[0];
        source.row = { ...source.row, Goals: 999 };
        source.contentHash = baselineProjectionContentHash(baselineProjectionSchemas("skater", 20262027)[0], source.row);
      },
      (player: typeof capture.players[number]) => { player.projectionSources[0].rowCount = 0; },
      (player: typeof capture.players[number]) => { player.limitations = player.limitations?.filter(value => !value.startsWith("Projection row versions")); },
    ]) {
      const forged = structuredClone(capture), player = forged.players[0];
      change(player);
      const { sourceWatermark: _old, ...identity } = player;
      player.sourceWatermark = playerForecastSourcePayloadHash({ basis: forged.basis, capturedAt: forged.capturedAt, ...identity });
      await expect(persistCapturedBaselineInputs({ db: {} as never, seasonId: 20262027, capture: forged }))
        .rejects.toThrow(/projection selection|projection source selection/);
    }
  });

  it("freezes requested projection-selection intent before asynchronous reads", async () => {
    const { rows, args } = normalizedHistoryFixture();
    const row = rows.PROJECTIONS_20262027_AG_SKATERS[0];
    const projectionSelection = { ag_skaters: { 77: { rowId: row.upload_batch_id,
      contentHash: baselineProjectionContentHash(baselineProjectionSchemas("skater", 20262027)[0], row) } } };
    const base = args.db as ReturnType<typeof fakeDb>;
    const db = { from(table: string) {
      if (table === "skatersGameStats") delete (projectionSelection as any).ag_skaters;
      return base.from(table);
    } };
    const capture = await captureCurrentSkaterBaselineInputs({ ...args, db: db as never, projectionSelection });
    expect(capture.players[0].projectionSelection?.sources[0].selectionMode).toBe("explicit");
  });

  it("recovers roster-discovered appearances missing from logs before selecting the 82/20 windows", async () => {
    const games = [
      ...Array.from({ length: 83 }, (_, i) => ({ id: i + 1, seasonId: 20252026,
        date: new Date(Date.UTC(2025, 9, 1 + i)).toISOString().slice(0, 10) })),
      ...Array.from({ length: 21 }, (_, i) => ({ id: 101 + i, seasonId: 20262027,
        date: new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10) })),
    ].map(game => ({ ...game, type: 2, startTime: `${game.date}T01:00:00Z`, homeTeamId: 4, awayTeamId: 5 }));
    const missingLogs = games.filter(game => [83, 121].includes(game.id));
    const rows: Record<string, any[]> = {
      games: missingLogs,
      skatersGameStats: games.filter(game => !missingLogs.includes(game)).map(game => ({
        playerId: 77, gameId: game.id, toi: "14:02", goals: 0, games: game })),
      nhl_api_game_roster_spots: games.map(game => ({ game_id: game.id, player_id: 77, team_id: 4,
        season_id: game.seasonId, game_date: game.date })),
      nhl_api_game_payloads_raw: missingLogs.map(game => ({ id: game.id * 100 + 1,
        game_id: game.id, season_id: game.seasonId, payload_hash: "a".repeat(64), fetched_at: `${game.date}T10:00:00Z`,
        payload: { id: game.id, season: game.seasonId, gameDate: game.date, gameType: 2, gameState: "FINAL",
          homeTeam: { id: 4 }, awayTeam: { id: 5 }, playerByGameStats: {
            homeTeam: { forwards: [{ playerId: 77, toi: "14:02", goals: 2 }], defense: [], goalies: [{ playerId: 1001 }] },
            awayTeam: { forwards: [{ playerId: 1002 }], defense: [], goalies: [{ playerId: 1003 }] } } } })),
    };
    const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
    const capture = await captureCurrentSkaterBaselineInputs({ db: fakeDb(rows, calls, 1) as never, seasonId: 20262027,
      players: [{ playerId: 7, nhlPlayerId: 77, teamId: 1, rosterRevision: "r" }],
      now: () => new Date("2026-09-28T12:00:00Z") });
    expect(capture.players[0].appearances).toHaveLength(104);
    const rates = buildSkaterBaselineRates({ ...capture.players[0], seasonId: 20262027, cutoffAt: capture.cutoffAt });
    const goals = rates.targets.find(row => row.targetKey === "GOALS")!;
    expect(goals.previousGameIds).toHaveLength(82);
    expect(goals.previousGameIds).toContain(83);
    expect(goals.previousGameIds).not.toContain(1);
    expect(goals.recentGameIds).toHaveLength(20);
    expect(goals.recentGameIds).toContain(121);
    expect(goals.recentGameIds).not.toContain(101);
    expect(capture.limitations.join(" ")).toContain("Recovered 2 appearances without normalized logs");
    const requestedGames = calls.filter(call => call.table === "games" && call.method === "in").map(call => call.args[1]);
    expect(requestedGames).toContainEqual([83, 121]);
    requestedGames.forEach(ids => expect(ids).toEqual([83, 121]));
    await expect(persistCapturedBaselineInputs({ db: {} as never, seasonId: 20262027, capture }))
      .resolves.toMatchObject({ dryRun: true });
    const bundle = await dryRunCapturedBaselineBundle({} as never, { capture, seasonId: 20262027,
      issuedAt: "2026-09-28T12:01:00Z", expiresAt: "2026-10-20T12:00:00Z", scheduleRevision: "s" });
    expect(bundle.sources[0].limitations).toContain("Recovered 2 appearances without normalized logs.");
    expect(bundle.sources[0].limitations?.join(" ")).toContain("row counts do not establish source completeness");
  });

  it("rejects missing canonical context for a roster-only historical game", async () => {
    const rows: Record<string, any[]> = { nhl_api_game_roster_spots: [{ game_id: 30, player_id: 77, team_id: 4,
      season_id: 20262027, game_date: "2026-09-27" }] };
    const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
    await expect(captureCurrentSkaterBaselineInputs({ db: fakeDb(rows, calls) as never, seasonId: 20262027,
      players: [{ playerId: 7, nhlPlayerId: 77, teamId: 1, rosterRevision: "r" }],
      now: () => new Date("2026-09-28T12:00:00Z") })).rejects.toThrow(/historical canonical game scope is incomplete/i);
    expect(calls.some(call => call.table === "nhl_api_game_payloads_raw")).toBe(false);
  });

  it("excludes known preseason roster opportunities without treating them as regular-season appearances", async () => {
    const rows: Record<string, any[]> = {
      games: [{ id: 30, date: "2026-09-27", seasonId: 20262027, type: 1,
        startTime: "2026-09-27T01:00:00Z", homeTeamId: 4, awayTeamId: 5 }],
      nhl_api_game_roster_spots: [{ game_id: 30, player_id: 77, team_id: 4,
        season_id: 20262027, game_date: "2026-09-27" }],
    };
    const capture = await captureCurrentSkaterBaselineInputs({ db: fakeDb(rows, []) as never, seasonId: 20262027,
      players: [{ playerId: 7, nhlPlayerId: 77, teamId: 1, rosterRevision: "r" }],
      now: () => new Date("2026-09-28T12:00:00Z") });
    expect(capture.players[0].appearances).toEqual([]);
    expect(capture.limitations.join(" ")).toContain("Excluded 1 non-regular-season roster opportunities");
  });

  it.each<[string, (rows: Record<string, any[]>) => void]>([
    ["duplicate history", rows => rows.skatersGameStats.push(structuredClone(rows.skatersGameStats[0]))],
    ["duplicate roster", rows => rows.nhl_api_game_roster_spots.push(structuredClone(rows.nhl_api_game_roster_spots[0]))],
    ["conflicting roster", rows => rows.nhl_api_game_roster_spots.unshift({ ...rows.nhl_api_game_roster_spots[0], team_id: 5 })],
    ["joined game mismatch", rows => { rows.skatersGameStats[0].games.id = 31; }],
    ["unrequested history player", rows => { rows.skatersGameStats[0].playerId = 88; }],
    ["unrequested roster player", rows => { rows.nhl_api_game_roster_spots[0].player_id = 88; }],
    ["wrong roster team", rows => { rows.nhl_api_game_roster_spots[0].team_id = 99; }],
    ["wrong roster date", rows => { rows.nhl_api_game_roster_spots[0].game_date = "2026-09-26"; }],
    ["unrequested history season", rows => { rows.skatersGameStats[0].games.seasonId = 20242025; }],
  ])("rejects invalid historical scope before payload reads: %s", async (_label, mutate) => {
    const rows: Record<string, any[]> = {
      skatersGameStats: [{ playerId: 77, gameId: 30, goals: 2, toi: "14:02",
        games: { id: 30, date: "2026-09-27", seasonId: 20262027, type: 2 } }],
      nhl_api_game_roster_spots: [{ game_id: 30, player_id: 77, team_id: 4,
        season_id: 20262027, game_date: "2026-09-27" }],
    };
    mutate(rows);
    const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
    await expect(captureCurrentSkaterBaselineInputs({ db: fakeDb(rows, calls, 1) as never, seasonId: 20262027,
      players: [{ playerId: 7, nhlPlayerId: 77, teamId: 1, rosterRevision: "r" }],
      now: () => new Date("2026-09-28T12:00:00Z") })).rejects.toThrow(/baseline historical/i);
    expect(calls.some(call => call.table === "nhl_api_game_payloads_raw")).toBe(false);
  });

  it("rejects overlapping historical scope pages with an unchanged exact count", async () => {
    const rows: Record<string, any[]> = { skatersGameStats: [30, 31].map(id => ({ playerId: 77,
      gameId: id, goals: 2, toi: "14:02", games: { id, date: "2026-09-27", seasonId: 20262027, type: 2 } })) };
    const base = fakeDb(rows, [], 1);
    const db = { from(table: string) {
      const query = base.from(table), range = query.range;
      if (table === "skatersGameStats") query.range = (from, to) => range(from === 1 ? 0 : from, to);
      return query;
    } };
    await expect(captureCurrentSkaterBaselineInputs({ db: db as never, seasonId: 20262027,
      players: [{ playerId: 7, nhlPlayerId: 77, teamId: 1, rosterRevision: "r" }],
      now: () => new Date("2026-09-28T12:00:00Z") })).rejects.toThrow(/baseline historical/i);
  });

  it("rejects a duplicated NHL request identity before querying sources", async () => {
    const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
    await expect(captureCurrentSkaterBaselineInputs({ db: fakeDb({}, calls) as never, seasonId: 20262027,
      players: [7, 8].map(playerId => ({ playerId, nhlPlayerId: 77, teamId: 1, rosterRevision: "r" })) }))
      .rejects.toThrow(/explicit canonical skaters/);
    expect(calls).toEqual([]);
    const capture = await captureCurrentSkaterBaselineInputs({ db: fakeDb({}, []) as never, seasonId: 20262027,
      players: [{ playerId: 7, nhlPlayerId: 77, teamId: 1, rosterRevision: "r" }] });
    const duplicate = { ...structuredClone(capture.players[0]), playerId: 8 };
    const { sourceWatermark: _old, ...identity } = duplicate;
    duplicate.sourceWatermark = playerForecastSourcePayloadHash({ basis: capture.basis,
      capturedAt: capture.capturedAt, ...identity });
    capture.players.push(duplicate);
    await expect(persistCapturedBaselineInputs({ db: {} as never, seasonId: 20262027, capture }))
      .rejects.toThrow(/Invalid current baseline capture receipt/);
  });

  it("binds prior-day raw content, discloses superseded logs and rejects forged values after rehashing", async () => {
    const rows: Record<string, any[]> = {
      skatersGameStats: [{ playerId: 77, gameId: 30, goals: 2, toi: "14:02", shots: 3,
        powerPlayPoints: 4, faceoffs: "6/9", games: { id: 30, date: "2026-09-27", seasonId: 20262027, type: 2 } }],
      nhl_api_game_roster_spots: [{ game_id: 30, player_id: 77, team_id: 4,
        season_id: 20262027, game_date: "2026-09-27" }],
    };
    const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
    const args = { db: fakeDb(rows, calls) as never, seasonId: 20262027,
      players: [{ playerId: 7, nhlPlayerId: 77, teamId: 1, rosterRevision: "r" }],
      now: () => new Date("2026-09-28T12:00:00Z") };
    const capture = await captureCurrentSkaterBaselineInputs(args);
    const appearance = capture.players[0].appearances[0];
    expect(appearance.targets).toMatchObject({ GOALS: 2, SHOTS_ON_GOAL: 3, PP_POINTS: null, FACEOFFS_WON: null });
    const receipt = appearance.finalBoxscore as any;
    expect(receipt.contentHash).toBe(playerForecastSourcePayloadHash(receipt.rawRow.payload));
    expect(receipt.contentHash).not.toBe(receipt.payloadHash);
    const rate = buildSkaterBaselineRates({ ...capture.players[0], seasonId: 20262027, cutoffAt: capture.cutoffAt,
      projections: [{ sourceId: "ag_skaters", sourceRowId: "a", seasonId: 20262027,
        availableAt: capture.cutoffAt, projectedAppearances: 80, totals: { GOALS: 40 } }] });
    const compact = rate.targets.find(row => row.targetKey === "GOALS")!.recentObservations[0].finalBoxscore as any;
    expect(compact).toMatchObject({ contentHash: receipt.contentHash, rawRowId: receipt.rawRow.id });
    expect(compact.rawRow).toBeUndefined();
    expect(calls.filter(row => row.table === "nhl_api_game_payloads_raw" && row.method === "select")
      .map(row => row.args[0])).toEqual([
      "id,game_id,season_id,payload_hash,fetched_at", "id,game_id,season_id,payload_hash,payload,fetched_at",
      "id,game_id,season_id,payload_hash,fetched_at", "id,game_id,season_id,payload_hash,payload,fetched_at",
    ]);
    const forged = structuredClone(capture);
    forged.players[0].appearances[0].targets.GOALS = 999;
    const player = forged.players[0];
    const { sourceWatermark: _old, ...identity } = player;
    player.sourceWatermark = playerForecastSourcePayloadHash({ basis: forged.basis,
      capturedAt: forged.capturedAt, ...identity });
    await expect(persistCapturedBaselineInputs({ db: {} as never, seasonId: 20262027, capture: forged }))
      .rejects.toThrow(/values do not match/);
    rows.skatersGameStats[0].goals = 999;
    const corrected = await captureCurrentSkaterBaselineInputs(args);
    expect(corrected.players[0].appearances[0].targets.GOALS).toBe(2);
    expect(corrected.limitations.join(" ")).toContain("supersede 1 disagreeing normalized");
    rows.skatersGameStats[0].goals = 2;
    rows.nhl_api_game_payloads_raw = [];
    await expect(captureCurrentSkaterBaselineInputs(args)).rejects.toThrow(/missing retained boxscore/);
  });

  it("rejects a changed or missing selected boxscore between metadata and payload reads", async () => {
    const rows: Record<string, any[]> = {
      skatersGameStats: [{ playerId: 77, gameId: 30, goals: 2, toi: "14:02",
        games: { id: 30, date: "2026-09-27", seasonId: 20262027, type: 2 } }],
      nhl_api_game_roster_spots: [{ game_id: 30, player_id: 77, team_id: 4,
        season_id: 20262027, game_date: "2026-09-27" }],
    };
    const base = fakeDb(rows, []);
    let reads = 0;
    const db = { from(table: string) {
      const query = base.from(table);
      if (table === "nhl_api_game_payloads_raw" && ++reads === 2) rows.nhl_api_game_payloads_raw = [];
      return query;
    } };
    await expect(captureCurrentSkaterBaselineInputs({ db: db as never, seasonId: 20262027,
      players: [{ playerId: 7, nhlPlayerId: 77, teamId: 1, rosterRevision: "r" }],
      now: () => new Date("2026-09-28T12:00:00Z") })).rejects.toThrow(/payloads are incomplete/);
  });

  it("rejects mismatched identities, duplicate players and sub-millisecond future boxscore receipts", async () => {
    const rows: Record<string, any[]> = { skatersGameStats: [{ playerId: 77, gameId: 30, goals: 2, toi: "14:02",
      games: { id: 30, date: "2026-09-27", seasonId: 20262027, type: 2 } }] };
    fakeDb(rows, []);
    const rawRow = rows.nhl_api_game_payloads_raw[0], game = rows.skatersGameStats[0].games;
    const args = { rawRow, game, nhlPlayerId: 77, teamId: 4, cutoffAt: "2026-09-28T12:00:00.000Z", population: "skater" as const };
    expect(baselineAppearanceFromBoxscore(args)?.targets.GOALS).toBe(2);
    for (const changed of [
      { ...rawRow, payload: { ...rawRow.payload, season: 20252026 } },
      { ...rawRow, payload: { ...rawRow.payload, gameType: 1 } },
      { ...rawRow, fetched_at: "2026-09-28T12:00:00.000001Z" },
      { ...rawRow, payload: { ...rawRow.payload, gameDate: "2026-09-26" } },
    ]) expect(() => baselineAppearanceFromBoxscore({ ...args, rawRow: changed })).toThrow(/inconsistent/);
    expect(() => baselineAppearanceFromBoxscore({ ...args, teamId: 99 })).toThrow(/unverified/);
    rawRow.payload.playerByGameStats.awayTeam.forwards.push({ playerId: 77, toi: "01:00" });
    expect(() => baselineAppearanceFromBoxscore(args)).toThrow(/unverified/);
    await expect(readBounded({ from() { const query: any = { select: () => query, order: () => query,
      range: () => new Promise(() => {}) }; return query; } } as never,
    "stalled", "id", "id", "id", query => query, Date.now() + 5)).rejects.toThrow(/deadline/);
  });

  it("reads legacy schemas and absent future tables without borrowing current-season imports", async () => {
    const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
    const players = [{ playerId: 7, nhlPlayerId: 77, teamId: 1, rosterRevision: "r" }];
    const args = { players, now: () => new Date("2026-10-01T12:00:00Z") };
    const db = fakeDb({ PROJECTIONS_20252026_AG_SKATERS: [{ player_id: 77,
      upload_batch_id: "historical", Games_Played: 80, Goals: 40 }] }, calls);
    const legacy = await captureCurrentSkaterBaselineInputs({ ...args, seasonId: 20252026, db: db as never });
    expect(legacy.players[0].projections[0]).toMatchObject({ sourceRowId: "historical",
      seasonId: 20252026, sourceTable: "PROJECTIONS_20252026_AG_SKATERS", availableAt: legacy.capturedAt });
    expect(legacy.players[0].projectionSources.filter(row => row.status === "no_versioned_schema")
      .map(row => row.sourceId)).toEqual(["dtz_skaters", "5v5_skaters"]);
    expect(calls.find(row => row.table === "PROJECTIONS_20252026_AG_SKATERS" && row.method === "select")
      ?.args[0]).not.toContain("PP_Goals");
    expect(calls.some(row => row.table.includes("20262027"))).toBe(false);
    await expect(persistCapturedBaselineInputs({ db: {} as never, seasonId: 20252026, capture: legacy }))
      .resolves.toMatchObject({ dryRun: true });
    const futureCalls: typeof calls = [];
    const errors = Object.fromEntries(baselineProjectionSchemas("skater", 20272028)
      .map(row => [row.tableName!, { code: "PGRST205" }]));
    const future = await captureCurrentSkaterBaselineInputs({ ...args, seasonId: 20272028,
      db: fakeDb({}, futureCalls, 500, errors) as never });
    expect(future.players[0].projections).toEqual([]);
    expect(future.players[0].projectionSources.every(row => row.status === "table_unavailable")).toBe(true);
    expect(future.limitations.join(" ")).toContain("unavailable for 20272028");
    expect(futureCalls.some(row => row.table.includes("20262027"))).toBe(false);
    errors.PROJECTIONS_20272028_AG_SKATERS = { code: "42501" };
    await expect(captureCurrentSkaterBaselineInputs({ ...args, seasonId: 20272028,
      db: fakeDb({}, [], 500, errors) as never })).rejects.toThrow(/capture incomplete/);
    await expect(persistCapturedBaselineInputs({ db: {} as never, seasonId: 20252026,
      capture: { ...legacy, players: [{ ...legacy.players[0], definitionHash: "legacy" }] } }))
      .rejects.toThrow(/definition/);
  });

  it("captures approved sources and verified historical teams with a post-read receipt", async () => {
    const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
    const db = fakeDb({
      PROJECTIONS_20262027_AG_SKATERS: [{ player_id: 77, upload_batch_id: "batch-a",
        Games_Played: 80, Goals: 40 }],
      skatersGameStats: [{ playerId: 77, gameId: 12, goals: 2, toi: "14:02",
        games: { id: 12, date: "2026-03-10", seasonId: 20252026, type: 2 } },
        { playerId: 77, gameId: 13, goals: 8, toi: "13:00",
          games: { id: 13, date: "2026-03-11", seasonId: 20252026, type: 2 } }],
      nhl_api_game_roster_spots: [{ game_id: 12, player_id: 77, team_id: 4,
        season_id: 20252026, game_date: "2026-03-10" }],
    }, calls);
    const times = [new Date("2026-09-28T12:00:00Z"), new Date("2026-09-28T12:00:01Z")];
    const captured = await captureCurrentSkaterBaselineInputs({ db: db as never, seasonId: 20262027,
      players: [{ playerId: 7, nhlPlayerId: 77, teamId: 1, rosterRevision: "r" }],
      now: () => times.shift()! });
    expect(captured.basis).toBe("captured_current");
    expect(captured.capturedAt).toBe("2026-09-28T12:00:01.000Z");
    expect(captured.players[0].projections[0].availableAt).toBe(captured.capturedAt);
    expect(captured.players[0].appearances).toHaveLength(1);
    expect(captured.players[0].appearances[0].teamId).toBe(4);
    expect(captured.limitations.join(" ")).toContain("Excluded 1 appearances");
    const bundle = await dryRunCapturedBaselineBundle({} as never, { capture: captured, seasonId: 20262027,
      issuedAt: "2026-09-28T12:01:00Z", expiresAt: "2026-10-20T12:00:00Z", scheduleRevision: "s" });
    expect(bundle.sources.find(row => row.targetKey === "GOALS")?.limitations)
      .toContain("Excluded 1 appearances without verified historical team membership.");
    expect(calls.filter((call) => call.method === "eq" && call.args[0] === "games.type")
      .map((call) => call.args[1])).toEqual([2, 2]);
    expect(calls.find((call) => call.table === "skatersGameStats"
      && call.method === "in" && call.args[0] === "playerId")?.args[1]).toEqual([77]);
    expect(calls.some((call) => call.table.includes("BLAKE_AG"))).toBe(false);
    expect(calls.some((call) => call.method === "range" && call.table === "skatersGameStats")).toBe(true);
    const databaseMustNotRun = new Proxy({}, { get() { throw new Error("database access in dry run"); } });
    const persisted = await persistCapturedBaselineInputs({ db: databaseMustNotRun as never,
      seasonId: 20262027, capture: captured });
    expect(persisted.dryRun).toBe(true);
    expect(persisted.receipts[0].payloadHash).toBe(captured.players[0].sourceWatermark);
    await expect(persistCapturedBaselineInputs({ db: databaseMustNotRun as never,
      seasonId: 20262027, capture: { ...captured,
        players: [{ ...captured.players[0], sourceWatermark: "tampered" }] } })).rejects.toThrow(/watermark/);
  });

  it("captures same-day skater stats only after a final pre-capture boxscore", async () => {
    const rows: Record<string, any[]> = {
      skatersGameStats: [{ playerId: 77, gameId: 30, goals: 2, toi: "14:02",
        games: { id: 30, date: "2026-09-28", seasonId: 20262027, type: 2 } }],
      nhl_api_game_roster_spots: [{ game_id: 30, player_id: 77, team_id: 4,
        season_id: 20262027, game_date: "2026-09-28" }],
      nhl_api_game_payloads_raw: [{ game_id: 30, season_id: 20262027,
        payload_hash: "a".repeat(64), fetched_at: "2026-09-28T11:00:00Z",
        payload: { id: 30, season: 20262027, gameState: "FINAL" } }],
    };
    const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
    const db = fakeDb(rows, calls);
    const args = { db: db as never, seasonId: 20262027,
      players: [{ playerId: 7, nhlPlayerId: 77, teamId: 1, rosterRevision: "r" }],
      now: () => new Date("2026-09-28T12:00:00Z") };
    const captured = await captureCurrentSkaterBaselineInputs(args);
    expect(captured.players[0].appearances[0].finalBoxscore).toMatchObject({
      payloadHash: "a".repeat(64), fetchedAt: "2026-09-28T11:00:00Z" });
    rows.nhl_api_game_payloads_raw.unshift({ ...rows.nhl_api_game_payloads_raw[0],
      id: 3002,
      fetched_at: "2026-09-28T11:30:00Z",
      payload: { id: 30, season: 20262027, gameState: "LIVE" } });
    const unresolved = await captureCurrentSkaterBaselineInputs(args);
    expect(unresolved.players[0].appearances).toEqual([]);
  });

  it("rejects a changing source rather than mixing capture revisions", async () => {
    const rows: Record<string, any[]> = { PROJECTIONS_20262027_AG_SKATERS: [{ player_id: 77,
      upload_batch_id: "a", Games_Played: 80, Goals: 20 }] };
    const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
    const stable = fakeDb(rows, calls);
    let reads = 0;
    const db = { from(table: string) {
      if (table === "PROJECTIONS_20262027_AG_SKATERS" && ++reads === 2) rows.PROJECTIONS_20262027_AG_SKATERS[0].Goals = 21;
      return stable.from(table);
    } };
    await expect(captureCurrentSkaterBaselineInputs({ db: db as never, seasonId: 20262027,
      players: [{ playerId: 7, nhlPlayerId: 77, teamId: 1, rosterRevision: "r" }],
      now: () => new Date("2026-09-28T12:00:00Z") })).rejects.toThrow(/changed during reads/);
  });

  it("rejects an overlarge player request before any read", async () => {
    const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
    const db = fakeDb({}, calls);
    await expect(captureCurrentSkaterBaselineInputs({ db: db as never, seasonId: 20262027,
      players: Array.from({ length: 21 }, (_, index) => ({ playerId: index + 1,
        nhlPlayerId: index + 101, teamId: 1, rosterRevision: "r" })) })).rejects.toThrow(/one to 20/);
    expect(calls).toHaveLength(0);
  });

  it("reads every baseline row when the backend cap is below the requested page size", async () => {
    const rows = Array.from({ length: 5 }, (_, id) => ({ id }));
    const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
    const db = fakeDb({ history: rows }, calls, 2);
    await expect(readBounded(db as never, "history", "id", "id", "id", query => query)).resolves.toEqual(rows);
    expect(calls.filter(call => call.method === "range").map(call => call.args)).toEqual([[0, 499], [2, 501], [4, 503]]);
    expect(calls.filter(call => call.method === "select").every(call =>
      (call.args[1] as { count: string }).count === "exact")).toBe(true);
  });

  it("rejects a truncated projection-source response instead of dropping a prior", async () => {
    const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
    const db = fakeDb({ PROJECTIONS_20262027_AG_SKATERS: [
      { player_id: 77, upload_batch_id: "batch", Games_Played: 80, Goals: 40 },
      { player_id: 88, upload_batch_id: "batch", Games_Played: 80, Goals: 20 },
    ] }, calls, 1);
    await expect(captureCurrentSkaterBaselineInputs({ db: db as never, seasonId: 20262027,
      players: [77, 88].map(nhlPlayerId => ({ playerId: nhlPlayerId, nhlPlayerId, teamId: 1, rosterRevision: "r" })),
      now: () => new Date("2026-09-28T12:00:00Z") })).rejects.toThrow("projection capture incomplete");
  });

  it.each(["missing count", "changed count", "no progress", "read error"])("rejects incomplete baseline pages: %s", async (failure) => {
    let reads = 0;
    const db = { from() {
      const query: any = {};
      for (const method of ["select", "order"]) query[method] = () => query;
      query.range = async () => ({ data: failure === "no progress" ? [] : [{ id: ++reads }],
        count: failure === "missing count" ? null : failure === "changed count" && reads > 1 ? 3 : 2,
        error: failure === "read error" ? { message: "failed" } : null });
      return query;
    } };
    await expect(readBounded(db as never, "history", "id", "id", "id", query => query))
      .rejects.toThrow(/read failed or changed/);
  });

  it("fails instead of truncating historical reads beyond 5000 rows", async () => {
    const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
    const db = fakeDb({ skatersGameStats: Array.from({ length: 5001 }, (_, index) => ({ gameId: index })) }, calls);
    await expect(captureCurrentSkaterBaselineInputs({ db: db as never, seasonId: 20262027,
      players: [{ playerId: 7, nhlPlayerId: 77, teamId: 1, rosterRevision: "r" }],
      now: () => new Date("2026-09-28T12:00:00Z") })).rejects.toThrow(/exceeded 5000/);
    expect(calls.filter((call) => call.table === "skatersGameStats" && call.method === "range")
      .at(-1)?.args).toEqual([0, 499]);
  });
});
