import { createHash } from "node:crypto";
import { normalizeNhlGameToTeamRows, planningScheduleStatus } from "../rosterScheduleData/normalize";
import { normalizePlanningGames } from "../rosterScheduleData/planningInputs";
import { timestampMicros } from "../projections/evidenceTime";
import { buildRosterObservationSkaterParticipationReceipt, type RosterObservationSkaterParticipationInput } from "./modeledSkaterParticipation";
import { buildRosterObservationGoalieParticipationReceipt, buildRosterObservationGoalieStartReceipt,
  type RosterObservationGoalieParticipationInput, type RosterObservationGoalieStartInput } from "./modeledGoalieParticipation";
import { targetRosterObservationFromReceipt } from "./targetRosterObservation";
import { bindNativeCadenceMaterialization } from "./nativeBaselineCadence";
import type { NativeMaterializationRequest } from "./nativeInputMaterialization";
import type { NativeBaselinePublicationPlan } from "./nativeBaselinePublication";
import { playerForecastSourcePayloadHash as hash, type PlannedSourceObservation } from "./sourceSnapshot";

/** v1 daily FORGE run: frozen native means and frozen participation history, re-bound to
 * fresh official club rosters and a fresh schedule. No fetching, writing or model change here. */
export type HttpReceipt = { url: string; capturedAt: string; bodySha256: string; rawBody: string };
type ParticipationInput = RosterObservationSkaterParticipationInput | RosterObservationGoalieParticipationInput | RosterObservationGoalieStartInput;
export const NATIVE_DAILY_HORIZON = 20;
const DAY_MS = 86400000;
const fail = (reason: string): never => { throw new Error(reason); };
const micros = (value: string) => timestampMicros(value) ?? fail("invalid_clock");
const sha = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
const nyDate = (instant: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York",
  year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(instant));
const evidence = (receipt: HttpReceipt) => ({ id: `http:${receipt.bodySha256}`, hash: receipt.bodySha256,
  availableAt: receipt.capturedAt, capturedAt: receipt.capturedAt });
function verified(receipt: HttpReceipt, pattern: RegExp, cutoffAt: string) {
  if (!pattern.test(receipt?.url ?? "") || typeof receipt.rawBody !== "string" || !receipt.rawBody.length
    || Buffer.byteLength(receipt.rawBody) > 1024 * 1024 || sha(receipt.rawBody) !== receipt.bodySha256
    || micros(receipt.capturedAt) > micros(cutoffAt)) fail("invalid_original_receipt");
  return JSON.parse(receipt.rawBody);
}

/** Next scheduled regular-season games per club from original NHL weekly schedule receipts. */
export function dailyScheduleBindings(receipts: HttpReceipt[], cutoffAt: string, yahoo: { gameKey: string; season: string }) {
  const games = new Map<number, { game: any; receipt: HttpReceipt; payloadHash: string }>(), teams = new Map<number, string>();
  for (const receipt of receipts) {
    const body = verified(receipt, /^https:\/\/api-web\.nhle\.com\/v1\/schedule\/\d{4}-\d{2}-\d{2}$/, cutoffAt);
    if (!Array.isArray(body?.gameWeek)) fail("schedule_shape");
    for (const day of body.gameWeek) for (const original of day.games ?? []) {
      const game = { ...original, gameDate: day.date }, previous = games.get(game.id);
      for (const team of [game.homeTeam, game.awayTeam]) {
        if (teams.has(team.id) && teams.get(team.id) !== team.abbrev) fail("club_abbreviation_conflict");
        teams.set(team.id, team.abbrev);
      }
      // Overlapping weekly bodies must agree on every field that defines the schedule revision.
      const identity = hash({ id: game.id, start: game.startTimeUTC, home: game.homeTeam.id, away: game.awayTeam.id, state: game.gameState, schedule: game.gameScheduleState });
      if (previous && previous.payloadHash !== identity) fail("schedule_source_conflict");
      if (!previous) games.set(game.id, { game, receipt, payloadHash: identity });
    }
  }
  const rows: any[] = [], sourceByGame = new Map<string, HttpReceipt>(), exclusions: Array<{ gameId: number; status: string }> = [];
  for (const { game, receipt } of games.values()) {
    if (game.gameType !== 2 || micros(new Date(Date.parse(game.startTimeUTC)).toISOString()) <= micros(cutoffAt)) continue;
    const status = planningScheduleStatus(game.gameState ?? "", game.gameScheduleState ?? "");
    if (status !== "scheduled") { exclusions.push({ gameId: game.id, status: status ?? "unknown" }); continue; }
    for (const row of normalizeNhlGameToTeamRows({ game, fetchedAt: receipt.capturedAt, sourceUrl: receipt.url,
      gameKey: yahoo.gameKey, yahooSeason: yahoo.season, mapping: { status: "unmapped", reason: "no_week" } as any })) {
      rows.push(row); sourceByGame.set(`${row.source_game_id}:${row.team_abbreviation}`, receipt);
    }
  }
  const planning = normalizePlanningGames(rows, "America/New_York");
  const byTeam = new Map<string, typeof planning>();
  for (const game of planning) byTeam.set(game.teamAbbreviation, [...(byTeam.get(game.teamAbbreviation) ?? []), game]);
  for (const list of byTeam.values()) list.sort((a, b) => Date.parse(a.startsAt!) - Date.parse(b.startsAt!) || Number(a.id) - Number(b.id));
  return { teams, byTeam, sourceByGame, exclusions };
}

/** League games on one New York date, for the cadence closure scope. */
export function dailyGames(bindings: ReturnType<typeof dailyScheduleBindings>, date: string) {
  const unique = new Map<number, string>();
  for (const list of bindings.byTeam.values()) for (const game of list) if (nyDate(game.startsAt!) === date) unique.set(Number(game.id), game.startsAt!);
  return [...unique].map(([gameId, startsAt]) => ({ gameId, startsAt })).sort((a, b) => a.gameId - b.gameId);
}

/** Re-observe the frozen history window from fresh original weekly schedules. Every retained club
 * frame must still list exactly the same regular-season games and starts, or the run stops. The
 * derived manifest gives the unchanged frame current scope evidence; no label or clock in it changes. */
export function reobserveHistoryWindow(args: { retained: ParticipationInput[]; weeks: HttpReceipt[]; cutoffAt: string }) {
  const frames = new Map<number, { start: string; end: string; games: Array<{ gameId: number; scheduledAt: string }> }>();
  for (const input of args.retained) {
    const frame = { start: input.history.windowStartAt, end: input.history.windowEndAt,
      games: input.history.games.map(game => ({ gameId: game.gameId, scheduledAt: game.scheduledAt })).sort((a, b) => a.gameId - b.gameId) };
    const previous = frames.get(input.scope.teamId);
    if (previous && hash(previous) !== hash(frame)) fail("retained_club_frame_conflict");
    frames.set(input.scope.teamId, frame);
  }
  const windows = new Set([...frames.values()].map(frame => `${frame.start}|${frame.end}`));
  if (windows.size !== 1) fail("retained_history_window_conflict");
  const [windowStartAt, windowEndAt] = [...windows][0].split("|"), observed = new Map<number, Map<number, string>>(), dates = new Set<string>();
  for (const receipt of args.weeks) {
    const body = verified(receipt, /^https:\/\/api-web\.nhle\.com\/v1\/schedule\/\d{4}-\d{2}-\d{2}$/, args.cutoffAt);
    for (const day of body?.gameWeek ?? []) {
      dates.add(day.date);
      for (const game of day.games ?? []) {
        const start = micros(new Date(Date.parse(game.startTimeUTC)).toISOString());
        if (game.gameType !== 2 || start < micros(windowStartAt) || start >= micros(windowEndAt)) continue;
        for (const team of [game.homeTeam.id, game.awayTeam.id]) {
          const games = observed.get(team) ?? new Map<number, string>(); games.set(game.id, game.startTimeUTC); observed.set(team, games);
        }
      }
    }
  }
  const windowDays = Math.round((Date.parse(windowEndAt) - Date.parse(windowStartAt)) / DAY_MS);
  if (dates.size < windowDays) fail("history_window_not_fully_reobserved");
  for (const [teamId, frame] of frames) {
    const fresh = observed.get(teamId) ?? new Map<number, string>();
    if (fresh.size !== frame.games.length || frame.games.some(game => !fresh.has(game.gameId)
      || micros(new Date(Date.parse(fresh.get(game.gameId)!)).toISOString()) !== micros(game.scheduledAt))) fail("history_frame_changed");
  }
  const payload = { version: "daily-frozen-window-history-reobservation-v1", materializedAt: args.cutoffAt, windowStartAt, windowEndAt,
    timeZone: "America/New_York", parents: args.weeks.map(receipt => ({ url: receipt.url, bodySha256: receipt.bodySha256, capturedAt: receipt.capturedAt })),
    clubIds: [...frames.keys()].sort((a, b) => a - b), gameIds: [...new Set([...frames.values()].flatMap(frame => frame.games.map(game => game.gameId)))].sort((a, b) => a - b),
    reobservationOf: [...new Set(args.retained.map(input => input.history.scheduleEvidence.hash))].sort(), historicalEligibilityInferred: false };
  const manifestHash = hash(payload);
  return { evidence: { id: `manifest:${manifestHash}`, hash: manifestHash, availableAt: args.cutoffAt, capturedAt: args.cutoffAt },
    parent: { id: `manifest:${manifestHash}`, hash: manifestHash, availableAt: args.cutoffAt, capturedAt: args.cutoffAt,
      derived: { payload, parentHashes: args.weeks.map(receipt => receipt.bodySha256) } } };
}

/** Fresh roster-observation participation inputs. History labels, identities and roster revisions come
 * unchanged from the retained inputs; targets, roster evidence, history scope evidence and cutoff are new. */
export function buildDailyParticipationInputs(args: { retained: ParticipationInput[]; rosterReceipts: HttpReceipt[];
  bindings: ReturnType<typeof dailyScheduleBindings>; historyEvidence: ReturnType<typeof reobserveHistoryWindow>["evidence"];
  cutoffAt: string; seasonId: number; knownConflicts?: Record<number, boolean | null>; horizon?: number }) {
  const horizon = args.horizon ?? NATIVE_DAILY_HORIZON, templates = new Map<number, ParticipationInput>();
  for (const input of args.retained) {
    const { scope } = input, existing = templates.get(scope.playerId);
    if (input.version === "goalie-roster-observation-start-input-v1") continue;
    if (existing && (hash(existing.history) !== hash(input.history) || existing.version !== input.version
      || [existing.scope.nhlPlayerId, existing.scope.teamId, existing.scope.rosterRevision].join() !== [scope.nhlPlayerId, scope.teamId, scope.rosterRevision].join())) {
      fail("retained_history_conflict");
    }
    templates.set(scope.playerId, input);
  }
  const rosters = new Map<string, HttpReceipt>();
  for (const receipt of args.rosterReceipts) {
    verified(receipt, new RegExp(`^https://api-web\\.nhle\\.com/v1/roster/[A-Z]{2,4}/${args.seasonId}$`), args.cutoffAt);
    const abbreviation = receipt.url.split("/")[5];
    if (rosters.has(abbreviation)) fail("duplicate_club_roster");
    rosters.set(abbreviation, receipt);
  }
  const inputs: ParticipationInput[] = [], coverage: any[] = [];
  const temporary = { issuedAt: args.cutoffAt, expiresAt: new Date(Date.parse(args.cutoffAt) + 1).toISOString() };
  for (const template of [...templates.values()].sort((a, b) => a.scope.playerId - b.scope.playerId)) {
    const { scope } = template, abbreviation = args.bindings.teams.get(scope.teamId), roster = abbreviation ? rosters.get(abbreviation) : undefined;
    const games = abbreviation ? (args.bindings.byTeam.get(abbreviation) ?? []).slice(0, horizon) : [];
    const row = { playerId: scope.playerId, playerClass: template.playerClass, teamId: scope.teamId, games: games.length, missingGames: horizon - games.length,
      listed: null as boolean | null, knownConflict: null as boolean | null, reasons: [] as string[] };
    coverage.push(row);
    if (!roster) { row.reasons.push("missing_official_club_roster"); continue; }
    // Fresh conflicts come only from an explicit pinned input. A carried-forward conflict stays a conservative
    // withhold; a carried "no conflict" is not evidence of health and becomes unknown.
    const knownConflict = Object.prototype.hasOwnProperty.call(args.knownConflicts ?? {}, scope.playerId)
      ? args.knownConflicts![scope.playerId] : template.targetRosterObservation?.knownConflict === true ? true : null;
    const observation = targetRosterObservationFromReceipt({ playerId: scope.playerId, nhlPlayerId: scope.nhlPlayerId, teamId: scope.teamId,
      seasonId: args.seasonId, teamAbbreviation: abbreviation!, knownConflict, cutoffAt: args.cutoffAt, receipt: roster });
    row.listed = observation.listed; row.knownConflict = observation.knownConflict;
    for (const game of games) {
      const source = args.bindings.sourceByGame.get(`${game.id}:${game.teamAbbreviation}`) ?? fail("missing_schedule_source");
      const input = { ...template, cutoffAt: args.cutoffAt, scheduleEvidence: evidence(source), rosterEvidence: observation.evidence, targetRosterObservation: observation,
        history: { ...template.history, scheduleEvidence: args.historyEvidence },
        scope: { ...scope, gameId: Number(game.id), scheduledAt: game.startsAt!, scheduleRevision: game.scheduleRevision } } as ParticipationInput;
      if (input.version === "skater-roster-observation-participation-input-v1") buildRosterObservationSkaterParticipationReceipt(input, temporary);
      else {
        buildRosterObservationGoalieParticipationReceipt(input as RosterObservationGoalieParticipationInput, temporary);
        const start = { ...input, version: "goalie-roster-observation-start-input-v1" } as RosterObservationGoalieStartInput;
        buildRosterObservationGoalieStartReceipt(start, temporary); inputs.push(start);
      }
      inputs.push(input);
    }
  }
  return { inputs, coverage };
}

/** Retained request re-bound to fresh parents, participation inputs, cutoff and run identity.
 * Retained parents stay only when frozen native or history evidence still reaches them. */
export function buildDailyMaterializationRequest(args: { retained: NativeMaterializationRequest; freshReceipts: HttpReceipt[];
  derivedParents?: Array<ReturnType<typeof reobserveHistoryWindow>["parent"]>;
  participationInputs: ParticipationInput[]; cutoffAt: string; runId: string; date: string; sourceKey: string; seasonId: number;
  games: Array<{ gameId: number; startsAt: string }> }) {
  const request: NativeMaterializationRequest = structuredClone(args.retained);
  const parents = new Map((request.parents ?? []).map(parent => [parent.hash, parent]));
  const keep = new Set<string>(), reach = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (typeof child === "string" && ["hash", "contentHash", "bodySha256"].includes(key) && parents.has(child) && !keep.has(child)) {
        keep.add(child); for (const ancestor of parents.get(child)!.derived?.parentHashes ?? []) reach({ hash: ancestor });
      } else if (child && typeof child === "object") reach(child);
    }
  };
  reach(request.additionalNativeObservations); reach(request.existingInputs);
  for (const input of args.participationInputs) reach(input.history);
  for (const receipt of args.freshReceipts) {
    verified(receipt, /^https:\/\/api-web\.nhle\.com\/v1\/(?:roster|schedule)\//, args.cutoffAt);
    if (keep.has(receipt.bodySha256)) fail("fresh_receipt_collides_with_retained_parent");
  }
  const fresh = new Map(args.freshReceipts.map(receipt => [receipt.bodySha256, receipt]));
  request.parents = [...(request.parents ?? []).filter(parent => keep.has(parent.hash)),
    ...[...fresh.values()].map(receipt => ({ ...evidence(receipt), original: { url: receipt.url, rawBody: receipt.rawBody, bodySha256: receipt.bodySha256 } })),
    ...(args.derivedParents ?? []).filter(parent => !keep.has(parent.hash))];
  request.requiredParents = request.parents.map(parent => ({ id: parent.id, hash: parent.hash, availableAt: parent.availableAt,
    capturedAt: parent.capturedAt, url: parent.original?.url ?? null }));
  request.participationInputs = args.participationInputs;
  request.acquisition = { ...request.acquisition, cutoffAt: args.cutoffAt };
  return { ...bindNativeCadenceMaterialization(request, { runId: args.runId, sourceKey: args.sourceKey, date: args.date, seasonId: args.seasonId, games: args.games }),
    droppedParents: (args.retained.parents ?? []).length - keep.size };
}

/** One expiry for the whole daily issuance: twelve hours, or one millisecond before the first
 * remaining universe or league game of the day, whichever comes first. */
export function dailyExpiresAt(issuedAt: string, participationInputs: ParticipationInput[], leagueGames: Array<{ startsAt: string }> = []) {
  const starts = [...participationInputs.map(input => Date.parse(input.scope.scheduledAt)), ...leagueGames.map(game => Date.parse(game.startsAt))]
    .filter(start => start > Date.parse(issuedAt));
  const expiry = Math.min(Date.parse(issuedAt) + DAY_MS / 2, ...starts.map(start => start - 1));
  if (!(expiry > Date.parse(issuedAt))) fail("no_valid_daily_expiry");
  return new Date(expiry).toISOString();
}

/** Apply an independent reviewer's decision to a pending daily plan. Only an explicit approval
 * of this exact plan hash fills the review fields; anything else leaves nothing publishable. */
export type NativeDailyReviewDecision = { version: "native-daily-review-decision-v1"; planHash: string; decision: "approve" | "reject";
  reviewer: string; reviewRef: string; reviewedAt: string; findings: string[] };
export function applyNativeDailyReview(plan: NativeBaselinePublicationPlan, decision: NativeDailyReviewDecision) {
  if (decision?.version !== "native-daily-review-decision-v1" || decision.planHash !== hash(plan)) fail("review_decision_plan_mismatch");
  if (decision.decision !== "approve") fail("review_rejected");
  if (!decision.reviewRef?.trim() || !decision.reviewer?.trim() || !Number.isFinite(Date.parse(decision.reviewedAt))) fail("review_decision_incomplete");
  const reviewFields = { independentDataReviewRef: decision.reviewRef, independentDataReviewedAt: decision.reviewedAt,
    independentReviewer: decision.reviewer, independentReviewFindings: decision.findings, scientificQualification: false };
  const reviewed = ({ pendingIndependentReview: _pending, ...rest }: Record<string, unknown>) => rest;
  const rows = plan.rows.map((row): PlannedSourceObservation => {
    if (row.entity_kind === "baseline_validation_review" && (row.payload as any).status === "pending_independent_review") {
      // A review becomes available when it is made, never before the issuance it reviews.
      if (micros(decision.reviewedAt) < micros(row.available_at)) fail("review_precedes_issuance");
      const payload = { ...(row.payload as any), status: "owner_approved", eligible: true, ownerApprovalRef: decision.reviewRef, reviewedAt: decision.reviewedAt };
      return { ...row, payload, payload_hash: hash(payload), observed_at: decision.reviewedAt, available_at: decision.reviewedAt,
        metadata: { ...reviewed(row.metadata), ...reviewFields } };
    }
    if (row.entity_kind === "participation_bundle" && (row.payload as any).reviewRef === "") {
      const payload = { ...(row.payload as any), reviewRef: decision.reviewRef };
      return { ...row, payload, payload_hash: hash(payload), source_revision_key: hash(payload),
        metadata: { ...reviewed(row.metadata), ...reviewFields } };
    }
    return row;
  });
  return { version: plan.version, seasonId: plan.seasonId, rows };
}
