// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fixtureOpportunity, fixturePublished } from "./fixtures";
import { contentHash } from "./hash.server";
import { claimRefreshBatch, createRefreshState, easternDailyDeadline, enqueueMaterialEvent, enqueueRefresh,
  finishRefresh, planScheduledRefresh, reconcileRefreshScopes, refreshStatus, restoreRefreshState, type MaterialEvent, type RefreshBounds } from "./refresh";
import { observeHorizonEpisodes } from "./schedule";

const bounds: RefreshBounds = { maximumJobs: 100, maximumEvents: 100, concurrency: 2, batchSize: 2,
  maximumAttempts: 2, retryDelayMs: 60000, leaseMs: 120000 };
const now = "2026-01-01T12:00:00.000Z";
const scope = fixtureOpportunity({ scheduledStartAt: "2026-01-01T14:00:00.000Z" });
function event(id = "event-1", receivedAt = now): MaterialEvent {
  return { id, kind: "role", receivedAt, acceptedAt: receivedAt, payloadHash: id === "event-1" ? "a".repeat(64) : "b".repeat(64), affected: { playerIds: [scope.playerId] } };
}
describe("isolated local refresh planner", () => {
  it.each([["2026-03-07", "13"], ["2026-03-08", "12"], ["2026-11-01", "13"], ["2026-10-31", "12"]])("sets 8am Eastern across DST on %s", (date, hour) => {
    expect(easternDailyDeadline(date)).toBe(`${date}T${hour}:00:00.000Z`);
  });
  it("daily work is idempotent and tomorrow creates new issuance even with unchanged values", () => {
    const plans = planScheduledRefresh([scope], now), state = enqueueRefresh(createRefreshState(), plans, now, bounds);
    expect(enqueueRefresh(state, plans, now, bounds).jobs).toEqual(state.jobs);
    expect(plans[0].deadlineAt).toBe("2026-01-01T13:00:00.000Z");
    expect(plans[1].readyAt).toBe("2026-01-01T13:30:00.000Z");
    expect(planScheduledRefresh([scope], "2026-01-02T12:00:00Z")[0].issuanceKey).not.toBe(plans[0].issuanceKey);
  });
  it("changed start creates a separate pregame attempt and respects earlier actual lock", () => {
    const original = planScheduledRefresh([scope], now)[1];
    const changed = planScheduledRefresh([{ ...scope, scheduleRevision: "r2", scheduledStartAt: "2026-01-01T15:00:00Z" }], now)[1];
    expect(changed.issuanceKey).not.toBe(original.issuanceKey);
    expect(planScheduledRefresh([scope], now, { [scope.gameId]: "2026-01-01T13:00:00Z" })[1].lockAt).toBe("2026-01-01T13:00:00.000Z");
  });
  it("supersedes unissued pregame work after rescheduling while updating unclaimed daily context", () => {
    const state = enqueueRefresh(createRefreshState(), planScheduledRefresh([scope], now), now, bounds);
    const moved = { ...scope, scheduleRevision: "r2", scheduledStartAt: "2026-01-01T15:00:00Z" };
    const next = enqueueRefresh(state, planScheduledRefresh([moved], "2026-01-01T12:01:00Z"), "2026-01-01T12:01:00Z", bounds);
    expect(next.jobs.filter(job => job.status === "pending")).toHaveLength(2);
    expect(next.jobs[0].scope.scheduleRevision).toBe("r2");
    expect(next.jobs[1].reason).toBe("superseded_schedule");
    expect(next.jobs[2].readyAt).toBe("2026-01-01T14:30:00.000Z");
  });
  it("reconciles a trade, fences an in-flight completion and preserves unrelated and published work", () => {
    const unrelated = { ...scope, playerId: scope.playerId + 1 };
    const queued = enqueueRefresh(createRefreshState(), planScheduledRefresh([scope, unrelated], now), now, bounds);
    const claimed = claimRefreshBatch(queued, now, bounds);
    const published = finishRefresh(claimed.state, claimed.jobs[1].id, 1, { state: "published", vintageId: "prior", confirmedAt: now }, now, bounds);
    const at = "2026-01-01T12:01:00Z", traded = { ...scope, observedAt: at, affiliationRevision: "trade", teamId: scope.opponentId, opponentId: scope.teamId, home: !scope.home };
    const result = reconcileRefreshScopes(published, { previous: [scope], current: [traded], acceptedAt: at }, bounds);
    expect(result.state.jobs.slice(0, 2).map(job => job.status)).toEqual(["expired", "expired"]);
    expect(result.state.jobs.slice(2, 4)).toEqual(published.jobs.slice(2, 4));
    expect(result.events.map(event => event.kind)).toEqual(["team_change", "team_change"]);
    expect(result.plans.every(plan => !queued.jobs.some(job => job.issuanceKey === plan.issuanceKey))).toBe(true);
    expect(() => finishRefresh(result.state, claimed.jobs[0].id, 1, { state: "published", vintageId: "stale", confirmedAt: at }, at, bounds)).toThrow("claim is not current");
    expect(restoreRefreshState(result.state, bounds)).toEqual(result.state);
    expect(reconcileRefreshScopes(result.state, { previous: [scope], current: [traded], acceptedAt: at }, bounds)).toEqual(result);
    expect(published.jobs[0].status).toBe("running");
  });
  it.each([
    { scheduleRevision: "postponed", scheduledStartAt: "2026-01-02T14:00:00Z" },
    { affiliationRevision: "new-role" }, { opponentId: 999 }, { home: !scope.home }, { horizon: 2 as const },
  ])("replaces all obsolete scope work for %j", change => {
    const state = enqueueRefresh(createRefreshState(), planScheduledRefresh([scope], now), now, bounds);
    const at = "2026-01-01T12:01:00Z", next = { ...scope, ...change, observedAt: at };
    const result = reconcileRefreshScopes(state, { previous: [scope], current: [next], acceptedAt: at }, bounds);
    expect(result.state.jobs.slice(0, 2).every(job => job.status === "expired")).toBe(true);
    expect(result.state.jobs.slice(2).every(job => job.status === "pending")).toBe(true);
    expect(result.closed).toEqual([scope]); expect(result.opened).toEqual([next]);
  });
  it("cancels then reenters with fresh same-day issuance IDs and preserves first horizon episode", () => {
    const initial = { ...scope, observedAt: now };
    const first = observeHorizonEpisodes([], [initial], now);
    const queued = enqueueRefresh(createRefreshState(), planScheduledRefresh([initial], now), now, bounds);
    const cancelledAt = "2026-01-01T12:01:00Z";
    const cancelled = reconcileRefreshScopes(queued, { previous: [initial], current: [], acceptedAt: cancelledAt }, bounds);
    expect(cancelled.state.jobs.every(job => job.status === "expired")).toBe(true);
    expect(cancelled.plans).toEqual([]); expect(cancelled.events[0].reason).toBe("scope_closed:removed");
    const closed = observeHorizonEpisodes(first, [], cancelledAt);
    const returnedAt = "2026-01-01T12:02:00Z", returned = { ...initial, observedAt: returnedAt };
    const reentry = reconcileRefreshScopes(cancelled.state, { previous: [], current: [returned], acceptedAt: returnedAt }, bounds);
    expect(reentry.plans.every(plan => !queued.jobs.some(job => job.issuanceKey === plan.issuanceKey))).toBe(true);
    const episodes = observeHorizonEpisodes(closed, [returned], returnedAt);
    expect(episodes[0]).toEqual({ ...first[0], exitedAt: cancelledAt }); expect(episodes[1].episode).toBe(2);
    const revised = { ...returned, scheduleRevision: "r2", observedAt: "2026-01-01T12:03:00Z" };
    expect(observeHorizonEpisodes(episodes, [revised], revised.observedAt)).toEqual(episodes);
  });
  it("rejects duplicate, future or noncontemporaneous scope transitions before mutating the queue", () => {
    const queued = enqueueRefresh(createRefreshState(), planScheduledRefresh([scope], now), now, bounds);
    const accepted = { ...scope, observedAt: now };
    expect(() => reconcileRefreshScopes(queued, { previous: [scope], current: [accepted, accepted], acceptedAt: now }, bounds)).toThrow();
    expect(() => reconcileRefreshScopes(queued, { previous: [scope], current: [{ ...accepted, observedAt: "2026-01-02T12:00:00Z" }], acceptedAt: now }, bounds)).toThrow();
    expect(queued.jobs.every(job => job.status === "pending")).toBe(true);
  });
  it("deduplicates semantic events, coalesces at most five minutes and routes opponent context", () => {
    const first = event(), state = enqueueMaterialEvent(createRefreshState(), first, [scope], now, bounds);
    expect(state.jobs[0].readyAt).toBe("2026-01-01T12:05:00.000Z");
    expect(state.jobs[0].deadlineAt).toBe("2026-01-01T12:15:00.000Z");
    expect(enqueueMaterialEvent(state, { ...first, id: "same-semantics" }, [scope], now, bounds).jobs).toEqual(state.jobs);
    const coalesced = enqueueMaterialEvent(state, event("event-2", "2026-01-01T12:03:00Z"), [scope], "2026-01-01T12:03:00Z", bounds);
    expect(coalesced.jobs).toHaveLength(1); expect(coalesced.jobs[0].eventIds).toEqual(["event-1", "event-2"]);
    expect(coalesced.jobs[0].readyAt).toBe(state.jobs[0].readyAt);
    const opponent = { ...first, affected: { teamIds: [scope.opponentId] } };
    expect(enqueueMaterialEvent(createRefreshState(), opponent, [scope], now, bounds).jobs).toHaveLength(1);
  });
  it("preserves events received during processing as a separately claimable follow-up", () => {
    const queued = enqueueMaterialEvent(createRefreshState(), event(), [scope], now, bounds);
    const claimed = claimRefreshBatch(queued, "2026-01-01T12:05:00Z", bounds);
    const next = enqueueMaterialEvent(claimed.state, event("event-2", "2026-01-01T12:06:00Z"), [scope], "2026-01-01T12:06:00Z", bounds);
    expect(next.jobs).toHaveLength(2);
    expect(next.jobs.map(job => job.status)).toEqual(["running", "pending"]);
    expect(claimed.jobs[0].eventIds).toEqual(["event-1"]);
  });
  it("indexes material candidates without changing first-match order or the ready-time boundary", () => {
    const first = enqueueMaterialEvent(createRefreshState(), event(), [scope], now, bounds);
    const secondPlan = { ...first.jobs[0], issuanceKey: "second-material", readyAt: "2026-01-01T12:06:00Z", eventIds: ["second"] };
    const both = enqueueRefresh(first, [secondPlan], now, bounds);
    const before = enqueueMaterialEvent(both, event("event-2", "2026-01-01T12:02:00Z"), [scope], "2026-01-01T12:02:00Z", bounds);
    expect(before.jobs[0].eventIds).toEqual(["event-1", "event-2"]);
    expect(before.jobs[1].eventIds).toEqual(["second"]);
    const boundary = enqueueMaterialEvent(both, event("event-2", "2026-01-01T12:05:00Z"), [scope], "2026-01-01T12:05:00Z", bounds);
    expect(boundary.jobs[0].eventIds).toEqual(["event-1"]);
    expect(boundary.jobs[1].eventIds).toEqual(["second", "event-2"]);
  });
  it("shortens coalescing before lock and rejects late work with an explicit gap", () => {
    const near = { ...scope, scheduledStartAt: "2026-01-01T12:02:00Z" };
    const state = enqueueMaterialEvent(createRefreshState(), event(), [near], now, bounds);
    expect(state.jobs[0].readyAt).toBe("2026-01-01T12:01:59.999Z");
    const expired = claimRefreshBatch(state, "2026-01-01T12:02:00Z", bounds);
    expect(expired.jobs).toHaveLength(0);
    expect(expired.state.jobs[0].reason).toBe("missing_refresh:lock_passed");
    expect(refreshStatus(expired.state, near, "2026-01-01T12:03:00Z").gaps).toHaveLength(1);
  });
  it("bounds concurrent claims and restores snapshots without sharing state", () => {
    const scopes = [scope, { ...scope, playerId: scope.playerId + 1 }, { ...scope, playerId: scope.playerId + 2 }];
    const queued = enqueueRefresh(createRefreshState(), planScheduledRefresh(scopes, now), now, bounds);
    const claimed = claimRefreshBatch(queued, now, bounds);
    expect(claimed.jobs).toHaveLength(2);
    expect(claimRefreshBatch(claimed.state, now, bounds).jobs).toHaveLength(0);
    expect(queued.jobs.every(job => job.status === "pending")).toBe(true);
    expect(restoreRefreshState(JSON.parse(JSON.stringify(claimed.state)), bounds)).toEqual(claimed.state);
    const bad = structuredClone(claimed.state); bad.jobs[0].id = "spoof";
    expect(() => restoreRefreshState(bad, bounds)).toThrow();
    const exhausted = structuredClone(queued); exhausted.jobs[0].attempts = bounds.maximumAttempts;
    expect(() => restoreRefreshState(exhausted, bounds)).toThrow();
  });
  it("retries late failures with the same key and preserves original SLA", () => {
    const queued = enqueueMaterialEvent(createRefreshState(), event(), [scope], now, bounds);
    const claim = claimRefreshBatch(queued, "2026-01-01T12:16:00Z", bounds);
    const retry = finishRefresh(claim.state, claim.jobs[0].id, 1, { state: "failed", reason: "fixture", retryable: true }, "2026-01-01T12:16:01Z", bounds);
    const again = claimRefreshBatch(restoreRefreshState(retry, bounds), "2026-01-01T12:17:01Z", bounds);
    expect(again.jobs[0].issuanceKey).toBe(claim.jobs[0].issuanceKey);
    expect(again.jobs[0].attempts).toBe(2); expect(again.jobs[0].late).toBe(true);
    const failed = finishRefresh(again.state, again.jobs[0].id, 2, { state: "failed", reason: "fixture", retryable: true }, "2026-01-01T12:17:02Z", bounds);
    expect(failed.jobs[0].status).toBe("failed");
  });
  it("recovers expired leases and rejects an old worker acknowledgement", () => {
    const queued = enqueueMaterialEvent(createRefreshState(), event(), [scope], now, bounds);
    const first = claimRefreshBatch(queued, "2026-01-01T12:05:00Z", bounds);
    const resumed = claimRefreshBatch(first.state, "2026-01-01T12:07:00Z", bounds);
    expect(resumed.jobs[0].attempts).toBe(2);
    expect(() => finishRefresh(resumed.state, first.jobs[0].id, 1, { state: "published", vintageId: "old", confirmedAt: "2026-01-01T12:07:00Z" }, "2026-01-01T12:07:00Z", bounds)).toThrow();
  });
  function recoveredAttempt() {
    const queued = enqueueMaterialEvent(createRefreshState(), event(), [scope], now, bounds);
    const first = claimRefreshBatch(queued, "2026-01-01T12:05:00Z", bounds), original = first.jobs[0];
    const proof = fixturePublished({ ...scope, id: "original-vintage", issuanceKey: original.issuanceKey, trigger: original.trigger,
      generatedAt: "2026-01-01T12:05:01Z", inputCutoffAt: "2026-01-01T12:05:00Z",
      issuanceAttempt: { queueId: "queue-1", jobId: original.id, attempt: 1, startedAt: original.startedAt! } }, "2026-01-01T12:05:02Z");
    const resumed = claimRefreshBatch(first.state, "2026-01-01T12:07:00Z", bounds);
    return { first, proof, resumed, result: { state: "published" as const, vintageId: proof.vintage.id, confirmedAt: proof.receipt.confirmedAt, recoveredPublication: proof } };
  }
  it("recovers the original immutable publication receipt without changing its clock or issuance", () => {
    const { proof, resumed, result } = recoveredAttempt();
    const recovered = finishRefresh(resumed.state, resumed.jobs[0].id, 2, result, "2026-01-01T12:07:01Z", bounds, "queue-1");
    expect(recovered.jobs[0]).toMatchObject({ status: "published", confirmedAt: "2026-01-01T12:05:02Z", vintageId: "original-vintage", attempts: 2 });
    expect(recovered.jobs[0].recoveredPublication).toEqual(proof);
    expect(restoreRefreshState(JSON.parse(JSON.stringify(recovered)), bounds)).toEqual(recovered);
    expect(() => finishRefresh(resumed.state, resumed.jobs[0].id, 2, { state: "published", vintageId: result.vintageId, confirmedAt: result.confirmedAt }, "2026-01-01T12:07:01Z", bounds)).toThrow("receipt clock");
  });
  it("does not treat acknowledgement recovery as newly incorporated evidence", () => {
    const { first, result } = recoveredAttempt();
    const pending = enqueueMaterialEvent(first.state, event("event-2", "2026-01-01T12:06:00Z"), [scope], "2026-01-01T12:06:00Z", bounds);
    const retry = claimRefreshBatch(pending, "2026-01-01T12:07:00Z", bounds);
    const recovered = finishRefresh(retry.state, retry.jobs[0].id, 2, result, "2026-01-01T12:07:01Z", bounds, "queue-1");
    expect(refreshStatus(recovered, scope, "2026-01-01T12:22:00Z").state).toBe("stale");
  });
  it.each(["queue", "job", "attempt", "scope", "hash", "receipt", "no expected queue"])("rejects mismatched recovered %s evidence", failure => {
    const { proof, resumed, result } = recoveredAttempt();
    if (failure === "queue") proof.vintage.issuanceAttempt!.queueId = "other-queue";
    if (failure === "job") proof.vintage.issuanceAttempt!.jobId = "other-job";
    if (failure === "attempt") proof.vintage.issuanceAttempt!.attempt = 2;
    if (failure === "scope") proof.vintage.teamId = 3;
    if (failure === "receipt") proof.receipt.confirmedAt = "2026-01-01T12:05:03Z";
    if (failure !== "hash") proof.receipt.outputHash = contentHash(proof.vintage);
    else proof.receipt.outputHash = "f".repeat(64);
    expect(() => finishRefresh(resumed.state, resumed.jobs[0].id, 2, result, "2026-01-01T12:07:01Z", bounds, failure === "no expected queue" ? undefined : "queue-1")).toThrow();
  });
  it("retains post-lock publication as late audit evidence without an eligible latest value", () => {
    const queued = enqueueMaterialEvent(createRefreshState(), event(), [scope], now, bounds);
    const first = claimRefreshBatch(queued, "2026-01-01T12:05:00Z", bounds);
    const finished = finishRefresh(first.state, first.jobs[0].id, 1, { state: "published", vintageId: "v1", confirmedAt: "2026-01-01T14:00:00Z" }, "2026-01-01T14:00:01Z", bounds);
    expect(finished.jobs[0].reason).toBe("post_lock_publication");
    expect(refreshStatus(finished, scope, "2026-01-01T14:01:00Z")).toMatchObject({ state: "unavailable", latestEligibleVintageId: null, latePublications: [first.jobs[0].issuanceKey] });
  });
  it("does not relabel previous publication fresh when a newer refresh fails", () => {
    const first = claimRefreshBatch(enqueueRefresh(createRefreshState(), [planScheduledRefresh([scope], now)[0]], now, bounds), now, bounds);
    const published = finishRefresh(first.state, first.jobs[0].id, 1, { state: "published", vintageId: "v1", confirmedAt: "2026-01-01T12:00:01Z" }, "2026-01-01T12:00:02Z", bounds);
    const pending = enqueueMaterialEvent(published, event("event-2", "2026-01-01T12:06:00Z"), [scope], "2026-01-01T12:06:00Z", bounds);
    expect(refreshStatus(pending, scope, "2026-01-01T12:22:00Z")).toMatchObject({ state: "stale", latestEligibleVintageId: "v1" });
  });
  it("rejects capacity overflow and malformed routing atomically", () => {
    const empty = createRefreshState();
    expect(() => enqueueRefresh(empty, planScheduledRefresh([scope], now), now, { ...bounds, maximumJobs: 1, concurrency: 1, batchSize: 1 })).toThrow();
    expect(empty.jobs).toEqual([]);
    expect(() => enqueueMaterialEvent(empty, { ...event(), affected: {} }, [scope], now, bounds)).toThrow();
  });
});
