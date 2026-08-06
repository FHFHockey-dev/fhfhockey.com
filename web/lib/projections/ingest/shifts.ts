import supabase from "lib/supabase/server";
import type { TablesInsert } from "lib/supabase/database-generated.types";

import { nhleFetchJson } from "./nhleFetch";
import { formatSecondsToClock } from "./time";
import { fetchPbpGame, isCompleteFinalPbpPayload } from "./pbp";
import { parseStrictShiftClock } from "../shiftChartCompleteness";

export type NhleShiftRow = {
  gameId: number;
  playerId: number;
  teamId: number;
  teamAbbrev: string;
  firstName: string;
  lastName: string;
  shiftNumber: number;
  period: number;
  startTime: string;
  endTime: string;
  duration: string | null;
  typeCode: number;
};

type ShiftchartsResponse = {
  total: number;
  data: NhleShiftRow[];
};

export type NhleShiftChartsRawPayload = ShiftchartsResponse & {
  source: "json-api";
};

export type NhleShiftChartsSnapshot = {
  rows: NhleShiftRow[];
  rawPayload: NhleShiftChartsRawPayload;
};

export type ShiftStrengthUpsert = Pick<
  TablesInsert<"shift_charts">,
  | "game_id"
  | "game_type"
  | "player_id"
  | "team_id"
  | "opponent_team_id"
  | "team_abbreviation"
  | "opponent_team_abbreviation"
  | "game_date"
  | "season_id"
  | "player_first_name"
  | "player_last_name"
  | "total_es_toi"
  | "total_pp_toi"
  | "total_pk_toi"
  | "home_or_away"
  | "updated_at"
>;

export type Strength = "es" | "pp" | "pk";

export type ShiftRelationshipStrengthSegment = {
  playerId: number;
  shiftNumber: number;
  period: number;
  startTime: string;
  endTime: string;
  duration: string;
  strength: Strength;
};

type SituationDigits = {
  awayGoalie: number;
  awaySkaters: number;
  homeSkaters: number;
  homeGoalie: number;
};

function assertSupabase() {
  if (!supabase) throw new Error("Supabase server client not available");
}

function parseSituationDigits(
  situationCode: string | null | undefined,
): SituationDigits | null {
  if (!situationCode) return null;
  const s = situationCode.trim();
  if (!/^[01][0-6][0-6][01]$/.test(s)) return null;
  const awayGoalie = Number(s[0]);
  const awaySkaters = Number(s[1]);
  const homeSkaters = Number(s[2]);
  const homeGoalie = Number(s[3]);
  return { awayGoalie, awaySkaters, homeSkaters, homeGoalie };
}

function strengthForTeam(
  digits: SituationDigits,
  teamId: number,
  homeTeamId: number,
  awayTeamId: number,
): Strength {
  const isHome = teamId === homeTeamId;
  const mySkaters = isHome ? digits.homeSkaters : digits.awaySkaters;
  const oppSkaters = isHome ? digits.awaySkaters : digits.homeSkaters;
  if (mySkaters > oppSkaters) return "pp";
  if (mySkaters < oppSkaters) return "pk";
  return "es";
}

type Segment = {
  start: number;
  end: number;
  digits: SituationDigits;
};

type PeriodTimeline = {
  nominalLength: number;
  playedEnd: number;
  segments: Segment[];
};

function requirePbpClock(
  value: unknown,
  field: "timeInPeriod" | "timeRemaining",
  gameId: number,
  period: number,
  eventId: unknown,
): number {
  const seconds = parseStrictShiftClock(value);
  if (seconds == null) {
    throw new Error(
      `Invalid PBP ${field} clock for game ${gameId}, period ${period}, event ${String(
        eventId,
      )}`,
    );
  }
  return seconds;
}

function buildSituationTimelineForPeriod(
  plays: readonly any[],
  period: number,
  gameId: number,
): PeriodTimeline {
  const periodPlays = plays.filter(
    (play) => play?.periodDescriptor?.number === period,
  );
  if (periodPlays.length === 0) {
    throw new Error(
      `Missing PBP timeline for game ${gameId}, period ${period}`,
    );
  }

  let nominalLength: number | null = null;
  let periodStartCount = 0;
  const terminalTimes: number[] = [];
  const points = periodPlays.map((play, sourceIndex) => {
    const timeInPeriod = requirePbpClock(
      play?.timeInPeriod,
      "timeInPeriod",
      gameId,
      period,
      play?.eventId,
    );
    const timeRemaining = requirePbpClock(
      play?.timeRemaining,
      "timeRemaining",
      gameId,
      period,
      play?.eventId,
    );
    const eventNominalLength = timeInPeriod + timeRemaining;
    if (eventNominalLength <= 0) {
      throw new Error(
        `Invalid PBP period length for game ${gameId}, period ${period}`,
      );
    }
    if (nominalLength == null) nominalLength = eventNominalLength;
    else if (nominalLength !== eventNominalLength) {
      throw new Error(
        `Inconsistent PBP period length for game ${gameId}, period ${period}`,
      );
    }

    const digits = parseSituationDigits(play?.situationCode ?? null);
    if (!digits) {
      throw new Error(
        `Invalid PBP situation code for game ${gameId}, period ${period}, event ${String(
          play?.eventId,
        )}`,
      );
    }

    if (play?.typeDescKey === "period-start") {
      periodStartCount += 1;
      if (timeInPeriod !== 0) {
        throw new Error(
          `PBP period-start is not at 0:00 for game ${gameId}, period ${period}`,
        );
      }
    }
    if (
      play?.typeDescKey === "period-end" ||
      play?.typeDescKey === "game-end"
    ) {
      terminalTimes.push(timeInPeriod);
    }

    const eventId = Number(play?.eventId);
    const sortOrder = Number.isSafeInteger(play?.sortOrder)
      ? Number(play.sortOrder)
      : eventId;
    return { timeInPeriod, digits, sortOrder, eventId, sourceIndex };
  });

  if (periodStartCount !== 1) {
    throw new Error(
      `Expected exactly one PBP period-start for game ${gameId}, period ${period}`,
    );
  }
  if (terminalTimes.length === 0) {
    throw new Error(
      `Missing PBP period terminal for game ${gameId}, period ${period}`,
    );
  }

  const playedEnd = terminalTimes[0];
  if (
    playedEnd <= 0 ||
    playedEnd > nominalLength! ||
    terminalTimes.some((time) => time !== playedEnd)
  ) {
    throw new Error(
      `Inconsistent PBP period terminal for game ${gameId}, period ${period}`,
    );
  }
  if (points.some((point) => point.timeInPeriod > playedEnd)) {
    throw new Error(
      `PBP event occurs after the period terminal for game ${gameId}, period ${period}`,
    );
  }

  points.sort(
    (a, b) =>
      a.timeInPeriod - b.timeInPeriod ||
      a.sortOrder - b.sortOrder ||
      a.eventId - b.eventId ||
      a.sourceIndex - b.sourceIndex,
  );
  const pointsByTime = new Map<number, SituationDigits>();
  for (const point of points) {
    // Multiple events commonly share a timestamp. Canonical NHL sort order,
    // then event identity, decides which final state owns the next interval.
    pointsByTime.set(point.timeInPeriod, point.digits);
  }
  const uniquePoints = Array.from(pointsByTime, ([timeInPeriod, digits]) => ({
    timeInPeriod,
    digits,
  }));
  if (uniquePoints[0]?.timeInPeriod !== 0) {
    throw new Error(
      `PBP situation coverage does not start at 0:00 for game ${gameId}, period ${period}`,
    );
  }

  const segments: Segment[] = [];
  for (let index = 0; index < uniquePoints.length; index += 1) {
    const start = uniquePoints[index].timeInPeriod;
    if (start >= playedEnd) break;
    const nextStart = uniquePoints[index + 1]?.timeInPeriod ?? playedEnd;
    const end = Math.min(nextStart, playedEnd);
    if (end <= start) continue;
    segments.push({ start, end, digits: uniquePoints[index].digits });
  }

  const coveredSeconds = segments.reduce(
    (sum, segment) => sum + segment.end - segment.start,
    0,
  );
  if (
    segments.length === 0 ||
    segments[0].start !== 0 ||
    segments[segments.length - 1].end !== playedEnd ||
    coveredSeconds !== playedEnd ||
    segments.some(
      (segment, index) =>
        index > 0 && segments[index - 1].end !== segment.start,
    )
  ) {
    throw new Error(
      `Incomplete PBP situation coverage for game ${gameId}, period ${period}`,
    );
  }

  return { nominalLength: nominalLength!, playedEnd, segments };
}

function overlapSeconds(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): number {
  const start = Math.max(aStart, bStart);
  const end = Math.min(aEnd, bEnd);
  return Math.max(0, end - start);
}

export async function fetchAllNhleShiftChartsSnapshotForGame(
  gameId: number,
): Promise<NhleShiftChartsSnapshot> {
  if (!Number.isSafeInteger(gameId) || gameId <= 0) {
    throw new Error("Invalid NHL shift-chart game identity");
  }
  const pageSize = 1000;
  let start = 0;
  let rows: NhleShiftRow[] = [];
  let declaredTotal: number | null = null;

  while (declaredTotal == null || start < declaredTotal) {
    const url = `https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId=${gameId}&start=${start}&limit=${pageSize}`;
    const resp = await nhleFetchJson<ShiftchartsResponse>(url);
    if (
      !Number.isSafeInteger(resp.total) ||
      resp.total < 0 ||
      resp.total > 20_000 ||
      !Array.isArray(resp.data) ||
      resp.data.length > pageSize ||
      (declaredTotal != null && resp.total !== declaredTotal)
    ) {
      throw new Error(`Invalid NHL shift pagination metadata for game ${gameId}`);
    }
    declaredTotal = resp.total;
    if (
      rows.length + resp.data.length > declaredTotal ||
      (rows.length + resp.data.length < declaredTotal &&
        resp.data.length < pageSize)
    ) {
      throw new Error(`Incomplete NHL shift pagination for game ${gameId}`);
    }
    rows = rows.concat(resp.data);
    start += resp.data.length;
    if (resp.data.length === 0) break;
  }

  if (declaredTotal == null || rows.length !== declaredTotal) {
    throw new Error(`Incomplete NHL shift pagination for game ${gameId}`);
  }
  const identities = new Set<string>();
  for (const row of rows) {
    if (
      row.gameId !== gameId ||
      !Number.isSafeInteger(row.playerId) ||
      !Number.isSafeInteger(row.teamId) ||
      !Number.isSafeInteger(row.shiftNumber) ||
      !Number.isSafeInteger(row.period) ||
      !Number.isSafeInteger(row.typeCode) ||
      row.shiftNumber < 0 ||
      row.period < 0 ||
      typeof row.startTime !== "string" ||
      typeof row.endTime !== "string"
    ) {
      throw new Error(`Invalid NHL shift source row for game ${gameId}`);
    }
    const identity = [
      row.gameId,
      row.playerId,
      row.teamId,
      row.shiftNumber,
      row.period,
      row.startTime,
      row.endTime,
      row.duration ?? "",
      row.typeCode,
    ].join(":");
    if (identities.has(identity)) {
      throw new Error(`Duplicate NHL shift source row for game ${gameId}`);
    }
    identities.add(identity);
  }

  const rawPayload: NhleShiftChartsRawPayload = {
    total: rows.length,
    data: rows,
    source: "json-api",
  };
  const normalizedRows = [...rows].sort(
    (left, right) =>
      left.typeCode - right.typeCode ||
      left.playerId - right.playerId ||
      left.period - right.period ||
      left.shiftNumber - right.shiftNumber ||
      left.startTime.localeCompare(right.startTime) ||
      left.endTime.localeCompare(right.endTime),
  );
  return { rows: normalizedRows, rawPayload };
}

export async function fetchAllNhleShiftChartsForGame(
  gameId: number,
): Promise<NhleShiftRow[]> {
  return (await fetchAllNhleShiftChartsSnapshotForGame(gameId)).rows;
}

export async function upsertShiftTotalsForGame(gameId: number): Promise<{
  rowsUpserted: number;
}> {
  assertSupabase();

  const [pbp, shiftRows] = await Promise.all([
    fetchPbpGame(gameId),
    fetchAllNhleShiftChartsForGame(gameId),
  ]);
  return upsertShiftTotalsForGameFromPbp(gameId, pbp, shiftRows);
}

function requireShiftClock(value: unknown, field: string): number {
  const seconds = parseStrictShiftClock(value);
  if (seconds == null) throw new Error(`Invalid ${field} shift clock`);
  return seconds;
}

export function buildShiftStrengthUpserts(
  gameId: number,
  pbp: Awaited<ReturnType<typeof fetchPbpGame>>,
  shiftRows: readonly NhleShiftRow[],
  updatedAt = new Date().toISOString(),
): ShiftStrengthUpsert[] {
  if (!Number.isSafeInteger(gameId) || gameId <= 0 || pbp.id !== gameId) {
    throw new Error("Shift/PBP game identity mismatch");
  }
  if (!isCompleteFinalPbpPayload(pbp)) {
    throw new Error(`PBP payload is not final and complete for game ${gameId}`);
  }
  if (shiftRows.length === 0) {
    throw new Error(`No NHL shift rows returned for game ${gameId}`);
  }

  const intervalRows = shiftRows.filter((shift) => shift?.typeCode === 517);
  if (intervalRows.length === 0) {
    throw new Error(`No NHL shift interval rows returned for game ${gameId}`);
  }

  const homeTeamId = pbp.homeTeam.id;
  const awayTeamId = pbp.awayTeam.id;
  const gameDate = pbp.gameDate;
  const seasonId = Number(pbp.season);
  const gameType = String(pbp.gameType);
  if (
    !Number.isSafeInteger(homeTeamId) ||
    homeTeamId <= 0 ||
    !Number.isSafeInteger(awayTeamId) ||
    awayTeamId <= 0 ||
    homeTeamId === awayTeamId ||
    !Number.isSafeInteger(seasonId) ||
    seasonId <= 0 ||
    !/^[1-9]\d*$/.test(gameType) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(gameDate)
  ) {
    throw new Error(`Invalid PBP metadata for game ${gameId}`);
  }

  const timelinesByPeriod = new Map<number, PeriodTimeline>();
  for (const shift of intervalRows) {
    if (
      shift.gameId !== gameId ||
      !Number.isSafeInteger(shift.playerId) ||
      shift.playerId <= 0 ||
      (shift.teamId !== homeTeamId && shift.teamId !== awayTeamId) ||
      !Number.isSafeInteger(shift.period) ||
      shift.period <= 0 ||
      shift.teamAbbrev !==
        (shift.teamId === homeTeamId
          ? pbp.homeTeam.abbrev
          : pbp.awayTeam.abbrev) ||
      !shift.firstName.trim() ||
      !shift.lastName.trim()
    ) {
      throw new Error(`Invalid NHL shift identity for game ${gameId}`);
    }
    if (!timelinesByPeriod.has(shift.period)) {
      timelinesByPeriod.set(
        shift.period,
        buildSituationTimelineForPeriod(pbp.plays, shift.period, gameId),
      );
    }
  }

  const totalsByPlayer = new Map<
    number,
    {
      es: number;
      pp: number;
      pk: number;
      meta: Omit<
        ShiftStrengthUpsert,
        "total_es_toi" | "total_pp_toi" | "total_pk_toi"
      >;
    }
  >();

  for (const shift of intervalRows) {
    const playerId = shift.playerId;
    const teamId = shift.teamId;

    const timeline = timelinesByPeriod.get(shift.period);
    if (!timeline) {
      throw new Error(
        `Missing validated shift timeline for game ${gameId}, period ${shift.period}`,
      );
    }

    const shiftStart = requireShiftClock(shift.startTime, "start");
    const shiftEnd = requireShiftClock(shift.endTime, "end");
    const duration = requireShiftClock(shift.duration, "duration");
    if (duration <= 0) {
      throw new Error(
        `Shift duration must be positive for game ${gameId}, player ${playerId}`,
      );
    }

    let normalizedEnd: number;
    if (shiftEnd === 0) {
      normalizedEnd = shiftStart + duration;
      if (normalizedEnd !== timeline.playedEnd) {
        throw new Error(
          `Invalid zero-end shift sentinel for game ${gameId}, player ${playerId}`,
        );
      }
    } else {
      if (shiftEnd <= shiftStart || shiftEnd - shiftStart !== duration) {
        throw new Error(
          `Shift clock/duration mismatch for game ${gameId}, player ${playerId}`,
        );
      }
      normalizedEnd = shiftEnd;
    }
    if (
      shiftStart < 0 ||
      shiftStart >= timeline.playedEnd ||
      normalizedEnd > timeline.playedEnd
    ) {
      throw new Error(
        `Shift interval is outside played period for game ${gameId}, player ${playerId}`,
      );
    }

    let es = 0;
    let pp = 0;
    let pk = 0;
    let coveredSeconds = 0;
    for (const seg of timeline.segments) {
      const olap = overlapSeconds(
        shiftStart,
        normalizedEnd,
        seg.start,
        seg.end,
      );
      if (olap === 0) continue;
      coveredSeconds += olap;
      const strength = strengthForTeam(
        seg.digits,
        teamId,
        homeTeamId,
        awayTeamId,
      );
      if (strength === "pp") pp += olap;
      else if (strength === "pk") pk += olap;
      else es += olap;
    }
    if (coveredSeconds !== duration || es + pp + pk !== duration) {
      throw new Error(
        `Incomplete situation coverage for shift in game ${gameId}, player ${playerId}`,
      );
    }

    const existing = totalsByPlayer.get(playerId);
    const homeOrAway: "home" | "away" = teamId === homeTeamId ? "home" : "away";
    const opponentTeamId = homeOrAway === "home" ? awayTeamId : homeTeamId;
    const opponentTeamAbbrev =
      homeOrAway === "home" ? pbp.awayTeam.abbrev : pbp.homeTeam.abbrev;

    const meta = {
      game_id: gameId,
      game_type: gameType,
      player_id: playerId,
      team_id: teamId,
      opponent_team_id: opponentTeamId,
      team_abbreviation: shift.teamAbbrev,
      opponent_team_abbreviation: opponentTeamAbbrev,
      game_date: gameDate,
      season_id: seasonId,
      player_first_name: shift.firstName,
      player_last_name: shift.lastName,
      home_or_away: homeOrAway,
      updated_at: updatedAt,
    } satisfies Omit<
      ShiftStrengthUpsert,
      "total_es_toi" | "total_pp_toi" | "total_pk_toi"
    >;

    if (!existing) {
      totalsByPlayer.set(playerId, { es, pp, pk, meta });
    } else {
      if (
        existing.meta.team_id !== meta.team_id ||
        existing.meta.team_abbreviation !== meta.team_abbreviation ||
        existing.meta.player_first_name !== meta.player_first_name ||
        existing.meta.player_last_name !== meta.player_last_name
      ) {
        throw new Error(
          `Contradictory NHL shift metadata for player ${playerId} in game ${gameId}`,
        );
      }
      existing.es += es;
      existing.pp += pp;
      existing.pk += pk;
    }
  }

  const upserts: ShiftStrengthUpsert[] = [];
  for (const { es, pp, pk, meta } of totalsByPlayer.values()) {
    upserts.push({
      ...meta,
      total_es_toi: formatSecondsToClock(es),
      total_pp_toi: formatSecondsToClock(pp),
      total_pk_toi: formatSecondsToClock(pk),
    });
  }

  const teamIds = new Set(upserts.map((row) => row.team_id));
  if (
    teamIds.size !== 2 ||
    !teamIds.has(homeTeamId) ||
    !teamIds.has(awayTeamId)
  ) {
    throw new Error(
      `NHL shift rows do not cover both teams for game ${gameId}`,
    );
  }
  return upserts;
}

/**
 * Split every validated shift interval against the same complete PBP situation
 * timeline used for strength totals. This keeps relationship PP/ES arrays on
 * the input manifest's PBP generation instead of a separately scheduled table.
 */
export function buildShiftRelationshipStrengthSegments(
  gameId: number,
  pbp: Awaited<ReturnType<typeof fetchPbpGame>>,
  shiftRows: readonly NhleShiftRow[],
): ShiftRelationshipStrengthSegment[] {
  // Reuse the strict identity, final-PBP, both-team, clock, and full-coverage
  // checks before exposing any relationship segments.
  buildShiftStrengthUpserts(gameId, pbp, shiftRows, "1970-01-01T00:00:00.000Z");

  const homeTeamId = pbp.homeTeam.id;
  const awayTeamId = pbp.awayTeam.id;
  const timelinesByPeriod = new Map<number, PeriodTimeline>();
  const output: ShiftRelationshipStrengthSegment[] = [];

  const intervalRows = shiftRows
    .filter((row) => row.typeCode === 517)
    .slice()
    .sort(
      (left, right) =>
        left.playerId - right.playerId ||
        left.period - right.period ||
        left.shiftNumber - right.shiftNumber ||
        left.startTime.localeCompare(right.startTime),
    );
  for (const shift of intervalRows) {
    let timeline = timelinesByPeriod.get(shift.period);
    if (!timeline) {
      timeline = buildSituationTimelineForPeriod(
        pbp.plays,
        shift.period,
        gameId,
      );
      timelinesByPeriod.set(shift.period, timeline);
    }
    const start = requireShiftClock(shift.startTime, "start");
    const rawEnd = requireShiftClock(shift.endTime, "end");
    const duration = requireShiftClock(shift.duration, "duration");
    const end = rawEnd === 0 ? start + duration : rawEnd;

    for (const segment of timeline.segments) {
      const segmentStart = Math.max(start, segment.start);
      const segmentEnd = Math.min(end, segment.end);
      if (segmentEnd <= segmentStart) continue;
      const strength = strengthForTeam(
        segment.digits,
        shift.teamId,
        homeTeamId,
        awayTeamId,
      );
      const previous = output.at(-1);
      if (
        previous &&
        previous.playerId === shift.playerId &&
        previous.shiftNumber === shift.shiftNumber &&
        previous.period === shift.period &&
        previous.strength === strength &&
        requireShiftClock(previous.endTime, "segment end") === segmentStart
      ) {
        previous.endTime = formatSecondsToClock(segmentEnd);
        previous.duration = formatSecondsToClock(
          requireShiftClock(previous.duration, "segment duration") +
            segmentEnd -
            segmentStart,
        );
        continue;
      }
      output.push({
        playerId: shift.playerId,
        shiftNumber: shift.shiftNumber,
        period: shift.period,
        startTime: formatSecondsToClock(segmentStart),
        endTime: formatSecondsToClock(segmentEnd),
        duration: formatSecondsToClock(segmentEnd - segmentStart),
        strength,
      });
    }
  }

  return output;
}

export async function upsertShiftTotalsForGameFromPbp(
  gameId: number,
  pbp: Awaited<ReturnType<typeof fetchPbpGame>>,
  prefetchedShiftRows?: readonly NhleShiftRow[],
): Promise<{
  rowsUpserted: number;
}> {
  assertSupabase();

  const shiftRows =
    prefetchedShiftRows ?? (await fetchAllNhleShiftChartsForGame(gameId));
  const upserts = buildShiftStrengthUpserts(gameId, pbp, shiftRows);

  return replaceShiftStrengthRowsForGame(gameId, upserts);
}

export async function replaceShiftStrengthRowsForGame(
  gameId: number,
  upserts: readonly ShiftStrengthUpsert[],
): Promise<{
  rowsUpserted: number;
}> {
  assertSupabase();
  if (
    !Number.isSafeInteger(gameId) ||
    gameId <= 0 ||
    upserts.length === 0 ||
    upserts.some(
      (row) =>
        row.game_id !== gameId ||
        !Number.isSafeInteger(row.player_id) ||
        (row.player_id ?? 0) <= 0,
    )
  ) {
    throw new Error(
      `Invalid shift-strength replacement scope for game ${gameId}`,
    );
  }

  // Strength totals have a separate producer from the DRM relationship fields.
  // Clear only that producer's columns first so removed players cannot retain
  // stale totals and any later failure leaves the game visibly incomplete.
  const { error: invalidateError } = await supabase
    .from("shift_charts")
    .update({
      total_es_toi: null,
      total_pp_toi: null,
      total_pk_toi: null,
      updated_at: new Date().toISOString(),
    })
    .eq("game_id", gameId);
  if (invalidateError) throw invalidateError;

  const { error } = await supabase.from("shift_charts").upsert([...upserts], {
    onConflict: "game_id,player_id",
  });
  if (error) throw error;
  return { rowsUpserted: upserts.length };
}
