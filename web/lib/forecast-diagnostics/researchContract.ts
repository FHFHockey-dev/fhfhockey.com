import type { SourceEvidence } from "./contract";
import type { researchPairDiagnosticReport } from "./frozenResearchPair";
export type ResearchDiagnosticsReport = ReturnType<typeof researchPairDiagnosticReport>;
export const RESEARCH_DIAGNOSTICS_VERSION = "frozen-research-pair-v1";
const number = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0;
const time = (s: unknown) => typeof s === "string" && Number.isFinite(Date.parse(s));
const cells = (c: any) => c && typeof c === "object" && Object.keys(c).length === 24
  && Object.entries(c).every(([k, v]) => /^(REG|OT):(both_present|attacking_absent|defending_absent|both_absent):(equal_skaters|more_skaters|fewer_skaters)$/.test(k) && number(v));
/** Browser-safe shape guard. Raw source/hash replay remains mandatory in the server loader. */
export function isResearchDiagnosticsReport(value: unknown): value is ResearchDiagnosticsReport {
  const r: any = value;
  const f = r?.researchForecast, scope = r?.scope, forecast = f?.forecast;
  if (r?.contractVersion !== RESEARCH_DIAGNOSTICS_VERSION || !["synthetic_fixture", "prospective_capture"].includes(r.evidenceKind)
    || r.acceptanceEligible !== false || !scope || !Number.isSafeInteger(scope.gameId) || !Number.isSafeInteger(scope.seasonId)
    || scope.phase !== 2 || scope.horizonGames !== 1 || !time(scope.startAt) || !time(scope.cutoffAt) || !time(r.issuedAt)
    || !Number.isSafeInteger(scope.homeTeamId) || !Number.isSafeInteger(scope.awayTeamId) || scope.homeTeamId === scope.awayTeamId
    || Date.parse(r.issuedAt) < Date.parse(scope.cutoffAt) || Date.parse(r.issuedAt) >= Date.parse(scope.startAt)
    || typeof r.forecastSetId !== "string" || r.forecastSetId !== f?.pairId || f?.scope?.gameId !== scope.gameId
    || f.acceptanceEligible !== false || f.qualifiedFullGameMean !== null || f.qualifiedDifference !== null
    || f.meanSemantics !== "given_game_played" || forecast?.scope?.pGamePlayed !== null || forecast.acceptanceEligible !== false
    || forecast.scope.gameId !== scope.gameId || forecast.scope.seasonId !== scope.seasonId
    || forecast.scope.homeTeamId !== scope.homeTeamId || forecast.scope.awayTeamId !== scope.awayTeamId
    || Date.parse(forecast.scope.startAt) !== Date.parse(scope.startAt) || Date.parse(forecast.scope.asOf) !== Date.parse(scope.cutoffAt)
    || !number(f.baseline?.homeMean) || !number(f.baseline?.awayMean)
    || forecast.fullGameContractEligible !== false || !Array.isArray(forecast.models) || forecast.models.length !== 3
    || !["not_verified", "verified"].includes(r.replay?.status) || !Array.isArray(r.limitations) || !r.limitations.every((x: unknown) => typeof x === "string")
    || !r.modelFreezes?.research || !r.modelFreezes?.team || !Array.isArray(r.sources) || !r.sources.length) return false;
  return forecast.models.every((model: any, i: number) => model?.model === ["empirical", "smoothed", "opponent_blended"][i]
    && Array.isArray(model.teams) && model.teams.length === 2 && model.teams.every((team: any, side: number) =>
      team?.teamId === [scope.homeTeamId, scope.awayTeamId][side] && team.model === model.model
      && number(team.goalMeanGivenGamePlayed) && team.unconditionalGoalsMean === null && team.fullGameEligible === false
      && team.futureRosterMembershipProved === false && cells(team.cellMeansGivenGamePlayed)
      && Array.isArray(team.historyGameIds) && team.historyGameIds.length > 0 && team.historyGameIds.length <= 20
      && team.historyGameIds.every((id: unknown) => Number.isSafeInteger(id))
      && typeof team.rosterRevisionId === "string" && ["official_current_snapshot", "latest_observed_box_population"].includes(team.rosterBasis)
      && Array.isArray(team.players) && team.players.length > 0 && team.players.length <= 100
      && new Set(team.players.map((p: any) => p?.playerId)).size === team.players.length
      && team.players.every((p: any) => Number.isSafeInteger(p?.playerId) && p.playerId > 0 && ["C", "L", "R", "D", "G"].includes(p.position)
        && Number.isSafeInteger(p.observedPositiveToiAppearances) && p.observedPositiveToiAppearances >= 0
        && (p.conditionalGoalsPerPlayingAppearance === null || number(p.conditionalGoalsPerPlayingAppearance))
        && number(p.goalMeanGivenGamePlayed) && p.unconditionalGoalsMean === null && cells(p.cellMeansGivenGamePlayed)
        && number(p.participation?.positiveToiProbability) && p.participation.positiveToiProbability <= 1
        && p.participation.dressingProbability === null && p.participation.statisticalCreditProbability === null && p.participation.confirmed === false)
      && typeof team.residual?.contributorId === "string" && typeof team.residual.reason === "string"
      && number(team.residual.goalMeanGivenGamePlayed) && team.residual.unconditionalGoalsMean === null && cells(team.residual.cellMeansGivenGamePlayed)))
    && r.sources.every((s: any) => typeof s?.revisionId === "string" && /^[a-f0-9]{64}$/.test(s.rawBytesHash)
      && typeof s.provenance?.source === "string" && /^[a-f0-9]{64}$/.test(s.provenance.payloadHash)
      && s.provenance.revisionId === s.revisionId && ["original_source", "retained_capture"].includes(s.provenance.availabilityBasis)
      && (s.provenance.publishedAt === null || time(s.provenance.publishedAt))
      && time(s.provenance.firstReceivedAt) && time(s.provenance.verifiedAt));
}

export function researchDiagnosticSources(report: ResearchDiagnosticsReport): SourceEvidence[] {
  return report.sources.map(s => ({ source: s.provenance.source, revisionId: s.revisionId, payloadHash: s.provenance.payloadHash,
    observedAt: s.provenance.publishedAt, availableAt: new Date(Math.max(Date.parse(s.provenance.firstReceivedAt), Date.parse(s.provenance.verifiedAt),
      s.provenance.publishedAt === null ? -Infinity : Date.parse(s.provenance.publishedAt))).toISOString(), retrievedAt: s.provenance.firstReceivedAt,
    availabilityBasis: s.provenance.availabilityBasis, immutable: true, hashVerified: true }));
}
export function researchDiagnosticsMarkdown(report: ResearchDiagnosticsReport) {
  return `# Exploratory played-game GOALS evidence\n\nPair: ${report.forecastSetId}\n\nQualified comparison: unavailable.\n\n`+
    `Exact displayed research evidence:\n\n\`\`\`json\n${JSON.stringify(report, null, 2)}\n\`\`\`\n`;
}
