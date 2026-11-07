/**
 * Bounded local rebuild of the FORGE derived tables for 2026-27 (forge-pp-fix lane).
 * Mirrors processProjectionDerivedGame in pages/api/v1/db/build-projection-derived-v2.ts using the
 * released lib code: one date at a time, games in order, concurrency 1, stop on the first failure.
 * Before each date: wait while pg_stat_activity connections > 40; a short gap between dates.
 *
 * Run from web/ of a clean export of the released SHA:
 *   NODE_PATH=. DOTENV_CONFIG_PATH=.env.local npx ts-node -r dotenv/config --transpile-only \
 *     --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/rebuild-forge-derived-2026-27.ts \
 *     [--start 2026-09-19] [--end 2026-11-06] [--plan]
 */
import { Client } from "pg";

import { fetchProjectionDerivedGamesForDateRange, preparePlayerGameStrengthV2, prepareTeamGameStrengthV2 } from "lib/projections/derived/buildStrengthTablesV2";
import { prepareGoalieGameV2 } from "lib/projections/derived/buildGoalieGameV2";
import { persistProjectionGameDerivedV1, readProjectionGameInputManifest } from "lib/projections/derived/projectionDerivedPersistence";

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

async function connectionCount(pg: Client): Promise<number> {
  const { rows } = await pg.query("select count(*)::int as n from pg_stat_activity where datname = current_database()");
  return rows[0].n;
}

async function main() {
  const start = arg("--start", "2026-09-19");
  const end = arg("--end", "2026-11-06");
  if (start < "2026-09-19" || end > "2026-11-06" || start > end) throw new Error("Range outside the approved 2026-09-19..2026-11-06 bound");
  const plan = dates(start, end);
  log({ event: "plan", start, end, dates: plan.length });
  if (process.argv.includes("--plan")) return;

  const pg = new Client({ connectionString: process.env.SUPABASE_DB_URL, statement_timeout: 10_000 });
  await pg.connect();
  const totals = { games: 0, rewritten: 0, idempotent: 0, skipped: 0, playerRows: 0, teamRows: 0, goalieRows: 0 };
  try {
    for (const date of plan) {
      let waits = 0;
      for (let n = await connectionCount(pg); n > MAX_CONNECTIONS; n = await connectionCount(pg)) {
        if (++waits > MAX_WAITS) throw new Error(`Connections stayed above ${MAX_CONNECTIONS} (${n}); stopping before ${date}`);
        log({ event: "wait_connections", date, connections: n });
        await sleep(WAIT_MS);
      }
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

main().catch((e) => {
  log({ event: "stopped_on_failure", error: e instanceof Error ? e.message : String(e) });
  process.exit(1);
});
