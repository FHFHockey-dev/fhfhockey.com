/**
 * Streamlining 7.5 row-identity check (TJ-approved 2026-10-22, model-lane session).
 * For each player, sequentially: recompute the season's rolling rows (all strengths) with the
 * released writer code, split them exactly as the writer stores them (wide row + sidecar), and
 * compare every stored field with the stored wide row and stored sidecar. Read-only: a transport
 * fence rejects anything but GET/HEAD, and the run stops past 3,000 GETs.
 * Run from web/: NODE_PATH=. ts-node --transpile-only <this file> SEASON PLAYER_ID... > out.json
 */
/* eslint-disable @typescript-eslint/no-var-requires */
const dotenv = require("dotenv");
const path = require("path");
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const MAX_GETS = 3000;
let gets = 0;
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: any, init?: any) => {
  const method = String(init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  if (method !== "GET" && method !== "HEAD") throw new Error(`fence: ${method} refused`);
  gets += 1;
  if (gets > MAX_GETS) throw new Error(`fence: more than ${MAX_GETS} GETs`);
  return realFetch(input, init);
}) as typeof fetch;

const { createClient } = require("@supabase/supabase-js");
const { recomputePlayerRowsForValidation, splitRollingUpsertRowForDurableStorage } = require("lib/supabase/Upserts/fetchRollingPlayerAverages");
const { ROLLING_PLAYER_SUPPORT_PAYLOAD_TABLE } = require("lib/supabase/Upserts/rollingPlayerSupportPayload");

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const IGNORED = new Set(["updated_at", "created_at"]);
const TOL = 1e-6;

const norm = (v: unknown) => (typeof v === "string" && v !== "" && Number.isFinite(Number(v)) ? Number(v) : v);
function same(a: unknown, b: unknown) {
  if (a == null && b == null) return true;
  const x = norm(a), y = norm(b);
  if (typeof x === "number" && typeof y === "number") return Math.abs(x - y) <= TOL;
  if (typeof x === "object" || typeof y === "object") return JSON.stringify(x) === JSON.stringify(y);
  return x === y;
}

async function readAll(table: string, select: string, playerId: number, season: number) {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(select).eq("player_id", playerId).eq("season", season)
      .order("game_date", { ascending: true }).order("strength_state", { ascending: true }).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

async function main() {
  const [seasonArg, ...ids] = process.argv.slice(2);
  const season = Number(seasonArg);
  const results: any[] = [];
  for (const playerId of ids.map(Number)) {
    const before = gets;
    const { rows } = await recomputePlayerRowsForValidation({ playerId, season, skipDiagnostics: true });
    const stored = await readAll("rolling_player_game_metrics", "*", playerId, season);
    const storedSupport = await readAll(ROLLING_PLAYER_SUPPORT_PAYLOAD_TABLE, "player_id,game_date,strength_state,season,support_payload", playerId, season);
    const key = (r: any) => `${String(r.game_date).slice(0, 10)}|${r.strength_state}`;
    const wideByKey = new Map(stored.map((r: any) => [key(r), r]));
    const supportByKey = new Map(storedSupport.map((r: any) => [key(r), r]));
    const res = { playerId, recomputedRows: rows.length, storedRows: stored.length, storedSupportRows: storedSupport.length,
      strengths: {} as Record<string, number>, comparedFields: 0, missingStored: 0, missingRecomputed: 0, mismatches: 0,
      sample: [] as string[], gets: 0, byField: {} as Record<string, number>, byDate: {} as Record<string, number>, missingStoredKeys: [] as string[] };
    const seen = new Set<string>();
    for (const row of rows) {
      const k = key(row);
      seen.add(k);
      res.strengths[row.strength_state] = (res.strengths[row.strength_state] ?? 0) + 1;
      const { rankingRow, supportRow } = splitRollingUpsertRowForDurableStorage(row);
      const wide = wideByKey.get(k);
      if (!wide) { res.missingStored += 1; res.missingStoredKeys.push(k); continue; }
      for (const [field, value] of Object.entries(rankingRow)) {
        if (IGNORED.has(field)) continue;
        res.comparedFields += 1;
        if (!same(value, wide[field])) {
          res.mismatches += 1; res.byField[`wide.${field}`] = (res.byField[`wide.${field}`] ?? 0) + 1; res.byDate[k] = (res.byDate[k] ?? 0) + 1;
          if (res.sample.length < 10) res.sample.push(`${k} wide.${field} recomputed=${JSON.stringify(value)} stored=${JSON.stringify(wide[field])}`);
        }
      }
      const want = supportRow?.support_payload ?? null, have = supportByKey.get(k)?.support_payload ?? null;
      for (const part of ["historicalCompatibility", "deprecatedCompatibility", "alignedCountSupport"]) {
        const a = (want as any)?.[part] ?? null, b = (have as any)?.[part] ?? null;
        const fields = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
        if (part === "alignedCountSupport") { res.comparedFields += 1; if (!same(a, b)) { res.mismatches += 1; if (res.sample.length < 10) res.sample.push(`${k} support.${part} differs`); } continue; }
        for (const f of fields) {
          res.comparedFields += 1;
          if (!same(a?.[f], b?.[f])) {
            res.mismatches += 1; res.byField[`support.${f}`] = (res.byField[`support.${f}`] ?? 0) + 1; res.byDate[k] = (res.byDate[k] ?? 0) + 1;
            if (res.sample.length < 10) res.sample.push(`${k} support.${part}.${f} recomputed=${JSON.stringify(a?.[f])} stored=${JSON.stringify(b?.[f])}`);
          }
        }
      }
    }
    res.missingRecomputed = stored.filter((r: any) => !seen.has(key(r))).length;
    res.gets = gets - before;
    results.push(res);
    console.error(`player ${playerId}: rows ${rows.length}/${stored.length} fields ${res.comparedFields} mismatches ${res.mismatches} missing ${res.missingStored}/${res.missingRecomputed} gets ${res.gets} total ${gets}`);
  }
  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), season, totalGets: gets, results }, null, 2));
}

main().catch((error) => { console.error(`row-identity failed: ${error instanceof Error ? error.message : error} (gets ${gets})`); process.exitCode = 1; });
