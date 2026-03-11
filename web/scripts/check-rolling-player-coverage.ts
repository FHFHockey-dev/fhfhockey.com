import dotenv from "dotenv";
import path from "path";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

type PlayerRow = {
  id: number;
  fullName: string | null;
  position: string | null;
};

type WgoTotalsRow = {
  player_id: number;
  season: string | null;
};

type RollingRow = {
  player_id: number;
};

type CoverageArgs = {
  season?: number;
  sample: number;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing Supabase credentials. Expected NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in web/.env.local."
  );
}

const supabase = createClient(supabaseUrl, supabaseKey);

function parseArgs(): CoverageArgs {
  const argv = process.argv.slice(2);
  const getArgValue = (...keys: string[]) => {
    for (let index = 0; index < argv.length; index += 1) {
      const token = argv[index];
      for (const key of keys) {
        if (token === key) {
          return argv[index + 1];
        }
        if (token.startsWith(`${key}=`)) {
          return token.slice(key.length + 1);
        }
      }
    }
    return undefined;
  };
  const seasonArg = getArgValue("--season", "-s");
  const sampleArg = getArgValue("--sample", "-n");
  const season =
    seasonArg !== undefined && Number.isFinite(Number(seasonArg))
      ? Number(seasonArg)
      : undefined;
  const sample =
    sampleArg !== undefined && Number.isFinite(Number(sampleArg))
      ? Math.max(1, Number(sampleArg))
      : 25;

  return { season, sample };
}

async function fetchAllRows<T extends Record<string, unknown>>(options: {
  label: string;
  select: string;
  table: string;
  applyFilters?: (query: any) => any;
  pageSize?: number;
}): Promise<T[]> {
  const { label, select, table, applyFilters, pageSize = 1000 } = options;
  const rows: T[] = [];
  let from = 0;

  while (true) {
    let query = supabase.from(table).select(select).range(from, from + pageSize - 1);
    if (applyFilters) {
      query = applyFilters(query);
    }
    const { data, error } = await query;
    if (error) {
      throw new Error(`[${label}] ${error.message}`);
    }
    const chunk = (data ?? []) as unknown as T[];
    if (!chunk.length) break;
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

function uniqueSorted(values: Iterable<number>): number[] {
  return Array.from(new Set(values)).sort((a, b) => a - b);
}

async function fetchRollingIdsForPlayers(playerIds: number[], season?: number) {
  const rollingIds = new Set<number>();
  const chunkSize = 100;

  for (let index = 0; index < playerIds.length; index += chunkSize) {
    const chunk = playerIds.slice(index, index + chunkSize);
    const rows = await fetchAllRows<RollingRow>({
      label: `rolling_player_game_metrics chunk:${index / chunkSize}`,
      table: "rolling_player_game_metrics",
      select: "player_id",
      applyFilters: (query) => {
        let next = query
          .eq("strength_state", "all")
          .in("player_id", chunk)
          .order("player_id", { ascending: true });
        if (season !== undefined) {
          next = next.eq("season", season);
        }
        return next;
      }
    });
    for (const row of rows) {
      rollingIds.add(row.player_id);
    }
  }

  return rollingIds;
}

async function fetchUpstreamGameCounts(playerIds: number[], season?: number) {
  const counts = new Map<number, number>();
  const latestDates = new Map<number, string | null>();

  await Promise.all(
    playerIds.map(async (playerId) => {
      let countQuery = supabase
        .from("wgo_skater_stats")
        .select("*", { count: "exact", head: true })
        .eq("player_id", playerId);
      if (season !== undefined) {
        countQuery = countQuery.eq("season_id", season);
      }
      const { count, error } = await countQuery;
      if (error) {
        throw new Error(`[wgo_skater_stats count] ${error.message}`);
      }
      counts.set(playerId, count ?? 0);

      let latestQuery = supabase
        .from("wgo_skater_stats")
        .select("date")
        .eq("player_id", playerId)
        .order("date", { ascending: false })
        .limit(1);
      if (season !== undefined) {
        latestQuery = latestQuery.eq("season_id", season);
      }
      const { data, error: latestError } = await latestQuery.maybeSingle();
      if (latestError) {
        throw new Error(`[wgo_skater_stats latest] ${latestError.message}`);
      }
      latestDates.set(playerId, data?.date ?? null);
    })
  );

  return { counts, latestDates };
}

async function main() {
  const { season, sample } = parseArgs();
  const seasonLabel = season ? `season ${season}` : "all seasons";

  console.log(
    `[rolling-player-coverage] Checking WGO spine coverage against rolling_player_game_metrics for ${seasonLabel}.`
  );

  const [players, wgoTotalsRows] = await Promise.all([
    fetchAllRows<PlayerRow>({
      label: "players",
      table: "players",
      select: "id,fullName,position",
      applyFilters: (query) => query.neq("position", "G").order("id", { ascending: true })
    }),
    fetchAllRows<WgoTotalsRow>({
      label: "wgo_skater_stats_totals",
      table: "wgo_skater_stats_totals",
      select: "player_id,season",
      applyFilters: (query) => {
        let next = query.order("player_id", { ascending: true }).order("season", {
          ascending: true
        });
        if (season !== undefined) {
          next = next.eq("season", String(season));
        }
        return next;
      }
    })
  ]);

  const playerMap = new Map<number, PlayerRow>(players.map((player) => [player.id, player]));
  const eligiblePlayerIds = new Set<number>(players.map((player) => player.id));
  const wgoIds = uniqueSorted(
    wgoTotalsRows
      .map((row) => row.player_id)
      .filter((playerId) => eligiblePlayerIds.has(playerId))
  );
  const rollingIds = await fetchRollingIdsForPlayers(wgoIds, season);
  const missingIds = wgoIds.filter((playerId) => !rollingIds.has(playerId));
  const sampleIds = missingIds.slice(0, sample);
  const { counts: upstreamGameCounts, latestDates: latestWgoDateByPlayer } =
    await fetchUpstreamGameCounts(sampleIds, season);

  const sampleRows = sampleIds.map((playerId) => {
    const player = playerMap.get(playerId);
    return {
      playerId,
      fullName: player?.fullName ?? null,
      position: player?.position ?? null,
      upstreamGames: upstreamGameCounts.get(playerId) ?? 0,
      latestWgoGameDate: latestWgoDateByPlayer.get(playerId) ?? null
    };
  });

  const summary = {
    scope: seasonLabel,
    skatersInPlayersTable: players.length,
    eligibleSkatersWithWgoRows: wgoIds.length,
    skatersWithRollingRows: rollingIds.size,
    skatersMissingRollingRows: missingIds.length,
    coveragePct:
      wgoIds.length > 0
        ? Number((((wgoIds.length - missingIds.length) / wgoIds.length) * 100).toFixed(2))
        : null,
    sampleSize: sampleRows.length
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!sampleRows.length) {
    console.log("[rolling-player-coverage] No skaters with WGO rows are missing rolling rows.");
    return;
  }

  console.log("[rolling-player-coverage] Sample missing skaters:");
  console.table(sampleRows);
}

main().catch((error) => {
  console.error("[rolling-player-coverage] Failed:", error);
  process.exitCode = 1;
});
