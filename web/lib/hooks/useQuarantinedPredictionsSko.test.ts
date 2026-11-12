import { describe, expect, it } from "vitest";

import * as hook from "./useQuarantinedPredictionsSko";

// W3-7 D2 / D10: the hook selected no model or horizon (mixed series) and dropped the API's
// `compatibility_model_not_promoted` warning.
describe("useQuarantinedPredictionsSko request and payload", () => {
  it("always selects one model, version and horizon", () => {
    const build = (hook as any).buildPredictionsSkoQuery;
    expect(typeof build).toBe("function");
    const params = new URLSearchParams(build({ asOfDate: "2026-03-21", limit: 30 }));
    expect(params.get("modelName")).toBe("baseline-moving-average");
    expect(params.get("modelVersion")).toBe("v0.4");
    expect(params.get("horizon")).toBe("5");
    expect(params.get("asOfDate")).toBe("2026-03-21");

    const explicit = new URLSearchParams(
      build({ horizon: 10, modelVersion: "v0.3" }),
    );
    expect(explicit.get("horizon")).toBe("10");
    expect(explicit.get("modelVersion")).toBe("v0.3");
  });

  it("keeps the API's source warnings with the rows", () => {
    const read = (hook as any).readPredictionsSkoPayload;
    expect(typeof read).toBe("function");
    expect(
      read({
        rows: [{ player_id: 1 }],
        sourceWarnings: ["compatibility_model_not_promoted", 3],
      }),
    ).toEqual({
      rows: [{ player_id: 1 }],
      warnings: ["compatibility_model_not_promoted"],
    });
    expect(read({})).toEqual({ rows: [], warnings: [] });
  });
});
