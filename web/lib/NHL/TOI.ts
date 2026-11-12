const BASE_URL = "https://statsapi.web.nhl.com/api/v1";

const fetchStats = async (playerId: number, seasonId?: string) => {
  const response = await fetch(
    `${BASE_URL}/people/${playerId}/stats?stats=gameLog${
      seasonId ? `&season=${seasonId}` : ""
    }`
  );
  const json = await response.json();

  const matches = json.stats[0].splits.reverse();
  const teamId = json.stats[0].splits[0].team.id;

  let labels = [];
  let timeOnIce = [];
  let powerPlayTimeOnIce = [];

  for (let i = 0; i < matches.length; i++) {
    labels[i] = matches[i].date;
    timeOnIce[i] = matches[i].stat.timeOnIce;
    powerPlayTimeOnIce[i] = matches[i].stat.powerPlayTimeOnIce;
  }
  return {
    totalPowerPlayTime: await fetchTotalPowerPlayTime(teamId, seasonId, labels),
    labels,
    timeOnIce,
    powerPlayTimeOnIce,
  };
};

const fetchTotalPowerPlayTime = async (
  teamId: string,
  seasonId: string = "",
  dates: string[]
) => {
  const response = await fetch(`${BASE_URL}/teams/${teamId}/roster`);
  const json = await response.json();
  const totalPlayers = json.roster.length;
  const matchesForPlayerId: any = {};

  let powerPlayTimeOnIce = new Array(dates.length);
  for (let i = 0; i < dates.length; i++) {
    let PPTOI = 0;

    for (let j = 0; j < totalPlayers; j++) {
      const playerId = json.roster[j].person.id;
      if (i == 0) {
        const response = await fetch(
          `${BASE_URL}/people/${playerId}/stats?stats=gameLog${
            seasonId ? `&season=${seasonId}` : ""
          }`
        );
        const playerJson = await response.json();
        const matches = playerJson.stats[0].splits.reverse();

        matchesForPlayerId[playerId] = matches;
      }

      for (let k = 0; k < matchesForPlayerId[playerId].length; k++) {
        if (
          dates[i] == matchesForPlayerId[playerId][k].date &&
          matchesForPlayerId[playerId][k].stat.powerPlayTimeOnIce
        ) {
          PPTOI += parseTime(
            matchesForPlayerId[playerId][k].stat.powerPlayTimeOnIce
          );
          break;
        }
      }
    }
    powerPlayTimeOnIce[i] = PPTOI / 5;
  }
  // totalPowerPlayTime = powerPlayTimeOnIce;
  return powerPlayTimeOnIce;
};

/**
 * Convert a time-on-ice value to minutes (W2-3 A5).
 * Accepts whole or decimal minutes ("20", "20.5") and "mm:ss" ("20:30").
 * Anything else is unknown: NaN (kept as a number for the existing API
 * callers, which must not turn it into 0).
 * @param timeString minutes, decimal minutes or mm:ss
 * @returns The number of minutes, or NaN when unknown.
 */
export function parseTime(
  timeString: string | number | null | undefined
): number {
  const text = String(timeString ?? "").trim();
  if (/^\d+(\.\d+)?$/.test(text)) {
    return Number(text);
  }
  const match = /^(\d+):([0-5]\d)$/.exec(text);
  if (match) {
    return Number(match[1]) + Number(match[2]) / 60;
  }
  return Number.NaN;
}

const fetchTOIData = async (playerId: number) => {
  const { labels, timeOnIce, totalPowerPlayTime, powerPlayTimeOnIce } =
    await fetchStats(playerId);

  for (let i = 0; i < timeOnIce.length; i++) {
    timeOnIce[i] = (parseTime(timeOnIce[i]) * 100) / 60;
    powerPlayTimeOnIce[i] =
      (parseTime(powerPlayTimeOnIce[i]) / totalPowerPlayTime[i]) * 100;
  }

  return {
    labels,
    TOI: timeOnIce,
    PPTOI: powerPlayTimeOnIce,
  };
};

export default fetchTOIData;
