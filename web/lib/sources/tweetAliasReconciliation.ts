import { fetchPlayerIdentityDirectory, resolvePlayerIdentity, rosterSeasonForDate } from "./playerIdentity";
import { fetchRosterEntriesByTeam, fetchPlayerNameAliases, applyPlayerNameAliasesToRosterMap } from "./lineSourceProcessing";
import { interpretTweetUnits, segmentPlayerRow } from "./tweetInterpretation";
import { fetchAllSupabasePages } from "lib/supabase/pagination";
import { easternReportDate, explicitPracticeSession, selectProjectedUnitSets, verifiedOriginalTweetUrl, type ProjectionReport } from "./projectedLineups";
import { tweetPublicationFromUrl } from "./linesCccIngestion";

export type PendingAlias = { id: string; raw_name: string; normalized_name: string; team_id: number; context_text: string | null; tweet_id: string | null; source: string; source_url?: string | null; created_at: string; metadata?: Record<string, unknown> };

export function reconcileAlias(row: PendingAlias, directory: Awaited<ReturnType<typeof fetchPlayerIdentityDirectory>>, roster: typeof directory) {
  const scoped = resolvePlayerIdentity(row.raw_name, roster);
  const global = resolvePlayerIdentity(row.raw_name, directory);
  const interpretation = interpretTweetUnits(row.context_text ?? "", roster);
  if (scoped.status === "matched") return { id: row.id, name: row.raw_name, disposition: "resolved", playerId: scoped.player.playerId, reason: scoped.basis };
  const segmented = segmentPlayerRow(row.raw_name, roster);
  if (segmented && segmented.length > 1) return { id: row.id, name: row.raw_name, disposition: "invalid_extraction", playerIds: segmented.map((hit) => hit.player.playerId), reason: "multiple_players_in_one_token" };
  if (/^(?:News|GM|President|SO NOT O|Montreal|Montréal|Nashville|Edmonton|Colorado|Los Angeles|Star|All|Utah|Vegas|Toronto|Islanders)$/i.test(row.raw_name)) {
    return { id: row.id, name: row.raw_name, disposition: "invalid_extraction", reason: "non_player_text" };
  }
  if (scoped.status === "ambiguous") return { id: row.id, name: row.raw_name, disposition: "review", reason: "ambiguous_identity", candidates: scoped.candidates.map((player) => player.playerId) };
  if (global.status === "matched") return { id: row.id, name: row.raw_name, disposition: "review", reason: "missing_membership", candidates: [global.player.playerId] };
  return { id: row.id, name: row.raw_name, disposition: "review", reason: global.status === "ambiguous" ? "ambiguous_identity" : "missing_player", structuredUnits: interpretation.units.length };
}

/** Read-only by construction: no receiver, publishing, email, forecast or write calls. */
export async function shadowReplayPendingAliases(supabase: any, args: { afterId?: string; limit?: number; seasonId?: number; previewNhlRosters?: boolean }) {
  if (args.limit != null && (!Number.isSafeInteger(args.limit) || args.limit < 1)) throw new Error("Invalid replay limit");
  if (args.seasonId != null && !/^\d{8}$/.test(String(args.seasonId))) throw new Error("Invalid roster season");
  const startedAt = Date.now();
  const limit = Math.min(Math.max(args.limit ?? 100, 1), 1000);
  const seasonId = args.seasonId ?? rosterSeasonForDate();
  const rows = await fetchAllSupabasePages<PendingAlias>(({ from, to }) => {
    let query = supabase.from("lineup_unresolved_player_names").select("id,raw_name,normalized_name,team_id,context_text,tweet_id,source,source_url,created_at,metadata").eq("status", "pending");
    if (args.afterId) query = query.gt("id", args.afterId);
    return query.order("id").range(from, to);
  }, { limit });
  const teamIds = [...new Set(rows.map((row) => row.team_id).filter(Boolean))];
  const [directory, rosterByTeam, aliases] = await Promise.all([
    fetchPlayerIdentityDirectory(supabase), fetchRosterEntriesByTeam({ supabase, teamIds, seasonId }), fetchPlayerNameAliases({ supabase, teamIds }),
  ]);
  if (args.previewNhlRosters) {
    const { fetchNhlRosterPreview } = await import("./nhlRosterPreview");
    const preview = await fetchNhlRosterPreview(seasonId);
    if (!preview.length) throw new Error("NHL roster preview was empty; refusing a misleading reconciliation.");
    rosterByTeam.clear();
    for (const player of preview) {
      const entry = { playerId: player.id, fullName: player.fullName, lastName: player.lastName, teamId: player.teamId, position: player.positionCode };
      const entries = rosterByTeam.get(player.teamId) ?? [];
      entries.push(entry); rosterByTeam.set(player.teamId, entries);
      const index = directory.findIndex((existing) => existing.playerId === player.id);
      if (index < 0) directory.push(entry); else directory[index] = entry;
    }
  }
  const roster = applyPlayerNameAliasesToRosterMap({ rosterByTeam, aliases });
  const results = rows.map((row) => reconcileAlias(row, directory, roster.get(row.team_id) ?? []));
  const reports: ProjectionReport[] = [...new Map(rows.filter((row) => row.context_text).map((row) => [`${row.tweet_id ?? row.id}:${row.team_id}`, row])).entries()].map(([key, row]) => {
    const publishedAt = tweetPublicationFromUrl(row.tweet_id ? `https://x.com/i/status/${row.tweet_id}` : null);
    const originalUrl = verifiedOriginalTweetUrl(row.source_url ?? null);
    return { key, teamId: row.team_id, teamAbbreviation: "", gameId: null, session: explicitPracticeSession(row.context_text!),
      date: publishedAt ? easternReportDate(publishedAt) : row.created_at.slice(0, 10), publishedAt,
      originalPublishedAt: originalUrl ? publishedAt : null, receivedAt: row.created_at, originalUrl, text: row.context_text!,
      interpretation: interpretTweetUnits(row.context_text!, roster.get(row.team_id) ?? []) };
  });
  const hypotheticalSets = selectProjectedUnitSets(reports);
  return { dryRun: true, previewNhlRosters: args.previewNhlRosters ?? false, seasonId, reviewed: rows.length, nextCursor: rows.length === limit ? rows.at(-1)!.id : null,
    counts: results.reduce<Record<string, number>>((counts, result) => { counts[result.disposition] = (counts[result.disposition] ?? 0) + 1; return counts; }, {}),
    rosterPlayers: [...roster.values()].reduce((count, entries) => count + entries.length, 0),
    reviewReasons: results.filter((result) => result.disposition === "review").reduce<Record<string, number>>((counts, result) => { counts[result.reason] = (counts[result.reason] ?? 0) + 1; return counts; }, {}),
    attribution: { reports: reports.length, verifiedOriginalLinks: reports.filter((report) => report.originalUrl).length, pendingLinks: reports.filter((report) => !report.originalUrl).length },
    hypotheticalPublishing: { sets: hypotheticalSets.length, units: hypotheticalSets.reduce((count, set) => count + set.units.length, 0),
      situations: hypotheticalSets.map((set) => ({ teamId: set.reports[0]!.teamId, date: set.reports[0]!.date, situation: set.situation, group: set.group, reportKeys: set.reports.map((report) => report.key) })),
      liveWrites: 0, forecastUpdates: 0, scope: "Only pending-queue contexts; no inferred game binding or current-lineup replacement" },
    trocheckRosterEvidence: [...roster.entries()].flatMap(([teamId, entries]) => entries.filter((entry) => entry.playerId === 8476389).map((entry) => ({ playerId: entry.playerId, name: entry.fullName, teamId, seasonId }))),
    elapsedMs: Date.now() - startedAt,
    results };
}
