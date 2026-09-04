import { get } from "lib/NHL/base";
import { getScheduleDaily } from "lib/NHL/server/scheduleDaily";

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
    if (byId.has(entry.game.id)) duplicateGameIds.add(entry.game.id);
    else byId.set(entry.game.id, entry);
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
}): Promise<{
  complete: boolean;
  games: FetchedNhlScheduleGame[];
  warnings: string[];
}> {
  const fetched: FetchedNhlScheduleGame[] = [];
  for (let cursor = args.startDate; cursor <= args.endDate; cursor = addUtcDays(cursor, 7)) {
    const payload = (await getScheduleDaily(cursor)) as unknown as {
      gameWeek?: Array<{ date?: string; games?: NhlScheduleGame[] }>;
    };
    const sourceUrl = `https://api-web.nhle.com/v1/schedule/${cursor}`;
    for (const day of payload.gameWeek ?? []) {
      if (!day.date || day.date < args.startDate || day.date > args.endDate) {
        continue;
      }
      for (const game of day.games ?? []) fetched.push({ game, sourceUrl });
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
