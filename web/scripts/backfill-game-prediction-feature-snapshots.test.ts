import { describe, expect, it } from "vitest";

import {
  parseBackfillFeatureSnapshotsArgs,
  validateBackfillFeatureSnapshotsOptions,
} from "./backfill-game-prediction-feature-snapshots";

describe("game prediction feature snapshot backfill script", () => {
  it("parses dry-run backfill options", () => {
    const options = parseBackfillFeatureSnapshotsArgs([
      "--from-date",
      "2026-01-01",
      "--to-date=2026-01-07",
      "--cutoff-hours-before-start",
      "2.5",
      "--limit",
      "25",
      "--max-runtime-ms",
      "120000",
      "--skip-existing=false",
      "--model-name",
      "nhl_game_baseline_logistic",
      "--model-version",
      "v5",
    ]);

    expect(options).toEqual({
      fromDate: "2026-01-01",
      toDate: "2026-01-07",
      cutoffHoursBeforeStart: 2.5,
      limit: 25,
      maxRuntimeMs: 120000,
      skipExisting: false,
      modelName: "nhl_game_baseline_logistic",
      modelVersion: "v5",
      dryRun: true,
      confirmWrite: false,
      help: false,
    });
    expect(() => validateBackfillFeatureSnapshotsOptions(options)).not.toThrow();
  });

  it("requires explicit confirmation for write mode", () => {
    const options = parseBackfillFeatureSnapshotsArgs([
      "--from-date=2026-01-01",
      "--to-date=2026-01-07",
      "--write",
    ]);

    expect(options.dryRun).toBe(false);
    expect(() => validateBackfillFeatureSnapshotsOptions(options)).toThrow(
      "Refusing to write feature snapshots without --confirm-write.",
    );

    expect(() =>
      validateBackfillFeatureSnapshotsOptions({
        ...options,
        confirmWrite: true,
      }),
    ).not.toThrow();
  });

  it("requires a date window unless help is requested", () => {
    expect(() =>
      validateBackfillFeatureSnapshotsOptions(
        parseBackfillFeatureSnapshotsArgs(["--from-date=2026-01-01"]),
      ),
    ).toThrow("--from-date and --to-date are required.");

    expect(() =>
      validateBackfillFeatureSnapshotsOptions(
        parseBackfillFeatureSnapshotsArgs(["--help"]),
      ),
    ).not.toThrow();
  });
});
