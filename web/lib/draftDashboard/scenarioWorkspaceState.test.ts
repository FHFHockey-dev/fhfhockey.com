import { describe, expect, it } from "vitest";

import { showScenarioWorkspace, toggleScenarioWorkspace } from "./scenarioWorkspaceState";

describe("scenario workspace state", () => {
  it("keeps the current candidates when history visibility changes", () => {
    const opened = showScenarioWorkspace({ mounted: true, open: true, candidateIds: ["a", "b"] });
    expect(toggleScenarioWorkspace(opened)).toEqual({ mounted: true, open: false, candidateIds: ["a", "b"] });
    expect(toggleScenarioWorkspace(toggleScenarioWorkspace(opened))).toEqual({ mounted: true, open: true, candidateIds: ["a", "b"] });
  });

  it("only replaces candidates for a deliberate table selection", () => {
    expect(showScenarioWorkspace({ mounted: false, open: false, candidateIds: [] }, ["c", "d"])).toEqual({ mounted: true, open: true, candidateIds: ["c", "d"] });
  });
});
