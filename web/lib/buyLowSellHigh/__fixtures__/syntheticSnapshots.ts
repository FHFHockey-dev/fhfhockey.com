/** Authored contract records, not copied, redacted or derived from retained player data.
 * Fake pins/identities assert structure only; they confer no source acceptance.
 */
import type { BlshResearchSnapshot } from "../researchSnapshot";
import type { DisplaySnapshot } from "../displayProfile";
const version = "support-conditioned-production-gap-v1";
export function syntheticHistorical(): BlshResearchSnapshot {
  const profile: BlshResearchSnapshot["profiles"][number] = {
    playerId: 900001, displayName: "Synthetic Forward", nameKind: "synthetic", team: "AAA", position: "F",
    snapshotDate: "2024-04-18", sourceLine: 1, sourceProfileSHA256: "a".repeat(64),
    score: { version, value: 50, normalizedGap: 1, productionVersion: "synthetic", productionP: 25,
      status: "concordant_research_candidate", evidenceTier: "measured_process_personal_reference", sourceResearchList: "BL", list: "BL", rank: 1,
      trusted: false, confidenceProbability: null, actual: [8, 2, 0], baseline: [10, 3, 1], support: [10, 3, 1], adjustment: [0, 0, 0] },
    reference: { personalGames: 20, personalWeight: 0.8, cohortWeight: 0.2, referenceAgeDays: 60, currentAgeDays: 0,
      currentSourceIds: [1], currentDates: ["2024-04-18"], referenceSourceIds: [101], referenceDates: ["2024-02-18"] },
    coverage: { noCurrent: false, freshProxy: true, shots: 0, shotsPerAppearance: 0, currentProcess: [1, 2, 3], process: null,
      modelBinding: {}, processAdmission: null, fittingRank: 3, donorPlayers: 12 }, families: {}, context: {}, streak: null,
  };
  const streak = structuredClone(profile); streak.playerId = 900002; streak.score.rank = 2;
  streak.streak = { playerId: 900002, eventThroughDate: "2024-04-18", detectorVersion: "blsh-overnight-three-track-v2", researchOption: "block5",
    productionAdopted: false, issuedAtUTC: null, sourceFile: "synthetic", sourceSHA256: "b".repeat(64), saved: {
      version: "blsh-overnight-three-track-v2", researchOption: "block5", productionAdopted: false,
      tracks: Object.fromEntries(["fantasy_points", "raw_points", "wigo_game_score", "composite"].map(key => [key, {
        status: "unavailable", availability: "unavailable", reason: "synthetic", issuedAtUTC: null, retrospectivePhaseLabelsIncluded: false, observation: null,
      }])),
    } };
  const missing = structuredClone(profile); missing.playerId = 900003;
  Object.assign(missing.score, { value: null, normalizedGap: null, productionP: null, status: "unavailable", evidenceTier: "unavailable", list: null, sourceResearchList: null, rank: null });
  return { schemaVersion: "fhfh.blsh.historical-snapshot.v1", snapshotId: "authored-synthetic", eventThroughDate: "2024-04-18", seasonId: 20232024,
    scope: "historical_development", scoreVersion: version, productionAdopted: false, trusted: false, confidenceProbability: null,
    sourceAvailableThroughUTC: null, retrievedAtUTC: null, issuedAtUTC: null, packagedAtUTC: "2024-04-19T00:00:00Z", sourceRunCompletedAtUTC: "2024-04-18T23:00:00Z",
    sourcePins: { synthetic: "a".repeat(64) }, streakFixturePins: {}, scoringProfile: "Synthetic contract", limits: ["Authored fixture; no empirical coverage"], profiles: [profile, streak, missing] };
}

/** Literal legacy display record, deliberately independent of buildDisplaySnapshot and the scorer. */
export function syntheticCurrent(): DisplaySnapshot {
  const p = {
    playerId: 900001, displayName: "Synthetic Forward", team: "AAA", position: "F",
    score: { version, value: 50, normalizedGap: 1, baselineNormalizedGap: 1, status: "concordant_research_candidate", gapSign: "buy_low_evidence",
      gapSignLabel: "Buy-low evidence", list: "BL", rank: 1, trusted: false, calibratedProbability: null, directionWithheldReason: null, directionWithheldText: null },
    evidence: { tier: "measured_process_personal_reference", calibratedProbability: null,
      window: { games: 5, dates: ["2026-10-18", "2026-10-20", "2026-10-22", "2026-10-24", "2026-10-26"], sourceIds: [1, 2, 3, 4, 5], fresh: true, recordedThroughDate: "2026-10-26" },
      reference: { personalGames: 20, dates: ["2024-04-18"], sourceIds: [101], seasons: [20232024], estimatorWeight: 0.8, cohortEstimatorWeight: 0.2 } },
    // Three gaps of 2, each normalized by 1/6: joint gap 1; bounded index 50.
    tracks: ["fantasy_points", "goals_plus_assists", "wigo_game_score"].map((track, i) => ({ track, label: track,
      observed: [8, 2, 0][i], referenceAtCurrentTOI: [10, 4, 2][i], supportConditioned: [10, 4, 2][i], gap: 2, componentSum: 2,
      normalizationMultiplier: 1 / 6, normalizedGapContribution: 1 / 3, baselineNormalizedGapContribution: 1 / 3,
      components: [{ id: "production_vs_reference", value: 2 }] })),
    coverage: { notes: [{ component: "personal_reference", text: "Synthetic profile note", games: null }], context: {
      current: { verified: true, reason: null, text: null }, reference: { verified: true, reason: null, text: null } } },
    context: { signals: [{ metric: "shots_per_60", current: 0, scoreInput: false, interpretation: "hypothesis" }] },
    claims: { luckIdentified: false, marketValue: false, forecast: false, trusted: false }, streak: null,
  };
  const missing = structuredClone(p); missing.playerId = 900003;
  Object.assign(missing.score, { value: null, normalizedGap: null, status: "unavailable", gapSign: null, list: null, rank: null, reason: "no_measured_current_production_or_exposure" });
  Object.assign(missing.evidence, { tier: null }); missing.tracks = [];
  return { schemaVersion: "fhfh.blsh.current-research-snapshot.v2", mapperVersion: "blsh-display-profile-v1", scoreVersion: version,
    scope: "current_season_research", seasonId: 20262027, eventThroughDate: "2026-10-26", provisional: true, exploratory: true,
    trusted: false, productionAdopted: false, confidenceProbability: null, issuedAtUTC: null, asOfUTC: "2026-10-27T00:00:00Z", packagedAtUTC: "2026-10-29T00:00:00Z",
    referencePolicy: { arm: "A_development_reference", inputs: "official_receipt_overlay", stale: true, provisional: true, selectedBy: "TJ", selectedAtUTC: "2026-10-28T00:00:00Z", label: "Synthetic contract policy; no source admission" },
    historyGate: "Synthetic", overlay: "Synthetic", limits: ["Authored fixture"], sourcePins: { synthetic: "a".repeat(64) }, profiles: [p, missing],
    counts: { profiles: 2, BL: 1, SH: 0, withheld: 1, numeric: 1, unavailableTier: 1 },
  } as unknown as DisplaySnapshot;
}
