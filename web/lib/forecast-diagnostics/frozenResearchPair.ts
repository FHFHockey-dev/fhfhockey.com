import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { availableBefore, pairScopeSchema, provenanceSchema, scoreTeamGoals, TEAM_GOALS_FEATURES,
  TEAM_GOALS_PARAMETERS, TEAM_GOALS_VERSION, modelFreezeSchema, type ModelFreeze } from "./pairedInputs";
import { projectionInputHash } from "../projections/inputCapture";
import { auditNativeGoalLedger } from "../projections/nativeGoalLedgerAudit";
import { evaluateRetainedResearchGoals, RESEARCH_GOAL_CELLS } from "../projections/researchGoalBaseline";
import { forecastResearchGameGoals, researchGoalHistoryFromReplay, researchRosterFromOfficialRevision,
  RESEARCH_GAME_GOALS_VERSION, RESEARCH_GAME_GOALS_PARAMETERS } from "../projections/researchGameGoals";

export const FROZEN_RESEARCH_PAIR_VERSION = "frozen-research-pair-v1";
const instant = z.string().datetime({ offset: true });
const rawRevision = z.object({ revisionId: z.string().min(1), payload: z.any(), bodyUtf8: z.string().max(8 * 1024 * 1024),
  rawBytesHash: z.string().regex(/^[a-f0-9]{64}$/), url: z.string(), provenance: provenanceSchema }).passthrough();
const sourcesSchema = z.object({ historyBundle: z.any(), attributeAudit: z.any(),
  ledgerRevisions: z.array(rawRevision).min(1).max(202), boxscoreRevisions: z.array(rawRevision).min(1).max(200),
  rosterRevisions: z.array(rawRevision).length(2), targetScheduleRevisions: z.array(rawRevision).length(2) }).strict();
export const researchPairSpecSchema = z.object({ evidenceKind: z.enum(["prospective_capture", "synthetic_fixture"]),
  scope: pairScopeSchema, abilityCutoffAt: instant, featureCutoffAt: instant, sources: sourcesSchema }).strict();
export const frozenResearchPairSchema = researchPairSpecSchema.extend({ version: z.literal(FROZEN_RESEARCH_PAIR_VERSION),
  pairId: z.string().uuid(), researchRunId: z.string().uuid(), teamRunId: z.string().uuid(), frozenAt: instant,
  researchFreeze: modelFreezeSchema, teamFreeze: modelFreezeSchema, acceptanceEligible: z.literal(false) }).strict();
export type FrozenResearchPair = z.infer<typeof frozenResearchPairSchema>;
export type ResearchPairSpec = z.infer<typeof researchPairSpecSchema>;
const digest = (body: string) => createHash("sha256").update(body).digest("hex");
export const RESEARCH_PAIR_FEATURES = ["selected_verified_team_games", "official_positive_TOI", "official_credited_GOALS",
  "official_observed_roster", ...RESEARCH_GOAL_CELLS] as const;

export function researchPairFreezes(common: Pick<ModelFreeze, "codeCommit" | "sourceTreeHash" | "lockfileHash" | "nodeVersion">,
  parserSourceHash: string): { research: ModelFreeze; team: ModelFreeze } {
  const parameters = { ...RESEARCH_GAME_GOALS_PARAMETERS, parserSourceHash, pGamePlayed: null,
    variants: ["empirical", "smoothed", "opponent_blended"], participationCalibration: "deterministic_common_logit_role_count" };
  return { research: { ...common, modelVersion: RESEARCH_GAME_GOALS_VERSION, featureSchemaVersion: FROZEN_RESEARCH_PAIR_VERSION,
    featureNames: [...RESEARCH_PAIR_FEATURES], parameters, parametersHash: projectionInputHash(parameters), calibration: { kind: "none" } },
  team: { ...common, modelVersion: TEAM_GOALS_VERSION, featureSchemaVersion: TEAM_GOALS_VERSION, featureNames: [...TEAM_GOALS_FEATURES],
    parameters: TEAM_GOALS_PARAMETERS, parametersHash: projectionInputHash(TEAM_GOALS_PARAMETERS), calibration: { kind: "none" } } };
}

function verifyRevision(source: z.infer<typeof rawRevision>, cutoffAt: string, frozenAt: string) {
  if (source.revisionId !== source.provenance.revisionId || source.url !== source.provenance.source
    || digest(source.bodyUtf8) !== source.rawBytesHash || projectionInputHash(JSON.parse(source.bodyUtf8)) !== projectionInputHash(source.payload)
    || projectionInputHash(source.payload) !== source.provenance.payloadHash || !availableBefore(source.provenance, cutoffAt)
    || Date.parse(source.provenance.verifiedAt) > Date.parse(frozenAt)) throw new Error("Unverified, late or future research source");
}

/** Replays immutable historical evidence under its original scope before applying the explicit future target. */
export function replayResearchPairInputs(packetInput: FrozenResearchPair) {
  const packet = frozenResearchPairSchema.parse(packetInput), { scope, sources } = packet;
  if (Buffer.byteLength(JSON.stringify(packet)) > 32 * 1024 * 1024) throw new Error("Research packet exceeds 32 MiB bound");
  if (!(Date.parse(packet.abilityCutoffAt) <= Date.parse(packet.featureCutoffAt)
    && Date.parse(packet.featureCutoffAt) <= Date.parse(packet.frozenAt) && Date.parse(packet.frozenAt) < Date.parse(scope.cutoffAt)))
    throw new Error("Research cutoffs must precede frozen time and the issuance cutoff");
  if (new Set([packet.pairId, packet.researchRunId, packet.teamRunId]).size !== 3) throw new Error("Research run identities must be distinct");
  const all = [...sources.ledgerRevisions, ...sources.boxscoreRevisions, ...sources.rosterRevisions, ...sources.targetScheduleRevisions];
  for (const role of [sources.ledgerRevisions, sources.boxscoreRevisions, sources.rosterRevisions, sources.targetScheduleRevisions]) {
    if (new Set(role.map(source => source.revisionId)).size !== role.length) throw new Error("Duplicate research source revision");
  }
  const historicalPbpIds = new Set(sources.historyBundle.retainedHistorySources.map((source: any) => source.revisionId));
  const ids = new Set<string>();
  for (const source of all) {
    if (ids.has(source.revisionId)) {
      const historySchedule = sources.ledgerRevisions.find(revision => revision.revisionId === source.revisionId);
      const targetSchedule = sources.targetScheduleRevisions.find(revision => revision.revisionId === source.revisionId);
      // One genuine observation can serve both schedule roles; its entire envelope must agree.
      if (source !== targetSchedule || !historySchedule || !targetSchedule
        || !sources.historyBundle.scheduleSources.some((revision: any) => revision.revisionId === source.revisionId)
        || projectionInputHash(historySchedule) !== projectionInputHash(targetSchedule))
        throw new Error("Duplicate research source revision");
    }
    ids.add(source.revisionId);
    verifyRevision(source, packet.featureCutoffAt, packet.frozenAt);
    if (historicalPbpIds.has(source.revisionId)
      && (source.url !== `https://api-web.nhle.com/v1/gamecenter/${source.payload?.id}/play-by-play` || source.httpStatus !== 200))
      throw new Error("Historical PBP requires its official endpoint and retained HTTP 200 success evidence");
  }
  if (sources.historyBundle.scope.seasonId !== scope.seasonId
    || projectionInputHash([sources.historyBundle.scope.homeTeamId, sources.historyBundle.scope.awayTeamId].sort((a, b) => a - b))
      !== projectionInputHash([scope.homeTeamId, scope.awayTeamId].sort((a, b) => a - b)))
    throw new Error("Historical research population differs from the explicit prospective teams/season");
  const ledger = auditNativeGoalLedger({ historyBundle: sources.historyBundle, revisions: sources.ledgerRevisions,
    attributeAudit: sources.attributeAudit, parserSourceHash: String(packet.researchFreeze.parameters.parserSourceHash) });
  const evaluation = evaluateRetainedResearchGoals({ ledger, historyBundle: sources.historyBundle, boxscoreRevisions: sources.boxscoreRevisions });
  const history = researchGoalHistoryFromReplay({ evaluation, ledger, boxscoreRevisions: sources.boxscoreRevisions });
  const rosters = [scope.homeTeamId, scope.awayTeamId].map(teamId => {
    const matches = sources.rosterRevisions.filter(source => source.teamId === teamId);
    const identityBox = sources.boxscoreRevisions.find(source => [source.payload.homeTeam.id, source.payload.awayTeam.id].includes(teamId));
    if (matches.length !== 1 || !identityBox) throw new Error("Missing or ambiguous public roster/team identity");
    const source = matches[0];
    const schedules = sources.targetScheduleRevisions.filter(schedule => schedule.url
      === `https://api-web.nhle.com/v1/club-schedule-season/${source.teamAbbrev}/${scope.seasonId}`);
    if (schedules.length !== 1 || schedules[0].httpStatus !== 200) throw new Error("Explicit target requires a retained successful official team schedule");
    const games = schedules[0].payload.games;
    if (!Array.isArray(games) || new Set(games.map((game: any) => game.id)).size !== games.length) throw new Error("Invalid prospective schedule population");
    // Validate before filtering: an unclassifiable time must never disappear as Date.parse(NaN).
    z.array(z.object({ id: z.number().int().positive().safe(), season: z.number().int().positive().safe(),
      gameType: z.number().int().positive(), gameState: z.string().min(1), startTimeUTC: instant,
      homeTeam: z.object({ id: z.number().int().positive().safe() }), awayTeam: z.object({ id: z.number().int().positive().safe() }),
    })).max(300).parse(games);
    const target = games.filter((game: any) => game.id === scope.gameId);
    if (target.length !== 1 || target[0].season !== scope.seasonId || target[0].gameType !== 2
      || target[0].gameDate !== scope.gameDate || Date.parse(target[0].startTimeUTC) !== Date.parse(scope.startAt)
      || target[0].homeTeam?.id !== scope.homeTeamId || target[0].awayTeam?.id !== scope.awayTeamId
      || !["FUT", "PRE"].includes(target[0].gameState)) throw new Error("Explicit prospective target differs from observed schedule");
    const priorGames = games.filter((game: any) => game.season === scope.seasonId && game.gameType === 2
      && [game.homeTeam?.id, game.awayTeam?.id].includes(teamId)
      && Date.parse(game.startTimeUTC) < Date.parse(packet.abilityCutoffAt));
    if (!availableBefore(schedules[0].provenance, packet.abilityCutoffAt)
      || priorGames.some((game: any) => !["OFF", "FINAL"].includes(game.gameState)))
      throw new Error("Latest history-window schedule is unavailable or contains unresolved prior games");
    const expectedIds = priorGames.sort((a: any, b: any) => Date.parse(b.startTimeUTC) - Date.parse(a.startTimeUTC) || b.id - a.id)
      .slice(0, TEAM_GOALS_PARAMETERS.historyLimit).map((game: any) => game.id).sort((a: number, b: number) => a - b);
    const selectedIds = history.filter(game => game.teamId === teamId).map(game => game.gameId).sort((a, b) => a - b);
    if (projectionInputHash(expectedIds) !== projectionInputHash(selectedIds))
      throw new Error("Retained training window is stale or incomplete for the explicit prospective scope");
    return researchRosterFromOfficialRevision(source, { teamId, teamAbbrev: String(source.teamAbbrev), seasonId: scope.seasonId,
      featureCutoffAt: packet.featureCutoffAt }, identityBox);
  });
  const forecast = forecastResearchGameGoals({ scope: { gameId: scope.gameId, seasonId: scope.seasonId, phase: 2,
    homeTeamId: scope.homeTeamId, awayTeamId: scope.awayTeamId, startAt: scope.startAt, abilityCutoffAt: packet.abilityCutoffAt,
    featureCutoffAt: packet.featureCutoffAt, asOf: scope.cutoffAt, pGamePlayed: null }, history, rosters });
  const baseline = scoreTeamGoals(scope, sources.historyBundle.history);
  const blend = forecast.models.find(model => model.model === "opponent_blended")!.teams;
  if (baseline.homeMean === null || baseline.awayMean === null
    || Math.abs(blend[0].goalMeanGivenGamePlayed - baseline.homeMean) > 1e-10
    || Math.abs(blend[1].goalMeanGivenGamePlayed - baseline.awayMean) > 1e-10)
    throw new Error("Research and independent baseline must use identical team history windows");
  return { forecast, baseline, historicalScopePreserved: sources.historyBundle.scope, inputHash: projectionInputHash(packet),
    pairId: packet.pairId, researchRunId: packet.researchRunId, teamRunId: packet.teamRunId,
    scope, meanSemantics: "given_game_played" as const, acceptanceEligible: false as const,
    qualifiedFullGameMean: null, qualifiedDifference: null, hostedWrites: 0 };
}

export function validateResearchPairFreeze(packet: FrozenResearchPair, execution: ReturnType<typeof researchPairFreezes>) {
  if (projectionInputHash(packet.researchFreeze) !== projectionInputHash(execution.research)
    || projectionInputHash(packet.teamFreeze) !== projectionInputHash(execution.team)) throw new Error("Research frozen code/features/parameters/calibration differ from execution");
}

export function assembleFrozenResearchPair(specInput: unknown, execution: ReturnType<typeof researchPairFreezes>, frozenAt: string) {
  const spec = researchPairSpecSchema.parse(specInput);
  const packet = frozenResearchPairSchema.parse({ ...spec, version: FROZEN_RESEARCH_PAIR_VERSION, pairId: randomUUID(),
    researchRunId: randomUUID(), teamRunId: randomUUID(), frozenAt, researchFreeze: execution.research, teamFreeze: execution.team, acceptanceEligible: false });
  validateResearchPairFreeze(packet, execution);
  replayResearchPairInputs(packet);
  return packet;
}

export function researchPairDiagnosticReport(packet: FrozenResearchPair, forecasts: ReturnType<typeof replayResearchPairInputs>, issuedAt: string, verified: boolean) {
  instant.parse(issuedAt);
  if (forecasts.inputHash !== projectionInputHash(packet) || forecasts.pairId !== packet.pairId
    || projectionInputHash(forecasts) !== projectionInputHash(replayResearchPairInputs(packet))
    || Date.parse(issuedAt) < Date.parse(packet.scope.cutoffAt) || Date.parse(issuedAt) >= Date.parse(packet.scope.startAt))
    throw new Error("Research diagnostic identity or issuance differs");
  return { contractVersion: FROZEN_RESEARCH_PAIR_VERSION, forecastSetId: packet.pairId, evidenceKind: packet.evidenceKind,
    issuedAt, scope: packet.scope, researchForecast: forecasts, modelFreezes: { research: packet.researchFreeze, team: packet.teamFreeze },
    replay: { status: verified ? "verified" : "not_verified" }, acceptanceEligible: false,
    sources: [...new Map([...packet.sources.ledgerRevisions, ...packet.sources.boxscoreRevisions,
      ...packet.sources.rosterRevisions, ...packet.sources.targetScheduleRevisions].map(source => [source.revisionId, source])).values()].map(source => ({
      revisionId: source.revisionId, rawBytesHash: source.rawBytesHash, provenance: source.provenance })),
    limitations: ["Exploratory GOALS research; this is not a FORGE producer forecast or model acceptance.",
      "All means are given the game being played; occurrence probability and unconditional means remain null.",
      "Empirical/smoothed team budgets agree and opponent blend equals the baseline by construction; this is not predictive lift.",
      ...forecasts.forecast.limitations] };
}
export function researchPairDiagnosticsMarkdown(report: ReturnType<typeof researchPairDiagnosticReport>) {
  return `# Exploratory played-game GOALS evidence\n\nPair: ${report.forecastSetId}\n\nQualified comparison: unavailable.\n\n`+
    `Exact displayed research evidence:\n\n\`\`\`json\n${JSON.stringify(report, null, 2)}\n\`\`\`\n`;
}
