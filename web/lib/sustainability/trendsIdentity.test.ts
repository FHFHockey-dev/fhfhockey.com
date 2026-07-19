import { describe, expect, it } from "vitest";

import {
  fetchSustainabilityTrendIdentity,
  fetchSustainabilityTrendScores,
  type SustainabilityTrendScoreRow,
} from "./trendsIdentity";

function score(playerId: number): SustainabilityTrendScoreRow {
  return {
    player_id: playerId,
    season_id: 20252026,
    snapshot_date: "2026-03-07",
    position_group: "F",
    window_code: "l10",
    s_raw: 0,
    s_100: 50,
    components: {},
  };
}

function createIdentityClient() {
  const identityChunks: Array<{ table: string; ids: number[] }> = [];
  const rowsByTable: Record<string, any[]> = {
    player_baselines: [
      { player_id: 1, player_name: null, position_code: "F" },
      { player_id: 2, player_name: "Baseline Two", position_code: "D" },
    ],
    players: [
      { id: 1, fullName: "Canonical One", position: "C" },
      { id: 2, fullName: "Canonical Two", position: "D" },
    ],
  };

  const client = {
    from(table: string) {
      const filters: Record<string, unknown> = {};
      const builder: any = {
        select() {
          return builder;
        },
        eq(column: string, value: unknown) {
          filters[column] = value;
          return builder;
        },
        in(column: string, ids: number[]) {
          identityChunks.push({ table, ids: [...ids] });
          const idColumn = table === "players" ? "id" : "player_id";
          return Promise.resolve({
            data: rowsByTable[table].filter((row) =>
              ids.includes(Number(row[idColumn])),
            ),
            error: null,
          });
        },
      };
      return builder;
    },
  };

  return { client, identityChunks };
}

describe("sustainability trend identity", () => {
  it("uses canonical player names ahead of nullable or stale snapshot baselines", async () => {
    const { client } = createIdentityClient();
    const identity = await fetchSustainabilityTrendIdentity(
      client as any,
      [score(1), score(2)],
      "2026-03-07",
    );

    expect(identity.get(1)).toEqual({
      playerId: 1,
      playerName: "Canonical One",
      positionCode: "C",
    });
    expect(identity.get(2)).toEqual({
      playerId: 2,
      playerName: "Canonical Two",
      positionCode: "D",
    });
  });

  it("chunks every identity lookup to a bounded 200-player request", async () => {
    const { client, identityChunks } = createIdentityClient();
    await fetchSustainabilityTrendIdentity(
      client as any,
      Array.from({ length: 401 }, (_, index) => score(index + 1)),
      "2026-03-07",
    );

    expect(identityChunks).toHaveLength(6);
    expect(identityChunks.every((entry) => entry.ids.length <= 200)).toBe(true);
    expect(
      identityChunks
        .filter((entry) => entry.table === "players")
        .map((entry) => entry.ids.length),
    ).toEqual([200, 200, 1]);
  });

  it("pages score rows until Supabase returns a short page", async () => {
    const pages = [
      Array.from({ length: 500 }, (_, index) => score(index + 1)),
      [score(501)],
    ];
    const ranges: Array<[number, number]> = [];
    const client = {
      from() {
        const builder: any = {
          select() {
            return builder;
          },
          eq() {
            return builder;
          },
          order() {
            return builder;
          },
          range(from: number, to: number) {
            ranges.push([from, to]);
            return Promise.resolve({ data: pages.shift() ?? [], error: null });
          },
        };
        return builder;
      },
    };

    const rows = await fetchSustainabilityTrendScores(client as any, {
      snapshotDate: "2026-03-07",
      windowCode: "l10",
    });

    expect(rows).toHaveLength(501);
    expect(ranges).toEqual([
      [0, 499],
      [500, 999],
    ]);
  });
});
