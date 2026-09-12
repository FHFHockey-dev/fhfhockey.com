import { beforeEach, describe, expect, it, vi } from "vitest";

const { deferYahooDraftSessionForAccessCheck, pollYahooDraftSession, pauseYahooDraftSessionForAccessLoss, requireYahooLiveDraftServerAccess, resolveYahooGameContext } = vi.hoisted(() => ({
  deferYahooDraftSessionForAccessCheck: vi.fn(),
  pollYahooDraftSession: vi.fn(),
  pauseYahooDraftSessionForAccessLoss: vi.fn(),
  requireYahooLiveDraftServerAccess: vi.fn(),
  resolveYahooGameContext: vi.fn(),
}));

vi.mock("./liveDraftAccess", async () => ({
  ...(await vi.importActual<typeof import("./liveDraftAccess")>("./liveDraftAccess")),
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
    requireYahooLiveDraftServerAccess.mockResolvedValue({});
    resolveYahooGameContext.mockResolvedValue({ gameCode: "nhl", gameKey: "477", season: "2026", targetSeasonId: 20262027 });
  });

  function clientFor(sessions: Array<{ connected_account_id: string; id: string; user_id: string }>) {
    const response = { data: sessions, error: null };
    const builder: any = { in: () => builder, limit: () => Promise.resolve(response), lte: () => builder, order: () => builder, select: () => builder };
    return { from: () => builder } as any;
  }

  it("processes due sessions with browsers absent and serializes each account", async () => {
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
    const client = clientFor([
        { connected_account_id: "account-a", id: "session-a-1", user_id: "user-a" },
        { connected_account_id: "account-b", id: "session-b-1", user_id: "user-b" },
        { connected_account_id: "account-a", id: "session-a-2", user_id: "user-a" },
      ]);

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
    const { YahooLiveDraftError } = await import("./liveDraft");
    const error = new YahooLiveDraftError("expired", 403, "yahoo_draft_pro_expired");
    const response = {
      data: [{ connected_account_id: "account-a", id: "session-a", user_id: "user-a" }], error: null,
    };
    const client = clientFor(response.data);
    requireYahooLiveDraftServerAccess.mockRejectedValue(error);

    await expect(runYahooDraftPollCoordinator({ client })).resolves.toEqual({
      attempted: 1,
      failed: 1,
      succeeded: 0,
    });

    expect(pauseYahooDraftSessionForAccessLoss).toHaveBeenCalledWith({
      client,
      error,
      sessionId: "session-a",
      userId: "user-a",
    });
    expect(pollYahooDraftSession).not.toHaveBeenCalled();
  });

  it("defers a transient denial and recovers on the next due cycle", async () => {
    const error = new Error("resolver unavailable");
    requireYahooLiveDraftServerAccess.mockRejectedValueOnce(error).mockResolvedValueOnce({});
    const client = clientFor([{ connected_account_id: "account-a", id: "session-a", user_id: "user-a" }]);
    await runYahooDraftPollCoordinator({ client, now: new Date("2026-09-12T00:00:00Z") });
    expect(deferYahooDraftSessionForAccessCheck).toHaveBeenCalledWith(expect.objectContaining({ error, now: expect.any(Date) }));
    expect(pollYahooDraftSession).not.toHaveBeenCalled();
    await runYahooDraftPollCoordinator({ client, now: new Date("2026-09-12T00:01:00Z") });
    expect(pollYahooDraftSession).toHaveBeenCalledTimes(1);
    expect(pauseYahooDraftSessionForAccessLoss).not.toHaveBeenCalled();
  });

  it("defers verification_unavailable without provider I/O", async () => {
    const { YahooLiveDraftError } = await import("./liveDraft");
    const error = new YahooLiveDraftError("verification unavailable", 503, "yahoo_draft_pro_verification_unavailable");
    requireYahooLiveDraftServerAccess.mockRejectedValue(error);
    const client = clientFor([{ connected_account_id: "account-a", id: "session-a", user_id: "user-a" }]);
    await runYahooDraftPollCoordinator({ client });
    expect(deferYahooDraftSessionForAccessCheck).toHaveBeenCalled();
    expect(pauseYahooDraftSessionForAccessLoss).not.toHaveBeenCalled();
    expect(pollYahooDraftSession).not.toHaveBeenCalled();
  });

  it("continues a healthy session when access-state writes fail", async () => {
    const { YahooLiveDraftError } = await import("./liveDraft");
    const expired = new YahooLiveDraftError("expired", 403, "yahoo_draft_pro_expired");
    const transient = new Error("temporary resolver failure");
    requireYahooLiveDraftServerAccess.mockRejectedValueOnce(expired).mockRejectedValueOnce(transient).mockResolvedValueOnce({});
    pauseYahooDraftSessionForAccessLoss.mockRejectedValueOnce(new Error("stop write failed"));
    deferYahooDraftSessionForAccessCheck.mockRejectedValueOnce(new Error("defer write failed"));
    const client = clientFor([
      { connected_account_id: "account-a", id: "expired", user_id: "user-a" },
      { connected_account_id: "account-b", id: "transient", user_id: "user-b" },
      { connected_account_id: "account-c", id: "healthy", user_id: "user-c" },
    ]);
    await expect(runYahooDraftPollCoordinator({ client })).resolves.toMatchObject({ attempted: 3, failed: 2, succeeded: 1 });
    expect(pollYahooDraftSession).toHaveBeenCalledWith("user-c", "healthy", expect.anything());
  });
});
