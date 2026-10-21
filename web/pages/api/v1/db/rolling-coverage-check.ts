// Read-only coverage report: compares rolling_player_game_metrics rows per
// game date and strength against the wgo_skater_stats skater-games for that
// date, and prints the bounded repair URL an operator runs by hand for each
// shortfall. It never writes rows or calls other routes.
import type { NextApiRequest, NextApiResponse } from "next";
import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { withNhlOffSeasonSkip } from "lib/cron/nhlOffSeason";
import supabase from "lib/supabase/server";
import adminOnly from "utils/adminOnlyMiddleware";

const SUPABASE_PAGE_SIZE = 1000;
const DEFAULT_WINDOW_DAYS = 14;
const MAX_WINDOW_DAYS = 31;
const MAX_MISSING_IDS = 200;
const STRENGTHS = ["all", "ev", "pp", "pk", "5v5"] as const;

type Strength = (typeof STRENGTHS)[number];

type DateCoverage = {
  date: string;
  expected: number;
  byStrength: Record<Strength, number>;
  missing: { all: number[] };
  shortfall: boolean;
  repairUrl: string | null;
};

function todayEtDateOnly() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function addDays(date: string, delta: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + delta);
  return value.toISOString().slice(0, 10);
}

function isValidDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  );
}

async function fetchAllRows<TRow>(
  fetchPage: (from: number, to: number) => PromiseLike<{
    data: TRow[] | null;
    error: { message?: string } | null;
  }>
): Promise<TRow[]> {
  const rows: TRow[] = [];
  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + SUPABASE_PAGE_SIZE - 1);
    if (error) throw new Error(error.message ?? "Failed to fetch Supabase rows.");
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < SUPABASE_PAGE_SIZE) break;
  }
  return rows;
}

export function buildRepairUrl(date: string, expectedIds: number[], missingIds: number[]) {
  const base =
    `/api/v1/db/update-rolling-player-averages?startDate=${date}&endDate=${date}` +
    "&fastMode=true&executionProfile=daily_incremental&bypassFreshnessBlockers=true";
  const lowestMissing = missingIds[0];
  const missingSet = new Set(missingIds);
  // resumeFrom only helps when the pass stopped part-way: every expected id at
  // or above the lowest missing id must be missing.
  const isUpperTail = expectedIds
    .filter((id) => id >= lowestMissing)
    .every((id) => missingSet.has(id));
  return isUpperTail ? `${base}&resumeFrom=${lowestMissing - 1}` : base;
}

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const yesterday = addDays(todayEtDateOnly(), -1);
  const endDate =
    typeof req.query.endDate === "string" ? req.query.endDate : yesterday;
  const startDate =
    typeof req.query.startDate === "string"
      ? req.query.startDate
      : addDays(endDate, -(DEFAULT_WINDOW_DAYS - 1));
  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    return res
      .status(400)
      .json({ error: "startDate and endDate must be valid YYYY-MM-DD dates." });
  }
  if (startDate > endDate) {
    return res
      .status(400)
      .json({ error: "startDate must be on or before endDate." });
  }
  if (addDays(startDate, MAX_WINDOW_DAYS - 1) < endDate) {
    return res
      .status(400)
      .json({ error: `The date window may span at most ${MAX_WINDOW_DAYS} days.` });
  }

  try {
    const [wgoRows, rollingRows] = await Promise.all([
      fetchAllRows<{ date: string; player_id: number }>((from, to) =>
        (supabase as any)
          .from("wgo_skater_stats")
          .select("date,player_id")
          .gte("date", startDate)
          .lte("date", endDate)
          .order("date", { ascending: true })
          .order("player_id", { ascending: true })
          .range(from, to)
      ),
      fetchAllRows<{ game_date: string; strength_state: string; player_id: number }>(
        (from, to) =>
          (supabase as any)
            .from("rolling_player_game_metrics")
            .select("game_date,strength_state,player_id")
            .gte("game_date", startDate)
            .lte("game_date", endDate)
            .order("game_date", { ascending: true })
            .order("player_id", { ascending: true })
            .order("strength_state", { ascending: true })
            .range(from, to)
      )
    ]);

    const expectedByDate = new Map<string, Set<number>>();
    for (const row of wgoRows) {
      const ids = expectedByDate.get(row.date) ?? new Set<number>();
      ids.add(Number(row.player_id));
      expectedByDate.set(row.date, ids);
    }
    const presentByDate = new Map<string, Map<string, Set<number>>>();
    for (const row of rollingRows) {
      const byStrength = presentByDate.get(row.game_date) ?? new Map();
      const ids = byStrength.get(row.strength_state) ?? new Set<number>();
      ids.add(Number(row.player_id));
      byStrength.set(row.strength_state, ids);
      presentByDate.set(row.game_date, byStrength);
    }

    const allDates = Array.from(
      new Set([...expectedByDate.keys(), ...presentByDate.keys()])
    ).sort();
    const dates: DateCoverage[] = allDates.map((date) => {
      const expectedIds = Array.from(expectedByDate.get(date) ?? []).sort(
        (a, b) => a - b
      );
      const byStrengthIds = presentByDate.get(date) ?? new Map();
      const presentAll: Set<number> = byStrengthIds.get("all") ?? new Set();
      const missingIds = expectedIds.filter((id) => !presentAll.has(id));
      const byStrength = Object.fromEntries(
        STRENGTHS.map((strength) => [strength, byStrengthIds.get(strength)?.size ?? 0])
      ) as Record<Strength, number>;
      const shortfall = missingIds.length > 0;
      return {
        date,
        expected: expectedIds.length,
        byStrength,
        missing: { all: missingIds.slice(0, MAX_MISSING_IDS) },
        shortfall,
        repairUrl: shortfall ? buildRepairUrl(date, expectedIds, missingIds) : null
      };
    });

    return res.status(200).json({
      startDate,
      endDate,
      dates,
      shortfallDates: dates.filter((entry) => entry.shortfall).length,
      note:
        "Read-only. expected = wgo_skater_stats skater-games per date; missing lists " +
        `expected ids absent from the 'all' strength (at most ${MAX_MISSING_IDS}). ` +
        "Run each repairUrl by hand to fill a shortfall."
    });
  } catch (error: any) {
    return res
      .status(500)
      .json({ error: error?.message ?? "Rolling coverage check failed." });
  }
};

export default withCronJobAudit(adminOnly(withNhlOffSeasonSkip(handler as any)));
