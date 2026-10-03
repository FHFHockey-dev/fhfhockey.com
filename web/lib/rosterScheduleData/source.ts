import { get } from "lib/NHL/base";
import { getScheduleDaily } from "lib/NHL/server/scheduleDaily";
import { MAX_BOUNDED_REFRESH_DAYS } from "./constants";

import type {
  FetchedNhlScheduleGame,
  NhlScheduleGame,
} from "./types";

type TeamDirectoryEntry = { id: number; abbreviation: string };

function addUtcDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function dedupeFetchedGames(
  games: readonly FetchedNhlScheduleGame[],
): { duplicateGameIds: number[]; games: FetchedNhlScheduleGame[] } {
  const byId = new Map<number, FetchedNhlScheduleGame>();
  const duplicateGameIds = new Set<number>();
  for (const entry of games) {
    const prior = byId.get(entry.game.id);
    if (prior) {
      const identity = (game: NhlScheduleGame) => JSON.stringify([game.season, game.gameType, game.gameDate,
        game.startTimeUTC ? (Number.isFinite(Date.parse(game.startTimeUTC)) ? Date.parse(game.startTimeUTC) : game.startTimeUTC) : null,
        game.homeTeam.id, game.homeTeam.abbrev, game.awayTeam.id, game.awayTeam.abbrev,
        game.gameState?.trim().toUpperCase() ?? "UNKNOWN", game.gameScheduleState?.trim().toUpperCase() ?? "UNKNOWN"]);
      if (identity(prior.game) !== identity(entry.game)) throw new Error("Conflicting NHL source schedule versions.");
      duplicateGameIds.add(entry.game.id);
    } else byId.set(entry.game.id, entry);
  }
  return {
    duplicateGameIds: [...duplicateGameIds].sort((a, b) => a - b),
    games: [...byId.values()].sort((a, b) => a.game.id - b.game.id),
  };
}

function duplicateWarning(duplicateGameIds: readonly number[]): string | null {
  if (duplicateGameIds.length === 0) return null;
  const sample = duplicateGameIds.slice(0, 20).join(", ");
  return `Collapsed ${duplicateGameIds.length} duplicate NHL source game IDs (${sample}${duplicateGameIds.length > 20 ? ", …" : ""}).`;
}

export async function fetchFullSeasonNhlSchedule(args: {
  seasonId: number;
  teams: readonly TeamDirectoryEntry[];
}): Promise<{
  complete: boolean;
  games: FetchedNhlScheduleGame[];
  warnings: string[];
}> {
  const fetched: FetchedNhlScheduleGame[] = [];
  const warnings: string[] = [];
  let failedTeamCount = 0;
  const concurrency = 6;

  for (let index = 0; index < args.teams.length; index += concurrency) {
    const chunk = args.teams.slice(index, index + concurrency);
    const results = await Promise.allSettled(
      chunk.map(async (team) => {
        const sourceUrl = `https://api-web.nhle.com/v1/club-schedule-season/${team.abbreviation}/${args.seasonId}`;
        const payload = await get<{ games?: NhlScheduleGame[] }>(
          `/club-schedule-season/${team.abbreviation}/${args.seasonId}`,
        );
        if (!payload || !Array.isArray(payload.games)) throw new Error("NHL club schedule response is incomplete.");
        return {
          team,
          entries: (payload.games ?? []).map((game) => ({ game, sourceUrl })),
        };
      }),
    );

    results.forEach((result, resultIndex) => {
      const team = chunk[resultIndex];
      if (result.status === "fulfilled") {
        fetched.push(...result.value.entries);
      } else {
        failedTeamCount += 1;
        warnings.push(
          `${team.abbreviation}: ${
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason)
          }`,
        );
      }
    });
  }

  if (fetched.length === 0) {
    throw new Error("NHL schedule source returned no games for any team.");
  }
  const deduped = dedupeFetchedGames(fetched);
  const warning = duplicateWarning(deduped.duplicateGameIds);
  if (warning) warnings.push(warning);
  return {
    complete: failedTeamCount === 0,
    games: deduped.games,
    warnings,
  };
}

export async function fetchBoundedNhlSchedule(args: {
  startDate: string;
  endDate: string;
  signal?: AbortSignal;
}): Promise<{
  complete: boolean;
  games: FetchedNhlScheduleGame[];
  warnings: string[];
}> {
  const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date)
    && Number.isFinite(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
  const days = (Date.parse(args.endDate) - Date.parse(args.startDate)) / 86400000 + 1;
  if (!validDate(args.startDate) || !validDate(args.endDate) || days < 1 || days > MAX_BOUNDED_REFRESH_DAYS) {
    throw new Error("Invalid bounded NHL schedule range.");
  }
  const fetched: FetchedNhlScheduleGame[] = [];
  for (let cursor = args.startDate; cursor <= args.endDate; cursor = addUtcDays(cursor, 7)) {
    if (args.signal?.aborted) throw args.signal.reason ?? new Error("NHL schedule read aborted.");
    const payload = (await getScheduleDaily(cursor, args.signal)) as unknown as {
      gameWeek?: Array<{ date?: string; games?: Array<Omit<NhlScheduleGame, "gameDate"> & { gameDate?: string | null }> }>;
    };
    if (args.signal?.aborted) throw args.signal.reason ?? new Error("NHL schedule read aborted.");
    if (!payload || !Array.isArray(payload.gameWeek)) throw new Error("NHL daily schedule response is incomplete.");
    const sourceUrl = `https://api-web.nhle.com/v1/schedule/${cursor}`;
    const seenDates = new Set<string>();
    for (const day of payload.gameWeek) {
      if (!day.date || !validDate(day.date)) throw new Error("NHL schedule day is invalid.");
      if (day.date < args.startDate || day.date > args.endDate) {
        continue;
      }
      if (!Array.isArray(day.games)) throw new Error("NHL schedule day is incomplete.");
      seenDates.add(day.date);
      for (const game of day.games) {
        if (game.gameDate != null && game.gameDate !== day.date) throw new Error("NHL game date conflicts with its schedule day.");
        fetched.push({ game: { ...game, gameDate: day.date }, sourceUrl });
      }
    }
    for (let day = cursor; day <= args.endDate && day < addUtcDays(cursor, 7); day = addUtcDays(day, 1)) {
      if (!seenDates.has(day)) throw new Error("NHL daily schedule omitted a requested date.");
    }
  }
  const deduped = dedupeFetchedGames(fetched);
  const warning = duplicateWarning(deduped.duplicateGameIds);
  return {
    complete: true,
    games: deduped.games,
    warnings: warning ? [warning] : [],
  };
}
