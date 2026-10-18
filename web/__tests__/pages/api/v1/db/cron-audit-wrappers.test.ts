import fs from "fs";
import path from "path";

import { describe, expect, it } from "vitest";

import {
  CRON_AUDIT_EXEMPTIONS,
  CRON_AUTH_DIRECT_SECRET_ROUTES,
  inspectScheduledCronAuditCoverage,
  inspectScheduledCronAuthCoverage,
} from "lib/cron/cronAuditCoverage";

describe("scheduled cron audit coverage", () => {
  const webRoot = process.cwd();
  const scheduleMarkdown = fs.readFileSync(
    path.resolve(webRoot, "../tasks/TASKS/cron-operations/cron-schedule.md"),
    "utf8",
  );
  const findings = inspectScheduledCronAuditCoverage({
    scheduleMarkdown,
    webRoot,
  });
  const authFindings = inspectScheduledCronAuthCoverage({
    scheduleMarkdown,
    webRoot,
  });

  it("covers every active scheduled HTTP route with an audit owner", () => {
    const uncovered = findings.filter((finding) => finding.mode == null);

    expect(uncovered).toEqual([]);
  });

  it("keeps manual audit owners explicit and all other routes on the shared wrapper", () => {
    const manualRoutes = findings
      .filter((finding) => finding.mode === "manual-insert")
      .map((finding) => finding.routePath);
    const unexpectedModes = findings.filter(
      (finding) =>
        finding.mode !== "shared-wrapper" &&
        finding.mode !== "manual-insert" &&
        finding.mode !== "exempt",
    );

    expect(manualRoutes).toEqual([
      "/api/v1/db/update-nst-gamelog",
      "/api/v1/db/update-wgo-goalies",
      "/api/v1/db/update-wgo-skaters",
      "/api/v1/db/update-wgo-totals",
    ]);
    expect(unexpectedModes).toEqual([]);
    expect(CRON_AUDIT_EXEMPTIONS).toEqual({});
  });

  it("freezes every active HTTP job, route auth mode, and non-cron caller shape before rollout", () => {
    const modeCounts = authFindings.reduce<Record<string, number>>(
      (counts, finding) => {
        const mode = finding.currentMode ?? "missing-route";
        counts[mode] = (counts[mode] ?? 0) + 1;
        return counts;
      },
      {},
    );
    const callerCounts = authFindings.reduce<Record<string, number>>(
      (counts, finding) => {
        counts[finding.callerShape] = (counts[finding.callerShape] ?? 0) + 1;
        return counts;
      },
      {},
    );

    // 2026-10-17: pg_cron job 234 (daily-cron-report) is intentionally
    // inactive (tasks/artifacts/ops-health-2026-10-17, OPS-06). Its route is
    // scheduled only by the Vercel 0 13 * * * cron, outside this pg_cron set.
    expect(authFindings).toHaveLength(46);
    expect(
      authFindings.reduce(
        (jobCount, finding) => jobCount + finding.jobNames.length,
        0,
      ),
    ).toBe(50);
    expect(modeCounts).toEqual({
      "admin-or-cron": 46,
    });
    expect(callerCounts).toEqual({
      "browser-admin": 5,
      "browser-admin-and-internal": 4,
      "cron-only": 26,
      "internal-server": 11,
    });
    expect(authFindings.some((finding) => finding.routePath === "/api/v1/db/cron-report")).toBe(false);
    const vercelConfig = JSON.parse(fs.readFileSync(path.resolve(webRoot, "vercel.json"), "utf8"));
    expect(vercelConfig.crons).toContainEqual({ path: "/api/v1/db/cron-report", schedule: "0 13 * * *" });
    expect(authFindings.filter((finding) => !finding.filePath)).toEqual([]);

    for (const finding of authFindings) {
      for (const callerFile of finding.callerFiles) {
        const callerPath = path.resolve(
          webRoot,
          callerFile.replace(/^web\//, ""),
        );
        expect(fs.existsSync(callerPath)).toBe(true);
        expect(fs.readFileSync(callerPath, "utf8")).toContain(
          finding.routePath,
        );
      }
    }
  });

  it("keeps every scheduled route behind its reviewed authorization boundary", () => {
    const unprotectedRoutes = authFindings
      .filter((finding) => finding.currentMode === "unprotected")
      .map((finding) => finding.routePath);

    expect(unprotectedRoutes).toEqual([]);
    expect(
      authFindings.every(
        (finding) =>
          finding.targetMode === "admin-or-cron" ||
          finding.targetMode === "cron-secret-only",
      ),
    ).toBe(true);
    expect(CRON_AUTH_DIRECT_SECRET_ROUTES).toEqual({
      "/api/internal/sync-yahoo-players-to-sheet":
        "Internal destructive sheet sync; exact cron bearer only.",
    });
  });
});
