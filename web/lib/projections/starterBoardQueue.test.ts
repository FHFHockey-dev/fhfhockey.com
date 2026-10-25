// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ForecastCadenceInput } from "lib/fantasy-projections/seasonJobs";

const { runProjection } = vi.hoisted(() => ({ runProjection: vi.fn() }));
vi.mock("./run-forge-projections", () => ({ runProjectionV2ForDate: runProjection }));
import { computeStarterBoardJob, dispatchStarterBoardJobs, enqueueStarterBoardCadence } from "./starterBoardQueue";

const input = (): ForecastCadenceInput => ({ date: "2026-10-15", now: new Date("2026-10-15T12:00:00Z"),
  requiredSources: ["overnight"], sources: [{ key: "overnight", date: "2026-10-15", status: "complete",
    revision: "source-r1", completedAt: "2026-10-15T11:30:00Z", expectedItems: 3, completedItems: 3 }],
  games: [{ gameId: 2026020001, startsAt: "2026-10-15T23:00:00Z" }], previous: [] });
const response = (data: unknown) => ({ abortSignal: vi.fn().mockResolvedValue({ data, error: null }) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("STARTER_BOARD_CAPTURE_ENABLED", "true");
  vi.stubEnv("STARTER_BOARD_COMPUTE_ENABLED", "true");
  vi.stubEnv("STARTER_BOARD_SCHEDULER_ENABLED", "true");
});
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("native Starter Board cadence coordinator", () => {
  it("requires the existing scheduler/capture/compute authorization switches", async () => {
    const rpc = vi.fn();
    vi.stubEnv("STARTER_BOARD_SCHEDULER_ENABLED", "false");
    await expect(enqueueStarterBoardCadence({ rpc } as never, input())).rejects.toThrow("not enabled");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("enqueues the per-game morning slot only after explicit upstream completion", async () => {
    const rpc = vi.fn().mockReturnValue(response({ outcome: "enqueued" }));
    const args = input();
    args.sources[0].status = "partial";
    expect((await enqueueStarterBoardCadence({ rpc } as never, args)).results.every(row => row.outcome === "held")).toBe(true);
    expect(rpc).not.toHaveBeenCalled();
    args.sources[0].status = "complete";
    const result = await enqueueStarterBoardCadence({ rpc } as never, args);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("enqueue_forge_cadence_slot", expect.objectContaining({
      p_game_id: 2026020001, p_date: "2026-10-15", p_kind: "morning", p_sources: args.sources,
    }));
    expect(result.results.map(row => row.outcome)).toEqual(["enqueued", "held"]);
    expect(result.activationApproved).toBe(false);
    expect(runProjection).not.toHaveBeenCalled();
  });

  it("uses durable per-game receipts for success dedup and a distinct T-15 revision", async () => {
    const rpc = vi.fn().mockReturnValueOnce(response({ outcome: "deduplicated" }))
      .mockReturnValueOnce(response({ outcome: "enqueued" }));
    const args = input();
    args.now = new Date("2026-10-15T22:45:00Z");
    args.previous = [{ key: "morning:2026-10-15", status: "succeeded", attempts: 1 }];
    const result = await enqueueStarterBoardCadence({ rpc } as never, args);
    expect(result.results.map(row => row.outcome)).toEqual(["deduplicated", "enqueued"]);
    expect(rpc.mock.calls[1][1].p_kind).toBe("news_revision");
    expect(result.slots[1].dueAt).toBe("2026-10-15T22:45:00.000Z");
  });

  it("stops on uncertain enqueue acknowledgement without retrying other slots", async () => {
    const rpc = vi.fn().mockReturnValue(response(null));
    const args = input();
    args.games.push({ gameId: 2026020002, startsAt: "2026-10-15T23:00:00Z" });
    const result = await enqueueStarterBoardCadence({ rpc } as never, args);
    expect(result.stopped).toBe(true);
    expect(result.results[0].outcome).toBe("unknown");
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("bounds a hung enqueue transport and reports unknown commit rather than retrying", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const rpc = vi.fn().mockReturnValue({ abortSignal: (value: AbortSignal) => {
      signal = value; return new Promise(() => {});
    } });
    const result = enqueueStarterBoardCadence({ rpc } as never, input());
    await vi.advanceTimersByTimeAsync(5000);
    expect((await result).results[0].outcome).toBe("unknown");
    expect(signal?.aborted).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("preserves the existing canary boundary", async () => {
    vi.stubEnv("STARTER_BOARD_CANARY_GAME_IDS", "2026020002");
    const rpc = vi.fn();
    await expect(enqueueStarterBoardCadence({ rpc } as never, input())).rejects.toThrow("canary scope");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("uses the existing fenced native worker and completes only a published game", async () => {
    runProjection.mockResolvedValue({ runId: "native-run-1", publishedGames: 1, timedOut: false });
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const query: any = { select: () => query, eq: () => query, abortSignal: () => query,
      single: async () => ({ data: { date: "2026-10-15" }, error: null }) };
    const result = await computeStarterBoardJob({ from: () => query, rpc } as never,
      { game_id: 2026020001, claimed_version: 2, first_accepted_at: new Date().toISOString() }, "fixture-owner");
    expect(runProjection).toHaveBeenCalledWith("2026-10-15", expect.objectContaining({
      gameIds: [2026020001], horizonGames: 1, boardLease: { owner: "fixture-owner", version: 2 },
    }));
    expect(rpc).toHaveBeenCalledWith("finish_starter_board_job", {
      p_game_id: 2026020001, p_owner: "fixture-owner", p_run_id: "native-run-1", p_error: null,
    });
    expect(result.error).toBeNull();
    runProjection.mockResolvedValue({ runId: "partial-run", publishedGames: 0, timedOut: false });
    const partial = await computeStarterBoardJob({ from: () => query, rpc } as never,
      { game_id: 2026020001, claimed_version: 3, first_accepted_at: new Date().toISOString() }, "fixture-owner");
    expect(partial.error).toContain("did not publish a complete pregame revision");
    expect(rpc.mock.calls[1][1].p_error).toContain("did not publish");
  });

  it("optionally connects cadence enqueue to the existing leased worker dispatcher", async () => {
    const rpc = vi.fn((name: string) => name === "enqueue_forge_cadence_slot"
      ? response({ outcome: "enqueued" }) : Promise.resolve({ data: [{ game_id: 2026020001,
        claimed_version: 1, first_accepted_at: "2026-10-15T12:00:00Z" }], error: null }));
    const request = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const result = await dispatchStarterBoardJobs({ rpc } as never, "https://synthetic.invalid", "synthetic-token", request, input());
    expect(result.dispatched).toBe(1);
    expect(result.failed).toBe(0);
    expect(rpc.mock.calls.map(call => call[0])).toEqual(["enqueue_forge_cadence_slot", "claim_starter_board_jobs"]);
    expect(request).toHaveBeenCalledWith(new URL("https://synthetic.invalid/api/v1/db/drain-starter-board"),
      expect.objectContaining({ method: "POST", body: expect.stringContaining('"claimed_version":1') }));
  });
});
