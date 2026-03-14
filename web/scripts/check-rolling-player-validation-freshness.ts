import dotenv from "dotenv";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { summarizeSourceTailFreshness } from "../lib/supabase/Upserts/rollingPlayerPipelineDiagnostics";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

type StrengthState = "all" | "ev" | "pp" | "pk";

type PlayerCase = {
  label: string;
  playerId: number;
  role: string;
};

type WgoRow = {
  game_id: number | null;
  date: string;
  season_id: number | null;
  pp_toi: number | null;
};

type DateRow = {
  date_scraped: string;
};

type PpRow = {
  gameId: number;
  pp_share_of_team: number | null;
  unit: number | null;
};

type LineRow = {
  gameId: number;
};

type RollingRow = {
  game_date: string;
  strength_state: StrengthState;
};

type StrengthFreshnessResult = {
  strength: StrengthState;
  latestRollingDate: string | null;
  rollingRowCount: number;
  blockers: {
    countsTailLag: number;
    ratesTailLag: number;
    countsOiTailLag: number;
    ppTailLag: number;
    lineTailLag: number;
  };
  latest: {
    wgoDate: string | null;
    countsDate: string | null;
    ratesDate: string | null;
    countsOiDate: string | null;
    expectedPpGameId: number | null;
    ppGameId: number | null;
    expectedLineGameId: number | null;
    lineGameId: number | null;
  };
  warnings: string[];
};

type PlayerFreshnessResult = {
  playerId: number;
  label: string;
  role: string;
  validationSeason: number | null;
  latestWgoDate: string | null;
  firstWgoDate: string | null;
  wgoRows: number;
  unresolvedFreshnessBlockers: number;
  targetFreshnessOk: boolean;
  overallStatus: "READY" | "BLOCKED";
  strengths: StrengthFreshnessResult[];
};

const VALIDATION_PLAYERS: PlayerCase[] = [
  {
    label: "Brent Burns",
    playerId: 8470613,
    role: "healthy-control skater"
  },
  {
    label: "Corey Perry",
    playerId: 8470621,
    role: "missed-games and traded-player GP case"
  },
  {
    label: "Jesper Bratt",
    playerId: 8479407,
    role: "heavy PP-role case"
  },
  {
    label: "Seth Jones",
    playerId: 8477495,
    role: "partial / incomplete-source-tail proxy"
  }
];

const STRENGTH_CONFIGS: Array<{
  state: StrengthState;
  countsTable: string;
  ratesTable: string;
  countsOiTable: string;
}> = [
  {
    state: "all",
    countsTable: "nst_gamelog_as_counts",
    ratesTable: "nst_gamelog_as_rates",
    countsOiTable: "nst_gamelog_as_counts_oi"
  },
  {
    state: "ev",
    countsTable: "nst_gamelog_es_counts",
    ratesTable: "nst_gamelog_es_rates",
    countsOiTable: "nst_gamelog_es_counts_oi"
  },
  {
    state: "pp",
    countsTable: "nst_gamelog_pp_counts",
    ratesTable: "nst_gamelog_pp_rates",
    countsOiTable: "nst_gamelog_pp_counts_oi"
  },
  {
    state: "pk",
    countsTable: "nst_gamelog_pk_counts",
    ratesTable: "nst_gamelog_pk_rates",
    countsOiTable: "nst_gamelog_pk_counts_oi"
  }
];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing Supabase credentials. Expected NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in web/.env.local."
  );
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchAllRows<T extends Record<string, unknown>>(options: {
  label: string;
  table: string;
  select: string;
  applyFilters?: (query: any) => any;
  pageSize?: number;
}): Promise<T[]> {
  const { label, table, select, applyFilters, pageSize = 1000 } = options;
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

async function fetchLatestSeason(playerId: number): Promise<number | null> {
  const { data, error } = await supabase
    .from("wgo_skater_stats")
    .select("season_id")
    .eq("player_id", playerId)
    .order("date", { ascending: false })
    .order("game_id", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(`[latest season player:${playerId}] ${error.message}`);
  }
  return typeof data?.season_id === "number" ? data.season_id : null;
}

async function fetchWgoRows(playerId: number, season: number): Promise<WgoRow[]> {
  return fetchAllRows<WgoRow>({
    label: `wgo player:${playerId} season:${season}`,
    table: "wgo_skater_stats",
    select: "game_id,date,season_id,pp_toi",
    applyFilters: (query) =>
      query
        .eq("player_id", playerId)
        .eq("season_id", season)
        .order("date", { ascending: true })
        .order("game_id", { ascending: true, nullsFirst: true })
  });
}

async function fetchDateRows(
  table: string,
  playerId: number,
  startDate: string,
  endDate: string
): Promise<DateRow[]> {
  return fetchAllRows<DateRow>({
    label: `${table} player:${playerId}`,
    table,
    select: "date_scraped",
    applyFilters: (query) =>
      query
        .eq("player_id", playerId)
        .gte("date_scraped", startDate)
        .lte("date_scraped", endDate)
        .order("date_scraped", { ascending: true })
  });
}

async function fetchPowerPlayRows(
  playerId: number,
  gameIds: number[]
): Promise<PpRow[]> {
  if (!gameIds.length) return [];
  const rows: PpRow[] = [];
  const chunkSize = 100;

  for (let index = 0; index < gameIds.length; index += chunkSize) {
    const chunk = gameIds.slice(index, index + chunkSize);
    const { data, error } = await supabase
      .from("powerPlayCombinations")
      .select("gameId, pp_share_of_team, unit")
      .eq("playerId", playerId)
      .in("gameId", chunk);
    if (error) {
      throw new Error(
        `[powerPlayCombinations player:${playerId} chunk:${index / chunkSize}] ${error.message}`
      );
    }
    rows.push(...((data ?? []) as PpRow[]));
  }

  return rows;
}

async function fetchLineRows(gameIds: number[]): Promise<LineRow[]> {
  if (!gameIds.length) return [];
  const rows: LineRow[] = [];
  const chunkSize = 100;

  for (let index = 0; index < gameIds.length; index += chunkSize) {
    const chunk = gameIds.slice(index, index + chunkSize);
    const { data, error } = await supabase
      .from("lineCombinations")
      .select("gameId")
      .in("gameId", chunk);
    if (error) {
      throw new Error(
        `[lineCombinations chunk:${index / chunkSize}] ${error.message}`
      );
    }
    rows.push(...((data ?? []) as LineRow[]));
  }

  return rows;
}

async function fetchRollingRows(
  playerId: number,
  season: number
): Promise<RollingRow[]> {
  return fetchAllRows<RollingRow>({
    label: `rolling_player_game_metrics player:${playerId} season:${season}`,
    table: "rolling_player_game_metrics",
    select: "game_date,strength_state",
    applyFilters: (query) =>
      query
        .eq("player_id", playerId)
        .eq("season", season)
        .order("game_date", { ascending: true })
  });
}

function getLatestRollingDateForStrength(
  rows: RollingRow[],
  strength: StrengthState
): string | null {
  const scoped = rows.filter((row) => row.strength_state === strength);
  if (!scoped.length) return null;
  return scoped[scoped.length - 1]?.game_date ?? null;
}

async function inspectPlayer(player: PlayerCase): Promise<PlayerFreshnessResult> {
  const validationSeason = await fetchLatestSeason(player.playerId);
  if (validationSeason == null) {
    return {
      playerId: player.playerId,
      label: player.label,
      role: player.role,
      validationSeason: null,
      latestWgoDate: null,
      firstWgoDate: null,
      wgoRows: 0,
      unresolvedFreshnessBlockers: 0,
      targetFreshnessOk: false,
      overallStatus: "BLOCKED",
      strengths: []
    };
  }

  const wgoRows = await fetchWgoRows(player.playerId, validationSeason);
  const firstWgoDate = wgoRows[0]?.date ?? null;
  const latestWgoDate = wgoRows[wgoRows.length - 1]?.date ?? null;
  const startDate = firstWgoDate;
  const endDate = latestWgoDate;
  const gameIds = wgoRows
    .map((row) => row.game_id)
    .filter((gameId): gameId is number => typeof gameId === "number");
  const [ppRows, lineRows, rollingRows] = await Promise.all([
    fetchPowerPlayRows(player.playerId, gameIds),
    fetchLineRows(gameIds),
    fetchRollingRows(player.playerId, validationSeason)
  ]);

  const strengths: StrengthFreshnessResult[] = [];

  for (const config of STRENGTH_CONFIGS) {
    const [countsRows, ratesRows, countsOiRows] = await Promise.all([
      startDate && endDate
        ? fetchDateRows(config.countsTable, player.playerId, startDate, endDate)
        : Promise.resolve([]),
      startDate && endDate
        ? fetchDateRows(config.ratesTable, player.playerId, startDate, endDate)
        : Promise.resolve([]),
      startDate && endDate
        ? fetchDateRows(config.countsOiTable, player.playerId, startDate, endDate)
        : Promise.resolve([])
    ]);

    const freshness = summarizeSourceTailFreshness({
      playerId: player.playerId,
      strength: config.state,
      wgoRows,
      countsRows,
      ratesRows,
      countsOiRows,
      ppRows,
      lineRows
    });

    strengths.push({
      strength: config.state,
      latestRollingDate: getLatestRollingDateForStrength(rollingRows, config.state),
      rollingRowCount: rollingRows.filter(
        (row) => row.strength_state === config.state
      ).length,
      blockers: freshness.blockers,
      latest: freshness.latest,
      warnings: freshness.warnings
    });
  }

  const unresolvedFreshnessBlockers = strengths.reduce(
    (sum, strength) =>
      sum +
      strength.blockers.countsTailLag +
      strength.blockers.ratesTailLag +
      strength.blockers.countsOiTailLag +
      strength.blockers.ppTailLag +
      strength.blockers.lineTailLag,
    0
  );
  const targetFreshnessOk = strengths.every(
    (strength) => strength.latestRollingDate === latestWgoDate
  );

  return {
    playerId: player.playerId,
    label: player.label,
    role: player.role,
    validationSeason,
    latestWgoDate,
    firstWgoDate,
    wgoRows: wgoRows.length,
    unresolvedFreshnessBlockers,
    targetFreshnessOk,
    overallStatus:
      unresolvedFreshnessBlockers === 0 && targetFreshnessOk ? "READY" : "BLOCKED",
    strengths
  };
}

async function main() {
  console.log(
    "[rolling-player-validation-freshness] Checking validation-player source and target freshness."
  );

  const results = await Promise.all(
    VALIDATION_PLAYERS.map((player) => inspectPlayer(player))
  );

  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        retainedValidationPlayers: VALIDATION_PLAYERS,
        replacementValidationCase: null,
        results
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("[rolling-player-validation-freshness] Failed:", error);
  process.exitCode = 1;
});
