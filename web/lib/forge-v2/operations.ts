import { CATEGORIES, Horizon, Instant, Opportunity, OutcomeRevision, PublishedVintage, QualificationManifest, Vintage, assertVintage, instant } from "./contracts";
import { IntegrityIncident } from "./artifacts.server";
import { canonicalJson, targetKey } from "./identity";
import { contentHash } from "./hash.server";
import { QualificationEvidence, assessQualification, qualificationScopeHash } from "./qualification";
import { RefreshBounds, RefreshState, restoreRefreshState } from "./refresh";

export interface OperatingLimits {
  maximumPublicationLatencyMs: number;
  maximumSourceAgeMs: number;
  maximumOutcomeLagMs: number;
  maximumQueued: number;
  maximumRetries: number;
}
export interface OperatingAlarm { code: string; scope: string; reason: string }
export interface QualificationCheck { vintage: Vintage; manifest: QualificationManifest | null; evidence: QualificationEvidence[]; expectedScopeHash: string | null }
export interface SettlementClock { target: Opportunity; endedAt: Instant; outcome: OutcomeRevision | null }
const maximum = (values: number[]) => values.length ? Math.max(...values) : null;
const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

/** Read-only summary. Operational metadata never substitutes for committed publication evidence. */
export function summarizeOperations(input: { asOf: Instant; opportunities: readonly Opportunity[]; queue: RefreshState; queueBounds: RefreshBounds; publications: readonly PublishedVintage[]; integrity: readonly IntegrityIncident[]; settlements: readonly SettlementClock[]; qualification: readonly QualificationCheck[]; limits: OperatingLimits | null }) {
  const now = instant(input.asOf), alarms: OperatingAlarm[] = [];
  const alarm = (code: string, scope: string, reason: string) => alarms.push({ code, scope, reason });
  const queue = restoreRefreshState(input.queue, input.queueBounds);
  if (input.opportunities.length > 100000 || input.publications.length > 100000 || input.settlements.length > 100000 || input.qualification.length > 100000 || input.integrity.length > 100000) throw new Error("Unbounded operating report");
  const limits = input.limits;
  if (!limits) alarm("operating_limits_missing", "forge_v2", "Measured limits and v1/RSO capacity reservation are not approved");
  else if (Object.values(limits).some(value => !Number.isSafeInteger(value) || value < 0)) throw new Error("Invalid operating limits");
  const publications = new Map<string, PublishedVintage>(), conflictedIds = new Set<string>();
  for (const row of input.publications) {
    try {
      assertVintage(row.vintage);
      const r = row.receipt, v = row.vintage;
      if (!r.id || r.witness !== "committed_readback" || r.vintageId !== v.id || r.evidenceClass !== v.evidenceClass || r.outputHash !== contentHash(v) || instant(r.confirmedAt) < instant(v.generatedAt) || instant(r.confirmedAt) > now) throw new Error("Invalid publication proof");
      const previous = publications.get(v.id);
      if (previous && contentHash(previous) !== contentHash(row)) { conflictedIds.add(v.id); publications.delete(v.id); throw new Error("Conflicting publication identity"); }
      if (!conflictedIds.has(v.id)) publications.set(v.id, row);
    } catch (error) { alarm("publication_integrity", row.vintage.id, error instanceof Error ? error.message : "Invalid publication"); }
  }
  const due = queue.jobs.filter(job => instant(job.deadlineAt) <= now && job.reason !== "superseded_schedule");
  const latency: number[] = [], sourceAges: number[] = [];
  let proven = 0, onTime = 0, late = 0;
  for (const job of queue.jobs) {
    if (instant(job.firstQueuedAt) > now) { alarm("future_queue_clock", job.id, "Queued after report cutoff"); continue; }
    if (job.status !== "published") continue;
    const publication = job.vintageId ? publications.get(job.vintageId) : undefined;
    if (!publication || publication.vintage.issuanceKey !== job.issuanceKey || targetKey(publication.vintage) !== targetKey(job.scope) || publication.receipt.confirmedAt !== job.confirmedAt) {
      alarm("unproven_queue_publication", job.id, "Queue acknowledgement lacks matching immutable receipt"); continue;
    }
    const published = instant(publication.receipt.confirmedAt);
    if (published >= instant(job.lockAt)) { alarm("post_lock_publication", job.id, "Publication is outside pregame eligibility"); continue; }
    proven++;
    if (published <= instant(job.deadlineAt)) onTime++; else late++;
    const duration = published - instant(job.firstQueuedAt); latency.push(duration);
    if (limits && duration > limits.maximumPublicationLatencyMs) alarm("publication_latency", job.id, "Publication latency exceeds approved limit");
  }
  const duePublished = due.filter(job => job.status === "published" && job.vintageId && publications.has(job.vintageId) && publications.get(job.vintageId)!.vintage.issuanceKey === job.issuanceKey && targetKey(publications.get(job.vintageId)!.vintage) === targetKey(job.scope) && publications.get(job.vintageId)!.receipt.confirmedAt === job.confirmedAt && instant(job.confirmedAt!) < instant(job.lockAt)).length;
  for (const job of due.filter(job => job.status !== "published")) alarm("missing_refresh", job.id, job.reason ?? "Refresh deadline passed without publication");
  const opportunities = new Set(input.opportunities.map(targetKey));
  if (opportunities.size !== input.opportunities.length) throw new Error("Duplicate operating opportunity");
  for (const scope of input.opportunities) if (!queue.jobs.some(job => targetKey(job.scope) === targetKey(scope))) alarm("unplanned_opportunity", targetKey(scope), "Independent opportunity has no queued refresh");
  const latestByTarget = new Map<string, PublishedVintage>();
  for (const publication of publications.values()) {
    const key = targetKey(publication.vintage), previous = latestByTarget.get(key);
    if (opportunities.has(key) && (!previous || instant(previous.receipt.confirmedAt) < instant(publication.receipt.confirmedAt))) latestByTarget.set(key, publication);
  }
  for (const publication of latestByTarget.values()) for (const source of publication.vintage.sourceManifest) {
    const age = now - instant(source.observedAt); sourceAges.push(age);
    if (limits && age > limits.maximumSourceAgeMs) alarm("stale_source", source.id, "Current scope source observation age exceeds approved limit");
  }
  const queued = queue.jobs.filter(job => job.status === "pending").length;
  const retries = queue.jobs.reduce((sum, job) => sum + Math.max(0, job.attempts - 1), 0);
  if (limits && queued > limits.maximumQueued) alarm("queue_capacity", "forge_v2", "Pending queue exceeds approved limit");
  if (limits && retries > limits.maximumRetries) alarm("retry_capacity", "forge_v2", "Retries exceed approved limit");
  for (const incident of input.integrity) alarm("artifact_integrity", incident.artifactId, incident.reason);
  const lags: number[] = []; let unsettled = 0;
  for (const row of input.settlements) {
    const ended = instant(row.endedAt);
    if (ended > now) throw new Error("Future game-end observation");
    const outcome = row.outcome;
    if (outcome && (targetKey(outcome) !== targetKey(row.target) || instant(outcome.recordedAt) > now || instant(outcome.recordedAt) < ended)) throw new Error("Settlement identity/clock mismatch");
    const settled = outcome && ["final", "corrected"].includes(outcome.status);
    const lag = (settled ? instant(outcome.recordedAt) : now) - ended; lags.push(lag);
    if (!settled) unsettled++;
    if (limits && lag > limits.maximumOutcomeLagMs) alarm("outcome_lag", targetKey(row.target), settled ? "Settlement arrived after approved limit" : "Outcome remains unsettled beyond approved limit");
  }
  let qualificationDrift = 0;
  for (const check of input.qualification) {
    const decision = assessQualification(check.vintage, check.manifest, check.evidence);
    if (decision.state === "unavailable" || !check.manifest || !check.expectedScopeHash || qualificationScopeHash(check.manifest) !== check.expectedScopeHash) {
      qualificationDrift++; alarm("qualification_drift", check.vintage.id, decision.state === "unavailable" ? decision.reason : "Qualification scope changed");
    }
  }
  if (!input.qualification.length) alarm("qualification_unverified", "forge_v2", "No current qualified scope evidence");
  const componentMissing = Object.fromEntries(CATEGORIES.map(category => [category, [...latestByTarget.values()].filter(row => row.vintage.means[category].state === "unavailable").length]));
  return { asOf: input.asOf, readyForActivation: false as const, health: alarms.length ? "blocked" as const : "within_supplied_limits" as const, alarms,
    opportunities: opportunities.size, refresh: { due: due.length, duePublished, dueMissing: due.length - duePublished, proven, onTime, late },
    publicationLatencyMs: { count: latency.length, mean: average(latency), maximum: maximum(latency) }, sourceAgeMs: { count: sourceAges.length, maximum: maximum(sourceAges) },
    missingness: { categories: componentMissing, opportunityWithoutPublication: opportunities.size - latestByTarget.size },
    queue: { pending: queued, running: queue.jobs.filter(job => job.status === "running").length, failed: queue.jobs.filter(job => job.status === "failed").length, expired: queue.jobs.filter(job => job.status === "expired").length, retries },
    artifactIntegrityFailures: input.integrity.length, outcomeLagMs: { requested: lags.length, unsettled, mean: average(lags), maximum: maximum(lags) }, qualificationDrift };
}

export interface ReleaseScope { id: string; horizons: Horizon[]; cohorts: string[]; profileId: string }
export interface ReleaseCandidate { hash: string; manifest: QualificationManifest; evidence: QualificationEvidence[]; representatives: Vintage[] }
export interface ReleaseApproval { id: string; candidateHash: string; scopeHash: string; environment: "production"; approvedAt: Instant; expiresAt: Instant }
export interface ReleaseEvent { id: string; at: Instant; scopeId: string; action: "promote" | "restore" | "disable"; before: string | null; after: string | null; reason: string; approvalId: string | null }
export interface ReleaseState { version: "forge-v2-release-v1"; scopes: Array<{ scope: ReleaseScope; enabled: boolean; candidateHash: string | null }>; events: ReleaseEvent[] }
export function createReleaseState(scopes: ReleaseScope[]): ReleaseState {
  if (new Set(scopes.map(scope => scope.id)).size !== scopes.length || scopes.some(scope => !scope.id || !scope.horizons.length || !scope.cohorts.length || !scope.profileId || scope.horizons.some(h => !Number.isInteger(h) || h < 1 || h > 10))) throw new Error("Invalid release scopes");
  return { version: "forge-v2-release-v1", scopes: structuredClone(scopes).map(scope => ({ scope, enabled: false, candidateHash: null })), events: [] };
}
export function releaseCandidateHash(candidate: Omit<ReleaseCandidate, "hash">): string { return contentHash(candidate); }

/** Produces an auditable state proposal only; this function never writes deployment/configuration. */
export function transitionRelease(input: ReleaseState, change: { id: string; scopeId: string; action: ReleaseEvent["action"]; at: Instant; reason: string; candidate?: ReleaseCandidate; approval?: ReleaseApproval }): ReleaseState {
  const state = structuredClone(input), at = instant(change.at);
  const entry = state.scopes.find(row => row.scope.id === change.scopeId);
  if (state.version !== "forge-v2-release-v1" || !["promote", "restore", "disable"].includes(change.action) || !entry || !change.id.trim() || !change.reason.trim() || state.events.some(event => event.id === change.id || instant(event.at) > at)) throw new Error("Invalid release transition lineage");
  const before = entry.candidateHash;
  if (change.action === "disable") { entry.enabled = false; entry.candidateHash = null; }
  else {
    const c = change.candidate, approval = change.approval;
    if (!c || c.hash !== releaseCandidateHash({ manifest: c.manifest, evidence: c.evidence, representatives: c.representatives })) throw new Error("Candidate content hash mismatch");
    if (!approval?.id || approval.environment !== "production" || approval.candidateHash !== c.hash || approval.scopeHash !== contentHash(entry.scope) || instant(approval.approvedAt) > at || instant(approval.expiresAt) <= at) throw new Error("Exact current release approval required");
    if (!entry.scope.horizons.every(h => c.manifest.horizons.includes(h)) || !entry.scope.cohorts.every(cohort => c.manifest.cohorts.includes(cohort)) || !c.manifest.profileIds.includes(entry.scope.profileId)) throw new Error("Candidate does not cover release scope");
    for (const horizon of entry.scope.horizons) for (const cohort of entry.scope.cohorts) {
      const representative = c.representatives.find(v => v.horizon === horizon && v.cohort === cohort && v.scoring.id === entry.scope.profileId);
      if (!representative || assessQualification(representative, c.manifest, c.evidence).state !== "available") throw new Error("Unqualified release scope");
    }
    if (change.action === "restore" && !state.events.some(event => event.scopeId === change.scopeId && event.after === c.hash && ["promote", "restore"].includes(event.action))) throw new Error("Restore candidate was never accepted in this scope");
    entry.enabled = true; entry.candidateHash = c.hash;
  }
  state.events.push({ id: change.id, at: change.at, scopeId: change.scopeId, action: change.action, before, after: entry.candidateHash, reason: change.reason, approvalId: change.action === "disable" ? null : change.approval!.id });
  return state;
}

/** Byte growth estimates are explicitly local JSON estimates, not database/storage bills. */
export function estimateRetention(sample: PublishedVintage, scopes: number, dailyRevisions: number, retentionDays: number) {
  if (![scopes, dailyRevisions, retentionDays].every(n => Number.isSafeInteger(n) && n > 0)) throw new Error("Explicit positive retention assumptions required");
  const bytesPerRevision = Buffer.byteLength(canonicalJson(sample));
  const rows = scopes * dailyRevisions * retentionDays;
  if (!Number.isSafeInteger(rows) || !Number.isSafeInteger(rows * bytesPerRevision)) throw new Error("Retention estimate exceeds safe range");
  return { basis: "uncompressed_canonical_json_only" as const, scopes, dailyRevisions, modeledDays: retentionDays, bytesPerRevision, rows, bytes: rows * bytesPerRevision, permanentHistory: true as const, automaticDeletion: false as const, excludes: ["indexes", "replicas", "artifacts", "backups", "provider_costs"] };
}
