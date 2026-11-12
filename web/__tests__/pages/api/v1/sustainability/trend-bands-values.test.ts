import { beforeEach, describe, expect, it, vi } from "vitest";

// Served-output tests for /api/v1/sustainability/trend-bands (POST recompute
// path, real band service and calculator; persistence and Supabase mocked).
// W1 P0 #23 (60x TOI fallback), #24 (usual range), BC W1-9 A1/A2/A3,
// W3-6 N2/N3/N4.

const { state } = vi.hoisted(() => ({
  state: { games: [] as any[], totals: [] as any[], selects: [] as string[] }
}));

vi.mock("utils/adminOnlyMiddleware", () => ({
  default: (handler: any) => handler
}));

vi.mock("lib/sustainability/persist", () => ({
  upsertTrendBandRows: vi.fn(async () => undefined),
  deleteStaleTrendBandRows: vi.fn(async () => undefined)
}));

vi.mock("lib/supabase/server", () => ({
  default: {
    from: (table: string) => {
      const query: any = {
        select: (columns: string) => {
          state.selects.push(`${table}:${columns}`);
          return query;
        },
        eq: () => query,
        lte: () => query,
        in: () => query,
        order: () => query,
        limit: () =>
          Promise.resolve({
            data:
              table === "player_stats_unified" ? state.games : state.totals,
            error: null
          })
      };
      return query;
    }
  }
}));

import handler from "../../../../../pages/api/v1/sustainability/trend-bands";
import { readUsualRange } from "lib/sustainability/usualRange";
import { computeSkaterTrendAdjustment } from "lib/projections/utils/trend-adjustments";

const SEASON = 20262027;
const PRIOR = 20252026;

function createRes() {
  return {
    statusCode: 200,
    body: null as any,
    setHeader() {
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    }
  } as any;
}

async function recompute(metric: string, window: string) {
  const res = createRes();
  await handler(
    {
      method: "POST",
      query: {},
      body: {
        player_id: 8478402,
        snapshot_date: "2026-11-10",
        metrics: metric,
        windows: window
      },
      headers: {}
    } as any,
    res
  );
  expect(res.statusCode).toBe(200);
  return res.body.rows as any[];
}

function game(daysAgo: number, fields: Record<string, unknown>) {
  const date = new Date(Date.UTC(2026, 10, 10 - daysAgo))
    .toISOString()
    .slice(0, 10);
  return { player_id: 8478402, season_id: SEASON, date, ...fields };
}

function row(rows: any[], metric: string, window: string) {
  return rows.find((r) => r.metric_key === metric && r.window_code === window);
}

describe("trend-bands served values", () => {
  beforeEach(() => {
    state.games = [];
    state.totals = [];
    state.selects = [];
  });

  it("#23: a game without an NST row uses WGO seconds, not 60x minutes", async () => {
    // 10 shots/60 everywhere: 3 shots in 18 minutes (1080 s) per game.
    state.games = [
      game(0, { shots: 3, toi_per_game: 1080, nst_toi: null }),
      ...[1, 2, 3, 4].map((d) =>
        game(d, { shots: 3, toi_per_game: 1080, nst_toi: 1080 })
      )
    ];
    state.totals = [
      { player_id: 8478402, season_id: PRIOR, shots: 200, toi_all_situations: 72_000 }
    ];

    const band = row(await recompute("shots_per_60", "l5"), "shots_per_60", "l5");

    expect(band.ewma).toBeCloseTo(10, 6);
    expect(band.baseline).toBeCloseTo(10, 6);
    // Stored exposure is discounted minutes: sum of half-life weights x 18.
    const weights = [0, 1, 2, 3, 4].map((g) => Math.exp((-Math.log(2) * g) / 5));
    expect(band.n_eff).toBeCloseTo(
      weights.reduce((sum, w) => sum + w * 18, 0),
      2
    );
    expect(Math.abs(band.z_score)).toBeLessThan(3);
    // Constant rate: observed equals baseline, and it reads neutral.
    expect(band.distribution.usualRange).toMatchObject({
      observed: 10,
      baseline: 10,
      count: 15,
      exposure: 90,
      status: "neutral",
      validated: false
    });
  });

  it("A1: window membership is the newest N games (suffix invariance)", async () => {
    const newest = [0, 1, 2].map((d) => game(d, { goals: 0, shots: 0 }));
    state.totals = [{ player_id: 8478402, season_id: PRIOR, goals: 10, shots: 100 }];

    state.games = [...newest, ...[3, 4, 5].map((d) => game(d, { goals: 1, shots: 1 }))];
    const first = row(await recompute("sh_pct", "l3"), "sh_pct", "l3");
    state.games = [...newest, ...[3, 4, 5].map((d) => game(d, { goals: 0, shots: 7 }))];
    const second = row(await recompute("sh_pct", "l3"), "sh_pct", "l3");

    expect(first.ewma).not.toBe(1);
    expect(first).toEqual(second);
    // Zero shots in the window: no observed SH%, so no usual-range verdict.
    expect(readUsualRange(first.distribution)).toMatchObject({
      status: "unknown",
      reason: "no_window_exposure"
    });
  });

  it("A2/A3: missing NST counts stay unknown instead of reading as zero", async () => {
    state.games = [
      game(0, { nst_ixg: null, nst_toi: 1200 }),
      game(1, { nst_ixg: 0.6, nst_toi: 1200 }),
      game(2, { nst_ixg: 0.6, nst_toi: 1200 })
    ];
    state.totals = [{ player_id: 8478402, season_id: PRIOR, nst_ixg: 18, nst_toi: 72_000 }];
    const band = row(await recompute("ixg_per_60", "l3"), "ixg_per_60", "l3");
    // Two known games at 0.6 per 20 minutes = 1.8/60; the null game is not 0.
    expect(band.ewma).toBeCloseTo(1.8, 6);
    expect(band.distribution.usualRange).toMatchObject({
      gamesInWindow: 3,
      gamesCovered: 2
    });
    expect(band.distribution.warnings).toContain("partial_window_coverage");

    state.games = [0, 1, 2].map((d) => game(d, { nst_ixg: null, nst_toi: null }));
    expect(row(await recompute("ixg_per_60", "l3"), "ixg_per_60", "l3")).toBeUndefined();
  });

  it("N2: 5v5 points are judged over 5v5 time; extra ES minutes change nothing", async () => {
    // 2 points per 60 5v5 minutes: 0.5 points per 15 minutes (900 s).
    const base = (extraEs: number) =>
      [0, 1, 2, 3].map((d) =>
        game(d, {
          points_5v5: d % 2 === 0 ? 1 : 0,
          toi_per_game_5v5: 900,
          ev_time_on_ice: 900 + extraEs
        })
      );
    state.totals = [
      { player_id: 8478402, season_id: PRIOR, points_5v5: 40, toi_5v5_total: 72_000, ev_time_on_ice: 90_000 }
    ];
    state.games = base(0);
    const a = row(await recompute("points_per_60_5v5", "l20"), "points_per_60_5v5", "l20");
    state.games = base(300);
    const b = row(await recompute("points_per_60_5v5", "l20"), "points_per_60_5v5", "l20");

    expect(a.baseline).toBeCloseTo(2, 6);
    expect(a.distribution.usualRange.observed).toBeCloseTo(2, 6);
    expect(b).toEqual(a);
    // The served query must select the same-game 5v5 ice time.
    expect(
      state.selects.find((sel) => sel.startsWith("player_stats_unified:"))
    ).toContain("toi_per_game_5v5");
  });

  it("#24/N3: usual range is the baseline-predictive central 80%; observed is shown apart from the shrunk value", async () => {
    // Baseline 7.5 PP goals/60 on 6,000 PP minutes; window 20 PP minutes:
    // predictive ~ Poisson(2.5), central 80% = [1, 5] goals.
    state.totals = [
      { player_id: 8478402, season_id: PRIOR, pp_goals: 750, pp_toi: 360_000 }
    ];
    state.games = [0, 1, 2, 3, 4].map((d) =>
      game(d, { pp_goals: d === 0 ? 2 : d < 4 ? 1 : 0, pp_toi: 240 })
    );
    const band = row(await recompute("pp_goals_per_60", "l5"), "pp_goals_per_60", "l5");
    const range = band.distribution.usualRange;

    // Twice the baseline but not unusual for 20 minutes: P(X >= 5) = .109.
    expect(range).toMatchObject({
      family: "negative_binomial",
      count: 5,
      exposure: 20,
      observed: 15,
      lower: 3,
      upper: 15,
      status: "neutral"
    });
    expect(range.upperTail).toBeGreaterThan(0.1);
    expect(range.upperTail).toBeLessThan(0.12);
    expect(band.value).toBeLessThan(range.observed);

    // An extreme stretch (12 goals in 20 minutes) is hot.
    state.games = [0, 1, 2, 3, 4].map((d) =>
      game(d, { pp_goals: d < 2 ? 3 : 2, pp_toi: 240 })
    );
    const hot = row(await recompute("pp_goals_per_60", "l5"), "pp_goals_per_60", "l5");
    expect(readUsualRange(hot.distribution).status).toBe("hot");
  });

  it("#24: five 0-for-4 games against a zero baseline do not read cold", async () => {
    state.totals = [{ player_id: 8478402, season_id: PRIOR, goals: 0, shots: 120 }];
    state.games = [0, 1, 2, 3, 4].map((d) => game(d, { goals: 0, shots: 4 }));
    const band = row(await recompute("sh_pct", "l5"), "sh_pct", "l5");
    expect(band.distribution.usualRange).toMatchObject({
      observed: 0,
      baseline: 0,
      status: "neutral"
    });
    expect(readUsualRange(band.distribution).status).toBe("neutral");
  });

  it("decision 34: the usual range ignores current-season totals", async () => {
    state.games = [0, 1, 2].map((d) => game(d, { shots: 3, toi_per_game: 1080 }));
    const prior = { player_id: 8478402, season_id: PRIOR, shots: 200, toi_all_situations: 72_000 };
    state.totals = [{ player_id: 8478402, season_id: SEASON, shots: 9, toi_all_situations: 3_240 }, prior];
    const a = row(await recompute("shots_per_60", "l3"), "shots_per_60", "l3");
    state.totals = [{ player_id: 8478402, season_id: SEASON, shots: 90, toi_all_situations: 3_240 }, prior];
    const b = row(await recompute("shots_per_60", "l3"), "shots_per_60", "l3");
    expect(a.distribution.usualRange).toEqual(b.distribution.usualRange);
    expect(a.distribution.usualRange.baselineSeasons).toEqual([PRIOR]);

    // No completed prior season: unavailable, never the player's own streak.
    state.totals = [{ player_id: 8478402, season_id: SEASON, shots: 9, toi_all_situations: 3_240 }];
    const rookie = row(await recompute("shots_per_60", "l3"), "shots_per_60", "l3");
    expect(readUsualRange(rookie.distribution)).toMatchObject({
      status: "unknown",
      reason: "no_prior_season_baseline"
    });
  });

  it("N4: IPP never falls back to ES goals for and rejects out-of-domain inputs", async () => {
    state.games = [
      game(0, { points: 3, nst_oi_gf: 2 }), // invalid: more points than on-ice GF
      game(1, { points: 1, nst_oi_gf: 2 }),
      game(2, { points: 1, nst_oi_gf: 2 })
    ];
    state.totals = [{ player_id: 8478402, season_id: PRIOR, points: 30, nst_oi_gf: 60, es_goals_for: 20 }];
    const band = row(await recompute("ipp", "l3"), "ipp", "l3");
    expect(band.ewma).toBeCloseTo(0.5, 6);
    expect(band.baseline).toBeCloseTo(0.5, 6);
    expect(band.distribution.usualRange).toMatchObject({ gamesCovered: 2, count: 2, exposure: 4 });

    // On-ice GF unknown in the baseline season: no ES-GF substitute.
    state.totals = [{ player_id: 8478402, season_id: PRIOR, points: 48, nst_oi_gf: null, es_goals_for: 35 }];
    const noGf = row(await recompute("ipp", "l3"), "ipp", "l3");
    expect(readUsualRange(noGf.distribution).reason).toBe("no_prior_season_baseline");

    // Out-of-domain baseline (IPP above 1): no band at all.
    state.totals = [{ player_id: 8478402, season_id: PRIOR, points: 48, nst_oi_gf: 35 }];
    expect(row(await recompute("ipp", "l3"), "ipp", "l3")).toBeUndefined();
  });
  it("decision 26 guard: FORGE's band reader stays neutral until L9a validates it", async () => {
    // A genuinely doubled shot rate (20/60 vs 10/60 over 10 games) is hot by
    // the usual range, but value/ci_lower/ci_upper keep their posterior
    // meaning, so FORGE's own-interval test applies no adjustment.
    state.totals = [
      { player_id: 8478402, season_id: PRIOR, shots: 200, toi_all_situations: 72_000 }
    ];
    state.games = Array.from({ length: 10 }, (_, d) =>
      game(d, { shots: 6, toi_per_game: 1080 })
    );
    const band = row(await recompute("shots_per_60", "l10"), "shots_per_60", "l10");
    expect(readUsualRange(band.distribution).status).toBe("hot");
    const adjustment = computeSkaterTrendAdjustment({
      row: band,
      asOfDate: "2026-11-10"
    });
    expect(adjustment?.effectState).toBe("within_band_neutral");
    expect(adjustment?.shotRateMultiplier).toBe(1);
  });
});
