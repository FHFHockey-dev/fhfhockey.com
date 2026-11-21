import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";
import type { World } from "./world/store";

const pgBin = process.env.FORGE_TEST_PG_BIN ?? "/opt/homebrew/opt/postgresql@15/bin";
const python = process.env.FORGE_TEST_PYTHON ?? "python3";
const port = 55431;
const hasPg = ["initdb", "pg_ctl"].every(bin => existsSync(join(pgBin, bin)));
const hasPython = (hasPg || !!process.env.FORGE_TEST_PYTHON) && spawnSync(python, ["--version"], { stdio: "ignore" }).status === 0;
export const publicationDbAvailable = (hasPg && hasPython)
  || (!hasPg && process.env.FORGE_TEST_PG_BIN !== undefined)
  || (!hasPython && process.env.FORGE_TEST_PYTHON !== undefined);
export const publicationFixtureUrl = "https://publication-fixture.invalid";
export const publicationFixtureKey = "synthetic-service-key";
const pgEnv: NodeJS.ProcessEnv = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("PG"))), NODE_ENV: "test" };
const migrations = resolve(__dirname, "../../../../../supabase");
const bridgeTables = ["forge_runs", "player_forecast_source_observations", "forge_player_projections", "forge_goalie_projections", "forge_reserve_projections"];
const publicationRpc = new Set(["forge_pregame_publish_v1", "forge_pregame_publication_receipt_v1",
  "forge_hosted_publish_v2","forge_hosted_stage_begin_v2","forge_hosted_stage_finish_v2"]);

/** Socket-only PostgreSQL. The fetch adapter is the RPC transport, and the only source of bridge output rows is SQL. */
export async function startPublicationDb() {
  if (!hasPg || !hasPython) throw new Error("The publication fixture needs working PostgreSQL binaries and Python 3.");
  const socketDir = mkdtempSync(join(tmpdir(), "forge-pg-"));
  const dataDir = join(socketDir, "data");
  const run = (bin: string, args: string[]) => execFileSync(join(pgBin, bin), args, { env: pgEnv, stdio: "pipe" });
  const client = () => new Client({ host: socketDir, port, user: "postgres", database: "postgres", ssl: false,
    options: "-c timezone=UTC", connectionTimeoutMillis: 2000, statement_timeout: 8000 });
  const owner = client();
  const service = client();
  let started = false;
  const close = async () => {
    await Promise.allSettled([service.end(), owner.end()]);
    try { if (started) run("pg_ctl", ["-D", dataDir, "-m", "immediate", "-w", "stop"]); }
    finally { rmSync(socketDir, { recursive: true, force: true }); }
  };
  try {
    run("initdb", ["-D", dataDir, "-U", "postgres", "-A", "trust", "--no-sync"]);
    run("pg_ctl", ["-D", dataDir, "-l", join(socketDir, "postgres.log"), "-w", "-o",
      `-p ${port} -k ${socketDir} -c listen_addresses= -c fsync=off`, "start"]);
    started = true;
    await Promise.all([owner.connect(), service.connect()]);
    const schema = execFileSync(python, ["-I", join(migrations, "tests/forge_pregame_publication.py"), "--schema"],
      { env: pgEnv, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
    await owner.query(schema);
    await service.query("set role service_role");
    const sdk = (afterRpc?: (name: string) => Promise<void>) => createClient(publicationFixtureUrl, publicationFixtureKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      global: { fetch: async (input, init) => {
        const url = new URL(String(input));
        const name = /^\/rest\/v1\/rpc\/(forge_pregame_[a-z0-9_]+|forge_hosted_publish_v2|forge_hosted_stage_(?:begin|finish)_v2|read_forge_game_revisions)$/.exec(url.pathname)?.[1];
        if (url.origin !== publicationFixtureUrl || !name || init?.method !== "POST" || typeof init.body !== "string") {
          throw new Error(`unsupported fixture request (${url.pathname})`);
        }
        const params = Object.entries(JSON.parse(init.body) as Record<string, unknown>);
        if (params.some(([key]) => !/^p_[a-z0-9_]+$/.test(key))) throw new Error("invalid fixture RPC parameters");
        // pg's array encoding is for PostgreSQL array arguments; publication row arrays are JSONB.
        const args = params.map(([, value]) => value !== null && typeof value === "object" ? JSON.stringify(value) : value);
        const binds = params.map(([key], index) => `${key} => $${index + 1}`).join(",");
        try {
          const result = publicationRpc.has(name)
            ? await service.query(`select public.${name}(${binds}) as value`, args)
            : await service.query(`select to_jsonb(row) as value from public.${name}(${binds}) row`, args);
          if (afterRpc) await afterRpc(name);
          const single = new Headers(init.headers).get("accept")?.includes("vnd.pgrst.object");
          return Response.json(publicationRpc.has(name) || single ? result.rows[0]?.value ?? null : result.rows.map(row => row.value));
        } catch (error) {
          const fault = error as { code?: string; message?: string };
          return Response.json({ code: fault.code, message: fault.message }, { status: 400 });
        }
      } },
    });
    const readBridgeTables = async (world: World) => {
      const rows = await Promise.all(bridgeTables.map(async table => {
        const result = await service.query(`select to_jsonb(row) as value from public.${table} row`);
        return [table, result.rows.map(row => row.value)] as const;
      }));
      return { ...world, tables: { ...world.tables, ...Object.fromEntries(rows) } };
    };
    const seed = async (world: World, gameId: number) => {
      const game = world.tables.games.find(row => row.id === gameId)!;
      await owner.query(`insert into public.seasons (id,"startDate","endDate","regularSeasonEndDate","numberOfGames")
        select id,"startDate","endDate","regularSeasonEndDate","numberOfGames" from jsonb_to_recordset($1::jsonb) as source(
          id bigint,"startDate" date,"endDate" date,"regularSeasonEndDate" date,"numberOfGames" smallint)`, [JSON.stringify(world.tables.seasons)]);
      await owner.query(`insert into public.teams (id,abbreviation,name)
        select id,abbreviation,name from jsonb_to_recordset($1::jsonb) as source(id smallint,abbreviation char(3),name text)`,
      [JSON.stringify(world.tables.teams)]);
      await owner.query(`insert into public.games (id,date,"seasonId","startTime","homeTeamId","awayTeamId",type) values ($1,$2,$3,$4,$5,$6,$7)`,
        [game.id, game.date, game.seasonId, game.startTime, game.homeTeamId, game.awayTeamId, game.type]);
      await owner.query(`insert into public.players (id, "firstName", "lastName", "fullName", position, "birthDate", "heightInCentimeters", "weightInKilograms", team_id)
        select id, 'Fixture', id::text, "fullName", position, '2000-01-01', 180, 80, team_id
        from jsonb_to_recordset($1::jsonb) as source(id bigint,"fullName" text,position public."NHL_Position_Code",team_id smallint)`,
      [JSON.stringify(world.tables.players)]);
      await owner.query(`insert into public.roster_optimizer_team_games (game_key,season,source_game_id,source_season_id,game_date,start_time,game_type,
        game_status,schedule_status,mapping_status,team_id,team_abbreviation,opponent_team_id,opponent_abbreviation,home_away,source_url,source_updated_at,fetched_at)
        select game_key,season,source_game_id,source_season_id,$2::date,start_time,2,game_status,schedule_status,'unmapped',team_id,team_abbreviation,
          opponent_team_id,opponent_abbreviation,case when team_id = $3 then 'home' else 'away' end,'https://fixture.invalid',source_updated_at,fetched_at
        from jsonb_to_recordset($1::jsonb) as source(game_key text,season text,source_game_id bigint,source_season_id bigint,start_time timestamptz,
          game_status text,schedule_status text,team_id smallint,team_abbreviation char(3),opponent_team_id smallint,opponent_abbreviation char(3),
          source_updated_at timestamptz,fetched_at timestamptz)`,
      [JSON.stringify(world.tables.roster_optimizer_team_games), game.date, game.homeTeamId]);
    };
    return { owner, sdk, readBridgeTables, seed, close };
  } catch (error) {
    await close();
    throw error;
  }
}
