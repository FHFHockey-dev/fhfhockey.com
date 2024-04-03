import { NUM_PLAYERS_PER_LINE } from "components/LinemateMatrix";
import { teamsInfo } from "lib/NHL/teamsInfo";
import supabase from "lib/supabase";
import adminOnly from "utils/adminOnlyMiddleware";

const WEBHOOK_URL = process.env.LINE_COMBO_WEBHOOK_URL ?? "";

export default adminOnly(async (req, res) => {
  const gameId = Number(req.query.gameId);
  const { data, error } = await supabase
    .from("lineCombinations")
    .select(
      "...teams(teamAbbreviation:abbreviation), forwards, defensemen, ...games(startTime)"
    )
    .eq("gameId", gameId)
    .returns<
      {
        teamAbbreviation: string;
        forwards: number[];
        defensemen: number[];
        startTime: string;
      }[]
    >();
  if (!data) throw error;

  const shiftChartUrl = `https://fhfhockey.com/shiftChart?gameId=${gameId}&linemate-matrix-mode=line-combination#linemate-matrix`;
  const gameTime = new Intl.DateTimeFormat("en-US").format(
    new Date(data[0].startTime)
  );

  const embeds = await Promise.all(
    data.map(async (item) => {
      const title = `${item.teamAbbreviation} Line Combos ${gameTime}`;
      const url = `${shiftChartUrl}&team=${item.teamAbbreviation}`;
      const color = parseInt(
        teamsInfo[item.teamAbbreviation as "NJD"].primaryColor.slice(1),
        16
      );
      // todo
      const image = {
        url: "https://fyhftlxokyjtpndbkfse.supabase.co/storage/v1/object/public/images/line-combo-1.png",
      };
      // get players
      const { data: forwards } = await supabase
        .from("players")
        .select("id, lastName")
        .in("id", item.forwards);
      const { data: defensemen } = await supabase
        .from("players")
        .select("id, lastName")
        .in("id", item.defensemen);

      const forwardsLines = createPlayersDescription(
        forwards!,
        NUM_PLAYERS_PER_LINE.forwards
      );

      const defensemenLines = createPlayersDescription(
        defensemen!,
        NUM_PLAYERS_PER_LINE.defensemen
      );

      const description = `${forwardsLines}

${defensemenLines}

[ShiftChart](${shiftChartUrl})
`;

      const embed = {
        title,
        description,
        url,
        color,
      };
      return embed;
    })
  );

  const message = {
    content: null,
    embeds,
  };
  try {
    await sendMessage(message, WEBHOOK_URL);
    res.json(message);
  } catch (e) {
    console.error(e);
    res.json({ error: "Failed to post the line combo to discord", message });
  }
});

function sendMessage(payload: any, webhookUrl: string) {
  const data = typeof payload === "string" ? { content: payload } : payload;

  return new Promise((resolve, reject) => {
    fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
      .then((response) => {
        if (!response.ok) {
          reject(new Error(`Could not send message: ${response.status}`));
        }
        resolve(0);
      })
      .catch((error) => {
        console.error(error);
        reject(error);
      });
  });
}

function getLineNumber(pos: number, numPlayersPerLine: number) {
  // num players per line : 3
  // 0  => 1
  // 1  => 1
  // 2  => 1
  // 3  => 2
  // 4  => 2
  // 5  => 2
  // 6  => 3
  return Math.floor(pos / numPlayersPerLine) + 1;
}

function createPlayersDescription(
  players: { lastName: string }[],
  numPlayersPerLine: number
) {
  const lines = [] as string[];
  // line number => player
  const map = new Map<number, { lastName: string }[]>();
  players.forEach((p, i) => {
    const line = getLineNumber(i, numPlayersPerLine);
    let playersOfLine = map.get(line);
    if (!playersOfLine) {
      playersOfLine = [];
      map.set(line, playersOfLine);
    }
    playersOfLine.push(p);
  });

  for (const line of map.keys()) {
    const playersOfLine = map.get(line) ?? [];
    let str = `L${line}: ${playersOfLine.map((p) => p.lastName).join(", ")}`;
    lines.push(str);
  }

  return lines.join("\n");
}
