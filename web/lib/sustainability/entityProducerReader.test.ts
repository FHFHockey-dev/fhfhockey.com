import { describe, expect, it, vi } from "vitest";

// Producer rows read back through the sandbox reader, with a client that
// honours eq/lte/order/limit the way PostgREST does.
const tables = vi.hoisted(() => ({
  entity_sustainability_scores_daily: [] as Record<string, any>[],
  entity_sustainability_bands_daily: [] as Record<string, any>[]
}));

vi.mock("lib/supabase/server", () => ({
  default: {
    from: (table: string) => {
      const source: Record<string, any>[] | null =
        table in tables ? (tables as any)[table] : table === "players" ? [] : null;
      if (!source) throw new Error(`Unexpected test table: ${table}`);
      // Filters, order and limit are collected and applied together, as
      // PostgREST does, whatever order the builder calls come in.
      const filters: Array<(row: Record<string, any>) => boolean> = [];
      let sort: { key: string; ascending: boolean } | null = null;
      let max = Infinity;
      const resolve = () => {
        let rows = source.filter((row) => filters.every((f) => f(row)));
        const count = rows.length;
        if (sort) {
          const { key, ascending } = sort;
          rows = [...rows].sort((a, b) =>
            (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0) * (ascending ? 1 : -1)
          );
        }
        return { rows: rows.slice(0, max), count };
      };
      const query: any = {
        select: () => query,
        eq: (key: string, value: unknown) => (filters.push((row) => row[key] === value), query),
        lte: (key: string, value: string) => (filters.push((row) => row[key] <= value), query),
        in: (key: string, values: unknown[]) => (filters.push((row) => values.includes(row[key])), query),
        order: (key: string, opts: { ascending: boolean }) => ((sort = { key, ascending: opts.ascending }), query),
        limit: (n: number) => ((max = n), query),
        single: () => {
          const { rows } = resolve();
          return Promise.resolve(
            rows.length ? { data: rows[0], error: null } : { data: null, error: { code: "PGRST116" } }
          );
        },
        then: (onFulfilled: (value: unknown) => unknown) => {
          const { rows, count } = resolve();
          return Promise.resolve({ data: rows, count, error: null }).then(onFulfilled);
        }
      };
      return query;
    }
  }
}));

import { buildTeamReadings, isoDateRange, type TeamGameInput } from "./entityProducer";
import {
  fetchSandboxBands,
  fetchSandboxScoreHistory,
  fetchSandboxScores
} from "./entitySurfaceServer";

function game(teamId: number, date: string): TeamGameInput {
  const k = (teamId * 7 + Number(date.slice(8)) * 3) % 11;
  return {
    teamId, teamAbbrev: `T${teamId}`, date,
    xgf: 2 + k * 0.2, xga: 3 - k * 0.1, scf: 25 + k, sca: 30 - k,
    hdcf: 9 + (k % 4), hdca: 12 - (k % 5), gf: 1 + (k % 4), ga: 1 + ((k + 2) % 4),
    sf: 26 + k, sa: 32 - k
  };
}

describe("producer rows through the sandbox reader", () => {
  // 200 days: past the reader's 160/180-row history limits.
  const dates = isoDateRange("2026-10-01", "2027-04-18");
  const teamIds = [1, 6, 22, 8, 10, 12, 14, 16, 18, 20, 24, 26];
  const games = dates.flatMap((date, i) =>
    teamIds.filter((id) => (id + i) % 2 === 0).map((id) => game(id, date))
  );
  const result = buildTeamReadings({
    seasonId: 20262027,
    dates,
    games,
    completedGames: games.map((g) => ({ teamId: g.teamId, date: g.date })),
    teamIds
  });
  tables.entity_sustainability_scores_daily = result.scores;
  tables.entity_sustainability_bands_daily = result.bands;
  const last = dates[dates.length - 1];

  it("returns Edmonton's reading for the requested date", async () => {
    const payload = await fetchSandboxScores({
      entityType: "team", entityId: 22, requestedDate: last, windowCode: "l5"
    });
    expect(payload.snapshotDate).toBe(last);
    expect(payload.totalRows).toBe(teamIds.length);
    expect(payload.selectedRow).toMatchObject({
      entityId: 22, snapshotDate: last, entityName: "Edmonton Oilers"
    });
    expect(["overperforming", "stable", "underperforming"]).toContain(
      payload.selectedRow?.expectationState
    );
  });

  it("returns all six team bands with a usual range, and history ending on the date", async () => {
    const payload = await fetchSandboxBands({
      entityType: "team", entityId: 22, requestedDate: last, windowCode: "l5", metricKey: "xgf_pct"
    });
    expect(payload.currentRows.map((r) => r.metricKey).sort()).toEqual(
      ["hdcf_pct", "on_ice_sh_pct", "on_ice_sv_pct", "pdo", "scf_pct", "xgf_pct"]
    );
    expect(payload.historyRows).toHaveLength(160);
    expect(payload.historyRows.at(-1)?.snapshotDate).toBe(last);
    expect(payload.historyRows[0].snapshotDate < last).toBe(true);
    expect(payload.currentRows[0].comparisons.find((c) => c.key === "l5")?.value).not.toBeNull();
  });

  it("gives no reading before a team's first game instead of a later day's", async () => {
    // Team 1 first plays on 2026-10-02.
    const payload = await fetchSandboxScores({
      entityType: "team", entityId: 1, requestedDate: "2026-10-01", windowCode: "l5"
    });
    expect(payload.selectedRow?.snapshotDate ?? null).toBeNull();
    const before = await fetchSandboxScores({
      entityType: "team", entityId: 22, requestedDate: "2026-09-01", windowCode: "l5"
    });
    expect(before).toMatchObject({ snapshotDate: null, totalRows: 0, selectedRow: null });
  });

  it("returns the latest score history in date order", async () => {
    const payload = await fetchSandboxScoreHistory({
      entityType: "team", entityId: 22, requestedDate: last, windowCode: "l5"
    });
    expect(payload.rows).toHaveLength(180);
    expect(payload.rows.at(-1)?.snapshotDate).toBe(last);
    const order = payload.rows.map((r) => r.snapshotDate);
    expect(order).toEqual([...order].sort());
  });
});
