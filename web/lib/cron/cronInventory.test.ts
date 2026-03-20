import { describe, expect, it } from "vitest";

import {
  formatScheduleTime,
  parseCronInventoryFromMarkdown
} from "lib/cron/cronInventory";

describe("cronInventory", () => {
  it("parses and orders scheduled jobs chronologically while preserving tie order", () => {
    const inventory = parseCronInventoryFromMarkdown(`
-- STATUS: 404 NOT FOUND
-- SELECT cron.schedule(
--   'broken-job',
--   '45 7 * * *',
--   $$
--     SELECT net.http_get(
--       url := 'https://fhfhockey.com/api/v1/db/update-shifts?action=all'
--     );
--   $$
-- );

-- SELECT cron.schedule(
--   'sql-refresh',
--   '50 7 * * *',
--   'REFRESH MATERIALIZED VIEW player_stats_unified;'
-- );

-- SELECT cron.schedule(
--   'post-job',
--   '45 7 * * *',
--   $$
--     SELECT net.http_post(
--       url := 'https://fhfhockey.com/api/v1/db/run-projection-v2'
--     );
--   $$
-- );
`);

    expect(inventory.map((job) => job.name)).toEqual([
      "broken-job",
      "post-job",
      "sql-refresh"
    ]);
    expect(inventory[0]).toMatchObject({
      method: "GET",
      executionShape: "currently non-runnable in local/dev",
      route: "/api/v1/db/update-shifts?action=all",
      routePath: "/api/v1/db/update-shifts"
    });
    expect(inventory[1]).toMatchObject({
      method: "POST",
      executionShape: "HTTP route",
      route: "/api/v1/db/run-projection-v2"
    });
    expect(inventory[2]).toMatchObject({
      method: "SQL",
      executionShape: "SQL-only",
      sqlText: "REFRESH MATERIALIZED VIEW player_stats_unified;"
    });
  });

  it("formats cron slots as UTC HH:MM strings", () => {
    expect(formatScheduleTime("5 9 * * *")).toBe("09:05 UTC");
    expect(formatScheduleTime("invalid")).toBe("invalid");
  });
});
