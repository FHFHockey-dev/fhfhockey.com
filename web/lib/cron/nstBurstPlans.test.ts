import { describe, expect, it } from "vitest";

import {
  DEFAULT_MAX_PENDING_URLS_PER_RUN,
  GOALIE_URLS_PER_DATE,
  NST_GOALIES_REQUEST_INTERVAL_MS,
  resolveGoalieNstRequestPlan
} from "./nstBurstPlans";
import {
  NST_TEAM_DAILY_BURST_INTERVAL_MS,
  NST_TEAM_DAILY_MULTI_DATE_INTERVAL_MS,
  NST_TEAM_DAILY_SMALL_INTERVAL_MS,
  TEAM_DAILY_URLS_PER_DATE,
  resolveTeamDailyNstRequestPlan
} from "./nstBurstPlans";
import {
  NST_TEAM_STATS_SAFE_INTERVAL_MS,
  resolveNstTeamStatsRequestPlan
} from "./nstBurstPlans";

describe("NST route burst plans", () => {
  it("allows update-nst-goalies to burst when the bounded per-run URL budget is safe", () => {
    const plan = resolveGoalieNstRequestPlan({
      queuedDates: 2,
      totalQueuedUrls: GOALIE_URLS_PER_DATE * 2,
      maxPendingUrls: DEFAULT_MAX_PENDING_URLS_PER_RUN
    });

    expect(plan.requestCountBudget).toBe(DEFAULT_MAX_PENDING_URLS_PER_RUN);
    expect(plan.burstAllowed).toBe(true);
    expect(plan.requestIntervalMs).toBe(0);
  });

  it("forces update-nst-goalies back to the safe interval when an explicit burst override is unsafe", () => {
    const plan = resolveGoalieNstRequestPlan({
      queuedDates: 5,
      totalQueuedUrls: GOALIE_URLS_PER_DATE * 5,
      maxPendingUrls: 50,
      explicitRequestIntervalMs: 0
    });

    expect(plan.requestCountBudget).toBe(50);
    expect(plan.burstAllowed).toBe(false);
    expect(plan.explicitIntervalRejected).toBe(true);
    expect(plan.requestIntervalMs).toBe(NST_GOALIES_REQUEST_INTERVAL_MS);
  });

  it("keeps update-nst-team-daily on burst while the total request count still fits the NST ceilings", () => {
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

  it("uses the small interval once burst would exceed the one-minute cap", () => {
    const dates = ["2026-03-16", "2026-03-17", "2026-03-18", "2026-03-19", "2026-03-20", "2026-03-21"];
    const plan = resolveTeamDailyNstRequestPlan(dates);

    expect(plan.requestCount).toBe(TEAM_DAILY_URLS_PER_DATE * dates.length);
    expect(plan.requestIntervalMs).toBe(NST_TEAM_DAILY_SMALL_INTERVAL_MS);
    expect(plan.burstAllowed).toBe(false);
  });

  it("forces update-nst-team-daily onto the long interval when the request count outgrows the small interval", () => {
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
    expect(plan.requestIntervalMs).toBe(NST_TEAM_DAILY_MULTI_DATE_INTERVAL_MS);
  });

  it("allows nst-team-stats to burst for the current one-date plus optional season-tail footprint", () => {
    const plan = resolveNstTeamStatsRequestPlan({
      dateRequestCount: 4,
      seasonRequestCount: 2
    });

    expect(plan.requestCount).toBe(6);
    expect(plan.burstAllowed).toBe(true);
    expect(plan.requestIntervalMs).toBe(0);
  });

  it("retains the safe interval candidate if a future request footprint ever stops qualifying for burst", () => {
    const plan = resolveNstTeamStatsRequestPlan({
      dateRequestCount: 41,
      seasonRequestCount: 0
    });

    expect(plan.burstAllowed).toBe(false);
    expect(plan.requestIntervalMs).toBe(NST_TEAM_STATS_SAFE_INTERVAL_MS);
  });
});
