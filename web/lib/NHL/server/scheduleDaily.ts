import { get } from "lib/NHL/base";

export interface ScheduleDailyOdds {
  providerId: number;
  value: string;
}

export interface ScheduleDailyGame {
  id: number;
  startTimeUTC: string;
  gameState?: string;
  gameScheduleState?: string;
  awayTeam: {
    id: number;
    abbrev: string;
    odds?: ScheduleDailyOdds[];
  };
  homeTeam: {
    id: number;
    abbrev: string;
    odds?: ScheduleDailyOdds[];
  };
}

export interface ScheduleDailyData {
  gameWeek: Array<{
    date: string;
    games: ScheduleDailyGame[];
  }>;
  oddsPartners: Array<{
    partnerId: number;
    name: string;
  }>;
}

export async function getScheduleDaily(date: string, signal?: AbortSignal): Promise<ScheduleDailyData> {
  return signal ? await get(`/schedule/${date}`, false, signal) : await get(`/schedule/${date}`);
}
