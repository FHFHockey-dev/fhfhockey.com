import { describe, expect, it } from "vitest";
import { forecastCalendarPolicy } from "lib/player-forecasts/contributions";
import type { PlanningGame } from "lib/rosterScheduleOptimizer/planningTypes";
import type { ForgeGameRevision } from "./gameRevisions";
import { publicPlanningForecasts } from "./consumerRevisionAdmission";

describe("consumer revision calendar horizon (decision 127)", () => {
  // 9 pm ET on Nov 12 (already Nov 13 UTC); a 1 pm ET game on Nov 26 is lead 13 on UTC days, lead 14 on NHL dates.
  const now = new Date("2026-11-13T02:00:00Z");
  const game: PlanningGame = { id: "41", date: "2026-11-26", startsAt: "2026-11-26T18:00:00Z", teamAbbreviation: "MIN", opponent: "TOR",
    home: true, status: "scheduled", scheduleRevision: "schedule-a" } as PlanningGame;
  const revision = { id: "rev-41", run_id: "run", game_id: 41, published_at: "2026-11-12T20:00:00Z", decision_as_of: "2026-11-12T19:00:00Z",
    payload: { players: [], goalies: [], teams: [] } } as unknown as ForgeGameRevision;
  const exclusionsUnder = (policy: Parameters<typeof publicPlanningForecasts>[7]) => {
    const exclusions: Record<string, number> = {};
    publicPlanningForecasts([revision], [], [game], now, exclusions, [], undefined, policy);
    return exclusions;
  };

  it("measures the horizon on the policy's date basis, using the schedule's own date under v2", () => {
    expect(exclusionsUnder(forecastCalendarPolicy(14, "forecast-calendar-v1")).outside_horizon).toBeUndefined();
    // The default is v2 since decision 127's flip.
    expect(exclusionsUnder(undefined).outside_horizon).toBe(1);
    expect(exclusionsUnder(forecastCalendarPolicy(14, "forecast-calendar-v2")).outside_horizon).toBe(1);
    // The schedule date wins over the start instant: listed for Nov 25, the same start is lead 13 under v2.
    const exclusions: Record<string, number> = {};
    publicPlanningForecasts([revision], [], [{ ...game, date: "2026-11-25" }], now, exclusions, [], undefined, forecastCalendarPolicy(14, "forecast-calendar-v2"));
    expect(exclusions.outside_horizon).toBeUndefined();
  });
});
