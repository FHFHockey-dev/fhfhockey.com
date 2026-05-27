// rebuild-priors.ts
import { NextApiRequest, NextApiResponse } from "next";
import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { normalizeDependencyError } from "lib/cron/normalizeDependencyError";
import { CronTimedResponse, withCronJobTiming } from "lib/cron/timingContract";
// import supabase from "lib/supabase"; // <- remove
import {
  ensureTables,
  upsertLeaguePriors,
  upsertPlayerPosteriors,
  PosGroup,
  StatCode
} from "lib/sustainability/priors";
import { resolveSeasonId } from "lib/sustainability/resolveSeasonId";
import {
  assertPriorsPrerequisites,
  isSustainabilityDependencyError
} from "lib/sustainability/dependencyChecks";

function parseBoundedInt(value: string | string[] | undefined, fallback: number, max: number) {
  const candidate = Array.isArray(value) ? value[0] : value;
  const parsed = Number(candidate);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(max, Math.floor(parsed)));
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CronTimedResponse<Record<string, unknown>>>
) {
  const started = Date.now();
  const withTiming = (body: Record<string, unknown>, endedAt = Date.now()) =>
    withCronJobTiming(body, started, endedAt);
  try {
    const season = await resolveSeasonId(req.query.season);
    await assertPriorsPrerequisites(season);
    const dry =
      req.query.dry === "1" ||
      req.query.dry === "true" ||
      req.query.dry === "yes";

    const k = {
      shp: Number(req.query.k_shp) || 200,
      oishp: Number(req.query.k_oishp) || 800,
      ipp: Number(req.query.k_ipp) || 60
    };
    const offset = parseBoundedInt(req.query.offset, 0, 100_000);
    const limit = Math.max(1, parseBoundedInt(req.query.limit, 500, 2_000));

    if (!dry) await ensureTables(); // (still a no-op unless you hook it up)

    // build priors either in DB (write) or in-memory (dry)
    const posGroups: PosGroup[] = ["F", "D"];
    const priorRows: Array<{
      season_id: number;
      position_group: PosGroup;
      stat_code: StatCode;
      k: number;
      league_mu: number;
      alpha0: number;
      beta0: number;
    }> = [];

    for (const pg of posGroups) {
      const rows = await upsertLeaguePriors(season, pg, k, { dry });
      priorRows.push(...rows);
    }

    // create a map for dry mode so we don’t need to read from DB
    const dryPriorMap = dry
      ? new Map(
          priorRows.map((r) => [
            `${r.position_group}|${r.stat_code}`,
            { alpha0: r.alpha0, beta0: r.beta0 }
          ])
        )
      : undefined;

    const { inserted, sample } = await upsertPlayerPosteriors(
      season,
      k,
      dry,
      dryPriorMap,
      { offset, limit }
    );

    const duration_s = ((Date.now() - started) / 1000).toFixed(2);
    return res
      .status(200)
      .json(withTiming({
        success: true,
        season,
        dry,
        offset,
        limit,
        k,
        inserted_player_rows: inserted,
        sample,
        duration_s
      }));
  } catch (error: any) {
    if (isSustainabilityDependencyError(error)) {
      return res.status(error.statusCode).json(
        withTiming({
          success: false,
          message: error.issue.message,
          prerequisite: error.issue,
          dependencyError: {
            kind: "dependency_error",
            source: "unknown",
            classification: "structured_upstream_error",
            message: error.issue.message,
            detail: error.issue.detail,
            htmlLike: false
          }
        })
      );
    }
    const dependencyError = normalizeDependencyError(error);
    console.error("rebuild-priors error", error?.message || error);
    return res
      .status(500)
      .json(withTiming({
        success: false,
        message: dependencyError.message,
        dependencyError
      }));
  }
}

export default withCronJobAudit(handler, {
  jobName: "rebuild-sustainability-priors"
});
