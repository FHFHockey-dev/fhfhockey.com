// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { Slot } from "./currentWindows";
import { COMPOSITE, DEFAULT_CONFIG, ForecastDeadlineExceeded, PRIMARY_ARMS, armMetrics, buildOrigins, compositeWeights, contrast, everyFifthEligible, fitGamma, priorSeasonMean, publishBeforeDeadline, runForecastComparison, type OriginRecord } from "./forecastEvaluation";
import type { TrainingBlock } from "./supportGap";

const day = (start: string, n: number) => new Date(Date.parse(`${start}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const config = { ...DEFAULT_CONFIG, bootstrap: 200 };
/** Deterministic synthetic slot: production and process vary by player and game so fits are well posed. */
function slot(pid: number, season: number, date: string, i: number, o: Partial<Slot> = {}): Slot {
  const g = (i * 7 + pid * 3) % 11, seconds = 900 + 15 * ((i + pid) % 9);
  const goals = g % 5 === 0 ? 1 : 0, assists = g % 3 === 0 ? 1 : 0;
  return { id: pid * 100000 + season % 10000 * 100 + i, playerId: pid, season, date, source: "development", position: pid <= 6 ? "F" : "D", team: "AAA",
    gamesPlayed: 1, seconds, esSeconds: seconds - 120, ppSeconds: 120,
    tracks: [3 * goals + 2 * assists + 0.2 * (g % 4) + 0.1 * (pid % 3), goals + assists, 0.75 * goals + 0.6 * assists + 0.05 * g - 0.2],
    goals, assists, shots: g % 4, ixG: 0.05 + 0.02 * ((i + pid) % 6), onIceXGF: 0.5 + 0.05 * (g % 5), onIceXGA: 0.45 + 0.04 * ((i * pid) % 5), onIceGF: goals + assists,
    reasons: [], onIceGoalsRevision: "wgo_raw", ...o };
}
function data(edit: (s: Slot) => Slot = s => s): Map<number, Slot[]> {
  const byPlayer = new Map<number, Slot[]>();
  for (let pid = 1; pid <= 10; pid++) {
    const rows = [...Array.from({ length: 82 }, (_, i) => slot(pid, 20222023, day("2022-10-10", i), i)), ...Array.from({ length: 40 }, (_, i) => slot(pid, 20232024, day("2023-10-10", i), 82 + i))];
    byPlayer.set(pid, rows.map(edit));
  }
  return byPlayer;
}
function blocks(): TrainingBlock[] {
  const x = [[1, 2, 3], [2, 1, 3], [3, 2, 2], [1, 4, 1], [2, 2, 4], [4, 3, 2]], coefficient = [[1, 0.2, 0.1], [0.3, 0.1, 0.2], [0.1, 0.05, -0.1]];
  return (["F", "D"] as const).flatMap(position => [11, 12].map(pid => (position === "F" ? pid : pid + 10))).flatMap(pid => x.map((row, k) => ({
    player_id: pid, position: pid < 20 ? "F" : "D", season_id: 20222023, source_ids: [0, 1, 2, 3, 4].map(j => pid * 1000 + 5 * k + j),
    dates: [0, 1, 2, 3, 4].map(j => day("2022-07-01", 5 * k + j)), seconds: 5000 + 100 * k, X: row,
    Y: [0, 1, 2].map(c => row.reduce((s, v, i) => s + v * coefficient[i][c], 0) + pid), qualified_process_exposure: true,
    teams: Array(5).fill("AAA"), positions: Array(5).fill(pid < 20 ? "F" : "D") })));
}
const run = (d = data()) => runForecastComparison(d, blocks(), config);
const origin = (playerId: number, originSourceId: number, i: number, targets: [number, number, number] = [0, 0, 0]) =>
  ({ playerId, originSourceId, windowDates: [day("2023-10-10", i - 4), day("2023-10-10", i)], targetDates: [day("2023-10-10", i + 1), day("2023-10-10", i + 5)], targets }) as OriginRecord;

describe("forecastEvaluation", () => {
  it("defines P0 as the frozen last-50 previous-season mean, with no missing-score compression", () => {
    const rows = data().get(1)!;
    const p0 = priorSeasonMean(rows, 20232024)!;
    const last = rows.filter(s => s.season === 20222023).slice(-50);
    expect(p0.mean[0]).toBeCloseTo(last.reduce((s, x) => s + (x.tracks[0] as number), 0) / 50, 12);
    const broken = rows.map((s, i) => (i === 70 ? { ...s, tracks: [s.tracks[0], null, s.tracks[2]] } : s));
    expect(priorSeasonMean(broken, 20232024)).toBeNull();
  });
  it("excludes training origins before production donors exist, without look-ahead", async () => {
    const { origins, funnel } = await buildOrigins(data(), blocks(), 20222023, "training", config);
    expect(funnel["production_reference_unestimable:fewer_than_two_qualified_donors"]).toBeGreaterThan(0);
    // A donor needs 50 complete games strictly before the window, i.e. windows from the 51st game date on.
    expect(origins.every(o => o.windowDates[0] > day("2022-10-10", 49))).toBe(true);
    expect(origins.length).toBeGreaterThan(0);
  });
  it("records censoring and boundary reasons", async () => {
    const gap = data(s => (s.playerId === 1 && s.season === 20232024 && s.date >= "2023-11-01" ? { ...s, date: day(s.date, 40) } : s));
    expect((await buildOrigins(gap, blocks(), 20232024, "evaluation", config)).funnel.gap_over_30_days_or_known_team_change).toBeGreaterThan(0);
    const trade = data(s => (s.playerId === 2 && s.season === 20232024 && s.date >= "2023-10-25" ? { ...s, team: "BBB" } : s));
    expect((await buildOrigins(trade, blocks(), 20232024, "evaluation", config)).funnel.gap_over_30_days_or_known_team_change).toBeGreaterThan(0);
    const { funnel } = await buildOrigins(data(), blocks(), 20232024, "evaluation", config);
    expect(funnel.fewer_than_five_future_appearances_in_season).toBe(10 * 5);
    expect(funnel.fewer_than_five_window_appearances_in_season).toBe(10 * 4);
  });
  it("gives every primary arm a prediction for all three tracks on the identical origin set", async () => {
    const r = await run();
    expect(r.primary.origins).toBeGreaterThan(0);
    for (const o of r.origins) for (const arm of PRIMARY_ARMS) expect(o.predictions[arm]?.every(Number.isFinite)).toBe(true);
    expect(r.primary.metrics.P0.map(m => m.n)).toEqual(r.primary.metrics.P2.map(m => m.n));
  });
  it("uses only information dated before the first target game", async () => {
    const base = await run();
    const o = base.origins[Math.floor(base.origins.length / 2)];
    const changed = await run(data(s => (s.season === 20232024 && s.date >= o.targetDates[0]
      ? { ...s, tracks: s.tracks.map(v => (v as number) * 3 + 1), seconds: (s.seconds as number) + 300, ixG: 2, onIceXGF: 3, onIceXGA: 0.1 } : s)));
    const same = changed.origins.find(x => x.playerId === o.playerId && x.originSourceId === o.originSourceId)!;
    expect(same.predictions).toEqual(o.predictions);
    expect(same.targets).not.toEqual(o.targets);
  });
  it("fits gamma on training-season origins only", async () => {
    const base = await run();
    const changed = await run(data(s => (s.season === 20232024 ? { ...s, tracks: s.tracks.map(v => (v as number) + 5) } : s)));
    expect(changed.gamma).toEqual(base.gamma);
    expect(fitGamma([]).reason).toBe("fewer_than_two_training_players");
  });
  it("computes each arm in the declared units", async () => {
    const r = await run(), o = r.origins[0], g = r.gamma[o.position].gamma!;
    o.referenceRate.forEach((rate, t) => expect(o.predictions.P1![t]).toBeCloseTo(rate * o.tau, 12));
    o.referenceRate.forEach((rate, t) => {
      const v = (rate + (o.deltaX[0] * g[0][t] + o.deltaX[1] * g[1][t] + o.deltaX[2] * g[2][t]) / 3600) * o.tau;
      expect(o.predictions.P2![t]).toBeCloseTo(t < 2 ? Math.max(0, v) : v, 12);
    });
    expect(o.per60.P1![0]).toBeCloseTo(o.referenceRate[0] * 3600, 12);
    expect(o.targetPer60[1]).toBeCloseTo((3600 * o.targets[1]) / o.tauTarget, 12);
    for (const x of r.origins) for (const arm of ["P2", "P2_transfer", "P2_unshrunk"] as const) expect(x.predictions[arm]!.slice(0, 2).every(v => v >= 0)).toBe(true);
  });
  it("clusters the bootstrap by player and is deterministic for a seed", async () => {
    const r = await run();
    const a = contrast(r.origins, "P2", "P0", 0, o => String(o.playerId), config)!, b = contrast(r.origins, "P2", "P0", 0, o => String(o.playerId), config)!;
    expect(a).toEqual(b);
    expect(a.clusters).toBe(new Set(r.origins.map(o => o.playerId)).size);
    expect(a.maeDiffCI[0]).toBeLessThanOrEqual(a.maeDiff);
    expect(a.maeDiffCI[1]).toBeGreaterThanOrEqual(a.maeDiff);
  });
  it("keeps non-overlapping targets within each player in the sensitivity schedule", async () => {
    const sparse = everyFifthEligible((await run()).origins);
    const byPlayer = new Map<number, OriginRecord[]>();
    sparse.forEach(o => byPlayer.set(o.playerId, [...(byPlayer.get(o.playerId) ?? []), o]));
    byPlayer.forEach(list => list.forEach((o, i) => { if (i) expect(o.targetDates[0] > list[i - 1].targetDates[1]).toBe(true); }));
  });
});

describe("forecastEvaluation: Codex evaluator review", () => {
  it("uses every 5th eligible origin per player, as proposed, across eligibility gaps", () => {
    // Player 1 is eligible at appearances 0, 2-6 and 9-12; greedy non-overlap would pick 0, 5 and 10.
    const one = [0, 2, 3, 4, 5, 6, 9, 10, 11, 12].map(i => origin(1, 100 + i, i + 4));
    const two = [0, 1, 2, 3, 4, 5].map(i => origin(2, 200 + i, i + 4));
    expect(everyFifthEligible([...two, ...one].reverse()).map(o => o.originSourceId)).toEqual([100, 106, 200, 205]);
  });
  it("normalizes the secondary composite with the frozen equal-weight formula on training targets", () => {
    // Orthogonal, mean-zero targets: correlation is the identity and standard deviations are in ratio 1:2:3.
    const h = [[1, -1, 1, -1], [1, 1, -1, -1], [1, -1, -1, 1]];
    const training = [0, 1, 2, 3].map(k => origin(1, k, 10 + k, [5 + h[0][k], 7 + 2 * h[1][k], 3 * h[2][k]]));
    const { weights } = compositeWeights(training);
    const sd = [1, 2, 3].map(m => m * Math.sqrt(4 / 3)), scale = Math.sqrt(3 * (1 / 9));
    weights!.forEach((w, t) => expect(w).toBeCloseTo(1 / 3 / sd[t] / scale, 12));
    const o = { ...origin(9, 1, 20, [1, 1, -1]), predictions: { P0: [2, 1, 0] } } as OriginRecord;
    const m = armMetrics([o], "per_appearance", weights).P0;
    expect(m.map(x => x.track)).toEqual(["fantasy_points", "goals_plus_assists", "wigo_game_score", "secondary_composite"]);
    expect(m[COMPOSITE].mae).toBeCloseTo(Math.abs(weights![0] * 1 + weights![2] * 1), 12);
    expect(compositeWeights(training.slice(0, 2)).reason).toBe("fewer_than_three_training_origins");
  });
  it("reports every secondary arm, track, schedule, tier and composite with full coverage", async () => {
    const r = await run(), n = r.primary.origins;
    for (const arm of [...PRIMARY_ARMS, "P2_unshrunk", "P1_H"] as const) {
      expect(r.primary.metrics[arm].map(x => x.n)).toEqual([n, n, n]);
      expect(r.perSixty.metrics[arm].map(x => x.n)).toEqual([n, n, n]);
      expect(r.secondaryComposite.metrics![arm].map(x => x.n)).toEqual([n, n, n, n]);
    }
    expect(r.perSixty.metrics.P1_H).toEqual(r.perSixty.metrics.P1);
    expect(r.secondaryComposite.contrasts.map(c => c.track)).toEqual(expect.arrayContaining(["secondary_composite"]));
    expect(r.everyFifthSchedule.origins).toBe(everyFifthEligible(r.origins).length);
    const tiers = Object.values(r.subgroups.evidenceTier).reduce((s, g) => s + g.origins, 0);
    expect(tiers).toBe(n);
    expect(Object.keys(r.coverage.evidenceTierByPosition).every(k => /^(measured_process_personal_reference|provisional_estimated_or_extrapolated)\|[FD]$/.test(k))).toBe(true);
  });
  it("stops at the deadline, does no further work and leaves nothing to publish", async () => {
    let calls = 0, published = false;
    const expired = () => ++calls > 3;
    await expect(runForecastComparison(data(), blocks(), config, { expired }).then(() => { published = true; })).rejects.toBeInstanceOf(ForecastDeadlineExceeded);
    expect(calls).toBe(4);
    expect(published).toBe(false);
  });
});

describe("forecastEvaluation: deadline at the publication boundary (Astra re-review of CLAUDE-121)", () => {
  const BUDGET = 3_600_000;
  it("rejects when the deadline passes during the final calculation, after the last checkpoint", async () => {
    let checks = 0;
    await runForecastComparison(data(), blocks(), { ...config, bootstrap: 1 }, { expired: () => { checks++; return false; } });
    // A fake clock that crosses the budget only on the very last check, after every checkpoint has passed.
    let clock = 0, calls = 0, published = false;
    const expired = () => { if (++calls === checks) clock = BUDGET + 1; return clock > BUDGET; };
    await expect(runForecastComparison(data(), blocks(), { ...config, bootstrap: 1 }, { expired }).then(() => { published = true; })).rejects.toThrow("after the final calculation");
    expect(calls).toBe(checks);
    expect(published).toBe(false);
  });
  it("makes no directory or file once the deadline passes after a successful evaluation", async () => {
    let clock = 0;
    const expired = () => clock > BUDGET;
    const result = await runForecastComparison(data(), blocks(), { ...config, bootstrap: 1 }, { expired });
    const files: [string, string][] = [["RESULTS.json", JSON.stringify(result.primary)], ["ORIGINS.jsonl", "x"], ["RECEIPT.json", "{}"]];
    const ops: string[] = [];
    clock = BUDGET + 1;
    expect(() => publishBeforeDeadline(files, expired, () => ops.push("mkdir"), name => ops.push(name))).toThrow(ForecastDeadlineExceeded);
    expect(ops).toEqual([]);
    // Control: within the budget the directory is created first, then every file.
    clock = BUDGET;
    publishBeforeDeadline(files, expired, () => ops.push("mkdir"), name => ops.push(name));
    expect(ops).toEqual(["mkdir", "RESULTS.json", "ORIGINS.jsonl", "RECEIPT.json"]);
  });
});
