import fs from "fs";
import path from "path";

import { describe, expect, it } from "vitest";

import {
  CRON_AUDIT_EXEMPTIONS,
  inspectScheduledCronAuditCoverage,
} from "lib/cron/cronAuditCoverage";

describe("scheduled cron audit coverage", () => {
  const webRoot = process.cwd();
  const scheduleMarkdown = fs.readFileSync(
    path.resolve(webRoot, "../tasks/TASKS/cron-operations/cron-schedule.md"),
    "utf8"
  );
  const findings = inspectScheduledCronAuditCoverage({ scheduleMarkdown, webRoot });

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
        finding.mode !== "exempt"
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
});
