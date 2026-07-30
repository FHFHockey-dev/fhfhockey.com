import { existsSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { FORGE_COMPATIBILITY_INVENTORY } from "./compatibilityInventory";
import { clamp } from "./utils/number-utils";
import { buildSequentialHorizonScalarsFromDates } from "./utils/date-utils";
import { pickLatestByPlayer } from "./utils/collection-utils";
import { buildStarterHeuristicMetadata } from "./utils/projection-metadata-builders";
import { computeSkaterShotQualityAdjustments } from "./calculators/skater-adjustments";
import { computeStarterProbabilities } from "./calculators/goalie-starter";
import { computeGoalieRestSplitSavePctAdjustment } from "./calculators/goalie-save-pct-context";
import { blendSkaterScenarioStatLines } from "./calculators/scenario-blending";
import { computeTeamStrengthContextAdjustment } from "./calculators/team-context-adjustments";
import { fetchRollingRows } from "./queries/skater-queries";
import { fetchGoalieEvidence } from "./queries/goalie-queries";
import { fetchTeamStrengthAverages } from "./queries/team-context-queries";
import { createRun } from "./queries/run-lifecycle-queries";
import { runProjectionV2ForDate } from "./run-forge-projections";
import { runMetricsFinalizationStage } from "./stages/metrics-finalization-stage";
import {
  availabilityMultiplierForEvent,
  runProjectionPreflightStage
} from "./stages/preflight-stage";
import {
  persistForgeGoalieProjection,
  persistForgePlayerProjectionRows,
  persistForgeTeamProjection,
  persistPerGameAnalyticsOutputs
} from "./stages/persistence-stage";
import { runPerGameGoalieStage } from "./stages/goalie-stage";
import {
  buildModelMarketFlagRow,
  getConsensusLineValue,
  getProjectionValueForPropMarket
} from "./utils/market-output-builders";

describe("projection module import integrity", () => {
  it("loads extracted utility, query, calculator, and orchestrator modules", () => {
    expect(typeof clamp).toBe("function");
    expect(typeof buildSequentialHorizonScalarsFromDates).toBe("function");
    expect(typeof pickLatestByPlayer).toBe("function");
    expect(typeof buildStarterHeuristicMetadata).toBe("function");

    expect(typeof computeSkaterShotQualityAdjustments).toBe("function");
    expect(typeof computeStarterProbabilities).toBe("function");
    expect(typeof computeGoalieRestSplitSavePctAdjustment).toBe("function");
    expect(typeof blendSkaterScenarioStatLines).toBe("function");
    expect(typeof computeTeamStrengthContextAdjustment).toBe("function");

    expect(typeof fetchRollingRows).toBe("function");
    expect(typeof fetchGoalieEvidence).toBe("function");
    expect(typeof fetchTeamStrengthAverages).toBe("function");
    expect(typeof createRun).toBe("function");

    expect(typeof availabilityMultiplierForEvent).toBe("function");
    expect(typeof runProjectionPreflightStage).toBe("function");
    expect(typeof runMetricsFinalizationStage).toBe("function");
    expect(typeof persistForgePlayerProjectionRows).toBe("function");
    expect(typeof persistForgeTeamProjection).toBe("function");
    expect(typeof persistForgeGoalieProjection).toBe("function");
    expect(typeof persistPerGameAnalyticsOutputs).toBe("function");
    expect(typeof runPerGameGoalieStage).toBe("function");
    expect(typeof getProjectionValueForPropMarket).toBe("function");
    expect(typeof getConsensusLineValue).toBe("function");
    expect(typeof buildModelMarketFlagRow).toBe("function");
    expect(typeof runProjectionV2ForDate).toBe("function");
  });

  it("finalizes projection metrics without changing their contract", () => {
    const metrics = {
      player_rows: 0,
      team_rows: 0,
      goalie_rows: 0,
      learning: {
        players_considered: 0,
        goal_rate_recent_players: 0,
        assist_rate_recent_players: 0,
        goal_rate_recent_share: 0,
        assist_rate_recent_share: 0
      },
      data_quality: {
        skater_pool_projected_teams: 3,
        skater_pool_projected_count_sum: 50,
        skater_pool_projected_count_avg: null
      }
    };

    runMetricsFinalizationStage({
      metrics,
      playerRowsUpserted: 42,
      teamRowsUpserted: 6,
      goalieRowsUpserted: 4,
      learningCounters: { players: 10, goalRecent: 6, assistRecent: 4 },
      timedOut: true,
      finishedAt: "2026-07-29T00:00:00.000Z"
    });

    expect(metrics).toMatchObject({
      player_rows: 42,
      team_rows: 6,
      goalie_rows: 4,
      learning: {
        players_considered: 10,
        goal_rate_recent_players: 6,
        assist_rate_recent_players: 4,
        goal_rate_recent_share: 0.6,
        assist_rate_recent_share: 0.4
      },
      data_quality: {
        skater_pool_projected_count_avg: 16.667
      },
      finished_at: "2026-07-29T00:00:00.000Z",
      timed_out: true
    });
  });

  it("keeps the removed shim path absent while pointing imports at the canonical runner", () => {
    expect(FORGE_COMPATIBILITY_INVENTORY.removedShim).toMatchObject({
      legacyModulePath: "web/lib/projections/runProjectionV2.ts",
      canonicalModulePath: "web/lib/projections/run-forge-projections.ts",
      status: "removed"
    });
    expect(
      existsSync(new URL("./runProjectionV2.ts", import.meta.url))
    ).toBe(false);
  });

  it("keeps the retired start-chart materializer absent while preserving its cleanup ledger entry", () => {
    expect(FORGE_COMPATIBILITY_INVENTORY.retiredRoutes).toContainEqual(
      expect.objectContaining({
        route: "/api/v1/db/update-start-chart-projections",
        status: "retired"
      })
    );
    expect(
      existsSync(
        new URL("../../pages/api/v1/db/update-start-chart-projections.ts", import.meta.url)
      )
    ).toBe(false);
  });
});
