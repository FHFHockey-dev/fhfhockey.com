import { teamsInfo } from "lib/NHL/teamsInfo";
import supabase from "lib/supabase";
import adminOnly from "utils/adminOnlyMiddleware";

const WEBHOOK_URL = process.env.LINE_COMBO_WEBHOOK_URL ?? "";

export default adminOnly(async (req, res) => {
  const gameId = Number(req.query.gameId);
  const { data, error } = await supabase
    .from("lineCombinations")
    .select(
      "...teams(teamAbbreviation:abbreviation), forwards, ...games(startTime)"
    )
    .eq("gameId", gameId)
    .returns<
      { teamAbbreviation: string; forwards: number[]; startTime: string }[]
    >();
  if (!data) throw error;

  const shiftChartUrl = `https://fhfhockey.com/shiftChart?gameId=${gameId}&linemate-matrix-mode=line-combination#linemate-matrix`;
  const gameTime = new Intl.DateTimeFormat("en-US").format(
    new Date(data[0].startTime)
  );

  const embeds = data.map((item) => {
    const title = `${item.teamAbbreviation} Line Combos ${gameTime}`;
    const url = shiftChartUrl;
    const color = parseInt(
      teamsInfo[item.teamAbbreviation as "NJD"].primaryColor.slice(1),
      16
    );
    // todo
    const image = {
      url: "https://fyhftlxokyjtpndbkfse.supabase.co/storage/v1/object/public/images/line-combo-1.png",
    };
    const description = "";

    const embed = {
      title,
      description,
      url,
      color,
      image,
    };
    return embed;
  });

  const message = {
    content: null,
    embeds,
    username: "Line Combo",
    attachments: [],
  };
  try {
    await sendMessage(message, WEBHOOK_URL);
    res.json(message);
  } catch (e) {
    console.error(e);
    res.json({ error: "Failed to post the line combo to discord" });
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
