import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import {
  buildTeamStatusDirectory,
  detectReturningStatusRows,
  fetchBellMediaInjuries,
  fetchCurrentPlayerStatusRows,
  normalizeBellMediaInjuryRows,
  toInjurySourceProvenanceRows,
  type RosterStatusEntry
} from "lib/sources/injuryStatusIngestion";
import adminOnly from "utils/adminOnlyMiddleware";

function parseRequestedDate(value: string | string[] | undefined): string {
  const rawValue = Array.isArray(value) ? value[0] : value;
  if (typeof rawValue === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
    return rawValue;
  }
  return new Date().toISOString().slice(0, 10);
}

type ScheduledGameRow = {
  id: number;
  date: string;
  homeTeamId: number;
  awayTeamId: number;
};

async function fetchRosterByTeam(args: {
  supabase: any;
}): Promise<Map<number, RosterStatusEntry[]>> {
  const { data, error } = await args.supabase
    .from("players")
    .select("id, fullName, lastName, team_id")
    .not("team_id", "is", null);

  if (error) throw error;

  const result = new Map<number, RosterStatusEntry[]>();
  for (const row of data ?? []) {
    const teamId = Number((row as any).team_id);
    if (!Number.isFinite(teamId)) continue;
    if (!result.has(teamId)) {
      result.set(teamId, []);
    }
    result.get(teamId)?.push({
      playerId: Number((row as any).id),
      fullName: String((row as any).fullName ?? ""),
      lastName: String((row as any).lastName ?? ""),
      teamId
    });
  }

  return result;
}

async function fetchNearestScheduledGameIdsByTeam(args: {
  supabase: any;
  snapshotDate: string;
  teamIds: number[];
}): Promise<Map<number, number>> {
  const remainingTeamIds = new Set(args.teamIds.filter((teamId) => Number.isFinite(teamId)));
  const result = new Map<number, number>();

  const collectFromGames = (games: ScheduledGameRow[]) => {
    for (const game of games) {
      for (const teamId of [game.homeTeamId, game.awayTeamId]) {
        if (remainingTeamIds.has(teamId) && !result.has(teamId)) {
          result.set(teamId, game.id);
          remainingTeamIds.delete(teamId);
        }
      }
      if (remainingTeamIds.size === 0) break;
    }
  };

  const selectClause = "id, date, homeTeamId, awayTeamId";
  const { data: upcomingGames, error: upcomingError } = await args.supabase
    .from("games")
    .select(selectClause)
    .gte("date", args.snapshotDate)
    .order("date", { ascending: true })
    .order("id", { ascending: true })
    .limit(500);

  if (upcomingError) throw upcomingError;
  collectFromGames((upcomingGames ?? []) as ScheduledGameRow[]);

  if (remainingTeamIds.size === 0) {
    return result;
  }

  const { data: pastGames, error: pastError } = await args.supabase
    .from("games")
    .select(selectClause)
    .lt("date", args.snapshotDate)
    .order("date", { ascending: false })
    .order("id", { ascending: false })
    .limit(500);

  if (pastError) throw pastError;
  collectFromGames((pastGames ?? []) as ScheduledGameRow[]);

  return result;
}

export default withCronJobAudit(
  adminOnly(async (req, res) => {
    try {
      const snapshotDate = parseRequestedDate(req.query.date);
      const observedAt = new Date().toISOString();
      const rosterByTeam = await fetchRosterByTeam({ supabase: req.supabase });
      const rawTeams = await fetchBellMediaInjuries();
      const currentInjuredRows = normalizeBellMediaInjuryRows({
        rawTeams,
        snapshotDate,
        observedAt,
        directory: buildTeamStatusDirectory(),
        rosterByTeam
      });
      const latestStatuses = await fetchCurrentPlayerStatusRows({ supabase: req.supabase });
      const returningRows = detectReturningStatusRows({
        snapshotDate,
        observedAt,
        latestStatuses,
        currentInjuredRows
      });

      const rowsToUpsert = [...currentInjuredRows, ...returningRows];
      const gameIdByTeamId = await fetchNearestScheduledGameIdsByTeam({
        supabase: req.supabase,
        snapshotDate,
        teamIds: rowsToUpsert
          .map((row) => row.team_id)
          .filter((teamId): teamId is number => Number.isFinite(teamId))
      });

      if (rowsToUpsert.length > 0) {
        const { error } = await req.supabase
          .from("player_status_history" as any)
          .upsert(rowsToUpsert as any, { onConflict: "capture_key" });
        if (error) throw error;
      }

      const provenanceRows = toInjurySourceProvenanceRows(rowsToUpsert, gameIdByTeamId);
      if (provenanceRows.length > 0) {
        const { error } = await req.supabase
          .from("source_provenance_snapshots" as any)
          .upsert(provenanceRows as any, {
            onConflict:
              "snapshot_date,source_type,entity_type,entity_id,source_name,game_id"
          });
        if (error) throw error;
      }

      return res.json({
        success: true,
        snapshotDate,
        rowsUpserted: rowsToUpsert.length,
        injuredRows: currentInjuredRows.length,
        returningRows: returningRows.length
      });
    } catch (error: any) {
      console.error("update-player-statuses error:", error);
      return res.status(500).json({
        success: false,
        error: error?.message ?? "Unknown error"
      });
    }
  }),
  {
    jobName: "/api/v1/db/update-player-statuses"
  }
);
