// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\LineCombinations\utilities.ts

import { NUM_PLAYERS_PER_LINE } from "components/LinemateMatrix";
import { addHours } from "date-fns";
import { getCurrentSeason } from "lib/NHL/server";
import supabase from "lib/supabase";
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

const FIVE_ON_FIVE_COLUMNS =
  "game_id, team_id, snapshot_date, unit_type, player_ids, player_count, unit_toi_seconds, coverage_status";

/**
 * Replaces a game's stored all-strength forwards and defense with its observed
 * 5v5 units placed disjointly (decision 137). Returns null when the game has
 * no complete 5v5 rows, so the caller keeps the labelled legacy grouping.
 */
function fiveOnFiveLineCombo<T extends { gameId: number; forwards: number[]; defensemen: number[] }>(
  game: T,
  rows: readonly TeamUnitToiReaderRow[]
): T | null {
  const lines = buildFiveOnFiveLines(rows.filter((row) => row.game_id === game.gameId));
  if (!lines) return null;
  return {
    ...game,
    forwards: lines.forwardLines.flatMap((unit) => unit.playerIds),
    defensemen: lines.defensePairs.flatMap((unit) => unit.playerIds)
  };
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
      .select(
        "gameId, teamId, forwards, defensemen, goalies, game:games!inner(startTime, seasonId)"
      )
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
    const lineCombinations = rawLineCombinations.map((combo: any) => ({
      gameId: combo.gameId,
      teamId: combo.teamId,
      startTime: combo.game?.startTime,
      seasonId: combo.game?.seasonId,
      forwards: Array.isArray(combo.forwards)
        ? combo.forwards
            .map((id: string) => {
              const parsedId = parseInt(id, 10);
              if (isNaN(parsedId)) {
                console.error(`Invalid forward ID: ${id}`);
                return null;
              }
              return parsedId;
            })
            .filter((id: number | null) => id !== null)
        : [],
      defensemen: Array.isArray(combo.defensemen)
        ? combo.defensemen
            .map((id: string) => {
              const parsedId = parseInt(id, 10);
              if (isNaN(parsedId)) {
                console.error(`Invalid defenseman ID: ${id}`);
                return null;
              }
              return parsedId;
            })
            .filter((id: number | null) => id !== null)
        : [],
      goalies: Array.isArray(combo.goalies)
        ? combo.goalies
            .map((id: string) => {
              const parsedId = parseInt(id, 10);
              if (isNaN(parsedId)) {
                console.error(`Invalid goalie ID: ${id}`);
                return null;
              }
              return parsedId;
            })
            .filter((id: number | null) => id !== null)
        : [],
    }));

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

    // Decision 107/137 switch: observed 5v5 units. Both games must have
    // complete 5v5 rows, so promotions and demotions never compare a 5v5 board
    // with an all-strength one; otherwise the labelled legacy grouping stays.
    let lineSource: LineSource = "all_strength_legacy";
    if (options.fiveOnFive ?? LINES_FIVE_ON_FIVE_ENABLED) {
      const { data: unitRows } = await supabase
        .from("team_unit_toi")
        .select(FIVE_ON_FIVE_COLUMNS)
        .eq("team_id", teamId)
        .in("game_id", [lineCombinations[0].gameId, lineCombinations[1].gameId])
        .in("unit_type", ["forward_line", "defense_pair"])
        .returns<TeamUnitToiReaderRow[]>()
        .throwOnError();
      const current = fiveOnFiveLineCombo(lineCombinations[0], unitRows ?? []);
      const previous = fiveOnFiveLineCombo(lineCombinations[1], unitRows ?? []);
      if (current && previous) {
        lineCombinations[0] = current;
        lineCombinations[1] = previous;
        lineSource = "five_on_five_observed";
      }
    }

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
  GP: number;
  SV: number | null;
  SVPercentage: number | null;
  GAA: number | null;
  /** Credited W-L-OTL; null when any appearance's decision is unknown. */
  Record: string | null;
};

function parseSaveShots(value: string | null) {
  const match = /^(\d+)\/(\d+)$/.exec(value?.trim() ?? "");
  return match ? { saves: Number(match[1]), shots: Number(match[2]) } : null;
}

function parseToiSeconds(value: string | null) {
  if (value == null || !/^\d+:\d{2}$/.test(value.trim())) return null;
  return parseTime(value.trim());
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
  // A dressed backup who did not play has 00:00; unknown TOI stays an appearance.
  const appearances = rows
    .filter((row) => row.toi !== "00:00")
    .slice()
    .sort((a, b) => b.game.startTime.localeCompare(a.game.startTime));
  const creditedByGame = new Map<number, CreditedDecisionRow>();
  creditedRows.forEach((row) => {
    if (row.goalie_id === playerId && row.game_id != null) {
      creditedByGame.set(row.game_id, row);
    }
  });

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
