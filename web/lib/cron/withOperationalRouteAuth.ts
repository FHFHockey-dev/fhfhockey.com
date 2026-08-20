import type { NextApiRequest, NextApiResponse } from "next";

import adminOnly from "utils/adminOnlyMiddleware";

import { withCronJobAudit } from "./withCronJobAudit";

type OperationalHandler = (
  req: NextApiRequest,
  res: NextApiResponse,
) => unknown | Promise<unknown>;

export type OperationalRouteOptions = {
  methods: readonly string[];
  audit?:
    | false
    | {
        jobName?: string;
        includeFinalAuditReceipt?: boolean;
        recordRowMetrics?: boolean;
      };
  defaultDryRun?: boolean;
};

export const operationalRouteContracts = {
  auditNhlXgBackfill: {
    methods: ["GET"],
    audit: { jobName: "audit-nhl-xg-backfill" },
  },
  checkMissingGoalieData: {
    methods: ["POST"],
    audit: { jobName: "check-missing-goalie-data" },
  },
  updateGoalieStarterMixtures: {
    methods: ["POST"],
    defaultDryRun: true,
    audit: { jobName: "update-goalie-starter-mixtures" },
  },
  updateLast71430: {
    methods: ["POST"],
    audit: { jobName: "update-last-7-14-30" },
  },
  updateNhlXgAdjustedImpact: {
    methods: ["POST"],
    defaultDryRun: true,
    audit: { jobName: "update-nhl-xg-adjusted-impact" },
  },
  updateNhlXgCreatedXg: {
    methods: ["POST"],
    defaultDryRun: true,
    audit: { jobName: "update-nhl-xg-created-xg" },
  },
  updateNhlXgQotQoc: {
    methods: ["POST"],
    defaultDryRun: true,
    audit: { jobName: "update-nhl-xg-qot-qoc" },
  },
  updateNhlXgReboundControl: {
    methods: ["POST"],
    defaultDryRun: true,
    audit: { jobName: "update-nhl-xg-rebound-control" },
  },
  updateNhlXgShotAssists: {
    methods: ["POST"],
    defaultDryRun: true,
    audit: { jobName: "update-nhl-xg-shot-assists" },
  },
  updateNhlXgShotFeatures: {
    methods: ["POST"],
    audit: { jobName: "update-nhl-xg-shot-features" },
  },
  updateNhlXgTransitions: {
    methods: ["POST"],
    defaultDryRun: true,
    audit: { jobName: "update-nhl-xg-transitions" },
  },
  updateNhlXgTravelFatigue: {
    methods: ["POST"],
    defaultDryRun: true,
    audit: { jobName: "update-nhl-xg-travel-fatigue" },
  },
  updateNstLastTen: {
    methods: ["POST"],
    audit: { jobName: "update-nst-last-ten" },
  },
  updateNstPlayerReports: {
    methods: ["POST"],
    audit: { jobName: "update-nst-player-reports" },
  },
  updateNhlPptReplayTracking: {
    methods: ["POST"],
    defaultDryRun: true,
    audit: false,
  },
} as const satisfies Record<string, OperationalRouteOptions>;

/**
 * Applies the shared operational-route contract in security-sensitive order:
 * authentication, method enforcement/defaults, handler work, then audit.
 */
export function withOperationalRouteAuth(
  handler: OperationalHandler,
  options: OperationalRouteOptions,
) {
  const allowedMethods = options.methods.map((method) => method.toUpperCase());
  const auditedHandler =
    options.audit === false
      ? handler
      : withCronJobAudit(handler, options.audit);

  const methodBoundHandler: OperationalHandler = async (req, res) => {
    const method = req.method?.toUpperCase() ?? "";
    if (!allowedMethods.includes(method)) {
      res.setHeader("Allow", allowedMethods);
      return res.status(405).json({
        success: false,
        error: `Method ${req.method ?? "UNKNOWN"} Not Allowed`,
      });
    }

    if (options.defaultDryRun && req.query.dryRun == null) {
      req.query = { ...req.query, dryRun: "true" };
    }

    return auditedHandler(req, res);
  };

  // adminOnly is intentionally outermost so rejected requests cannot invoke
  // either the route handler or withCronJobAudit's service-role insert.
  return adminOnly(methodBoundHandler as any);
}
