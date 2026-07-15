import { describe, expect, it, vi } from "vitest";
import {
  classifyWgoGoalieFetchFailure,
  classifyWgoGoaliePruneFailure,
  classifyWgoGoalieWriteFailure,
  fetchRequiredWgoGoaliePage,
  getWgoGoalieFetchFailureDetails,
  getWgoGoaliePruneFailureDetails,
  getWgoGoalieWriteFailureDetails,
  persistWgoGoalieStatsRecords,
  WgoGoalieFetchError,
  WgoGoaliePruneError,
  WgoGoalieWriteError,
} from "./wgoGoaliePersistence";

const records = [
  {
    goalie_id: 1,
    date: "2026-01-01",
    season_id: 20252026,
  },
  {
    goalie_id: 2,
    date: "2026-01-01",
    season_id: 20252026,
  },
];

describe("persistWgoGoalieStatsRecords", () => {
  it("does not call the writer for an empty input", async () => {
    const upsertRows = vi.fn();

    await expect(persistWgoGoalieStatsRecords([], upsertRows)).resolves.toBe(0);
    expect(upsertRows).not.toHaveBeenCalled();
  });

  it("returns the requested count after a successful bulk write", async () => {
    const upsertRows = vi.fn().mockResolvedValue(null);

    await expect(
      persistWgoGoalieStatsRecords(records, upsertRows),
    ).resolves.toBe(2);
    expect(upsertRows).toHaveBeenCalledOnce();
    expect(upsertRows).toHaveBeenCalledWith(records);
  });

  it("accepts a fully successful bounded row retry after a bulk error", async () => {
    const onBulkFallbackRecovered = vi.fn();
    const upsertRows = vi
      .fn()
      .mockResolvedValueOnce({
        code: "42883",
        message:
          "bulk failed at https://example.test/private?token=value Bearer sensitive\ncontinued",
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    await expect(
      persistWgoGoalieStatsRecords(records, upsertRows, {
        onBulkFallbackRecovered,
      }),
    ).resolves.toBe(2);
    expect(upsertRows).toHaveBeenCalledTimes(3);
    expect(onBulkFallbackRecovered).toHaveBeenCalledWith({
      code: "WGO_GOALIE_BULK_FALLBACK_RECOVERED",
      requestedRows: 2,
      persistedRows: 2,
      bulkErrorCode: "42883",
      bulkError: "bulk failed at [redacted-url] Bearer [redacted] continued",
    });
    expect(JSON.stringify(onBulkFallbackRecovered.mock.calls)).not.toContain(
      "sensitive",
    );
  });

  it("throws structured failure details when any requested row is not persisted", async () => {
    const upsertRows = vi
      .fn()
      .mockResolvedValueOnce({ code: "42883", message: "bulk failed" })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        code: "42883",
        message: "function unaccent(unknown, text) does not exist",
      });

    let capturedError: unknown;
    try {
      await persistWgoGoalieStatsRecords(records, upsertRows);
      expect.unreachable("expected WGO persistence to reject");
    } catch (error: unknown) {
      capturedError = error;
    }

    expect(capturedError).toBeInstanceOf(WgoGoalieWriteError);
    expect(getWgoGoalieWriteFailureDetails(capturedError)).toEqual({
      code: "WGO_GOALIE_WRITE_FAILED",
      requestedRows: 2,
      persistedRows: 1,
      completedRowsBeforeFailure: 0,
      totalPersistedRows: 1,
      failedRows: 1,
      bulkErrorCode: "42883",
      bulkError: "bulk failed",
      failedSamples: [
        {
          goalieId: 2,
          date: "2026-01-01",
          seasonId: 20252026,
          code: "42883",
          message: "function unaccent(unknown, text) does not exist",
        },
      ],
    });
  });

  it("bounds zero-persistence diagnostics while preserving the failed-row count", async () => {
    const manyRecords = Array.from({ length: 7 }, (_, index) => ({
      goalie_id: index + 1,
      date: "2026-01-01",
      season_id: 20252026,
    }));
    const upsertRows = vi.fn().mockResolvedValue({
      code: "42883",
      message: "x".repeat(500),
    });

    let capturedError: unknown;
    try {
      await persistWgoGoalieStatsRecords(manyRecords, upsertRows);
      expect.unreachable("expected zero-persistence WGO write to reject");
    } catch (error: unknown) {
      capturedError = error;
    }

    expect(capturedError).toBeInstanceOf(WgoGoalieWriteError);
    const details = getWgoGoalieWriteFailureDetails(capturedError);
    expect(details).toMatchObject({
      requestedRows: 7,
      persistedRows: 0,
      completedRowsBeforeFailure: 0,
      totalPersistedRows: 0,
      failedRows: 7,
    });
    expect(details?.failedSamples).toHaveLength(5);
    expect(details?.bulkError).toHaveLength(300);
    expect(details?.failedSamples[0].message).toHaveLength(300);
    expect(classifyWgoGoalieWriteFailure(capturedError)).toMatchObject({
      jobStatus: "error",
      httpStatus: 500,
      response: {
        success: false,
        code: "WGO_GOALIE_WRITE_FAILED",
        requestedRows: 7,
        persistedRows: 0,
        totalPersistedRows: 0,
        failedRows: 7,
      },
    });
  });

  it("adds completed outer-loop rows without losing the failing batch count", async () => {
    const upsertRows = vi
      .fn()
      .mockResolvedValueOnce({ code: "42883", message: "bulk failed" })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ code: "42883", message: "row failed" });

    let capturedError: unknown;
    try {
      await persistWgoGoalieStatsRecords(records, upsertRows);
      expect.unreachable("expected partial WGO persistence to reject");
    } catch (error: unknown) {
      capturedError = error;
    }

    expect(capturedError).toBeInstanceOf(WgoGoalieWriteError);
    (capturedError as WgoGoalieWriteError).addCompletedRowsBeforeFailure(4);
    expect(getWgoGoalieWriteFailureDetails(capturedError)).toMatchObject({
      persistedRows: 1,
      completedRowsBeforeFailure: 4,
      totalPersistedRows: 5,
      failedRows: 1,
    });
  });

  it("redacts secret-shaped bulk and row diagnostics before classification", async () => {
    const upsertRows = vi
      .fn()
      .mockResolvedValueOnce({
        code: "42883",
        message:
          "bulk failed at https://example.test/private?token=value Bearer bulk-secret\ncontinued",
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        code: "42883",
        message:
          "row failed at https://example.test/private?token=value Bearer row-secret\ncontinued",
      });

    let capturedError: unknown;
    try {
      await persistWgoGoalieStatsRecords(records, upsertRows);
      expect.unreachable("expected secret-shaped WGO write failure to reject");
    } catch (error: unknown) {
      capturedError = error;
    }

    const details = getWgoGoalieWriteFailureDetails(capturedError);
    expect(details?.bulkError).toBe(
      "bulk failed at [redacted-url] Bearer [redacted] continued",
    );
    expect(details?.failedSamples[0].message).toBe(
      "row failed at [redacted-url] Bearer [redacted] continued",
    );
    const classified = classifyWgoGoalieWriteFailure(capturedError);
    expect(JSON.stringify(classified)).not.toContain("bulk-secret");
    expect(JSON.stringify(classified)).not.toContain("row-secret");
    expect(JSON.stringify(classified)).not.toContain("token=value");
  });

  it("normalizes rejected bulk and row promises into structured sanitized failures", async () => {
    const rejectedBulk = Object.assign(
      new Error(
        "bulk rejected at https://example.test/private?token=value Bearer bulk-secret\ncontinued",
      ),
      { code: "NETWORK_ERROR" },
    );
    const rejectedRow = Object.assign(
      new Error(
        "row rejected at https://example.test/private?token=value Bearer row-secret\ncontinued",
      ),
      { code: "PGRST500" },
    );
    const upsertRows = vi
      .fn()
      .mockRejectedValueOnce(rejectedBulk)
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(rejectedRow);

    let capturedError: unknown;
    try {
      await persistWgoGoalieStatsRecords(records, upsertRows);
      expect.unreachable("expected rejected WGO writes to reject structurally");
    } catch (error: unknown) {
      capturedError = error;
    }

    expect(capturedError).toBeInstanceOf(WgoGoalieWriteError);
    expect(getWgoGoalieWriteFailureDetails(capturedError)).toEqual({
      code: "WGO_GOALIE_WRITE_FAILED",
      requestedRows: 2,
      persistedRows: 1,
      completedRowsBeforeFailure: 0,
      totalPersistedRows: 1,
      failedRows: 1,
      bulkErrorCode: "NETWORK_ERROR",
      bulkError: "bulk rejected at [redacted-url] Bearer [redacted] continued",
      failedSamples: [
        {
          goalieId: 2,
          date: "2026-01-01",
          seasonId: 20252026,
          code: "PGRST500",
          message: "row rejected at [redacted-url] Bearer [redacted] continued",
        },
      ],
    });
    expect(
      JSON.stringify(classifyWgoGoalieWriteFailure(capturedError)),
    ).not.toMatch(/bulk-secret|row-secret|token=value/);
  });
});

describe("fetchRequiredWgoGoaliePage", () => {
  it("returns a validated required source page", async () => {
    const page = [{ playerId: 8478402 }];

    await expect(
      fetchRequiredWgoGoaliePage({
        date: "2026-01-01",
        source: "summary",
        pageStart: 0,
        pageLimit: 100,
        request: async () => ({
          ok: true,
          status: 200,
          json: async () => ({ data: page }),
        }),
      }),
    ).resolves.toEqual(page);
  });

  it("rejects a required request with bounded sanitized diagnostics", async () => {
    let capturedError: unknown;
    try {
      await fetchRequiredWgoGoaliePage({
        date: "2026-01-01",
        source: "advanced",
        pageStart: 100,
        pageLimit: 100,
        request: async () => {
          throw new Error(
            `request failed at https://example.test/private?token=value Bearer sensitive\n${"x".repeat(500)}`,
          );
        },
      });
      expect.unreachable("expected required WGO page acquisition to reject");
    } catch (error: unknown) {
      capturedError = error;
    }

    expect(capturedError).toBeInstanceOf(WgoGoalieFetchError);
    const details = getWgoGoalieFetchFailureDetails(capturedError);
    expect(details).toMatchObject({
      code: "WGO_GOALIE_FETCH_FAILED",
      date: "2026-01-01",
      source: "advanced",
      pageStart: 100,
      pageLimit: 100,
      completedRowsBeforeFailure: 0,
    });
    expect(details?.upstreamError).toContain("[redacted-url]");
    expect(details?.upstreamError).toContain("Bearer [redacted]");
    expect(details?.upstreamError).not.toContain("sensitive");
    expect(details?.upstreamError.length).toBeLessThanOrEqual(300);
    expect(classifyWgoGoalieFetchFailure(capturedError)).toMatchObject({
      jobStatus: "error",
      httpStatus: 500,
      response: {
        success: false,
        code: "WGO_GOALIE_FETCH_FAILED",
        date: "2026-01-01",
        source: "advanced",
        pageStart: 100,
        pageLimit: 100,
      },
    });
  });

  it("rejects HTTP errors and malformed required source payloads", async () => {
    const cases = [
      {
        request: async () => ({
          ok: false,
          status: 503,
          json: async () => ({ data: [] }),
        }),
        expectedError: "Upstream returned HTTP 503.",
      },
      {
        request: async () => ({
          ok: true,
          status: 200,
          json: async () => ({ unexpected: [] }),
        }),
        expectedError: "Upstream response omitted the required data array.",
      },
      {
        request: async () => ({
          ok: true,
          status: 200,
          json: async () => ({
            data: Array.from({ length: 101 }, (_, index) => ({
              playerId: index + 1,
            })),
          }),
        }),
        expectedError:
          "Upstream returned 101 rows, exceeding the requested page limit 100.",
      },
    ];

    for (const testCase of cases) {
      let capturedError: unknown;
      try {
        await fetchRequiredWgoGoaliePage({
          date: "2026-01-01",
          source: "days_rest",
          pageStart: 0,
          pageLimit: 100,
          request: testCase.request,
        });
        expect.unreachable("expected invalid WGO source page to reject");
      } catch (error: unknown) {
        capturedError = error;
      }

      expect(capturedError).toBeInstanceOf(WgoGoalieFetchError);
      expect(getWgoGoalieFetchFailureDetails(capturedError)).toMatchObject({
        source: "days_rest",
        upstreamError: testCase.expectedError,
      });
    }
  });
});

describe("WgoGoaliePruneError", () => {
  it("reports the retained replacement count with bounded diagnostics", () => {
    const error = new WgoGoaliePruneError({
      code: "WGO_GOALIE_PRUNE_FAILED",
      date: "2026-01-01",
      replacementRowsPersisted: 2,
      upstreamError: {
        message: `prune failed at https://example.test/private Bearer sensitive\n${"x".repeat(500)}`,
      },
    });
    error.addCompletedRowsBeforeFailure(4);

    const details = getWgoGoaliePruneFailureDetails(error);
    expect(details).toMatchObject({
      code: "WGO_GOALIE_PRUNE_FAILED",
      date: "2026-01-01",
      replacementRowsPersisted: 2,
      completedRowsBeforeFailure: 4,
      totalPersistedRows: 6,
      safeSupersetRetained: true,
    });
    expect(details?.upstreamError).toContain("[redacted-url]");
    expect(details?.upstreamError).toContain("Bearer [redacted]");
    expect(details?.upstreamError).not.toContain("sensitive");
    expect(details?.upstreamError.length).toBeLessThanOrEqual(300);
    expect(classifyWgoGoaliePruneFailure(error)).toMatchObject({
      jobStatus: "error",
      httpStatus: 500,
      response: {
        success: false,
        code: "WGO_GOALIE_PRUNE_FAILED",
        replacementRowsPersisted: 2,
        totalPersistedRows: 6,
        safeSupersetRetained: true,
      },
    });
  });
});
