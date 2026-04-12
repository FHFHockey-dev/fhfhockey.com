import { describe, expect, it } from "vitest";

import {
  DEFAULT_MAX_PENDING_URLS_PER_RUN,
  GOALIE_URLS_PER_DATE,
  NST_GOALIES_REQUEST_INTERVAL_MS,
  NST_SAFE_INTERVAL_MS,
  NST_SMALL_DATE_BURST_MAX_DATES,
  resolveGoalieNstRequestPlan
} from "./nstBurstPlans";
import {
  NST_TEAM_DAILY_BURST_INTERVAL_MS,
  NST_TEAM_DAILY_SAFE_INTERVAL_MS,
  TEAM_DAILY_URLS_PER_DATE,
  resolveTeamDailyNstRequestPlan
} from "./nstBurstPlans";
import {
  NST_TEAM_STATS_SAFE_INTERVAL_MS,
  resolveNstTeamStatsRequestPlan
} from "./nstBurstPlans";

describe("NST route burst plans", () => {
  it("allows update-nst-goalies to burst when two or fewer dates are queued", () => {
    const plan = resolveGoalieNstRequestPlan({
      queuedDates: 2,
      totalQueuedUrls: GOALIE_URLS_PER_DATE * 2,
      maxPendingUrls: DEFAULT_MAX_PENDING_URLS_PER_RUN
    });

    expect(plan.requestCountBudget).toBe(DEFAULT_MAX_PENDING_URLS_PER_RUN);
    expect(plan.burstEligibleByDateCount).toBe(true);
    expect(plan.burstAllowed).toBe(true);
    expect(plan.requestIntervalMs).toBe(0);
  });

  it("forces update-nst-goalies onto the safe interval once the queued date count exceeds the burst threshold", () => {
    const plan = resolveGoalieNstRequestPlan({
      queuedDates: NST_SMALL_DATE_BURST_MAX_DATES + 1,
      totalQueuedUrls: GOALIE_URLS_PER_DATE * (NST_SMALL_DATE_BURST_MAX_DATES + 1),
      maxPendingUrls: GOALIE_URLS_PER_DATE * (NST_SMALL_DATE_BURST_MAX_DATES + 1)
    });

    expect(plan.requestCountBudget).toBe(
      GOALIE_URLS_PER_DATE * (NST_SMALL_DATE_BURST_MAX_DATES + 1)
    );
    expect(plan.burstEligibleByDateCount).toBe(false);
    expect(plan.burstAllowed).toBe(false);
    expect(plan.requestIntervalMs).toBe(NST_GOALIES_REQUEST_INTERVAL_MS);
  });

  it("keeps update-nst-team-daily on burst for one or two queued dates", () => {
    const oneDayPlan = resolveTeamDailyNstRequestPlan(["2026-03-21"]);
    const twoDayPlan = resolveTeamDailyNstRequestPlan([
      "2026-03-20",
      "2026-03-21"
    ]);

    expect(oneDayPlan.requestCount).toBe(TEAM_DAILY_URLS_PER_DATE);
    expect(oneDayPlan.requestIntervalMs).toBe(NST_TEAM_DAILY_BURST_INTERVAL_MS);
    expect(oneDayPlan.burstAllowed).toBe(true);

    expect(twoDayPlan.requestCount).toBe(TEAM_DAILY_URLS_PER_DATE * 2);
    expect(twoDayPlan.requestIntervalMs).toBe(NST_TEAM_DAILY_BURST_INTERVAL_MS);
    expect(twoDayPlan.burstAllowed).toBe(true);
  });

  it("moves update-nst-team-daily to the safe interval at three dates", () => {
    const dates = ["2026-03-19", "2026-03-20", "2026-03-21"];
    const plan = resolveTeamDailyNstRequestPlan(dates);

    expect(plan.requestCount).toBe(TEAM_DAILY_URLS_PER_DATE * dates.length);
    expect(plan.burstAllowed).toBe(false);
    expect(plan.requestIntervalMs).toBe(NST_TEAM_DAILY_SAFE_INTERVAL_MS);
  });

  it("keeps update-nst-team-daily on the safe interval for larger queued date counts", () => {
    const dates = [
      "2026-03-09",
      "2026-03-10",
      "2026-03-11",
      "2026-03-12",
      "2026-03-13",
      "2026-03-14",
      "2026-03-15",
      "2026-03-16",
      "2026-03-17",
      "2026-03-18",
      "2026-03-19",
      "2026-03-20",
      "2026-03-21"
    ];
    const plan = resolveTeamDailyNstRequestPlan(dates);

    expect(plan.requestCount).toBe(TEAM_DAILY_URLS_PER_DATE * dates.length);
    expect(plan.requestIntervalMs).toBe(NST_TEAM_DAILY_SAFE_INTERVAL_MS);
    expect(plan.burstAllowed).toBe(false);
  });

  it("allows nst-team-stats to burst when the run is within two queued dates", () => {
    const plan = resolveNstTeamStatsRequestPlan({
      queuedDates: 1,
      dateRequestCount: 4,
      seasonRequestCount: 2
    });

    expect(plan.requestCount).toBe(6);
    expect(plan.burstAllowed).toBe(true);
    expect(plan.requestIntervalMs).toBe(0);
  });

  it("keeps nst-team-stats on the safe interval once the queued date count exceeds the burst threshold", () => {
    const plan = resolveNstTeamStatsRequestPlan({
      queuedDates: 3,
      dateRequestCount: 12,
      seasonRequestCount: 0
    });

    expect(plan.burstAllowed).toBe(false);
    expect(plan.requestIntervalMs).toBe(NST_TEAM_STATS_SAFE_INTERVAL_MS);
  });

  it("retains the safe interval candidate if a future request footprint stops qualifying for burst by request volume", () => {
    const dates = Array.from({ length: 23 }, (_, index) =>
      `2026-03-${String(index + 1).padStart(2, "0")}`
    );
    const plan = resolveTeamDailyNstRequestPlan(dates);

    expect(plan.burstAllowed).toBe(false);
    expect(plan.requestIntervalMs).toBe(NST_SAFE_INTERVAL_MS);
  });
});
