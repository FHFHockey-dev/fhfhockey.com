import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { executeRosterPlanning } from "./executionAdapter";
import { gameForecastPoints } from "./planning";
import { fixture, now, respond } from "./p07ReviewFixture";
import { packPlanningSnapshots, unpackPlanningSnapshots } from "../rosterScheduleData/bridgeForecastWire";
import { currentBridgeIsAuthorized } from "./currentPlanningRead";
import { currentRsoUsePolicy } from "../player-forecasts/rsoUsePolicy";
beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(now)); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it("serialized selected output remains displayable but cannot authorize a restored planning execution", async () => {
  const { snapshot, body, intent } = fixture();
  vi.stubGlobal("fetch", vi.fn(async () => respond(body)));
  const current = await executeRosterPlanning(snapshot, intent);
  const display = JSON.parse(JSON.stringify(current.displaySnapshot));
  const row = JSON.parse(JSON.stringify(current.result.selected.forecastInputs![0]));
  expect(gameForecastPoints(display, row).expected).toBe(2);
  expect(currentBridgeIsAuthorized(row, currentRsoUsePolicy().revision)).toBe(false);
  const restored = unpackPlanningSnapshots(JSON.parse(JSON.stringify(packPlanningSnapshots(display))));
  const rejected = await executeRosterPlanning(restored, intent, { allowRead: false });
  expect(rejected.result.selected.projectedValue).toBeNull();
  expect(rejected.displaySnapshot.forecasts).toEqual([]);
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("one denied weighted contribution with retained finite means withholds both display totals", async () => {
  const { snapshot, body, intent } = fixture();
  vi.stubGlobal("fetch", vi.fn(async () => respond(body)));
  const result = await executeRosterPlanning(snapshot, intent);
  const display = structuredClone(result.displaySnapshot), row = structuredClone(result.result.selected.forecastInputs![0]);
  display.players[0].playerClass = "goalie";
  display.rules.scoring.weights = { SAVES_GOALIE: 0.2, WINS_GOALIE: 3 };
  row.stats = { SAVES_GOALIE: 10, WINS_GOALIE: 0.5 };
  row.conditionalStats = { SAVES_GOALIE: 20, WINS_GOALIE: 1 };
  const allowed = { assignment: true, totals: true, comparison: true, conditionalTieBreak: false };
  row.contributions = {
    SAVES_GOALIE: { allowedUses: allowed, basis: "per_start", conditionalMean: 20 },
    WINS_GOALIE: { allowedUses: { ...allowed, totals: false }, basis: "per_start", conditionalMean: 1 },
  } as typeof row.contributions;
  expect(gameForecastPoints(display, row)).toEqual({ expected: null, ifStarts: null });
  row.contributions!.WINS_GOALIE.allowedUses.totals = true;
  row.contributions!.WINS_GOALIE.basis = "per_appearance";
  expect(gameForecastPoints(display, row)).toEqual({ expected: 3.5, ifStarts: null });
});
