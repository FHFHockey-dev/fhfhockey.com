import { describe, expect, it } from "vitest";

import {
  fetchSeasonTeamSummaryGameIdSet,
  resolveGameOutcomeFromOfficialPayload,
} from "./teamStatsSummaryRefresh";

type MockSummaryRow = {
  game_id: number;
  team_id: number;
  toi_seconds: number;
  season_id: number;
  game_type: number;
  strength: string;
  score_state: string;
};

function createSummaryRow(overrides: Partial<MockSummaryRow>): MockSummaryRow {
  return {
    game_id: 1,
    team_id: 1,
    toi_seconds: 3600,
    season_id: 20252026,
    game_type: 2,
    strength: "allStrengths",
    score_state: "allScores",
    ...overrides,
  };
}

function createMockSupabase(rows: MockSummaryRow[]) {
  return {
    from(table: string) {
      if (table !== "team_underlying_stats_summary") {
        throw new Error(`Unexpected table: ${table}`);
      }

      const eqFilters = new Map<string, unknown>();

      return {
        select() {
          return this;
        },
        eq(column: string, value: unknown) {
          eqFilters.set(column, value);
          return this;
        },
        order() {
          return this;
        },
        async range(from: number, to: number) {
          const filtered = rows.filter((row) => {
            for (const [column, value] of eqFilters.entries()) {
              if (row[column as keyof MockSummaryRow] !== value) {
                return false;
              }
            }

            return true;
          });

          return {
            data: filtered.slice(from, to + 1),
            error: null,
          };
        },
      };
    },
  };
}

describe("fetchSeasonTeamSummaryGameIdSet", () => {
  it("only marks games covered when both teams have sampled broad rows", async () => {
    const supabase = createMockSupabase([
      createSummaryRow({ game_id: 10, team_id: 1, toi_seconds: 3600 }),
      createSummaryRow({ game_id: 10, team_id: 2, toi_seconds: 3600 }),
      createSummaryRow({ game_id: 11, team_id: 1, toi_seconds: 3600 }),
      createSummaryRow({ game_id: 12, team_id: 1, toi_seconds: 0 }),
      createSummaryRow({ game_id: 12, team_id: 2, toi_seconds: 0 }),
      createSummaryRow({ game_id: 13, team_id: 1, toi_seconds: 3600, strength: "fiveOnFive" }),
      createSummaryRow({ game_id: 13, team_id: 2, toi_seconds: 3600, strength: "fiveOnFive" }),
      createSummaryRow({ game_id: 14, team_id: 1, toi_seconds: 3600, game_type: 3 }),
      createSummaryRow({ game_id: 14, team_id: 2, toi_seconds: 3600, game_type: 3 }),
    ]);

    const covered = await fetchSeasonTeamSummaryGameIdSet({
      supabase: supabase as never,
      seasonId: 20252026,
      requestedGameType: 2,
    });

    expect([...covered]).toEqual([10]);
  });
});

describe("resolveGameOutcomeFromOfficialPayload", () => {
  it("classifies shootout and overtime decisions from official payload scores", () => {
    expect(
      resolveGameOutcomeFromOfficialPayload({
        homeTeamId: 21,
        awayTeamId: 7,
        payload: {
          periodDescriptor: { periodType: "SO" },
          homeTeam: { id: 21, score: 4 },
          awayTeam: { id: 7, score: 3 },
        },
      })
    ).toEqual({
      winnerTeamId: 21,
      outcomeType: "shootout",
    });

    expect(
      resolveGameOutcomeFromOfficialPayload({
        homeTeamId: 21,
        awayTeamId: 7,
        payload: {
          summary: {
            scoring: [
              { periodDescriptor: { periodType: "REG" } },
              { periodDescriptor: { periodType: "OT" } },
            ],
          },
          homeTeam: { id: 21, score: 2 },
          awayTeam: { id: 7, score: 3 },
        },
      })
    ).toEqual({
      winnerTeamId: 7,
      outcomeType: "overtime",
    });
  });

  it("returns null when the payload is tied or mismatched", () => {
    expect(
      resolveGameOutcomeFromOfficialPayload({
        homeTeamId: 21,
        awayTeamId: 7,
        payload: {
          gameOutcome: { lastPeriodType: "SO" },
          homeTeam: { id: 21, score: 3 },
          awayTeam: { id: 7, score: 3 },
        },
      })
    ).toBeNull();

    expect(
      resolveGameOutcomeFromOfficialPayload({
        homeTeamId: 21,
        awayTeamId: 7,
        payload: {
          gameOutcome: { lastPeriodType: "REG" },
          homeTeam: { id: 99, score: 3 },
          awayTeam: { id: 7, score: 2 },
        },
      })
    ).toBeNull();
  });
});