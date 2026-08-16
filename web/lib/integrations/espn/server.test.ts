import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EspnLeagueStateV1 } from "./contracts";

const mocks = vi.hoisted(() => ({
  getEspnLeague: vi.fn(),
  getEspnTransactions: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("./client", () => ({
  EspnApiError: class EspnApiError extends Error {
    constructor(
      message: string,
      public readonly code: string,
      public readonly statusCode: number,
    ) {
      super(message);
    }
  },
  getEspnLeague: mocks.getEspnLeague,
  getEspnTransactions: mocks.getEspnTransactions,
}));

vi.mock("lib/supabase/server", () => ({
  default: { rpc: mocks.rpc },
}));

import { EspnApiError } from "./client";
import {
  backfillEspnTransactions,
  isEspnFantasyEnabled,
  isEspnLiveDraftEnabled,
  linkEspnAccount,
  parseEspnLeagueRef,
  resolveEspnPlayers,
  runEspnScheduledSync,
  validateEspnS2,
  validateEspnSeason,
  validateEspnSwid,
} from "./server";

const transactionState: EspnLeagueStateV1 = {
  version: 1,
  externalLeagueKey: "fhl:2026:123456",
  espnLeagueId: "123456",
  seasonKey: "2026",
  currentScoringPeriodId: 1,
  currentMatchupPeriodId: 1,
  isActive: true,
  teams: [],
  matchups: [],
  transactions: [],
  draft: { drafted: false, inProgress: false, completeDate: null, picks: [] },
  sectionFreshness: {},
  cursor: { transactionCount: 0, complete: false },
  sourceHash: "a".repeat(64),
  fetchedAt: "2026-08-14T12:00:00.000Z",
};

function transactionPage(offset: number, count: number) {
  return {
    transactions: Array.from({ length: count }, (_, index) => ({
      id: `tx-${offset + index}`,
      type: "ROSTER",
      status: "EXECUTED",
      proposedDate: 1_767_225_600_000 + offset + index,
      scoringPeriodId: 1,
      items: [],
    })),
  };
}

describe("ESPN Fantasy integration policy and validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ESPN_FANTASY_API_ENABLED", "true");
    vi.stubEnv("ESPN_FANTASY_ALLOWED_USER_IDS", "user-1, user-2");
    vi.stubEnv("ESPN_FANTASY_LIVE_DRAFT_ENABLED", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requires both the off-by-default feature flag and an exact allowlist match", () => {
    expect(isEspnFantasyEnabled("user-1")).toBe(true);
    expect(isEspnFantasyEnabled("user-3")).toBe(false);
    expect(isEspnFantasyEnabled(null)).toBe(false);
    expect(isEspnLiveDraftEnabled("user-1")).toBe(true);

    vi.stubEnv("ESPN_FANTASY_API_ENABLED", "false");
    expect(isEspnFantasyEnabled("user-1")).toBe(false);
    expect(isEspnLiveDraftEnabled("user-1")).toBe(false);

    vi.stubEnv("ESPN_FANTASY_API_ENABLED", "true");
    vi.stubEnv("ESPN_FANTASY_ALLOWED_USER_IDS", "");
    expect(isEspnFantasyEnabled("user-1")).toBe(false);
  });

  it("does not query scheduled league state unless both beta gates are configured", async () => {
    vi.stubEnv("ESPN_FANTASY_ALLOWED_USER_IDS", "");
    const client = { from: vi.fn() };

    await expect(
      runEspnScheduledSync({ client: client as never }),
    ).resolves.toEqual({
      processed: 0,
      changed: 0,
      failed: 0,
      disabled: true,
    });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("pages transaction periods, persists a partial offset, and resumes idempotently", async () => {
    mocks.getEspnTransactions
      .mockResolvedValueOnce(transactionPage(0, 100))
      .mockRejectedValueOnce(new Error("transient"));

    const partial = await backfillEspnTransactions({
      credentials: {
        swid: "{00000000-0000-0000-0000-000000000001}",
        espnS2: "redacted-session",
      },
      leagueId: "123456",
      season: 2026,
      state: transactionState,
      previous: null,
    });

    expect(partial.state.transactions).toHaveLength(100);
    expect(partial.state.cursor.complete).toBe(false);
    expect(partial.syncCursor).toEqual({
      nextScoringPeriodId: 1,
      transactionOffset: 100,
      transactionBackfillComplete: false,
      transactionBackfillErrorCode: "ESPN_TRANSACTION_BACKFILL_INTERRUPTED",
    });
    expect(mocks.getEspnTransactions).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ scoringPeriodId: 1, transactionOffset: 100 }),
    );

    mocks.getEspnTransactions.mockReset();
    mocks.getEspnTransactions.mockResolvedValue(transactionPage(100, 1));
    const complete = await backfillEspnTransactions({
      credentials: {
        swid: "{00000000-0000-0000-0000-000000000001}",
        espnS2: "redacted-session",
      },
      leagueId: "123456",
      season: 2026,
      state: transactionState,
      previous: {
        normalized_state: partial.state,
        sync_cursor: partial.syncCursor,
      },
    });

    expect(mocks.getEspnTransactions).toHaveBeenCalledWith(
      expect.objectContaining({ scoringPeriodId: 1, transactionOffset: 100 }),
    );
    expect(complete.state.transactions).toHaveLength(101);
    expect(complete.state.cursor.complete).toBe(true);
    expect(complete.syncCursor).toEqual({
      nextScoringPeriodId: 2,
      transactionOffset: 0,
      transactionBackfillComplete: true,
      transactionBackfillErrorCode: null,
    });
  });

  it("does not hide expired credentials during a transaction backfill", async () => {
    mocks.getEspnTransactions.mockRejectedValue(
      new EspnApiError("expired", "ESPN_REAUTH_REQUIRED", 409),
    );

    await expect(
      backfillEspnTransactions({
        credentials: {
          swid: "{00000000-0000-0000-0000-000000000001}",
          espnS2: "redacted-session",
        },
        leagueId: "123456",
        season: 2026,
        state: transactionState,
        previous: null,
      }),
    ).rejects.toMatchObject({ code: "ESPN_REAUTH_REQUIRED" });
  });

  it("auto-verifies only a unique normalized name, NHL team, and position match", async () => {
    const externalIdentityUpsert = vi.fn(async () => ({ error: null }));
    const client = {
      from: vi.fn((table: string) => {
        if (table === "fhfh_player_external_identities") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  in: vi.fn(async () => ({ data: [], error: null })),
                })),
              })),
            })),
            upsert: externalIdentityUpsert,
          };
        }
        if (table === "teams") {
          return {
            select: vi.fn(() => ({
              in: vi.fn(async () => ({
                data: [{ id: 77, abbreviation: "TOR" }],
                error: null,
              })),
            })),
          };
        }
        if (table === "fhfh_player_identities") {
          return {
            select: vi.fn(() => ({
              in: vi.fn((column: string, values: number[]) => {
                expect(column).toBe("current_nhl_team_id");
                expect(values).toEqual([77]);
                return {
                  is: vi.fn(async () => ({
                    data: [
                      {
                        id: 42,
                        canonical_name: "Normalized Name",
                        canonical_position: "C",
                        current_nhl_team_id: 77,
                      },
                    ],
                    error: null,
                  })),
                };
              }),
            })),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    };
    const state: EspnLeagueStateV1 = {
      ...transactionState,
      teams: [
        {
          externalTeamKey: "1",
          name: "Test Team",
          abbreviation: "TST",
          divisionId: null,
          isOwned: true,
          roster: [
            {
              externalPlayerId: "9001",
              playerName: "  normalized   name ",
              position: "C",
              proTeamId: 21,
              lineupSlotId: 0,
              acquisitionType: null,
              injuryStatus: null,
            },
          ],
          record: {
            wins: 0,
            losses: 0,
            ties: 0,
            pointsFor: 0,
            pointsAgainst: 0,
            percentage: null,
            rank: null,
          },
        },
      ],
    };

    const resolved = await resolveEspnPlayers(client as never, state);

    expect(resolved.teams[0].roster[0]).toMatchObject({
      fhfhPlayerId: 42,
      mappingStatus: "mapped",
    });
    expect(externalIdentityUpsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          external_player_id: "9001",
          fhfh_player_id: 42,
          verification_status: "verified",
          match_method: "exact_name_team_position",
        }),
      ],
      expect.objectContaining({ ignoreDuplicates: true }),
    );
  });

  it("accepts numeric IDs or canonical HTTPS ESPN URLs only", () => {
    expect(parseEspnLeagueRef(123456)).toBe("123456");
    expect(
      parseEspnLeagueRef(
        "https://fantasy.espn.com/hockey/league?leagueId=123456",
      ),
    ).toBe("123456");
    expect(
      parseEspnLeagueRef(
        "https://lm-api-reads.fantasy.espn.com/apis/v3/games/fhl/leagues/98765",
      ),
    ).toBe("98765");
    expect(() =>
      parseEspnLeagueRef("https://notespn.com/hockey?leagueId=123456"),
    ).toThrowError(expect.objectContaining({ code: "ESPN_LEAGUE_REF_INVALID" }));
    expect(() =>
      parseEspnLeagueRef("http://fantasy.espn.com/hockey?leagueId=123456"),
    ).toThrowError(expect.objectContaining({ code: "ESPN_LEAGUE_REF_INVALID" }));
  });

  it("normalizes SWID and enforces bounded cookie and four-digit season values", () => {
    expect(
      validateEspnSwid("00000000-0000-0000-0000-0000000000aa"),
    ).toBe("{00000000-0000-0000-0000-0000000000AA}");
    expect(validateEspnS2('"redacted-session"')).toBe("redacted-session");
    expect(validateEspnSeason("2026")).toBe(2026);
    expect(validateEspnSeason(2025)).toBe(2025);
    expect(() => validateEspnSeason("02026")).toThrowError(
      expect.objectContaining({ code: "ESPN_SEASON_INVALID" }),
    );
    expect(() => validateEspnS2("bad\nvalue")).toThrowError(
      expect.objectContaining({ code: "ESPN_S2_INVALID" }),
    );
  });

  it("rejects disabled, unconsented, or malformed links before ESPN or Vault access", async () => {
    const valid = {
      userId: "user-1",
      accountLabel: "My ESPN",
      swid: "{00000000-0000-0000-0000-000000000001}",
      espnS2: "redacted-session",
      leagueRef: "123456",
      season: "2026",
      consentVersion: "espn-fantasy-private-beta-v1",
    };

    vi.stubEnv("ESPN_FANTASY_API_ENABLED", "false");
    await expect(linkEspnAccount(valid)).rejects.toMatchObject({
      code: "ESPN_API_DISABLED",
    });

    vi.stubEnv("ESPN_FANTASY_API_ENABLED", "true");
    await expect(
      linkEspnAccount({ ...valid, consentVersion: "stale-consent" }),
    ).rejects.toMatchObject({ code: "ESPN_CONSENT_REQUIRED" });
    await expect(
      linkEspnAccount({ ...valid, leagueRef: "not-a-league" }),
    ).rejects.toMatchObject({ code: "ESPN_LEAGUE_REF_INVALID" });

    expect(mocks.getEspnLeague).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
