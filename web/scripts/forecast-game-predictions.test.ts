import { describe, expect, it } from "vitest";

import {
  parseForecastGamePredictionsArgs,
  resolveForecastModelIdentity,
  resolveForecastDateWindow,
  summarizeForecastGamePredictionsResult,
  validateForecastGamePredictionsOptions,
} from "./forecast-game-predictions";

describe("game prediction forecast script", () => {
  it("parses dry-run forecast options", () => {
    const options = parseForecastGamePredictionsArgs([
      "--from-date",
      "2026-06-15",
      "--to-date=2026-06-22",
      "--source-as-of-date",
      "2026-06-15",
      "--prediction-cutoff-at=2026-06-15T16:00:00.000Z",
      "--model-name",
      "nhl_game_baseline_logistic",
      "--model-version",
      "v4",
      "--limit",
      "12",
      "--max-runtime-ms",
      "120000",
      "--fail-on-skipped",
    ]);

    expect(options).toEqual({
      fromDate: "2026-06-15",
      toDate: "2026-06-22",
      sourceAsOfDate: "2026-06-15",
      predictionCutoffAt: "2026-06-15T16:00:00.000Z",
      modelName: "nhl_game_baseline_logistic",
      modelVersion: "v4",
      limit: 12,
      maxRuntimeMs: 120000,
      dryRun: true,
      confirmWrite: false,
      failOnSkipped: true,
      allowBaselineBootstrap: false,
      help: false,
    });
    expect(() => validateForecastGamePredictionsOptions(options)).not.toThrow();
  });

  it("requires explicit confirmation before writing prediction rows", () => {
    const options = parseForecastGamePredictionsArgs([
      "--from-offset-days=0",
      "--to-offset-days=7",
      "--write",
      "--allow-baseline-bootstrap",
    ]);

    expect(options.dryRun).toBe(false);
    expect(options.allowBaselineBootstrap).toBe(true);
    expect(() => validateForecastGamePredictionsOptions(options)).toThrow(
      "Refusing to write game predictions without --confirm-write.",
    );
    expect(() =>
      validateForecastGamePredictionsOptions({
        ...options,
        confirmWrite: true,
      }),
    ).not.toThrow();
  });

  it("resolves the serving model identity used by forecast writes", () => {
    expect(resolveForecastModelIdentity({})).toMatchObject({
      modelName: "nhl_game_baseline_logistic",
    });
    expect(
      resolveForecastModelIdentity({
        modelName: "nhl_game_extratrees_candidate_v1",
        modelVersion: "candidate-v1",
      }),
    ).toMatchObject({
      modelName: "nhl_game_extratrees_candidate_v1",
      modelVersion: "candidate-v1",
    });
  });

  it("requires a date window and validates ISO date flags", () => {
    expect(() =>
      validateForecastGamePredictionsOptions(
        parseForecastGamePredictionsArgs(["--from-date=2026-06-15"]),
      ),
    ).toThrow(
      "--from-date/--to-date or --from-offset-days/--to-offset-days are required.",
    );
    expect(() =>
      validateForecastGamePredictionsOptions(
        parseForecastGamePredictionsArgs([
          "--from-date=2026/06/15",
          "--to-date=2026-06-22",
        ]),
      ),
    ).toThrow("--from-date and --to-date must use YYYY-MM-DD.");
    expect(() =>
      validateForecastGamePredictionsOptions(
        parseForecastGamePredictionsArgs(["--help"]),
      ),
    ).not.toThrow();
  });

  it("resolves offset windows deterministically", () => {
    expect(
      resolveForecastDateWindow(
        {
          fromOffsetDays: 1,
          toOffsetDays: 3,
        },
        new Date("2026-06-15T12:00:00.000Z"),
      ),
    ).toEqual({
      fromDate: "2026-06-16",
      toDate: "2026-06-18",
    });
  });

  it("summarizes skipped prediction reasons without dumping full payloads", () => {
    const summary = summarizeForecastGamePredictionsResult({
      fromDate: "2026-06-15",
      toDate: "2026-06-22",
      sourceAsOfDate: "2026-06-15",
      requestedGames: 2,
      processedGames: 1,
      skippedGames: 1,
      stoppedForDeadline: false,
      dryRun: true,
      results: [
        {
          gameId: 1,
          featureSnapshotId: null,
          predictionId: null,
          homeWinProbability: 0.55,
          awayWinProbability: 0.45,
          skippedReason: null,
          dryRun: true,
        },
        {
          gameId: 2,
          featureSnapshotId: null,
          predictionId: null,
          homeWinProbability: null,
          awayWinProbability: null,
          skippedReason: "prediction_cutoff_at_or_after_puck_drop",
          dryRun: true,
        },
      ],
    });

    expect(summary).toMatchObject({
      success: false,
      dryRun: true,
      requestedGames: 2,
      processedGames: 1,
      skippedGames: 1,
      skippedReasons: {
        prediction_cutoff_at_or_after_puck_drop: 1,
      },
      predictions: [
        {
          gameId: 1,
          homeWinProbability: 0.55,
        },
        {
          gameId: 2,
          skippedReason: "prediction_cutoff_at_or_after_puck_drop",
        },
      ],
    });
  });
});
