import { describe, expect, it } from "vitest";
import { Component, HorizonEpisode, LockEpoch, PublishedVintage, available, unavailable } from "./contracts";
import { FIXTURE_CLOCK, FIXTURE_TARGET, fixtureMeans, fixtureOutcome, fixturePublished } from "./fixtures";
import { DEFAULT_SCORING, scoringProfile } from "./identity";
import { contentHash } from "./hash.server";
import { EvaluationRevision, RsoEvidence, appendOutcomeRevision, publicationEligibility, reportRsoEvidence, selectLockedFinal, selectPrimaryCheckpoints, settleEvaluation, summarizeAccountability } from "./evaluation";

const end = "2026-01-02T12:00:00.000Z", after = "2026-01-12T12:00:00.000Z";
const epoch: LockEpoch = { id: "lock-1", gameId: FIXTURE_TARGET.gameId, adoptedAt: FIXTURE_CLOCK, lockAt: "2026-01-11T23:00:00.000Z", scheduleRevision: "schedule-1", predecessorId: null, reopened: false, actualStartAt: null, timingStatus: "provisional", playBegun: false };
const episode: HorizonEpisode = { ...FIXTURE_TARGET, id: "episode-H10-1", horizon: 10, episode: 1, enteredAt: FIXTURE_CLOCK, exitedAt: end, scheduleRevision: "schedule-1", affiliationRevision: "affiliation-1" };
const primary = (publications: PublishedVintage[], extra: Partial<Parameters<typeof selectPrimaryCheckpoints>[0]> = {}) => selectPrimaryCheckpoints({ target: FIXTURE_TARGET, episodes: [episode], publications, epochs: [epoch], evidenceClass: "fixture", asOf: after, ...extra });
const final = (publications: PublishedVintage[], extra: Partial<Parameters<typeof selectLockedFinal>[0]> = {}) => selectLockedFinal({ target: FIXTURE_TARGET, publications, epochs: [epoch], evidenceClass: "fixture", asOf: after, ...extra });
const pub = fixturePublished();
function grade(overrides: Partial<Parameters<typeof settleEvaluation>[0]> = {}): EvaluationRevision {
  return settleEvaluation({ id: "grade-1", selection: primary([pub])[9], publication: pub, outcome: fixtureOutcome(), profile: DEFAULT_SCORING, valueKind: "PIM", recordedAt: after, period: "synthetic-period", rescheduled: false, ...overrides });
}

describe("FR26 primary selection", () => {
  it("selects first successful publication across triggers regardless of components and model; retries are one selection", () => {
    const first = fixturePublished({ means: fixtureMeans({ PIM: unavailable("incomplete") }), trigger: "material", modelVersion: "first-model" });
    const next = fixturePublished({ id: "next", issuanceKey: "next", sequence: 2, modelVersion: "new-model" }, "2026-01-01T12:01:00.000Z");
    const selections = primary([next, first, first]);
    expect(selections[9].vintageId).toBe(first.vintage.id);
    expect(grade({ selection: selections[9], publication: first }).forecast).toEqual(unavailable("incomplete"));
    expect(selections.filter(row => row.state === "missing")).toHaveLength(9);
  });

  it("uses issuance sequence then vintage ID for equal-time ties", () => {
    const a = fixturePublished({ id: "a", issuanceKey: "a", sequence: 2 });
    const b = fixturePublished({ id: "b", issuanceKey: "b", sequence: 2 });
    const c = fixturePublished({ id: "c", issuanceKey: "c", sequence: 3 });
    expect(primary([c, b, a])[9].vintageId).toBe("a");
    expect(final([a, c, b]).vintageId).toBe("c");
  });

  it("retains a missing first episode through reentry and never substitutes an adjacent horizon", () => {
    const reentry = { ...episode, id: "episode-H10-2", episode: 2, enteredAt: "2026-01-03T12:00:00.000Z", exitedAt: null };
    const later = fixturePublished({ id: "later", episodeId: reentry.id, inputCutoffAt: reentry.enteredAt, generatedAt: "2026-01-03T12:00:01.000Z" }, "2026-01-03T12:00:02.000Z");
    const adjacent = fixturePublished({ id: "adjacent", horizon: 9 });
    const selections = primary([later, adjacent], { episodes: [reentry, episode] });
    expect(selections[9]).toMatchObject({ state: "missing", reason: "no_publication_in_first_episode", vintageId: null });
    expect(selections[8]).toMatchObject({ state: "missing", reason: "unobserved_horizon" });
    expect(primary([pub, later], { episodes: [episode, reentry], prior: selections })[9].vintageId).toBeNull();
  });

  it("retains the original identity when technical evidence invalidates it without favorable replacement", () => {
    const next = fixturePublished({ id: "replacement", issuanceKey: "replacement", sequence: 2 }, "2026-01-01T12:01:00.000Z");
    const original = primary([pub, next]);
    const revised = primary([pub, next], { prior: original, invalidations: [{ vintageId: pub.vintage.id, recordedAt: after, evidenceId: "technical-evidence", reason: "corrupt_source" }] });
    expect(revised[9]).toMatchObject({ state: "excluded", vintageId: pub.vintage.id });
    expect(original[9].state).toBe("selected");
  });

  it("retains original primary selection as excluded after later actual-start evidence, and retries require valid receipts", () => {
    const bad = structuredClone(pub); bad.receipt.outputHash = "b".repeat(64); bad.receipt.confirmedAt = "2026-01-01T12:00:01.000Z";
    expect(primary([bad, pub])[9].vintageId).toBe(pub.vintage.id);
    const correction: LockEpoch = { ...epoch, id: "actual-correction", predecessorId: epoch.id, adoptedAt: after, actualStartAt: "2026-01-01T12:00:01.000Z", timingStatus: "confirmed", playBegun: true };
    expect(primary([pub], { epochs: [epoch, correction] })[9]).toMatchObject({ state: "excluded", vintageId: pub.vintage.id, reason: "at_or_after_actual_start" });
    expect(primary([pub], { epochs: [epoch, correction], prior: primary([pub]) })[9]).toMatchObject({ state: "excluded", vintageId: pub.vintage.id });
  });

  it("rejects invalid receipt hashes, source cutoffs, conflicting bytes, and publication outside the episode", () => {
    const bad = structuredClone(pub); bad.receipt.outputHash = "b".repeat(64);
    const future = fixturePublished({ sourceManifest: [{ ...pub.vintage.sourceManifest[0], firstReceivedAt: end }] });
    const outside = fixturePublished({ id: "outside" }, end);
    expect(primary([bad, future, outside])[9].state).toBe("missing");
    const conflict = fixturePublished({ means: fixtureMeans({ PIM: available(4) }) });
    expect(primary([pub, conflict])[9].vintageId).toBeNull();
  });
});

describe("separate final pregame benchmark", () => {
  it("uses latest proven strictly pre-lock publication; cutoff alone cannot rescue a delayed commit", () => {
    const earlier = fixturePublished({ id: "earlier" }, "2026-01-11T22:00:00.000Z");
    const latest = fixturePublished({ id: "latest" }, "2026-01-11T22:59:59.999Z");
    const equal = fixturePublished({ id: "equal" }, epoch.lockAt);
    const late = fixturePublished({ id: "late" }, "2026-01-11T23:00:00.001Z");
    expect(final([earlier, late, equal, latest])).toMatchObject({ vintageId: "latest", timingStatus: "provisional" });
    expect(primary([earlier, latest])[9].vintageId).toBeNull();
    expect(final([latest], { asOf: FIXTURE_CLOCK }).state).toBe("pending");
  });

  it("earlier actual starts exclude late forecasts and keep final distinct from H1", () => {
    const corrected: LockEpoch = { ...epoch, id: "timing-correction", adoptedAt: after, predecessorId: epoch.id, actualStartAt: "2026-01-11T22:30:00.000Z", timingStatus: "confirmed", playBegun: true };
    const before = fixturePublished({ id: "before" }, "2026-01-11T22:29:59.999Z");
    const afterStart = fixturePublished({ id: "after-start" }, "2026-01-11T22:30:00.000Z");
    expect(final([before, afterStart], { epochs: [epoch, corrected] })).toMatchObject({ vintageId: "before", series: "locked_final", horizon: null, timingStatus: "confirmed" });
  });

  it("closes publication at observed play while keeping unknown actual-start timing provisional", () => {
    const observed: LockEpoch = { ...epoch, id: "observed-play", predecessorId: epoch.id, adoptedAt: "2026-01-11T22:30:00.000Z", playBegun: true };
    const before = fixturePublished({ id: "before-observation" }, "2026-01-11T22:29:59.000Z");
    const afterPlay = fixturePublished({ id: "post-observation", lockEpochId: observed.id, inputCutoffAt: observed.adoptedAt, generatedAt: "2026-01-11T22:30:01.000Z" }, "2026-01-11T22:30:02.000Z");
    expect(publicationEligibility(afterPlay, [epoch, observed], after)).toBe("play_already_observed");
    expect(final([before, afterPlay], { epochs: [epoch, observed], asOf: "2026-01-11T22:31:00.000Z" })).toMatchObject({ state: "selected", vintageId: before.vintage.id, timingStatus: "provisional" });
  });

  it("a reopened epoch is prospective and cannot legitimize the gap after the old lock", () => {
    const reopened: LockEpoch = { ...epoch, id: "reopened", predecessorId: epoch.id, adoptedAt: "2026-01-12T00:00:00.000Z", lockAt: "2026-01-13T23:00:00.000Z", reopened: true };
    const gap = fixturePublished({ id: "gap" }, "2026-01-11T23:30:00.000Z");
    const backdated = fixturePublished({ id: "backdated", lockEpochId: reopened.id }, "2026-01-11T23:30:00.000Z");
    const fresh = fixturePublished({ id: "fresh", lockEpochId: reopened.id, inputCutoffAt: reopened.adoptedAt, generatedAt: "2026-01-12T00:00:01.000Z" }, "2026-01-12T00:00:02.000Z");
    const asOf = "2026-01-14T00:00:00.000Z";
    expect(final([gap, backdated, fresh], { epochs: [epoch, reopened], asOf }).vintageId).toBe("fresh");
    expect(publicationEligibility(gap, [epoch, reopened], asOf)).toBe("at_or_after_lock");
    expect(publicationEligibility(backdated, [epoch, reopened], asOf)).toBe("unproven_lock_epoch");
  });
});

describe("outcomes, corrections, scoring and metrics", () => {
  it("grades penalty-only official credit and never turns nonappearance/cancellation into zero performance", () => {
    expect(grade()).toMatchObject({ forecast: available(0.5), actual: available(2), error: available(-1.5), participationActual: available(1) });
    for (const appearance of ["dressed_unused", "nonappearance", "ambiguous", "game_not_played"] as const) {
      const result = grade({ outcome: fixtureOutcome({ appearance }) });
      expect(result.actual.state).toBe("unavailable"); expect(result.error.state).toBe("unavailable");
      expect(result.participationActual).toEqual(["dressed_unused", "nonappearance"].includes(appearance) ? available(0) : unavailable(appearance));
    }
    expect(grade({ outcome: fixtureOutcome({ status: "pending" }) }).actual.state).toBe("unavailable");
  });

  it("appends outcome and evaluation corrections preserving original grades and rejects mismatches", () => {
    const outcome = fixtureOutcome();
    const history = appendOutcomeRevision([], outcome);
    const correction = fixtureOutcome({ id: "outcome-2", predecessorId: outcome.id, status: "corrected", values: { ...outcome.values, PIM: available(4) }, recordedAt: "2026-01-13T03:02:00.000Z", reason: "official_revision" });
    const revised = appendOutcomeRevision(history, correction);
    expect(history).toHaveLength(1); expect(revised).toHaveLength(2);
    const original = grade(), corrected = grade({ id: "grade-2", prior: original, outcome: correction, recordedAt: "2026-01-14T00:00:00.000Z", correctionReason: "official_revision" });
    expect(original.error).toEqual(available(-1.5)); expect(corrected.error).toEqual(available(-3.5)); expect(corrected.predecessorId).toBe(original.id);
    expect(() => grade({ outcome: fixtureOutcome({ playerId: 9900999 }) })).toThrow("mismatch");
    expect(() => appendOutcomeRevision(history, { ...correction, predecessorId: null })).toThrow("lineage");
  });

  it("requires labeled rescoring, honors zero-weight missingness and allows signed weights", () => {
    const missing = fixturePublished({ means: fixtureMeans({ PIM: unavailable("missing") }) });
    expect(grade({ publication: missing, valueKind: "FP" }).forecast.state).toBe("available");
    const profile = scoringProfile({ ...DEFAULT_SCORING.weights, PIM: -1 });
    expect(() => grade({ profile, valueKind: "FP" })).toThrow("re-scoring");
    const rescore = grade({ profile, valueKind: "FP", label: "historical_rescore" });
    expect(rescore.actual).toEqual(available(-2));
    expect(grade({ publication: missing, profile, valueKind: "FP", label: "historical_rescore" }).forecast.state).toBe("unavailable");
  });

  it("computes coverage, errors, proper interval scores, participation and exact matched baselines", () => {
    const probability = fixturePublished({ participation: { ...pub.vintage.participation, probability: available(0.75) } });
    const row = grade({ publication: probability, intervals: available([{ level: 0.5, lower: 0, upper: 1 }, { level: 0.9, lower: 0, upper: 3 }]) });
    const baseline = { evaluationId: row.id, valueKind: row.valueKind, evidenceClass: row.selection.evidenceClass, name: "last_five" as const, selectedVintageId: pub.vintage.id, inputCutoffAt: pub.vintage.inputCutoffAt, target: FIXTURE_TARGET, profileId: DEFAULT_SCORING.id, outcomeId: row.outcomeId!, value: available(0) };
    const report = summarizeAccountability([row], [probability], [baseline])[0];
    expect(report.accuracy).toEqual({ count: 1, mae: 1.5, mse: 2.25, rmse: 1.5, bias: -1.5 });
    expect(report.intervals[0]).toMatchObject({ coverage: 0, width: 1, intervalScore: 5 });
    expect(report.intervals[1]).toMatchObject({ coverage: 1, width: 3, intervalScore: 3 });
    expect(report.participation.brier).toBe(0.0625); expect(report.participation.logLoss).toBeCloseTo(-Math.log(0.75));
    expect(report.paired[0]).toMatchObject({ paired: 1, coverage: 1, mseImprovement: 1.75 });
    expect(report.paired[1].paired).toBe(0);
    expect(report.manifest[0].dependence.game).toBe(String(FIXTURE_TARGET.gameId));
    expect(() => summarizeAccountability([row, row], [probability])).toThrow("Duplicate");
    expect(() => summarizeAccountability([row], [probability], [{ ...baseline, inputCutoffAt: end }])).toThrow("Unmatched");
    expect(() => summarizeAccountability([row], [probability], [{ ...baseline, valueKind: "G" }])).toThrow("Unmatched");
  });

  it("reports impossible-event logarithmic loss explicitly without serializing Infinity to null", () => {
    const probability = fixturePublished({ participation: { ...pub.vintage.participation, probability: available(0) } });
    const report = summarizeAccountability([grade({ publication: probability })], [probability])[0];
    expect(report.participation).toMatchObject({ brier: 1, logLoss: null, logLossState: "infinite", impossibleEvents: 1 });
  });

  it("separates evidence/cohorts and retains missingness and dependence without sample-independence claims", () => {
    const row = grade();
    const missing = grade({ id: "missing", selection: { ...row.selection, playerId: 9900002, vintageId: null, state: "missing", reason: "no_publication_in_first_episode" }, publication: null, outcome: null });
    const reports = summarizeAccountability([row, missing], [pub]);
    expect(reports).toHaveLength(2); expect(reports[1]).toMatchObject({ requested: 1, forecastCoverage: 0, outcomeCoverage: 0, abstentions: 1, missingHorizons: 1 });
    expect(reports[1].accuracy.mae).toBeNull();
  });
});

describe("RSO lineage", () => {
  const evidence = (kind: RsoEvidence["kind"], parentId: string | null, value: Component<number> = available(3)): RsoEvidence => ({ id: kind, kind, parentId, vintageId: "displayed-vintage", profileId: DEFAULT_SCORING.id, consumerVersion: "rso-fixture", at: FIXTURE_CLOCK, value, valueHash: contentHash(value) });
  it("keeps stored, snapshot, served and actual display distinct, preserving displayed values", () => {
    const records = [evidence("stored", null), evidence("bridge_snapshot", "stored"), evidence("served", "bridge_snapshot"), evidence("displayed", "served")];
    const report = reportRsoEvidence(records);
    expect(report.map(row => row.exposure)).toEqual(["missing_exposure_proof", "missing_exposure_proof", "served_only", "actual_display_receipt"]);
    expect(reportRsoEvidence(records.slice(0, 2)).every(row => row.exposure === "missing_exposure_proof")).toBe(true);
    expect(reportRsoEvidence([...records.slice(0, 3), evidence("displayed", "served", available(99))]).at(-1)?.proven).toBe(false);
    expect(reportRsoEvidence([{ ...records[3], vintageId: "newer-vintage" }, ...records.slice(0, 3)])[0].proven).toBe(false);
  });
});
