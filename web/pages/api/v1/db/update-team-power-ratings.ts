import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { withNhlOffSeasonSkip } from "lib/cron/nhlOffSeason";
import type { NextApiRequest, NextApiResponse } from "next";
import adminOnly from "utils/adminOnlyMiddleware";
import supabase from "lib/supabase/server";
import { fetchCurrentSeason } from "../../../../utils/fetchCurrentSeason";
import {
  fetchGameLogs,
  fetchAllRatings,
  buildGenuineTeamGames,
  computeDailyPowerRatings,
  computeSpecialTeamsTiers,
} from "../../../../lib/power-ratings";
import { fetchUnderlyingStatsTeamSpecialTeamsContext } from "../../../../lib/underlying-stats/teamSpecialTeamsContext";
import {
  TEAM_RATINGS_TREND_LOOKBACK_DAYS,
  deriveTrendOverridesFromLogs,
} from "../../../../lib/teamRatingsTrend";

/**
 * v3 (L12, 2026-11-12): genuine all-situation games, all teams standardised
 * against one daily baseline as of their latest game, prior after normalisation
 * (decision 19), pooled season-to-date PP/PK tiers with unknown = null (decision 20).
 */
export const TEAM_POWER_RATING_CALCULATION_VERSION =
  "team-power-v3-all-team-baseline-prior-after-norm-pooled-st";
const LEGACY_TEAM_POWER_RATING_VERSION = "legacy_unversioned";

function parseBooleanFlag(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function getRequestValue(req: NextApiRequest, key: string): unknown {
  if (req.method === "GET") {
    const raw = req.query[key];
    return Array.isArray(raw) ? raw[0] : raw;
  }
  return req.body?.[key];
}

function getRequestFlag(req: NextApiRequest, key: string): boolean {
  return parseBooleanFlag(getRequestValue(req, key));
}

function parseDateParam(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return value.trim().slice(0, 10);
}

function isValidIsoDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime())
  );
}

function previousIsoDate(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", ["POST", "GET"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rawDateParam = getRequestValue(req, "date");
  const rawStartDateParam = getRequestValue(req, "startDate");
  const rawEndDateParam = getRequestValue(req, "endDate");
  const parsedDateParam = parseDateParam(rawDateParam);
  const parsedStartDateParam = parseDateParam(rawStartDateParam);
  const parsedEndDateParam = parseDateParam(rawEndDateParam);

  if (
    (rawDateParam != null &&
      (!parsedDateParam || !isValidIsoDate(parsedDateParam))) ||
    (rawStartDateParam != null &&
      (!parsedStartDateParam || !isValidIsoDate(parsedStartDateParam))) ||
    (rawEndDateParam != null &&
      (!parsedEndDateParam || !isValidIsoDate(parsedEndDateParam)))
  ) {
    return res.status(400).json({ error: "Invalid date parameter" });
  }

  const targetDateParam =
    parsedEndDateParam ??
    parsedDateParam ??
    new Date().toISOString().slice(0, 10);
  const explicitStartDate = parsedStartDateParam;
  const isDefaultScheduledWindow =
    rawDateParam == null &&
    rawStartDateParam == null &&
    rawEndDateParam == null;

  if (explicitStartDate && explicitStartDate > targetDateParam) {
    return res.status(400).json({ error: "Invalid startDate/endDate range" });
  }

  const smokeTestMode = getRequestFlag(req, "smokeTest");

  try {
    // Check if table is empty to decide if we need to backfill
    const { count } = await supabase
      .from("team_power_ratings_daily")
      .select("*", { count: "exact", head: true });

    let startDateStr = explicitStartDate ?? targetDateParam;
    const tableWasEmpty = count === 0;
    const explicitRangeApplied = Boolean(explicitStartDate);
    const autoBackfillApplied =
      !explicitRangeApplied && tableWasEmpty && !smokeTestMode;
    let lateArrivalRepairApplied = false;
    if (autoBackfillApplied) {
      console.log("Table is empty. Fetching season start date...");
      const season = await fetchCurrentSeason();
      startDateStr = season.startDate;
      console.log(`Backfilling from season start: ${startDateStr}`);
    } else if (tableWasEmpty && smokeTestMode) {
      console.log(
        `Smoke-test mode enabled; skipping empty-table backfill and probing only ${targetDateParam}.`,
      );
    } else if (explicitRangeApplied) {
      console.log(
        `Explicit rating refresh range requested: ${startDateStr} -> ${targetDateParam}.`,
      );
    } else if (isDefaultScheduledWindow && !smokeTestMode) {
      startDateStr = previousIsoDate(targetDateParam);
      lateArrivalRepairApplied = true;
      console.log(
        `Scheduled late-arrival repair window: ${startDateStr} -> ${targetDateParam}.`,
      );
    }

    const startDate = new Date(`${startDateStr}T00:00:00.000Z`);
    const endDate = new Date(`${targetDateParam}T00:00:00.000Z`);
    const executionWindowDays =
      Math.floor(
        (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000),
      ) + 1;
    let processedCount = 0;
    let totalUpserts = 0;

    // Loop through each day from startDate to endDate
    for (
      let d = new Date(startDate);
      d <= endDate;
      d.setDate(d.getDate() + 1)
    ) {
      const targetDate = d.toISOString().slice(0, 10);
      console.log(`Processing ${targetDate}...`);

      // Use the shared trend lookback so off-season dates still retain the last
      // played-game snapshots instead of propagating zero after day 90.
      const logEndDate = targetDate;
      const logStartDateObj = new Date(`${logEndDate}T00:00:00.000Z`);
      logStartDateObj.setUTCDate(
        logStartDateObj.getUTCDate() - TEAM_RATINGS_TREND_LOOKBACK_DAYS,
      );
      const logStartDate = logStartDateObj.toISOString().slice(0, 10);

      const logs = await fetchGameLogs(supabase, logStartDate, logEndDate);
      const trendOverrides = deriveTrendOverridesFromLogs(logs, targetDate);

      // Every team with a genuine game in the window is rated as of its latest
      // game against one all-team baseline (W1 P0 #12); the night's slate
      // cannot move anyone's rating.
      const dailyRatings = computeDailyPowerRatings(
        buildGenuineTeamGames(logs),
        targetDate,
      );
      if (dailyRatings.size === 0) {
        console.log(`No games found for ${targetDate}.`);
      }

      // Stored rows only fill teams with no game in the window (offseason).
      const trendStartDate = new Date(targetDate);
      trendStartDate.setDate(trendStartDate.getDate() - 60);

      const latestRatings = await fetchAllRatings(
        supabase,
        "team_power_ratings_daily",
        targetDate,
        trendStartDate.toISOString().slice(0, 10),
      );

      const latestMap = new Map<string, any>();
      latestRatings?.forEach((r) => {
        if (r.team_abbreviation) {
          if (!latestMap.has(r.team_abbreviation)) {
            latestMap.set(r.team_abbreviation, r);
          }
        }
      });

      // PP/PK tiers from pooled season-to-date opportunities and results
      // (decision 20, W1 P0 #13); an unknown team has no tier.
      const specialTeamsTiers = computeSpecialTeamsTiers(
        await fetchUnderlyingStatsTeamSpecialTeamsContext(targetDate, supabase),
      );

      const allTeams = new Set<string>([
        ...Array.from(dailyRatings.keys()),
        ...Array.from(latestMap.keys()),
      ]);

      const upserts: any[] = [];
      for (const team of allTeams) {
        const calculated = dailyRatings.get(team);
        const trend10 =
          trendOverrides.get(team) ?? Number(latestMap.get(team)?.trend10 ?? 0);

        const tiers = specialTeamsTiers.get(team);
        const ppTier = tiers?.ppTier ?? null;
        const pkTier = tiers?.pkTier ?? null;

        if (calculated) {
          upserts.push({
            ...calculated.rating,
            calculation_version: TEAM_POWER_RATING_CALCULATION_VERSION,
            source_through_date: calculated.sourceThroughDate,
            trend10,
            pp_tier: ppTier,
            pk_tier: pkTier,
          });
        } else {
          const latest = latestMap.get(team);
          if (latest) {
            upserts.push({
              team_abbreviation: team,
              date: targetDate,
              calculation_version:
                latest.calculation_version ?? LEGACY_TEAM_POWER_RATING_VERSION,
              source_through_date:
                latest.source_through_date ?? latest.date ?? null,
              off_rating: latest.off_rating,
              def_rating: latest.def_rating,
              pace_rating: latest.pace_rating,
              xgf60: latest.xgf60,
              gf60: latest.gf60,
              sf60: latest.sf60,
              xga60: latest.xga60,
              ga60: latest.ga60,
              sa60: latest.sa60,
              pace60: latest.pace60,
              finishing_rating: latest.finishing_rating,
              goalie_rating: latest.goalie_rating,
              danger_rating: latest.danger_rating,
              special_rating: latest.special_rating,
              discipline_rating: latest.discipline_rating,
              variance_flag: latest.variance_flag,
              trend10,
              pp_tier: ppTier,
              pk_tier: pkTier,
            });
          }
        }
      }

      // Upsert
      if (upserts.length > 0) {
        const { error } = await supabase
          .from("team_power_ratings_daily" as any)
          .upsert(upserts, { onConflict: "team_abbreviation, date" });

        if (error) throw error;
        totalUpserts += upserts.length;
      }
      processedCount++;
    }

    return res.status(200).json({
      message: "Updated ratings",
      startDate: startDateStr,
      endDate: targetDateParam,
      processedDays: processedCount,
      totalUpserts,
      calculationVersion: TEAM_POWER_RATING_CALCULATION_VERSION,
      executionScope: {
        requestedDate: targetDateParam,
        requestedStartDate: explicitStartDate,
        requestedEndDate: targetDateParam,
        startDate: startDateStr,
        endDate: targetDateParam,
        windowDays: executionWindowDays,
        tableWasEmpty,
        smokeTestMode,
        autoBackfillApplied,
        lateArrivalRepairApplied,
        explicitRangeApplied,
        smokeTestComparable: executionWindowDays === 1,
        smokeTestGuidance:
          executionWindowDays === 1
            ? null
            : "This run expanded beyond a one-day smoke test. Pass smokeTest=true with a target date to force a bounded one-day operational probe when the table is empty.",
      },
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}

export default adminOnly(withCronJobAudit(withNhlOffSeasonSkip(handler as any)));
