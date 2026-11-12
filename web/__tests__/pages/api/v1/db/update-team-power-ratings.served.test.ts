import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("utils/adminOnlyMiddleware", () => ({ default: (handler: any) => handler }));
vi.mock("../../../../../lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: unknown) => handler,
}));
vi.mock("lib/cron/nhlOffSeason", () => ({
  withNhlOffSeasonSkip: (handler: unknown) => handler,
}));

const { logsState, wgoState, pooledState, upsertMock } = vi.hoisted(() => ({
  logsState: { value: [] as any[] },
  wgoState: { value: [] as any[] },
  pooledState: { value: new Map<string, any>() },
  upsertMock: vi.fn(),
}));

vi.mock("../../../../../lib/power-ratings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../../lib/power-ratings")>();
  return {
    ...actual,
    fetchGameLogs: vi.fn(async () => logsState.value),
    fetchWgoStats: vi.fn(async () => wgoState.value),
    fetchAllRatings: vi.fn(async () => []),
  };
});

vi.mock("../../../../../lib/underlying-stats/teamSpecialTeamsContext", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    fetchUnderlyingStatsTeamSpecialTeamsContext: vi.fn(async () => pooledState.value),
  };
});

vi.mock("../../../../../lib/supabase/server", () => ({
  default: {
    from: vi.fn(() => ({
      select: vi.fn(() => Promise.resolve({ count: 32, error: null })),
      upsert: upsertMock,
    })),
  },
}));

import handler from "../../../../../pages/api/v1/db/update-team-power-ratings";

const TEAMS = Array.from({ length: 32 }, (_, i) => `T${String(i).padStart(2, "0")}`);
const TARGET = "2026-01-31";

const isoDay = (offset: number) => {
  const d = new Date(`${TARGET}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

/** Frozen per-team inputs; the mask only moves a team's games one day earlier. */
const buildLogs = (onSlate: (i: number) => boolean) =>
  TEAMS.flatMap((team, i) =>
    Array.from({ length: 20 }, (_, g) => {
      const t = i + 1;
      const w = ((t * 7 + g * 13) % 11) / 10;
      return {
        team_abbreviation: team,
        date: isoDay((onSlate(i) ? 0 : -1) - 2 * g),
        season_id: 20252026,
        data_mode: "all",
        gp: 1,
        toi_seconds: 3600,
        cf_per_60: 50 + t * 0.4 + w,
        ca_per_60: 58 - t * 0.3 + w,
        sf_per_60: 26 + t * 0.2 + w,
        sa_per_60: 32 - t * 0.15 + w,
        gf_per_60: 2.4 + t * 0.03 + w / 5,
        ga_per_60: 3.6 - t * 0.02 + w / 7,
        xgf_per_60: 2.2 + t * 0.035 + w / 6,
        xga_per_60: 3.4 - t * 0.025 + w / 8,
        pace_per_60: null,
        hdcf_per_60: 9 + t * 0.1 + w,
        hdca_per_60: 13 - t * 0.08 + w,
        pdo: 1,
        pp_xgf_per_60: 6,
        pk_xga_per_60: 7,
        penalties_drawn_per_60: 3,
        penalties_taken_per_60: 3,
      };
    }),
  );

const runFor = async (onSlate: (i: number) => boolean) => {
  upsertMock.mockClear();
  logsState.value = buildLogs(onSlate);
  const res: any = {
    statusCode: 200,
    body: null,
    setHeader() {},
    status(code: number) { this.statusCode = code; return this; },
    json(payload: unknown) { this.body = payload; return this; },
  };
  await handler({ method: "GET", query: { date: TARGET } } as any, res);
  expect(res.statusCode).toBe(200);
  const rows = upsertMock.mock.calls.flatMap((call) => call[0]) as any[];
  return new Map(rows.filter((r) => r.date === TARGET).map((r) => [r.team_abbreviation, r]));
};

describe("served team power ratings writer (W1 P0 #12, #13)", () => {
  beforeEach(() => {
    upsertMock.mockResolvedValue({ error: null });
    wgoState.value = [];
    pooledState.value = new Map();
  });

  it("writes the same ratings for all 32 teams whichever teams played tonight", async () => {
    const even = await runFor((i) => i % 2 === 0);
    const few = await runFor((i) => i < 4);
    expect(even.size).toBe(32);
    expect(few.size).toBe(32);
    for (const team of TEAMS) {
      expect(few.get(team).off_rating).toBeCloseTo(even.get(team).off_rating, 9);
      expect(few.get(team).def_rating).toBeCloseTo(even.get(team).def_rating, 9);
    }
  });

  it("tiers PP/PK on pooled season-to-date values and keeps unknown unknown", async () => {
    // Last single game: T00 went 1-for-1 (100%), T01 0-for-3; T02 has no row.
    wgoState.value = [
      { team_abbreviation: "T00", date: TARGET, power_play_pct: 1, penalty_kill_pct: 1 },
      { team_abbreviation: "T01", date: TARGET, power_play_pct: 0, penalty_kill_pct: 0.5 },
    ];
    // Pooled season: T00 is worst on the PP, T01 best; T02 unknown.
    pooledState.value = new Map(
      TEAMS.map((team, i) => [
        team,
        team === "T02"
          ? { teamAbbr: team, ppPct: null, ppRank: null, pkPct: null, pkRank: null }
          : {
              teamAbbr: team,
              ppPct: team === "T00" ? 5 : team === "T01" ? 40 : 20,
              ppRank: team === "T00" ? 31 : team === "T01" ? 1 : 2,
              pkPct: 80,
              pkRank: 1,
            },
      ]),
    );
    const rows = await runFor(() => true);
    expect(rows.get("T00").pp_tier).toBe(3);
    expect(rows.get("T01").pp_tier).toBe(1);
    expect(rows.get("T02").pp_tier).toBeNull();
    expect(rows.get("T02").pk_tier).toBeNull();
  });
});
