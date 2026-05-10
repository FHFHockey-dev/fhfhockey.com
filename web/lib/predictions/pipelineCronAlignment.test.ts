import { describe, expect, it } from "vitest";

import type { CronInventoryJob } from "lib/cron/cronInventory";
import type { RollingForgePipelineStage } from "lib/rollingForgePipeline";
import { buildPipelineCronAlignmentReport } from "./pipelineCronAlignment";

function job(name: string, routePath: string, slotIndex: number): CronInventoryJob {
  return {
    key: name,
    name,
    cronExpression: "* * * * *",
    scheduleTimeDisplay: `${slotIndex}m`,
    utcHour: null,
    utcMinute: null,
    slotIndex,
    sortOrder: slotIndex,
    method: "GET",
    executionShape: "HTTP route",
    url: `https://fhfhockey.com${routePath}`,
    route: routePath,
    routePath,
    sqlText: null,
    notes: [],
  };
}

const stages = [
  {
    id: "core_entity_freshness",
    order: 1,
    routes: ["/api/v1/db/update-games"],
    depends_on: [],
  },
  {
    id: "rolling_player_recompute",
    order: 2,
    routes: ["/api/v1/db/update-rolling-player-averages"],
    depends_on: ["core_entity_freshness"],
  },
] as RollingForgePipelineStage[];

describe("pipeline cron alignment", () => {
  it("reports scheduled stages and missing routes", () => {
    const report = buildPipelineCronAlignmentReport({
      stages,
      jobs: [job("update-games", "/api/v1/db/update-games", 10)],
    });

    expect(report.missingRouteCount).toBe(1);
    expect(report.stages[1]).toMatchObject({
      stageId: "rolling_player_recompute",
      missingRoutes: ["/api/v1/db/update-rolling-player-averages"],
    });
  });

  it("flags a stage scheduled before its dependency", () => {
    const report = buildPipelineCronAlignmentReport({
      stages,
      jobs: [
        job("update-games", "/api/v1/db/update-games", 20),
        job("rolling", "/api/v1/db/update-rolling-player-averages", 10),
      ],
    });

    expect(report.orderViolations).toEqual([
      expect.objectContaining({
        stageId: "rolling_player_recompute",
        dependsOn: "core_entity_freshness",
      }),
    ]);
  });
});
