/**
 * NHL sometimes publishes an extra shiftcharts row whose start, end and
 * duration disagree. Games 2026020310, 2026020318 and 2026020399 each had one:
 * a row starting at 00:00 that is absent from the official HTML TOI report.
 * The clock/duration validator
 * rejects such a feed, and it must stay strict.
 *
 * This rule lets both shift writers store the official HTML report instead,
 * as the existing `htmlreports` envelope with the verbatim JSON in
 * `upstream.json`, only when the official record corroborates that the
 * mismatched rows are the only defect:
 *
 * 1. each mismatched row either lies inside the same player's remaining
 *    consistent intervals for that period under every reading of its clocks
 *    ([start,end], [start,start+duration], [end-duration,end]), so dropping
 *    it gives the same intervals whichever clock is wrong, or belongs to a
 *    dressed player who did not play: boxscore TOI 00:00, no rows in the HTML
 *    report and no other JSON row (2026020310's backup goalie);
 * 2. the HTML report rows equal the remaining JSON rows, row for row, for the
 *    whole game (player, team, period, shift number, start, end, duration),
 *    except that a JSON row the report lacks is accepted, and recorded, when
 *    it exactly repeats the interval (player, team, period, start, end,
 *    duration) of another JSON row the report does list (2026020310 had
 *    three such renumbered copies);
 * 3. every boxscore TOI equals the player's HTML total and the player's JSON
 *    total, each distinct interval counted once.
 *
 * The decision and the boxscore TOI it relied on travel in the envelope's
 * `corroboration`, and every reader re-checks it without the network.
 */

export const SHIFT_CORROBORATION_RULE =
  "shift-clock-mismatch-covered-and-officially-corroborated/v1";
export const SHIFT_CORROBORATION_EXCLUSION_REASON =
  "CLOCK_DURATION_MISMATCH_COVERED_UNDER_EVERY_READING_AND_ABSENT_FROM_OFFICIAL_RECORD";
export const SHIFT_CORROBORATION_ZERO_TOI_EXCLUSION_REASON =
  "CLOCK_DURATION_MISMATCH_FOR_PLAYER_WITH_ZERO_BOXSCORE_TOI_AND_NO_OFFICIAL_SHIFTS";
export const SHIFT_CORROBORATION_DUPLICATE_REASON =
  "EXACT_INTERVAL_DUPLICATE_OF_A_ROW_THE_OFFICIAL_REPORT_LISTS";
const MAX_EXCLUDED_ROWS = 2;
const BOXSCORE_GROUPS = ["forwards", "defense", "goalies"];

export class ShiftCorroborationError extends Error {
  constructor(reason, gameId) {
    super(`Shift corroboration refused for game ${gameId}: ${reason}`);
    this.name = "ShiftCorroborationError";
    this.code = "SHIFT_CORROBORATION_REJECTED";
    this.reason = reason;
  }
}

/** On unless `PROJECTION_SHIFT_CORROBORATION_ENABLED=false`; both writers read it. */
export function isShiftCorroborationEnabled(env = process.env) {
  return env.PROJECTION_SHIFT_CORROBORATION_ENABLED !== "false";
}

export function buildBoxscoreUrl(gameId) {
  return `https://api-web.nhle.com/v1/gamecenter/${gameId}/boxscore`;
}

/** Matches parseStrictShiftClock in lib/projections/shiftChartCompleteness.ts. */
function clockSeconds(value) {
  if (typeof value !== "string") return null;
  const match = /^(\d+):([0-5]\d)$/.exec(value);
  if (!match) return null;
  const total = Number(match[1]) * 60 + Number(match[2]);
  return Number.isSafeInteger(total) ? total : null;
}

function clocks(row) {
  const start = clockSeconds(row?.startTime);
  const end = clockSeconds(row?.endTime);
  const duration = clockSeconds(row?.duration);
  return start == null || end == null || duration == null
    ? null
    : { start, end, duration };
}

function rowId(row) {
  return Number.isSafeInteger(row?.id) && row.id > 0 ? row.id : null;
}

/** Rows the projection validator rejects as SHIFT_CLOCK_DURATION_MISMATCH. */
export function findShiftClockMismatchRows(rows) {
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    if (row?.typeCode !== 517) return false;
    const parsed = clocks(row);
    return (
      parsed != null &&
      parsed.end !== 0 &&
      (parsed.end <= parsed.start || parsed.end - parsed.start !== parsed.duration)
    );
  });
}

/** A consistent interval row, with the zero-end sentinel resolved; else null. */
function consistentInterval(row) {
  if (row?.typeCode !== 517) return null;
  const parsed = clocks(row);
  if (!parsed || parsed.duration <= 0) return null;
  if (parsed.end === 0) {
    return { start: parsed.start, end: parsed.start + parsed.duration };
  }
  return parsed.end - parsed.start === parsed.duration
    ? { start: parsed.start, end: parsed.end }
    : null;
}

/**
 * Ids of the remaining rows covering `row` under every clock reading, or null
 * when a reading is empty or negative or leaves the covered span.
 */
function coveringRowIds(row, remaining) {
  const parsed = clocks(row);
  if (!parsed) return null;
  const readings = [
    { start: parsed.start, end: parsed.end },
    { start: parsed.start, end: parsed.start + parsed.duration },
    { start: parsed.end - parsed.duration, end: parsed.end },
  ];
  if (readings.some((r) => r.start < 0 || r.end <= r.start)) return null;
  const siblings = remaining
    .filter((other) => other?.playerId === row.playerId &&
      other?.teamId === row.teamId && other?.period === row.period)
    .map((other) => ({ id: rowId(other), interval: consistentInterval(other) }))
    .filter((other) => other.interval != null)
    .sort((a, b) => a.interval.start - b.interval.start || a.interval.end - b.interval.end);
  const merged = [];
  for (const { interval } of siblings) {
    const last = merged.at(-1);
    if (last && interval.start <= last.end) last.end = Math.max(last.end, interval.end);
    else merged.push({ ...interval });
  }
  const covered = readings.every((reading) =>
    merged.some((span) => span.start <= reading.start && reading.end <= span.end));
  if (!covered) return null;
  const lo = Math.min(...readings.map((r) => r.start));
  const hi = Math.max(...readings.map((r) => r.end));
  const ids = siblings
    .filter(({ interval }) => interval.start < hi && interval.end > lo)
    .map(({ id }) => id);
  return ids.every((id) => id != null)
    ? [...new Set(ids)].sort((a, b) => a - b)
    : null;
}

/**
 * Why a mismatched row may be excluded, with the rows covering it, or null.
 * `boxPlayers` are the corroboration's boxscore entries.
 */
function exclusionFor(row, jsonRows, remaining, htmlRows, boxPlayers) {
  const coveredByIds = coveringRowIds(row, remaining);
  if (coveredByIds) return { reason: SHIFT_CORROBORATION_EXCLUSION_REASON, coveredByIds };
  const box = boxPlayers.filter((player) =>
    player?.playerId === row.playerId && player?.teamId === row.teamId);
  const didNotPlay =
    box.length === 1 &&
    clockSeconds(box[0].toi) === 0 &&
    !htmlRows.some((other) => other?.playerId === row.playerId) &&
    jsonRows.every((other) => other === row || other?.playerId !== row.playerId);
  return didNotPlay
    ? { reason: SHIFT_CORROBORATION_ZERO_TOI_EXCLUSION_REASON, coveredByIds: [] }
    : null;
}

/** Interval content key, without the shift number; the zero-end sentinel is resolved. */
function intervalKey(row) {
  const parsed = clocks(row);
  const end = parsed && parsed.end === 0 ? parsed.start + parsed.duration : parsed?.end;
  return JSON.stringify([
    row?.playerId, row?.teamId, row?.period,
    parsed?.start ?? null, end ?? null, parsed?.duration ?? null,
  ]);
}

/** Row content key: the interval and its shift number. */
function shiftKey(row) {
  return JSON.stringify([intervalKey(row), row?.shiftNumber]);
}

/**
 * Matches the remaining JSON interval rows to the report rows. Returns the
 * JSON rows the report lacks that exactly repeat the interval of a matched
 * row, or null when any other row disagrees.
 */
function matchReportRows(jsonIntervalRows, htmlRows) {
  const htmlKeys = htmlRows.map(shiftKey);
  const htmlKeySet = new Set(htmlKeys);
  if (htmlKeySet.size !== htmlKeys.length) return null;
  const matched = jsonIntervalRows.filter((row) => htmlKeySet.has(shiftKey(row)));
  if (new Set(matched.map(shiftKey)).size !== htmlKeySet.size) return null;
  const matchedIdByInterval = new Map();
  for (const row of matched) {
    const key = intervalKey(row);
    const id = rowId(row);
    if (id == null) return null;
    if (!matchedIdByInterval.has(key) || id < matchedIdByInterval.get(key)) {
      matchedIdByInterval.set(key, id);
    }
  }
  const duplicates = [];
  for (const row of jsonIntervalRows) {
    if (htmlKeySet.has(shiftKey(row))) continue;
    const duplicateOfId = matchedIdByInterval.get(intervalKey(row));
    const id = rowId(row);
    if (duplicateOfId == null || id == null) return null;
    duplicates.push({
      id,
      playerId: row.playerId,
      teamId: row.teamId,
      period: row.period,
      shiftNumber: row.shiftNumber,
      startTime: row.startTime,
      endTime: row.endTime,
      duration: row.duration,
      reason: SHIFT_CORROBORATION_DUPLICATE_REASON,
      duplicateOfId,
    });
  }
  return duplicates.sort((a, b) => a.id - b.id);
}

function boxscorePlayers(boxscore) {
  const players = [];
  for (const side of ["awayTeam", "homeTeam"]) {
    const teamId = boxscore?.[side]?.id;
    const groups = boxscore?.playerByGameStats?.[side] ?? {};
    for (const group of BOXSCORE_GROUPS) {
      for (const player of Array.isArray(groups[group]) ? groups[group] : []) {
        players.push({ playerId: player?.playerId, teamId, toi: player?.toi });
      }
    }
  }
  return players.sort((a, b) => a.teamId - b.teamId || a.playerId - b.playerId);
}

/**
 * Checks a corroborated `htmlreports` envelope against its own evidence and
 * throws ShiftCorroborationError unless every condition of the rule holds.
 * Live writers run it before storing, and stored readers on every read.
 */
export function verifyShiftCorroboration(gameId, payload) {
  const fail = (reason) => {
    throw new ShiftCorroborationError(reason, gameId);
  };
  const corroboration = payload?.corroboration;
  const jsonRows = payload?.upstream?.json?.data;
  const htmlRows = payload?.data;
  if (
    payload?.source !== "htmlreports" ||
    !Array.isArray(jsonRows) ||
    payload.upstream.json.total !== jsonRows.length ||
    !Array.isArray(htmlRows) ||
    htmlRows.length === 0 ||
    payload.total !== htmlRows.length ||
    corroboration?.rule !== SHIFT_CORROBORATION_RULE ||
    !Array.isArray(corroboration.excluded) ||
    !Array.isArray(corroboration.duplicates) ||
    corroboration.boxscore?.url !== buildBoxscoreUrl(gameId) ||
    !Array.isArray(corroboration.boxscore?.players)
  ) {
    return fail("INVALID_EVIDENCE");
  }

  const mismatches = findShiftClockMismatchRows(jsonRows);
  if (mismatches.length === 0 || corroboration.excluded.length !== mismatches.length) {
    return fail("INVALID_EVIDENCE");
  }
  if (mismatches.length > MAX_EXCLUDED_ROWS) return fail("TOO_MANY_CLOCK_MISMATCHES");
  const excludedIds = new Set();
  for (const row of mismatches) {
    const id = rowId(row);
    if (id == null || excludedIds.has(id) ||
      jsonRows.filter((other) => rowId(other) === id).length !== 1) {
      return fail("INVALID_EVIDENCE");
    }
    excludedIds.add(id);
  }
  const remaining = jsonRows.filter((row) => !excludedIds.has(rowId(row)));
  for (const row of mismatches) {
    const exclusion = exclusionFor(row, jsonRows, remaining, htmlRows, corroboration.boxscore.players);
    if (!exclusion) return fail("MISMATCH_NOT_COVERED_UNDER_EVERY_READING");
    const { coveredByIds } = exclusion;
    const record = corroboration.excluded.find((entry) => entry?.id === rowId(row));
    if (
      !record ||
      record.reason !== exclusion.reason ||
      record.playerId !== row.playerId ||
      record.teamId !== row.teamId ||
      record.period !== row.period ||
      record.shiftNumber !== row.shiftNumber ||
      record.startTime !== row.startTime ||
      record.endTime !== row.endTime ||
      record.duration !== row.duration ||
      JSON.stringify(record.coveredByIds) !== JSON.stringify(coveredByIds)
    ) {
      return fail("INVALID_EVIDENCE");
    }
  }

  const htmlSecondsByPlayer = new Map();
  for (const row of htmlRows) {
    const parsed = clocks(row);
    if (
      row?.typeCode !== 517 ||
      row?.gameId !== gameId ||
      !parsed ||
      parsed.end <= parsed.start ||
      parsed.end - parsed.start !== parsed.duration
    ) {
      return fail("HTML_ROW_INCONSISTENT");
    }
    const key = `${row.teamId}:${row.playerId}`;
    htmlSecondsByPlayer.set(key, (htmlSecondsByPlayer.get(key) ?? 0) + parsed.duration);
  }

  const boxKeys = new Set();
  for (const player of corroboration.boxscore.players) {
    const seconds = clockSeconds(player?.toi);
    const key = `${player?.teamId}:${player?.playerId}`;
    if (!Number.isSafeInteger(player?.playerId) || !Number.isSafeInteger(player?.teamId) ||
      seconds == null || boxKeys.has(key)) {
      return fail("INVALID_EVIDENCE");
    }
    boxKeys.add(key);
    if ((htmlSecondsByPlayer.get(key) ?? 0) !== seconds) {
      return fail("BOXSCORE_TOI_DISAGREES_WITH_HTML");
    }
  }
  if ([...htmlSecondsByPlayer.keys()].some((key) => !boxKeys.has(key))) {
    return fail("BOXSCORE_PLAYER_MISSING");
  }

  const jsonIntervalRows = remaining.filter((row) => row?.typeCode === 517);
  const duplicates = matchReportRows(jsonIntervalRows, htmlRows);
  if (!duplicates) return fail("HTML_ROWS_DISAGREE_WITH_JSON");
  if (JSON.stringify(duplicates) !== JSON.stringify(corroboration.duplicates)) {
    return fail("INVALID_EVIDENCE");
  }

  // Each distinct interval counts once, so a recorded duplicate adds nothing.
  const jsonSecondsByPlayer = new Map();
  const counted = new Set();
  for (const row of jsonIntervalRows) {
    const key = intervalKey(row);
    if (counted.has(key)) continue;
    counted.add(key);
    const player = `${row.teamId}:${row.playerId}`;
    jsonSecondsByPlayer.set(player, (jsonSecondsByPlayer.get(player) ?? 0) + clocks(row).duration);
  }
  for (const player of corroboration.boxscore.players) {
    const key = `${player.teamId}:${player.playerId}`;
    if ((jsonSecondsByPlayer.get(key) ?? 0) !== clockSeconds(player.toi)) {
      return fail("BOXSCORE_TOI_DISAGREES_WITH_JSON");
    }
  }
  if ([...jsonSecondsByPlayer.keys()].some((key) => !boxKeys.has(key))) {
    return fail("BOXSCORE_PLAYER_MISSING");
  }
  return payload;
}

/**
 * Adds the corroboration to a strict `htmlreports` envelope built from the
 * verbatim JSON feed, then checks it as stored readers will. Throws
 * ShiftCorroborationError when the official record does not agree.
 */
export function buildCorroboratedShiftPayload({ gameId, htmlPayload, boxscore }) {
  const fail = (reason) => {
    throw new ShiftCorroborationError(reason, gameId);
  };
  if (htmlPayload?.source !== "htmlreports") return fail("SOURCES_UNAVAILABLE");
  if (boxscore?.id !== gameId) return fail("INVALID_EVIDENCE");
  const jsonRows = htmlPayload.upstream?.json?.data ?? [];
  const mismatches = findShiftClockMismatchRows(jsonRows);
  if (mismatches.length === 0) return fail("INVALID_EVIDENCE");
  if (mismatches.length > MAX_EXCLUDED_ROWS) return fail("TOO_MANY_CLOCK_MISMATCHES");
  const ids = new Set(mismatches.map(rowId));
  const remaining = jsonRows.filter((row) => !ids.has(rowId(row)));
  const players = boxscorePlayers(boxscore);
  const excluded = mismatches.map((row) => {
    const id = rowId(row);
    if (id == null) return fail("INVALID_EVIDENCE");
    const exclusion = exclusionFor(row, jsonRows, remaining, htmlPayload.data ?? [], players);
    if (!exclusion) return fail("MISMATCH_NOT_COVERED_UNDER_EVERY_READING");
    return {
      id,
      playerId: row.playerId,
      teamId: row.teamId,
      period: row.period,
      shiftNumber: row.shiftNumber,
      startTime: row.startTime,
      endTime: row.endTime,
      duration: row.duration,
      reason: exclusion.reason,
      coveredByIds: exclusion.coveredByIds,
    };
  });
  const payload = {
    ...htmlPayload,
    corroboration: {
      rule: SHIFT_CORROBORATION_RULE,
      excluded,
      duplicates: matchReportRows(
        remaining.filter((row) => row?.typeCode === 517),
        htmlPayload.data ?? [],
      ) ?? [],
      boxscore: { url: buildBoxscoreUrl(gameId), players },
    },
  };
  return verifyShiftCorroboration(gameId, payload);
}
