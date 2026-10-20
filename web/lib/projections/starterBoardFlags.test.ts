import { describe, expect, it } from "vitest";

import { starterBoardFlags } from "./starterBoardFlags";

describe("starterBoardFlags", () => {
  // News intake (goalie/lineup capture RPCs, IFTTT on-arrival processing) reads
  // `capture` directly. FORGE gates its own input capture on `compute`, so the
  // flag itself must keep reporting capture on without compute.
  it("reports capture on with compute off, as production runs", () => {
    expect(starterBoardFlags({ STARTER_BOARD_CAPTURE_ENABLED: "true", STARTER_BOARD_COMPUTE_ENABLED: "false" }))
      .toMatchObject({ capture: true, compute: false });
  });

  it("keeps the legacy combined flag as the default for capture and compute", () => {
    expect(starterBoardFlags({ START_CHART_GAME_REVISIONS: "true" })).toMatchObject({ capture: true, compute: true, serving: true });
    expect(starterBoardFlags({ START_CHART_GAME_REVISIONS: "true", STARTER_BOARD_COMPUTE_ENABLED: "false" }))
      .toMatchObject({ capture: true, compute: false });
  });
});
