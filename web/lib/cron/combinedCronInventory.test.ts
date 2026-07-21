import { describe, expect, it } from "vitest";

import {
  buildCombinedCronInventory,
  classifyCronDomains,
  findCrossProviderCronCollisions,
  findScheduledRuntimeBudgetFindings,
  getFixedCronTime,
  loadCombinedCronInventory,
  normalizeCronExpression,
  parseVercelCronConfig,
} from "lib/cron/combinedCronInventory";
import { PROJECTION_ROUTE_DEFAULT_BUDGET_MS } from "lib/rollingPlayerOperationalPolicy";

describe("combinedCronInventory", () => {
  it("normalizes fixed fields without coercing wildcard syntax", () => {
    expect(normalizeCronExpression("05 10 * * *")).toBe("5 10 * * *");
    expect(normalizeCronExpression("*/30 * * * *")).toBe("*/30 * * * *");
    expect(getFixedCronTime("*/30 * * * *")).toEqual({
      utcMinute: null,
      utcHour: null,
    });
  });

  it.each([
    "foo bar baz qux quux",
    "*/0 * * * *",
    "60 0 * * *",
    "0 24 * * *",
    "0 0 0 * *",
    "0 0 * 13 *",
    "0 0 * * 8",
    "1,,2 0 * * *",
    "10-5 0 * * *",
  ])("rejects unsupported or out-of-range cron syntax: %s", (schedule) => {
    expect(() => normalizeCronExpression(schedule)).toThrow();
  });

  it("maps the scheduled compatibility route to relationship ownership", () => {
    expect(classifyCronDomains("/api/v1/db/update-shifts")).toEqual([
      "projection_relationship_build",
    ]);
  });

  it("fails closed for malformed or incomplete provider sources", () => {
    expect(() => parseVercelCronConfig("not-json")).toThrow(
      "Vercel cron configuration is malformed",
    );
    expect(() => parseVercelCronConfig(JSON.stringify({ crons: [] }))).toThrow(
      "Vercel Pages function duration limit is missing",
    );
    expect(() =>
      buildCombinedCronInventory({
        cronScheduleMarkdown: "# missing canonical inventory",
        vercelConfigJson: JSON.stringify({
          functions: { "pages/api/**/*.ts": { maxDuration: 240 } },
          crons: [{ path: "/api/example", schedule: "0 0 * * *" }],
        }),
      }),
    ).toThrow("Canonical pg_cron JSON inventory is missing");
  });

  it("rejects host-bearing scheduled routes", () => {
    for (const route of [
      "https://example.invalid/api/cron",
      "//example.invalid/api/cron",
      "/api\\cron",
      "/api/cron#fragment",
    ]) {
      expect(() =>
        parseVercelCronConfig(
          JSON.stringify({
            functions: { "pages/api/**/*.ts": { maxDuration: 240 } },
            crons: [{ path: route, schedule: "0 0 * * *" }],
          }),
        ),
      ).toThrow("Scheduled routes must be path-only values");
    }
  });

  it.each([
    "/api/v1/db/run-rolling-forge-pipeline ?mode=daily_incremental",
    "/api/v1/db/run-rolling-forge-pipeline?mode=daily_incremental ",
  ])("rejects raw whitespace in scheduled routes: %s", (route) => {
    expect(() =>
      parseVercelCronConfig(
        JSON.stringify({
          functions: { "pages/api/**/*.ts": { maxDuration: 240 } },
          crons: [{ path: route, schedule: "0 0 * * *" }],
        }),
      ),
    ).toThrow("Scheduled routes must be path-only values");
  });

  it.each([
    "/api/v1/db/./run-rolling-forge-pipeline?mode=daily_incremental",
    "/api/v1/db/example/../run-rolling-forge-pipeline?mode=daily_incremental",
    "/api/v1/db/%2e%2e/db/run-rolling-forge-pipeline?mode=daily_incremental",
  ])("rejects noncanonical scheduled route aliases: %s", (route) => {
    expect(() =>
      parseVercelCronConfig(
        JSON.stringify({
          functions: { "pages/api/**/*.ts": { maxDuration: 240 } },
          crons: [{ path: route, schedule: "0 0 * * *" }],
        }),
      ),
    ).toThrow("Scheduled route paths must use canonical URL syntax");
  });

  it("rejects credential-bearing scheduled query fields", () => {
    expect(() =>
      parseVercelCronConfig(
        JSON.stringify({
          functions: { "pages/api/**/*.ts": { maxDuration: 240 } },
          crons: [
            {
              path: "/api/cron?api_key=redacted",
              schedule: "0 0 * * *",
            },
          ],
        }),
      ),
    ).toThrow("Scheduled routes cannot embed credential query fields");
  });

  it.each(["0 0 1 * 1", "0 0 * * 7"])(
    "rejects cron syntax unsupported by Vercel: %s",
    (schedule) => {
      expect(() =>
        parseVercelCronConfig(
          JSON.stringify({
            functions: { "pages/api/**/*.ts": { maxDuration: 240 } },
            crons: [{ path: "/api/example", schedule }],
          }),
        ),
      ).toThrow();
    },
  );

  it("fails closed when canonical pg_cron rows or parser identity drift", () => {
    const vercelConfigJson = JSON.stringify({
      functions: { "pages/api/**/*.ts": { maxDuration: 240 } },
      crons: [{ path: "/api/example", schedule: "0 0 * * *" }],
    });

    expect(() =>
      buildCombinedCronInventory({
        cronScheduleMarkdown: "# ALL CRON JOBS:\n```json\n[1]\n```",
        vercelConfigJson,
      }),
    ).toThrow("Canonical pg_cron inventory contains a malformed row");

    expect(() =>
      buildCombinedCronInventory({
        cronScheduleMarkdown: `
\`\`\`json
[{"jobid":1,"jobname":"wrong","schedule":"0 0 * * *","active":true,"method":"GET","route":"/api/wrong"}]
\`\`\`
# ALL CRON JOBS:
\`\`\`json
[{"jobid":2,"jobname":"right","schedule":"0 0 * * *","active":true,"method":"GET","route":"/api/right"}]
\`\`\`
`,
        vercelConfigJson,
      }),
    ).toThrow("Parsed pg_cron identity differs from the canonical row");
  });

  it.each([
    [
      {
        jobname: "missing-id",
        schedule: "0 0 * * *",
        active: true,
        method: "GET",
        route: "/api/example",
      },
      "Canonical active pg_cron job ID is malformed",
    ],
    [
      {
        jobid: 1,
        jobname: "missing-method",
        schedule: "0 0 * * *",
        active: true,
        route: "/api/example",
      },
      "Canonical active pg_cron method is malformed",
    ],
    [
      {
        jobid: 1,
        jobname: "missing-route",
        schedule: "0 0 * * *",
        active: true,
        method: "POST",
      },
      "Canonical HTTP pg_cron route is missing",
    ],
    [
      {
        jobid: 1,
        jobname: "sql-with-route",
        schedule: "0 0 * * *",
        active: true,
        method: "SQL",
        route: "/api/example",
      },
      "Canonical SQL pg_cron row cannot define an HTTP route",
    ],
  ])("requires complete active canonical rows", (row, expectedMessage) => {
    expect(() =>
      buildCombinedCronInventory({
        cronScheduleMarkdown: `# ALL CRON JOBS:\n\`\`\`json\n${JSON.stringify([row])}\n\`\`\``,
        vercelConfigJson: JSON.stringify({
          functions: { "pages/api/**/*.ts": { maxDuration: 240 } },
          crons: [{ path: "/api/example", schedule: "0 0 * * *" }],
        }),
      }),
    ).toThrow(expectedMessage);
  });

  it("uses the exact canonical route query instead of a stale SQL definition", () => {
    const inventory = buildCombinedCronInventory({
      cronScheduleMarkdown: `
# ALL CRON JOBS:
\`\`\`json
[{"jobid":1,"jobname":"bounded-projection","schedule":"0 0 * * *","active":true,"method":"POST","route":"/api/v1/db/run-projection-v2?maxDurationMs=120000"}]
\`\`\`

SELECT cron.schedule(
  'bounded-projection',
  '0 0 * * *',
  $$
    SELECT net.http_post(
      url := 'https://example.invalid/api/v1/db/run-projection-v2?maxDurationMs=270000'
    );
  $$
);
`,
      vercelConfigJson: JSON.stringify({
        functions: { "pages/api/**/*.ts": { maxDuration: 240 } },
        crons: [{ path: "/api/example", schedule: "30 0 * * *" }],
      }),
    });

    expect(
      inventory.jobs.find((job) => job.provider === "pg_cron")?.route,
    ).toBe("/api/v1/db/run-projection-v2?maxDurationMs=120000");
    expect(findScheduledRuntimeBudgetFindings(inventory)).toEqual([]);
  });

  it("loads all active pg_cron and Vercel jobs from canonical sources", async () => {
    const inventory = await loadCombinedCronInventory();

    expect(
      inventory.jobs.filter((job) => job.provider === "pg_cron"),
    ).toHaveLength(64);
    expect(
      inventory.jobs.filter((job) => job.provider === "vercel"),
    ).toHaveLength(20);
    expect(inventory.jobs).toHaveLength(84);
    expect(inventory.vercelMaxDurationMs).toBe(240_000);
    expect(inventory.jobs.every((job) => job.active)).toBe(true);
  });

  it("detects normalized cross-provider projection and sustainability collisions", async () => {
    const inventory = await loadCombinedCronInventory();
    const collisions = findCrossProviderCronCollisions(inventory.jobs);

    expect(collisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          normalizedCronExpressions: ["5 10 * * *"],
          domain: "projection_execution",
        }),
        expect.objectContaining({
          normalizedCronExpressions: ["42 10 * * *"],
          domain: "sustainability_priors",
        }),
        expect.objectContaining({
          normalizedCronExpressions: ["43 10 * * *"],
          domain: "sustainability_window_z",
        }),
      ]),
    );

    const projectionCollision = collisions.find(
      (collision) =>
        collision.normalizedCronExpressions.includes("5 10 * * *") &&
        collision.domain === "projection_execution",
    );
    expect(projectionCollision?.jobs.map((job) => job.provider).sort()).toEqual(
      ["pg_cron", "vercel"],
    );
    expect(JSON.stringify(collisions)).not.toMatch(/https?:\/\//);
  });

  it("detects wildcard schedules that overlap fixed schedules", () => {
    const inventory = buildCombinedCronInventory({
      cronScheduleMarkdown: `
# ALL CRON JOBS:
\`\`\`json
[{"jobid":1,"jobname":"half-hour-projection","schedule":"*/30 * * * *","active":true,"method":"POST","route":"/api/v1/db/run-projection-v2"}]
\`\`\`
`,
      vercelConfigJson: JSON.stringify({
        functions: { "pages/api/**/*.ts": { maxDuration: 240 } },
        crons: [
          {
            path: "/api/v1/db/run-projection-v2?maxDurationMs=120000",
            schedule: "0 * * * *",
          },
        ],
      }),
    });

    expect(findCrossProviderCronCollisions(inventory.jobs)).toEqual([
      expect.objectContaining({
        normalizedCronExpressions: ["*/30 * * * *", "0 * * * *"],
        domain: "projection_execution",
      }),
    ]);
  });

  it.each([
    ["0 0 */2 * *", "0 0 2 * *", false],
    ["0 0 */2 * *", "0 0 3 * *", true],
    ["0 0 * * */2", "0 0 * * 1", false],
    ["0 0 29 2 *", "0 0 * 2 0", true],
  ])(
    "applies pg_cron calendar semantics to %s and %s",
    (pgSchedule, vercelSchedule, shouldOverlap) => {
      const inventory = buildCombinedCronInventory({
        cronScheduleMarkdown: `
# ALL CRON JOBS:
\`\`\`json
[{"jobid":1,"jobname":"pg-projection","schedule":"${pgSchedule}","active":true,"method":"POST","route":"/api/v1/db/run-projection-v2"}]
\`\`\`
`,
        vercelConfigJson: JSON.stringify({
          functions: { "pages/api/**/*.ts": { maxDuration: 240 } },
          crons: [
            {
              path: "/api/v1/db/run-projection-v2?maxDurationMs=120000",
              schedule: vercelSchedule,
            },
          ],
        }),
      });

      expect(findCrossProviderCronCollisions(inventory.jobs).length > 0).toBe(
        shouldOverlap,
      );
    },
  );

  it("reports both naturally scheduled 270-second contracts above the 240-second cap", async () => {
    const inventory = await loadCombinedCronInventory();
    const findings = findScheduledRuntimeBudgetFindings(inventory);

    expect(PROJECTION_ROUTE_DEFAULT_BUDGET_MS).toBe(270_000);
    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          routePath: "/api/v1/db/run-rolling-forge-pipeline",
          budgetMs: 270_000,
          platformLimitMs: 240_000,
          hasAuditFlushHeadroom: false,
        }),
        expect.objectContaining({
          routePath: "/api/v1/db/run-projection-v2",
          budgetMs: 270_000,
          platformLimitMs: 240_000,
          hasAuditFlushHeadroom: false,
          scheduledJobs: expect.arrayContaining([
            expect.objectContaining({ name: "run-forge-projection-v2" }),
            expect.objectContaining({
              name: "run-forge-projection-v2-weekly",
            }),
          ]),
        }),
      ]),
    );
  });

  it.each([
    ["overnight", 5_400_000],
    ["targeted_repair", 900_000],
  ])("uses the shared %s coordinator budget", (mode, expectedBudgetMs) => {
    const parsed = parseVercelCronConfig(
      JSON.stringify({
        functions: { "pages/api/**/*.ts": { maxDuration: 240 } },
        crons: [
          {
            path: `/api/v1/db/run-rolling-forge-pipeline?mode=${mode}`,
            schedule: "0 0 * * *",
          },
        ],
      }),
    );

    expect(
      findScheduledRuntimeBudgetFindings({
        jobs: parsed.jobs,
        vercelMaxDurationMs: parsed.maxDurationMs,
      }),
    ).toEqual([
      expect.objectContaining({
        routePath: "/api/v1/db/run-rolling-forge-pipeline",
        budgetMs: expectedBudgetMs,
      }),
    ]);
  });

  it.each([
    [
      "/api/v1/db/run-rolling-forge-pipeline",
      "Scheduled rolling coordinator mode must be provided exactly once",
    ],
    [
      "/api/v1/db/run-rolling-forge-pipeline?mode=overnight&mode=targeted_repair",
      "Scheduled rolling coordinator mode must be provided exactly once",
    ],
    [
      "/api/v1/db/run-rolling-forge-pipeline?mode=unsupported",
      "Scheduled rolling coordinator mode is unsupported",
    ],
  ])("rejects ambiguous coordinator runtime mode: %s", (route, message) => {
    const parsed = parseVercelCronConfig(
      JSON.stringify({
        functions: { "pages/api/**/*.ts": { maxDuration: 240 } },
        crons: [{ path: route, schedule: "0 0 * * *" }],
      }),
    );

    expect(() =>
      findScheduledRuntimeBudgetFindings({
        jobs: parsed.jobs,
        vercelMaxDurationMs: parsed.maxDurationMs,
      }),
    ).toThrow(message);
  });

  it("honors bounded direct-route overrides and rejects ambiguous ones", () => {
    const bounded = parseVercelCronConfig(
      JSON.stringify({
        functions: { "pages/api/**/*.ts": { maxDuration: 240 } },
        crons: [
          {
            path: "/api/v1/db/run-projection-v2?maxDurationMs=120000",
            schedule: "0 0 * * *",
          },
        ],
      }),
    );
    expect(
      findScheduledRuntimeBudgetFindings({
        jobs: bounded.jobs,
        vercelMaxDurationMs: bounded.maxDurationMs,
      }),
    ).toEqual([]);

    const repeated = parseVercelCronConfig(
      JSON.stringify({
        functions: { "pages/api/**/*.ts": { maxDuration: 240 } },
        crons: [
          {
            path: "/api/v1/db/run-projection-v2?maxDurationMs=120000&maxDurationMs=130000",
            schedule: "0 0 * * *",
          },
        ],
      }),
    );
    expect(() =>
      findScheduledRuntimeBudgetFindings({
        jobs: repeated.jobs,
        vercelMaxDurationMs: repeated.maxDurationMs,
      }),
    ).toThrow("Scheduled projection runtime override is repeated");
  });
});
