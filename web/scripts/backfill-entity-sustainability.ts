// Backfill of the team/goalie sustainability tables from this machine.
//
// Without --write it is a rehearsal: it computes the rows, checks foreign
// keys and prints counts, and writes nothing. With --write it upserts (bands
// first, then scores, in paced chunks) and reads the counts back. Writing to
// production needs explicit approval for the exact season and dates.
//
// Usage (from web/):
//   NODE_PATH=. npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' \
//     scripts/backfill-entity-sustainability.ts --season 20262027 --start 2026-09-29 --end 2026-11-22 [--write] [--pause-ms 250]

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { computeEntitySustainability } from "lib/sustainability/entityProducerData";
import { upsertEntitySustainabilityRows } from "lib/sustainability/entityProducerWrite";

dotenv.config({ path: ".env.local", quiet: true });

const MAX_DATES = 62;

function arg(name: string, fallback?: string): string {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (value && !value.startsWith("--")) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing --${name}`);
}

async function missingIds(client: any, table: string, ids: number[]): Promise<number[]> {
  const found = new Set<number>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await client.from(table).select("id").in("id", ids.slice(i, i + 200));
    if (error) throw new Error(`${table} check failed: ${error.message}`);
    for (const row of data ?? []) found.add(Number(row.id));
  }
  return ids.filter((id) => !found.has(id));
}

async function countRows(client: any, table: string, entityType: string, start: string, end: string) {
  const { count, error } = await client
    .from(table)
    .select("snapshot_date", { count: "exact", head: true })
    .eq("entity_type", entityType)
    .gte("snapshot_date", start)
    .lte("snapshot_date", end);
  if (error) throw new Error(`${table} count failed: ${error.message}`);
  return count ?? 0;
}

async function main() {
  const seasonId = Number(arg("season"));
  const start = arg("start");
  const end = arg("end");
  const write = process.argv.includes("--write");
  const pauseMs = Number(arg("pause-ms", "250"));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const run = await computeEntitySustainability({ client, seasonId, startDate: start, endDate: end });
  if (!run.dates.length) throw new Error(`No publishable dates (readyThrough ${run.readyThrough})`);
  if (run.dates.length > MAX_DATES) throw new Error(`${run.dates.length} dates; split into calls of at most ${MAX_DATES}`);
  const first = run.dates[0];
  const last = run.dates[run.dates.length - 1];
  const count = (type: string) => ({
    scores: run.scores.filter((s) => s.entity_type === type).length,
    bands: run.bands.filter((b) => b.entity_type === type).length
  });
  const teamIds = [...new Set(run.scores.map((s) => s.team_id).filter((id): id is number => id != null))];
  const playerIds = [...new Set(run.scores.map((s) => s.player_id).filter((id): id is number => id != null))];
  const fk = {
    missingTeams: await missingIds(client, "teams", teamIds),
    missingPlayers: await missingIds(client, "players", playerIds)
  };
  const summary = {
    mode: write ? "write" : "rehearsal (no writes)",
    seasonId: run.seasonId,
    dates: `${first}..${last} (${run.dates.length})`,
    readyThrough: run.readyThrough,
    team: count("team"),
    goalie: count("goalie"),
    chunks: Math.ceil(run.bands.length / 400) + Math.ceil(run.scores.length / 400),
    fk
  };
  console.log(JSON.stringify(summary, null, 2));
  if (fk.missingTeams.length || fk.missingPlayers.length) throw new Error("Foreign keys missing; nothing written");
  if (!write) return;

  const started = Date.now();
  let lastLog = 0;
  await upsertEntitySustainabilityRows(client, run, {
    pauseMs,
    onChunk: (table, done) => {
      if (Date.now() - lastLog > 15000) {
        lastLog = Date.now();
        console.log(`${table}: ${done} rows`);
      }
    }
  });
  const readback = {
    teamScores: await countRows(client, "entity_sustainability_scores_daily", "team", first, last),
    teamBands: await countRows(client, "entity_sustainability_bands_daily", "team", first, last),
    goalieScores: await countRows(client, "entity_sustainability_scores_daily", "goalie", first, last),
    goalieBands: await countRows(client, "entity_sustainability_bands_daily", "goalie", first, last)
  };
  console.log(JSON.stringify({ written: true, elapsedMs: Date.now() - started, readback }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
