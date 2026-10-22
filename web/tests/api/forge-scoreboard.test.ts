import { beforeEach, describe, expect, it, vi } from "vitest";

const { tables, readMock } = vi.hoisted(() => ({ tables: {} as Record<string, Record<string, any>[]>, readMock: vi.fn() }));

vi.mock("lib/supabase/server", () => ({
  default: {
    from: (table: string) => {
      readMock(table);
      const filters: Array<(row: any) => boolean> = [];
      const builder: any = {
        select: () => builder, order: () => builder, range: () => builder,
        eq: (column: string, value: unknown) => { filters.push(row => row[column] === value); return builder; },
        not: (column: string) => { filters.push(row => row[column] !== null); return builder; },
        lte: (column: string, value: string) => { filters.push(row => row[column] <= value); return builder; },
        gte: (column: string, value: string) => { filters.push(row => row[column] >= value); return builder; },
        abortSignal: async () => {
          const data = (tables[table] ?? []).filter(row => filters.every(filter => filter(row)));
          return { data, count: data.length, error: null };
        },
      };
      return builder;
    },
  },
}));

import handler from "pages/api/v1/forge/scoreboard";

const res = () => {
  const out: any = { statusCode: 200, body: null, headers: {} as Record<string, string>, setHeader(key: string, value: string) { this.headers[key] = value; },
    status(code: number) { this.statusCode = code; return this; }, json(payload: any) { this.body = payload; return this; } };
  return out;
};
// Numerics arrive as strings from PostgREST; one unsettled row must be excluded.
const row = (served_date: string, player_id: number, source: string, exp: number, act: number, settled = true) => ({ served_date, season_id: "20262027", player_id, game_id: player_id * 10,
  source, player_class: "skater", team_rest_days: 2, start_probability: null, dressed: true, started: null, settled_at: settled ? "2026-10-21T11:00:00Z" : null,
  exp_goals: String(exp), exp_assists: "0", exp_pp_points: "0", exp_shots: "2", exp_hits: "1", exp_blocks: "0", exp_saves: null, exp_goals_against: null,
  exp_shots_against: null, exp_win_prob: null, exp_shutout_prob: null, exp_fantasy_points: String(exp),
  act_goals: String(act), act_assists: "0", act_pp_points: "0", act_shots: "2", act_hits: "1", act_blocks: "0", act_saves: null, act_goals_against: null,
  act_shots_against: null, act_win: null, act_shutout: null, act_fantasy_points: String(act) });

describe("/api/v1/forge/scoreboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-22T16:00:00Z"));
    tables.forge_served_forecast_ledger = [row("2026-10-20", 1, "bridge_exact", 0.5, 1), row("2026-10-20", 1, "naive_season", 0.2, 1),
      row("2026-10-21", 2, "bridge_exact", 0.5, 0), row("2026-10-21", 3, "bridge_exact", 2, 0, false), row("2026-09-01", 4, "bridge_exact", 9, 0)];
  });

  it("scores settled rows per served date × source and pooled, cached", async () => {
    const out = res();
    await handler({ method: "GET", query: { days: "14", scope: "skater" } } as any, out);
    expect(out.statusCode).toBe(200);
    expect(out.headers["Cache-Control"]).toContain("s-maxage=300");
    expect(out.body).toMatchObject({ scope: "skater", days: 14, startDate: "2026-10-09", endDate: "2026-10-22" });
    expect(out.body.empty).toBeUndefined();
    expect(out.body).toMatchObject({ coverageStatus: "unavailable_independent_universe_not_persisted", comparison: "paired_player_game", sourceSamples: "unpaired_descriptive_only" });
    expect(out.body.data.map((day: any) => day.served_date)).toEqual(["2026-10-20", "2026-10-21"]);
    const day1 = out.body.data[0].scores;
    expect(day1.find((s: any) => s.source === "bridge_exact")).toMatchObject({ n: 1, heads: { goals: { n: 1, mae: 0.5, bias: -0.5 } }, fantasyPoints: { mae: 0.5 } });
    expect(day1.find((s: any) => s.source === "naive_season").heads.goals).toMatchObject({ mae: 0.8, bias: -0.8 });
    expect(out.body.pooled.find((s: any) => s.source === "bridge_exact")).toMatchObject({ n: 2, heads: { goals: { n: 2, mae: 0.5, bias: 0 } } });
    expect(out.body.pooled.find((s: any) => s.source === "bridge_exact")).toMatchObject({ dressed: null, coverage: null, coverageStatus: "unavailable" });
    const paired = out.body.pooledPaired.comparisons.find((s: any) => s.source === "bridge_exact" && s.reference === "naive_season");
    expect(paired).toMatchObject({ pairing: { matched: 1, sourceOnly: 1 }, fantasyPoints: { source: { n: 1, rmse: 0.5 }, reference: { n: 1, rmse: 0.8 }, rmseSkill: 0.375 } });
    expect(out.body.data[0].paired.comparisons.find((s: any) => s.source === "bridge_exact" && s.reference === "naive_season").pairing.matched).toBe(1);
    expect(out.body.pooledPaired.invalidIdentityRows).toBe(0);
    expect(out.body.limitations).toMatchObject({ position: "unavailable_skater_position_not_captured", opportunityRate: "unavailable_expected_and_actual_toi_pp_toi_not_captured" });
  });

  it("returns 200 empty when nothing is settled", async () => {
    tables.forge_served_forecast_ledger = [];
    const out = res();
    await handler({ method: "GET", query: {} } as any, out);
    expect(out.statusCode).toBe(200);
    expect(out.body).toMatchObject({ data: [], empty: true, scope: "all", days: 14 });
    expect(out.body.pooledPaired.comparisons).toEqual([]);
  });

  it("preserves missing and malformed numeric evidence instead of converting it to zero", async () => {
    tables.forge_served_forecast_ledger = [
      { ...row("2026-10-20", 1, "bridge_exact", 0.5, 1), exp_fantasy_points: "", exp_goals: true },
      { ...row("2026-10-20", 1, "naive_last5", 0.2, 1), act_hits: "invalid" },
    ];
    const out = res();
    await handler({ method: "GET", query: {} } as any, out);
    const paired = out.body.pooledPaired.comparisons.find((s: any) => s.source === "bridge_exact" && s.reference === "naive_last5");
    expect(paired.fantasyPoints).toMatchObject({ source: { n: 0 }, exclusions: { missingPrediction: 1 } });
    expect(paired.heads.goals.source.n).toBe(0);
    expect(paired.heads.hits).toMatchObject({ source: { n: 0 }, exclusions: { missingOutcome: 1 } });
    expect(readMock).toHaveBeenCalledTimes(1);
    expect(readMock).toHaveBeenCalledWith("forge_served_forecast_ledger");
  });

  it("rejects bad params and non-GET without reading", async () => {
    for (const query of [{ days: "0" }, { days: "61" }, { days: "abc" }, { scope: "team" }]) {
      const out = res();
      await handler({ method: "GET", query } as any, out);
      expect(out.statusCode).toBe(400);
    }
    const post = res();
    await handler({ method: "POST", query: {} } as any, post);
    expect(post.statusCode).toBe(405);
    expect(readMock).not.toHaveBeenCalled();
  });
});
