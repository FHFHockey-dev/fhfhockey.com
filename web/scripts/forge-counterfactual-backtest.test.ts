// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  clusterBootstrap, counterfactualHeads, prepareRows, runCounterfactualBacktest, usedRates,
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

  it("bootstrap CIs are deterministic for a fixed seed", () => {
    const { rows } = prepareRows(inputs());
    const a = clusterBootstrap(rows, "q7", "G", 1, 500), b = clusterBootstrap(rows, "q7", "G", 1, 500);
    expect(a).toEqual(b);
    expect(a.clusters).toBe(2);
    expect(a.dMaeCi[0]).toBeLessThanOrEqual(a.dMaeCi[1]);
  });
});
