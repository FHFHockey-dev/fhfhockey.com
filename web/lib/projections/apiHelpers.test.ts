import { describe, expect, it } from "vitest";

import { buildProjectionApiErrorResponse } from "./apiHelpers";

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
