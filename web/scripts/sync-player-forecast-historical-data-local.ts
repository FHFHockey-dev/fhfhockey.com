import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import dotenv from "dotenv";
import { Client } from "pg";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env.development.local" });

const HISTORY_SEASONS = [20222023, 20232024, 20242025, 20252026] as const;
const LOCAL_DATABASE_DEFAULT = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const CONFIRMATION = "remote-read-local-write";

type ColumnMetadata = {
  column_name: string;
  udt_schema: string;
  udt_name: string;
  is_generated: "ALWAYS" | "NEVER";
  is_identity: "YES" | "NO";
  is_nullable: "YES" | "NO";
  column_default: string | null;
};

type SyncSpec = {
  key: string;
  table: string;
  fromSql: string;
  whereSql?: string;
  columns?: readonly string[];
  excludeColumns?: readonly string[];
  columnExpressions?: Readonly<Record<string, string>>;
  conflictColumns?: readonly string[];
  refreshColumns?: readonly string[];
  chunks?: ReadonlyArray<{ key: string; whereSql: string }>;
};

const seasonList = HISTORY_SEASONS.join(", ");
const REGULAR_SEASON_MONTH_CHUNKS = [
  { key: "2025-10", whereSql: "g.date >= date '2025-10-01' and g.date < date '2025-11-01'" },
  { key: "2025-11", whereSql: "g.date >= date '2025-11-01' and g.date < date '2025-12-01'" },
  { key: "2025-12", whereSql: "g.date >= date '2025-12-01' and g.date < date '2026-01-01'" },
  { key: "2026-01", whereSql: "g.date >= date '2026-01-01' and g.date < date '2026-02-01'" },
  { key: "2026-02", whereSql: "g.date >= date '2026-02-01' and g.date < date '2026-03-01'" },
  { key: "2026-03", whereSql: "g.date >= date '2026-03-01' and g.date < date '2026-04-01'" },
  { key: "2026-04", whereSql: "g.date >= date '2026-04-01' and g.date < date '2026-05-01'" },
] as const;
const WGO_COLUMNS = [
  "player_id",
  "player_name",
  "date",
  "assists",
  "ot_goals",
  "gw_goals",
  "empty_net_goals",
  "empty_net_points",
  "giveaways",
  "missed_shots",
  "takeaways",
  "penalties",
  "penalties_drawn",
  "sh_goals",
  "sh_primary_assists",
  "sh_secondary_assists",
  "pp_goals",
  "pp_primary_assists",
  "pp_secondary_assists",
  "total_primary_assists",
  "total_secondary_assists",
  "season_id",
  "game_id",
] as const;

const SYNC_SPECS: readonly SyncSpec[] = [
  {
    key: "teams",
    table: "teams",
    fromSql: "public.teams t",
    whereSql: `exists (
      select 1
      from public.games g
      where g.\"seasonId\" in (${seasonList})
        and g.type = 2
        and t.id in (g.\"homeTeamId\", g.\"awayTeamId\")
    )`,
  },
  {
    key: "seasons",
    table: "seasons",
    fromSql: "public.seasons t",
    whereSql: `t.id in (${seasonList})`,
  },
  {
    key: "team-seasons",
    table: "team_season",
    fromSql: "public.team_season t",
    whereSql: `t.\"seasonId\" in (${seasonList})`,
  },
  {
    key: "games",
    table: "games",
    fromSql: "public.games t",
    whereSql: `t.\"seasonId\" in (${seasonList}) and t.type = 2`,
  },
  {
    key: "players",
    table: "players",
    fromSql: "public.players t",
    whereSql: `
      exists (
        select 1
        from public.\"skatersGameStats\" s
        join public.games g on g.id = s.\"gameId\"
        where s.\"playerId\" = t.id
          and g.\"seasonId\" in (${seasonList})
          and g.type = 2
      )
      or exists (
        select 1
        from public.\"goaliesGameStats\" goalie
        join public.games g on g.id = goalie.\"gameId\"
        where goalie.\"playerId\" = t.id
          and g.\"seasonId\" in (${seasonList})
          and g.type = 2
      )
    `,
  },
  {
    key: "skater-game-stats",
    table: "skatersGameStats",
    fromSql: "public.\"skatersGameStats\" t join public.games g on g.id = t.\"gameId\"",
    whereSql: `g.\"seasonId\" in (${seasonList}) and g.type = 2`,
  },
  {
    key: "goalie-game-stats",
    table: "goaliesGameStats",
    fromSql: "public.\"goaliesGameStats\" t join public.games g on g.id = t.\"gameId\"",
    whereSql: `g.\"seasonId\" in (${seasonList}) and g.type = 2`,
  },
  {
    key: "team-game-stats",
    table: "teamGameStats",
    fromSql: "public.\"teamGameStats\" t join public.games g on g.id = t.\"gameId\"",
    whereSql: `g.\"seasonId\" in (${seasonList}) and g.type = 2`,
  },
  {
    key: "wgo-game-labels",
    table: "wgo_skater_stats",
    fromSql: `
      public.wgo_skater_stats t
      join public.\"skatersGameStats\" skater
        on skater.\"playerId\" = t.player_id
      join public.games g
        on g.id = skater.\"gameId\" and g.date = t.date
    `,
    whereSql: `
      g.\"seasonId\" in (${seasonList})
      and g.type = 2
    `,
    columns: WGO_COLUMNS,
    columnExpressions: {
      season_id: "g.\"seasonId\"::integer",
      game_id: "g.id",
    },
  },
  {
    key: "wgo-season-totals",
    table: "wgo_skater_stats_totals",
    fromSql: "public.wgo_skater_stats_totals t",
    whereSql: `t.season::text in (${HISTORY_SEASONS.map((season) => `'${season}'`).join(", ")})`,
  },
  {
    key: "normalized-pbp",
    table: "nhl_api_pbp_events",
    fromSql: "public.nhl_api_pbp_events t join public.games g on g.id = t.game_id",
    whereSql: `t.season_id in (${seasonList}) and g.type = 2`,
    excludeColumns: ["raw_event"],
    chunks: REGULAR_SEASON_MONTH_CHUNKS,
  },
  {
    key: "normalized-shifts",
    table: "nhl_api_shift_rows",
    fromSql: "public.nhl_api_shift_rows t join public.games g on g.id = t.game_id",
    whereSql: `t.season_id in (${seasonList}) and g.type = 2`,
    excludeColumns: ["raw_shift"],
    chunks: REGULAR_SEASON_MONTH_CHUNKS,
  },
  {
    key: "deployment-tallies",
    table: "player_lineup_deployment_tallies",
    fromSql: "public.player_lineup_deployment_tallies t",
    whereSql: `t.season_id in (${seasonList}) and t.game_type = 2`,
  },
  {
    key: "line-source-snapshots",
    table: "line_source_snapshots",
    fromSql: "public.line_source_snapshots t",
    whereSql: `t.game_id is null or exists (
      select 1 from public.games g
      where g.id = t.game_id and g.\"seasonId\" in (${seasonList}) and g.type = 2
    )`,
  },
  {
    key: "ccc-lines",
    table: "lines_ccc",
    fromSql: "public.lines_ccc t",
    whereSql: `t.game_id is null or exists (
      select 1 from public.games g
      where g.id = t.game_id and g.\"seasonId\" in (${seasonList}) and g.type = 2
    )`,
  },
  {
    key: "nhl-lines",
    table: "lines_nhl",
    fromSql: "public.lines_nhl t",
    whereSql: `t.game_id is null or exists (
      select 1 from public.games g
      where g.id = t.game_id and g.\"seasonId\" in (${seasonList}) and g.type = 2
    )`,
  },
  {
    key: "xg-model-registry",
    table: "nhl_xg_model_registry",
    fromSql: "public.nhl_xg_model_registry t",
    whereSql: "t.model_approved is true and t.approval_status = 'approved'",
  },
  {
    key: "xg-shot-features",
    table: "nhl_xg_shot_features",
    fromSql: "public.nhl_xg_shot_features t join public.games g on g.id = t.game_id",
    whereSql: `t.season_id in (${seasonList}) and g.type = 2`,
    columnExpressions: {
      // The scoring contract distinguishes a present null feature from an
      // absent feature. Keep selected-feature keys even when the source value
      // is null so locally copied rows remain valid model inputs.
      feature_payload: `pg_catalog.jsonb_build_object(
        'featureVersion', t.feature_version,
        'gameId', t.game_id,
        'eventId', t.event_id,
        'seasonId', t.season_id,
        'gameDate', t.game_date,
        'eventOwnerTeamId', t.event_owner_team_id,
        'shooterPlayerId', t.shooter_player_id,
        'goalieInNetId', t.goalie_in_net_id,
        'normalizedX', t.normalized_x,
        'normalizedY', t.normalized_y,
        'shotDistanceFeet', t.shot_distance_feet,
        'shotAngleDegrees', t.shot_angle_degrees,
        'periodNumber', t.period_number,
        'periodSecondsElapsed', t.period_seconds_elapsed,
        'gameSecondsElapsed', t.game_seconds_elapsed,
        'timeSincePreviousEventSeconds', t.time_since_previous_event_seconds,
        'distanceFromPreviousEvent', t.distance_from_previous_event,
        'ownerPowerPlayAgeSeconds', t.owner_power_play_age_seconds,
        'shooterShiftAgeSeconds', t.shooter_shift_age_seconds,
        'eastWestMovementFeet', t.east_west_movement_feet,
        'northSouthMovementFeet', t.north_south_movement_feet,
        'previousEventSameTeam', t.previous_event_same_team,
        'isReboundShot', t.is_rebound_shot,
        'isRushShot', t.is_rush_shot,
        'isFlurryShot', t.is_flurry_shot,
        'isEmptyNetEvent', t.is_empty_net_event,
        'isOvertimeEvent', t.is_overtime_event,
        'isShortSideMiss', t.is_short_side_miss,
        'crossedRoyalRoad', t.crossed_royal_road,
        'shotType', t.shot_type,
        'strengthState', t.strength_state,
        'strengthExact', t.strength_exact,
        'zoneCode', t.zone_code,
        'previousEventTypeDescKey', t.previous_event_type_desc_key,
        'missReasonBucket', t.miss_reason_bucket,
        'isGoal', t.is_goal,
        'isShotOnGoal', t.is_shot_on_goal,
        'isMissedShot', t.is_missed_shot,
        'isBlockedShot', t.is_blocked_shot,
        'isUnblockedShotAttempt', t.is_unblocked_shot_attempt,
        'createsRebound', t.creates_rebound,
        'reboundControlOutcome', t.feature_payload -> 'reboundControlOutcome',
        'createsGoalieFreeze', t.feature_payload -> 'createsGoalieFreeze',
        'createsCoveredPuck', t.feature_payload -> 'createsCoveredPuck',
        'createsNoDangerContinuation', t.feature_payload -> 'createsNoDangerContinuation',
        'dangerTaxonomySource', 'continuous_shot_distance_feet',
        'dangerTaxonomyVersion', 'player-forecasts-v5-distance-bands-v1'
      )`,
    },
    conflictColumns: ["feature_version", "game_id", "event_id"],
    refreshColumns: ["feature_payload"],
    chunks: REGULAR_SEASON_MONTH_CHUNKS,
  },
  {
    key: "xg-shot-predictions",
    table: "nhl_xg_shot_predictions",
    fromSql: "public.nhl_xg_shot_predictions t join public.games g on g.id = t.game_id",
    whereSql: `t.season_id in (${seasonList}) and g.type = 2 and t.model_approved is true
      and exists (
        select 1 from public.nhl_xg_model_registry registry
        where registry.model_version = t.model_version
          and registry.prediction_type = t.prediction_type
          and registry.model_approved is true
          and registry.approval_status = 'approved'
      )`,
    columnExpressions: {
      provenance: `pg_catalog.jsonb_build_object(
        'source', 'hosted_registry_approved_local_copy',
        'modelVersion', t.model_version,
        'predictionType', t.prediction_type,
        'featureVersion', t.feature_version,
        'featurePayloadHash', t.feature_payload_hash
      )`,
    },
    chunks: REGULAR_SEASON_MONTH_CHUNKS,
  },
  {
    key: "xg-shot-assist-candidates",
    table: "nhl_xg_shot_assist_candidates",
    fromSql: "public.nhl_xg_shot_assist_candidates t join public.games g on g.id = t.game_id",
    whereSql: `t.season_id in (${seasonList}) and g.type = 2`,
  },
  {
    key: "xg-player-game-aggregates",
    table: "nhl_xg_player_game_aggregates",
    fromSql: "public.nhl_xg_player_game_aggregates t join public.games g on g.id = t.game_id",
    whereSql: `t.season_id in (${seasonList}) and g.type = 2 and t.source_model_approved is true`,
  },
  {
    key: "xg-player-created-xg-aggregates",
    table: "nhl_xg_player_created_xg_game_aggregates",
    fromSql: "public.nhl_xg_player_created_xg_game_aggregates t join public.games g on g.id = t.game_id",
    whereSql: `t.season_id in (${seasonList}) and g.type = 2`,
  },
  {
    key: "xg-player-rebound-aggregates",
    table: "nhl_xg_rebound_control_player_game_aggregates",
    fromSql: "public.nhl_xg_rebound_control_player_game_aggregates t join public.games g on g.id = t.game_id",
    whereSql: `t.season_id in (${seasonList}) and g.type = 2 and t.source_model_approved is true`,
  },
  {
    key: "xg-goalie-game-aggregates",
    table: "nhl_xg_goalie_game_aggregates",
    fromSql: "public.nhl_xg_goalie_game_aggregates t join public.games g on g.id = t.game_id",
    whereSql: `t.season_id in (${seasonList}) and g.type = 2 and t.source_model_approved is true`,
  },
  {
    key: "xg-goalie-rebound-aggregates",
    table: "nhl_xg_rebound_control_goalie_game_aggregates",
    fromSql: "public.nhl_xg_rebound_control_goalie_game_aggregates t join public.games g on g.id = t.game_id",
    whereSql: `t.season_id in (${seasonList}) and g.type = 2 and t.source_model_approved is true`,
  },
  {
    key: "xg-team-game-aggregates",
    table: "nhl_xg_team_game_aggregates",
    fromSql: "public.nhl_xg_team_game_aggregates t join public.games g on g.id = t.game_id",
    whereSql: `t.season_id in (${seasonList}) and g.type = 2 and t.source_model_approved is true`,
  },
];

function parseArgument(name: string): string | null {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length).trim() || null;
}

function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function sourceDatabaseUrl(): URL {
  const raw = process.env.PLAYER_FORECAST_HISTORICAL_SOURCE_DB_URL?.trim()
    || process.env.SUPABASE_DB_URL?.trim();
  if (!raw) {
    throw new Error(
      "Set PLAYER_FORECAST_HISTORICAL_SOURCE_DB_URL or SUPABASE_DB_URL to the hosted read source.",
    );
  }
  const url = new URL(raw);
  const direct = url.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
  if (direct) {
    const region = process.env.PLAYER_FORECAST_HISTORICAL_SOURCE_POOLER_REGION?.trim()
      || "us-east-1";
    if (!/^[a-z0-9-]+$/i.test(region)) throw new Error("Invalid source pooler region.");
    url.hostname = `aws-0-${region}.pooler.supabase.com`;
    url.port = "5432";
    url.username = `postgres.${direct[1]}`;
  }
  url.search = "";
  if (isLocalHostname(url.hostname) || !url.hostname.endsWith(".supabase.com")) {
    throw new Error("The historical source must be a non-local Supabase database.");
  }
  return url;
}

function localDatabaseUrl(): URL {
  const url = new URL(
    process.env.PLAYER_FORECAST_LOCAL_DB_URL?.trim() || LOCAL_DATABASE_DEFAULT,
  );
  if (!isLocalHostname(url.hostname)) {
    throw new Error("The historical sync destination must be local Supabase on localhost.");
  }
  const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (apiUrl && !isLocalHostname(new URL(apiUrl).hostname)) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must also point to local Supabase.");
  }
  return url;
}

function assertAuthorization(): void {
  if (process.env.PLAYER_FORECAST_HISTORICAL_SYNC_CONFIRM !== CONFIRMATION) {
    throw new Error(`PLAYER_FORECAST_HISTORICAL_SYNC_CONFIRM must equal ${CONFIRMATION}.`);
  }
}

function quoteIdentifier(value: string): string {
  return `\"${value.replaceAll("\"", "\"\"")}\"`;
}

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function pgEnvironment(url: URL, readOnly: boolean): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: url.pathname.replace(/^\//, "") || "postgres",
    PGSSLMODE: isLocalHostname(url.hostname) ? "disable" : "require",
    PGOPTIONS: readOnly ? "-c default_transaction_read_only=on -c statement_timeout=0" : "-c statement_timeout=0",
  };
}

function runPsql(url: URL, sql: string, readOnly: boolean): void {
  const result = spawnSync("psql", ["-X", "-v", "ON_ERROR_STOP=1", "-q"], {
    env: pgEnvironment(url, readOnly),
    input: sql,
    encoding: "utf8",
    stdio: ["pipe", "inherit", "inherit"],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`psql exited with status ${result.status}.`);
}

async function columnsFor(client: Client, table: string): Promise<ColumnMetadata[]> {
  const { rows } = await client.query<ColumnMetadata>(
    `
      select column_name, udt_schema, udt_name, is_generated, is_identity,
             is_nullable, column_default
      from information_schema.columns
      where table_schema = 'public' and table_name = $1
      order by ordinal_position
    `,
    [table],
  );
  if (!rows.length) throw new Error(`Table public.${table} is missing.`);
  return rows;
}

async function selectedColumns(
  source: Client,
  local: Client,
  spec: SyncSpec,
): Promise<{ columns: string[]; hasIdentity: boolean }> {
  const [sourceColumns, localColumns] = await Promise.all([
    columnsFor(source, spec.table),
    columnsFor(local, spec.table),
  ]);
  const sourceByName = new Map(sourceColumns.map((column) => [column.column_name, column]));
  const localByName = new Map(localColumns.map((column) => [column.column_name, column]));
  const excluded = new Set(spec.excludeColumns ?? []);
  const candidates = spec.columns
    ? [...spec.columns]
    : localColumns
        .filter((column) => column.is_generated === "NEVER" && !excluded.has(column.column_name))
        .map((column) => column.column_name);
  const columns = candidates.filter((name) => sourceByName.has(name) && localByName.has(name));
  for (const name of candidates) {
    const sourceColumn = sourceByName.get(name);
    const localColumn = localByName.get(name);
    if (!sourceColumn || !localColumn) throw new Error(`${spec.key}: required column ${name} is missing.`);
    if (
      sourceColumn.udt_schema !== localColumn.udt_schema
      || sourceColumn.udt_name !== localColumn.udt_name
    ) {
      throw new Error(`${spec.key}: column ${name} has incompatible source/local types.`);
    }
  }
  const selected = new Set(columns);
  const missingRequired = localColumns.filter((column) => (
    column.is_generated === "NEVER"
    && column.is_identity === "NO"
    && column.is_nullable === "NO"
    && column.column_default == null
    && !selected.has(column.column_name)
  ));
  if (missingRequired.length) {
    throw new Error(
      `${spec.key}: source cannot populate required local columns: ${missingRequired
        .map((column) => column.column_name)
        .join(", ")}.`,
    );
  }
  return {
    columns,
    hasIdentity: columns.some((name) => localByName.get(name)?.is_identity === "YES"),
  };
}

function selectSql(spec: SyncSpec, columns: readonly string[]): string {
  const projection = columns
    .map((column) => spec.columnExpressions?.[column] ?? `t.${quoteIdentifier(column)}`)
    .join(", ");
  return `select ${projection} from ${spec.fromSql}${spec.whereSql ? ` where ${spec.whereSql}` : ""}`
    .replace(/\s+/g, " ")
    .trim();
}

async function countRows(client: Client, spec: SyncSpec): Promise<number> {
  const { rows } = await client.query<{ count: string }>(
    `select count(*)::text as count from ${spec.fromSql}${spec.whereSql ? ` where ${spec.whereSql}` : ""}`,
  );
  return Number(rows[0]?.count ?? 0);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

async function main(): Promise<void> {
  assertAuthorization();
  const sourceUrl = sourceDatabaseUrl();
  const localUrl = localDatabaseUrl();
  const dryRun = process.argv.includes("--dry-run");
  const requested = parseArgument("tables")
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const requestedSet = requested ? new Set(requested) : null;
  const selectedSpecs = requestedSet
    ? SYNC_SPECS.filter((spec) => requestedSet.has(spec.key))
    : [...SYNC_SPECS];
  const unknown = requested?.filter((key) => !SYNC_SPECS.some((spec) => spec.key === key)) ?? [];
  if (unknown.length) throw new Error(`Unknown sync table keys: ${unknown.join(", ")}.`);
  if (!selectedSpecs.length) throw new Error("No historical sync tables were selected.");
  const specs = selectedSpecs.flatMap((spec) => (
    spec.chunks?.map((chunk) => ({
      ...spec,
      key: `${spec.key}:${chunk.key}`,
      whereSql: `(${spec.whereSql}) and (${chunk.whereSql})`,
      chunks: undefined,
    })) ?? [spec]
  ));

  const source = new Client({ connectionString: sourceUrl.toString(), ssl: { rejectUnauthorized: false } });
  const local = new Client({ connectionString: localUrl.toString() });
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "fhfh-player-forecast-sync-"));
  const results: Array<Record<string, unknown>> = [];
  try {
    await Promise.all([source.connect(), local.connect()]);
    const sourceReadOnly = await source.query<{ read_only: string }>(
      "select current_setting('default_transaction_read_only') as read_only",
    );
    if (sourceReadOnly.rows[0]?.read_only !== "off") {
      throw new Error("Unexpected source session state before the explicit read-only copy transaction.");
    }
    for (const [index, spec] of specs.entries()) {
      const [{ columns, hasIdentity }, sourceRows, localBefore] = await Promise.all([
        selectedColumns(source, local, spec),
        countRows(source, spec),
        countRows(local, spec),
      ]);
      process.stdout.write(
        `[${index + 1}/${specs.length}] ${spec.key}: source ${sourceRows.toLocaleString()}, local ${localBefore.toLocaleString()}\n`,
      );
      if (dryRun || sourceRows === 0) {
        results.push({ key: spec.key, sourceRows, localBefore, localAfter: localBefore, dryRun });
        continue;
      }
      const copyPath = path.join(temporaryDirectory, `${String(index).padStart(2, "0")}-${spec.key}.bin`);
      runPsql(
        sourceUrl,
        `
          begin transaction read only;
          \\copy (${selectSql(spec, columns)}) to ${sqlLiteral(copyPath)} with (format binary)
          rollback;
        `,
        true,
      );
      const quotedTable = `public.${quoteIdentifier(spec.table)}`;
      const columnList = columns.map(quoteIdentifier).join(", ");
      const conflictClause = spec.conflictColumns?.length && spec.refreshColumns?.length
        ? `on conflict (${spec.conflictColumns.map(quoteIdentifier).join(", ")}) do update set ${spec.refreshColumns
            .map((column) => `${quoteIdentifier(column)} = excluded.${quoteIdentifier(column)}`)
            .join(", ")}`
        : "on conflict do nothing";
      runPsql(
        localUrl,
        `
          begin;
          create temp table pf_historical_sync (like ${quotedTable} including defaults including generated) on commit drop;
          \\copy pf_historical_sync (${columnList}) from ${sqlLiteral(copyPath)} with (format binary)
          insert into ${quotedTable} (${columnList})${hasIdentity ? " overriding system value" : ""}
          select ${columnList} from pf_historical_sync
          ${conflictClause};
          commit;
        `,
        false,
      );
      const localAfter = await countRows(local, spec);
      const bytes = fs.statSync(copyPath).size;
      fs.unlinkSync(copyPath);
      process.stdout.write(
        `    local ${localAfter.toLocaleString()} (${formatBytes(bytes)} transferred)\n`,
      );
      results.push({ key: spec.key, sourceRows, localBefore, localAfter, transferredBytes: bytes });
    }
    process.stdout.write(`${JSON.stringify({
      success: true,
      dryRun,
      historySeasons: HISTORY_SEASONS,
      sourceMode: "explicit-read-only-transaction",
      destinationMode: "local-insert-on-conflict-do-nothing",
      omittedRawPayloads: [
        "nhl_api_game_payloads_raw.payload",
        "nhl_api_pbp_events.raw_event",
        "nhl_api_shift_rows.raw_shift",
      ],
      results,
    }, null, 2)}\n`);
  } finally {
    await Promise.allSettled([source.end(), local.end()]);
    if (temporaryDirectory.startsWith(`${os.tmpdir()}${path.sep}fhfh-player-forecast-sync-`)) {
      fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
