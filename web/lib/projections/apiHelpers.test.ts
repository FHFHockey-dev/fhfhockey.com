import { describe, expect, it } from "vitest";

import { buildProjectionApiErrorResponse } from "./apiHelpers";
import {
  FORGE_ROLLING_HISTORY_INPUT_CONTRACT,
  buildForgeInputProvenance,
  evaluateForgeCalibrationEligibility,
} from "./calibrationEligibility";

describe("projection API error responses", () => {
  it("preserves bounded caller-error detail", () => {
    const error = Object.assign(new Error("Invalid query parameters"), {
      statusCode: 400,
      details: { fieldErrors: { horizon: ["Too big"] } },
    });

    expect(
      buildProjectionApiErrorResponse(error, "PROJECTIONS_UNAVAILABLE"),
    ).toEqual({
      statusCode: 400,
      error: "Invalid query parameters",
      details: { fieldErrors: { horizon: ["Too big"] } },
    });
  });

  it("redacts internal dependency detail behind a stable error", () => {
    const error = Object.assign(
      new Error("relation private_projection_table does not exist"),
      {
        statusCode: 503,
        details: { schema: "private" },
      },
    );

    expect(
      buildProjectionApiErrorResponse(error, "PROJECTIONS_UNAVAILABLE"),
    ).toEqual({
      statusCode: 503,
      error: "PROJECTIONS_UNAVAILABLE",
    });
  });
});

describe("FORGE calibration eligibility", () => {
  it("accepts only the repaired rolling-history provenance contract", () => {
    expect(
      evaluateForgeCalibrationEligibility({
        input_provenance: buildForgeInputProvenance(),
      }),
    ).toEqual({
      eligible: true,
      observedContract: FORGE_ROLLING_HISTORY_INPUT_CONTRACT,
      requiredContract: FORGE_ROLLING_HISTORY_INPUT_CONTRACT,
      reason: "eligible",
    });

    expect(evaluateForgeCalibrationEligibility({})).toMatchObject({
      eligible: false,
      observedContract: null,
      reason: "missing_or_legacy_rolling_history_contract",
    });
    expect(
      evaluateForgeCalibrationEligibility({
        input_provenance: {
          rolling_player_history_contract: "legacy_date_scoped_v0",
        },
      }),
    ).toMatchObject({
      eligible: false,
      observedContract: "legacy_date_scoped_v0",
    });
  });
});
