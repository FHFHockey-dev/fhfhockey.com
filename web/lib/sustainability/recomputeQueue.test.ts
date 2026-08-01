import { describe, expect, it, vi } from "vitest";

import {
  advanceSustainabilityRecomputeCursor,
  parseSustainabilityRecomputeCursor,
  processSustainabilityRecomputeQueue,
  type SustainabilityRecomputeCursor,
} from "./recomputeQueue";

const queueRow = {
  attempts: 1,
  completed_at: null,
  config_hash: "fnv1a_91691726",
  config_revision: 2,
  cursor: {
    stage: "priors",
    season: "current",
    snapshotDate: "current",
    offset: 0,
    limit: 250,
  },
  enqueued_at: "2026-07-25T00:00:00.000Z",
  id: 7,
  last_error: null,
  model_version: "sustainability_score_v2",
  next_attempt_at: "2026-07-25T00:00:00.000Z",
  reason: "config_change",
  started_at: "2026-07-25T00:00:00.000Z",
  status: "running",
};

describe("Sustainability recompute queue", () => {
  it("runs a deterministic bounded full-pipeline fixture", () => {
    let cursor: SustainabilityRecomputeCursor =
      parseSustainabilityRecomputeCursor(
        queueRow.cursor,
        new Date("2026-04-16T12:00:00Z"),
      );
    const visited: Array<{ stage: string; offset: number }> = [];
    const receipts = [100, 250, 10, 250, 10, 4, 250, 10];
    let completed = false;

    for (const processed of receipts) {
      visited.push({ stage: cursor.stage, offset: cursor.offset });
      const advanced = advanceSustainabilityRecomputeCursor(cursor, {
        success: true,
        processed,
      });
      cursor = advanced.cursor;
      completed = advanced.completed;
    }

    expect(visited).toEqual([
      { stage: "priors", offset: 0 },
      { stage: "window_z", offset: 0 },
      { stage: "window_z", offset: 250 },
      { stage: "score", offset: 0 },
      { stage: "score", offset: 250 },
      { stage: "finalize", offset: 0 },
      { stage: "trend_bands", offset: 0 },
      { stage: "trend_bands", offset: 250 },
    ]);
    expect(cursor).toMatchObject({
      stage: "trend_bands",
      snapshotDate: "2026-04-16",
      offset: 250,
    });
    expect(completed).toBe(true);
  });

  it("claims one job and advances it with the exact config identity", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: [queueRow], error: null })
      .mockResolvedValueOnce({
        data: [{ ...queueRow, status: "queued" }],
        error: null,
      });
    const runStage = vi
      .fn()
      .mockResolvedValue({ success: true, processed: 100 });

    const result = await processSustainabilityRecomputeQueue({
      client: { rpc } as never,
      runStage,
      now: new Date("2026-04-16T12:00:00Z"),
    });

    expect(runStage).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: "priors",
        snapshotDate: "2026-04-16",
      }),
      {
        configRevision: 2,
        modelVersion: "sustainability_score_v2",
        configHash: "fnv1a_91691726",
      },
    );
    expect(rpc).toHaveBeenLastCalledWith(
      "advance_sustainability_recompute_queue",
      expect.objectContaining({
        p_id: 7,
        p_completed: false,
        p_error: undefined,
      }),
    );
    expect(result).toMatchObject({
      claimed: true,
      completed: false,
      status: "queued",
      stage: "priors",
    });
  });

  it("records only a fixed failure code and leaves the job retryable", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: [queueRow], error: null })
      .mockResolvedValueOnce({
        data: [
          {
            ...queueRow,
            status: "failed",
            next_attempt_at: "2026-07-25T00:00:30.000Z",
          },
        ],
        error: null,
      });

    const result = await processSustainabilityRecomputeQueue({
      client: { rpc } as never,
      runStage: vi
        .fn()
        .mockRejectedValue(new Error("sensitive upstream detail")),
    });

    expect(rpc).toHaveBeenLastCalledWith(
      "advance_sustainability_recompute_queue",
      expect.objectContaining({ p_error: "stage_failed" }),
    );
    expect(JSON.stringify(result)).not.toContain("sensitive upstream detail");
    expect(result).toMatchObject({ status: "failed", completed: false });
  });
});
