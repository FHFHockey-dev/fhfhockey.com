// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\LineCombinations\utilities.ts

import { NUM_PLAYERS_PER_LINE } from "components/LinemateMatrix";
import { addHours } from "date-fns";
import { getCurrentSeason } from "lib/NHL/server";
import supabase from "lib/supabase";
import { fetchAllSupabasePages } from "lib/supabase/pagination";
import type { GoalieStats, SkaterStats } from "pages/lines/[abbreviation]";
import { parseTime } from "utils/getPowerPlayBlocks";
import {
  LINES_FIVE_ON_FIVE_ENABLED,
  buildFiveOnFiveLines,
  type TeamUnitToiReaderRow
} from "./fiveOnFiveUnits";

export type LineCombinations = {
  game: {
    id: number;
    startTime: string;
    teamId: number;
    seasonId: number;
  };
  /** The games the card stats are totalled over (the team's last 10 with line data). */
  statsGameIds: number[];
  /**
   * Where the lines come from: observed 5v5 units placed disjointly
   * (decisions 107, 137) or the labelled all-strength legacy grouping.
   */
  lineSource: LineSource;
  /**
   * Clock seconds each board unit was on the ice together at 5v5 in the last
   * game, in board order (line 1 first); null on the legacy board.
   */
  fiveOnFiveUnitSeconds: FiveOnFiveUnitSeconds | null;
  promotions: LineChangeInfo[];
  demotions: LineChangeInfo[];
  forwards: {
    line1: SkaterStats[];
    line2: SkaterStats[];
    line3: SkaterStats[];
    line4: SkaterStats[];
  };
  defensemen: {
    line1: SkaterStats[];
    line2: SkaterStats[];
    line3: SkaterStats[];
  };
  goalies: {
    line1: GoalieStats[];
    line2: GoalieStats[];
  };
};

const isLineCombinationDebugEnabled = process.env.NODE_ENV !== "production";

function debugLineCombinationsLog(label: string, value: unknown) {
  if (isLineCombinationDebugEnabled) {
    console.log(label, value);
  }
}

export function aggregateSkaterToiSeconds(
  rows: readonly { playerId: number; toi: string }[]
): Map<number, number> {
  const totals = new Map<number, number>();
  rows.forEach((row) => {
    totals.set(row.playerId, (totals.get(row.playerId) ?? 0) + parseTime(row.toi));
  });
  return totals;
}

export function resolveLineCombinationSourceContext({
  requestedTeamId,
  requestedSeasonId,
  sourceTeamId,
  sourceSeasonId
}: {
  requestedTeamId: number;
  requestedSeasonId: number;
  sourceTeamId: number;
  sourceSeasonId: number;
}) {
  if (
    sourceTeamId !== requestedTeamId ||
    sourceSeasonId !== requestedSeasonId
  ) {
    throw new Error(
      "Line combination source context does not match the request."
    );
  }

  return { teamId: sourceTeamId, seasonId: sourceSeasonId };
}

export type LineSource = "five_on_five_observed" | "all_strength_legacy";

export type FiveOnFiveUnitSeconds = { forwards: number[]; defense: number[] };

const FIVE_ON_FIVE_COLUMNS =
  "game_id, team_id, snapshot_date, unit_type, player_ids, player_count, unit_toi_seconds, coverage_status";
const FIVE_ON_FIVE_UNIT_TYPES = ["forward_line", "defense_pair"];

const teamGameKey = (teamId: number, gameId: number) => `${teamId}:${gameId}`;

/**
 * Each team's 5v5 unit rows for its given games, each team-game at its latest
 * snapshot only. Both reads filter `season_id`, so the
 * (season_id, game_id, team_id, unit_type) index serves them, and page by `id`
 * past the 1,000-row cap. The first read takes one row per unit type and
 * snapshot (`unit_number` 1) to find each team-game's latest snapshot; the
 * second reads only those snapshots. A team gets no rows when any of its games
 * has none: its board switches only when every game has 5v5 rows.
 */
async function fetchLatestFiveOnFiveUnits(
  seasonId: number,
  gamesByTeam: ReadonlyMap<number, readonly number[]>
): Promise<Map<number, TeamUnitToiReaderRow[]>> {
  const unitsByTeam = new Map<number, TeamUnitToiReaderRow[]>();
  const teamIds = [...gamesByTeam.keys()];
  if (teamIds.length === 0) return unitsByTeam;
  const isRequested = (teamId: number, gameId: number) =>
    gamesByTeam.get(teamId)?.includes(gameId) ?? false;

  const heads = await fetchAllSupabasePages<{ team_id: number; game_id: number; snapshot_date: string }>(
    (range) =>
      supabase
        .from("team_unit_toi")
        .select("team_id, game_id, snapshot_date")
        .eq("season_id", seasonId)
        .in("team_id", teamIds)
        .in("game_id", [...new Set([...gamesByTeam.values()].flat())])
        .in("unit_type", FIVE_ON_FIVE_UNIT_TYPES)
        .eq("unit_number", 1)
        .order("id")
        .range(range.from, range.to)
        .returns<Array<{ team_id: number; game_id: number; snapshot_date: string }>>()
  );
  const latest = new Map<string, string>();
  for (const head of heads) {
    if (!isRequested(head.team_id, head.game_id)) continue;
    const key = teamGameKey(head.team_id, head.game_id);
    const known = latest.get(key);
    if (!known || head.snapshot_date > known) latest.set(key, head.snapshot_date);
  }
  const ready = teamIds.filter((teamId) =>
    gamesByTeam.get(teamId)!.every((gameId) => latest.has(teamGameKey(teamId, gameId)))
  );
  if (ready.length === 0) return unitsByTeam;

  const readyGameIds = [...new Set(ready.flatMap((teamId) => gamesByTeam.get(teamId)!))];
  const latestDates = [
    ...new Set(
      ready.flatMap((teamId) =>
        gamesByTeam.get(teamId)!.map((gameId) => latest.get(teamGameKey(teamId, gameId))!)
      )
    )
  ];
  const rows = await fetchAllSupabasePages<TeamUnitToiReaderRow>((range) =>
    supabase
      .from("team_unit_toi")
      .select(FIVE_ON_FIVE_COLUMNS)
      .eq("season_id", seasonId)
      .in("team_id", ready)
      .in("game_id", readyGameIds)
      .in("unit_type", FIVE_ON_FIVE_UNIT_TYPES)
      .in("snapshot_date", latestDates)
      .order("id")
      .range(range.from, range.to)
      .returns<TeamUnitToiReaderRow[]>()
  );
  // A team-game's older snapshot can share a date with another's latest, and
  // a team can appear in another team's game: keep only requested latest rows.
  for (const row of rows) {
    if (!ready.includes(row.team_id)) continue;
    if (latest.get(teamGameKey(row.team_id, row.game_id)) !== row.snapshot_date) continue;
    const teamRows = unitsByTeam.get(row.team_id) ?? [];
    teamRows.push(row);
    unitsByTeam.set(row.team_id, teamRows);
  }
  return unitsByTeam;
}

/**
 * Replaces a game's stored all-strength forwards and defense with its observed
 * 5v5 units placed disjointly (decision 137), with each unit's 5v5 seconds
 * together. Returns null when the game has no complete 5v5 rows, so the caller
 * keeps the labelled legacy grouping.
 */
function fiveOnFiveLineCombo<T extends { gameId: number; forwards: number[]; defensemen: number[] }>(
  game: T,
  rows: readonly TeamUnitToiReaderRow[]
): { game: T; unitSeconds: FiveOnFiveUnitSeconds } | null {
  const lines = buildFiveOnFiveLines(rows.filter((row) => row.game_id === game.gameId));
  if (!lines) return null;
  return {
    game: {
      ...game,
      forwards: lines.forwardLines.flatMap((unit) => unit.playerIds),
      defensemen: lines.defensePairs.flatMap((unit) => unit.playerIds)
    },
    unitSeconds: {
      forwards: lines.forwardLines.map((unit) => unit.sharedSeconds),
      defense: lines.defensePairs.map((unit) => unit.sharedSeconds)
    }
  };
}

/**
 * Decision 107/137 switch: observed 5v5 units. Both games must have complete
 * 5v5 rows, so promotions and demotions never compare a 5v5 board with an
 * all-strength one; otherwise the labelled legacy grouping stays. `unitRows`
 * is null when the switch is off.
 */
function chooseBoard<T extends ParsedLineCombination>(
  current: T,
  previous: T,
  unitRows: readonly TeamUnitToiReaderRow[] | null
) {
  const fiveOnFiveCurrent = unitRows && fiveOnFiveLineCombo(current, unitRows);
  const fiveOnFivePrevious = unitRows && fiveOnFiveLineCombo(previous, unitRows);
  if (fiveOnFiveCurrent && fiveOnFivePrevious) {
    return {
      current: fiveOnFiveCurrent.game,
      previous: fiveOnFivePrevious.game,
      lineSource: "five_on_five_observed" as LineSource,
      fiveOnFiveUnitSeconds: fiveOnFiveCurrent.unitSeconds as FiveOnFiveUnitSeconds | null
    };
  }
  return {
    current,
    previous,
    lineSource: "all_strength_legacy" as LineSource,
    fiveOnFiveUnitSeconds: null as FiveOnFiveUnitSeconds | null
  };
}

const LINE_COMBINATION_COLUMNS =
  "gameId, teamId, forwards, defensemen, goalies, game:games!inner(startTime, seasonId)";

type ParsedLineCombination = {
  gameId: number;
  teamId: number;
  startTime: string;
  seasonId: number;
  forwards: number[];
  defensemen: number[];
  goalies: number[];
};

function parsePlayerIds(ids: unknown, label: string): number[] {
  if (!Array.isArray(ids)) return [];
  return ids.flatMap((id: string) => {
    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId)) {
      console.error(`Invalid ${label} ID: ${id}`);
      return [];
    }
    return [parsedId];
  });
}

/** A stored `lineCombinations` row with its id strings parsed to numbers. */
function parseLineCombination(combo: any): ParsedLineCombination {
  return {
    gameId: combo.gameId,
    teamId: combo.teamId,
    startTime: combo.game?.startTime,
    seasonId: combo.game?.seasonId,
    forwards: parsePlayerIds(combo.forwards, "forward"),
    defensemen: parsePlayerIds(combo.defensemen, "defenseman"),
    goalies: parsePlayerIds(combo.goalies, "goalie")
  };
}

export type LineChangeSummary = Pick<
  LineCombinations,
  "lineSource" | "fiveOnFiveUnitSeconds" | "promotions" | "demotions"
>;

/** Rows per page of the landing read: about two weeks of games league-wide. */
const LANDING_PAGE_ROWS = 200;

/**
 * The /lines landing page's movement data for many teams at once: each team's
 * line source, promotions and demotions, exactly as getLineCombinations
 * computes them (same two latest games, same latest 5v5 snapshot, same 5v5 or
 * legacy choice), from a few season-scoped reads instead of nine per team.
 * Reads: the season (when not given), `lineCombinations` paged newest first
 * until every team has two games (normally one page), then the two
 * `team_unit_toi` reads. A team with fewer than two games with lines this
 * season is left out, as the per-team path throws for it.
 */
export async function getLatestLineChanges(
  teamIds: number[],
  seasonId?: number,
  options: { fiveOnFive?: boolean } = {}
): Promise<Map<number, LineChangeSummary>> {
  const summaries = new Map<number, LineChangeSummary>();
  if (teamIds.length === 0) return summaries;
  const seasonToUse = seasonId ?? (await getCurrentSeason()).seasonId;

  const latestGames = new Map<number, ParsedLineCombination[]>();
  for (let from = 0; ; from += LANDING_PAGE_ROWS) {
    const { data } = await supabase
      .from("lineCombinations")
      .select(LINE_COMBINATION_COLUMNS)
      .in("teamId", teamIds)
      .eq("game.seasonId", seasonToUse)
      .order("game(startTime)", { ascending: false })
      .order("gameId", { ascending: false })
      .order("teamId", { ascending: true })
      .range(from, from + LANDING_PAGE_ROWS - 1)
      .returns<any[]>()
      .throwOnError();
    for (const combo of data ?? []) {
      const games = latestGames.get(combo.teamId) ?? [];
      if (games.length < 2) games.push(parseLineCombination(combo));
      latestGames.set(combo.teamId, games);
    }
    const complete = teamIds.every((teamId) => (latestGames.get(teamId)?.length ?? 0) >= 2);
    if (complete || (data?.length ?? 0) < LANDING_PAGE_ROWS) break;
  }

  const gamesByTeam = new Map<number, number[]>();
  for (const teamId of teamIds) {
    const games = latestGames.get(teamId);
    if (games && games.length >= 2) gamesByTeam.set(teamId, games.map((game) => game.gameId));
  }
  const unitsByTeam =
    options.fiveOnFive ?? LINES_FIVE_ON_FIVE_ENABLED
      ? await fetchLatestFiveOnFiveUnits(seasonToUse, gamesByTeam)
      : null;

  for (const teamId of gamesByTeam.keys()) {
    const [current, previous] = latestGames.get(teamId)!;
    const board = chooseBoard(current, previous, unitsByTeam && (unitsByTeam.get(teamId) ?? []));
    summaries.set(teamId, {
      lineSource: board.lineSource,
      fiveOnFiveUnitSeconds: board.fiveOnFiveUnitSeconds,
      ...getLineChanges([board.current, board.previous])
    });
  }
  return summaries;
}

export async function getLineCombinations(
  teamId: number,
  seasonId?: number,
  options: { fiveOnFive?: boolean } = {}
): Promise<LineCombinations> {
  try {
    const seasonToUse = seasonId ?? (await getCurrentSeason()).seasonId;

    const { data: rawLineCombinations } = await supabase
      .from("lineCombinations")
      .select(LINE_COMBINATION_COLUMNS)
      .eq("teamId", teamId)
      .eq("game.seasonId", seasonToUse)
      .order("game(startTime)", { ascending: false })
      .limit(10)
      .returns<any>() // will be fixed after upgrading supabase-js
      .throwOnError();

    if (!rawLineCombinations || rawLineCombinations.length < 2) {
      console.error("Raw Line Combinations Data:", rawLineCombinations);
      throw new Error(
        `Cannot find at least 2 games' line combo data for team ${teamId}`
      );
    }

    // Parse the forwards, defensemen, and goalies fields from strings to number arrays
    const lineCombinations: ParsedLineCombination[] =
      rawLineCombinations.map(parseLineCombination);

    debugLineCombinationsLog("Parsed Line Combinations:", lineCombinations);

    // Fetch player info
    const { data: playerId_sweaterNumber } = await supabase
      .from("rosters")
      .select("playerId, sweaterNumber, ...players(position)")
      .eq("teamId", teamId)
      .eq("seasonId", seasonToUse)
      .returns<any[]>()
      .throwOnError();

    // Transform into a map
    const playerId_Info = new Map<
      number,
      { sweaterNumber: number; position: string }
    >();
    playerId_sweaterNumber?.forEach((item) =>
      playerId_Info.set(item.playerId, {
        sweaterNumber: item.sweaterNumber,
        position: item.position,
      })
    );

    debugLineCombinationsLog(
      "Player ID Info Map:",
      Array.from(playerId_Info.entries())
    );

    // Decision 107/137 switch (chooseBoard): 5v5 units only when both games
    // have complete 5v5 rows; otherwise the labelled legacy grouping stays.
    const unitRows =
      options.fiveOnFive ?? LINES_FIVE_ON_FIVE_ENABLED
        ? (
            await fetchLatestFiveOnFiveUnits(
              seasonToUse,
              new Map([[teamId, [lineCombinations[0].gameId, lineCombinations[1].gameId]]])
            )
          ).get(teamId) ?? []
        : null;
    const board = chooseBoard(lineCombinations[0], lineCombinations[1], unitRows);
    lineCombinations[0] = board.current;
    lineCombinations[1] = board.previous;
    const { lineSource, fiveOnFiveUnitSeconds } = board;

    // Determine promotions and demotions
    const { promotions, demotions } = getLineChanges([
      lineCombinations[0],
      lineCombinations[1],
    ]);

    debugLineCombinationsLog("Promotions:", promotions);
    debugLineCombinationsLog("Demotions:", demotions);

    // Aggregate all relevant player IDs (current and previous lines)
    const currentLine = lineCombinations[0];
    const previousLine = lineCombinations[1];

    const allPlayerIds = new Set<number>([
      ...currentLine.forwards,
      ...currentLine.defensemen,
      ...currentLine.goalies,
      ...previousLine.forwards,
      ...previousLine.defensemen,
      ...previousLine.goalies,
    ]);

    debugLineCombinationsLog("All Player IDs:", Array.from(allPlayerIds));

    // Fetch skater stats for all relevant players
    const { data: skaters } = await supabase
      .from("skatersGameStats")
      .select(
        `playerId, numGames:playerId.count(), Goals:goals.sum(), Assists:assists.sum(), PTS:points.sum(), PPP:powerPlayPoints.sum(), 
           Shots:shots.sum(), Hits:hits.sum(), Blocks:blockedShots.sum(), PlusMinus:plusMinus.sum(), 
           ...players(playerName:fullName)`
      )
      .in(
        "gameId",
        lineCombinations.map((game: any) => game.gameId)
      )
      .in("playerId", Array.from(allPlayerIds))
      .returns<SkaterStats[]>()
      .throwOnError();

    const { data: skaterToiRows } = await supabase
      .from("skatersGameStats")
      .select("playerId,toi")
      .in(
        "gameId",
        lineCombinations.map((game: any) => game.gameId)
      )
      .in("playerId", Array.from(allPlayerIds))
      .throwOnError();
    const toiSecondsByPlayerId = aggregateSkaterToiSeconds(skaterToiRows ?? []);

    debugLineCombinationsLog("Fetched Skater Stats:", skaters);

    // Fetch goalie stats similarly, ensuring all goalies are included
    const allGoalieIds = new Set<number>([
      ...currentLine.goalies,
      ...previousLine.goalies,
    ]);

    // Each goalie's own season appearances (not the team's line-data games):
    // "SEASON" is his season, "LAST 10" his last ten appearances.
    const goalieIds = Array.from(allGoalieIds);
    const { data: goalieGameRows } = await supabase
      .from("goaliesGameStats")
      .select(
        `playerId, saveShotsAgainst, toi, goalsAgainst,
         game:games!inner(id, seasonId, startTime),
         ...players(playerName:fullName)`
      )
      .in("playerId", goalieIds)
      .eq("game.seasonId", seasonToUse)
      .order("game(startTime)", { ascending: false })
      .returns<GoalieAppearanceRow[]>()
      .throwOnError();

    // Credited decisions (decision 72): the goalie's own W / L / OTL from
    // the official per-game goalie log, never the team result.
    const { data: creditedRows } = await supabase
      .from("wgo_goalie_stats")
      .select("goalie_id, game_id, wins, losses, ot_losses")
      .in("goalie_id", goalieIds)
      .eq("season_id", seasonToUse)
      .returns<CreditedDecisionRow[]>()
      .throwOnError();

    const goalies = goalieIds
      .map((goalieId) =>
        summarizeGoalieAppearances(
          (goalieGameRows ?? []).filter((row) => row.playerId === goalieId),
          creditedRows ?? []
        )
      )
      .filter((goalie): goalie is NonNullable<typeof goalie> => goalie !== null);

    debugLineCombinationsLog("Processed Goalies:", goalies);

    if (!skaters) throw new Error("Cannot find the stats for skaters");

    // Map player stats
    const playersStats = new Map<number, any>();
    [...skaters, ...goalies].forEach((item) => {
      if (!item || !item.playerId) {
        console.error("Invalid player data:", item); // Log or handle the case where the item is null/undefined
        return;
      }

      item.sweaterNumber = playerId_Info.get(item.playerId)?.sweaterNumber ?? 0;
      item.position = playerId_Info.get(item.playerId)?.position ?? "L";
      if ("Goals" in item && toiSecondsByPlayerId.has(item.playerId)) {
        item.TOISeconds = toiSecondsByPlayerId.get(item.playerId);
      }
      item.lineChange = getLineChangeType(
        promotions.map((p) => p.playerId),
        demotions.map((d) => d.playerId),
        item.playerId
      );

      playersStats.set(item.playerId, item);
    });

    debugLineCombinationsLog(
      "Mapped Player Stats:",
      Array.from(playersStats.entries())
    );

    // Convert to lines using current line combination
    const lines = convertToLines(currentLine);

    debugLineCombinationsLog("Converted Lines:", lines);

    // Map lines to player stats
    const result: LineCombinations = mapToLineCombinations(
      playersStats,
      lines
    ) as any;

    debugLineCombinationsLog("Mapped Line Combinations:", result);

    // Order each line by player position L C R
    orderLinesByPosition(result);

    debugLineCombinationsLog("Ordered Lines:", {
      forwards: result.forwards,
      defensemen: result.defensemen,
      goalies: result.goalies,
    });

    const sourceContext = resolveLineCombinationSourceContext({
      requestedTeamId: teamId,
      requestedSeasonId: seasonToUse,
      sourceTeamId: currentLine.teamId,
      sourceSeasonId: currentLine.seasonId
    });

    result.statsGameIds = lineCombinations.map((game: any) => game.gameId);
    result.lineSource = lineSource;
    result.fiveOnFiveUnitSeconds = fiveOnFiveUnitSeconds;

    // Assign game info
    result.game = {
      id: currentLine.gameId,
      startTime: currentLine.startTime,
      ...sourceContext
    };

    // Assign promotions and demotions
    result.promotions = promotions;
    result.demotions = demotions;

    debugLineCombinationsLog("Final Line Combinations Result:", result);

    return result;
  } catch (error) {
    console.error(`Failed to get line combinations for team ${teamId}:`, error);
    throw error;
  }
}

function mapToLineCombinations(
  playersStats: Map<number, any>,
  lineCombo: ReturnType<typeof convertToLines>
) {
  const result = {} as any;
  positions.forEach((position) => {
    const lines = lineCombo[position];
    Object.keys(lines).forEach((line) => {
      if (result[position] === undefined) result[position] = {};
      // @ts-ignore
      result[position][line] = (lineCombo[position][line] as number[])
        .map((playerId) => {
          if (playersStats.get(playerId) === undefined) {
            debugLineCombinationsLog("Missing player", playerId);
          }
          return playersStats.get(playerId);
        })
        .filter((item) => item !== undefined);
    });
  });

  return result;
}

type RawLineCombo = {
  forwards: number[];
  defensemen: number[];
  goalies: number[];
};

type LineChangeInfo = {
  playerId: number;
  previousLine: number | null;
  currentLine: number | null;
  // previousPowerPlayerUnit: number | null;
  // currentPowerPlayerUnit: number | null;
};

type LineChanges = {
  promotions: LineChangeInfo[];
  demotions: LineChangeInfo[];
};

const positions = ["forwards", "defensemen", "goalies"] as const;
export function getLineChanges(
  lineCombinations: [RawLineCombo, RawLineCombo]
): LineChanges {
  const [currentGame, previousGame] = lineCombinations;
  const currentLines = convertToLines(currentGame);
  const previousLines = convertToLines(previousGame);

  const result: LineChanges = {
    promotions: [],
    demotions: [],
  };
  const data = new Map<
    number,
    { currentLine: number | null; previousLine: number | null }
  >();
  positions.forEach((position) => {
    const current = currentLines[position];
    const previous = previousLines[position];
    Object.keys(current).forEach((line) => {
      const lineNumber = Number.parseInt(line.at(-1) ?? "1", 10);
      // @ts-ignore
      const currentPlayers: number[] = current[line];
      // @ts-ignore
      const previousPlayers: number[] = previous[line];

      currentPlayers.forEach((p) => {
        if (!data.get(p)) {
          data.set(p, { currentLine: lineNumber, previousLine: null });
        } else {
          data.set(p, {
            currentLine: lineNumber,
            previousLine: data.get(p)!.previousLine,
          });
        }
      });

      previousPlayers.forEach((p) => {
        if (!data.get(p)) {
          data.set(p, { currentLine: null, previousLine: lineNumber });
        } else {
          data.set(p, {
            currentLine: data.get(p)!.currentLine,
            previousLine: lineNumber,
          });
        }
      });
    });
  });

  for (const [playerId, { currentLine, previousLine }] of data) {
    if (previousLine === null) {
      result.promotions.push({
        playerId,
        currentLine,
        previousLine,
      });
    } else if (currentLine === null) {
      result.demotions.push({
        playerId,
        currentLine,
        previousLine,
      });
    } else if (currentLine < previousLine) {
      result.promotions.push({
        playerId,
        currentLine,
        previousLine,
      });
    } else if (currentLine > previousLine) {
      result.demotions.push({
        playerId,
        currentLine,
        previousLine,
      });
    }
  }

  return result;
}

function getLineChangeType(
  promotions: number[],
  demotions: number[],
  id: number
) {
  if (promotions.some((p) => p === id)) return "promotion";
  if (demotions.some((p) => p === id)) return "demotion";
  return "static";
}

type GoalieAppearanceRow = {
  playerId: number;
  playerName: string;
  saveShotsAgainst: string | null;
  toi: string | null;
  goalsAgainst: number | null;
  game: { id: number; seasonId: number; startTime: string };
};

type CreditedDecisionRow = {
  goalie_id: number;
  game_id: number | null;
  wins: number | null;
  losses: number | null;
  ot_losses: number | null;
};

export type GoalieWindowStats = {
  GP: number | null;
  SV: number | null;
  SVPercentage: number | null;
  GAA: number | null;
  /** Credited W-L-OTL; null when any appearance's decision is unknown. */
  Record: string | null;
};

function parseSaveShots(value: string | null) {
  const match = /^(\d+)[/-](\d+)$/.exec(value?.trim() ?? "");
  if (!match) return null;
  const saves = Number(match[1]), shots = Number(match[2]);
  return Number.isSafeInteger(saves) && Number.isSafeInteger(shots) && saves <= shots ? { saves, shots } : null;
}

function parseToiSeconds(value: string | null) {
  if (value == null || !/^\d+:[0-5]\d$/.test(value.trim())) return null;
  return parseTime(value.trim());
}

function goalieAppeared(row: GoalieAppearanceRow, credited?: CreditedDecisionRow): boolean | null {
  const seconds = parseToiSeconds(row.toi);
  const shots = parseSaveShots(row.saveShotsAgainst);
  if ((seconds != null && seconds > 0) || (shots != null && shots.shots > 0)
    || (row.goalsAgainst != null && row.goalsAgainst > 0)
    || [credited?.wins, credited?.losses, credited?.ot_losses].some(value => value != null && value > 0)) return true;
  return seconds === 0 ? false : null;
}

/**
 * Pooled goalie line over a window of appearances: SV% = Σsaves / Σshots,
 * GAA = ΣGA × 3600 / ΣTOI seconds. A count and its exposure come from the
 * same appearances, so one unknown input leaves that stat unknown (rule 13).
 */
function pooledGoalieWindow(
  appearances: readonly GoalieAppearanceRow[],
  creditedByGame: ReadonlyMap<number, CreditedDecisionRow>
): GoalieWindowStats {
  // An unproved appearance also makes the membership of the last-ten window unknown.
  if (appearances.some(row => goalieAppeared(row, creditedByGame.get(row.game.id)) === null)) {
    return { GP: null, SV: null, SVPercentage: null, GAA: null, Record: null };
  }
  let saves = 0;
  let shots = 0;
  let goalsAgainst = 0;
  let toiSeconds = 0;
  let saveShotsKnown = true;
  let gaaKnown = true;
  let recordKnown = true;
  const record = { W: 0, L: 0, OTL: 0 };

  for (const row of appearances) {
    const saveShots = parseSaveShots(row.saveShotsAgainst);
    if (saveShots) {
      saves += saveShots.saves;
      shots += saveShots.shots;
    } else {
      saveShotsKnown = false;
    }

    const seconds = parseToiSeconds(row.toi);
    if (seconds == null || row.goalsAgainst == null) {
      gaaKnown = false;
    } else {
      toiSeconds += seconds;
      goalsAgainst += row.goalsAgainst;
    }

    const credited = creditedByGame.get(row.game.id);
    if (
      !credited ||
      credited.wins == null ||
      credited.losses == null ||
      credited.ot_losses == null
    ) {
      recordKnown = false;
    } else {
      record.W += credited.wins;
      record.L += credited.losses;
      record.OTL += credited.ot_losses;
    }
  }

  return {
    GP: appearances.length,
    SV: saveShotsKnown ? saves : null,
    SVPercentage: saveShotsKnown && shots > 0 ? saves / shots : null,
    GAA: gaaKnown && toiSeconds > 0 ? (goalsAgainst * 3600) / toiSeconds : null,
    Record: recordKnown ? `${record.W}-${record.L}-${record.OTL}` : null
  };
}

function summarizeGoalieAppearances(
  rows: readonly GoalieAppearanceRow[],
  creditedRows: readonly CreditedDecisionRow[]
): Partial<GoalieStats> | null {
  if (rows.length === 0) return null;
  const playerId = rows[0].playerId;
  const creditedByGame = new Map<number, CreditedDecisionRow>();
  creditedRows.forEach((row) => {
    if (row.goalie_id === playerId && row.game_id != null) {
      creditedByGame.set(row.game_id, row);
    }
  });

  const appearances = rows
    .filter(row => goalieAppeared(row, creditedByGame.get(row.game.id)) !== false)
    .slice()
    .sort((a, b) => b.game.startTime.localeCompare(a.game.startTime));

  return {
    playerId,
    playerName: rows[0].playerName,
    last10Games: pooledGoalieWindow(appearances.slice(0, 10), creditedByGame),
    season: pooledGoalieWindow(appearances, creditedByGame)
  };
}

export function convertToLines(lineCombo: RawLineCombo | undefined) {
  const f = lineCombo === undefined ? [] : [...lineCombo.forwards];
  const d = lineCombo === undefined ? [] : [...lineCombo.defensemen];
  const g = lineCombo === undefined ? [] : [...lineCombo.goalies];
  const forwardsLines: {
    line1: number[];
    line2: number[];
    line3: number[];
    line4: number[];
  } = { line1: [], line2: [], line3: [], line4: [] };
  const defensemenLines: {
    line1: number[];
    line2: number[];
    line3: number[];
  } = { line1: [], line2: [], line3: [] };
  const goaliesLines: {
    line1: number[];
    line2: number[];
  } = { line1: [], line2: [] };
  Object.values(forwardsLines).forEach((line) => {
    for (let i = 0; i < NUM_PLAYERS_PER_LINE.forwards; i++) {
      const playerId = f.shift();
      if (playerId === undefined) break;
      line.push(playerId);
    }
  });

  Object.values(defensemenLines).forEach((line) => {
    for (let i = 0; i < NUM_PLAYERS_PER_LINE.defensemen; i++) {
      const playerId = d.shift();
      if (playerId === undefined) break;
      line.push(playerId);
    }
  });

  goaliesLines.line1 = [g[0]];
  goaliesLines.line2 = g[1] ? [g[1]] : [];

  return {
    forwards: forwardsLines,
    defensemen: defensemenLines,
    goalies: goaliesLines,
  };
}

function orderLinesByPosition(lineCombinations: LineCombinations) {
  Object.keys(lineCombinations.forwards).forEach((line) => {
    const players = lineCombinations.forwards[line as "line1"];

    const sorted = [
      ...players.filter((p) => p.position === "L"),
      ...players.filter((p) => p.position === "C"),
      ...players.filter((p) => p.position === "R"),
    ];
    lineCombinations.forwards[line as "line1"] = sorted;
  });
}
