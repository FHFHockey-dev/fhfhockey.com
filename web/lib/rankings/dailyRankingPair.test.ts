import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "lib/supabase/database-generated.types";

import { createFakeSupabase, failClosedFetch, type FakeDb } from "./__acceptance__/fakeSupabase";
import { seedDailyRankingInput } from "./__acceptance__/dailyRankingInput";
import { prepareDailyRankingPair, publishDailyRankingPair } from "./dailyRankingPair";
import type { RankingPublicationReady } from "./publicationReadiness";
import { buildEntityMetricRankingRows } from "./entityMetricRankingWriter";
import { buildSkaterCompositeRatingRows } from "./skaterCompositeWriter";

const { manualFrom } = vi.hoisted(() => ({ manualFrom: vi.fn() }));
vi.mock("lib/supabase/server", () => ({ default: { from: manualFrom } }));

const season = 20262027;
const cutoffDate = "2026-11-16";
const idleDate = "2026-11-08";
const db: FakeDb = { tables: {}, calls: [] };
const memory = createFakeSupabase(db);
const client = memory as unknown as SupabaseClient<Database>;
const fetchSpy = vi.fn(failClosedFetch());

function ready(): RankingPublicationReady {
  return {
    status: "ready", cutoffDate, readyAt: cutoffDate + "T08:00:00.000Z", sourceDigest: "fixture",
    expectedPlayerIds: [1, 2, 3], expectedRollingSources: [1, 2, 3].map(playerId => {
      const date = playerId === 1 ? idleDate : cutoffDate;
      return { playerId, gameDate: date, gameId: playerId === 1 ? 2026020200 : 2026020250,
        updatedAt: date + "T06:00:00.000Z", supportUpdatedAt: date + "T06:00:00.000Z" };
    }),
  };
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchSpy);
  fetchSpy.mockClear();
  manualFrom.mockReset().mockImplementation(() => { throw new Error("Unexpected default client read"); });
  db.calls = [];
  db.tables = {
    wgo_skater_stats: [], rolling_player_game_metrics: [], rolling_player_metric_support_payloads: [],
    entity_metric_rankings: [], skater_composite_ratings: [], ranking_publications: [],
    players: [1, 2, 3].map(id => ({ id, fullName: "Skater " + id, position: "C" })),
    teams: [{ id: 22, abbreviation: "EDM" }, { id: 10, abbreviation: "TOR" }],
  };
  for (const src of ready().expectedRollingSources) {
    seedDailyRankingInput(db, season, src.playerId, src.gameDate, src.playerId, src.gameId);
  }
});

afterEach(() => { expect(fetchSpy).not.toHaveBeenCalled(); vi.unstubAllGlobals(); });

describe("daily paired Rankings", () => {
  it("prepares both full builds on one snapshot, preserves manual composite semantics, then publishes all five markers", async () => {
    const prepared = await prepareDailyRankingPair(client, season, ready());
    expect(prepared).toMatchObject({ cutoffDate, expectedPlayerCount: 3, expectedRankingRows: 204 });
    expect(db.calls.map(call => call.table).sort()).toEqual([
      "players", "rolling_player_game_metrics", "rolling_player_metric_support_payloads", "teams", "wgo_skater_stats",
    ]);
    expect(db.tables.ranking_publications).toEqual([]);
    expect(manualFrom).not.toHaveBeenCalled();
    // Old and new rows exercise both Results Luck exact-date provenance branches.
    manualFrom.mockImplementation(memory.from);
    const manualRankings = await buildEntityMetricRankingRows(prepared.rankings.request);
    const manual = await buildSkaterCompositeRatingRows(prepared.composites.request);
    expect(prepared.rankings.rows).toEqual(manualRankings.rows);
    expect(prepared.composites.rows).toEqual(manual.rows);
    manualFrom.mockReset().mockImplementation(() => { throw new Error("Unexpected default client read"); });
    const published = await publishDailyRankingPair(client, prepared);
    expect(published.rankings.dbWrittenRows).toBe(204);
    expect(published.composites.dbWrittenRows).toBe(3);
    expect(db.tables.ranking_publications.map(row => row.status)).toEqual(Array(5).fill("complete"));
    expect(manualFrom).not.toHaveBeenCalled();
  });

  it.each(["cohort", "rolling revision", "support revision", "missing source table", "no calculable metric"])(
    "refuses before writing on %s disagreement", async kind => {
      const readiness = ready();
      if (kind === "cohort") db.tables.wgo_skater_stats[0].player_id = 99;
      if (kind === "rolling revision") db.tables.rolling_player_game_metrics[0].updated_at = "2026-11-16T15:00:00Z";
      if (kind === "support revision") db.tables.rolling_player_metric_support_payloads[0].updated_at = "2026-11-16T15:00:00Z";
      if (kind === "missing source table") delete db.tables.rolling_player_metric_support_payloads;
      if (kind === "no calculable metric") {
        for (const row of db.tables.rolling_player_game_metrics) row.points_avg_season = null;
      }
      await expect(prepareDailyRankingPair(client, season, readiness)).rejects.toThrow();
      expect(db.tables.ranking_publications).toEqual([]);
      expect(db.tables.entity_metric_rankings).toEqual([]);
      expect(db.tables.skater_composite_ratings).toEqual([]);
    },
  );

  it("holds all writes when the Rankings build succeeds but season composites have no qualified score", async () => {
    for (const table of ["wgo_skater_stats", "rolling_player_game_metrics", "rolling_player_metric_support_payloads"]) {
      db.tables[table] = db.tables[table].filter(row => row.player_id !== 3);
    }
    const readiness = ready();
    await expect(prepareDailyRankingPair(client, season, { ...readiness, expectedPlayerIds: [1, 2],
      expectedRollingSources: readiness.expectedRollingSources.slice(0, 2),
    })).rejects.toThrow(/No complete, qualified MCM rows/);
    expect(db.tables.ranking_publications).toEqual([]);
    expect(db.tables.entity_metric_rankings).toEqual([]);
    expect(db.tables.skater_composite_ratings).toEqual([]);
  });

  it("stops on a short composite upsert without marking the pair complete or reissuing the write", async () => {
    const prepared = await prepareDailyRankingPair(client, season, ready());
    db.calls = [];
    const interrupted = { from(table: string) {
      const query = memory.from(table);
      if (table === "skater_composite_ratings") query.upsert = () => ({ count: 2, error: null });
      return query;
    } };
    await expect(publishDailyRankingPair(interrupted as unknown as SupabaseClient<Database>, prepared))
      .rejects.toThrow(/reported 2 written rows/);
    expect(db.calls.at(-1)?.table).toBe("skater_composite_ratings");
    expect(db.calls.filter(call => call.table === "skater_composite_ratings")).toHaveLength(1);
    expect(db.tables.ranking_publications.map(row => row.status)).toEqual(["complete", "complete", "complete", "complete", "writing"]);
  });

  it.each(["error", "short count"])("makes no split, later-window or composite writes after a Rankings chunk %s", async failure => {
    const prepared = await prepareDailyRankingPair(client, season, ready());
    const writes: number[] = [];
    const interrupted = { from(table: string) {
      const query = memory.from(table);
      if (table === "entity_metric_rankings") {
        const write = query.upsert;
        query.upsert = (rows: Record<string, unknown>[], options: unknown) => {
          writes.push(rows.length);
          if (writes.length === 2) return failure === "error" ? { error: { message: "fixture failure" } } : { count: 0 };
          return write(rows, options);
        };
      }
      return query;
    } };
    await expect(publishDailyRankingPair(interrupted as unknown as SupabaseClient<Database>, prepared)).rejects.toThrow();
    expect(writes).toEqual([51, 51]);
    expect(db.tables.ranking_publications.map(row => row.status)).toEqual(["complete", "writing", "writing", "writing"]);
    expect(db.tables.skater_composite_ratings).toEqual([]);
  });
});
