import { describe, expect, it } from "vitest";

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

    expect(typeof runProjectionV2ForDate).toBe("function");
  });
});
