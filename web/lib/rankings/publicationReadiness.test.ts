import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { ROLLING_WINDOW_COUNT_SUPPORT_VERSION } from "lib/rollingPlayerWindowCountSupport";
import type { Database } from "lib/supabase/database-generated.types";
import {
  readRankingPublicationReadiness,
  validateRankingPublicationBuildSources,
} from "./publicationReadiness";
import type { RollingPlayerGameMetricRow } from "./skaterWindowAggregation";

const input = { season: 20262027, lastServedDate: "2026-11-14", cutoffDate: "2026-11-17" };
const newest = {
  playerId: 1,
  gameId: 2026020336,
  gameDate: input.cutoffDate,
  updatedAt: "2026-11-18T10:21:04.123456+00:00",
  supportUpdatedAt: "2026-11-18T10:21:04.123456+00:00",
};
const inactive = {
  playerId: 2,
  gameId: 2026020314,
  gameDate: "2026-11-14",
  updatedAt: "2026-11-15T10:21:00.249923+00:00",
  supportUpdatedAt: "2026-11-15T10:20:59.123493+00:00",
};
const receipt = {
  status: "ready",
  cutoffDate: input.cutoffDate,
  expectedRollingSources: [inactive, newest],
  readyAt: "2026-11-18T10:22:00+00:00",
  evidence: { boxscores: [[2026020336, "proof"]] },
};

function fakeRpc(data: unknown, error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error });
  return { rpc, client: { rpc } as unknown as SupabaseClient<Database> };
}

function loaded(source: typeof newest) {
  return {
    player_id: source.playerId,
    game_id: source.gameId,
    game_date: source.gameDate,
    updated_at: source.updatedAt,
    windowCountSupportUpdatedAt: source.supportUpdatedAt,
    windowCountSupport: { version: ROLLING_WINDOW_COUNT_SUPPORT_VERSION },
  } as RollingPlayerGameMetricRow & { windowCountSupportUpdatedAt: string };
}

describe("scheduled Rankings source admission", () => {
  it("reads one scoped readiness snapshot and binds the loaded player and support revisions", async () => {
    const { client, rpc } = fakeRpc(receipt);
    const result = await readRankingPublicationReadiness({ ...input, client });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("read_rankings_publication_readiness", {
      p_season: 20262027, p_last_served: "2026-11-14", p_cutoff: "2026-11-17",
    });
    expect(result).toMatchObject({
      status: "ready", readyAt: "2026-11-18T10:22:00.000000Z", expectedPlayerIds: [1, 2],
      sourceDigest: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    if (result.status !== "ready") throw new Error("Expected ready receipt");
    const rows = [loaded(inactive), loaded(newest)];
    expect(() => validateRankingPublicationBuildSources(result, rows)).not.toThrow();
    const changed = { ...rows[1], windowCountSupportUpdatedAt: "2026-11-18T10:21:04.123457Z" };
    expect(() => validateRankingPublicationBuildSources(result, [rows[0], changed])).toThrow("changed after readiness");
    expect(() => validateRankingPublicationBuildSources(result, [rows[0], rows[0]])).toThrow("cohort");
    expect(() => validateRankingPublicationBuildSources(result, [{ ...rows[0], windowCountSupport: null }, rows[1]]))
      .toThrow("changed after readiness");
  });

  it("rejects a missing function, malformed receipt or duplicate ready cohort", async () => {
    for (const rpc of [
      fakeRpc(null, { code: "PGRST202" }),
      fakeRpc({ ...receipt, expectedRollingSources: [newest, newest] }),
      fakeRpc({ ...receipt, cutoffDate: "2026-11-16" }),
      fakeRpc({ ...receipt, readyAt: "2026-11-18T09:20:00Z" }),
    ]) expect(await readRankingPublicationReadiness({ ...input, client: rpc.client })).toMatchObject({ status: "blocked" });
  });

  it("preserves the source gap reason and distinguishes a no-slate cutoff", async () => {
    const incomplete = { status: "blocked", reason: "source_incomplete", details: ["wgo_appearance_mismatch"] };
    expect(await readRankingPublicationReadiness({ ...input, client: fakeRpc(incomplete).client })).toEqual(incomplete);
    const noSlate = { status: "no_slate", cutoffDate: input.cutoffDate };
    expect(await readRankingPublicationReadiness({ ...input, client: fakeRpc(noSlate).client })).toEqual(noSlate);
  });
});
