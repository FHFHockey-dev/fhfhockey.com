import { Player } from "pages/api/v1/player/[id]";
import { ScheduleData } from "pages/api/v1/schedule/[startDate]";
import { Season } from "pages/api/v1/season";
import { Team } from "pages/api/v1/team";

const BASE_URL = "/api/v1";

/**
 * `BASE_URL` /api/v1
 * @param path
 * @returns
 */
function get<T = any>(path: string): Promise<T> {
  return fetch(`${BASE_URL}${path}`).then((res) => res.json());
}

export async function getCurrentSeason(): Promise<Season> {
  return get("/season");
}

export async function getTeams(): Promise<Team[]> {
  return get("/team");
}

/**
 *
 * @param startDate e.g., 2023-11-06
 * @returns
 */
export async function getSchedule(startDate: string): Promise<ScheduleData> {
  return get(`/schedule/${startDate}`);
}

export async function getPlayer(id: number): Promise<Player> {
  return get(`/player/${id}`);
}
