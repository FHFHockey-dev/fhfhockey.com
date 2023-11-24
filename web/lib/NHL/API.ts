import { Player } from "pages/api/v1/player/[id]";
import { PlayerGameLog } from "pages/api/v1/player/[id]/game-log/[season]/[type]";
import { ScheduleData } from "pages/api/v1/schedule/[startDate]";
import { Season } from "pages/api/v1/season";
import { Team } from "pages/api/v1/team/[seasonId]";

const isBrowser = typeof window !== "undefined";

const BASE_URL =
  (!isBrowser ? process.env.NEXT_PUBLIC_SITE_URL : "") + "/api/v1";

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
    console.log(url, e);
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
  try {
    return await get<PlayerGameLog[]>(
      `/player/${playerId}/game-log/${season}/${type}`
    );
  } catch (e: any) {
    console.error(`/player/${playerId}/game-log/${season}/${type}`);
    console.error("error in getGameLog", e.message);
    return [];
  }
}

export async function getAllPlayers(): Promise<Player[]> {
  return await get("/player");
}
