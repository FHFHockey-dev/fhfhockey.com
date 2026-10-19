// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchSeason: vi.fn(),
  fetchRows: vi.fn(),
  computeCtpi: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => {
      const builder: any = {
        select: () => builder,
        eq: () => builder,
        order: () => builder,
        limit: () => Promise.resolve({ data: [], error: null }),
        upsert: mocks.upsert,
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ count: 0, error: null }).then(resolve),
      };
      return builder;
    },
  }),
}));
vi.mock("dotenv", () => ({ default: { config: vi.fn() } }));
vi.mock("utils/adminOnlyMiddleware", () => ({ default: (handler: unknown) => handler }));
vi.mock("lib/cron/withCronJobAudit", () => ({ withCronJobAudit: (handler: unknown) => handler }));
vi.mock("lib/cron/nhlOffSeason", () => ({ withNhlOffSeasonSkip: (handler: unknown) => handler }));
vi.mock("utils/fetchCurrentSeason", () => ({ fetchCurrentSeason: mocks.fetchSeason }));
vi.mock("lib/power-ratings", () => ({ fetchPaginatedRows: mocks.fetchRows }));
vi.mock("lib/trends/ctpi", () => ({
  computeTrendMetrics: vi.fn(() => ({})),
  computeCtpi: mocks.computeCtpi,
}));

import handler from "pages/api/v1/db/update-team-ctpi-daily";

async function invoke() {
  const res = {
    statusCode: 200,
    body: undefined as any,
    status(code: number) { this.statusCode = code; return this; },
    json(body: any) { this.body = body; return this; },
    setHeader: vi.fn(),
  };
  await handler({ method: "GET", query: {} } as any, res as any);
  return res;
}

describe("update-team-ctpi-daily outcome", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-18T14:00:00.000Z"));
    mocks.fetchSeason.mockResolvedValue({
      id: 20262027,
      startDate: "2026-10-07",
      endDate: "2027-06-20",
      regularSeasonEndDate: "2027-04-15",
    });
    mocks.upsert.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  it("reports an in-season run with no source rows as a skip with a warning", async () => {
    mocks.fetchRows.mockResolvedValue([]);
    mocks.computeCtpi.mockReturnValue([]);

    const res = await invoke();

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      skipped: true,
      outcome: "skipped",
      reason: "no_source_rows",
      rowsUpserted: 0,
      sourceRows: 0,
      startDate: "2026-10-07",
      endDate: "2026-10-18",
    });
    expect(res.body.warnings).toHaveLength(1);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("keeps a run that writes rows as a plain success", async () => {
    mocks.fetchRows.mockResolvedValue([{ team_abbreviation: "TOR", date: "2026-10-08", gp: 1 }]);
    mocks.computeCtpi.mockReturnValue([{ team: "TOR", ctpi_raw: 1, ctpi_0_to_100: 50 }]);

    const res = await invoke();

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ message: "CTPI daily processed", rowsUpserted: 12 });
    expect(res.body.outcome).toBeUndefined();
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
  });
});
