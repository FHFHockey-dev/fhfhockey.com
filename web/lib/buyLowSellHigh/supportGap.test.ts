// @vitest-environment node
import { createReadStream, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { describe, expect, it } from "vitest";
import {
  PROCESS, SHRINK, attributionOf, conditionalDelta, covarianceGeometry, explainSupportGap, fitPrior, rankTwoLists, score, scoreAndAttribute,
  type ExplanationContext, type ProductionAxis, type ScoringModel, type SupportGapExplanation, type SupportGapResult, type TrainingBlock, type WindowEvidence,
} from "./supportGap";

/** Unit cases ported one-for-one from the frozen `test_candidate.py`. */
function blocks(): [TrainingBlock[], number[][]] {
  const x = [[1, 2, 3], [2, 1, 3], [3, 2, 2], [1, 4, 1], [2, 2, 4], [4, 3, 2]];
  const coefficient = [[1, 0.2, 0.1], [0.3, 0.1, 0.2], [0.1, 0.05, -0.1]];
  const result: TrainingBlock[] = [];
  for (const pid of [11, 12]) x.forEach((row, k) => {
    const dates = Array.from({ length: 5 }, (_, j) => new Date(Date.UTC(2023, 0, 1 + 5 * k + j)).toISOString().slice(0, 10));
    const y = [0, 1, 2].map(c => row.reduce((s, v, i) => s + v * coefficient[i][c], 0) + [10 * pid, pid, -2 * pid][c]);
    result.push({ player_id: pid, position: "F", season_id: 20222023, source_ids: Array.from({ length: 5 }, (_, j) => pid * 1000 + 5 * k + j), dates,
      seconds: 5000 + 100 * k, X: [...row], Y: y, qualified_process_exposure: true, teams: Array(5).fill("AAA"), positions: Array(5).fill("F") });
  });
  return [result, coefficient];
}
const model = (): ScoringModel => ({
  featureNames: [...PROCESS], beta: [[0.5, 0, 0], [0, 0.5, 0], [0, 0, 0.5]], Cxx: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  cohortX: [1, 2, 3], rank: 3, donors: 12, deltaMin: [-10, -10, -10], deltaMax: [10, 10, 10],
});
const production = (): ProductionAxis => ({
  value: 30, current_seconds: 3600, expected_totals: [10, 3, 1], raw_observed: [8, 2, 0],
  joint_gap_covariance: [[4, 0, 0], [0, 1, 0], [0, 0, 1]], personal_n: 50, personal_weight: 0.8,
});
const evaluate = (o: { m?: ScoringModel; p?: ProductionAxis; w?: (number | null)[]; h?: (number | null)[]; personal?: boolean[]; fresh?: boolean } = {}) =>
  score(o.m ?? model(), o.p ?? production(), o.w ?? [1.5, 2, 3], o.h ?? [1, 2, 3], o.personal ?? [true, true, true], o.fresh ?? true);
const times = (v: number[], m: number[][]) => m[0].map((_, j) => m.reduce((s, row, i) => s + v[i] * row[j], 0));
const close = (actual: number[] | number[][], expected: number[] | number[][], atol = 1e-12) =>
  actual.flat().forEach((v, i) => expect(Math.abs(v - expected.flat()[i])).toBeLessThanOrEqual(atol));

describe("supportGap fit", () => {
  it("centers player levels and half-shrinks", () => {
    const [data, coefficient] = blocks();
    const [fitted, reason] = fitPrior(data, 99, "F", "2023-02-01");
    expect(reason).toBeNull();
    close(fitted!.beta, coefficient.map(r => r.map(v => SHRINK * v)));
    expect(fitted!.donors).toBe(2);
    Object.values(fitted!.playerWeightSums).forEach(w => expect(Math.abs(w - 0.5)).toBeLessThan(1e-12));
  });
  it("rejects current/future training", () => {
    expect(() => fitPrior(blocks()[0], 99, "F", "2023-01-30")).toThrow("Current/future");
  });
  it("keeps the target out of the fit", () => {
    const [data] = blocks();
    const [before] = fitPrior(data, 99, "F", "2023-02-01");
    const poison = { ...structuredClone(data[0]), player_id: 99, X: [1e10, 1e10, 1e10], Y: [1e20, 1e20, 1e20] };
    const [after] = fitPrior([...data, poison], 99, "F", "2023-02-01");
    expect(after!.beta).toEqual(before!.beta);
    expect(after!.targetBlocksExcluded).toBe(1);
  });
  it("rejects overlapping source blocks", () => {
    const [data] = blocks();
    expect(() => fitPrior([...data, structuredClone(data[0])], 99, "F", "2023-02-01")).toThrow("Overlapping");
  });
  it("does not let new IDs hide duplicate player dates", () => {
    const [data] = blocks();
    const duplicate = { ...structuredClone(data[0]), source_ids: [9000, 9001, 9002, 9003, 9004] };
    expect(() => fitPrior([...data, duplicate], 99, "F", "2023-02-01")).toThrow("Overlapping");
  });
  it("does not compress an invalid original block", () => {
    const [data] = blocks();
    data[0].qualified_process_exposure = false;
    const [fitted] = fitPrior(data, 99, "F", "2023-02-01");
    expect(fitted!.blocks).toBe(11);
    expect(fitted!.rejected.unqualified_original_block).toBe(1);
    expect(data[0].source_ids.some(id => fitted!.sourceIds.includes(id))).toBe(false);
  });
  it("does not let an unknown team hide a trade", () => {
    const [data] = blocks();
    data[0].teams = ["AAA", null, "BBB", "BBB", "BBB"];
    expect(fitPrior(data, 99, "F", "2023-02-01")[0]!.rejected.within_block_context_change).toBe(1);
  });
  it("is unavailable for a sparse fit", () => {
    expect(fitPrior(blocks()[0].slice(0, 6), 99, "F", "2023-02-01")).toEqual([null, "fewer_than_two_arithmetic_donor_players"]);
  });
  it("gives a constant process no epsilon", () => {
    const [data] = blocks();
    data.forEach(b => { b.X = [1, 1, 1]; });
    expect(fitPrior(data, 99, "F", "2023-02-01")).toEqual([null, "no_within_player_process_variation"]);
  });
  it("gives a duplicate feature no extra vote", () => {
    const [data] = blocks();
    const [fitted] = fitPrior(data, 99, "F", "2023-02-01");
    const duplicate = structuredClone(data);
    duplicate.forEach(b => b.X!.push(b.X![0]));
    const [repeated] = fitPrior(duplicate, 99, "F", "2023-02-01", [...PROCESS, "same_xG_copy"]);
    const delta = [0.4, -0.3, 0.2];
    close(times(delta, fitted!.beta), times([...delta, delta[0]], repeated!.beta));
    expect(fitted!.rank).toBe(repeated!.rank);
  });
  it("preserves the fitted correction under process unit changes", () => {
    const [data] = blocks();
    const [fitted] = fitPrior(data, 99, "F", "2023-02-01");
    const units = [1000, 0.5, 2];
    const rescaled = structuredClone(data);
    rescaled.forEach(b => { b.X = b.X!.map((v, j) => v * units[j]); });
    const [changed] = fitPrior(rescaled, 99, "F", "2023-02-01");
    const delta = [0.4, -0.3, 0.2];
    close(times(delta, fitted!.beta), times(delta.map((d, j) => d * units[j]), changed!.beta));
  });
});

describe("supportGap geometry and conditional delta", () => {
  it("rejects heteroscale invalid and missing covariance", () => {
    expect(() => covarianceGeometry([[1e24, 1e13, 0], [1e13, 1, 0], [0, 0, 1]])).toThrow("Non-PSD");
    expect(() => covarianceGeometry(null)).toThrow("Missing");
  });
  it("treats missing as not zero and zero as measured", () => {
    const [zero] = conditionalDelta(model(), [0, 2, 3], [0, 2, 3], [true, true, true]);
    const [missing] = conditionalDelta(model(), [null, 2, 3], [0, 2, 3], [true, true, true]);
    expect(zero!.observedIndices).toEqual([0, 1, 2]);
    expect(missing!.imputedIndices).toEqual([0]);
    expect(missing!.missingProcessCovariance[0][0]).toBeGreaterThan(0);
    expect(zero!.missingProcessCovariance[0][0]).toBe(0);
  });
  it("keeps singular-overlap conditional uncertainty valid", () => {
    const m = { ...model(), Cxx: [[1, 1, 0], [1, 1, 0], [0, 0, 1]] };
    const [process, reason] = conditionalDelta(m, [2, null, 3], [1, 2, 3], [true, true, true]);
    expect(reason).toBeNull();
    close(process!.delta, [1, 1, 0]);
    expect(process!.missingProcessCovariance[1][1]).toBeLessThan(1e-24);
    covarianceGeometry(process!.missingProcessCovariance);
  });
  it("does not give an unseen null-space change a measured interpretation", () => {
    const s = evaluate({ m: { ...model(), Cxx: [[1, 1, 0], [1, 1, 0], [0, 0, 1]] }, w: [2, 1, 3] });
    expect(s.process!.outsidePriorSpan).toBe(true);
    expect(s.evidenceTier).toBe("provisional_estimated_or_extrapolated");
  });
});

describe("supportGap score", () => {
  it("cannot rename missing current support as production", () => {
    const s = evaluate({ w: [null, null, null] });
    expect(s.value).toBeNull();
    expect(s.reason).toBe("no_observed_current_process");
    expect(s.productionAxis.value).toBe(30);
  });
  it("labels a missing reference as cohort", () => {
    const s = evaluate({ h: [null, null, null], personal: [false, false, false] });
    expect(s.value).not.toBeNull();
    expect(s.evidenceTier).toBe("provisional_estimated_or_extrapolated");
    expect(s.process!.modes.every(m => m.includes("cohort_reference"))).toBe(true);
  });
  it("does not veto low/zero shooting or balanced finishing", () => {
    const s = evaluate({ w: [0, 2, 3], h: [0, 2, 3] });
    expect(s.value!).toBeGreaterThan(0);
    expect(s.researchList).toBe("BL");
    expect(s.individualFinishingOrSOGGate).toBe(false);
  });
  it("keeps peripheral-driven production visible", () => {
    const s = evaluate({ p: { ...production(), raw_observed: [14, 3, 1] }, w: [0, 2, 3], h: [0, 2, 3] });
    expect(s.value!).toBeLessThan(0);
    expect(s.researchList).toBe("SH");
  });
  it("separates a support change from the raw production axis", () => {
    const plain = evaluate({ w: [1, 2, 3] }), changed = evaluate({ w: [2, 2, 3] });
    expect(plain.value).not.toBe(changed.value);
    close(changed.supportAdjustment!, [0.5, 0, 0]);
  });
  it("keeps a conflict's number without a direction", () => {
    const s = evaluate({ p: { ...production(), raw_observed: [9, 2.9, 0.9] }, w: [0, 2, 3], h: [6, 2, 3] });
    expect(s.value!).toBeLessThan(0);
    expect(s.status).toBe("conflicting_baseline_and_support");
    expect(s.researchList).toBeNull();
  });
  it("discloses floors and keeps GS signed", () => {
    const s = evaluate({ w: [0, 0, 0], h: [30, 10, 10] });
    expect(s.physicalFloorIndices).toEqual([0, 1]);
    close(s.expectedSupport!, [0, 0, -4]);
    expect(s.evidenceTier).toBe("provisional_estimated_or_extrapolated");
  });
  it("keeps no current history null", () => {
    const s = evaluate({ p: { ...production(), value: null, current_seconds: null } });
    expect(s.value).toBeNull();
    expect(s.status).toBe("unavailable");
  });
  it("does not treat stale or cohort evidence as measured personal evidence", () => {
    const stale = evaluate({ fresh: false });
    expect(stale.value).not.toBeNull();
    expect(stale.researchList).toBeNull();
    const cohort = evaluate({ p: { ...production(), personal_n: 0 }, h: [null, null, null], personal: [false, false, false] });
    expect(cohort.evidenceTier).toBe("provisional_estimated_or_extrapolated");
    expect(cohort.trustedListEligible).toBe(false);
  });
  it("preserves the index under outcome unit changes", () => {
    const units = [100, 0.5, 2], p = production(), m = model();
    p.expected_totals = p.expected_totals!.map((v, i) => v * units[i]);
    p.raw_observed = p.raw_observed!.map((v, i) => v * units[i]);
    p.joint_gap_covariance = p.joint_gap_covariance!.map((r, i) => r.map((v, j) => v * units[i] * units[j]));
    m.beta = m.beta.map(r => r.map((v, j) => v * units[j]));
    expect(evaluate({ m, p }).value!).toBeCloseTo(evaluate().value!, 7);
  });
  it("distinguishes balanced from missing", () => {
    const balanced = evaluate({ p: { ...production(), raw_observed: [10, 3, 1] }, w: [1, 2, 3] });
    expect(balanced.value).toBe(0);
    expect(balanced.status).toBe("balanced_model_estimate");
    expect(evaluate({ w: [null, null, null] }).value).toBeNull();
  });
  it("keeps exactly two lists, tier order and non-list records separate", () => {
    const records = [
      { playerId: 2, snapshotDate: "2024-04-18", candidate: evaluate({ h: [null, null, null], personal: [false, false, false] }) },
      { playerId: 1, snapshotDate: "2024-04-18", candidate: evaluate() },
      { playerId: 3, snapshotDate: "2024-04-18", candidate: evaluate({ fresh: false }) },
    ];
    const result = rankTwoLists(records);
    expect(Object.keys(result).sort()).toEqual(["BL", "SH"]);
    expect(result.BL.map(r => r.playerId)).toEqual([1, 2]);
    expect(records).toHaveLength(3);
    expect(() => rankTwoLists([...records, records[0]])).toThrow("Duplicate");
  });
  it("leaves original objects unchanged", () => {
    const p = production(), before = structuredClone(p);
    const s = evaluate({ p });
    expect(p).toEqual(before);
    expect(s.productionAxis).toEqual(before);
    expect(s.trustedListEligible).toBe(false);
  });
});

/** Opt-in replay of the frozen v1 run (2,772 origins). Set BLSH_V1_RUN_DIR to its `run-guarded-v1` folder.
 * Optional BLSH_PARITY_RECEIPT writes the measured differences as JSON. */
const runDir = process.env.BLSH_V1_RUN_DIR;
describe.skipIf(!runDir || !existsSync(join(runDir, "CANDIDATES.jsonl")))("supportGap parity with frozen v1 run", () => {
  type Saved = Record<string, any>;
  const lines = async function* (file: string) {
    for await (const line of createInterface({ input: createReadStream(join(runDir!, file)), crlfDelay: Infinity })) if (line.trim()) yield JSON.parse(line) as Saved;
  };
  const maxDiff = (a: unknown, b: unknown): number => {
    if (Array.isArray(a) && Array.isArray(b)) return a.length !== b.length ? Infinity : Math.max(0, ...a.map((v, i) => maxDiff(v, b[i])));
    if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) / Math.max(1, Math.abs(b));
    return a === b ? 0 : Infinity;
  };

  it("reproduces fitted models, scores, states and lists", async () => {
    const catalog = new Map<string, TrainingBlock>();
    for await (const b of lines("ORIGINAL-BLOCK-CATALOG.jsonl")) catalog.set(b.block_id, b as TrainingBlock);
    const pools = new Map<string, TrainingBlock[]>();
    for await (const p of lines("TRAINING-POOLS.jsonl")) pools.set(p.pool_id, (p.fixed_catalog_block_ids as string[]).map(id => catalog.get(id)!));
    const savedModels = new Map<string, Saved>();
    for await (const m of lines("MODELS.jsonl")) savedModels.set(`${m.origin.player_id}|${m.origin.snapshot_date}`, m);

    const diffs = { model: 0, value: 0, normalizedGap: 0, baselineNormalizedGap: 0, expectedSupport: 0, supportAdjustment: 0, missingVariance: 0 };
    const mismatches: string[] = [];
    const bySnapshot = new Map<string, { playerId: number; snapshotDate: string; candidate: SupportGapResult }[]>();
    let origins = 0, numeric = 0;
    for await (const r of lines("CANDIDATES.jsonl")) {
      origins++;
      const key = `${r.player_id}|${r.snapshot_date}`, saved = r.candidate, savedModel = savedModels.get(key)!;
      let fitted: ScoringModel | null = null;
      if (savedModel.pool_id && savedModel.beta) {
        const [m, reason] = fitPrior(pools.get(savedModel.pool_id)!, r.player_id, savedModel.pool_id.split("|")[0], savedModel.cutoff);
        if (!m) { mismatches.push(`${key}: fit ${reason}`); continue; }
        diffs.model = Math.max(diffs.model, maxDiff(m.beta, savedModel.beta), maxDiff(m.Cxx, savedModel.Cxx), maxDiff(m.Cxy, savedModel.Cxy),
          maxDiff(m.cohortX, savedModel.cohort_X), maxDiff(m.deltaMin, savedModel.delta_min), maxDiff(m.deltaMax, savedModel.delta_max));
        if (m.rank !== savedModel.rank || m.donors !== savedModel.donors || m.blocks !== savedModel.blocks || m.strata !== savedModel.strata ||
          m.targetBlocksExcluded !== savedModel.target_blocks_excluded || m.priorLastDate !== savedModel.prior_last_date) mismatches.push(`${key}: model counts`);
        fitted = m;
      } else if (savedModel.pool_id) {
        const [m, reason] = fitPrior(pools.get(savedModel.pool_id)!, r.player_id, savedModel.pool_id.split("|")[0], savedModel.pool_id.split("|")[1]);
        if (m || reason !== savedModel.unavailable_reason) mismatches.push(`${key}: expected unavailable fit ${savedModel.unavailable_reason}, got ${reason}`);
      }
      // Rebuild the scorer's reference inputs from the saved modes and deltas.
      const modes: string[] = saved.process?.modes ?? [], delta: number[] = saved.process?.delta ?? [];
      const current: (number | null)[] = saved.current_process;
      const reference = current.map((w, j) => (modes[j] === "measured_current_personal_reference" || modes[j] === "measured_current_estimated_reference" ? (w as number) - delta[j] : null));
      const personal = current.map((_, j) => modes[j] === "measured_current_personal_reference");
      const ours = score(fitted, saved.production_axis, current, reference, personal, saved.fresh_proxy ?? false);
      if (ours.status !== saved.status || (ours.reason ?? null) !== (saved.reason ?? null) || (ours.evidenceTier ?? null) !== (saved.evidence_tier ?? null) ||
        ours.researchList !== saved.research_list || JSON.stringify(ours.physicalFloorIndices ?? null) !== JSON.stringify(saved.physical_floor_indices ?? null) ||
        JSON.stringify(ours.process?.imputedIndices ?? null) !== JSON.stringify(saved.process?.imputed_indices ?? null) ||
        (ours.process?.outsidePriorSpan ?? null) !== (saved.process?.outside_prior_span ?? null) ||
        (ours.process?.outsidePriorComponentRange ?? null) !== (saved.process?.outside_prior_component_range ?? null)) mismatches.push(`${key}: state`);
      if (ours.value !== null) {
        numeric++;
        diffs.value = Math.max(diffs.value, Math.abs(ours.value - saved.value));
        diffs.normalizedGap = Math.max(diffs.normalizedGap, Math.abs(ours.normalizedGap! - saved.normalized_gap));
        diffs.baselineNormalizedGap = Math.max(diffs.baselineNormalizedGap, Math.abs(ours.baselineNormalizedGap! - saved.baseline_normalized_gap));
        diffs.expectedSupport = Math.max(diffs.expectedSupport, maxDiff(ours.expectedSupport, saved.expected_support));
        diffs.supportAdjustment = Math.max(diffs.supportAdjustment, maxDiff(ours.supportAdjustment, saved.support_adjustment));
        diffs.missingVariance = Math.max(diffs.missingVariance, Math.abs(ours.missingProcessNormalizedVariance! - saved.missing_process_normalized_variance));
      } else if (saved.value !== null) mismatches.push(`${key}: value null`);
      const list = bySnapshot.get(r.snapshot_date) ?? [];
      list.push({ playerId: r.player_id, snapshotDate: r.snapshot_date, candidate: ours });
      bySnapshot.set(r.snapshot_date, list);
    }

    const listOrder: Record<string, { BL: boolean; SH: boolean }> = {};
    for (const [date, records] of bySnapshot) {
      const ours = rankTwoLists(records), saved = JSON.parse(readFileSync(join(runDir!, `RANKINGS-${date}.json`), "utf8"));
      const ids = (rows: Saved[]) => rows.map(x => x.player_id ?? x.playerId);
      listOrder[date] = { BL: JSON.stringify(ours.BL.map(x => x.playerId)) === JSON.stringify(ids(saved.BL)), SH: JSON.stringify(ours.SH.map(x => x.playerId)) === JSON.stringify(ids(saved.SH)) };
    }
    const snapshotPath = join(__dirname, "research-snapshots", "2024-04-18.v1.json");
    const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
    const ourLists = rankTwoLists(bySnapshot.get("2024-04-18") ?? []);
    const ourRank = new Map<number, [string, number]>();
    (["BL", "SH"] as const).forEach(side => ourLists[side].forEach((x, i) => ourRank.set(x.playerId, [side, i + 1])));
    let snapshotRankMismatches = 0, snapshotValueDiff = 0;
    for (const p of snapshot.profiles) {
      const mine = ourRank.get(p.playerId);
      if ((mine?.[0] ?? null) !== p.score.list || (mine?.[1] ?? null) !== p.score.rank) snapshotRankMismatches++;
      const ours = bySnapshot.get("2024-04-18")!.find(x => x.playerId === p.playerId)?.candidate.value ?? null;
      if (ours === null || p.score.value === null) { if (ours !== p.score.value) snapshotRankMismatches++; }
      else snapshotValueDiff = Math.max(snapshotValueDiff, Math.abs(ours - p.score.value));
    }

    const receipt = { origins, numeric, mismatches: mismatches.slice(0, 50), mismatchCount: mismatches.length, maxDifferences: diffs, listOrder,
      snapshot: { profiles: snapshot.profiles.length, rankOrListMismatches: snapshotRankMismatches, maxValueDifference: snapshotValueDiff } };
    if (process.env.BLSH_PARITY_RECEIPT) writeFileSync(process.env.BLSH_PARITY_RECEIPT, `${JSON.stringify(receipt, null, 2)}\n`);
    expect(origins).toBe(2772);
    expect(mismatches).toEqual([]);
    Object.values(diffs).forEach(d => expect(d).toBeLessThanOrEqual(1e-9));
    Object.values(listOrder).forEach(o => expect(o).toEqual({ BL: true, SH: true }));
    expect(snapshotRankMismatches).toBe(0);
    expect(snapshotValueDiff).toBeLessThanOrEqual(1e-9);
  }, 900_000);
});

/** Explanation layer v3: reads a finished score and never changes it. Regressions cover both independent reviews. */
const prov = (provider: string, field: string, revision: string | null = "r1") => ({ provider, field, revision });
const allScopes = { goals: "all_situations", assists: "all_situations", shots: "all_situations", ixG: "all_situations", onIceGoals: "all_situations", onIceXG: "all_situations" } as const;
const allProvenance = { goals: prov("wgo", "goals"), assists: prov("wgo", "assists"), shots: prov("wgo", "shots"), ixG: prov("nst", "ixg"), onIceGoals: prov("wgo", "on_ice_gf"), onIceXG: prov("nst", "oi_xgf") };
const CURRENT_IDS = [1, 2, 3, 4, 5], REFERENCE_IDS = [101, 102, 103, 104, 105, 106, 107, 108, 109, 110];
const window_ = (o: Partial<WindowEvidence> = {}): WindowEvidence => ({
  identity: { playerId: 7, sourceIds: CURRENT_IDS }, appearances: 5, seconds: 3600, esSeconds: 3000, ppSeconds: 400,
  goals: 1, assists: 1, shots: 12, ixG: 1.6, onIceGF: 5, onIceXGF: 3.5, scopes: { ...allScopes }, provenance: { ...allProvenance }, ...o,
});
const refWindow = (o: Partial<WindowEvidence> = {}) => window_({ identity: { playerId: 7, sourceIds: REFERENCE_IDS }, appearances: 10, seconds: 8000, esSeconds: 6600, ppSeconds: 1000,
  goals: 2, assists: 3, shots: 20, ixG: 2.5, onIceGF: 9, onIceXGF: 8, ...o });
const idProduction = (o: Partial<ProductionAxis> = {}): ProductionAxis => ({ ...production(), player_id: 7, current_source_ids: CURRENT_IDS, reference_source_ids: REFERENCE_IDS, ...o });
const attributed = (o: { m?: ScoringModel; p?: ProductionAxis; w?: (number | null)[]; h?: (number | null)[]; personal?: boolean[]; fresh?: boolean } = {}) =>
  scoreAndAttribute(o.m ?? model(), o.p ?? idProduction(), o.w ?? [1.5, 2, 3], o.h ?? [1, 2, 3], o.personal ?? [true, true, true], o.fresh ?? true);
const explain = (s = attributed(), o: Partial<ExplanationContext> = {}) =>
  explainSupportGap(s, { current: window_(), reference: refWindow(), ...o });
const signalOf = (e: SupportGapExplanation, metric: string) => e.context.find(x => x.metric === metric)!;
const reasons = (e: SupportGapExplanation) => e.coverage.map(n => n.reason);

describe("supportGap explanation: score decomposition", () => {
  it("splits each track gap into components that add back exactly, and tracks into the score", () => {
    for (const s of [attributed(), attributed({ w: [null, 2.5, 3] }), attributed({ h: [null, null, null], personal: [false, false, false] }), attributed({ w: [0, 0, 0], h: [30, 10, 10] })]) {
      const e = explain(s, { current: null, reference: null });
      expect(e.tracks.map(t => t.track)).toEqual(["fantasy_points", "goals_plus_assists", "wigo_game_score"]);
      e.tracks.forEach((t, i) => {
        expect(Math.abs(t.reconciliationResidual)).toBeLessThanOrEqual(1e-12 * Math.max(1, Math.abs(t.gap)));
        expect(t.gap).toBeCloseTo(s.expectedSupport![i] - s.rawActual![i], 12);
      });
      expect(Math.abs(e.normalizedReconciliationResidual!)).toBeLessThanOrEqual(1e-12);
      expect(e.baselineNormalizedGap).toBeCloseTo(e.tracks.reduce((x, t) => x + t.baselineNormalizedContribution, 0), 12);
    }
  });
  it("leaves scores from scoreAndAttribute identical to the frozen score", () => {
    expect(attributed({ p: production(), w: [null, 2.5, 3] })).toEqual(evaluate({ w: [null, 2.5, 3] }));
  });
  it("uses beta[process][track] with a non-symmetric model", () => {
    const m = { ...model(), beta: [[1, 2, 3], [4, 5, 6], [7, 8, 9]] };
    const e = explain(attributed({ m, w: [2, 2.5, 2] }), { current: null, reference: null });
    const gs = e.tracks[2].components;
    expect(gs.find(c => c.id === "process:individual_xG60")!.value).toBeCloseTo(3, 12);
    expect(gs.find(c => c.id === "process:shared_onice_xGF60")!.value).toBeCloseTo(3, 12);
    expect(gs.find(c => c.id === "process:shared_onice_xGA60")!.value).toBeCloseTo(-9, 12);
    expect(e.tracks[0].components.find(c => c.id === "process:shared_onice_xGA60")!.value).toBeCloseTo(-7, 12);
  });
  it("tags reference, model, imputed, cohort and floor components separately", () => {
    const fp = explain(attributed({ w: [null, 2.5, 3] })).tracks[0].components;
    expect(fp[0]).toMatchObject({ id: "production_vs_reference", kind: "reference_gap" });
    expect(fp[0].note).toContain("Power-play share, role and linemates are not modelled separately");
    expect(fp.find(c => c.id === "process:individual_xG60")).toMatchObject({ kind: "imputed_estimate", referenceKind: "imputed_current" });
    expect(fp.find(c => c.id === "process:shared_onice_xGF60")).toMatchObject({ kind: "model_sensitivity", referenceKind: "personal" });
    const cohort = explain(attributed({ p: { ...idProduction(), personal_n: 0 }, h: [null, null, null], personal: [false, false, false] }));
    expect(cohort.tracks[0].components.slice(1, 4).every(c => c.referenceKind === "cohort")).toBe(true);
    expect(cohort.tracks[0].components[0].note).toContain("No personal production history");
    const floored = explain(attributed({ w: [0, 0, 0], h: [30, 10, 10] }));
    expect(floored.tracks[0].components.at(-1)).toMatchObject({ id: "physical_floor", kind: "floor_adjustment" });
    expect(floored.tracks[2].components.some(c => c.id === "physical_floor")).toBe(false);
    expect(floored.tracks[2].expectedSupport).toBeLessThan(0);
  });
  it("separates the gap sign from research-list membership", () => {
    expect(explain()).toMatchObject({ gapSign: "buy_low_evidence", researchList: "BL" });
    expect(explain(attributed({ fresh: false }))).toMatchObject({ gapSign: "buy_low_evidence", researchList: null });
  });
  it("does not change the score it explains", () => {
    const s = attributed({ w: [null, 2.5, 3] }), before = structuredClone(s);
    explain(s);
    expect(s).toEqual(before);
  });
});

describe("supportGap explanation: review finding 4, attribution bound to the scoring model", () => {
  it("refuses a result that was not scored with attribution", () => {
    const e = explain(evaluate());
    expect(e.tracks).toEqual([]);
    expect(reasons(e)).toContain("explanation_attribution_missing");
  });
  it("attributes cancelling coefficient changes to the model that actually scored", () => {
    const a = { ...model(), beta: [[0.5, 0, 0], [0, 0.5, 0], [0, 0, 0.5]] }, b = { ...model(), beta: [[1, 0, 0], [-0.5, 0.5, 0], [0, 0, 0.5]] };
    const sa = attributed({ m: a, w: [2, 3, 3] }), sb = attributed({ m: b, w: [2, 3, 3] });
    expect(sa.supportAdjustment).toEqual(sb.supportAdjustment);
    const comps = (s: SupportGapResult) => explain(s).tracks[0].components.slice(1, 4).map(c => c.value);
    expect(comps(sa)).toEqual([0.5, 0, 0]);
    expect(comps(sb)).toEqual([1, -0.5, 0]);
  });
  it("labels terms with the scoring model's own feature names and freezes the record", () => {
    const m = { ...model(), featureNames: ["shared_onice_xGA60", "shared_onice_xGF60", "individual_xG60"] };
    const s = attributed({ m });
    expect(explain(s).tracks[0].components.slice(1, 4).map(c => c.id)).toEqual(["process:shared_onice_xGA60", "process:shared_onice_xGF60", "process:individual_xG60"]);
    const record = attributionOf(s)!;
    expect(Object.isFrozen(record) && Object.isFrozen(record.beta[0]) && Object.isFrozen(record.contributions)).toBe(true);
  });
  it("rejects invalid model coefficients before any arithmetic", () => {
    expect(() => attributed({ m: { ...model(), beta: [[NaN, 0, 0], [0, 0.5, 0], [0, 0, 0.5]] } })).toThrow("Invalid coefficient matrix");
  });
});

describe("supportGap explanation: review finding 1, window identity", () => {
  it("accepts context only for the scored player and games", () => {
    const ok = explain();
    expect(signalOf(ok, "shots_per_60").status).toBe("available");
    const other = explain(attributed(), { current: window_({ identity: { playerId: 8, sourceIds: CURRENT_IDS } }) });
    expect(reasons(other)).toContain("context_identity_differs_from_scored_window");
    const games = explain(attributed(), { current: window_({ identity: { playerId: 7, sourceIds: [1, 2, 3, 4, 6] } }) });
    expect(reasons(games)).toContain("context_identity_differs_from_scored_window");
    expect(games.context.every(x => x.current === null)).toBe(true);
  });
  it("withholds context with missing identities", () => {
    expect(reasons(explain(attributed(), { current: window_({ identity: null }) }))).toContain("window_identity_missing");
    expect(reasons(explain(attributed({ p: production() })))).toEqual(expect.arrayContaining(["scored_identity_not_recorded"]));
  });
  it("withholds context whose outcomes disagree with the scored totals", () => {
    const e = explain(attributed(), { current: window_({ goals: 7, assists: 10 }) });
    expect(reasons(e)).toContain("context_outcomes_disagree_with_scored_totals");
    expect(signalOf(e, "goals_minus_individual_xG_per_60").current).toBeNull();
  });
  it("withholds context when the scored production axis names different games", () => {
    const s = attributed({ p: { ...idProduction(), current_source_ids: [9, 9, 9, 9, 9] } });
    expect(reasons(explain(s))).toContain("context_identity_differs_from_scored_window");
  });
  it("checks the reference window's identity separately", () => {
    const e = explain(attributed(), { reference: refWindow({ identity: { playerId: 7, sourceIds: [101, 102] } }) });
    expect(reasons(e)).toContain("context_identity_differs_from_scored_reference");
    expect(signalOf(e, "shots_per_60")).toMatchObject({ status: "available", reference: null, delta: null });
  });
  it("withholds context whose seconds or appearance count differ from the scored window", () => {
    expect(reasons(explain(attributed(), { current: window_({ seconds: 5400 }) }))).toContain("context_window_mismatch_with_scored_window");
    expect(reasons(explain(attributed({ p: { ...idProduction(), current_recorded_slots: 4 } })))).toContain("context_window_mismatch_with_scored_window");
  });
});

describe("supportGap explanation: review finding 2, exposure matches scope", () => {
  const pp = { ...allScopes, goals: "power_play", ixG: "power_play" } as const;
  it("uses PP seconds for PP-scoped finishing, including the spread", () => {
    const e = explain(attributed(), { current: window_({ goals: 2, assists: 0, ixG: 1, ppSeconds: 600, scopes: pp }) });
    const f = signalOf(e, "goals_minus_individual_xG_per_60");
    expect(f.current).toBeCloseTo(6, 12);
    expect(f.scale!.value).toBeCloseTo(6, 12);
  });
  it("uses ES seconds for ES-scoped shots", () => {
    const e = explain(attributed(), { current: window_({ shots: 10, esSeconds: 3000, scopes: { ...allScopes, shots: "even_strength" } }) });
    expect(signalOf(e, "shots_per_60").current).toBeCloseTo(12, 12);
  });
  it("withholds rates with a missing, zero or unknown denominator", () => {
    const missing = explain(attributed(), { current: window_({ goals: 2, assists: 0, ppSeconds: null, scopes: pp }) });
    expect(signalOf(missing, "goals_minus_individual_xG_per_60").reason).toBe("power_play_TOI_missing");
    const zero = explain(attributed(), { current: window_({ goals: 2, assists: 0, ppSeconds: 0, scopes: pp }) });
    expect(signalOf(zero, "goals_minus_individual_xG_per_60").reason).toBe("no_power_play_ice_time");
    const unknown = explain(attributed(), { current: window_({ scopes: { ...allScopes, shots: "unknown" } }) });
    expect(signalOf(unknown, "shots_per_60").reason).toBe("unknown_scope_no_exposure");
  });
});

describe("supportGap explanation: review finding 3, scope and source compatibility", () => {
  it("withholds a delta across different scopes", () => {
    const e = explain(attributed(), { current: window_({ goals: 2, assists: 0, ppSeconds: 600, scopes: { ...allScopes, goals: "power_play", ixG: "power_play" } }) });
    expect(signalOf(e, "goals_minus_individual_xG_per_60")).toMatchObject({ status: "available", delta: null, deltaReason: "current_reference_scope_mismatch" });
    expect(e.coverage).toContainEqual({ component: "delta:goals_minus_individual_xG_per_60", state: "unavailable", reason: "current_reference_scope_mismatch" });
  });
  it("withholds a delta across different providers or a known revision change", () => {
    const source = explain(attributed(), { reference: refWindow({ provenance: { ...allProvenance, ixG: prov("other", "ixg") } }) });
    expect(signalOf(source, "goals_minus_individual_xG_per_60").deltaReason).toBe("current_reference_source_mismatch");
    const revision = explain(attributed(), { reference: refWindow({ provenance: { ...allProvenance, ixG: prov("nst", "ixg", "r2") } }) });
    expect(signalOf(revision, "goals_minus_individual_xG_per_60").deltaReason).toBe("current_reference_revision_mismatch");
  });
  it("flags an unknown revision as unverified and withholds unknown provenance", () => {
    const unverified = explain(attributed(), { reference: refWindow({ provenance: { ...allProvenance, shots: prov("wgo", "shots", null) } }) });
    expect(signalOf(unverified, "shots_per_60")).toMatchObject({ revisionVerified: false });
    expect(signalOf(unverified, "shots_per_60").delta).not.toBeNull();
    expect(unverified.coverage).toContainEqual({ component: "delta:shots_per_60", state: "partial", reason: "provider_revision_unverified" });
    expect(signalOf(explain(), "shots_per_60").revisionVerified).toBe(true);
    const unknown = explain(attributed(), { current: window_({ provenance: { ...allProvenance, ixG: null } }) });
    expect(signalOf(unknown, "goals_minus_individual_xG_per_60")).toMatchObject({ status: "unavailable", reason: "provenance_unknown" });
  });
});

describe("supportGap explanation: review finding 5, invalid numbers", () => {
  it("rejects a non-finite or invalid exposure and withholds the window", () => {
    for (const bad of [{ seconds: NaN }, { seconds: Infinity }, { seconds: -1 }, { appearances: 2.5 }]) {
      const e = explain(attributed(), { current: window_(bad) });
      expect(reasons(e)).toEqual(expect.arrayContaining(["current_window_invalid"]));
      expect(e.context.every(x => x.current === null && x.status === "unavailable")).toBe(true);
    }
  });
  it("rejects non-finite or negative counts with a reason, never a number", () => {
    const inf = explain(attributed(), { current: window_({ goals: Infinity }) });
    expect(inf.coverage).toContainEqual({ component: "current_window", state: "unavailable", reason: "invalid_goals" });
    expect(signalOf(inf, "goals_minus_individual_xG_per_60")).toMatchObject({ status: "unavailable", current: null });
    const negative = explain(attributed(), { current: window_({ assists: -1 }) });
    expect(negative.coverage).toContainEqual({ component: "current_window", state: "unavailable", reason: "invalid_assists" });
    expect(signalOf(negative, "assists_per_teammate_on_ice_goal")).toMatchObject({ status: "unavailable", current: null });
    expect(JSON.stringify(explain(attributed(), { current: window_({ shots: NaN }) }))).not.toContain("NaN");
  });
});

describe("supportGap explanation: independent re-review of v3", () => {
  it("reads the scored identity from the production axis, not from the caller's context", () => {
    const s = attributed();
    const moved = { identity: { playerId: 7, sourceIds: [11, 12, 13, 14, 15] } };
    const e = explain(s, { current: window_(moved), reference: refWindow({ identity: { playerId: 7, sourceIds: [111, 112, 113, 114, 115, 116, 117, 118, 119, 120] } }) });
    expect(reasons(e)).toEqual(expect.arrayContaining(["context_identity_differs_from_scored_window", "context_identity_differs_from_scored_reference"]));
    expect(e.scoreWindow).toMatchObject({ identity: { playerId: 7, currentSourceIds: CURRENT_IDS }, currentContextVerified: false, referenceContextVerified: false });
    expect(explain().scoreWindow).toMatchObject({ currentContextVerified: true, referenceContextVerified: true });
  });
  it("treats a known revision on one side and another known revision on the other as a mismatch, including mixed windows", () => {
    const overlay = { ...allProvenance, onIceGoals: prov("wgo", "on_ice_gf", "official_receipt_overlay") };
    const raw = { ...allProvenance, onIceGoals: prov("wgo", "on_ice_gf", "wgo_raw") };
    const mixed = { ...allProvenance, onIceGoals: prov("wgo", "on_ice_gf", "mixed:official_receipt_overlay+wgo_raw") };
    for (const [cur, ref] of [[overlay, raw], [mixed, raw]]) {
      const e = explain(attributed(), { current: window_({ provenance: cur }), reference: refWindow({ provenance: ref }) });
      expect(signalOf(e, "on_ice_goals_minus_xGF_per_60")).toMatchObject({ delta: null, deltaReason: "current_reference_revision_mismatch" });
    }
  });
  it("states an unknown or unusable personal history instead of 'no history'", () => {
    const unknown = explain(attributed({ p: idProduction({ personal_n: undefined }) }));
    expect(unknown.tracks[0].components[0].note).toContain("not recorded");
    const unusable = explain(attributed({ p: idProduction({ personal_n: 0, personal_reason: "missing_measurement_or_exposure" }) }));
    expect(unusable.tracks[0].components[0].note).toContain("exists but was not usable (missing_measurement_or_exposure)");
  });
  it("checks goals and assists separately against the scored split and total", () => {
    const split = attributed({ p: idProduction({ current_goals: 1, current_assists: 1 }) });
    expect(reasons(explain(split, { current: window_({ goals: 2, assists: 0 }) }))).toContain("context_outcomes_disagree_with_scored_totals");
    const ppGoals = { ...allScopes, goals: "power_play" } as const;
    expect(reasons(explain(attributed(), { current: window_({ goals: 0, assists: 10, scopes: ppGoals }) }))).toContain("context_outcomes_disagree_with_scored_totals");
    expect(explain(split).scoreWindow.currentContextVerified).toBe(true);
  });
  it("freezes the scored result so modes, deltas and exposure cannot be relabelled", () => {
    const s = attributed({ w: [null, 2.5, 3] });
    expect(Object.isFrozen(s) && Object.isFrozen(s.process!.modes) && Object.isFrozen(s.productionAxis)).toBe(true);
    expect(() => { (s.process!.modes as string[])[0] = "measured_current_personal_reference"; }).toThrow(TypeError);
    expect(attributionOf(s)!.model.cohortX).toEqual([1, 2, 3]);
  });
  it("rejects ES + PP seconds above the total and notes an undefined spread at zero xG", () => {
    expect(reasons(explain(attributed(), { current: window_({ esSeconds: 3300, ppSeconds: 400 }) }))).toEqual(expect.arrayContaining(["exposure_components_exceed_total", "current_window_invalid"]));
    const zero = explain(attributed(), { current: window_({ ixG: 0 }) });
    expect(zero.coverage).toContainEqual({ component: "goals_minus_individual_xG_per_60", state: "partial", reason: "spread_undefined_zero_xG" });
  });
});

describe("supportGap explanation: Codex re-review of v3.1", () => {
  it("withholds on-ice deltas between opposite mixed compositions that share one label", () => {
    const label = "mixed:official_receipt_overlay+wgo_raw";
    const mixed = (games: string[]) => ({ ...allProvenance, onIceGoals: { ...prov("wgo", "on_ice_gf", label), gameRevisions: games } });
    const e = explain(attributed(), {
      current: window_({ provenance: mixed(["official_receipt_overlay", "wgo_raw", "wgo_raw", "wgo_raw", "wgo_raw"]) }),
      reference: refWindow({ provenance: mixed(["official_receipt_overlay", "official_receipt_overlay", "official_receipt_overlay", "official_receipt_overlay", "wgo_raw",
        "official_receipt_overlay", "official_receipt_overlay", "official_receipt_overlay", "official_receipt_overlay", "wgo_raw"]) }),
    });
    expect(signalOf(e, "on_ice_goals_minus_xGF_per_60")).toMatchObject({ status: "available", delta: null, deltaReason: "current_reference_mixed_revision_composition", revisionVerified: null });
    expect(e.coverage).toContainEqual({ component: "delta:on_ice_goals_minus_xGF_per_60", state: "unavailable", reason: "current_reference_mixed_revision_composition" });
    // Per-game revisions alone mark a window as mixed, whatever its label says.
    const relabelled = explain(attributed(), { current: window_({ provenance: { ...allProvenance, onIceGoals: { ...prov("wgo", "on_ice_gf"), gameRevisions: ["r1", "r1", "r2", "r1", "r1"] } } }) });
    expect(signalOf(relabelled, "on_ice_goals_minus_xGF_per_60").deltaReason).toBe("current_reference_mixed_revision_composition");
    expect(signalOf(explain(), "on_ice_goals_minus_xGF_per_60").delta).not.toBeNull();
  });
  it("checks PP seconds against the total when ES seconds are missing, and ES when PP are missing", () => {
    const pp = { ...allScopes, goals: "power_play", ixG: "power_play" } as const;
    for (const bad of [{ esSeconds: null, ppSeconds: 7200, scopes: pp }, { esSeconds: 7200, ppSeconds: null }]) {
      for (const side of ["current", "reference"] as const) {
        const e = explain(attributed(), side === "current" ? { current: window_(bad) } : { reference: refWindow({ ...bad, ppSeconds: bad.ppSeconds && 9000, esSeconds: bad.esSeconds && 9000 }) });
        expect(e.coverage).toContainEqual({ component: `${side}_window`, state: "unavailable", reason: "exposure_components_exceed_total" });
        expect(reasons(e)).toContain(`${side}_window_invalid`);
        expect(e.scoreWindow[side === "current" ? "currentContextVerified" : "referenceContextVerified"]).toBe(false);
        const values = [...e.opportunity, ...e.context].map(x => x[side]);
        expect(values.every(v => v === null)).toBe(true);
      }
    }
    // A known part within the total is still accepted when the other part is missing.
    expect(explain(attributed(), { current: window_({ esSeconds: null, ppSeconds: 600, scopes: pp, goals: 2, assists: 0, ixG: 1 }) }).scoreWindow.currentContextVerified).toBe(true);
  });
});

describe("supportGap explanation: context arithmetic and coverage", () => {
  it("reports finishing per 60 as provider-model-relative, with a same-unit spread only when available", () => {
    const e = explain(attributed(), { current: window_({ goals: 1, assists: 1, ixG: 1.2 }) });
    const f = signalOf(e, "goals_minus_individual_xG_per_60");
    expect(f).toMatchObject({ kind: "provider_model_relative", interpretation: "hypothesis", scoreInput: false, status: "available" });
    expect(f.current).toBeCloseTo(-0.2, 12);
    expect(f.scale!.value).toBeCloseTo(Math.sqrt(1.2), 12);
    e.context.forEach(x => { expect(x.scoreInput).toBe(false); expect(x.hypotheses.length).toBeGreaterThanOrEqual(2); });
    expect(e.claims).toEqual({ luckIdentified: false, marketValue: false, forecast: false, trusted: false });
    expect(signalOf(explain(attributed(), { current: window_({ ixG: null }) }), "goals_minus_individual_xG_per_60").scale).toBeUndefined();
  });
  it("defines assists per teammate on-ice goal and flags contradictions", () => {
    expect(signalOf(explain(), "assists_per_teammate_on_ice_goal").current).toBeCloseTo(1 / 4, 12);
    const p0 = { ...idProduction(), raw_observed: [8, 0, 0] };
    expect(signalOf(explain(attributed({ p: p0 }), { current: window_({ goals: 0, assists: 0, onIceGF: 0 }) }), "assists_per_teammate_on_ice_goal").reason).toBe("no_teammate_on_ice_goals_ratio_undefined");
    expect(signalOf(explain(attributed(), { current: window_({ goals: 0, assists: 2, onIceGF: 1 }) }), "assists_per_teammate_on_ice_goal").reason).toBe("assists_exceed_teammate_on_ice_goals_data_conflict");
  });
  it("keeps genuine zeros and records missing reference values as coverage", () => {
    const zero = explain(attributed({ p: { ...idProduction(), raw_observed: [8, 0, 0] } }), { current: window_({ shots: 0, ixG: 0, goals: 0, assists: 0, ppSeconds: 0 }) });
    expect(signalOf(zero, "goals_minus_individual_xG_per_60")).toMatchObject({ status: "available", current: 0 });
    expect(signalOf(zero, "shots_per_60").current).toBe(0);
    expect(zero.opportunity.find(x => x.metric === "PP_TOI_per_game")).toMatchObject({ status: "available", current: 0 });
    const ref = explain(attributed(), { reference: refWindow({ ixG: null }) });
    expect(ref.coverage).toContainEqual({ component: "reference:goals_minus_individual_xG_per_60", state: "unavailable", reason: "goals_or_individual_xG_missing" });
  });
  it("keeps unavailable scores unexplained but still reports context and deduplicated coverage", () => {
    const note = { component: "reference_window_context", state: "unavailable" as const, reason: "reference_window_not_supplied" };
    const e = explainSupportGap(attributed({ w: [null, null, null] }), { current: window_(), reference: null, coverage: [note] });
    expect(e.tracks).toEqual([]);
    expect(e).toMatchObject({ value: null, gapSign: null, researchList: null });
    expect(e.coverage.filter(n => n.reason === "reference_window_not_supplied")).toHaveLength(1);
    expect(signalOf(e, "shots_per_60").status).toBe("available");
  });
});

/** Opt-in: every saved numeric v1 origin, rescored with its saved model, must reconcile exactly.
 * Context windows are null here, so this checks arithmetic only; real-window checks live in the dry run. */
describe.skipIf(!runDir || !existsSync(join(runDir, "MODELS.jsonl")))("supportGap explanation reconciles on the frozen v1 run", () => {
  it("adds every component back to the gap and every track back to the score for all numeric origins", async () => {
    const read = async function* (file: string) {
      for await (const line of createInterface({ input: createReadStream(join(runDir!, file)), crlfDelay: Infinity })) if (line.trim()) yield JSON.parse(line);
    };
    const models = new Map<string, ScoringModel>();
    for await (const m of read("MODELS.jsonl")) if (m.beta) models.set(`${m.origin.player_id}|${m.origin.snapshot_date}`,
      { featureNames: m.feature_names, beta: m.beta, Cxx: m.Cxx, cohortX: m.cohort_X, rank: m.rank, deltaMin: m.delta_min, deltaMax: m.delta_max, donors: m.donors });
    let explained = 0, worst = 0, worstNormalized = 0;
    for await (const r of read("CANDIDATES.jsonl")) {
      const saved = r.candidate, m = models.get(`${r.player_id}|${r.snapshot_date}`) ?? null;
      const modes: string[] = saved.process?.modes ?? [], delta: number[] = saved.process?.delta ?? [], current: (number | null)[] = saved.current_process;
      const reference = current.map((w, j) => (modes[j] === "measured_current_personal_reference" || modes[j] === "measured_current_estimated_reference" ? (w as number) - delta[j] : null));
      const s = scoreAndAttribute(m, saved.production_axis, current, reference, current.map((_, j) => modes[j] === "measured_current_personal_reference"), saved.fresh_proxy ?? false);
      const e = explainSupportGap(s, { current: null, reference: null });
      if (s.value === null) { expect(e.tracks).toEqual([]); continue; }
      explained++;
      e.tracks.forEach(t => { worst = Math.max(worst, Math.abs(t.reconciliationResidual) / Math.max(1, Math.abs(t.gap))); });
      worstNormalized = Math.max(worstNormalized, Math.abs(e.normalizedReconciliationResidual!));
    }
    expect(explained).toBe(2414);
    expect(worst).toBeLessThanOrEqual(1e-9);
    expect(worstNormalized).toBeLessThanOrEqual(1e-9);
  }, 600_000);
});
