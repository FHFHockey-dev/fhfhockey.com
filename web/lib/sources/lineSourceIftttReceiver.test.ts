import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, insertMock, upsertMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  insertMock: vi.fn(),
  upsertMock: vi.fn(),
}));

vi.mock("lib/supabase/server", () => ({
  default: {
    from: fromMock,
  },
}));

import { createLineSourceIftttReceiver } from "lib/sources/lineSourceIftttReceiver";

function createMockReq(overrides: Record<string, unknown> = {}) {
  return {
    method: "POST",
    headers: {
      "x-fhfh-ifttt-secret": "test-secret",
    },
    query: {},
    body: {
      source: "ifttt",
      source_account: "GameDayGoalies",
      text: "Confirmed Wild Starting Goalie: Filip Gustavsson",
      username: "GameDayGoalies",
      link_to_tweet: "https://twitter.com/GameDayGoalies/status/2049999999999999999",
      created_at: "April 30, 2026 at 06:05PM",
    },
    ...overrides,
  } as any;
}

function createMockRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string | string[]>,
    body: null as unknown,
    setHeader(key: string, value: string | string[]) {
      this.headers[key] = value;
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe("createLineSourceIftttReceiver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.IFTTT_GAMEDAYGOALIES_WEBHOOK_SECRET = "test-secret";
    process.env.IFTTT_GAMEDAYLINES_WEBHOOK_SECRET = "test-secret";
    upsertMock.mockResolvedValue({ error: null });
    insertMock.mockResolvedValue({ error: null });
    fromMock.mockReturnValue({
      insert: insertMock,
      upsert: upsertMock,
    });
  });

  it("routes a GameDayGoalies event into the generic queue with source metadata", async () => {
    const handler = createLineSourceIftttReceiver({
      sourceGroup: "gdl_suite",
      sourceKey: "gamedaygoalies",
      sourceAccount: "GameDayGoalies",
      secretEnvVar: "IFTTT_GAMEDAYGOALIES_WEBHOOK_SECRET",
    });

    const res = createMockRes();
    await handler(createMockReq(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      sourceKey: "gamedaygoalies",
      tweetId: "2049999999999999999",
      processingStatus: "pending",
    });
    expect(fromMock).toHaveBeenCalledWith("line_source_ifttt_events");
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "ifttt",
        source_group: "gdl_suite",
        source_key: "gamedaygoalies",
        source_account: "GameDayGoalies",
        username: "GameDayGoalies",
        text: "Confirmed Wild Starting Goalie: Filip Gustavsson",
        tweet_id: "2049999999999999999",
        processing_status: "pending",
        raw_payload: expect.objectContaining({
          source_account: "GameDayGoalies",
        }),
      }),
      {
        onConflict: "source_key,tweet_id",
      },
    );
  });

  it("dedupes by source key and tweet id so separate sources can store the same tweet id", async () => {
    const goaliesHandler = createLineSourceIftttReceiver({
      sourceGroup: "gdl_suite",
      sourceKey: "gamedaygoalies",
      sourceAccount: "GameDayGoalies",
      secretEnvVar: "IFTTT_GAMEDAYGOALIES_WEBHOOK_SECRET",
    });
    const linesHandler = createLineSourceIftttReceiver({
      sourceGroup: "gdl_suite",
      sourceKey: "gamedaylines",
      sourceAccount: "GameDayLines",
      secretEnvVar: "IFTTT_GAMEDAYLINES_WEBHOOK_SECRET",
    });

    await goaliesHandler(createMockReq(), createMockRes());
    await linesHandler(
      createMockReq({
        body: {
          source: "ifttt",
          source_account: "GameDayLines",
          text: "Wild lines",
          username: "GameDayLines",
          link_to_tweet:
            "https://twitter.com/GameDayLines/status/2049999999999999999",
          created_at: "April 30, 2026 at 06:05PM",
        },
      }),
      createMockRes(),
    );

    expect(upsertMock).toHaveBeenCalledTimes(2);
    expect(upsertMock.mock.calls[0][0]).toMatchObject({
      source_key: "gamedaygoalies",
      tweet_id: "2049999999999999999",
    });
    expect(upsertMock.mock.calls[1][0]).toMatchObject({
      source_key: "gamedaylines",
      tweet_id: "2049999999999999999",
    });
    expect(upsertMock.mock.calls[0][1]).toEqual({
      onConflict: "source_key,tweet_id",
    });
    expect(upsertMock.mock.calls[1][1]).toEqual({
      onConflict: "source_key,tweet_id",
    });
  });
});
