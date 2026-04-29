import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { Client } from "pg";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), "scripts/.env") });
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

type SourceDefinition = {
  name: string;
  purpose: string;
  priority: "core" | "optional" | "storage";
  expectedDateColumns: string[];
  keyColumns: string[];
  notes: string;
};

type ColumnSummary = {
  column_name: string;
  data_type: string;
  is_nullable: "YES" | "NO";
};

type SourceInventoryRow = SourceDefinition & {
  exists: boolean;
  relationType: string | null;
  rowCount: number | null;
  dateCoverage: Array<{ column: string; min: string | null; max: string | null }>;
  columns: ColumnSummary[];
  primaryKey: string[];
  foreignKeys: string[];
  indexes: string[];
  missingKeyColumns: string[];
  metadataMode: "pg_catalog" | "management_api_sql" | "supabase_rest";
};

type IdentityCheck = {
  name: string;
  severity: "pass" | "warn" | "blocker";
  description: string;
  rows: Record<string, unknown>[];
};

type MathCheck = {
  name: string;
  severity: "pass" | "warn" | "blocker";
  description: string;
  rows: Record<string, unknown>[];
};

type NstTeamCheck = MathCheck;
type WgoStandingsCheck = MathCheck;
type GoalieCheck = MathCheck;
type LineupPlayerCheck = MathCheck;
type StorageCheck = MathCheck;
type DataQualityCheck = MathCheck;
type AsOfLeakageCheck = MathCheck;

const SOURCES: SourceDefinition[] = [
  {
    name: "games",
    purpose: "Schedule identity, home/away teams, season, start time.",
    priority: "core",
    expectedDateColumns: ["date", "startTime", "created_at"],
    keyColumns: ["id", "date", "seasonId", "startTime", "homeTeamId", "awayTeamId"],
    notes: "Backbone for schedule, rest, home ice, matchup, and result joins.",
  },
  {
    name: "teams",
    purpose: "Team identity and abbreviation mapping.",
    priority: "core",
    expectedDateColumns: [],
    keyColumns: ["id", "abbreviation", "name"],
    notes: "Must reconcile with NST/WGO team abbreviations.",
  },
  {
    name: "players",
    purpose: "Player and goalie identity.",
    priority: "core",
    expectedDateColumns: ["birthDate"],
    keyColumns: ["id", "fullName", "position", "team_id"],
    notes: "Goalies are represented as players; player team assignments can be stale.",
  },
  {
    name: "seasons",
    purpose: "Season identity for schedule joins.",
    priority: "core",
    expectedDateColumns: [],
    keyColumns: ["id"],
    notes: "Needed to interpret season IDs in `games` and stat tables.",
  },
  {
    name: "team_power_ratings_daily",
    purpose: "Primary team-strength ratings and EWMA-derived team features.",
    priority: "core",
    expectedDateColumns: ["date", "created_at"],
    keyColumns: ["team_abbreviation", "date", "off_rating", "def_rating", "xgf60", "xga60"],
    notes: "Must be mathematically audited before model use.",
  },
  {
    name: "nst_team_gamelogs_as_counts",
    purpose: "Game-level all-situation NST team counts.",
    priority: "core",
    expectedDateColumns: ["date"],
    keyColumns: ["team_abbreviation", "season_id", "date", "xgf", "xga", "cf", "ca"],
    notes: "Candidate source for rolling/as-of team xG and shot features.",
  },
  {
    name: "nst_team_gamelogs_as_rates",
    purpose: "Game-level all-situation NST team rates.",
    priority: "core",
    expectedDateColumns: ["date"],
    keyColumns: ["team_abbreviation", "season_id", "date", "xgf_per_60", "xga_per_60"],
    notes: "Candidate source for rolling/as-of per-60 team features.",
  },
  {
    name: "nst_team_gamelogs_pp_counts",
    purpose: "Game-level power-play NST team counts.",
    priority: "core",
    expectedDateColumns: ["date"],
    keyColumns: ["team_abbreviation", "season_id", "date", "xgf", "xga", "cf", "ca"],
    notes: "Upstream source for team power-rating special-teams features and PP feature candidates.",
  },
  {
    name: "nst_team_gamelogs_pp_rates",
    purpose: "Game-level power-play NST team rates.",
    priority: "core",
    expectedDateColumns: ["date"],
    keyColumns: ["team_abbreviation", "season_id", "date", "xgf_per_60", "xga_per_60"],
    notes: "Read by `web/lib/power-ratings.ts` for PP offensive rating inputs.",
  },
  {
    name: "nst_team_gamelogs_pk_counts",
    purpose: "Game-level penalty-kill NST team counts.",
    priority: "core",
    expectedDateColumns: ["date"],
    keyColumns: ["team_abbreviation", "season_id", "date", "xgf", "xga", "cf", "ca"],
    notes: "Upstream source for team power-rating special-teams features and PK feature candidates.",
  },
  {
    name: "nst_team_gamelogs_pk_rates",
    purpose: "Game-level penalty-kill NST team rates.",
    priority: "core",
    expectedDateColumns: ["date"],
    keyColumns: ["team_abbreviation", "season_id", "date", "xgf_per_60", "xga_per_60"],
    notes: "Read by `web/lib/power-ratings.ts` for PK defensive rating inputs.",
  },
  {
    name: "nst_team_5v5",
    purpose: "NST 5v5 team snapshot/table.",
    priority: "core",
    expectedDateColumns: ["date", "created_at", "updated_at"],
    keyColumns: ["team_abbreviation", "date", "xgf", "xga", "cf", "ca"],
    notes: "Use carefully: verify whether rows are daily snapshots or cumulative.",
  },
  {
    name: "nst_team_all",
    purpose: "NST all-situation team snapshot/table.",
    priority: "core",
    expectedDateColumns: ["date", "created_at", "updated_at"],
    keyColumns: ["team_abbreviation", "date", "xgf", "xga", "cf", "ca"],
    notes: "Use carefully: verify whether rows are daily snapshots or cumulative.",
  },
  {
    name: "nst_team_pp",
    purpose: "NST team power-play context.",
    priority: "core",
    expectedDateColumns: ["date", "created_at", "updated_at"],
    keyColumns: ["team_abbreviation", "date", "xgf", "xga", "gf", "ga"],
    notes: "Secondary feature source for special-teams matchup terms.",
  },
  {
    name: "nst_team_pk",
    purpose: "NST team penalty-kill context.",
    priority: "core",
    expectedDateColumns: ["date", "created_at", "updated_at"],
    keyColumns: ["team_abbreviation", "date", "xgf", "xga", "gf", "ga"],
    notes: "Secondary feature source for special-teams matchup terms.",
  },
  {
    name: "wgo_team_stats",
    purpose: "WGO team season/day stats including goals, shots, PP/PK, and discipline.",
    priority: "core",
    expectedDateColumns: ["date"],
    keyColumns: ["team_id", "franchise_name", "season_id", "date"],
    notes: "Recent rows audit as team-game rows; use game/date keys and handle null game/opponent IDs.",
  },
  {
    name: "nhl_standings_details",
    purpose: "Dated standings, l10, home/road, and goal differential context.",
    priority: "core",
    expectedDateColumns: ["date"],
    keyColumns: ["season_id", "date", "team_abbrev"],
    notes: "Useful for dated record/form context and preseason/current-season shrinkage.",
  },
  {
    name: "goalie_start_projections",
    purpose: "Starter probability, confirmation status, and projected goalie quality.",
    priority: "core",
    expectedDateColumns: ["game_date", "created_at", "updated_at"],
    keyColumns: ["game_id", "team_id", "player_id", "start_probability", "confirmed_status"],
    notes: "Must validate probability bounds and per-game/team sums.",
  },
  {
    name: "wgo_goalie_stats",
    purpose: "Goalie game/dated stats, rest splits, save percentage, and GAA.",
    priority: "core",
    expectedDateColumns: ["date"],
    keyColumns: ["goalie_id", "date", "season_id", "save_pct", "goals_against_avg"],
    notes: "Core goalie-quality source if joined as-of.",
  },
  {
    name: "wgo_goalie_stats_totals",
    purpose: "Goalie season totals.",
    priority: "core",
    expectedDateColumns: ["updated_at"],
    keyColumns: ["goalie_id", "season_id", "save_pct", "goals_against_avg"],
    notes: "Not as-of safe by itself for historical training unless snapshotted by date.",
  },
  {
    name: "vw_goalie_stats_unified",
    purpose: "Unified WGO/NST goalie view.",
    priority: "core",
    expectedDateColumns: ["date", "materialized_at"],
    keyColumns: ["player_id", "date", "season_id", "team_id"],
    notes: "Convenient source, but validate view definition and as-of safety.",
  },
  {
    name: "nst_gamelog_goalie_all_counts",
    purpose: "NST goalie all-situation counts.",
    priority: "core",
    expectedDateColumns: ["date_scraped"],
    keyColumns: ["player_id", "date_scraped", "season", "xg_against", "gsaa"],
    notes: "Goalie xGA/GSAA input source.",
  },
  {
    name: "nst_gamelog_goalie_all_rates",
    purpose: "NST goalie all-situation rates.",
    priority: "core",
    expectedDateColumns: ["date_scraped"],
    keyColumns: ["player_id", "date_scraped", "season", "xg_against_per_60", "gsaa_per_60"],
    notes: "Goalie per-60 input source.",
  },
  {
    name: "nst_gamelog_goalie_5v5_counts",
    purpose: "NST goalie 5v5 counts.",
    priority: "core",
    expectedDateColumns: ["date_scraped"],
    keyColumns: ["player_id", "date_scraped", "season", "xg_against", "gsaa"],
    notes: "5v5 goalie quality source.",
  },
  {
    name: "nst_gamelog_goalie_5v5_rates",
    purpose: "NST goalie 5v5 rates.",
    priority: "core",
    expectedDateColumns: ["date_scraped"],
    keyColumns: ["player_id", "date_scraped", "season", "xg_against_per_60", "gsaa_per_60"],
    notes: "5v5 goalie quality source.",
  },
  {
    name: "nst_gamelog_goalie_ev_counts",
    purpose: "NST goalie even-strength counts.",
    priority: "core",
    expectedDateColumns: ["date_scraped"],
    keyColumns: ["player_id", "date_scraped", "season", "xg_against", "gsaa"],
    notes: "Even-strength goalie quality source.",
  },
  {
    name: "nst_gamelog_goalie_ev_rates",
    purpose: "NST goalie even-strength rates.",
    priority: "core",
    expectedDateColumns: ["date_scraped"],
    keyColumns: ["player_id", "date_scraped", "season", "xg_against_per_60", "gsaa_per_60"],
    notes: "Even-strength goalie per-60 quality source.",
  },
  {
    name: "nst_gamelog_goalie_pk_counts",
    purpose: "NST goalie penalty-kill counts.",
    priority: "core",
    expectedDateColumns: ["date_scraped"],
    keyColumns: ["player_id", "date_scraped", "season", "xg_against", "gsaa"],
    notes: "Penalty-kill goalie quality source.",
  },
  {
    name: "nst_gamelog_goalie_pk_rates",
    purpose: "NST goalie penalty-kill rates.",
    priority: "core",
    expectedDateColumns: ["date_scraped"],
    keyColumns: ["player_id", "date_scraped", "season", "xg_against_per_60", "gsaa_per_60"],
    notes: "Penalty-kill goalie per-60 quality source.",
  },
  {
    name: "nst_gamelog_goalie_pp_counts",
    purpose: "NST goalie power-play counts.",
    priority: "core",
    expectedDateColumns: ["date_scraped"],
    keyColumns: ["player_id", "date_scraped", "season", "xg_against", "gsaa"],
    notes: "Power-play goalie quality source.",
  },
  {
    name: "nst_gamelog_goalie_pp_rates",
    purpose: "NST goalie power-play rates.",
    priority: "core",
    expectedDateColumns: ["date_scraped"],
    keyColumns: ["player_id", "date_scraped", "season", "xg_against_per_60", "gsaa_per_60"],
    notes: "Power-play goalie per-60 quality source.",
  },
  {
    name: "lineCombinations",
    purpose: "Current/projected line combinations by game/team.",
    priority: "optional",
    expectedDateColumns: [],
    keyColumns: ["gameId", "teamId", "forwards", "defensemen", "goalies"],
    notes: "Optional feature/explanation source; historical completeness must be verified.",
  },
  {
    name: "lines_nhl",
    purpose: "Historical NHL.com lineup snapshots.",
    priority: "optional",
    expectedDateColumns: ["snapshot_date", "observed_at", "updated_at"],
    keyColumns: ["capture_key", "snapshot_date", "game_id", "team_id"],
    notes: "Prospective source snapshots; likely better for current context than backtests until coverage is known.",
  },
  {
    name: "lines_dfo",
    purpose: "Historical DailyFaceoff lineup snapshots.",
    priority: "optional",
    expectedDateColumns: ["snapshot_date", "observed_at", "updated_at"],
    keyColumns: ["capture_key", "snapshot_date", "game_id", "team_id"],
    notes: "Optional lineup context source.",
  },
  {
    name: "lines_gdl",
    purpose: "Historical GameDayTweets lineup snapshots.",
    priority: "optional",
    expectedDateColumns: ["snapshot_date", "observed_at", "tweet_posted_at", "updated_at"],
    keyColumns: ["capture_key", "snapshot_date", "game_id", "team_id"],
    notes: "Optional lineup context source.",
  },
  {
    name: "lines_ccc",
    purpose: "CCC tweet-derived lineup snapshots.",
    priority: "optional",
    expectedDateColumns: ["snapshot_date", "observed_at", "tweet_posted_at", "updated_at"],
    keyColumns: ["capture_key", "snapshot_date", "game_id", "team_id", "nhl_filter_status"],
    notes: "Optional source; query only accepted observed NHL rows for model context.",
  },
  {
    name: "forge_roster_events",
    purpose: "Injury, lineup, transaction, and goalie-start events.",
    priority: "optional",
    expectedDateColumns: ["created_at", "updated_at", "effective_from", "effective_to"],
    keyColumns: ["event_id", "event_type", "confidence"],
    notes: "Optional availability/news context with confidence weighting.",
  },
  {
    name: "forge_player_projections",
    purpose: "FORGE player-level projection context.",
    priority: "optional",
    expectedDateColumns: ["as_of_date", "created_at", "updated_at"],
    keyColumns: ["run_id", "game_id", "player_id", "team_id", "horizon_games"],
    notes: "Optional player context; do not hard-block game predictions.",
  },
  {
    name: "forge_goalie_projections",
    purpose: "FORGE goalie projection context.",
    priority: "optional",
    expectedDateColumns: ["as_of_date", "created_at", "updated_at"],
    keyColumns: ["run_id", "game_id", "goalie_id", "team_id", "horizon_games"],
    notes: "Optional goalie projection context, separate from starter probabilities.",
  },
  {
    name: "forge_team_projections",
    purpose: "FORGE team-level projection context.",
    priority: "optional",
    expectedDateColumns: ["as_of_date", "created_at", "updated_at"],
    keyColumns: ["run_id", "game_id", "team_id", "horizon_games"],
    notes: "Optional team projection context.",
  },
  {
    name: "game_prediction_outputs",
    purpose: "Latest/public game prediction output contract.",
    priority: "storage",
    expectedDateColumns: ["snapshot_date", "computed_at", "updated_at"],
    keyColumns: ["snapshot_date", "game_id", "model_name", "model_version", "prediction_scope"],
    notes: "Existing key cannot preserve repeated same-day outputs for the same model/game.",
  },
  {
    name: "player_prediction_outputs",
    purpose: "Player prediction output contract.",
    priority: "storage",
    expectedDateColumns: ["snapshot_date", "computed_at", "updated_at"],
    keyColumns: ["snapshot_date", "player_id", "model_name", "model_version", "metric_key"],
    notes: "Not core to game model v1, but useful for optional player context.",
  },
  {
    name: "forge_runs",
    purpose: "FORGE run metadata and metrics.",
    priority: "storage",
    expectedDateColumns: ["as_of_date", "created_at", "updated_at"],
    keyColumns: ["run_id", "as_of_date", "status", "metrics"],
    notes: "May be reused for game model run metadata if metrics are sufficient.",
  },
  {
    name: "source_provenance_snapshots",
    purpose: "Source freshness/provenance registry.",
    priority: "storage",
    expectedDateColumns: ["snapshot_date", "observed_at", "freshness_expires_at", "updated_at"],
    keyColumns: ["snapshot_date", "source_type", "entity_type", "entity_id", "source_name"],
    notes: "Preferred source freshness contract when present.",
  },
];

function parseDbUrl(): {
  user: string;
  password: string;
  host: string;
  port: number;
  database: string;
} {
  if (
    process.env.SUPABASE_HOST &&
    process.env.SUPABASE_DB &&
    process.env.SUPABASE_USER &&
    process.env.SUPABASE_PASSWORD
  ) {
    return {
      user: process.env.SUPABASE_USER,
      password: process.env.SUPABASE_PASSWORD,
      host: process.env.SUPABASE_HOST,
      port: Number(process.env.SUPABASE_PORT ?? 5432),
      database: process.env.SUPABASE_DB,
    };
  }

  const rawUrl = process.env.SUPABASE_DB_URL;

  if (!rawUrl) {
    throw new Error("Missing SUPABASE_DB_URL in web/.env.local.");
  }

  const withoutPrefix = rawUrl.replace(/^postgresql:\/\//, "");
  const atIndex = withoutPrefix.lastIndexOf("@");
  const creds = withoutPrefix.slice(0, atIndex);
  const hostPart = withoutPrefix.slice(atIndex + 1);
  const colonIndex = creds.indexOf(":");
  const hostMatch = hostPart.match(/^([^:]+):(\d+)\/([^?]+)(\?.*)?$/);

  if (atIndex === -1 || colonIndex === -1 || !hostMatch) {
    throw new Error("Unexpected SUPABASE_DB_URL format.");
  }

  return {
    user: decodeURIComponent(creds.slice(0, colonIndex)),
    password: decodeURIComponent(creds.slice(colonIndex + 1)),
    host: hostMatch[1],
    port: Number(hostMatch[2]),
    database: hostMatch[3],
  };
}

function q(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function formatValue(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

async function getColumns(client: Client, tableName: string): Promise<ColumnSummary[]> {
  const result = await client.query<ColumnSummary>(
    `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
      ORDER BY ordinal_position
    `,
    [tableName]
  );

  return result.rows;
}

async function getRelationType(client: Client, tableName: string): Promise<string | null> {
  const result = await client.query<{ relation_type: string }>(
    `
      SELECT CASE c.relkind
        WHEN 'r' THEN 'table'
        WHEN 'v' THEN 'view'
        WHEN 'm' THEN 'materialized_view'
        WHEN 'p' THEN 'partitioned_table'
        ELSE c.relkind::text
      END AS relation_type
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = $1
      LIMIT 1
    `,
    [tableName]
  );

  return result.rows[0]?.relation_type ?? null;
}

async function getPrimaryKey(client: Client, tableName: string): Promise<string[]> {
  const result = await client.query<{ column_name: string }>(
    `
      SELECT a.attname AS column_name
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = to_regclass('public.' || quote_ident($1))
        AND i.indisprimary
      ORDER BY array_position(i.indkey, a.attnum)
    `,
    [tableName]
  );

  return result.rows.map((row) => row.column_name);
}

async function getForeignKeys(client: Client, tableName: string): Promise<string[]> {
  const result = await client.query<{ foreign_key: string }>(
    `
      SELECT conname || ': ' || pg_get_constraintdef(oid) AS foreign_key
      FROM pg_constraint
      WHERE conrelid = to_regclass('public.' || quote_ident($1))
        AND contype = 'f'
      ORDER BY conname
    `,
    [tableName]
  );

  return result.rows.map((row) => row.foreign_key);
}

async function getIndexes(client: Client, tableName: string): Promise<string[]> {
  const result = await client.query<{ indexname: string }>(
    `
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = $1
      ORDER BY indexname
    `,
    [tableName]
  );

  return result.rows.map((row) => row.indexname);
}

async function getRowCount(client: Client, source: SourceDefinition): Promise<number | null> {
  try {
    const result = await client.query<{ estimated_count: number | null }>(
      `
        SELECT CASE
          WHEN c.reltuples < 0 THEN NULL
          ELSE c.reltuples::bigint
        END AS estimated_count
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = $1
        LIMIT 1
      `,
      [source.name]
    );

    return result.rows[0]?.estimated_count == null
      ? null
      : Number(result.rows[0].estimated_count);
  } catch {
    return null;
  }
}

async function getDateCoverage(
  client: Client,
  source: SourceDefinition,
  columns: ColumnSummary[]
): Promise<Array<{ column: string; min: string | null; max: string | null }>> {
  const existingDateColumns = source.expectedDateColumns.filter((columnName) =>
    columns.some((column) => column.column_name === columnName)
  );

  const coverage: Array<{ column: string; min: string | null; max: string | null }> = [];

  for (const columnName of existingDateColumns) {
    try {
      const result = await client.query<{ min_value: unknown; max_value: unknown }>(
        `
          SELECT min(${q(columnName)}) AS min_value, max(${q(columnName)}) AS max_value
          FROM public.${q(source.name)}
        `
      );

      coverage.push({
        column: columnName,
        min: formatValue(result.rows[0]?.min_value),
        max: formatValue(result.rows[0]?.max_value),
      });
    } catch {
      coverage.push({ column: columnName, min: null, max: null });
    }
  }

  return coverage;
}

async function buildInventory(client: Client): Promise<SourceInventoryRow[]> {
  const rows: SourceInventoryRow[] = [];

  for (const source of SOURCES) {
    const relationType = await getRelationType(client, source.name);
    const exists = relationType != null;
    const columns = exists ? await getColumns(client, source.name) : [];
    const columnNames = new Set(columns.map((column) => column.column_name));

    rows.push({
      ...source,
      exists,
      relationType,
      rowCount: exists ? await getRowCount(client, source) : null,
      dateCoverage: exists ? await getDateCoverage(client, source, columns) : [],
      columns,
      primaryKey: exists ? await getPrimaryKey(client, source.name) : [],
      foreignKeys: exists ? await getForeignKeys(client, source.name) : [],
      indexes: exists ? await getIndexes(client, source.name) : [],
      missingKeyColumns: source.keyColumns.filter((column) => !columnNames.has(column)),
      metadataMode: "pg_catalog",
    });
  }

  return rows;
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function sourceNameArraySql(): string {
  return `ARRAY[${SOURCES.map((source) => sqlString(source.name)).join(",")}]`;
}

function getSupabaseProjectRef(): string {
  const rawUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fyhftlxokyjtpndbkfse.supabase.co";
  const match = rawUrl.match(/^https:\/\/([^.]+)\.supabase\.co/);
  return match?.[1] ?? "fyhftlxokyjtpndbkfse";
}

async function queryManagementApi<T>(query: string): Promise<T[]> {
  const token = process.env.SUPABASE_ACCESS_TOKEN;

  if (!token) {
    throw new Error("Missing SUPABASE_ACCESS_TOKEN for Supabase Management API.");
  }

  const projectRef = getSupabaseProjectRef();
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query/read-only`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    }
  );

  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Management API query failed (${response.status}): ${body}`);
  }

  return JSON.parse(body) as T[];
}

async function buildManagementInventory(): Promise<{
  rows: SourceInventoryRow[];
  identityChecks: IdentityCheck[];
  mathChecks: MathCheck[];
  nstTeamChecks: NstTeamCheck[];
  wgoStandingsChecks: WgoStandingsCheck[];
  goalieChecks: GoalieCheck[];
  lineupPlayerChecks: LineupPlayerCheck[];
  storageChecks: StorageCheck[];
  dataQualityChecks: DataQualityCheck[];
  asOfLeakageChecks: AsOfLeakageCheck[];
}> {
  const sourceArraySql = sourceNameArraySql();
  const relationRows = await queryManagementApi<{
    table_name: string;
    relation_type: string;
    estimated_count: number | null;
  }>(`
    SELECT
      c.relname AS table_name,
      CASE c.relkind
        WHEN 'r' THEN 'table'
        WHEN 'v' THEN 'view'
        WHEN 'm' THEN 'materialized_view'
        WHEN 'p' THEN 'partitioned_table'
        ELSE c.relkind::text
      END AS relation_type,
      CASE WHEN c.reltuples < 0 THEN NULL ELSE c.reltuples::bigint END AS estimated_count
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = ANY(${sourceArraySql})
  `);
  const columnRows = await queryManagementApi<ColumnSummary & { table_name: string }>(`
    SELECT table_name, column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ANY(${sourceArraySql})
    ORDER BY table_name, ordinal_position
  `);
  const primaryKeyRows = await queryManagementApi<{ table_name: string; column_name: string }>(`
    SELECT c.relname AS table_name, a.attname AS column_name
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    WHERE n.nspname = 'public'
      AND c.relname = ANY(${sourceArraySql})
      AND i.indisprimary
    ORDER BY c.relname, array_position(i.indkey, a.attnum)
  `);
  const foreignKeyRows = await queryManagementApi<{ table_name: string; foreign_key: string }>(`
    SELECT
      c.relname AS table_name,
      con.conname || ': ' || pg_get_constraintdef(con.oid) AS foreign_key
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = ANY(${sourceArraySql})
      AND con.contype = 'f'
    ORDER BY c.relname, con.conname
  `);
  const indexRows = await queryManagementApi<{ table_name: string; indexname: string }>(`
    SELECT tablename AS table_name, indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = ANY(${sourceArraySql})
    ORDER BY tablename, indexname
  `);

  const relationsByName = new Map(relationRows.map((row) => [row.table_name, row]));
  const columnsByName = new Map<string, ColumnSummary[]>();
  const primaryKeysByName = new Map<string, string[]>();
  const foreignKeysByName = new Map<string, string[]>();
  const indexesByName = new Map<string, string[]>();

  for (const row of columnRows) {
    const existing = columnsByName.get(row.table_name) ?? [];
    existing.push({
      column_name: row.column_name,
      data_type: row.data_type,
      is_nullable: row.is_nullable,
    });
    columnsByName.set(row.table_name, existing);
  }

  for (const row of primaryKeyRows) {
    const existing = primaryKeysByName.get(row.table_name) ?? [];
    existing.push(row.column_name);
    primaryKeysByName.set(row.table_name, existing);
  }

  for (const row of foreignKeyRows) {
    const existing = foreignKeysByName.get(row.table_name) ?? [];
    existing.push(row.foreign_key);
    foreignKeysByName.set(row.table_name, existing);
  }

  for (const row of indexRows) {
    const existing = indexesByName.get(row.table_name) ?? [];
    existing.push(row.indexname);
    indexesByName.set(row.table_name, existing);
  }

  const dateCoverageByName = await buildManagementDateCoverageBySource(columnsByName);
  const rows: SourceInventoryRow[] = [];

  for (const source of SOURCES) {
    const relation = relationsByName.get(source.name);
    const exists = relation != null;
    const columns = columnsByName.get(source.name) ?? [];
    const columnNames = new Set(columns.map((column) => column.column_name));

    rows.push({
      ...source,
      exists,
      relationType: relation?.relation_type ?? null,
      rowCount: relation?.estimated_count == null ? null : Number(relation.estimated_count),
      dateCoverage: exists ? dateCoverageByName.get(source.name) ?? [] : [],
      columns,
      primaryKey: primaryKeysByName.get(source.name) ?? [],
      foreignKeys: foreignKeysByName.get(source.name) ?? [],
      indexes: indexesByName.get(source.name) ?? [],
      missingKeyColumns: source.keyColumns.filter((column) => !columnNames.has(column)),
      metadataMode: "management_api_sql",
    });
  }

  return {
    rows,
    identityChecks: await buildManagementIdentityChecks(),
    mathChecks: await buildManagementTeamPowerChecks(),
    nstTeamChecks: await buildManagementNstTeamChecks(),
    wgoStandingsChecks: await buildManagementWgoStandingsChecks(),
    goalieChecks: await buildManagementGoalieChecks(),
    lineupPlayerChecks: await buildManagementLineupPlayerChecks(),
    storageChecks: await buildManagementStorageChecks(),
    dataQualityChecks: await buildManagementDataQualityChecks(),
    asOfLeakageChecks: await buildManagementAsOfLeakageChecks(),
  };
}

async function buildManagementDateCoverageBySource(
  columnsByName: Map<string, ColumnSummary[]>
): Promise<Map<string, Array<{ column: string; min: string | null; max: string | null }>>> {
  const selects: string[] = [];

  for (const source of SOURCES) {
    const columnNames = new Set(
      (columnsByName.get(source.name) ?? []).map((column) => column.column_name)
    );

    for (const columnName of source.expectedDateColumns) {
      if (!columnNames.has(columnName)) continue;

      selects.push(`
        SELECT
          ${sqlString(source.name)} AS source_name,
          ${sqlString(columnName)} AS column_name,
          min(${q(columnName)})::text AS min_value,
          max(${q(columnName)})::text AS max_value
        FROM public.${q(source.name)}
      `);
    }
  }

  const coverageByName = new Map<
    string,
    Array<{ column: string; min: string | null; max: string | null }>
  >();

  if (selects.length === 0) {
    return coverageByName;
  }

  const rows = await queryManagementApi<{
    source_name: string;
    column_name: string;
    min_value: string | null;
    max_value: string | null;
  }>(selects.join("\nUNION ALL\n"));

  for (const row of rows) {
    const existing = coverageByName.get(row.source_name) ?? [];
    existing.push({
      column: row.column_name,
      min: row.min_value,
      max: row.max_value,
    });
    coverageByName.set(row.source_name, existing);
  }

  return coverageByName;
}

async function buildManagementIdentityChecks(): Promise<IdentityCheck[]> {
  const checks: Array<{
    name: string;
    description: string;
    blockerWhenAnyRows?: boolean;
    query: string;
  }> = [
    {
      name: "games_team_and_season_fk_integrity",
      description: "Games should resolve home teams, away teams, and seasons.",
      blockerWhenAnyRows: true,
      query: `
        SELECT
          count(*) FILTER (WHERE ht.id IS NULL) AS missing_home_team_rows,
          count(*) FILTER (WHERE at.id IS NULL) AS missing_away_team_rows,
          count(*) FILTER (WHERE s.id IS NULL) AS missing_season_rows
        FROM public.games g
        LEFT JOIN public.teams ht ON ht.id = g."homeTeamId"
        LEFT JOIN public.teams at ON at.id = g."awayTeamId"
        LEFT JOIN public.seasons s ON s.id = g."seasonId"
      `,
    },
    {
      name: "team_abbreviation_coverage",
      description: "Team abbreviations from primary team sources should resolve to `teams.abbreviation`.",
      query: `
        WITH source_abbrs AS (
          SELECT 'team_power_ratings_daily' AS source_name, team_abbreviation AS abbr FROM public.team_power_ratings_daily
          UNION
          SELECT 'nst_team_gamelogs_as_counts', team_abbreviation FROM public.nst_team_gamelogs_as_counts
          UNION
          SELECT 'nst_team_gamelogs_as_rates', team_abbreviation FROM public.nst_team_gamelogs_as_rates
          UNION
          SELECT 'nst_team_gamelogs_pp_counts', team_abbreviation FROM public.nst_team_gamelogs_pp_counts
          UNION
          SELECT 'nst_team_gamelogs_pp_rates', team_abbreviation FROM public.nst_team_gamelogs_pp_rates
          UNION
          SELECT 'nst_team_gamelogs_pk_counts', team_abbreviation FROM public.nst_team_gamelogs_pk_counts
          UNION
          SELECT 'nst_team_gamelogs_pk_rates', team_abbreviation FROM public.nst_team_gamelogs_pk_rates
          UNION
          SELECT 'nst_team_5v5', team_abbreviation FROM public.nst_team_5v5
          UNION
          SELECT 'nst_team_all', team_abbreviation FROM public.nst_team_all
          UNION
          SELECT 'nst_team_pp', team_abbreviation FROM public.nst_team_pp
          UNION
          SELECT 'nst_team_pk', team_abbreviation FROM public.nst_team_pk
          UNION
          SELECT 'nhl_standings_details', team_abbrev FROM public.nhl_standings_details
        )
        SELECT source_name, abbr, count(*) AS distinct_marker
        FROM source_abbrs s
        LEFT JOIN public.teams t ON t.abbreviation = s.abbr
        WHERE t.id IS NULL
        GROUP BY source_name, abbr
        ORDER BY source_name, abbr
        LIMIT 50
      `,
    },
    {
      name: "wgo_team_id_coverage",
      description: "Recent WGO team rows should resolve team IDs where present.",
      query: `
        SELECT
          count(*) FILTER (WHERE team_id IS NULL) AS null_team_id_rows,
          count(*) FILTER (WHERE team_id IS NOT NULL AND t.id IS NULL) AS unmapped_team_id_rows
        FROM public.wgo_team_stats w
        LEFT JOIN public.teams t ON t.id = w.team_id
        WHERE w.date >= DATE '2023-01-01'
      `,
    },
    {
      name: "goalie_start_projection_identity_coverage",
      description: "`goalie_start_projections` rows should resolve games, teams, and players.",
      blockerWhenAnyRows: true,
      query: `
        SELECT
          count(*) FILTER (WHERE g.id IS NULL) AS missing_game_rows,
          count(*) FILTER (WHERE t.id IS NULL) AS missing_team_rows,
          count(*) FILTER (WHERE p.id IS NULL) AS missing_player_rows
        FROM public.goalie_start_projections gp
        LEFT JOIN public.games g ON g.id = gp.game_id
        LEFT JOIN public.teams t ON t.id = gp.team_id
        LEFT JOIN public.players p ON p.id = gp.player_id
      `,
    },
    {
      name: "recent_wgo_goalie_player_coverage",
      description: "Recent WGO goalie stat rows should resolve goalie IDs to players.",
      query: `
        SELECT
          count(*) AS recent_rows,
          count(*) FILTER (WHERE p.id IS NULL) AS missing_player_rows
        FROM public.wgo_goalie_stats w
        LEFT JOIN public.players p ON p.id = w.goalie_id
        WHERE w.date >= DATE '2023-01-01'
      `,
    },
    {
      name: "vw_goalie_stats_unified_team_coverage",
      description: "Unified goalie rows should have team IDs for model joins.",
      query: `
        SELECT
          count(*) AS rows,
          count(*) FILTER (WHERE team_id IS NULL) AS null_team_id_rows
        FROM public.vw_goalie_stats_unified
        WHERE date >= DATE '2023-01-01'
      `,
    },
    {
      name: "line_combinations_identity_coverage",
      description: "`lineCombinations` rows should resolve games and teams.",
      blockerWhenAnyRows: true,
      query: `
        SELECT
          count(*) FILTER (WHERE g.id IS NULL) AS missing_game_rows,
          count(*) FILTER (WHERE t.id IS NULL) AS missing_team_rows
        FROM public."lineCombinations" lc
        LEFT JOIN public.games g ON g.id = lc."gameId"
        LEFT JOIN public.teams t ON t.id = lc."teamId"
      `,
    },
    {
      name: "line_source_identity_coverage",
      description: "Accepted/observed line source rows should resolve games where supplied and teams.",
      query: `
        WITH rows AS (
          SELECT 'lines_nhl' AS source_name, game_id, team_id FROM public.lines_nhl WHERE status = 'observed'
          UNION ALL
          SELECT 'lines_dfo', game_id, team_id FROM public.lines_dfo WHERE status = 'observed'
          UNION ALL
          SELECT 'lines_gdl', game_id, team_id FROM public.lines_gdl WHERE status = 'observed'
          UNION ALL
          SELECT 'lines_ccc', game_id, team_id FROM public.lines_ccc WHERE status = 'observed' AND nhl_filter_status = 'accepted'
        )
        SELECT
          source_name,
          count(*) AS rows,
          count(*) FILTER (WHERE team_id IS NULL OR t.id IS NULL) AS missing_team_rows,
          count(*) FILTER (WHERE game_id IS NOT NULL AND g.id IS NULL) AS missing_game_rows,
          count(*) FILTER (WHERE game_id IS NULL) AS null_game_id_rows
        FROM rows r
        LEFT JOIN public.teams t ON t.id = r.team_id
        LEFT JOIN public.games g ON g.id = r.game_id
        GROUP BY source_name
        ORDER BY source_name
      `,
    },
    {
      name: "forge_projection_identity_coverage",
      description: "FORGE projection rows should resolve games, teams, players/goalies, and runs.",
      blockerWhenAnyRows: true,
      query: `
        WITH checks AS (
          SELECT
            'forge_player_projections' AS source_name,
            count(*) FILTER (WHERE g.id IS NULL) AS missing_game_rows,
            count(*) FILTER (WHERE t.id IS NULL) AS missing_team_rows,
            count(*) FILTER (WHERE ot.id IS NULL) AS missing_opponent_team_rows,
            count(*) FILTER (WHERE p.id IS NULL) AS missing_entity_rows,
            count(*) FILTER (WHERE r.run_id IS NULL) AS missing_run_rows
          FROM public.forge_player_projections fp
          LEFT JOIN public.games g ON g.id = fp.game_id
          LEFT JOIN public.teams t ON t.id = fp.team_id
          LEFT JOIN public.teams ot ON ot.id = fp.opponent_team_id
          LEFT JOIN public.players p ON p.id = fp.player_id
          LEFT JOIN public.forge_runs r ON r.run_id = fp.run_id
          UNION ALL
          SELECT
            'forge_goalie_projections',
            count(*) FILTER (WHERE g.id IS NULL),
            count(*) FILTER (WHERE t.id IS NULL),
            count(*) FILTER (WHERE ot.id IS NULL),
            count(*) FILTER (WHERE p.id IS NULL),
            count(*) FILTER (WHERE r.run_id IS NULL)
          FROM public.forge_goalie_projections fg
          LEFT JOIN public.games g ON g.id = fg.game_id
          LEFT JOIN public.teams t ON t.id = fg.team_id
          LEFT JOIN public.teams ot ON ot.id = fg.opponent_team_id
          LEFT JOIN public.players p ON p.id = fg.goalie_id
          LEFT JOIN public.forge_runs r ON r.run_id = fg.run_id
          UNION ALL
          SELECT
            'forge_team_projections',
            count(*) FILTER (WHERE g.id IS NULL),
            count(*) FILTER (WHERE t.id IS NULL),
            count(*) FILTER (WHERE ot.id IS NULL),
            0,
            count(*) FILTER (WHERE r.run_id IS NULL)
          FROM public.forge_team_projections ft
          LEFT JOIN public.games g ON g.id = ft.game_id
          LEFT JOIN public.teams t ON t.id = ft.team_id
          LEFT JOIN public.teams ot ON ot.id = ft.opponent_team_id
          LEFT JOIN public.forge_runs r ON r.run_id = ft.run_id
        )
        SELECT * FROM checks ORDER BY source_name
      `,
    },
    {
      name: "player_current_team_coverage",
      description: "Player current team assignments can be optional/stale but should be understood before player context use.",
      query: `
        SELECT
          count(*) AS players,
          count(*) FILTER (WHERE team_id IS NULL) AS null_team_id_rows,
          count(*) FILTER (WHERE team_id IS NOT NULL AND t.id IS NULL) AS unmapped_team_id_rows
        FROM public.players p
        LEFT JOIN public.teams t ON t.id = p.team_id
      `,
    },
  ];

  const results: IdentityCheck[] = [];

  for (const check of checks) {
    const rows = await queryManagementApi<Record<string, unknown>>(check.query);
    const numericValues = rows.flatMap((row) =>
      Object.entries(row)
        .filter(([key, value]) => key !== "rows" && key !== "recent_rows" && typeof value === "number")
        .map(([, value]) => Number(value))
    );
    const hasIssue = numericValues.some((value) => value > 0);

    results.push({
      name: check.name,
      description: check.description,
      rows,
      severity: hasIssue ? (check.blockerWhenAnyRows ? "blocker" : "warn") : "pass",
    });
  }

  return results;
}

async function buildManagementTeamPowerChecks(): Promise<MathCheck[]> {
  const checkDefinitions: Array<{
    name: string;
    description: string;
    blockerPredicate?: (rows: Record<string, unknown>[]) => boolean;
    warnPredicate?: (rows: Record<string, unknown>[]) => boolean;
    query: string;
  }> = [
    {
      name: "team_power_duplicate_key_check",
      description: "`team_power_ratings_daily` should have one row per team/date.",
      blockerPredicate: (rows) => Number(rows[0]?.duplicate_key_rows ?? 0) > 0,
      query: `
        WITH grouped AS (
          SELECT team_abbreviation, date, count(*) AS rows
          FROM public.team_power_ratings_daily
          GROUP BY team_abbreviation, date
        )
        SELECT
          count(*) FILTER (WHERE rows > 1) AS duplicate_keys,
          coalesce(sum(rows - 1) FILTER (WHERE rows > 1), 0) AS duplicate_key_rows
        FROM grouped
      `,
    },
    {
      name: "team_power_null_and_invalid_value_check",
      description: "Core rating/rate fields should be populated and physically plausible.",
      blockerPredicate: (rows) => {
        const row = rows[0] ?? {};
        return [
          "null_off_rating",
          "null_def_rating",
          "null_xgf60",
          "null_xga60",
          "negative_xgf60",
          "negative_xga60",
          "negative_pace60",
        ].some((key) => Number(row[key] ?? 0) > 0);
      },
      warnPredicate: (rows) => {
        const row = rows[0] ?? {};
        return [
          "null_special_rating",
          "null_goalie_rating",
          "null_trend10",
        ].some((key) => Number(row[key] ?? 0) > 0);
      },
      query: `
        SELECT
          count(*) AS rows,
          count(*) FILTER (WHERE off_rating IS NULL) AS null_off_rating,
          count(*) FILTER (WHERE def_rating IS NULL) AS null_def_rating,
          count(*) FILTER (WHERE xgf60 IS NULL) AS null_xgf60,
          count(*) FILTER (WHERE xga60 IS NULL) AS null_xga60,
          count(*) FILTER (WHERE xgf60 < 0) AS negative_xgf60,
          count(*) FILTER (WHERE xga60 < 0) AS negative_xga60,
          count(*) FILTER (WHERE pace60 < 0) AS negative_pace60,
          count(*) FILTER (WHERE special_rating IS NULL) AS null_special_rating,
          count(*) FILTER (WHERE goalie_rating IS NULL) AS null_goalie_rating,
          count(*) FILTER (WHERE trend10 IS NULL) AS null_trend10
        FROM public.team_power_ratings_daily
      `,
    },
    {
      name: "team_power_rating_range_check",
      description: "Ratings should stay in plausible z-score-derived ranges around 100.",
      warnPredicate: (rows) => {
        const row = rows[0] ?? {};
        return (
          Number(row.min_off_rating ?? 100) < 40 ||
          Number(row.max_off_rating ?? 100) > 160 ||
          Number(row.min_def_rating ?? 100) < 40 ||
          Number(row.max_def_rating ?? 100) > 160 ||
          Number(row.min_pace_rating ?? 100) < 40 ||
          Number(row.max_pace_rating ?? 100) > 160
        );
      },
      query: `
        SELECT
          min(off_rating) AS min_off_rating,
          max(off_rating) AS max_off_rating,
          avg(off_rating) AS avg_off_rating,
          min(def_rating) AS min_def_rating,
          max(def_rating) AS max_def_rating,
          avg(def_rating) AS avg_def_rating,
          min(pace_rating) AS min_pace_rating,
          max(pace_rating) AS max_pace_rating,
          avg(pace_rating) AS avg_pace_rating
        FROM public.team_power_ratings_daily
      `,
    },
    {
      name: "team_power_directionality_check",
      description: "Offense should increase with xGF; defense should improve as xGA decreases; pace should increase with pace60.",
      blockerPredicate: (rows) => {
        const row = rows[0] ?? {};
        return (
          Number(row.off_xgf60_corr ?? 0) <= 0 ||
          Number(row.def_xga60_corr ?? 0) >= 0 ||
          Number(row.pace_corr ?? 0) <= 0
        );
      },
      query: `
        SELECT
          corr(off_rating::double precision, xgf60::double precision) AS off_xgf60_corr,
          corr(def_rating::double precision, xga60::double precision) AS def_xga60_corr,
          corr(pace_rating::double precision, pace60::double precision) AS pace_corr
        FROM public.team_power_ratings_daily
        WHERE off_rating IS NOT NULL
          AND def_rating IS NOT NULL
          AND pace_rating IS NOT NULL
          AND xgf60 IS NOT NULL
          AND xga60 IS NOT NULL
          AND pace60 IS NOT NULL
      `,
    },
    {
      name: "team_power_special_team_tier_check",
      description: "Power-play and penalty-kill tiers should be null or in the expected 1-3 range.",
      blockerPredicate: (rows) => {
        const row = rows[0] ?? {};
        return Number(row.invalid_pp_tier ?? 0) > 0 || Number(row.invalid_pk_tier ?? 0) > 0;
      },
      query: `
        SELECT
          count(*) FILTER (WHERE pp_tier IS NOT NULL AND pp_tier NOT BETWEEN 1 AND 3) AS invalid_pp_tier,
          count(*) FILTER (WHERE pk_tier IS NOT NULL AND pk_tier NOT BETWEEN 1 AND 3) AS invalid_pk_tier,
          count(*) FILTER (WHERE pp_tier IS NULL) AS null_pp_tier,
          count(*) FILTER (WHERE pk_tier IS NULL) AS null_pk_tier
        FROM public.team_power_ratings_daily
      `,
    },
    {
      name: "team_power_source_date_alignment_check",
      description: "Power-rating dates should be understood relative to upstream NST/WGO source freshness.",
      warnPredicate: (rows) => {
        const row = rows[0] ?? {};
        if (!row.max_power_date || !row.max_nst_rates_date) return true;
        return String(row.max_power_date) > String(row.max_nst_rates_date);
      },
      query: `
        SELECT
          (SELECT max(date) FROM public.team_power_ratings_daily) AS max_power_date,
          (SELECT max(date) FROM public.nst_team_gamelogs_as_rates) AS max_nst_rates_date,
          (SELECT max(date) FROM public.nst_team_gamelogs_as_counts) AS max_nst_counts_date,
          (SELECT max(date) FROM public.nst_team_gamelogs_pp_rates) AS max_nst_pp_rates_date,
          (SELECT max(date) FROM public.nst_team_gamelogs_pk_rates) AS max_nst_pk_rates_date,
          (SELECT max(date) FROM public.wgo_team_stats) AS max_wgo_team_date,
          (SELECT max(date) FROM public.nhl_standings_details) AS max_standings_date
      `,
    },
    {
      name: "team_power_team_count_by_date_check",
      description: "Recent rating dates should generally include a full NHL team set.",
      warnPredicate: (rows) => rows.some((row) => Number(row.team_count ?? 0) < 32),
      query: `
        SELECT date, count(DISTINCT team_abbreviation) AS team_count
        FROM public.team_power_ratings_daily
        WHERE date >= (SELECT max(date) - INTERVAL '14 days' FROM public.team_power_ratings_daily)
        GROUP BY date
        ORDER BY date DESC
      `,
    },
  ];

  const checks: MathCheck[] = [];

  for (const definition of checkDefinitions) {
    const rows = await queryManagementApi<Record<string, unknown>>(definition.query);
    const isBlocker = definition.blockerPredicate?.(rows) ?? false;
    const isWarning = !isBlocker && (definition.warnPredicate?.(rows) ?? false);

    checks.push({
      name: definition.name,
      description: definition.description,
      rows,
      severity: isBlocker ? "blocker" : isWarning ? "warn" : "pass",
    });
  }

  return checks;
}

async function buildManagementNstTeamChecks(): Promise<NstTeamCheck[]> {
  const checkDefinitions: Array<{
    name: string;
    description: string;
    blockerPredicate?: (rows: Record<string, unknown>[]) => boolean;
    warnPredicate?: (rows: Record<string, unknown>[]) => boolean;
    query: string;
  }> = [
    {
      name: "nst_team_duplicate_key_check",
      description: "NST team sources should have one row per source/team/date.",
      blockerPredicate: (rows) => rows.some((row) => Number(row.duplicate_key_rows ?? 0) > 0),
      query: `
        WITH grouped AS (
          SELECT 'nst_team_gamelogs_as_counts' AS source_name, team_abbreviation, date, count(*) AS rows
          FROM public.nst_team_gamelogs_as_counts
          GROUP BY team_abbreviation, date
          UNION ALL
          SELECT 'nst_team_gamelogs_as_rates', team_abbreviation, date, count(*)
          FROM public.nst_team_gamelogs_as_rates
          GROUP BY team_abbreviation, date
          UNION ALL
          SELECT 'nst_team_gamelogs_pp_counts', team_abbreviation, date, count(*)
          FROM public.nst_team_gamelogs_pp_counts
          GROUP BY team_abbreviation, date
          UNION ALL
          SELECT 'nst_team_gamelogs_pp_rates', team_abbreviation, date, count(*)
          FROM public.nst_team_gamelogs_pp_rates
          GROUP BY team_abbreviation, date
          UNION ALL
          SELECT 'nst_team_gamelogs_pk_counts', team_abbreviation, date, count(*)
          FROM public.nst_team_gamelogs_pk_counts
          GROUP BY team_abbreviation, date
          UNION ALL
          SELECT 'nst_team_gamelogs_pk_rates', team_abbreviation, date, count(*)
          FROM public.nst_team_gamelogs_pk_rates
          GROUP BY team_abbreviation, date
          UNION ALL
          SELECT 'nst_team_5v5', team_abbreviation, date, count(*)
          FROM public.nst_team_5v5
          GROUP BY team_abbreviation, date
          UNION ALL
          SELECT 'nst_team_all', team_abbreviation, date, count(*)
          FROM public.nst_team_all
          GROUP BY team_abbreviation, date
          UNION ALL
          SELECT 'nst_team_pp', team_abbreviation, date, count(*)
          FROM public.nst_team_pp
          GROUP BY team_abbreviation, date
          UNION ALL
          SELECT 'nst_team_pk', team_abbreviation, date, count(*)
          FROM public.nst_team_pk
          GROUP BY team_abbreviation, date
        )
        SELECT
          source_name,
          count(*) FILTER (WHERE rows > 1) AS duplicate_keys,
          coalesce(sum(rows - 1) FILTER (WHERE rows > 1), 0) AS duplicate_key_rows
        FROM grouped
        GROUP BY source_name
        ORDER BY source_name
      `,
    },
    {
      name: "nst_team_date_freshness_check",
      description: "NST team source latest dates should be explicit so stale tables are not treated as current.",
      warnPredicate: (rows) =>
        rows.some((row) => Number(row.days_since_latest ?? 0) > 10),
      query: `
        WITH rows AS (
          SELECT 'nst_team_gamelogs_as_counts' AS source_name, team_abbreviation, date FROM public.nst_team_gamelogs_as_counts
          UNION ALL SELECT 'nst_team_gamelogs_as_rates', team_abbreviation, date FROM public.nst_team_gamelogs_as_rates
          UNION ALL SELECT 'nst_team_gamelogs_pp_counts', team_abbreviation, date FROM public.nst_team_gamelogs_pp_counts
          UNION ALL SELECT 'nst_team_gamelogs_pp_rates', team_abbreviation, date FROM public.nst_team_gamelogs_pp_rates
          UNION ALL SELECT 'nst_team_gamelogs_pk_counts', team_abbreviation, date FROM public.nst_team_gamelogs_pk_counts
          UNION ALL SELECT 'nst_team_gamelogs_pk_rates', team_abbreviation, date FROM public.nst_team_gamelogs_pk_rates
          UNION ALL SELECT 'nst_team_5v5', team_abbreviation, date FROM public.nst_team_5v5
          UNION ALL SELECT 'nst_team_all', team_abbreviation, date FROM public.nst_team_all
          UNION ALL SELECT 'nst_team_pp', team_abbreviation, date FROM public.nst_team_pp
          UNION ALL SELECT 'nst_team_pk', team_abbreviation, date FROM public.nst_team_pk
        ),
        summarized AS (
          SELECT source_name, min(date) AS min_date, max(date) AS max_date, count(DISTINCT date) AS distinct_dates
          FROM rows
          GROUP BY source_name
        )
        SELECT
          s.source_name,
          s.min_date,
          s.max_date,
          s.distinct_dates,
          current_date - s.max_date AS days_since_latest,
          count(DISTINCT r.team_abbreviation) FILTER (WHERE r.date = s.max_date) AS latest_date_team_count
        FROM summarized s
        JOIN rows r ON r.source_name = s.source_name
        GROUP BY s.source_name, s.min_date, s.max_date, s.distinct_dates
        ORDER BY s.source_name
      `,
    },
    {
      name: "nst_team_situation_label_check",
      description: "Situation labels should match gamelog table family; snapshot tables may encode the situation in the table name rather than the column.",
      warnPredicate: (rows) =>
        rows.some(
          (row) =>
            Number(row.unexpected_situation_rows ?? 0) > 0 ||
            Number(row.snapshot_default_all_rows ?? 0) > 0
        ),
      query: `
        WITH rows AS (
          SELECT 'nst_team_gamelogs_as_counts' AS source_name, 'all' AS expected_situation, false AS snapshot_table, situation FROM public.nst_team_gamelogs_as_counts
          UNION ALL SELECT 'nst_team_gamelogs_as_rates', 'all', false, situation FROM public.nst_team_gamelogs_as_rates
          UNION ALL SELECT 'nst_team_gamelogs_pp_counts', 'pp', false, situation FROM public.nst_team_gamelogs_pp_counts
          UNION ALL SELECT 'nst_team_gamelogs_pp_rates', 'pp', false, situation FROM public.nst_team_gamelogs_pp_rates
          UNION ALL SELECT 'nst_team_gamelogs_pk_counts', 'pk', false, situation FROM public.nst_team_gamelogs_pk_counts
          UNION ALL SELECT 'nst_team_gamelogs_pk_rates', 'pk', false, situation FROM public.nst_team_gamelogs_pk_rates
          UNION ALL SELECT 'nst_team_5v5', '5v5', true, situation FROM public.nst_team_5v5
          UNION ALL SELECT 'nst_team_all', 'all', true, situation FROM public.nst_team_all
          UNION ALL SELECT 'nst_team_pp', 'pp', true, situation FROM public.nst_team_pp
          UNION ALL SELECT 'nst_team_pk', 'pk', true, situation FROM public.nst_team_pk
        )
        SELECT
          source_name,
          expected_situation,
          array_agg(DISTINCT situation ORDER BY situation) AS observed_situations,
          count(*) FILTER (WHERE NOT snapshot_table AND situation <> expected_situation) AS unexpected_situation_rows,
          count(*) FILTER (WHERE snapshot_table AND source_name <> 'nst_team_all' AND situation = 'all') AS snapshot_default_all_rows
        FROM rows
        GROUP BY source_name, expected_situation
        ORDER BY source_name
      `,
    },
    {
      name: "nst_team_percentage_identity_check",
      description: "NST percentage fields should match for/(for+against) on a 0-100 percentage scale within source-rounding tolerance.",
      blockerPredicate: (rows) =>
        rows.some((row) => {
          const sourceName = String(row.source_name ?? "");
          const metric = String(row.metric ?? "");
          const isSpecialTeamXgfPct =
            metric === "xgf_pct" &&
            (sourceName.includes("_pp") || sourceName.includes("_pk"));
          const total = Number(row.total_rows ?? 0);
          const failPercent = Number(row.fail_percent_scale_rows ?? 0);
          const failFraction = Number(row.fail_fraction_scale_rows ?? 0);
          return (
            !isSpecialTeamXgfPct &&
            total > 0 &&
            failPercent / total > 0.01 &&
            failFraction / total > 0.01
          );
        }),
      warnPredicate: (rows) =>
        rows.some((row) => {
          const total = Number(row.total_rows ?? 0);
          const failPercent = Number(row.fail_percent_scale_rows ?? 0);
          return total > 0 && failPercent > 0;
        }),
      query: `
        WITH source_rows AS (
          SELECT 'nst_team_gamelogs_as_counts' AS source_name, cf::double precision, ca::double precision, cf_pct::double precision, ff::double precision, fa::double precision, ff_pct::double precision, sf::double precision, sa::double precision, sf_pct::double precision, gf::double precision, ga::double precision, gf_pct::double precision, xgf::double precision, xga::double precision, xgf_pct::double precision, scf::double precision, sca::double precision, scf_pct::double precision, hdcf::double precision, hdca::double precision, hdcf_pct::double precision, hdsf::double precision, hdsa::double precision, hdsf_pct::double precision, hdgf::double precision, hdga::double precision, hdgf_pct::double precision FROM public.nst_team_gamelogs_as_counts
          UNION ALL SELECT 'nst_team_gamelogs_as_rates', cf::double precision, ca::double precision, cf_pct::double precision, ff::double precision, fa::double precision, ff_pct::double precision, sf::double precision, sa::double precision, sf_pct::double precision, gf::double precision, ga::double precision, gf_pct::double precision, xgf::double precision, xga::double precision, xgf_pct::double precision, scf::double precision, sca::double precision, scf_pct::double precision, hdcf::double precision, hdca::double precision, hdcf_pct::double precision, hdsf::double precision, hdsa::double precision, hdsf_pct::double precision, hdgf::double precision, hdga::double precision, hdgf_pct::double precision FROM public.nst_team_gamelogs_as_rates
          UNION ALL SELECT 'nst_team_gamelogs_pp_counts', cf::double precision, ca::double precision, cf_pct::double precision, ff::double precision, fa::double precision, ff_pct::double precision, sf::double precision, sa::double precision, sf_pct::double precision, gf::double precision, ga::double precision, gf_pct::double precision, xgf::double precision, xga::double precision, xgf_pct::double precision, scf::double precision, sca::double precision, scf_pct::double precision, hdcf::double precision, hdca::double precision, hdcf_pct::double precision, hdsf::double precision, hdsa::double precision, hdsf_pct::double precision, hdgf::double precision, hdga::double precision, hdgf_pct::double precision FROM public.nst_team_gamelogs_pp_counts
          UNION ALL SELECT 'nst_team_gamelogs_pp_rates', cf::double precision, ca::double precision, cf_pct::double precision, ff::double precision, fa::double precision, ff_pct::double precision, sf::double precision, sa::double precision, sf_pct::double precision, gf::double precision, ga::double precision, gf_pct::double precision, xgf::double precision, xga::double precision, xgf_pct::double precision, scf::double precision, sca::double precision, scf_pct::double precision, hdcf::double precision, hdca::double precision, hdcf_pct::double precision, hdsf::double precision, hdsa::double precision, hdsf_pct::double precision, hdgf::double precision, hdga::double precision, hdgf_pct::double precision FROM public.nst_team_gamelogs_pp_rates
          UNION ALL SELECT 'nst_team_gamelogs_pk_counts', cf::double precision, ca::double precision, cf_pct::double precision, ff::double precision, fa::double precision, ff_pct::double precision, sf::double precision, sa::double precision, sf_pct::double precision, gf::double precision, ga::double precision, gf_pct::double precision, xgf::double precision, xga::double precision, xgf_pct::double precision, scf::double precision, sca::double precision, scf_pct::double precision, hdcf::double precision, hdca::double precision, hdcf_pct::double precision, hdsf::double precision, hdsa::double precision, hdsf_pct::double precision, hdgf::double precision, hdga::double precision, hdgf_pct::double precision FROM public.nst_team_gamelogs_pk_counts
          UNION ALL SELECT 'nst_team_gamelogs_pk_rates', cf::double precision, ca::double precision, cf_pct::double precision, ff::double precision, fa::double precision, ff_pct::double precision, sf::double precision, sa::double precision, sf_pct::double precision, gf::double precision, ga::double precision, gf_pct::double precision, xgf::double precision, xga::double precision, xgf_pct::double precision, scf::double precision, sca::double precision, scf_pct::double precision, hdcf::double precision, hdca::double precision, hdcf_pct::double precision, hdsf::double precision, hdsa::double precision, hdsf_pct::double precision, hdgf::double precision, hdga::double precision, hdgf_pct::double precision FROM public.nst_team_gamelogs_pk_rates
          UNION ALL SELECT 'nst_team_5v5', cf::double precision, ca::double precision, cf_pct::double precision, ff::double precision, fa::double precision, ff_pct::double precision, sf::double precision, sa::double precision, sf_pct::double precision, gf::double precision, ga::double precision, gf_pct::double precision, xgf::double precision, xga::double precision, xgf_pct::double precision, scf::double precision, sca::double precision, scf_pct::double precision, hdcf::double precision, hdca::double precision, hdcf_pct::double precision, hdsf::double precision, hdsa::double precision, hdsf_pct::double precision, hdgf::double precision, hdga::double precision, hdgf_pct::double precision FROM public.nst_team_5v5
          UNION ALL SELECT 'nst_team_all', cf::double precision, ca::double precision, cf_pct::double precision, ff::double precision, fa::double precision, ff_pct::double precision, sf::double precision, sa::double precision, sf_pct::double precision, gf::double precision, ga::double precision, gf_pct::double precision, xgf::double precision, xga::double precision, xgf_pct::double precision, scf::double precision, sca::double precision, scf_pct::double precision, hdcf::double precision, hdca::double precision, hdcf_pct::double precision, hdsf::double precision, hdsa::double precision, hdsf_pct::double precision, hdgf::double precision, hdga::double precision, hdgf_pct::double precision FROM public.nst_team_all
          UNION ALL SELECT 'nst_team_pp', cf::double precision, ca::double precision, cf_pct::double precision, ff::double precision, fa::double precision, ff_pct::double precision, sf::double precision, sa::double precision, sf_pct::double precision, gf::double precision, ga::double precision, gf_pct::double precision, xgf::double precision, xga::double precision, xgf_pct::double precision, scf::double precision, sca::double precision, scf_pct::double precision, hdcf::double precision, hdca::double precision, hdcf_pct::double precision, hdsf::double precision, hdsa::double precision, hdsf_pct::double precision, hdgf::double precision, hdga::double precision, hdgf_pct::double precision FROM public.nst_team_pp
          UNION ALL SELECT 'nst_team_pk', cf::double precision, ca::double precision, cf_pct::double precision, ff::double precision, fa::double precision, ff_pct::double precision, sf::double precision, sa::double precision, sf_pct::double precision, gf::double precision, ga::double precision, gf_pct::double precision, xgf::double precision, xga::double precision, xgf_pct::double precision, scf::double precision, sca::double precision, scf_pct::double precision, hdcf::double precision, hdca::double precision, hdcf_pct::double precision, hdsf::double precision, hdsa::double precision, hdsf_pct::double precision, hdgf::double precision, hdga::double precision, hdgf_pct::double precision FROM public.nst_team_pk
        ),
        metric_rows AS (
          SELECT source_name, metric, for_value, against_value, pct_value
          FROM source_rows
          CROSS JOIN LATERAL (
            VALUES
              ('cf_pct', cf, ca, cf_pct),
              ('ff_pct', ff, fa, ff_pct),
              ('sf_pct', sf, sa, sf_pct),
              ('gf_pct', gf, ga, gf_pct),
              ('xgf_pct', xgf, xga, xgf_pct),
              ('scf_pct', scf, sca, scf_pct),
              ('hdcf_pct', hdcf, hdca, hdcf_pct),
              ('hdsf_pct', hdsf, hdsa, hdsf_pct),
              ('hdgf_pct', hdgf, hdga, hdgf_pct)
          ) AS metrics(metric, for_value, against_value, pct_value)
        )
        SELECT
          source_name,
          metric,
          count(*) FILTER (WHERE pct_value IS NOT NULL AND for_value IS NOT NULL AND against_value IS NOT NULL AND for_value + against_value > 0) AS total_rows,
          count(*) FILTER (
            WHERE pct_value IS NOT NULL
              AND for_value IS NOT NULL
              AND against_value IS NOT NULL
              AND for_value + against_value > 0
              AND abs(pct_value - (100.0 * for_value / (for_value + against_value))) > 0.25
          ) AS fail_percent_scale_rows,
          count(*) FILTER (
            WHERE pct_value IS NOT NULL
              AND for_value IS NOT NULL
              AND against_value IS NOT NULL
              AND for_value + against_value > 0
              AND abs(pct_value - (for_value / (for_value + against_value))) > 0.0005
          ) AS fail_fraction_scale_rows,
          min(pct_value) AS min_pct_value,
          max(pct_value) AS max_pct_value
        FROM metric_rows
        GROUP BY source_name, metric
        ORDER BY source_name, metric
      `,
    },
    {
      name: "nst_team_per60_identity_check",
      description: "Gamelog per-60 fields should match count * 3600 / TOI seconds.",
      blockerPredicate: (rows) =>
        rows.some((row) => {
          const total = Number(row.total_rows ?? 0);
          const failures = Number(row.rate_mismatch_rows ?? 0);
          return total > 0 && failures / total > 0.01;
        }),
      warnPredicate: (rows) =>
        rows.some((row) => Number(row.rate_mismatch_rows ?? 0) > 0),
      query: `
        WITH source_rows AS (
          SELECT 'nst_team_gamelogs_as_rates' AS source_name, toi_seconds::double precision, cf::double precision, cf_per_60::double precision, ca::double precision, ca_per_60::double precision, sf::double precision, sf_per_60::double precision, sa::double precision, sa_per_60::double precision, gf::double precision, gf_per_60::double precision, ga::double precision, ga_per_60::double precision, xgf::double precision, xgf_per_60::double precision, xga::double precision, xga_per_60::double precision, scf::double precision, scf_per_60::double precision, sca::double precision, sca_per_60::double precision, hdcf::double precision, hdcf_per_60::double precision, hdca::double precision, hdca_per_60::double precision FROM public.nst_team_gamelogs_as_rates
          UNION ALL SELECT 'nst_team_gamelogs_pp_rates', toi_seconds::double precision, cf::double precision, cf_per_60::double precision, ca::double precision, ca_per_60::double precision, sf::double precision, sf_per_60::double precision, sa::double precision, sa_per_60::double precision, gf::double precision, gf_per_60::double precision, ga::double precision, ga_per_60::double precision, xgf::double precision, xgf_per_60::double precision, xga::double precision, xga_per_60::double precision, scf::double precision, scf_per_60::double precision, sca::double precision, sca_per_60::double precision, hdcf::double precision, hdcf_per_60::double precision, hdca::double precision, hdca_per_60::double precision FROM public.nst_team_gamelogs_pp_rates
          UNION ALL SELECT 'nst_team_gamelogs_pk_rates', toi_seconds::double precision, cf::double precision, cf_per_60::double precision, ca::double precision, ca_per_60::double precision, sf::double precision, sf_per_60::double precision, sa::double precision, sa_per_60::double precision, gf::double precision, gf_per_60::double precision, ga::double precision, ga_per_60::double precision, xgf::double precision, xgf_per_60::double precision, xga::double precision, xga_per_60::double precision, scf::double precision, scf_per_60::double precision, sca::double precision, sca_per_60::double precision, hdcf::double precision, hdcf_per_60::double precision, hdca::double precision, hdca_per_60::double precision FROM public.nst_team_gamelogs_pk_rates
        ),
        metric_rows AS (
          SELECT source_name, toi_seconds, metric, count_value, rate_value
          FROM source_rows
          CROSS JOIN LATERAL (
            VALUES
              ('cf_per_60', cf, cf_per_60),
              ('ca_per_60', ca, ca_per_60),
              ('sf_per_60', sf, sf_per_60),
              ('sa_per_60', sa, sa_per_60),
              ('gf_per_60', gf, gf_per_60),
              ('ga_per_60', ga, ga_per_60),
              ('xgf_per_60', xgf, xgf_per_60),
              ('xga_per_60', xga, xga_per_60),
              ('scf_per_60', scf, scf_per_60),
              ('sca_per_60', sca, sca_per_60),
              ('hdcf_per_60', hdcf, hdcf_per_60),
              ('hdca_per_60', hdca, hdca_per_60)
          ) AS metrics(metric, count_value, rate_value)
        )
        SELECT
          source_name,
          metric,
          count(*) FILTER (WHERE toi_seconds > 0 AND count_value IS NOT NULL AND rate_value IS NOT NULL) AS total_rows,
          count(*) FILTER (
            WHERE toi_seconds > 0
              AND count_value IS NOT NULL
              AND rate_value IS NOT NULL
              AND abs(rate_value - (count_value * 3600.0 / toi_seconds)) > 0.1
          ) AS rate_mismatch_rows,
          max(abs(rate_value - (count_value * 3600.0 / nullif(toi_seconds, 0)))) AS max_abs_delta
        FROM metric_rows
        GROUP BY source_name, metric
        ORDER BY source_name, metric
      `,
    },
    {
      name: "nst_team_count_rate_pairing_check",
      description: "NST count and rate gamelog tables should have matching team/date coverage within each situation family.",
      warnPredicate: (rows) =>
        rows.some(
          (row) =>
            Number(row.count_rows_missing_rate_pair ?? 0) > 0 ||
            Number(row.rate_rows_missing_count_pair ?? 0) > 0
        ),
      query: `
        WITH families AS (
          SELECT
            'as' AS situation_family,
            (SELECT count(*) FROM public.nst_team_gamelogs_as_counts c LEFT JOIN public.nst_team_gamelogs_as_rates r USING (team_abbreviation, date) WHERE r.team_abbreviation IS NULL) AS count_rows_missing_rate_pair,
            (SELECT count(*) FROM public.nst_team_gamelogs_as_rates r LEFT JOIN public.nst_team_gamelogs_as_counts c USING (team_abbreviation, date) WHERE c.team_abbreviation IS NULL) AS rate_rows_missing_count_pair
          UNION ALL
          SELECT
            'pp',
            (SELECT count(*) FROM public.nst_team_gamelogs_pp_counts c LEFT JOIN public.nst_team_gamelogs_pp_rates r USING (team_abbreviation, date) WHERE r.team_abbreviation IS NULL),
            (SELECT count(*) FROM public.nst_team_gamelogs_pp_rates r LEFT JOIN public.nst_team_gamelogs_pp_counts c USING (team_abbreviation, date) WHERE c.team_abbreviation IS NULL)
          UNION ALL
          SELECT
            'pk',
            (SELECT count(*) FROM public.nst_team_gamelogs_pk_counts c LEFT JOIN public.nst_team_gamelogs_pk_rates r USING (team_abbreviation, date) WHERE r.team_abbreviation IS NULL),
            (SELECT count(*) FROM public.nst_team_gamelogs_pk_rates r LEFT JOIN public.nst_team_gamelogs_pk_counts c USING (team_abbreviation, date) WHERE c.team_abbreviation IS NULL)
        )
        SELECT * FROM families ORDER BY situation_family
      `,
    },
    {
      name: "nst_team_snapshot_semantics_check",
      description: "NST snapshot tables with GP greater than 1 are cumulative/snapshot rows, not one-game logs.",
      warnPredicate: (rows) => rows.some((row) => Number(row.rows_with_gp_gt_1 ?? 0) > 0),
      query: `
        WITH rows AS (
          SELECT 'nst_team_5v5' AS source_name, team_abbreviation, date, gp FROM public.nst_team_5v5
          UNION ALL SELECT 'nst_team_all', team_abbreviation, date, gp FROM public.nst_team_all
          UNION ALL SELECT 'nst_team_pp', team_abbreviation, date, gp FROM public.nst_team_pp
          UNION ALL SELECT 'nst_team_pk', team_abbreviation, date, gp FROM public.nst_team_pk
        ),
        ordered AS (
          SELECT
            source_name,
            team_abbreviation,
            date,
            gp,
            lag(gp) OVER (PARTITION BY source_name, team_abbreviation ORDER BY date) AS previous_gp
          FROM rows
        )
        SELECT
          source_name,
          count(*) AS rows,
          count(*) FILTER (WHERE gp > 1) AS rows_with_gp_gt_1,
          min(gp) AS min_gp,
          max(gp) AS max_gp,
          count(*) FILTER (WHERE gp IS NOT NULL AND previous_gp IS NOT NULL AND gp < previous_gp) AS gp_decrease_rows
        FROM ordered
        GROUP BY source_name
        ORDER BY source_name
      `,
    },
    {
      name: "nst_team_gamelog_gp_check",
      description: "NST gamelog tables should normally represent one team-game row when GP is populated.",
      warnPredicate: (rows) => rows.some((row) => Number(row.rows_where_gp_not_1 ?? 0) > 0),
      query: `
        WITH rows AS (
          SELECT 'nst_team_gamelogs_as_counts' AS source_name, gp FROM public.nst_team_gamelogs_as_counts
          UNION ALL SELECT 'nst_team_gamelogs_as_rates', gp FROM public.nst_team_gamelogs_as_rates
          UNION ALL SELECT 'nst_team_gamelogs_pp_counts', gp FROM public.nst_team_gamelogs_pp_counts
          UNION ALL SELECT 'nst_team_gamelogs_pp_rates', gp FROM public.nst_team_gamelogs_pp_rates
          UNION ALL SELECT 'nst_team_gamelogs_pk_counts', gp FROM public.nst_team_gamelogs_pk_counts
          UNION ALL SELECT 'nst_team_gamelogs_pk_rates', gp FROM public.nst_team_gamelogs_pk_rates
        )
        SELECT
          source_name,
          count(*) AS rows,
          count(*) FILTER (WHERE gp IS NULL) AS null_gp_rows,
          count(*) FILTER (WHERE gp IS NOT NULL AND gp <> 1) AS rows_where_gp_not_1,
          min(gp) AS min_gp,
          max(gp) AS max_gp
        FROM rows
        GROUP BY source_name
        ORDER BY source_name
      `,
    },
  ];

  const checks: NstTeamCheck[] = [];

  for (const definition of checkDefinitions) {
    const rows = await queryManagementApi<Record<string, unknown>>(definition.query);
    const isBlocker = definition.blockerPredicate?.(rows) ?? false;
    const isWarning = !isBlocker && (definition.warnPredicate?.(rows) ?? false);

    checks.push({
      name: definition.name,
      description: definition.description,
      rows,
      severity: isBlocker ? "blocker" : isWarning ? "warn" : "pass",
    });
  }

  return checks;
}

async function buildManagementWgoStandingsChecks(): Promise<WgoStandingsCheck[]> {
  const checkDefinitions: Array<{
    name: string;
    description: string;
    blockerPredicate?: (rows: Record<string, unknown>[]) => boolean;
    warnPredicate?: (rows: Record<string, unknown>[]) => boolean;
    query: string;
  }> = [
    {
      name: "wgo_standings_duplicate_key_check",
      description: "WGO team stats and standings should have unique source-specific team/date keys.",
      blockerPredicate: (rows) => rows.some((row) => Number(row.duplicate_key_rows ?? 0) > 0),
      query: `
        WITH grouped AS (
          SELECT 'wgo_team_stats' AS source_name, season_id::text AS season_key, team_id::text AS team_key, date, count(*) AS rows
          FROM public.wgo_team_stats
          GROUP BY season_id, team_id, date
          UNION ALL
          SELECT 'nhl_standings_details', season_id::text, team_abbrev, date, count(*)
          FROM public.nhl_standings_details
          GROUP BY season_id, team_abbrev, date
        )
        SELECT
          source_name,
          count(*) FILTER (WHERE rows > 1) AS duplicate_keys,
          coalesce(sum(rows - 1) FILTER (WHERE rows > 1), 0) AS duplicate_key_rows
        FROM grouped
        GROUP BY source_name
        ORDER BY source_name
      `,
    },
    {
      name: "wgo_team_stats_identity_coverage",
      description: "Recent WGO team rows should resolve team, game, and opponent identities when IDs are supplied.",
      warnPredicate: (rows) =>
        rows.some(
          (row) =>
            Number(row.null_game_id_rows ?? 0) > 0 ||
            Number(row.unmapped_game_id_rows ?? 0) > 0 ||
            Number(row.unmapped_team_id_rows ?? 0) > 0 ||
            Number(row.unmapped_opponent_id_rows ?? 0) > 0
        ),
      query: `
        SELECT
          count(*) AS recent_rows,
          count(*) FILTER (WHERE w.team_id IS NULL) AS null_team_id_rows,
          count(*) FILTER (WHERE w.team_id IS NOT NULL AND t.id IS NULL) AS unmapped_team_id_rows,
          count(*) FILTER (WHERE w.game_id IS NULL) AS null_game_id_rows,
          count(*) FILTER (WHERE w.game_id IS NOT NULL AND g.id IS NULL) AS unmapped_game_id_rows,
          count(*) FILTER (WHERE w.opponent_id IS NULL) AS null_opponent_id_rows,
          count(*) FILTER (WHERE w.opponent_id IS NOT NULL AND ot.id IS NULL) AS unmapped_opponent_id_rows
        FROM public.wgo_team_stats w
        LEFT JOIN public.teams t ON t.id = w.team_id
        LEFT JOIN public.teams ot ON ot.id = w.opponent_id
        LEFT JOIN public.games g ON g.id = w.game_id
        WHERE w.date >= DATE '2023-01-01'
      `,
    },
    {
      name: "wgo_standings_date_freshness_check",
      description: "WGO and standings source freshness should be explicit for as-of feature joins.",
      warnPredicate: (rows) => rows.some((row) => Number(row.days_since_latest ?? 0) > 10),
      query: `
        WITH rows AS (
          SELECT 'wgo_team_stats' AS source_name, team_id::text AS team_key, date FROM public.wgo_team_stats
          UNION ALL
          SELECT 'nhl_standings_details', team_abbrev, date FROM public.nhl_standings_details
        ),
        summarized AS (
          SELECT source_name, min(date) AS min_date, max(date) AS max_date, count(DISTINCT date) AS distinct_dates
          FROM rows
          GROUP BY source_name
        )
        SELECT
          s.source_name,
          s.min_date,
          s.max_date,
          s.distinct_dates,
          current_date - s.max_date AS days_since_latest,
          count(DISTINCT r.team_key) FILTER (WHERE r.date = s.max_date) AS latest_date_team_count
        FROM summarized s
        JOIN rows r ON r.source_name = s.source_name
        GROUP BY s.source_name, s.min_date, s.max_date, s.distinct_dates
        ORDER BY s.source_name
      `,
    },
    {
      name: "wgo_team_stats_game_level_semantics_check",
      description: "Recent WGO team rows should normally be one team-game row when games_played is populated.",
      warnPredicate: (rows) => rows.some((row) => Number(row.rows_with_games_played_gt_1 ?? 0) > 0),
      query: `
        SELECT
          count(*) AS rows,
          count(*) FILTER (WHERE games_played IS NULL) AS null_games_played_rows,
          count(*) FILTER (WHERE games_played > 1) AS rows_with_games_played_gt_1,
          min(games_played) AS min_games_played,
          max(games_played) AS max_games_played
        FROM public.wgo_team_stats
        WHERE date >= DATE '2023-01-01'
      `,
    },
    {
      name: "wgo_team_stats_record_math_check",
      description: "WGO season-to-date wins, losses, OT losses, points, point percentage, and goals-per-game fields should be internally consistent.",
      blockerPredicate: (rows) => {
        const row = rows[0] ?? {};
        return (
          Number(row.points_mismatch_rows ?? 0) > 0 ||
          Number(row.record_sum_mismatch_rows ?? 0) > 0 ||
          Number(row.goal_diff_extreme_rows ?? 0) > 0
        );
      },
      warnPredicate: (rows) => {
        const row = rows[0] ?? {};
        return (
          Number(row.point_pct_mismatch_rows ?? 0) > 0 ||
          Number(row.goals_for_per_game_mismatch_rows ?? 0) > 0 ||
          Number(row.goals_against_per_game_mismatch_rows ?? 0) > 0
        );
      },
      query: `
        SELECT
          count(*) AS rows,
          count(*) FILTER (
            WHERE wins IS NOT NULL AND ot_losses IS NOT NULL AND points IS NOT NULL
              AND points <> wins * 2 + ot_losses
          ) AS points_mismatch_rows,
          count(*) FILTER (
            WHERE wins IS NOT NULL AND losses IS NOT NULL AND ot_losses IS NOT NULL AND games_played IS NOT NULL
              AND games_played <> wins + losses + ot_losses
          ) AS record_sum_mismatch_rows,
          count(*) FILTER (
            WHERE games_played > 0 AND point_pct IS NOT NULL
              AND abs(point_pct::double precision - (points::double precision / (2.0 * games_played))) > 0.005
          ) AS point_pct_mismatch_rows,
          count(*) FILTER (
            WHERE games_played > 0 AND goals_for_per_game IS NOT NULL
              AND abs(goals_for_per_game - (goals_for::double precision / games_played)) > 0.01
          ) AS goals_for_per_game_mismatch_rows,
          count(*) FILTER (
            WHERE games_played > 0 AND goals_against_per_game IS NOT NULL
              AND abs(goals_against_per_game - (goals_against::double precision / games_played)) > 0.01
          ) AS goals_against_per_game_mismatch_rows,
          count(*) FILTER (
            WHERE goals_for IS NOT NULL AND goals_against IS NOT NULL
              AND abs(goals_for - goals_against) > 300
          ) AS goal_diff_extreme_rows
        FROM public.wgo_team_stats
        WHERE date >= DATE '2023-01-01'
      `,
    },
    {
      name: "wgo_team_stats_rate_and_percentage_bounds_check",
      description: "WGO percentage and per-game/per-60 fields should stay within plausible hockey ranges.",
      warnPredicate: (rows) => {
        const row = rows[0] ?? {};
        return [
          "invalid_percentage_rows",
          "negative_rate_rows",
          "extreme_goals_per_game_rows",
          "extreme_shots_per_game_rows",
        ].some((key) => Number(row[key] ?? 0) > 0);
      },
      query: `
        SELECT
          count(*) AS rows,
          count(*) FILTER (
            WHERE (
              point_pct NOT BETWEEN 0 AND 1
              OR power_play_pct NOT BETWEEN 0 AND 100
              OR penalty_kill_pct NOT BETWEEN 0 AND 100
              OR faceoff_win_pct NOT BETWEEN 0 AND 100
              OR sat_pct NOT BETWEEN 0 AND 100
              OR goals_for_percentage NOT BETWEEN 0 AND 100
              OR save_pct_5v5 NOT BETWEEN 0 AND 100
              OR shooting_pct_5v5 NOT BETWEEN 0 AND 100
            )
          ) AS invalid_percentage_rows,
          count(*) FILTER (
            WHERE (
              goals_for_per_game < 0 OR goals_against_per_game < 0
              OR shots_for_per_game < 0 OR shots_against_per_game < 0
              OR penalties_drawn_per_60 < 0 OR penalties_taken_per_60 < 0
              OR hits_per_60 < 0 OR giveaways_per_60 < 0 OR takeaways_per_60 < 0
            )
          ) AS negative_rate_rows,
          count(*) FILTER (WHERE goals_for_per_game > 8 OR goals_against_per_game > 8) AS extreme_goals_per_game_rows,
          count(*) FILTER (WHERE shots_for_per_game > 60 OR shots_against_per_game > 60) AS extreme_shots_per_game_rows,
          min(point_pct) AS min_point_pct,
          max(point_pct) AS max_point_pct,
          min(power_play_pct) AS min_power_play_pct,
          max(power_play_pct) AS max_power_play_pct,
          min(penalty_kill_pct) AS min_penalty_kill_pct,
          max(penalty_kill_pct) AS max_penalty_kill_pct
        FROM public.wgo_team_stats
        WHERE date >= DATE '2023-01-01'
      `,
    },
    {
      name: "wgo_team_stats_faceoff_identity_check",
      description: "WGO faceoff totals should match won/lost components where all fields are populated.",
      warnPredicate: (rows) => {
        const row = rows[0] ?? {};
        return [
          "total_faceoff_mismatch_rows",
          "d_zone_faceoff_mismatch_rows",
          "o_zone_faceoff_mismatch_rows",
          "neutral_zone_faceoff_mismatch_rows",
        ].some((key) => Number(row[key] ?? 0) > 0);
      },
      query: `
        SELECT
          count(*) AS rows,
          count(*) FILTER (
            WHERE total_faceoffs IS NOT NULL AND faceoffs_won IS NOT NULL AND faceoffs_lost IS NOT NULL
              AND total_faceoffs <> faceoffs_won + faceoffs_lost
          ) AS total_faceoff_mismatch_rows,
          count(*) FILTER (
            WHERE d_zone_fo IS NOT NULL AND d_zone_fow IS NOT NULL AND d_zone_fol IS NOT NULL
              AND d_zone_fo <> d_zone_fow + d_zone_fol
          ) AS d_zone_faceoff_mismatch_rows,
          count(*) FILTER (
            WHERE o_zone_fo IS NOT NULL AND o_zone_fow IS NOT NULL AND o_zone_fol IS NOT NULL
              AND o_zone_fo <> o_zone_fow + o_zone_fol
          ) AS o_zone_faceoff_mismatch_rows,
          count(*) FILTER (
            WHERE neutral_zone_fo IS NOT NULL AND neutral_zone_fow IS NOT NULL AND neutral_zone_fol IS NOT NULL
              AND neutral_zone_fo <> neutral_zone_fow + neutral_zone_fol
          ) AS neutral_zone_faceoff_mismatch_rows
        FROM public.wgo_team_stats
        WHERE date >= DATE '2023-01-01'
      `,
    },
    {
      name: "standings_record_math_check",
      description: "Standings record, points, goal differential, l10, home, and road split fields should be internally consistent.",
      blockerPredicate: (rows) => {
        const row = rows[0] ?? {};
        return (
          Number(row.points_mismatch_rows ?? 0) > 0 ||
          Number(row.record_sum_mismatch_rows ?? 0) > 0 ||
          Number(row.goal_diff_mismatch_rows ?? 0) > 0
        );
      },
      warnPredicate: (rows) => {
        const row = rows[0] ?? {};
        return [
          "point_pctg_mismatch_rows",
          "home_record_sum_mismatch_rows",
          "road_record_sum_mismatch_rows",
          "l10_record_sum_mismatch_rows",
          "home_road_games_mismatch_rows",
        ].some((key) => Number(row[key] ?? 0) > 0);
      },
      query: `
        SELECT
          count(*) AS rows,
          count(*) FILTER (
            WHERE wins IS NOT NULL AND ot_losses IS NOT NULL AND points IS NOT NULL
              AND points <> wins * 2 + ot_losses
          ) AS points_mismatch_rows,
          count(*) FILTER (
            WHERE wins IS NOT NULL AND losses IS NOT NULL AND ot_losses IS NOT NULL AND games_played IS NOT NULL
              AND games_played <> wins + losses + ot_losses
          ) AS record_sum_mismatch_rows,
          count(*) FILTER (
            WHERE goal_for IS NOT NULL AND goal_against IS NOT NULL AND goal_differential IS NOT NULL
              AND goal_differential <> goal_for - goal_against
          ) AS goal_diff_mismatch_rows,
          count(*) FILTER (
            WHERE games_played > 0 AND point_pctg IS NOT NULL
              AND abs(point_pctg::double precision - (points::double precision / (2.0 * games_played))) > 0.005
          ) AS point_pctg_mismatch_rows,
          count(*) FILTER (
            WHERE home_wins IS NOT NULL AND home_losses IS NOT NULL AND home_ot_losses IS NOT NULL AND home_games_played IS NOT NULL
              AND home_games_played <> home_wins + home_losses + home_ot_losses
          ) AS home_record_sum_mismatch_rows,
          count(*) FILTER (
            WHERE road_wins IS NOT NULL AND road_losses IS NOT NULL AND road_ot_losses IS NOT NULL AND road_games_played IS NOT NULL
              AND road_games_played <> road_wins + road_losses + road_ot_losses
          ) AS road_record_sum_mismatch_rows,
          count(*) FILTER (
            WHERE l10_wins IS NOT NULL AND l10_losses IS NOT NULL AND l10_ot_losses IS NOT NULL AND l10_games_played IS NOT NULL
              AND l10_games_played <> l10_wins + l10_losses + l10_ot_losses
          ) AS l10_record_sum_mismatch_rows,
          count(*) FILTER (
            WHERE home_games_played IS NOT NULL AND road_games_played IS NOT NULL AND games_played IS NOT NULL
              AND games_played <> home_games_played + road_games_played
          ) AS home_road_games_mismatch_rows
        FROM public.nhl_standings_details
      `,
    },
    {
      name: "standings_percentage_bounds_check",
      description: "Standings percentage fields, goal-differential rate fields, and sequence ranks should stay within plausible ranges.",
      warnPredicate: (rows) => {
        const row = rows[0] ?? {};
        return (
          Number(row.invalid_percentage_rows ?? 0) > 0 ||
          Number(row.invalid_sequence_rows ?? 0) > 0
        );
      },
      query: `
        SELECT
          count(*) AS rows,
          count(*) FILTER (
            WHERE point_pctg NOT BETWEEN 0 AND 1
              OR win_pctg NOT BETWEEN 0 AND 1
              OR goals_for_pctg NOT BETWEEN 0 AND 10
              OR goal_differential_pctg NOT BETWEEN -10 AND 10
              OR regulation_win_pctg NOT BETWEEN 0 AND 1
              OR regulation_plus_ot_win_pctg NOT BETWEEN 0 AND 1
          ) AS invalid_percentage_rows,
          count(*) FILTER (
            WHERE league_sequence NOT BETWEEN 1 AND 32
              OR conference_sequence NOT BETWEEN 1 AND 16
              OR division_sequence NOT BETWEEN 1 AND 8
              OR wildcard_sequence NOT BETWEEN 0 AND 32
          ) AS invalid_sequence_rows,
          min(point_pctg) AS min_point_pctg,
          max(point_pctg) AS max_point_pctg,
          min(goal_differential_pctg) AS min_goal_differential_pctg,
          max(goal_differential_pctg) AS max_goal_differential_pctg
        FROM public.nhl_standings_details
      `,
    },
  ];

  const checks: WgoStandingsCheck[] = [];

  for (const definition of checkDefinitions) {
    const rows = await queryManagementApi<Record<string, unknown>>(definition.query);
    const isBlocker = definition.blockerPredicate?.(rows) ?? false;
    const isWarning = !isBlocker && (definition.warnPredicate?.(rows) ?? false);

    checks.push({
      name: definition.name,
      description: definition.description,
      rows,
      severity: isBlocker ? "blocker" : isWarning ? "warn" : "pass",
    });
  }

  return checks;
}

async function buildManagementGoalieChecks(): Promise<GoalieCheck[]> {
  const checkDefinitions: Array<{
    name: string;
    description: string;
    blockerPredicate?: (rows: Record<string, unknown>[]) => boolean;
    warnPredicate?: (rows: Record<string, unknown>[]) => boolean;
    query: string;
  }> = [
    {
      name: "goalie_start_probability_bounds_check",
      description: "`goalie_start_projections` probabilities and supporting start-rate fields should stay within valid ranges.",
      blockerPredicate: (rows) => {
        const row = rows[0] ?? {};
        return Number(row.invalid_start_probability_rows ?? 0) > 0;
      },
      warnPredicate: (rows) => {
        const row = rows[0] ?? {};
        return [
          "null_start_probability_rows",
          "invalid_l10_start_pct_rows",
          "invalid_season_start_pct_rows",
          "extreme_projected_gsaa_rows",
        ].some((key) => Number(row[key] ?? 0) > 0);
      },
      query: `
        SELECT
          count(*) AS rows,
          count(*) FILTER (WHERE start_probability IS NULL) AS null_start_probability_rows,
          count(*) FILTER (WHERE start_probability < 0 OR start_probability > 1) AS invalid_start_probability_rows,
          count(*) FILTER (WHERE l10_start_pct IS NOT NULL AND l10_start_pct NOT BETWEEN 0 AND 1) AS invalid_l10_start_pct_rows,
          count(*) FILTER (WHERE season_start_pct IS NOT NULL AND season_start_pct NOT BETWEEN 0 AND 1) AS invalid_season_start_pct_rows,
          count(*) FILTER (WHERE projected_gsaa_per_60 IS NOT NULL AND abs(projected_gsaa_per_60) > 10) AS extreme_projected_gsaa_rows,
          min(projected_gsaa_per_60) AS min_projected_gsaa_per_60,
          max(projected_gsaa_per_60) AS max_projected_gsaa_per_60
        FROM public.goalie_start_projections
      `,
    },
    {
      name: "goalie_start_probability_sum_check",
      description: "Goalie starter probabilities should generally sum to 1 per game/team, and confirmed starters should be unique.",
      warnPredicate: (rows) =>
        rows.some(
          (row) =>
            Number(row.team_groups_with_probability_sum_issue ?? 0) > 0 ||
            Number(row.team_groups_with_multiple_confirmed_goalies ?? 0) > 0 ||
            Number(row.confirmed_goalies_with_probability_below_one ?? 0) > 0
        ),
      query: `
        WITH grouped AS (
          SELECT
            game_id,
            team_id,
            sum(coalesce(start_probability, 0)) AS probability_sum,
            count(*) FILTER (WHERE confirmed_status IS TRUE) AS confirmed_goalies,
            count(*) FILTER (WHERE confirmed_status IS TRUE AND coalesce(start_probability, 0) < 0.99) AS confirmed_probability_below_one
          FROM public.goalie_start_projections
          GROUP BY game_id, team_id
        )
        SELECT
          count(*) AS game_team_groups,
          count(*) FILTER (WHERE probability_sum NOT BETWEEN 0.99 AND 1.01) AS team_groups_with_probability_sum_issue,
          count(*) FILTER (WHERE confirmed_goalies > 1) AS team_groups_with_multiple_confirmed_goalies,
          sum(confirmed_probability_below_one) AS confirmed_goalies_with_probability_below_one,
          min(probability_sum) AS min_probability_sum,
          max(probability_sum) AS max_probability_sum
        FROM grouped
      `,
    },
    {
      name: "goalie_start_schedule_coverage_check",
      description: "Scheduled games in the goalie-projection date range should have goalie candidates for both teams.",
      warnPredicate: (rows) => {
        const row = rows[0] ?? {};
        return Number(row.team_game_sides_missing_goalie_candidates ?? 0) > 0;
      },
      query: `
        WITH game_sides AS (
          SELECT id AS game_id, date, "homeTeamId" AS team_id
          FROM public.games
          WHERE date BETWEEN (SELECT min(game_date) FROM public.goalie_start_projections)
            AND (SELECT max(game_date) FROM public.goalie_start_projections)
          UNION ALL
          SELECT id, date, "awayTeamId"
          FROM public.games
          WHERE date BETWEEN (SELECT min(game_date) FROM public.goalie_start_projections)
            AND (SELECT max(game_date) FROM public.goalie_start_projections)
        ),
        coverage AS (
          SELECT
            gs.game_id,
            gs.team_id,
            count(gp.player_id) AS candidate_rows
          FROM game_sides gs
          LEFT JOIN public.goalie_start_projections gp
            ON gp.game_id = gs.game_id
           AND gp.team_id = gs.team_id
          GROUP BY gs.game_id, gs.team_id
        )
        SELECT
          count(*) AS team_game_sides,
          count(*) FILTER (WHERE candidate_rows = 0) AS team_game_sides_missing_goalie_candidates,
          min(candidate_rows) AS min_candidate_rows,
          max(candidate_rows) AS max_candidate_rows
        FROM coverage
      `,
    },
    {
      name: "wgo_goalie_game_level_semantics_check",
      description: "Recent WGO goalie rows should normally be one goalie-game row when games_played is populated.",
      warnPredicate: (rows) => rows.some((row) => Number(row.rows_with_games_played_gt_1 ?? 0) > 0),
      query: `
        SELECT
          count(*) AS rows,
          count(*) FILTER (WHERE games_played IS NULL) AS null_games_played_rows,
          count(*) FILTER (WHERE games_played > 1) AS rows_with_games_played_gt_1,
          min(games_played) AS min_games_played,
          max(games_played) AS max_games_played
        FROM public.wgo_goalie_stats
        WHERE date >= DATE '2023-01-01'
      `,
    },
    {
      name: "wgo_goalie_value_bounds_check",
      description: "Recent WGO goalie saves, shots, save percentage, GAA, and rest-split fields should stay plausible.",
      warnPredicate: (rows) => {
        const row = rows[0] ?? {};
        return [
          "invalid_save_pct_rows",
          "negative_count_rows",
          "saves_exceed_shots_rows",
          "extreme_gaa_rows",
          "invalid_rest_save_pct_rows",
        ].some((key) => Number(row[key] ?? 0) > 0);
      },
      query: `
        SELECT
          count(*) AS rows,
          count(*) FILTER (WHERE save_pct IS NOT NULL AND save_pct NOT BETWEEN 0 AND 1) AS invalid_save_pct_rows,
          count(*) FILTER (
            WHERE saves < 0 OR goals_against < 0 OR shots_against < 0 OR time_on_ice < 0
          ) AS negative_count_rows,
          count(*) FILTER (
            WHERE saves IS NOT NULL AND shots_against IS NOT NULL AND saves > shots_against
          ) AS saves_exceed_shots_rows,
          count(*) FILTER (WHERE goals_against_avg IS NOT NULL AND goals_against_avg > 15) AS extreme_gaa_rows,
          count(*) FILTER (
            WHERE save_pct_days_rest_0 NOT BETWEEN 0 AND 1
              OR save_pct_days_rest_1 NOT BETWEEN 0 AND 1
              OR save_pct_days_rest_2 NOT BETWEEN 0 AND 1
              OR save_pct_days_rest_3 NOT BETWEEN 0 AND 1
              OR save_pct_days_rest_4_plus NOT BETWEEN 0 AND 1
          ) AS invalid_rest_save_pct_rows,
          min(save_pct) AS min_save_pct,
          max(save_pct) AS max_save_pct,
          min(goals_against_avg) AS min_goals_against_avg,
          max(goals_against_avg) AS max_goals_against_avg
        FROM public.wgo_goalie_stats
        WHERE date >= DATE '2023-01-01'
      `,
    },
    {
      name: "wgo_goalie_totals_as_of_safety_check",
      description: "WGO goalie totals are season-level totals with updated_at but no stat-date key, so they are not historical-training-safe without a snapshot rule.",
      warnPredicate: (rows) => Number(rows[0]?.rows ?? 0) > 0,
      query: `
        SELECT
          count(*) AS rows,
          min(updated_at) AS min_updated_at,
          max(updated_at) AS max_updated_at,
          count(*) FILTER (WHERE updated_at IS NULL) AS null_updated_at_rows
        FROM public.wgo_goalie_stats_totals
      `,
    },
    {
      name: "nst_goalie_duplicate_key_check",
      description: "NST goalie tables should have one row per source/player/date.",
      blockerPredicate: (rows) => rows.some((row) => Number(row.duplicate_key_rows ?? 0) > 0),
      query: `
        WITH grouped AS (
          SELECT 'nst_gamelog_goalie_all_counts' AS source_name, player_id, date_scraped, count(*) AS rows FROM public.nst_gamelog_goalie_all_counts GROUP BY player_id, date_scraped
          UNION ALL SELECT 'nst_gamelog_goalie_all_rates', player_id, date_scraped, count(*) FROM public.nst_gamelog_goalie_all_rates GROUP BY player_id, date_scraped
          UNION ALL SELECT 'nst_gamelog_goalie_5v5_counts', player_id, date_scraped, count(*) FROM public.nst_gamelog_goalie_5v5_counts GROUP BY player_id, date_scraped
          UNION ALL SELECT 'nst_gamelog_goalie_5v5_rates', player_id, date_scraped, count(*) FROM public.nst_gamelog_goalie_5v5_rates GROUP BY player_id, date_scraped
          UNION ALL SELECT 'nst_gamelog_goalie_ev_counts', player_id, date_scraped, count(*) FROM public.nst_gamelog_goalie_ev_counts GROUP BY player_id, date_scraped
          UNION ALL SELECT 'nst_gamelog_goalie_ev_rates', player_id, date_scraped, count(*) FROM public.nst_gamelog_goalie_ev_rates GROUP BY player_id, date_scraped
          UNION ALL SELECT 'nst_gamelog_goalie_pk_counts', player_id, date_scraped, count(*) FROM public.nst_gamelog_goalie_pk_counts GROUP BY player_id, date_scraped
          UNION ALL SELECT 'nst_gamelog_goalie_pk_rates', player_id, date_scraped, count(*) FROM public.nst_gamelog_goalie_pk_rates GROUP BY player_id, date_scraped
          UNION ALL SELECT 'nst_gamelog_goalie_pp_counts', player_id, date_scraped, count(*) FROM public.nst_gamelog_goalie_pp_counts GROUP BY player_id, date_scraped
          UNION ALL SELECT 'nst_gamelog_goalie_pp_rates', player_id, date_scraped, count(*) FROM public.nst_gamelog_goalie_pp_rates GROUP BY player_id, date_scraped
        )
        SELECT
          source_name,
          count(*) FILTER (WHERE rows > 1) AS duplicate_keys,
          coalesce(sum(rows - 1) FILTER (WHERE rows > 1), 0) AS duplicate_key_rows
        FROM grouped
        GROUP BY source_name
        ORDER BY source_name
      `,
    },
    {
      name: "nst_goalie_date_freshness_check",
      description: "NST goalie source latest dates should be explicit so stale goalie quality inputs are not treated as current.",
      warnPredicate: (rows) => rows.some((row) => Number(row.days_since_latest ?? 0) > 10),
      query: `
        WITH rows AS (
          SELECT 'nst_gamelog_goalie_all_counts' AS source_name, player_id, date_scraped FROM public.nst_gamelog_goalie_all_counts
          UNION ALL SELECT 'nst_gamelog_goalie_all_rates', player_id, date_scraped FROM public.nst_gamelog_goalie_all_rates
          UNION ALL SELECT 'nst_gamelog_goalie_5v5_counts', player_id, date_scraped FROM public.nst_gamelog_goalie_5v5_counts
          UNION ALL SELECT 'nst_gamelog_goalie_5v5_rates', player_id, date_scraped FROM public.nst_gamelog_goalie_5v5_rates
          UNION ALL SELECT 'nst_gamelog_goalie_ev_counts', player_id, date_scraped FROM public.nst_gamelog_goalie_ev_counts
          UNION ALL SELECT 'nst_gamelog_goalie_ev_rates', player_id, date_scraped FROM public.nst_gamelog_goalie_ev_rates
          UNION ALL SELECT 'nst_gamelog_goalie_pk_counts', player_id, date_scraped FROM public.nst_gamelog_goalie_pk_counts
          UNION ALL SELECT 'nst_gamelog_goalie_pk_rates', player_id, date_scraped FROM public.nst_gamelog_goalie_pk_rates
          UNION ALL SELECT 'nst_gamelog_goalie_pp_counts', player_id, date_scraped FROM public.nst_gamelog_goalie_pp_counts
          UNION ALL SELECT 'nst_gamelog_goalie_pp_rates', player_id, date_scraped FROM public.nst_gamelog_goalie_pp_rates
        ),
        summarized AS (
          SELECT source_name, min(date_scraped) AS min_date, max(date_scraped) AS max_date, count(DISTINCT date_scraped) AS distinct_dates
          FROM rows
          GROUP BY source_name
        )
        SELECT
          s.source_name,
          s.min_date,
          s.max_date,
          s.distinct_dates,
          current_date - s.max_date AS days_since_latest,
          count(DISTINCT r.player_id) FILTER (WHERE r.date_scraped = s.max_date) AS latest_date_goalie_count
        FROM summarized s
        JOIN rows r ON r.source_name = s.source_name
        GROUP BY s.source_name, s.min_date, s.max_date, s.distinct_dates
        ORDER BY s.source_name
      `,
    },
    {
      name: "nst_goalie_counts_identity_check",
      description: "NST goalie count rows should have nonnegative counts and saves/goals should not exceed shots against.",
      warnPredicate: (rows) =>
        rows.some(
          (row) =>
            Number(row.negative_count_rows ?? 0) > 0 ||
            Number(row.saves_exceed_shots_rows ?? 0) > 0 ||
            Number(row.goals_exceed_shots_rows ?? 0) > 0
        ),
      query: `
        WITH rows AS (
          SELECT 'nst_gamelog_goalie_all_counts' AS source_name, shots_against, saves, goals_against, xg_against, hd_shots_against, hd_saves, md_shots_against, md_saves FROM public.nst_gamelog_goalie_all_counts
          UNION ALL SELECT 'nst_gamelog_goalie_5v5_counts', shots_against, saves, goals_against, xg_against, hd_shots_against, hd_saves, md_shots_against, md_saves FROM public.nst_gamelog_goalie_5v5_counts
          UNION ALL SELECT 'nst_gamelog_goalie_ev_counts', shots_against, saves, goals_against, xg_against, hd_shots_against, hd_saves, md_shots_against, md_saves FROM public.nst_gamelog_goalie_ev_counts
          UNION ALL SELECT 'nst_gamelog_goalie_pk_counts', shots_against, saves, goals_against, xg_against, hd_shots_against, hd_saves, md_shots_against, md_saves FROM public.nst_gamelog_goalie_pk_counts
          UNION ALL SELECT 'nst_gamelog_goalie_pp_counts', shots_against, saves, goals_against, xg_against, hd_shots_against, hd_saves, md_shots_against, md_saves FROM public.nst_gamelog_goalie_pp_counts
        )
        SELECT
          source_name,
          count(*) AS rows,
          count(*) FILTER (
            WHERE shots_against < 0 OR saves < 0 OR goals_against < 0 OR xg_against < 0
              OR hd_shots_against < 0 OR hd_saves < 0 OR md_shots_against < 0 OR md_saves < 0
          ) AS negative_count_rows,
          count(*) FILTER (WHERE saves IS NOT NULL AND shots_against IS NOT NULL AND saves > shots_against) AS saves_exceed_shots_rows,
          count(*) FILTER (WHERE goals_against IS NOT NULL AND shots_against IS NOT NULL AND goals_against > shots_against) AS goals_exceed_shots_rows
        FROM rows
        GROUP BY source_name
        ORDER BY source_name
      `,
    },
    {
      name: "nst_goalie_rate_bounds_check",
      description: "NST goalie rate rows should stay nonnegative and within plausible hockey ranges.",
      warnPredicate: (rows) =>
        rows.some(
          (row) =>
            Number(row.negative_rate_rows ?? 0) > 0 ||
            Number(row.invalid_save_pct_rows ?? 0) > 0 ||
            Number(row.extreme_rate_rows ?? 0) > 0
        ),
      query: `
        WITH rows AS (
          SELECT 'nst_gamelog_goalie_all_rates' AS source_name, shots_against_per_60, saves_per_60, sv_percentage, gaa, gsaa_per_60, xg_against_per_60 FROM public.nst_gamelog_goalie_all_rates
          UNION ALL SELECT 'nst_gamelog_goalie_5v5_rates', shots_against_per_60, saves_per_60, sv_percentage, gaa, gsaa_per_60, xg_against_per_60 FROM public.nst_gamelog_goalie_5v5_rates
          UNION ALL SELECT 'nst_gamelog_goalie_ev_rates', shots_against_per_60, saves_per_60, sv_percentage, gaa, gsaa_per_60, xg_against_per_60 FROM public.nst_gamelog_goalie_ev_rates
          UNION ALL SELECT 'nst_gamelog_goalie_pk_rates', shots_against_per_60, saves_per_60, sv_percentage, gaa, gsaa_per_60, xg_against_per_60 FROM public.nst_gamelog_goalie_pk_rates
          UNION ALL SELECT 'nst_gamelog_goalie_pp_rates', shots_against_per_60, saves_per_60, sv_percentage, gaa, gsaa_per_60, xg_against_per_60 FROM public.nst_gamelog_goalie_pp_rates
        )
        SELECT
          source_name,
          count(*) AS rows,
          count(*) FILTER (
            WHERE shots_against_per_60 < 0 OR saves_per_60 < 0 OR xg_against_per_60 < 0
          ) AS negative_rate_rows,
          count(*) FILTER (WHERE sv_percentage IS NOT NULL AND sv_percentage NOT BETWEEN 0 AND 100) AS invalid_save_pct_rows,
          count(*) FILTER (
            WHERE shots_against_per_60 > 120 OR saves_per_60 > 120 OR gaa > 20 OR abs(gsaa_per_60) > 20 OR xg_against_per_60 > 20
          ) AS extreme_rate_rows,
          min(sv_percentage) AS min_sv_percentage,
          max(sv_percentage) AS max_sv_percentage
        FROM rows
        GROUP BY source_name
        ORDER BY source_name
      `,
    },
  ];

  const checks: GoalieCheck[] = [];

  for (const definition of checkDefinitions) {
    const rows = await queryManagementApi<Record<string, unknown>>(definition.query);
    const isBlocker = definition.blockerPredicate?.(rows) ?? false;
    const isWarning = !isBlocker && (definition.warnPredicate?.(rows) ?? false);

    checks.push({
      name: definition.name,
      description: definition.description,
      rows,
      severity: isBlocker ? "blocker" : isWarning ? "warn" : "pass",
    });
  }

  return checks;
}

async function buildManagementLineupPlayerChecks(): Promise<LineupPlayerCheck[]> {
  const checkDefinitions: Array<{
    name: string;
    description: string;
    blockerPredicate?: (rows: Record<string, unknown>[]) => boolean;
    warnPredicate?: (rows: Record<string, unknown>[]) => boolean;
    query: string;
  }> = [
    {
      name: "line_combinations_game_side_coverage_check",
      description: "`lineCombinations` should be understood as game/team context and should not be assumed complete for all historical training rows.",
      warnPredicate: (rows) => {
        const row = rows[0] ?? {};
        return Number(row.team_game_sides_missing_line_combinations ?? 0) > 0;
      },
      query: `
        WITH game_sides AS (
          SELECT id AS game_id, date, "homeTeamId" AS team_id
          FROM public.games
          WHERE date BETWEEN DATE '2025-10-01' AND current_date + INTERVAL '14 days'
          UNION ALL
          SELECT id, date, "awayTeamId"
          FROM public.games
          WHERE date BETWEEN DATE '2025-10-01' AND current_date + INTERVAL '14 days'
        ),
        coverage AS (
          SELECT
            gs.game_id,
            gs.team_id,
            count(lc."gameId") AS lineup_rows
          FROM game_sides gs
          LEFT JOIN public."lineCombinations" lc
            ON lc."gameId" = gs.game_id
           AND lc."teamId" = gs.team_id
          GROUP BY gs.game_id, gs.team_id
        )
        SELECT
          count(*) AS team_game_sides,
          count(*) FILTER (WHERE lineup_rows = 0) AS team_game_sides_missing_line_combinations,
          min(lineup_rows) AS min_lineup_rows,
          max(lineup_rows) AS max_lineup_rows
        FROM coverage
      `,
    },
    {
      name: "line_source_freshness_and_status_check",
      description: "Prospective line-source tables should be treated as sparse/current-context inputs until historical coverage is proven.",
      warnPredicate: (rows) =>
        rows.some(
          (row) =>
            Number(row.observed_or_accepted_rows ?? 0) === 0 ||
            Number(row.days_since_latest_observed_at ?? 0) > 7 ||
            Number(row.null_game_id_rows ?? 0) > 0
        ),
      query: `
        WITH rows AS (
          SELECT 'lines_nhl' AS source_name, status, snapshot_date, observed_at, game_id, team_id FROM public.lines_nhl
          UNION ALL
          SELECT 'lines_dfo', status, snapshot_date, observed_at, game_id, team_id FROM public.lines_dfo
          UNION ALL
          SELECT 'lines_gdl', status, snapshot_date, observed_at, game_id, team_id FROM public.lines_gdl
          UNION ALL
          SELECT 'lines_ccc', status, snapshot_date, observed_at, game_id, team_id FROM public.lines_ccc WHERE nhl_filter_status = 'accepted'
        )
        SELECT
          source_name,
          count(*) AS rows,
          count(*) FILTER (WHERE status = 'observed') AS observed_or_accepted_rows,
          min(snapshot_date) AS min_snapshot_date,
          max(snapshot_date) AS max_snapshot_date,
          max(observed_at) AS max_observed_at,
          current_date - max(observed_at)::date AS days_since_latest_observed_at,
          count(*) FILTER (WHERE game_id IS NULL) AS null_game_id_rows,
          count(*) FILTER (WHERE team_id IS NULL) AS null_team_id_rows
        FROM rows
        GROUP BY source_name
        ORDER BY source_name
      `,
    },
    {
      name: "forge_projection_context_coverage_check",
      description: "FORGE player, goalie, and team projection tables are optional context and should be gated by freshness and game coverage.",
      warnPredicate: (rows) =>
        rows.some(
          (row) =>
            Number(row.rows ?? 0) === 0 ||
            Number(row.days_since_latest_as_of_date ?? 0) > 7 ||
            Number(row.null_game_id_rows ?? 0) > 0
        ),
      query: `
        WITH rows AS (
          SELECT 'forge_player_projections' AS source_name, as_of_date, game_id, team_id, horizon_games FROM public.forge_player_projections
          UNION ALL
          SELECT 'forge_goalie_projections', as_of_date, game_id, team_id, horizon_games FROM public.forge_goalie_projections
          UNION ALL
          SELECT 'forge_team_projections', as_of_date, game_id, team_id, horizon_games FROM public.forge_team_projections
        )
        SELECT
          source_name,
          count(*) AS rows,
          count(DISTINCT game_id) AS distinct_games,
          min(as_of_date) AS min_as_of_date,
          max(as_of_date) AS max_as_of_date,
          current_date - max(as_of_date) AS days_since_latest_as_of_date,
          min(horizon_games) AS min_horizon_games,
          max(horizon_games) AS max_horizon_games,
          count(*) FILTER (WHERE game_id IS NULL) AS null_game_id_rows,
          count(*) FILTER (WHERE team_id IS NULL) AS null_team_id_rows
        FROM rows
        GROUP BY source_name
        ORDER BY source_name
      `,
    },
    {
      name: "forge_roster_events_coverage_check",
      description: "`forge_roster_events` is optional availability/news context and should not be required when empty.",
      warnPredicate: (rows) => Number(rows[0]?.rows ?? 0) === 0,
      query: `
        SELECT
          count(*) AS rows,
          min(effective_from) AS min_effective_from,
          max(effective_from) AS max_effective_from,
          count(*) FILTER (WHERE event_type IS NULL) AS null_event_type_rows,
          count(*) FILTER (WHERE confidence IS NULL) AS null_confidence_rows
        FROM public.forge_roster_events
      `,
    },
  ];

  const checks: LineupPlayerCheck[] = [];

  for (const definition of checkDefinitions) {
    const rows = await queryManagementApi<Record<string, unknown>>(definition.query);
    const isBlocker = definition.blockerPredicate?.(rows) ?? false;
    const isWarning = !isBlocker && (definition.warnPredicate?.(rows) ?? false);

    checks.push({
      name: definition.name,
      description: definition.description,
      rows,
      severity: isBlocker ? "blocker" : isWarning ? "warn" : "pass",
    });
  }

  return checks;
}

async function buildManagementStorageChecks(): Promise<StorageCheck[]> {
  const checkDefinitions: Array<{
    name: string;
    description: string;
    blockerPredicate?: (rows: Record<string, unknown>[]) => boolean;
    warnPredicate?: (rows: Record<string, unknown>[]) => boolean;
    query: string;
  }> = [
    {
      name: "prediction_output_history_contract_check",
      description:
        "`game_prediction_outputs` and `player_prediction_outputs` are suitable as latest/serving rows only if they cannot preserve multiple same-day same-model predictions without an additional history key.",
      warnPredicate: (rows) =>
        rows.some(
          (row) =>
            row.table_name === "game_prediction_outputs" &&
            row.pk_includes_computed_at !== true &&
            row.has_prediction_id !== true
        ),
      query: `
        WITH targets(table_name) AS (
          VALUES ('game_prediction_outputs'), ('player_prediction_outputs')
        ),
        pk_cols AS (
          SELECT
            c.relname AS table_name,
            array_agg(a.attname ORDER BY array_position(i.indkey, a.attnum)) AS pk_columns
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          JOIN pg_index i ON i.indrelid = c.oid AND i.indisprimary
          JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(i.indkey)
          WHERE n.nspname = 'public'
            AND c.relname IN ('game_prediction_outputs', 'player_prediction_outputs')
          GROUP BY c.relname
        ),
        cols AS (
          SELECT
            table_name,
            array_agg(column_name ORDER BY ordinal_position) AS columns
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name IN ('game_prediction_outputs', 'player_prediction_outputs')
          GROUP BY table_name
        ),
        counts AS (
          SELECT 'game_prediction_outputs' AS table_name, count(*) AS rows FROM public.game_prediction_outputs
          UNION ALL
          SELECT 'player_prediction_outputs', count(*) FROM public.player_prediction_outputs
        )
        SELECT
          t.table_name,
          coalesce(pk.pk_columns, ARRAY[]::text[]) AS pk_columns,
          coalesce(cols.columns, ARRAY[]::text[]) AS columns,
          coalesce(counts.rows, 0) AS rows,
          'computed_at' = ANY(coalesce(pk.pk_columns, ARRAY[]::text[])) AS pk_includes_computed_at,
          'prediction_id' = ANY(coalesce(cols.columns, ARRAY[]::text[])) AS has_prediction_id,
          'feature_snapshot_id' = ANY(coalesce(cols.columns, ARRAY[]::text[])) AS has_feature_snapshot_id,
          'run_id' = ANY(coalesce(cols.columns, ARRAY[]::text[])) AS has_run_id
        FROM targets t
        LEFT JOIN pk_cols pk USING (table_name)
        LEFT JOIN cols USING (table_name)
        LEFT JOIN counts USING (table_name)
        ORDER BY t.table_name
      `,
    },
    {
      name: "prediction_output_payload_contract_check",
      description:
        "Prediction output tables should expose probability/output fields plus JSON payloads for components, provenance, metadata, and timestamps for reproducibility.",
      warnPredicate: (rows) =>
        rows.some(
          (row) =>
            Number(row.missing_required_columns ?? 0) > 0 ||
            Number(row.null_payload_rows ?? 0) > 0 ||
            Number(row.invalid_probability_rows ?? 0) > 0
        ),
      query: `
        WITH required_columns AS (
          SELECT 'game_prediction_outputs' AS table_name, unnest(ARRAY[
            'snapshot_date', 'game_id', 'model_name', 'model_version', 'prediction_scope',
            'home_team_id', 'away_team_id', 'components', 'provenance', 'metadata',
            'computed_at', 'updated_at'
          ]) AS column_name
          UNION ALL
          SELECT 'player_prediction_outputs', unnest(ARRAY[
            'snapshot_date', 'game_id', 'player_id', 'model_name', 'model_version',
            'prediction_scope', 'metric_key', 'components', 'provenance', 'metadata',
            'computed_at', 'updated_at'
          ])
        ),
        missing AS (
          SELECT rc.table_name, count(*) AS missing_required_columns
          FROM required_columns rc
          LEFT JOIN information_schema.columns c
            ON c.table_schema = 'public'
           AND c.table_name = rc.table_name
           AND c.column_name = rc.column_name
          WHERE c.column_name IS NULL
          GROUP BY rc.table_name
        ),
        payloads AS (
          SELECT
            'game_prediction_outputs' AS table_name,
            count(*) AS rows,
            count(*) FILTER (WHERE components IS NULL OR provenance IS NULL OR metadata IS NULL) AS null_payload_rows,
            count(*) FILTER (
              WHERE (home_win_probability IS NOT NULL AND home_win_probability NOT BETWEEN 0 AND 1)
                 OR (away_win_probability IS NOT NULL AND away_win_probability NOT BETWEEN 0 AND 1)
                 OR (
                   home_win_probability IS NOT NULL
                   AND away_win_probability IS NOT NULL
                   AND abs((home_win_probability + away_win_probability) - 1) > 0.05
                 )
            ) AS invalid_probability_rows
          FROM public.game_prediction_outputs
          UNION ALL
          SELECT
            'player_prediction_outputs',
            count(*),
            count(*) FILTER (WHERE components IS NULL OR provenance IS NULL OR metadata IS NULL),
            count(*) FILTER (WHERE probability_over IS NOT NULL AND probability_over NOT BETWEEN 0 AND 1)
          FROM public.player_prediction_outputs
        )
        SELECT
          p.table_name,
          p.rows,
          coalesce(m.missing_required_columns, 0) AS missing_required_columns,
          p.null_payload_rows,
          p.invalid_probability_rows
        FROM payloads p
        LEFT JOIN missing m USING (table_name)
        ORDER BY p.table_name
      `,
    },
    {
      name: "forge_runs_game_model_metadata_fit_check",
      description:
        "`forge_runs` can carry run metadata, status, git SHA, and coarse metrics, but game prediction metrics still need explicit model/version/feature-set segmentation if metrics are not populated with that contract.",
      warnPredicate: (rows) => {
        const row = rows[0] ?? {};
        return (
          Number(row.rows ?? 0) === 0 ||
          Number(row.days_since_latest_as_of_date ?? 0) > 7 ||
          Number(row.empty_metrics_rows ?? 0) > 0
        );
      },
      query: `
        SELECT
          count(*) AS rows,
          min(as_of_date) AS min_as_of_date,
          max(as_of_date) AS max_as_of_date,
          current_date - max(as_of_date) AS days_since_latest_as_of_date,
          count(*) FILTER (WHERE status = 'succeeded') AS succeeded_rows,
          count(*) FILTER (WHERE status = 'failed') AS failed_rows,
          count(*) FILTER (WHERE metrics = '{}'::jsonb) AS empty_metrics_rows,
          count(*) FILTER (WHERE git_sha IS NULL) AS null_git_sha_rows
        FROM public.forge_runs
      `,
    },
    {
      name: "source_provenance_snapshots_freshness_contract_check",
      description:
        "`source_provenance_snapshots` has the right freshness/provenance shape, but model use depends on current, non-expired, source-specific coverage.",
      warnPredicate: (rows) => {
        const row = rows[0] ?? {};
        return (
          Number(row.rows ?? 0) === 0 ||
          Number(row.expired_freshness_rows ?? 0) > 0 ||
          Number(row.null_freshness_rows ?? 0) > 0 ||
          Number(row.distinct_source_names ?? 0) < 4
        );
      },
      query: `
        SELECT
          count(*) AS rows,
          count(DISTINCT source_name) AS distinct_source_names,
          min(observed_at) AS min_observed_at,
          max(observed_at) AS max_observed_at,
          max(freshness_expires_at) AS max_freshness_expires_at,
          count(*) FILTER (WHERE freshness_expires_at IS NULL) AS null_freshness_rows,
          count(*) FILTER (WHERE freshness_expires_at IS NOT NULL AND freshness_expires_at < now()) AS expired_freshness_rows,
          count(*) FILTER (WHERE status <> 'observed') AS non_observed_rows,
          count(*) FILTER (WHERE payload = '{}'::jsonb) AS empty_payload_rows
        FROM public.source_provenance_snapshots
      `,
    },
  ];

  const checks: StorageCheck[] = [];

  for (const definition of checkDefinitions) {
    const rows = await queryManagementApi<Record<string, unknown>>(definition.query);
    const isBlocker = definition.blockerPredicate?.(rows) ?? false;
    const isWarning = !isBlocker && (definition.warnPredicate?.(rows) ?? false);

    checks.push({
      name: definition.name,
      description: definition.description,
      rows,
      severity: isBlocker ? "blocker" : isWarning ? "warn" : "pass",
    });
  }

  return checks;
}

async function buildManagementDataQualityChecks(): Promise<DataQualityCheck[]> {
  const checkDefinitions: Array<{
    name: string;
    description: string;
    blockerPredicate?: (rows: Record<string, unknown>[]) => boolean;
    warnPredicate?: (rows: Record<string, unknown>[]) => boolean;
    query: string;
  }> = [
    {
      name: "recent_games_required_fields_check",
      description:
        "Recent and near-future schedule rows should have usable home/away teams, season/date/start time, and no duplicate natural matchups.",
      warnPredicate: (rows) => {
        const row = rows[0] ?? {};
        return (
          Number(row.rows ?? 0) === 0 ||
          Number(row.null_required_rows ?? 0) > 0 ||
          Number(row.home_equals_away_rows ?? 0) > 0 ||
          Number(row.missing_home_team_rows ?? 0) > 0 ||
          Number(row.missing_away_team_rows ?? 0) > 0 ||
          Number(row.duplicate_natural_key_groups ?? 0) > 0
        );
      },
      query: `
        WITH recent_games AS (
          SELECT *
          FROM public.games
          WHERE date BETWEEN DATE '2025-10-01' AND current_date + INTERVAL '14 days'
        ),
        natural_dupes AS (
          SELECT date, "homeTeamId", "awayTeamId", count(*) AS rows
          FROM recent_games
          GROUP BY date, "homeTeamId", "awayTeamId"
          HAVING count(*) > 1
        )
        SELECT
          count(*) AS rows,
          min(date) AS min_date,
          max(date) AS max_date,
          count(*) FILTER (
            WHERE g.id IS NULL OR g.date IS NULL OR g."seasonId" IS NULL OR g."startTime" IS NULL
              OR g."homeTeamId" IS NULL OR g."awayTeamId" IS NULL
          ) AS null_required_rows,
          count(*) FILTER (WHERE g."homeTeamId" = g."awayTeamId") AS home_equals_away_rows,
          count(*) FILTER (WHERE home.id IS NULL) AS missing_home_team_rows,
          count(*) FILTER (WHERE away.id IS NULL) AS missing_away_team_rows,
          (SELECT count(*) FROM natural_dupes) AS duplicate_natural_key_groups
        FROM recent_games g
        LEFT JOIN public.teams home ON home.id = g."homeTeamId"
        LEFT JOIN public.teams away ON away.id = g."awayTeamId"
      `,
    },
    {
      name: "planned_source_duplicate_key_check",
      description:
        "Representative natural keys should not contain duplicate groups that would make as-of joins ambiguous.",
      warnPredicate: (rows) =>
        rows.some(
          (row) =>
            Number(row.duplicate_key_groups ?? 0) > 0 ||
            Number(row.duplicate_rows_above_one_per_key ?? 0) > 0
        ),
      query: `
        WITH duplicate_groups AS (
          SELECT 'team_power_ratings_daily' AS source_name, count(*) AS duplicate_key_groups, coalesce(sum(rows - 1), 0) AS duplicate_rows_above_one_per_key
          FROM (
            SELECT date, team_abbreviation, count(*) AS rows
            FROM public.team_power_ratings_daily
            GROUP BY date, team_abbreviation
            HAVING count(*) > 1
          ) d
          UNION ALL
          SELECT 'wgo_team_stats', count(*), coalesce(sum(rows - 1), 0)
          FROM (
            SELECT date, team_id, game_id, count(*) AS rows
            FROM public.wgo_team_stats
            WHERE date >= DATE '2025-10-01'
            GROUP BY date, team_id, game_id
            HAVING count(*) > 1
          ) d
          UNION ALL
          SELECT 'nhl_standings_details', count(*), coalesce(sum(rows - 1), 0)
          FROM (
            SELECT season_id, date, team_abbrev, count(*) AS rows
            FROM public.nhl_standings_details
            GROUP BY season_id, date, team_abbrev
            HAVING count(*) > 1
          ) d
          UNION ALL
          SELECT 'goalie_start_projections', count(*), coalesce(sum(rows - 1), 0)
          FROM (
            SELECT game_id, player_id, count(*) AS rows
            FROM public.goalie_start_projections
            GROUP BY game_id, player_id
            HAVING count(*) > 1
          ) d
          UNION ALL
          SELECT 'nst_team_gamelogs_as_counts', count(*), coalesce(sum(rows - 1), 0)
          FROM (
            SELECT team_abbreviation, date, count(*) AS rows
            FROM public.nst_team_gamelogs_as_counts
            GROUP BY team_abbreviation, date
            HAVING count(*) > 1
          ) d
          UNION ALL
          SELECT 'nst_team_gamelogs_as_rates', count(*), coalesce(sum(rows - 1), 0)
          FROM (
            SELECT team_abbreviation, date, count(*) AS rows
            FROM public.nst_team_gamelogs_as_rates
            GROUP BY team_abbreviation, date
            HAVING count(*) > 1
          ) d
          UNION ALL
          SELECT 'lineCombinations', count(*), coalesce(sum(rows - 1), 0)
          FROM (
            SELECT "gameId", "teamId", count(*) AS rows
            FROM public."lineCombinations"
            GROUP BY "gameId", "teamId"
            HAVING count(*) > 1
          ) d
        )
        SELECT *
        FROM duplicate_groups
        ORDER BY source_name
      `,
    },
    {
      name: "core_recent_value_bounds_check",
      description:
        "Core recent feature tables should not contain null identity fields, impossible probabilities, negative impossible counts/rates, or extreme values that need clipping.",
      warnPredicate: (rows) =>
        rows.some(
          (row) =>
            Number(row.rows ?? 0) === 0 ||
            Number(row.null_identity_rows ?? 0) > 0 ||
            Number(row.invalid_probability_rows ?? 0) > 0 ||
            Number(row.negative_value_rows ?? 0) > 0 ||
            Number(row.extreme_value_rows ?? 0) > 0
        ),
      query: `
        SELECT
          'team_power_ratings_daily' AS source_name,
          count(*) AS rows,
          count(*) FILTER (WHERE team_abbreviation IS NULL OR date IS NULL) AS null_identity_rows,
          0 AS invalid_probability_rows,
          count(*) FILTER (
            WHERE xgf60 < 0 OR xga60 < 0 OR gf60 < 0 OR ga60 < 0 OR sf60 < 0 OR sa60 < 0 OR pace60 < 0
          ) AS negative_value_rows,
          count(*) FILTER (
            WHERE xgf60 > 10 OR xga60 > 10 OR gf60 > 10 OR ga60 > 10 OR sf60 > 80 OR sa60 > 80 OR pace60 > 120
          ) AS extreme_value_rows
        FROM public.team_power_ratings_daily
        WHERE date >= DATE '2025-10-01'
        UNION ALL
        SELECT
          'wgo_team_stats',
          count(*),
          count(*) FILTER (WHERE date IS NULL OR team_id IS NULL),
          count(*) FILTER (
            WHERE point_pct NOT BETWEEN 0 AND 1
               OR goals_for_percentage NOT BETWEEN 0 AND 100
               OR power_play_pct NOT BETWEEN 0 AND 100
               OR penalty_kill_pct NOT BETWEEN 0 AND 100
               OR faceoff_win_pct NOT BETWEEN 0 AND 100
          ),
          count(*) FILTER (
            WHERE games_played < 0 OR goals_for < 0 OR goals_against < 0 OR shots_for_per_game < 0 OR shots_against_per_game < 0
          ),
          count(*) FILTER (
            WHERE goals_for_per_game > 8 OR goals_against_per_game > 8 OR shots_for_per_game > 80 OR shots_against_per_game > 80
          )
        FROM public.wgo_team_stats
        WHERE date >= DATE '2025-10-01'
        UNION ALL
        SELECT
          'nhl_standings_details',
          count(*),
          count(*) FILTER (WHERE season_id IS NULL OR date IS NULL OR team_abbrev IS NULL),
          count(*) FILTER (
            WHERE point_pctg NOT BETWEEN 0 AND 1
               OR win_pctg NOT BETWEEN 0 AND 1
               OR regulation_win_pctg NOT BETWEEN 0 AND 1
               OR regulation_plus_ot_win_pctg NOT BETWEEN 0 AND 1
          ),
          count(*) FILTER (
            WHERE games_played < 0 OR wins < 0 OR losses < 0 OR ot_losses < 0 OR goal_for < 0 OR goal_against < 0
          ),
          count(*) FILTER (
            WHERE goal_differential IS NOT NULL
              AND goal_for IS NOT NULL
              AND goal_against IS NOT NULL
              AND goal_differential <> goal_for - goal_against
          )
        FROM public.nhl_standings_details
        WHERE date >= DATE '2025-10-01'
        UNION ALL
        SELECT
          'goalie_start_projections',
          count(*),
          count(*) FILTER (WHERE game_id IS NULL OR player_id IS NULL OR team_id IS NULL OR game_date IS NULL),
          count(*) FILTER (
            WHERE start_probability IS NOT NULL AND start_probability NOT BETWEEN 0 AND 1
          ),
          count(*) FILTER (
            WHERE games_played < 0 OR l10_start_pct < 0 OR season_start_pct < 0
          ),
          count(*) FILTER (
            WHERE projected_gsaa_per_60 IS NOT NULL AND abs(projected_gsaa_per_60) > 10
          )
        FROM public.goalie_start_projections
        WHERE game_date >= DATE '2025-10-01'
      `,
    },
    {
      name: "nst_team_recent_row_quality_check",
      description:
        "NST team gamelog rows should have nonnegative counts/rates, percent-scale percentages, and one-game rows for rolling-window usage.",
      warnPredicate: (rows) =>
        rows.some(
          (row) =>
            Number(row.rows ?? 0) === 0 ||
            Number(row.null_identity_rows ?? 0) > 0 ||
            Number(row.negative_value_rows ?? 0) > 0 ||
            Number(row.invalid_percentage_rows ?? 0) > 0 ||
            Number(row.non_one_game_rows ?? 0) > 0
        ),
      query: `
        WITH rows AS (
          SELECT 'nst_team_gamelogs_as_counts' AS source_name, team_abbreviation, date, gp, cf, ca, sf, sa, gf, ga, xgf, xga, cf_pct, sf_pct, gf_pct, xgf_pct FROM public.nst_team_gamelogs_as_counts
          UNION ALL SELECT 'nst_team_gamelogs_as_rates', team_abbreviation, date, gp, cf, ca, sf, sa, gf, ga, xgf, xga, cf_pct, sf_pct, gf_pct, xgf_pct FROM public.nst_team_gamelogs_as_rates
          UNION ALL SELECT 'nst_team_gamelogs_pp_counts', team_abbreviation, date, gp, cf, ca, sf, sa, gf, ga, xgf, xga, cf_pct, sf_pct, gf_pct, xgf_pct FROM public.nst_team_gamelogs_pp_counts
          UNION ALL SELECT 'nst_team_gamelogs_pp_rates', team_abbreviation, date, gp, cf, ca, sf, sa, gf, ga, xgf, xga, cf_pct, sf_pct, gf_pct, xgf_pct FROM public.nst_team_gamelogs_pp_rates
          UNION ALL SELECT 'nst_team_gamelogs_pk_counts', team_abbreviation, date, gp, cf, ca, sf, sa, gf, ga, xgf, xga, cf_pct, sf_pct, gf_pct, xgf_pct FROM public.nst_team_gamelogs_pk_counts
          UNION ALL SELECT 'nst_team_gamelogs_pk_rates', team_abbreviation, date, gp, cf, ca, sf, sa, gf, ga, xgf, xga, cf_pct, sf_pct, gf_pct, xgf_pct FROM public.nst_team_gamelogs_pk_rates
        )
        SELECT
          source_name,
          count(*) AS rows,
          count(*) FILTER (WHERE team_abbreviation IS NULL OR date IS NULL) AS null_identity_rows,
          count(*) FILTER (
            WHERE cf < 0 OR ca < 0 OR sf < 0 OR sa < 0 OR gf < 0 OR ga < 0 OR xgf < 0 OR xga < 0
          ) AS negative_value_rows,
          count(*) FILTER (
            WHERE cf_pct NOT BETWEEN 0 AND 100
               OR sf_pct NOT BETWEEN 0 AND 100
               OR gf_pct NOT BETWEEN 0 AND 100
               OR xgf_pct NOT BETWEEN 0 AND 100
          ) AS invalid_percentage_rows,
          count(*) FILTER (WHERE gp IS NOT NULL AND gp <> 1) AS non_one_game_rows
        FROM rows
        WHERE date >= DATE '2025-10-01'
        GROUP BY source_name
        ORDER BY source_name
      `,
    },
    {
      name: "recent_game_side_core_source_coverage_check",
      description:
        "Each recent game/team side should have reasonably current team-power and standings context available before or on game date.",
      warnPredicate: (rows) => {
        const row = rows[0] ?? {};
        return (
          Number(row.team_game_sides ?? 0) === 0 ||
          Number(row.missing_recent_team_power_rows ?? 0) > 0 ||
          Number(row.missing_recent_standings_rows ?? 0) > 0
        );
      },
      query: `
        WITH game_sides AS (
          SELECT g.id AS game_id, g.date, t.abbreviation AS team_abbreviation
          FROM public.games g
          JOIN public.teams t ON t.id = g."homeTeamId"
          WHERE g.date BETWEEN DATE '2025-10-01' AND LEAST(current_date, DATE '2026-06-30')
          UNION ALL
          SELECT g.id, g.date, t.abbreviation
          FROM public.games g
          JOIN public.teams t ON t.id = g."awayTeamId"
          WHERE g.date BETWEEN DATE '2025-10-01' AND LEAST(current_date, DATE '2026-06-30')
        )
        SELECT
          count(*) AS team_game_sides,
          count(*) FILTER (
            WHERE NOT EXISTS (
              SELECT 1
              FROM public.team_power_ratings_daily p
              WHERE p.team_abbreviation = game_sides.team_abbreviation
                AND p.date <= game_sides.date
                AND p.date >= game_sides.date - INTERVAL '14 days'
            )
          ) AS missing_recent_team_power_rows,
          count(*) FILTER (
            WHERE NOT EXISTS (
              SELECT 1
              FROM public.nhl_standings_details s
              WHERE s.team_abbrev = game_sides.team_abbreviation
                AND s.date <= game_sides.date
                AND s.date >= game_sides.date - INTERVAL '14 days'
            )
          ) AS missing_recent_standings_rows
        FROM game_sides
      `,
    },
  ];

  const checks: DataQualityCheck[] = [];

  for (const definition of checkDefinitions) {
    const rows = await queryManagementApi<Record<string, unknown>>(definition.query);
    const isBlocker = definition.blockerPredicate?.(rows) ?? false;
    const isWarning = !isBlocker && (definition.warnPredicate?.(rows) ?? false);

    checks.push({
      name: definition.name,
      description: definition.description,
      rows,
      severity: isBlocker ? "blocker" : isWarning ? "warn" : "pass",
    });
  }

  return checks;
}

async function buildManagementAsOfLeakageChecks(): Promise<AsOfLeakageCheck[]> {
  const checkDefinitions: Array<{
    name: string;
    description: string;
    blockerPredicate?: (rows: Record<string, unknown>[]) => boolean;
    warnPredicate?: (rows: Record<string, unknown>[]) => boolean;
    query: string;
  }> = [
    {
      name: "latest_only_view_exclusion_check",
      description:
        "Latest-only display views should not be used for historical training rows because they encode current database state instead of an as-of cutoff.",
      warnPredicate: (rows) =>
        rows.some((row) => row.relation_exists === true || row.is_planned_source === true),
      query: `
        SELECT
          'nhl_team_data' AS relation_name,
          EXISTS (
            SELECT 1
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relname = 'nhl_team_data'
          ) AS relation_exists,
          ${SOURCES.some((source) => source.name === "nhl_team_data")} AS is_planned_source
      `,
    },
    {
      name: "team_feature_strict_pregame_as_of_coverage_check",
      description:
        "Historical team features should be joinable from rows dated before the game date; same-day-only joins are leakage-prone for completed games.",
      warnPredicate: (rows) => {
        const row = rows[0] ?? {};
        return (
          Number(row.team_game_sides ?? 0) === 0 ||
          Number(row.missing_team_power_before_game_rows ?? 0) > 0 ||
          Number(row.missing_standings_before_game_rows ?? 0) > 0 ||
          Number(row.missing_wgo_before_game_rows ?? 0) > 0 ||
          Number(row.team_power_same_day_only_rows ?? 0) > 0 ||
          Number(row.standings_same_day_only_rows ?? 0) > 0 ||
          Number(row.wgo_same_day_only_rows ?? 0) > 0
        );
      },
      query: `
        WITH game_sides AS (
          SELECT g.id AS game_id, g.date, t.id AS team_id, t.abbreviation AS team_abbreviation
          FROM public.games g
          JOIN public.teams t ON t.id = g."homeTeamId"
          WHERE g.date BETWEEN DATE '2025-10-01' AND LEAST(current_date, DATE '2026-06-30')
          UNION ALL
          SELECT g.id, g.date, t.id, t.abbreviation
          FROM public.games g
          JOIN public.teams t ON t.id = g."awayTeamId"
          WHERE g.date BETWEEN DATE '2025-10-01' AND LEAST(current_date, DATE '2026-06-30')
        )
        SELECT
          count(*) AS team_game_sides,
          count(*) FILTER (
            WHERE NOT EXISTS (
              SELECT 1
              FROM public.team_power_ratings_daily p
              WHERE p.team_abbreviation = game_sides.team_abbreviation
                AND p.date < game_sides.date
            )
          ) AS missing_team_power_before_game_rows,
          count(*) FILTER (
            WHERE NOT EXISTS (
              SELECT 1
              FROM public.nhl_standings_details s
              WHERE s.team_abbrev = game_sides.team_abbreviation
                AND s.date < game_sides.date
            )
          ) AS missing_standings_before_game_rows,
          count(*) FILTER (
            WHERE NOT EXISTS (
              SELECT 1
              FROM public.wgo_team_stats w
              WHERE w.team_id = game_sides.team_id
                AND w.date < game_sides.date
            )
          ) AS missing_wgo_before_game_rows,
          count(*) FILTER (
            WHERE EXISTS (
              SELECT 1 FROM public.team_power_ratings_daily p
              WHERE p.team_abbreviation = game_sides.team_abbreviation AND p.date = game_sides.date
            )
            AND NOT EXISTS (
              SELECT 1 FROM public.team_power_ratings_daily p
              WHERE p.team_abbreviation = game_sides.team_abbreviation AND p.date < game_sides.date
            )
          ) AS team_power_same_day_only_rows,
          count(*) FILTER (
            WHERE EXISTS (
              SELECT 1 FROM public.nhl_standings_details s
              WHERE s.team_abbrev = game_sides.team_abbreviation AND s.date = game_sides.date
            )
            AND NOT EXISTS (
              SELECT 1 FROM public.nhl_standings_details s
              WHERE s.team_abbrev = game_sides.team_abbreviation AND s.date < game_sides.date
            )
          ) AS standings_same_day_only_rows,
          count(*) FILTER (
            WHERE EXISTS (
              SELECT 1 FROM public.wgo_team_stats w
              WHERE w.team_id = game_sides.team_id AND w.date = game_sides.date
            )
            AND NOT EXISTS (
              SELECT 1 FROM public.wgo_team_stats w
              WHERE w.team_id = game_sides.team_id AND w.date < game_sides.date
            )
          ) AS wgo_same_day_only_rows
        FROM game_sides
      `,
    },
    {
      name: "goalie_projection_temporal_safety_check",
      description:
        "`goalie_start_projections` has timestamps, but rows created or updated after scheduled puck drop cannot be used for historical pregame training at that cutoff.",
      warnPredicate: (rows) => {
        const row = rows[0] ?? {};
        return (
          Number(row.rows_joined_to_games ?? 0) === 0 ||
          Number(row.created_after_start_rows ?? 0) > 0 ||
          Number(row.updated_after_start_rows ?? 0) > 0 ||
          Number(row.null_created_at_rows ?? 0) > 0
        );
      },
      query: `
        SELECT
          count(*) AS rows_joined_to_games,
          count(*) FILTER (WHERE gsp.created_at IS NULL) AS null_created_at_rows,
          count(*) FILTER (WHERE gsp.created_at > g."startTime") AS created_after_start_rows,
          count(*) FILTER (WHERE gsp.updated_at > g."startTime") AS updated_after_start_rows,
          min(gsp.created_at) AS min_created_at,
          max(gsp.created_at) AS max_created_at
        FROM public.goalie_start_projections gsp
        JOIN public.games g ON g.id = gsp.game_id
        WHERE g.date >= DATE '2025-10-01'
      `,
    },
    {
      name: "lineup_source_temporal_safety_check",
      description:
        "Lineup sources need observed/snapshot timestamps before game start for historical training; `lineCombinations` has no observation timestamp and should remain current/explanation-only unless provenance is added.",
      warnPredicate: (rows) =>
        rows.some(
          (row) =>
            Number(row.rows_joined_to_games ?? 0) === 0 ||
            Number(row.observed_after_start_rows ?? 0) > 0 ||
            row.has_observed_at_column === false
        ),
      query: `
        WITH line_sources AS (
          SELECT 'lines_nhl' AS source_name, game_id, observed_at FROM public.lines_nhl
          UNION ALL
          SELECT 'lines_dfo', game_id, observed_at FROM public.lines_dfo
          UNION ALL
          SELECT 'lines_gdl', game_id, observed_at FROM public.lines_gdl
          UNION ALL
          SELECT 'lines_ccc', game_id, observed_at FROM public.lines_ccc WHERE nhl_filter_status = 'accepted'
        ),
        source_checks AS (
          SELECT
            source_name,
            count(*) FILTER (WHERE game_id IS NOT NULL) AS rows_with_game_id,
            count(*) FILTER (WHERE game_id IS NOT NULL AND g.id IS NOT NULL) AS rows_joined_to_games,
            count(*) FILTER (WHERE game_id IS NOT NULL AND g.id IS NOT NULL AND observed_at > g."startTime") AS observed_after_start_rows,
            true AS has_observed_at_column
          FROM line_sources ls
          LEFT JOIN public.games g ON g.id = ls.game_id
          GROUP BY source_name
        )
        SELECT * FROM source_checks
        UNION ALL
        SELECT
          'lineCombinations' AS source_name,
          count(*) AS rows_with_game_id,
          count(*) AS rows_joined_to_games,
          NULL::bigint AS observed_after_start_rows,
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'lineCombinations'
              AND column_name = 'observed_at'
          ) AS has_observed_at_column
        FROM public."lineCombinations"
        ORDER BY source_name
      `,
    },
    {
      name: "forge_projection_as_of_date_safety_check",
      description:
        "FORGE projections use date-level `as_of_date`; rows on or after the game date need timestamp provenance or conservative exclusion for strict pregame training.",
      warnPredicate: (rows) =>
        rows.some(
          (row) =>
            Number(row.rows_joined_to_games ?? 0) === 0 ||
            Number(row.as_of_on_or_after_game_date_rows ?? 0) > 0 ||
            Number(row.null_as_of_date_rows ?? 0) > 0
        ),
      query: `
        WITH rows AS (
          SELECT 'forge_player_projections' AS source_name, as_of_date, game_id FROM public.forge_player_projections
          UNION ALL
          SELECT 'forge_goalie_projections', as_of_date, game_id FROM public.forge_goalie_projections
          UNION ALL
          SELECT 'forge_team_projections', as_of_date, game_id FROM public.forge_team_projections
        )
        SELECT
          source_name,
          count(*) AS rows,
          count(*) FILTER (WHERE as_of_date IS NULL) AS null_as_of_date_rows,
          count(*) FILTER (WHERE g.id IS NOT NULL) AS rows_joined_to_games,
          count(*) FILTER (WHERE g.id IS NOT NULL AND as_of_date >= g.date) AS as_of_on_or_after_game_date_rows,
          min(as_of_date) AS min_as_of_date,
          max(as_of_date) AS max_as_of_date
        FROM rows
        LEFT JOIN public.games g ON g.id = rows.game_id
        GROUP BY source_name
        ORDER BY source_name
      `,
    },
  ];

  const checks: AsOfLeakageCheck[] = [];

  for (const definition of checkDefinitions) {
    const rows = await queryManagementApi<Record<string, unknown>>(definition.query);
    const isBlocker = definition.blockerPredicate?.(rows) ?? false;
    const isWarning = !isBlocker && (definition.warnPredicate?.(rows) ?? false);

    checks.push({
      name: definition.name,
      description: definition.description,
      rows,
      severity: isBlocker ? "blocker" : isWarning ? "warn" : "pass",
    });
  }

  return checks;
}

async function getManagementDateCoverage(
  source: SourceDefinition,
  columns: ColumnSummary[]
): Promise<Array<{ column: string; min: string | null; max: string | null }>> {
  const columnNames = new Set(columns.map((column) => column.column_name));
  const coverage: Array<{ column: string; min: string | null; max: string | null }> = [];

  for (const columnName of source.expectedDateColumns) {
    if (!columnNames.has(columnName)) continue;

    const rows = await queryManagementApi<{ min_value: unknown; max_value: unknown }>(
      `
        SELECT min(${q(columnName)}) AS min_value, max(${q(columnName)}) AS max_value
        FROM public.${q(source.name)}
      `
    );

    coverage.push({
      column: columnName,
      min: formatValue(rows[0]?.min_value),
      max: formatValue(rows[0]?.max_value),
    });
  }

  return coverage;
}

function buildSupabaseClient(): SupabaseClient {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fyhftlxokyjtpndbkfse.supabase.co";
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseKey) {
    throw new Error("Missing Supabase REST key.");
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

async function restColumnExists(
  supabase: SupabaseClient,
  sourceName: string,
  columnName: string
): Promise<boolean> {
  const { error } = await supabase.from(sourceName).select(columnName).limit(1);
  return !error;
}

async function getRestRowCount(
  supabase: SupabaseClient,
  sourceName: string
): Promise<{ exists: boolean; count: number | null }> {
  const { count, error } = await supabase
    .from(sourceName)
    .select("*", { count: "exact", head: true });

  if (error) {
    return { exists: false, count: null };
  }

  return { exists: true, count: count ?? null };
}

async function getRestDateCoverage(
  supabase: SupabaseClient,
  sourceName: string,
  columnName: string
): Promise<{ column: string; min: string | null; max: string | null } | null> {
  const minResult = await supabase
    .from(sourceName)
    .select(columnName)
    .not(columnName, "is", null)
    .order(columnName, { ascending: true })
    .limit(1);

  if (minResult.error) return null;

  const maxResult = await supabase
    .from(sourceName)
    .select(columnName)
    .not(columnName, "is", null)
    .order(columnName, { ascending: false })
    .limit(1);

  if (maxResult.error) return null;

  return {
    column: columnName,
    min: formatValue(
      ((minResult.data?.[0] as unknown) as Record<string, unknown> | undefined)?.[columnName]
    ),
    max: formatValue(
      ((maxResult.data?.[0] as unknown) as Record<string, unknown> | undefined)?.[columnName]
    ),
  };
}

async function buildRestInventory(supabase: SupabaseClient): Promise<SourceInventoryRow[]> {
  const rows: SourceInventoryRow[] = [];

  for (const source of SOURCES) {
    const rowCountResult = await getRestRowCount(supabase, source.name);
    const exists = rowCountResult.exists;
    const plannedColumns = Array.from(
      new Set([...source.keyColumns, ...source.expectedDateColumns])
    );
    const existingPlannedColumns: ColumnSummary[] = [];
    const missingPlannedColumns: string[] = [];

    if (exists) {
      for (const columnName of plannedColumns) {
        if (await restColumnExists(supabase, source.name, columnName)) {
          existingPlannedColumns.push({
            column_name: columnName,
            data_type: "unknown_rest",
            is_nullable: "YES",
          });
        } else if (source.keyColumns.includes(columnName)) {
          missingPlannedColumns.push(columnName);
        }
      }
    }

    const dateCoverage: SourceInventoryRow["dateCoverage"] = [];

    if (exists) {
      for (const columnName of source.expectedDateColumns) {
        if (!existingPlannedColumns.some((column) => column.column_name === columnName)) {
          continue;
        }

        const coverage = await getRestDateCoverage(supabase, source.name, columnName);
        if (coverage) dateCoverage.push(coverage);
      }
    }

    rows.push({
      ...source,
      exists,
      relationType: exists ? "relation_rest_accessible" : null,
      rowCount: rowCountResult.count,
      dateCoverage,
      columns: existingPlannedColumns,
      primaryKey: [],
      foreignKeys: [],
      indexes: [],
      missingKeyColumns: exists ? missingPlannedColumns : source.keyColumns,
      metadataMode: "supabase_rest",
    });
  }

  return rows;
}

function formatList(values: string[]): string {
  return values.length > 0 ? values.map((value) => `\`${value}\``).join(", ") : "None";
}

function formatCoverage(row: SourceInventoryRow): string {
  if (!row.exists) return "Missing relation";
  if (row.dateCoverage.length === 0) return "No planned date columns found";

  return row.dateCoverage
    .map((coverage) => `\`${coverage.column}\`: ${coverage.min ?? "null"} to ${coverage.max ?? "null"}`)
    .join("; ");
}

function renderMarkdown(
  rows: SourceInventoryRow[],
  identityChecks: IdentityCheck[],
  mathChecks: MathCheck[],
  nstTeamChecks: NstTeamCheck[],
  wgoStandingsChecks: WgoStandingsCheck[],
  goalieChecks: GoalieCheck[],
  lineupPlayerChecks: LineupPlayerCheck[],
  storageChecks: StorageCheck[],
  dataQualityChecks: DataQualityCheck[],
  asOfLeakageChecks: AsOfLeakageCheck[]
): string {
  const generatedAt = new Date().toISOString();
  const metadataModes = Array.from(new Set(rows.map((row) => row.metadataMode))).join(", ");
  const missing = rows.filter((row) => !row.exists);
  const missingKeyColumns = rows.filter((row) => row.exists && row.missingKeyColumns.length > 0);
  const identityBlockers = identityChecks.filter((check) => check.severity === "blocker");
  const identityWarnings = identityChecks.filter((check) => check.severity === "warn");
  const mathBlockers = mathChecks.filter((check) => check.severity === "blocker");
  const mathWarnings = mathChecks.filter((check) => check.severity === "warn");
  const nstTeamBlockers = nstTeamChecks.filter((check) => check.severity === "blocker");
  const nstTeamWarnings = nstTeamChecks.filter((check) => check.severity === "warn");
  const wgoStandingsBlockers = wgoStandingsChecks.filter((check) => check.severity === "blocker");
  const wgoStandingsWarnings = wgoStandingsChecks.filter((check) => check.severity === "warn");
  const goalieBlockers = goalieChecks.filter((check) => check.severity === "blocker");
  const goalieWarnings = goalieChecks.filter((check) => check.severity === "warn");
  const lineupPlayerBlockers = lineupPlayerChecks.filter((check) => check.severity === "blocker");
  const lineupPlayerWarnings = lineupPlayerChecks.filter((check) => check.severity === "warn");
  const storageBlockers = storageChecks.filter((check) => check.severity === "blocker");
  const storageWarnings = storageChecks.filter((check) => check.severity === "warn");
  const dataQualityBlockers = dataQualityChecks.filter((check) => check.severity === "blocker");
  const dataQualityWarnings = dataQualityChecks.filter((check) => check.severity === "warn");
  const asOfLeakageBlockers = asOfLeakageChecks.filter((check) => check.severity === "blocker");
  const asOfLeakageWarnings = asOfLeakageChecks.filter((check) => check.severity === "warn");

  return `# NHL Game Prediction Supabase Source Audit

Generated at: ${generatedAt}

Scope: live schema, source inventory, identity joins, team-power math, NST team-table semantics, WGO/standings semantics, goalie-source semantics, lineup/player-context coverage, prediction storage/provenance fit, representative row-level data quality, and as-of/leakage safety for tasks 1.1 through 1.11 of \`tasks/tasks-prd-nhl-game-prediction-model.md\`.

Metadata mode: ${metadataModes}

## Summary

- Planned sources checked: ${rows.length}
- Existing live relations: ${rows.filter((row) => row.exists).length}
- Missing live relations: ${missing.length}
- Existing relations with missing planned key columns: ${missingKeyColumns.length}
- Identity check blockers: ${identityBlockers.length}
- Identity check warnings: ${identityWarnings.length}
- Team-power math blockers: ${mathBlockers.length}
- Team-power math warnings: ${mathWarnings.length}
- NST team-table blockers: ${nstTeamBlockers.length}
- NST team-table warnings: ${nstTeamWarnings.length}
- WGO/standings blockers: ${wgoStandingsBlockers.length}
- WGO/standings warnings: ${wgoStandingsWarnings.length}
- Goalie-source blockers: ${goalieBlockers.length}
- Goalie-source warnings: ${goalieWarnings.length}
- Lineup/player-context blockers: ${lineupPlayerBlockers.length}
- Lineup/player-context warnings: ${lineupPlayerWarnings.length}
- Storage/provenance blockers: ${storageBlockers.length}
- Storage/provenance warnings: ${storageWarnings.length}
- Row-level data-quality blockers: ${dataQualityBlockers.length}
- Row-level data-quality warnings: ${dataQualityWarnings.length}
- As-of/leakage blockers: ${asOfLeakageBlockers.length}
- As-of/leakage warnings: ${asOfLeakageWarnings.length}

## Blockers And Follow-Ups

${
  missing.length > 0
    ? missing.map((row) => `- Missing relation: \`${row.name}\` (${row.purpose})`).join("\n")
    : "- No missing live relations in this inventory pass."
}
${
  missingKeyColumns.length > 0
    ? "\n" +
      missingKeyColumns
        .map(
          (row) =>
            `- \`${row.name}\` is missing planned key columns: ${formatList(row.missingKeyColumns)}`
        )
        .join("\n")
    : ""
}
${
  identityBlockers.length > 0
    ? "\n" +
      identityBlockers
        .map((check) => `- Identity blocker: \`${check.name}\` requires remediation before model use.`)
        .join("\n")
    : "\n- No identity-join blockers in this pass."
}
${
  identityWarnings.length > 0
    ? "\n" +
      identityWarnings
        .map((check) => `- Identity warning: \`${check.name}\` should be handled in the data dictionary/fallback rules.`)
        .join("\n")
    : "\n- No identity-join warnings in this pass."
}
${
  mathBlockers.length > 0
    ? "\n" +
      mathBlockers
        .map((check) => `- Team-power math blocker: \`${check.name}\` requires remediation before model use.`)
        .join("\n")
    : "\n- No team-power math blockers in this pass."
}
${
  mathWarnings.length > 0
    ? "\n" +
      mathWarnings
        .map((check) => `- Team-power math warning: \`${check.name}\` should be handled before using this table for production modeling.`)
        .join("\n")
    : "\n- No team-power math warnings in this pass."
}
${
  nstTeamBlockers.length > 0
    ? "\n" +
      nstTeamBlockers
        .map((check) => `- NST team-table blocker: \`${check.name}\` requires remediation before model use.`)
        .join("\n")
    : "\n- No NST team-table blockers in this pass."
}
${
  nstTeamWarnings.length > 0
    ? "\n" +
      nstTeamWarnings
        .map((check) => `- NST team-table warning: \`${check.name}\` should be handled in source semantics and freshness rules.`)
        .join("\n")
    : "\n- No NST team-table warnings in this pass."
}
${
  wgoStandingsBlockers.length > 0
    ? "\n" +
      wgoStandingsBlockers
        .map((check) => `- WGO/standings blocker: \`${check.name}\` requires remediation before model use.`)
        .join("\n")
    : "\n- No WGO/standings blockers in this pass."
}
${
  wgoStandingsWarnings.length > 0
    ? "\n" +
      wgoStandingsWarnings
        .map((check) => `- WGO/standings warning: \`${check.name}\` should be handled in source semantics and freshness rules.`)
        .join("\n")
    : "\n- No WGO/standings warnings in this pass."
}
${
  goalieBlockers.length > 0
    ? "\n" +
      goalieBlockers
        .map((check) => `- Goalie-source blocker: \`${check.name}\` requires remediation before model use.`)
        .join("\n")
    : "\n- No goalie-source blockers in this pass."
}
${
  goalieWarnings.length > 0
    ? "\n" +
      goalieWarnings
        .map((check) => `- Goalie-source warning: \`${check.name}\` should be handled in source semantics and freshness rules.`)
        .join("\n")
    : "\n- No goalie-source warnings in this pass."
}
${
  lineupPlayerBlockers.length > 0
    ? "\n" +
      lineupPlayerBlockers
        .map((check) => `- Lineup/player-context blocker: \`${check.name}\` requires remediation before model use.`)
        .join("\n")
    : "\n- No lineup/player-context blockers in this pass."
}
${
  lineupPlayerWarnings.length > 0
    ? "\n" +
      lineupPlayerWarnings
        .map((check) => `- Lineup/player-context warning: \`${check.name}\` should be handled in optional-source and freshness rules.`)
        .join("\n")
    : "\n- No lineup/player-context warnings in this pass."
}
${
  storageBlockers.length > 0
    ? "\n" +
      storageBlockers
        .map((check) => `- Storage/provenance blocker: \`${check.name}\` requires remediation before prediction persistence.`)
        .join("\n")
    : "\n- No storage/provenance blockers in this pass."
}
${
  storageWarnings.length > 0
    ? "\n" +
      storageWarnings
        .map((check) => `- Storage/provenance warning: \`${check.name}\` should be handled before relying on stored prediction history or freshness evidence.`)
        .join("\n")
    : "\n- No storage/provenance warnings in this pass."
}
${
  dataQualityBlockers.length > 0
    ? "\n" +
      dataQualityBlockers
        .map((check) => `- Row-level data-quality blocker: \`${check.name}\` requires remediation before training or prediction generation.`)
        .join("\n")
    : "\n- No row-level data-quality blockers in this pass."
}
${
  dataQualityWarnings.length > 0
    ? "\n" +
      dataQualityWarnings
        .map((check) => `- Row-level data-quality warning: \`${check.name}\` should be handled in feature filters, freshness gates, or clipping rules.`)
        .join("\n")
    : "\n- No row-level data-quality warnings in this pass."
}
${
  asOfLeakageBlockers.length > 0
    ? "\n" +
      asOfLeakageBlockers
        .map((check) => `- As-of/leakage blocker: \`${check.name}\` requires remediation before historical training.`)
        .join("\n")
    : "\n- No as-of/leakage blockers in this pass."
}
${
  asOfLeakageWarnings.length > 0
    ? "\n" +
      asOfLeakageWarnings
        .map((check) => `- As-of/leakage warning: \`${check.name}\` should be handled with strict feature cutoffs or source exclusion rules.`)
        .join("\n")
    : "\n- No as-of/leakage warnings in this pass."
}

## Source Inventory

| Source | Priority | Type | Rows | Date Coverage | Planned Key Columns Missing | Use-Case Purpose |
| --- | --- | --- | ---: | --- | --- | --- |
${rows
  .map(
    (row) =>
      `| \`${row.name}\` | ${row.priority} | ${row.relationType ?? "missing"} | ${
        row.rowCount ?? ""
      } | ${formatCoverage(row)} | ${formatList(row.missingKeyColumns)} | ${row.purpose} |`
  )
  .join("\n")}

## Identity Join Checks

${identityChecks
  .map(
    (check) => `### ${check.severity.toUpperCase()}: \`${check.name}\`

${check.description}

\`\`\`json
${JSON.stringify(check.rows, null, 2)}
\`\`\`
`
  )
  .join("\n")}

## Team Power Ratings Math Checks

${mathChecks
  .map(
    (check) => `### ${check.severity.toUpperCase()}: \`${check.name}\`

${check.description}

\`\`\`json
${JSON.stringify(check.rows, null, 2)}
\`\`\`
`
  )
  .join("\n")}

## NST Team Table Semantics Checks

${nstTeamChecks
  .map(
    (check) => `### ${check.severity.toUpperCase()}: \`${check.name}\`

${check.description}

\`\`\`json
${JSON.stringify(check.rows, null, 2)}
\`\`\`
`
  )
  .join("\n")}

## WGO Team And Standings Semantics Checks

${wgoStandingsChecks
  .map(
    (check) => `### ${check.severity.toUpperCase()}: \`${check.name}\`

${check.description}

\`\`\`json
${JSON.stringify(check.rows, null, 2)}
\`\`\`
`
  )
  .join("\n")}

## Goalie Source Semantics Checks

${goalieChecks
  .map(
    (check) => `### ${check.severity.toUpperCase()}: \`${check.name}\`

${check.description}

\`\`\`json
${JSON.stringify(check.rows, null, 2)}
\`\`\`
`
  )
  .join("\n")}

## Lineup And Player Context Checks

${lineupPlayerChecks
  .map(
    (check) => `### ${check.severity.toUpperCase()}: \`${check.name}\`

${check.description}

\`\`\`json
${JSON.stringify(check.rows, null, 2)}
\`\`\`
`
  )
  .join("\n")}

## Storage And Provenance Checks

${storageChecks
  .map(
    (check) => `### ${check.severity.toUpperCase()}: \`${check.name}\`

${check.description}

\`\`\`json
${JSON.stringify(check.rows, null, 2)}
\`\`\`
`
  )
  .join("\n")}

## Row-Level Data Quality Checks

${dataQualityChecks
  .map(
    (check) => `### ${check.severity.toUpperCase()}: \`${check.name}\`

${check.description}

\`\`\`json
${JSON.stringify(check.rows, null, 2)}
\`\`\`
`
  )
  .join("\n")}

## As-Of And Leakage Checks

${asOfLeakageChecks
  .map(
    (check) => `### ${check.severity.toUpperCase()}: \`${check.name}\`

${check.description}

\`\`\`json
${JSON.stringify(check.rows, null, 2)}
\`\`\`
`
  )
  .join("\n")}

## Per-Source Details

${rows
  .map(
    (row) => `### \`${row.name}\`

- Priority: ${row.priority}
- Relation type: ${row.relationType ?? "missing"}
- Metadata mode: ${row.metadataMode}
- Row count: ${row.rowCount ?? "n/a"}
- Planned use: ${row.purpose}
- Notes: ${row.notes}
- Primary key: ${formatList(row.primaryKey)}
- Foreign keys: ${row.foreignKeys.length > 0 ? row.foreignKeys.map((fk) => `\`${fk}\``).join("; ") : "None"}
- Indexes: ${formatList(row.indexes)}
- Date coverage: ${formatCoverage(row)}
- Planned key columns present: ${
      row.exists
        ? row.keyColumns
            .filter((column) => !row.missingKeyColumns.includes(column))
            .map((column) => `\`${column}\``)
            .join(", ") || "None"
        : "Relation missing"
    }
- Planned key columns missing: ${formatList(row.missingKeyColumns)}
- Column count: ${row.columns.length}
`
  )
  .join("\n")}
`;
}

async function main(): Promise<void> {
  let rows: SourceInventoryRow[];
  let identityChecks: IdentityCheck[] = [];
  let mathChecks: MathCheck[] = [];
  let nstTeamChecks: NstTeamCheck[] = [];
  let wgoStandingsChecks: WgoStandingsCheck[] = [];
  let goalieChecks: GoalieCheck[] = [];
  let lineupPlayerChecks: LineupPlayerCheck[] = [];
  let storageChecks: StorageCheck[] = [];
  let dataQualityChecks: DataQualityCheck[] = [];
  let asOfLeakageChecks: AsOfLeakageCheck[] = [];
  let preserveExistingReport = false;
  const outputPath = path.resolve(
    process.cwd(),
    "../tasks/artifacts/nhl-game-prediction-supabase-source-audit.md"
  );

  try {
    const dbConfig = parseDbUrl();
    const client = new Client({
      ...dbConfig,
      connectionTimeoutMillis: 5000,
      query_timeout: 15000,
      ssl: { rejectUnauthorized: false },
    });

    await client.connect();

    try {
      rows = await buildInventory(client);
    } finally {
      await client.end();
    }
  } catch (error) {
    console.warn(
      `[audit-nhl-game-prediction-sources] direct pg_catalog inventory unavailable; using Supabase Management API. Reason: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    try {
      const managementInventory = await buildManagementInventory();
      rows = managementInventory.rows;
      identityChecks = managementInventory.identityChecks;
      mathChecks = managementInventory.mathChecks;
      nstTeamChecks = managementInventory.nstTeamChecks;
      wgoStandingsChecks = managementInventory.wgoStandingsChecks;
      goalieChecks = managementInventory.goalieChecks;
      lineupPlayerChecks = managementInventory.lineupPlayerChecks;
      storageChecks = managementInventory.storageChecks;
      dataQualityChecks = managementInventory.dataQualityChecks;
      asOfLeakageChecks = managementInventory.asOfLeakageChecks;
    } catch (managementError) {
      if (
        fs.existsSync(outputPath) &&
        fs.readFileSync(outputPath, "utf8").includes("Metadata mode: management_api_sql")
      ) {
        console.warn(
          `[audit-nhl-game-prediction-sources] Management API unavailable and existing management-backed report is present; preserving ${outputPath}. Reason: ${
            managementError instanceof Error ? managementError.message : String(managementError)
          }`
        );
        preserveExistingReport = true;
        rows = [];
      } else {
      console.warn(
        `[audit-nhl-game-prediction-sources] Management API inventory unavailable; using Supabase REST fallback. Reason: ${
          managementError instanceof Error ? managementError.message : String(managementError)
        }`
      );
      rows = await buildRestInventory(buildSupabaseClient());
      }
    }
  }

  if (preserveExistingReport) {
    console.log(
      JSON.stringify(
        {
          outputPath,
          preservedExistingReport: true,
        },
        null,
        2
      )
    );
    return;
  }

  {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(
      outputPath,
      renderMarkdown(
        rows,
        identityChecks,
        mathChecks,
        nstTeamChecks,
        wgoStandingsChecks,
        goalieChecks,
        lineupPlayerChecks,
        storageChecks,
        dataQualityChecks,
        asOfLeakageChecks
      )
    );

    const missing = rows.filter((row) => !row.exists).length;
    const missingColumns = rows.reduce((sum, row) => sum + row.missingKeyColumns.length, 0);

    console.log(
      JSON.stringify(
        {
          outputPath,
          plannedSources: rows.length,
          existingRelations: rows.length - missing,
          missingRelations: missing,
          missingPlannedKeyColumns: missingColumns,
        },
        null,
        2
      )
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
