import { describe, expect, it } from "vitest";
import { projectionInputHash } from "lib/projections/inputCapture";
import { actualForOutput, goalieActualFromBoxscore } from "./settlement";
import { evaluateIssuedObservations, evaluatePairedPointDecisions, runForgeProspectiveEvaluation, runProspectiveEvaluation, type IssuedObservation, type PairedPointDecision } from "./evaluation";

describe("forecast evaluation boundaries", () => {
  const observation = (id: string, overrides: Partial<IssuedObservation> = {}): IssuedObservation => ({
    id, target: "goals", gameDate: "2026-10-05", gameType: "regular_season", evidenceClass: "captured_live",
    issuedAt: "2026-10-04T12:00:00Z", gameStartAt: "2026-10-05T23:00:00Z",
    outcomeAvailableAt: "2026-10-06T12:00:00Z", conditioning: "unconditional",
    actual: 2, forecast: 3, baseline: 4, baselineConditioning: "unconditional", ...overrides,
  });

  it("settles observed unconditional skater counts but leaves absent appearances unknown", () => {
    const output = (target_key: string, conditioning: string) => ({ population: "forward", target_key, conditioning }) as any;
    expect(actualForOutput(output("goals", "unconditional"), { goals: 0, toi: "00:00" })?.value).toBe(0);
    expect(actualForOutput(output("plays", "playing_probability"), { goals: 0, toi: "18:10" })?.value).toBe(1);
    expect(actualForOutput(output("plays", "playing_probability"), { goals: 0, toi: "00:00" })?.value).toBe(0);
    expect(actualForOutput(output("plays", "playing_probability"), { goals: 0, toi: null })).toBeNull();
    expect(actualForOutput(output("plays", "playing_probability"), undefined)).toBeNull();
    expect(actualForOutput(output("goals", "unconditional"), undefined)).toBeNull();
    expect(actualForOutput(output("goals", "conditional_playing"), { goals: 0, toi: "00:00" })).toBeNull();
    expect(actualForOutput(output("goals", "conditional_playing"), { goals: 0, toi: "18:10" })?.value).toBe(0);
    expect(actualForOutput(output("goals", "legacy_availability_adjusted"), { goals: 0 })).toBeNull();
    expect(actualForOutput(({ population: "goalie", target_key: "starts", conditioning: "start_probability" }) as any,
      undefined, { toi: "60:00", saveShotsAgainst: "28/30" })).toBeNull();
  });

  it("takes goalie starters and wins only from an official final boxscore", () => {
    const boxscore = { payloadHash: "retained-hash", fetchedAt: "2026-10-06T03:00:00Z", seasonId: 20262027,
      payload: { id: 100, season: 20262027, gameState: "OFF", homeTeam: { id: 10 }, awayTeam: { id: 20 },
        playerByGameStats: { homeTeam: { goalies: [
          { playerId: 7, starter: true, decision: "W", toi: "60:00" },
          { playerId: 8, starter: false, toi: "00:00" },
        ] }, awayTeam: { goalies: [{ playerId: 9, starter: true, decision: "L", toi: "60:00" }] } } } };
    const output = (player_id: number, target_key: string, conditioning: string) => ({
      id: "output", game_id: 100, team_id: 10, player_id, population: "goalie", target_key, conditioning,
      point_estimate: null, probability: null, distribution: null, quantiles: null,
    }) as any;
    expect(goalieActualFromBoxscore(output(7, "starts", "start_probability"), boxscore)?.value).toBe(1);
    expect(goalieActualFromBoxscore(output(8, "starts", "start_probability"), boxscore)?.value).toBe(0);
    expect(goalieActualFromBoxscore(output(7, "wins", "unconditional"), boxscore)).toMatchObject({ value: 1,
      payload: { sourceTable: "nhl_api_game_payloads_raw", payloadHash: "retained-hash" } });
    expect(goalieActualFromBoxscore(output(8, "wins", "unconditional"), boxscore)?.value).toBe(0);
    expect(goalieActualFromBoxscore(output(8, "wins", "conditional_start"), boxscore)).toBeNull();
    expect(goalieActualFromBoxscore(output(7, "shutouts", "unconditional"), boxscore)).toBeNull();
    expect(goalieActualFromBoxscore(output(7, "starts", "start_probability"),
      { ...boxscore, payload: { ...boxscore.payload, gameState: "LIVE" } })).toBeNull();
    expect(goalieActualFromBoxscore(output(7, "wins", "unconditional"),
      { ...boxscore, payload: { ...boxscore.payload, season: 20252026 } })).toBeNull();
  });

  it("separates point error, bias, and participation Brier while excluding holdout and late issues", () => {
    const result = evaluateIssuedObservations([
      observation("one"), observation("two", { actual: 4, forecast: 10, baseline: null }),
      observation("play", { target: "plays", conditioning: "playing_probability", baselineConditioning: "playing_probability", actual: 1, forecast: 0.8, baseline: 0.5 }),
      observation("holdout", { gameDate: "2026-01-03" }),
      observation("late", { issuedAt: "2026-10-06T00:00:00Z" }),
      observation("one"),
    ], "2026-10-07T00:00:00Z");
    expect(result.points).toEqual([{ target: "goals", conditioning: "unconditional", population: "unknown",
      calendarLeadDays: null, teamGameOrdinal: null, samples: 2, mae: 3.5, bias: 3.5,
      pairedMae: 1, pairedBias: 1, baselineMae: 2, baselineSamples: 1 }]);
    expect(result.participation[0]).toMatchObject({ target: "plays", conditioning: "playing_probability",
      samples: 1, brier: expect.closeTo(0.04), pairedBrier: expect.closeTo(0.04), baselineBrier: 0.25 });
    expect(result.excluded).toEqual({ protected_holdout: 1, invalid_cutoff: 1, duplicate_output: 1 });
  });

  it("keeps conditioning, population, and both horizon definitions in separate labeled cohorts", () => {
    const result = evaluateIssuedObservations([
      observation("forward-1", { population: "forward", calendarLeadDays: 1, teamGameOrdinal: 1 }),
      observation("forward-2", { population: "forward", calendarLeadDays: 2, teamGameOrdinal: 1 }),
      observation("forward-ordinal-2", { population: "forward", calendarLeadDays: 1, teamGameOrdinal: 2 }),
      observation("defense", { population: "defense", calendarLeadDays: 1, teamGameOrdinal: 1 }),
      observation("conditional", { conditioning: "conditional_playing", baselineConditioning: "unconditional" }),
      observation("unknown-baseline", { baselineConditioning: undefined }),
    ], "2026-10-07T00:00:00Z");
    expect(result.points).toHaveLength(6);
    expect(result.points.find(row => row.conditioning === "conditional_playing")).toMatchObject({
      samples: 1, baselineSamples: 0, pairedMae: null, baselineMae: null,
    });
    expect(result.points.find(row => row.population === "unknown" && row.conditioning === "unconditional")).toMatchObject({
      samples: 1, baselineSamples: 0,
    });
    expect(result.points.filter(row => row.population === "forward").map(row => [row.calendarLeadDays, row.teamGameOrdinal]).sort())
      .toEqual([[1, 1], [1, 2], [2, 1]]);
  });

  const decision = (id: string, overrides: Partial<PairedPointDecision> = {}): PairedPointDecision => ({
    id, gameDate: "2026-10-05", issuedAt: "2026-10-04T12:00:00Z", lockAt: "2026-10-05T23:00:00Z",
    outcomeAvailableAt: "2026-10-06T12:00:00Z", evidenceClass: "captured_live", comparableCoverage: true,
    scoringWeights: { GOALS: 1 }, outcomes: { "shared:g": { GOALS: 10 }, "a:g": { GOALS: 2 }, "b:g": { GOALS: 3 } },
    plans: { candidate: ["shared:g", "b:g"], noMove: ["shared:g", "a:g"], agp: ["a:g"] }, ...overrides,
  });

  it("scores paired plans with shared outcomes and withholds incomplete decisions", () => {
    const result = evaluatePairedPointDecisions([
      decision("good"), decision("weak", { plans: { candidate: ["a:g"], noMove: ["shared:g", "b:g"], agp: ["b:g"] } }),
      decision("incomplete", { comparableCoverage: false }),
      decision("missing", { outcomes: { "a:g": { GOALS: 2 } } }),
      decision("holdout", { gameDate: "2026-04-16" }),
    ], "2026-10-07T00:00:00Z");
    expect(result.evaluated).toEqual([
      { id: "good", candidate: 13, noMove: 12, agp: 2, opportunityLoss: 0 },
      { id: "weak", candidate: 2, noMove: 13, agp: 3, opportunityLoss: 11 },
    ]);
    expect(result.meanOpportunityLoss).toBe(5.5);
    expect(result.excluded).toEqual({ incomplete_coverage: 1, missing_outcome: 1, protected_holdout: 1 });
  });

  it("reads retained final prospective evidence without treating samples as promotion", async () => {
    const games = [{ id: 1, date: "2026-10-05", startTime: "2026-10-05T23:00:00Z", type: 2 },
      { id: 2, date: "2026-04-16", startTime: "2026-04-16T23:00:00Z", type: 2 }];
    const output = (id: string, game_id: number, run_id: string) => ({ id, run_id, game_id, player_id: 7,
      population: "forward", target_key: "goals", conditioning: "unconditional", team_game_horizon: 1,
      point_estimate: 2, probability: null, distribution: { baselinePointEstimate: 3, baselineConditioning: "unconditional" },
      source_high_watermark: "2026-10-04T10:00:00Z", issued_at: "2026-10-04T12:00:00Z" });
    const runs = [{ id: "live", game_id: 1, status: "succeeded", run_kind: "canonical_daily",
      cutoff_at: "2026-10-04T11:00:00Z", issued_at: "2026-10-04T12:00:00Z", metadata: { evidenceClass: "captured_live" } },
      { id: "unknown", game_id: 1, status: "succeeded", run_kind: "backtest",
        cutoff_at: "2026-10-04T11:00:00Z", issued_at: "2026-10-04T12:00:00Z", metadata: {} },
      { id: "holdout-run", game_id: 2, status: "succeeded", run_kind: "canonical_daily",
        cutoff_at: "2026-04-15T11:00:00Z", issued_at: "2026-04-15T12:00:00Z", metadata: { evidenceClass: "captured_live" } }];
    const tables: Record<string, unknown[]> = { games, player_forecast_outputs: [output("valid", 1, "live"),
      output("backtest", 1, "unknown"), output("holdout", 2, "holdout-run"),
      { ...output("conditional", 1, "live"), conditioning: "conditional_playing" },
      { ...output("conditional-start", 1, "live"), population: "goalie", target_key: "wins", conditioning: "conditional_start" }], player_forecast_runs: runs,
      player_forecast_outcome_revisions: [{ id: "actual", game_id: 1, player_id: 7, target_key: "goals",
        target_version: "research-contract-v1", outcome_value: 1, available_at: "2026-10-06T12:00:00Z",
        finality: "final", source: "nhl_game_stats" },
      { id: "win", game_id: 1, player_id: 7, target_key: "wins", target_version: "research-contract-v1",
        outcome_value: 0, available_at: "2026-10-06T12:00:00Z", finality: "final", source: "nhl_raw_boxscore" },
      { id: "did-not-play", game_id: 1, player_id: 7, target_key: "plays", target_version: "research-contract-v1",
        outcome_value: 0, available_at: "2026-10-06T12:00:00Z", finality: "final", source: "nhl_game_stats" }] };
    const filters: Array<{ table: string; key: string; value: unknown }> = [];
    const db = { from: (table: string) => {
      const chain: any = new Proxy({}, { get: (_, key) => key === "range"
        ? async (from: number, to: number) => ({ data: (tables[table] ?? []).slice(from, Math.min(to + 1, from + 2)), count: (tables[table] ?? []).length, error: null }) : (...args: unknown[]) => {
          if (key === "gte" || key === "lte") filters.push({ table, key: String(args[0]), value: args[1] });
          return chain;
        } });
      return chain;
    } };
    const result = await runProspectiveEvaluation(db as any,
      { startDate: "2026-04-16", endDate: "2026-10-06", asOf: "2026-10-07T00:00:00Z" });
    expect(result.progress).toMatchObject({ settledGames: 1, settledSlates: 1, settledForecasts: 1,
      starterBoardMinimums: { gamesRequired: 200, slatesRequired: 30, sampleMinimumMet: false }, releaseDecision: "not_assessed" });
    expect(result.metrics.points[0]).toMatchObject({ samples: 1, mae: 1, pairedMae: 1, baselineMae: 2 });
    expect(result.excluded).toMatchObject({ protected_holdout: 1, prospective_capture_unverified: 1,
      conditioning_outcome_unverified: 2 });
    expect(filters.filter(row => row.table === "games" && row.key === "date").map(row => row.value))
      .toEqual(["2026-04-17", "2026-10-06"]);
  });
  it("fails explicitly when a read reaches its row cap", async () => {
    const page = Array.from({ length: 1000 }, (_, index) => ({ id: index + 1, date: "2026-10-05",
      startTime: "2026-10-05T23:00:00Z", type: 2 }));
    const db = { from: () => {
      const chain: any = new Proxy({}, { get: (_, key) => key === "range"
        ? async () => ({ data: page, count: 50_000, error: null }) : () => chain });
      return chain;
    } };
    await expect(runProspectiveEvaluation(db as any,
      { startDate: "2026-10-05", endDate: "2026-10-06", asOf: "2026-10-07T00:00:00Z" }))
      .rejects.toThrow("row cap reached");
  });
  it.each(["missing count", "changed count", "no progress", "read error"])("rejects incomplete evaluation reads: %s", async (failure) => {
    let pages = 0;
    const db = { from() {
      const chain: any = new Proxy({}, { get: (_, method) => method === "range"
        ? async () => ({ data: failure === "no progress" ? [] : [{ id: ++pages }],
          count: failure === "missing count" ? null : failure === "changed count" && pages > 1 ? 3 : 2,
          error: failure === "read error" ? new Error("read failed") : null })
        : () => chain });
      return chain;
    } };
    for (const run of [runProspectiveEvaluation, runForgeProspectiveEvaluation]) {
      pages = 0;
      await expect(run(db as any, { startDate: "2026-10-05", endDate: "2026-10-06", asOf: "2026-10-07T00:00:00Z" }))
        .rejects.toThrow(failure === "read error" ? "read failed" : "incomplete or changed");
    }
  });

  it("scores only hash-checked captured FORGE revisions with final boxscore outcomes", async () => {
    const game = { id: 100, date: "2026-10-10", type: 2, seasonId: 20262027,
      startTime: "2026-10-10T23:00:00Z", homeTeamId: 10, awayTeamId: 8 };
    const snapshot = { version: "forge-inputs-v1", runId: "run", slateDate: game.date,
      decisionAsOf: "2026-10-10T20:00:02Z", inputCutoff: "2026-10-10T20:00:00Z",
      capturedAt: "2026-10-10T20:00:03Z", codeVersion: "commit", modelMode: "baseline",
      horizonGames: 1, gameIds: [100], replayClassification: "captured_live", outputHash: "output", goalieStarts: [],
      reads: [
        { request: [{ method: "from", args: ["games"] }], receivedAt: "2026-10-10T20:00:01Z",
          result: { data: [game], error: null } },
        { request: [{ method: "from", args: ["players"] }], receivedAt: "2026-10-10T20:00:01Z",
          result: { data: [{ id: 7, team_id: 10, position: "L" }], error: null } },
      ] };
    const observation = { id: "snapshot", provider: "forge", dataset_key: "forge-run-inputs-v1", entity_key: "run",
      available_at: snapshot.capturedAt, payload_hash: projectionInputHash(snapshot), payload: snapshot };
    const revision = { id: "revision", game_id: 100, run_id: "run", input_snapshot_id: "snapshot", slate_date: game.date,
      decision_as_of: snapshot.decisionAsOf, published_at: "2026-10-10T20:00:04Z",
      payload: { codeVersion: "commit", modelMode: "baseline", goalies: [], players: [{ run_id: "run", game_id: 100,
        horizon_games: 1, player_id: 7, team_id: 10, proj_goals_es: 1, proj_goals_pp: 0, proj_goals_pk: 0,
        uncertainty: { model: { skater_selection: { production_conditioning: "conditional_playing",
          participation: { version: "skater-participation-v1", probability: 1, status: "confirmed_evidence", evidenceIds: ["e"] } } } },
      }] } };
    const raw = { game_id: 100, season_id: 20262027, payload_hash: "raw-hash", fetched_at: "2026-10-11T05:00:00Z",
      payload: { id: 100, season: 20262027, gameState: "OFF", homeTeam: { id: 10 }, awayTeam: { id: 8 },
        playerByGameStats: { homeTeam: { forwards: [{ playerId: 7, goals: 2, toi: "18:00" }], defense: [],
          goalies: [{ playerId: 30, starter: true, decision: "W", toi: "60:00" }] },
        awayTeam: { forwards: [], defense: [], goalies: [{ playerId: 31, starter: true, decision: "L", toi: "60:00" }] } } } };
    const tables: Record<string, unknown[]> = { games: [game], forge_final_pregame_revisions: [
      { game_id: 100, revision_id: "revision", scheduled_start_at: game.startTime, frozen_at: "2026-10-10T23:01:00Z" }],
      forge_game_revisions: [revision], player_forecast_source_observations: [observation], nhl_api_game_payloads_raw: [raw] };
    const db = { from: (table: string) => {
      const chain: any = new Proxy({}, { get: (_, key) => key === "range"
        ? async (from: number, to: number) => ({ data: (tables[table] ?? []).slice(from, to + 1), count: (tables[table] ?? []).length, error: null }) : () => chain });
      return chain;
    } };
    const window = { startDate: "2026-10-10", endDate: "2026-10-11", asOf: "2026-10-12T00:00:00Z" };
    const result = await runForgeProspectiveEvaluation(db as any, window);
    expect(result.metrics.points.filter(row => row.target === "GOALS").map(row => row.conditioning).sort())
      .toEqual(["conditional_playing", "unconditional"]);
    expect(result.metrics.points.filter(row => row.target === "GOALS").every(row => row.teamGameOrdinal === null)).toBe(true);
    expect(result.metrics.participation[0]).toMatchObject({ target: "participation", brier: 0 });
    expect(result.progress).toMatchObject({ producer: "FORGE", settledGames: 1, releaseDecision: "not_assessed" });
    tables.player_forecast_source_observations = [{ ...observation, payload_hash: "tampered" }];
    const invalid = await runForgeProspectiveEvaluation(db as any, window);
    expect(invalid.progress.settledForecasts).toBe(0);
    expect(invalid.excluded.frozen_source_invalid).toBe(1);
    tables.player_forecast_source_observations = [observation];
    tables.forge_game_revisions = [{ ...revision, payload: { ...revision.payload,
      players: [{ ...revision.payload.players[0], proj_goals_pk: null }] } }];
    const incomplete = await runForgeProspectiveEvaluation(db as any, window);
    expect(incomplete.metrics.points.some(row => row.target === "GOALS")).toBe(false);
    expect(incomplete.excluded.all_strength_source_incomplete).toBe(2);
  });
});
