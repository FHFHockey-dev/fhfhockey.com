import { rankMetric, type PoolValue } from "./ranking";
import type { Rank, Strength } from "./contracts";
import type { CurrentNhlCard, CurrentNhlGameEvidence } from "./currentNhl";
import { validDate } from "./windows";

/** Consumer contract only. Source admission remains with the supplying adapter. */
export const CARD_ANALYSIS_VERSION = "fhfh-card-analysis-v1" as const;
/** TJ approved both numeric and known-short policies on 2026-11-01; source admission is separate. */
export const CARD_RANK_POLICY = Object.freeze({ version: "fhfh-card-rank-policy-2026-11-01", status: "approved", ordering: "highest-numeric-first", ties: "competition", percentile: "midrank", shortSeason: "include-verified-complete", additionalQualifiers: "none" } as const);
export type AnalysisField = "goals" | "assists" | "points" | "shots" | "blocks" | "hits" | "ppPoints" | "toiSeconds" | "ppToiSeconds" | "ixg" | "xgf" | "xga";
export type AnalysisMetric = AnalysisField | "bsh" | "xgPct";
export type AnalysisBasis = "total" | "per-game" | "per60";
export const ANALYSIS_FIELDS: Record<AnalysisMetric, { label: string; group: "Scoring" | "Peripherals" | "Opportunity" | "Underlying"; unit: string; fields: AnalysisField[] }> = {
  goals: { label: "Goals", group: "Scoring", unit: "goals", fields: ["goals"] },
  assists: { label: "Assists", group: "Scoring", unit: "assists", fields: ["assists"] },
  points: { label: "Points", group: "Scoring", unit: "points", fields: ["points"] },
  ppPoints: { label: "PP points", group: "Scoring", unit: "points", fields: ["ppPoints"] },
  shots: { label: "Shots on goal", group: "Peripherals", unit: "shots", fields: ["shots"] },
  blocks: { label: "Blocks", group: "Peripherals", unit: "blocks", fields: ["blocks"] },
  hits: { label: "Hits", group: "Peripherals", unit: "hits", fields: ["hits"] },
  bsh: { label: "BSH · BLK + SOG + HITS", group: "Peripherals", unit: "events", fields: ["blocks", "shots", "hits"] },
  toiSeconds: { label: "Ice time", group: "Opportunity", unit: "min", fields: ["toiSeconds"] },
  ppToiSeconds: { label: "PP ice time", group: "Opportunity", unit: "min", fields: ["ppToiSeconds"] },
  ixg: { label: "Individual ixG", group: "Underlying", unit: "xG", fields: ["ixg"] },
  xgf: { label: "On-ice xGF", group: "Underlying", unit: "xG", fields: ["xgf"] },
  xga: { label: "On-ice xGA", group: "Underlying", unit: "xG", fields: ["xga"] },
  xgPct: { label: "On-ice xG share", group: "Underlying", unit: "%", fields: ["xgf", "xga"] },
};
export type FieldSource = { provider: string; field: string; model: string | null; revision: string; updatedAt: string | null; strength: Strength; unit: "count" | "seconds" | "xG" };
export type AnalysisGame = { gameId: number; date: string; utcStart: string; team: string; finalAtObservation: boolean; played: boolean | null; values: Partial<Record<AnalysisField, number | null>> };
export type AnalysisCapture = {
  version: typeof CARD_ANALYSIS_VERSION; id: string; player: CurrentNhlCard["player"]; season: number; gameType: "regular";
  source: "synthetic" | "retained" | "observed"; observedAt: string; strength: Strength;
  history: { complete: boolean; seasonAppearances: number | null; reason: string | null };
  fields: Partial<Record<AnalysisField, FieldSource>>; games: AnalysisGame[]; finality: string;
};
export type AnalysisSettings = { period: { mode: "appearances"; count: 5 | 10 | 20 } | { mode: "calendar"; start: string; end: string }; baseline: "previous" | "season"; basis: AnalysisBasis; visual: "bars" | "radar" };
export type AnalysisReading = { metric: AnalysisMetric; value: number | null; state: "valid" | "missing" | "undefined"; reason: string | null; unit: string; gp: number; rank: Rank | null; rankReason: string; definitionKey: string };
export type AnalysisWindow = { label: string; gameIds: number[]; dates: string[]; gp: number; requestedAppearances: number | null; knownShort: boolean; sampleWarning: string | null; readings: AnalysisReading[]; reason: string | null };
export type AnalysisSnapshot = { version: typeof CARD_ANALYSIS_VERSION; capture: AnalysisCapture; settings: AnalysisSettings; recent: AnalysisWindow; baseline: AnalysisWindow; overlap: number; disclosure: string; rankPolicy: typeof CARD_RANK_POLICY };
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;
const timestamp = (v: string) => Number.isFinite(Date.parse(v));

function captureError(c: AnalysisCapture): string | null {
  if (c.version !== CARD_ANALYSIS_VERSION || c.gameType !== "regular" || !timestamp(c.observedAt) || !["all", "5v5", "pp"].includes(c.strength)) return "Capture definition or observation time is invalid.";
  if (!c.history.complete || c.history.seasonAppearances === null) return c.history.reason || "Complete season history unavailable.";
  if (new Set(c.games.map(g => g.gameId)).size !== c.games.length) return "Duplicate game identities.";
  if (c.games.some(g => g.played === null || !validDate(g.date) || !timestamp(g.utcStart) || Date.parse(g.utcStart) > Date.parse(c.observedAt) || !Number.isSafeInteger(g.gameId) || g.gameId <= 0 || (g.played && !g.finalAtObservation))) return "Participation, game identity or final status is unverified.";
  if (c.games.filter(g => g.played).length !== c.history.seasonAppearances) return "Season appearances do not reconcile; missing rows are not a short sample.";
  if (new Set(c.games.filter(g => g.played).map(g => g.utcStart)).size !== c.history.seasonAppearances) return "Appearance ordering is ambiguous.";
  return null;
}
function reading(c: AnalysisCapture, games: AnalysisGame[], metric: AnalysisMetric, settings: AnalysisSettings, label: string, reason: string | null): AnalysisReading {
  const def = ANALYSIS_FIELDS[metric], time = metric === "toiSeconds" || metric === "ppToiSeconds";
  const basis = metric === "xgPct" ? "pooled-percentage" : time ? "per-game" : settings.basis;
  const required = [...def.fields, ...(basis === "per60" || metric === "ppToiSeconds" ? ["toiSeconds" as const] : [])];
  const definitionKey = JSON.stringify([CARD_ANALYSIS_VERSION, CARD_RANK_POLICY.version, c.season, c.gameType, c.observedAt, c.strength, settings.period, label, metric, basis, required.map(f => c.fields[f] || null)]);
  const result: AnalysisReading = { metric, value: null, state: "missing", reason, gp: games.length, unit: metric === "xgPct" ? "%" : `${def.unit}${basis === "per-game" ? "/GP" : basis === "per60" ? "/60" : " total"}`, rank: null, rankReason: "Rank unavailable: complete all-NHL same-definition population and qualified source evidence required.", definitionKey };
  if (reason) return result;
  if (!games.length) return { ...result, state: "undefined", reason: "No completed appearances in this window." };
  for (const f of required) {
    const source = c.fields[f];
    if (!source || !source.provider || !source.field || !source.revision || source.strength !== c.strength || (source.updatedAt !== null && (!timestamp(source.updatedAt) || Date.parse(source.updatedAt) > Date.parse(c.observedAt)))) return { ...result, reason: `${f}: source, strength or revision unavailable/incompatible.` };
    const expected = f.endsWith("Seconds") ? "seconds" : ["ixg", "xgf", "xga"].includes(f) ? "xG" : "count";
    if (source.unit !== expected || (expected === "xG" && !source.model)) return { ...result, reason: `${f}: denominator units or xG model unverified.` };
    if (games.some(g => !finite(g.values[f]) || expected === "count" && !Number.isSafeInteger(g.values[f]))) return { ...result, reason: `${f}: missing or invalid measurement; not zero.` };
  }
  if (metric === "ppToiSeconds" && games.some(g => !finite(g.values.toiSeconds) || g.values.ppToiSeconds! > g.values.toiSeconds!)) return { ...result, reason: "PP exposure exceeds or lacks total ice time." };
  if (metric === "xgPct" && ["provider", "model", "revision"].some(key => c.fields.xgf![key as keyof FieldSource] !== c.fields.xga![key as keyof FieldSource])) return { ...result, reason: "On-ice xGF/xGA source definitions differ." };
  const sum = (f: AnalysisField) => games.reduce((s, g) => s + g.values[f]!, 0);
  const numerator = def.fields.reduce((s, f) => s + sum(f), 0);
  const denominator = metric === "xgPct" ? sum("xgf") + sum("xga") : basis === "per60" ? sum("toiSeconds") : basis === "per-game" ? games.length : 1;
  if (denominator <= 0) return { ...result, state: "undefined", reason: "Zero exposure/denominator; ratio is undefined." };
  const value = metric === "xgPct" ? sum("xgf") * 100 / denominator : numerator / denominator * (time ? 1 / 60 : basis === "per60" ? 3600 : 1);
  return { ...result, value, state: "valid", reason: null };
}

export function analysisDifference(snapshot: AnalysisSnapshot, metric: AnalysisMetric): { value: number | null; reason: string | null } {
  const recent = snapshot.recent.readings.find(r => r.metric === metric)!, baseline = snapshot.baseline.readings.find(r => r.metric === metric)!;
  if (recent.value === null || baseline.value === null) return { value: null, reason: "A comparison value is unavailable." };
  if (snapshot.settings.basis === "total" && !["toiSeconds", "ppToiSeconds", "xgPct"].includes(metric) && snapshot.recent.gp !== snapshot.baseline.gp) return { value: null, reason: "Totals have unequal appearance samples; choose per-game or per60 for a change." };
  return { value: recent.value - baseline.value, reason: null };
}
/** Copies inputs before selecting; control changes do not fetch or mutate the capture. */
export function buildAnalysisSnapshot(input: AnalysisCapture, settings: AnalysisSettings): AnalysisSnapshot {
  const c: AnalysisCapture = JSON.parse(JSON.stringify(input)), s: AnalysisSettings = JSON.parse(JSON.stringify(settings));
  let error = captureError(c);
  if (s.period.mode === "calendar" && (!validDate(s.period.start) || !validDate(s.period.end) || s.period.start > s.period.end)) error = "Invalid inclusive UTC calendar window.";
  if (s.period.mode === "appearances" && ![5, 10, 20].includes(s.period.count)) error = "Unsupported appearance window.";
  if (!["previous", "season"].includes(s.baseline) || !["total", "per-game", "per60"].includes(s.basis) || !["bars", "radar"].includes(s.visual)) error = "Unsupported analysis setting.";
  const all = c.games.filter(g => g.played).sort((a, b) => b.utcStart.localeCompare(a.utcStart));
  const period = s.period;
  const recent = error ? [] : period.mode === "appearances" ? all.slice(0, period.count) : all.filter(g => g.utcStart.slice(0, 10) >= period.start && g.utcStart.slice(0, 10) <= period.end);
  let prior: AnalysisGame[] = [], priorError = error;
  if (s.baseline === "season") {
    prior = error ? [] : all;
    if (period.mode !== "appearances" || ![5, 10].includes(period.count)) priorError = "Season comparison is available for L5 or L10 only.";
  } else if (period.mode === "appearances") {
    prior = error ? [] : all.slice(period.count, period.count * 2);
    if (prior.length !== period.count) priorError = error || `Needs ${period.count * 2} appearances for equal, non-overlapping windows; captured ${all.length}.`;
  } else priorError = error || "Previous comparison requires an appearance window.";
  const window = (label: string, games: AnalysisGame[], why: string | null, requested: number | null): AnalysisWindow => {
    const knownShort = !why && requested !== null && games.length > 0 && games.length < requested;
    return { label, gameIds: games.map(g => g.gameId), dates: games.map(g => g.date), gp: games.length, requestedAppearances: requested, knownShort, sampleWarning: knownShort ? `${games.length} of ${requested} appearances: verified complete season history, small sample. Per-field gaps remain unavailable.` : null, reason: why, readings: (Object.keys(ANALYSIS_FIELDS) as AnalysisMetric[]).map(m => reading(c, games, m, s, label, why)) };
  };
  const overlap = priorError ? 0 : recent.filter(g => prior.some(p => p.gameId === g.gameId)).length;
  return { version: CARD_ANALYSIS_VERSION, capture: c, settings: s, recent: window(period.mode === "appearances" ? `Last ${period.count}` : `${period.start} to ${period.end} UTC`, recent, error, period.mode === "appearances" ? period.count : null), baseline: window(s.baseline === "season" ? "Season to date" : "Previous", prior, priorError, s.baseline === "previous" && period.mode === "appearances" ? period.count : null), overlap, disclosure: s.baseline === "season" ? `Season includes recent games: ${overlap} overlapping appearances. This is not an independent baseline.` : "Equal, non-overlapping appearance windows; short preceding history is withheld.", rankPolicy: CARD_RANK_POLICY };
}

/** Approved policy reuses the established arithmetic. No observed population is admitted by a boolean alone. */
export function analysisRank(snapshot: AnalysisSnapshot, metric: AnalysisMetric, pool: readonly PoolValue[], fullPopulation: boolean): { rank: Rank | null; reason?: string } {
  const value = snapshot.recent.readings.find(r => r.metric === metric)!;
  if (snapshot.capture.source !== "synthetic") return { rank: null, reason: "Observed population source admission pending: complete all-NHL same-definition evidence required. Ranking policy is approved." };
  const selected = pool.find(r => r.playerId === String(snapshot.capture.player.id));
  if (value.state !== "valid" || selected?.value !== value.value) return { rank: null, reason: "Population value does not match the displayed player metric." };
  return rankMetric(String(snapshot.capture.player.id), pool, { fullEligiblePopulationVerified: fullPopulation, definitionKey: value.definitionKey });
}

/** Recovers only already supplied, reconciled NHL games; never infers unseen season rows. */
export function analysisCaptureFromNhl(card: CurrentNhlCard): AnalysisCapture {
  const games = new Map<number, CurrentNhlGameEvidence>();
  let conflict = false;
  for (const w of [card, ...(card.windows || [])]) for (const g of [...w.evidence.selectedGames, ...(w.previous?.state === "ready" ? w.previous.games : [])]) {
    if (w.player.id !== card.player.id || w.request.season !== card.request.season || w.observedAt !== card.observedAt || w.source !== card.source) { conflict = true; continue; }
    if (games.has(g.gameId) && JSON.stringify(games.get(g.gameId)) !== JSON.stringify(g)) conflict = true;
    games.set(g.gameId, g);
  }
  const fields: AnalysisCapture["fields"] = {};
  for (const f of ["goals", "assists", "points", "shots", "toiSeconds"] as const) fields[f] = { provider: "NHL", field: f === "toiSeconds" ? "gameLog.toi (mm:ss converted to seconds)" : `gameLog.${f}`, model: null, revision: card.evidence.version, updatedAt: null, strength: "all", unit: f === "toiSeconds" ? "seconds" : "count" };
  const complete = card.state === "ready" && !conflict && games.size === card.evidence.seasonGp;
  return { version: CARD_ANALYSIS_VERSION, id: card.id, player: { ...card.player }, season: card.request.season, gameType: "regular", source: card.source === "contract-fixture" ? "synthetic" : card.source === "nhl-retained" ? "retained" : "observed", observedAt: card.observedAt, strength: "all", history: { complete, seasonAppearances: card.evidence.seasonGp, reason: complete ? null : "Supplied capture does not contain a complete, consistent season; no additional requests made." }, fields, finality: card.finalityStatement, games: [...games.values()].map(g => ({ gameId: g.gameId, date: g.providerDate, utcStart: g.utcStart, team: g.team, finalAtObservation: ["FINAL", "OFF"].includes(g.finalStatusAtObservation), played: true, values: { goals: g.goals, assists: g.assists, points: g.points, shots: g.shots, toiSeconds: g.toiSeconds } })) };
}
