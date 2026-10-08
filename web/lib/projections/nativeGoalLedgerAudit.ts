import { createHash } from "node:crypto";
import { z } from "zod";
import { availableBefore, goalHistoryFromOfficialFinal, historicalGameSchema, provenanceSchema } from "../forecast-diagnostics/pairedInputs";
import { parseSituationCode } from "../supabase/Upserts/nhlStrengthState";
import { projectionInputHash } from "./inputCapture";

export const NATIVE_GOAL_LEDGER_AUDIT_VERSION = "native-goal-ledger-audit-v1";
const id = z.number().int().positive();
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const revisionId = z.string().regex(/^[A-Za-z0-9-]{1,128}$/);
const instant = z.string().datetime({ offset: true });
const sourceSchema = z.object({ revisionId, payload: z.any(), bodyUtf8: z.string().max(8 * 1024 * 1024), rawBytesHash: hash });
const bundleSchema = z.object({
  scope: z.object({ gameId: id, seasonId: id, phase: z.literal(2), homeTeamId: id, awayTeamId: id,
    startAt: instant, cutoffAt: instant, horizonGames: z.literal(1) }).strict(),
  history: z.array(historicalGameSchema).min(1).max(200),
  retainedHistorySources: z.array(sourceSchema).min(1).max(200),
  scheduleSources: z.array(sourceSchema).length(2),
  population: z.array(z.object({ teamId: id, selectedGameIds: z.array(id).min(1).max(20), incompleteGameIds: z.array(id).max(20) })).length(2),
  capturedAt: instant,
  acceptanceEligible: z.literal(false),
});
const revisionSchema = sourceSchema.extend({ provenance: provenanceSchema, url: z.string().min(1) });

export type NativeLedgerGap = { code: string; gameId?: number; eventId?: number; teamId?: number; gameIds?: number[]; requirement: string };
export type NativeLedgerEvent = {
  gameId: number; eventId: number; teamId: number; playerId: number | null;
  kind: "goal" | "shot-on-goal"; period: "REG" | "OT"; periodNumber: number;
  elapsedSeconds: number | null; rawSituationCode: string | null;
  attackingGoalie: number | null; defendingGoalie: number | null;
  attackingSkaters: number | null; defendingSkaters: number | null;
  netState: "both_present" | "attacking_absent" | "defending_absent" | "both_absent" | "unknown";
  skaterRelation: "equal_skaters" | "more_skaters" | "fewer_skaters" | "unknown";
  ordinaryRegStrength: "ES" | "PP" | "PK" | null;
  goalieInNetId: number | null;
  creditClass: "shot_on_goal_event" | "goal_with_shot_type" | "goal_shot_credit_unproved";
  ledgerCell: string;
};
const positiveId = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const counts = (keys: string[]) => Object.fromEntries([...new Set(keys)].sort().map(key => [key, keys.filter(value => value === key).length]));
const equal = (left: unknown, right: unknown) => projectionInputHash(left) === projectionInputHash(right);

/** Event clocks are point observations in seconds, never elapsed player exposure. */
export function nativeEventClockSeconds(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{1,2}:[0-5]\d$/.test(value)) return null;
  const [minutes, seconds] = value.split(":").map(Number);
  return minutes * 60 + seconds;
}

function ledgerEvent(payload: any, play: any, gaps: NativeLedgerGap[]): NativeLedgerEvent {
  if (!positiveId(play.periodDescriptor.number)) throw new Error("Invalid official event period number");
  const details = play.details ?? {};
  const teamId = details.eventOwnerTeamId;
  if (![payload.homeTeam.id, payload.awayTeam.id].includes(teamId)) throw new Error("Unmapped goal/shot event team");
  const home = teamId === payload.homeTeam.id;
  const parsed = typeof play.situationCode === "string" && /^[01][1-6][1-6][01]$/.test(play.situationCode)
    ? parseSituationCode(play.situationCode) : null;
  const attackingGoalie = parsed ? home ? parsed.homeGoalie : parsed.awayGoalie : null;
  const defendingGoalie = parsed ? home ? parsed.awayGoalie : parsed.homeGoalie : null;
  const attackingSkaters = parsed ? home ? parsed.homeSkaters : parsed.awaySkaters : null;
  const defendingSkaters = parsed ? home ? parsed.awaySkaters : parsed.homeSkaters : null;
  const netState = attackingGoalie === null ? "unknown" : attackingGoalie === 1
    ? defendingGoalie === 1 ? "both_present" : "defending_absent"
    : defendingGoalie === 1 ? "attacking_absent" : "both_absent";
  const skaterRelation = attackingSkaters === null || defendingSkaters === null ? "unknown"
    : attackingSkaters === defendingSkaters ? "equal_skaters" : attackingSkaters > defendingSkaters ? "more_skaters" : "fewer_skaters";
  const ordinaryRegStrength = play.periodDescriptor.periodType !== "REG" || netState !== "both_present" ? null
    : skaterRelation === "equal_skaters" ? "ES" : skaterRelation === "more_skaters" ? "PP" : "PK";
  const player = play.typeDescKey === "goal" ? details.scoringPlayerId : details.shootingPlayerId;
  const playerId = positiveId(player) ? player : null;
  const goalieInNetId = positiveId(details.goalieInNetId) ? details.goalieInNetId : null;
  const elapsedSeconds = nativeEventClockSeconds(play.timeInPeriod);
  const creditClass = play.typeDescKey === "shot-on-goal" ? "shot_on_goal_event"
    : typeof details.shotType === "string" && details.shotType.length ? "goal_with_shot_type" : "goal_shot_credit_unproved";
  const gap = (code: string, requirement: string) => gaps.push({ code, gameId: payload.id, eventId: play.eventId, requirement });
  if (!parsed) gap("event_situation_unproved", "Retain valid goalie bits and skater counts for this event; do not assign a strength zero.");
  if (elapsedSeconds === null) gap("event_clock_unproved", "Retain an unambiguous minute:second event clock; it still cannot establish exposure.");
  if (playerId === null || !payload.rosterSpots?.some((row: any) => row.playerId === playerId && row.teamId === teamId))
    gap("event_player_roster_identity_unproved", "Bind this shooter/scorer to the same-source historical team roster.");
  const defendingTeamId = home ? payload.awayTeam.id : payload.homeTeam.id;
  if (defendingGoalie === 1 && (goalieInNetId === null || !payload.rosterSpots?.some((row: any) => row.playerId === goalieInNetId && row.teamId === defendingTeamId && row.positionCode === "G")))
    gap("event_defending_goalie_identity_unproved", "Bind the reported in-net goalie to the defending historical roster; official GA/SA credit requires separate proof.");
  if (defendingGoalie === 0 && details.goalieInNetId != null)
    gap("event_goalie_presence_conflict", "Resolve the absent defending-goalie bit versus the reported in-net identity.");
  if (creditClass === "goal_shot_credit_unproved") gap("event_goal_sog_credit_unproved", "Retain explicit awarded/non-shot goal and SOG-credit evidence; preserve this goal in official-play counts.");
  return { gameId: payload.id, eventId: play.eventId, teamId, playerId, kind: play.typeDescKey,
    period: play.periodDescriptor.periodType, periodNumber: play.periodDescriptor.number, elapsedSeconds,
    rawSituationCode: typeof play.situationCode === "string" ? play.situationCode : null,
    attackingGoalie, defendingGoalie, attackingSkaters, defendingSkaters, netState, skaterRelation,
    ordinaryRegStrength, goalieInNetId, creditClass,
    ledgerCell: `${play.periodDescriptor.periodType}:${netState}:${skaterRelation}:${creditClass}` };
}

/** Local retained facts only. No query, ingestion, estimator, TOI interpolation or fitted rate. */
export function auditNativeGoalLedger(input: { historyBundle: unknown; revisions: unknown[]; attributeAudit: any; parserSourceHash: string }) {
  const bundle = bundleSchema.parse(input.historyBundle);
  hash.parse(input.parserSourceHash);
  const { scope } = bundle;
  if (scope.homeTeamId === scope.awayTeamId || Date.parse(scope.cutoffAt) >= Date.parse(scope.startAt)) throw new Error("Invalid audit scope");
  if (bundle.history.some(row => ![scope.homeTeamId, scope.awayTeamId].includes(row.teamId))) throw new Error("Historical team outside audit scope");
  const sources = [...bundle.retainedHistorySources, ...bundle.scheduleSources];
  const revisions = input.revisions.map(value => revisionSchema.parse(value));
  if (sources.length !== revisions.length || new Set(sources.map(row => row.revisionId)).size !== sources.length
    || new Set(revisions.map(row => row.revisionId)).size !== revisions.length) throw new Error("Missing or duplicate retained revisions");
  const verified = new Map<string, z.infer<typeof revisionSchema>>();
  for (const source of sources) {
    const revision = revisions.find(row => row.revisionId === source.revisionId);
    if (!revision || revision.revisionId !== revision.provenance.revisionId || revision.url !== revision.provenance.source)
      throw new Error("Retained revision/provenance identity mismatch");
    for (const record of [source, revision]) {
      if (createHash("sha256").update(record.bodyUtf8, "utf8").digest("hex") !== record.rawBytesHash
        || !equal(JSON.parse(record.bodyUtf8), record.payload)
        || projectionInputHash(record.payload) !== revision.provenance.payloadHash) throw new Error("Retained raw bytes or canonical payload mismatch");
    }
    if (source.bodyUtf8 !== revision.bodyUtf8 || source.rawBytesHash !== revision.rawBytesHash)
      throw new Error("Bundle differs from separately retained raw revision");
    if (Date.parse(revision.provenance.verifiedAt) > Date.parse(bundle.capturedAt)) throw new Error("Bundle precedes source verification");
    verified.set(source.revisionId, revision);
  }
  const gaps: NativeLedgerGap[] = [];
  const historyKeys = bundle.history.map(row => `${row.gameId}:${row.teamId}`);
  if (new Set(historyKeys).size !== historyKeys.length) throw new Error("Duplicate team-game history");
  const games = bundle.retainedHistorySources.map(source => {
    const revision = verified.get(source.revisionId)!;
    const payload = revision.payload;
    const derived = goalHistoryFromOfficialFinal(payload, revision.provenance);
    if (payload.periodDescriptor?.periodType === "SO" && derived[0].goalsFor !== derived[1].goalsFor)
      throw new Error("Shootout official-play totals are not tied");
    const histories = bundle.history.filter(row => row.provenance.revisionId === source.revisionId);
    if (!histories.length || histories.some(row => !derived.some(candidate => equal(row, candidate)))) throw new Error("Historical facts differ from raw official final");
    if (payload.id === scope.gameId || payload.season !== scope.seasonId || Date.parse(payload.startTimeUTC) >= Date.parse(scope.cutoffAt)) throw new Error("Out-of-window historical game");
    if (payload.plays.at(-1)?.typeDescKey !== "game-end") throw new Error("Retained final lacks terminal game-end event");
    const roster = z.array(z.object({ playerId: id, teamId: id, positionCode: z.string().min(1) })).min(1).max(100).parse(payload.rosterSpots);
    if (new Set(roster.map(row => row.playerId)).size !== roster.length
      || roster.some(row => ![payload.homeTeam.id, payload.awayTeam.id].includes(row.teamId))) throw new Error("Ambiguous historical roster identity");
    const events = payload.plays.filter((play: any) => ["goal", "shot-on-goal"].includes(play.typeDescKey) && play.periodDescriptor.periodType !== "SO")
      .map((play: any) => ledgerEvent(payload, play, gaps)).sort((a: NativeLedgerEvent, b: NativeLedgerEvent) => a.eventId - b.eventId) as NativeLedgerEvent[];
    const excludedShootoutGoalEventIds = payload.plays.filter((play: any) => play.typeDescKey === "goal" && play.periodDescriptor.periodType === "SO").map((play: any) => play.eventId).sort((a: number, b: number) => a - b);
    const teams = [payload.homeTeam, payload.awayTeam].sort((a, b) => a.id - b.id).map(team => {
      const observedGoals = events.filter(row => row.teamId === team.id && row.kind === "goal").length;
      const candidateSog = events.filter(row => row.teamId === team.id).length;
      const officialSog = z.number().int().nonnegative().parse(team.sog);
      const finalScore = z.number().int().nonnegative().parse(team.score);
      const teamSogEventParity = candidateSog === officialSog;
      if (!teamSogEventParity) gaps.push({ code: "team_sog_event_parity_unproved", gameId: payload.id, teamId: team.id,
        requirement: "Resolve candidate goal/shot events against the official team SOG and exceptional-credit rules." });
      return { teamId: team.id, observedOfficialPlayGoals: observedGoals, finalScore,
        shootoutStandingsAdjustment: finalScore - observedGoals, candidateSog, officialSog, teamSogEventParity };
    });
    const availableAtProspectiveCutoff = availableBefore(revision.provenance, scope.cutoffAt);
    const availableBeforeHistoricalStart = availableBefore(revision.provenance, payload.startTimeUTC);
    if (!availableAtProspectiveCutoff) gaps.push({ code: "source_unavailable_at_prospective_cutoff", gameId: payload.id,
      requirement: "Retain receipt and verification strictly before the proposed cutoff; later observations cannot backfill availability." });
    return { gameId: payload.id, revisionId: source.revisionId, rawBytesHash: source.rawBytesHash,
      canonicalPayloadHash: revision.provenance.payloadHash, startAt: payload.startTimeUTC,
      provenance: revision.provenance, availableAtProspectiveCutoff, availableBeforeHistoricalStart,
      officialPlayGoalCount: events.filter(row => row.kind === "goal").length,
      goalLedgerCounts: counts(events.filter(row => row.kind === "goal").map(row => row.ledgerCell)),
      excludedShootoutGoalEventIds, teams, roster, events };
  }).sort((a, b) => a.gameId - b.gameId);
  if (new Set(games.map(row => row.gameId)).size !== games.length || bundle.history.some(row => !games.some(game => game.revisionId === row.provenance.revisionId && game.gameId === row.gameId)))
    throw new Error("Missing or duplicate historical game sources");

  const expectedTeams = [scope.homeTeamId, scope.awayTeamId].sort((a, b) => a - b);
  if (!equal(bundle.population.map(row => row.teamId).sort((a, b) => a - b), expectedTeams)) throw new Error("Population team scope mismatch");
  const windows = bundle.population.map(population => {
    const schedules = bundle.scheduleSources.filter(source => source.payload.games?.some((game: any) => game.id === scope.gameId
      && [game.homeTeam.id, game.awayTeam.id].includes(population.teamId))
      && population.selectedGameIds.every(gameId => source.payload.games?.some((game: any) => game.id === gameId
        && [game.homeTeam.id, game.awayTeam.id].includes(population.teamId))));
    if (schedules.length !== 1) throw new Error("Missing or ambiguous retained team schedule");
    const schedule = schedules[0];
    const scheduleRevision = verified.get(schedule.revisionId)!;
    const scheduleGames = z.array(z.any()).max(300).parse(schedule.payload.games);
    if (new Set(scheduleGames.map(row => row.id)).size !== scheduleGames.length) throw new Error("Duplicate retained schedule games");
    const target = scheduleGames.find(row => row.id === scope.gameId);
    if (!target || target.season !== scope.seasonId || target.gameType !== scope.phase || target.startTimeUTC !== scope.startAt
      || target.homeTeam?.id !== scope.homeTeamId || target.awayTeam?.id !== scope.awayTeamId)
      throw new Error("Prospective scope differs from retained schedule");
    for (const row of scheduleGames.filter(row => row.season === scope.seasonId && row.gameType === scope.phase
      && [row.homeTeam?.id, row.awayTeam?.id].includes(population.teamId) && ["OFF", "FINAL"].includes(row.gameState))) {
      id.parse(row.id);
      instant.parse(row.startTimeUTC);
    }
    const completed = scheduleGames.filter(row => row.season === scope.seasonId && row.gameType === scope.phase
      && [row.homeTeam?.id, row.awayTeam?.id].includes(population.teamId) && ["OFF", "FINAL"].includes(row.gameState)
      && Number.isFinite(Date.parse(row.startTimeUTC)) && Date.parse(row.startTimeUTC) < Date.parse(scope.cutoffAt))
      .sort((a, b) => Date.parse(b.startTimeUTC) - Date.parse(a.startTimeUTC) || b.id - a.id);
    const selected = bundle.history.filter(row => row.teamId === population.teamId).sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt) || b.gameId - a.gameId);
    if (new Set(population.selectedGameIds).size !== population.selectedGameIds.length
      || !equal(population.selectedGameIds, selected.map(row => row.gameId))
      || !equal(population.selectedGameIds, completed.slice(0, population.selectedGameIds.length).map(row => row.id))) throw new Error("Pinned historical window differs from retained schedule or facts");
    if (selected.some(row => {
      const scheduled = completed.find(game => game.id === row.gameId);
      return !scheduled || scheduled.startTimeUTC !== row.startedAt
        || !equal([scheduled.homeTeam.id, scheduled.awayTeam.id].sort((a, b) => a - b), [row.teamId, row.opponentId].sort((a, b) => a - b));
    })) throw new Error("Historical schedule identity or start differs from PBP facts");
    if (population.incompleteGameIds.length) gaps.push({ code: "pinned_window_incomplete", teamId: population.teamId,
      requirement: `Resolve selected incomplete games ${population.incompleteGameIds.join(",")}; do not replace them silently.` });
    const scheduleAvailableAtProspectiveCutoff = availableBefore(scheduleRevision.provenance, scope.cutoffAt);
    if (!scheduleAvailableAtProspectiveCutoff) gaps.push({ code: "schedule_unavailable_at_prospective_cutoff", teamId: population.teamId,
      requirement: "Retain the selected-population schedule receipt and verification before cutoff." });
    const selectedGames = games.filter(row => population.selectedGameIds.includes(row.gameId));
    const playerIds = [...new Set(selectedGames.flatMap(row => row.roster.filter(player => player.teamId === population.teamId).map(player => player.playerId)))].sort((a, b) => a - b);
    const pkObservedInputs = playerIds.map(playerId => {
      const pkEvents = selectedGames.flatMap(row => row.events).filter(row => row.teamId === population.teamId && row.playerId === playerId && row.ordinaryRegStrength === "PK");
      return { nhlPlayerId: playerId, rosterListedGameIds: selectedGames.filter(row => row.roster.some(player => player.playerId === playerId && player.teamId === population.teamId)).map(row => row.gameId),
        ordinaryRegPkObservedGoalCount: pkEvents.filter(row => row.kind === "goal").length,
        ordinaryRegPkCandidateSogCount: pkEvents.length,
        positiveTotalToiAppearanceCount: null, ordinaryRegPkExposureSeconds: null,
        secondsPerPlayingAppearance: null, sogPer60PkMinutes: null, goalsPerPkSog: null };
    });
    return { teamId: population.teamId, selectedGameIds: population.selectedGameIds, retainedFinalTeamGameCount: selected.length,
      retainedSelectionLimit: "not_recorded", availableFinishedCurrentSeasonGames: completed.length,
      fewerThanNativeTenRows: selected.length < 10, nativeTenRowWindowProved: false,
      scheduleRevisionId: schedule.revisionId, scheduleRawBytesHash: schedule.rawBytesHash, scheduleProvenance: scheduleRevision.provenance,
      scheduleAvailableAtProspectiveCutoff, pkObservedInputs };
  }).sort((a, b) => a.teamId - b.teamId);

  const prior = input.attributeAudit;
  if (prior?.version !== "retained-goal-attribute-audit-v1" || prior.acceptanceEligible !== false
    || prior.parserHash !== input.parserSourceHash || !/^[a-f0-9]{40}$/.test(prior.codeCommit ?? "")
    || !equal(prior.prospectiveScope, scope) || !Array.isArray(prior.games) || prior.games.length !== games.length)
    throw new Error("Prior attribute audit scope/parser/version mismatch");
  const attributeEvents = (events: NativeLedgerEvent[]) => events.filter(row => row.kind === "goal").map(row => ({
    eventId: row.eventId, teamId: row.teamId, scoringPlayerId: row.playerId, period: row.period,
    rawSituationCode: row.rawSituationCode, goalieInNetId: row.goalieInNetId, attackingGoalie: row.attackingGoalie,
    defendingGoalie: row.defendingGoalie, attackingSkaters: row.attackingSkaters, defendingSkaters: row.defendingSkaters,
    ledgerCell: `${row.period}:${row.netState}:${row.netState === "both_present" ? row.skaterRelation : "not_partitioned"}`,
  }));
  for (const game of games) {
    const matches = prior.games.filter((row: any) => row.gameId === game.gameId);
    const previous = matches[0];
    const projected = attributeEvents(game.events);
    if (matches.length !== 1 || previous.revisionId !== game.revisionId || previous.rawBytesHash !== game.rawBytesHash
      || previous.firstReceivedAt !== game.provenance.firstReceivedAt || previous.originalVerifiedAt !== game.provenance.verifiedAt
      || previous.officialPlayGoalCount !== game.officialPlayGoalCount
      || !Array.isArray(previous.events) || !equal(previous.events.map(({ gaps: _gaps, ...event }: any) => event).sort((a: any, b: any) => a.eventId - b.eventId), projected)
      || !equal(previous.ledgerCounts, counts(projected.map(row => row.ledgerCell)))
      || !Array.isArray(previous.excludedGoals) || !equal(previous.excludedGoals.map((row: any) => row.eventId).sort((a: number, b: number) => a - b), game.excludedShootoutGoalEventIds))
      throw new Error(`Retained attribute audit differs from raw replay for game ${game.gameId}`);
  }
  const goalCount = games.reduce((sum, row) => sum + row.officialPlayGoalCount, 0);
  if (prior.goalCount !== goalCount) throw new Error("Prior attribute audit total mismatch");
  const affectedGameIds = games.map(row => row.gameId);
  const inputGaps: NativeLedgerGap[] = [
    { code: "shift_exposure_unavailable", requirement: "Retain hash-bound complete shift intervals, period lengths and goalie identities for each selected game; PBP point states cannot establish PK seconds." },
    { code: "playing_appearance_denominator_unavailable", requirement: "Retain positive total TOI per player/game, including measured zero PK exposure. Historical roster listing and positive-PK appearances are different denominators." },
    { code: "player_sog_credit_unproved", requirement: "Reconcile scorer/shooter and exceptional goal/SOG credits to retained official player finals in the same ledger, beyond aggregate team SOG parity." },
    { code: "native_window_lineage_unproved", requirement: "Retain actual native last-ten team rows and player rolling support windows. The native query has no season/type filter; this current-season schedule is not its row manifest." },
    { code: "provider_situation_semantics_unproved", requirement: "Independently certify provider situation/strength semantics. Matching the repository parser hash proves parser identity only." },
    { code: "native_asof_feature_lineage_unproved", requirement: "Bind the native feature, roster and model revisions to receipt/verification and applicable feature/training cutoffs; this observation audit is not a forecast freeze." },
    { code: "historical_pregame_availability_unproved", requirement: "Do not treat newly retained final responses as pregame-available inputs for the completed historical games." },
  ];
  gaps.push(...inputGaps.map(row => ({ ...row, gameIds: affectedGameIds })));
  const events = games.flatMap(row => row.events);
  return { version: NATIVE_GOAL_LEDGER_AUDIT_VERSION, evidenceKind: "retained_official_observations", acceptanceEligible: false,
    scope, parser: { sourceHash: input.parserSourceHash, providerSemanticsCertified: false },
    priorAttributeAudit: { codeCommit: prior.codeCommit, parserHash: prior.parserHash, parityVerified: true },
    units: { eventClock: "seconds_into_period", goals: "event_count", candidateSog: "event_count", exposure: "seconds_unavailable", sogRate: "SOG_per_60_PK_minutes_unavailable" },
    goalCount, candidateSogCount: events.length, goalLedgerCounts: counts(events.filter(row => row.kind === "goal").map(row => row.ledgerCell)),
    defendingGoalieAbsentGoalCount: events.filter(row => row.kind === "goal" && row.defendingGoalie === 0).length,
    attackingOnlyGoalieAbsentGoalCount: events.filter(row => row.kind === "goal" && row.attackingGoalie === 0 && row.defendingGoalie === 1).length,
    excludedShootoutGoalCount: games.reduce((sum, row) => sum + row.excludedShootoutGoalEventIds.length, 0),
    games, windows, gaps, exposureAudit: { status: "unsupported", reason: "No retained shift or total-TOI inputs in this bounded bundle", futurePkDecisionEligible: false } };
}
