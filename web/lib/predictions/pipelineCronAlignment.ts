import type { CronInventoryJob } from "lib/cron/cronInventory";
import type {
  RollingForgePipelineStage,
  RollingForgePipelineStageId,
} from "lib/rollingForgePipeline";

export type PipelineCronStageSchedule = {
  stageId: RollingForgePipelineStageId;
  order: number;
  scheduledRoutes: Array<{
    route: string;
    jobName: string;
    slotIndex: number;
    scheduleTimeDisplay: string;
  }>;
  missingRoutes: string[];
};

export type PipelineCronOrderViolation = {
  stageId: RollingForgePipelineStageId;
  dependsOn: RollingForgePipelineStageId;
  dependencyLatestSlot: number;
  stageEarliestSlot: number;
  message: string;
};

export type PipelineCronAlignmentReport = {
  stages: PipelineCronStageSchedule[];
  missingRouteCount: number;
  orderViolations: PipelineCronOrderViolation[];
};

function normalizeRoute(route: string): string {
  return route.split("?")[0] ?? route;
}

function jobsForRoute(jobs: CronInventoryJob[], route: string): CronInventoryJob[] {
  const normalizedRoute = normalizeRoute(route);
  return jobs.filter((job) => job.routePath === normalizedRoute || normalizeRoute(job.route ?? "") === normalizedRoute);
}

export function buildPipelineCronAlignmentReport(args: {
  stages: RollingForgePipelineStage[];
  jobs: CronInventoryJob[];
}): PipelineCronAlignmentReport {
  const stages = args.stages.map((stage): PipelineCronStageSchedule => {
    const scheduledRoutes = stage.routes.flatMap((route) =>
      jobsForRoute(args.jobs, route).map((job) => ({
        route,
        jobName: job.name,
        slotIndex: job.slotIndex,
        scheduleTimeDisplay: job.scheduleTimeDisplay,
      })),
    );
    const scheduledRouteSet = new Set(scheduledRoutes.map((row) => row.route));

    return {
      stageId: stage.id,
      order: stage.order,
      scheduledRoutes,
      missingRoutes: stage.routes.filter((route) => !scheduledRouteSet.has(route)),
    };
  });

  const byStage = new Map(stages.map((stage) => [stage.stageId, stage]));
  const orderViolations: PipelineCronOrderViolation[] = [];

  for (const stage of args.stages) {
    const scheduled = byStage.get(stage.id);
    if (!scheduled || scheduled.scheduledRoutes.length === 0) continue;
    const stageEarliestSlot = Math.min(...scheduled.scheduledRoutes.map((route) => route.slotIndex));
    const stageLatestSlot = Math.max(...scheduled.scheduledRoutes.map((route) => route.slotIndex));

    for (const dependencyId of stage.depends_on) {
      const dependency = byStage.get(dependencyId);
      if (!dependency || dependency.scheduledRoutes.length === 0) continue;
      const dependencyLatestSlot = Math.max(
        ...dependency.scheduledRoutes.map((route) => route.slotIndex),
      );

      if (dependencyLatestSlot > stageLatestSlot) {
        orderViolations.push({
          stageId: stage.id,
          dependsOn: dependencyId,
          dependencyLatestSlot,
          stageEarliestSlot,
          message: `${stage.id} is scheduled before dependency ${dependencyId} completes.`,
        });
      }
    }
  }

  return {
    stages,
    missingRouteCount: stages.reduce((sum, stage) => sum + stage.missingRoutes.length, 0),
    orderViolations,
  };
}
