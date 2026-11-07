import { assertId, assertSource, instant, type SourceReference } from "./contracts";
import type { SourcePolicy } from "./data";
import { contentHash } from "./hash.server";
import { validateCalendarGame, type CalendarGame, type CumulativeHorizon } from "./horizonEvaluation";

/** Local research contract only; no serving, database, scheduler or network dependency. */
export const RESEARCH_CAPTURE_VERSION = "forge-research-pregame-capture-v1";
export interface PinnedInput<T> { source: SourceReference; value: T }
export type Admission = Pick<SourcePolicy, "intendedUse" | "approvals">;
export function assertPinnedInput<T>(input: PinnedInput<T>, cutoffAt: string, admission: Admission): void {
  assertSource(input.source, cutoffAt);
  if (contentHash(input.value) !== input.source.sha256) throw new Error("input_hash_mismatch");
  if (!admission.intendedUse || !admission.approvals.some(a => a.source === input.source.source && a.intendedUse === admission.intendedUse
    && a.evidenceId && instant(a.approvedAt) <= instant(cutoffAt))) throw new Error("intended_use_not_approved");
}
export interface CaptureMember {
  playerId: number; teamId: number | null; kind: "skater" | "goalie";
  effectiveAt: string;
  status: "roster" | "injury_reserve" | "reserve" | "assigned" | "unresolved";
}
export interface CaptureGame { gameId: number; homeTeamId: number; awayTeamId: number; startsAt: string }
export interface CapturedPointForecast {
  playerId: number; horizon: CumulativeHorizon; gameIds: number[];
  modelVersion: string; featureVersion: string; codeVersion: string; calibrationVersion: string | null; modelAvailableAt: string;
  sourceIds: string[]; means: Record<string, number | null>;
}
export interface CaptureInput {
  id: string; predecessorId: string | null; seasonId: number; mappingVersion: string; categoryVersion: string; cutoffAt: string; issuedAt: string; retainedAt: string;
  evidenceClass: "fixture" | "prospective_shadow";
  roster: PinnedInput<{ complete: boolean; members: CaptureMember[] }>;
  schedule: PinnedInput<{ complete: boolean; version: string; games: CaptureGame[] }>;
  inputs: PinnedInput<object>[]; forecasts: CapturedPointForecast[]; admission: Admission;
}
export interface ResearchCapture { payload: CaptureInput & { version: string }; sha256: string }

export function captureUniverse(capture: ResearchCapture) {
  assertResearchCapture(capture);
  const { roster, schedule, issuedAt, forecasts } = capture.payload;
  return roster.value.members.map(member => {
    const eligible = member.status !== "assigned";
    const games = schedule.value.games.filter(g => instant(g.startsAt) > instant(issuedAt)
      && [g.homeTeamId, g.awayTeamId].includes(member.teamId!)).sort((a, b) => instant(a.startsAt) - instant(b.startsAt) || a.gameId - b.gameId);
    return { ...member, eligible, windows: ([1, 10, 20] as const).map(horizon => {
      const selected = games.slice(0, horizon), forecast = forecasts.find(f => f.playerId === member.playerId && f.horizon === horizon);
      return { horizon, gameIds: selected.map(g => g.gameId), endAt: selected.at(-1)?.startsAt ?? null,
        complete: eligible && member.teamId !== null && member.status !== "unresolved" && selected.length === horizon,
        forecast: forecast ?? null, missingReason: forecast ? null : "no_captured_forecast" };
    }) };
  });
}

export function freezeResearchCapture(input: CaptureInput): ResearchCapture {
  const payload = { ...structuredClone(input), version: RESEARCH_CAPTURE_VERSION }, capture = { payload, sha256: contentHash(payload) };
  assertResearchCapture(capture);
  return capture;
}
export function assertResearchCapture(capture: ResearchCapture): void {
  const p = capture.payload;
  if (p.version !== RESEARCH_CAPTURE_VERSION || contentHash(p) !== capture.sha256) throw new Error("capture_integrity_failure");
  assertId(p.seasonId);
  if (!p.id || !p.categoryVersion || !p.mappingVersion || !["fixture", "prospective_shadow"].includes(p.evidenceClass)
    || !(instant(p.cutoffAt) <= instant(p.issuedAt) && instant(p.issuedAt) <= instant(p.retainedAt))) throw new Error("invalid_capture_clock");
  for (const pin of [p.roster, p.schedule, ...p.inputs]) assertPinnedInput(pin, p.cutoffAt, p.admission);
  if (!p.roster.value.complete || !p.schedule.value.complete || !p.schedule.value.version) throw new Error("incomplete_independent_population_or_schedule");
  if (p.roster.value.members.length > 2000 || p.schedule.value.games.length > 3000 || p.inputs.length > 10000 || p.forecasts.length > 6000) throw new Error("capture_size_limit");
  const players = new Set<number>(), games = new Set<number>();
  for (const m of p.roster.value.members) {
    assertId(m.playerId); if (m.teamId !== null) assertId(m.teamId);
    if (players.has(m.playerId) || instant(m.effectiveAt) > instant(p.cutoffAt) || !["skater", "goalie"].includes(m.kind)
      || !["roster", "injury_reserve", "reserve", "assigned", "unresolved"].includes(m.status)) throw new Error("invalid_population_identity");
    players.add(m.playerId);
  }
  for (const g of p.schedule.value.games) {
    [g.gameId, g.homeTeamId, g.awayTeamId].forEach(assertId); instant(g.startsAt);
    if (games.has(g.gameId) || g.homeTeamId === g.awayTeamId) throw new Error("invalid_schedule_identity");
    // Retention may lag issuance, but must not silently advance an eligible player's origin window.
    if (instant(g.startsAt) > instant(p.issuedAt) && instant(g.startsAt) <= instant(p.retainedAt)
      && p.roster.value.members.some(m => !["assigned", "unresolved"].includes(m.status)
        && [g.homeTeamId, g.awayTeamId].includes(m.teamId!))) throw new Error("late_capture_retention");
    games.add(g.gameId);
  }
  const sources = [p.roster.source, p.schedule.source, ...p.inputs.map(i => i.source)];
  if (new Set(sources.map(s => s.id)).size !== sources.length) throw new Error("duplicate_source_identity");
  const seen = new Set<string>();
  for (const f of p.forecasts) {
    const member = p.roster.value.members.find(m => m.playerId === f.playerId);
    const ids = p.schedule.value.games.filter(g => member?.teamId !== null && [g.homeTeamId, g.awayTeamId].includes(member?.teamId ?? -1)
      && instant(g.startsAt) > instant(p.issuedAt)).sort((a, b) => instant(a.startsAt) - instant(b.startsAt) || a.gameId - b.gameId).slice(0, f.horizon).map(g => g.gameId);
    const key = `${f.playerId}:${f.horizon}`;
    if (seen.has(key) || ![1, 10, 20].includes(f.horizon) || !member || ["assigned", "unresolved"].includes(member.status)
      || ids.length !== f.horizon || contentHash(ids) !== contentHash(f.gameIds)) throw new Error("invalid_or_duplicate_forecast_window");
    seen.add(key);
    if (!f.modelVersion || !f.featureVersion || !f.codeVersion || instant(f.modelAvailableAt) > instant(p.cutoffAt) || !f.sourceIds.length
      || f.sourceIds.some(id => !sources.some(s => s.id === id)) || f.gameIds.some(id => !games.has(id)
        || instant(p.schedule.value.games.find(g => g.gameId === id)!.startsAt) <= instant(p.retainedAt))) throw new Error("unproven_or_late_forecast");
    if (Object.values(f.means).some(n => n !== null && (!Number.isFinite(n) || n < 0))) throw new Error("invalid_point_mean");
  }
}
/** Append-only value semantics: same ID/same bytes is idempotent; corrections need a new ID and predecessor. */
export function appendResearchCapture(history: readonly ResearchCapture[], capture: ResearchCapture): ResearchCapture[] {
  history.forEach(assertResearchCapture); assertResearchCapture(capture);
  const prior = history.find(c => c.payload.id === capture.payload.id);
  if (prior && prior.sha256 !== capture.sha256) throw new Error("immutable_capture_conflict");
  const versions = new Map<string, string>();
  for (const c of [...history, capture]) for (const pin of [c.payload.roster, c.payload.schedule, ...c.payload.inputs]) {
    const s = pin.source, key = `${s.source}:${s.id}:${s.revision}`, hash = contentHash(s);
    if (versions.has(key) && versions.get(key) !== hash) throw new Error("immutable_source_revision_conflict");
    versions.set(key, hash);
  }
  if (capture.payload.predecessorId && !history.some(c => c.payload.id === capture.payload.predecessorId
    && c.payload.seasonId === capture.payload.seasonId && instant(c.payload.retainedAt) <= instant(capture.payload.retainedAt))) throw new Error("missing_capture_predecessor");
  return structuredClone(prior ? [...history] : [...history, capture]);
}

export interface CaptureSettlement {
  gameId: number; played: boolean; finalAt: string;
  completeScopes: Array<{ teamId: number; kind: "skater" | "goalie" }>;
  observations: Array<{ playerId: number; kind: "skater" | "goalie"; appearance: "official_appearance" | "dressed_unused" | "nonappearance"; game: CalendarGame }>;
}
export function settleResearchCapture(capture: ResearchCapture, receipt: PinnedInput<CaptureSettlement>, asOf: string, admission: Admission) {
  const universe = captureUniverse(capture); assertPinnedInput(receipt, asOf, admission);
  const value = receipt.value, game = capture.payload.schedule.value.games.find(g => g.gameId === value.gameId);
  if (!game || typeof value.played !== "boolean" || instant(value.finalAt) > instant(receipt.source.firstReceivedAt)
    || value.played && instant(value.finalAt) < instant(game.startsAt)) throw new Error("immature_or_wrong_game_settlement");
  const seen = new Set<number>();
  for (const o of value.observations) {
    if (seen.has(o.playerId) || o.game.gameId !== value.gameId || ![game.homeTeamId, game.awayTeamId].includes(o.game.teamId)
      || !["official_appearance", "dressed_unused", "nonappearance"].includes(o.appearance)
      || instant(o.game.startsAt) > instant(value.finalAt)) throw new Error("conflicting_outcome_identity");
    seen.add(o.playerId); validateCalendarGame(o.game, o.kind);
    if (!value.played || o.game.counts.GP !== (o.appearance === "official_appearance" ? 1 : 0)) throw new Error("appearance_count_conflict");
  }
  return universe.filter(m => m.eligible && [game.homeTeamId, game.awayTeamId].includes(m.teamId!)).map(m => {
    const o = value.observations.find(o => o.playerId === m.playerId);
    if (o && (o.kind !== m.kind || o.game.teamId !== m.teamId)) throw new Error("outcome_membership_conflict");
    const complete = value.completeScopes.some(s => s.teamId === m.teamId && s.kind === m.kind);
    return { playerId: m.playerId, gameId: game.gameId, appearance: !value.played ? "game_not_played"
      : o?.appearance ?? (complete ? "nonappearance" : "unknown"), counts: o?.game.counts ?? null,
      knownZero: value.played && !o && complete, actualStartsAt: o?.game.startsAt ?? null, finalAt: value.finalAt,
      sourceId: receipt.source.id, sourceHash: receipt.source.sha256 };
  });
}
