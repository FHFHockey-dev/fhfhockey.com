import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockSession } from "lib/mockDraft/contracts";
const storage = vi.hoisted(() => ({
  read: vi.fn(),
  write: vi.fn(),
  pending: vi.fn(),
  ack: vi.fn(),
}));
vi.mock("lib/mockDraft/storage", () => ({
  storedSession: storage.read,
  writeSession: storage.write,
  pendingContributions: storage.pending,
  acknowledgeContribution: storage.ack,
}));
vi.mock("lib/mockDraft/client", () => ({
  mockRequest: vi.fn().mockResolvedValue({ authorized: true }),
  syncContributions: vi.fn().mockResolvedValue(undefined),
}));
import { useMockDraft } from "./useMockDraft";
import { newSession } from "lib/mockDraft/engine";

function session(): MockSession {
  return newSession(
    {
      season: "20262027",
      teamCount: 2,
      leagueType: "points",
      scoring: {},
      goalieScoring: {},
      roster: { C: 1 },
      grouping: "split",
      userSeat: 0,
      seconds: 15,
      timeout: "autopick",
      tier: "free",
      bots: [
        { personality: "BPA", variation: 0 },
        { personality: "BPA", variation: 0 },
      ],
    },
    Array.from({ length: 4 }, (_, i) => ({
      id: String(i + 1),
      name: `P${i}`,
      team: "",
      positions: ["C"],
      value: 100 - i,
      adp: i + 1,
      categories: {},
      workload: null,
      workloadKind: null,
    })),
    "seed",
    "id",
    null,
    false,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  storage.read.mockResolvedValue(null);
  storage.write.mockResolvedValue(true);
  storage.pending.mockResolvedValue([]);
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: false,
  });
});
afterEach(() => vi.useRealTimers());
describe("mock session controller", () => {
  it("commits a timeout exactly once and preserves time when the queue changes", async () => {
    const { result, unmount } = renderHook(() => useMockDraft(null, false));
    await waitFor(() => expect(result.current.ready).toBe(true));
    vi.useFakeTimers();
    await act(async () => {
      await result.current.start(session());
    });
    act(() => {
      vi.advanceTimersByTime(10_000);
      result.current.queue(["2"]);
    });
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(result.current.session?.picks).toHaveLength(1);
    expect(result.current.session?.picks[0]).toMatchObject({
      playerId: "2",
      source: "timeout",
      contributes: false,
    });
    unmount();
  });
  it("pauses on hidden tabs and resumes with remaining time", async () => {
    const { result, unmount } = renderHook(() => useMockDraft(null, false));
    await waitFor(() => expect(result.current.ready).toBe(true));
    vi.useFakeTimers();
    await act(async () => {
      await result.current.start(session());
    });
    act(() => {
      vi.advanceTimersByTime(5000);
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current.session?.status).toBe("paused");
    expect(result.current.session?.pending?.remainingMs).toBe(10_000);
    act(() => vi.advanceTimersByTime(30_000));
    expect(result.current.session?.picks).toHaveLength(0);
    unmount();
  });
  it("waits on human expiry in pause mode, and resumes a fresh clock", async () => {
    const { result, unmount } = renderHook(() => useMockDraft(null, false));
    await waitFor(() => expect(result.current.ready).toBe(true));
    vi.useFakeTimers();
    const s = session();
    s.config.timeout = "pause";
    await act(async () => {
      await result.current.start(s);
    });
    act(() => vi.advanceTimersByTime(15_000));
    expect(result.current.session?.status).toBe("paused");
    expect(result.current.session?.picks).toHaveLength(0);
    await act(async () => {
      await result.current.resume();
    });
    expect(result.current.session?.pending?.remainingMs).toBe(15_000);
    unmount();
  });
  it("requires explicit takeover before editing a restored session", async () => {
    storage.read.mockResolvedValue(session());
    storage.write.mockResolvedValue(false);
    const { result, unmount } = renderHook(() => useMockDraft(null, false));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.owns).toBe(false);
    act(() => result.current.queue(["2"]));
    expect(result.current.session?.queue).toEqual([]);
    storage.write.mockResolvedValue(true);
    await act(async () => {
      await result.current.takeover();
    });
    expect(result.current.owns).toBe(true);
    expect(result.current.session?.status).toBe("paused");
    unmount();
  });
});
