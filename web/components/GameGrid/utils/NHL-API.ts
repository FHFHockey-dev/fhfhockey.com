import { Day } from "../GameGrid";
import { parseDateStr } from "../Header";
import { DAYS, MatchUpCellData, TeamRowData } from "../TeamRow";
import calcWinOdds from "./calcWinOdds";
import { getDayStr } from "./date-func";

const URL = `https://statsapi.web.nhl.com/api/v1/`;

export default function getData(path: string) {
  return fetch(`${URL}${path}`).then((res) => res.json());
}

export type Team = {
  id: number;
  name: string;
};

type Game = {
  /**
   * e.g. 2022-04-27T23:30:00Z
   */
  gameDate: string;
  /**
   * 2022-04-27
   */
  date: string;
  teams: {
    home: {
      team: Team;
      score: number | string;
    };
    away: {
      team: Team;
      score: number | string;
    };
  };
};

/**
 * API: schedule?startDate=yyyy-mm-dd&endDate=yyyy-mm-dd
 * @param start Date string. e.g., 2020-01-13
 * @param end Date string. e.g., 2020-01-13
 * @returns
 */
export async function getTeams(
  start: string,
  end: string,
  season: string 
): Promise<[TeamRowData[], number[]]> {
  // const initWinOddsEnvPromise = initWinOddsEnv();

  const dates = (await getData(`schedule?startDate=${start}&endDate=${end}`))
    .dates;
  const games: Game[] = dates.map((date: any) => date.games).flat() as Game[];

  // Obtain Total Games Per Day
  const temp1: { [day: string]: number } = {};
  const totalGamesPerDay: number[] = [];
  dates.forEach(
    ({
      date,
      totalGames,
      games,
    }: {
      date: string;
      totalGames: number;
      games: Game[];
    }) => {
      const day = getDayStr(parseDateStr(date));
      temp1[day] = totalGames;

      // use the Gregorian calendar day
      games.forEach((game) => {
        game.date = date;
      });
    }
  );

  DAYS.forEach((day) => {
    const numGames = temp1[day] ?? 0;
    totalGamesPerDay.push(numGames);
  });

  // console.log(games);

  // init python env
  // await initWinOddsEnvPromise;
  const temp = new Map<string, { [day: string]: MatchUpCellData }>();

  // extract two teams from each game
  // [{ranger:{Mon:{}}}, {newYork:{Mon:{}}}], [colvance:{M}]
  const promises = games.map(async (game) => {
    const day = getDayStr(parseDateStr(game.date));
    const { home, away } = game.teams;
    const dat = [
      {
        [home.team.name]: {
          [day]: {
            home: true,
            away: false,
            logo: getTeamLogo(away.team.name),
            opponentName: away.team.name,
            win: home.score > away.score,
            loss: home.score < away.score,
            score: `${home.score}-${away.score}`,
            winOdds: await calcWinOdds(home.team.name, away.team.name, season),
          } as MatchUpCellData,
        },
      },
      {
        [away.team.name]: {
          [day]: {
            home: false,
            away: true,
            logo: getTeamLogo(home.team.name),
            opponentName: home.team.name,
            win: away.score > home.score,
            loss: away.score < home.score,
            score: `${away.score}-${home.score}`,
            winOdds: await calcWinOdds(away.team.name, home.team.name, season),
          } as MatchUpCellData,
        },
      },
    ];
    return dat;
  });
  // [{ranger:{Mon:{}}}, {newYork:{Mon:{}}}], [colvance:{M}]
  // { ranger:{Mon:{}, Tue:{} }  }
  const r = (await Promise.all(promises)).flat();
  r.forEach((el) => {
    const teamName = Object.keys(el)[0];
    temp.set(teamName, { ...temp.get(teamName), ...el[teamName] });
  });

  const teams: TeamRowData[] = [];

  for (const [teamName, games] of temp) {
    teams.push({
      teamName: teamName,
      ...games,
      totalGamesPlayed: 0,
      totalOffNights: 0,
      weekScore: -100, // unknown at this stage
    });
  }

  const offNights = getOffNights(totalGamesPerDay);
  teams.forEach((row) => {
    // add off nights to each day for shading light color
    offNights.forEach((day) => {
      // @ts-ignore
      row[day] = { ...row[day], offNight: true };
    });

    // add Total GP for each team
    const totalGamesPlayed = getTotalGamePlayed(row);

    // add Total Off-Nights
    const totalOffNights = calcTotalOffNights(row);

    row.totalGamesPlayed = totalGamesPlayed;
    row.totalOffNights = totalOffNights;
  });

  return [teams, totalGamesPerDay];
}

function getTeamLogo(teamName: string) {
  return `/teamLogos/${teamName}.png`;
}

export async function getAllTeams(): Promise<Team[]> {
  const teams = (await getData("teams")).teams.map((team: any) => ({
    id: team.id,
    name: team.name,
  }));
  return teams;
}

function getOffNights(totalGamesPerDay: number[]) {
  const days: Day[] = [];
  totalGamesPerDay.forEach((numGames, i) => {
    // when a day has <= 8 games, mark that day as off night
    if (numGames <= 8) {
      days.push(DAYS[i]);
    }
  });
  return days;
}

/**
 * Test if the match up exist.
 * If a match up does not exist, then its home and away will both be false.
 * @param matchUp A match up.
 * @returns true if the match up exist, otherwise false.
 */
function hasMatchUp(matchUp: MatchUpCellData | undefined) {
  return matchUp?.away || matchUp?.home;
}

export function getTotalGamePlayed(
  matchUps: TeamRowData,
  excludedDays: Day[] = []
) {
  let num = 0;
  DAYS.forEach((day) => {
    if (excludedDays.includes(day)) return;

    const hasMatchUp_ = hasMatchUp(matchUps[day]);
    if (hasMatchUp_) num++;
  });
  return num;
}

/**
 * If a team plays game at off night day, then increment counter by 1.
 * @param matchUps All match ups. Monday ~ Sunday
 * @returns Total Off Nights
 */
export function calcTotalOffNights(
  matchUps: TeamRowData,
  excludedDays: Day[] = []
) {
  let num = 0;
  DAYS.forEach((day) => {
    if (excludedDays.includes(day)) return;

    const matchUp = matchUps[day];
    const hasMatchUp_ = hasMatchUp(matchUp);
    if (hasMatchUp_ && matchUp?.offNight) num++;
  });
  return num;
}
