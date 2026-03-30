import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
const webRoot = path.resolve(__dirname, "..");
const PARSER_VERSION = 1;
const STRENGTH_VERSION = 1;
const SHOT_LIKE_TYPES = new Set([
  "goal",
  "shot-on-goal",
  "missed-shot",
  "blocked-shot",
  "failed-shot-attempt",
]);

function parseEnvFile(text) {
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

async function loadEnv() {
  for (const envPath of [
    path.join(webRoot, ".env.local"),
    path.join(repoRoot, ".env.local"),
  ]) {
    try {
      parseEnvFile(await fs.readFile(envPath, "utf8"));
    } catch {
      // Ignore missing env files.
    }
  }
}

function sha256Json(payload) {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
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

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent": "fhfhockey-nhl-api-raw-ingest/1.0",
      accept: "application/json,text/plain,*/*",
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
  }
  return res.json();
}

async function fetchShiftCharts(gameId) {
  const pageSize = 1000;
  let start = 0;
  let total = Infinity;
  const rows = [];

  while (start < total) {
    const url = `https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId=${gameId}&start=${start}&limit=${pageSize}`;
    const payload = await fetchJson(url);
    total = payload.total ?? 0;
    rows.push(...(payload.data ?? []));
    if (!payload.data?.length) break;
    start += pageSize;
  }

  return { total: rows.length, data: rows };
}

async function upsertInBatches(supabase, table, rows, onConflict, batchSize = 500) {
  let count = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const query = supabase.from(table).upsert(batch, { onConflict });
    const { error } = await query;
    if (error) throw error;
    count += batch.length;
  }
  return count;
}

async function insertPayloadSnapshot(supabase, row) {
  const { error } = await supabase.from("nhl_api_game_payloads_raw").upsert(row, {
    onConflict: "game_id,endpoint,payload_hash",
    ignoreDuplicates: true,
  });
  if (error) throw error;
}

function normalizeRosterSpots(game, pbpHash) {
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

function normalizePbpEvents(game, pbpHash) {
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

function normalizeShiftRows(game, shiftPayload, shiftHash) {
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

async function ingestGame(supabase, gameId) {
  const pbpUrl = `https://api-web.nhle.com/v1/gamecenter/${gameId}/play-by-play`;
  const boxscoreUrl = `https://api-web.nhle.com/v1/gamecenter/${gameId}/boxscore`;
  const landingUrl = `https://api-web.nhle.com/v1/gamecenter/${gameId}/landing`;
  const shiftUrl = `https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId=${gameId}`;

  const [pbp, boxscore, landing, shiftPayload] = await Promise.all([
    fetchJson(pbpUrl),
    fetchJson(boxscoreUrl),
    fetchJson(landingUrl),
    fetchShiftCharts(gameId),
  ]);

  const fetchedAt = new Date().toISOString();
  const seasonId = Number(pbp.season);
  const gameDate = pbp.gameDate;
  const pbpHash = sha256Json(pbp);
  const boxscoreHash = sha256Json(boxscore);
  const landingHash = sha256Json(landing);
  const shiftHash = sha256Json(shiftPayload);

  await insertPayloadSnapshot(supabase, {
    game_id: gameId,
    endpoint: "play-by-play",
    season_id: seasonId,
    game_date: gameDate,
    source_url: pbpUrl,
    payload_hash: pbpHash,
    payload: pbp,
    fetched_at: fetchedAt,
  });

  await insertPayloadSnapshot(supabase, {
    game_id: gameId,
    endpoint: "boxscore",
    season_id: seasonId,
    game_date: gameDate,
    source_url: boxscoreUrl,
    payload_hash: boxscoreHash,
    payload: boxscore,
    fetched_at: fetchedAt,
  });

  await insertPayloadSnapshot(supabase, {
    game_id: gameId,
    endpoint: "landing",
    season_id: seasonId,
    game_date: gameDate,
    source_url: landingUrl,
    payload_hash: landingHash,
    payload: landing,
    fetched_at: fetchedAt,
  });

  await insertPayloadSnapshot(supabase, {
    game_id: gameId,
    endpoint: "shiftcharts",
    season_id: seasonId,
    game_date: gameDate,
    source_url: shiftUrl,
    payload_hash: shiftHash,
    payload: shiftPayload,
    fetched_at: fetchedAt,
  });

  const rosterRows = normalizeRosterSpots(pbp, pbpHash);
  const eventRows = normalizePbpEvents(pbp, pbpHash);
  const shiftRows = normalizeShiftRows(pbp, shiftPayload, shiftHash);

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

async function main() {
  await loadEnv();

  const gameIds = process.argv
    .slice(2)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  if (gameIds.length === 0) {
    throw new Error("Pass one or more NHL game IDs. Example: node web/scripts/ingest-nhl-api-raw.mjs 2025021103");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase credentials in environment.");
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const results = [];

  for (const gameId of gameIds) {
    results.push(await ingestGame(supabase, gameId));
  }

  console.log(JSON.stringify({ ok: true, results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
