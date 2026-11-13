import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
  computeUnderlyingStatsScheduleTexture,
  computePointPctFromRecord,
  computeUnderlyingStatsTeamScheduleStrength,
  fetchUnderlyingStatsTeamScheduleStrengthForRatings,
  type TeamSosLandingRow
} from "./teamScheduleStrength";
describe("computePointPctFromRecord", () => {
  it("respects overtime-loss standings value", () => {
    expect(computePointPctFromRecord(7, 3, 0)).toBeCloseTo(0.7, 5);
    expect(computePointPctFromRecord(7, 2, 1)).toBeCloseTo(0.75, 5);
  });

  it("returns null when no games are present", () => {
    expect(computePointPctFromRecord(0, 0, 0)).toBeNull();
    expect(computePointPctFromRecord(2, null, 1)).toBeNull();
    expect(computePointPctFromRecord(0, 2, 0)).toBe(0);
  });
});

const v2Row = (
  teamAbbr: string,
  values: Partial<TeamSosLandingRow> = {}
): TeamSosLandingRow => ({
  season_id: 20262027,
  snapshot_date: "2026-11-13",
  team_abbrev: teamAbbr,
  sos_version: "descriptive-sos-v2",
  past_fixtures: 0,
  pending_fixtures: 0,
  future_fixtures: 0,
  past_direct_points_pct: null,
  past_indirect_points_pct: null,
  future_direct_points_pct: null,
  future_indirect_points_pct: null,
  past_opponents: [],
  future_opponents: [],
  ...values
});

const opponents = (...abbrevs: string[]) =>
  abbrevs.map((opponent, index) => ({
    game_id: 2026020001 + index,
    opponent,
    starts_at: "2026-11-01T23:00:00Z"
  }));

type FakeCall = { table: string; filters: Array<[string, string, unknown]> };

const fakeSupabase = (tables: Record<string, Array<Record<string, unknown>>>) => {
  const calls: FakeCall[] = [];
  const from = (table: string) => {
    const call: FakeCall = { table, filters: [] };
    calls.push(call);
    let rows = [...(tables[table] ?? [])];
    let order: { column: string; ascending: boolean } | null = null;
    let limit: number | null = null;
    const builder: Record<string, unknown> = {};
    Object.assign(builder, {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        call.filters.push(["eq", column, value]);
        rows = rows.filter((row) => row[column] === value);
        return builder;
      },
      lte: (column: string, value: unknown) => {
        call.filters.push(["lte", column, value]);
        rows = rows.filter((row) => String(row[column]) <= String(value));
        return builder;
      },
      gte: (column: string, value: unknown) => {
        call.filters.push(["gte", column, value]);
        rows = rows.filter((row) => String(row[column]) >= String(value));
        return builder;
      },
      order: (column: string, options?: { ascending?: boolean }) => {
        order = { column, ascending: options?.ascending ?? true };
        return builder;
      },
      limit: (count: number) => {
        limit = count;
        return builder;
      },
      then: (
        resolve: (value: unknown) => unknown,
        reject: (reason: unknown) => unknown
      ) => {
        let out = rows;
        if (order) {
          const { column, ascending } = order;
          out = [...out].sort((a, b) =>
            ascending
              ? String(a[column]).localeCompare(String(b[column]))
              : String(b[column]).localeCompare(String(a[column]))
          );
        }
        if (limit !== null) out = out.slice(0, limit);
        return Promise.resolve({ data: out, error: null }).then(resolve, reject);
      }
    });
    return builder;
  };
  return { client: { from } as unknown as SupabaseClient, calls };
};

describe("computeUnderlyingStatsTeamScheduleStrength (descriptive-sos-v2)", () => {
  it("keeps the 2:1 record-only sos over the stored v2 means and ranks it", () => {
    const result = computeUnderlyingStatsTeamScheduleStrength({
      date: "2026-11-13",
      scheduleRows: [
        v2Row("TOR", {
          past_fixtures: 3,
          past_direct_points_pct: 0.7,
          past_indirect_points_pct: 0.4,
          past_opponents: opponents("BOS", "BOS", "MTL")
        }),
        v2Row("BOS", {
          past_fixtures: 3,
          past_direct_points_pct: 0.5,
          past_indirect_points_pct: 0.5,
          past_opponents: opponents("TOR", "MTL", "MTL")
        }),
        v2Row("MTL", {
          past_fixtures: 3,
          past_direct_points_pct: 0.3,
          past_indirect_points_pct: 0.6,
          past_opponents: opponents("TOR", "TOR", "BOS")
        })
      ]
    });

    expect(result.get("TOR")?.past).toMatchObject({
      directOpponentPointPct: 0.7,
      indirectOpponentPointPct: 0.4,
      opponentGamesPlayed: 3,
      rank: 1,
      uniqueOpponents: 2
    });
    expect(result.get("TOR")?.past.sos).toBeCloseTo((2 * 0.7 + 0.4) / 3, 12);
    expect(result.get("BOS")?.past.rank).toBe(2);
    expect(result.get("MTL")?.past.rank).toBe(3);
  });

  it("uses the stored future indirect term, built from opponents' past records (W2 D7)", () => {
    // v1 recomputed the future indirect term from each opponent's own future
    // schedule. v2 stores the contract's value; the landing must not rebuild it.
    const result = computeUnderlyingStatsTeamScheduleStrength({
      date: "2026-11-13",
      scheduleRows: [
        v2Row("TOR", {
          future_fixtures: 2,
          future_direct_points_pct: 0.6,
          future_indirect_points_pct: 0.52,
          future_opponents: opponents("BOS", "BOS")
        }),
        v2Row("BOS", {
          future_fixtures: 2,
          future_direct_points_pct: 0.9,
          future_indirect_points_pct: 0.5,
          future_opponents: opponents("TOR", "TOR")
        })
      ]
    });

    expect(result.get("TOR")?.future.indirectOpponentPointPct).toBe(0.52);
    expect(result.get("TOR")?.future.sos).toBeCloseTo((2 * 0.6 + 0.52) / 3, 12);
  });

  it("counts fixtures from the v2 buckets: an unplayed game today is pending, not past", () => {
    const result = computeUnderlyingStatsTeamScheduleStrength({
      date: "2026-11-13",
      scheduleRows: [
        v2Row("SEA", {
          past_fixtures: 2,
          pending_fixtures: 1,
          future_fixtures: 3,
          past_direct_points_pct: 0.5,
          past_indirect_points_pct: 0.5,
          future_direct_points_pct: 0.5,
          future_indirect_points_pct: 0.5,
          past_opponents: opponents("VAN", "CGY"),
          future_opponents: opponents("EDM", "EDM", "VAN")
        })
      ]
    });

    expect(result.get("SEA")?.past).toMatchObject({
      opponentGamesPlayed: 2,
      pendingFixtures: 1,
      uniqueOpponents: 2
    });
    expect(result.get("SEA")?.future).toMatchObject({
      opponentGamesPlayed: 3,
      uniqueOpponents: 2
    });
    expect(result.get("SEA")?.sosVersion).toBe("descriptive-sos-v2");
    expect(result.get("SEA")?.snapshotDate).toBe("2026-11-13");
  });

  it("keeps unsupported buckets unavailable instead of zero", () => {
    const result = computeUnderlyingStatsTeamScheduleStrength({
      date: "2026-11-13",
      scheduleRows: [v2Row("SEA", { past_fixtures: 0, future_fixtures: 4 })]
    });

    expect(result.get("SEA")).toMatchObject({
      future: {
        directOpponentPointPct: null,
        indirectOpponentPointPct: null,
        opponentGamesPlayed: 4,
        rank: null,
        sos: null
      },
      past: {
        directOpponentPointPct: null,
        indirectOpponentPointPct: null,
        opponentGamesPlayed: 0,
        rank: null,
        sos: null,
        uniqueOpponents: 0
      },
      sos: null
    });
  });

  it("ignores rows of another sos version", () => {
    const result = computeUnderlyingStatsTeamScheduleStrength({
      date: "2026-11-13",
      scheduleRows: [
        v2Row("TOR", {
          sos_version: "descriptive-sos-v3",
          past_fixtures: 1,
          past_direct_points_pct: 0.5
        })
      ]
    });

    expect(result.has("TOR")).toBe(false);
  });
});

describe("fetchUnderlyingStatsTeamScheduleStrengthForRatings", () => {
  it("reads the latest v2 snapshot on or before the date and never the frozen v1 table", async () => {
    const { client, calls } = fakeSupabase({
      team_sos_daily: [
        v2Row("TOR", {
          snapshot_date: "2026-11-12",
          past_fixtures: 1,
          past_direct_points_pct: 0.4,
          past_indirect_points_pct: 0.4
        }),
        v2Row("TOR", {
          snapshot_date: "2026-11-14",
          past_fixtures: 1,
          past_direct_points_pct: 0.9,
          past_indirect_points_pct: 0.9
        })
      ],
      sos_standings: [{ game_date: "2026-11-13", team_abbrev: "TOR" }],
      games: []
    });

    const result = await fetchUnderlyingStatsTeamScheduleStrengthForRatings(
      "2026-11-13",
      [{ teamAbbr: "TOR" }],
      client
    );

    expect(calls.some((call) => call.table === "sos_standings")).toBe(false);
    expect(
      calls
        .filter((call) => call.table === "team_sos_daily")
        .every((call) =>
          call.filters.some(
            ([op, column, value]) =>
              op === "eq" && column === "sos_version" && value === "descriptive-sos-v2"
          )
        )
    ).toBe(true);
    expect(result.get("TOR")?.snapshotDate).toBe("2026-11-12");
    expect(result.get("TOR")?.past.directOpponentPointPct).toBe(0.4);
  });

  it("serves unknown, not zero or v1 values, before the first v2 snapshot", async () => {
    const { client, calls } = fakeSupabase({
      team_sos_daily: [],
      sos_standings: [
        {
          game_date: "2026-11-13",
          team_abbrev: "TOR",
          past_opponent_total_wins: 7,
          past_opponent_total_losses: 3,
          past_opponent_total_ot_losses: 0
        }
      ],
      games: []
    });

    const result = await fetchUnderlyingStatsTeamScheduleStrengthForRatings(
      "2026-11-13",
      [{ teamAbbr: "TOR" }],
      client
    );

    expect(calls.some((call) => call.table === "sos_standings")).toBe(false);
    expect(result.get("TOR")).toMatchObject({
      past: { directOpponentPointPct: null, sos: null, rank: null },
      future: { directOpponentPointPct: null, sos: null, rank: null },
      sos: null,
      sosVersion: null,
      snapshotDate: null
    });
  });

  it("does not serve a snapshot older than the staleness bound", async () => {
    const { client } = fakeSupabase({
      team_sos_daily: [
        v2Row("TOR", {
          snapshot_date: "2026-04-16",
          past_fixtures: 82,
          past_direct_points_pct: 0.5,
          past_indirect_points_pct: 0.5
        })
      ],
      games: []
    });

    const result = await fetchUnderlyingStatsTeamScheduleStrengthForRatings(
      "2026-10-10",
      [{ teamAbbr: "TOR" }],
      client
    );

    expect(result.get("TOR")?.sos).toBeNull();
    expect(result.get("TOR")?.snapshotDate).toBeNull();
  });
});

describe("computeUnderlyingStatsScheduleTexture", () => {
  it("computes future schedule texture from upcoming games", () => {
    const result = computeUnderlyingStatsScheduleTexture({
      date: "2026-04-05",
      games: [
        { date: "2026-04-04", homeTeamId: 10, awayTeamId: 6 },
        { date: "2026-04-06", homeTeamId: 10, awayTeamId: 6 },
        { date: "2026-04-07", homeTeamId: 8, awayTeamId: 10 },
        { date: "2026-04-09", homeTeamId: 10, awayTeamId: 3 },
        { date: "2026-04-10", homeTeamId: 3, awayTeamId: 10 },
        { date: "2026-04-15", homeTeamId: 10, awayTeamId: 5 },
        { date: "2026-04-05", homeTeamId: 6, awayTeamId: 8 },
        { date: "2026-04-08", homeTeamId: 6, awayTeamId: 3 },
        { date: "2026-04-08", homeTeamId: 3, awayTeamId: 5 },
        { date: "2026-04-14", homeTeamId: 5, awayTeamId: 10 }
      ]
    });

    expect(result.get("TOR")).toMatchObject({
      backToBacksNext14: 3,
      gamesNext14: 6,
      gamesNext7: 4,
      homeGamesNext14: 3,
      restAdvantageGamesNext14: 2,
      restDisadvantageGamesNext14: 2,
      roadGamesNext14: 3,
      threeInFourNext14: 2
    });
  });
});
