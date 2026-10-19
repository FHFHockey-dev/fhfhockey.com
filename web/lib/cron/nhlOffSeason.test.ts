import { describe, expect, it, vi } from "vitest";
import {
  resolveNhlSeasonWindow,
  withNhlOffSeasonSkip,
  type NhlSeasonSpan,
  type NhlSeasonWindow,
} from "./nhlOffSeason";

const finished: NhlSeasonSpan = {
  seasonId: 20252026,
  startDate: "2025-10-07T00:00:00",
  endDate: "2026-06-15T00:00:00",
  firstGameDate: "2025-09-21",
  lastGameDate: "2026-06-15",
};
const next: NhlSeasonSpan = {
  seasonId: 20262027,
  startDate: "2026-09-29T00:00:00",
  endDate: "2027-06-10T00:00:00",
  firstGameDate: "2026-09-19",
  lastGameDate: "2027-04-10",
};
// Noon UTC is always the same calendar day in New York.
const at = (date: string) => new Date(`${date}T16:00:00.000Z`);

describe("resolveNhlSeasonWindow", () => {
  it("is in season from the first preseason game through the grace days", () => {
    expect(resolveNhlSeasonWindow([next, finished], at("2026-09-19"))).toMatchObject({
      state: "in_season",
      seasonId: 20262027,
      activeFrom: "2026-09-19",
    });
    expect(resolveNhlSeasonWindow([finished], at("2026-06-18"))).toMatchObject({
      state: "in_season",
      seasonId: 20252026,
      activeUntil: "2026-06-18",
    });
  });

  it("is off season after the grace days while the next schedule is unpublished", () => {
    expect(resolveNhlSeasonWindow([finished], at("2026-06-19"))).toEqual({
      state: "off_season",
      today: "2026-06-19",
      lastSeasonId: 20252026,
      lastActiveUntil: "2026-06-18",
      nextSeasonId: null,
      resumesOn: null,
    });
  });

  it("resumes at the next season's first scheduled game, preseason included", () => {
    expect(resolveNhlSeasonWindow([next, finished], at("2026-08-01"))).toMatchObject({
      state: "off_season",
      nextSeasonId: 20262027,
      resumesOn: "2026-09-19",
    });
  });

  it("falls back to the regular-season start when the schedule has no games yet", () => {
    const unscheduled = { ...next, firstGameDate: null, lastGameDate: null };
    expect(resolveNhlSeasonWindow([unscheduled, finished], at("2026-09-20"))).toMatchObject({
      state: "off_season",
      resumesOn: "2026-09-29",
    });
  });

  it("extends the window when games run past the published end date", () => {
    const late = { ...finished, lastGameDate: "2026-06-20" };
    expect(resolveNhlSeasonWindow([late], at("2026-06-22"))).toMatchObject({
      state: "in_season",
    });
  });

  it("is unknown without usable season dates", () => {
    expect(resolveNhlSeasonWindow([], at("2026-08-01"))).toMatchObject({
      state: "unknown",
    });
  });
});

function response() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status: vi.fn((code: number) => {
      res.statusCode = code;
      return res;
    }),
    json: vi.fn((body: unknown) => {
      res.body = body;
      return res;
    }),
  };
  return res;
}

const offSeason: NhlSeasonWindow = {
  state: "off_season",
  today: "2026-08-01",
  lastSeasonId: 20252026,
  lastActiveUntil: "2026-06-18",
  nextSeasonId: null,
  resumesOn: null,
};

describe("withNhlOffSeasonSkip", () => {
  it("skips the handler in the off season with a skipped receipt", async () => {
    const handler = vi.fn();
    const res = response();
    await withNhlOffSeasonSkip(handler, { loadWindow: async () => offSeason })(
      { query: {} } as never,
      res as never,
    );
    expect(handler).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      skipped: true,
      reason: "nhl_off_season",
    });
  });

  it("runs when asked to ignore the off season, without reading the window", async () => {
    const handler = vi.fn();
    const loadWindow = vi.fn(async () => offSeason);
    await withNhlOffSeasonSkip(handler, { loadWindow })(
      { query: { ignoreOffSeason: "true" } } as never,
      response() as never,
    );
    expect(handler).toHaveBeenCalledTimes(1);
    expect(loadWindow).not.toHaveBeenCalled();
  });

  it.each<NhlSeasonWindow>([
    { state: "unknown", today: "2026-08-01", reason: "lookup failed" },
    {
      state: "in_season",
      today: "2026-10-19",
      seasonId: 20262027,
      activeFrom: "2026-09-19",
      activeUntil: "2027-06-13",
    },
  ])("runs the handler when the window is $state", async (window) => {
    const handler = vi.fn();
    await withNhlOffSeasonSkip(handler, { loadWindow: async () => window })(
      { query: {} } as never,
      response() as never,
    );
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
