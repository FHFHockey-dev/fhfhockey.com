import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { nhlCalendarDate, withNhlOffSeasonSkip } from "lib/cron/nhlOffSeason";
import adminOnly from "utils/adminOnlyMiddleware";
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fetchCurrentSeason } from "utils/fetchCurrentSeason";
import { teamsInfo } from "lib/teamsInfo";
import { DESCRIPTIVE_SOS_VERSION } from "lib/trends/strengthOfScheduleContract";
import {
  adaptClubSchedules,
  buildTeamSosSnapshotRows,
  snapshotCutoff,
  TEAM_SOS_PAST_VIEW,
  TEAM_SOS_TABLE,
  type ObservedClubSchedule
} from "lib/trends/teamSosSnapshot";

dotenv.config({ path: "./../../../.env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase credentials for SOS updater.");
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);
// descriptive-sos-v2 rows go to TEAM_SOS_TABLE. v1 rows in `sos_standings`
// are issued history (rule 21): this writer no longer touches them.

async function fetchJson<T>(
  url: string,
  retries = 4,
  backoffMs = 500
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url);
    if (res.ok) {
      return (await res.json()) as T;
    }

    // NHL API sometimes rate limits by returning 429; back off and retry.
    if (res.status === 429 && attempt < retries) {
      const wait = backoffMs * 2 ** attempt;
      console.warn(
        `[SOS] 429 for ${url} (attempt ${attempt + 1}/${
          retries + 1
        }) – retrying in ${wait}ms`
      );
      await sleep(wait);
      continue;
    }

    let body = "";
    try {
      body = await res.text();
    } catch (_) {}
    throw new Error(
      `Fetch failed ${res.status} ${res.statusText} for ${url}${
        body ? ` – ${body.slice(0, 200)}` : ""
      }`
    );
  }

  // Should never get here
  throw new Error(`Fetch exhausted for ${url}`);
}

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function fetchTeamSchedule(
  abbrev: string,
  seasonId: number
): Promise<ObservedClubSchedule> {
  const url = `https://api-web.nhle.com/v1/club-schedule-season/${abbrev}/${seasonId}`;
  const data = await fetchJson<{ games?: unknown }>(url);
  return { team: abbrev, observedAt: new Date().toISOString(), games: data.games ?? [] };
}

/**
 * descriptive-sos-v2 (decision 21): one snapshot per run, as of the run's
 * cutoff. "Past" counts only fixtures with a final result observed before the
 * cutoff; started, unfinished or postponed fixtures are stored as pending;
 * opponents' records exclude games against the team. NHL usage: the 32 club
 * schedules only (v1 also fetched one standings page per date).
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ message: "Method not allowed" });
  }
  if (req.query.start !== undefined) {
    return res.status(400).json({
      success: false,
      message:
        "descriptive-sos-v2 computes the current cutoff only. NHL schedules carry no result-known times, so historical dates cannot be rebuilt; v1 sos_standings rows stay as issued history."
    });
  }

  try {
    const season = await fetchCurrentSeason();
    const teams = Object.entries(teamsInfo).map(([abbrev, info]) => ({
      abbrev,
      id: info.id
    }));

    const schedules = await Promise.all(
      teams.map(({ abbrev }) => fetchTeamSchedule(abbrev, season.id))
    );
    const adapted = adaptClubSchedules({ seasonId: season.id, schedules });
    const cutoff = snapshotCutoff(adapted, Date.now());
    const snapshotDate = nhlCalendarDate(new Date(cutoff));
    const rows = buildTeamSosSnapshotRows({
      seasonId: season.id,
      snapshotDate,
      cutoff,
      teams,
      adapted,
      schedulesFetched: schedules.length
    });

    const { error: upsertError } = await supabase
      .from(TEAM_SOS_TABLE)
      .upsert(rows, {
        onConflict: "season_id,snapshot_date,team_id,sos_version"
      });
    if (upsertError) throw upsertError;

    return res.status(200).json({
      success: true,
      message: "SOS updated",
      sosVersion: DESCRIPTIVE_SOS_VERSION,
      pastView: TEAM_SOS_PAST_VIEW,
      snapshotDate,
      cutoff,
      nhlRequests: schedules.length,
      issues: adapted.issues,
      rows: rows.length,
      rowsUpserted: rows.length,
      failedRows: 0
    });
  } catch (error: any) {
    console.error("update-team-sos error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to compute SOS.",
      error: error?.message ?? "Unknown error"
    });
  }
}

export default adminOnly(withCronJobAudit(withNhlOffSeasonSkip(handler as any)));
