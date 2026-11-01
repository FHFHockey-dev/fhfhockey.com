/** Synthetic evidence only. These values provide no model/calibration qualification. */
import { Affiliation, CATEGORIES, CategoryMeans, CONDITIONING, Opportunity, OutcomeRevision, PublishedVintage, ScheduleGame, SourceReference, TARGET_VERSION, Vintage, available, unavailable } from "./contracts";
import { DEFAULT_SCORING } from "./identity";
import { contentHash } from "./hash.server";

export const FIXTURE_CLOCK = "2026-01-01T12:00:00.000Z";
export const FIXTURE_TARGET = { playerId: 9900001, gameId: 2099020010, seasonId: 20992000, targetVersion: TARGET_VERSION, conditioning: CONDITIONING };
export function fixtureSource(overrides: Partial<SourceReference> = {}): SourceReference {
  return { id: "synthetic-source", revision: "r1", sha256: "a".repeat(64), source: "fixture", use: "approved", observedAt: FIXTURE_CLOCK, publishedAt: FIXTURE_CLOCK, firstReceivedAt: FIXTURE_CLOCK, ...overrides };
}
export function fixtureMeans(overrides: Partial<CategoryMeans> = {}): CategoryMeans {
  return { G: available(0.4), A: available(0.7), PPP: available(0.3), SOG: available(3), HIT: available(1), BLK: available(1), PIM: available(0.5), ...overrides };
}
export function fixtureAffiliation(overrides: Partial<Affiliation> = {}): Affiliation {
  return { playerId: FIXTURE_TARGET.playerId, teamId: 1, position: "F", status: "roster", effectiveAt: FIXTURE_CLOCK, revision: "affiliation-1", source: fixtureSource(), ...overrides };
}
export function fixtureSchedule(count = 10): ScheduleGame[] {
  return Array.from({ length: count }, (_, i) => ({
    gameId: 2099020001 + i, seasonId: FIXTURE_TARGET.seasonId, gameType: "regular", homeTeamId: i % 2 ? 2 : 1, awayTeamId: i % 2 ? 1 : 2,
    sourceGameDate: `2026-01-${String(i + 2).padStart(2, "0")}`, scheduledStartAt: `2026-01-${String(i + 2).padStart(2, "0")}T23:00:00.000Z`,
    actualStartAt: null, status: "scheduled", revision: "schedule-1", source: fixtureSource(), noPlayConfirmed: false, replacementGameId: null,
  }));
}
export function fixtureOpportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return { ...FIXTURE_TARGET, id: "opportunity-1", teamId: 1, opponentId: 2, home: true, horizon: 10, observedAt: FIXTURE_CLOCK, scheduleRevision: "schedule-1", affiliationRevision: "affiliation-1", scheduledStartAt: "2026-01-11T23:00:00.000Z", sourceGameDate: "2026-01-11", ...overrides };
}
export function fixtureVintage(overrides: Partial<Vintage> = {}): Vintage {
  return {
    ...FIXTURE_TARGET, id: "vintage-1", issuanceKey: "daily:2026-01-01:9900001:2099020010", sequence: 1, teamId: 1, opponentId: 2, home: true,
    horizon: 10, episodeId: "episode-H10-1", lockEpochId: "lock-1", scheduleRevision: "schedule-1", affiliationRevision: "affiliation-1",
    sourceGameDate: "2026-01-11", scheduledStartAt: "2026-01-11T23:00:00.000Z", inputCutoffAt: FIXTURE_CLOCK, generatedAt: "2026-01-01T12:00:01.000Z",
    means: fixtureMeans(), participation: { event: CONDITIONING, probability: unavailable("not_qualified"), verifiedStatus: "unknown", modelVersion: "fixture-appearance-v1", qualificationId: null, evidenceIds: [] },
    distribution: unavailable("not_fitted"), calibration: unavailable("not_calibrated"), scoring: DEFAULT_SCORING, modelVersion: "fixture-model-v1", featureVersion: "fixture-feature-v1", codeVersion: "fixture-code-v1",
    cohort: "synthetic-skater", qualificationId: null, sourceManifest: [fixtureSource()], trigger: "daily", predecessorId: null, evidenceClass: "fixture", limitations: ["synthetic_unqualified"], ...overrides,
  };
}
export function fixturePublished(overrides: Partial<Vintage> = {}, confirmedAt = "2026-01-01T12:00:02.000Z"): PublishedVintage {
  const vintage = fixtureVintage(overrides);
  return { vintage, receipt: { id: `receipt:${vintage.id}`, vintageId: vintage.id, outputHash: contentHash(vintage), confirmedAt, witness: "committed_readback", evidenceClass: vintage.evidenceClass } };
}
export function fixtureOutcome(overrides: Partial<OutcomeRevision> = {}): OutcomeRevision {
  return { ...FIXTURE_TARGET, id: "outcome-1", predecessorId: null, appearance: "official_appearance", values: Object.fromEntries(CATEGORIES.map(c => [c, available(c === "PIM" ? 2 : 0)])) as CategoryMeans, status: "final", source: fixtureSource({ observedAt: "2026-01-12T03:00:00.000Z", publishedAt: null, firstReceivedAt: "2026-01-12T03:01:00.000Z" }), recordedAt: "2026-01-12T03:02:00.000Z", reason: "Synthetic zero-minute penalty-only official credit", ...overrides };
}

export const FIXTURE_CASES = {
  injured: fixtureAffiliation({ status: "injury_reserve" }),
  reserve: fixtureAffiliation({ playerId: 9900002, status: "reserve" }),
  callUp: fixtureAffiliation({ playerId: 9900003, effectiveAt: "2026-01-01T13:00:00.000Z", source: fixtureSource({ firstReceivedAt: "2026-01-01T13:05:00.000Z" }) }),
  trade: fixtureAffiliation({ teamId: 3, revision: "affiliation-trade", effectiveAt: "2026-01-02T13:00:00.000Z", source: fixtureSource({ firstReceivedAt: "2026-01-02T13:05:00.000Z" }) }),
  missingPim: fixtureMeans({ PIM: unavailable("source_incomplete") }),
  sparse: fixtureMeans(Object.fromEntries(CATEGORIES.map(c => [c, unavailable("sparse_history")])) as CategoryMeans),
  penaltyOnly: fixtureOutcome(),
  dressedUnused: fixtureOutcome({ appearance: "dressed_unused" }),
  nonappearance: fixtureOutcome({ appearance: "nonappearance" }),
  ambiguous: fixtureOutcome({ appearance: "ambiguous" }),
};
