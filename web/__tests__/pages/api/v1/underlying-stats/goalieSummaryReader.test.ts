/**
 * DR1 / decision 110: the goalie readers serve goalie_underlying_summary_partitions
 * (fresh and complete), fall back to a raw build only when a partition is missing
 * or stale, and snapshot seeding never copies a stale shared partition.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AWAY_GOALIE,
  BASE_QUERY,
  HOME_GOALIE,
  buildFixtureTables,
  createFakeSupabase,
  createMockApiContext,
} from "./landingMathFixture";

const fake = vi.hoisted(() => ({ client: null as unknown }));

vi.mock("lib/supabase/server", () => ({
  default: new Proxy(
    {},
    { get: (_target, prop) => (fake.client as Record<string | symbol, unknown>)[prop] }
  ),
}));
vi.mock("lib/underlying-stats/entityRatingsOverlay", () => ({
  overlayEntityRatingsOnLandingResponse: async ({ response }: { response: unknown }) => response,
}));

import goaliesHandler from "../../../../../pages/api/v1/underlying-stats/goalies";
import goalieDetailHandler from "../../../../../pages/api/v1/underlying-stats/goalies/[playerId]";
import goalieChartHandler from "../../../../../pages/api/v1/underlying-stats/goalies/[playerId]/chart";
import {
  buildPlayerStatsLandingSummarySnapshotsForGameIds,
  invalidatePlayerStatsSeasonAggregateCache,
} from "lib/underlying-stats/playerStatsLandingServer";
import { refreshGoalieUnderlyingSummarySnapshotsForGameIds } from "lib/underlying-stats/goalieStatsSummaryRefresh";

type Tables = ReturnType<typeof buildFixtureTables>;

/** A pre-fix partition: no formula revision, and goalie numbers that differ. */
function staleCopy(row: Record<string, any>, extraShots: number) {
  const payload = structuredClone(row.payload);
  delete payload.formulaRevision;
  for (const summaryRow of payload.rows) {
    if (summaryRow.mode === "goalies") {
      summaryRow.metrics.goalies.shotsAgainst += extraShots;
      summaryRow.metrics.goalies.saves += extraShots;
    }
  }
  return { ...row, payload };
}

async function buildSharedSnapshots(tables: Tables) {
  const client = createFakeSupabase(tables);
  return buildPlayerStatsLandingSummarySnapshotsForGameIds(
    tables.games.map((game) => Number(game.id)),
    client as any
  );
}

function goaliePartitionsFrom(snapshots: Array<Record<string, any>>) {
  return snapshots
    .filter((row) => String(row.source_url).includes("/goalies/"))
    .map((row) => {
      const parts = String(row.source_url).split("/goalies/")[1]!.split("/");
      return {
        game_id: row.game_id,
        season_id: row.season_id,
        game_date: row.game_date,
        strength: parts[0],
        score_state: parts.length === 3 ? parts[1] : "allScores",
        endpoint: row.endpoint,
        source_url: `derived://underlying-goalie-summary-v1/${parts.join("/")}`,
        shared_source_url: row.source_url,
        payload_hash: row.payload_hash,
        payload: row.payload,
        fetched_at: row.fetched_at,
        updated_at: row.fetched_at,
      };
    });
}

async function callRoute(handler: (req: any, res: any) => Promise<unknown>, query: Record<string, string>) {
  const { req, res } = createMockApiContext({ ...BASE_QUERY, ...query });
  await handler(req, res);
  expect(res.statusCode, JSON.stringify(res.body)).toBe(200);
  return res.body as { rows: Array<Record<string, any>> };
}

const allQuery = { strength: "allStrengths", scoreState: "allScores", displayMode: "counts" };

beforeEach(() => {
  invalidatePlayerStatsSeasonAggregateCache();
});

describe("goalie readers serve goalie_underlying_summary_partitions (DR1, decision 110)", () => {
  it("serves the fresh goalie partition over a stale shared partition on landing, detail and chart", async () => {
    const tables = buildFixtureTables();
    const snapshots = await buildSharedSnapshots(tables);
    tables.goalie_underlying_summary_partitions.push(...goaliePartitionsFrom(snapshots));
    tables.nhl_api_game_payloads_raw.push(
      ...snapshots.map((row, index) => ({ ...staleCopy(row, 10), id: index + 1 }))
    );
    fake.client = createFakeSupabase(tables);

    const landing = await callRoute(goaliesHandler, allQuery);
    expect(landing.rows.find((row) => row.playerId === HOME_GOALIE)).toMatchObject({
      shotsAgainst: 3,
      saves: 2,
    });

    const detail = await callRoute(goalieDetailHandler, { ...allQuery, playerId: String(AWAY_GOALIE) });
    expect(detail.rows[0]).toMatchObject({ shotsAgainst: 2, saves: 1 });

    const chart = await callRoute(goalieChartHandler, { ...allQuery, playerId: String(AWAY_GOALIE) });
    expect(chart.rows[0]).toMatchObject({ shotsAgainst: 2, saves: 1 });
  });

  it("rebuilds from raw payloads when the goalie partition is stale and no fresh copy exists", async () => {
    const tables = buildFixtureTables();
    const snapshots = await buildSharedSnapshots(tables);
    tables.goalie_underlying_summary_partitions.push(
      ...goaliePartitionsFrom(snapshots).map((row) => staleCopy(row, 10))
    );
    tables.nhl_api_game_payloads_raw.push(
      ...snapshots.map((row, index) => ({ ...staleCopy(row, 20), id: index + 1 }))
    );
    fake.client = createFakeSupabase(tables);

    const detail = await callRoute(goalieDetailHandler, { ...allQuery, playerId: String(HOME_GOALIE) });
    expect(detail.rows[0]).toMatchObject({ shotsAgainst: 3, saves: 2 });
  });

  it("treats a game as complete when its all-situation partition is fresh, so an empty split is not rebuilt", async () => {
    const tables = buildFixtureTables();
    const snapshots = await buildSharedSnapshots(tables);
    tables.goalie_underlying_summary_partitions.push(...goaliePartitionsFrom(snapshots));
    // Raw sources removed: any raw rebuild would now produce no rows at all.
    tables.nhl_api_pbp_events = [];
    tables.nhl_api_shift_rows = [];
    fake.client = createFakeSupabase(tables);

    const pk = await callRoute(goaliesHandler, { ...allQuery, strength: "penaltyKill", venue: "away" });
    expect(pk.rows.find((row) => row.playerId === AWAY_GOALIE)).toMatchObject({ toiSeconds: 50, goalsAgainst: 1 });
    const threeOnThree = await callRoute(goaliesHandler, { ...allQuery, strength: "threeOnThree", venue: "away" });
    expect(threeOnThree.rows).toEqual([]);
  });
});

describe("goalie snapshot seeding never copies a stale shared partition (DR1)", () => {
  it("raw-builds a game whose shared goalie partitions are stale", async () => {
    const tables = buildFixtureTables();
    const snapshots = await buildSharedSnapshots(tables);
    tables.nhl_api_game_payloads_raw.push(
      ...snapshots.map((row, index) => ({ ...staleCopy(row, 10), id: index + 1 }))
    );
    const client = createFakeSupabase(tables);

    const result = await refreshGoalieUnderlyingSummarySnapshotsForGameIds({
      gameIds: [Number(tables.games[0]!.id)],
      preferSharedSnapshotSeed: true,
      supabase: client as any,
    });

    expect(result.seededGameIds).toEqual([]);
    const all = tables.goalie_underlying_summary_partitions.find(
      (row) => row.strength === "allStrengths" && row.score_state === "allScores"
    ) as Record<string, any>;
    const home = all.payload.rows.find((row: any) => row.playerId === HOME_GOALIE);
    expect(home.metrics.goalies.shotsAgainst).toBe(3);
    expect(all.payload.formulaRevision).toBeGreaterThan(0);
  });
});
