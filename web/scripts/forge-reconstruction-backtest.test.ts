// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { clusterBootstrap, summarize } from "./forge-counterfactual-backtest";
import { buildRows, loadCaptures, pairRows, runReconstructionBacktest } from "./forge-reconstruction-backtest";

const FIXTURES = join(__dirname, "fixtures", "forge-reconstruction-backtest");
const load = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const fixture = () => buildRows({ captures: loadCaptures(join(FIXTURES, "recon")).captures,
  actuals: load(join(FIXTURES, "actuals.json")), hitsBlocks: load(join(FIXTURES, "hits_blocks.json")) });

describe("forge reconstruction backtest", () => {
  it("joins the synthetic fixture: common games, dressed players, horizon 1, null heads excluded", () => {
    const { rows, checks, kept, dropped } = fixture();
    expect(kept).toEqual(["2026-10-13-1", "2026-10-13-2"]);
    expect(dropped).toEqual(["2026-10-13-3 (missing: b, a0, b0)"]);
    expect(rows.map((r) => `${r.gameId}:${r.playerId}`)).toEqual(["1:11", "1:12", "2:21", "2:22"]);
    expect(checks).toMatchObject({ drop_no_actual_not_dressed: 1, skip_horizon_not_1_a: 1, head_null_component_HIT: 1, rows_used: 4 });
    expect(rows.find((r) => r.playerId === 22)!.heads).not.toContain("HIT");
  });

  it("hand-computed MAE, bias, RMSE and paired deltas", () => {
    const { rows } = fixture();
    expect(summarize(rows, "a", "G")).toMatchObject({ n: 4, mae: 0.5, bias: 0, rmse: 0.5 });
    const b = summarize(rows, "b", "G");
    expect(b.mae).toBeCloseTo(0.2, 12); expect(b.bias).toBeCloseTo(0, 12); expect(b.rmse).toBeCloseTo(0.2, 12);
    // A: a predicts 0.3, a0 predicts 0.2 against actuals 0, 1, 0, 0.
    const a = summarize(rows, "a", "A"), a0 = summarize(rows, "a0", "A");
    expect([a.mae, a.bias, a.rmse].map((x) => Number(x.toFixed(10)))).toEqual([0.4, 0.05, Number(Math.sqrt(0.19).toFixed(10))]);
    expect([a0.mae, a0.bias, a0.rmse].map((x) => Number(x.toFixed(10)))).toEqual([0.35, -0.05, Number(Math.sqrt(0.19).toFixed(10))]);
    const hydration = clusterBootstrap(pairRows(rows, "b", "a"), "b", "G", 1, 2000);
    expect(hydration.dMae).toBeCloseTo(-0.3, 12);
    expect(hydration.dMaeCi.map((x) => Number(x.toFixed(10)))).toEqual([-0.3, -0.3]);
    expect(hydration.dRmse).toBeCloseTo(-0.3, 12);
    // a vs a0 on A: game 1 contributes 0, game 2 contributes +0.2 over 2 rows -> 0.05; resamples give 0, 0.05 or 0.1.
    const r18 = clusterBootstrap(pairRows(rows, "a", "a0"), "a", "A", 1, 2000);
    expect(r18.dMae).toBeCloseTo(0.05, 12);
    expect(r18.dMaeCi.map((x) => Number(x.toFixed(10)) + 0)).toEqual([0, 0.1]);
    expect(clusterBootstrap(pairRows(rows, "a", "a0"), "a", "A", 1, 2000)).toEqual(r18);
  });

  it("renders every section from the CLI in order", () => {
    const dir = mkdtempSync(join(tmpdir(), "forge-recon-")); dirs.push(dir);
    const { report } = runReconstructionBacktest(["--recon-dir", join(FIXTURES, "recon"), "--actuals", join(FIXTURES, "actuals.json"),
      "--hits-blocks", join(FIXTURES, "hits_blocks.json"), "--output", join(dir, "report.md"), "--seed", "1", "--reps", "200"]);
    const order = ["## Metrics per variant", "## Paired deltas", "## Top-decile calibration", "## Check counts"].map((s) => report.indexOf(s));
    expect(order.every((i, k) => i > 0 && (k === 0 || i > order[k - 1]))).toBe(true);
    for (const text of ["| b vs a | hydration effect, R18 on | G |", "| b0 vs a0 |", "| a vs a0 |", "| b vs b0 |", "| a | BLK | variant-a G top decile |", "| b0 | G | own top decile |"])
      expect(report).toContain(text);
    expect(readFileSync(join(dir, "report.md"), "utf8")).toBe(report + "\n");
  });
});
