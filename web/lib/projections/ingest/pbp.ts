import supabase from "lib/supabase/server";

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

type PbpResponse = {
  id: number;
  season: number | string;
  gameType: number;
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

function assertSupabase() {
  if (!supabase) throw new Error("Supabase server client not available");
}

export async function fetchPbpGame(gameId: number): Promise<PbpResponse> {
  return nhleFetchJson<PbpResponse>(
    `https://api-web.nhle.com/v1/gamecenter/${gameId}/play-by-play`
  );
}

export async function upsertPbpGameAndPlays(game: PbpResponse): Promise<{
  playsUpserted: number;
}> {
  assertSupabase();

  const gameInfo = {
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
    created_at: new Date().toISOString()
  };

  const { error: gameErr } = await supabase.from("pbp_games").upsert(gameInfo);
  if (gameErr) throw gameErr;

  const plays = (game.plays ?? []).map((play) => {
    const details = play.details ?? {};
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
      typecode: play.typeCode ?? null,
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
      updated_at: new Date().toISOString()
    };
  });

  if (plays.length === 0) return { playsUpserted: 0 };
  const { error: playsErr } = await supabase.from("pbp_plays").upsert(plays);
  if (playsErr) throw playsErr;

  return { playsUpserted: plays.length };
}

