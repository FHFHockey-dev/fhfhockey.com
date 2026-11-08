/** Exploratory development forecast comparison for BLSH (FORECAST-PROPOSAL-v2.md).
 * Pure functions: callers supply every slot and block; no I/O, clock or network. A caller may
 * pass an `expired` check, which the run consults between players and sections: once it
 * returns true the run stops and rejects, so no result exists to publish.
 * Every prediction uses only games dated before the origin's first target game.
 * Results are exploratory development evidence, never a trusted or final performance claim.
 */
import { fitProductionPrior, personalReference, summarizeHistory, type HistorySummary, type ProductionPrior } from "./productionReference";
import { conditionalDelta, fitPrior, type EvidenceTier, type ScoringModel, type TrainingBlock } from "./supportGap";
import type { Slot } from "./currentWindows";

export const FORECAST_EVALUATION_VERSION = "blsh-forecast-dev-comparison-v2";
export const FORECAST_TRACKS = ["fantasy_points", "goals_plus_assists", "wigo_game_score"] as const;
/** Track index 3 is the secondary composite (frozen equal-weight normalization, `compositeWeights`). */
export const COMPOSITE = 3;
const TRACK_LABELS = [...FORECAST_TRACKS, "secondary_composite"] as const;
/** Primary arms share one origin set. P2_unshrunk and P1_H are secondary sensitivities. */
export const PRIMARY_ARMS = ["P0", "P1", "P2", "P2_transfer", "P3"] as const;
export type Arm = (typeof PRIMARY_ARMS)[number] | "P2_unshrunk" | "P1_H";
export const CONTRASTS: [Arm, Arm][] = [["P2", "P0"], ["P1", "P0"], ["P2", "P1"], ["P2_transfer", "P1"], ["P3", "P0"], ["P2_unshrunk", "P0"], ["P1_H", "P1"]];
const GAMMA_SHRINK = 0.5;
type Vec3 = [number, number, number];

export type ForecastConfig = { trainingSeason: number; evaluationSeason: number; gapDays: number; bootstrap: number; seed: number };
export const DEFAULT_CONFIG: ForecastConfig = { trainingSeason: 20222023, evaluationSeason: 20232024, gapDays: 30, bootstrap: 2000, seed: 20261029 };
export type RunOptions = { expired?: () => boolean };
export class ForecastDeadlineExceeded extends Error {
  constructor(where: string) { super(`Forecast run stopped at its deadline (${where}); no result was produced`); this.name = "ForecastDeadlineExceeded"; }
}
/** Publication boundary: callers prepare every payload first; the deadline is checked once more
 * immediately before the first filesystem mutation (`prepare`, e.g. creating the directory), and
 * nothing is created or written once it has passed. Pure: the caller supplies the I/O. */
export function publishBeforeDeadline(files: [name: string, text: string][], expired: () => boolean, prepare: () => void, write: (name: string, text: string) => void) {
  if (expired()) throw new ForecastDeadlineExceeded("publication boundary, before any output");
  prepare();
  for (const [name, text] of files) write(name, text);
}
/** Yield to the event loop (so the host can process its own messages), then stop if the deadline has passed. */
async function checkpoint(options: RunOptions, where: string) {
  await new Promise(resolve => setTimeout(resolve, 0));
  if (options.expired?.()) throw new ForecastDeadlineExceeded(where);
}

export type OriginRecord = {
  playerId: number; season: number; role: "training" | "evaluation"; position: "F" | "D"; team: string | null;
  originSourceId: number; windowDates: [string, string]; targetDates: [string, string]; windowSpanDays: number;
  tau: number; tauTarget: number; targets: Vec3; targetPer60: Vec3;
  referenceMode: "personal_full" | "personal_sparse" | "cohort"; personalGames: number; processReferenceMode: "personal" | "cohort";
  /** v1's tier at this origin: measured personal process and production references, inside the prior's span and range, no floor. */
  evidenceTier: EvidenceTier;
  deltaX: Vec3; referenceRate: Vec3;
  predictions: Partial<Record<Arm, Vec3>>; per60: Partial<Record<Arm, Vec3>>; floored: Partial<Record<Arm, number[]>>;
};

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const days = (a: string, b: string) => (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000;
const sum = (v: number[]) => v.reduce((s, x) => s + x, 0);
const complete = (s: Slot) => s.gamesPlayed === 1 && finite(s.seconds) && s.seconds > 0 && s.tracks.every(finite);
const per60 = (total: number, seconds: number) => (3600 * total) / seconds;
/** The frozen summarizer throws on duplicate or unordered dates; such histories are recorded as unusable, never repaired. */
function safeSummary(...args: Parameters<typeof summarizeHistory>): [HistorySummary | null, string | null] {
  try { return summarizeHistory(...args); } catch { return [null, "history_identity_or_order_invalid"]; }
}

/** Frozen 2024-25 P0: the last 50 admitted appearances of the immediately preceding season, no missing-score compression. */
export function priorSeasonMean(slots: Slot[], season: number): { mean: Vec3; toiPerGame: number } | null {
  const previous = slots.filter(s => s.season === season - 10001 && s.gamesPlayed === 1).slice(-50);
  if (previous.length !== 50 || !previous.every(s => s.tracks.every(finite) && finite(s.seconds))) return null;
  return { mean: [0, 1, 2].map(t => sum(previous.map(s => s.tracks[t] as number)) / 50) as Vec3, toiPerGame: sum(previous.map(s => s.seconds as number)) / 50 };
}

/** Donor summaries (complete, single-position final 50 before `before`), cached per date. */
function donorCache(byPlayer: Map<number, Slot[]>) {
  const cache = new Map<string, HistorySummary[]>();
  return (before: string) => {
    if (!cache.has(before)) {
      const donors: HistorySummary[] = [];
      byPlayer.forEach((slots, pid) => {
        let end = 0;
        while (end < slots.length && slots[end].date < before) end++;
        const h = slots.slice(Math.max(0, end - 50), end);
        const positions = new Set(h.map(s => s.position));
        if (h.length !== 50 || positions.size !== 1 || positions.has(null) || !h.every(complete)) return;
        const [summary] = safeSummary(pid, [...positions][0]!, h.map(s => s.tracks as number[]), h.map(s => s.seconds as number), h.map(s => s.id), h.map(s => s.date), before, true);
        if (summary) donors.push(summary);
      });
      cache.set(before, donors);
    }
    return cache.get(before)!;
  };
}

/** Solve a 3x3 system A x = b (columns of b solved together); null when numerically singular. */
function solve3(a: number[][], b: number[][]): number[][] | null {
  const m = a.map((row, i) => [...row, ...b[i]]), n = 3, scale = Math.max(...a.flat().map(Math.abs), 1e-300);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r;
    if (Math.abs(m[p][c]) <= 1e-12 * scale) return null;
    [m[c], m[p]] = [m[p], m[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const f = m[r][c] / m[c][c]; for (let k = c; k < m[r].length; k++) m[r][k] -= f * m[c][k]; }
  }
  return m.map((row, i) => row.slice(n).map(v => v / m[i][i]));
}

export type GammaFit = { gamma: number[][] | null; unshrunk: number[][] | null; origins: number; players: number; reason: string | null };
/** No-intercept least squares of 3600·(next-5 rate − reference rate) on ΔX, weighted by target TOI with equal total weight per player. */
export function fitGamma(training: OriginRecord[]): GammaFit {
  const players = [...new Set(training.map(o => o.playerId))];
  if (players.length < 2) return { gamma: null, unshrunk: null, origins: training.length, players: players.length, reason: "fewer_than_two_training_players" };
  const playerSeconds = new Map<number, number>();
  training.forEach(o => playerSeconds.set(o.playerId, (playerSeconds.get(o.playerId) ?? 0) + 5 * o.tauTarget));
  const a = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], b = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const o of training) {
    const w = (5 * o.tauTarget) / playerSeconds.get(o.playerId)! / players.length;
    const y = [0, 1, 2].map(t => 3600 * (o.targets[t] / o.tauTarget - o.referenceRate[t]));
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { a[i][j] += w * o.deltaX[i] * o.deltaX[j]; b[i][j] += w * o.deltaX[i] * y[j]; }
  }
  const unshrunk = solve3(a, b);
  if (!unshrunk) return { gamma: null, unshrunk: null, origins: training.length, players: players.length, reason: "singular_training_design" };
  return { gamma: unshrunk.map(r => r.map(v => GAMMA_SHRINK * v)), unshrunk, origins: training.length, players: players.length, reason: null };
}

/** Rate (per second) plus a per-hour process shift, times declared TOI; FP and G+A floored at zero. */
function shifted(r: Vec3, deltaX: Vec3, coef: number[][], tau: number): { value: Vec3; floored: number[] } {
  const floored: number[] = [];
  const value = [0, 1, 2].map(t => {
    const v = (r[t] + (deltaX[0] * coef[0][t] + deltaX[1] * coef[1][t] + deltaX[2] * coef[2][t]) / 3600) * tau;
    if (t < 2 && v < 0) { floored.push(t); return 0; }
    return v;
  }) as Vec3;
  return { value, floored };
}

export type Funnel = Record<string, number>;
/** Enumerate origins in one season and record why each appearance is or is not eligible. */
export async function buildOrigins(byPlayer: Map<number, Slot[]>, blocks: TrainingBlock[], season: number, role: "training" | "evaluation", config: ForecastConfig, options: RunOptions = {}): Promise<{ origins: OriginRecord[]; funnel: Funnel }> {
  const funnel: Funnel = {}, origins: OriginRecord[] = [];
  const fail = (reason: string) => { funnel[reason] = (funnel[reason] ?? 0) + 1; };
  const donors = donorCache(byPlayer);
  const qualified = blocks.filter(b => b.qualified_process_exposure);
  for (const [pid, slots] of [...byPlayer].sort((x, y) => x[0] - y[0])) {
    await checkpoint(options, `${role} origins, player ${pid}`);
    const inSeason = slots.map((s, i) => [s, i] as const).filter(([s]) => s.season === season);
    for (const [s, i] of inSeason) {
      funnel.appearances = (funnel.appearances ?? 0) + 1;
      const w = slots.slice(i - 4, i + 1), t = slots.slice(i + 1, i + 6);
      if (i < 4 || w.some(x => x.season !== season)) { fail("fewer_than_five_window_appearances_in_season"); continue; }
      if (t.length < 5 || t.some(x => x.season !== season)) { fail("fewer_than_five_future_appearances_in_season"); continue; }
      const all = [...w, ...t];
      if (!all.every(complete)) { fail("window_or_target_game_not_admitted_or_incomplete"); continue; }
      if (all.some((x, k) => k > 0 && days(all[k - 1].date, x.date) > config.gapDays) || new Set(all.map(x => x.team).filter(x => x !== null)).size > 1) { fail("gap_over_30_days_or_known_team_change"); continue; }
      const p0 = role === "evaluation" ? priorSeasonMean(slots, season) : null;
      if (role === "evaluation" && !p0) { fail("prior_season_mean_unavailable"); continue; }
      const before = w[0].date, position = w[4].position;
      if (!position) { fail("unknown_position"); continue; }
      const h = slots.slice(Math.max(0, i - 4 - 50), i - 4);
      let personal: HistorySummary | null = null;
      if (h.length && h.every(x => x.gamesPlayed === 1) && h.every(x => x.position === position)) {
        [personal] = safeSummary(pid, position, h.map(x => x.tracks.map(v => (v === null ? NaN : v))), h.map(x => x.seconds ?? NaN), h.map(x => x.id), h.map(x => x.date), before);
      }
      const [prior, priorReason] = fitProductionPrior(donors(before), position, pid, before) as [ProductionPrior | null, string | null];
      if (!prior) { fail(`production_reference_unestimable:${priorReason}`); continue; }
      if (!w.every(x => finite(x.ixG) && finite(x.onIceXGF) && finite(x.onIceXGA))) { fail("current_process_incomplete"); continue; }
      const [model, modelReason] = fitPrior(qualified.filter(b => b.position === position && b.dates[b.dates.length - 1] < before), pid, position, before) as [ScoringModel | null, string | null];
      if (!model) { fail(`support_model_unestimable:${modelReason}`); continue; }
      const wSeconds = sum(w.map(x => x.seconds as number)), tSeconds = sum(t.map(x => x.seconds as number));
      const xW: Vec3 = [per60(sum(w.map(x => x.ixG as number)), wSeconds), per60(sum(w.map(x => x.onIceXGF as number)), wSeconds), per60(sum(w.map(x => x.onIceXGA as number)), wSeconds)];
      const hProcess = h.length > 0 && h.every(x => finite(x.ixG) && finite(x.onIceXGF) && finite(x.onIceXGA) && finite(x.seconds) && x.seconds > 0);
      const hSeconds = hProcess ? sum(h.map(x => x.seconds as number)) : 0;
      const xH: Vec3 = hProcess ? [per60(sum(h.map(x => x.ixG as number)), hSeconds), per60(sum(h.map(x => x.onIceXGF as number)), hSeconds), per60(sum(h.map(x => x.onIceXGA as number)), hSeconds)]
        : (model.cohortX as Vec3);
      const reference = personalReference(prior, personal), r = reference.rate as Vec3, tau = wSeconds / 5, tauTarget = tSeconds / 5;
      const deltaX = [0, 1, 2].map(j => xW[j] - xH[j]) as Vec3;
      const targets = [0, 1, 2].map(k => sum(t.map(x => x.tracks[k] as number)) / 5) as Vec3;
      const transfer = shifted(r, deltaX, model.beta, tau);
      const [process] = conditionalDelta(model, xW, hProcess ? xH : [null, null, null], [hProcess, hProcess, hProcess]);
      const measured = !!process && hProcess && (personal?.n ?? 0) > 0 && !transfer.floored.length && !process.outsidePriorSpan && !process.outsidePriorComponentRange;
      const predictions: OriginRecord["predictions"] = {
        P1: r.map(v => v * tau) as Vec3, P2_transfer: transfer.value,
        P3: [0, 1, 2].map(k => sum(w.map(x => x.tracks[k] as number)) / 5) as Vec3,
      };
      if (p0) predictions.P0 = p0.mean;
      const hToi = h.length && h.every(x => finite(x.seconds)) ? sum(h.map(x => x.seconds as number)) / h.length : null;
      if (hToi !== null) predictions.P1_H = r.map(v => v * hToi) as Vec3;
      // P1-H changes only the declared TOI, so its rate prediction equals P1's by construction.
      const perSixty: OriginRecord["per60"] = { P1: r.map(v => v * 3600) as Vec3, ...(hToi !== null ? { P1_H: r.map(v => v * 3600) as Vec3 } : {}), P2_transfer: transfer.value.map(v => (3600 * v) / tau) as Vec3, P3: [0, 1, 2].map(k => per60(sum(w.map(x => x.tracks[k] as number)), wSeconds)) as Vec3 };
      if (p0) perSixty.P0 = p0.mean.map(v => (3600 * v) / p0.toiPerGame) as Vec3;
      origins.push({
        playerId: pid, season, role, position, team: w[4].team, originSourceId: s.id, windowDates: [w[0].date, w[4].date], targetDates: [t[0].date, t[4].date],
        windowSpanDays: days(w[0].date, w[4].date), tau, tauTarget, targets, targetPer60: targets.map(v => (3600 * v) / tauTarget) as Vec3,
        referenceMode: !personal ? "cohort" : personal.n === 50 ? "personal_full" : "personal_sparse", personalGames: personal?.n ?? 0, processReferenceMode: hProcess ? "personal" : "cohort",
        evidenceTier: measured ? "measured_process_personal_reference" : "provisional_estimated_or_extrapolated", deltaX, referenceRate: r, predictions, per60: perSixty, floored: { P2_transfer: transfer.floored },
      });
      fail("eligible");
    }
  }
  return { origins, funnel };
}

/** Attach P2 (shrunk γ) and P2_unshrunk to evaluation origins; drop origins without γ for their position. */
export function applyGamma(origins: OriginRecord[], gamma: Record<"F" | "D", GammaFit>): { origins: OriginRecord[]; excluded: number } {
  const kept: OriginRecord[] = [];
  for (const o of origins) {
    const g = gamma[o.position];
    if (!g.gamma || !g.unshrunk) continue;
    const p2 = shifted(o.referenceRate, o.deltaX, g.gamma, o.tau), raw = shifted(o.referenceRate, o.deltaX, g.unshrunk, o.tau);
    kept.push({ ...o, predictions: { ...o.predictions, P2: p2.value, P2_unshrunk: raw.value },
      per60: { ...o.per60, P2: p2.value.map(v => (3600 * v) / o.tau) as Vec3, P2_unshrunk: raw.value.map(v => (3600 * v) / o.tau) as Vec3 },
      floored: { ...o.floored, P2: p2.floored, P2_unshrunk: raw.floored } });
  }
  return { origins: kept, excluded: origins.length - kept.length };
}

/** Sensitivity schedule (proposal §2): every 5th eligible origin per player, in appearance order,
 * starting with the first. Eligible origins are distinct appearances, so five apart never overlap. */
export function everyFifthEligible(origins: OriginRecord[]): OriginRecord[] {
  const seen = new Map<number, number>();
  return [...origins].sort((a, b) => a.playerId - b.playerId || a.windowDates[1].localeCompare(b.windowDates[1]) || a.originSourceId - b.originSourceId)
    .filter(o => { const k = seen.get(o.playerId) ?? 0; seen.set(o.playerId, k + 1); return k % 5 === 0; });
}

/** Secondary composite: v1's frozen equal-weight normalization, a_t = (1/3) / sd_t / sqrt(w'Rw), with the
 * covariance taken from the training season's per-appearance targets (arm-neutral, fixed before evaluation). */
export function compositeWeights(training: OriginRecord[]): { weights: number[] | null; basis: string; origins: number; reason: string | null } {
  const basis = "training_season_target_covariance", n = training.length;
  if (n < 3) return { weights: null, basis, origins: n, reason: "fewer_than_three_training_origins" };
  const mean = [0, 1, 2].map(t => sum(training.map(o => o.targets[t])) / n);
  const v = [0, 1, 2].map(i => [0, 1, 2].map(j => sum(training.map(o => (o.targets[i] - mean[i]) * (o.targets[j] - mean[j]))) / (n - 1)));
  if (v.some((row, i) => !(row[i] > 0))) return { weights: null, basis, origins: n, reason: "zero_target_variance" };
  const sd = v.map((row, i) => Math.sqrt(row[i])), w = [1 / 3, 1 / 3, 1 / 3];
  const denominator = sum(w.map((wi, i) => sum(w.map((wj, j) => wi * wj * v[i][j] / (sd[i] * sd[j])))));
  if (!(denominator > 0)) return { weights: null, basis, origins: n, reason: "unusable_aggregate_scale" };
  return { weights: w.map((wi, i) => wi / sd[i] / Math.sqrt(denominator)), basis, origins: n, reason: null };
}
/** One track's value, or the composite (track 3) as the weighted sum of the three. */
const at = (v: Vec3, track: number, weights: number[] | null) => (track === COMPOSITE ? (weights ? sum(v.map((x, i) => weights[i] * x)) : NaN) : v[track]);

/** Deterministic PRNG (mulberry32) for the bootstrap. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
type Loss = { n: number; absA: number; absB: number; sqA: number; sqB: number };
export type ContrastResult = { arms: [Arm, Arm]; track: string; n: number; clusters: number; maeDiff: number; rmseDiff: number;
  maeDiffCI: [number, number]; rmseDiffCI: [number, number] };
/** Paired MAE/RMSE differences (A − B, negative favours A) with a cluster bootstrap over `cluster(o)`. */
export function contrast(origins: OriginRecord[], a: Arm, b: Arm, track: number, cluster: (o: OriginRecord) => string, config: ForecastConfig, scale: "per_appearance" | "per60" = "per_appearance", weights: number[] | null = null): ContrastResult | null {
  if (track === COMPOSITE && (!weights || scale !== "per_appearance")) return null;
  const pick = (o: OriginRecord, arm: Arm) => { const p = scale === "per60" ? o.per60[arm] : o.predictions[arm]; return p ? at(p, track, weights) : null; };
  const target = (o: OriginRecord) => at(scale === "per60" ? o.targetPer60 : o.targets, track, weights);
  const usable = origins.filter(o => pick(o, a) !== null && pick(o, b) !== null);
  if (!usable.length) return null;
  const groups = new Map<string, Loss>();
  for (const o of usable) {
    const ea = pick(o, a)! - target(o), eb = pick(o, b)! - target(o), k = cluster(o);
    const g = groups.get(k) ?? { n: 0, absA: 0, absB: 0, sqA: 0, sqB: 0 };
    g.n++; g.absA += Math.abs(ea); g.absB += Math.abs(eb); g.sqA += ea * ea; g.sqB += eb * eb; groups.set(k, g);
  }
  const list = [...groups.keys()].sort().map(k => groups.get(k)!);
  const stat = (gs: Loss[]) => { const n = sum(gs.map(g => g.n)); return [(sum(gs.map(g => g.absA)) - sum(gs.map(g => g.absB))) / n, Math.sqrt(sum(gs.map(g => g.sqA)) / n) - Math.sqrt(sum(gs.map(g => g.sqB)) / n)]; };
  const [maeDiff, rmseDiff] = stat(list), draws: number[][] = [], next = rng(config.seed + track * 1000 + CONTRASTS.findIndex(c => c[0] === a && c[1] === b));
  for (let r = 0; r < config.bootstrap; r++) draws.push(stat(Array.from({ length: list.length }, () => list[Math.floor(next() * list.length)])));
  const ci = (j: number): [number, number] => { const v = draws.map(d => d[j]).sort((x, y) => x - y); return [v[Math.floor(0.025 * (v.length - 1))], v[Math.ceil(0.975 * (v.length - 1))]]; };
  return { arms: [a, b], track: TRACK_LABELS[track], n: usable.length, clusters: list.length, maeDiff, rmseDiff, maeDiffCI: ci(0), rmseDiffCI: ci(1) };
}

export function armMetrics(origins: OriginRecord[], scale: "per_appearance" | "per60" = "per_appearance", weights: number[] | null = null) {
  const arms: Arm[] = [...PRIMARY_ARMS, "P2_unshrunk", "P1_H"];
  const tracks = weights && scale === "per_appearance" ? [0, 1, 2, COMPOSITE] : [0, 1, 2];
  return Object.fromEntries(arms.map(arm => [arm, tracks.map(t => {
    const track = TRACK_LABELS[t];
    const errs = origins.map(o => { const p = scale === "per60" ? o.per60[arm] : o.predictions[arm]; return p ? at(p, t, weights) - at(scale === "per60" ? o.targetPer60 : o.targets, t, weights) : null; }).filter(finite);
    return { track, n: errs.length, mae: errs.length ? sum(errs.map(Math.abs)) / errs.length : null, rmse: errs.length ? Math.sqrt(sum(errs.map(e => e * e)) / errs.length) : null };
  })]));
}

/** Pre-registered decision rule (exploratory on 2023-24). */
export function decision(primary: ContrastResult[]) {
  const get = (a: Arm, b: Arm, t: string) => primary.find(c => c.arms[0] === a && c.arms[1] === b && c.track === t);
  const fp = get("P2", "P0", "fantasy_points"), p2p1 = get("P2", "P1", "fantasy_points");
  const ga = get("P2", "P0", "goals_plus_assists"), gs = get("P2", "P0", "wigo_game_score");
  const conditions = {
    fp_P2_vs_P0_interval_below_zero: !!fp && fp.maeDiffCI[1] < 0,
    fp_P2_vs_P1_point_below_zero: !!p2p1 && p2p1.maeDiff < 0,
    ga_and_gs_P2_not_worse_than_P0: !!ga && !!gs && ga.maeDiff <= 0 && gs.maeDiff <= 0,
  };
  return { conditions, forwardPromise: Object.values(conditions).every(Boolean), note: "Exploratory development result; a promise only justifies freezing the protocol for the reserved evaluation." };
}

/** Run the whole comparison from slots grouped by player (sorted by date then id). */
export async function runForecastComparison(byPlayer: Map<number, Slot[]>, blocks: TrainingBlock[], config: ForecastConfig = DEFAULT_CONFIG, options: RunOptions = {}) {
  const training = await buildOrigins(byPlayer, blocks, config.trainingSeason, "training", config, options);
  const evaluation = await buildOrigins(byPlayer, blocks, config.evaluationSeason, "evaluation", config, options);
  const gamma = { F: fitGamma(training.origins.filter(o => o.position === "F")), D: fitGamma(training.origins.filter(o => o.position === "D")) };
  const { origins, excluded } = applyGamma(evaluation.origins, gamma);
  evaluation.funnel.gamma_unavailable_for_position = excluded;
  evaluation.funnel.eligible = origins.length;
  const byPlayerCluster = (o: OriginRecord) => String(o.playerId), byTeamSeason = (o: OriginRecord) => `${o.team ?? "unknown"}|${o.season}`;
  const composite = compositeWeights(training.origins);
  const contrasts = async (set: OriginRecord[], cluster: (o: OriginRecord) => string, scale: "per_appearance" | "per60" = "per_appearance", tracks = [0, 1, 2], where = "contrasts") => {
    const out: ContrastResult[] = [];
    for (const [a, b] of CONTRASTS) {
      await checkpoint(options, `${where} ${a}-${b}`);
      for (const t of tracks) { const c = contrast(set, a, b, t, cluster, config, scale, composite.weights); if (c) out.push(c); }
    }
    return out;
  };
  const primary = await contrasts(origins, byPlayerCluster, "per_appearance", [0, 1, 2], "primary");
  const sparse = everyFifthEligible(origins);
  const subgroup = (key: (o: OriginRecord) => string) => {
    const keys = [...new Set(origins.map(key))].sort();
    return Object.fromEntries(keys.map(k => { const set = origins.filter(o => key(o) === k); return [k, { origins: set.length, players: new Set(set.map(o => o.playerId)).size, metrics: armMetrics(set) }]; }));
  };
  const floors = Object.fromEntries((["P2", "P2_unshrunk", "P2_transfer"] as Arm[]).map(arm => [arm, origins.filter(o => (o.floored[arm] ?? []).length).length]));
  const teamSeason = (await contrasts(origins, byTeamSeason, "per_appearance", [0, 1, 2], "team-season")).filter(c => c.arms[0] === "P2" || c.arms[1] === "P0");
  const sparseContrasts = await contrasts(sparse, byPlayerCluster, "per_appearance", [0, 1, 2], "every-fifth");
  const perSixtyContrasts = (await contrasts(origins, byPlayerCluster, "per60", [0, 1, 2], "per-60")).filter(c => c.arms[1] === "P0" || (c.arms[0] === "P2" && c.arms[1] === "P1"));
  const compositeContrasts = composite.weights ? (await contrasts(origins, byPlayerCluster, "per_appearance", [COMPOSITE], "composite")).filter(c => c.arms[1] === "P0" || (c.arms[0] === "P2" && c.arms[1] === "P1")) : [];
  const tierPosition = subgroup(o => `${o.evidenceTier}|${o.position}`);
  const result = {
    version: FORECAST_EVALUATION_VERSION, config, exploratory: true,
    funnel: { training: training.funnel, evaluation: evaluation.funnel },
    trainingOrigins: { count: training.origins.length, players: new Set(training.origins.map(o => o.playerId)).size,
      firstWindowStart: training.origins.map(o => o.windowDates[0]).sort()[0] ?? null },
    gamma,
    primary: { origins: origins.length, players: new Set(origins.map(o => o.playerId)).size, metrics: armMetrics(origins), contrasts: primary, decision: decision(primary) },
    teamSeasonClusters: teamSeason,
    everyFifthSchedule: { schedule: "every_fifth_eligible_origin_per_player", origins: sparse.length, players: new Set(sparse.map(o => o.playerId)).size, metrics: armMetrics(sparse), contrasts: sparseContrasts },
    perSixty: { metrics: armMetrics(origins, "per60"), contrasts: perSixtyContrasts, note: "P1_H's rate prediction equals P1's by construction (it changes only the declared TOI)." },
    secondaryComposite: { label: "secondary", ...composite, metrics: composite.weights ? armMetrics(origins, "per_appearance", composite.weights) : null, contrasts: compositeContrasts },
    coverage: { evidenceTierByPosition: Object.fromEntries(Object.entries(tierPosition).map(([k, v]) => [k, { origins: v.origins, players: v.players }])) },
    subgroups: { evidenceTier: subgroup(o => o.evidenceTier), referenceMode: subgroup(o => o.referenceMode), position: subgroup(o => o.position), processReference: subgroup(o => o.processReferenceMode),
      windowSpan: subgroup(o => (o.windowSpanDays <= 9 ? "span_le_9d" : o.windowSpanDays <= 14 ? "span_10_14d" : "span_gt_14d")) },
    floors, origins,
  };
  // The last checkpoint precedes the final contrasts and aggregation; check again before returning.
  if (options.expired?.()) throw new ForecastDeadlineExceeded("after the final calculation");
  return result;
}
