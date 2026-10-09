import { createHash } from "node:crypto";
import { provenanceSchema } from "../forecast-diagnostics/pairedInputs";
import { projectionInputHash } from "./inputCapture";

export const NATIVE_INTERVAL_RECONCILIATION_VERSION = "native-interval-reconciliation-v1";
const MAX_PRESENCE_VARIANTS = 64;
type Interval = { period: number; start: number; end: number };
type Period = { number: number; type: "REG" | "OT"; endSeconds: number | null; reasons: string[] };
type SourceRow = {
  key: string; revisionId: string; rowIndex: number; rowHash: string; original: any;
  disposition: "interval" | "duration_conflict" | "event_marker" | "excluded_shootout" | "quarantined";
  reasons: string[]; candidates: Interval[];
};
type Player = {
  playerId: number; teamId: number; goalie: boolean; boxToiSeconds: number | null;
  sourceRowKeys: string[]; endpointUnionSeconds: number; candidateUnionSeconds: number[];
  distinctPresenceVariants: number; boxMatchingPresenceVariants: number;
  supportedPresenceSeconds: number | null; status: "reconciled" | "quarantined";
  reasons: string[]; presence: Interval[] | null;
};
type Span = {
  period: number; periodType: "REG" | "OT"; start: number; end: number;
  homeSkaterIds: number[]; awaySkaterIds: number[]; homeGoalieIds: number[]; awayGoalieIds: number[];
  status: "reconciled_interval_state" | "quarantined"; reasons: string[];
};
const positiveId = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const sorted = (values: string[]) => [...new Set(values)].sort();
const same = (left: unknown, right: unknown) => projectionInputHash(left) === projectionInputHash(right);

function spanCell(span: Span, home: boolean) {
  const ownSkaters = home ? span.homeSkaterIds : span.awaySkaterIds, otherSkaters = home ? span.awaySkaterIds : span.homeSkaterIds;
  const ownGoalie = (home ? span.homeGoalieIds : span.awayGoalieIds).length, otherGoalie = (home ? span.awayGoalieIds : span.homeGoalieIds).length;
  const net = ownGoalie ? otherGoalie ? "both_present" : "defending_absent" : otherGoalie ? "attacking_absent" : "both_absent";
  const relation = ownSkaters.length === otherSkaters.length ? "equal_skaters" : ownSkaters.length > otherSkaters.length ? "more_skaters" : "fewer_skaters";
  return `${span.periodType}:${net}:${relation}`;
}

/** Strict seconds; no truncation, fallback duration, period-length rule or clock interpolation. */
export function intervalClockSeconds(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{1,3}:[0-5]\d$/.test(value)) return null;
  const [minutes, seconds] = value.split(":").map(Number);
  return minutes * 60 + seconds;
}

function union(intervals: Interval[]): Interval[] {
  const result: Interval[] = [];
  for (const interval of [...intervals].sort((a, b) => a.period - b.period || a.start - b.start || a.end - b.end)) {
    const previous = result[result.length - 1];
    if (previous && previous.period === interval.period && interval.start <= previous.end) previous.end = Math.max(previous.end, interval.end);
    else result.push({ ...interval });
  }
  return result;
}
const seconds = (intervals: Interval[]) => intervals.reduce((sum, row) => sum + row.end - row.start, 0);

/** Verify already-retained bytes and provenance; this performs no source collection. */
export function verifyIntervalRevision(value: any, cutoffAt: string) {
  const provenance = provenanceSchema.parse(value.provenance);
  if (!/^[A-Za-z0-9-]{1,128}$/.test(value.revisionId) || value.revisionId !== provenance.revisionId
    || value.url !== provenance.source || typeof value.bodyUtf8 !== "string"
    || createHash("sha256").update(value.bodyUtf8, "utf8").digest("hex") !== value.rawBytesHash
    || !same(JSON.parse(value.bodyUtf8), value.payload) || projectionInputHash(value.payload) !== provenance.payloadHash)
    throw new Error("Retained revision raw bytes, canonical payload or identity mismatch");
  const received = Date.parse(provenance.firstReceivedAt), verified = Date.parse(provenance.verifiedAt), cutoff = Date.parse(cutoffAt);
  if (!Number.isFinite(cutoff) || received > verified || verified > cutoff) throw new Error("Retained revision unavailable at requested cutoff");
  if (value.kind !== undefined && (value.httpStatus !== 200 || !Number.isFinite(Date.parse(value.requestedAt))
    || Date.parse(value.requestedAt) > received)) throw new Error("Invalid supplemental receipt chronology or HTTP status");
  return provenance;
}

/** Deterministic mechanics for one historical game, conditional on its retained source records. */
export function reconcileNativeIntervalGame(input: {
  playByPlay: any; boxscore: any; shiftPages: { revisionId: string; rows: any[] }[];
}) {
  const pbp = input.playByPlay, box = input.boxscore, gameId = pbp.id;
  if (!positiveId(gameId) || gameId !== box.id || pbp.season !== box.season || pbp.gameType !== box.gameType
    || !["OFF", "FINAL"].includes(pbp.gameState) || !["OFF", "FINAL"].includes(box.gameState)
    || pbp.startTimeUTC !== box.startTimeUTC || !same(pbp.periodDescriptor, box.periodDescriptor)
    || !positiveId(pbp.homeTeam?.id) || !positiveId(pbp.awayTeam?.id) || pbp.homeTeam.id === pbp.awayTeam.id
    || !Array.isArray(pbp.plays) || !Array.isArray(pbp.rosterSpots)) throw new Error("Historical PBP/boxscore identity or final state mismatch");
  for (const side of ["homeTeam", "awayTeam"]) {
    if (pbp[side].id !== box[side]?.id || pbp[side].score !== box[side].score || pbp[side].sog !== box[side].sog)
      throw new Error("Historical PBP/boxscore team or official totals mismatch");
  }
  const roster = new Map<number, any>();
  for (const row of pbp.rosterSpots) {
    if (!positiveId(row.playerId) || roster.has(row.playerId) || ![pbp.homeTeam.id, pbp.awayTeam.id].includes(row.teamId)
      || !["C", "L", "R", "D", "G"].includes(row.positionCode)) throw new Error("Invalid historical roster identity");
    roster.set(row.playerId, row);
  }
  const boxPlayers: any[] = [];
  for (const side of ["homeTeam", "awayTeam"]) for (const group of ["forwards", "defense", "goalies"]) {
    const rows = box.playerByGameStats?.[side]?.[group];
    if (!Array.isArray(rows)) throw new Error("Missing historical boxscore player group");
    for (const row of rows) {
      const identity = roster.get(row.playerId);
      if (!identity || identity.teamId !== box[side].id || (identity.positionCode === "G") !== (group === "goalies")
        || boxPlayers.some(player => player.playerId === row.playerId)) throw new Error("Boxscore/player roster identity mismatch");
      boxPlayers.push({ ...row, teamId: box[side].id, goalie: group === "goalies" });
    }
  }
  if (boxPlayers.length !== roster.size) throw new Error("Incomplete boxscore/roster population");
  const periodDescriptors = new Map<number, Set<string>>();
  for (const play of pbp.plays) {
    const { number, periodType } = play.periodDescriptor ?? {};
    if (!positiveId(number) || !["REG", "OT", "SO"].includes(periodType)) throw new Error("Invalid retained period descriptor");
    const types = periodDescriptors.get(number) ?? new Set<string>();
    types.add(periodType); periodDescriptors.set(number, types);
  }
  const periods: Period[] = [], shootoutPeriods: number[] = [];
  for (const [number, types] of [...periodDescriptors].sort(([a], [b]) => a - b)) {
    if (types.size !== 1) throw new Error("Conflicting period types");
    const type = [...types][0];
    if (type === "SO") { shootoutPeriods.push(number); continue; }
    const endpoints = pbp.plays.filter((play: any) => play.periodDescriptor.number === number
      && ["period-end", "game-end"].includes(play.typeDescKey)).map((play: any) => intervalClockSeconds(play.timeInPeriod));
    const valid = endpoints.length > 0 && endpoints.every((value: number | null) => value !== null && value > 0) && new Set(endpoints).size === 1;
    periods.push({ number, type: type as "REG" | "OT", endSeconds: valid ? endpoints[0] : null,
      reasons: valid ? [] : ["period_end_clock_unproved"] });
  }
  if (!periods.length) throw new Error("No retained playing periods");
  const sourceRows: SourceRow[] = input.shiftPages.flatMap(page => page.rows.map((original, rowIndex) => ({
    key: `${page.revisionId}:${rowIndex}`, revisionId: page.revisionId, rowIndex, rowHash: projectionInputHash(original), original,
    disposition: "quarantined" as SourceRow["disposition"], reasons: [], candidates: [],
  })));
  if (!sourceRows.length || new Set(sourceRows.map(row => row.key)).size !== sourceRows.length) throw new Error("Missing or duplicate shift page identities");
  for (const row of sourceRows) {
    const raw = row.original ?? {}, identity = roster.get(raw.playerId), period = periods.find(value => value.number === raw.period);
    const start = intervalClockSeconds(raw.startTime), end = intervalClockSeconds(raw.endTime), duration = intervalClockSeconds(raw.duration);
    if (!positiveId(raw.id)) row.reasons.push("source_row_id_invalid");
    if (raw.gameId !== gameId || !identity || identity.teamId !== raw.teamId) row.reasons.push("source_row_game_player_team_unmapped");
    if (sourceRows.some(other => other !== row && other.original?.id === raw.id && other.rowHash !== row.rowHash))
      row.reasons.push("conflicting_source_row_identity");
    if (row.reasons.length) continue;
    if (shootoutPeriods.includes(raw.period)) { row.disposition = "excluded_shootout"; continue; }
    if (!period || period.endSeconds === null) { row.reasons.push("source_row_period_unproved"); continue; }
    if (raw.typeCode === 505 && start !== null && start === end && start <= period.endSeconds && raw.duration === null) {
      row.disposition = "event_marker"; continue;
    }
    if (raw.typeCode !== 517) { row.reasons.push("source_row_type_or_event_marker_unproved"); continue; }
    if (start === null || end === null || duration === null || duration <= 0 || end <= start) {
      row.reasons.push("source_row_clock_or_duration_invalid"); continue;
    }
    if (end > period.endSeconds) { row.reasons.push("source_row_endpoint_outside_retained_period_clock"); continue; }
    row.candidates.push({ period: raw.period, start, end });
    if (end - start !== duration) {
      row.disposition = "duration_conflict"; row.reasons.push("duration_disagrees_with_endpoints");
      if (start + duration <= period.endSeconds) row.candidates.push({ period: raw.period, start, end: start + duration });
    } else row.disposition = "interval";
    if (start + duration > period.endSeconds) row.reasons.push("duration_candidate_outside_period_clock");
  }
  const overlaps: { playerId: number; period: number; leftRowKey: string; rightRowKey: string; kind: string; overlapSeconds: number }[] = [];
  for (let index = 0; index < sourceRows.length; index++) {
    const left = sourceRows[index];
    if (!["interval", "duration_conflict"].includes(left.disposition)) continue;
    for (const right of sourceRows.slice(index + 1)) {
      if (!["interval", "duration_conflict"].includes(right.disposition) || left.original?.playerId !== right.original?.playerId
        || left.original?.period !== right.original?.period) continue;
      const a = left.candidates[0], b = right.candidates[0], overlapSeconds = Math.min(a.end, b.end) - Math.max(a.start, b.start);
      if (overlapSeconds > 0) overlaps.push({ playerId: left.original.playerId, period: a.period, leftRowKey: left.key, rightRowKey: right.key,
        kind: a.start === b.start && a.end === b.end ? "identical_presence_endpoints" : "partial_presence_overlap", overlapSeconds });
    }
  }
  const players: Player[] = boxPlayers.sort((a, b) => a.teamId - b.teamId || a.playerId - b.playerId).map(boxPlayer => {
    const rows = sourceRows.filter(row => row.original?.playerId === boxPlayer.playerId);
    const intervals = rows.filter(row => ["interval", "duration_conflict"].includes(row.disposition));
    const boxToiSeconds = intervalClockSeconds(boxPlayer.toi), reasons: string[] = [];
    if (boxToiSeconds === null) reasons.push("boxscore_toi_unproved");
    if (rows.some(row => row.disposition === "quarantined")) reasons.push("player_has_quarantined_source_rows");
    if (periods.some(period => period.endSeconds === null)) reasons.push("period_end_clock_unproved");
    let variants: Interval[][] = [[]];
    for (const row of intervals) {
      const next = new Map<string, Interval[]>();
      for (const variant of variants) for (const candidate of row.candidates) {
        const combined = union([...variant, candidate]); next.set(projectionInputHash(combined), combined);
      }
      if (next.size > MAX_PRESENCE_VARIANTS) { reasons.push("presence_variant_audit_bound_exceeded"); variants = []; break; }
      variants = [...next.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value);
    }
    const matching = variants.filter(variant => seconds(variant) === boxToiSeconds);
    if (matching.length === 0) reasons.push("presence_union_boxscore_toi_mismatch");
    else if (matching.length > 1) reasons.push("multiple_box_matching_presence_timelines");
    const endpointUnion = union(intervals.map(row => row.candidates[0]));
    const presence = reasons.length === 0 ? matching[0] : null;
    return { playerId: boxPlayer.playerId, teamId: boxPlayer.teamId, goalie: boxPlayer.goalie, boxToiSeconds,
      sourceRowKeys: rows.map(row => row.key), endpointUnionSeconds: seconds(endpointUnion),
      candidateUnionSeconds: [...new Set(variants.map(seconds))].sort((a, b) => a - b),
      distinctPresenceVariants: variants.length, boxMatchingPresenceVariants: matching.length,
      supportedPresenceSeconds: presence ? seconds(presence) : null, status: presence ? "reconciled" : "quarantined",
      reasons: sorted(reasons), presence };
  });
  const gameStateReasons = sorted([
    ...players.filter(player => player.status === "quarantined").map(player => `player_presence_unresolved:${player.playerId}`),
    ...sourceRows.filter(row => row.disposition === "quarantined" && !roster.has(row.original?.playerId)).map(row => `unmapped_source_row:${row.key}`),
  ]);
  const spans: Span[] = [];
  for (const period of periods) {
    if (period.endSeconds === null) continue;
    const boundaries = [...new Set([0, period.endSeconds, ...players.flatMap(player => (player.presence ?? [])
      .filter(interval => interval.period === period.number).flatMap(interval => [interval.start, interval.end]))])].sort((a, b) => a - b);
    for (let index = 1; index < boundaries.length; index++) {
      const start = boundaries[index - 1], end = boundaries[index];
      const active = players.filter(player => player.presence?.some(interval => interval.period === period.number && interval.start <= start && interval.end >= end));
      const ids = (teamId: number, goalie: boolean) => active.filter(player => player.teamId === teamId && player.goalie === goalie).map(player => player.playerId).sort((a, b) => a - b);
      const homeSkaterIds = ids(pbp.homeTeam.id, false), awaySkaterIds = ids(pbp.awayTeam.id, false);
      const homeGoalieIds = ids(pbp.homeTeam.id, true), awayGoalieIds = ids(pbp.awayTeam.id, true), reasons = [...gameStateReasons];
      if ([homeSkaterIds.length, awaySkaterIds.length].some(count => count < 3 || count > 6)) reasons.push("skater_count_outside_3_to_6");
      if (homeGoalieIds.length > 1 || awayGoalieIds.length > 1) reasons.push("multiple_goalies_on_one_team");
      spans.push({ period: period.number, periodType: period.type, start, end, homeSkaterIds, awaySkaterIds, homeGoalieIds, awayGoalieIds,
        status: reasons.length ? "quarantined" : "reconciled_interval_state", reasons: sorted(reasons) });
    }
  }
  // Clocks at a shift boundary have two possible adjacent states. Do not invent event ordering.
  const eventChecks = (pbp.plays as any[]).filter(play => ["goal", "shot-on-goal"].includes(play.typeDescKey) && play.periodDescriptor.periodType !== "SO").map(play => {
    const clock = intervalClockSeconds(play.timeInPeriod);
    const adjacent = clock === null ? [] : spans.filter(span => span.period === play.periodDescriptor.number && span.start <= clock && clock <= span.end);
    const digits = typeof play.situationCode === "string" && /^[01][3-6][3-6][01]$/.test(play.situationCode) ? [...play.situationCode].map(Number) : null;
    const playerId = play.typeDescKey === "goal" ? play.details?.scoringPlayerId : play.details?.shootingPlayerId;
    const owner = play.details?.eventOwnerTeamId;
    const identityProved = [pbp.homeTeam.id, pbp.awayTeam.id].includes(owner) && positiveId(playerId) && roster.get(playerId)?.teamId === owner;
    const matches = adjacent.filter(span => identityProved && digits && span.awayGoalieIds.length === digits[0] && span.awaySkaterIds.length === digits[1]
      && span.homeSkaterIds.length === digits[2] && span.homeGoalieIds.length === digits[3]
      && (play.details?.eventOwnerTeamId === pbp.homeTeam.id ? span.homeSkaterIds : span.awaySkaterIds).includes(playerId)
      && (play.details?.goalieInNetId == null || (play.details.eventOwnerTeamId === pbp.homeTeam.id ? span.awayGoalieIds : span.homeGoalieIds).includes(play.details.goalieInNetId)));
    const boundary = adjacent.some(span => span.start === clock || span.end === clock);
    const status = gameStateReasons.length ? "joint_state_quarantined" : !identityProved ? "event_player_or_team_unproved"
      : !digits || !adjacent.length ? "event_clock_or_situation_unproved" : !matches.length ? "interval_event_state_conflict"
      : matches.some(span => span.status === "quarantined") ? "matching_state_quarantined" : boundary ? "boundary_compatible_order_unproved" : "interior_state_compatible";
    if (["interval_event_state_conflict", "event_clock_or_situation_unproved", "event_player_or_team_unproved"].includes(status)) for (const span of adjacent) {
      span.status = "quarantined"; span.reasons = sorted([...span.reasons, `${status}:${play.eventId}`]);
    }
    return { eventId: play.eventId, playerId: positiveId(playerId) ? playerId : null, period: play.periodDescriptor.number, clockSeconds: clock,
      rawSituationCode: play.situationCode ?? null, boundary, status, matchingSpanStarts: matches.map(span => span.start),
      eventToExposureCellEligible: false as const };
  });
  const cells = new Map<string, { teamId: number; cell: string; clockSeconds: number; skaterSeconds: number }>();
  for (const span of spans.filter(span => span.status === "reconciled_interval_state")) for (const home of [true, false]) {
    const ownSkaters = home ? span.homeSkaterIds : span.awaySkaterIds;
    const cell = spanCell(span, home), teamId = home ? pbp.homeTeam.id : pbp.awayTeam.id, key = `${teamId}:${cell}`;
    const total = cells.get(key) ?? { teamId, cell, clockSeconds: 0, skaterSeconds: 0 };
    total.clockSeconds += span.end - span.start; total.skaterSeconds += (span.end - span.start) * ownSkaters.length; cells.set(key, total);
  }
  const totalClockSeconds = periods.every(period => period.endSeconds !== null) ? periods.reduce((sum, period) => sum + period.endSeconds!, 0) : null;
  const reconciledStateClockSeconds = spans.filter(span => span.status === "reconciled_interval_state").reduce((sum, span) => sum + span.end - span.start, 0);
  const playerCellExposure = players.filter(player => !player.goalie).map(player => {
    const totals = new Map<string, number>();
    for (const span of spans.filter(span => span.status === "reconciled_interval_state")) {
      const home = player.teamId === pbp.homeTeam.id;
      const ownSkaters = home ? span.homeSkaterIds : span.awaySkaterIds;
      if (!ownSkaters.includes(player.playerId)) continue;
      const cell = spanCell(span, home);
      totals.set(cell, (totals.get(cell) ?? 0) + span.end - span.start);
    }
    const classifiedSeconds = [...totals.values()].reduce((sum, value) => sum + value, 0);
    const unclassifiedPresenceSeconds = player.supportedPresenceSeconds === null ? null : player.supportedPresenceSeconds - classifiedSeconds;
    return { playerId: player.playerId, teamId: player.teamId, historicalPositiveToiAppearance: player.boxToiSeconds === null ? null : player.boxToiSeconds > 0,
      cellSeconds: [...totals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([cell, seconds]) => ({ cell, seconds })),
      unclassifiedPresenceSeconds, completeJointCellClassification: unclassifiedPresenceSeconds === 0 };
  });
  return { gameId, homeTeamId: pbp.homeTeam.id, awayTeamId: pbp.awayTeam.id, periods, shootoutPeriods, sourceRows, overlaps, players, spans, eventChecks,
    playerCellExposure,
    cellExposure: [...cells.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value),
    totalClockSeconds, reconciledStateClockSeconds, quarantinedStateClockSeconds: totalClockSeconds === null ? null : totalClockSeconds - reconciledStateClockSeconds,
    reconciledSkaterPresenceSeconds: players.filter(player => !player.goalie && player.status === "reconciled").reduce((sum, player) => sum + player.supportedPresenceSeconds!, 0),
    unresolvedSkaterBoxToiSeconds: players.some(player => !player.goalie && player.boxToiSeconds === null) ? null
      : players.filter(player => !player.goalie && player.status === "quarantined").reduce((sum, player) => sum + player.boxToiSeconds!, 0),
    appearanceBasis: "historical_boxscore_positive_total_toi_only", forecastEstimatorEligible: false as const };
}
