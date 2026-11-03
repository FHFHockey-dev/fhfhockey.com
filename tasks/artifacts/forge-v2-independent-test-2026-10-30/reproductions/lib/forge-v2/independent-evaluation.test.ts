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


describe("outside audit: corrected actual start", () => {
  it("honors the latest authoritative actual-start correction for final selection", () => {
    const published = fixturePublished({id:"between-start-estimates"}, "2026-01-11T22:15:00.000Z");
    const first: LockEpoch = {...epoch,id:"erroneous-actual",predecessorId:epoch.id,adoptedAt:"2026-01-12T01:00:00.000Z",actualStartAt:"2026-01-11T22:00:00.000Z",playBegun:true,timingStatus:"confirmed"};
    const corrected: LockEpoch = {...first,id:"corrected-actual",predecessorId:first.id,adoptedAt:"2026-01-12T02:00:00.000Z",actualStartAt:"2026-01-11T22:30:00.000Z"};
    expect(final([published],{epochs:[epoch,first]}).state).toBe("missing");
    expect(final([published],{epochs:[epoch,first,corrected]})).toMatchObject({state:"selected",vintageId:published.vintage.id});
  });
});
