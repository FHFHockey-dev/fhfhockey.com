import supabase from "lib/supabase/server";
import type { TablesInsert } from "lib/supabase/database-generated.types";
import {
  isCompleteStoredPbpEvidence,
  type ExpectedPbpSourceEvidence,
} from "lib/projections/pbpCompletenessServer";

import { nhleFetchJson } from "./nhleFetch";

type PbpPlay = {
  eventId: number;
  periodDescriptor?: { number?: number; periodType?: string };
  timeInPeriod?: string;
  timeRemaining?: string;
  situationCode?: string;
  typeDescKey?: string;
  typeCode?: number | string;
  homeTeamDefendingSide?: string;
  sortOrder?: number;
  details?: Record<string, any>;
};

export type PbpResponse = {
  id: number;
  season: number | string;
  gameType: number;
  gameState?: string;
  gameDate: string;
  startTimeUTC: string;
  venue?: { default?: string };
  awayTeam: {
    id: number;
    abbrev: string;
    commonName: { default: string };
    score: number;
  };
  homeTeam: {
    id: number;
    abbrev: string;
    commonName: { default: string };
    score: number;
  };
  plays: PbpPlay[];
};

export type PbpGamePersistenceRow = Omit<
  TablesInsert<"pbp_games">,
  "created_at" | "id"
> & {
  id: number;
};

export type PbpPlayPersistenceRow = Omit<
  TablesInsert<"pbp_plays">,
  "updated_at"
>;

export type PbpPersistenceRows = {
  gameRow: PbpGamePersistenceRow;
  playRows: PbpPlayPersistenceRow[];
};

export function buildExpectedPbpSourceEvidence(
  game: PbpResponse,
): ExpectedPbpSourceEvidence {
  return {
    game: {
      id: game.id,
      date: game.gameDate,
      hometeamid: game.homeTeam?.id ?? null,
      awayteamid: game.awayTeam?.id ?? null,
      type: game.gameType,
      season: String(game.season),
      hometeamabbrev: game.homeTeam?.abbrev ?? null,
      awayteamabbrev: game.awayTeam?.abbrev ?? null,
      hometeamscore: game.homeTeam?.score ?? null,
      awayteamscore: game.awayTeam?.score ?? null,
    },
    eventIds: Array.isArray(game.plays)
      ? game.plays.map((play) => play.eventId)
      : [],
  };
}

function assertSupabase() {
  if (!supabase) throw new Error("Supabase server client not available");
}

export async function fetchPbpGame(gameId: number): Promise<PbpResponse> {
  return nhleFetchJson<PbpResponse>(
    `https://api-web.nhle.com/v1/gamecenter/${gameId}/play-by-play`,
  );
}

export function isCompleteFinalPbpPayload(game: PbpResponse): boolean {
  if (!Array.isArray(game.plays)) return false;

  const eventIds = new Set<number>();
  let terminalEventCount = 0;
  for (const play of game.plays) {
    if (
      !Number.isSafeInteger(play?.eventId) ||
      play.eventId <= 0 ||
      eventIds.has(play.eventId)
    ) {
      return false;
    }
    eventIds.add(play.eventId);
    if (play.typeDescKey === "game-end") terminalEventCount += 1;
  }

  return (
    (game.gameState === "OFF" || game.gameState === "FINAL") &&
    isCompleteStoredPbpEvidence(
      buildExpectedPbpSourceEvidence(game).game,
      game.plays.length,
      terminalEventCount,
    )
  );
}

/**
 * Normalize one final NHL PBP snapshot into the database-owned columns used by
 * the projection input transaction. Volatile persistence timestamps are
 * deliberately excluded; the database writes those inside the transaction.
 */
export function buildPbpPersistenceRows(game: PbpResponse): PbpPersistenceRows {
  if (!isCompleteFinalPbpPayload(game)) {
    throw new Error(
      `PBP payload is not final and complete for game ${game.id}`,
    );
  }

  const gameRow: PbpGamePersistenceRow = {
    id: game.id,
    date: game.gameDate,
    starttime: game.startTimeUTC,
    type: game.gameType,
    season: String(game.season),
    hometeamid: game.homeTeam.id,
    awayteamid: game.awayTeam.id,
    hometeamname: game.homeTeam.commonName.default,
    hometeamabbrev: game.homeTeam.abbrev,
    hometeamscore: game.homeTeam.score,
    awayteamname: game.awayTeam.commonName.default,
    awayteamabbrev: game.awayTeam.abbrev,
    awayteamscore: game.awayTeam.score,
    location: game.venue?.default ?? null,
  };

  const playRows = game.plays
    .map((play): PbpPlayPersistenceRow => {
      const details = play.details ?? {};
      const typeCode = play.typeCode == null ? null : Number(play.typeCode);
      if (typeCode != null && !Number.isSafeInteger(typeCode)) {
        throw new Error(
          `PBP payload has an invalid type code for game ${game.id}, event ${play.eventId}`,
        );
      }
      return {
        id: play.eventId,
        gameid: game.id,
        game_date: game.gameDate,
        periodnumber: play.periodDescriptor?.number ?? null,
        periodtype: play.periodDescriptor?.periodType ?? null,
        timeinperiod: play.timeInPeriod ?? null,
        timeremaining: play.timeRemaining ?? null,
        situationcode: play.situationCode ?? null,
        typedesckey: play.typeDescKey ?? null,
        typecode: typeCode,
        hometeamdefendingside: play.homeTeamDefendingSide ?? null,
        sortorder: play.sortOrder ?? null,
        eventownerteamid: details.eventOwnerTeamId ?? null,
        losingplayerid: details.losingPlayerId ?? null,
        winningplayerid: details.winningPlayerId ?? null,
        shootingplayerid: details.shootingPlayerId ?? null,
        goalieinnetid: details.goalieInNetId ?? null,
        awaysog: details.awaySOG ?? null,
        homesog: details.homeSOG ?? null,
        blockingplayerid: details.blockingPlayerId ?? null,
        hittingplayerid: details.hittingPlayerId ?? null,
        hitteeplayerid: details.hitteePlayerId ?? null,
        durationofpenalty: details.duration ?? null,
        committedbyplayerid: details.committedByPlayerId ?? null,
        drawnbyplayerid: details.drawnByPlayerId ?? null,
        penalizedteam: details.typeCode ?? null,
        scoringplayerid: details.scoringPlayerId ?? null,
        scoringplayertotal: details.scoringPlayerTotal ?? null,
        shottype: details.shotType ?? null,
        assist1playerid: details.assist1PlayerId ?? null,
        assist1playertotal: details.assist1PlayerTotal ?? null,
        assist2playerid: details.assist2PlayerId ?? null,
        assist2playertotal: details.assist2PlayerTotal ?? null,
        homescore: details.homeScore ?? null,
        awayscore: details.awayScore ?? null,
        playerid: details.playerId ?? null,
        zonecode: details.zoneCode ?? null,
        xcoord: details.xCoord ?? null,
        ycoord: details.yCoord ?? null,
        reason: details.reason ?? null,
      };
    })
    .sort((left, right) => left.id - right.id);

  return { gameRow, playRows };
}

export async function upsertPbpGameAndPlays(game: PbpResponse): Promise<{
  playsUpserted: number;
}> {
  assertSupabase();
  const { gameRow, playRows } = buildPbpPersistenceRows(game);
  const persistedAt = new Date().toISOString();
  const gameInfo = {
    ...gameRow,
    created_at: persistedAt,
  };
  const plays = playRows.map((row) => ({
    ...row,
    updated_at: persistedAt,
  }));

  // The upstream response is a complete snapshot. Remove the prior game scope
  // first so corrected or withdrawn events cannot survive a successful refresh.
  // If a later write fails, the missing terminal play makes stored completeness
  // fail closed and prevents dependent materialization from using a mixed set.
  const { error: deleteErr } = await supabase
    .from("pbp_plays")
    .delete()
    .eq("gameid", game.id);
  if (deleteErr) throw deleteErr;

  const { error: gameErr } = await supabase
    .from("pbp_games")
    .upsert(gameInfo, { onConflict: "id" });
  if (gameErr) throw gameErr;

  const { error: playsErr } = await supabase
    .from("pbp_plays")
    .upsert(plays, { onConflict: "gameid,id" });
  if (playsErr) throw playsErr;

  return { playsUpserted: plays.length };
}
