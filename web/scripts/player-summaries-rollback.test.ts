// @vitest-environment node
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PLAYER_SUMMARY_PARTITION_PREFIX, sha256Hex } from "../lib/underlying-stats/playerSummaryRollbackPlan";
import { runPlayerSummaryBackup } from "./player-summaries-backup";
import { runPlayerSummaryRollback, type RollbackReceipt } from "./player-summaries-rollback";

type RawRow = {
  id: number; game_id: number; endpoint: string; season_id: number | null; game_date: string | null;
  source_url: string; payload_hash: string; payload: Record<string, unknown>; fetched_at: string; created_at: string;
};

/** In-memory nhl_api_game_payloads_raw + games, with the append-only and unique-hash rules. */
class FakeDb {
  raw: RawRow[] = [];
  games: Array<{ id: number; date: string; seasonId: number }> = [];
  inserts: number[] = [];
  busyNext = 0;
  beforeInsert?: () => void;
  private nextId = 1;

  add(row: Omit<RawRow, "id" | "created_at" | "endpoint" | "season_id" | "game_date">) {
    if (this.raw.some((r) => r.game_id === row.game_id && r.payload_hash === row.payload_hash)) return null;
    const stored = { endpoint: "landing", season_id: 20262027, game_date: "2026-10-12", created_at: row.fetched_at, ...row, id: this.nextId++ };
    this.raw.push(stored);
    return stored;
  }

  client(): SupabaseClient {
    const db = this;
    return {
      from(table: string) {
        const filters: Array<(row: Record<string, unknown>) => boolean> = [];
        let range: [number, number] | null = null;
        let insertRows: RawRow[] | null = null;
        const builder = {
          select() { return builder; },
          eq(column: string, value: unknown) { filters.push((r) => r[column] === value); return builder; },
          gte(column: string, value: string) { filters.push((r) => String(r[column]) >= value); return builder; },
          lte(column: string, value: string) { filters.push((r) => String(r[column]) <= value); return builder; },
          like(column: string, pattern: string) { filters.push((r) => String(r[column]).startsWith(pattern.replace(/%$/, ""))); return builder; },
          in(column: string, values: unknown[]) { filters.push((r) => values.includes(r[column])); return builder; },
          order() { return builder; },
          range(from: number, to: number) { range = [from, to]; return builder; },
          insert(rows: RawRow[]) { insertRows = rows; return builder; },
          then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
            try {
              if (insertRows) {
                if (db.busyNext > 0) { db.busyNext -= 1; return Promise.resolve({ data: null, error: { code: "P0001", message: "NHL_NORMALIZATION_WRITER_BUSY" } }).then(resolve, reject); }
                db.beforeInsert?.();
                const rows = insertRows;
                if (rows.some((row) => db.raw.some((r) => r.game_id === row.game_id && r.endpoint === row.endpoint && r.payload_hash === row.payload_hash))) {
                  return Promise.resolve({ data: null, error: { code: "23505", message: "duplicate key" } }).then(resolve, reject);
                }
                db.inserts.push(rows.length);
                for (const row of rows) db.raw.push({ ...row, id: db.nextId++, created_at: row.fetched_at });
                return Promise.resolve({ data: null, error: null }).then(resolve, reject);
              }
              const source = (table === "games" ? db.games : db.raw) as unknown as Record<string, unknown>[];
              let data = source.filter((r) => filters.every((f) => f(r))).sort((a, b) => Number(a.id) - Number(b.id));
              if (range) data = data.slice(range[0], range[1] + 1);
              return Promise.resolve({ data: JSON.parse(JSON.stringify(data)), error: null }).then(resolve, reject);
            } catch (error) { return Promise.reject(error).then(resolve, reject); }
          },
        };
        return builder;
      },
    } as unknown as SupabaseClient;
  }
}

const G1 = 2026020087, G2 = 2026020088;
const url = (strength: string, game: number) => `${PLAYER_SUMMARY_PARTITION_PREFIX}individual/${strength}/${game}`;
const payload = (game: number, generatedAt: string, value: number) => ({ version: 1, generatedAt, game: { id: game, seasonId: 20262027 }, rows: [{ value }] });

/** Readers' view: newest row per partition (fetched_at desc, id asc). */
function readerView(db: FakeDb) {
  const view = new Map<string, unknown>();
  for (const row of [...db.raw].sort((a, b) => Date.parse(b.fetched_at) - Date.parse(a.fetched_at) || a.id - b.id)) {
    if (!view.has(row.source_url)) view.set(row.source_url, (row.payload as { rows: unknown }).rows);
  }
  return view;
}

function seedRebuild(db: FakeDb) {
  for (const [game, strength, value] of [[G1, "allStrengths", 1], [G1, "fiveOnFive", 2], [G2, "allStrengths", 3]] as const) {
    db.add({ game_id: game, source_url: url(strength, game), payload_hash: `old-${game}-${strength}`, payload: payload(game, "2026-10-12T04:00:00Z", value), fetched_at: "2026-10-12T04:00:00Z" });
  }
  const before = readerView(db);
  // The rebuild: new content for two partitions, one untouched, one partition that did not exist.
  db.add({ game_id: G1, source_url: url("allStrengths", G1), payload_hash: "new-1", payload: payload(G1, "2026-11-09T10:00:00.123456Z", 10), fetched_at: "2026-11-09T10:00:00.123456+00:00" });
  db.add({ game_id: G2, source_url: url("allStrengths", G2), payload_hash: "new-3", payload: payload(G2, "2026-11-09T10:00:00.123456Z", 30), fetched_at: "2026-11-09T10:00:00.123456+00:00" });
  db.add({ game_id: G2, source_url: url("powerPlay", G2), payload_hash: "new-4", payload: payload(G2, "2026-11-09T10:00:00.123456Z", 40), fetched_at: "2026-11-09T10:00:00.123456+00:00" });
  return before;
}

describe("player summary backup and rollback scripts", () => {
  let dir: string;
  const now = () => new Date("2026-11-09T12:00:00Z");
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "player-summary-rollback-")); });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  async function backup(db: FakeDb, out = join(dir, "backup")) {
    const result = await runPlayerSummaryBackup(["--out-dir", out, "--game-ids", `${G1},${G2}`, "--pause-ms", "0"], { supabase: db.client(), now });
    return { out, result };
  }

  it("exports the newest row per partition, private and sha256-verified, and re-verifies offline", async () => {
    const db = new FakeDb();
    db.add({ game_id: G1, source_url: url("allStrengths", G1), payload_hash: "older", payload: payload(G1, "2026-10-01T00:00:00Z", 0), fetched_at: "2026-10-01T00:00:00Z" });
    seedRebuild(db);
    const { out, result } = await backup(db);
    expect(result).toMatchObject({ status: "exported_and_verified", games: 2, partitions: 4, versionsScanned: 7, databaseWrites: 0 });
    const lines = readFileSync(join(out, "rows.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    expect(lines.map((l) => l.payload_hash).sort()).toEqual(["new-1", "new-3", "new-4", `old-${G1}-fiveOnFive`]);
    expect(JSON.parse(readFileSync(join(out, "manifest.json"), "utf8")).rowsSha256).toBe(sha256Hex(readFileSync(join(out, "rows.jsonl"), "utf8")));
    expect(statSync(join(out, "rows.jsonl")).mode & 0o777).toBe(0o600);
    expect(await runPlayerSummaryBackup(["--verify", out])).toMatchObject({ status: "verified", partitions: 4, databaseReads: 0 });
    await expect(backup(db, out)).rejects.toThrow(/EEXIST/);
  });

  it("resolves a date window from games and enforces the game cap", async () => {
    const db = new FakeDb();
    db.games = [{ id: G1, date: "2026-10-12", seasonId: 20262027 }, { id: G2, date: "2026-10-13", seasonId: 20262027 }];
    seedRebuild(db);
    const args = ["--out-dir", join(dir, "w"), "--season-id", "20262027", "--start-date", "2026-10-12", "--end-date", "2026-10-12", "--pause-ms", "0"];
    expect(await runPlayerSummaryBackup(args, { supabase: db.client(), now })).toMatchObject({ games: 1, partitions: 2 });
    await expect(runPlayerSummaryBackup([...args.slice(2), "--out-dir", join(dir, "x"), "--max-games", "1", "--end-date", "2026-10-13"], { supabase: db.client(), now })).rejects.toThrow(/above --max-games/);
  });

  it("restores the pre-rebuild reader view after a rebuild; naive same-hash re-insert would not", async () => {
    const pre = new FakeDb();
    for (const [game, strength, value] of [[G1, "allStrengths", 1], [G1, "fiveOnFive", 2], [G2, "allStrengths", 3]] as const) {
      pre.add({ game_id: game, source_url: url(strength, game), payload_hash: `old-${game}-${strength}`, payload: payload(game, "2026-10-12T04:00:00Z", value), fetched_at: "2026-10-12T04:00:00Z" });
    }
    const before = readerView(pre);
    const { out } = await backup(pre);
    // Same database after the rebuild.
    seedRebuild(pre);
    const rebuilt = readerView(pre);
    expect(rebuilt.get(url("allStrengths", G1))).toEqual([{ value: 10 }]);

    // A naive restore of the old row is a unique-hash no-op: the reader still sees the rebuild.
    expect(pre.add({ game_id: G1, source_url: url("allStrengths", G1), payload_hash: `old-${G1}-allStrengths`, payload: payload(G1, "2026-10-12T04:00:00Z", 1), fetched_at: "2026-11-09T11:00:00Z" })).toBeNull();
    expect(readerView(pre).get(url("allStrengths", G1))).toEqual([{ value: 10 }]);

    const dry = await runPlayerSummaryRollback(["--backup", out, "--pause-ms", "0"], { supabase: pre.client(), now });
    expect(dry).toMatchObject({ status: "dry_run", partitions: 3, restore: 2, unchanged: 1, newPartitionsNotRestorable: 1, databaseWrites: 0 });
    expect(pre.inserts).toEqual([]);

    await expect(runPlayerSummaryRollback(["--backup", out, "--apply", "--pause-ms", "0"], { supabase: pre.client(), now })).rejects.toThrow(/Plan changed/);
    const applied = await runPlayerSummaryRollback(["--backup", out, "--apply", "--expect-plan-sha256", dry.planSha256, "--pause-ms", "0"], { supabase: pre.client(), now });
    expect(applied).toMatchObject({ status: "applied", rowsInserted: 2, insertStatements: 1, rollbackAt: "2026-11-09T12:00:00.000Z" });
    expect(pre.inserts).toEqual([2]);

    const after = readerView(pre);
    for (const [sourceUrl, rows] of before) expect(after.get(sourceUrl)).toEqual(rows);
    expect(after.get(url("powerPlay", G2))).toEqual([{ value: 40 }]); // rebuild-only partition remains

    const receipt = JSON.parse(readFileSync("receipt" in applied ? applied.receipt : "", "utf8")) as RollbackReceipt;
    expect(receipt).toMatchObject({ status: "complete", planSha256: dry.planSha256 });
    expect(receipt.inserted.map((r) => r.replaced_id).sort()).toEqual([4, 5]); // the rebuild rows

    // Re-running is idempotent: the receipt marks those heads as already restored.
    const again = await runPlayerSummaryRollback(["--backup", out, "--pause-ms", "0"], { supabase: pre.client(), now });
    expect(again).toMatchObject({ restore: 0, alreadyRestored: 2, unchanged: 1 });
    expect(pre.raw.length).toBe(8);
  });

  it("splits restores into 25-row statements and retries the writer-busy guard once", async () => {
    const db = new FakeDb();
    const games = Array.from({ length: 30 }, (_, i) => G1 + i);
    for (const game of games) db.add({ game_id: game, source_url: url("allStrengths", game), payload_hash: `old-${game}`, payload: payload(game, "2026-10-12T04:00:00Z", 1), fetched_at: "2026-10-12T04:00:00Z" });
    const out = join(dir, "big");
    await runPlayerSummaryBackup(["--out-dir", out, "--game-ids", games.join(","), "--pause-ms", "0"], { supabase: db.client(), now });
    for (const game of games) db.add({ game_id: game, source_url: url("allStrengths", game), payload_hash: `new-${game}`, payload: payload(game, "2026-11-09T10:00:00Z", 2), fetched_at: "2026-11-09T10:00:00Z" });
    const dry = await runPlayerSummaryRollback(["--backup", out, "--pause-ms", "0"], { supabase: db.client(), now });
    db.busyNext = 1;
    const applied = await runPlayerSummaryRollback(["--backup", out, "--apply", "--expect-plan-sha256", dry.planSha256, "--pause-ms", "0"], { supabase: db.client(), now, busyRetryDelayMs: 0 });
    expect(applied).toMatchObject({ rowsInserted: 30, insertStatements: 2 });
    expect(db.inserts).toEqual([25, 5]);
  });

  it("aborts with a receipt when a head moves after the plan (compare-and-set)", async () => {
    const db = new FakeDb();
    db.add({ game_id: G1, source_url: url("allStrengths", G1), payload_hash: "old", payload: payload(G1, "2026-10-12T04:00:00Z", 1), fetched_at: "2026-10-12T04:00:00Z" });
    const { out } = await backup(db);
    db.add({ game_id: G1, source_url: url("allStrengths", G1), payload_hash: "new", payload: payload(G1, "2026-11-09T10:00:00Z", 2), fetched_at: "2026-11-09T10:00:00Z" });
    const dry = await runPlayerSummaryRollback(["--backup", out, "--pause-ms", "0"], { supabase: db.client(), now });
    // A concurrent writer lands between the dry run and the apply's first batch check.
    const client = db.client();
    let reads = 0;
    const racing = { from: (table: string) => { reads += 1; if (reads === 2) db.add({ game_id: G1, source_url: url("allStrengths", G1), payload_hash: "cron", payload: payload(G1, "2026-11-09T11:00:00Z", 3), fetched_at: "2026-11-09T11:00:00Z" }); return client.from(table); } } as unknown as SupabaseClient;
    await expect(runPlayerSummaryRollback(["--backup", out, "--apply", "--expect-plan-sha256", dry.planSha256, "--pause-ms", "0"], { supabase: racing, now })).rejects.toThrow(/Compare-and-set failed/);
    expect(db.inserts).toEqual([]);
    const receipts = readdirSync(out).filter((f) => f.startsWith("receipt-"));
    expect(JSON.parse(readFileSync(join(out, receipts[0]), "utf8"))).toMatchObject({ status: "aborted", inserted: [] });
  });

  it("refuses a backup whose rows were altered", async () => {
    const db = new FakeDb();
    db.add({ game_id: G1, source_url: url("allStrengths", G1), payload_hash: "old", payload: payload(G1, "2026-10-12T04:00:00Z", 1), fetched_at: "2026-10-12T04:00:00Z" });
    const { out } = await backup(db);
    const path = join(out, "rows.jsonl");
    rmSync(path);
    const { writeFileSync } = await import("node:fs");
    writeFileSync(path, "{}\n");
    await expect(runPlayerSummaryRollback(["--backup", out], { supabase: db.client(), now })).rejects.toThrow(/byte length|sha256/);
  });
});
