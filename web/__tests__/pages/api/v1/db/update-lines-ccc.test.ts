import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentSeason: vi.fn(),
  getTeams: vi.fn(),
  from: vi.fn(),
}));

vi.mock("lib/NHL/server", () => ({
  getCurrentSeason: mocks.getCurrentSeason,
  getTeams: mocks.getTeams,
}));

vi.mock("utils/adminOnlyMiddleware", () => ({
  default: (handler: any) => async (req: any, res: any) =>
    handler(
      {
        ...req,
        supabase: {
          from: mocks.from,
        },
      },
      res,
    ),
}));

vi.mock("lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: any) => async (req: any, res: any) => {
    try {
      await handler(req, res);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error?.message ?? "Unknown error",
      });
    }
  },
}));

import handler from "../../../../../pages/api/v1/db/update-lines-ccc";

function createMockReq(overrides: Record<string, unknown> = {}) {
  return {
    method: "POST",
    query: {
      date: "2026-04-24",
      limit: "10",
    },
    ...overrides,
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
    },
  } as any;
}

function createSupabaseMocks(args?: {
  includeQuoteEvent?: boolean;
  linesCccUpsertErrors?: Array<Error | null>;
  linesCccUpsertError?: Error;
}) {
  let upsertCallIndex = 0;
  const linesCccUpsertMock = vi.fn().mockImplementation(() => {
    const configuredError =
      args?.linesCccUpsertErrors?.[upsertCallIndex] ??
      args?.linesCccUpsertError ??
      null;
    upsertCallIndex += 1;
    return Promise.resolve({
      error: configuredError,
    });
  });
  const linesCccUpdateEqMock = vi.fn().mockResolvedValue({ error: null });
  const staleRowUpdateQuery: any = {
    eq: linesCccUpdateEqMock,
    neq: vi.fn(() => staleRowUpdateQuery),
    then: (resolve: any) => Promise.resolve({ error: null }).then(resolve),
  };
  linesCccUpdateEqMock.mockImplementation(() => staleRowUpdateQuery);
  const linesCccUpdateMock = vi.fn(() => staleRowUpdateQuery);
  const unresolvedUpdateQuery: any = {
    eq: vi.fn(() => unresolvedUpdateQuery),
    neq: vi.fn(() => unresolvedUpdateQuery),
    then: (resolve: any) => Promise.resolve({ error: null }).then(resolve),
  };
  const unresolvedUpdateMock = vi.fn(() => unresolvedUpdateQuery);
  const eventUpdateEqMock = vi.fn().mockResolvedValue({ error: null });
  const eventUpdateMock = vi.fn(() => ({
    eq: eventUpdateEqMock,
  }));
  const unresolvedNamesUpsertMock = vi.fn().mockResolvedValue({ error: null });
  const eventRows = [
    {
      id: "event-nhl",
      source: "ifttt",
      source_account: "CcCMiddleton",
      username: "CcCMiddleton",
      text: "Canadiens lines\nconfirmed Canadiens Starting Goalie: Jakub Dobes https://t.co/NEEgtVpvUw",
      link_to_tweet:
        "https://twitter.com/CcCMiddleton/status/2047809041154625899",
      tweet_id: "2047809041154625899",
      tweet_created_at: null,
      created_at_label: "April 24, 2026 at 06:44PM",
      raw_payload: {
        linesCccOembed: {
          wrapper: {
            status: "failed",
            tweetId: "2047809041154625899",
            tweetUrl: "https://twitter.com/i/web/status/2047809041154625899",
            attemptCount: 1,
            lastAttemptAt: "2026-04-24T22:45:00.000Z",
            httpStatus: 500,
            lastError: "oembed_http_500",
          },
        },
      },
      received_at: "2026-04-24T22:46:29.954Z",
    },
    {
      id: "event-ahl",
      source: "ifttt",
      source_account: "CcCMiddleton",
      username: "CcCMiddleton",
      text: "AHL Crunch lines\nAHL Crunch Starting Goalie: Jon Gillies https://t.co/aATPLL0aCx",
      link_to_tweet:
        "https://twitter.com/CcCMiddleton/status/2047809990422147403",
      tweet_id: "2047809990422147403",
      tweet_created_at: null,
      created_at_label: "April 24, 2026 at 06:48PM",
      raw_payload: {
        linesCccOembed: {
          wrapper: {
            status: "failed",
            tweetId: "2047809990422147403",
            tweetUrl: "https://twitter.com/i/web/status/2047809990422147403",
            attemptCount: 1,
            lastAttemptAt: "2026-04-24T22:50:00.000Z",
            httpStatus: 500,
            lastError: "oembed_http_500",
          },
        },
      },
      received_at: "2026-04-24T22:51:13.800Z",
    },
  ];
  if (args?.includeQuoteEvent) {
    eventRows.push({
      id: "event-quote",
      source: "ifttt",
      source_account: "CcCMiddleton",
      username: "CcCMiddleton",
      text: "Lightning lines https://t.co/9cZkBXydVn",
      link_to_tweet:
        "https://twitter.com/CcCMiddleton/status/2047808711494902155",
      tweet_id: "2047808711494902155",
      tweet_created_at: null,
      created_at_label: "April 24, 2026 at 06:43PM",
      raw_payload: {
        linesCccOembed: {
          wrapper: {
            status: "failed",
            tweetId: "2047808711494902155",
            tweetUrl: "https://twitter.com/i/web/status/2047808711494902155",
            attemptCount: 1,
            lastAttemptAt: "2026-04-24T22:44:00.000Z",
            httpStatus: 500,
            lastError: "oembed_http_500",
          },
        },
      },
      received_at: "2026-04-24T22:46:29.726Z",
    });
  }

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
                awayTeamId: 14,
              },
            ],
            error: null,
          }),
        })),
      })),
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
                  lastName: "Dobes",
                },
              },
            ],
            error: null,
          }),
        })),
      })),
    },
    lineup_player_name_aliases: {
      select: vi.fn(() => ({
        or: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
        is: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      })),
    },
    lines_ccc_ifttt_events: {
      select: vi.fn(() => {
        const query: any = {
          eq: vi.fn(() => query),
          in: vi.fn(() => query),
          order: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue({
              data: eventRows,
              error: null,
            }),
          })),
        };
        return query;
      }),
      update: eventUpdateMock,
    },
    lines_ccc: {
      upsert: linesCccUpsertMock,
      update: linesCccUpdateMock,
    },
    lineup_unresolved_player_names: {
      update: unresolvedUpdateMock,
      upsert: unresolvedNamesUpsertMock,
    },
  };

  mocks.from.mockImplementation((tableName: string) => tables[tableName]);
  return {
    linesCccUpsertMock,
    linesCccUpdateMock,
    linesCccUpdateEqMock,
    unresolvedNamesUpsertMock,
    unresolvedUpdateMock,
    eventUpdateMock,
    eventUpdateEqMock,
  };
}

describe("/api/v1/db/update-lines-ccc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    mocks.getCurrentSeason.mockResolvedValue({ seasonId: 20252026 });
    mocks.getTeams.mockResolvedValue([
      {
        id: 8,
        name: "Montréal Canadiens",
        abbreviation: "MTL",
        logo: "/teamLogos/MTL.png",
      },
      {
        id: 14,
        name: "Tampa Bay Lightning",
        abbreviation: "TBL",
        logo: "/teamLogos/TBL.png",
      },
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
        unresolvedNamesQueued: 0,
        eventsProcessed: 1,
        eventsRejected: 1,
      },
    });

    expect(linesCccUpsertMock).toHaveBeenCalledTimes(2);
    const upsertedRows = linesCccUpsertMock.mock.calls.flatMap(
      (call) => call[0],
    );
    expect(upsertedRows).toHaveLength(2);
    expect(upsertedRows[0]).toMatchObject({
      tweet_id: "2047809041154625899",
      team_abbreviation: "MTL",
      status: "observed",
      nhl_filter_status: "accepted",
      goalie_1_name: "Jakub Dobes",
      goalie_1_player_id: 9,
    });
    expect(upsertedRows[1]).toMatchObject({
      tweet_id: "2047809990422147403",
      team_id: null,
      status: "rejected",
      nhl_filter_status: "rejected_non_nhl",
      detected_league: "AHL",
    });

    expect(eventUpdateMock).toHaveBeenCalledTimes(2);
    const eventUpdateCalls = eventUpdateMock.mock.calls as unknown[][];
    expect(eventUpdateCalls[0]?.[0]).toMatchObject({
      processing_status: "processed",
    });
    expect(eventUpdateCalls[1]?.[0]).toMatchObject({
      processing_status: "rejected",
    });
    const eventUpdateEqCalls = eventUpdateEqMock.mock.calls as unknown[][];
    expect(eventUpdateEqCalls[0]).toEqual(["id", "event-nhl"]);
    expect(eventUpdateEqCalls[1]).toEqual(["id", "event-ahl"]);
  });

  it("returns a 500 when lines_ccc upsert fails", async () => {
    createSupabaseMocks({
      linesCccUpsertError: new Error("upsert failed"),
    });
    const req = createMockReq();
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      error: "upsert failed",
    });
  });

  it("resolves quoted tweet text for headline-only CCC wrappers", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "https://t.co/9cZkBXydVn") {
        return new Response(null, {
          status: 302,
          headers: {
            location:
              "https://x.com/BenjaminJReport/status/2047808467969220779",
          },
        });
      }
      if (url.startsWith("https://publish.twitter.com/oembed?")) {
        return new Response(
          JSON.stringify({
            author_name: "Benjamin Pierce",
            author_url: "https://twitter.com/BenjaminJReport",
            html: '<blockquote><p>The #GoBolts lines unchanged in warmups:<br>Goncalves-Point-Kucherov<br>Hagel-Cirelli-Guentzel<br><br>Vasilevskiy<br>Johansson</p>&mdash; Benjamin Pierce <a href="https://twitter.com/BenjaminJReport/status/2047808467969220779">April 24, 2026</a></blockquote>',
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { linesCccUpsertMock } = createSupabaseMocks({
      includeQuoteEvent: true,
    });
    const req = createMockReq();
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      summary: {
        eventsLoaded: 3,
        quoteTweetsResolved: 1,
        quoteResolveAttempts: 1,
        quoteResolveFailures: 0,
      },
    });
    const upsertedRows = linesCccUpsertMock.mock.calls.flatMap(
      (call) => call[0],
    );
    const quoteRow = upsertedRows.find(
      (row: any) => row.tweet_id === "2047808711494902155",
    );
    expect(quoteRow).toMatchObject({
      quoted_tweet_id: "2047808467969220779",
      quoted_tweet_url: "https://twitter.com/i/web/status/2047808467969220779",
      quoted_author_handle: "BenjaminJReport",
      quoted_author_name: "Benjamin Pierce",
      primary_text_source: "quoted_oembed",
    });
    expect(quoteRow.quoted_enriched_text).toContain("Goncalves-Point-Kucherov");
    expect(quoteRow.metadata).toMatchObject({
      preferredQuotedTweet: true,
    });
  });

  it("updates an existing accepted tweet row when the tweet/team unique index conflicts", async () => {
    const duplicateError = new Error(
      'duplicate key value violates unique constraint "lines_ccc_tweet_id_team_unique_idx"',
    );
    const { linesCccUpdateMock, linesCccUpdateEqMock } = createSupabaseMocks({
      linesCccUpsertErrors: [duplicateError, null],
    });
    const req = createMockReq();
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(linesCccUpdateMock).toHaveBeenCalledTimes(2);
    expect(linesCccUpdateEqMock).toHaveBeenCalledWith(
      "nhl_filter_status",
      "accepted",
    );
  });

  it("ignores stale unresolved names from the wrong team before re-upserting an accepted CCC row", async () => {
    const { linesCccUpdateMock, unresolvedUpdateMock } = createSupabaseMocks();
    const req = createMockReq({
      query: {
        date: "2026-04-24",
        limit: "10",
        reprocess: "true",
      },
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(linesCccUpdateMock).toHaveBeenCalledTimes(1);
    expect(linesCccUpdateMock.mock.calls[0]?.[0]).toMatchObject({
      status: "superseded",
    });
    expect(unresolvedUpdateMock).toHaveBeenCalledTimes(1);
    expect(unresolvedUpdateMock.mock.calls[0]?.[0]).toMatchObject({
      status: "ignored",
    });
  });

  it("does not queue URL fragments as unresolved player names", async () => {
    const { unresolvedNamesUpsertMock } = createSupabaseMocks();
    const req = createMockReq();
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(unresolvedNamesUpsertMock).not.toHaveBeenCalled();
  });
});
