import { assertHorizon, assertVintage, type HistoryEvent, type Opportunity, type PublishedVintage, type Vintage } from "./contracts";
import { sourceInstant } from "./data";
import { contentHash } from "./hash.server";
import { targetKey } from "./identity";

const MINUTE = 60000;
export interface RefreshBounds {
  maximumJobs: number; maximumEvents: number; concurrency: number; batchSize: number;
  maximumAttempts: number; retryDelayMs: number; leaseMs: number;
}
export interface RefreshPlan {
  issuanceKey: string; scope: Opportunity; trigger: Vintage["trigger"];
  readyAt: string; deadlineAt: string; lockAt: string; eventIds: string[];
}
export interface RefreshJob extends RefreshPlan {
  id: string; status: "pending" | "running" | "published" | "failed" | "expired";
  attempts: number; firstQueuedAt: string; startedAt: string | null; leaseUntil: string | null;
  finishedAt: string | null; confirmedAt: string | null; vintageId: string | null;
  late: boolean; reason: string | null;
  /** Preserved immutable evidence for an acknowledgement recovered on a later claim. */
  recoveredPublication?: PublishedVintage;
  publicationQueueId?: string;
}
export interface RefreshState { version: "forge-v2-refresh-v1"; jobs: RefreshJob[]; seenEvents: string[] }
export interface MaterialEvent {
  id: string; kind: "schedule" | "affiliation" | "availability" | "role" | "statistics" | "correction" | "promoted_artifact";
  receivedAt: string; acceptedAt: string; payloadHash: string;
  affected: { playerIds?: number[]; gameIds?: number[]; teamIds?: number[] };
}
export const createRefreshState = (): RefreshState => ({ version: "forge-v2-refresh-v1", jobs: [], seenEvents: [] });
const iso = (time: number) => new Date(time).toISOString();
function clock(value: string): number {
  const result = sourceInstant(value);
  if (!Number.isFinite(result)) throw new Error("Invalid refresh UTC clock");
  return result;
}
function validBounds(bounds: RefreshBounds) {
  if (![bounds.maximumJobs, bounds.maximumEvents, bounds.concurrency, bounds.batchSize, bounds.maximumAttempts,
    bounds.retryDelayMs, bounds.leaseMs].every(Number.isSafeInteger)
    || bounds.maximumJobs < 1 || bounds.maximumJobs > 100000 || bounds.maximumEvents < 1 || bounds.maximumEvents > 100000
    || bounds.concurrency < 1 || bounds.concurrency > bounds.maximumJobs || bounds.batchSize < 1 || bounds.batchSize > bounds.concurrency
    || bounds.maximumAttempts < 1 || bounds.maximumAttempts > 10 || bounds.retryDelayMs < 1 || bounds.retryDelayMs > 15 * MINUTE
    || bounds.leaseMs < 1 || bounds.leaseMs > 15 * MINUTE) throw new Error("Invalid isolated refresh capacity");
}
function validatePlan(plan: RefreshPlan) {
  const s = plan?.scope;
  if (!plan || typeof plan.issuanceKey !== "string" || !plan.issuanceKey.trim() || !s
    || ![s.playerId, s.gameId, s.seasonId, s.teamId, s.opponentId].every(x => Number.isSafeInteger(x) && x > 0)
    || s.teamId === s.opponentId || !s.scheduleRevision || !s.affiliationRevision
    || s.targetVersion !== "nhl-official-skater-appearance-v1" || s.conditioning !== "official_appearance_given_game_occurs"
    || !["daily", "pregame", "material"].includes(plan.trigger) || !Array.isArray(plan.eventIds)
    || plan.eventIds.length > 1000 || plan.eventIds.some(id => typeof id !== "string" || !id.trim())
    || new Set(plan.eventIds).size !== plan.eventIds.length) throw new Error("Invalid refresh plan identity");
  clock(plan.readyAt);
  if (clock(plan.deadlineAt) > clock(plan.lockAt)
    || clock(plan.lockAt) > clock(s.scheduledStartAt)) throw new Error("Invalid refresh deadline or lock");
}

function validateRecoveredPublication(job: RefreshJob, published: PublishedVintage, queueId: string | undefined,
  vintageId: string, confirmedAt: string) {
  if (!queueId?.trim() || !published?.vintage || !published.receipt) throw new Error("Missing recovered publication provenance");
  const { vintage, receipt } = published;
  assertVintage(vintage);
  const stamp = vintage.issuanceAttempt, confirmed = clock(receipt.confirmedAt);
  if (!stamp || stamp.queueId !== queueId || stamp.jobId !== job.id || stamp.attempt >= job.attempts
    || clock(stamp.startedAt) < clock(job.firstQueuedAt) || clock(stamp.startedAt) > clock(vintage.generatedAt)
    || confirmed < clock(vintage.generatedAt) || confirmed >= clock(job.startedAt!)
    || !receipt.id?.trim() || receipt.witness !== "committed_readback" || receipt.evidenceClass !== vintage.evidenceClass
    || receipt.vintageId !== vintage.id || vintage.id !== vintageId || clock(confirmedAt) !== confirmed
    || receipt.outputHash !== contentHash(vintage) || vintage.issuanceKey !== job.issuanceKey
    || targetKey(vintage) !== targetKey(job.scope) || vintage.trigger !== job.trigger
    || vintage.teamId !== job.scope.teamId || vintage.opponentId !== job.scope.opponentId || vintage.home !== job.scope.home
    || vintage.horizon !== job.scope.horizon || vintage.scheduleRevision !== job.scope.scheduleRevision
    || vintage.affiliationRevision !== job.scope.affiliationRevision || vintage.sourceGameDate !== job.scope.sourceGameDate
    || clock(vintage.scheduledStartAt) !== clock(job.scope.scheduledStartAt)) throw new Error("Recovered publication does not match the prior immutable attempt");
}

/** Revalidate serialized snapshots; no functions, timers or process-local queue authority. */
export function restoreRefreshState(value: unknown, bounds: RefreshBounds): RefreshState {
  validBounds(bounds);
  const state = value as RefreshState;
  if (!state || state.version !== "forge-v2-refresh-v1" || !Array.isArray(state.jobs) || state.jobs.length > bounds.maximumJobs
    || !Array.isArray(state.seenEvents) || state.seenEvents.length > bounds.maximumEvents
    || state.seenEvents.some(x => typeof x !== "string" || !/^[a-f0-9]{64}$/.test(x))
    || new Set(state.seenEvents).size !== state.seenEvents.length) throw new Error("Invalid refresh snapshot bounds");
  const keys = new Set<string>();
  for (const job of state.jobs) {
    validatePlan(job);
    if (job.id !== `refresh:${contentHash(job.issuanceKey)}` || keys.has(job.issuanceKey)
      || !["pending", "running", "published", "failed", "expired"].includes(job.status)
      || !Number.isSafeInteger(job.attempts) || job.attempts < 0 || job.attempts > bounds.maximumAttempts
      || typeof job.late !== "boolean" || job.reason !== null && typeof job.reason !== "string") throw new Error("Invalid refresh job snapshot");
    keys.add(job.issuanceKey);
    clock(job.firstQueuedAt);
    for (const time of [job.startedAt, job.leaseUntil, job.finishedAt, job.confirmedAt]) if (time !== null) clock(time);
    if (job.status === "running" && (!job.startedAt || !job.leaseUntil || job.attempts < 1 || clock(job.leaseUntil) <= clock(job.startedAt))
      || job.status !== "running" && job.leaseUntil !== null
      || job.status === "pending" && job.attempts >= bounds.maximumAttempts
      || ["pending", "running"].includes(job.status) && job.finishedAt !== null
      || job.status !== "published" && (job.confirmedAt !== null || job.vintageId !== null)
      || job.startedAt !== null && clock(job.startedAt) < clock(job.firstQueuedAt)
      || job.finishedAt !== null && clock(job.finishedAt) < clock(job.firstQueuedAt)
      || job.status === "published" && (!job.confirmedAt || !job.finishedAt || typeof job.vintageId !== "string" || !job.vintageId.trim())
      || job.status === "published" && (!job.startedAt || !job.recoveredPublication && clock(job.confirmedAt!) < clock(job.startedAt)
        || clock(job.confirmedAt!) > clock(job.finishedAt!))
      || ["published", "failed", "expired"].includes(job.status) && !job.finishedAt) throw new Error("Invalid refresh job lifecycle");
    if (job.recoveredPublication !== undefined || job.publicationQueueId !== undefined) {
      if (job.status !== "published" || !job.recoveredPublication) throw new Error("Recovery proof requires a completed publication");
      validateRecoveredPublication(job, job.recoveredPublication, job.publicationQueueId, job.vintageId!, job.confirmedAt!);
    }
  }
  if (state.jobs.filter(job => job.status === "running").length > bounds.concurrency) throw new Error("Refresh capacity conflict");
  return structuredClone(state);
}

const eastern = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" });
function localParts(time: number) {
  return Object.fromEntries(eastern.formatToParts(new Date(time)).filter(p => p.type !== "literal").map(p => [p.type, p.value]));
}
export function easternDate(now: string): string {
  const p = localParts(clock(now));
  return `${p.year}-${p.month}-${p.day}`;
}
/** 08:00 is never ambiguous or nonexistent on Eastern DST transition dates. */
export function easternDailyDeadline(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`))
    || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) throw new Error("Invalid Eastern date");
  for (const hour of [12, 13]) {
    const candidate = `${date}T${hour}:00:00.000Z`, parts = localParts(clock(candidate));
    if (`${parts.year}-${parts.month}-${parts.day}` === date && parts.hour === "08") return candidate;
  }
  throw new Error("Unsupported Eastern daily deadline");
}

/** Opportunities are supplied by the accepted schedule/lock layer, never fetched here. */
export function planScheduledRefresh(scopes: Opportunity[], now: string,
  locks: Record<number, string> = {}): RefreshPlan[] {
  const current = clock(now), date = easternDate(now), daily = clock(easternDailyDeadline(date));
  if (scopes.length > 100000) throw new Error("Unbounded refresh scopes");
  return scopes.flatMap(scope => {
    const lock = Math.min(clock(scope.scheduledStartAt), locks[scope.gameId] ? clock(locks[scope.gameId]) : Infinity);
    const key = targetKey(scope), deadline = Math.min(daily, lock);
    const plans: RefreshPlan[] = [{ scope, trigger: "daily", issuanceKey: `daily:${date}:${key}`,
      readyAt: iso(Math.min(current, deadline)), deadlineAt: iso(deadline), lockAt: iso(lock), eventIds: [] },
    { scope, trigger: "pregame", issuanceKey: `pregame:${scope.scheduleRevision}:${scope.scheduledStartAt}:${key}`,
      readyAt: iso(Math.min(clock(scope.scheduledStartAt) - 30 * MINUTE, lock)),
      deadlineAt: iso(Math.min(clock(scope.scheduledStartAt) - 30 * MINUTE, lock)), lockAt: iso(lock), eventIds: [] }];
    plans.forEach(validatePlan);
    return plans;
  });
}

function append(state: RefreshState, plan: RefreshPlan, now: string, bounds: RefreshBounds) {
  validatePlan(plan);
  const same = state.jobs.find(job => job.issuanceKey === plan.issuanceKey);
  if (same) {
    if (targetKey(same.scope) !== targetKey(plan.scope) || same.trigger !== plan.trigger) throw new Error("Conflicting refresh issuance identity");
    // Unclaimed daily work may adopt a newly accepted schedule without inventing a second daily issuance.
    if (same.status === "pending" && same.attempts === 0 && plan.trigger === "daily"
      && (same.scope.scheduleRevision !== plan.scope.scheduleRevision || same.scope.affiliationRevision !== plan.scope.affiliationRevision)) {
      Object.assign(same, structuredClone(plan));
    }
    return;
  }
  if (state.jobs.length >= bounds.maximumJobs) throw new Error("Isolated refresh queue full; persist/archive terminal queue receipts before admission");
  const expired = clock(now) >= clock(plan.lockAt);
  state.jobs.push({ ...structuredClone(plan), id: `refresh:${contentHash(plan.issuanceKey)}`, status: expired ? "expired" : "pending",
    attempts: 0, firstQueuedAt: now, startedAt: null, leaseUntil: null, finishedAt: expired ? now : null,
    confirmedAt: null, vintageId: null, late: clock(now) > clock(plan.deadlineAt), reason: expired ? "missing_refresh:lock_passed" : null });
}
export function enqueueRefresh(input: RefreshState, plans: RefreshPlan[], now: string, bounds: RefreshBounds): RefreshState {
  const state = restoreRefreshState(input, bounds); clock(now);
  if (plans.length > bounds.maximumJobs) throw new Error("Unbounded refresh plan batch");
  for (const plan of plans) {
    validatePlan(plan);
    if (plan.trigger === "pregame") for (const job of state.jobs) {
      if (job.trigger === "pregame" && job.status === "pending" && targetKey(job.scope) === targetKey(plan.scope)
        && job.issuanceKey !== plan.issuanceKey) {
        job.status = "expired"; job.finishedAt = now; job.reason = "superseded_schedule";
      }
    }
    append(state, plan, now, bounds);
  }
  return state;
}

export interface RefreshScopeTransition {
  /** Complete accepted populations for the affected targets only; other targets are untouched. */
  previous: Opportunity[];
  current: Opportunity[];
  acceptedAt: string;
}
function scopeRevision(scope: Opportunity): string {
  return contentHash({ target: targetKey(scope), teamId: scope.teamId, opponentId: scope.opponentId,
    home: scope.home, horizon: scope.horizon, scheduleRevision: scope.scheduleRevision,
    affiliationRevision: scope.affiliationRevision, scheduledStartAt: iso(clock(scope.scheduledStartAt)),
    sourceGameDate: scope.sourceGameDate });
}

/** Pure proposal: CAS-save this state before accepting another claim or capturing its ledger events.
 * Published history and horizon episodes remain immutable; the schedule ledger owns episode entry/exit.
 * A removal must be represented in previous, never inferred from a partial current-only population. */
export function reconcileRefreshScopes(input: RefreshState, transition: RefreshScopeTransition, bounds: RefreshBounds,
  locks: Record<number, string> = {}): { state: RefreshState; plans: RefreshPlan[]; closed: Opportunity[]; opened: Opportunity[]; events: HistoryEvent[] } {
  const state = restoreRefreshState(input, bounds), at = clock(transition.acceptedAt);
  if (transition.previous.length + transition.current.length > bounds.maximumJobs) throw new Error("Unbounded refresh scope transition");
  const populations = [transition.previous, transition.current].map((rows, index) => {
    const map = new Map<string, Opportunity>();
    for (const scope of rows) {
      planScheduledRefresh([scope], transition.acceptedAt, locks); assertHorizon(scope.horizon);
      const observed = clock(scope.observedAt), key = targetKey(scope);
      if (!scope.id?.trim() || typeof scope.home !== "boolean" || !/^\d{4}-\d{2}-\d{2}$/.test(scope.sourceGameDate)
        || observed > at || index === 1 && observed !== at || map.has(key)) throw new Error("Invalid accepted refresh scope population");
      map.set(key, scope);
    }
    return map;
  });
  const [previous, current] = populations, affected = new Set([...previous.keys(), ...current.keys()]);
  const differs = (old: Opportunity | undefined, next: Opportunity | undefined) => !old || !next || scopeRevision(old) !== scopeRevision(next);
  const closed = transition.previous.filter(scope => differs(scope, current.get(targetKey(scope))));
  const opened = transition.current.filter(scope => differs(previous.get(targetKey(scope)), scope));
  for (const job of state.jobs) {
    const key = targetKey(job.scope), next = current.get(key);
    if (!affected.has(key) || !["pending", "running"].includes(job.status) || !differs(job.scope, next)) continue;
    if (clock(job.firstQueuedAt) > at || job.startedAt !== null && clock(job.startedAt) > at) throw new Error("Refresh scope transition precedes queued work");
    job.status = "expired"; job.finishedAt = transition.acceptedAt; job.leaseUntil = null;
    job.reason = next ? "scope_closed:superseded" : "scope_closed:removed";
    job.late ||= at > clock(job.deadlineAt);
  }
  const events: HistoryEvent[] = [];
  for (const [action, rows] of [["closed", closed], ["opened", opened]] as const) for (const scope of rows) {
    const key = targetKey(scope), old = previous.get(key), next = current.get(key);
    const reason = `scope_${action}:${old && next ? "superseded" : action === "closed" ? "removed" : "entered"}`;
    events.push({ playerId: scope.playerId, gameId: scope.gameId, seasonId: scope.seasonId,
      targetVersion: scope.targetVersion, conditioning: scope.conditioning,
      id: `refresh-scope:${contentHash({ action, scope: scopeRevision(scope), at: transition.acceptedAt })}`,
      at: transition.acceptedAt, kind: old && next && old.teamId !== next.teamId ? "team_change" : action === "closed" ? "retraction" : "technical_correction",
      reason, vintageId: null, predecessorId: null });
  }
  const plans = opened.flatMap(scope => {
    const revision = contentHash({ scope: scopeRevision(scope), acceptedAt: transition.acceptedAt });
    return planScheduledRefresh([scope], transition.acceptedAt, locks).map(plan => ({ ...plan,
      issuanceKey: `${plan.issuanceKey}:scope:${revision}`, eventIds: events.filter(event => targetKey(event) === targetKey(scope)).map(event => event.id) }));
  });
  for (const plan of plans) append(state, plan, transition.acceptedAt, bounds);
  return { state, plans, closed: structuredClone(closed), opened: structuredClone(opened), events };
}

/** Selectors are an intersection; affiliation events may name both former and new club. */
export function enqueueMaterialEvent(input: RefreshState, event: MaterialEvent, scopes: Opportunity[], now: string,
  bounds: RefreshBounds, locks: Record<number, string> = {}): RefreshState {
  const state = restoreRefreshState(input, bounds), current = clock(now), received = clock(event.receivedAt);
  if (!event.id?.trim() || !["schedule", "affiliation", "availability", "role", "statistics", "correction", "promoted_artifact"].includes(event.kind)
    || !/^[a-f0-9]{64}$/.test(event.payloadHash) || received > clock(event.acceptedAt) || clock(event.acceptedAt) > current
    || scopes.length > bounds.maximumJobs || !event.affected) throw new Error("Invalid accepted material event");
  const selectors = [event.affected.playerIds, event.affected.gameIds, event.affected.teamIds];
  if (!selectors.some(ids => ids?.length) || selectors.some(ids => ids !== undefined
    && (!Array.isArray(ids) || !ids.length || ids.length > bounds.maximumJobs || ids.some(id => !Number.isSafeInteger(id) || id <= 0)))) throw new Error("Unbounded or empty material routing");
  const affected = Object.fromEntries(Object.entries(event.affected).map(([key, ids]) => [key, [...new Set(ids)].sort((a, b) => a - b)]));
  const semantic = contentHash({ kind: event.kind, payloadHash: event.payloadHash, affected });
  if (state.seenEvents.includes(semantic)) return state;
  if (state.seenEvents.length >= bounds.maximumEvents) throw new Error("Material deduplication ledger full");
  const coalescible = new Map<string, RefreshJob[]>();
  for (const job of state.jobs) {
    if (job.trigger !== "material" || job.status !== "pending" || job.attempts !== 0 || current >= clock(job.readyAt)) continue;
    const key = targetKey(job.scope), candidates = coalescible.get(key) ?? [];
    candidates.push(job); coalescible.set(key, candidates);
  }
  for (const scope of scopes.filter(s => (!event.affected.playerIds || event.affected.playerIds.includes(s.playerId))
    && (!event.affected.gameIds || event.affected.gameIds.includes(s.gameId))
    && (!event.affected.teamIds || event.affected.teamIds.includes(s.teamId) || event.affected.teamIds.includes(s.opponentId)))) {
    const lock = Math.min(clock(scope.scheduledStartAt), locks[scope.gameId] ? clock(locks[scope.gameId]) : Infinity);
    const deadline = Math.min(received + 15 * MINUTE, lock), ready = Math.min(received + 5 * MINUTE, deadline, lock - 1);
    const key = targetKey(scope), candidates = coalescible.get(key) ?? [];
    const pending = candidates.find(job => current < clock(job.readyAt));
    if (pending) {
      pending.scope = structuredClone(scope);
      pending.eventIds = [...new Set([...pending.eventIds, event.id])];
      if (pending.eventIds.length > 1000) throw new Error("Material coalescing bound exceeded");
      pending.lockAt = iso(Math.min(clock(pending.lockAt), lock));
      pending.deadlineAt = iso(Math.min(clock(pending.deadlineAt), deadline, clock(pending.lockAt)));
      pending.readyAt = iso(Math.min(clock(pending.readyAt), ready, clock(pending.deadlineAt)));
    } else {
      const previousLength = state.jobs.length;
      append(state, { scope, trigger: "material", issuanceKey: `material:${semantic}:${key}`,
        readyAt: iso(ready), deadlineAt: iso(deadline), lockAt: iso(lock), eventIds: [event.id] }, now, bounds);
      if (state.jobs.length > previousLength && current < ready) {
        candidates.push(state.jobs[state.jobs.length - 1]); coalescible.set(key, candidates);
      }
    }
  }
  state.seenEvents.push(semantic);
  return state;
}

/** Expired leases become resumable attempts; existing running jobs retain the same issuance key. */
export function claimRefreshBatch(input: RefreshState, now: string, bounds: RefreshBounds): { state: RefreshState; jobs: RefreshJob[] } {
  const state = restoreRefreshState(input, bounds), current = clock(now);
  for (const job of state.jobs) {
    if (job.status === "running" && current >= clock(job.leaseUntil!)) {
      job.leaseUntil = null;
      job.reason = "worker_lease_expired";
      job.status = job.attempts >= bounds.maximumAttempts ? "failed" : "pending";
      if (job.status === "failed") job.finishedAt = now;
    }
    if (job.status === "pending" && current >= clock(job.lockAt)) {
      job.status = "expired"; job.finishedAt = now; job.reason = "missing_refresh:lock_passed"; job.late = true;
    }
  }
  const slots = Math.min(bounds.batchSize, bounds.concurrency - state.jobs.filter(job => job.status === "running").length);
  const jobs = state.jobs.filter(job => job.status === "pending" && clock(job.readyAt) <= current)
    .sort((a, b) => clock(a.deadlineAt) - clock(b.deadlineAt) || a.id.localeCompare(b.id)).slice(0, slots);
  for (const job of jobs) {
    job.status = "running"; job.startedAt = now; job.attempts++; job.leaseUntil = iso(current + bounds.leaseMs);
    job.late = current > clock(job.deadlineAt);
  }
  return { state, jobs: structuredClone(jobs) };
}
export type RefreshResult = { state: "published"; vintageId: string; confirmedAt: string; recoveredPublication?: PublishedVintage }
  | { state: "failed" | "unavailable"; reason: string; retryable: boolean };

/** Attempt token prevents a timed-out worker from acknowledging a newer claim. */
export function finishRefresh(input: RefreshState, jobId: string, attempt: number, result: RefreshResult, now: string,
  bounds: RefreshBounds, queueId?: string): RefreshState {
  const state = restoreRefreshState(input, bounds), current = clock(now), job = state.jobs.find(j => j.id === jobId);
  if (!job || job.status !== "running" || job.attempts !== attempt || current < clock(job.startedAt!)) throw new Error("Refresh claim is not current");
  job.leaseUntil = null;
  if (result.state === "published") {
    const confirmation = clock(result.confirmedAt);
    if (!result.vintageId?.trim() || confirmation > current) throw new Error("Invalid publication receipt clock");
    if (result.recoveredPublication) {
      validateRecoveredPublication(job, result.recoveredPublication, queueId, result.vintageId, result.confirmedAt);
      job.recoveredPublication = structuredClone(result.recoveredPublication); job.publicationQueueId = queueId;
    } else if (confirmation < clock(job.startedAt!)) throw new Error("Invalid publication receipt clock");
    job.status = "published"; job.confirmedAt = result.confirmedAt; job.vintageId = result.vintageId; job.finishedAt = now;
    job.late = confirmation > clock(job.deadlineAt) || confirmation >= clock(job.lockAt);
    job.reason = confirmation >= clock(job.lockAt) ? "post_lock_publication" : job.late ? "publication_deadline_missed" : null;
  } else {
    if (!result.reason?.trim()) throw new Error("Missing refresh failure reason");
    job.reason = `${result.state}:${result.reason}`; job.late = current > clock(job.deadlineAt);
    const retryAt = current + bounds.retryDelayMs;
    if (result.retryable && job.attempts < bounds.maximumAttempts && retryAt < clock(job.lockAt)) {
      job.status = "pending";
      // Retry readiness may follow the SLA; preserve its original deadline separately.
      job.readyAt = iso(retryAt);
    } else { job.status = "failed"; job.finishedAt = now; }
  }
  return state;
}

export function refreshStatus(state: RefreshState, scope: Opportunity, now: string) {
  const current = clock(now), jobs = state.jobs.filter(job => targetKey(job.scope) === targetKey(scope));
  const published = jobs.filter(job => job.status === "published" && job.confirmedAt && clock(job.confirmedAt) < clock(job.lockAt))
    .sort((a, b) => clock(b.confirmedAt!) - clock(a.confirmedAt!))[0];
  const outstanding = jobs.filter(job => job.reason !== "superseded_schedule"
    && (job.status !== "published" || job.reason === "post_lock_publication"));
  const overdue = outstanding.filter(job => current > clock(job.deadlineAt));
  return { latestEligibleVintageId: published?.vintageId ?? null, state: !published ? "unavailable" as const
    : overdue.some(job => clock(job.firstQueuedAt) >= clock(published.recoveredPublication?.vintage.inputCutoffAt ?? published.startedAt!)) ? "stale" as const : "fresh" as const,
    pending: outstanding.filter(job => job.status === "pending").length,
    running: outstanding.filter(job => job.status === "running").length,
    gaps: overdue.map(job => ({ issuanceKey: job.issuanceKey, reason: job.reason ?? "missing_refresh:deadline_missed" })),
    latePublications: jobs.filter(job => job.status === "published" && job.late).map(job => job.issuanceKey) };
}
