// @vitest-environment node
// W3-3 D11 (L19): the admin CSV upsert links rows to players by exact
// identity only and reports every row it could not link.
import { describe, expect, it, vi } from "vitest";

vi.mock("utils/adminOnlyMiddleware", () => ({
  default: (handler: unknown) => handler
}));
vi.mock("lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: unknown) => handler
}));

import upsertCsv from "../../../../../pages/api/v1/db/upsert-csv";

type Player = { id: number; fullName: string; position: string };

function fakeSupabase(players: Player[]) {
  const inserted: Record<string, unknown>[] = [];
  const query = (rows: Player[]) => ({
    eq: async (column: keyof Player, value: string) => ({
      data: rows.filter((p) => p[column] === value),
      error: null
    }),
    ilike: (column: keyof Player, pattern: string) => {
      const needle = pattern.replace(/%/g, "").toLowerCase();
      const hits = rows.filter((p) =>
        String(p[column]).toLowerCase().includes(needle)
      );
      return { limit: async () => ({ data: hits, error: null }) };
    }
  });
  return {
    inserted,
    client: {
      rpc: async () => ({ error: null }),
      from: (table: string) =>
        table === "players"
          ? { select: () => query(players) }
          : {
              insert: async (rows: Record<string, unknown>[]) => {
                inserted.push(...rows);
                return { error: null };
              }
            }
    }
  };
}

async function post(players: Player[], csvData: Record<string, string>[]) {
  const supabase = fakeSupabase(players);
  let body: any;
  const res: any = {
    statusCode: 200,
    setHeader() {},
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(value: unknown) {
      body = value;
      return this;
    },
    end() {
      return this;
    }
  };
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  await (upsertCsv as any)(
    {
      method: "POST",
      supabase: supabase.client,
      body: {
        tableName: "fixture_projections",
        columns: [
          { name: "player", type: "TEXT", isPlayerNameSource: true },
          { name: "Position", type: "TEXT" },
          { name: "goals", type: "NUMERIC" }
        ],
        csvData,
        playerIdentifierColumnName: "player"
      }
    },
    res
  );
  return { body, status: res.statusCode, inserted: supabase.inserted };
}

const PLAYERS: Player[] = [
  { id: 1, fullName: "Mattias Smith", position: "D" },
  { id: 2, fullName: "Josh Anderson", position: "R" },
  { id: 3, fullName: "Sebastian Aho", position: "C" },
  { id: 4, fullName: "Sebastian Aho", position: "D" }
];

describe("upsert-csv player identity (W3-3 D11)", () => {
  it("never links a CSV name to a different player by a shared prefix", async () => {
    const { body, inserted } = await post(PLAYERS, [
      { player: "Matt Smith", Position: "D", goals: "4" },
      { player: "Josh Anderson", Position: "R", goals: "20" }
    ]);
    expect(inserted.map((row) => row.player_id)).toEqual([2]);
    expect(body.success).toBe(true);
    expect(body.unmatchedRows).toEqual([
      { row: 0, name: "Matt Smith", reason: "no_exact_match" }
    ]);
    expect(body.message).toContain("Matt Smith");
  });

  it("links an exact duplicate name only by CSV position, and reports one it cannot resolve", async () => {
    const { body, inserted } = await post(PLAYERS, [
      { player: "Sebastian Aho", Position: "D", goals: "8" },
      { player: "Sebastian Aho", Position: "", goals: "30" }
    ]);
    expect(inserted.map((row) => row.player_id)).toEqual([4]);
    expect(body.unmatchedRows).toEqual([
      { row: 1, name: "Sebastian Aho", reason: "ambiguous_name" }
    ]);
  });
});
