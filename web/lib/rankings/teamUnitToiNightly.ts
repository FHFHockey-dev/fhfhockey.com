// Nightly team_unit_toi upkeep: add newly completed games to the season's CURRENT snapshot.
//
// The team matrix reads only the newest snapshot_date of a season, so a nightly run must never
// start a new snapshot: it reuses the latest one, and a season with no snapshot yet needs a
// backfill first. A game is done once its snapshot has a top forward line for both teams; a game
// whose shifts are missing or incomplete is skipped and stays undone, so the next run retries it.
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "lib/supabase/database-generated.types";

import type { TeamUnitToiInsert } from "./teamUnitToiBuilder";

/** Most games one nightly call builds; leftovers carry to the next call. */
export const NIGHTLY_MAX_GAMES = 40;
const REGULAR_AND_PLAYOFF_GAME_TYPES = [2, 3];

export type TeamUnitToiNightlyPlan =
  | { status: "no_snapshot"; snapshotDate: null; gameIds: []; pendingGames: number }
  | { status: "nothing_to_do"; snapshotDate: string; gameIds: []; pendingGames: 0 }
  | { status: "ready"; snapshotDate: string; gameIds: number[]; pendingGames: number };

/** Picks the oldest completed games not yet in the current snapshot. */
export function planTeamUnitToiNightly(args: {
  latestSnapshotDate: string | null;
  completedGames: { id: number; date: string }[];
  doneGameIds: Set<number>;
  maxGames?: number;
}): TeamUnitToiNightlyPlan {
  const pending = args.completedGames
    .filter((game) => !args.doneGameIds.has(game.id))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  if (args.latestSnapshotDate == null) {
    return { status: "no_snapshot", snapshotDate: null, gameIds: [], pendingGames: pending.length };
  }
  if (pending.length === 0) {
    return { status: "nothing_to_do", snapshotDate: args.latestSnapshotDate, gameIds: [], pendingGames: 0 };
  }
  return {
    status: "ready",
    snapshotDate: args.latestSnapshotDate,
    gameIds: pending.slice(0, args.maxGames ?? NIGHTLY_MAX_GAMES).map((game) => game.id),
    pendingGames: pending.length,
  };
}

/** Games whose built rows include a top forward line and a top defense pair for two teams. */
export function completeGameIds(rows: TeamUnitToiInsert[]) {
  const teamsByGame = new Map<number, { forward: Set<number>; defense: Set<number> }>();
  for (const row of rows) {
    if (row.unit_number !== 1) continue;
    if (row.unit_type !== "forward_line" && row.unit_type !== "defense_pair") continue;
    const entry = teamsByGame.get(row.game_id) ?? { forward: new Set(), defense: new Set() };
    (row.unit_type === "forward_line" ? entry.forward : entry.defense).add(row.team_id);
    teamsByGame.set(row.game_id, entry);
  }
  return new Set(
    [...teamsByGame.entries()]
      .filter(([, teams]) => teams.forward.size === 2 && teams.defense.size === 2)
      .map(([gameId]) => gameId),
  );
}

type Page<T> = PromiseLike<{ data: T[] | null; error: { message?: string } | null }>;

async function readOrThrow<T>(query: Page<T>, label: string) {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message ?? "unknown error"}`);
  return data ?? [];
}

const PAGE_SIZE = 1000; // Supabase answers at most 1,000 rows per request.

async function readAllPages<T>(page: (from: number, to: number) => Page<T>, label: string) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const chunk = await readOrThrow(page(from, from + PAGE_SIZE - 1), label);
    rows.push(...chunk);
    if (chunk.length < PAGE_SIZE) return rows;
  }
}

/** Reads what the planner needs: the latest snapshot, completed games and which are done. */
export async function loadTeamUnitToiNightlyPlan(
  supabase: SupabaseClient<Database>,
  args: { season: number; today: string; maxGames?: number },
) {
  const latest = await readOrThrow(
    supabase
      .from("team_unit_toi")
      .select("snapshot_date")
      .eq("season_id", args.season)
      .order("snapshot_date", { ascending: false })
      .limit(1) as unknown as Page<{ snapshot_date: string }>,
    "Failed to read the latest team unit-TOI snapshot",
  );
  const latestSnapshotDate = latest[0]?.snapshot_date ?? null;

  const games = await readAllPages(
    (from, to) =>
      supabase
        .from("games")
        .select("id,date")
        .eq("seasonId", args.season)
        .in("type", REGULAR_AND_PLAYOFF_GAME_TYPES)
        .lt("date", args.today)
        .order("id", { ascending: true })
        .range(from, to) as unknown as Page<{ id: number; date: string }>,
    "Failed to read completed games",
  );

  const doneGameIds = new Set<number>();
  if (latestSnapshotDate != null) {
    // One row per team-game: the top forward line. Two teams means the game is done.
    const topLines = await readAllPages(
      (from, to) =>
        supabase
          .from("team_unit_toi")
          .select("game_id,team_id")
          .eq("season_id", args.season)
          .eq("snapshot_date", latestSnapshotDate)
          .eq("unit_type", "forward_line")
          .eq("unit_number", 1)
          .order("id", { ascending: true })
          .range(from, to) as unknown as Page<{ game_id: number; team_id: number }>,
      "Failed to read games already in the snapshot",
    );
    const teamsByGame = new Map<number, Set<number>>();
    topLines.forEach((row) => {
      const teams = teamsByGame.get(row.game_id) ?? new Set<number>();
      teams.add(row.team_id);
      teamsByGame.set(row.game_id, teams);
    });
    teamsByGame.forEach((teams, gameId) => {
      if (teams.size === 2) doneGameIds.add(gameId);
    });
  }

  return planTeamUnitToiNightly({
    latestSnapshotDate,
    completedGames: games.map((game) => ({ id: Number(game.id), date: String(game.date) })),
    doneGameIds,
    maxGames: args.maxGames,
  });
}
