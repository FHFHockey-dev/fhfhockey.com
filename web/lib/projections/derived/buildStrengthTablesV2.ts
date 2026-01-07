import supabase from "lib/supabase/server";

import { parseClockToSeconds } from "../ingest/time";
import { parseSituationDigits, strengthForTeam } from "./situation";

type GameRow = {
  id: number;
  date: string;
  homeTeamId: number;
  awayTeamId: number;
};

type ShiftTotalsRow = {
  game_id: number;
  player_id: number | null;
  team_id: number | null;
  opponent_team_id: number | null;
  game_date: string | null;
  total_es_toi: string | null;
  total_pp_toi: string | null;
  total_pk_toi: string | null;
};

type PbpPlayRow = {
  gameid: number;
  situationcode: string | null;
  typedesckey: string | null;
  eventownerteamid: number | null;
  shootingplayerid: number | null;
  scoringplayerid: number | null;
  assist1playerid: number | null;
  assist2playerid: number | null;
};

function assertSupabase() {
  if (!supabase) throw new Error("Supabase server client not available");
}

function isShotForProjection(typeDescKey: string | null): boolean {
  return typeDescKey === "shot-on-goal" || typeDescKey === "goal";
}

function isGoal(typeDescKey: string | null): boolean {
  return typeDescKey === "goal";
}

type SplitCounts = {
  es: number;
  pp: number;
  pk: number;
};

function emptySplit(): SplitCounts {
  return { es: 0, pp: 0, pk: 0 };
}

function addToSplit(split: SplitCounts, strength: "es" | "pp" | "pk", n = 1) {
  split[strength] += n;
}

export async function buildPlayerGameStrengthV2ForDateRange(opts: {
  startDate: string;
  endDate: string;
  deadlineMs?: number;
}): Promise<{ gamesProcessed: number; rowsUpserted: number }> {
  assertSupabase();
  const { startDate, endDate, deadlineMs } = opts;

  const { data: games, error: gamesErr } = await supabase
    .from("games")
    .select("id,date,homeTeamId,awayTeamId")
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });
  if (gamesErr) throw gamesErr;

  let rowsUpserted = 0;

  for (const game of (games ?? []) as GameRow[]) {
    if (deadlineMs != null && Date.now() > deadlineMs) break;
    const gameId = game.id;
    const gameDate = game.date;

    const { data: shifts, error: shiftsErr } = await supabase
      .from("shift_charts")
      .select("game_id,player_id,team_id,opponent_team_id,game_date,total_es_toi,total_pp_toi,total_pk_toi")
      .eq("game_id", gameId);
    if (shiftsErr) throw shiftsErr;

    const { data: plays, error: playsErr } = await supabase
      .from("pbp_plays")
      .select(
        "gameid,situationcode,typedesckey,eventownerteamid,shootingplayerid,scoringplayerid,assist1playerid,assist2playerid"
      )
      .eq("gameid", gameId);
    if (playsErr) throw playsErr;

    const shotSplitsByPlayer = new Map<number, SplitCounts>();
    const goalSplitsByPlayer = new Map<number, SplitCounts>();
    const assistSplitsByPlayer = new Map<number, SplitCounts>();

    for (const play of (plays ?? []) as PbpPlayRow[]) {
      const teamId = play.eventownerteamid;
      if (!teamId) continue;
      const digits = parseSituationDigits(play.situationcode);
      const strength = strengthForTeam(
        digits,
        teamId,
        game.homeTeamId,
        game.awayTeamId
      );

      if (isShotForProjection(play.typedesckey) && play.shootingplayerid) {
        const playerId = play.shootingplayerid;
        const split = shotSplitsByPlayer.get(playerId) ?? emptySplit();
        addToSplit(split, strength, 1);
        shotSplitsByPlayer.set(playerId, split);
      }

      if (isGoal(play.typedesckey) && play.scoringplayerid) {
        const scorerId = play.scoringplayerid;
        const split = goalSplitsByPlayer.get(scorerId) ?? emptySplit();
        addToSplit(split, strength, 1);
        goalSplitsByPlayer.set(scorerId, split);

        if (play.assist1playerid) {
          const a1 = assistSplitsByPlayer.get(play.assist1playerid) ?? emptySplit();
          addToSplit(a1, strength, 1);
          assistSplitsByPlayer.set(play.assist1playerid, a1);
        }
        if (play.assist2playerid) {
          const a2 = assistSplitsByPlayer.get(play.assist2playerid) ?? emptySplit();
          addToSplit(a2, strength, 1);
          assistSplitsByPlayer.set(play.assist2playerid, a2);
        }
      }
    }

    const upserts = ((shifts ?? []) as ShiftTotalsRow[])
      .filter((r) => r.player_id != null && r.team_id != null)
      .map((r) => {
        const playerId = r.player_id as number;
        const teamId = r.team_id as number;
        const opponentTeamId =
          (r.opponent_team_id as number | null) ??
          (teamId === game.homeTeamId ? game.awayTeamId : game.homeTeamId);

        const toiEsSeconds = r.total_es_toi ? parseClockToSeconds(r.total_es_toi) : null;
        const toiPpSeconds = r.total_pp_toi ? parseClockToSeconds(r.total_pp_toi) : null;
        const toiPkSeconds = r.total_pk_toi ? parseClockToSeconds(r.total_pk_toi) : null;

        const shots = shotSplitsByPlayer.get(playerId) ?? emptySplit();
        const goals = goalSplitsByPlayer.get(playerId) ?? emptySplit();
        const assists = assistSplitsByPlayer.get(playerId) ?? emptySplit();

        return {
          game_id: gameId,
          player_id: playerId,
          team_id: teamId,
          opponent_team_id: opponentTeamId,
          game_date: (r.game_date ?? gameDate) as string,

          toi_es_seconds: toiEsSeconds,
          toi_pp_seconds: toiPpSeconds,
          toi_pk_seconds: toiPkSeconds,

          shots_es: shots.es,
          shots_pp: shots.pp,
          shots_pk: shots.pk,

          goals_es: goals.es,
          goals_pp: goals.pp,
          goals_pk: goals.pk,

          assists_es: assists.es,
          assists_pp: assists.pp,
          assists_pk: assists.pk,

          hits: null,
          blocks: null,
          pim: null,
          plus_minus: null,

          updated_at: new Date().toISOString()
        };
      });

    if (upserts.length === 0) continue;

    const { error: upErr } = await supabase
      .from("forge_player_game_strength")
      .upsert(upserts, { onConflict: "game_id,player_id" });
    if (upErr) throw upErr;

    rowsUpserted += upserts.length;
  }

  return { gamesProcessed: (games ?? []).length, rowsUpserted };
}

export async function buildTeamGameStrengthV2ForDateRange(opts: {
  startDate: string;
  endDate: string;
  deadlineMs?: number;
}): Promise<{ gamesProcessed: number; rowsUpserted: number }> {
  assertSupabase();
  const { startDate, endDate, deadlineMs } = opts;

  const { data: games, error: gamesErr } = await supabase
    .from("games")
    .select("id,date,homeTeamId,awayTeamId")
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });
  if (gamesErr) throw gamesErr;

  let rowsUpserted = 0;

  for (const game of (games ?? []) as GameRow[]) {
    if (deadlineMs != null && Date.now() > deadlineMs) break;
    const gameId = game.id;
    const gameDate = game.date;

    const { data: rows, error } = await supabase
      .from("forge_player_game_strength")
      .select(
        "game_id,team_id,opponent_team_id,game_date,toi_es_seconds,toi_pp_seconds,toi_pk_seconds,shots_es,shots_pp,shots_pk,goals_es,goals_pp,goals_pk"
      )
      .eq("game_id", gameId);
    if (error) throw error;

    const aggByTeam = new Map<number, any>();
    for (const r of rows ?? []) {
      const teamId = (r as any).team_id as number;
      const opponentTeamId = (r as any).opponent_team_id as number | null;
      const key = teamId;
      const cur =
        aggByTeam.get(key) ??
        ({
          game_id: gameId,
          team_id: teamId,
          opponent_team_id: opponentTeamId ?? (teamId === game.homeTeamId ? game.awayTeamId : game.homeTeamId),
          game_date: (r as any).game_date ?? gameDate,
          toi_es_seconds: 0,
          toi_pp_seconds: 0,
          toi_pk_seconds: 0,
          shots_es: 0,
          shots_pp: 0,
          shots_pk: 0,
          goals_es: 0,
          goals_pp: 0,
          goals_pk: 0
        } as any);

      cur.toi_es_seconds += Number((r as any).toi_es_seconds ?? 0);
      cur.toi_pp_seconds += Number((r as any).toi_pp_seconds ?? 0);
      cur.toi_pk_seconds += Number((r as any).toi_pk_seconds ?? 0);
      cur.shots_es += Number((r as any).shots_es ?? 0);
      cur.shots_pp += Number((r as any).shots_pp ?? 0);
      cur.shots_pk += Number((r as any).shots_pk ?? 0);
      cur.goals_es += Number((r as any).goals_es ?? 0);
      cur.goals_pp += Number((r as any).goals_pp ?? 0);
      cur.goals_pk += Number((r as any).goals_pk ?? 0);

      aggByTeam.set(key, cur);
    }

    const upserts = Array.from(aggByTeam.values()).map((t) => ({
      ...t,
      updated_at: new Date().toISOString()
    }));

    if (upserts.length === 0) continue;

    const { error: upErr } = await supabase
      .from("forge_team_game_strength")
      .upsert(upserts, { onConflict: "game_id,team_id" });
    if (upErr) throw upErr;

    rowsUpserted += upserts.length;
  }

  return { gamesProcessed: (games ?? []).length, rowsUpserted };
}
