import fs from "fs";
import path from "path";

import { parseCronInventoryFromMarkdown } from "lib/cron/cronInventory";

export type CronAuditCoverageMode = "shared-wrapper" | "manual-insert" | "exempt";

export type CronAuditCoverageFinding = {
  jobNames: string[];
  routePath: string;
  filePath: string | null;
  mode: CronAuditCoverageMode | null;
  reason: string | null;
};

// Exemptions must remain rare, route-specific, and justified. An empty map means
// every active scheduled HTTP route currently has an audit-producing owner.
export const CRON_AUDIT_EXEMPTIONS: Readonly<Record<string, string>> = {};

function routeCandidates(webRoot: string, routePath: string) {
  const routeRelativePath = routePath.replace(/^\/+/, "");
  const basePath = path.resolve(webRoot, "pages", routeRelativePath);
  const pagesRoot = path.resolve(webRoot, "pages");

  if (!basePath.startsWith(`${pagesRoot}${path.sep}`)) {
    return [];
  }

  return [
    `${basePath}.ts`,
    `${basePath}.tsx`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx"),
  ];
}

export function resolveCronRouteFile(webRoot: string, routePath: string) {
  return routeCandidates(webRoot, routePath).find((candidate) => fs.existsSync(candidate)) ?? null;
}

export function classifyCronAuditSource(source: string): CronAuditCoverageMode | null {
  if (/\bwithCronJobAudit\s*\(/.test(source)) {
    return "shared-wrapper";
  }

  if (
    /\.from\(\s*["']cron_job_audit["']\s*\)\s*\.insert\s*\(/.test(source)
  ) {
    return "manual-insert";
  }

  return null;
}

export function inspectScheduledCronAuditCoverage(args: {
  scheduleMarkdown: string;
  webRoot: string;
  exemptions?: Readonly<Record<string, string>>;
}): CronAuditCoverageFinding[] {
  const exemptions = args.exemptions ?? CRON_AUDIT_EXEMPTIONS;
  const jobsByRoute = new Map<string, string[]>();

  for (const job of parseCronInventoryFromMarkdown(args.scheduleMarkdown)) {
    if ((job.method !== "GET" && job.method !== "POST") || !job.routePath) {
      continue;
    }

    jobsByRoute.set(job.routePath, [
      ...(jobsByRoute.get(job.routePath) ?? []),
      job.name,
    ]);
  }

  return Array.from(jobsByRoute.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([routePath, jobNames]) => {
      const exemptionReason = exemptions[routePath] ?? null;
      if (exemptionReason) {
        return {
          jobNames,
          routePath,
          filePath: resolveCronRouteFile(args.webRoot, routePath),
          mode: "exempt" as const,
          reason: exemptionReason,
        };
      }

      const filePath = resolveCronRouteFile(args.webRoot, routePath);
      if (!filePath) {
        return {
          jobNames,
          routePath,
          filePath: null,
          mode: null,
          reason: "No Pages API route file resolves from the active cron inventory.",
        };
      }

      const mode = classifyCronAuditSource(fs.readFileSync(filePath, "utf8"));
      return {
        jobNames,
        routePath,
        filePath,
        mode,
        reason: mode ? null : "Route has neither withCronJobAudit nor a manual cron_job_audit insert.",
      };
    });
}
