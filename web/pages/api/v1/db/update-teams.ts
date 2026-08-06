// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\pages\api\v1\db\update-teams.ts

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { isRealUtcDateOnly } from "lib/dashboard/forgeLinks";
import { get } from "lib/NHL/base";
import { getCurrentSeason, isValidNhlSeasonId } from "lib/NHL/server";
import { teamsInfo } from "lib/teamsInfo";
import adminOnly from "utils/adminOnlyMiddleware";

type ValidatedScheduleTeam = {
  id: number;
  abbreviation: string;
  name: string;
};

function parsePositiveSafeInteger(value: unknown, label: string): number {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    throw new Error(`${label} must be a positive integer.`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${label} must be a positive safe integer.`);
  }

  return parsed;
}

function parseSeasonId(value: unknown): number {
  const seasonId = parsePositiveSafeInteger(value, "seasonId");
  if (!isValidNhlSeasonId(seasonId)) {
    throw new Error("seasonId must be a consecutive eight-digit NHL season.");
  }

  return seasonId;
}

function parseForcedTeamIds(value: unknown): number[] {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("forceTeamIds must be a comma-separated list of team IDs.");
  }

  const ids = value
    .split(",")
    .map((part, index) =>
      parsePositiveSafeInteger(part.trim(), `forceTeamIds[${index}]`),
    );
  if (new Set(ids).size !== ids.length) {
    throw new Error("forceTeamIds must not contain duplicate team IDs.");
  }

  return ids;
}

function validateScheduleCalendar(
  value: unknown,
  expectedDate: string,
): ValidatedScheduleTeam[] {
  if (
    typeof value !== "object" ||
    value === null ||
    (value as { startDate?: unknown }).startDate !== expectedDate
  ) {
    throw new Error(
      "Schedule calendar did not match the requested season start date.",
    );
  }

  const teams = (value as { teams?: unknown }).teams;
  if (!Array.isArray(teams) || teams.length === 0) {
    throw new Error("Schedule calendar returned no teams.");
  }

  const seenIds = new Set<number>();
  return teams.map((team, index) => {
    if (typeof team !== "object" || team === null) {
      throw new Error(`Schedule calendar team ${index} is malformed.`);
    }

    const candidate = team as {
      id?: unknown;
      abbrev?: unknown;
      name?: { default?: unknown } | null;
    };
    if (
      typeof candidate.id !== "number" ||
      !Number.isSafeInteger(candidate.id) ||
      candidate.id <= 0
    ) {
      throw new Error(`Schedule calendar team ${index} has an invalid ID.`);
    }
    if (seenIds.has(candidate.id)) {
      throw new Error("Schedule calendar returned duplicate team IDs.");
    }

    const abbreviation =
      typeof candidate.abbrev === "string" ? candidate.abbrev.trim() : "";
    const name =
      typeof candidate.name?.default === "string"
        ? candidate.name.default.trim()
        : "";
    if (!/^[A-Z]{2,4}$/.test(abbreviation) || name.length === 0) {
      throw new Error(
        `Schedule calendar team ${candidate.id} is missing identity fields.`,
      );
    }

    seenIds.add(candidate.id);
    return { id: candidate.id, abbreviation, name };
  });
}

function validateExactCurrentTeamCatalog(
  teams: readonly ValidatedScheduleTeam[],
): void {
  const expectedTeams = Object.values(teamsInfo);
  const expectedById = new Map(
    expectedTeams.map((team) => [team.id, team.abbrev] as const),
  );

  if (
    expectedById.size !== expectedTeams.length ||
    teams.length !== expectedTeams.length ||
    teams.some((team) => expectedById.get(team.id) !== team.abbreviation)
  ) {
    throw new Error(
      "Current schedule calendar does not match the canonical active team catalog.",
    );
  }
}

export default withCronJobAudit(
  adminOnly(async function handler(req, res) {
    try {
      const { supabase } = req;
      const hasExplicitSeason = req.query.seasonId !== undefined;
      const hasForcedTeamIds = req.query.forceTeamIds !== undefined;

      // Parse every caller-controlled override before any database or NHL work.
      const explicitSeasonId = hasExplicitSeason
        ? parseSeasonId(req.query.seasonId)
        : null;
      const forcedTeamIds = hasForcedTeamIds
        ? parseForcedTeamIds(req.query.forceTeamIds)
        : [];

      const currentSeason = hasExplicitSeason ? null : await getCurrentSeason();
      const seasonId = hasExplicitSeason
        ? explicitSeasonId
        : currentSeason?.seasonId;
      if (typeof seasonId !== "number" || !isValidNhlSeasonId(seasonId)) {
        return res.status(400).json({
          message:
            "Invalid or missing seasonId. Provide ?seasonId=YYYYYYYY or run 'Update Seasons' first.",
          success: false,
        });
      }

      // Resolve both the season identity and its own calendar anchor. Historical
      // requests must never be populated from today's schedule calendar.
      const { data: seasonRow, error: seasonLookupErr } = await supabase
        .from("seasons")
        .select("id,startDate")
        .eq("id", seasonId)
        .single();
      if (
        seasonLookupErr ||
        !seasonRow ||
        seasonRow.id !== seasonId ||
        !isRealUtcDateOnly(seasonRow.startDate)
      ) {
        return res.status(400).json({
          message: `Season ${seasonId} not found in 'seasons' or has an invalid start date. Run the 'Seasons' update first or pass a valid seasonId.`,
          success: false,
        });
      }

      const calendar = await get(`/schedule-calendar/${seasonRow.startDate}`);
      const teams = validateScheduleCalendar(calendar, seasonRow.startDate);
      const ownsExactCurrentSet = !hasExplicitSeason && !hasForcedTeamIds;
      if (ownsExactCurrentSet) {
        validateExactCurrentTeamCatalog(teams);
      }
      const scheduleTeamIds = new Set(teams.map((team) => team.id));
      const targetTeamIds = new Set([...scheduleTeamIds, ...forcedTeamIds]);

      // Inventory the current exact set before writing. If this read fails, the
      // implicit destructive owner remains zero-mutation and can be retried.
      let existingSeasonRows: Array<{ teamId: number }> = [];
      if (ownsExactCurrentSet) {
        const { data, error: fetchSeasonRowsError } = await supabase
          .from("team_season")
          .select("teamId")
          .eq("seasonId", seasonId);
        if (fetchSeasonRowsError) throw fetchSeasonRowsError;
        existingSeasonRows = data || [];
      }

      const { error: teamsError } = await supabase.from("teams").upsert(
        teams.map((team) => ({
          id: team.id,
          name: team.name,
          abbreviation: team.abbreviation,
        })),
      );
      if (teamsError) throw teamsError;

      const { error: teamSeasonError } = await supabase
        .from("team_season")
        .upsert([...targetTeamIds].map((teamId) => ({ teamId, seasonId })));
      if (teamSeasonError) throw teamSeasonError;

      // Only the default current-season refresh owns exact-set reconciliation.
      // Historical and forced requests are intentionally additive so a bounded
      // repair cannot erase valid season membership.
      if (ownsExactCurrentSet) {
        const toDelete = existingSeasonRows
          .map((row: { teamId: number }) => row.teamId)
          .filter((teamId: number) => !scheduleTeamIds.has(teamId));
        if (toDelete.length > 0) {
          const { error: deleteError } = await supabase
            .from("team_season")
            .delete()
            .eq("seasonId", seasonId)
            .in("teamId", toDelete);
          if (deleteError) throw deleteError;
        }
      }

      return res.status(200).json({
        message:
          "successfully updated the teams table " +
          "num teams: " +
          targetTeamIds.size,
        success: true,
      });
    } catch (error: any) {
      return res.status(400).json({ message: error.message, success: false });
    }
  }),
);
