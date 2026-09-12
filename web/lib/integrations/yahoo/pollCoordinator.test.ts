import { beforeEach, describe, expect, it, vi } from "vitest";

const { deferYahooDraftSessionForAccessCheck, isConfirmedYahooLiveDraftAccessLoss, pollYahooDraftSession, pauseYahooDraftSessionForAccessLoss, requireYahooLiveDraftServerAccess, resolveYahooGameContext } = vi.hoisted(() => ({
  deferYahooDraftSessionForAccessCheck: vi.fn(),
  isConfirmedYahooLiveDraftAccessLoss: vi.fn(),
  pollYahooDraftSession: vi.fn(),
  pauseYahooDraftSessionForAccessLoss: vi.fn(),
  requireYahooLiveDraftServerAccess: vi.fn(),
  resolveYahooGameContext: vi.fn(),
}));

vi.mock("./liveDraftAccess", () => ({
  isConfirmedYahooLiveDraftAccessLoss,
  requireYahooLiveDraftServerAccess,
}));
vi.mock("./liveDraftServer", () => ({
  deferYahooDraftSessionForAccessCheck,
  pauseYahooDraftSessionForAccessLoss,
  pollYahooDraftSession,
}));
vi.mock("./gameContext", () => ({ resolveYahooGameContext }));

import { runYahooDraftPollCoordinator } from "./pollCoordinator";

describe("Yahoo live-draft coordinator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isConfirmedYahooLiveDraftAccessLoss.mockReturnValue(false);
    requireYahooLiveDraftServerAccess.mockResolvedValue({});
  });

  it("processes due sessions with browsers absent and serializes each account", async () => {
    resolveYahooGameContext.mockResolvedValue({
      gameCode: "nhl",
      gameKey: "477",
      season: "2026",
      targetSeasonId: 20262027,
    });
    const accountBySession = new Map([
      ["session-a-1", "account-a"],
      ["session-a-2", "account-a"],
      ["session-b-1", "account-b"],
    ]);
    const active = new Map<string, number>();
    const maximum = new Map<string, number>();
    pollYahooDraftSession.mockImplementation(async (_userId, sessionId) => {
      const account = accountBySession.get(sessionId) ?? "unknown";
      active.set(account, (active.get(account) ?? 0) + 1);
      maximum.set(account, Math.max(maximum.get(account) ?? 0, active.get(account) ?? 0));
      await new Promise((resolve) => setTimeout(resolve, 2));
      active.set(account, (active.get(account) ?? 1) - 1);
    });
    const response = {
      data: [
        { connected_account_id: "account-a", id: "session-a-1", user_id: "user-a" },
        { connected_account_id: "account-b", id: "session-b-1", user_id: "user-b" },
        { connected_account_id: "account-a", id: "session-a-2", user_id: "user-a" },
      ],
      error: null,
    };
    const builder: any = {
      in: () => builder,
      limit: () => Promise.resolve(response),
      lte: () => builder,
      order: () => builder,
      select: () => builder,
    };
    const client = { from: () => builder } as any;

    await expect(
      runYahooDraftPollCoordinator({ client, concurrency: 2 }),
    ).resolves.toEqual({ attempted: 3, failed: 0, succeeded: 3 });
    expect(maximum.get("account-a")).toBe(1);
    expect(pollYahooDraftSession).toHaveBeenCalledTimes(3);
  });

  it("stops polling but retains the session when Draft Pro access is lost", async () => {
    requireYahooLiveDraftServerAccess.mockRejectedValue(
      Object.assign(new Error("Draft Pro access is required for this action."), {
        code: "no_active_grant",
        statusCode: 403,
      }),
    );
    isConfirmedYahooLiveDraftAccessLoss.mockReturnValue(true);
    const response = {
      data: [{ connected_account_id: "account-a", id: "session-a", user_id: "user-a" }],
      error: null,
    };
    const builder: any = {
      in: () => builder,
      limit: () => Promise.resolve(response),
      lte: () => builder,
      order: () => builder,
      select: () => builder,
    };
    const client = { from: () => builder } as any;

    await expect(runYahooDraftPollCoordinator({ client })).resolves.toEqual({
      attempted: 1,
      failed: 1,
      succeeded: 0,
    });

    expect(pauseYahooDraftSessionForAccessLoss).toHaveBeenCalledWith({
      client,
      error: expect.objectContaining({ code: "no_active_grant" }),
      sessionId: "session-a",
      userId: "user-a",
    });
    expect(pollYahooDraftSession).not.toHaveBeenCalled();
  });
});
