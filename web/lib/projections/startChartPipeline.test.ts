import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve as resolvePath } from "node:path";
import { execFileSync } from "node:child_process";
import { captureProjectionInputs, interceptProjectionQuery, projectionInputHash, replayProjectionInputs } from "./inputCapture";
import { interceptProjectionQuery as interceptSharedQuery } from "./queryCaptureHook";
import { fantasySourcePerGame, buildSeasonHistory, blendSeasonBootstrap, bootstrapSkaterLine, bootstrapGoalieLine,
  averageBootstrapStats, type SeasonBootstrap } from "./seasonBootstrap";
import { capturedGoalieStarts, projectionWritesHash } from "./gameRevisions";
import { applyDailyBoardEvidence, resolveDailyBoardEvidence, type BoardLineupEvidence } from "./dailyBoardEvidence";
import { roleTagFromRosterEvent, allocatePpToiByTeamOpportunity } from "./stages/skater-stage";
import { attachPreviousBoardForecast, boardGoalieForecast, integrateBoardParticipation, parseBoardScoringRequest, scoreBoardStats, scoreStarterBoardPayload } from "./starterBoardScoring";
import { normalizeStartChartResponse } from "./startChartContract";
import { claimStarterBoardJobs, computeStarterBoardJob, dispatchStarterBoardJobs, drainStarterBoardQueue, STARTER_BOARD_LATENCY } from "./starterBoardQueue";
import { starterBoardCanaryGameIds, starterBoardFlags, starterBoardScopeAllowed } from "./starterBoardFlags";
import { exportFrozenBoardForecasts, readFrozenBoardSource, type FrozenBoardSource } from "./starterBoardDataset";
import { optimizeToday, rankTodayStreams, type TodayPlayer, type TodayStream } from "./starterBoardPersonalization";
import * as forgeRunner from "./run-forge-projections";
import { buildStarterBoardOperationsReport, type BoardOperationalEvent } from "./starterBoardOperations";
import { boardComponentDecisions, boardReviewSchema, buildBoardValidationDisclosure, normalizeBoardValidationDisclosure,
  type BoardValidationPolicy, type BoardValidationReview } from "./starterBoardValidation";

describe("immutable daily-board forecast exports", () => {
  const fixture = (): FrozenBoardSource => {
    const game = { id: 1, date: "2026-10-10", type: 2, homeTeamId: 10, awayTeamId: 8 };
    const snapshot: any = { version: "forge-inputs-v1", runId: "run-1", slateDate: game.date, inputCutoff: "2026-10-10T20:00:00Z",
      decisionAsOf: "2026-10-10T20:00:02Z", capturedAt: "2026-10-10T20:00:03Z", codeVersion: "commit-1", modelMode: "baseline",
      horizonGames: 1, gameIds: [1], replayClassification: "captured_live", outputHash: "output", goalieStarts: [],
      reads: [{ request: [{ method: "from", args: ["games"] }], receivedAt: "2026-10-10T20:00:01Z", result: { data: [game], error: null } },
        { request: [{ method: "from", args: ["players"] }], receivedAt: "2026-10-10T20:00:02Z",
          result: { data: [{ id: 1, team_id: 10, position: "C" }, { id: 3, team_id: 8, position: "G" }], error: null } }] };
    return { game, frozen: { game_id: 1, revision_id: "revision-1", scheduled_start_at: "2026-10-10T23:00:00Z", frozen_at: "2026-10-10T23:01:00Z" },
      observation: { id: "snapshot-1", provider: "forge", dataset_key: "forge-run-inputs-v1", entity_key: "run-1",
        available_at: snapshot.capturedAt, payload_hash: projectionInputHash(snapshot), payload: snapshot },
      revision: { id: "revision-1", game_id: 1, run_id: "run-1", input_snapshot_id: "snapshot-1", slate_date: game.date,
        decision_as_of: snapshot.decisionAsOf, published_at: "2026-10-10T20:00:04Z", payload: { codeVersion: "commit-1", modelMode: "baseline",
          players: [{ run_id: "run-1", game_id: 1, horizon_games: 1, player_id: 1, team_id: 10,
            proj_goals_es: 0.2, proj_goals_pp: 0.1, proj_goals_pk: 0, proj_assists_es: 0.3, proj_assists_pp: 0.2, proj_assists_pk: 0,
            proj_shots_es: 2, proj_shots_pp: 0.5, proj_shots_pk: 0.1, proj_hits: 2, proj_blocks: 1, proj_pim: null,
            proj_toi_es_seconds: 900, proj_toi_pp_seconds: 120, proj_toi_pk_seconds: 60,
            uncertainty: { model: { skater_selection: { production_conditioning: "conditional_playing" } } } }],
          goalies: [{ run_id: "run-1", game_id: 1, horizon_games: 1, team_id: 8, goalie_id: 3, uncertainty: { daily_board_candidates: [
            { playerId: 3, startingProbability: 0.25, conditional: { SHOTS_AGAINST_GOALIE: 30, SAVES_GOALIE: 28,
              GOALS_AGAINST_GOALIE: 2, WINS_GOALIE: 0.6, SHUTOUTS_GOALIE: 0.1 } },
          ] } }],
        } } };
  };
  it("exports the frozen checkpoint with serving semantics and no invented comparators", () => {
    const source = fixture();
    const output = exportFrozenBoardForecasts(source);
    expect(exportFrozenBoardForecasts(source)).toEqual(output);
    expect(output.rows.find((row) => row.player_id === 1 && row.target_key === "FANTASY_POINTS")).toMatchObject({
      estimates: { forge: 3.37 }, conditioning: "conditional_playing", revision_id: "revision-1",
      issued_at: "2026-10-10T20:00:04Z", maximum_feature_available_at: "2026-10-10T20:00:02.000Z",
    });
    expect(output.rows.find((row) => row.player_id === 3 && row.target_key === "FANTASY_POINTS" && row.conditioning === "unconditional")?.estimates.forge).toBe(1.575);
    expect(output.rows.filter((row) => row.target_key === "goalie_start")).toHaveLength(1);
    expect(output.rows.some((row) => row.player_id === 1 && row.conditioning === "unconditional")).toBe(false);
    expect(output.manifest).toMatchObject({ completeParticipationCandidatePool: false, promotionEligible: false,
      exclusions: expect.arrayContaining([{ playerId: 1, target: "participation", reason: "participation_estimate_missing" }]) });
    expect(output.rows.every((row) => !Object.hasOwn(row, "outcome") && Object.keys(row.estimates).join() === "forge")).toBe(true);
  });
  it("excludes missing or conflicting pregame membership instead of using postgame teams", () => {
    const source = fixture();
    (source.observation.payload.reads[1].result as any).data.push({ id: 1, team_id: 8 });
    source.observation.payload_hash = projectionInputHash(source.observation.payload);
    const output = exportFrozenBoardForecasts(source);
    expect(output.rows.some((row) => row.player_id === 1)).toBe(false);
    expect(output.manifest.exclusions).toContainEqual({ playerId: 1, reason: "pregame_membership_missing_or_conflicting" });
  });
  it("rejects changed snapshots, substituted revisions, reconstructions, and late publication", () => {
    for (const mutate of [
      (source: FrozenBoardSource) => { source.observation.payload.codeVersion = "changed"; },
      (source: FrozenBoardSource) => { source.frozen.revision_id = "newer-revision"; },
      (source: FrozenBoardSource) => { source.observation.payload.replayClassification = "historical_reconstruction"; source.observation.payload_hash = projectionInputHash(source.observation.payload); },
      (source: FrozenBoardSource) => { source.revision.published_at = "2026-10-10T23:00:00Z"; },
      (source: FrozenBoardSource) => { source.observation.payload.reads[0].receivedAt = "2026-10-10T21:00:00Z"; source.observation.payload_hash = projectionInputHash(source.observation.payload); },
    ]) { const source = fixture(); mutate(source); expect(() => exportFrozenBoardForecasts(source)).toThrow(); }
  });
  it("reads only the explicitly frozen revision and its source observation", async () => {
    const source = fixture();
    const records: Record<string, unknown> = { games: source.game, forge_final_pregame_revisions: source.frozen,
      forge_game_revisions: source.revision, player_forecast_source_observations: source.observation };
    const filters: unknown[] = [];
    const from = vi.fn((table: string) => {
      const query: any = { select: () => query, eq: (key: string, value: unknown) => { filters.push([table, key, value]); return query; },
        single: async () => ({ data: records[table], error: null }) };
      return query;
    });
    expect(await readFrozenBoardSource({ from }, "2026-10-10", 1)).toEqual(source);
    expect(from.mock.calls.map(([table]) => table)).toEqual(Object.keys(records));
    expect(filters).toContainEqual(["forge_game_revisions", "id", "revision-1"]);
    expect(filters).toContainEqual(["player_forecast_source_observations", "id", "snapshot-1"]);
    from.mockClear();
    await expect(readFrozenBoardSource({ from }, "2026-02-01", 1)).rejects.toThrow("holdout");
    expect(from).not.toHaveBeenCalled();
  });
  it("writes a private CLI artifact and verifies exact retries without rewriting", () => {
    const directory = mkdtempSync(join(tmpdir(), "starter-board-export-"));
    try {
      const input = join(directory, "source.json"), output = join(directory, "output");
      writeFileSync(input, JSON.stringify(fixture()));
      const args = [require.resolve("ts-node/dist/bin"), "--transpile-only", "--compiler-options", '{"module":"commonjs","moduleResolution":"node"}',
        resolvePath("scripts/export-starter-board-forecasts.ts"), "2026-10-10", "1", output, "--source", input];
      const options = { encoding: "utf8" as const, env: { ...process.env, NODE_PATH: process.cwd() }, timeout: 10000 };
      const first = JSON.parse(execFileSync(process.execPath, args, options));
      expect(first).toMatchObject({ sourceOrigin: "provided_capture", revisionId: "revision-1", evaluatedPlayers: 2, promotionEligible: false });
      const before = statSync(join(output, "manifest.json")).mtimeMs;
      expect(JSON.parse(execFileSync(process.execPath, args, options))).toEqual(first);
      expect(statSync(join(output, "manifest.json")).mtimeMs).toBe(before);
      expect(statSync(output).mode & 0o777).toBe(0o700);
      expect(statSync(join(output, "source.json")).mode & 0o777).toBe(0o600);
      const manifest = JSON.parse(readFileSync(join(output, "manifest.json"), "utf8"));
      expect(manifest.files["forecasts.jsonl"]).toMatch(/^[a-f0-9]{64}$/);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  }, 20000);
});

describe("Starter Board release and review disclosure", () => {
  const policy: BoardValidationPolicy = { version: "starter-board-policy-v1", featureDefinitionHash: "a".repeat(64),
    candidateRuleHash: "b".repeat(64), refitPolicyHash: "c".repeat(64), components: [
      { component: "participation", baselineId: "FORGE", primaryTarget: "participation", primaryMetric: "brier", protectedMetrics: [{ target: "participation", metric: "log_loss" }], probability: true },
    ] };
  const review = (): BoardValidationReview => ({ contractVersion: "starter-board-review-v1", evaluationVersion: "daily-v1",
    policyHash: "a".repeat(64), dataHash: "b".repeat(64), forecastHash: "c".repeat(64), asOf: "2026-11-05T20:00:00Z",
    windowStart: "2026-10-07", windowEnd: "2026-11-05", evidenceClass: "captured_live", gameType: "regular_season",
    settledGames: 200, settledSlates: 30, settledForecasts: 1000, metrics: [{ target: "participation", metric: "brier", value: 0.1, samples: 1000 }],
    comparisons: [{ component: "participation", candidateId: "logistic-v1", baselineId: "FORGE", games: 200, slates: 30,
      primaryTarget: "participation", primaryMetric: "brier", baselineLoss: 0.2, candidateLoss: 0.19, improvementLow95: 0.002, improvementHigh95: 0.02,
      secondary: [{ target: "participation", metric: "log_loss", relativeDegradation: 0.01, lower95: -0.01, upper95: 0.015 }], positiveLabels: 800, negativeLabels: 200 }],
  });
  it("requires all frozen policy, sample, paired improvement and probability-label gates", () => {
    expect(boardComponentDecisions(review(), policy)[0].decision).toBe("eligible_for_promotion_review");
    for (const patch of [{ games: 199 }, { slates: 29 }, { candidateLoss: 0.199 }, { improvementLow95: 0 }, { negativeLabels: 0 },
      { primaryMetric: "mae" as const }, { baselineId: "different-baseline" }, { primaryTarget: "different-target" },
      { secondary: [{ target: "participation", metric: "mae" as const, relativeDegradation: 0, lower95: 0, upper95: 0 }] },
      { secondary: [{ target: "participation", metric: "log_loss" as const, relativeDegradation: 0.03, lower95: 0.01, upper95: 0.04 }] }]) {
      const report = review(); report.comparisons[0] = { ...report.comparisons[0], ...patch };
      expect(boardComponentDecisions(report, policy)[0].decision).toBe("retain_serving_component");
    }
    expect(boardComponentDecisions({ ...review(), evidenceClass: "historical_reconstruction" }, policy)[0].decision).toBe("retain_serving_component");
    expect(boardComponentDecisions({ ...review(), gameType: "preseason" }, policy)[0].decision).toBe("retain_serving_component");
  });
  it("rejects protected holdout reuse and inconsistent report evidence", () => {
    expect(boardReviewSchema.safeParse({ ...review(), windowStart: "2026-01-02" }).success).toBe(false);
    expect(boardReviewSchema.safeParse({ ...review(), settledGames: 199 }).success).toBe(false);
    expect(boardReviewSchema.safeParse({ ...review(), windowEnd: "2026-11-31" }).success).toBe(false);
    expect(boardReviewSchema.safeParse(review()).success).toBe(true);
  });
  it("does not turn elapsed time or live slates into settled samples or calibrated intervals", () => {
    const result = buildBoardValidationDisclosure({ startedOn: "2026-10-07", liveRegularSlates: 35 }, "2026-11-06");
    expect(result).toMatchObject({ status: "collecting_evidence", elapsedDays: 31, evaluatedGames: null,
      latestReview: null, distributionStatus: "means_only_unvalidated" });
    expect(result.milestones).toEqual([{ day: 14, dueOn: "2026-10-20", status: "due" }, { day: 30, dueOn: "2026-11-05", status: "due" }]);
    expect(buildBoardValidationDisclosure(null, "2026-11-06").milestones.every((row) => row.status === "awaiting_launch")).toBe(true);
  });
  it("publishes safe measured fields without leaking private registry/artifact data or activating challengers", () => {
    const result = buildBoardValidationDisclosure({ startedOn: "2026-10-07", liveRegularSlates: 30,
      release: { id: "release-1", release_key: "board-v1", code_version: "sha-1", model_identity: "FORGE", evaluation_version: "daily-v1",
        policy_hash: "a".repeat(64), policy, privatePath: "/private/dataset" },
      reviews: [{ id: "review-1", kind: "day30", report_hash: "d".repeat(64), report: review(), secret: "private-token" }],
    }, "2026-11-06");
    expect(result).toMatchObject({ status: "review_available", evaluatedGames: 200, evaluatedSlates: 30, evaluatedForecasts: 1000,
      servingDecision: "forge_retained_pending_review", distributionStatus: "means_only_unvalidated" });
    expect(result.milestones[1].status).toBe("published");
    expect(JSON.stringify(result)).not.toMatch(/private-token|privatePath|featureDefinitionHash/);
    expect(normalizeBoardValidationDisclosure({ ...result, secret: "private-token" })).toEqual(result);
    expect(normalizeBoardValidationDisclosure({ status: "review_available", evaluatedGames: -1 })?.status).toBe("unavailable");
  });
});

describe("Starter Board operational evidence", () => {
  const at = (seconds: number) => new Date(Date.parse("2026-10-10T12:00:00Z") + seconds * 1000).toISOString();
  const event = (overrides: Partial<BoardOperationalEvent> = {}): BoardOperationalEvent => ({
    eventId: "event-1", newsKey: overrides.eventId ?? "event-1", changeKey: overrides.eventId ?? "event-1", gameId: 1, slateDate: "2026-10-10", gameType: 2, queueVersion: 1, categories: ["pp"],
    sourcePublishedAt: at(-90), receivedAt: at(-60), acceptedAt: at(0), firstDispatchedAt: at(30),
    successfulDispatchAt: at(30), inputCutoff: at(31), calculationStartedAt: at(32), calculationCompletedAt: at(150),
    publishedAt: at(152), browserRenderedAt: at(175), visibilityReceivedAt: at(180), revisionId: "revision-1", runId: "run-1", ...overrides,
  });
  const report = (events: BoardOperationalEvent[], asOf = at(600)) => buildStarterBoardOperationsReport({ events, from: at(0), until: asOf, asOf });
  it("separates provider delay from acceptance and uses a conservative visibility receipt", () => {
    const result = report([event()]);
    expect(result.events[0]).toMatchObject({ providerDelayMs: 30_000, receiptToAcceptanceMs: 60_000,
      acceptanceToVisibleUpperBoundMs: 180_000, calculationMs: 118_000, status: "delivered_on_time" });
    expect(result.cohorts.regularSeason.acceptanceToVisibleUpperBoundMs).toEqual({ samples: 1, p50: 180_000, p95: 180_000, p99: 180_000 });
    expect(result.reviewStatus).toBe("insufficient_operational_evidence");
  });
  it("counts missing visibility as a failure after 300 seconds and retains every breach", () => {
    const missing = event({ eventId: "missing", visibilityReceivedAt: null, browserRenderedAt: null });
    const late = event({ eventId: "late", visibilityReceivedAt: at(301) });
    const result = report([event(), missing, late]);
    expect(result.cohorts.regularSeason).toMatchObject({ acceptedEvents: 3, evaluatedEvents: 3, onTimeShare: 1 / 3,
      lateEvents: 1, unobservedOverdueEvents: 1, acceptanceToVisibleUpperBoundMs: { samples: 2, p95: 301_000 } });
    expect(result.breaches.map((row) => row.eventId)).toEqual(["late", "missing"]);
    expect(report([missing], at(299)).cohorts.regularSeason).toMatchObject({ pendingEvents: 1, evaluatedEvents: 0, onTimeShare: null });
    expect(report([missing], at(300)).cohorts.regularSeason.unobservedOverdueEvents).toBe(1);
  });
  it("cannot pass with empty, preseason-only or missing-category evidence", () => {
    expect(report([]).cohorts.regularSeason.measuredTargetMet).toBe(false);
    const rows = Array.from({ length: 100 }, (_, index) => event({ eventId: String(index), categories: ["pp", "goalie", "availability"] }));
    expect(report(rows.map((row) => ({ ...row, gameType: 1 }))).reviewStatus).toBe("insufficient_operational_evidence");
    expect(report(rows.map((row) => ({ ...row, categories: ["pp"] }))).reviewStatus).toBe("insufficient_operational_evidence");
    expect(report(rows).reviewStatus).toBe("operational_target_met_for_window");
    expect(report(rows).cohorts.regularSeason.byCategory.pp).toBe(100);
  });
  it("keeps unknown provider time and impossible timing explicit without dropping events", () => {
    const result = report([event({ sourcePublishedAt: null }), event({ eventId: "invalid", visibilityReceivedAt: at(100) })]);
    expect(result.events.find((row) => row.eventId === "event-1")?.providerDelayMs).toBeNull();
    expect(result.cohorts.regularSeason).toMatchObject({ acceptedEvents: 2, evaluatedEvents: 2, invalidTimingEvents: 1, onTimeShare: 0.5 });
    expect(result.breaches[0].timingIssues).toContain("invalid_visibility_sequence");
  });
  it("does not turn reposts into independent samples or reset their first acceptance deadline", () => {
    const rows = Array.from({ length: 100 }, (_, index) => event({ eventId: String(index), newsKey: "same-report", changeKey: "same-assertions",
      acceptedAt: at(index), firstDispatchedAt: at(index + 30), successfulDispatchAt: at(index + 30), inputCutoff: at(index + 31),
      calculationStartedAt: at(index + 32), calculationCompletedAt: at(index + 150), publishedAt: at(index + 152),
      visibilityReceivedAt: at(350), categories: ["pp", "goalie", "availability"] }));
    const result = report(rows);
    expect(result.cohorts.regularSeason).toMatchObject({ acceptedEvents: 100, uniqueNewsEvents: 1, repostEvents: 99,
      evaluatedEvents: 1, onTimeShare: 0, sampleGateMet: false });
    expect(result.breaches).toHaveLength(1);
    expect(result.breaches[0].eventId).toBe("0");
    expect(report(rows.map((row) => ({ ...row, newsKey: null }))).reviewStatus).toBe("insufficient_operational_evidence");
    const changes = report(rows.map((row) => ({ ...row, changeKey: row.eventId })));
    expect(changes.cohorts.regularSeason).toMatchObject({ uniqueNewsEvents: 100, repostEvents: 0, independentReports: 1, sampleGateMet: false });
  });
  it("is deterministic, rejects duplicate rows, and enforces declared cutoff windows", () => {
    const rows = [event(), event({ eventId: "event-2", queueVersion: 2 })];
    expect(report(rows)).toEqual(report([...rows].reverse()));
    expect(() => report([event(), event()])).toThrow("Duplicate");
    expect(() => report([event({ acceptedAt: at(-1) })])).toThrow("outside");
    expect(() => report([event({ acceptedAt: "2026-10-10T12:00:00" })])).toThrow("timezone");
    expect(report([event({ visibilityReceivedAt: at(700) })]).cohorts.regularSeason.invalidTimingEvents).toBe(1);
  });
});

describe("today-only eligible lineup assignment", () => {
  const player = (id: string, value: number, eligiblePositions: string[], overrides: Partial<TodayPlayer> = {}): TodayPlayer => ({
    id, value, eligiblePositions, selectedPosition: "BN", lock: "unlocked", valueBasis: "unconditional", identityVerified: true, canDrop: true, ...overrides,
  });
  const slots = [{ id: "C1", position: "C" }, { id: "LW1", position: "LW" }];
  it("finds the maximum across flexible eligibility instead of greedily filling slots", () => {
    const roster = [player("flex", 10, ["C", "LW"]), player("center", 9, ["C"]), player("wing", 1, ["LW"])];
    const result = optimizeToday({ slots, roster });
    expect(result.status).toBe("complete");
    expect(result.expectedValue).toBe(19);
    expect(result.assignments.map((row) => row.playerId)).toEqual(["center", "flex"]);
    expect(optimizeToday({ slots, roster: [...roster].reverse() })).toEqual(result);
  });
  it("preserves locked active/bench players and inactive slots, and excludes goalies from Util", () => {
    const result = optimizeToday({ slots: [...slots, { id: "U1", position: "Util" }], roster: [
      player("locked", 1, ["C"], { selectedPosition: "C", lock: "locked" }),
      player("locked-bench", 20, ["C", "LW"], { lock: "locked" }),
      player("injured", 30, ["LW"], { selectedPosition: "IR" }), player("goalie", 50, ["G"]),
      player("wing", 4, ["LW"]), player("defender", 3, ["D"]),
    ] });
    expect(result.expectedValue).toBe(8);
    expect(result.assignments.find((row) => row.id === "C1")).toMatchObject({ playerId: "locked", preserved: true });
    expect(result.preservedPlayers.map((row) => row.playerId)).toEqual(["injured", "locked", "locked-bench"]);
  });
  it("labels incomplete calculations and preserves active players with missing estimates or lock rules", () => {
    const result = optimizeToday({ slots, roster: [
      player("unknown-production", 10, ["C"], { selectedPosition: "C", valueBasis: "conditional" }),
      player("unknown-lock", 3, ["LW"], { selectedPosition: "LW", lock: "unknown" }), player("replacement", 50, ["C", "LW"]),
    ] });
    expect(result.status).toBe("incomplete");
    expect(result.expectedValue).toBeNull();
    expect(result.assignments.every((row) => row.preserved)).toBe(true);
  });
  it("computes incremental streaming gain with a legal drop and refuses inferred free agents", () => {
    const roster = [player("center", 9, ["C"]), player("wing", 1, ["LW"])];
    const candidate: TodayStream = { ...player("new-wing", 5, ["LW"]), availability: "free_agent", usableToday: true };
    const args = { slots, roster, openRosterSpots: 0, candidates: [candidate] };
    expect(rankTodayStreams(args)[0]).toMatchObject({ incrementalValue: 4, dropPlayerId: "wing" });
    for (const availability of ["waivers", "rostered", "unknown"] as const) {
      expect(rankTodayStreams({ ...args, candidates: [{ ...candidate, availability }] })[0].incrementalValue).toBeNull();
    }
    expect(rankTodayStreams({ ...args, candidates: [{ ...candidate, usableToday: null }] })[0].incrementalValue).toBeNull();
    expect(rankTodayStreams({ ...args, roster: roster.map((row) => ({ ...row, canDrop: false })) })[0].incrementalValue).toBeNull();
  });
  it("matches an exhaustive small-roster oracle for multi-position, negative and tied values", () => {
    const testSlots = [...slots, { id: "U1", position: "Util" }];
    for (let sample = 0; sample < 30; sample++) {
      const roster = Array.from({ length: 5 }, (_, index) => player(String(index), ((sample * 7 + index * 3) % 13) - 3,
        index % 2 ? ["C", "LW", "Util"] : ["C", "Util"]));
      const enumerate = (slot: number, used: Set<string>): number => {
        if (slot === testSlots.length) return 0;
        return Math.max(enumerate(slot + 1, used), ...roster.filter((row) => !used.has(row.id)
          && row.eligiblePositions.includes(testSlots[slot].position)).map((row) => row.value! + enumerate(slot + 1, new Set([...used, row.id]))));
      };
      expect(optimizeToday({ slots: testSlots, roster }).expectedValue).toBe(enumerate(0, new Set()));
    }
  });
});

function query(table: string, result: unknown, live = vi.fn()) {
  return interceptProjectionQuery("from", [table], () => {
    live();
    const builder: any = {
      select: () => builder, eq: () => builder, upsert: () => builder,
      then: (resolve: any) => Promise.resolve(result).then(resolve),
    };
    return builder;
  });
}

describe("Starter Board season-opening priors", () => {
  const prior: SeasonBootstrap = { previous: { GOALS: 0.5, ASSISTS: 0.7, PP_GOALS: 0.1, PP_POINTS: 0.3, SHOTS_ON_GOAL: 3 },
    fantasy: { GOALS: 0.8, ASSISTS: 1, PP_GOALS: 0.2, PP_POINTS: 0.5, SHOTS_ON_GOAL: 4 },
    currentSeasonGames: 0, historyGames: 20, sourceIds: ["ag_skaters"], sourceRowIds: ["source-row"], limitations: [] };
  it("converts source totals using projected games and preserves per-game TOI and missing categories", () => {
    expect(fantasySourcePerGame({ Games_Played: 60, Goals: 30, Assists: 48, Time_on_Ice_Per_Game: 20 }, "ag_skaters"))
      .toMatchObject({ GOALS: 0.5, ASSISTS: 0.8, TIME_ON_ICE_PER_GAME: 20 });
    expect(fantasySourcePerGame({ Games_Played: 0, Goals: 30 }, "ag_skaters")).toBeNull();
    expect(fantasySourcePerGame({ Games_Played: 60, Goals: null }, "ag_skaters")?.GOALS).toBeUndefined();
    expect(averageBootstrapStats([{ GOALS: 0.4, HITS: null }, { GOALS: 0.8, HITS: 2 }]))
      .toEqual({ GOALS: expect.closeTo(0.6), HITS: 2 });
  });
  it("takes the last N previous-season regular appearances across trades, excluding future games and nonappearances", () => {
    const row = (id: number, date: string, seasonId: number, goals: number, extra: any = {}) => ({
      goals, assists: 1, toi: "20:00", powerPlayToi: "02:00", ...extra,
      games: { id, date, seasonId, type: 2, ...extra.games } });
    const result = buildSeasonHistory([
      row(1, "2026-04-10", 20252026, 10, { teamId: 1 }),
      row(2, "2026-04-11", 20252026, 1, { teamId: 2 }),
      row(3, "2026-04-12", 20252026, 3, { teamId: 2 }),
      row(4, "2026-04-13", 20252026, 100, { games: { type: 3 } }),
      row(5, "2026-10-01", 20262027, 1), row(6, "2026-10-02", 20262027, 100),
      row(7, "2026-10-01", 20262027, 0, { toi: "00:00" }),
    ], 20262027, "2026-10-02", "skater", 2);
    expect(result).toMatchObject({ historyGames: 2, currentSeasonGames: 1, previous: { GOALS: 2, PP_TOI: 2 } });
    const goalies = buildSeasonHistory([
      { ...row(8, "2026-04-10", 20252026, 0), saveShotsAgainst: "28/30", goalsAgainst: 2, toi: "60:00" },
      { ...row(9, "2026-04-11", 20252026, 0), saveShotsAgainst: "0/0", goalsAgainst: 0, toi: "00:00" },
    ], 20262027, "2026-10-02", "goalie");
    expect(goalies).toMatchObject({ historyGames: 1, previous: { SAVES_GOALIE: 28, GOALS_AGAINST_GOALIE: 2, SHOTS_AGAINST_GOALIE: 30 } });
  });
  it("uses a 60/40 game-one prior, fades with observed appearances, and reaches the organic forecast", () => {
    const organic = { GOALS: 0.4 };
    expect(blendSeasonBootstrap(organic, prior).stats.GOALS).toBeCloseTo(0.68);
    expect(blendSeasonBootstrap(organic, { ...prior, currentSeasonGames: 10 }).stats.GOALS).toBeCloseTo(0.54);
    const settled = blendSeasonBootstrap(organic, { ...prior, currentSeasonGames: 20 });
    expect(settled.stats.GOALS).toBe(0.4);
    expect(settled.disclosure).toMatchObject({ fantasyWeight: 0, historyWeight: 0, validation: "unvalidated" });
    expect(blendSeasonBootstrap(organic, { ...prior, previous: {}, historyGames: 0 }).stats.GOALS).toBeCloseTo(0.8);
    expect(blendSeasonBootstrap(organic, { ...prior, previous: {}, fantasy: {}, historyGames: 0 }).stats.GOALS).toBe(0.4);
  });
  it("keeps opponent context and current PP removal effective while preserving skater category accounting", () => {
    const organic = { goalsEs: 0.3, goalsPp: 0.1, assistsEs: 0.5, assistsPp: 0.1, shotsEs: 2, shotsPp: 1, hits: 1, blocks: 1 };
    const normal = bootstrapSkaterLine(organic, prior, { goals: 1, assists: 1, shots: 1, ppUsage: 1 });
    const removed = bootstrapSkaterLine({ ...organic, goalsPp: 0, assistsPp: 0, shotsPp: 0 }, prior,
      { goals: 1, assists: 1, shots: 1, ppUsage: 0 });
    const opponent = bootstrapSkaterLine(organic, prior, { goals: 0.9, assists: 0.9, shots: 0.9, ppUsage: 1 });
    expect(normal.goalsEs + normal.goalsPp).toBeCloseTo(0.68);
    expect(removed.goalsPp + removed.assistsPp).toBe(0);
    expect(removed.goalsEs).toBeLessThan(normal.goalsEs + normal.goalsPp);
    expect(opponent.goalsEs + opponent.goalsPp).toBeLessThan(normal.goalsEs + normal.goalsPp);
    expect(normal.goalsPp + normal.assistsPp).toBeLessThanOrEqual(normal.goalsEs + normal.goalsPp + normal.assistsEs + normal.assistsPp);
  });
  it("integrates goalie starting probability once and requires projected starts for win priors", () => {
    const fantasy = fantasySourcePerGame({ Games_Played: 50, Games_Started_Goalie: 40,
      Saves_Goalie: 1400, Goals_Against_Goalie: 100, Wins_Goalie: 24, Shutouts_Goalie: 4 }, "cullen_goalies")!;
    expect(fantasy).toMatchObject({ SAVES_GOALIE: 28, GOALS_AGAINST_GOALIE: 2, SHOTS_AGAINST_GOALIE: 30, WINS_GOALIE: 0.6, SHUTOUTS_GOALIE: 0.1 });
    expect(fantasySourcePerGame({ Games_Played: 50, Wins_Goalie: 24 }, "cullen_goalies")).toBeNull();
    const blended = blendSeasonBootstrap({}, { ...prior, previous: {}, fantasy });
    const board = boardGoalieForecast({ startingProbability: 0.5, conditional: blended.stats, seasonBootstrap: blended.disclosure })!;
    expect(board.expected).toMatchObject({ SAVES_GOALIE: expect.closeTo(14), GOALS_AGAINST_GOALIE: expect.closeTo(1),
      SHOTS_AGAINST_GOALIE: expect.closeTo(15), WINS_GOALIE: expect.closeTo(0.3) });
    expect(board.seasonBootstrap?.fantasyWeight).toBe(0.6);
    const lowVolume = bootstrapGoalieLine({ SHOTS_AGAINST_GOALIE: 20 }, { ...prior, previous: {}, fantasy });
    const highVolume = bootstrapGoalieLine({ SHOTS_AGAINST_GOALIE: 40 }, { ...prior, previous: {}, fantasy });
    expect(highVolume.stats.SAVES_GOALIE).toBeCloseTo(lowVolume.stats.SAVES_GOALIE! * 2);
    expect(highVolume.stats.SAVES_GOALIE! + highVolume.stats.GOALS_AGAINST_GOALIE!).toBe(40);
  });
});

describe("Starter Board reproducible inputs", () => {
  it("captures and replays through the browser-safe shared-client bridge", async () => {
    const live = vi.fn(() => Promise.resolve({ data: [{ goals: 1 }], error: null }));
    const calculate = () => interceptSharedQuery("from", ["rates"], live);
    const captured = await captureProjectionInputs(calculate);
    expect(captured.reads).toHaveLength(1);
    expect((await replayProjectionInputs(captured.reads, calculate)).result).toEqual(captured.result);
    expect(live).toHaveBeenCalledOnce();
    expect(calculate()).toBeUndefined();
  });
  it("captures read-only reconstructions without constructing writes and refuses opaque RPCs", async () => {
    const liveRead = vi.fn(), liveWrite = vi.fn(), liveRpc = vi.fn();
    const capture = await captureProjectionInputs(async () => {
      await query("rates", { data: [{ goals: 1 }], error: null }, liveRead).select("goals");
      await query("forge_player_projections", {}, liveWrite).upsert({ player_id: 1 });
      await expect(interceptProjectionQuery("rpc", ["possibly_mutating", {}], liveRpc)).rejects.toThrow("RPC is not allowed");
    }, { suppressWrites: true });
    expect(liveRead).toHaveBeenCalledOnce();
    expect(liveWrite).not.toHaveBeenCalled();
    expect(liveRpc).not.toHaveBeenCalled();
    expect(capture.reads).toHaveLength(1);
    expect(capture.writes).toHaveLength(1);
  });
  it("records controlled news in replay inputs and never permits it in a writing capture", async () => {
    const live = vi.fn();
    const rows = [{ id: "controlled", game_id: 7 }];
    const calculate = () => query("player_forecast_lineup_snapshots", { data: [], error: null }, live).select("*");
    await expect(captureProjectionInputs(calculate, { controlledNewsReads: { player_forecast_lineup_snapshots: rows } }))
      .rejects.toThrow("read-only reconstruction");
    const captured = await captureProjectionInputs(calculate, { suppressWrites: true,
      controlledNewsReads: { player_forecast_lineup_snapshots: rows } });
    expect(captured.result).toEqual({ data: rows, error: null });
    expect((await replayProjectionInputs(captured.reads, calculate)).result).toEqual(captured.result);
    expect(live).not.toHaveBeenCalled();
  });
  it("replays calculations from captured reads without constructing a DB client or writing", async () => {
    const live = vi.fn();
    const calculate = async () => {
      const { data } = await query("rates", { data: [{ goals: 0.4 }], error: null }, live).select("goals").eq("player_id", 7);
      const output = { player_id: 7, goals: data[0].goals * 3 };
      await query("forge_player_projections", { error: null }, live).upsert(output);
      return output;
    };
    const captured = await captureProjectionInputs(calculate);
    expect(captured.reads).toHaveLength(1);
    expect(live).toHaveBeenCalledTimes(2);
    live.mockClear();
    const replayed = await replayProjectionInputs(captured.reads, calculate);
    expect(replayed.result).toEqual(captured.result);
    expect(projectionWritesHash(replayed.writes)).toBe(projectionWritesHash(captured.writes));
    expect(live).not.toHaveBeenCalled();
  });

  it("rejects unseen and unused reads instead of falling back to current data", async () => {
    const captured = await captureProjectionInputs(() => query("rates", { data: [], error: null }).select("goals"));
    await expect(replayProjectionInputs(captured.reads, () => query("rates", {}).select("shots"))).rejects.toThrow("Unrecorded");
    await expect(replayProjectionInputs(captured.reads, async () => null)).rejects.toThrow("every captured input");
  });

  it("isolates simultaneous capture scopes and records a read only once", async () => {
    const results = await Promise.all([1, 2].map((id) => captureProjectionInputs(async () => {
      const builder = query("rates", { data: [id], error: null }).select("goals");
      await builder;
      await builder;
    })));
    expect(results.map((result) => result.reads.length)).toEqual([1, 1]);
    expect(results.map((result) => (result.reads[0].result as any).data)).toEqual([[1], [2]]);
    expect(interceptProjectionQuery("from", ["rates"], () => null)).toBeUndefined();
  });

  it("preserves error responses and detects changed outputs", async () => {
    const result = { data: null, error: { message: "source missing" } };
    const capture = await captureProjectionInputs(() => query("rates", result).select("goals"));
    const replay = await replayProjectionInputs(capture.reads, () => query("rates", {}).select("goals"));
    expect(replay.result).toEqual(result);
    expect(projectionInputHash({ a: 1, b: 2 })).toBe(projectionInputHash({ b: 2, a: 1 }));
    expect(projectionInputHash({ a: 1 })).not.toBe(projectionInputHash({ a: 2 }));
  });

  it("freezes goalie inputs with game and team identities from the actual queries", async () => {
    const capture = await captureProjectionInputs(async () => {
      await query("goalie_start_projections", { data: [{ player_id: 7, start_probability: 0.7 }], error: null })
        .select("player_id,start_probability").eq("game_id", 100).eq("team_id", 8);
    });
    expect(capturedGoalieStarts(capture.reads)).toEqual([{ player_id: 7, start_probability: 0.7, game_id: 100, team_id: 8 }]);
  });
});

const cutoff = "2026-10-01T12:00:00Z";
const lineup = (overrides: Partial<BoardLineupEvidence> = {}): BoardLineupEvidence => ({
  id: "ev", game_id: 1, team_id: 10, source_key: "reporter-a", accepted: true,
  observed_at: "2026-10-01T11:00:00Z", available_at: "2026-10-01T11:01:00Z",
  parser_version: "line-source-v2", player_forecast_lineup_assignments: [
    { player_id: 7, unit_type: "forward_line", unit_number: 3, assignment_status: "observed" },
  ], ...overrides,
});
const resolve = (lineups: BoardLineupEvidence[]) => resolveDailyBoardEvidence({ cutoff, lineups, goalies: [], conflicts: [] });

describe("Starter Board same-day overlay", () => {
  it("excludes future publications, late arrivals, later parsing and expired evidence", () => {
    expect(resolve([
      lineup({ observed_at: "2026-10-01T13:00:00Z" }),
      lineup({ available_at: "2026-10-01T13:00:00Z" }),
      lineup({ created_at: "2026-10-01T13:00:00Z" }),
      lineup({ expires_at: cutoff }),
    ]).assertions).toEqual([]);
  });
  it("applies a partial PP change without overwriting EV or inferring scratches", () => {
    const evidence = resolve([lineup(), lineup({ id: "pp", player_forecast_lineup_assignments: [
      { player_id: 7, unit_type: "power_play", unit_number: 1, assignment_status: "observed" },
    ] })]);
    const overlay = applyDailyBoardEvidence({ gameId: 1, evidence,
      playerAvailabilityMultiplier: new Map(), availabilityEventByPlayer: new Map(),
      roleEventByPlayer: new Map(), ppEventByPlayer: new Map(), goalieOverrideByTeamId: new Map() });
    expect(roleTagFromRosterEvent(overlay.roleEventByPlayer.get(7)!)?.esRole).toBe("L3");
    const ppRole = roleTagFromRosterEvent(overlay.ppEventByPlayer.get(7)!);
    expect(ppRole?.esRole).toBe("PP1");
    expect(overlay.playerAvailabilityMultiplier.size).toBe(0);
    const before = allocatePpToiByTeamOpportunity({ projectedByPlayer: new Map([
      [7, { toiPp: 120, roleTag: null }], [8, { toiPp: 120, roleTag: null }],
    ]), targetTeamPpSeconds: 600 });
    const after = allocatePpToiByTeamOpportunity({ projectedByPlayer: new Map([
      [7, { toiPp: 120, roleTag: ppRole }], [8, { toiPp: 120, roleTag: null }],
    ]), targetTeamPpSeconds: 600 });
    expect(after.perPlayerPpToiSeconds.get(7)!).toBeGreaterThan(before.perPlayerPpToiSeconds.get(7)!);
    expect(after.perPlayerPpToiSeconds.get(8)!).toBeLessThan(before.perPlayerPpToiSeconds.get(8)!);
  });
  it("uses reporter corrections, not late arrival order or repost counts", () => {
    const corrected = lineup({ id: "correction", observed_at: "2026-10-01T11:30:00Z",
      player_forecast_lineup_assignments: [{ player_id: 7, unit_type: "forward_line", unit_number: 1, assignment_status: "observed" }] });
    const result = resolve([corrected, lineup({ available_at: "2026-10-01T11:50:00Z" }), corrected]);
    expect(result.assertions).toHaveLength(1);
    expect(result.assertions[0].value).toBe("L1");
  });
  it("retains material conflicts and never converts legacy injury mentions into out labels", () => {
    const result = resolve([lineup(), lineup({ source_key: "reporter-b", id: "conflict",
      player_forecast_lineup_assignments: [{ player_id: 7, unit_type: "forward_line", unit_number: 1, assignment_status: "observed" }] }),
      lineup({ id: "old-injury", parser_version: "line-source-v1", player_forecast_lineup_assignments: [
        { player_id: 8, unit_type: "injury", unit_number: null, assignment_status: "ruled_out" },
      ] }),
    ]);
    expect(result.conflicts).toHaveLength(1);
    expect(result.assertions).toHaveLength(1);
    expect(result.assertions[0].value).toBe("uncertain");
  });
  it("honors only conflict resolutions known by the cutoff", () => {
    const goalie = { ...lineup(), player_id: 9, observation_status: "confirmed" };
    const conflict = { id: "c", game_id: 1, team_id: 10, player_id: null, conflict_type: "goalie_start", detected_at: "2026-10-01T11:01:00Z",
      player_forecast_conflict_resolutions: [{ action: "select_observation", selected_observation_id: "ev", resolved_at: "2026-10-01T13:00:00Z" }] };
    const args = { cutoff, lineups: [], goalies: [goalie], conflicts: [conflict] };
    expect(resolveDailyBoardEvidence(args).assertions).toHaveLength(0);
    conflict.player_forecast_conflict_resolutions[0].resolved_at = "2026-10-01T11:59:00Z";
    expect(resolveDailyBoardEvidence(args).assertions[0].playerId).toBe(9);
    Object.assign(conflict.player_forecast_conflict_resolutions[0], { created_at: "2026-10-01T13:00:00Z" });
    expect(resolveDailyBoardEvidence(args).assertions).toHaveLength(0);
  });
});

describe("Starter Board scoring and probability accounting", () => {
  it("matches hand-calculated default and custom scoring, and propagates missing values", () => {
    const profile = parseBoardScoringRequest({}).profile;
    const stats = { GOALS: 1, ASSISTS: 2, PP_POINTS: 1, SHOTS_ON_GOAL: 5, HITS: 2, BLOCKED_SHOTS: 4 };
    expect(scoreBoardStats(stats, profile.skater).points).toBe(10.4);
    expect(scoreBoardStats(stats, { GOALS: 6, HITS: -0.5 }).points).toBe(5);
    expect(scoreBoardStats({ GOALS: null }, { GOALS: 3 })).toEqual({ points: null, missingCategories: ["GOALS"] });
    expect(scoreBoardStats({ GOALS: null }, { GOALS: 0 }).points).toBe(0);
    expect(() => parseBoardScoringRequest({ profile: { skater: { FACEOFFS_WON: 1 } } })).toThrow("Unsupported");
    expect(() => parseBoardScoringRequest({ profile: { goalie: { SAVES_GOALIE: Infinity } } })).toThrow("Invalid");
  });
  it("leaves missing participation unknown and weights each goalie category once", () => {
    expect(integrateBoardParticipation({ GOALS: 1 }, null)).toBeNull();
    expect(integrateBoardParticipation({ GOALS: 1 }, 0)).toEqual({ GOALS: 0 });
    const forecast = boardGoalieForecast({ startingProbability: 0.5,
      conditional: { SHOTS_AGAINST_GOALIE: 30, SAVES_GOALIE: 27, GOALS_AGAINST_GOALIE: 3, WINS_GOALIE: 0.6, SHUTOUTS_GOALIE: 0.1 } })!;
    expect(forecast.expected).toMatchObject({ SHOTS_AGAINST_GOALIE: 15, SAVES_GOALIE: 13.5, GOALS_AGAINST_GOALIE: 1.5, WINS_GOALIE: 0.3, SHUTOUTS_GOALIE: 0.05 });
    expect(forecast.expected!.SAVES_GOALIE! + forecast.expected!.GOALS_AGAINST_GOALIE!).toBe(forecast.expected!.SHOTS_AGAINST_GOALIE);
    expect(scoreBoardStats(forecast.expected, parseBoardScoringRequest({}).profile.goalie).points).toBe(2.55);
    expect(forecast.nonStartAssumption).toBe("zero_relief_minutes");
  });
  it("allows fantasy order to differ from starting probability and re-scores without changing forecasts", () => {
    const candidate = (player_id: number, probability: number, saves: number) => ({ player_id, positions: ["G"],
      start_probability: probability, forecast: boardGoalieForecast({ startingProbability: probability,
        conditional: { SHOTS_AGAINST_GOALIE: saves + 2, SAVES_GOALIE: saves, GOALS_AGAINST_GOALIE: 2, WINS_GOALIE: 0.5, SHUTOUTS_GOALIE: 0.1 } }) });
    const payload = { players: [candidate(1, 0.8, 15), candidate(2, 0.6, 35)] };
    const original = JSON.stringify(payload);
    const points = scoreStarterBoardPayload(payload, parseBoardScoringRequest({}));
    expect(points.players[1].position_ranks.G).toBe(1);
    expect(scoreStarterBoardPayload(payload, parseBoardScoringRequest({ goalieSort: "start_probability" })).players[0].position_ranks.G).toBe(1);
    expect(JSON.stringify(payload)).toBe(original);
    const ga = scoreStarterBoardPayload(payload, parseBoardScoringRequest({ mode: "categories", category: "GOALS_AGAINST_GOALIE" }));
    expect(ga.players[1].position_ranks.G).toBe(1);
  });
  it("re-scores comparable revisions and preserves a validated public profile", () => {
    const candidate = (saves: number) => boardGoalieForecast({ startingProbability: 0.5,
      conditional: { SAVES_GOALIE: saves, GOALS_AGAINST_GOALIE: 2, SHOTS_AGAINST_GOALIE: saves + 2, WINS_GOALIE: 0.5, SHUTOUTS_GOALIE: 0.1 } })!;
    const forecast = candidate(30);
    attachPreviousBoardForecast(forecast, candidate(20), "previous-revision");
    const request = parseBoardScoringRequest({ profile: { goalie: { SAVES_GOALIE: 2 } } });
    const result = scoreStarterBoardPayload({ players: [{ player_id: 1, positions: ["G"], forecast }] }, request);
    expect(result.players[0].boardScore.change).toBe(10);
    const normalized = normalizeStartChartResponse({ ...result, dateUsed: "2026-10-01", scoringProfile: { ...result.scoringProfile, privateToken: "secret" } });
    expect(normalized.scoringProfile).toEqual(result.scoringProfile);
    expect(JSON.stringify(normalized)).not.toContain("secret");
  });
});

describe("Starter Board dispatch budget", () => {
  it("separates private capture and compute from public serving and challengers", () => {
    expect(starterBoardFlags({ STARTER_BOARD_CAPTURE_ENABLED: "true" })).toEqual({ capture: true, compute: false, serving: false, challenger: false, scheduler: false });
    expect(starterBoardFlags({ START_CHART_GAME_REVISIONS: "true", STARTER_BOARD_SERVING_ENABLED: "false" })).toMatchObject({ capture: true, compute: true, serving: false, challenger: false });
  });
  it("dispatches all 16 leased games without waiting for serial batches", async () => {
    vi.stubEnv("START_CHART_GAME_REVISIONS", "true");
    const jobs = Array.from({ length: 16 }, (_, i) => ({ game_id: i + 1, claimed_version: 1, first_accepted_at: new Date().toISOString() }));
    const rpc = vi.fn().mockResolvedValue({ data: jobs, error: null });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const request = vi.fn(async () => { await gate; return { ok: true, status: 200 } as Response; });
    try {
      const pending = dispatchStarterBoardJobs({ rpc } as any, "https://board.example", "test-secret", request);
      await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(16));
      expect(rpc).toHaveBeenCalledWith("claim_starter_board_jobs", expect.objectContaining({ p_limit: 16 }));
      release();
      expect(await pending).toMatchObject({ dispatched: 16, failed: 0 });
    } finally { release(); vi.unstubAllEnvs(); }
  });
  it("claims only the configured canary and refuses an out-of-scope worker", async () => {
    vi.stubEnv("START_CHART_GAME_REVISIONS", "true");
    vi.stubEnv("STARTER_BOARD_CANARY_GAME_IDS", "2026020001, 2026020002");
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const from = vi.fn();
    try {
      await claimStarterBoardJobs({ rpc } as any);
      expect(rpc).toHaveBeenCalledWith("claim_starter_board_jobs", expect.objectContaining({ p_game_ids: [2026020001, 2026020002] }));
      await expect(computeStarterBoardJob({ rpc, from } as any,
        { game_id: 2026020003, claimed_version: 1, first_accepted_at: new Date().toISOString() }, "owner"))
        .rejects.toThrow("outside the Starter Board canary scope");
      expect(from).not.toHaveBeenCalled();
      expect(rpc).toHaveBeenCalledTimes(1);
      vi.stubEnv("STARTER_BOARD_CANARY_GAME_IDS", "");
      await expect(claimStarterBoardJobs({ rpc } as any)).rejects.toThrow("distinct positive game IDs");
      expect(rpc).toHaveBeenCalledTimes(1);
    } finally { vi.unstubAllEnvs(); }
  });
  it("requires explicit valid canary configuration instead of silently opening the slate", () => {
    expect(starterBoardCanaryGameIds({})).toBeNull();
    expect(starterBoardCanaryGameIds({ STARTER_BOARD_CANARY_GAME_IDS: "1, 2" })).toEqual([1, 2]);
    const canary = { STARTER_BOARD_CANARY_GAME_IDS: "1, 2" };
    expect(starterBoardScopeAllowed([1], canary)).toBe(true);
    expect(starterBoardScopeAllowed([1, 2], canary)).toBe(true);
    expect(starterBoardScopeAllowed([1, 3], canary)).toBe(false);
    expect(starterBoardScopeAllowed([], canary)).toBe(false);
    expect(starterBoardScopeAllowed(undefined, canary)).toBe(false);
    expect(starterBoardScopeAllowed(undefined, {})).toBe(true);
    for (const value of ["", " ", "1,", "1,1", "0", "-1", "1.5", "1e3", "9007199254740992",
      Array.from({ length: 17 }, (_, i) => i + 1).join(",")]) {
      expect(() => starterBoardCanaryGameIds({ STARTER_BOARD_CANARY_GAME_IDS: value })).toThrow("distinct positive game IDs");
    }
  });
  it("bounds game work, finishes failures and measures breaches from acceptance", async () => {
    vi.stubEnv("START_CHART_GAME_REVISIONS", "true");
    const run = vi.spyOn(forgeRunner, "runProjectionV2ForDate")
      .mockResolvedValueOnce({ runId: "complete", publishedGames: 1 } as any)
      .mockRejectedValueOnce(new Error("calculation failed"));
    const rpc = vi.fn().mockResolvedValue({ error: null });
    rpc.mockResolvedValueOnce({ data: [1, 2].map((game_id) => ({ game_id, first_accepted_at: new Date(Date.now() - 301_000).toISOString() })), error: null });
    const builder: any = { select: () => builder, eq: () => builder, abortSignal: () => builder,
      single: async () => ({ data: { date: "2026-10-01" }, error: null }) };
    const started = Date.now();
    try {
      const result = await drainStarterBoardQueue({ rpc, from: () => builder } as any);
      expect(result.processed).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.results.every((item) => item.freshnessBreached)).toBe(true);
      expect(run.mock.calls[0][1]?.gameIds).toEqual([1]);
      expect(run.mock.calls[0][1]?.deadlineMs).toBeGreaterThanOrEqual(started + STARTER_BOARD_LATENCY.computeMs);
      expect(rpc).toHaveBeenCalledWith("finish_starter_board_job", expect.objectContaining({ p_game_id: 2, p_error: "calculation failed" }));
    } finally { run.mockRestore(); vi.unstubAllEnvs(); }
  });
  it("includes delayed game lookup in every full-slate worker's computation deadline", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-10T20:00:00Z"));
    vi.stubEnv("START_CHART_GAME_REVISIONS", "true");
    const acceptedAt = Date.now();
    const jobs = Array.from({ length: 16 }, (_, index) => ({ game_id: index + 1, claimed_version: 1,
      first_accepted_at: new Date(acceptedAt).toISOString() }));
    // Exercise dispatch + worker orchestration, with deterministic I/O delays.
    // This is a scheduling contract test, not a database/browser load benchmark.
    await vi.advanceTimersByTimeAsync(STARTER_BOARD_LATENCY.coalescingMs + STARTER_BOARD_LATENCY.dispatchMs);
    const enteredAt = Date.now();
    const finished: number[] = [];
    const signals: AbortSignal[] = [];
    const rpc = vi.fn(async (name: string) => {
      if (name === "claim_starter_board_jobs") return { data: jobs, error: null };
      finished.push(Date.now());
      return { error: null };
    });
    const db: any = { rpc, from: () => {
      let id = 0;
      const query: any = { select: () => query, eq: (_key: string, value: number) => { id = value; return query; },
        abortSignal: (signal: AbortSignal) => { signals.push(signal); return query; },
        single: () => new Promise((resolve) => setTimeout(() => resolve({ data: { date: "2026-10-10" }, error: null }), (id - 1) * 900)) };
      return query;
    } };
    const run = vi.spyOn(forgeRunner, "runProjectionV2ForDate").mockImplementation(async (_date, options) => {
      await new Promise((resolve) => setTimeout(resolve, options!.deadlineMs! - Date.now()));
      return { runId: `run-${options!.gameIds![0]}`, publishedGames: 1 } as any;
    });
    const request = vi.fn(async (_url, init) => {
      const { job, owner } = JSON.parse(init!.body as string);
      const result = await computeStarterBoardJob(db, job, owner);
      return { ok: !result.error, status: result.error ? 503 : 200 } as Response;
    });
    try {
      const work = dispatchStarterBoardJobs(db, "https://board.example", "test-secret", request);
      await vi.advanceTimersByTimeAsync(STARTER_BOARD_LATENCY.computeMs);
      expect(await work).toMatchObject({ dispatched: 16, failed: 0 });
      expect(run).toHaveBeenCalledTimes(16);
      expect(run.mock.calls.every(([, options]) => options?.deadlineMs === enteredAt + STARTER_BOARD_LATENCY.computeMs)).toBe(true);
      expect(finished).toHaveLength(16);
      expect(Math.max(...finished) - acceptedAt + STARTER_BOARD_LATENCY.visibleMs).toBe(300_000);
      expect(signals.every((signal) => !signal.aborted)).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    } finally { run.mockRestore(); vi.useRealTimers(); vi.unstubAllEnvs(); }
  });
  it("aborts a stalled lookup without running FORGE and records a retryable failure", async () => {
    vi.useFakeTimers();
    vi.stubEnv("START_CHART_GAME_REVISIONS", "true");
    let aborted = false;
    let signal: AbortSignal;
    const query: any = { select: () => query, eq: () => query,
      abortSignal: (value: AbortSignal) => { signal = value; return query; },
      single: () => new Promise((resolve) => signal.addEventListener("abort", () => {
        aborted = true;
        resolve({ data: null, error: new Error("Game lookup timed out") });
      })) };
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const run = vi.spyOn(forgeRunner, "runProjectionV2ForDate");
    try {
      const work = computeStarterBoardJob({ from: () => query, rpc } as any,
        { game_id: 1, claimed_version: 1, first_accepted_at: new Date().toISOString() }, "owner");
      await vi.advanceTimersByTimeAsync(15_000);
      expect(await work).toMatchObject({ error: "Game lookup timed out", runId: null });
      expect(aborted).toBe(true);
      expect(run).not.toHaveBeenCalled();
      expect(rpc).toHaveBeenCalledWith("finish_starter_board_job", expect.objectContaining({ p_game_id: 1, p_error: "Game lookup timed out" }));
      expect(vi.getTimerCount()).toBe(0);
    } finally { run.mockRestore(); vi.useRealTimers(); vi.unstubAllEnvs(); }
  });
});
