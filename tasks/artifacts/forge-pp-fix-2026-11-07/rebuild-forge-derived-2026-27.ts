/**
 * Bounded local rebuild of the FORGE derived tables for 2026-27 (forge-pp-fix lane).
 * Mirrors processProjectionDerivedGame in pages/api/v1/db/build-projection-derived-v2.ts using the
 * released lib code: one date at a time, games in order, concurrency 1, stop on the first failure.
 * Before each date: wait while pg_stat_activity connections > 40; a short gap between dates.
 *
 * Run from web/ of a clean export of the released SHA:
 *   NODE_PATH=. DOTENV_CONFIG_PATH=.env.local npx ts-node -r dotenv/config --transpile-only \
 *     --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/rebuild-forge-derived-2026-27.ts \
 *     [--start 2026-09-19] [--end 2026-11-06] [--plan | --check-connections]
 * FORGE_GUARD_DB_URL overrides only the guard's SUPABASE_DB_URL (use the confirmed session pooler).
 * --check-connections performs one read-only count and exits; it never loads the rebuild code.
 */
import { Client, type ClientConfig } from "pg";

const MAX_CONNECTIONS = 40;
const GAP_MS = 3_000;
const WAIT_MS = 15_000;
const MAX_WAITS = 20;

function arg(name: string, fallback: string) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (o: object) => console.log(JSON.stringify({ at: new Date().toISOString(), ...o }));

function dates(start: string, end: string) {
  const out: string[] = [];
  for (let d = new Date(`${start}T00:00:00Z`); d <= new Date(`${end}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export function connectionConfig(env: NodeJS.ProcessEnv): ClientConfig {
  const connectionString = env.FORGE_GUARD_DB_URL ?? env.SUPABASE_DB_URL;
  if (!connectionString) throw new Error("Set FORGE_GUARD_DB_URL or SUPABASE_DB_URL for the connection guard");
  let url: URL;
  let project: string;
  try {
    url = new URL(connectionString);
    const api = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    if (!/^[a-z0-9]+\.supabase\.co$/.test(api.hostname)) throw new Error();
    project = api.hostname.split(".")[0];
  } catch {
    // URL parser errors can include the credentials. Never forward them to the run log.
    throw new Error("Invalid guard or Supabase API URL");
  }
  const direct = url.hostname === `db.${project}.supabase.co` && url.username === "postgres";
  const sessionPooler = url.hostname.endsWith(".pooler.supabase.com") && url.username === `postgres.${project}`;
  if (!(["postgres:", "postgresql:"].includes(url.protocol)) || !(direct || sessionPooler)
      || (url.port && url.port !== "5432") || url.pathname !== "/postgres" || !url.password
      || url.search || url.hash) {
    throw new Error("Guard URL must target this Supabase project's postgres database on port 5432, without URL options");
  }
  return {
    host: url.hostname, port: 5432, database: "postgres",
    user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
    // Use explicit fields so connection-string options cannot override TLS or timeout settings.
    ssl: { rejectUnauthorized: true },
    application_name: "forge-derived-rebuild-connection-guard",
    connectionTimeoutMillis: 10_000, query_timeout: 10_000, statement_timeout: 10_000,
  };
}

export async function connectionCount(pg: Pick<Client, "query">): Promise<number> {
  // This executes on PostgreSQL even through Supavisor. Include idle sessions and this guard.
  // Keep the original database-scoped backend count (including workers), not pooler client count.
  const { rows } = await pg.query("select count(*)::int as n from pg_catalog.pg_stat_activity where datname = current_database()");
  const n: unknown = rows[0]?.n;
  if (rows.length !== 1 || typeof n !== "number" || !Number.isSafeInteger(n) || n < 1) {
    throw new Error("Invalid database connection count; stopping without admitting more work");
  }
  return n;
}

export async function waitForConnections(
  pg: Pick<Client, "query">, date: string, pause = sleep, writeLog = log,
): Promise<void> {
  for (let waits = 0; ; waits += 1) {
    const n = await connectionCount(pg);
    if (n <= MAX_CONNECTIONS) return;
    if (waits === MAX_WAITS) throw new Error(`Connections stayed above ${MAX_CONNECTIONS} (${n}); stopping before ${date}`);
    writeLog({ event: "wait_connections", date, connections: n });
    await pause(WAIT_MS);
  }
}

async function main() {
  const start = arg("--start", "2026-09-19");
  const end = arg("--end", "2026-11-06");
  if (start < "2026-09-19" || end > "2026-11-06" || start > end) throw new Error("Range outside the approved 2026-09-19..2026-11-06 bound");
  const plan = dates(start, end);
  log({ event: "plan", start, end, dates: plan.length });
  if (process.argv.includes("--plan")) return;

  const pg = new Client(connectionConfig(process.env));
  const totals = { games: 0, rewritten: 0, idempotent: 0, skipped: 0, playerRows: 0, teamRows: 0, goalieRows: 0 };
  try {
    await pg.connect();
    await pg.query("set default_transaction_read_only = on; set statement_timeout = '10s'");
    if (process.argv.includes("--check-connections")) {
      const connections = await connectionCount(pg);
      log({ event: "connection_check", connections, maxConnections: MAX_CONNECTIONS, ready: connections <= MAX_CONNECTIONS });
      if (connections > MAX_CONNECTIONS) process.exitCode = 1;
      return;
    }
    const { fetchProjectionDerivedGamesForDateRange, preparePlayerGameStrengthV2, prepareTeamGameStrengthV2 } = await import("lib/projections/derived/buildStrengthTablesV2");
    const { prepareGoalieGameV2 } = await import("lib/projections/derived/buildGoalieGameV2");
    const { persistProjectionGameDerivedV1, readProjectionGameInputManifest } = await import("lib/projections/derived/projectionDerivedPersistence");
    for (const date of plan) {
      await waitForConnections(pg, date);
      const games = await fetchProjectionDerivedGamesForDateRange({ startDate: date, endDate: date });
      for (const game of games) {
        let manifest;
        try {
          manifest = await readProjectionGameInputManifest({ gameId: game.id });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          if (message.startsWith("Projection input manifest is unavailable")) {
            totals.skipped += 1;
            log({ event: "skip", date, gameId: game.id, reason: "projection_inputs_unavailable" });
            continue;
          }
          throw e;
        }
        const player = await preparePlayerGameStrengthV2({ game });
        const teamRows = prepareTeamGameStrengthV2({ game, playerRows: player.rows });
        const goalie = prepareGoalieGameV2({ game, plays: player.plays });
        const receipt = await persistProjectionGameDerivedV1({ gameId: game.id, manifest, playerRows: player.rows, teamRows, goalie });
        totals.games += 1;
        if (receipt.idempotent) totals.idempotent += 1; else totals.rewritten += 1;
        totals.playerRows += receipt.observedPlayerRows;
        totals.teamRows += receipt.observedTeamRows;
        totals.goalieRows += receipt.observedGoalieRows;
        log({ event: "game", date, gameId: game.id, idempotent: receipt.idempotent, derivedVersion: receipt.derivedVersion,
          players: receipt.observedPlayerRows, goalPp: player.rows.reduce((s, r) => s + r.goals_pp, 0) });
      }
      log({ event: "date_done", date, games: games.length, totals });
      await sleep(GAP_MS);
    }
    log({ event: "complete", totals });
  } finally {
    await pg.end();
  }
}

if (require.main === module) {
  main().catch((e) => {
    log({ event: "stopped_on_failure", error: e instanceof Error ? e.message : String(e) });
    process.exitCode = 1;
  });
}
