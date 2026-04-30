import type { RosterNameEntry } from "lib/sources/lineupSourceIngestion";
import {
  buildUnresolvedPlayerNameDedupeKey,
  mergePlayerNameAliasesIntoRoster,
  normalizePlayerNameAlias,
  type PlayerNameAliasRow,
} from "lib/sources/playerNameAliases";

export type ScheduledGameRow = {
  id: number;
  date: string;
  homeTeamId: number;
  awayTeamId: number;
};

export type LineSourceRowForUnresolvedNameReview = {
  capture_key: string;
  source: string;
  source_url: string | null;
  tweet_id: string | null;
  quoted_tweet_id: string | null;
  team_id: number | null;
  team_abbreviation: string | null;
  status: string;
  nhl_filter_status: string;
  classification: string | null;
  raw_text: string | null;
  enriched_text: string | null;
  quoted_raw_text: string | null;
  quoted_enriched_text: string | null;
  unmatched_names: string[] | null;
  line_1_player_ids: Array<number | null> | null;
  line_1_player_names: string[] | null;
  line_2_player_ids: Array<number | null> | null;
  line_2_player_names: string[] | null;
  line_3_player_ids: Array<number | null> | null;
  line_3_player_names: string[] | null;
  line_4_player_ids: Array<number | null> | null;
  line_4_player_names: string[] | null;
  pair_1_player_ids: Array<number | null> | null;
  pair_1_player_names: string[] | null;
  pair_2_player_ids: Array<number | null> | null;
  pair_2_player_names: string[] | null;
  pair_3_player_ids: Array<number | null> | null;
  pair_3_player_names: string[] | null;
  scratches_player_ids: Array<number | null> | null;
  scratches_player_names: string[] | null;
  injured_player_ids: Array<number | null> | null;
  injured_player_names: string[] | null;
  goalie_1_player_id: number | null;
  goalie_1_name: string | null;
  goalie_2_player_id: number | null;
  goalie_2_name: string | null;
};

export function parseRequestedDate(value: string | string[] | undefined): string {
  const rawValue = Array.isArray(value) ? value[0] : value;
  if (typeof rawValue === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
    return rawValue;
  }
  return new Date().toISOString().slice(0, 10);
}

export function parseBatchSize(value: string | string[] | undefined): number {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = rawValue ? Number.parseInt(rawValue, 10) : 25;
  if (!Number.isFinite(parsed)) return 25;
  return Math.min(Math.max(parsed, 1), 100);
}

export function parseBooleanFlag(value: string | string[] | undefined): boolean {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue === "1" || rawValue === "true" || rawValue === "yes";
}

export function parseStringQueryValue(
  value: string | string[] | undefined,
): string | null {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return typeof rawValue === "string" && rawValue.trim()
    ? rawValue.trim()
    : null;
}

export async function fetchScheduledGamesForDate(args: {
  supabase: any;
  date: string;
}): Promise<ScheduledGameRow[]> {
  const { data, error } = await args.supabase
    .from("games")
    .select("id, date, homeTeamId, awayTeamId")
    .eq("date", args.date)
    .order("id", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as ScheduledGameRow[]).filter(
    (row) => Number.isFinite(row.homeTeamId) && Number.isFinite(row.awayTeamId),
  );
}

export async function fetchRosterEntriesByTeam(args: {
  supabase: any;
  teamIds: number[];
  seasonId: number;
}): Promise<Map<number, RosterNameEntry[]>> {
  if (args.teamIds.length === 0) return new Map();

  const { data, error } = await args.supabase
    .from("rosters")
    .select("teamId, playerId, is_current, players!inner(fullName, lastName)")
    .in("teamId", args.teamIds)
    .eq("seasonId", args.seasonId);

  if (error) throw error;

  const result = new Map<number, RosterNameEntry[]>();
  for (const row of data ?? []) {
    const teamId = Number((row as any).teamId);
    if (!Number.isFinite(teamId)) continue;
    const entry: RosterNameEntry = {
      playerId: Number((row as any).playerId),
      fullName: String((row as any).players?.fullName ?? ""),
      lastName: String((row as any).players?.lastName ?? ""),
    };
    if (!result.has(teamId)) {
      result.set(teamId, []);
    }
    result.get(teamId)?.push(entry);
  }

  return result;
}

export async function fetchPlayerNameAliases(args: {
  supabase: any;
  teamIds: number[];
}): Promise<PlayerNameAliasRow[]> {
  let query = args.supabase
    .from("lineup_player_name_aliases" as any)
    .select("alias, player_id, team_id");

  query =
    args.teamIds.length > 0
      ? query.or(`team_id.is.null,team_id.in.(${args.teamIds.join(",")})`)
      : query.is("team_id", null);

  const { data, error } = await query;

  if (error) throw error;

  return (data ?? []) as PlayerNameAliasRow[];
}

export function applyPlayerNameAliasesToRosterMap(args: {
  rosterByTeam: Map<number, RosterNameEntry[]>;
  aliases: PlayerNameAliasRow[];
}): Map<number, RosterNameEntry[]> {
  const result = new Map<number, RosterNameEntry[]>();
  for (const [teamId, rosterEntries] of args.rosterByTeam.entries()) {
    result.set(
      teamId,
      mergePlayerNameAliasesIntoRoster({
        rosterEntries,
        aliases: args.aliases,
        teamId,
      }),
    );
  }
  return result;
}

export function extractTweetId(value: string | null): string | null {
  if (!value) return null;
  return value.match(/\/status(?:es)?\/(\d+)/i)?.[1] ?? null;
}

export function normalizeTweetUrl(
  value: string | null,
  tweetId: string | null,
): string | null {
  if (value) {
    const id = extractTweetId(value);
    if (id) return `https://twitter.com/i/web/status/${id}`;
  }
  return tweetId ? `https://twitter.com/i/web/status/${tweetId}` : null;
}

function isReviewablePlayerName(rawName: string | null | undefined) {
  const trimmed = rawName?.trim() ?? "";
  if (!trimmed) return false;
  if (trimmed.length > 36) return false;
  if (/https?:|www\.|t\.co|pic\.twitter\.com|@|#|…/.test(trimmed))
    return false;
  if (/[:]/.test(trimmed)) return false;
  if (!/[A-Za-z]/.test(trimmed)) return false;
  if (/\d/.test(trimmed)) return false;
  if (!trimmed.includes(" ")) {
    const uppercaseCount = (trimmed.match(/[A-Z]/g) ?? []).length;
    if (uppercaseCount > 2) return false;
  }
  if (!/^[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ.' -]+$/.test(trimmed)) return false;
  if (/^(rt|per|confirmed|lineup|lines|starting|goalie|starter)$/i.test(trimmed)) {
    return false;
  }
  return true;
}

export function collectUnresolvedNamesFromLineRows(
  rows: LineSourceRowForUnresolvedNameReview[],
) {
  const pending = new Map<string, Record<string, unknown>>();

  for (const row of rows) {
    if (
      row.status !== "observed" ||
      row.nhl_filter_status !== "accepted" ||
      !row.team_id
    ) {
      continue;
    }

    const addName = (rawName: string | null | undefined, reason: string) => {
      if (!isReviewablePlayerName(rawName)) return;
      const trimmedName = rawName?.trim();
      if (!trimmedName) return;
      const normalizedName = normalizePlayerNameAlias(trimmedName);
      if (!normalizedName) return;
      const dedupeKey = buildUnresolvedPlayerNameDedupeKey({
        source: row.source,
        tweetId: row.tweet_id,
        teamId: row.team_id,
        normalizedName,
      });
      pending.set(dedupeKey, {
        dedupe_key: dedupeKey,
        source: row.source,
        source_url: row.source_url,
        tweet_id: row.tweet_id,
        raw_name: trimmedName,
        normalized_name: normalizedName,
        team_id: row.team_id,
        team_abbreviation: row.team_abbreviation,
        context_text:
          row.quoted_enriched_text ??
          row.quoted_raw_text ??
          row.enriched_text ??
          row.raw_text ??
          null,
        status: "pending",
        metadata: {
          reason,
          captureKey: row.capture_key,
          classification: row.classification,
          quotedTweetId: row.quoted_tweet_id,
        },
        updated_at: new Date().toISOString(),
      });
    };

    for (const rawName of row.unmatched_names ?? []) {
      addName(rawName, "unmatched_names");
    }

    const groupedNames = [
      {
        names: row.line_1_player_names,
        ids: row.line_1_player_ids,
        reason: "line_1_null_id",
      },
      {
        names: row.line_2_player_names,
        ids: row.line_2_player_ids,
        reason: "line_2_null_id",
      },
      {
        names: row.line_3_player_names,
        ids: row.line_3_player_ids,
        reason: "line_3_null_id",
      },
      {
        names: row.line_4_player_names,
        ids: row.line_4_player_ids,
        reason: "line_4_null_id",
      },
      {
        names: row.pair_1_player_names,
        ids: row.pair_1_player_ids,
        reason: "pair_1_null_id",
      },
      {
        names: row.pair_2_player_names,
        ids: row.pair_2_player_ids,
        reason: "pair_2_null_id",
      },
      {
        names: row.pair_3_player_names,
        ids: row.pair_3_player_ids,
        reason: "pair_3_null_id",
      },
      {
        names: row.scratches_player_names,
        ids: row.scratches_player_ids,
        reason: "scratches_null_id",
      },
      {
        names: row.injured_player_names,
        ids: row.injured_player_ids,
        reason: "injuries_null_id",
      },
    ];

    for (const group of groupedNames) {
      group.names?.forEach((name, index) => {
        if (group.ids?.[index] == null) {
          addName(name, group.reason);
        }
      });
    }

    if (row.goalie_1_name && row.goalie_1_player_id == null) {
      addName(row.goalie_1_name, "goalie_1_null_id");
    }
    if (row.goalie_2_name && row.goalie_2_player_id == null) {
      addName(row.goalie_2_name, "goalie_2_null_id");
    }
  }

  return Array.from(pending.values());
}

export async function persistUnresolvedPlayerNames(args: {
  supabase: any;
  rows: LineSourceRowForUnresolvedNameReview[];
}): Promise<number> {
  const unresolvedRows = collectUnresolvedNamesFromLineRows(args.rows);
  if (unresolvedRows.length === 0) return 0;

  const { error } = await args.supabase
    .from("lineup_unresolved_player_names" as any)
    .upsert(unresolvedRows as any, {
      onConflict: "dedupe_key",
      ignoreDuplicates: true,
    });

  if (error) throw error;
  return unresolvedRows.length;
}
