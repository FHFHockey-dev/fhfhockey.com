import { describe, expect, it } from "vitest";
import { saveWorkspaceSchema, workspaceQuerySchema } from "./workspaceSchema";

const context = { provider: "manual", seasonId: 20262027, leagueId: "league", teamId: "team", startDate: "2026-10-01", endDate: "2026-10-07", timeZone: "America/New_York", asOf: "2026-10-01T12:00:00Z" };
const rules = { lineupMode: "daily", rosterSlots: { C: 1 }, lineupPeriods: [{ id: "week", start: "2026-10-01T00:00:00Z", end: "2026-10-08T00:00:00Z", lockAt: null }], acquisitionTiming: "unknown", acquisitionCost: null, periods: [], scoring: { mode: "points", weights: {}, categories: [] }, goalieMinimum: { required: null, credited: null, periodStart: "2026-10-01", periodEnd: "2026-10-07", counts: "unknown", penalty: "unknown" }, unsupported: [] };
const workspace = { version: 1, context, rules, managerRuleOverrides: { acquisitionTiming: "next_day", scoring: { categories: [{ key: "GOALS", direction: "higher" }] }, goalieMinimum: { credited: 2 } }, roster: [], intent: { revision: 0, steps: [], protectedPlayerIds: [], excludedPlayerIds: [], goalieCoverage: "accept_risk", goalieWindow: "any", goalieSplit: "mon_thu", alternativeCount: 10 }, manualPlayers: [], unresolvedNames: [], realized: {}, opponent: null };
const modeledMetadata = { version: "skater-participation-frequency-v1", event: "positive_minutes",
  probabilityStatus: "uncalibrated_model", calibration: "unavailable", inputHash: "a".repeat(64),
  evidenceHashes: ["b".repeat(64)], numerator: 1, denominator: 2, selectedGameIds: [101, 102],
  limitations: ["Synthetic fixture only; calibration unavailable."] };
const snapshot = { id: "snapshot", context, players: [], roster: [], games: [], forecasts: [], rules, lockedAssignments: [], realized: {}, opponent: null, evidence: {} };

describe("saved in-season workspace validation", () => {
  it("round-trips optional period zones across rules, manager overrides and account snapshots without adding legacy defaults", () => {
    const period = { id: "Current week", start: "2026-10-12T07:00:00.000Z", end: "2026-10-19T07:00:00.000Z",
      timeZone: "America/New_York", remaining: 2, source: "manager" };
    const exactRules = { ...rules, periods: [period] };
    const parsed = saveWorkspaceSchema.parse({ workspace: { ...workspace, rules: exactRules,
      managerRuleOverrides: { ...workspace.managerRuleOverrides, periods: [period] } },
      snapshot: { ...snapshot, rules: exactRules }, expectedVersion: null });
    expect(parsed.workspace.rules.periods).toEqual([period]);
    expect(parsed.workspace.managerRuleOverrides?.periods).toEqual([period]);
    expect(parsed.snapshot?.rules.periods).toEqual([period]);
    const { timeZone: _zone, ...legacy } = period;
    const unknown = { ...legacy, remaining: null };
    const reopened = saveWorkspaceSchema.parse({ workspace: { ...workspace, rules: { ...rules, periods: [unknown] },
      managerRuleOverrides: { periods: [unknown] } }, snapshot: null, expectedVersion: null });
    expect(reopened.workspace.rules.periods).toEqual([unknown]);
    expect(reopened.workspace.managerRuleOverrides?.periods).toEqual([unknown]);
    expect(reopened.workspace.rules.periods[0]).not.toHaveProperty("timeZone");
  });
  it.each(["", "EST", "PST", "Not/AZone"])("rejects an invalid or ambiguous saved period zone %s", timeZone => {
    const period = { id: "week", start: "2026-10-12T07:00:00Z", end: "2026-10-19T07:00:00Z", remaining: null, source: "manager", timeZone };
    expect(saveWorkspaceSchema.safeParse({ workspace: { ...workspace, rules: { ...rules, periods: [period] } }, snapshot: null, expectedVersion: null }).success).toBe(false);
    expect(saveWorkspaceSchema.safeParse({ workspace: { ...workspace, managerRuleOverrides: { periods: [period] } }, snapshot: null, expectedVersion: null }).success).toBe(false);
    expect(saveWorkspaceSchema.safeParse({ workspace, snapshot: { ...snapshot, rules: { ...rules, periods: [period] } }, expectedVersion: null }).success).toBe(false);
  });
  it("retains acquisition presence, raw values, provider time and date scope through an account snapshot", () => {
    const acquisitionEvidence = {
      source: "Yahoo team roster_adds and league current_week", fetchedAt: context.asOf, asOf: context.asOf,
      counter: { present: true, coverageType: "week", coverageWeek: 1, reportedValue: "0", used: 0 },
      limit: { present: true, reportedValue: "0", verified: false },
      period: { week: 1, startDate: "2026-09-29", endDate: "2026-10-04", containsHorizon: false },
      remaining: null, limitations: ["NHL limit encoding is unverified."],
    };
    const parsed = saveWorkspaceSchema.safeParse({ workspace, snapshot: { ...snapshot, acquisitionEvidence }, expectedVersion: null });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.snapshot?.acquisitionEvidence).toEqual(acquisitionEvidence);
    expect(saveWorkspaceSchema.safeParse({ workspace, snapshot: { ...snapshot, acquisitionEvidence: { ...acquisitionEvidence, counter: { ...acquisitionEvidence.counter, used: -1 } } }, expectedVersion: null }).success).toBe(false);
  });
  it("accepts a coherent manual workspace and snapshot", () => {
    const parsed = saveWorkspaceSchema.safeParse({ workspace, snapshot, expectedVersion: null });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.workspace.rules.lineupPeriods).toEqual(rules.lineupPeriods);
      expect(parsed.data.workspace.managerRuleOverrides?.acquisitionTiming).toBe("next_day");
      expect(parsed.data.workspace.managerRuleOverrides?.scoring).toEqual(workspace.managerRuleOverrides.scoring);
      expect(parsed.data.workspace.managerRuleOverrides?.goalieMinimum).toEqual({ credited: 2 });
      expect(parsed.data.snapshot?.rules.goalieMinimum.periodStart).toBe(rules.goalieMinimum.periodStart);
    }
  });
  it("round-trips shared forecast lineage while rejecting private payload fields", () => {
    const calendarPolicy = { version: "forecast-calendar-v1", calendarDays: 21, overlapDays: 7, timeZone: "UTC" };
    const identity = { seasonId: 20262027, gameId: 31, teamId: 6, scheduledAt: "2026-10-05T23:00:00Z",
      scheduleRevision: "schedule-a", rosterRevision: "roster-a", playerId: 7, nhlPlayerId: 77 };
    const source = { kind: "baseline", sourceId: "rate-a", policyVersion: "baseline-v1", released: true,
      allowedUses: { assignment: true, totals: false, comparison: false, conditionalTieBreak: false },
      playerId: 7, nhlPlayerId: 77, seasonId: 20262027, teamId: 6, targetKey: "GOALS", unit: "count",
      basis: "per_appearance", mean: 0.5, participationIntegrated: false,
      cutoffAt: context.asOf, issuedAt: context.asOf, expiresAt: "2026-10-08T00:00:00Z",
      sourceWatermark: "projection-a", scheduleRevision: "schedule-a", rosterRevision: "roster-a" };
    const contribution = { resolverVersion: "contribution-resolver-v1", game: identity, targetKey: "GOALS",
      inputs: { baseline: source, horizonDays: 21, calendarPolicy, servingEnabled: true,
        participation: { playerId: identity.playerId, nhlPlayerId: identity.nhlPlayerId, seasonId: identity.seasonId,
          gameId: identity.gameId, teamId: identity.teamId, scheduleRevision: identity.scheduleRevision,
          rosterRevision: identity.rosterRevision, basis: "appearance", probability: 0.5, revisionId: "participation",
          released: true, allowedUses: source.allowedUses, issuedAt: context.asOf, cutoffAt: context.asOf,
          expiresAt: source.expiresAt, model: modeledMetadata } },
      sourceKind: "baseline", conditionalMean: 0.5, unconditionalMean: null, unit: "count", basis: "per_appearance",
      allowedUses: { assignment: false, totals: false, comparison: false, conditionalTieBreak: true },
      sourceIds: ["rate-a"], participationRevisionId: null, blendWeight: null,
      exclusionReasons: ["missing_participation"], limitations: [] };
    const enriched = { ...snapshot, players: [{ id: "fhfh:7", nhlId: 77, nhlTeamId: 6, rosterRevision: "roster-a",
      name: "Test Player", teamAbbreviation: "CAR", eligiblePositions: ["C"], eligibilityVerified: true,
      playerClass: "skater", availability: "rostered", ownership: null, canDrop: null, holdValue: null, reserveEligibility: [] }],
      games: [{ id: "31", date: "2026-10-05", startsAt: identity.scheduledAt, scheduleRevision: "schedule-a",
        teamAbbreviation: "CAR", opponent: "NJD", home: true, status: "scheduled" }],
      forecasts: [{ playerId: "fhfh:7", gameId: "31", stats: { GOALS: null }, allowedUses: source.allowedUses, assignmentStats: { GOALS: 0.5 }, tieBreakStats: { GOALS: 0.5 },
        issuedContext: { version: "forge-issued-context-v1", playerId: "fhfh:7", gameId: "31",
          nhlPlayerId: identity.nhlPlayerId, seasonId: identity.seasonId, teamId: identity.teamId,
          scheduledAt: identity.scheduledAt, scheduleRevision: "schedule-a", rosterRevision: "roster-a",
          observedAt: context.asOf, scheduleSourceUpdatedAt: null, scheduleFetchedAt: context.asOf,
          identityUpdatedAt: context.asOf, membershipCreatedAt: [context.asOf] },
        conditionalStats: { GOALS: 0.5 }, appearanceProbability: null, contributions: { GOALS: contribution },
        sourceKind: "baseline", sourceWatermark: "captured-reads", cutoffAt: context.asOf, expiresAt: source.expiresAt,
        conditioning: "unconditional", startProbability: null, confirmedStart: false, revisionId: "rate-a",
        issuedAt: context.asOf, modelVersion: "baseline-v1", limitations: [] }],
      baselineSources: [source], participationSources: [contribution.inputs.participation], forecastManifest: { version: "planning-forecasts-v1", id: "manifest-a",
        calendarPolicy, acceptedNewsRevision: "opaque-news-receipts",
        seasonId: 20262027, asOf: context.asOf, scheduleRevision: "schedule-a", rosterRevision: "roster-a",
        issuedRevisionIds: [], baselineChecksum: "checksum-a", participationRevisionIds: ["participation"], participationChecksum: "c".repeat(64), requiredOpportunities: 1,
        forecastedOpportunities: 0, exclusionCounts: { missing_participation: 1 },
        exclusions: [{ gameId: "31", reasons: ["discovery_failed", "game_mismatch", "invalid_cutoff", "no_usable_target", "conflicting_forecast"] }] } };
    const parsed = saveWorkspaceSchema.safeParse({ workspace, snapshot: enriched, expectedVersion: null });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.snapshot?.baselineSources?.[0].sourceId).toBe("rate-a");
      expect(parsed.data.snapshot?.participationSources).toEqual(enriched.participationSources);
      expect(parsed.data.snapshot?.participationSources?.[0].allowedUses?.totals).toBe(false);
      expect(parsed.data.snapshot?.participationSources?.[0].model).toEqual(modeledMetadata);
      expect(parsed.data.snapshot?.forecastManifest?.participationRevisionIds).toEqual(["participation"]);
      expect(parsed.data.snapshot?.forecastManifest?.participationChecksum).toBe("c".repeat(64));
      expect(parsed.data.snapshot?.forecastManifest?.id).toBe("manifest-a");
      expect(parsed.data.snapshot?.forecastManifest?.calendarPolicy).toEqual(calendarPolicy);
      expect(parsed.data.snapshot?.forecastManifest?.acceptedNewsRevision).toBe("opaque-news-receipts");
      expect(parsed.data.snapshot?.forecastManifest?.exclusions).toEqual(enriched.forecastManifest.exclusions);
      expect(parsed.data.snapshot?.forecasts[0].allowedUses?.totals).toBe(false);
      expect(parsed.data.snapshot?.forecasts[0].assignmentStats?.GOALS).toBe(0.5);
      expect(parsed.data.snapshot?.forecasts[0].issuedContext).toEqual(enriched.forecasts[0].issuedContext);
      expect(parsed.data.snapshot?.forecasts[0].sourceWatermark).toBe("captured-reads");
      expect(parsed.data.snapshot?.forecasts[0].contributions?.GOALS.sourceIds).toEqual(["rate-a"]);
      expect(parsed.data.snapshot?.forecasts[0].contributions?.GOALS.inputs).toEqual(contribution.inputs);
    }
    const ratioLimited = { ...contribution,
      exclusionReasons: ["missing_participation", "incompatible_component_basis"] };
    expect(saveWorkspaceSchema.safeParse({ workspace, snapshot: { ...enriched,
      forecasts: [{ ...enriched.forecasts[0], contributions: { GOALS: ratioLimited } }] },
      expectedVersion: null }).success).toBe(true);
    expect(saveWorkspaceSchema.safeParse({ workspace, snapshot: { ...enriched,
      baselineSources: [{ ...source, privatePayload: "secret" }] }, expectedVersion: null }).success).toBe(false);
    expect(saveWorkspaceSchema.safeParse({ workspace, snapshot: { ...enriched,
      forecastManifest: { ...enriched.forecastManifest, calendarPolicy: { ...calendarPolicy, version: "unknown" } } },
      expectedVersion: null }).success).toBe(false);
    expect(saveWorkspaceSchema.safeParse({ workspace, snapshot: { ...enriched,
      forecasts: [{ ...enriched.forecasts[0], issuedContext: { ...enriched.forecasts[0].issuedContext, privatePayload: "secret" } }] },
      expectedVersion: null }).success).toBe(false);
    expect(saveWorkspaceSchema.safeParse({ workspace, snapshot: { ...enriched,
      forecasts: [{ ...enriched.forecasts[0], contributions: { GOALS: { ...contribution, privatePayload: "secret" } } }] }, expectedVersion: null }).success).toBe(false);
    expect(saveWorkspaceSchema.safeParse({ workspace, snapshot: { ...enriched,
      forecasts: [{ ...enriched.forecasts[0], contributions: { GOALS: { ...contribution,
        inputs: { ...contribution.inputs, baseline: { ...source, privatePayload: "secret" } } } } }] }, expectedVersion: null }).success).toBe(false);
    expect(saveWorkspaceSchema.safeParse({ workspace, snapshot: { ...enriched,
      forecasts: [{ ...enriched.forecasts[0], revisionId: "a".repeat(300) }] }, expectedVersion: null }).success).toBe(true);
    expect(saveWorkspaceSchema.safeParse({ workspace, snapshot: { ...enriched,
      forecasts: [{ ...enriched.forecasts[0], revisionId: "a".repeat(4097) }] }, expectedVersion: null }).success).toBe(false);
  });
  it("round-trips a native catalog baseline source carrying its admitted catalog expiry", () => {
    // contributionStore stamps catalogExpiresAt on every source served from a pinned catalog.
    const source = { kind: "baseline", sourceId: "native-rate", policyVersion: "native-baseline-v1", released: true,
      allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: true },
      playerId: 7, nhlPlayerId: 77, seasonId: 20262027, teamId: 6, gameId: 31, scheduledAt: "2026-10-05T23:00:00Z",
      targetKey: "GOALS", unit: "count", basis: "per_appearance", mean: 0.5, participationIntegrated: false,
      cutoffAt: context.asOf, issuedAt: context.asOf, expiresAt: "2026-10-05T22:00:00Z", catalogExpiresAt: "2026-10-05T21:59:59.999Z",
      sourceWatermark: "native-capture", scheduleRevision: "schedule-a", rosterRevision: "roster-a" };
    const parsed = saveWorkspaceSchema.parse({ workspace, snapshot: { ...snapshot, baselineSources: [source] }, expectedVersion: null });
    expect(parsed.snapshot?.baselineSources).toEqual([source]);
    for (const catalogExpiresAt of ["not-a-time", "2026-10-05", 1_760_000_000_000, null]) {
      expect(saveWorkspaceSchema.safeParse({ workspace, snapshot: { ...snapshot, baselineSources: [{ ...source, catalogExpiresAt }] },
        expectedVersion: null }).success).toBe(false);
    }
  });
  it.each([
    { numerator: 3 }, { numerator: NaN }, { denominator: Infinity }, { denominator: 0 }, { denominator: 21 },
    { numerator: 0.5 }, { inputHash: "bad" }, { evidenceHashes: ["bad"] },
    { selectedGameIds: [101, 101] }, { selectedGameIds: Array.from({ length: 21 }, (_, i) => i + 1) },
    { selectedGameIds: [0] }, { calibration: "calibrated" }, { probabilityStatus: "confirmed" }, { privatePayload: "secret" },
  ])("rejects malformed or promoted participation metadata %j", invalid => {
    const receipt = { playerId: 7, nhlPlayerId: 77, seasonId: 20262027, gameId: 31, teamId: 6,
      scheduleRevision: "schedule-a", rosterRevision: "roster-a", basis: "appearance", probability: 0.5,
      revisionId: "synthetic-participation", released: true, issuedAt: context.asOf, cutoffAt: context.asOf,
      expiresAt: "2026-10-08T00:00:00Z", model: { ...modeledMetadata, ...invalid } };
    expect(saveWorkspaceSchema.safeParse({ workspace, snapshot: { ...snapshot, participationSources: [receipt] }, expectedVersion: null }).success).toBe(false);
  });
  it.each(["goalie-roster-observation-start-frequency-v1", "goalie-rolling-14d-start-frequency-v1"])("round-trips a resolved goalie forecast carrying %s start metadata", version => {
    const startModel = { ...modeledMetadata, version, event: "official_starter",
      numerator: 3, denominator: 4, selectedGameIds: [101, 102, 103, 104] };
    const start = { playerId: 30, nhlPlayerId: 8480030, seasonId: 20262027, gameId: 31, teamId: 6,
      scheduledAt: "2026-10-05T23:00:00Z", scheduleRevision: "schedule-a", rosterRevision: "roster-a", basis: "start",
      probability: 0.75, revisionId: "goalie-start", released: true,
      allowedUses: { assignment: false, totals: true, comparison: false, conditionalTieBreak: false },
      issuedAt: context.asOf, cutoffAt: context.asOf, expiresAt: "2026-10-05T22:00:00Z", model: startModel };
    const goalieSnapshot = { ...snapshot, players: [{ id: "fhfh:30", nhlId: 8480030, name: "Test Goalie", teamAbbreviation: "CAR",
      eligiblePositions: ["G"], playerClass: "goalie", availability: "rostered", ownership: null, canDrop: null, holdValue: null, reserveEligibility: [] }],
      forecasts: [{ playerId: "fhfh:30", gameId: "31", stats: { SAVES_GOALIE: null }, conditioning: "unconditional",
        startProbability: 0.75, startParticipation: start, appearanceProbability: null,
        powerPlayRole: { value: null, status: "not_applicable", reason: "not_applicable", source: null },
        confirmedStart: false, revisionId: "goalie-rates", issuedAt: context.asOf, modelVersion: null, limitations: [] }],
      participationSources: [start] };
    const parsed = saveWorkspaceSchema.parse({ workspace, snapshot: goalieSnapshot, expectedVersion: null });
    expect(parsed.snapshot?.forecasts[0].startParticipation).toEqual(start);
    expect(parsed.snapshot?.participationSources).toEqual([start]);
    expect(saveWorkspaceSchema.safeParse({ workspace, snapshot: { ...goalieSnapshot, forecasts: [{ ...goalieSnapshot.forecasts[0],
      startParticipation: { ...start, model: { ...startModel, event: "confirmed_starter" } } }] }, expectedVersion: null }).success).toBe(false);
    expect(saveWorkspaceSchema.safeParse({ workspace, snapshot: { ...goalieSnapshot, forecasts: [{ ...goalieSnapshot.forecasts[0],
      startParticipation: { ...start, privatePayload: "secret" } }] }, expectedVersion: null }).success).toBe(false);
  });
  it("preserves explicit empty participation catalogs and nullable manifest checksums", () => {
    const parsed = saveWorkspaceSchema.parse({ workspace, snapshot: { ...snapshot, participationSources: [], forecastManifest: {
      version: "planning-forecasts-v1", id: "manifest", seasonId: 20262027, asOf: context.asOf,
      scheduleRevision: "schedule", rosterRevision: "roster", issuedRevisionIds: [], baselineChecksum: null,
      participationRevisionIds: [], participationChecksum: null, requiredOpportunities: 0, forecastedOpportunities: 0, exclusionCounts: {},
    } }, expectedVersion: null });
    expect(parsed.snapshot?.participationSources).toEqual([]);
    expect(parsed.snapshot?.forecastManifest?.participationRevisionIds).toEqual([]);
    expect(parsed.snapshot?.forecastManifest?.participationChecksum).toBeNull();
  });
  it("preserves manager-entered locked assignments", () => {
    const lockedAssignments = [{ date: "2026-10-01", playerId: "p", slotId: "G" }];
    const parsed = saveWorkspaceSchema.safeParse({ workspace: { ...workspace, lockedAssignments }, snapshot, expectedVersion: null });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.workspace.lockedAssignments).toEqual(lockedAssignments);
  });
  it("round-trips lock provenance in saved snapshots while retaining legacy untagged rows", () => {
    const lockedAssignments = [
      { date: "2026-10-01", playerId: "provider", slotId: "C#1" },
      { date: "2026-10-02", playerId: "manager", slotId: null, source: "manager" },
    ];
    const parsed = saveWorkspaceSchema.safeParse({ workspace, snapshot: { ...snapshot, lockedAssignments }, expectedVersion: null });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.snapshot?.lockedAssignments).toEqual(lockedAssignments);
    expect(saveWorkspaceSchema.safeParse({ workspace, snapshot: { ...snapshot, lockedAssignments: [{ ...lockedAssignments[1], source: "unverified-authority" }] }, expectedVersion: null }).success).toBe(false);
  });
  it("preserves explicit waiver policy and spend without inventing missing values", () => {
    const waiverRules = { ...rules, waivers: { mode: "budget", remainingBudget: 35 } };
    const waiverStep = { id: "bid", type: "add", playerId: "p", at: context.asOf, effectiveAt: context.asOf, conditional: false, waiverSpend: 7, dependsOn: [] };
    const parsed = saveWorkspaceSchema.safeParse({ workspace: { ...workspace, rules: waiverRules, intent: { ...workspace.intent, steps: [waiverStep] } }, snapshot: { ...snapshot, rules: waiverRules }, expectedVersion: null });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.workspace.rules.waivers).toEqual(waiverRules.waivers);
      expect(parsed.data.workspace.intent.steps[0].waiverSpend).toBe(7);
    }
    expect(saveWorkspaceSchema.safeParse({ workspace: { ...workspace, rules: { ...rules, waivers: { mode: "unknown", remainingBudget: null } } }, snapshot: null, expectedVersion: null }).success).toBe(true);
    expect(saveWorkspaceSchema.safeParse({ workspace: { ...workspace, rules: { ...rules, waivers: { mode: "budget", remainingBudget: -1 } } }, snapshot: null, expectedVersion: null }).success).toBe(false);
  });
  it("orders reset and lock instants by absolute time across DST offsets", () => {
    const period = { id: "dst", start: "2026-11-01T01:30:00-04:00", end: "2026-11-01T01:15:00-05:00", remaining: 1, source: "manager" };
    const parse = (start: string, end: string, lockAt: string) => saveWorkspaceSchema.safeParse({ workspace: { ...workspace, rules: { ...rules, periods: [{ ...period, start, end }], lineupPeriods: [{ id: "dst", start, end, lockAt }] } }, snapshot: null, expectedVersion: null });
    expect(parse(period.start, period.end, "2026-11-01T01:45:00-04:00").success).toBe(true);
    expect(parse(period.end, period.start, period.end).success).toBe(false);
    expect(parse(period.start, period.end, "2026-11-01T01:30:00-05:00").success).toBe(false);
  });
  it("rejects account fields and cross-context snapshots", () => {
    expect(saveWorkspaceSchema.safeParse({ workspace: { ...workspace, userId: "other" }, snapshot, expectedVersion: null }).success).toBe(false);
    expect(saveWorkspaceSchema.safeParse({ workspace, snapshot: { ...snapshot, context: { ...context, teamId: "other" } }, expectedVersion: 1 }).success).toBe(false);
  });
  it("rejects invalid context ranges and query account spoofing", () => {
    const query = { provider: "manual", seasonId: 20262027, leagueId: "league", teamId: "team", startDate: "2026-10-07", endDate: "2026-10-01" };
    expect(workspaceQuerySchema.safeParse(query).success).toBe(false);
    expect(workspaceQuerySchema.safeParse({ ...query, endDate: "2026-10-07", userId: "other" }).success).toBe(false);
    expect(workspaceQuerySchema.safeParse({ ...query, startDate: "2026-02-31", endDate: "2026-10-07" }).success).toBe(false);
    expect(workspaceQuerySchema.safeParse({ ...query, startDate: "2026-10-01", endDate: "2027-10-03" }).success).toBe(false);
  });
  describe("per-player ownership evidence", () => {
    const player = { id: "p1", nhlId: 8478402, name: "Connor McDavid", teamAbbreviation: "EDM", eligiblePositions: ["C"], playerClass: "skater",
      availability: "rostered", ownership: 99, canDrop: false, holdValue: null, reserveEligibility: [] };
    const evidence = { value: 99, observedOn: "2026-10-18", provider: "yahoo", status: "stale" };
    const save = (row: unknown) => ({ workspace: { ...workspace, manualPlayers: [row] }, snapshot: { ...snapshot, players: [row] }, expectedVersion: null });

    it("parses saves without it unchanged and round-trips it exactly when present", () => {
      const legacy = saveWorkspaceSchema.parse(save(player));
      expect(legacy.workspace.manualPlayers[0]).toEqual(player);
      expect(legacy.snapshot?.players[0]).not.toHaveProperty("ownershipEvidence");
      for (const ownershipEvidence of [evidence, { value: null, observedOn: null, provider: null, status: "unknown" },
        { value: 0, observedOn: "2026-10-20", provider: "yahoo", status: "fresh" }, { value: 100, observedOn: "2026-10-20", provider: "yahoo", status: "fresh" }]) {
        const parsed = saveWorkspaceSchema.parse(save({ ...player, ownershipEvidence }));
        expect(parsed.workspace.manualPlayers[0]).toEqual({ ...player, ownershipEvidence });
        expect(parsed.snapshot?.players[0]).toEqual({ ...player, ownershipEvidence });
      }
    });

    it.each([
      { value: 100.5 }, { value: -1 }, { value: Number.NaN }, { value: "99" },
      { observedOn: "2026-13-01" }, { observedOn: "10/18/2026" }, { observedOn: "2026-10-18T00:00:00Z" },
      { provider: "espn" }, { provider: "" }, { status: "old" }, { status: null },
      { source: "yahoo" },
    ])("rejects invalid ownership evidence %j", (change) => {
      expect(saveWorkspaceSchema.safeParse(save({ ...player, ownershipEvidence: { ...evidence, ...change } })).success).toBe(false);
    });

    it.each(["value", "observedOn", "provider", "status"])("rejects ownership evidence missing %s", (key) => {
      const { [key as keyof typeof evidence]: _dropped, ...partial } = evidence;
      expect(saveWorkspaceSchema.safeParse(save({ ...player, ownershipEvidence: partial })).success).toBe(false);
      expect(saveWorkspaceSchema.safeParse(save({ ...player, ownershipEvidence: null })).success).toBe(false);
    });
  });
  it("rejects impossible probabilities, ownership, costs and rule periods", () => {
    const invalidRules = { ...rules, acquisitionCost: -1 };
    expect(saveWorkspaceSchema.safeParse({ workspace: { ...workspace, rules: invalidRules }, snapshot, expectedVersion: null }).success).toBe(false);
    const invalidPeriod = { ...rules, lineupPeriods: [{ id: "bad", start: "2026-10-08T00:00:00Z", end: "2026-10-01T00:00:00Z", lockAt: null }] };
    expect(saveWorkspaceSchema.safeParse({ workspace: { ...workspace, rules: invalidPeriod }, snapshot, expectedVersion: null }).success).toBe(false);
    const badProbability = { ...snapshot, forecasts: [{ playerId: "p", gameId: "g", stats: {}, conditioning: "unconditional", startProbability: 1.2, confirmedStart: false, revisionId: "r", issuedAt: context.asOf, modelVersion: null, limitations: [] }] };
    expect(saveWorkspaceSchema.safeParse({ workspace, snapshot: badProbability, expectedVersion: null }).success).toBe(false);
    const badOwnership = { ...workspace, manualPlayers: [{ id: "p", nhlId: null, name: "Player", teamAbbreviation: null, eligiblePositions: [], playerClass: "skater", availability: "unknown", ownership: 101, canDrop: null, holdValue: null, reserveEligibility: [] }] };
    expect(saveWorkspaceSchema.safeParse({ workspace: badOwnership, snapshot, expectedVersion: null }).success).toBe(false);
  });
});
