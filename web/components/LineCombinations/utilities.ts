// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\LineCombinations\utilities.ts

import { NUM_PLAYERS_PER_LINE } from "components/LinemateMatrix";
import { addHours } from "date-fns";
import { getCurrentSeason } from "lib/NHL/server";
import supabase from "lib/supabase";
import { GoalieStats, SkaterStats } from "pages/lines/[abbreviation]";
import { parseTime } from "utils/getPowerPlayBlocks";

type LineCombinations = {
  game: {
    id: number;
    startTime: string;
  };
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

// Type Guard Function
function isNonEmptyArray(goalie: any[] | null): goalie is any[] {
  return goalie !== null && goalie.length > 0;
}

export async function getLineCombinations(
  teamId: number
): Promise<LineCombinations> {
  try {
    const { data: rawLineCombinations } = await supabase
      .from("lineCombinations")
      .select(
        "gameId, teamId, forwards, defensemen, goalies, ...games (startTime)"
      )
      .eq("teamId", teamId)
      .order("games(startTime)", { ascending: false })
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
      ...combo,
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

    // **Console Log: Parsed Line Combinations**
    console.log("Parsed Line Combinations:", lineCombinations);

    const season = await getCurrentSeason();

    // Fetch player info
    const { data: playerId_sweaterNumber } = await supabase
      .from("rosters")
      .select("playerId, sweaterNumber, ...players(position)")
      .eq("teamId", teamId)
      .eq("seasonId", season.seasonId)
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

    // **Console Log: Player ID Info Map**
    console.log("Player ID Info Map:", Array.from(playerId_Info.entries()));

    // Determine promotions and demotions
    const { promotions, demotions } = getLineChanges([
      lineCombinations[0],
      lineCombinations[1],
    ]);

    // **Console Log: Promotions and Demotions**
    console.log("Promotions:", promotions);
    console.log("Demotions:", demotions);

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

    // **Console Log: All Player IDs**
    console.log("All Player IDs:", Array.from(allPlayerIds));

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

    // **Console Log: Skaters Data**
    console.log("Fetched Skater Stats:", skaters);

    // Fetch goalie stats similarly, ensuring all goalies are included
    const allGoalieIds = new Set<number>([
      ...currentLine.goalies,
      ...previousLine.goalies,
    ]);

    const goaliesStats = await Promise.all(
      Array.from(allGoalieIds).map((id: number) =>
        supabase
          .from("goaliesGameStats")
          .select(
            `playerId, saveShotsAgainst, savePctg, toi, goalsAgainst,
             game:games!inner(id, seasonId, startTime),
             ...players(playerName:fullName)`
          )
          .in(
            "gameId",
            lineCombinations.map((game: any) => game.gameId)
          )
          .eq("playerId", id)
          .eq("games.seasonId", season.seasonId)
          .order("game(startTime)", { ascending: false })
          .returns<any[]>()
          .throwOnError()
          .then((res) => res.data)
      )
    );

    // **Console Log: Goalies Stats**
    console.log("Fetched Goalies Stats:", goaliesStats);

    // Process goalies stats
    const gameOutcomes = await getGameResults(
      new Set(goaliesStats.flat(1).map((item) => item.game.id)),
      teamId
    );

    // **Console Log: Game Outcomes**
    console.log("Game Outcomes:", Array.from(gameOutcomes.entries()));

    const goalies = goaliesStats
      .filter(isNonEmptyArray) // Type guard applied here
      .map((goalie) => processGoalie(goalie, gameOutcomes))
      .filter((goalie) => goalie !== null); // Filter out null results

    // **Console Log: Processed Goalies**
    console.log("Processed Goalies:", goalies);

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
      item.lineChange = getLineChangeType(
        promotions.map((p) => p.playerId),
        demotions.map((d) => d.playerId),
        item.playerId
      );

      playersStats.set(item.playerId, item);
    });

    // **Console Log: Mapped Player Stats**
    console.log("Mapped Player Stats:", Array.from(playersStats.entries()));

    // Convert to lines using current line combination
    const lines = convertToLines(currentLine);

    // **Console Log: Converted Lines**
    console.log("Converted Lines:", lines);

    // Map lines to player stats
    const result: LineCombinations = mapToLineCombinations(
      playersStats,
      lines
    ) as any;

    // **Console Log: Mapped Line Combinations**
    console.log("Mapped Line Combinations:", result);

    // Order each line by player position L C R
    orderLinesByPosition(result);

    // **Console Log: Ordered Lines**
    console.log("Ordered Lines:", {
      forwards: result.forwards,
      defensemen: result.defensemen,
      goalies: result.goalies,
    });

    // Assign game info
    result.game = {
      id: currentLine.gameId,
      startTime: currentLine.startTime,
    };

    // Assign promotions and demotions
    result.promotions = promotions;
    result.demotions = demotions;

    // **Console Log: Final Line Combinations Result**
    console.log("Final Line Combinations Result:", result);

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
            console.error(`Missing player ${playerId}`);
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

function processGoalie(
  goalie: any[],
  gameOutcomes: Map<number, GameOutcome>
): Partial<GoalieStats> | null {
  if (!goalie || goalie.length === 0) {
    console.error("No goalie data found", goalie);
    return null; // Handle missing goalie data
  }

  const seasonStats = goalie.filter((item) => item.toi !== "00:00");
  const last10GamesStats = seasonStats.slice(0, 10);

  const getStats = (stats: any[]) => {
    let record: Record<GameOutcome, number> = {
      WIN: 0,
      LOSS: 0,
      TIE: 0,
    };

    let SV = 0;
    let SVPercentage = 0;
    let GAA = 0;
    for (const item of stats) {
      if (!item || !item.saveShotsAgainst) continue; // Defensive check for valid item data
      SV += Number.parseInt(item.saveShotsAgainst.split("/")[0], 10);
      SVPercentage += item.savePctg;
      record[gameOutcomes.get(item.game.id) ?? "WIN"]++;
      const minutesPlayed = parseTime(item.toi) / 60;
      GAA += (item.goalsAgainst * 60) / minutesPlayed;
    }
    SVPercentage = SVPercentage / stats.length;
    GAA = GAA / stats.length;
    const aggregate = {
      SV,
      GP: stats.length,
      SVPercentage,
      GAA,
      Record: `${record.WIN}-${record.LOSS}-${record.TIE}`,
    };
    return aggregate;
  };

  return {
    playerId: goalie[0].playerId,
    playerName: goalie[0].playerName,
    last10Games: getStats(last10GamesStats),
    season: getStats(seasonStats),
  };
}

type GameOutcome = "WIN" | "LOSS" | "TIE";
async function getGameResults(
  gameIds: Set<number>,
  teamId: number
): Promise<Map<number, GameOutcome>> {
  const { data } = await supabase
    .from("gameOutcomes")
    .select("gameId, outcome")
    .eq("teamId", teamId)
    .in("gameId", [...gameIds]);
  const result = new Map();
  data?.forEach((item) => {
    result.set(item.gameId, item.outcome);
  });

  return result;
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
