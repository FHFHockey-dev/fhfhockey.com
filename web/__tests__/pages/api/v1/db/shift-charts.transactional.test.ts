import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const routeSource = readFileSync(
  resolve(process.cwd(), "pages/api/v1/db/shift-charts.ts"),
  "utf8",
);

describe("shift-chart relationship transaction wiring", () => {
  it("binds relationship output to the exact PBP and shift input generation", () => {
    expect(routeSource).toContain("buildShiftRelationshipStrengthSegments(");
    expect(routeSource).toContain("sourcePbpHash: buildProjectionPbpSourceHash(pbp)");
    expect(routeSource).toContain("sourceShiftHash: shiftChartData.sourceShiftHash");
    expect(routeSource).toContain("fetchCurrentRelationshipRosterPositions(");
    expect(routeSource).toContain("pbp_raw_payload_hash");
    expect(routeSource).toContain("source_play_by_play_hash");
    expect(routeSource).toContain("buildRelationshipRosterPositionMap({");
    expect(routeSource).toContain("resolveRelationshipPlayerPosition({");
    expect(routeSource).toContain("expectedPbpRawPayloadHash,");
    expect(routeSource.indexOf("resolvedPositionsByPlayer.set(")).toBeLessThan(
      routeSource.indexOf("buildShiftRelationshipStrengthSegments("),
    );
    expect(routeSource).not.toContain('.from("pp_timeframes")');
    expect(routeSource).not.toContain("/boxscore");
    expect(routeSource).not.toContain("@ts-nocheck");
  });

  it("uses the durable status queue while preserving the legacy all alias", () => {
    expect(routeSource).toContain('getCurrentSeason } from "lib/NHL/server"');
    expect(routeSource).toContain("(await getCurrentSeason()).seasonId");
    expect(routeSource).not.toContain("async function fetchCurrentSeason");
    expect(routeSource).not.toContain("api.nhle.com/stats/rest/en/season");
    expect(routeSource).toContain("listPendingRelationshipGameIds(");
    expect(routeSource).toContain("selectPendingRelationshipGameIds({");
    expect(routeSource).toContain('rawTargetGameId === "all"');
  });
});
