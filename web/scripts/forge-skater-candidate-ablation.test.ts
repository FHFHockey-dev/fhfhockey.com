// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { fromHistoricalAudit, pairCandidateCohort, runCandidateAblation, scoreCandidateCohort, type CandidateCohort } from "./forge-skater-candidate-ablation";

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
function cohort(): CandidateCohort {
  return { evidence: "synthetic", provenance: "hand-computed mechanical fixture; no predictive evidence", baseline: "base", variants: ["base", "candidate"],
    heads: ["G", "A"], fpWeights: { G: 3, A: 2 }, rows: Array.from({ length: 20 }, (_, i) => ({
      gameId: i + 1, playerId: i + 1, dressed: true, position: i < 10 ? "F" : "D",
      actual: { G: 2 * (i + 1) + 1, A: 1 },
      predictions: { base: { G: i + 1, A: 1 }, candidate: { G: 2 * (i + 1) + 1, A: 1 } },
    })) };
}

describe("offline skater ablation scorer", () => {
  it("reports paired bias/RMSE, ratio, descriptive MZ and fixed forecast deciles by F/D/head", () => {
    const report = scoreCandidateCohort(cohort(), 40);
    const g = report.groups[0].stats.find((stat) => stat.head === "G")!;
    expect(g.variants[0]).toMatchObject({ n: 20, bias: -11.5, mzSlope: 2, mzIntercept: 1, sumActual: 440, sumPredicted: 210 });
    expect(g.variants[1]).toMatchObject({ n: 20, rmse: 0, bias: 0, actualOverPredicted: 1 });
    expect(g.variants[0].byBaselineHeadDecile[9]).toMatchObject({ n: 2, sumPredicted: 39, sumActual: 80 });
    expect(g.variants[1].byBaselineHeadDecile[9]).toMatchObject({ n: 2, sumPredicted: 80, sumActual: 80 });
    expect(report.groups.map((group) => [group.position, group.rows])).toEqual([["all", 20], ["F", 10], ["D", 10]]);
    expect(g.variants[1].deltaVsBaseline?.dRmse).toBeLessThan(0);
  });

  it("withholds a missing head from all variants and withholds partial FP", () => {
    const input = cohort();
    input.rows[0].predictions.candidate.A = null;
    input.rows[1].dressed = false;
    const paired = pairCandidateCohort(input);
    expect(paired.excluded).toEqual({ notDressed: 1, A: 1, FP: 1 });
    expect(paired.rows[0].heads).toEqual(["G"]);
    const a = scoreCandidateCohort(input, 2).groups[0].stats.find((stat) => stat.head === "A")!;
    expect(a.variants.map((variant) => variant.n)).toEqual([18, 18]);
  });

  it("bins on predictions rather than observed outcomes and ignores input ordering", () => {
    const first = cohort(), changed = cohort();
    changed.rows.forEach((row, i) => { row.actual.G = 40 - i; });
    changed.rows.reverse();
    const bins = (input: CandidateCohort) => scoreCandidateCohort(input, 2).groups[0].stats[0].variants[0].byBaselineHeadDecile;
    expect(bins(first).map((bin) => bin.sumPredicted)).toEqual(bins(changed).map((bin) => bin.sumPredicted));
    expect(scoreCandidateCohort(first, 2)).toEqual(scoreCandidateCohort({ ...first, rows: [...first.rows].reverse() }, 2));
  });

  it("also exposes each candidate's own top forecast decile instead of hiding rank changes", () => {
    const input = cohort();
    input.rows.forEach((row, i) => { row.predictions.candidate.G = 20 - i; });
    const candidate = scoreCandidateCohort(input, 2).groups[0].stats[0].variants[1];
    expect(candidate.byOwnHeadDecile[9]).toMatchObject({ n: 2, sumPredicted: 39, sumActual: 8 });
    expect(candidate.byBaselineHeadDecile[9]).toMatchObject({ n: 2, sumPredicted: 3, sumActual: 80 });
  });

  it("keeps FP ranks common across heads and does not treat a zero denominator as calibration", () => {
    const input = cohort();
    input.fpWeights = { G: 3, A: 0 };
    input.rows[19].predictions.candidate.A = null;
    const report = scoreCandidateCohort(input, 2);
    const a = report.groups[0].stats.find((stat) => stat.head === "A")!.variants[0];
    expect(a.byBaselineFpDecile[9].n).toBe(1);
    const zeros = cohort();
    zeros.rows.forEach((row) => { row.predictions.base.A = 0; });
    const zeroA = scoreCandidateCohort(zeros, 2).groups[0].stats.find((stat) => stat.head === "A")!.variants[0];
    expect(zeroA.actualOverPredicted).toBeNull(); expect(zeroA.mzSlope).toBeNull();
  });

  it("rejects duplicate identities, incomplete metadata and wrong frozen-extract hashes", () => {
    const input = cohort();
    input.rows.push(input.rows[0]);
    expect(() => pairCandidateCohort(input)).toThrow("Duplicate");
    expect(() => pairCandidateCohort({ ...cohort(), baseline: "absent" })).toThrow();
    expect(() => pairCandidateCohort({ ...cohort(), provenance: "" })).toThrow();
    expect(() => fromHistoricalAudit(Buffer.from("[]"))).toThrow("hash mismatch");
  });

  it("executes a local-only CLI with hashed inputs and refuses input/output replacement", () => {
    const dir = mkdtempSync(join(tmpdir(), "forge-skater-candidate-")); dirs.push(dir);
    const input = join(dir, "cohort.json"), output = join(dir, "report.json");
    writeFileSync(input, JSON.stringify(cohort()));
    const result = runCandidateAblation(["--cohort", input, "--output", output]);
    expect(result.inputSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.parse(readFileSync(output, "utf8"))).toMatchObject({ evidence: "synthetic" });
    expect(() => runCandidateAblation(["--cohort", input, "--output", input])).toThrow("overwrite");
    expect(() => runCandidateAblation(["--cohort", input, "--output", output])).toThrow("EEXIST");
  });
});
