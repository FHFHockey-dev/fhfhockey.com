import fs from "fs";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildAccountabilityCandles, buildPlayerForecastCandles } from "./accountability";
import { goalieObservationStatus } from "./sourceObservations";
import { createPlayerForecastReviewToken, verifyPlayerForecastReviewToken } from "./reviewToken";
import { probePlayerForecastTable } from "./readiness";
import {
  playerForecastErrorMessage,
  playerForecastRuntimeBoundary,
} from "./runtimeSafety";
import { buildNextTenGameScopes } from "./schedule";
import { playerForecastSourcePayloadHash } from "./sourceSnapshot";
import { parseTimeOnIceSeconds, scoreForecast } from "./settlement";
import {
  createPlayerForecastServingArtifact,
  ensureValidationFeatureSnapshots,
  playerForecastCanonicalHash,
  verifyPlayerForecastArtifact,
} from "./serving";
import { aggregatePlayerForecastRestOfSeason } from "./restOfSeason";
import type { PlayerForecastRevision } from "./contracts";

const baseRevision: PlayerForecastRevision = {
  outputId: "out-1",
  runId: "run-1",
  gameId: 100,
  teamId: 10,
  playerId: 20,
  playerName: "Test Player",
  population: "forward",
  targetKey: "shots",
  conditioning: "conditional_playing",
  teamGameHorizon: 10,
  pointEstimate: 2.4,
  probability: null,
  distributionKind: "research-test",
  distribution: null,
  quantiles: { p10: 1, p90: 5 },
  issuedAt: "2026-11-01T10:00:00Z",
  cutoffAt: "2026-11-01T10:00:00Z",
  scheduledStartAt: "2026-11-28T23:00:00Z",
  modelVersion: "test",
  artifactChecksum: "checksum",
  featureSchemaVersion: "test",
  sourceHighWatermark: "2026-11-01T09:59:00Z",
  fallbackFlags: [],
  degraded: false,
  degradedReasons: [],
};

describe("player forecast schedule", () => {
  it("opens each team's horizon at ten future scheduled games", () => {
    const games = Array.from({ length: 12 }, (_, index) => ({
      id: 100 + index,
      seasonId: 20262027,
      date: `2026-11-${String(index + 2).padStart(2, "0")}`,
      startTime: `2026-11-${String(index + 2).padStart(2, "0")}T23:00:00Z`,
      homeTeamId: index % 2 === 0 ? 10 : 20,
      awayTeamId: index % 2 === 0 ? 20 : 10,
      type: 2,
    }));
    const scopes = buildNextTenGameScopes({
      games,
      now: new Date("2026-11-01T10:00:00Z"),
      teamId: 10,
    });
    expect(scopes).toHaveLength(10);
    expect(scopes.map((scope) => scope.teamGameHorizon)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(scopes[9]?.scopeKey).toBe("game:109:team:10");
  });
});

describe("player forecast accountability", () => {
  it("uses only pregame revisions for candle OHLC and overlays the outcome", () => {
    const revisions = [
      baseRevision,
      { ...baseRevision, outputId: "out-2", issuedAt: "2026-11-20T10:00:00Z", teamGameHorizon: 3, pointEstimate: 1.8 },
      { ...baseRevision, outputId: "out-3", issuedAt: "2026-11-28T22:55:00Z", teamGameHorizon: 1, pointEstimate: 3.1 },
      { ...baseRevision, outputId: "out-4", issuedAt: "2026-11-28T23:01:00Z", teamGameHorizon: 1, pointEstimate: 99 },
    ];
    const candles = buildPlayerForecastCandles({
      revisions,
      outcomes: [{ gameId: 100, playerId: 20, targetKey: "shots", value: 4, settlementStatus: "provisional" }],
    });
    expect(candles).toHaveLength(1);
    expect(candles[0]).toMatchObject({ open: 2.4, low: 1.8, high: 3.1, close: 3.1, actual: 4, revisionCount: 3 });
  });

  it("aggregates standardized checkpoint scores without per-player hindsight selection", () => {
    const candles = buildAccountabilityCandles([
      { slateDate: "2026-11-01", modelArtifactId: "model-1", modelVersion: "v1", checkpoint: "H10", checkpointOrder: 10, compositeSkillScore: 48, evaluatedForecasts: 40, scoringVersion: "score-v1", settlementStatus: "provisional" },
      { slateDate: "2026-11-01", modelArtifactId: "model-1", modelVersion: "v1", checkpoint: "H5", checkpointOrder: 20, compositeSkillScore: 61, evaluatedForecasts: 40, scoringVersion: "score-v1", settlementStatus: "provisional" },
      { slateDate: "2026-11-01", modelArtifactId: "model-1", modelVersion: "v1", checkpoint: "final_pregame", checkpointOrder: 30, compositeSkillScore: 57, evaluatedForecasts: 40, scoringVersion: "score-v1", settlementStatus: "final" },
    ]);
    expect(candles[0]).toMatchObject({ open: 48, low: 48, high: 61, close: 57, settlementStatus: "final" });
  });
});

describe("source semantics", () => {
  it("keeps explicit goalie language separate from model probabilities", () => {
    expect(goalieObservationStatus("Joseph Woll is confirmed to start tonight")).toBe("confirmed");
    expect(goalieObservationStatus("Woll is expected in goal")).toBe("projected");
    expect(goalieObservationStatus("Woll and Stolarz led the skate")).toBe("unconfirmed");
  });

  it("hashes provider payloads independently of object key order", () => {
    expect(playerForecastSourcePayloadHash({ b: 2, a: { y: 1, x: 0 } })).toBe(
      playerForecastSourcePayloadHash({ a: { x: 0, y: 1 }, b: 2 }),
    );
  });
});

describe("player forecast serving artifact", () => {
  it("creates a deterministic, checksum-verified private-shadow identity", () => {
    const unsigned = {
      modelKey: "historical-core-baseline-tournament",
      modelVersion: "development-v2",
      featureSchemaVersion: "historical-core-v2",
      trainingCutoffInclusive: "2026-01-02",
      contractVersion: "player-forecasts-research-v1",
      contractChecksum: "9d4a30f5027e8b277015c592a39715e16d18c9a371dd352ddd4f0738868d9574",
      promotionEligible: false,
      targets: { goals: { candidate: "position_prior" } },
      segments: { forward: { goals: { candidate: "position_prior" } } },
    };
    const offlineArtifact = {
      ...unsigned,
      artifactChecksum: playerForecastCanonicalHash(unsigned),
    };
    const first = createPlayerForecastServingArtifact(offlineArtifact);
    const second = createPlayerForecastServingArtifact(offlineArtifact);
    expect(first).toEqual(second);
    const payload = JSON.parse(first.canonicalPayload);
    expect(payload.servingChannel).toBe("private_shadow");
    expect(payload.sourceArtifactChecksum).toBe(offlineArtifact.artifactChecksum);
    expect(() => verifyPlayerForecastArtifact(first)).not.toThrow();
    expect(() => verifyPlayerForecastArtifact({ ...first, canonicalPayload: `${first.canonicalPayload} ` })).toThrow(
      "checksum mismatch",
    );
  });

  it("accepts the checksum-bound validation challenger without making it promotable", () => {
    const unsigned = {
      modelKey: "assist-decomposition-hierarchical-hits-challenger",
      modelVersion: "development-validation-v1",
      featureSchemaVersion: "historical-core-issued-vintages-v3-validation",
      trainingCutoffInclusive: "2026-01-02",
      contractVersion: "player-forecasts-research-v2-validation",
      contractChecksum: "14832482d902ca02fa148be4b31eaa23fe57b5a2d4ac642d87ba14403a90f5ed",
      promotionEligible: false,
      segments: { forward: { hits: { candidate: "career_rate" } } },
      evidenceClassification: "validation_not_blind_evidence",
    };
    const artifact = createPlayerForecastServingArtifact({
      ...unsigned,
      artifactChecksum: playerForecastCanonicalHash(unsigned),
    });
    const payload = JSON.parse(artifact.canonicalPayload);
    expect(payload.contractVersion).toBe("player-forecasts-research-v2-validation");
    expect(payload.promotionEligible).toBe(false);
    expect(() => verifyPlayerForecastArtifact(artifact)).not.toThrow();
  });

  it("builds deterministic cutoff-bound validation snapshots from the service-only RPC", async () => {
    let inserted: any[] = [];
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: [{
          player_id: 10,
          population: "forward",
          features: { assists: { multi_season_weighted_rate: 0.5, position_prior: 0.3 } },
          missingness: { no_completed_game_history: false },
          source_manifest: [{ source: "official_nhl_boxscore_history" }],
        }],
        error: null,
      }),
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockImplementation(async (rows: any[]) => {
          inserted = rows;
          return { error: null };
        }),
      }),
    } as any;
    const args = {
      supabase,
      artifactPayload: {
        contractChecksum: "contract-v2",
        segments: { forward: { assists: { candidate: "multi_season_weighted_rate" } } },
      },
      featureSchemaVersion: "historical-core-issued-vintages-v3-validation",
      gameId: 20,
      teamId: 1,
      horizon: 3,
      sourceHighWatermark: "2026-11-01T10:00:00.000Z",
      seasonId: 20262027,
      gameStartTime: "2026-11-04T23:00:00.000Z",
      opponentTeamId: 2,
      homeIndicator: 1,
      restDays: 1,
    };
    await ensureValidationFeatureSnapshots(args);
    const first = inserted[0];
    await ensureValidationFeatureSnapshots(args);
    expect(supabase.rpc).toHaveBeenCalledWith("build_player_forecast_runtime_features", {
      p_team_id: 1,
      p_opponent_team_id: 2,
      p_season_id: 20262027,
      p_cutoff_at: "2026-11-01T10:00:00.000Z",
    });
    expect(inserted[0].id).toBe(first.id);
    expect(inserted[0].content_hash).toBe(first.content_hash);
    expect(inserted[0].features.assists.multi_season_weighted_rate).toBe(0.5);
    expect(inserted[0].features.assists.home_indicator).toBe(1);
    expect(inserted[0].fallback_flags).toEqual(["validation_only"]);
  });
});

describe("forecast settlement scoring", () => {
  it("scores count forecasts and preserves baseline-relative accountability", () => {
    expect(scoreForecast({
      actual: 4,
      pointEstimate: 3,
      probability: null,
      conditioning: "conditional_playing",
      quantiles: { p10: 1, p90: 5 },
      baselinePointEstimate: 2,
    })).toEqual({
      metrics: { actual: 4, forecast: 3, absoluteError: 1, squaredError: 1, interval80Covered: true },
      baselineMetrics: { forecast: 2, absoluteError: 2, squaredError: 4 },
      compositeSkillScore: 75,
    });
  });

  it("uses clipped probabilities for log loss and parses time on ice", () => {
    const score = scoreForecast({
      actual: 1,
      pointEstimate: null,
      probability: 0.8,
      conditioning: "playing_probability",
    });
    expect(score?.metrics.brier).toBeCloseTo(0.04);
    expect(score?.metrics.logLoss).toBeCloseTo(-Math.log(0.8));
    expect(parseTimeOnIceSeconds("18:32")).toBe(1112);
    expect(parseTimeOnIceSeconds("invalid")).toBeNull();
  });
});

describe("rest-of-season forecast aggregation", () => {
  const components = [
    { gameId: 1, scheduledStartAt: "2026-11-01T23:00:00Z", mean: 1, variance: 1.5, playsProbability: 0.5 },
    { gameId: 2, scheduledStartAt: "2026-11-03T23:00:00Z", mean: 2, variance: 2.5, playsProbability: 0.75, fallbackFlags: ["tail_h10_calibration"] },
  ];

  it("keeps conditional and unconditional totals separate", () => {
    const conditional = aggregatePlayerForecastRestOfSeason({
      components,
      conditioning: "conditional_playing",
      seasonToDateActual: 10,
      scheduleRevisionHash: "schedule-v1",
    });
    const unconditional = aggregatePlayerForecastRestOfSeason({
      components,
      conditioning: "unconditional",
      seasonToDateActual: 10,
      scheduleRevisionHash: "schedule-v1",
    });
    expect(conditional.remainingMean).toBe(3);
    expect(unconditional.remainingMean).toBe(2);
    expect(conditional.fullSeasonMean).toBe(13);
    expect(unconditional.fallbackFlags).toEqual(["tail_h10_calibration"]);
  });

  it("fails closed when unconditional availability is missing", () => {
    expect(() => aggregatePlayerForecastRestOfSeason({
      components: [{ gameId: 1, scheduledStartAt: "2026-11-01T23:00:00Z", mean: 1, variance: 1 }],
      conditioning: "unconditional",
      scheduleRevisionHash: "schedule-v1",
    })).toThrow("plays probability");
  });
});

describe("forecast review tokens", () => {
  afterEach(() => delete process.env.PLAYER_FORECAST_REVIEW_TOKEN_SECRET);

  it("binds a signed token to its conflict and expiry", () => {
    process.env.PLAYER_FORECAST_REVIEW_TOKEN_SECRET = "forecast-review-test";
    const token = createPlayerForecastReviewToken({ conflictId: "conflict-1", nowMs: 1_000, ttlSeconds: 10 });
    expect(verifyPlayerForecastReviewToken({ token, conflictId: "conflict-1", nowMs: 5_000 })).toBe(true);
    expect(verifyPlayerForecastReviewToken({ token, conflictId: "conflict-2", nowMs: 5_000 })).toBe(false);
    expect(verifyPlayerForecastReviewToken({ token, conflictId: "conflict-1", nowMs: 12_000 })).toBe(false);
  });
});

describe("player forecast runtime safety", () => {
  it("blocks non-local Supabase targets outside production", () => {
    expect(playerForecastRuntimeBoundary({
      NODE_ENV: "development",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    })).toMatchObject({ allowed: false, databaseTarget: "hosted", localRequired: true });
    expect(playerForecastRuntimeBoundary({
      NODE_ENV: "development",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    })).toMatchObject({ allowed: true, databaseTarget: "local", localRequired: true });
    expect(playerForecastRuntimeBoundary({
      NODE_ENV: "production",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    })).toMatchObject({ allowed: true, databaseTarget: "hosted", localRequired: false });
  });

  it("normalizes PostgREST errors without rendering object Object", () => {
    const message = playerForecastErrorMessage({
      code: "42P01",
      message: 'relation "public.player_forecast_outputs" does not exist',
    });
    expect(message).toContain("database schema is unavailable");
    expect(message).toContain("42P01");
    expect(message).not.toContain("[object Object]");
  });

  it("detects a missing table with a non-HEAD probe", async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          limit: async () => ({ error: { code: "42P01" } }),
        }),
      }),
    } as any;
    await expect(probePlayerForecastTable(supabase, "player_forecast_outputs"))
      .resolves.toEqual({
        table: "player_forecast_outputs",
        present: false,
        errorCode: "42P01",
      });
  });
});

describe("player forecast migration", () => {
  it("keeps tables service-only, immutable, and schedules dry-run orchestration", () => {
    const migration = fs.readFileSync(
      path.resolve(process.cwd(), "../supabase/migrations/20260802163747_add_player_forecast_foundation.sql"),
      "utf8",
    );
    expect(migration).toContain("create table public.player_forecast_goalie_start_observations");
    expect(migration).toContain("create table public.player_forecast_source_observations");
    expect(migration).toContain("create table public.player_forecast_lineup_assignments");
    expect(migration).toContain("create table public.player_forecast_outputs");
    expect(migration).toContain("alter table public.%I force row level security");
    expect(migration).toContain("from public, anon, authenticated, service_role");
    expect(migration).toContain("to service_role;");
    expect(migration).toContain("PLAYER_FORECAST_IMMUTABLE_RECORD");
    expect(migration).toContain("create trigger player_forecast_goalie_observation_enqueue");
    expect(migration).toContain("create trigger player_forecast_lineup_observation_enqueue");
    expect(migration).toContain("normalized_observation_trigger");
    expect(migration).toContain("scheduled_game.\"startTime\" <= new.available_at");
    expect(migration).toContain("player-forecasts-queue-drain");
    expect(migration).toContain("jobs/drain?dryRun=true");
    expect(migration).not.toMatch(/grant\s+select[^;]+to\s+(anon|authenticated)/i);
  });
});
