import path from "path";

import dotenv from "dotenv";

dotenv.config({
  path: path.resolve(__dirname, "../.env.local"),
});

type GameRow = {
  id: number | string | null;
  date: string | null;
  startTime?: string | null;
};

const SUPABASE_PAGE_SIZE = 1000;

async function fetchAllRows<TRow>(
  fetchPage: (from: number, to: number) => PromiseLike<{
    data: unknown[] | null;
    error: unknown;
  }>
): Promise<TRow[]> {
  const rows: TRow[] = [];

  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const to = from + SUPABASE_PAGE_SIZE - 1;
    const { data, error } = await fetchPage(from, to);

    if (error) {
      throw error;
    }

    const pageRows = (data ?? []) as TRow[];
    if (pageRows.length === 0) {
      break;
    }

    rows.push(...pageRows);

    if (pageRows.length < SUPABASE_PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

function chunk<T>(items: readonly T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

async function runWithRetry<T>(operation: () => Promise<T>, attempts = 3) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === attempts) {
        break;
      }

      console.warn(
        JSON.stringify({
          retrying: true,
          attempt,
          attempts,
          message: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  throw lastError;
}

async function main() {
  const [{ default: serviceRoleClient }, { refreshTeamUnderlyingSummaryRowsForGameIds }] =
    await Promise.all([
      import("lib/supabase/server"),
      import("lib/underlying-stats/teamStatsSummaryRefresh"),
    ]);

  const seasonId = Number(process.argv[2] ?? "20252026");
  const requestedGameType = Number(process.argv[3] ?? "2");
  const batchSize = Number(process.argv[4] ?? "25");
  const today = new Date().toISOString().slice(0, 10);
  const finishedCutoff = new Date(Date.now() - 8 * 60 * 60 * 1000);

  if (!Number.isFinite(seasonId) || !Number.isFinite(requestedGameType) || !Number.isFinite(batchSize)) {
    throw new Error("Expected numeric seasonId, gameType, and batchSize arguments.");
  }

  const games = await fetchAllRows<GameRow>((from, to) =>
    serviceRoleClient
      .from("games")
      .select("id,date,startTime,seasonId,type")
      .eq("seasonId", seasonId)
      .eq("type", requestedGameType)
      .lte("date", today)
      .order("date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to)
  );

  const finishedGameIds = games
    .filter((row) => Number.isFinite(Number(row.id)) && typeof row.date === "string")
    .filter((row) => row.date != null && row.date < today)
    .filter((row) => row.startTime == null || new Date(row.startTime) <= finishedCutoff)
    .map((row) => Number(row.id));

  let processedGames = 0;
  let rowsUpserted = 0;
  const gameIdBatches = chunk(finishedGameIds, Math.max(1, Math.trunc(batchSize)));

  for (let index = 0; index < gameIdBatches.length; index += 1) {
    const batch = gameIdBatches[index] ?? [];
    const result = await runWithRetry(() =>
      refreshTeamUnderlyingSummaryRowsForGameIds({
        gameIds: batch,
        seasonId,
        requestedGameType,
        shouldWarmLandingCache: false,
        supabase: serviceRoleClient,
      })
    );

    processedGames += result.gameIdsProcessed.length;
    rowsUpserted += result.rowsUpserted;

    console.log(
      JSON.stringify({
        batch: index + 1,
        totalBatches: gameIdBatches.length,
        processedGames,
        rowsUpserted,
      })
    );
  }

  console.log(JSON.stringify({ done: true, processedGames, rowsUpserted }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});