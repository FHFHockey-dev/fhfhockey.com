import { CATEGORIES, Component, EvidenceClass, Horizon, HorizonEpisode, Instant, Interval, LockEpoch, OutcomeRevision, PublishedVintage, ScoringProfile, Target, available, assertComponent, assertSource, assertTarget, assertVintage, instant, unavailable } from "./contracts";
import { contentHash } from "./hash.server";
import { scoreMeans, targetKey } from "./identity";

export interface Selection extends Target {
  series: "primary_horizon" | "locked_final";
  horizon: Horizon | null;
  evidenceClass: EvidenceClass;
  episodeId: string | null;
  vintageId: string | null;
  state: "selected" | "missing" | "excluded" | "pending";
  reason: string | null;
  selectedAt: Instant;
  lockEpochId: string | null;
  timingStatus: "provisional" | "confirmed";
}
export interface Invalidation { vintageId: string; recordedAt: Instant; evidenceId: string; reason: string }

function publicationOrder(a: PublishedVintage, b: PublishedVintage): number {
  return instant(a.receipt.confirmedAt) - instant(b.receipt.confirmedAt) || a.vintage.sequence - b.vintage.sequence || a.vintage.id.localeCompare(b.vintage.id);
}
function deduplicate(rows: readonly PublishedVintage[], eligible: (row: PublishedVintage) => boolean): PublishedVintage[] {
  const groups = new Map<string, PublishedVintage[]>();
  for (const row of rows) { const group = groups.get(row.vintage.id) ?? []; group.push(row); groups.set(row.vintage.id, group); }
  return [...groups.values()].flatMap(group => {
    try {
      if (new Set(group.map(row => contentHash(row.vintage))).size !== 1) return [];
      const first = group.filter(eligible).sort(publicationOrder)[0];
      return first ? [first] : [];
    } catch { return []; }
  });
}

/** Complete proof includes output hash, source cutoff, generation, epoch and actual-start clocks. */
export function publicationEligibility(row: PublishedVintage, epochs: readonly LockEpoch[], asOf: Instant): string | null {
  try {
    const { vintage: v, receipt: r } = row;
    assertVintage(v);
    if (!r.id || r.vintageId !== v.id || r.witness !== "committed_readback" || r.evidenceClass !== v.evidenceClass || r.outputHash !== contentHash(v)) return "invalid_publication_receipt";
    const published = instant(r.confirmedAt);
    if (published < instant(v.generatedAt) || published > instant(asOf)) return "invalid_publication_clock";
    const epoch = epochs.find(item => item.id === v.lockEpochId && item.gameId === v.gameId);
    if (!epoch || published < instant(epoch.adoptedAt) || instant(v.inputCutoffAt) < instant(epoch.adoptedAt)) return "unproven_lock_epoch";
    if (epoch.playBegun) return "play_already_observed";
    if (published >= instant(epoch.lockAt) || instant(v.inputCutoffAt) >= instant(epoch.lockAt)) return "at_or_after_lock";
    const next = epochs.find(item => item.predecessorId === epoch.id);
    if (next && published >= instant(next.adoptedAt)) return "superseded_lock_epoch";
    const actuals = epochs.filter(item => item.gameId === v.gameId && instant(item.adoptedAt) <= instant(asOf) && item.actualStartAt !== null).map(item => instant(item.actualStartAt!));
    if (actuals.length && published >= Math.min(...actuals)) return "at_or_after_actual_start";
    return null;
  } catch { return "invalid_publication_contract"; }
}

function disposition(selection: Selection, invalidations: readonly Invalidation[], asOf: Instant): Selection {
  const correction = invalidations.find(row => row.vintageId === selection.vintageId && instant(row.recordedAt) <= instant(asOf));
  if (!correction) return selection;
  if (!correction.evidenceId.trim() || !correction.reason.trim()) throw new Error("Technical exclusion requires evidence and reason");
  return { ...selection, state: "excluded", reason: `technical_invalidation:${correction.evidenceId}:${correction.reason}` };
}

/** One common vintage across all categories/profiles; model filters must run AFTER this. */
export function selectPrimaryCheckpoints(input: { target: Target; episodes: readonly HorizonEpisode[]; publications: readonly PublishedVintage[]; epochs: readonly LockEpoch[]; evidenceClass: EvidenceClass; asOf: Instant; prior?: readonly Selection[]; invalidations?: readonly Invalidation[] }): Selection[] {
  assertTarget(input.target);
  const target = targetKey(input.target), now = instant(input.asOf);
  const episodes = input.episodes.filter(row => targetKey(row) === target && instant(row.enteredAt) <= now);
  const publications = deduplicate(input.publications.filter(row => targetKey(row.vintage) === target && row.vintage.evidenceClass === input.evidenceClass), row => instant(row.receipt.confirmedAt) <= now && publicationEligibility(row, input.epochs, row.receipt.confirmedAt) === null);
  const corrected = (selection: Selection): Selection => {
    const row = publications.find(item => item.vintage.id === selection.vintageId);
    const reason = row ? publicationEligibility(row, input.epochs, input.asOf) : selection.vintageId ? "selected_publication_proof_unavailable" : null;
    return disposition(reason ? { ...selection, state: "excluded", reason } : selection, input.invalidations ?? [], input.asOf);
  };
  return Array.from({ length: 10 }, (_, index) => {
    const horizon = (index + 1) as Horizon;
    const first = episodes.filter(row => row.horizon === horizon).sort((a, b) => a.episode - b.episode || instant(a.enteredAt) - instant(b.enteredAt))[0];
    const prior = input.prior?.find(row => row.series === "primary_horizon" && targetKey(row) === target && row.horizon === horizon && row.evidenceClass === input.evidenceClass);
    // A closed first episode's missingness and any selected identity are permanent.
    if (prior && (prior.vintageId !== null || (prior.state === "missing" && prior.reason === "no_publication_in_first_episode"))) return corrected({ ...prior });
    const row = first && publications.filter(item => item.vintage.horizon === horizon && item.vintage.episodeId === first.id && instant(item.receipt.confirmedAt) >= instant(first.enteredAt) && (first.exitedAt === null || instant(item.receipt.confirmedAt) < instant(first.exitedAt))).sort(publicationOrder)[0];
    const selection: Selection = { ...input.target, series: "primary_horizon", horizon, evidenceClass: input.evidenceClass, episodeId: first?.id ?? null, vintageId: row?.vintage.id ?? null, state: row ? "selected" : first && (first.exitedAt === null || instant(first.exitedAt) > now) ? "pending" : "missing", reason: row ? null : !first ? "unobserved_horizon" : first.exitedAt === null || instant(first.exitedAt) > now ? "first_episode_open" : "no_publication_in_first_episode", selectedAt: input.asOf, lockEpochId: row?.vintage.lockEpochId ?? null, timingStatus: "provisional" };
    return corrected(selection);
  });
}

export function selectLockedFinal(input: { target: Target; publications: readonly PublishedVintage[]; epochs: readonly LockEpoch[]; evidenceClass: EvidenceClass; asOf: Instant; invalidations?: readonly Invalidation[] }): Selection {
  assertTarget(input.target);
  const epochs = input.epochs.filter(row => row.gameId === input.target.gameId && instant(row.adoptedAt) <= instant(input.asOf)).sort((a, b) => instant(a.adoptedAt) - instant(b.adoptedAt));
  const latest = epochs.at(-1);
  const deadline = latest ? Math.min(instant(latest.lockAt), ...epochs.flatMap(row => row.actualStartAt !== null ? [instant(row.actualStartAt)] : row.playBegun ? [instant(row.adoptedAt)] : [])) : Infinity;
  const pending = instant(input.asOf) < deadline;
  const selected = !pending && deduplicate(input.publications.filter(row => targetKey(row.vintage) === targetKey(input.target) && row.vintage.evidenceClass === input.evidenceClass), row => publicationEligibility(row, epochs, input.asOf) === null).filter(row => instant(row.receipt.confirmedAt) < deadline).sort(publicationOrder).at(-1);
  return disposition({ ...input.target, series: "locked_final", horizon: null, evidenceClass: input.evidenceClass, episodeId: selected ? selected.vintage.episodeId : null, vintageId: selected ? selected.vintage.id : null, state: pending ? "pending" : selected ? "selected" : "missing", reason: pending ? "lock_pending" : selected ? null : "no_proven_pregame_publication", selectedAt: input.asOf, lockEpochId: latest?.id ?? null, timingStatus: latest?.timingStatus ?? "provisional" }, input.invalidations ?? [], input.asOf);
}

export function appendOutcomeRevision(history: readonly OutcomeRevision[], revision: OutcomeRevision): OutcomeRevision[] {
  assertTarget(revision); assertSource(revision.source, revision.recordedAt);
  CATEGORIES.forEach(category => assertComponent(revision.values[category]));
  const duplicate = history.find(row => row.id === revision.id);
  if (duplicate) { if (contentHash(duplicate) !== contentHash(revision)) throw new Error("Outcome identity conflict"); return structuredClone([...history]); }
  const previous = history.filter(row => targetKey(row) === targetKey(revision)).at(-1);
  if ((previous?.id ?? null) !== revision.predecessorId || (previous && instant(revision.recordedAt) <= instant(previous.recordedAt))) throw new Error("Invalid outcome correction lineage");
  if (previous && !revision.reason?.trim()) throw new Error("Outcome revision requires reason");
  return structuredClone([...history, revision]);
}

export interface EvaluationRevision {
  id: string;
  predecessorId: string | null;
  recordedAt: Instant;
  selection: Selection;
  outcomeId: string | null;
  appearance: OutcomeRevision["appearance"] | "pending";
  status: OutcomeRevision["status"];
  profile: ScoringProfile;
  valueKind: "G" | "A" | "PPP" | "SOG" | "HIT" | "BLK" | "PIM" | "FP";
  forecast: Component<number>;
  actual: Component<number>;
  error: Component<number>;
  probability: Component<number>;
  participationActual: Component<number>;
  interval: Component<Interval[]>;
  modelVersion: string | null;
  cohort: string;
  period: string;
  leadHours: number | null;
  rescheduled: boolean;
  dependence: { player: string; game: string; slate: string; time: string };
  label: "original_scoring" | "historical_rescore";
  correctionReason: string | null;
}

export function settleEvaluation(input: { id: string; selection: Selection; publication: PublishedVintage | null; outcome: OutcomeRevision | null; profile: ScoringProfile; valueKind: EvaluationRevision["valueKind"]; recordedAt: Instant; period: string; rescheduled: boolean; intervals?: Component<Interval[]>; prior?: EvaluationRevision; correctionReason?: string; label?: EvaluationRevision["label"] }): EvaluationRevision {
  const { selection, publication, outcome, profile } = input;
  instant(input.recordedAt); assertTarget(selection);
  if (outcome) { assertSource(outcome.source, input.recordedAt); CATEGORIES.forEach(category => assertComponent(outcome.values[category])); }
  if (publication && (publication.vintage.id !== selection.vintageId || targetKey(publication.vintage) !== targetKey(selection))) throw new Error("Selected vintage mismatch");
  if (outcome && (targetKey(outcome) !== targetKey(selection) || instant(outcome.recordedAt) > instant(input.recordedAt))) throw new Error("Outcome target/clock mismatch");
  if (input.prior && (!input.correctionReason?.trim() || instant(input.recordedAt) <= instant(input.prior.recordedAt) || input.prior.selection.vintageId !== selection.vintageId || input.prior.profile.id !== profile.id || input.prior.valueKind !== input.valueKind || targetKey(input.prior.selection) !== targetKey(selection) || input.prior.selection.series !== selection.series || input.prior.selection.horizon !== selection.horizon || input.prior.selection.evidenceClass !== selection.evidenceClass)) throw new Error("Invalid evaluation correction lineage");
  const v = publication?.vintage;
  const originalProfile = v?.scoring.id === profile.id;
  if (v && !originalProfile && input.label !== "historical_rescore") throw new Error("Changed weights require labeled historical re-scoring");
  const forecast = selection.state === "selected" && v ? input.valueKind === "FP" ? scoreMeans(v.means, profile) : v.means[input.valueKind] : unavailable(selection.reason ?? "forecast_missing");
  const supported = outcome && outcome.status !== "pending" && outcome.appearance === "official_appearance";
  const actual = supported ? input.valueKind === "FP" ? scoreMeans(outcome.values, profile) : outcome.values[input.valueKind] : unavailable(outcome?.appearance ?? "pending");
  const error = forecast.state === "available" && actual.state === "available" ? available(forecast.value - actual.value) : unavailable("ungraded_conditional_performance");
  const participationActual = outcome && outcome.status !== "pending" && ["official_appearance", "dressed_unused", "nonappearance"].includes(outcome.appearance) ? available(outcome.appearance === "official_appearance" ? 1 : 0) : unavailable(outcome?.appearance ?? "pending");
  return { id: input.id, predecessorId: input.prior?.id ?? null, recordedAt: input.recordedAt, selection: structuredClone(selection), outcomeId: outcome?.id ?? null, appearance: outcome?.appearance ?? "pending", status: outcome?.status ?? "pending", profile: structuredClone(profile), valueKind: input.valueKind, forecast: structuredClone(forecast), actual: structuredClone(actual), error, probability: v && selection.state === "selected" ? structuredClone(v.participation.probability) : unavailable("forecast_missing"), participationActual, interval: structuredClone(input.intervals ?? unavailable("interval_unavailable")), modelVersion: v?.modelVersion ?? null, cohort: v?.cohort ?? "unresolved", period: input.period, leadHours: v ? (instant(v.scheduledStartAt) - instant(publication!.receipt.confirmedAt)) / 3600000 : null, rescheduled: input.rescheduled, dependence: { player: String(selection.playerId), game: String(selection.gameId), slate: v?.sourceGameDate ?? "unknown", time: input.period }, label: input.label ?? "original_scoring", correctionReason: input.correctionReason ?? null };
}

export interface MatchedBaseline { evaluationId: string; valueKind: EvaluationRevision["valueKind"]; evidenceClass: EvidenceClass; name: "last_five" | "season_rate"; selectedVintageId: string; inputCutoffAt: Instant; target: Target; profileId: string; outcomeId: string; value: Component<number> }
function mean(values: number[]): number | null { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null; }
function errors(values: number[]) { return { count: values.length, mae: mean(values.map(Math.abs)), mse: mean(values.map(value => value * value)), rmse: values.length ? Math.sqrt(mean(values.map(value => value * value))!) : null, bias: mean(values) }; }

/** Caller supplies one settled revision per checkpoint; mixing revisions is rejected. No IID uncertainty is claimed. */
export function summarizeAccountability(rows: readonly EvaluationRevision[], publications: readonly PublishedVintage[], baselines: readonly MatchedBaseline[] = []) {
  const seen = new Set<string>();
  const strata = new Map<string, EvaluationRevision[]>();
  for (const row of rows) {
    const s = row.selection;
    const key = [targetKey(s), s.series, s.horizon, s.evidenceClass, row.profile.id, row.valueKind].join("|");
    if (seen.has(key)) throw new Error("Duplicate primary observation or evaluation revision"); seen.add(key);
    const stratum = [s.evidenceClass, s.series, s.horizon ?? "final", row.modelVersion ?? "unavailable", row.cohort, row.period, row.profile.id, row.valueKind, row.label].join("|");
    const group = strata.get(stratum) ?? []; group.push(row); strata.set(stratum, group);
  }
  return [...strata].map(([stratum, group]) => {
    const graded = group.flatMap(row => row.error.state === "available" ? [row.error.value] : []);
    const intervals = ([0.5, 0.9] as const).map(level => {
      const evaluated = group.flatMap(row => {
        const band = row.interval.state === "available" ? row.interval.value.find(interval => interval.level === level) : undefined;
        if (!band || row.error.state !== "available" || row.actual.state !== "available") return [];
        if (!Number.isFinite(band.lower) || !Number.isFinite(band.upper) || band.lower > band.upper) throw new Error("Invalid interval");
        const y = row.actual.value, alpha = 1 - level;
        return [{ covered: Number(y >= band.lower && y <= band.upper), width: band.upper - band.lower, score: band.upper - band.lower + 2 / alpha * Math.max(0, band.lower - y, y - band.upper) }];
      });
      return { level, count: evaluated.length, missing: group.length - evaluated.length, coverage: mean(evaluated.map(row => row.covered)), width: mean(evaluated.map(row => row.width)), intervalScore: mean(evaluated.map(row => row.score)) };
    });
    const probabilities = group.flatMap(row => row.probability.state === "available" && row.participationActual.state === "available" ? [{ p: row.probability.value, y: row.participationActual.value }] : []);
    if (probabilities.some(row => row.p < 0 || row.p > 1 || !Number.isFinite(row.p))) throw new Error("Invalid probability");
    const impossibleEvents = probabilities.filter(row => (row.p === 0 && row.y === 1) || (row.p === 1 && row.y === 0)).length;
    const paired = (["last_five", "season_rate"] as const).map(name => {
      const pairs: Array<{ candidate: number; baseline: number }> = [];
      for (const row of group) {
        const matches = baselines.filter(item => item.evaluationId === row.id && item.name === name);
        if (matches.length > 1) throw new Error("Duplicate matched baseline");
        const baseline = matches[0];
        if (!baseline || baseline.value.state !== "available" || row.error.state !== "available" || row.actual.state !== "available") continue;
        const publication = publications.find(item => item.vintage.id === row.selection.vintageId);
        if (!publication || baseline.selectedVintageId !== publication.vintage.id || baseline.inputCutoffAt !== publication.vintage.inputCutoffAt || targetKey(baseline.target) !== targetKey(row.selection) || baseline.profileId !== row.profile.id || baseline.outcomeId !== row.outcomeId || baseline.valueKind !== row.valueKind || baseline.evidenceClass !== row.selection.evidenceClass || !Number.isFinite(baseline.value.value)) throw new Error("Unmatched baseline contract");
        pairs.push({ candidate: row.error.value, baseline: baseline.value.value - row.actual.value });
      }
      const candidate = errors(pairs.map(row => row.candidate)), baseline = errors(pairs.map(row => row.baseline));
      return { name, requested: group.length, paired: pairs.length, coverage: pairs.length / group.length, candidate, baseline, mseImprovement: candidate.mse === null || baseline.mse === null ? null : baseline.mse - candidate.mse };
    });
    return { stratum, requested: group.length, forecastCoverage: group.filter(row => row.forecast.state === "available").length / group.length, outcomeCoverage: group.filter(row => row.actual.state === "available").length / group.length, abstentions: group.filter(row => row.forecast.state === "unavailable").length, missingHorizons: group.filter(row => row.selection.series === "primary_horizon" && row.selection.state === "missing").length, integrityExclusions: group.filter(row => row.selection.state === "excluded").length, corrections: group.filter(row => row.predecessorId !== null).length, accuracy: errors(graded), intervals, paired, participation: { count: probabilities.length, missing: group.length - probabilities.length, brier: mean(probabilities.map(row => (row.p - row.y) ** 2)), logLoss: impossibleEvents ? null : mean(probabilities.map(row => row.y === 1 ? -Math.log(row.p) : -Math.log(1 - row.p))), logLossState: impossibleEvents ? "infinite" : probabilities.length ? "finite" : "missing", impossibleEvents, reliability: Array.from({ length: 10 }, (_, bin) => { const members = probabilities.filter(row => Math.min(9, Math.floor(row.p * 10)) === bin); return { bin, count: members.length, predicted: mean(members.map(row => row.p)), observed: mean(members.map(row => row.y)) }; }) }, manifest: group.map(row => ({ evaluationId: row.id, vintageId: row.selection.vintageId, outcomeId: row.outcomeId, leadHours: row.leadHours, rescheduled: row.rescheduled, dependence: row.dependence })) };
  });
}

export interface RsoEvidence { id: string; kind: "stored" | "bridge_snapshot" | "served" | "displayed"; parentId: string | null; vintageId: string; profileId: string; consumerVersion: string; at: Instant; value: Component<number>; valueHash: string }
/** Each stage must bind the exact preceding value; a newer stored forecast cannot replace display evidence. */
export function reportRsoEvidence(records: readonly RsoEvidence[]) {
  const byId = new Map(records.map(row => [row.id, row]));
  if (byId.size !== records.length) throw new Error("Duplicate exposure identity");
  const stages = ["stored", "bridge_snapshot", "served", "displayed"] as const;
  const valid = (row: RsoEvidence): boolean => {
    instant(row.at);
    if (!row.consumerVersion || !row.vintageId || !row.profileId || row.valueHash !== contentHash(row.value)) return false;
    const index = stages.indexOf(row.kind);
    if (index === 0) return row.parentId === null;
    const parent = row.parentId ? byId.get(row.parentId) : undefined;
    return !!parent && parent.kind === stages[index - 1] && parent.vintageId === row.vintageId && parent.profileId === row.profileId && parent.consumerVersion === row.consumerVersion && parent.valueHash === row.valueHash && instant(parent.at) <= instant(row.at) && valid(parent);
  };
  return records.map(row => ({ ...structuredClone(row), proven: valid(row), exposure: row.kind === "displayed" && valid(row) ? "actual_display_receipt" : row.kind === "served" && valid(row) ? "served_only" : "missing_exposure_proof" }));
}
