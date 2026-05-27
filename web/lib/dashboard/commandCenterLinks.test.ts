import { describe, expect, it } from "vitest";

import { buildCommandCenterDestinations } from "./commandCenterLinks";

describe("commandCenterLinks", () => {
  it("preserves command-center route context across drill-in destinations", () => {
    const destinations = buildCommandCenterDestinations({
      date: "2026-03-14",
      resolvedDate: "2026-03-13",
      team: "CAR",
      position: "f",
      slateMode: "main",
      addMode: "week",
      returnTo: "/forge/command-center?date=2026-03-14"
    });

    expect(destinations.commandCenter).toBe(
      "/forge/command-center?date=2026-03-14&mode=week&resolvedDate=2026-03-13&slate=main&team=CAR&position=f&returnTo=%2Fforge%2Fcommand-center%3Fdate%3D2026-03-14"
    );
    expect(destinations.legacyDashboard).toContain("/forge/dashboard?");
    expect(destinations.startChart).toContain("/start-chart?");
    expect(destinations.trends).toContain("/trends?");
    expect(destinations.teamDetail).toContain("/forge/team/CAR?");
    expect(destinations.team("NJD")).toContain("/forge/team/NJD?");
    expect(destinations.forgePlayer(97)).toContain("/forge/player/97?");
    expect(destinations.trendsPlayer(97)).toContain("/trends/player/97?");
  });

  it("does not create a team-detail destination for all-team context", () => {
    const destinations = buildCommandCenterDestinations({
      date: "2026-03-14",
      resolvedDate: null,
      team: "all",
      position: "all",
      slateMode: "all",
      addMode: "tonight"
    });

    expect(destinations.teamDetail).toBeNull();
    expect(destinations.commandCenter).toBe(
      "/forge/command-center?date=2026-03-14&mode=tonight&slate=all&team=all&position=all"
    );
  });
});
