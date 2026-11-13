// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as materialization from "lib/trends/recentTeamFormV2Materialization";

type Filter = [string, string, unknown];
type Call = { table: string; filters: Filter[] };

const mocks = vi.hoisted(() => ({
  fetchSeason: vi.fn(),
  upsert: vi.fn(),
  tables: {} as Record<string, unknown[]>,
  latestIssuedDate: null as string | null,
  calls: [] as Array<{ table: string; filters: Array<[string, string, unknown]> }>,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => {
      const filters: Array<[string, string, unknown]> = [];
      const builder: any = {
        table,
        filters,
        select: () => builder,
        eq: (column: string, value: unknown) => {
          filters.push(["eq", column, value]);
          return builder;
        },
        gte: (column: string, value: unknown) => {
          filters.push(["gte", column, value]);
          return builder;
        },
        lte: (column: string, value: unknown) => {
          filters.push(["lte", column, value]);
          return builder;
        },
        order: () => builder,
        limit: () => {
          mocks.calls.push({ table, filters });
          return Promise.resolve({
            data: mocks.latestIssuedDate ? [{ date: mocks.latestIssuedDate }] : [],
            error: null,
          });
        },
        upsert: mocks.upsert,
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
vi.mock("lib/power-ratings", () => ({
  fetchPaginatedRows: async (buildQuery: () => any) => {
    const query = buildQuery();
    mocks.calls.push({ table: query.table, filters: query.filters });
    return mocks.tables[query.table] ?? [];
  },
}));
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

const UPDATED_AT = "2026-10-14T09:00:00.000Z";

type Game = { team: unknown; date: string; ppXgf?: number; ppToi?: number };

/** One NST team game across the four source tables (identical except for PP). */
function setGames(games: Game[]) {
  const key = (game: Game) => ({ team_abbreviation: game.team, date: game.date, gp: 1, updated_at: UPDATED_AT });
  mocks.tables = {
    nst_team_gamelogs_as_rates: games.map((game) => ({
      ...key(game),
      xgf_per_60: 2.5, hdcf_per_60: 10, gf_per_60: 2.5,
      xga_per_60: 2.5, hdca_per_60: 10, ca_per_60: 55, cf_pct: 50, pdo: 1,
    })),
    nst_team_gamelogs_as_counts: games.map((game) => ({ ...key(game), ga: 2, xga: 2.5, toi_seconds: 3600 })),
    nst_team_gamelogs_pp_counts: games.map((game) => ({
      ...key(game), xgf: game.ppXgf ?? 0.5, toi_seconds: game.ppToi ?? 300,
    })),
    nst_team_gamelogs_pk_counts: games.map((game) => ({ ...key(game), xga: 0.5, toi_seconds: 300 })),
    team_ctpi_daily: [],
  };
}

const GAME_DATES = ["2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11", "2026-10-12", "2026-10-13"];

/**
 * Decision 20 fixture. TOR's newest game has 1 PP xGF in 60 s and five older
 * games 0 xGF in 600 s each; MTL is 0.5 xGF per 300 s every game. Pooled by
 * ice time TOR is 1.67 xGF/60 against MTL's 6.0; a weighted mean of per-game
 * ratios would put TOR at 13.3, above MTL.
 */
function pooledFixture(extra: Game[] = []): Game[] {
  return [
    ...GAME_DATES.map((date, index) => ({
      team: "TOR", date,
      ppXgf: index === GAME_DATES.length - 1 ? 1 : 0,
      ppToi: index === GAME_DATES.length - 1 ? 60 : 600,
    })),
    ...GAME_DATES.map((date) => ({ team: "MTL", date })),
    ...extra,
  ];
}

const writtenRows = () => mocks.upsert.mock.calls.flatMap(([rows]) => rows);
const byTeam = (team: string, date = "2026-10-18") =>
  writtenRows().find((row: any) => row.team === team && row.date === date);

describe("update-team-ctpi-daily (CTPI v2 writer)", () => {
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
    mocks.latestIssuedDate = null;
    mocks.calls = [];
    mocks.tables = {};
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.resetAllMocks();
  });

  it("issues v2 rows under the versioned identity and never writes a v1 row", async () => {
    setGames(pooledFixture());

    const res = await invoke();

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      message: "CTPI daily processed",
      ctpiVersion: 2,
      formulaVersion: "recent-team-form-v2-candidate-2",
      publicationStatus: "candidate_unapproved",
      rowsUpserted: 2,
      // A first v2 run issues today only; history is an explicit, bounded backfill.
      startDate: "2026-10-18",
      endDate: "2026-10-18",
    });
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.upsert.mock.calls[0][1]).toEqual({ onConflict: "season_id,team,date,ctpi_version" });
    for (const row of writtenRows()) {
      expect(row).toMatchObject({
        season_id: 20262027,
        date: "2026-10-18",
        ctpi_version: 2,
        luck: null,
        payload: {
          formulaVersion: "recent-team-form-v2-candidate-2",
          inputVersion: "ctpi-one-team-game-input-v3-candidate",
          publicationStatus: "candidate_unapproved",
          sourceCutoffExclusive: "2026-10-18",
        },
      });
      expect(row.ctpi_0_to_100).toBeGreaterThan(0);
      expect(row.ctpi_0_to_100).toBeLessThan(100);
    }
    expect(mocks.calls).toContainEqual({
      table: "team_ctpi_daily",
      filters: [["eq", "season_id", 20262027], ["eq", "ctpi_version", 2]],
    });
  });

  it("pools PP/PK rates by ice time in the stored special-teams component (decision 20)", async () => {
    setGames(pooledFixture());

    await invoke();

    // Two teams: z = -1 for the lower pooled PP rate; PK is equal (z 0), so
    // special teams = 0.55 z. The v1 mean of ratios gives TOR +0.55.
    expect(byTeam("TOR").special_teams).toBeCloseTo(-0.55, 10);
    expect(byTeam("MTL").special_teams).toBeCloseTo(0.55, 10);
    expect(byTeam("TOR").ctpi_raw).toBeLessThan(byTeam("MTL").ctpi_raw);
  });

  it("scores a date from games before it, never the date's own games", async () => {
    setGames(pooledFixture([{ team: "TOR", date: "2026-10-18", ppXgf: 9, ppToi: 60 }]));

    await invoke();

    expect(byTeam("TOR").payload.sourceThroughDate).toBe("2026-10-13");
    expect(byTeam("TOR").special_teams).toBeCloseTo(-0.55, 10);
  });

  it("re-checks the latest issued date and rewrites only dates whose source changed", async () => {
    setGames(pooledFixture());
    await invoke({ start: "2026-10-17", end: "2026-10-17" });
    const issued = writtenRows();
    expect(issued.map((row: any) => row.date)).toEqual(["2026-10-17", "2026-10-17"]);
    mocks.upsert.mockClear();
    mocks.tables.team_ctpi_daily = issued.map((row: any) => ({
      date: row.date,
      team: row.team,
      formula_version: row.payload.formulaVersion,
      input_version: row.payload.inputVersion,
      source_cutoff_exclusive: row.payload.sourceCutoffExclusive,
      source_fingerprint: row.payload.sourceFingerprint,
      source_updated_through: row.payload.sourceUpdatedThrough,
    }));
    mocks.latestIssuedDate = "2026-10-17";

    const unchanged = await invoke();

    expect(unchanged.body).toMatchObject({
      startDate: "2026-10-17",
      unchangedDates: ["2026-10-17"],
      datesReplayed: [{ date: "2026-10-18", reasons: ["missing_persisted_snapshot"] }],
    });
    expect(writtenRows().map((row: any) => row.date)).toEqual(["2026-10-18", "2026-10-18"]);
    expect(mocks.calls).toContainEqual({
      table: "team_ctpi_daily",
      filters: [
        ["eq", "season_id", 20262027],
        ["eq", "ctpi_version", 2],
        ["gte", "date", "2026-10-17"],
        ["lte", "date", "2026-10-18"],
      ],
    });

    mocks.upsert.mockClear();
    (mocks.tables.nst_team_gamelogs_pp_counts[0] as any).updated_at = "2026-10-18T08:00:00.000Z";
    const late = await invoke();

    expect(late.body.datesReplayed[0]).toEqual({ date: "2026-10-17", reasons: ["source_watermark_advanced"] });
    expect(writtenRows().map((row: any) => row.date)).toContain("2026-10-17");
  });

  it("bounds every run: rejects an explicit span over 31 dates and clamps an automatic catch-up", async () => {
    vi.setSystemTime(new Date("2026-12-01T14:00:00.000Z"));
    setGames(pooledFixture());

    const tooLong = await invoke({ start: "2026-10-07" });

    expect(tooLong.statusCode).toBe(400);
    expect(tooLong.body.error).toBe("CTPI_DATE_SPAN_TOO_LARGE");
    expect(mocks.upsert).not.toHaveBeenCalled();

    mocks.latestIssuedDate = "2026-10-08";
    const clamped = await invoke();

    expect(clamped.statusCode).toBe(200);
    expect(clamped.body).toMatchObject({ startDate: "2026-11-01", endDate: "2026-12-01", datesComputed: 31 });
    expect(clamped.body.warnings[0]).toContain("2026-10-09 to 2026-10-31 were not computed");
  });

  it("rejects an invalid date parameter", async () => {
    const res = await invoke({ start: "2026-13-01" });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("CTPI_INVALID_REQUEST");
    expect(mocks.fetchSeason).not.toHaveBeenCalled();
  });

  it("reports an in-season run with no source rows as a skip with a warning", async () => {
    setGames([]);

    const res = await invoke();

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      skipped: true,
      outcome: "skipped",
      reason: "no_source_rows",
      rowsUpserted: 0,
      sourceRows: 0,
    });
    expect(res.body.warnings).toHaveLength(1);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("skips, without writing, when no team has five games before the date", async () => {
    setGames(GAME_DATES.slice(0, 2).flatMap((date) => [{ team: "TOR", date }, { team: "MTL", date }]));

    const res = await invoke();

    expect(res.body).toMatchObject({ skipped: true, reason: "no_scorable_teams", omittedRows: 2, rowsUpserted: 0 });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("excludes invalid source team identities before league normalization", async () => {
    setGames(pooledFixture());
    await invoke();
    const expected = writtenRows();
    mocks.upsert.mockClear();
    setGames(pooledFixture(["", " ", " TOR", "TOR ", null, undefined, 123].map((team) => ({
      team, date: "2026-10-13", ppXgf: 9, ppToi: 60,
    }))));

    const res = await invoke();

    expect(res.statusCode).toBe(200);
    expect(writtenRows()).toEqual(expected);
  });

  it("rejects duplicate destination identities before the first write", async () => {
    setGames(pooledFixture());
    const real = materialization.materializeRecentTeamFormCandidateSnapshot;
    vi.spyOn(materialization, "materializeRecentTeamFormCandidateSnapshot").mockImplementation((args) => {
      const result = real(args);
      return { ...result, rows: [...result.rows, result.rows[0]] };
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await invoke();

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toContain("Duplicate CTPI destination identity");
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
