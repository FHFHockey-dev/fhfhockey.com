import { describe, expect, it } from "vitest";
import { customRangeLimits, customRangeReason, matchupCalendar, matchupLabel, matchupPager, periodDates, periodWindowFields, resolvePeriodWindow, type MatchupRow, type PeriodMode, type PeriodWindowSettings } from "./periodWindow";
import { loadMatchupWeeks } from "./periodWindow.sources";

/** This season's shape: a short first week, normal weeks, a 14-day break, and a row with no dates. */
const rows: MatchupRow[] = [
  { week: 1, start_date: "2026-09-29", end_date: "2026-10-04" },
  { week: 2, start_date: "2026-10-05", end_date: "2026-10-11" },
  { week: 3, start_date: "2026-10-12", end_date: "2026-10-25" },
  { week: 4, start_date: null, end_date: null },
  { week: 5, start_date: "2026-10-26", end_date: "2026-11-01" },
  { week: 6, start_date: "2026-11-02", end_date: "2026-11-08" },
];
const calendar = matchupCalendar(rows);
const matchup = (week: number | null): PeriodWindowSettings => ({ period: "matchup", week, start: null, end: null });
const custom = (start: string | null, end: string | null): PeriodWindowSettings => ({ period: "custom", week: null, start, end });
const pastOnly: { mode: PeriodMode; cutoff: string } = { mode: "past-only", cutoff: "2026-10-28" }, anyWeek: typeof pastOnly = { mode: "any-week", cutoff: "2026-10-28" };

describe("matchup calendar", () => {
  it("skips a row with no dates, with a reason", () => {
    expect(calendar.weeks.map(week => week.week)).toEqual([1, 2, 3, 5, 6]);
    expect(calendar.reasons).toEqual(["Week 4 has no dates on the matchup calendar, so it is skipped."]);
    expect(matchupCalendar([{ week: 2, start_date: "2026-10-05", end_date: null }]).weeks).toEqual([]);
  });
  it("turns overlapping weeks into a reason rather than a guess", () => {
    const overlap = matchupCalendar([{ week: 1, start_date: "2026-10-01", end_date: "2026-10-07" }, { week: 2, start_date: "2026-10-07", end_date: "2026-10-14" }]);
    expect(overlap.weeks).toEqual([]);
    expect(overlap.reasons[0]).toMatch(/overlap/);
  });
});

describe("period window", () => {
  it("takes each week's real length: short, normal and long", () => {
    expect(resolvePeriodWindow(matchup(1), calendar, pastOnly).window).toEqual({ kind: "matchup", week: 1, from: "2026-09-29", through: "2026-10-04", label: "Week 1 · Sep 29 to Oct 4", days: 6 });
    expect(resolvePeriodWindow(matchup(2), calendar, pastOnly).window).toMatchObject({ days: 7 });
    expect(resolvePeriodWindow(matchup(3), calendar, pastOnly).window).toMatchObject({ days: 14, label: "Week 3 · Oct 12 to Oct 25" });
  });
  it("refuses a skipped week and one that is not on the calendar", () => {
    expect(resolvePeriodWindow(matchup(4), calendar, anyWeek).reason).toBe("Week 4 is not on the matchup calendar.");
    expect(resolvePeriodWindow(matchup(27), calendar, anyWeek).reason).toBe("Week 27 is not on the matchup calendar.");
  });
  it("past-only refuses a week not started and keeps one under way, while any-week opens every week", () => {
    expect(resolvePeriodWindow(matchup(6), calendar, pastOnly).reason).toBe("Week 6 has not started; data runs through 2026-10-28.");
    expect(resolvePeriodWindow(matchup(5), calendar, pastOnly).window?.week).toBe(5);
    expect(resolvePeriodWindow(matchup(6), calendar, anyWeek).window?.week).toBe(6);
  });
  it("moves a schedule's blank week on once the week's last day is the cutoff, so Monday opens the new week", () => {
    const calendar = matchupCalendar([{ week: 1, start_date: "2026-10-19", end_date: "2026-10-25" }, { week: 2, start_date: "2026-10-26", end_date: "2026-11-01" }]);
    const blankWeekOn = (cutoff: string) => resolvePeriodWindow({ period: "matchup", week: null, start: null, end: null }, calendar, { mode: "any-week", cutoff }).window?.week;
    expect(blankWeekOn("2026-10-24")).toBe(1);
    expect(blankWeekOn("2026-10-25")).toBe(2);
  });

  it("reads a blank week as the last completed for results and the one under way for a schedule", () => {
    expect(resolvePeriodWindow(matchup(null), calendar, pastOnly).window?.week).toBe(3);
    expect(resolvePeriodWindow(matchup(null), calendar, anyWeek).window?.week).toBe(5);
    expect(resolvePeriodWindow(matchup(null), calendar, { ...anyWeek, cutoff: "2027-06-01" }).window?.week).toBe(6);
    expect(resolvePeriodWindow(matchup(null), calendar, { ...pastOnly, cutoff: "2026-09-01" }).reason).toBe("No matchup week has started.");
    expect(resolvePeriodWindow(matchup(null), { weeks: [], reasons: [] }, anyWeek).reason).toBe("No matchup week has started.");
  });
  it("follows a post's own matchup value", () => {
    expect(resolvePeriodWindow({ ...matchup(2), period: "week" }, calendar, { ...pastOnly, matchupValue: "week" }).window).toMatchObject({ kind: "week", week: 2 });
  });
  it("validates a custom range and counts its days", () => {
    expect(resolvePeriodWindow(custom("2026-10-08", "2026-10-20"), calendar, pastOnly).window).toEqual({ kind: "custom", week: null, from: "2026-10-08", through: "2026-10-20", label: "Oct 8 to Oct 20", days: 13 });
    for (const [start, end] of [[null, "2026-10-20"], ["2026-10-08", null], [null, null]]) expect(resolvePeriodWindow(custom(start, end), calendar, pastOnly).reason).toBe("A custom range needs a start date and an end date.");
    for (const [start, end] of [["2026-10-20", "2026-10-08"], ["2026-10-20", "2026-10-20"]]) {
      expect(resolvePeriodWindow(custom(start, end), calendar, pastOnly).reason).toBe("The start date must be before the end date.");
      expect(customRangeReason({ start, end })).toBe("The start date must be before the end date.");
    }
    expect(resolvePeriodWindow(custom("2026-09-01", "2026-10-20"), calendar, pastOnly).reason).toBe("The range must fall inside the season, 2026-09-29 to 2026-11-08.");
    expect(resolvePeriodWindow(custom("2026-10-08", "2026-11-20"), calendar, anyWeek).reason).toBe("The range must fall inside the season, 2026-09-29 to 2026-11-08.");
    expect(resolvePeriodWindow(custom("2026-10-08", "2026-10-20"), { weeks: [], reasons: [] }, pastOnly).reason).toBe("The range must fall inside the season, not started to not started.");
  });
  it("past-only stops a custom range at the cutoff, and any-week does not", () => {
    expect(resolvePeriodWindow(custom("2026-10-20", "2026-10-29"), calendar, pastOnly).reason).toBe("The end date 2026-10-29 is past the last completed games, 2026-10-28.");
    expect(resolvePeriodWindow(custom("2026-10-20", "2026-11-05"), calendar, anyWeek).window?.days).toBe(17);
    expect(customRangeLimits(calendar, pastOnly)).toEqual({ min: "2026-09-29", max: "2026-10-28" });
    expect(customRangeLimits(calendar, anyWeek)).toEqual({ min: "2026-09-29", max: "2026-11-08" });
    expect(customRangeLimits(calendar, { ...pastOnly, cutoff: "2027-01-01" }).max).toBe("2026-11-08");
  });
  it("hands a post's own default its dates, its reason, or says the period is unknown", () => {
    const own = { rolling: (cutoff: string) => ({ from: "2026-10-22", through: cutoff, label: `Last 7 days, through ${cutoff}` }), early: () => ({ reason: "Too early." }) };
    const settings = (period: string) => ({ ...matchup(null), period });
    expect(resolvePeriodWindow(settings("rolling"), calendar, { ...pastOnly, own }).window).toEqual({ kind: "rolling", week: null, from: "2026-10-22", through: "2026-10-28", label: "Last 7 days, through 2026-10-28", days: 7 });
    expect(resolvePeriodWindow(settings("early"), calendar, { ...pastOnly, own }).reason).toBe("Too early.");
    expect(resolvePeriodWindow(settings("other"), calendar, { ...pastOnly, own }).reason).toBe("Period other is not available.");
  });
  it("writes the dates plainly, with years only across a new year", () => {
    expect(periodDates("2026-12-28", "2027-01-03")).toBe("Dec 28, 2026 to Jan 3, 2027");
    expect(matchupLabel({ week: 4, start: "2026-10-19", end: "2026-10-25" })).toBe("Week 4 · Oct 19 to Oct 25");
  });
});

describe("matchup pager", () => {
  const step = (week: number | null, options = pastOnly) => { const pager = matchupPager(week, calendar, options); return [pager.current?.week ?? null, pager.prior?.week ?? null, pager.next?.week ?? null]; };
  it("stops at both ends of the calendar", () => {
    expect(step(1, anyWeek)).toEqual([1, null, 2]);
    expect(step(6, anyWeek)).toEqual([6, 5, null]);
  });
  it("steps over a skipped week", () => {
    expect(step(3, anyWeek)).toEqual([3, 2, 5]);
    expect(step(5, anyWeek)).toEqual([5, 3, 6]);
  });
  it("past-only has no next past the week under way", () => {
    expect(step(5)).toEqual([5, 3, null]);
    expect(step(3)).toEqual([3, 2, 5]);
  });
  it("starts from the blank week's default, and shows the same week the resolver does", () => {
    expect(step(null)).toEqual([3, 2, 5]);
    expect(step(null, anyWeek)).toEqual([5, 3, 6]);
    expect(matchupPager(null, calendar, pastOnly).label).toBe("Week 3 · Oct 12 to Oct 25");
  });
  it("offers a way back from a week the calendar does not have", () => {
    const pager = matchupPager(27, calendar, pastOnly);
    expect(pager).toMatchObject({ current: null, label: "Week 27 is not on the calendar", next: null });
    expect(pager.prior?.week).toBe(5);
  });
});

describe("period fields and read", () => {
  it("names the four fields and keeps them off the settings form", () => {
    const fields = periodWindowFields({ mode: "any-week", options: [{ value: "matchup", label: "Matchup" }, { value: "custom", label: "Custom" }] });
    expect(fields.map(field => [field.id, field.default, field.panelOnly])).toEqual([["period", "matchup", true], ["week", null, true], ["start", null, true], ["end", null, true]]);
    expect(fields[1].label).toBe("Week (blank is the current)");
  });
  it("reads one season's rows, with the season as text, and the loaders' cutoff", async () => {
    const calls: unknown[][] = [];
    const chain: Record<string, unknown> = { select: () => chain, order: () => chain, eq: (...args: unknown[]) => { calls.push(args); return chain; }, range: async () => ({ data: rows, error: null, count: rows.length }) };
    const result = await loadMatchupWeeks({ from: table => { calls.push([table]); return chain; } }, "2026-10-29T16:00:00Z");
    expect(calls).toEqual([["yahoo_matchup_weeks"], ["season", "2026"]]);
    expect(result).toEqual({ rows, cutoff: "2026-10-28" });
  });
  it("fails closed over its ceiling", async () => {
    const chain: Record<string, unknown> = { select: () => chain, order: () => chain, eq: () => chain, range: async (start: number, end: number) => ({ data: Array.from({ length: 41 }, () => rows[0]).slice(start, end + 1), error: null, count: 41 }) };
    await expect(loadMatchupWeeks({ from: () => chain }, "2026-10-29T16:00:00Z")).rejects.toThrow(/40-row limit/);
  });
});
