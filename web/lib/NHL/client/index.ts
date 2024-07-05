import type {
  Boxscore,
  Player,
  PlayerGameLog,
  ScheduleData,
  Season,
  Team,
} from "lib/NHL/types";
import { Response } from "pages/api/_types";

const BASE_URL = "/api/v1";

/**
 * `BASE_URL` /api/v1
 * @param path
 * @returns
 */
async function get<T = any>(path: string): Promise<T> {
  const url = `${BASE_URL}${path}`;
  try {
    return await fetch(url).then((res) => res.json());
  } catch (e: any) {
    console.error(url, e);
    // @ts-expect-error
    return null;
  }
}

export async function getCurrentSeason(): Promise<Season> {
  return await get("/season");
}
export async function getTeams(seasonId?: number): Promise<Team[]> {
  return await get(`/team/${seasonId ?? "current"}`);
}

/**
 *
 * @param startDate e.g., 2023-11-06
 * @returns
 */
export async function getSchedule(startDate: string): Promise<ScheduleData> {
  return await get(`/schedule/${startDate}`);
}

export async function getPlayer(id: number): Promise<Player> {
  return await get(`/player/${id}`);
}

export async function getGameLogs(
  playerId: number,
  season: number,
  type: number = 2
) {
  const { success, data } = await get<Response<PlayerGameLog[]>>(
    `/player/${playerId}/game-log/${season}/${type}`
  );
  if (success) {
    return data;
  } else {
    return [];
  }
}

export async function getAllPlayers(seasonId?: number): Promise<Player[]> {
  const query = seasonId ? `?season=${seasonId}` : "";
  const url = `/player${query}`;
  return await get(url);
}

export async function getBoxscore(id: number): Promise<Boxscore | null> {
  const { success, data } = await get<Response<Boxscore>>(
    `/game/${id}/boxscore`
  );

  if (success) {
    return data;
  } else {
    return null;
  }
}
