// @vitest-environment node
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { describe, expect, it } from "vitest";
import {
  fitProductionPrior, outcomes, personalReference, productionGap, scoreProduction, selectReference, summarizeHistory, validCovariance,
  type HistorySummary, type ProductionPrior,
} from "./productionReference";

/** Cases ported from the frozen `test_estimator.py`. The three `exposure_gap_fixed` cases test a helper v1 does not use. */
const isoDay = (start: string, days: number) => new Date(Date.parse(`${start}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
function history(pid = 1, n = 50, scaleBy: number[] | null = null): HistorySummary {
  const values: number[][] = [], seconds: number[] = [];
  for (let i = 0; i < n; i++) {
    const g = (i + pid) % 3, a = Number(i % 4 < pid % 3), s = (i * 2 + pid) % 6, b = Math.floor(i / 3) % 2;
    values.push([3 * g + 2 * a + 0.2 * s + 0.25 * b, g + a, 0.75 * g + 0.7 * a + 0.075 * s + 0.05 * b + 0.05 * ((i % 7) - 3) - 0.2].map((v, j) => v * (scaleBy?.[j] ?? 1)));
    seconds.push(300 + 20 * pid + 5 * (i % 5));
  }
  const dates = Array.from({ length: n }, (_, i) => isoDay("2022-10-01", i));
  return summarizeHistory(pid, "F", values, seconds, Array.from({ length: n }, (_, i) => pid * 1000 + i), dates, "2023-10-01", n === 50)[0]!;
}
const donors = (s: number[] | null = null) => Array.from({ length: 8 }, (_, i) => history(i + 1, 50, s));
const prior = (s: number[] | null = null) => fitProductionPrior(donors(s), "F", 999, "2023-10-01")[0]!;
const close = (a: number[] | number[][], b: number[] | number[][], tol = 1e-12) => a.flat().forEach((v, i) => expect(Math.abs(v - b.flat()[i])).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(b.flat()[i]))));

describe("productionReference estimator (ported)", () => {
  it("uses other players and prior events", () => {
    const [p, reason] = fitProductionPrior(donors(), "F", 1, "2023-10-01");
    expect(reason).toBeNull(); expect(p!.donor_ids).not.toContain(1); expect(p!.donors).toBe(7);
  });
  it("rejects a future donor", () => {
    const ds = donors(); ds[0].end = "2024-01-01";
    expect(() => fitProductionPrior(ds, "F", 999, "2023-10-01")).toThrow();
  });
  it("does not let a future record change the selected slots", () => {
    const records = Array.from({ length: 70 }, (_, i) => ({ id: i, player_id: 1, date: isoDay("2023-01-01", i) }));
    const expected = selectReference(records, 1, "2023-03-01");
    expect(selectReference([...records, { id: 999, player_id: 1, date: "2099-01-01" }], 1, "2023-03-01")).toEqual(expected);
    expect(expected).toHaveLength(50);
  });
  it("shrinks sparse history continuously instead of using a game floor", () => {
    const p = prior(), one = personalReference(p, history(90, 1)), twenty = personalReference(p, history(90, 20));
    expect(one.personal_weight).toBeGreaterThanOrEqual(0); expect(twenty.personal_weight).toBeLessThanOrEqual(1);
    expect(one.personal_weight).toBeLessThanOrEqual(twenty.personal_weight);
    close(one.rate, history(90, 1).rate.map((r, j) => one.personal_weight * r + (1 - one.personal_weight) * p.mu[j]));
  });
  it("labels a no-history reference as cohort", () => {
    const p = prior(), ref = personalReference(p, null);
    close(ref.rate, p.mu); expect(ref.personal_weight).toBe(0);
    const out = scoreProduction(p, null, [0, 0, 0], 2000);
    expect(out.tier).toBe("cohort_reference"); expect(out.direction).toBeNull(); expect(out.trusted_list_eligible).toBe(false);
  });
  it("cannot be vetoed by low or zero shots", () => {
    const out = scoreProduction(prior(), history(90, 10), [2, 1, 0.5], 1000);
    expect(out.value).not.toBeNull(); expect(out.finishing_gate).toBe(false); expect("shots" in out).toBe(false);
  });
  it("does not treat short positive exposure as a quality cutoff", () => {
    expect(scoreProduction(prior(), history(90, 10), [0, 0, 0], 0.5).value).not.toBeNull();
  });
  it("leaves missing or zero exposure unestimated", () => {
    for (const t of [null, 0]) {
      const out = scoreProduction(prior(), history(90, 10), [0, 0, 0], t);
      expect(out.value).toBeNull(); expect(out.tier).toBe("unestimated_current_exposure");
    }
  });
  it("treats zero observed output as information", () => {
    const out = scoreProduction(prior(), history(90, 10), [0, 0, 0], 2000);
    expect(out.value!).toBeGreaterThan(0); expect(out.raw_observed).toEqual([0, 0, 0]);
  });
  it("does not fill or reweight a missing current track", () => {
    const out = scoreProduction(prior(), history(90, 10), [0, null, 0], 2000);
    expect(out.tier).toBe("prior_reference_only_missing_current"); expect(out.raw_observed[1]).toBeNull();
    expect(out.direction).toBeNull(); expect(out.value).toBeNull(); expect(out.weights).toEqual([1 / 3, 1 / 3, 1 / 3]); expect(out.expected_totals).toBeDefined();
  });
  it("does not treat all-missing current outcomes as observed neutral", () => {
    const out = scoreProduction(prior(), null, [null, null, null], 2000);
    expect(out.value).toBeNull(); expect(out.tier).toBe("prior_reference_only_missing_current"); expect(out.direction).toBeNull();
  });
  it("allows a negative Game Score", () => {
    expect(scoreProduction(prior(), history(90, 10), [0, 0, -2], 2000).value).not.toBeNull();
  });
  it("does not rescue a missing history measurement", () => {
    const dates = [0, 1, 2].map(i => isoDay("2022-01-01", i));
    expect(summarizeHistory(1, "F", [[0, 0, 0], [1, 1, NaN], [0, 0, 0]], [600, 600, 600], [1, 2, 3], dates, "2023-01-01")).toEqual([null, "missing_measurement_or_exposure"]);
  });
  it("gives a degenerate group no variance epsilon", () => {
    const ds = [1, 2].map(pid => summarizeHistory(pid, "F", Array.from({ length: 50 }, () => [0, 0, 0]), Array(50).fill(600),
      Array.from({ length: 50 }, (_, i) => pid * 100 + i), Array.from({ length: 50 }, (_, i) => isoDay("2022-01-01", i)), "2023-01-01", true)[0]!);
    expect(fitProductionPrior(ds, "F", 999, "2023-01-01")).toEqual([null, "unestimable_group_rate_scale"]);
  });
  it("is invariant to unit rescaling", () => {
    const s = [20, 1, 200];
    const a = scoreProduction(prior(), history(90, 10), [2, 1, 0.5], 2000);
    const b = scoreProduction(prior(s), history(90, 10, s), [2 * 20, 1, 0.5 * 200], 2000);
    expect(b.value!).toBeCloseTo(a.value!, 7);
  });
  it("accepts full overlap covariance and rejects malformed or indefinite ones", () => {
    expect(validCovariance([[1, 1, 1], [1, 1, 1], [1, 1, 1]], true)).toBe(true);
    expect(validCovariance([[1e12, 0, 0], [0, 1, 2], [0, 2, 1]], true)).toBe(false);
    expect(validCovariance([[1, 0], [0, 1]], true)).toBe(false);
    expect(validCovariance(null, true)).toBe(false);
  });
  it("matches the hand-calculated shrinkage and joint gap", () => {
    const signal = [[4e-6, 0, 0], [0, 1e-6, 0], [0, 0, 0.25e-6]];
    const p: ProductionPrior = { position: "F", donors: 8, donor_ids: [], mu: [0.01, 0.005, 0.002], signal, omega: signal.map(r => r.map(v => v * 1000)),
      mean_cov: [[0, 0, 0], [0, 0, 0], [0, 0, 0]], metric: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], variance_component_eigenvalues: [], donor_end_dates: [] };
    const h = { rate: [0.02, 0.01, 0.004], seconds: 1000, n: 3 } as HistorySummary;
    const out = scoreProduction(p, h, [20, 10, 4], 2000);
    expect(out.personal_weight).toBeCloseTo(0.5, 12);
    close(out.expected_totals as number[], [30, 15, 6]); close(out.joint_gap_scale as number[], [4, 2, 1]);
    expect(out.normalized_gap as number).toBeCloseTo(7 / Math.sqrt(3), 12);
  });
  it("does not count perfectly shared tracks as three confirmations", () => {
    const one = [[1e-6, 1e-6, 1e-6], [1e-6, 1e-6, 1e-6], [1e-6, 1e-6, 1e-6]];
    const p: ProductionPrior = { position: "F", donors: 8, donor_ids: [], mu: [0.01, 0.01, 0.01], signal: one, omega: one.map(r => r.map(v => v * 1000)),
      mean_cov: [[0, 0, 0], [0, 0, 0], [0, 0, 0]], metric: [[1, 1, 1], [1, 1, 1], [1, 1, 1]], variance_component_eigenvalues: [], donor_end_dates: [] };
    const out = scoreProduction(p, { rate: [0.02, 0.02, 0.02], seconds: 1000, n: 3 } as HistorySummary, [20, 20, 20], 2000);
    expect(out.normalized_gap as number).toBeCloseTo(5, 10);
  });
  it("does not treat missing model uncertainty as zero", () => {
    const out = productionGap({ ...personalReference(prior(), null), omega: null }, [0, 0, 0], 2000);
    expect(out.value).toBeNull(); expect(out.tier).toBe("unestimated_joint_uncertainty");
  });
  it("does not mutate inputs", () => {
    const p = prior(), h = history(90, 10), before = structuredClone(p), hb = structuredClone(h);
    scoreProduction(p, h, [0, 0, 0], 2000);
    expect(p).toEqual(before); expect(h).toEqual(hb);
  });
});

describe("productionReference track outcomes", () => {
  const row = { goals: 1, assists: 2, pp_points: 1, shots: 4, hits: 3, blocked_shots: 2, total_primary_assists: 1, total_secondary_assists: 1,
    penalties_drawn: 1, penalties: 2, total_fow: 5, total_fol: 3, sat_for: 10, sat_against: 8, es_goals_for: 2, pp_goals_for: 1, sh_goals_for: 0,
    es_goals_against: 1, pp_goals_against: 0, sh_goals_against: 0 };
  it("computes FHFH Standard, G+A and the named WiGO Game Score", () => {
    const [fp, pts, gs] = outcomes(row);
    expect(fp.value).toBeCloseTo(3 + 4 + 1 + 0.8 + 0.6 + 0.5, 12);
    expect(pts.value).toBe(3);
    expect(gs.value).toBeCloseTo(0.75 + 0.7 + 0.55 + 0.3 + 0.1 - 0.15 + 0.02 + 0.1 + 0.3, 12);
  });
  it("leaves only the affected track null when an input is missing", () => {
    const [fp, pts, gs] = outcomes({ ...row, es_goals_for: null });
    expect(fp.value).not.toBeNull(); expect(pts.value).toBe(3); expect(gs).toEqual({ value: null, reason: "missing_required_input" });
    expect(outcomes({ ...row, points: 4 })[1]).toEqual({ value: null, reason: "inconsistent_points_primitive" });
  });
});

/** Opt-in: rebuild all 2,772 saved production axes from the exported 2022-24 history.
 * BLSH_DEV_HISTORY = exported dev-history.jsonl; BLSH_V1_EXPOSURE_DIR = Codex `exposure-rate-candidate-v1`. */
const devHistory = process.env.BLSH_DEV_HISTORY, exposureDir = process.env.BLSH_V1_EXPOSURE_DIR;
describe.skipIf(!devHistory || !exposureDir || !existsSync(devHistory) || !existsSync(join(exposureDir, "run-guarded-v1", "ESTIMATES.jsonl")))("productionReference parity with frozen v1 run", () => {
  type Row = Record<string, any>;
  const lines = async function* (file: string) {
    for await (const line of createInterface({ input: createReadStream(file), crlfDelay: Infinity })) if (line.trim()) yield JSON.parse(line) as Row;
  };
  const pos = (r: Row) => (r.position_code === "D" ? "D" : ["F", "C", "L", "R", "LW", "RW"].includes(r.position_code) ? "F" : null);
  const diff = (a: unknown, b: unknown): number => Array.isArray(a) && Array.isArray(b) ? (a.length !== b.length ? Infinity : Math.max(0, ...a.map((v, i) => diff(v, b[i]))))
    : typeof a === "number" && typeof b === "number" ? Math.abs(a - b) / Math.max(1, Math.abs(b)) : a === b ? 0 : Infinity;

  it("reproduces every saved production axis", async () => {
    const spec = JSON.parse(readFileSync(join(exposureDir!, "SPEC.json"), "utf8"));
    const inputs = JSON.parse(readFileSync(join(exposureDir!, "INPUTS.json"), "utf8"));
    const anomalies = new Set<number>(spec.preserved_anomaly_ids);
    const raw = new Map<number, Row>(), histories = new Map<number, Row[]>(), measured = new Map<number, (number | null)[]>();
    for await (const r of lines(devHistory!)) {
      raw.set(r.id, r);
      if (anomalies.has(r.id)) continue;
      if (!histories.has(r.player_id)) histories.set(r.player_id, []);
      histories.get(r.player_id)!.push(r);
      measured.set(r.id, r.games_played === 1 ? outcomes(r).map(m => m.value) : [null, null, null]);
    }
    histories.forEach(rows => rows.sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id));
    const summary = (rows: Row[], pid: number, position: string | null, before: string, full = false): [HistorySummary | null, string | null] => {
      if (rows.some(r => r.games_played !== 1)) return [null, "GP_unknown_or_nonappearance"];
      return summarizeHistory(pid, position ?? "", rows.map(r => measured.get(r.id)!.map(v => (v === null ? NaN : v))), rows.map(r => (r.toi_per_game ?? NaN)),
        rows.map(r => r.id), rows.map(r => r.date), before, full);
    };
    const pools = new Map<string, HistorySummary[]>();
    const donorPool = (before: string) => {
      if (!pools.has(before)) {
        const donors: HistorySummary[] = [];
        histories.forEach((rows, pid) => {
          const h = selectReference(rows as { player_id: number; date: string; id: number }[], pid, before) as Row[];
          const positions = new Set(h.map(pos));
          if (positions.size !== 1 || positions.has(null)) return;
          const [s] = summary(h, pid, [...positions][0], before, true);
          if (s) donors.push(s);
        });
        pools.set(before, donors);
      }
      return pools.get(before)!;
    };
    const saved = new Map<string, Row>();
    for await (const e of lines(join(exposureDir!, "run-guarded-v1", "ESTIMATES.jsonl"))) saved.set(`${e.player_id}|${e.snapshot_date}`, e);
    let origins = 0, worst = 0;
    const mismatches: string[] = [];
    for await (const o of lines(inputs.sources.origins.path)) {
      if (!spec.dates.includes(o.snapshot_date)) continue;
      origins++;
      const key = `${o.player_id}|${o.snapshot_date}`, e = saved.get(key)!, w = (o.recent_source_ids as number[]).map(id => raw.get(id)!);
      if (!w.length) { if (e.tier !== "no_current_evidence") mismatches.push(`${key}: no current`); continue; }
      const before = w[0].date, position = pos(w[w.length - 1]);
      const h = selectReference((histories.get(o.player_id) ?? []) as { player_id: number; date: string; id: number }[], o.player_id, before) as Row[];
      let [personal] = summary(h, o.player_id, position, before);
      if (h.some(r => pos(r) !== position)) personal = null;
      const [p] = position ? fitProductionPrior(donorPool(before), position, o.player_id, before) : [null];
      const complete = w.every(r => r.games_played === 1), times = w.map(r => r.toi_per_game);
      const total = complete && times.every(t => typeof t === "number" && Number.isFinite(t) && t >= 0) ? times.reduce((s, t) => s + t, 0) : null;
      const y = [0, 1, 2].map(j => (w.every(r => measured.get(r.id)![j] !== null) ? w.reduce((s, r) => s + (measured.get(r.id)![j] as number), 0) : null));
      const ours = scoreProduction(p, personal, y, total);
      if (ours.tier !== e.tier || (ours.direction ?? null) !== (e.direction ?? null) || (ours.value === null) !== (e.value === null)) { mismatches.push(`${key}: tier/direction`); continue; }
      const d = Math.max(diff(ours.value, e.value), diff(ours.normalized_gap ?? null, e.normalized_gap ?? null), diff(ours.expected_totals ?? null, e.expected_totals ?? null),
        diff(ours.joint_gap_covariance ?? null, e.joint_gap_covariance ?? null), diff(ours.personal_weight ?? null, e.personal_weight ?? null),
        diff(p?.mu ?? null, e.fitted_prior?.mu ?? null), diff(p?.omega ?? null, e.fitted_prior?.omega ?? null), diff(p?.signal ?? null, e.fitted_prior?.signal ?? null));
      if (!Number.isFinite(d)) mismatches.push(`${key}: shape`); else worst = Math.max(worst, d);
    }
    expect(origins).toBe(2772);
    expect(mismatches.slice(0, 10)).toEqual([]);
    expect(worst).toBeLessThanOrEqual(1e-9);
  }, 900_000);
});
