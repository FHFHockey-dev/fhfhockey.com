// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\lib\NHL\client\index.ts

import type {
  Boxscore,
  Player,
  PlayerGameLog,
  ScheduleData,
  Season,
  Team,
} from "lib/NHL/types";
import { Response } from "lib/api/types";
import { createSharedReadCache } from "./sharedRead";

const BASE_URL = "/api/v1";
const teamReads = createSharedReadCache<Team[]>();
const scheduleReads = createSharedReadCache<ScheduleData>();

function summarizeHtmlError(value: string): string {
  const title = value.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? null;
  const host = title?.split("|")[0]?.trim() ?? null;
  const code = title?.match(/\|\s*(\d{3})\s*:/)?.[1]?.trim() ?? null;
  const reason =
    title?.match(/\|\s*\d{3}\s*:\s*([^|]+)/)?.[1]?.trim() ??
    "HTML error response";

  return [
    "Upstream returned HTML instead of JSON.",
    code ? `Code ${code}.` : null,
    reason ? `${reason}.` : null,
    host ? `Host: ${host}.` : null
  ]
    .filter((part): part is string => Boolean(part))
    .join(" ");
}

/**
 * `BASE_URL` /api/v1
 * @param path
 * @returns
 */
async function get<T = any>(path: string, signal?: AbortSignal): Promise<T> {
  const url = `${BASE_URL}${path}`;
  try {
    const res = signal ? await fetch(url, { signal }) : await fetch(url);
    const contentType = res.headers.get("content-type") ?? "";
    const bodyText = await res.text();
    const isJson = contentType.includes("application/json");
    const looksLikeHtml =
      bodyText.trim().startsWith("<!DOCTYPE html") ||
      bodyText.trim().startsWith("<html");

    if (!res.ok) {
      if (looksLikeHtml) {
        throw new Error(`${url} -> ${summarizeHtmlError(bodyText)}`);
      }

      if (isJson) {
        const parsed = JSON.parse(bodyText) as { error?: unknown; message?: unknown };
        const message =
          typeof parsed.error === "string"
            ? parsed.error
            : typeof parsed.message === "string"
              ? parsed.message
              : `Request failed with status ${res.status}`;
        throw new Error(`${url} -> ${message}`);
      }

      throw new Error(`${url} -> Request failed with status ${res.status}`);
    }

    if (!isJson) {
      if (looksLikeHtml) {
        throw new Error(`${url} -> ${summarizeHtmlError(bodyText)}`);
      }
      throw new Error(`${url} -> Expected JSON but received ${contentType || "unknown content type"}`);
    }

    return JSON.parse(bodyText) as T;
  } catch (e: any) {
    if (!signal?.aborted) console.error(url, e);
    throw e;
  }
}

export async function getCurrentSeason(): Promise<Season> {
  return await get("/season");
}

export async function getTeams(seasonId?: number, opts: { signal?: AbortSignal } = {}): Promise<Team[]> {
  const path = `/team/${seasonId ?? "current"}`;
  return teamReads.read(path, signal => get<Team[]>(path, signal), opts.signal);
}

/**
 *
 * @param startDate e.g., 2023-11-06
 * @returns
 */
export async function getSchedule(
  startDate: string,
  opts: { includeOdds?: boolean; signal?: AbortSignal } = {}
): Promise<ScheduleData> {
  const includeOdds = opts.includeOdds !== false;
  const oddsPath = `/schedule/${startDate}`;
  // A complete odds-bearing window also serves fixture-only readers, never the reverse.
  const path = includeOdds || scheduleReads.has(oddsPath) ? oddsPath : `${oddsPath}?includeOdds=0`;
  return scheduleReads.read(path, signal => get<ScheduleData>(path, signal), opts.signal);
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
