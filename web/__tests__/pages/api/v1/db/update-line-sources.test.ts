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

import handler from "../../../../../pages/api/v1/db/update-line-sources";

type LineSourceEventFixture = {
  id: string;
  source: string;
  source_group: string;
  source_key: string;
  source_account: string;
  username: string;
  text: string;
  link_to_tweet: string;
  tweet_id: string;
  tweet_created_at: string | null;
  created_at_label: string;
  processing_status: string;
  raw_payload: Record<string, unknown>;
  received_at: string;
};

function createMockReq(overrides: Record<string, unknown> = {}) {
  return {
    method: "POST",
    query: {
      date: "2026-04-29",
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

function buildEvent(args: {
  id: string;
  sourceKey: string;
  sourceAccount: string;
  tweetId: string;
  text: string;
  receivedAt?: string;
}): LineSourceEventFixture {
  return {
    id: args.id,
    source: "ifttt",
    source_group: "gdl_suite",
    source_key: args.sourceKey,
    source_account: args.sourceAccount,
    username: args.sourceAccount,
    text: args.text,
    link_to_tweet: `https://twitter.com/${args.sourceAccount}/status/${args.tweetId}`,
    tweet_id: args.tweetId,
    tweet_created_at: null,
    created_at_label: "April 29, 2026 at 07:11PM",
    processing_status: "pending",
    raw_payload: {
      linesCccOembed: {
        wrapper: {
          status: "failed",
          tweetId: args.tweetId,
          tweetUrl: `https://twitter.com/i/web/status/${args.tweetId}`,
          attemptCount: 1,
          lastAttemptAt: "2026-04-29T23:12:00.000Z",
          httpStatus: 500,
          lastError: "oembed_http_500",
        },
      },
    },
    received_at: args.receivedAt ?? "2026-04-29T23:11:16.000Z",
  };
}

function createLineSourceEventsQuery(eventRows: LineSourceEventFixture[]) {
  const filters: Array<{
    type: "eq" | "in";
    column: string;
    value: unknown;
  }> = [];
  const query: any = {
    eq: vi.fn((column: string, value: unknown) => {
      filters.push({ type: "eq", column, value });
      return query;
    }),
    in: vi.fn((column: string, value: unknown[]) => {
      filters.push({ type: "in", column, value });
      return query;
    }),
    order: vi.fn(() => query),
    limit: vi.fn(async (limit: number) => {
      const filteredRows = eventRows.filter((row) =>
        filters.every((filter) => {
          const rowValue = row[filter.column as keyof LineSourceEventFixture];
          return filter.type === "eq"
            ? rowValue === filter.value
            : (filter.value as unknown[]).includes(rowValue);
        }),
      );
      return {
        data: filteredRows.slice(0, limit),
        error: null,
      };
    }),
  };
  return query;
}

function createSupabaseMocks(eventRows: LineSourceEventFixture[]) {
  const lineSourceSnapshotsUpsertMock = vi
    .fn()
    .mockResolvedValue({ error: null });
  const staleRowUpdateQuery: any = {
    eq: vi.fn(() => staleRowUpdateQuery),
    neq: vi.fn(() => staleRowUpdateQuery),
    then: (resolve: any) => Promise.resolve({ error: null }).then(resolve),
  };
  const staleRowUpdateMock = vi.fn(() => staleRowUpdateQuery);
  const eventUpdateEqMock = vi.fn().mockResolvedValue({ error: null });
  const eventUpdateMock = vi.fn(() => ({
    eq: eventUpdateEqMock,
  }));
  const unresolvedNamesUpsertMock = vi.fn().mockResolvedValue({ error: null });
  const lineSourceEventsQuery = createLineSourceEventsQuery(eventRows);

  const tables: Record<string, any> = {
    games: {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: 2025030111,
                date: "2026-04-29",
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
        in: vi.fn((_column: string, teamIds: number[]) => ({
          eq: vi.fn().mockResolvedValue({
            data: [
              {
                teamId: 8,
                playerId: 8480018,
                players: { fullName: "Cole Caufield", lastName: "Caufield" },
              },
              {
                teamId: 8,
                playerId: 8480019,
                players: { fullName: "Nick Suzuki", lastName: "Suzuki" },
              },
              {
                teamId: 8,
                playerId: 8480020,
                players: {
                  fullName: "Juraj Slafkovsky",
                  lastName: "Slafkovsky",
                },
              },
              {
                teamId: 8,
                playerId: 8482487,
                players: { fullName: "Jakub Dobes", lastName: "Dobes" },
              },
              {
                teamId: 14,
                playerId: 8476883,
                players: {
                  fullName: "Andrei Vasilevskiy",
                  lastName: "Vasilevskiy",
                },
              },
              {
                teamId: 14,
                playerId: 8477404,
                players: { fullName: "Nikita Kucherov", lastName: "Kucherov" },
              },
              {
                teamId: 14,
                playerId: 8476453,
                players: { fullName: "Brayden Point", lastName: "Point" },
              },
              {
                teamId: 14,
                playerId: 8482201,
                players: { fullName: "Gage Goncalves", lastName: "Goncalves" },
              },
              {
                teamId: 54,
                playerId: 8474565,
                players: { fullName: "Ivan Barbashev", lastName: "Barbashev" },
              },
              {
                teamId: 54,
                playerId: 8478403,
                players: { fullName: "Jack Eichel", lastName: "Eichel" },
              },
              {
                teamId: 54,
                playerId: 8475913,
                players: { fullName: "Brett Howden", lastName: "Howden" },
              },
              {
                teamId: 54,
                playerId: 8475191,
                players: { fullName: "Reilly Smith", lastName: "Smith" },
              },
              {
                teamId: 54,
                playerId: 8478483,
                players: { fullName: "Mitch Marner", lastName: "Marner" },
              },
              {
                teamId: 54,
                playerId: 8475913,
                players: { fullName: "Mark Stone", lastName: "Stone" },
              },
              {
                teamId: 54,
                playerId: 8479394,
                players: { fullName: "Carter Hart", lastName: "Hart" },
              },
              {
                teamId: 24,
                playerId: 8478873,
                players: { fullName: "Troy Terry", lastName: "Terry" },
              },
              {
                teamId: 24,
                playerId: 8482745,
                players: { fullName: "Lukas Dostal", lastName: "Dostal" },
              },
              {
                teamId: 59,
                playerId: 8479979,
                players: { fullName: "Karel Vejmelka", lastName: "Vejmelka" },
              },
              {
                teamId: 7,
                playerId: 8479312,
                players: { fullName: "Alex Lyon", lastName: "Lyon" },
              },
              {
                teamId: 30,
                playerId: 8476958,
                players: { fullName: "Nico Sturm", lastName: "Sturm" },
              },
              {
                teamId: 25,
                playerId: 8477504,
                players: { fullName: "Michael Bunting", lastName: "Bunting" },
              },
              {
                teamId: 25,
                playerId: 8475692,
                players: {
                  fullName: "Alexander Petrovic",
                  lastName: "Petrovic",
                },
              },
            ].filter((row) => teamIds.includes(row.teamId)),
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
    line_source_ifttt_events: {
      select: vi.fn(() => lineSourceEventsQuery),
      update: eventUpdateMock,
    },
    line_source_snapshots: {
      update: staleRowUpdateMock,
      upsert: lineSourceSnapshotsUpsertMock,
    },
    lineup_unresolved_player_names: {
      update: staleRowUpdateMock,
      upsert: unresolvedNamesUpsertMock,
    },
  };

  mocks.from.mockImplementation((tableName: string) => tables[tableName]);
  return {
    eventUpdateMock,
    eventUpdateEqMock,
    lineSourceSnapshotsUpsertMock,
    unresolvedNamesUpsertMock,
  };
}

function getUpsertedRows(upsertMock: ReturnType<typeof vi.fn>) {
  return upsertMock.mock.calls.flatMap((call) => call[0]);
}

describe("/api/v1/db/update-line-sources", () => {
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
      {
        id: 54,
        name: "Vegas Golden Knights",
        abbreviation: "VGK",
        logo: "/teamLogos/VGK.png",
      },
      {
        id: 24,
        name: "Anaheim Ducks",
        abbreviation: "ANA",
        logo: "/teamLogos/ANA.png",
      },
      {
        id: 7,
        name: "Buffalo Sabres",
        abbreviation: "BUF",
        logo: "/teamLogos/BUF.png",
      },
      {
        id: 30,
        name: "Minnesota Wild",
        abbreviation: "MIN",
        logo: "/teamLogos/MIN.png",
      },
      {
        id: 25,
        name: "Dallas Stars",
        abbreviation: "DAL",
        logo: "/teamLogos/DAL.png",
      },
      {
        id: 59,
        name: "Utah Mammoth",
        abbreviation: "UTA",
        logo: "/teamLogos/UTA.png",
      },
    ]);
  });

  it("processes GDL goalie, lines, news, non-NHL, and ambiguous events by source key", async () => {
    const events = [
      buildEvent({
        id: "event-goalie",
        sourceKey: "gamedaygoalies",
        sourceAccount: "GameDayGoalies",
        tweetId: "2049619999812391371",
        text: "confirmed Canadiens Starting Goalie: Jakub Dobes https://t.co/p3wzJmJJUd",
      }),
      buildEvent({
        id: "event-lines",
        sourceKey: "gamedaylines",
        sourceAccount: "GameDayLines",
        tweetId: "2049626619221008663",
        text: "#Habs lines vs #Lightning\nCaufield - Suzuki - Slafkovsky",
      }),
      buildEvent({
        id: "event-news",
        sourceKey: "gamedaynewsnhl",
        sourceAccount: "GameDayNewsNHL",
        tweetId: "2049629478754943139",
        text: "Canadiens forward Nick Suzuki is out tonight with an injury.",
      }),
      buildEvent({
        id: "event-ahl",
        sourceKey: "gamedaylines",
        sourceAccount: "GameDayLines",
        tweetId: "2049622696678535527",
        text: "AHL Rocket lines\nAHL Rocket Starting Goalie: Kaapo Kahkonen https://t.co/Rz6hbYZ6CN",
      }),
      buildEvent({
        id: "event-ambiguous",
        sourceKey: "gamedaygoalies",
        sourceAccount: "GameDayGoalies",
        tweetId: "2049625325911605526",
        text: "confirmed Flyers Starting Goalie: Dan Vladar\nconfirmed Penguins Starting Goalie: Arturs Silovs",
      }),
    ];
    const { eventUpdateMock, eventUpdateEqMock, lineSourceSnapshotsUpsertMock } =
      createSupabaseMocks(events);
    const req = createMockReq();
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      sourceGroup: "gdl_suite",
      summary: {
        sourcesProcessed: 3,
        eventsLoaded: 5,
        tweetsParsed: 5,
        acceptedNhl: 3,
        nonNhlRejected: 1,
        ambiguousRejected: 1,
        rowsUpserted: 5,
        eventsProcessed: 3,
        eventsRejected: 2,
        bySourceKey: {
          gamedaygoalies: {
            total: 2,
            processed: 1,
            rejected: 1,
          },
          gamedaylines: {
            total: 2,
            processed: 1,
            rejected: 1,
          },
          gamedaynewsnhl: {
            total: 1,
            processed: 1,
            rejected: 0,
            byClassification: {
              injury: 1,
            },
          },
        },
      },
    });

    const upsertedRows = getUpsertedRows(lineSourceSnapshotsUpsertMock);
    expect(upsertedRows).toHaveLength(5);
    expect(upsertedRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source_group: "gdl_suite",
          source_key: "gamedaygoalies",
          source_account: "GameDayGoalies",
          source: "gamedaygoalies",
          tweet_id: "2049619999812391371",
          team_abbreviation: "MTL",
          classification: "goalie_start",
          nhl_filter_status: "accepted",
          goalie_1_name: "Jakub Dobes",
          goalie_1_player_id: 8482487,
        }),
        expect.objectContaining({
          source_key: "gamedaylines",
          tweet_id: "2049626619221008663",
          team_abbreviation: "MTL",
          classification: "lineup",
          nhl_filter_status: "accepted",
          line_1_player_ids: [8480020, 8480019, 8480018],
        }),
        expect.objectContaining({
          source_key: "gamedaynewsnhl",
          tweet_id: "2049629478754943139",
          team_abbreviation: "MTL",
          classification: "injury",
          nhl_filter_status: "accepted",
        }),
        expect.objectContaining({
          source_key: "gamedaylines",
          tweet_id: "2049622696678535527",
          team_id: null,
          status: "rejected",
          detected_league: "AHL",
          nhl_filter_status: "rejected_non_nhl",
        }),
        expect.objectContaining({
          source_key: "gamedaygoalies",
          tweet_id: "2049625325911605526",
          team_id: null,
          status: "rejected",
          nhl_filter_status: "rejected_ambiguous",
        }),
      ]),
    );
    expect(
      upsertedRows.every((row: any) =>
        row.capture_key.startsWith(`${row.source_key}:`),
      ),
    ).toBe(true);

    expect(eventUpdateMock).toHaveBeenCalledTimes(5);
    expect(eventUpdateMock.mock.calls.map((call) => call[0])).toEqual([
      expect.objectContaining({ processing_status: "processed" }),
      expect.objectContaining({ processing_status: "processed" }),
      expect.objectContaining({ processing_status: "processed" }),
      expect.objectContaining({ processing_status: "rejected" }),
      expect.objectContaining({ processing_status: "rejected" }),
    ]);
    expect(eventUpdateEqMock.mock.calls.map((call) => call[1])).toEqual([
      "event-goalie",
      "event-lines",
      "event-news",
      "event-ahl",
      "event-ambiguous",
    ]);
  });

  it("prefixes capture keys so duplicate tweet ids from different sources do not collide", async () => {
    const events = [
      buildEvent({
        id: "event-goalie",
        sourceKey: "gamedaygoalies",
        sourceAccount: "GameDayGoalies",
        tweetId: "2049619999812391371",
        text: "confirmed Canadiens Starting Goalie: Jakub Dobes https://t.co/p3wzJmJJUd",
      }),
      buildEvent({
        id: "event-lines",
        sourceKey: "gamedaylines",
        sourceAccount: "GameDayLines",
        tweetId: "2049619999812391371",
        text: "confirmed Canadiens Starting Goalie: Jakub Dobes https://t.co/p3wzJmJJUd",
      }),
    ];
    const { lineSourceSnapshotsUpsertMock } = createSupabaseMocks(events);
    const req = createMockReq({
      query: {
        date: "2026-04-29",
        limit: "10",
        reprocess: "true",
      },
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      summary: {
        eventsLoaded: 2,
        acceptedNhl: 2,
        duplicatesSkipped: 0,
        rowsUpserted: 2,
      },
    });
    const captureKeys = getUpsertedRows(lineSourceSnapshotsUpsertMock).map(
      (row: any) => row.capture_key,
    );
    expect(captureKeys).toHaveLength(2);
    expect(captureKeys[0]).toContain("gamedaygoalies:");
    expect(captureKeys[1]).toContain("gamedaylines:");
    expect(captureKeys[0]).not.toEqual(captureKeys[1]);
  });

  it("resolves quoted tweet text for generic line sources", async () => {
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
            html: '<blockquote><p>The #GoBolts lines unchanged in warmups:<br>Goncalves-Point-Kucherov<br><br>Vasilevskiy</p>&mdash; Benjamin Pierce <a href="https://twitter.com/BenjaminJReport/status/2047808467969220779">April 29, 2026</a></blockquote>',
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
    const events = [
      buildEvent({
        id: "event-quote",
        sourceKey: "gamedaylines",
        sourceAccount: "GameDayLines",
        tweetId: "2047808711494902155",
        text: "Lightning lines https://t.co/9cZkBXydVn",
      }),
    ];
    const { lineSourceSnapshotsUpsertMock } = createSupabaseMocks(events);
    const req = createMockReq();
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      summary: {
        eventsLoaded: 1,
        quoteTweetsResolved: 1,
        quoteResolveAttempts: 1,
        quoteResolveFailures: 0,
        acceptedNhl: 1,
        rowsUpserted: 1,
      },
    });
    const [quoteRow] = getUpsertedRows(lineSourceSnapshotsUpsertMock);
    expect(quoteRow).toMatchObject({
      source_group: "gdl_suite",
      source_key: "gamedaylines",
      source_account: "GameDayLines",
      source: "gamedaylines",
      tweet_id: "2047808711494902155",
      quoted_tweet_id: "2047808467969220779",
      quoted_tweet_url: "https://twitter.com/i/web/status/2047808467969220779",
      quoted_author_handle: "BenjaminJReport",
      quoted_author_name: "Benjamin Pierce",
      primary_text_source: "quoted_oembed",
      team_abbreviation: "TBL",
      nhl_filter_status: "accepted",
    });
    expect(quoteRow.capture_key).toMatch(/^gamedaylines:/);
    expect(quoteRow.quoted_enriched_text).toContain("Goncalves-Point-Kucherov");
    expect(quoteRow.metadata).toMatchObject({
      preferredQuotedTweet: true,
      sourceGroup: "gdl_suite",
      sourceKey: "gamedaylines",
      sourceAccount: "GameDayLines",
    });
  });

  it("loads rosters for accepted teams that are not on the requested date schedule", async () => {
    const events = [
      buildEvent({
        id: "event-vgk",
        sourceKey: "gamedaylines",
        sourceAccount: "GameDayLines",
        tweetId: "2049666976247947332",
        text: "VGK lines for warmups before Game 5\nBarbashev-Eichel-Howden\nSmith-Marner-Stone\nHart",
      }),
    ];
    const { lineSourceSnapshotsUpsertMock } = createSupabaseMocks(events);
    const req = createMockReq({
      query: {
        date: "2026-04-30",
        limit: "10",
      },
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      rosterTeamsLoaded: 3,
      summary: {
        acceptedNhl: 1,
        rowsUpserted: 1,
      },
    });
    const [row] = getUpsertedRows(lineSourceSnapshotsUpsertMock);
    expect(row).toMatchObject({
      source_key: "gamedaylines",
      team_abbreviation: "VGK",
      nhl_filter_status: "accepted",
      line_1_player_ids: [8475913, 8478403, 8474565],
      goalie_1_player_id: 8479394,
    });
  });

  it("uses beat-writer handles and NHL hashtag hints to avoid false ambiguous GDL rejections", async () => {
    const events = [
      buildEvent({
        id: "event-ducks-goalie",
        sourceKey: "gamedaygoalies",
        sourceAccount: "GameDayGoalies",
        tweetId: "2049909539970122058",
        text: "Terry IN, Dostál starting, per Quenneville.#FlyTogether https://t.co/yquWQ5hKMK",
      }),
      buildEvent({
        id: "event-sabres-boston",
        sourceKey: "gamedaygoalies",
        sourceAccount: "GameDayGoalies",
        tweetId: "2049866903368110544",
        text: "Hi from KeyBank Center — the #Sabres practice before heading to Boston for Game 6 on Friday.\nAlex Lyon is in the starter’s net.",
      }),
      buildEvent({
        id: "event-wild-news",
        sourceKey: "gamedaynewsnhl",
        sourceAccount: "GameDayNewsNHL",
        tweetId: "2049873426932797786",
        text: "In other #mnwild lineup news, Brink will come out, and Sturm comes in.",
      }),
      buildEvent({
        id: "event-stars-news",
        sourceKey: "gamedaynewsnhl",
        sourceAccount: "GameDayNewsNHL",
        tweetId: "2049885673360916596",
        text: "Glen Gulutzan and staff are shaking up the lines and the lineup.\nIt appears that Michael Bunting & Alexander Petrovic will make their 2026 playoff debuts.",
      }),
      buildEvent({
        id: "event-moose",
        sourceKey: "gamedaynewsnhl",
        sourceAccount: "GameDayNewsNHL",
        tweetId: "2049890927775486457",
        text: "#MBMoose coach Mark Morrison just told us Elias Salomonsson is having season-ending surgery due to injury.",
      }),
    ];
    events[0]!.username = "Derek_Lee27";
    events[1]!.username = "rachelmlenzi";
    events[2]!.username = "JoeSmithNHL";
    events[3]!.username = "OwenNewkirk";
    events[4]!.username = "mikemcintyrewpg";
    const { lineSourceSnapshotsUpsertMock } = createSupabaseMocks(events);
    const req = createMockReq({
      query: {
        date: "2026-04-30",
        limit: "10",
      },
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      summary: {
        acceptedNhl: 4,
        nonNhlRejected: 1,
        ambiguousRejected: 0,
        rowsUpserted: 5,
      },
    });
    const rows = getUpsertedRows(lineSourceSnapshotsUpsertMock);
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tweet_id: "2049909539970122058",
          team_abbreviation: "ANA",
          nhl_filter_status: "accepted",
        }),
        expect.objectContaining({
          tweet_id: "2049866903368110544",
          team_abbreviation: "BUF",
          nhl_filter_status: "accepted",
        }),
        expect.objectContaining({
          tweet_id: "2049873426932797786",
          team_abbreviation: "MIN",
          nhl_filter_status: "accepted",
        }),
        expect.objectContaining({
          tweet_id: "2049885673360916596",
          team_abbreviation: "DAL",
          nhl_filter_status: "accepted",
        }),
        expect.objectContaining({
          tweet_id: "2049890927775486457",
          team_id: null,
          detected_league: "AHL",
          nhl_filter_status: "rejected_non_nhl",
        }),
      ]),
    );
  });

  it("accepts Utah goalie tweets after second-pass roster loading when #TusksUp is the only team hint", async () => {
    const events = [
      buildEvent({
        id: "event-utah-goalie",
        sourceKey: "gamedaygoalies",
        sourceAccount: "GameDayGoalies",
        tweetId: "2050000000000000001",
        text: "#TusksUp Vejmelka in the starter's net",
      }),
    ];
    const { lineSourceSnapshotsUpsertMock } = createSupabaseMocks(events);
    const req = createMockReq({
      query: {
        date: "2026-04-30",
        limit: "10",
      },
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      summary: {
        acceptedNhl: 1,
        ambiguousRejected: 0,
        rowsUpserted: 1,
      },
    });
    const [row] = getUpsertedRows(lineSourceSnapshotsUpsertMock);
    expect(row).toMatchObject({
      source_key: "gamedaygoalies",
      tweet_id: "2050000000000000001",
      team_abbreviation: "UTA",
      nhl_filter_status: "accepted",
      goalie_1_player_id: 8479979,
      goalie_1_name: "Karel Vejmelka",
    });
  });

  it("uses decisive roster-density fallback for short tweets with multiple same-team player hits", async () => {
    const events = [
      buildEvent({
        id: "event-ducks-roster-density",
        sourceKey: "gamedaygoalies",
        sourceAccount: "GameDayGoalies",
        tweetId: "2049909539970122058",
        text: "Terry IN, Dostál starting, per Quenneville.",
      }),
    ];
    const { lineSourceSnapshotsUpsertMock } = createSupabaseMocks(events);
    const req = createMockReq({
      query: {
        date: "2026-04-30",
        limit: "10",
      },
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      summary: {
        acceptedNhl: 1,
        ambiguousRejected: 0,
        rowsUpserted: 1,
      },
    });
    const [row] = getUpsertedRows(lineSourceSnapshotsUpsertMock);
    expect(row).toMatchObject({
      team_abbreviation: "ANA",
      nhl_filter_status: "accepted",
      matched_player_ids: [8478873, 8482745],
    });
  });
});
