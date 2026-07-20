import supabase from "lib/supabase/server";
import { fetchAllSupabasePages } from "lib/supabase/pagination";
import {
  isCompleteStoredPbpEvidence,
  PBP_COMPLETENESS_SELECT,
  type StoredPbpEvidenceRow,
} from "lib/projections/pbpCompletenessServer";
import {
  fetchNhlApiShiftPlayerManifest,
  SHIFT_CHART_STRENGTH_OWNERSHIP_FILTER,
} from "lib/projections/shiftChartCompletenessServer";

import {
  classifyShiftChartStrengthGame,
  parseStrictShiftClock,
  SHIFT_CHART_STRENGTH_SELECT,
  type ShiftChartStrengthRow,
} from "../shiftChartCompleteness";
import { parseSituationDigits, strengthForTeam } from "./situation";

export type ProjectionDerivedGame = {
  id: number;
  date: string;
  homeTeamId: number;
  awayTeamId: number;
};

export type ProjectionDerivedPbpPlayRow = {
  id: number;
  gameid: number;
  situationcode: string | null;
  typedesckey: string | null;
  eventownerteamid: number | null;
  shootingplayerid: number | null;
  scoringplayerid: number | null;
  assist1playerid: number | null;
  assist2playerid: number | null;
  goalieinnetid: number | null;
};

export type ProjectionPlayerStrengthRow = {
  game_id: number;
  player_id: number;
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
  assists_es: number;
  assists_pp: number;
  assists_pk: number;
  hits: null;
  blocks: null;
  pim: null;
  plus_minus: null;
};

export type ProjectionTeamStrengthRow = {
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

type TeamStrengthAccumulator = ProjectionTeamStrengthRow;

type SplitCounts = {
  es: number;
  pp: number;
  pk: number;
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

function requireNonNegativeFinite(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Incomplete ${field} player-strength metric`);
  }
  return value;
}

export async function fetchProjectionDerivedGamesForDateRange(opts: {
  startDate: string;
  endDate: string;
}): Promise<ProjectionDerivedGame[]> {
  assertSupabase();
  return fetchAllSupabasePages<ProjectionDerivedGame>(({ from, to }) =>
    supabase
      .from("games")
      .select("id,date,homeTeamId,awayTeamId")
      .gte("date", opts.startDate)
      .lte("date", opts.endDate)
      .order("date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );
}

function validatePlayerSources(args: {
  game: ProjectionDerivedGame;
  shifts: ShiftChartStrengthRow[];
  expectedPlayerIds: number[];
  pbpGame: StoredPbpEvidenceRow | null;
  plays: ProjectionDerivedPbpPlayRow[];
}): void {
  const { game, shifts, expectedPlayerIds, pbpGame, plays } = args;
  const classification = classifyShiftChartStrengthGame({
    gameId: game.id,
    rows: shifts,
    expectedPlayerIds,
  });
  if (classification.status !== "complete") {
    throw new Error(
      `Shift-strength rows are ${classification.status} for game ${game.id}: ${classification.reasons.join(",")}`,
    );
  }

  const teamIds = new Set(shifts.map((row) => row.team_id));
  if (
    teamIds.size !== 2 ||
    !teamIds.has(game.homeTeamId) ||
    !teamIds.has(game.awayTeamId) ||
    shifts.some((row) => row.game_date !== game.date)
  ) {
    throw new Error(
      `Shift-strength schedule metadata mismatch for game ${game.id}`,
    );
  }

  const terminalEventCount = plays.filter(
    (play) => play.typedesckey === "game-end",
  ).length;
  if (
    !isCompleteStoredPbpEvidence(pbpGame, plays.length, terminalEventCount) ||
    plays.some(
      (play) =>
        !Number.isSafeInteger(play.id) ||
        play.id <= 0 ||
        play.gameid !== game.id ||
        (play.eventownerteamid != null &&
          play.eventownerteamid !== game.homeTeamId &&
          play.eventownerteamid !== game.awayTeamId) ||
        [
          play.shootingplayerid,
          play.scoringplayerid,
          play.assist1playerid,
          play.assist2playerid,
          play.goalieinnetid,
        ].some(
          (playerId) =>
            playerId != null &&
            (!Number.isSafeInteger(playerId) || playerId <= 0),
        ),
    )
  ) {
    throw new Error(`PBP evidence is incomplete for game ${game.id}`);
  }

  for (const play of plays) {
    if (!isShotForProjection(play.typedesckey)) continue;
    const goalPlay = isGoal(play.typedesckey);
    if (
      play.eventownerteamid == null ||
      parseSituationDigits(play.situationcode) == null ||
      (goalPlay ? play.scoringplayerid == null : play.shootingplayerid == null)
    ) {
      throw new Error(`Countable PBP event is incomplete for game ${game.id}`);
    }
  }
}

export async function preparePlayerGameStrengthV2(args: {
  game: ProjectionDerivedGame;
}): Promise<{
  rows: ProjectionPlayerStrengthRow[];
  plays: ProjectionDerivedPbpPlayRow[];
}> {
  assertSupabase();
  const { game } = args;
  const rawShiftPlayerIdsByGame = await fetchNhlApiShiftPlayerManifest([
    game.id,
  ]);
  const [shifts, pbpGameResult, plays] = await Promise.all([
    fetchAllSupabasePages<ShiftChartStrengthRow>(({ from, to }) =>
      supabase
        .from("shift_charts")
        .select(SHIFT_CHART_STRENGTH_SELECT)
        .eq("game_id", game.id)
        .or(SHIFT_CHART_STRENGTH_OWNERSHIP_FILTER)
        .order("id", { ascending: true })
        .range(from, to),
    ),
    supabase
      .from("pbp_games")
      .select(PBP_COMPLETENESS_SELECT)
      .eq("id", game.id)
      .maybeSingle<StoredPbpEvidenceRow>(),
    fetchAllSupabasePages<ProjectionDerivedPbpPlayRow>(({ from, to }) =>
      supabase
        .from("pbp_plays")
        .select(
          "id,gameid,situationcode,typedesckey,eventownerteamid,shootingplayerid,scoringplayerid,assist1playerid,assist2playerid,goalieinnetid",
        )
        .eq("gameid", game.id)
        .order("id", { ascending: true })
        .range(from, to),
    ),
  ]);
  if (pbpGameResult.error) throw pbpGameResult.error;

  validatePlayerSources({
    game,
    shifts,
    expectedPlayerIds: rawShiftPlayerIdsByGame.get(game.id) ?? [],
    pbpGame:
      (pbpGameResult.data as StoredPbpEvidenceRow | null | undefined) ?? null,
    plays,
  });

  const shotSplitsByPlayer = new Map<number, SplitCounts>();
  const goalSplitsByPlayer = new Map<number, SplitCounts>();
  const assistSplitsByPlayer = new Map<number, SplitCounts>();

  for (const play of plays) {
    const teamId = play.eventownerteamid;
    if (teamId == null || !isShotForProjection(play.typedesckey)) continue;
    const digits = parseSituationDigits(play.situationcode);
    if (digits == null) {
      throw new Error(`Countable PBP event is incomplete for game ${game.id}`);
    }
    const strength = strengthForTeam(
      digits,
      teamId,
      game.homeTeamId,
      game.awayTeamId,
    );
    const goalPlay = isGoal(play.typedesckey);
    const shotPlayerId =
      play.shootingplayerid ?? (goalPlay ? play.scoringplayerid : null);
    if (shotPlayerId != null) {
      const split = shotSplitsByPlayer.get(shotPlayerId) ?? emptySplit();
      addToSplit(split, strength);
      shotSplitsByPlayer.set(shotPlayerId, split);
    }
    if (!goalPlay || play.scoringplayerid == null) continue;

    const goalSplit =
      goalSplitsByPlayer.get(play.scoringplayerid) ?? emptySplit();
    addToSplit(goalSplit, strength);
    goalSplitsByPlayer.set(play.scoringplayerid, goalSplit);
    for (const assistPlayerId of [play.assist1playerid, play.assist2playerid]) {
      if (assistPlayerId == null) continue;
      const assistSplit =
        assistSplitsByPlayer.get(assistPlayerId) ?? emptySplit();
      addToSplit(assistSplit, strength);
      assistSplitsByPlayer.set(assistPlayerId, assistSplit);
    }
  }

  const rows = shifts
    .map((shift): ProjectionPlayerStrengthRow => {
      const playerId = shift.player_id!;
      const shots = shotSplitsByPlayer.get(playerId) ?? emptySplit();
      const goals = goalSplitsByPlayer.get(playerId) ?? emptySplit();
      const assists = assistSplitsByPlayer.get(playerId) ?? emptySplit();
      return {
        game_id: game.id,
        player_id: playerId,
        team_id: shift.team_id!,
        opponent_team_id: shift.opponent_team_id!,
        game_date: shift.game_date!,
        toi_es_seconds: requireStrictClock(shift.total_es_toi, "ES"),
        toi_pp_seconds: requireStrictClock(shift.total_pp_toi, "PP"),
        toi_pk_seconds: requireStrictClock(shift.total_pk_toi, "PK"),
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
      };
    })
    .sort((left, right) => left.player_id - right.player_id);

  if (rows.length === 0) {
    throw new Error(`No complete player-strength rows for game ${game.id}`);
  }
  return { rows, plays };
}

export function prepareTeamGameStrengthV2(args: {
  game: ProjectionDerivedGame;
  playerRows: ProjectionPlayerStrengthRow[];
}): ProjectionTeamStrengthRow[] {
  const { game, playerRows } = args;
  if (playerRows.length === 0) {
    throw new Error(`No player-strength rows for team build game ${game.id}`);
  }

  const seenPlayerIds = new Set<number>();
  const aggByTeam = new Map<number, TeamStrengthAccumulator>();
  for (const row of playerRows) {
    if (
      row.game_id !== game.id ||
      row.game_date !== game.date ||
      !Number.isSafeInteger(row.player_id) ||
      row.player_id <= 0 ||
      seenPlayerIds.has(row.player_id) ||
      (row.team_id !== game.homeTeamId && row.team_id !== game.awayTeamId) ||
      (row.opponent_team_id !== game.homeTeamId &&
        row.opponent_team_id !== game.awayTeamId) ||
      row.team_id === row.opponent_team_id
    ) {
      throw new Error(`Invalid player-strength identity for game ${game.id}`);
    }
    seenPlayerIds.add(row.player_id);

    const current = aggByTeam.get(row.team_id) ?? {
      game_id: game.id,
      team_id: row.team_id,
      opponent_team_id: row.opponent_team_id,
      game_date: game.date,
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
    if (current.opponent_team_id !== row.opponent_team_id) {
      throw new Error(
        `Contradictory player-strength opponent for game ${game.id}`,
      );
    }
    current.toi_es_seconds += requireNonNegativeFinite(
      row.toi_es_seconds,
      "ES TOI",
    );
    current.toi_pp_seconds += requireNonNegativeFinite(
      row.toi_pp_seconds,
      "PP TOI",
    );
    current.toi_pk_seconds += requireNonNegativeFinite(
      row.toi_pk_seconds,
      "PK TOI",
    );
    current.shots_es += requireNonNegativeFinite(row.shots_es, "ES shots");
    current.shots_pp += requireNonNegativeFinite(row.shots_pp, "PP shots");
    current.shots_pk += requireNonNegativeFinite(row.shots_pk, "PK shots");
    current.goals_es += requireNonNegativeFinite(row.goals_es, "ES goals");
    current.goals_pp += requireNonNegativeFinite(row.goals_pp, "PP goals");
    current.goals_pk += requireNonNegativeFinite(row.goals_pk, "PK goals");
    aggByTeam.set(row.team_id, current);
  }

  if (
    aggByTeam.size !== 2 ||
    !aggByTeam.has(game.homeTeamId) ||
    !aggByTeam.has(game.awayTeamId)
  ) {
    throw new Error(
      `Player-strength rows do not cover both teams for game ${game.id}`,
    );
  }

  return Array.from(aggByTeam.values()).sort(
    (left, right) => left.team_id - right.team_id,
  );
}
