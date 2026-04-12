import { get } from "lib/NHL/base";

export interface RightRailData {
  seasonSeries: Array<{
    id: number;
    season: number;
    gameDate: string;
    awayTeam: { id: number; abbrev: string; logo: string; score?: number };
    homeTeam: { id: number; abbrev: string; logo: string; score?: number };
  }>;
  teamSeasonStats: {
    awayTeam: {
      ppPctg: number;
      pkPctg: number;
      goalsForPerGamePlayed: number;
      goalsAgainstPerGamePlayed: number;
    };
    homeTeam: {
      ppPctg: number;
      pkPctg: number;
      goalsForPerGamePlayed: number;
      goalsAgainstPerGamePlayed: number;
    };
  };
  last10Record: {
    awayTeam: { record: string; streakType: string; streak: number };
    homeTeam: { record: string; streakType: string; streak: number };
  };
}

export async function getRightRail(gameId: number | string): Promise<RightRailData> {
  return await get(`/gamecenter/${gameId}/right-rail`);
}
