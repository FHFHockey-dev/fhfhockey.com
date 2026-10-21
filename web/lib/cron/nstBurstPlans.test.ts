import { describe, expect, it } from "vitest";

import {
  DEFAULT_MAX_PENDING_URLS_PER_RUN,
  GOALIE_URLS_PER_DATE,
  NST_GOALIES_REQUEST_INTERVAL_MS,
  NST_SAFE_INTERVAL_MS,
  resolveGoalieNstRequestPlan,
  resolveNstGamelogRequestPlan
} from "./nstBurstPlans";
import {
  NST_TEAM_DAILY_SAFE_INTERVAL_MS,
  TEAM_DAILY_URLS_PER_DATE,
  resolveTeamDailyNstRequestPlan
} from "./nstBurstPlans";
import {
  NST_TEAM_STATS_SAFE_INTERVAL_MS,
  resolveNstTeamStatsRequestPlan
} from "./nstBurstPlans";

describe("NST full-job pacing plans", () => {
  it("bursts only full gamelog jobs below 40 URLs, independently of date aperture", () => {
    expect(resolveNstGamelogRequestPlan({ queuedDates: 2, requestCount: 39 })).toMatchObject({ burstAllowed: true, requestIntervalMs: 0 });
    expect(resolveNstGamelogRequestPlan({ queuedDates: 1, requestCount: 1 }).requestIntervalMs).toBe(0);
    expect(resolveNstGamelogRequestPlan({ queuedDates: 2, requestCount: 40 })).toMatchObject({ burstAllowed: false, requestIntervalMs: 21_000 });
    expect(resolveNstGamelogRequestPlan({ queuedDates: 3, requestCount: 3 }).requestIntervalMs).toBe(0);
    expect(resolveNstGamelogRequestPlan({ queuedDates: 2, requestCount: 41 }).burstAllowed).toBe(false);
  });
  it("bursts update-nst-goalies when its full queue is below 40 URLs", () => {
    const plan = resolveGoalieNstRequestPlan({
      queuedDates: 2,
      totalQueuedUrls: GOALIE_URLS_PER_DATE * 2,
      maxPendingUrls: DEFAULT_MAX_PENDING_URLS_PER_RUN
    });

    expect(plan.requestCountBudget).toBe(DEFAULT_MAX_PENDING_URLS_PER_RUN);
    expect(plan.burstEligibleByRequestCount).toBe(true);
    expect(plan.burstAllowed).toBe(true);
    expect(plan.requestIntervalMs).toBe(0);
  });

  it("bursts a full goalie queue below 40 URLs independently of date count", () => {
    const plan = resolveGoalieNstRequestPlan({
      queuedDates: 3,
      totalQueuedUrls: GOALIE_URLS_PER_DATE * 3,
      maxPendingUrls: GOALIE_URLS_PER_DATE * 3
    });

    expect(plan.requestCountBudget).toBe(
      GOALIE_URLS_PER_DATE * 3
    );
    expect(plan.burstEligibleByRequestCount).toBe(true);
    expect(plan.burstAllowed).toBe(true);
    expect(plan.requestIntervalMs).toBe(0);
  });

  it("bursts update-nst-team-daily for one or two queued dates", () => {
    const oneDayPlan = resolveTeamDailyNstRequestPlan(["2026-03-21"]);
    const twoDayPlan = resolveTeamDailyNstRequestPlan([
      "2026-03-20",
      "2026-03-21"
    ]);

    expect(oneDayPlan.requestCount).toBe(TEAM_DAILY_URLS_PER_DATE);
    expect(oneDayPlan.requestIntervalMs).toBe(0);
    expect(oneDayPlan.burstAllowed).toBe(true);

    expect(twoDayPlan.requestCount).toBe(TEAM_DAILY_URLS_PER_DATE * 2);
    expect(twoDayPlan.requestIntervalMs).toBe(0);
    expect(twoDayPlan.burstAllowed).toBe(true);
  });

  it("bursts update-nst-team-daily while the full queue is below 40 URLs", () => {
    const dates = ["2026-03-19", "2026-03-20", "2026-03-21"];
    const plan = resolveTeamDailyNstRequestPlan(dates);

    expect(plan.requestCount).toBe(TEAM_DAILY_URLS_PER_DATE * dates.length);
    expect(plan.burstAllowed).toBe(true);
    expect(plan.requestIntervalMs).toBe(0);
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

  it("bursts nst-team-stats when its full run is below 40 URLs", () => {
    const plan = resolveNstTeamStatsRequestPlan({
      queuedDates: 1,
      dateRequestCount: 4,
      seasonRequestCount: 2
    });

    expect(plan.requestCount).toBe(6);
    expect(plan.burstAllowed).toBe(true);
    expect(plan.requestIntervalMs).toBe(0);
  });

  it("bursts small nst-team-stats jobs independently of date count", () => {
    const plan = resolveNstTeamStatsRequestPlan({
      queuedDates: 3,
      dateRequestCount: 12,
      seasonRequestCount: 0
    });

    expect(plan.burstAllowed).toBe(true);
    expect(plan.requestIntervalMs).toBe(0);
  });

  it("paces nst-team-stats queues of 40 or more URLs at 21 seconds", () => {
    const plan = resolveNstTeamStatsRequestPlan({
      queuedDates: 10,
      dateRequestCount: 40,
      seasonRequestCount: 0
    });

    expect(plan.burstEligibleByRequestCount).toBe(false);
    expect(plan.burstAllowed).toBe(false);
    expect(plan.requestIntervalMs).toBe(NST_TEAM_STATS_SAFE_INTERVAL_MS);
  });

  it.each([-1, 20_999, NaN, Infinity])("rejects unsafe explicit goalie spacing %s", (interval) => {
    const plan = resolveGoalieNstRequestPlan({ queuedDates: 1, totalQueuedUrls: 1,
      maxPendingUrls: 1, explicitRequestIntervalMs: interval });
    expect(plan).toMatchObject({ requestIntervalMs: NST_SAFE_INTERVAL_MS, burstAllowed: false,
      explicitIntervalRejected: true, usedExplicitInterval: false });
  });

  it("allows explicit zero only for a full job below 40 URLs", () => {
    expect(resolveGoalieNstRequestPlan({ queuedDates: 1, totalQueuedUrls: 39,
      maxPendingUrls: 1, explicitRequestIntervalMs: 0 })).toMatchObject({
      requestIntervalMs: 0, burstAllowed: true, usedExplicitInterval: true });
    expect(resolveGoalieNstRequestPlan({ queuedDates: 1, totalQueuedUrls: 40,
      maxPendingUrls: 1, explicitRequestIntervalMs: 0 })).toMatchObject({
      requestIntervalMs: NST_SAFE_INTERVAL_MS, burstAllowed: false, explicitIntervalRejected: true });
  });

  it("retains a longer explicit goalie interval", () => {
    expect(resolveGoalieNstRequestPlan({ queuedDates: 1, totalQueuedUrls: 1,
      maxPendingUrls: 1, explicitRequestIntervalMs: 30_000 })).toMatchObject({
      requestIntervalMs: 30_000, usedExplicitInterval: true, explicitIntervalRejected: false });
  });

  it("does not hide a large goalie backlog behind a small per-run cap", () => {
    const plan = resolveGoalieNstRequestPlan({
      queuedDates: 5,
      totalQueuedUrls: 50,
      maxPendingUrls: 20
    });

    expect(plan.requestCountBudget).toBe(20);
    expect(plan.burstEligibleByRequestCount).toBe(false);
    expect(plan.burstAllowed).toBe(false);
    expect(plan.requestIntervalMs).toBe(NST_GOALIES_REQUEST_INTERVAL_MS);
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
