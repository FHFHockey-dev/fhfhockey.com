import fs from "fs";
import path from "path";

import { parseCronInventoryFromMarkdown } from "lib/cron/cronInventory";

export type CronAuditCoverageMode =
  | "shared-wrapper"
  | "manual-insert"
  | "exempt";

export type CronAuditCoverageFinding = {
  jobNames: string[];
  routePath: string;
  filePath: string | null;
  mode: CronAuditCoverageMode | null;
  reason: string | null;
};

export type CronAuthCoverageMode =
  | "admin-or-cron"
  | "cron-secret-only"
  | "unprotected";

export type CronAuthCallerShape =
  | "cron-only"
  | "browser-admin"
  | "internal-server"
  | "browser-admin-and-internal";

export type CronAuthCallerInventory = {
  shape: Exclude<CronAuthCallerShape, "cron-only">;
  files: readonly string[];
};

export type CronAuthCoverageFinding = {
  jobNames: string[];
  routePath: string;
  filePath: string | null;
  currentMode: CronAuthCoverageMode | null;
  targetMode: Exclude<CronAuthCoverageMode, "unprotected">;
  callerShape: CronAuthCallerShape;
  callerFiles: readonly string[];
  reason: string | null;
};

// Exemptions must remain rare, route-specific, and justified. An empty map means
// every active scheduled HTTP route currently has an audit-producing owner.
export const CRON_AUDIT_EXEMPTIONS: Readonly<Record<string, string>> = {};

// This destructive internal route intentionally accepts only the exact cron
// bearer. It has no browser-admin contract; update-yahoo-players is its sole
// static server caller and already forwards CRON_SECRET.
export const CRON_AUTH_DIRECT_SECRET_ROUTES: Readonly<Record<string, string>> =
  {
    "/api/internal/sync-yahoo-players-to-sheet":
      "Internal destructive sheet sync; exact cron bearer only.",
  };

// Active routes omitted from this map have no non-test static source caller
// beyond pg_cron. The manifest freezes every browser/manual or server-chain
// consumer that must be preserved before a route moves behind adminOnly.
export const CRON_AUTH_NON_CRON_CALLERS: Readonly<
  Record<string, CronAuthCallerInventory>
> = {
  "/api/Teams/nst-team-stats": {
    shape: "browser-admin",
    files: ["web/pages/db/index.tsx"],
  },
  "/api/internal/sync-yahoo-players-to-sheet": {
    shape: "internal-server",
    files: ["web/pages/api/v1/db/update-yahoo-players.ts"],
  },
  "/api/v1/db/build-projection-derived-v2": {
    shape: "internal-server",
    files: [
      "web/lib/projections/goaliePipeline.ts",
      "web/lib/rollingForgePipeline.ts",
      "web/pages/api/v1/db/run-projection-v2.ts",
      "web/pages/api/v1/db/run-rolling-forge-pipeline.ts",
    ],
  },
  "/api/v1/db/cron-report": {
    shape: "internal-server",
    files: [
      "web/lib/rollingForgePipeline.ts",
      "web/pages/api/v1/db/run-rolling-forge-pipeline.ts",
    ],
  },
  "/api/v1/db/ingest-projection-inputs": {
    shape: "internal-server",
    files: [
      "web/lib/projections/goaliePipeline.ts",
      "web/lib/rollingForgePipeline.ts",
      "web/lib/xg/backfillCoverageAudit.ts",
      "web/pages/api/v1/db/run-projection-v2.ts",
      "web/pages/api/v1/db/run-rolling-forge-pipeline.ts",
    ],
  },
  "/api/v1/db/powerPlayTimeFrame": {
    shape: "browser-admin",
    files: ["web/pages/db/index.tsx"],
  },
  "/api/v1/db/run-projection-accuracy": {
    shape: "internal-server",
    files: [
      "web/lib/projections/goaliePipeline.ts",
      "web/lib/rollingForgePipeline.ts",
      "web/pages/api/v1/db/run-rolling-forge-pipeline.ts",
    ],
  },
  "/api/v1/db/run-projection-v2": {
    shape: "internal-server",
    files: [
      "web/lib/projections/goaliePipeline.ts",
      "web/lib/rollingForgePipeline.ts",
      "web/pages/api/v1/db/run-rolling-forge-pipeline.ts",
    ],
  },
  "/api/v1/db/sustainability/rebuild-baselines": {
    shape: "internal-server",
    files: ["web/lib/sustainability/dependencyChecks.ts"],
  },
  "/api/v1/db/update-game-goal-projections": {
    shape: "browser-admin",
    files: ["web/pages/db/index.tsx"],
  },
  "/api/v1/db/update-games": {
    shape: "browser-admin-and-internal",
    files: [
      "web/lib/projections/goaliePipeline.ts",
      "web/lib/rollingForgePipeline.ts",
      "web/pages/api/v1/db/run-projection-v2.ts",
      "web/pages/api/v1/db/run-rolling-forge-pipeline.ts",
      "web/pages/db/index.tsx",
    ],
  },
  "/api/v1/db/update-goalie-projections-v2": {
    shape: "internal-server",
    files: [
      "web/lib/projections/compatibilityInventory.ts",
      "web/lib/projections/goaliePipeline.ts",
      "web/lib/rollingForgePipeline.ts",
      "web/pages/api/v1/db/run-projection-v2.ts",
      "web/pages/api/v1/db/run-rolling-forge-pipeline.ts",
      "web/pages/api/v1/db/update-lineup-source-provenance.ts",
    ],
  },
  "/api/v1/db/update-line-combinations": {
    shape: "browser-admin-and-internal",
    files: [
      "web/lib/projections/goaliePipeline.ts",
      "web/lib/rollingForgePipeline.ts",
      "web/pages/api/v1/db/run-projection-v2.ts",
      "web/pages/api/v1/db/run-rolling-forge-pipeline.ts",
      "web/pages/db/index.tsx",
    ],
  },
  "/api/v1/db/update-nst-gamelog": {
    shape: "internal-server",
    files: [
      "web/lib/rollingForgePipeline.ts",
      "web/pages/api/v1/db/run-rolling-forge-pipeline.ts",
    ],
  },
  "/api/v1/db/update-players": {
    shape: "browser-admin-and-internal",
    files: [
      "web/lib/projections/goaliePipeline.ts",
      "web/lib/rollingForgePipeline.ts",
      "web/pages/api/v1/db/run-projection-v2.ts",
      "web/pages/api/v1/db/run-rolling-forge-pipeline.ts",
      "web/pages/db/index.tsx",
    ],
  },
  "/api/v1/db/update-power-play-combinations": {
    shape: "internal-server",
    files: [
      "web/lib/rollingForgePipeline.ts",
      "web/pages/api/v1/db/run-rolling-forge-pipeline.ts",
    ],
  },
  "/api/v1/db/update-rolling-player-averages": {
    shape: "internal-server",
    files: [
      "web/lib/rankings/skaterWindowAggregation.ts",
      "web/lib/rollingForgePipeline.ts",
      "web/pages/api/v1/db/run-rolling-forge-pipeline.ts",
      "web/pages/api/v1/db/update-rolling-games.ts",
    ],
  },
  "/api/v1/db/update-seasons": {
    shape: "browser-admin",
    files: ["web/pages/db/index.tsx"],
  },
  "/api/v1/db/update-standings-details": {
    shape: "browser-admin",
    files: ["web/pages/db/index.tsx"],
  },
  "/api/v1/db/update-teams": {
    shape: "browser-admin-and-internal",
    files: [
      "web/lib/projections/goaliePipeline.ts",
      "web/lib/rollingForgePipeline.ts",
      "web/pages/api/v1/db/run-projection-v2.ts",
      "web/pages/api/v1/db/run-rolling-forge-pipeline.ts",
      "web/pages/db/index.tsx",
    ],
  },
};

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
  return (
    routeCandidates(webRoot, routePath).find((candidate) =>
      fs.existsSync(candidate),
    ) ?? null
  );
}

export function classifyCronAuditSource(
  source: string,
): CronAuditCoverageMode | null {
  if (/\bwithCronJobAudit\s*\(/.test(source)) {
    return "shared-wrapper";
  }

  if (/\.from\(\s*["']cron_job_audit["']\s*\)\s*\.insert\s*\(/.test(source)) {
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
          reason:
            "No Pages API route file resolves from the active cron inventory.",
        };
      }

      const mode = classifyCronAuditSource(fs.readFileSync(filePath, "utf8"));
      return {
        jobNames,
        routePath,
        filePath,
        mode,
        reason: mode
          ? null
          : "Route has neither withCronJobAudit nor a manual cron_job_audit insert.",
      };
    });
}

export function classifyCronAuthSource(source: string): CronAuthCoverageMode {
  if (/\badminOnly\s*\(/.test(source)) {
    return "admin-or-cron";
  }

  if (/token\s*!==\s*process\.env\.CRON_SECRET/.test(source)) {
    return "cron-secret-only";
  }

  return "unprotected";
}

export function inspectScheduledCronAuthCoverage(args: {
  scheduleMarkdown: string;
  webRoot: string;
}): CronAuthCoverageFinding[] {
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
      const filePath = resolveCronRouteFile(args.webRoot, routePath);
      const caller = CRON_AUTH_NON_CRON_CALLERS[routePath];
      const targetMode = CRON_AUTH_DIRECT_SECRET_ROUTES[routePath]
        ? "cron-secret-only"
        : "admin-or-cron";

      if (!filePath) {
        return {
          jobNames,
          routePath,
          filePath: null,
          currentMode: null,
          targetMode,
          callerShape: caller?.shape ?? "cron-only",
          callerFiles: caller?.files ?? [],
          reason:
            "No Pages API route file resolves from the active cron inventory.",
        };
      }

      const currentMode = classifyCronAuthSource(
        fs.readFileSync(filePath, "utf8"),
      );

      return {
        jobNames,
        routePath,
        filePath,
        currentMode,
        targetMode,
        callerShape: caller?.shape ?? "cron-only",
        callerFiles: caller?.files ?? [],
        reason:
          currentMode === "unprotected"
            ? "Route must remain on the explicit route-by-route auth rollout before enforcement."
            : null,
      };
    });
}
