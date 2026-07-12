import { describe, expect, it, vi } from "vitest";

import {
  buildLineCombinationSourceMutation,
  selectLineCombinationSourceMutations,
  syncLineCombinationSourceWinners,
  type LineCombinationSourceRow,
} from "./lineSourceLineCombinations";

function row(
  overrides: Partial<LineCombinationSourceRow> = {},
): LineCombinationSourceRow {
  return {
    capture_key: overrides.capture_key ?? "capture-1",
    source_key: overrides.source_key ?? "gamedaylines",
    source_account: overrides.source_account ?? "GameDayLines",
    source_url: overrides.source_url ?? "https://x.com/GameDayLines/status/100",
    tweet_id: overrides.tweet_id ?? "100",
    snapshot_date: overrides.snapshot_date ?? "2026-07-11",
    observed_at: overrides.observed_at ?? "2026-07-11T12:01:00.000Z",
    tweet_posted_at: overrides.tweet_posted_at ?? "2026-07-11T12:00:00.000Z",
    game_id: overrides.game_id ?? 42,
    team_id: overrides.team_id ?? 1,
    team_abbreviation: overrides.team_abbreviation ?? "BOS",
    classification: overrides.classification ?? "lineup",
    status: overrides.status ?? "observed",
    nhl_filter_status: overrides.nhl_filter_status ?? "accepted",
    line_1_player_ids: overrides.line_1_player_ids ?? [1, 2, 3],
    line_2_player_ids: overrides.line_2_player_ids ?? [4, 5, 6],
    line_3_player_ids: overrides.line_3_player_ids ?? [7, 8, 9],
    line_4_player_ids: overrides.line_4_player_ids ?? [10, 11, 12],
    pair_1_player_ids: overrides.pair_1_player_ids ?? [13, 14],
    pair_2_player_ids: overrides.pair_2_player_ids ?? [15, 16],
    pair_3_player_ids: overrides.pair_3_player_ids ?? [17, 18],
    goalie_1_player_id: overrides.goalie_1_player_id ?? 19,
    goalie_2_player_id: overrides.goalie_2_player_id ?? 20,
    ...overrides,
  };
}

describe("tweet-derived lineCombinations mutations", () => {
  it("maps a complete accepted lineup into flattened canonical arrays", () => {
    expect(buildLineCombinationSourceMutation(row())).toMatchObject({
      gameId: 42,
      teamId: 1,
      forwards: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      defensemen: [13, 14, 15, 16, 17, 18],
      goalies: [19, 20],
      sourceKind: "tweet",
      sourceKey: "gamedaylines",
    });
  });

  it("allows canonical goalie-only updates while preserving skater arrays", () => {
    expect(
      buildLineCombinationSourceMutation(
        row({ classification: "goalie_start", goalie_2_player_id: null }),
      ),
    ).toMatchObject({ forwards: null, defensemen: null, goalies: [19] });
  });

  it("rejects incomplete lineups and non-lineup classifications", () => {
    expect(
      buildLineCombinationSourceMutation(row({ line_4_player_ids: null })),
    ).toBeNull();
    expect(
      buildLineCombinationSourceMutation(row({ classification: "injury" })),
    ).toBeNull();
  });

  it("uses the shared first-arrival winner before building mutations", () => {
    const mutations = selectLineCombinationSourceMutations([
      row({
        source_key: "ccc",
        capture_key: "first",
        tweet_posted_at: "2026-07-11T12:00:00Z",
      }),
      row({
        source_key: "gamedaylines",
        capture_key: "later",
        tweet_id: "200",
        tweet_posted_at: "2026-07-11T12:05:00Z",
      }),
    ]);

    expect(mutations).toHaveLength(1);
    expect(mutations[0]?.sourceCaptureKey).toBe("first");
  });

  it("paginates both source tables and calls the atomic provenance RPC for the winner", async () => {
    const rangeCalls: Array<{ table: string; from: number; to: number }> = [];
    const rpc = vi.fn(() => ({
      throwOnError: vi.fn().mockResolvedValue({ data: {}, error: null }),
    }));
    const supabase = {
      from: vi.fn((table: string) => {
        const query: any = {
          select: vi.fn(() => query),
          eq: vi.fn(() => query),
          order: vi.fn(() => query),
          range: vi.fn(async (from: number, to: number) => {
            rangeCalls.push({ table, from, to });
            return {
              data:
                table === "lines_ccc"
                  ? [row({ source_key: undefined, capture_key: "ccc-first" })]
                  : [
                      row({
                        source_key: "gamedaylines",
                        capture_key: "gdl-later",
                        tweet_id: "200",
                        tweet_posted_at: "2026-07-11T12:05:00Z",
                      }),
                    ],
              error: null,
            };
          }),
        };
        return query;
      }),
      rpc,
    };

    const result = await syncLineCombinationSourceWinners({
      supabase,
      date: "2026-07-11",
    });

    expect(rangeCalls).toEqual([
      { table: "lines_ccc", from: 0, to: 999 },
      { table: "line_source_snapshots", from: 0, to: 999 },
    ]);
    expect(result).toMatchObject({
      sourceRows: 2,
      eligibleWinners: 1,
      written: 1,
      failures: [],
    });
    expect(rpc).toHaveBeenCalledWith(
      "upsert_line_combinations_from_source",
      expect.objectContaining({
        p_game_id: 42,
        p_team_id: 1,
        p_source_key: "ccc",
        p_source_capture_key: "ccc-first",
      }),
    );
  });
});
