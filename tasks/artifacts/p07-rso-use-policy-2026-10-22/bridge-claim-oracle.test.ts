import { expect, it } from "vitest";
import { currentRsoUsePolicy, restrictRsoForecast } from "./rsoUsePolicy";
import type { GameForecast } from "../rosterScheduleOptimizer/planningTypes";
it("C08: client manifest cannot approve a native row by claiming a bridge selection", () => {
  const row: GameForecast = { playerId: "7", gameId: "31", stats: { HITS: 3 }, sourceKind: "detailed",
    sourceWatermark: "native-issued", conditioning: "unconditional", revisionId: "native-issued-31",
    modelVersion: "native-candidate", issuedAt: "2026-10-22T10:00:00Z", cutoffAt: "2026-10-22T09:00:00Z",
    expiresAt: "2026-10-23T00:00:00Z", startProbability: null, confirmedStart: false, limitations: [],
    allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: false } };
  const policy = currentRsoUsePolicy();
  const claimed = { rsoUsePolicy: { version: policy.version, revision: policy.revision, bridgeRevisionIds: [row.revisionId] } };
  const result = restrictRsoForecast(JSON.parse(JSON.stringify(row)), JSON.parse(JSON.stringify(claimed)), "2026-10-22T12:00:00Z");
  expect(result.targetAllowedUses?.HITS.totals ?? result.allowedUses?.totals).toBe(false);
});
