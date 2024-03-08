import { NUM_PLAYERS_PER_LINE } from "components/LinemateMatrix";
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

export async function getLineCombinations(
  teamId: number
): Promise<LineCombinations> {
  const { data: last10Games } = await supabase
    .from("games")
    .select("id")
    .or(`homeTeamId.eq.${teamId}, awayTeamId.eq.${teamId}`)
    .lt("startTime", "now()")
    .order("startTime", { ascending: false })
    .limit(10)
    .throwOnError();
  if (!last10Games) throw new Error("No games were found for team " + teamId);
  const { data: lineCombinations } = await supabase
    .from("lineCombinations")
    .select(
      "gameId, teamId, forwards, defensemen, goalies, ...games (startTime)"
    )
    .eq("teamId", teamId)
    .in("gameId", [last10Games[0].id, last10Games[1].id])
    .order("games(startTime)", { ascending: false })
    .returns<any>() // will be fixed after upgrading supabase-js
    .throwOnError();
  if (!lineCombinations || lineCombinations.length !== 2)
    throw new Error(
      `Cannot find 2 games line combo data for team ${teamId} games: ${[
        last10Games[0].id,
        last10Games[1].id,
      ]}`
    );
  const season = await getCurrentSeason();
  const { data: playerId_sweaterNumber } = await supabase
    .from("rosters")
    .select("playerId, sweaterNumber")
    .eq("teamId", teamId)
    .eq("seasonId", season.seasonId)
    .throwOnError();
  // transform into a table
  const playerId_sweaterNumberTable = new Map<number, number>();
  playerId_sweaterNumber?.forEach((item) =>
    playerId_sweaterNumberTable.set(item.playerId, item.sweaterNumber)
  );

  // get stats
  const { data: skaters } = await supabase
    .from("skatersGameStats")
    .select(
      `playerId, numGames:playerId.count(), Goals:goals.sum(), Assists:assists.sum(), PTS:points.sum(), PPP:powerPlayPoints.sum(), 
         Shots:shots.sum(), Hits:hits.sum(), Blocks:blockedShots.sum(), PlusMinus:plusMinus.sum(), 
         ...players(playerName:fullName)`
    )
    .in(
      "gameId",
      last10Games.map((game) => game.id)
    )
    .in("playerId", [
      ...lineCombinations[0].forwards,
      ...lineCombinations[0].defensemen,
    ])
    .returns<SkaterStats[]>()
    .throwOnError();

  const goaliesStats = await Promise.all(
    lineCombinations[0].goalies.map((id: number) =>
      supabase
        .from("goaliesGameStats")
        .select(
          `playerId, saveShotsAgainst, savePctg, toi, goalsAgainst,
           game:games!inner(id, seasonId, startTime),
           ...players(playerName:fullName)
         `
        )
        .eq("playerId", id)
        .eq("games.seasonId", season.seasonId)
        .order("game(startTime)", { ascending: false })
        .returns<any[]>()
        .throwOnError()
        .then((res) => res.data)
    )
  );

  const gameOutcomes = await getGameResults(
    new Set(goaliesStats.flat(1).map((item) => item.game.id)),
    teamId
  );

  const goalies = goaliesStats.map((goalie) =>
    processGoalie(goalie, gameOutcomes)
  );

  if (!skaters) throw new Error("Cannot find the stats for skaters");

  const { promotions, demotions } = getLineChanges(lineCombinations);
  const playersStats = new Map<number, any>();
  // add sweaterNumber & lineChange
  [...skaters, ...goalies].forEach((item) => {
    item.sweaterNumber = playerId_sweaterNumberTable.get(item.playerId!) ?? 0;
    item.lineChange = getLineChangeType(
      promotions.map((p) => p.playerId),
      demotions.map((p) => p.playerId),
      item.playerId!
    );
    playersStats.set(item.playerId ?? 0, item);
  });

  const lines = convertToLines(lineCombinations[0]);

  const result: LineCombinations = mapToLineCombinations(
    playersStats,
    lines
  ) as any;
  // console.log({ skaters, goalies, lineCombo: lineCombinations[0], result });
  result.game = {
    id: lineCombinations[0].gameId,
    startTime: lineCombinations[0].startTime,
  };

  result.promotions = promotions;
  result.demotions = demotions;

  return result;
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
): Partial<GoalieStats> {
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
    playerId: seasonStats[0].playerId,
    playerName: seasonStats[0].playerName,
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
