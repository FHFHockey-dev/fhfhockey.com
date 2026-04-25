import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentSeasonMock = vi.fn();
const getTeamsMock = vi.fn();
const fromMock = vi.fn();

vi.mock("lib/NHL/server", () => ({
  getCurrentSeason: getCurrentSeasonMock,
  getTeams: getTeamsMock
}));

vi.mock("utils/adminOnlyMiddleware", () => ({
  default: (handler: any) => async (req: any, res: any) =>
    handler(
      {
        ...req,
        supabase: {
          from: fromMock
        }
      },
      res
    )
}));

vi.mock("lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: any) => async (req: any, res: any) => {
    try {
      await handler(req, res);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error?.message ?? "Unknown error"
      });
    }
  }
}));

import handler from "../../../../../pages/api/v1/db/update-lines-ccc";

function createMockReq(overrides: Record<string, unknown> = {}) {
  return {
    method: "POST",
    query: {
      date: "2026-04-24",
      limit: "10"
    },
    ...overrides
  } as any;
}

function createMockRes() {
  return {
    statusCode: 200,
    headers: {} as Record<string, unknown>,
    body: undefined as unknown,
    setHeader(name: string, value: unknown) {
      this.headers[name] = value;
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    }
  } as any;
}

function createSupabaseMocks(args?: { linesCccUpsertError?: Error }) {
  const linesCccUpsertMock = vi.fn().mockResolvedValue({
    error: args?.linesCccUpsertError ?? null
  });
  const eventUpdateEqMock = vi.fn().mockResolvedValue({ error: null });
  const eventUpdateMock = vi.fn(() => ({
    eq: eventUpdateEqMock
  }));

  const tables: Record<string, any> = {
    games: {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: 2025030111,
                date: "2026-04-24",
                homeTeamId: 8,
                awayTeamId: 14
              }
            ],
            error: null
          })
        }))
      }))
    },
    rosters: {
      select: vi.fn(() => ({
        in: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({
            data: [
              {
                teamId: 8,
                playerId: 9,
                players: {
                  fullName: "Jakub Dobes",
                  lastName: "Dobes"
                }
              }
            ],
            error: null
          })
        }))
      }))
    },
    lines_ccc_ifttt_events: {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "event-nhl",
                  source: "ifttt",
                  source_account: "CcCMiddleton",
                  username: "CcCMiddleton",
                  text:
                    "Canadiens lines\nconfirmed Canadiens Starting Goalie: Jakub Dobes https://t.co/NEEgtVpvUw",
                  link_to_tweet:
                    "https://twitter.com/CcCMiddleton/status/2047809041154625899",
                  tweet_id: "2047809041154625899",
                  tweet_created_at: null,
                  created_at_label: "April 24, 2026 at 06:44PM",
                  raw_payload: {},
                  received_at: "2026-04-24T22:46:29.954Z"
                },
                {
                  id: "event-ahl",
                  source: "ifttt",
                  source_account: "CcCMiddleton",
                  username: "CcCMiddleton",
                  text:
                    "AHL Crunch lines\nAHL Crunch Starting Goalie: Jon Gillies https://t.co/aATPLL0aCx",
                  link_to_tweet:
                    "https://twitter.com/CcCMiddleton/status/2047809990422147403",
                  tweet_id: "2047809990422147403",
                  tweet_created_at: null,
                  created_at_label: "April 24, 2026 at 06:48PM",
                  raw_payload: {},
                  received_at: "2026-04-24T22:51:13.800Z"
                }
              ],
              error: null
            })
          }))
        }))
      })),
      update: eventUpdateMock
    },
    lines_ccc: {
      upsert: linesCccUpsertMock
    }
  };

  fromMock.mockImplementation((tableName: string) => tables[tableName]);
  return {
    linesCccUpsertMock,
    eventUpdateMock,
    eventUpdateEqMock
  };
}

describe("/api/v1/db/update-lines-ccc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentSeasonMock.mockResolvedValue({ seasonId: 20252026 });
    getTeamsMock.mockResolvedValue([
      {
        id: 8,
        name: "Montréal Canadiens",
        abbreviation: "MTL",
        logo: "/teamLogos/MTL.png"
      },
      {
        id: 14,
        name: "Tampa Bay Lightning",
        abbreviation: "TBL",
        logo: "/teamLogos/TBL.png"
      }
    ]);
  });

  it("upserts parsed rows and marks source events processed or rejected", async () => {
    const { linesCccUpsertMock, eventUpdateMock, eventUpdateEqMock } =
      createSupabaseMocks();
    const req = createMockReq();
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      summary: {
        eventsLoaded: 2,
        tweetsParsed: 2,
        acceptedNhl: 1,
        nonNhlRejected: 1,
        rowsUpserted: 2,
        eventsProcessed: 1,
        eventsRejected: 1
      }
    });

    expect(linesCccUpsertMock).toHaveBeenCalledTimes(1);
    const upsertedRows = linesCccUpsertMock.mock.calls[0][0];
    expect(upsertedRows).toHaveLength(2);
    expect(upsertedRows[0]).toMatchObject({
      tweet_id: "2047809041154625899",
      team_abbreviation: "MTL",
      status: "observed",
      nhl_filter_status: "accepted",
      goalie_1_name: "Jakub Dobes",
      goalie_1_player_id: 9
    });
    expect(upsertedRows[1]).toMatchObject({
      tweet_id: "2047809990422147403",
      team_id: null,
      status: "rejected",
      nhl_filter_status: "rejected_non_nhl",
      detected_league: "AHL"
    });

    expect(eventUpdateMock).toHaveBeenCalledTimes(2);
    expect(eventUpdateMock.mock.calls[0][0]).toMatchObject({
      processing_status: "processed"
    });
    expect(eventUpdateMock.mock.calls[1][0]).toMatchObject({
      processing_status: "rejected"
    });
    expect(eventUpdateEqMock).toHaveBeenNthCalledWith(1, "id", "event-nhl");
    expect(eventUpdateEqMock).toHaveBeenNthCalledWith(2, "id", "event-ahl");
  });

  it("returns a 500 when lines_ccc upsert fails", async () => {
    createSupabaseMocks({
      linesCccUpsertError: new Error("upsert failed")
    });
    const req = createMockReq();
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      error: "upsert failed"
    });
  });
});
