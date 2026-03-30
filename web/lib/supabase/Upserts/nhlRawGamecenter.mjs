import crypto from "node:crypto";

export const PARSER_VERSION = 1;
export const STRENGTH_VERSION = 1;
export const DEFAULT_FETCH_RETRIES = 3;
export const DEFAULT_FETCH_TIMEOUT_MS = 20_000;
export const DEFAULT_RETRY_DELAY_MS = 500;

const SHOT_LIKE_TYPES = new Set([
  "goal",
  "shot-on-goal",
  "missed-shot",
  "blocked-shot",
  "failed-shot-attempt",
]);

function sha256Json(payload) {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseClockToSeconds(clock) {
  if (typeof clock !== "string") return null;
  const [minutes, seconds] = clock.trim().split(":").map(Number);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
  return minutes * 60 + seconds;
}

function parseSituationCode(situationCode) {
  if (!situationCode) return null;
  const raw = String(situationCode).trim();
  if (!/^\d{4}$/.test(raw)) return null;
  return {
    raw,
    awayGoalie: Number(raw[0]),
    awaySkaters: Number(raw[1]),
    homeSkaters: Number(raw[2]),
    homeGoalie: Number(raw[3]),
  };
}

function buildStrengthState(parsed, ownerTeamId, homeTeamId, awayTeamId) {
  if (!parsed) {
    return {
      strengthExact: null,
      strengthState: null,
      eventOwnerSide: null,
    };
  }

  const isHomeOwner = ownerTeamId === homeTeamId;
  const isAwayOwner = ownerTeamId === awayTeamId;
  const eventOwnerSide = isHomeOwner ? "home" : isAwayOwner ? "away" : null;
  const strengthExact = `${parsed.awaySkaters}v${parsed.homeSkaters}`;

  if (parsed.awayGoalie === 0 || parsed.homeGoalie === 0) {
    return { strengthExact, strengthState: "EN", eventOwnerSide };
  }

  if (parsed.awaySkaters === parsed.homeSkaters) {
    return { strengthExact, strengthState: "EV", eventOwnerSide };
  }

  if (!eventOwnerSide) {
    return { strengthExact, strengthState: null, eventOwnerSide };
  }

  const ownerSkaters = isHomeOwner ? parsed.homeSkaters : parsed.awaySkaters;
  const oppSkaters = isHomeOwner ? parsed.awaySkaters : parsed.homeSkaters;
  return {
    strengthExact,
    strengthState: ownerSkaters > oppSkaters ? "PP" : "SH",
    eventOwnerSide,
  };
}

function isRetryableFetchError(error) {
  const message = String(error?.message ?? error ?? "").toLowerCase();
  return (
    message.includes("und_err_socket") ||
    message.includes("socketerror") ||
    message.includes("fetch failed") ||
    message.includes("aborted") ||
    message.includes("timeout") ||
    message.includes("http 429") ||
    message.includes("http 500") ||
    message.includes("http 502") ||
    message.includes("http 503") ||
    message.includes("http 504")
  );
}

export async function fetchJsonWithRetry(url, options = {}) {
  const retries = options.retries ?? DEFAULT_FETCH_RETRIES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

  let lastError = null;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "user-agent": "fhfhockey-nhl-api-raw-ingest/1.0",
          accept: "application/json,text/plain,*/*",
        },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
      }
      return await res.json();
    } catch (error) {
      lastError = error;
      if (attempt === retries || !isRetryableFetchError(error)) {
        throw error;
      }
      await sleep(retryDelayMs * attempt);
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Failed to fetch ${url}`);
}

export async function fetchShiftCharts(gameId, fetchOptions = {}) {
  const pageSize = 1000;
  let start = 0;
  let total = Infinity;
  const rows = [];

  while (start < total) {
    const url = `https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId=${gameId}&start=${start}&limit=${pageSize}`;
    const payload = await fetchJsonWithRetry(url, fetchOptions);
    total = payload.total ?? 0;
    rows.push(...(payload.data ?? []));
    if (!payload.data?.length) break;
    start += pageSize;
  }

  return { total: rows.length, data: rows };
}

export async function fetchNhlApiRawGamePayloads(gameId, fetchOptions = {}) {
  const pbpUrl = `https://api-web.nhle.com/v1/gamecenter/${gameId}/play-by-play`;
  const boxscoreUrl = `https://api-web.nhle.com/v1/gamecenter/${gameId}/boxscore`;
  const landingUrl = `https://api-web.nhle.com/v1/gamecenter/${gameId}/landing`;
  const shiftUrl = `https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId=${gameId}`;

  const [pbp, boxscore, landing, shiftPayload] = await Promise.all([
    fetchJsonWithRetry(pbpUrl, fetchOptions),
    fetchJsonWithRetry(boxscoreUrl, fetchOptions),
    fetchJsonWithRetry(landingUrl, fetchOptions),
    fetchShiftCharts(gameId, fetchOptions),
  ]);

  return {
    gameId,
    seasonId: Number(pbp.season),
    gameDate: pbp.gameDate,
    fetchedAt: new Date().toISOString(),
    urls: {
      playByPlay: pbpUrl,
      boxscore: boxscoreUrl,
      landing: landingUrl,
      shiftcharts: shiftUrl,
    },
    payloads: {
      playByPlay: pbp,
      boxscore,
      landing,
      shiftcharts: shiftPayload,
    },
    hashes: {
      playByPlay: sha256Json(pbp),
      boxscore: sha256Json(boxscore),
      landing: sha256Json(landing),
      shiftcharts: sha256Json(shiftPayload),
    },
  };
}

export async function upsertInBatches(
  supabase,
  table,
  rows,
  onConflict,
  batchSize = 500
) {
  let count = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).upsert(batch, { onConflict });
    if (error) throw error;
    count += batch.length;
  }
  return count;
}

export async function insertPayloadSnapshot(supabase, row) {
  const { error } = await supabase.from("nhl_api_game_payloads_raw").upsert(row, {
    onConflict: "game_id,endpoint,payload_hash",
    ignoreDuplicates: true,
  });
  if (error) throw error;
}

export function normalizeRosterSpots(game, pbpHash) {
  return (game.rosterSpots ?? []).map((spot) => ({
    game_id: game.id,
    season_id: Number(game.season),
    game_date: game.gameDate,
    source_play_by_play_hash: pbpHash,
    parser_version: PARSER_VERSION,
    team_id: spot.teamId,
    player_id: spot.playerId,
    first_name: spot.firstName?.default ?? null,
    last_name: spot.lastName?.default ?? null,
    sweater_number: spot.sweaterNumber ?? null,
    position_code: spot.positionCode ?? null,
    headshot_url: spot.headshot ?? null,
    raw_spot: spot,
    updated_at: new Date().toISOString(),
  }));
}

export function normalizePbpEvents(game, pbpHash) {
  const seasonId = Number(game.season);
  const homeTeamId = game.homeTeam.id;
  const awayTeamId = game.awayTeam.id;

  return (game.plays ?? []).map((play) => {
    const details = play.details ?? {};
    const parsedSituation = parseSituationCode(play.situationCode);
    const strength = buildStrengthState(
      parsedSituation,
      details.eventOwnerTeamId ?? null,
      homeTeamId,
      awayTeamId
    );
    const typeDescKey = play.typeDescKey ?? null;

    return {
      game_id: game.id,
      season_id: seasonId,
      game_date: game.gameDate,
      source_play_by_play_hash: pbpHash,
      parser_version: PARSER_VERSION,
      strength_version: STRENGTH_VERSION,
      event_id: play.eventId,
      sort_order: play.sortOrder ?? null,
      period_number: play.periodDescriptor?.number ?? null,
      period_type: play.periodDescriptor?.periodType ?? null,
      time_in_period: play.timeInPeriod ?? null,
      time_remaining: play.timeRemaining ?? null,
      period_seconds_elapsed: parseClockToSeconds(play.timeInPeriod),
      time_remaining_seconds: parseClockToSeconds(play.timeRemaining),
      situation_code: play.situationCode ?? null,
      away_goalie: parsedSituation?.awayGoalie ?? null,
      away_skaters: parsedSituation?.awaySkaters ?? null,
      home_skaters: parsedSituation?.homeSkaters ?? null,
      home_goalie: parsedSituation?.homeGoalie ?? null,
      strength_exact: strength.strengthExact,
      strength_state: strength.strengthState,
      home_team_defending_side: play.homeTeamDefendingSide ?? null,
      type_code:
        play.typeCode == null || Number.isNaN(Number(play.typeCode))
          ? null
          : Number(play.typeCode),
      type_desc_key: typeDescKey,
      event_owner_team_id: details.eventOwnerTeamId ?? null,
      event_owner_side: strength.eventOwnerSide,
      is_shot_like: SHOT_LIKE_TYPES.has(typeDescKey),
      is_goal: typeDescKey === "goal",
      is_penalty: typeDescKey === "penalty",
      raw_event: play,
      details,
      losing_player_id: details.losingPlayerId ?? null,
      winning_player_id: details.winningPlayerId ?? null,
      shooting_player_id: details.shootingPlayerId ?? null,
      scoring_player_id: details.scoringPlayerId ?? null,
      goalie_in_net_id: details.goalieInNetId ?? null,
      blocking_player_id: details.blockingPlayerId ?? null,
      hitting_player_id: details.hittingPlayerId ?? null,
      hittee_player_id: details.hitteePlayerId ?? null,
      committed_by_player_id: details.committedByPlayerId ?? null,
      drawn_by_player_id: details.drawnByPlayerId ?? null,
      served_by_player_id: details.servedByPlayerId ?? null,
      player_id: details.playerId ?? null,
      assist1_player_id: details.assist1PlayerId ?? null,
      assist2_player_id: details.assist2PlayerId ?? null,
      shot_type: details.shotType ?? null,
      penalty_type_code: details.typeCode ?? null,
      penalty_desc_key: details.descKey ?? null,
      penalty_duration_minutes:
        details.duration == null || Number.isNaN(Number(details.duration))
          ? null
          : Number(details.duration),
      reason: details.reason ?? null,
      secondary_reason: details.secondaryReason ?? null,
      x_coord: details.xCoord ?? null,
      y_coord: details.yCoord ?? null,
      zone_code: details.zoneCode ?? null,
      home_score: details.homeScore ?? null,
      away_score: details.awayScore ?? null,
      home_sog: details.homeSOG ?? null,
      away_sog: details.awaySOG ?? null,
      updated_at: new Date().toISOString(),
    };
  });
}

export function normalizeShiftRows(game, shiftPayload, shiftHash) {
  const seasonId = Number(game.season);
  return (shiftPayload.data ?? []).map((shift) => ({
    game_id: game.id,
    shift_id: shift.id,
    season_id: seasonId,
    game_date: game.gameDate,
    source_shiftcharts_hash: shiftHash,
    parser_version: PARSER_VERSION,
    player_id: shift.playerId,
    team_id: shift.teamId,
    team_abbrev: shift.teamAbbrev ?? null,
    team_name: shift.teamName ?? null,
    first_name: shift.firstName ?? null,
    last_name: shift.lastName ?? null,
    period: shift.period ?? null,
    shift_number: shift.shiftNumber ?? null,
    start_time: shift.startTime ?? null,
    end_time: shift.endTime ?? null,
    duration: shift.duration ?? null,
    start_seconds: parseClockToSeconds(shift.startTime),
    end_seconds: parseClockToSeconds(shift.endTime),
    duration_seconds: parseClockToSeconds(shift.duration),
    type_code: shift.typeCode ?? null,
    detail_code: shift.detailCode ?? null,
    event_number: shift.eventNumber ?? null,
    event_description: shift.eventDescription ?? null,
    event_details: shift.eventDetails ?? null,
    hex_value: shift.hexValue ?? null,
    raw_shift: shift,
    updated_at: new Date().toISOString(),
  }));
}

export async function ingestNhlApiRawGame(supabase, gameId) {
  const fetched = await fetchNhlApiRawGamePayloads(gameId);

  await insertPayloadSnapshot(supabase, {
    game_id: gameId,
    endpoint: "play-by-play",
    season_id: fetched.seasonId,
    game_date: fetched.gameDate,
    source_url: fetched.urls.playByPlay,
    payload_hash: fetched.hashes.playByPlay,
    payload: fetched.payloads.playByPlay,
    fetched_at: fetched.fetchedAt,
  });

  await insertPayloadSnapshot(supabase, {
    game_id: gameId,
    endpoint: "boxscore",
    season_id: fetched.seasonId,
    game_date: fetched.gameDate,
    source_url: fetched.urls.boxscore,
    payload_hash: fetched.hashes.boxscore,
    payload: fetched.payloads.boxscore,
    fetched_at: fetched.fetchedAt,
  });

  await insertPayloadSnapshot(supabase, {
    game_id: gameId,
    endpoint: "landing",
    season_id: fetched.seasonId,
    game_date: fetched.gameDate,
    source_url: fetched.urls.landing,
    payload_hash: fetched.hashes.landing,
    payload: fetched.payloads.landing,
    fetched_at: fetched.fetchedAt,
  });

  await insertPayloadSnapshot(supabase, {
    game_id: gameId,
    endpoint: "shiftcharts",
    season_id: fetched.seasonId,
    game_date: fetched.gameDate,
    source_url: fetched.urls.shiftcharts,
    payload_hash: fetched.hashes.shiftcharts,
    payload: fetched.payloads.shiftcharts,
    fetched_at: fetched.fetchedAt,
  });

  const rosterRows = normalizeRosterSpots(
    fetched.payloads.playByPlay,
    fetched.hashes.playByPlay
  );
  const eventRows = normalizePbpEvents(
    fetched.payloads.playByPlay,
    fetched.hashes.playByPlay
  );
  const shiftRows = normalizeShiftRows(
    fetched.payloads.playByPlay,
    fetched.payloads.shiftcharts,
    fetched.hashes.shiftcharts
  );

  const rosterCount = rosterRows.length
    ? await upsertInBatches(
        supabase,
        "nhl_api_game_roster_spots",
        rosterRows,
        "game_id,player_id"
      )
    : 0;

  const eventCount = eventRows.length
    ? await upsertInBatches(
        supabase,
        "nhl_api_pbp_events",
        eventRows,
        "game_id,event_id"
      )
    : 0;

  const shiftCount = shiftRows.length
    ? await upsertInBatches(
        supabase,
        "nhl_api_shift_rows",
        shiftRows,
        "game_id,shift_id"
      )
    : 0;

  return {
    gameId,
    rosterCount,
    eventCount,
    shiftCount,
    rawEndpointsStored: 4,
  };
}

export async function ingestNhlApiRawGames(supabase, gameIds) {
  const results = [];
  for (const gameId of gameIds) {
    results.push(await ingestNhlApiRawGame(supabase, gameId));
  }
  return results;
}
