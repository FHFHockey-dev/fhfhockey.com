import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  isYahooLiveDraftEnabled,
  isYahooLiveDraftUserEntitled,
} from "./liveDraftApi";

const { requireApiUser, listYahooDraftLeagues, createYahooDraftSession } =
  vi.hoisted(() => ({
    requireApiUser: vi.fn(),
    listYahooDraftLeagues: vi.fn(),
    createYahooDraftSession: vi.fn(),
  }));

vi.mock("lib/api/requireApiUser", () => ({ requireApiUser }));
vi.mock("lib/integrations/yahoo/liveDraftServer", () => ({
  listYahooDraftLeagues,
  createYahooDraftSession,
}));

import handler from "../../../pages/api/v1/account/yahoo/draft-sessions";

function mockResponse() {
  const response: any = {
    statusCode: 200,
    headers: {} as Record<string, unknown>,
    body: null as unknown,
    setHeader(name: string, value: unknown) {
      this.headers[name.toLowerCase()] = value;
    },
    status(statusCode: number) {
      this.statusCode = statusCode;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  return response;
}

describe("Yahoo live draft API safeguards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.YAHOO_LIVE_DRAFT_ENABLED;
    delete process.env.YAHOO_LIVE_DRAFT_ROLLOUT_STAGE;
    delete process.env.YAHOO_LIVE_DRAFT_STAFF_USER_IDS;
    delete process.env.YAHOO_LIVE_DRAFT_BETA_USER_IDS;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is fail-closed and supports staff, allowlist, and authenticated rollout", () => {
    const staff = "11111111-1111-4111-8111-111111111111";
    const pilot = "22222222-2222-4222-8222-222222222222";
    expect(isYahooLiveDraftEnabled()).toBe(false);
    expect(isYahooLiveDraftEnabled("true")).toBe(true);
    expect(
      isYahooLiveDraftUserEntitled(staff, {
        YAHOO_LIVE_DRAFT_ROLLOUT_STAGE: "staff",
        YAHOO_LIVE_DRAFT_STAFF_USER_IDS: staff,
      }),
    ).toBe(true);
    expect(
      isYahooLiveDraftUserEntitled(pilot, {
        YAHOO_LIVE_DRAFT_ROLLOUT_STAGE: "allowlist",
        YAHOO_LIVE_DRAFT_BETA_USER_IDS: pilot,
      }),
    ).toBe(true);
    expect(
      isYahooLiveDraftUserEntitled(pilot, {
        YAHOO_LIVE_DRAFT_ROLLOUT_STAGE: "authenticated",
      }),
    ).toBe(true);
  });

  it("returns disabled before authentication or database reads and is no-store", async () => {
    const response = mockResponse();
    await handler({ method: "GET", headers: {}, query: {} } as any, response);
    expect(response.statusCode).toBe(503);
    expect(response.body.code).toBe("yahoo_live_draft_disabled");
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.headers.vary).toBe("Authorization");
    expect(requireApiUser).not.toHaveBeenCalled();
    expect(listYahooDraftLeagues).not.toHaveBeenCalled();
  });

  it("requires bearer authentication before loading live draft data", async () => {
    process.env.YAHOO_LIVE_DRAFT_ENABLED = "true";
    process.env.YAHOO_LIVE_DRAFT_ROLLOUT_STAGE = "authenticated";
    requireApiUser.mockImplementation(async (_request, response) => {
      response.status(401).json({ error: "Authentication required." });
      return null;
    });
    const response = mockResponse();
    await handler({ method: "GET", headers: {}, query: {} } as any, response);
    expect(response.statusCode).toBe(401);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(listYahooDraftLeagues).not.toHaveBeenCalled();
  });

  it("rejects raw Yahoo league keys instead of passing them to session creation", async () => {
    process.env.YAHOO_LIVE_DRAFT_ENABLED = "true";
    process.env.YAHOO_LIVE_DRAFT_ROLLOUT_STAGE = "authenticated";
    requireApiUser.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
    });
    const response = mockResponse();
    await handler(
      {
        method: "POST",
        headers: {},
        query: {},
        body: {
          externalLeagueId: "22222222-2222-4222-8222-222222222222",
          yahooLeagueKey: "477.l.123",
        },
      } as any,
      response,
    );
    expect(response.statusCode).toBe(400);
    expect(response.body.code).toBe("validation_error");
    expect(createYahooDraftSession).not.toHaveBeenCalled();
  });
});
