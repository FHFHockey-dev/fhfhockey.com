import { describe, expect, it } from "vitest";

import {
  completeGameIds,
  loadTeamUnitToiNightlyPlan,
  planTeamUnitToiNightly,
} from "./teamUnitToiNightly";
import type { TeamUnitToiInsert } from "./teamUnitToiBuilder";

const games = [
  { id: 2026020003, date: "2026-11-06" },
  { id: 2026020001, date: "2026-11-05" },
  { id: 2026020002, date: "2026-11-05" },
];

function row(gameId: number, teamId: number, unitType: TeamUnitToiInsert["unit_type"], unitNumber = 1) {
  return { game_id: gameId, team_id: teamId, unit_type: unitType, unit_number: unitNumber } as TeamUnitToiInsert;
}

describe("planTeamUnitToiNightly", () => {
  it("reuses the season's latest snapshot and picks the oldest undone games", () => {
    const plan = planTeamUnitToiNightly({
      latestSnapshotDate: "2026-11-08",
      completedGames: games,
      doneGameIds: new Set([2026020001]),
    });
    expect(plan).toEqual({
      status: "ready",
      snapshotDate: "2026-11-08",
      gameIds: [2026020002, 2026020003],
      pendingGames: 2,
    });
  });

  it("is a no-op when every completed game is already in the snapshot", () => {
    expect(
      planTeamUnitToiNightly({
        latestSnapshotDate: "2026-11-08",
        completedGames: games,
        doneGameIds: new Set(games.map((game) => game.id)),
      }),
    ).toMatchObject({ status: "nothing_to_do", gameIds: [] });
    expect(
      planTeamUnitToiNightly({ latestSnapshotDate: "2026-11-08", completedGames: [], doneGameIds: new Set() }),
    ).toMatchObject({ status: "nothing_to_do", snapshotDate: "2026-11-08" });
  });

  it("never invents a snapshot: a season without one needs a backfill first", () => {
    expect(
      planTeamUnitToiNightly({ latestSnapshotDate: null, completedGames: games, doneGameIds: new Set() }),
    ).toEqual({ status: "no_snapshot", snapshotDate: null, gameIds: [], pendingGames: 3 });
  });

  it("caps one call and leaves the rest pending for the next", () => {
    const plan = planTeamUnitToiNightly({
      latestSnapshotDate: "2026-11-08",
      completedGames: games,
      doneGameIds: new Set(),
      maxGames: 1,
    });
    expect(plan).toMatchObject({ gameIds: [2026020001], pendingGames: 3 });
  });
});

describe("completeGameIds", () => {
  it("keeps only games with a top forward line and pair for both teams", () => {
    const rows = [
      row(1, 10, "forward_line"), row(1, 10, "defense_pair"), row(1, 20, "forward_line"), row(1, 20, "defense_pair"),
      // Game 2: shifts for one team only, so it is skipped this run.
      row(2, 10, "forward_line"), row(2, 10, "defense_pair"),
      // Game 3: PP rows alone (no ES shifts) do not make it complete.
      row(3, 10, "power_play"), row(3, 20, "power_play"),
      // Lower-ranked units do not count toward completeness.
      row(4, 10, "forward_line", 2), row(4, 20, "forward_line", 2),
    ];
    expect([...completeGameIds(rows)]).toEqual([1]);
  });

  it("retries a skipped game on the next run because it is still not done", () => {
    // Night 1: game 2 has no shifts, so nothing is written for it and it stays undone.
    const night1 = planTeamUnitToiNightly({
      latestSnapshotDate: "2026-11-08",
      completedGames: [{ id: 2, date: "2026-11-07" }],
      doneGameIds: new Set(),
    });
    expect(completeGameIds([])).toEqual(new Set());
    // Night 2: the same game is planned again.
    const night2 = planTeamUnitToiNightly({
      latestSnapshotDate: "2026-11-08",
      completedGames: [{ id: 2, date: "2026-11-07" }, { id: 3, date: "2026-11-08" }],
      doneGameIds: new Set(),
    });
    expect(night1.gameIds).toEqual([2]);
    expect(night2.gameIds).toEqual([2, 3]);
  });
});

describe("loadTeamUnitToiNightlyPlan", () => {
  type Call = { table: string; ops: unknown[][] };

  function fakeSupabase(answers: Record<string, (call: Call) => unknown[]>) {
    const calls: Call[] = [];
    const client = {
      from(table: string) {
        const call: Call = { table, ops: [] };
        calls.push(call);
        const builder: any = {};
        for (const op of ["select", "eq", "in", "lt", "order", "limit", "range"]) {
          builder[op] = (...args: unknown[]) => {
            call.ops.push([op, ...args]);
            return builder;
          };
        }
        builder.then = (resolve: any) => resolve({ data: answers[table](call), error: null });
        return builder;
      },
    };
    return { client: client as any, calls };
  }

  it("reads the latest snapshot, pages completed games, and counts games with both top lines as done", async () => {
    const topLines = [
      { game_id: 2026020001, team_id: 10 }, { game_id: 2026020001, team_id: 20 },
      { game_id: 2026020002, team_id: 10 }, // one team only: not done
    ];
    const { client, calls } = fakeSupabase({
      team_unit_toi: (call) =>
        call.ops.some(([op]) => op === "limit") ? [{ snapshot_date: "2026-11-08" }] : topLines,
      games: () => games,
    });

    const plan = await loadTeamUnitToiNightlyPlan(client, { season: 20262027, today: "2026-11-08" });

    expect(plan).toMatchObject({ status: "ready", snapshotDate: "2026-11-08", gameIds: [2026020002, 2026020003] });
    const gameCall = calls.find((call) => call.table === "games")!;
    expect(gameCall.ops).toContainEqual(["lt", "date", "2026-11-08"]);
    expect(gameCall.ops).toContainEqual(["in", "type", [2, 3]]);
    const topLineCall = calls.filter((call) => call.table === "team_unit_toi")[1];
    expect(topLineCall.ops).toContainEqual(["eq", "snapshot_date", "2026-11-08"]);
    expect(topLineCall.ops).toContainEqual(["eq", "unit_number", 1]);
  });

  it("pages past Supabase's 1,000-row cap", async () => {
    const many = Array.from({ length: 1500 }, (_, i) => ({ id: 2026020000 + i, date: "2026-11-01" }));
    const { client, calls } = fakeSupabase({
      team_unit_toi: (call) => (call.ops.some(([op]) => op === "limit") ? [{ snapshot_date: "2026-11-08" }] : []),
      games: (call) => {
        const [, from, to] = call.ops.find(([op]) => op === "range") as [string, number, number];
        return many.slice(from, to + 1);
      },
    });

    const plan = await loadTeamUnitToiNightlyPlan(client, { season: 20262027, today: "2026-11-08", maxGames: 100 });

    expect(plan.pendingGames).toBe(1500);
    expect(calls.filter((call) => call.table === "games")).toHaveLength(2);
  });
});
