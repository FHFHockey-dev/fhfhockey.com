import { describe, expect, it } from "vitest";

import { fetchSeasonGoalieSummaryGameIdSet, fetchSharedGoalieSummarySnapshotsByGameIds } from "./goalieStatsSummaryRefresh";
import { fetchPlayerStatsOfficialLandingPayloadRows, fetchPlayerStatsSummaryPayloadRows } from "./playerStatsLandingServer";
import { fetchSeasonSummaryGameIdSet, fetchSummaryPayloadRowsByGameIds } from "./playerStatsSummaryRefresh";
import {
  fetchOfficialGamePayloadByGameId,
  fetchTeamSummaryRebuildGameIds,
  findStaleTeamSummaryKeys,
} from "./teamStatsSummaryRefresh";

// Offset paging (range) over an order that is not unique lets Postgres repeat rows on one page
// and skip them on another, so every paged read must end its ORDER BY on a unique key.
function recordingClient(rowsByTable: Record<string, unknown[]> = {}) {
  const orders: Record<string, string[][]> = {};
  const nots: Record<string, string[][]> = {};
  const client = {
    from(table: string) {
      const order: string[] = [];
      (orders[table] ??= []).push(order);
      const not: string[] = [];
      (nots[table] ??= []).push(not);
      let page = 0;
      // Thenable like a PostgREST builder: some readers chain filters after range().
      const query: any = {
        select: () => query,
        eq: () => query,
        like: () => query,
        not: (column: string, operator: string, value: string) => (not.push(`${column} ${operator} ${value}`), query),
        in: () => query,
        gte: () => query,
        lte: () => query,
        order: (column: string) => (order.push(column), query),
        range: (from: number) => ((page = from), query),
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
          Promise.resolve({ data: page === 0 ? rowsByTable[table] ?? [] : [], error: null }).then(resolve, reject),
      };
      return query;
    },
  };
  return { client: client as any, orders, nots };
}

// nhl_api_game_payloads_raw: PK id. goalie_underlying_summary_partitions: PK (game_id, strength, score_state).
describe("underlying-summary paged reads end on a unique key", () => {
  it("player summary payload and season game-id reads", async () => {
    const { client, orders } = recordingClient();
    await fetchSummaryPayloadRowsByGameIds({ supabase: client, gameIds: [1], sourceUrlPrefix: "derived://x/" });
    await fetchSeasonSummaryGameIdSet({ supabase: client, seasonId: 20252026 });
    expect(orders.nhl_api_game_payloads_raw).toEqual([
      ["game_id", "fetched_at", "id"],
      ["game_id", "id"],
    ]);
  });

  it("goalie shared-seed and season game-id reads", async () => {
    const { client, orders } = recordingClient();
    await fetchSharedGoalieSummarySnapshotsByGameIds({ supabase: client, gameIds: [1] });
    await fetchSeasonGoalieSummaryGameIdSet({ supabase: client, seasonId: 20252026 });
    expect(orders.nhl_api_game_payloads_raw).toEqual([["game_id", "fetched_at", "id"]]);
    expect(orders.goalie_underlying_summary_partitions).toEqual([["game_id", "strength", "score_state"]]);
  });

  it("landing summary and official payload Supabase reads", async () => {
    const { client, orders } = recordingClient();
    await fetchPlayerStatsSummaryPayloadRows({ gameIds: [1], sourceUrlPrefix: "derived://x/", client });
    await fetchPlayerStatsOfficialLandingPayloadRows({ gameIds: [1], client });
    expect(orders.nhl_api_game_payloads_raw).toEqual([
      ["game_id", "fetched_at", "id"],
      ["game_id", "fetched_at", "id"],
    ]);
  });

  it("team official payload read", async () => {
    const { client, orders } = recordingClient();
    await fetchOfficialGamePayloadByGameId({ gameIds: [1], supabase: client });
    expect(orders.nhl_api_game_payloads_raw).toEqual([["game_id", "fetched_at", "id"]]);
  });
});

describe("team summary rebuild helpers", () => {
  it("selects finished games in the window by unique id order", async () => {
    const { client, orders } = recordingClient({
      games: [
        { id: 2025020001, date: "2025-10-07" },
        { id: 2025020002, date: "2999-01-01" },
      ],
    });
    const ids = await fetchTeamSummaryRebuildGameIds({
      seasonId: 20252026,
      startDate: "2025-10-07",
      endDate: "2025-10-13",
      supabase: client,
    });
    expect(ids).toEqual([2025020001]);
    expect(orders.games).toEqual([["id"]]);
  });

  it("reports stored keys the rebuilt rows no longer contain", async () => {
    const stored = [
      { game_id: 1, team_id: 10, strength: "allStrengths", score_state: "allScores" },
      { game_id: 1, team_id: 10, strength: "threeOnThree", score_state: "tied" },
    ];
    const { client, orders } = recordingClient({ team_underlying_stats_summary: stored });
    const stale = await findStaleTeamSummaryKeys({
      gameIds: [1],
      rows: [stored[0]],
      supabase: client,
    });
    expect(stale).toEqual([stored[1]]);
    expect(orders.team_underlying_stats_summary).toEqual([["game_id", "team_id", "strength", "score_state"]]);
  });
});

// Derived summary copies are ~99% of landing rows (156 MB vs 1.8 MB for one week); official-payload
// reads must exclude them in the query, not after downloading them.
describe("official payload reads exclude derived rows server-side", () => {
  it("team official payload read", async () => {
    const { client, nots } = recordingClient();
    await fetchOfficialGamePayloadByGameId({ gameIds: [1], supabase: client });
    expect(nots.nhl_api_game_payloads_raw).toEqual([["source_url like derived://%"]]);
  });

  it("landing official payload Supabase fallback", async () => {
    const { client, nots } = recordingClient();
    await fetchPlayerStatsOfficialLandingPayloadRows({ gameIds: [1], client });
    expect(nots.nhl_api_game_payloads_raw).toEqual([["source_url like derived://%"]]);
  });

  it("still drops a derived row if one is returned", async () => {
    const { client } = recordingClient({
      nhl_api_game_payloads_raw: [
        { game_id: 1, payload: { derived: true }, source_url: "derived://underlying-player-summary-v2/x/1" },
        { game_id: 1, payload: { official: true }, source_url: "https://api-web.nhle.com/v1/gamecenter/1/landing" },
      ],
    });
    const payloads = await fetchOfficialGamePayloadByGameId({ gameIds: [1], supabase: client });
    expect(payloads.get(1)).toEqual({ official: true });
  });
});
