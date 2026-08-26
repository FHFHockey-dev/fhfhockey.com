import { describe, expect, it, vi } from "vitest";

const { pollYahooDraftSession, resolveYahooGameContext } = vi.hoisted(() => ({
  pollYahooDraftSession: vi.fn(),
  resolveYahooGameContext: vi.fn(),
}));

vi.mock("./liveDraftServer", () => ({ pollYahooDraftSession }));
vi.mock("./gameContext", () => ({ resolveYahooGameContext }));

import { runYahooDraftPollCoordinator } from "./pollCoordinator";

describe("Yahoo live-draft coordinator", () => {
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
});
