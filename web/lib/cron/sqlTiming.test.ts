import { describe, expect, it } from "vitest";

import { buildSqlCronTimingObservation } from "lib/cron/sqlTiming";

describe("buildSqlCronTimingObservation", () => {
  it("normalizes pg_cron SQL timing into the canonical timing contract", () => {
    const result = buildSqlCronTimingObservation({
      jobname: "daily-refresh-player-unified-matview",
      scheduled_time: "2026-03-20T07:50:00.000Z",
      end_time: "2026-03-20T07:50:26.400Z",
      status: "succeeded",
      return_message: "REFRESH MATERIALIZED VIEW",
      sql_text: "REFRESH MATERIALIZED VIEW player_stats_unified;"
    });

    expect(result.jobName).toBe("daily-refresh-player-unified-matview");
    expect(result.method).toBe("SQL");
    expect(result.source).toBe("cron_report");
    expect(result.status).toBe("success");
    expect(result.timing).toEqual({
      startedAt: "2026-03-20T07:50:00.000Z",
      endedAt: "2026-03-20T07:50:26.400Z",
      durationMs: 26_400,
      timer: "00:26",
      source: "cron_report"
    });
  });

  it("returns null timing when pg_cron timestamps are incomplete", () => {
    const result = buildSqlCronTimingObservation({
      jobname: "daily-refresh-goalie-unified-matview",
      scheduled_time: "2026-03-20T09:05:00.000Z",
      end_time: null,
      status: "failed"
    });

    expect(result.status).toBe("failure");
    expect(result.timing).toBeNull();
  });
});
