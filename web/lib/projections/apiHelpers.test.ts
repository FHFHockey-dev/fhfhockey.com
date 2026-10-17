import { describe, expect, it } from "vitest";

import { buildProjectionApiErrorResponse } from "./apiHelpers";
import {
  FORGE_ROLLING_HISTORY_INPUT_CONTRACT,
  FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT,
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
  it("requires repaired rolling history and external fantasy exclusion provenance", () => {
    expect(
      evaluateForgeCalibrationEligibility({
        input_provenance: buildForgeInputProvenance({ externalFantasyInputsExcluded: true }),
      }),
    ).toEqual({
      eligible: true,
      observedContract: FORGE_ROLLING_HISTORY_INPUT_CONTRACT,
      requiredContract: FORGE_ROLLING_HISTORY_INPUT_CONTRACT,
      observedExternalFantasyContract: FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT,
      requiredExternalFantasyContract: FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT,
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

  it("stamps the external fantasy exclusion label only on explicit opt-in", () => {
    // Production run-forge-projections.ts calls the builder without options while its
    // stages still blend external fantasy priors; that provenance must stay ineligible.
    expect(buildForgeInputProvenance()).toEqual({
      rolling_player_history_contract: FORGE_ROLLING_HISTORY_INPUT_CONTRACT,
    });
    expect(evaluateForgeCalibrationEligibility({ input_provenance: buildForgeInputProvenance() })).toMatchObject({
      eligible: false,
      observedContract: FORGE_ROLLING_HISTORY_INPUT_CONTRACT,
      observedExternalFantasyContract: null,
      reason: "missing_or_legacy_external_fantasy_exclusion_contract",
    });
    expect(buildForgeInputProvenance({ externalFantasyInputsExcluded: true })).toEqual({
      rolling_player_history_contract: FORGE_ROLLING_HISTORY_INPUT_CONTRACT,
      external_fantasy_input_contract: FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT,
    });
  });

  it.each([undefined, null, true, [], {}, "comparison_reference", "blended_v0"])(
    "rejects legacy or unsupported external fantasy exclusion provenance: %j",
    (contract) => {
      expect(evaluateForgeCalibrationEligibility({ input_provenance: {
        rolling_player_history_contract: FORGE_ROLLING_HISTORY_INPUT_CONTRACT,
        external_fantasy_input_contract: contract,
      } })).toMatchObject({ eligible: false,
        reason: "missing_or_legacy_external_fantasy_exclusion_contract" });
    },
  );
});
