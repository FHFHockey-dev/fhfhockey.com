import { getCurrentSeason } from "lib/NHL/client"; // replace to use server
import supabase from "lib/supabase";
import { GoalieStats, SkaterStats } from "pages/lines/[abbreviation]";

type LineCombinations = {
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
    line1: SkaterStats[];
    line2: SkaterStats[];
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
    .returns<any>() // will be fixed after upgrading supabase-js
    .throwOnError();
  if (!lineCombinations)
    throw new Error("Cannot find line combo data for team " + teamId);
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
      `playerId, numGames:playerId.count(), Goals:goals.avg(), Assists:assists.avg(), PTS:points.avg(), PPP:powerPlayPoints.avg(), 
         Shots:shots.avg(), Hits:hits.avg(), Blocks:blockedShots.avg(), PlusMinus:plusMinus.avg(), 
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

  const { data: goalies } = await supabase
    .from("goaliesGameStats")
    .select(
      `playerId, numGames:playerId.count(), savePctg:savePctg.avg(), 
        ...players(playerName:fullName)`
    )
    .in("playerId", lineCombinations[0].goalies)
    .in(
      "gameId",
      last10Games.map((game) => game.id)
    )
    .returns<GoalieStats[]>()
    .throwOnError();
  // todo: add more stats for goalies
  if (!skaters || !goalies)
    throw new Error("Cannot find the stats for skaters or goalies");

  const result: LineCombinations = {} as any;
  const { promotions, demotions } = getLineChanges(lineCombinations);

  // add sweaterNumber & lineChange
  [...skaters, ...goalies].forEach((item) => {
    item.sweaterNumber = playerId_sweaterNumberTable.get(item.playerId) ?? 0;
    item.lineChange = getLineChangeType(
      promotions.map((p) => p.playerId),
      demotions.map((p) => p.playerId),
      item.playerId
    );
  });

  console.log({ skaters, goalies });
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
  previousPowerPlayerUnit: number | null;
  currentPowerPlayerUnit: number | null;
};

type LineChanges = {
  promotions: LineChangeInfo[];
  demotions: LineChangeInfo[];
};

export function getLineChanges(
  lineCombinations: [RawLineCombo, RawLineCombo]
): LineChanges {
  const [currentGame, previousGame] = lineCombinations;
  const result: LineChanges = {
    promotions: [],
    demotions: [],
  };
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
