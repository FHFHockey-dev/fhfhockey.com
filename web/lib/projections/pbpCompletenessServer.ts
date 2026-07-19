import type { Database } from "lib/supabase/database-generated.types";
import supabase from "lib/supabase/server";
import {
  fetchAllSupabaseFilterChunks,
  fetchAllSupabasePages,
} from "lib/supabase/pagination";

type PbpGameTableRow = Database["public"]["Tables"]["pbp_games"]["Row"];
export type StoredPbpEvidenceRow = Pick<
  PbpGameTableRow,
  | "id"
  | "date"
  | "hometeamid"
  | "awayteamid"
  | "type"
  | "season"
  | "hometeamabbrev"
  | "awayteamabbrev"
  | "hometeamscore"
  | "awayteamscore"
>;
type PbpTerminalPlayRow = Pick<
  Database["public"]["Tables"]["pbp_plays"]["Row"],
  "id" | "gameid" | "typedesckey"
>;

export const PBP_COMPLETENESS_SELECT =
  "id,date,hometeamid,awayteamid,type,season,hometeamabbrev,awayteamabbrev,hometeamscore,awayteamscore";

export type ExpectedPbpSourceEvidence = {
  game: StoredPbpEvidenceRow;
  eventIds: number[];
};

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function isCompleteStoredPbpEvidence(
  row: StoredPbpEvidenceRow | null,
  playCount: number,
  terminalEventCount: number,
): boolean {
  if (
    !row ||
    !Number.isSafeInteger(playCount) ||
    playCount <= terminalEventCount ||
    terminalEventCount !== 1
  ) {
    return false;
  }
  return (
    isPositiveSafeInteger(row.id) &&
    typeof row.date === "string" &&
    isValidIsoDate(row.date) &&
    isPositiveSafeInteger(row.hometeamid) &&
    isPositiveSafeInteger(row.awayteamid) &&
    row.hometeamid !== row.awayteamid &&
    isPositiveSafeInteger(row.type) &&
    typeof row.season === "string" &&
    /^[1-9]\d*$/.test(row.season) &&
    typeof row.hometeamabbrev === "string" &&
    row.hometeamabbrev.trim() !== "" &&
    typeof row.awayteamabbrev === "string" &&
    row.awayteamabbrev.trim() !== "" &&
    isNonNegativeSafeInteger(row.hometeamscore) &&
    isNonNegativeSafeInteger(row.awayteamscore) &&
    row.hometeamscore + row.awayteamscore > 0
  );
}

export function isStoredPbpSourceParity(
  storedGame: StoredPbpEvidenceRow | null,
  storedPlays: readonly PbpTerminalPlayRow[],
  expected: ExpectedPbpSourceEvidence,
): boolean {
  if (!storedGame) return false;
  const expectedIds = [...expected.eventIds].sort((a, b) => a - b);
  const storedIds = storedPlays.map((play) => play.id).sort((a, b) => a - b);
  if (
    expected.game.id !== storedGame.id ||
    expectedIds.length !== new Set(expectedIds).size ||
    expectedIds.some((id) => !isPositiveSafeInteger(id)) ||
    storedPlays.some(
      (play) =>
        play.gameid !== expected.game.id || !isPositiveSafeInteger(play.id),
    ) ||
    storedIds.length !== expectedIds.length ||
    storedIds.some((id, index) => id !== expectedIds[index])
  ) {
    return false;
  }

  const fields: Array<keyof StoredPbpEvidenceRow> = [
    "id",
    "date",
    "hometeamid",
    "awayteamid",
    "type",
    "season",
    "hometeamabbrev",
    "awayteamabbrev",
    "hometeamscore",
    "awayteamscore",
  ];
  return fields.every((field) => storedGame[field] === expected.game[field]);
}

export async function hasCompleteStoredPbpGame(
  gameId: number,
  expected?: ExpectedPbpSourceEvidence,
): Promise<boolean> {
  if (expected) {
    const [gameResult, plays] = await Promise.all([
      supabase
        .from("pbp_games")
        .select(PBP_COMPLETENESS_SELECT)
        .eq("id", gameId)
        .maybeSingle(),
      fetchAllSupabasePages<PbpTerminalPlayRow>(({ from, to }) =>
        supabase
          .from("pbp_plays")
          .select("id,gameid,typedesckey")
          .eq("gameid", gameId)
          .order("id", { ascending: true })
          .range(from, to),
      ),
    ]);
    if (gameResult.error) throw gameResult.error;
    const storedGame = (gameResult.data as StoredPbpEvidenceRow | null) ?? null;
    const terminalEventCount = plays.filter(
      (play) => play.typedesckey === "game-end",
    ).length;
    return (
      isCompleteStoredPbpEvidence(
        storedGame,
        plays.length,
        terminalEventCount,
      ) && isStoredPbpSourceParity(storedGame, plays, expected)
    );
  }

  const [gameResult, allPlaysResult, terminalPlaysResult] = await Promise.all([
    supabase
      .from("pbp_games")
      .select(PBP_COMPLETENESS_SELECT)
      .eq("id", gameId)
      .maybeSingle(),
    supabase
      .from("pbp_plays")
      .select("id", { count: "exact", head: true })
      .eq("gameid", gameId),
    supabase
      .from("pbp_plays")
      .select("id", { count: "exact", head: true })
      .eq("gameid", gameId)
      .eq("typedesckey", "game-end"),
  ]);
  if (gameResult.error) throw gameResult.error;
  if (allPlaysResult.error) throw allPlaysResult.error;
  if (terminalPlaysResult.error) throw terminalPlaysResult.error;
  return isCompleteStoredPbpEvidence(
    (gameResult.data as StoredPbpEvidenceRow | null) ?? null,
    allPlaysResult.count ?? 0,
    terminalPlaysResult.count ?? 0,
  );
}

export async function classifyStoredPbpGames(
  gameIds: Iterable<number>,
): Promise<Map<number, boolean>> {
  const uniqueGameIds = Array.from(new Set(gameIds));
  const [games, plays] = await Promise.all([
    fetchAllSupabaseFilterChunks<StoredPbpEvidenceRow, number>(
      uniqueGameIds,
      (chunk, { from, to }) =>
        supabase
          .from("pbp_games")
          .select(PBP_COMPLETENESS_SELECT)
          .in("id", chunk)
          .order("id", { ascending: true })
          .range(from, to),
    ),
    fetchAllSupabaseFilterChunks<PbpTerminalPlayRow, number>(
      uniqueGameIds,
      (chunk, { from, to }) =>
        supabase
          .from("pbp_plays")
          .select("id,gameid,typedesckey")
          .in("gameid", chunk)
          .order("gameid", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to),
    ),
  ]);
  const gameById = new Map(games.map((game) => [game.id, game]));
  const playCounts = new Map<number, number>();
  const terminalEventCounts = new Map<number, number>();
  for (const play of plays) {
    playCounts.set(play.gameid, (playCounts.get(play.gameid) ?? 0) + 1);
    if (play.typedesckey === "game-end") {
      terminalEventCounts.set(
        play.gameid,
        (terminalEventCounts.get(play.gameid) ?? 0) + 1,
      );
    }
  }
  return new Map(
    uniqueGameIds.map((gameId) => [
      gameId,
      isCompleteStoredPbpEvidence(
        gameById.get(gameId) ?? null,
        playCounts.get(gameId) ?? 0,
        terminalEventCounts.get(gameId) ?? 0,
      ),
    ]),
  );
}
