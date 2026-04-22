import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import {
  buildTeamStatusDirectory,
  detectReturningStatusRows,
  fetchBellMediaInjuries,
  fetchCurrentPlayerStatusRows,
  normalizeBellMediaInjuryRows,
  normalizeGameDayTweetsNewsStatusRows,
  parseGameDayTweetsNewsPage,
  toGameDayTweetsNewsProvenanceRows,
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

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "fhfhockey/1.0 (+https://fhfhockey.com)"
    },
    cache: "no-store"
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return body;
}

type ScheduledGameRow = {
  id: number;
  date: string;
  homeTeamId: number;
  awayTeamId: number;
};

function dedupeRowsByKey<T>(rows: T[], getKey: (row: T) => string): T[] {
  const seen = new Map<string, T>();
  for (const row of rows) {
    seen.set(getKey(row), row);
  }
  return Array.from(seen.values());
}

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
      const allRosterEntries = Array.from(rosterByTeam.values()).flat();
      const directory = buildTeamStatusDirectory();
      const rawTeams = await fetchBellMediaInjuries();
      const currentInjuredRows = normalizeBellMediaInjuryRows({
        rawTeams,
        snapshotDate,
        observedAt,
        directory,
        rosterByTeam
      });
      const gameDayTweetsNewsUrl = "https://www.gamedaytweets.com/news";
      const gameDayTweetsNewsHtml = await fetchHtml(gameDayTweetsNewsUrl);
      const gameDayTweetsNewsItems = parseGameDayTweetsNewsPage({
        html: gameDayTweetsNewsHtml,
        sourceUrl: gameDayTweetsNewsUrl,
        rosterEntries: allRosterEntries,
        directory
      });
      const gameDayTweetsStatusRows = normalizeGameDayTweetsNewsStatusRows({
        items: gameDayTweetsNewsItems,
        snapshotDate,
        observedAt
      });
      const latestStatuses = await fetchCurrentPlayerStatusRows({ supabase: req.supabase });
      const returningRows = detectReturningStatusRows({
        snapshotDate,
        observedAt,
        latestStatuses,
        currentInjuredRows: [...currentInjuredRows, ...gameDayTweetsStatusRows]
      });

      const rowsToUpsert = dedupeRowsByKey(
        [
          ...currentInjuredRows,
          ...gameDayTweetsStatusRows,
          ...returningRows
        ],
        (row) => row.capture_key
      );
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
      const gameDayTweetsNewsProvenanceRows = toGameDayTweetsNewsProvenanceRows(
        gameDayTweetsNewsItems,
        snapshotDate,
        observedAt,
        gameIdByTeamId
      );
      const allProvenanceRows = dedupeRowsByKey(
        [...provenanceRows, ...gameDayTweetsNewsProvenanceRows],
        (row) =>
          [
            row.snapshot_date,
            row.source_type,
            row.entity_type,
            row.entity_id,
            row.source_name,
            row.game_id
          ].join(":")
      );
      if (allProvenanceRows.length > 0) {
        const { error } = await req.supabase
          .from("source_provenance_snapshots" as any)
          .upsert(allProvenanceRows as any, {
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
        gameDayTweetsStatusRows: gameDayTweetsStatusRows.length,
        gameDayTweetsNewsRows: gameDayTweetsNewsItems.length,
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
