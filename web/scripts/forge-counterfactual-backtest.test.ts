// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  bayesSplitRates, clusterBootstrap, counterfactualHeads, prepareRows, renderReport, runCounterfactualBacktest, summarize, usedRates, VARIANTS,
  type PreparedRow,
} from "./forge-counterfactual-backtest";
import { computeSkaterRestScheduleAdjustments, resolveSkaterConversionRates } from "../lib/projections/calculators/skater-adjustments";

const FIXTURES = join(__dirname, "fixtures", "forge-counterfactual-backtest");
const load = (name: string) => JSON.parse(readFileSync(join(FIXTURES, `${name}.json`), "utf8"));
const inputs = () => ({ runs: load("runs"), projections: load("projections"), actuals: load("actuals"), games: load("games") });
const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe("forge counterfactual backtest", () => {
  it("passes the self-checks on the fixture and renders the report", () => {
    const dir = mkdtempSync(join(tmpdir(), "forge-cf-")); dirs.push(dir);
    const output = join(dir, "report.md");
    const { checks, rows, report } = runCounterfactualBacktest(["--runs", join(FIXTURES, "runs.json"),
      "--projections", join(FIXTURES, "projections.json"), "--actuals", join(FIXTURES, "actuals.json"),
      "--games", join(FIXTURES, "games.json"), "--output", output, "--seed", "1", "--reps", "200"]);
    expect(checks).toMatchObject({ projection_rows: 14, rows_used: 12, drop_used_rate_mismatch: 0, drop_rest_multiplier_mismatch: 0,
      drop_mask_disagrees_with_support: 0, negative_residual_G: 0, drop_not_selected_run: 1, drop_candidate_mode_not_modelled: 1,
      head_withheld_A: 1, head_withheld_PPP: 1 });
    expect(checks.info_team_rest_ne_games_derived).toBeUndefined();
    // The stamped 10-13 run wins over the newer null-sha run.
    expect(rows.filter((r) => r.date === "2026-10-13").every((r) => r.gitSha === "abc1234")).toBe(true);
    // Baseline reproduces the stored columns exactly.
    const stored = load("projections").find((p: any) => p.run_id === "run-1013-stamped" && p.player_id === 102);
    const row = rows.find((r) => r.date === "2026-10-13" && r.playerId === 102)!;
    expect(row.preds.baseline.G).toBeCloseTo(stored.proj_goals_es + stored.proj_goals_pp, 10);
    expect(readFileSync(output, "utf8")).toBe(report + "\n");
    for (const section of ["## Check counts", "## All rows", "## Top decile by predicted G", "## B2B team", "## Stratum: stamped git_sha"])
      expect(report).toContain(section);
  });

  it("Q7 moves goals by bayes / legacy-shrunk rate (bayes 0.13, sample weight 0.7)", () => {
    const split = { goalRateEs: 0.13, goalRatePp: 0.2, assistRateEs: 0.7, assistRatePp: 0.9 };
    const legacy = resolveSkaterConversionRates({ splitRates: split, sampleWeight: 0.7 }).conversionShrink.goal_es.legacy;
    expect(legacy).toBeCloseTo(0.13 * 0.7 + 0.3 * 0.095, 12);
    const neutral = { g: 1, a: 1 }, noCoupling = { es: 1, pp: 1 };
    const rates = usedRates(split, 0.7, neutral, noCoupling, false), q7 = usedRates(split, 0.7, neutral, noCoupling, true);
    expect(rates.ges).toBeCloseTo(0.1195, 12);
    expect(q7.ges).toBeCloseTo(0.13, 12);
    const base = { ges: 0.2, gpp: 0, aes: 0.1, app: 0 };
    const { pred } = counterfactualHeads({ base, final: { G: 0.2, A: 0.1, PPP: 0 }, weights: { p: 1, W: 1 },
      rates, ratesPrime: q7, restScale: { G: 1, A: 1, PPP: 1 }, capPpp: true });
    expect(pred.G / 0.2).toBeCloseTo(0.13 / 0.1195, 10);
    // With a season bootstrap, only the organic share p moves.
    const boot = counterfactualHeads({ base, final: { G: 0.25, A: 0.1, PPP: 0 }, weights: { p: 0.15, W: 1 },
      rates, ratesPrime: q7, restScale: { G: 1, A: 1, PPP: 1 }, capPpp: true });
    expect(boot.pred.G - 0.25).toBeCloseTo(0.15 * 0.2 * (0.13 / 0.1195 - 1), 10);
  });

  it("Q8 moves a B2B row from the mild to the heavy fatigue tier and lowers goals", () => {
    const old = computeSkaterRestScheduleAdjustments({ teamRestDays: 1, opponentRestDays: 3, isHome: false, buckets: "legacy" });
    const next = computeSkaterRestScheduleAdjustments({ teamRestDays: 1, opponentRestDays: 3, isHome: false });
    expect(next.goalRateMultiplier).toBeLessThan(old.goalRateMultiplier);
    const { rows } = prepareRows(inputs());
    const b2b = rows.filter((r) => r.teamRest === 1);
    expect(b2b.length).toBe(3);
    for (const r of b2b) {
      expect(r.preds.q8.G).toBeLessThan(r.preds.baseline.G);
      expect(r.preds.q7q8.G).toBeLessThan(r.preds.q7.G);
    }
    // Their opponents (rest 3, facing a rest-1 team) get the larger opponent-fatigue boost.
    for (const r of rows.filter((x) => x.oppRest === 1)) expect(r.preds.q8.G).toBeGreaterThan(r.preds.baseline.G);
  });

  it("a1 moves assists by Bayes/legacy and leaves goals unchanged", () => {
    const split = { goalRateEs: 0.13, goalRatePp: 0.2, assistRateEs: 0.8, assistRatePp: 0.9 };
    const neutral = { g: 1, a: 1 }, noCoupling = { es: 1, pp: 1 };
    const rates = usedRates(split, 0.7, neutral, noCoupling, false);
    const a1 = usedRates(split, 0.7, neutral, noCoupling, false, { q7Assist: true });
    expect(a1.ges).toBe(rates.ges);
    expect(a1.gpp).toBe(rates.gpp);
    expect(rates.aes).toBeCloseTo(0.8 * 0.7 + 0.3 * 0.72, 12);
    expect(a1.aes).toBeCloseTo(0.8, 12);
    const base = { ges: 0.2, gpp: 0, aes: 0.15, app: 0 };
    const { pred } = counterfactualHeads({ base, final: { G: 0.2, A: 0.15, PPP: 0 }, weights: { p: 1, W: 1 },
      rates, ratesPrime: a1, restScale: { G: 1, A: 1, PPP: 1 }, capPpp: true });
    expect(pred.G).toBeCloseTo(0.2, 12);
    expect(pred.A / 0.15).toBeCloseTo(0.8 / 0.776, 10);
    const { rows } = prepareRows(inputs());
    for (const r of rows) for (const v of ["a1", "a2", "a1a2"] as const) expect(r.preds[v].G).toBe(r.preds.baseline.G);
    expect(rows.some((r) => r.heads.includes("A") && Math.abs(r.preds.a1.A - r.preds.baseline.A) > 1e-6)).toBe(true);
  });

  it("a2 moves assists only when the ES coupled rate exceeds 1.8", () => {
    const split = { goalRateEs: 0.13, goalRatePp: 0.2, assistRateEs: 1.6, assistRatePp: 0.9 };
    const neutral = { g: 1, a: 1 }, coupling = { es: 1.3, pp: 1 };
    const rates = usedRates(split, 1, neutral, coupling, false);
    const a2 = usedRates(split, 1, neutral, coupling, false, { wideCoupling: true });
    expect(rates.coupled.es).toBeCloseTo(2.08, 12);
    expect(rates.aes).toBe(1.8);
    expect(a2.aes).toBeCloseTo(2.08, 12);
    expect(a2.app).toBe(rates.app);
    const base = { ges: 0.2, gpp: 0, aes: 0.36, app: 0 };
    const { pred } = counterfactualHeads({ base, final: { G: 0.2, A: 0.36, PPP: 0 }, weights: { p: 1, W: 1 },
      rates, ratesPrime: a2, restScale: { G: 1, A: 1, PPP: 1 }, capPpp: true });
    expect(pred.G).toBeCloseTo(0.2, 12);
    expect(pred.A).toBeCloseTo(0.36 * 2.08 / 1.8, 10);
    // Nothing binds in the fixture, so a2 reproduces baseline there.
    const { rows } = prepareRows(inputs());
    for (const r of rows) {
      expect(r.decomp.bindEs || r.decomp.bindPp).toBe(false);
      expect(r.preds.a2).toEqual(r.preds.baseline);
    }
  });

  it("a3 doubles the organic assist line and leaves goals unchanged", () => {
    const { rows } = prepareRows(inputs());
    const raw = load("projections");
    const selected = new Set(["run-1013-stamped", "run-1014-null"]);
    let checked = 0;
    for (const r of rows) {
      expect(r.preds.a3.G).toBe(r.preds.baseline.G);
      const p = raw.find((x: any) => selected.has(x.run_id) && x.game_id === r.gameId && x.player_id === r.playerId);
      const cb = p.current_baseline, { p: w, W } = r.decomp;
      if (r.heads.includes("A")) {
        expect(r.preds.a3.A).toBeCloseTo((w * 2 * r.decomp.orgA + W * r.decomp.priorA) / W, 10);
        expect(r.preds.a3.A - r.preds.baseline.A).toBeCloseTo((w / W) * r.decomp.orgA, 10);
      }
      if (r.heads.includes("PPP")) {
        const residual = W * (p.proj_goals_pp + p.proj_assists_pp) - w * (cb.goals_pp + cb.assists_pp);
        const ppp = (w * (cb.goals_pp + 2 * cb.assists_pp) + residual) / W;
        expect(r.preds.a3.PPP).toBeCloseTo(Math.min(ppp, r.preds.a3.G + r.preds.a3.A), 10);
        checked += 1;
      }
    }
    expect(checked).toBe(11);
  });

  it("a4 refits assists per goal: Bayes assist rates double and goals are unchanged", () => {
    const support = load("projections")[0].support_counts;
    const two = bayesSplitRates(support, 1, 1, "per_two_goals"), one = bayesSplitRates(support, 1, 1, "per_goal");
    expect(two.assistRateEs).toBeGreaterThan(0.2); expect(two.assistRateEs).toBeLessThan(1.45);
    expect(one.assistRateEs! / two.assistRateEs!).toBeCloseTo(2, 10);
    expect(one.assistRatePp! / two.assistRatePp!).toBeCloseTo(2, 10);
    expect(one.goalRateEs).toBe(two.goalRateEs);
    const { rows } = prepareRows(inputs());
    let checked = 0;
    for (const r of rows) {
      expect(r.preds.a4.G).toBe(r.preds.baseline.G);
      expect(r.preds.a4q7.G).toBe(r.preds.q7.G);
      if (!r.heads.includes("A")) continue;
      // Organic A under a4 is exactly twice the organic A under a1 (same Bayes path, old scale) when no clamp binds.
      const { p, W, priorA } = r.decomp, organic = (a: number) => (a * W - W * priorA) / p;
      expect(organic(r.preds.a4.A) / organic(r.preds.a1.A)).toBeCloseTo(2, 8);
      checked += 1;
    }
    expect(checked).toBe(11);
  });

  it("renders the assists decomposition and it adds up", () => {
    const { rows, checks, selected } = prepareRows(inputs());
    const report = renderReport({ rows, checks, selected, inputs: [], seed: 1, reps: 50 });
    expect(report).toContain("## Assists decomposition (baseline)");
    expect(report).toContain("Outer coupling clamp binding in baseline: ES 0/11");
    expect(report).toMatch(/\| a1a2 \| A \|/);
    for (const r of rows.filter((x) => x.heads.includes("A"))) {
      const { p, W, orgA, priorA, finalA } = r.decomp;
      expect(Math.abs(finalA - (p * orgA + priorA * W) / W)).toBeLessThan(1e-6);
      expect(finalA).toBeCloseTo(r.preds.baseline.A, 10);
    }
  });

  it("RMSE and paired ΔRMSE match hand values", () => {
    const zero = { G: 0, A: 0, PPP: 0 };
    const row = (gameId: number, actual: number, base: number, q7: number) => ({ gameId, playerId: gameId, date: "2026-10-13",
      gitSha: null, stamped: false, teamRest: null, oppRest: null, heads: ["G" as const], actual: { ...zero, G: actual },
      preds: Object.fromEntries(VARIANTS.map((v) => [v.key, { ...zero, G: v.key === "q7" ? q7 : base }])) as PreparedRow["preds"],
      decomp: { p: 1, W: 1, orgA: 0, priorA: 0, finalA: 0, bindEs: false, bindPp: false } });
    // Baseline errors 0.5, -1, 2 (SSE 5.25); q7 errors 0, -0.5, 1 (SSE 1.25).
    const rows: PreparedRow[] = [row(1, 0, 0.5, 0), row(2, 1, 0, 0.5), row(3, 1, 3, 2)];
    expect(summarize(rows, "baseline", "G").rmse).toBeCloseTo(Math.sqrt(5.25 / 3), 12);
    expect(summarize(rows, "q7", "G").rmse).toBeCloseTo(Math.sqrt(1.25 / 3), 12);
    const a = clusterBootstrap(rows, "q7", "G", 7, 300);
    expect(a.dRmse).toBeCloseTo(Math.sqrt(1.25 / 3) - Math.sqrt(5.25 / 3), 12);
    expect(a.dRmseCi[0]).toBeLessThanOrEqual(a.dRmse);
    expect(a.dRmseCi[1]).toBeLessThanOrEqual(0);
    expect(clusterBootstrap(rows, "q7", "G", 7, 300)).toEqual(a);
    expect(clusterBootstrap(rows, "baseline", "G", 7, 300).dRmse).toBe(0);
  });

  it("bootstrap CIs are deterministic for a fixed seed", () => {
    const { rows } = prepareRows(inputs());
    const a = clusterBootstrap(rows, "q7", "G", 1, 500), b = clusterBootstrap(rows, "q7", "G", 1, 500);
    expect(a).toEqual(b);
    expect(a.clusters).toBe(2);
    expect(a.dMaeCi[0]).toBeLessThanOrEqual(a.dMaeCi[1]);
  });
});
