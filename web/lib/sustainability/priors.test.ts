import { describe, expect, it } from "vitest";

import {
  applyPositionLeagueFallback,
  betaFromMuK,
  fetchLeagueMeans,
  fetchPlayerSeasonCounts,
  getPriorSeasonIds,
  ROOKIE_FALLBACK_MIN_TRIALS,
} from "./priors";

function createQueryClient(rows: any[]) {
  const requests: Array<{
    filters: Record<string, unknown>;
    from: number;
    to: number;
  }> = [];

  return {
    requests,
    from: () => {
      let filtered = [...rows];
      const filters: Record<string, unknown> = {};
      const query = {
        select: () => query,
        eq: (column: string, value: unknown) => {
          filters[column] = value;
          filtered = filtered.filter((row) => row[column] === value);
          return query;
        },
        in: (column: string, values: unknown[]) => {
          filters[column] = values;
          filtered = filtered.filter((row) => values.includes(row[column]));
          return query;
        },
        not: (column: string) => {
          filtered = filtered.filter((row) => row[column] != null);
          return query;
        },
        order: (column: string, options?: { ascending?: boolean }) => {
          const direction = options?.ascending === false ? -1 : 1;
          filtered.sort(
            (left, right) =>
              direction * (Number(left[column]) - Number(right[column])),
          );
          return query;
        },
        range: async (from: number, to: number) => {
          requests.push({ filters: { ...filters }, from, to });
          return { data: filtered.slice(from, to + 1), error: null };
        },
      };
      return query;
    },
  };
}

describe("applyPositionLeagueFallback", () => {
  it("keeps the original position prior when trials meet the threshold", () => {
    const prior = betaFromMuK(0.1, 200);
    const result = applyPositionLeagueFallback(
      prior,
      "shp",
      ROOKIE_FALLBACK_MIN_TRIALS.shp,
    );

    expect(result.alpha0).toBeCloseTo(prior.alpha0);
    expect(result.beta0).toBeCloseTo(prior.beta0);
    expect(result.fallback_weight).toBe(0);
  });

  it("boosts league-prior strength for low-sample players", () => {
    const prior = betaFromMuK(0.08, 200);
    const result = applyPositionLeagueFallback(prior, "shp", 20);

    expect(result.adjusted_k).toBeGreaterThan(prior.alpha0 + prior.beta0);
    expect(result.fallback_weight).toBeGreaterThan(0);
    expect(result.alpha0 / result.adjusted_k).toBeCloseTo(0.08);
  });

  it("applies the strongest fallback when a player has no usable trials", () => {
    const prior = betaFromMuK(0.65, 60);
    const result = applyPositionLeagueFallback(prior, "ipp", 0);

    expect(result.fallback_weight).toBe(1);
    expect(result.adjusted_k).toBeCloseTo((prior.alpha0 + prior.beta0) * 2);
    expect(result.alpha0 / result.adjusted_k).toBeCloseTo(0.65);
  });
});

describe("canonical prior reads", () => {
  it("derives the prior two concatenated NHL season identifiers", () => {
    expect(getPriorSeasonIds(20252026)).toEqual([20252026, 20242025, 20232024]);
    expect(() => getPriorSeasonIds(2025)).toThrow(
      "Invalid NHL season identifier",
    );
  });

  it("paginates every league row before calculating pooled means", async () => {
    const client = createQueryClient([
      {
        player_id: 3,
        season_id: 20252026,
        position_code: "C",
        goals: 3,
        shots: 30,
        nst_oi_gf: 6,
        nst_oi_sf: 60,
        points_5v5: 3,
        pp_goals: 1,
        pp_shots: 10,
      },
      {
        player_id: 1,
        season_id: 20252026,
        position_code: "LW",
        goals: 1,
        shots: 10,
        nst_oi_gf: 2,
        nst_oi_sf: 20,
        points_5v5: 1,
        pp_goals: 0,
        pp_shots: 5,
      },
      {
        player_id: 2,
        season_id: 20252026,
        position_code: "RW",
        goals: 2,
        shots: 20,
        nst_oi_gf: 4,
        nst_oi_sf: 40,
        points_5v5: 2,
        pp_goals: 1,
        pp_shots: 5,
      },
    ]);

    const means = await fetchLeagueMeans(20252026, "F", {
      client,
      pageSize: 2,
    });

    expect(client.requests.map(({ from, to }) => [from, to])).toEqual([
      [0, 1],
      [2, 3],
    ]);
    expect(means).toEqual({ shp: 0.1, oishp: 0.1, ipp: 0.5, ppshp: 0.1 });
  });

  it("batches current-season player identities before fetching complete history", async () => {
    const row = (
      player_id: number,
      season_id: number,
      position_code: string,
      goals: number,
    ) => ({
      player_id,
      season_id,
      position_code,
      goals,
      shots: goals * 10,
      nst_oi_gf: goals * 2,
      nst_oi_sf: goals * 20,
      points_5v5: goals,
      pp_goals: 0,
      pp_shots: 0,
    });
    const client = createQueryClient([
      row(1, 20252026, "C", 1),
      row(1, 20242025, "C", 2),
      row(2, 20252026, "D", 3),
      row(2, 20242025, "D", 4),
      row(2, 20232024, "D", 5),
      row(3, 20252026, "G", 6),
      row(4, 20252026, "LW", 7),
    ]);

    const result = await fetchPlayerSeasonCounts(20252026, {
      client,
      offset: 1,
      limit: 1,
      pageSize: 2,
      filterChunkSize: 2,
    });

    expect(result).toHaveLength(1);
    expect(result[0].player_id).toBe(2);
    expect(result[0].position_group).toBe("D");
    expect(result[0].seasons.map((season) => season.shp.s)).toEqual([3, 4, 5]);
    expect(
      client.requests
        .filter(({ filters }) => "player_id" in filters)
        .every(
          ({ filters }) =>
            (filters.player_id as number[] | undefined)?.[0] === 2,
        ),
    ).toBe(true);
  });
});
