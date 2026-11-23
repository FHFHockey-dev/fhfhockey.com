import { afterEach, describe, expect, it, vi } from "vitest";
import * as rsoPolicy from "lib/player-forecasts/rsoUsePolicy";
import { snapshotSchema } from "lib/in-season/workspaceSchema";
import { packPlanningSnapshots, unpackPlanningSnapshots } from "lib/rosterScheduleData/bridgeForecastWire";
import { evaluatePlan } from "lib/rosterScheduleOptimizer/planning";
import { fixturePolicy, intent, issuedForecast, snapshot } from "lib/rosterScheduleOptimizer/objectiveSwitchScenario.fixture";
import { DETAILED_PARTICIPATION_NOTES, overlayChangeNote, participationDisplay } from "./rsoParticipationNotes";

afterEach(() => { vi.restoreAllMocks(); });

// Fictional Detailed RSO policy row: confirmed back for game A0 after an injury, with its change chain.
function labelledSnapshot() {
  const data = snapshot();
  const changes = [
    overlayChangeNote({ at: "2026-10-04T00:10:00Z", source: "roster event 21 (RETURN)", detail: "possible return reported; does not clear the injury" }),
    overlayChangeNote({ at: "2026-10-04T00:20:00Z", source: "accepted news fictional-return (availability:return, confirmed)", detail: "confirmed in this game's lineup" }),
  ];
  data.forecasts = data.forecasts.map(row => row.playerId === "a" && row.gameId === "A0" ? issuedForecast(data, "a", "A0", {
    stats: { pts: 3 }, conditionalStats: { pts: 3 }, appearanceProbability: 1,
    limitations: ["Game forecasts are provisional; joint plan uncertainty is not calibrated.", ...changes, DETAILED_PARTICIPATION_NOTES.confirmed_playing] }) : row);
  return data;
}
const policyRow = (forecasts: { playerId: string; gameId: string; limitations: string[] }[] | undefined) =>
  forecasts?.find(row => row.playerId === "a" && row.gameId === "A0");

describe("Detailed RSO participation receipts", () => {
  it("the basis and change chain survive the saved planning snapshot (workspace save) and its packing", () => {
    const data = labelledSnapshot();
    const expected = participationDisplay(policyRow(data.forecasts)!);
    expect(expected).toMatchObject({ basis: "confirmed_playing", label: "Confirmed playing", changes: [
      { at: "2026-10-04T00:10:00Z", source: "roster event 21 (RETURN)" }, { at: "2026-10-04T00:20:00Z" }] });
    const saved = snapshotSchema.parse(JSON.parse(JSON.stringify(unpackPlanningSnapshots(packPlanningSnapshots(data)))));
    expect(participationDisplay(policyRow(saved.forecasts)!)).toEqual(expected);
  });

  it("the planner's forecast inputs, which the RSO evidence panel renders, keep the basis and changes", () => {
    vi.spyOn(rsoPolicy, "currentRsoUsePolicy").mockReturnValue(fixturePolicy);
    const data = labelledSnapshot();
    const plan = evaluatePlan(data, intent, "outcome", [], false);
    expect(participationDisplay(policyRow(plan.forecastInputs)!)).toEqual(participationDisplay(policyRow(data.forecasts)!));
  });
});
