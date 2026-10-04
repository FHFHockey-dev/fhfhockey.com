import { describe, expect, it } from "vitest";
import { formatExecutionDuration, readReportMetrics, repositoryExecutionLimitMs, isNearRepositoryLimit } from "./reportMetrics";

describe("report metric evidence", () => {
  it("does not turn attempted, generic or wrapper-inferred counters into writes", () => {
    expect(readReportMetrics({ count: 50, updated: 40, rowsAffected: 20, succeeded: 10, rowsUpserted: 42 }, "/api/unknown").rowsUpserted).toBeNull();
    expect(readReportMetrics({ rowsUpserted: 42 }, "/api/v1/db/update-PbP").rowsUpserted).toBeNull();
    expect(readReportMetrics({ rowsUpserted: 42, rowsVerified: 41 }, "/api/v1/db/update-PbP").rowsUpserted).toBeNull();
  });
  it("preserves confirmed partial writes and labels failed game operations separately", () => {
    expect(readReportMetrics({ success: false, rowsUpserted: 741, rowsVerified: 741, failedRows: 1 }, "/api/v1/db/update-PbP"))
      .toEqual({ rowsUpserted: 741, failedRows: null, failedOperations: 1 });
  });
  it.each(["refresh-draft-ranker-community", "draft-ranker-health", "refresh-draft-ranker-discovery"])("keeps %s exception receipts in operation units", (name) => {
    expect(readReportMetrics({ success: false, error: "operation unavailable", failedRows: 1 }, `/api/v1/db/${name}`))
      .toEqual({ rowsUpserted: null, failedRows: null, failedOperations: 1 });
    expect(readReportMetrics({ failedRows: 0 }, `/api/v1/db/${name}`).failedRows).toBeNull();
  });
  it("preserves verified zero and does not double count verified or pruned rows", () => {
    expect(readReportMetrics({ rowsUpserted: 0, rowsVerified: 740, rowsPruned: 3 }, "/api/v1/db/ingest-projection-inputs").rowsUpserted).toBe(0);
    expect(readReportMetrics({ rowsAffected: 20, rowsVerified: 20 }, "/api/v1/db/update-shifts").rowsUpserted).toBe(20);
  });
  it("keeps missing metrics unknown, rejects invalid counts, and does not count error messages as rows", () => {
    for (const payload of [null, {}, { errors: ["network", "timeout"], errorCount: 2 }, { failedRows: -1 }, { failedRows: 1.5 }]) {
      expect(readReportMetrics(payload, "/api/unknown").failedRows).toBeNull();
    }
    expect(readReportMetrics({ failedRows: 0 }, "/api/unknown").failedRows).toBe(0);
  });
  it("uses the verified route's repository policy and does not assign it to unknown or SQL routes", () => {
    expect(repositoryExecutionLimitMs("/api/v1/db/run-projection-v2")).toBe(240000);
    expect(repositoryExecutionLimitMs("/api/v1/games")).toBeNull();
    expect(repositoryExecutionLimitMs(null)).toBeNull();
    expect(isNearRepositoryLimit(216000, 240000)).toBe(true);
    expect(isNearRepositoryLimit(215999, 240000)).toBe(false);
    expect(isNearRepositoryLimit(301000, null)).toBe(false);
  });
  it("distinguishes missing, exact zero and measured subsecond durations", () => {
    expect([null, -1, NaN].map(formatExecutionDuration)).toEqual(["Unknown", "Unknown", "Unknown"]);
    expect([0, 1, 499, 999, 1000, 59999, 60000, 239999].map(formatExecutionDuration)).toEqual(["0s", "<1s", "<1s", "<1s", "1s", "59s", "1m 0s", "3m 59s"]);
  });
});
