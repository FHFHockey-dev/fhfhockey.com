import { describe, expect, it } from "vitest";

import {
  parsePromoteModelVersionArgs,
  summarizePromotionResult,
  validatePromoteModelVersionOptions,
} from "./promote-game-prediction-model-version";

describe("game prediction model promotion script", () => {
  it("parses promotion preview options", () => {
    const options = parsePromoteModelVersionArgs([
      "--model-name",
      "nhl_game_baseline_logistic",
      "--model-version=candidate-v1",
      "--feature-set-version",
      "game_features_v5_accuracy_candidates",
      "--min-evaluated-games",
      "150",
    ]);

    expect(options).toEqual({
      modelName: "nhl_game_baseline_logistic",
      modelVersion: "candidate-v1",
      featureSetVersion: "game_features_v5_accuracy_candidates",
      minEvaluatedGames: 150,
      dryRun: true,
      confirm: false,
      help: false,
    });
    expect(() => validatePromoteModelVersionOptions(options)).not.toThrow();
  });

  it("requires explicit confirmation before mutating production status", () => {
    const options = parsePromoteModelVersionArgs([
      "--model-name=nhl_game_baseline_logistic",
      "--model-version=candidate-v1",
      "--feature-set-version=game_features_v5_accuracy_candidates",
      "--promote",
    ]);

    expect(options.dryRun).toBe(false);
    expect(() => validatePromoteModelVersionOptions(options)).toThrow(
      "Refusing to promote model version without --confirm after previewing persisted evidence.",
    );
    expect(() =>
      validatePromoteModelVersionOptions({
        ...options,
        confirm: true,
      }),
    ).not.toThrow();
  });

  it("requires model identity unless help is requested", () => {
    expect(() =>
      validatePromoteModelVersionOptions(
        parsePromoteModelVersionArgs(["--model-name=nhl_game_baseline_logistic"]),
      ),
    ).toThrow(
      "--model-name, --model-version, and --feature-set-version are required.",
    );

    expect(() =>
      validatePromoteModelVersionOptions(parsePromoteModelVersionArgs(["--help"])),
    ).not.toThrow();
  });

  it("summarizes preview and mutation results consistently", () => {
    expect(
      summarizePromotionResult(
        {
          wouldPromote: false,
          reasons: ["Persisted promotion evidence is not eligible for promotion."],
          modelName: "nhl_game_baseline_logistic",
          modelVersion: "candidate-v1",
          featureSetVersion: "game_features_v5_accuracy_candidates",
          persistedEvidenceChecked: true,
        },
        true,
      ),
    ).toMatchObject({
      success: false,
      dryRun: true,
      result: {
        wouldPromote: false,
        persistedEvidenceChecked: true,
      },
    });

    expect(
      summarizePromotionResult(
        {
          promoted: true,
          reasons: [],
          modelName: "nhl_game_baseline_logistic",
          modelVersion: "candidate-v1",
          featureSetVersion: "game_features_v5_accuracy_candidates",
          promotedAt: "2026-06-15T12:00:00.000Z",
          retiredProductionRows: 1,
        },
        false,
      ),
    ).toMatchObject({
      success: true,
      dryRun: false,
      result: {
        promoted: true,
        retiredProductionRows: 1,
      },
    });
  });
});
