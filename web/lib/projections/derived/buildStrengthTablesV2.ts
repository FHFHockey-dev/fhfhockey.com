import supabase from "lib/supabase/server";
import type { Database } from "lib/supabase/database-generated.types";
import { fetchAllSupabasePages } from "lib/supabase/pagination";
import {
  isCompleteStoredPbpEvidence,
  PBP_COMPLETENESS_SELECT,
  type StoredPbpEvidenceRow,
} from "lib/projections/pbpCompletenessServer";
import { fetchNhlApiShiftPlayerManifest } from "lib/projections/shiftChartCompletenessServer";

import {
  classifyShiftChartStrengthGame,
  parseStrictShiftClock,
  SHIFT_CHART_STRENGTH_SELECT,
  type ShiftChartStrengthRow,
} from "../shiftChartCompleteness";
import { parseSituationDigits, strengthForTeam } from "./situation";

type GameRow = {
  id: number;
  date: string;
  homeTeamId: number;
  awayTeamId: number;
};

type PbpPlayRow = {
  id: number;
  gameid: number;
  situationcode: string | null;
  typedesckey: string | null;
  eventownerteamid: number | null;
  shootingplayerid: number | null;
  scoringplayerid: number | null;
  assist1playerid: number | null;
  assist2playerid: number | null;
};

type PlayerStrengthTableRow = Pick<
  Database["public"]["Tables"]["forge_player_game_strength"]["Row"],
  | "game_id"
  | "player_id"
  | "team_id"
  | "opponent_team_id"
  | "game_date"
  | "toi_es_seconds"
  | "toi_pp_seconds"
  | "toi_pk_seconds"
  | "shots_es"
  | "shots_pp"
  | "shots_pk"
  | "goals_es"
  | "goals_pp"
  | "goals_pk"
>;

type TeamStrengthAccumulator = {
  game_id: number;
  team_id: number;
  opponent_team_id: number;
  game_date: string;
  toi_es_seconds: number;
  toi_pp_seconds: number;
  toi_pk_seconds: number;
  shots_es: number;
  shots_pp: number;
  shots_pk: number;
  goals_es: number;
  goals_pp: number;
  goals_pk: number;
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

function requireStrictClock(value: string | null, field: string): number {
  const parsed = parseStrictShiftClock(value);
  if (parsed == null) throw new Error(`Incomplete ${field} strength clock`);
  return parsed;
}

function requireNonNegativeFinite(value: number | null, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`Incomplete ${field} player-strength metric`);
  }
  return value;
}

async function deleteDerivedGameScope(
  table: "forge_player_game_strength" | "forge_team_game_strength",
  gameId: number,
): Promise<void> {
  const { error } = await supabase.from(table).delete().eq("game_id", gameId);
  if (error) throw error;
}

export async function buildPlayerGameStrengthV2ForDateRange(opts: {
  startDate: string;
  endDate: string;
  deadlineMs?: number;
}): Promise<{ gamesProcessed: number; rowsUpserted: number }> {
  assertSupabase();
  const { startDate, endDate, deadlineMs } = opts;

  const games = await fetchAllSupabasePages<GameRow>(({ from, to }) =>
    supabase
      .from("games")
      .select("id,date,homeTeamId,awayTeamId")
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );
  // Player and team tables are derived snapshots. Clear the entire requested
  // game scope before reading sources so an incomplete or failed rebuild cannot
  // leave prior rows looking current. Delete team first so a later failure can
  // never expose a fresh-looking team aggregate backed by stale players.
  for (const game of games) {
    await deleteDerivedGameScope("forge_team_game_strength", game.id);
    await deleteDerivedGameScope("forge_player_game_strength", game.id);
  }
  const rawShiftPlayerIdsByGame = await fetchNhlApiShiftPlayerManifest(
    games.map((game) => game.id),
  );

  let rowsUpserted = 0;
  let gamesProcessed = 0;

  for (const game of games) {
    if (deadlineMs != null && Date.now() > deadlineMs) break;
    const gameId = game.id;
    const gameDate = game.date;

    const [shifts, pbpGameResult, plays] = await Promise.all([
      fetchAllSupabasePages<ShiftChartStrengthRow>(({ from, to }) =>
        supabase
          .from("shift_charts")
          .select(SHIFT_CHART_STRENGTH_SELECT)
          .eq("game_id", gameId)
          .order("id", { ascending: true })
          .range(from, to),
      ),
      supabase
        .from("pbp_games")
        .select(PBP_COMPLETENESS_SELECT)
        .eq("id", gameId)
        .maybeSingle<StoredPbpEvidenceRow>(),
      fetchAllSupabasePages<PbpPlayRow>(({ from, to }) =>
        supabase
          .from("pbp_plays")
          .select(
            "id,gameid,situationcode,typedesckey,eventownerteamid,shootingplayerid,scoringplayerid,assist1playerid,assist2playerid",
          )
          .eq("gameid", gameId)
          .order("id", { ascending: true })
          .range(from, to),
      ),
    ]);

    if (pbpGameResult.error) throw pbpGameResult.error;

    const classification = classifyShiftChartStrengthGame({
      gameId,
      rows: shifts,
      expectedPlayerIds: rawShiftPlayerIdsByGame.get(gameId) ?? [],
    });
    if (classification.status !== "complete") {
      throw new Error(
        `Shift-strength rows are ${classification.status} for game ${gameId}: ${classification.reasons.join(",")}`,
      );
    }
    const teamIds = new Set(shifts.map((row) => row.team_id));
    if (
      teamIds.size !== 2 ||
      !teamIds.has(game.homeTeamId) ||
      !teamIds.has(game.awayTeamId) ||
      shifts.some((row) => row.game_date !== gameDate)
    ) {
      throw new Error(
        `Shift-strength schedule metadata mismatch for game ${gameId}`,
      );
    }
    const terminalEventCount = plays.filter(
      (play) => play.typedesckey === "game-end",
    ).length;
    if (
      !isCompleteStoredPbpEvidence(
        (pbpGameResult.data as StoredPbpEvidenceRow | null) ?? null,
        plays.length,
        terminalEventCount,
      ) ||
      plays.some(
        (play) =>
          !Number.isSafeInteger(play.id) ||
          play.id <= 0 ||
          play.gameid !== gameId ||
          (play.eventownerteamid != null &&
            play.eventownerteamid !== game.homeTeamId &&
            play.eventownerteamid !== game.awayTeamId) ||
          [
            play.shootingplayerid,
            play.scoringplayerid,
            play.assist1playerid,
            play.assist2playerid,
          ].some(
            (playerId) =>
              playerId != null &&
              (!Number.isSafeInteger(playerId) || playerId <= 0),
          ),
      )
    ) {
      throw new Error(`PBP evidence is incomplete for game ${gameId}`);
    }

    for (const play of plays) {
      if (!isShotForProjection(play.typedesckey)) continue;
      const goalPlay = isGoal(play.typedesckey);
      if (
        play.eventownerteamid == null ||
        parseSituationDigits(play.situationcode) == null ||
        (goalPlay
          ? play.scoringplayerid == null
          : play.shootingplayerid == null)
      ) {
        throw new Error(`Countable PBP event is incomplete for game ${gameId}`);
      }
    }

    const shotSplitsByPlayer = new Map<number, SplitCounts>();
    const goalSplitsByPlayer = new Map<number, SplitCounts>();
    const assistSplitsByPlayer = new Map<number, SplitCounts>();

    for (const play of plays) {
      const teamId = play.eventownerteamid;
      if (!teamId) continue;
      const isGoalPlay = isGoal(play.typedesckey);
      const isShotPlay = isShotForProjection(play.typedesckey);
      const digits = parseSituationDigits(play.situationcode);
      if (isShotPlay && digits == null) {
        throw new Error(`Countable PBP event is incomplete for game ${gameId}`);
      }
      if (!isShotPlay) continue;
      const strength = strengthForTeam(
        digits!,
        teamId,
        game.homeTeamId,
        game.awayTeamId,
      );

      // Goal events should count as SOG. Some goal rows have null shootingplayerid,
      // so fall back to scoringplayerid for shot attribution.
      const shotPlayerId =
        play.shootingplayerid ?? (isGoalPlay ? play.scoringplayerid : null);
      if (isShotPlay && shotPlayerId) {
        const playerId = shotPlayerId;
        const split = shotSplitsByPlayer.get(playerId) ?? emptySplit();
        addToSplit(split, strength, 1);
        shotSplitsByPlayer.set(playerId, split);
      }

      if (isGoalPlay && play.scoringplayerid) {
        const scorerId = play.scoringplayerid;
        const split = goalSplitsByPlayer.get(scorerId) ?? emptySplit();
        addToSplit(split, strength, 1);
        goalSplitsByPlayer.set(scorerId, split);

        if (play.assist1playerid) {
          const a1 =
            assistSplitsByPlayer.get(play.assist1playerid) ?? emptySplit();
          addToSplit(a1, strength, 1);
          assistSplitsByPlayer.set(play.assist1playerid, a1);
        }
        if (play.assist2playerid) {
          const a2 =
            assistSplitsByPlayer.get(play.assist2playerid) ?? emptySplit();
          addToSplit(a2, strength, 1);
          assistSplitsByPlayer.set(play.assist2playerid, a2);
        }
      }
    }

    const upserts = shifts.map((r) => {
      const playerId = r.player_id!;
      const teamId = r.team_id!;
      const opponentTeamId = r.opponent_team_id!;

      const toiEsSeconds = requireStrictClock(r.total_es_toi, "ES");
      const toiPpSeconds = requireStrictClock(r.total_pp_toi, "PP");
      const toiPkSeconds = requireStrictClock(r.total_pk_toi, "PK");

      const shots = shotSplitsByPlayer.get(playerId) ?? emptySplit();
      const goals = goalSplitsByPlayer.get(playerId) ?? emptySplit();
      const assists = assistSplitsByPlayer.get(playerId) ?? emptySplit();

      return {
        game_id: gameId,
        player_id: playerId,
        team_id: teamId,
        opponent_team_id: opponentTeamId,
        game_date: r.game_date!,

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

        updated_at: new Date().toISOString(),
      };
    });

    if (upserts.length === 0) {
      throw new Error(`No complete player-strength rows for game ${gameId}`);
    }

    const { error: upErr } = await supabase
      .from("forge_player_game_strength")
      .upsert(upserts, { onConflict: "game_id,player_id" });
    if (upErr) throw upErr;

    rowsUpserted += upserts.length;
    gamesProcessed += 1;
  }

  return { gamesProcessed, rowsUpserted };
}

export async function buildTeamGameStrengthV2ForDateRange(opts: {
  startDate: string;
  endDate: string;
  deadlineMs?: number;
}): Promise<{ gamesProcessed: number; rowsUpserted: number }> {
  assertSupabase();
  const { startDate, endDate, deadlineMs } = opts;

  const games = await fetchAllSupabasePages<GameRow>(({ from, to }) =>
    supabase
      .from("games")
      .select("id,date,homeTeamId,awayTeamId")
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );
  for (const game of games) {
    await deleteDerivedGameScope("forge_team_game_strength", game.id);
  }
  const rawShiftPlayerIdsByGame = await fetchNhlApiShiftPlayerManifest(
    games.map((game) => game.id),
  );

  let rowsUpserted = 0;
  let gamesProcessed = 0;

  for (const game of games) {
    if (deadlineMs != null && Date.now() > deadlineMs) break;
    const gameId = game.id;
    const gameDate = game.date;

    const [rows, shiftRows] = await Promise.all([
      fetchAllSupabasePages<PlayerStrengthTableRow>(({ from, to }) =>
        supabase
          .from("forge_player_game_strength")
          .select(
            "game_id,player_id,team_id,opponent_team_id,game_date,toi_es_seconds,toi_pp_seconds,toi_pk_seconds,shots_es,shots_pp,shots_pk,goals_es,goals_pp,goals_pk",
          )
          .eq("game_id", gameId)
          .order("player_id", { ascending: true })
          .range(from, to),
      ),
      fetchAllSupabasePages<ShiftChartStrengthRow>(({ from, to }) =>
        supabase
          .from("shift_charts")
          .select(SHIFT_CHART_STRENGTH_SELECT)
          .eq("game_id", gameId)
          .order("id", { ascending: true })
          .range(from, to),
      ),
    ]);
    if (rows.length === 0) {
      throw new Error(`No player-strength rows for team build game ${gameId}`);
    }

    const shiftClassification = classifyShiftChartStrengthGame({
      gameId,
      rows: shiftRows,
      expectedPlayerIds: rawShiftPlayerIdsByGame.get(gameId) ?? [],
    });
    if (
      shiftClassification.status !== "complete" ||
      shiftRows.some((row) => row.game_date !== gameDate) ||
      !new Set(shiftRows.map((row) => row.team_id)).has(game.homeTeamId) ||
      !new Set(shiftRows.map((row) => row.team_id)).has(game.awayTeamId)
    ) {
      throw new Error(
        `Shift-strength source is incomplete for team build game ${gameId}`,
      );
    }

    const expectedPlayerIds = new Set(shiftClassification.playerIds);
    const derivedPlayerIds = new Set<number>();
    for (const row of rows) {
      if (
        !Number.isSafeInteger(row.player_id) ||
        row.player_id <= 0 ||
        derivedPlayerIds.has(row.player_id)
      ) {
        throw new Error(
          `Invalid player-strength player set for game ${gameId}`,
        );
      }
      derivedPlayerIds.add(row.player_id);
    }
    if (
      derivedPlayerIds.size !== expectedPlayerIds.size ||
      Array.from(expectedPlayerIds).some(
        (playerId) => !derivedPlayerIds.has(playerId),
      )
    ) {
      throw new Error(`Stale player-strength player set for game ${gameId}`);
    }

    const aggByTeam = new Map<number, TeamStrengthAccumulator>();
    for (const r of rows) {
      const teamId = r.team_id;
      const opponentTeamId = r.opponent_team_id;
      if (
        r.game_id !== gameId ||
        r.game_date !== gameDate ||
        (teamId !== game.homeTeamId && teamId !== game.awayTeamId) ||
        (opponentTeamId !== game.homeTeamId &&
          opponentTeamId !== game.awayTeamId) ||
        teamId === opponentTeamId
      ) {
        throw new Error(`Invalid player-strength identity for game ${gameId}`);
      }
      const key = teamId;
      const cur = aggByTeam.get(key) ?? {
        game_id: gameId,
        team_id: teamId,
        opponent_team_id: opponentTeamId,
        game_date: gameDate,
        toi_es_seconds: 0,
        toi_pp_seconds: 0,
        toi_pk_seconds: 0,
        shots_es: 0,
        shots_pp: 0,
        shots_pk: 0,
        goals_es: 0,
        goals_pp: 0,
        goals_pk: 0,
      };
      if (cur.opponent_team_id !== opponentTeamId) {
        throw new Error(
          `Contradictory player-strength opponent for game ${gameId}`,
        );
      }

      cur.toi_es_seconds += requireNonNegativeFinite(
        r.toi_es_seconds,
        "ES TOI",
      );
      cur.toi_pp_seconds += requireNonNegativeFinite(
        r.toi_pp_seconds,
        "PP TOI",
      );
      cur.toi_pk_seconds += requireNonNegativeFinite(
        r.toi_pk_seconds,
        "PK TOI",
      );
      cur.shots_es += requireNonNegativeFinite(r.shots_es, "ES shots");
      cur.shots_pp += requireNonNegativeFinite(r.shots_pp, "PP shots");
      cur.shots_pk += requireNonNegativeFinite(r.shots_pk, "PK shots");
      cur.goals_es += requireNonNegativeFinite(r.goals_es, "ES goals");
      cur.goals_pp += requireNonNegativeFinite(r.goals_pp, "PP goals");
      cur.goals_pk += requireNonNegativeFinite(r.goals_pk, "PK goals");

      aggByTeam.set(key, cur);
    }

    if (
      aggByTeam.size !== 2 ||
      !aggByTeam.has(game.homeTeamId) ||
      !aggByTeam.has(game.awayTeamId)
    ) {
      throw new Error(
        `Player-strength rows do not cover both teams for game ${gameId}`,
      );
    }

    const upserts = Array.from(aggByTeam.values()).map((t) => ({
      ...t,
      updated_at: new Date().toISOString(),
    }));

    const { error: upErr } = await supabase
      .from("forge_team_game_strength")
      .upsert(upserts, { onConflict: "game_id,team_id" });
    if (upErr) throw upErr;

    rowsUpserted += upserts.length;
    gamesProcessed += 1;
  }

  return { gamesProcessed, rowsUpserted };
}
