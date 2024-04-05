import { NUM_PLAYERS_PER_LINE } from "components/LinemateMatrix";
import { teamsInfo } from "lib/NHL/teamsInfo";
import supabase from "lib/supabase";
import adminOnly from "utils/adminOnlyMiddleware";

const WEBHOOK_URL = process.env.LINE_COMBO_WEBHOOK_URL ?? "";

export default adminOnly(async (req, res) => {
  const gameId = Number(req.query.gameId);
  const teamId = req.query.teamId ? Number(req.query.teamId) : 0;
  let q = supabase
    .from("lineCombinations")
    .select(
      "...teams(teamId:id, teamAbbreviation:abbreviation), forwards, defensemen, ...games(startTime)"
    )
    .eq("gameId", gameId);
  if (teamId !== 0) {
    q = q.eq("teamId", teamId);
  }
  const { data, error } = await q.returns<
    {
      teamId: number;
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
      const imageUrl = supabase.storage
        .from("images")
        .getPublicUrl(
          `line-combos/${gameId}-linemate-matrix-${item.teamId}.png`
        ).data.publicUrl;
      const image = {
        url: imageUrl,
      };
      // get players
      let { data: forwards } = await supabase
        .from("players")
        .select("id, lastName")
        .in("id", item.forwards);
      forwards =
        forwards!.sort((a, b) => {
          const aPos = item.forwards.indexOf(a.id);
          const bPos = item.forwards.indexOf(b.id);
          return aPos - bPos;
        }) ?? [];
      let { data: defensemen } = await supabase
        .from("players")
        .select("id, lastName")
        .in("id", item.defensemen);
      defensemen =
        defensemen!.sort((a, b) => {
          const aPos = item.defensemen.indexOf(a.id);
          const bPos = item.defensemen.indexOf(b.id);
          return aPos - bPos;
        }) ?? [];

      const forwardsLines = createPlayersDescription(forwards, "FORWARDS");

      const defensemenLines = createPlayersDescription(
        defensemen,
        "DEFENSEMEN"
      );

      const extras = createExtras({
        forwards,
        defensemen,
      });

      const description = `${forwardsLines}

${defensemenLines}
${extras.length === 0 ? "" : "\n" + extras + "\n"}
[ShiftChart](${shiftChartUrl})
`;

      const embed = {
        title,
        description,
        url,
        color,
        image,
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
  } catch (e: any) {
    console.error(e);
    res.json({
      error: "Failed to post the line combo to discord " + e.message,
      message,
    });
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
  type: "FORWARDS" | "DEFENSEMEN"
) {
  const numPlayersPerLine =
    type === "FORWARDS"
      ? NUM_PLAYERS_PER_LINE.forwards
      : NUM_PLAYERS_PER_LINE.defensemen;
  const numLines = type === "FORWARDS" ? 4 : 3;
  const lines = [] as string[];
  // line number => player
  const map = new Map<number, { lastName: string }[]>();
  players.forEach((p, i) => {
    const line = getLineNumber(i, numPlayersPerLine);
    if (line > numLines) return;

    let playersOfLine = map.get(line);
    if (!playersOfLine) {
      playersOfLine = [];
      map.set(line, playersOfLine);
    }
    playersOfLine.push(p);
  });

  for (const line of map.keys()) {
    const playersOfLine = map.get(line) ?? [];
    // L1 = Line 1
    // P1 = Pairing 1
    // Just semantics but Lines are for forwards, Pairings for defensemen
    const prefix = numPlayersPerLine === 3 ? "L" : "P";
    let str = `${prefix}${line}: ${playersOfLine
      .map((p) => p.lastName)
      .join(", ")}`;
    lines.push(str);
  }

  return lines.join("\n");
}

function createExtras(players: {
  defensemen: { lastName: string }[];
  forwards: { lastName: string }[];
}) {
  const numLines = {
    forwards: 4,
    defensemen: 3,
  };
  const extras = [] as string[];
  extras.push(
    ...players.defensemen
      .slice(numLines.defensemen * NUM_PLAYERS_PER_LINE.defensemen)
      .map((p) => p.lastName)
  );
  extras.push(
    ...players.forwards
      .slice(numLines.forwards * NUM_PLAYERS_PER_LINE.forwards)
      .map((p) => p.lastName)
  );
  return extras.length > 0 ? `Extras: [${extras.join(", ")}]` : "";
}
