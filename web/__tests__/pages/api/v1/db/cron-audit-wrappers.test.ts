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

    expect(authFindings).toHaveLength(52);
    expect(
      authFindings.reduce(
        (jobCount, finding) => jobCount + finding.jobNames.length,
        0,
      ),
    ).toBe(59);
    expect(modeCounts).toEqual({
      "admin-or-cron": 20,
      "cron-secret-only": 1,
      unprotected: 31,
    });
    expect(callerCounts).toEqual({
      "browser-admin": 5,
      "browser-admin-and-internal": 4,
      "cron-only": 32,
      "internal-server": 11,
    });
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

  it("keeps the reviewed unprotected set explicit and targets no public unauthenticated exception", () => {
    const unprotectedRoutes = authFindings
      .filter((finding) => finding.currentMode === "unprotected")
      .map((finding) => finding.routePath);

    expect(unprotectedRoutes).toEqual([
      "/api/v1/db/calculate-wigo-stats",
      "/api/v1/db/cron-report",
      "/api/v1/db/run-fetch-wgo-data",
      "/api/v1/db/run-projection-accuracy",
      "/api/v1/db/run-projection-v2",
      "/api/v1/db/sustainability/rebuild-baselines",
      "/api/v1/db/update-game-goal-projections",
      "/api/v1/db/update-goalie-projections-v2",
      "/api/v1/db/update-nhl-edge-stats",
      "/api/v1/db/update-nst-current-season",
      "/api/v1/db/update-nst-gamelog",
      "/api/v1/db/update-nst-goalies",
      "/api/v1/db/update-nst-team-daily",
      "/api/v1/db/update-player-trend-metrics",
      "/api/v1/db/update-rolling-player-averages",
      "/api/v1/db/update-sko-stats",
      "/api/v1/db/update-team-ctpi-daily",
      "/api/v1/db/update-team-power-ratings",
      "/api/v1/db/update-team-sos",
      "/api/v1/db/update-team-yearly-summary",
      "/api/v1/db/update-wgo-averages",
      "/api/v1/db/update-wgo-goalie-totals",
      "/api/v1/db/update-wgo-skaters",
      "/api/v1/db/update-wgo-totals",
      "/api/v1/db/update-yahoo-players",
      "/api/v1/db/update-yahoo-weeks",
      "/api/v1/ml/update-predictions-sko",
      "/api/v1/sustainability/rebuild-priors",
      "/api/v1/sustainability/rebuild-score",
      "/api/v1/sustainability/rebuild-trend-bands",
      "/api/v1/sustainability/rebuild-window-z",
    ]);
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
