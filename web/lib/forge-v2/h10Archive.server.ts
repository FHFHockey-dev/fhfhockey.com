/**
 * Monthly archive of the partitioned FORGE v2 history (migration 20261123210000; TJ Q2, 2026-11-23). An operator
 * procedure, never a route: export a closed month's partitions, checksum them, restore them into an isolated database,
 * reconcile every row, reproduce an as-of lookup and a backtest from the restored copy, and only then write the
 * manifest. Detaching and dropping a production partition is a separate, approved step outside this file.
 *
 * Format: one gzip'd CSV per table and month (`COPY … TO STDOUT (FORMAT csv, HEADER)` in insertion order, UTC), so a
 * restore is a plain COPY into the same schema and every column (payload bytes, hashes, transaction ids, receipt and
 * insert clocks, ordinals) comes back unchanged. Exports and restores run through `psql`, streamed.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { PassThrough, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip, createGzip } from "node:zlib";
import { CATEGORIES } from "./contracts";
import { canonicalJson } from "./identity";
import { contentHash } from "./hash.server";

export const ARCHIVE_TABLES = ["forge_v2_vintages", "forge_v2_publication_receipts", "forge_v2_goalie_vintages", "forge_v2_goalie_publication_receipts", "forge_v2_records", "forge_h10_interval_editions"] as const;
export type ArchiveTable = typeof ARCHIVE_TABLES[number];
const ORDER: Record<ArchiveTable, string> = {
  forge_v2_vintages: "inserted_at, id", forge_v2_goalie_vintages: "inserted_at, id",
  forge_v2_publication_receipts: "inserted_at, vintage_id", forge_v2_goalie_publication_receipts: "inserted_at, vintage_id",
  forge_v2_records: "recorded_at, ordinal",
  forge_h10_interval_editions: "inserted_at, id",
};
/** "2026-11" → the partition of `table` holding rows inserted in that UTC month. */
export const partitionOf = (table: ArchiveTable, month: string) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("archive_month_invalid");
  return `${table}_${month.replace("-", "_")}`;
};
export const monthBounds = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return { from: new Date(Date.UTC(y, m - 1, 1)).toISOString(), to: new Date(Date.UTC(y, m, 1)).toISOString() };
};

/** A psql connection (local binaries). Credentials, if any, come from the caller's environment, never from here. */
export interface PsqlTarget { bin: string; host: string; port: number; user: string; database: string; env?: NodeJS.ProcessEnv; options?: string }
function psql(target: PsqlTarget, command: string) {
  const child = spawn(join(target.bin, "psql"), ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-h", target.host, "-p", String(target.port), "-U", target.user, "-d", target.database, "-c", command],
    { env: { ...(target.env ?? process.env), PGTZ: "UTC", PGCLIENTENCODING: "UTF8", ...(target.options ? { PGOPTIONS: target.options } : {}) }, stdio: ["pipe", "pipe", "pipe"] });
  let errors = "";
  child.stderr.on("data", chunk => { errors += String(chunk); });
  const done = new Promise<void>((resolve, reject) => child.on("close", code => code === 0 ? resolve() : reject(new Error(`psql_failed:${code}:${errors.slice(0, 300)}`))));
  return { child, done };
}

export interface ArchiveFile { table: ArchiveTable; month: string; partition: string; path: string; rawBytes: number; bytes: number; rawSha256: string; sha256: string }
/** Streams one month partition to `<dir>/<partition>.csv.gz`, hashing the raw CSV and the gzip bytes. */
export async function exportPartition(target: PsqlTarget, table: ArchiveTable, month: string, dir: string): Promise<ArchiveFile> {
  const partition = partitionOf(table, month), path = join(dir, `${partition}.csv.gz`);
  const { child, done } = psql(target, `\\copy (select * from forge_v2_private.${partition} order by ${ORDER[table]}) to stdout with (format csv, header)`);
  child.stdin.end();
  const raw = createHash("sha256"); let rawBytes = 0;
  const tap = new Transform({ transform(chunk, _encoding, callback) { raw.update(chunk); rawBytes += chunk.length; callback(null, chunk); } });
  await Promise.all([pipeline(child.stdout, tap, createGzip({ level: 9 }), createWriteStream(path)), done]);
  return { table, month, partition, path, rawBytes, bytes: (await stat(path)).size, rawSha256: raw.digest("hex"), sha256: await fileSha256(path) };
}
export async function fileSha256(path: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk as Uint8Array);
  return hash.digest("hex");
}

/** Restores one archive file into the same partition of an isolated database. Triggers are off for the session
 * (`session_replication_role = replica`, superuser in the isolated database only), so stored hashes, transaction ids
 * and clocks are copied, never recomputed. The file's checksum is verified first. */
export async function restorePartition(target: PsqlTarget, file: Pick<ArchiveFile, "table" | "month" | "path" | "sha256">) {
  if (await fileSha256(file.path) !== file.sha256) throw new Error("archive_checksum_mismatch");
  const partition = partitionOf(file.table, file.month), { from, to } = monthBounds(file.month);
  const create = psql(target, `create table if not exists forge_v2_private.${partition} partition of forge_v2_private.${file.table} for values from ('${from}') to ('${to}')`);
  create.child.stdin.end(); await create.done;
  const { child, done } = psql({ ...target, options: "-c session_replication_role=replica" }, `\\copy forge_v2_private.${partition} from stdin with (format csv, header)`);
  const input = new PassThrough();
  await Promise.all([pipeline(createReadStream(file.path), createGunzip(), input, child.stdin), done]);
}

/** Minimal client: one connection, so the session time zone applies to every statement. */
export interface OneClient { query: <T = Record<string, unknown>>(text: string, values?: unknown[]) => Promise<{ rows: T[] }> }

/** Row count and a digest over every row's full text (all columns, UTC), in archive order. Equal digests on the
 * source partition and the restored one mean every key and every byte came back. */
export async function partitionDigest(db: OneClient, table: ArchiveTable, month: string) {
  await db.query("set time zone 'UTC'");
  const partition = partitionOf(table, month);
  const { rows } = await db.query<{ n: number; digest: string; keys: string }>(`select count(*)::int as n,
    encode(sha256(convert_to(coalesce(string_agg(md5(t::text), '' order by ${ORDER[table]}), ''), 'UTF8')), 'hex') as digest,
    encode(sha256(convert_to(coalesce(string_agg(${table.includes("receipts") ? "t.vintage_id" : "t.id"}::text, ',' order by ${ORDER[table]}), ''), 'UTF8')), 'hex') as keys
    from forge_v2_private.${partition} t`);
  return { rows: rows[0].n, digest: rows[0].digest, keysDigest: rows[0].keys };
}

/** As-of lookup, the accountability question: for each (player, game, as-of) the latest forecast whose input cutoff
 * was at or before the as-of time and whose publication receipt was at or before `publishedBy` (default: as-of).
 * Skater and goalie forecasts alike. */
export async function asOfLookup(db: OneClient, queries: ReadonlyArray<{ playerId: number; gameId: number; asOf: string; publishedBy?: string }>) {
  const { rows } = await db.query<{ q: number; id: string | null; output_hash: string | null; confirmed_at: string | null; cutoff: string | null }>(`
    select q.ord as q, f.id, f.output_hash, f.confirmed_at, f.cutoff from unnest($1::bigint[], $2::bigint[], $3::timestamptz[], $4::timestamptz[]) with ordinality as q(player_id, game_id, as_of, published_by, ord)
    left join lateral (
      select v.id, v.output_hash, to_char(r.confirmed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as confirmed_at, v.payload::jsonb->>'inputCutoffAt' as cutoff, v.issuance_sequence
      from forge_v2_private.forge_v2_vintages v join forge_v2_private.forge_v2_publication_receipts r on r.vintage_id = v.id and r.output_hash = v.output_hash
      where v.player_id = q.player_id and v.game_id = q.game_id and r.confirmed_at <= q.published_by and (v.payload::jsonb->>'inputCutoffAt')::timestamptz <= q.as_of
      union all
      select v.id, v.output_hash, to_char(r.confirmed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), v.payload::jsonb->>'inputCutoffAt', v.issuance_sequence
      from forge_v2_private.forge_v2_goalie_vintages v join forge_v2_private.forge_v2_goalie_publication_receipts r on r.vintage_id = v.id and r.output_hash = v.output_hash
      where v.player_id = q.player_id and v.game_id = q.game_id and r.confirmed_at <= q.published_by and (v.payload::jsonb->>'inputCutoffAt')::timestamptz <= q.as_of
      order by cutoff desc, issuance_sequence desc limit 1) f on true
    order by q.ord`, [queries.map(q => q.playerId), queries.map(q => q.gameId), queries.map(q => q.asOf), queries.map(q => q.publishedBy ?? q.asOf)]);
  return { results: rows, sha256: contentHash(rows) };
}

/** Backtest over one issuance month: each skater target's latest edition issued before its game, scored with its own
 * issued linear-seven weights, against an outcome table. Mean absolute error and bias, by horizon. */
export async function backtest(db: OneClient, month: string, outcome: (playerId: number, gameId: number) => Record<string, number> | null) {
  const { from, to } = monthBounds(month);
  const { rows } = await db.query<{ payload: string }>(`select distinct on (v.player_id, v.game_id) v.payload
    from forge_v2_private.forge_v2_vintages v join forge_v2_private.forge_v2_publication_receipts r on r.vintage_id = v.id and r.output_hash = v.output_hash
    where v.inserted_at >= $1 and v.inserted_at < $2 and (v.payload::jsonb->>'inputCutoffAt')::timestamptz < (v.payload::jsonb->>'scheduledStartAt')::timestamptz
    order by v.player_id, v.game_id, (v.payload::jsonb->>'inputCutoffAt')::timestamptz desc, v.issuance_sequence desc`, [from, to]);
  const byHorizon = new Map<number, { n: number; abs: number; bias: number }>();
  let scored = 0, missing = 0;
  for (const { payload } of rows) {
    const v = JSON.parse(payload) as { playerId: number; gameId: number; horizon: number; means: Record<string, { state: string; value?: number }>; scoring: { weights: Record<string, number> } };
    const actual = outcome(v.playerId, v.gameId);
    if (!actual || CATEGORIES.some(c => v.means[c]?.state !== "available")) { missing += 1; continue; }
    const forecast = CATEGORIES.reduce((sum, c) => sum + v.scoring.weights[c] * (v.means[c].value as number), 0);
    const realized = CATEGORIES.reduce((sum, c) => sum + v.scoring.weights[c] * actual[c], 0);
    const cell = byHorizon.get(v.horizon) ?? { n: 0, abs: 0, bias: 0 };
    cell.n += 1; cell.abs += Math.abs(forecast - realized); cell.bias += forecast - realized; byHorizon.set(v.horizon, cell);
    scored += 1;
  }
  const horizons = [...byHorizon].sort((a, b) => a[0] - b[0]).map(([horizon, c]) => ({ horizon, n: c.n, mae: Number((c.abs / c.n).toFixed(9)), bias: Number((c.bias / c.n).toFixed(9)) }));
  const result = { month, targets: rows.length, scored, missing, horizons };
  return { result, sha256: contentHash(JSON.parse(canonicalJson(result))) };
}
