import { describe, expect, it } from "vitest";
import { assessGoalieFreshness, type ExpectedGoalieGame, type NstGoalieGame } from "./goalieFreshness";

const row = (date: string, goalieId = 1): ExpectedGoalieGame => ({ season: "20262027", date, goalieId });
const nst = (date: string, goalieId = 1, hdShotsAgainst: number | null = 0): NstGoalieGame => ({ ...row(date, goalieId), hdShotsAgainst });
function assess(overrides: Partial<Parameters<typeof assessGoalieFreshness>[0]> = {}) {
  return assessGoalieFreshness({ now: new Date("2026-11-01T13:00:00Z"), season: "20262027",
    seasonStartDate: "2026-10-07", regularSeasonEndDate: "2027-04-15",
    finalGameDates: ["2026-10-29", "2026-10-30", "2026-10-31"],
    expected: [row("2026-10-29"), row("2026-10-30"), row("2026-10-31")],
    observed: [nst("2026-10-29"), nst("2026-10-30"), nst("2026-10-31")],
    calendarComplete: true, wgoComplete: true, nstComplete: true,
    noProgressWindows: 0, writerAuditPresent: true, writerAuditExpected: true, ...overrides });
}

describe("goalie freshness", () => {
  it("alerts on a missing middle date even when newest dates match", () => {
    const result = assess({ observed: [nst("2026-10-29"), nst("2026-10-31")] });
    expect(result.status).toBe("warning");
    expect(result.latestCompleteDate).toBe(result.latestExpectedDate);
    expect(result.missing).toEqual([{ ...row("2026-10-30"), reason: "missing_row" }]);
  });

  it("alerts on partial date coverage and missing HD without treating zero as missing", () => {
    const result = assess({ expected: [row("2026-10-29"), row("2026-10-30"), row("2026-10-31"), row("2026-10-31", 2)],
      observed: [nst("2026-10-29"), nst("2026-10-30"), nst("2026-10-31", 1, null)] });
    expect(result.expected).toBe(4);
    expect(result.matched).toBe(2);
    expect(result.missing.map(value => value.reason)).toEqual(["missing_hd", "missing_row"]);
    expect(result.perDate.at(-1)).toEqual({ date: "2026-10-31", expected: 2, matched: 0 });
    expect(assess().status).toBe("healthy");
  });

  it("uses season and goalie identity in the join, not names or date alone", () => {
    const result = assess({ observed: [nst("2026-10-29"), nst("2026-10-30"), nst("2026-10-31", 2),
      { ...nst("2026-10-31"), season: "20252026" }] });
    expect(result.matched).toBe(2);
    expect(result.missing[0].goalieId).toBe(1);
  });

  it("returns unknown for truncated/failed reads and stale WGO", () => {
    for (const field of ["calendarComplete", "wgoComplete", "nstComplete"] as const) {
      const result = assess({ [field]: false });
      expect(result.status).toBe("unknown");
      expect(result.expected).toBeNull();
    }
    expect(assess({ expected: [row("2026-10-29"), row("2026-10-30")] }).status).toBe("unknown");
  });

  it("keeps missing audits separate from independently observed healthy coverage", () => {
    const result = assess({ writerAuditPresent: false });
    expect(result.status).toBe("healthy");
    expect(result.warnings).toContain("No acknowledged goalie writer audit in the expected window.");
    expect(assess({ writerAuditPresent: false, writerAuditExpected: false }).warnings).toEqual([]);
  });

  it("escalates persistent gaps or two no-progress windows", () => {
    expect(assess({ observed: [nst("2026-10-30"), nst("2026-10-31")] }).status).toBe("critical");
    expect(assess({ observed: [nst("2026-10-29"), nst("2026-10-30")], noProgressWindows: 2 }).status).toBe("critical");
    expect(assess({ observed: [], now: new Date("2026-11-01T12:40:00Z") }).status).toBe("not_due");
  });

  it("deduplicates identical keys but rejects conflicting or invalid NST evidence", () => {
    expect(assess({ observed: [nst("2026-10-29"), nst("2026-10-30"), nst("2026-10-31"), nst("2026-10-31")] }).matched).toBe(3);
    expect(assess({ observed: [nst("2026-10-31"), nst("2026-10-31", 1, 4)] }).status).toBe("unknown");
    expect(assess({ observed: [nst("2026-10-31", 1, NaN)] }).status).toBe("unknown");
  });

  it("does not create no-game/offseason lag or include today's unfinished games", () => {
    expect(assess({ finalGameDates: [], expected: [], observed: [] }).status).toBe("healthy");
    const result = assess({ expected: [row("2026-10-29"), row("2026-10-30"), row("2026-10-31"), row("2026-11-01")],
      finalGameDates: ["2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"] });
    expect(result.expected).toBe(3);
    expect(result.status).toBe("healthy");
    expect(assess({ now: new Date("2026-11-10T13:00:00Z"), regularSeasonEndDate: "2026-10-31" }).cutoffDate).toBe("2026-10-31");
  });

  it("ignores out-of-window historical outliers without masking recent gaps", () => {
    const result = assess({ expected: [row("2026-10-10", 2), row("2026-10-29"), row("2026-10-30"), row("2026-10-31")],
      finalGameDates: ["2026-10-10", "2026-10-29", "2026-10-30", "2026-10-31"] });
    expect(result.expected).toBe(3);
    expect(result.status).toBe("healthy");
  });
});
