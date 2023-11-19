import { MatchUpCellData, TeamRowData } from "components/GameGrid/TeamRow";

const BASE_URL_ONE = "https://api-web.nhle.com/v1";
const BASE_URL_TWO = "https://api.nhle.com/stats/rest/en";

/**
 * `BASE_URL` https://api-web.nhle.com/v1
 * @param path
 * @returns
 */
function get<T = any>(path: string): Promise<T> {
  return fetch(`${BASE_URL_ONE}${path}`).then((res) => res.json());
}

/**
 * `BASE_URL` https://api.nhle.com/stats/rest/en
 * @param path
 * @returns
 */
function restGet(path: string): Promise<{ data: any[]; total: number }> {
  return fetch(`${BASE_URL_TWO}${path}`).then((res) => res.json());
}

export type Season = {
  seasonId: string;
  regularSeasonStartDate: string;
  regularSeasonEndDate: string;
  seasonEndDate: string;
  numberOfGames: number;
};

export async function getCurrentSeason(): Promise<Season> {
  const data = (
    await restGet(
      `/season?sort${encodeURIComponent(
        '[{"property": "id", "direction":"DESC"}]'
      )}&limit=1`
    )
  ).data[0];

  return {
    seasonId: data.id,
    regularSeasonStartDate: data.startDate,
    regularSeasonEndDate: data.regularSeasonEndDate,
    seasonEndDate: data.endDate,
    numberOfGames: data.numberOfGames,
  };
}

export type Team = {
  /**
   * e.g., 13
   */
  id: number;
  /**
   * e.g., "Florida Panthers"
   */
  name: string;
  /**
   * e.g., FLA
   */
  abbreviation: string;
};

export async function getTeams(): Promise<Team[]> {
  const { data } = await restGet("/team");
  return data.map((item) => ({
    id: item.id,
    name: item.fullName,
    abbreviation: item.triCode,
  }));
}

type Game = {
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

type GameWeek = {
  date: string;
  dayAbbrev: string;
  numberOfGames: number;
  games: {
    id: number;
    season: number;
    awayTeam: {
      id: number;
      abbrev: string;
      score: number;
    };
    homeTeam: {
      id: number;
      abbrev: string;
      score: number;
    };
  }[];
}[];

type DAY_ABBREVIATION = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";

/**
 *
 * @param startDate e.g., 2023-11-06
 * @returns
 */
export async function getSchedule(
  startDate: string
): Promise<[TeamRowData[], number[]]> {
  const { gameWeek } = await get<{ gameWeek: GameWeek }>(
    `/schedule/${startDate}`
  );

  const totalGamesPerDay: number[] = gameWeek.map(
    (item: any) => item.numberOfGames
  );
  const games: Game[] = [];

  const output: TeamRowData[] = [];
  const TEAM_DAY_DATA: Record<
    number,
    Record<DAY_ABBREVIATION, MatchUpCellData>
  > = {};
  gameWeek.forEach((day) => {
    day.games.forEach((game) => {
      TEAM_DAY_DATA[game.id] = {
        [day.dayAbbrev]: {
          home: true,
        },
      };
      games.push({
        date: day.date,
        teams: {
          home: {
            team: {
              id: game.homeTeam.id,
              abbreviation: game.homeTeam.abbrev,
              name: "TEMP Home Team Name" + game.homeTeam.abbrev,
            },
            score: game.homeTeam.score,
          },
          away: {
            team: {
              id: game.awayTeam.id,
              abbreviation: game.awayTeam.abbrev,
              name: "TEMP Away Team Name" + game.awayTeam.abbrev,
            },
            score: game.awayTeam.score,
          },
        },
      });
    });
  });

  return [output, totalGamesPerDay];
}
