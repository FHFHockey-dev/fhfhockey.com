import { describe, expect, it } from "vitest";

import { buildDashboardRecencyState } from "./dataFetchers";

const withDates = (teamPower: string, startChart: string) =>
  ({
    teamTrends: { dateUsed: teamPower },
    teamCtpi: { dateUsed: null },
    teamSos: { dateUsed: null },
    skaterTrends: { dateUsed: null },
    goalieTrends: { dateUsed: null },
    forgePlayers: { asOfDate: null },
    forgeGoalies: { asOfDate: null },
    startChart: { dateUsed: startChart }
  }) as unknown as Parameters<typeof buildDashboardRecencyState>[0];

describe("buildDashboardRecencyState (W3-3 D9)", () => {
  it("labels a four-day gap as possibly out of date, not as downgraded", () => {
    const state = buildDashboardRecencyState(withDates("2026-11-06", "2026-11-10"));
    expect(state.status).toBe("mixed");
    expect(state.gapDays).toBe(4);
    expect(state.warning).toMatch(/may be out of date/);
    expect(state.warning).not.toMatch(/downgraded/);
  });

  it("keeps a three-day gap aligned with no warning", () => {
    const state = buildDashboardRecencyState(withDates("2026-11-07", "2026-11-10"));
    expect(state).toMatchObject({ status: "aligned", gapDays: 3, warning: null });
  });
});
