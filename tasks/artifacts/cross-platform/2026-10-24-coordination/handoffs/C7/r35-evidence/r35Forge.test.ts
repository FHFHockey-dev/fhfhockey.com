// C7 R35 controls (reviewer-only; not in the repo).
import { describe, expect, it, vi } from "vitest";
vi.mock("lib/supabase/server", () => ({ default: {} }));
import { blendSeasonBootstrap, bootstrapSkaterLine, SEASON_BOOTSTRAP_POLICY, type SeasonBootstrap } from "../seasonBootstrap";
import { readsExcludeExternalFantasy } from "../run-forge-projections";
import type { ProjectionInputRead } from "../inputCapture";

const read = (ops: Array<{ method: string; args: unknown[] }>): ProjectionInputRead =>
  ({ request: ops, result: { data: [], error: null }, receivedAt: "2026-10-26T12:00:00.000Z" }) as never;
const prior = (previous: Record<string, number | null>, currentSeasonGames = 0, historyGames = 20): SeasonBootstrap =>
  ({ previous, currentSeasonGames, historyGames, limitations: [] });

describe("C7 R35 claim edges", () => {
  it.each([
    ["schema-qualified read", [{ method: "schema", args: ["public"] }, { method: "from", args: ["games"] }]],
    ["qualified fantasy name", [{ method: "from", args: ["public.PROJECTIONS_20262027_AG_SKATERS"] }]],
    ["lower-case fantasy name", [{ method: "from", args: ["projections_20262027_ag_skaters"] }]],
    ["empty request", []],
    ["non-string name", [{ method: "from", args: [42] }]],
  ])("withholds the claim for %s", (_label, ops) => {
    expect(readsExcludeExternalFantasy([read([{ method: "from", args: ["games"] }, { method: "select", args: ["*"] }]), read(ops as never)])).toBe(false);
  });
});

describe("C7 R35 early-season prior", () => {
  const organic = { GOALS: 0.3, ASSISTS: 0.4, SHOTS_ON_GOAL: 2.5 };
  it("a player with no previous-season history keeps the organic line exactly (no zeroing, no NaN)", () => {
    const { stats, disclosure } = blendSeasonBootstrap(organic, prior({}, 0, 0));
    expect(stats).toMatchObject(organic);
    expect(disclosure).toMatchObject({ fantasyWeight: 0, sourceIds: [], historyWeight: SEASON_BOOTSTRAP_POLICY.historyShare });
  });
  it("at 0 current-season games the history prior carries the whole line (organic weight is 0)", () => {
    const { stats } = blendSeasonBootstrap(organic, prior({ GOALS: 0.5, ASSISTS: 0.2, SHOTS_ON_GOAL: 3 }));
    for (const [key, value] of Object.entries({ GOALS: 0.5, ASSISTS: 0.2, SHOTS_ON_GOAL: 3 })) expect(stats[key]).toBeCloseTo(value, 12);
  });
  it("by 10 games organic dominates (history 0.2 vs organic 0.5)", () => {
    const { stats } = blendSeasonBootstrap({ GOALS: 0.3 }, prior({ GOALS: 0.6 }, 10));
    expect(stats.GOALS).toBeCloseTo((0.3 * 0.5 + 0.6 * 0.2) / 0.7, 10);
  });
  it("bootstrapSkaterLine with an empty prior returns finite organic heads", () => {
    const line = bootstrapSkaterLine({ goalsEs: 0.2, goalsPp: 0.05, assistsEs: 0.25, assistsPp: 0.1, shotsEs: 2, shotsPp: 0.4, hits: 1, blocks: 0.5 },
      prior({}, 0, 0), { goals: 1, assists: 1, shots: 1, ppUsage: 1 });
    for (const value of Object.values(line)) if (typeof value === "number") expect(Number.isFinite(value)).toBe(true);
    expect(line.goalsEs).toBeCloseTo(0.2, 12); expect(line.shotsEs).toBeCloseTo(2, 12); expect(line.goalsPp).toBeCloseTo(0.05, 12);
  });
});
