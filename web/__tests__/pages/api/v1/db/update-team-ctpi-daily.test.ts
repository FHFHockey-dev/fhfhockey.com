// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as ctpi from "lib/trends/ctpi";

const mocks = vi.hoisted(() => ({
  fetchSeason: vi.fn(),
  fetchRows: vi.fn(),
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
import handler from "pages/api/v1/db/update-team-ctpi-daily";

async function invoke(query: Record<string, string> = {}) {
  const res = {
    statusCode: 200,
    body: undefined as any,
    status(code: number) { this.statusCode = code; return this; },
    json(body: any) { this.body = body; return this; },
    setHeader: vi.fn(),
  };
  await handler({ method: "GET", query } as any, res as any);
  return res;
}

const sourceRow = (team: unknown, date: string, xgf = 3) => ({
  team_abbreviation: team, date, gp: 1,
  xgf_per_60: xgf, hdcf_per_60: 11, gf_per_60: 3,
  xga_per_60: 2.5, hdca_per_60: 9, ca_per_60: 50, cf_pct: 55, pdo: 100,
});

function setSourceRows(rows: ReturnType<typeof sourceRow>[]) {
  mocks.fetchRows.mockResolvedValue([]).mockResolvedValueOnce(rows);
}

const writtenRows = () => mocks.upsert.mock.calls.flatMap(([rows]) => rows);

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
    mocks.upsert.mockImplementation(async (rows) => {
      const keys = rows.map((row: any) => JSON.stringify([row.season_id, row.team, row.date]));
      return { error: new Set(keys).size === keys.length ? null
        : { message: "ON CONFLICT DO UPDATE command cannot affect row a second time" } };
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.resetAllMocks();
  });

  it("reports an in-season run with no source rows as a skip with a warning", async () => {
    mocks.fetchRows.mockResolvedValue([]);

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
    setSourceRows([sourceRow("TOR", "2026-10-08")]);

    const res = await invoke();

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ message: "CTPI daily processed", rowsUpserted: 11 });
    expect(res.body.outcome).toBeUndefined();
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    expect(writtenRows().every(row => row.payload.publicationStatus === "legacy_unapproved")).toBe(true);
  });

  it("omits teams before their first source game instead of upserting duplicate blank identities", async () => {
    setSourceRows([sourceRow("TOR", "2026-10-08"), sourceRow("MTL", "2026-10-09")]);

    const res = await invoke();

    expect(res.statusCode).toBe(200);
    expect(writtenRows()).toHaveLength(21);
    expect(writtenRows().some(row => row.date === "2026-10-07")).toBe(false);
    expect(writtenRows().every(row => row.team && row.payload.sourceGameCount > 0)).toBe(true);
    const keys = writtenRows().map(row => JSON.stringify([row.season_id, row.team, row.date]));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("excludes a single empty history from league normalization and never emits its blank row", async () => {
    const eligible = [sourceRow("TOR", "2026-10-07", 6), sourceRow("MTL", "2026-10-07", 2)];
    setSourceRows(eligible);
    await invoke();
    const expected = writtenRows().filter(row => row.date === "2026-10-07");
    mocks.upsert.mockClear();
    setSourceRows([...eligible, sourceRow("BOS", "2026-10-08", 99)]);

    const res = await invoke();

    expect(res.statusCode).toBe(200);
    expect(writtenRows().filter(row => row.date === "2026-10-07")).toEqual(expected);
    expect(writtenRows().every(row => row.team.length > 0)).toBe(true);
  });

  it("excludes invalid source team identities before league normalization", async () => {
    setSourceRows([sourceRow("TOR", "2026-10-07")]);
    await invoke({ start: "2026-10-18" });
    const expected = writtenRows();
    mocks.upsert.mockClear();
    setSourceRows([sourceRow("TOR", "2026-10-07"),
      ...["", " ", " TOR", "TOR ", null, undefined, 123].map(team => sourceRow(team, "2026-10-07", 99))]);

    const res = await invoke({ start: "2026-10-18" });

    expect(res.statusCode).toBe(200);
    expect(writtenRows()).toEqual(expected);
  });

  it("keeps current-date team identities and source counts when all teams have history", async () => {
    setSourceRows([sourceRow("TOR", "2026-10-08"), sourceRow("MTL", "2026-10-09")]);

    const res = await invoke({ start: "2026-10-18" });

    expect(res.statusCode).toBe(200);
    expect(writtenRows().map(row => row.team)).toEqual(["TOR", "MTL"]);
    expect(writtenRows().every(row => row.payload.sourceGameCount === 1)).toBe(true);
  });

  it("rejects duplicate destination identities across batches before the first write", async () => {
    setSourceRows([sourceRow("TOR", "2026-10-07")]);
    const score = ctpi.computeCtpi([ctpi.computeTrendMetrics([{ team: "TOR", date: "2026-10-07", gp: 1 }])])[0];
    const scores = Array.from({ length: 500 }, (_, index) => ({ ...score, team: `TEAM${index}` }));
    scores.push(scores[0]);
    vi.spyOn(ctpi, "computeCtpi").mockReturnValue(scores);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await invoke({ start: "2026-10-18" });

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toContain("Duplicate CTPI destination identity");
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("rejects a blank destination identity from the calculator before any write", async () => {
    setSourceRows([sourceRow("TOR", "2026-10-07")]);
    const score = ctpi.computeCtpi([ctpi.computeTrendMetrics([{ team: "TOR", date: "2026-10-07", gp: 1 }])])[0];
    vi.spyOn(ctpi, "computeCtpi").mockReturnValue([{ ...score, team: " " }]);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await invoke({ start: "2026-10-18" });

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toContain("Invalid CTPI destination identity");
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
