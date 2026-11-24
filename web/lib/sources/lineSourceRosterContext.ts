import moment from "moment-timezone";
import { timestampMicros } from "lib/projections/evidenceTime";
import { authorityTier, isRelayAccount } from "lib/lines/authority";
import { beatTeamCoverage, CANDIDATE_CLASSIFICATIONS } from "lib/lines/beatReporterInference";
import { BEAT_REPORTER_REVIEWS } from "lib/lines/beatReporters";
import { fetchAllSupabasePages } from "lib/supabase/pagination";
import { applyPlayerNameAliasesToRosterMap, extractTweetId, fetchPlayerNameAliases, fetchRosterEntriesByTeam } from "./lineSourceProcessing";
import { buildTweetSourceProvenance, refreshLinesCccSourceFromPrimaryText, type LinesCccIftttEventInput, type ParsedLinesCccSource } from "./linesCccIngestion";
import type { RosterNameEntry, TeamDirectoryEntry } from "./lineupSourceIngestion";
import type { PlayerNameAliasRow } from "./playerNameAliases";
import { rosterSeasonForDate } from "./playerIdentity";
import { tweetPipelineFlags } from "./tweetInterpretation";
import { tweetPublicationFromUrl } from "./tweetPublicationTime";

type RosterMap = Map<number, RosterNameEntry[]>;
type SourceContext = {
  rosterByTeam: RosterMap;
  inferenceRosterByTeam?: RosterMap;
  inferencePublishedAt?: string;
};

type Membership = {
  playerId: number;
  teamId: number;
  players: { fullName: string; lastName: string; position: string | null };
  start: string;
  end: string | null;
  officialSeenAt?: string;
  roster: boolean;
};

function micros(value: string | null | undefined) {
  const timestamp = value ? timestampMicros(value) : null;
  return timestamp === null ? NaN : Number(timestamp);
}

function primaryReport(event: LinesCccIftttEventInput, source?: ParsedLinesCccSource) {
  if (source?.primaryTextSource === "quoted_oembed") {
    const urlId = extractTweetId(source.quotedTweetUrl ?? null);
    const id = source.quotedTweetId ?? urlId;
    let publishedAt: string | null = null;
    if (id && (!source.quotedTweetUrl || urlId === id)) {
      const rawClock = source.metadata?.quotedPostedAt;
      if ((source.metadata?.quotedRetrievalStatus === "x_api_success" || (source.metadata?.quotedRetrievalStatus === "fxtwitter_payload"
        && source.metadata?.publicationTimeBasis === "provider_timestamp" && rawClock === source.tweetPostedAt))
        && typeof rawClock === "string" && Number.isFinite(micros(rawClock))) {
        publishedAt = rawClock;
      } else {
        publishedAt = tweetPublicationFromUrl(source.quotedTweetUrl ?? `https://x.com/i/web/status/${id}`);
      }
    }
    return { id, handle: source.quotedAuthorHandle, publishedAt };
  }
  const provenance = buildTweetSourceProvenance(event);
  const id = provenance.originalTweetId;
  let publishedAt: string | null = null;
  if (provenance.timestampIsOriginal) {
    publishedAt = Number.isFinite(micros(event.tweet_created_at)) ? event.tweet_created_at : provenance.publishedAt;
  } else if (id) {
    publishedAt = tweetPublicationFromUrl(`https://x.com/i/web/status/${id}`);
  }
  return { id, handle: provenance.originalAuthor, publishedAt };
}

function canInferBeat(handle: string) {
  return /^[a-z0-9_]{1,15}$/.test(handle) && !isRelayAccount(handle) && authorityTier(handle) === "unknown"
    && !BEAT_REPORTER_REVIEWS.some((review) => review.handle === handle);
}

const BEAT_LOOKUP_BUDGET = 5;
const BEAT_ROW_LIMIT = 64;
const DAY_MS = 86_400_000;
type PriorBeatRow = {
  team_abbreviation: string; classification: string; snapshot_date: string; primary_text_source: string | null;
  quoted_tweet_id: string | null; quoted_author_handle: string | null; labels: string[] | null;
  provenance: { originalTweetId?: string; originalAuthor?: string } | null;
  observed_at: string; updated_at: string; tweet_posted_at: string;
};

async function fetchPriorBeatRows(supabase: any, handle: string, day: string, at: string): Promise<PriorBeatRow[]> {
  const since = new Date(Date.parse(day) - 30 * DAY_MS).toISOString();
  const { data, error } = await supabase.from("line_source_snapshots")
    .select("team_abbreviation,classification,snapshot_date,primary_text_source,quoted_tweet_id,quoted_author_handle,observed_at,updated_at,tweet_posted_at,provenance:metadata->sourceProvenance,labels:metadata->teamLabelMatches")
    .eq("status", "observed").eq("nhl_filter_status", "accepted").in("classification", CANDIDATE_CLASSIFICATIONS)
    .gte("observed_at", since).lt("observed_at", at).lt("updated_at", at).lt("tweet_posted_at", at)
    .or(`metadata->sourceProvenance->>originalAuthor.ilike.${handle},quoted_author_handle.ilike.${handle}`)
    .order("observed_at", { ascending: false }).order("capture_key").limit(BEAT_ROW_LIMIT)
    .abortSignal(AbortSignal.timeout(1500));
  if (error) throw error;
  return data ?? [];
}

function priorBeatTeams(rows: PriorBeatRow[], teams: TeamDirectoryEntry[], handle: string, at: string, originalId: string) {
  const cutoff = micros(at);
  const since = cutoff - 30 * DAY_MS * 1000;
  const originals = new Map<string, string>();
  const conflicting = new Set<string>();
  for (const row of rows) {
    const observed = micros(row.observed_at);
    if (!(observed >= since && observed < cutoff && micros(row.tweet_posted_at) < cutoff && micros(row.updated_at) < cutoff)) continue;
    const quote = row.primary_text_source === "quoted_oembed";
    const id = quote ? row.quoted_tweet_id : row.provenance?.originalTweetId;
    const author = quote ? row.quoted_author_handle : row.provenance?.originalAuthor;
    if (!id || id === originalId || author?.toLowerCase() !== handle || row.labels?.length !== 1
      || row.labels[0] !== row.team_abbreviation) continue;
    if (originals.has(id) && originals.get(id) !== row.team_abbreviation) conflicting.add(id);
    originals.set(id, row.team_abbreviation);
  }
  for (const id of conflicting) originals.delete(id);
  if (originals.size < 3) return [];
  const { teams: coverage, suggestedTeams } = beatTeamCoverage(originals.values());
  const top = coverage[0];
  if (!top || top.count < 3 || top.count * 2 <= originals.size) return [];
  return teams.filter((team) => suggestedTeams.includes(team.abbreviation)).map((team) => team.id);
}

type DatedName = { name: string; availableAt: number };

/** Both a verified registry-to-NHL mapping and its alias revision must already exist at publication. */
async function fetchRegistryNames(supabase: any) {
  const [identities, aliases] = await Promise.all([
    fetchAllSupabasePages<{ id: number; nhl_player_id: number | null; canonical_name: string; verified_at: string | null; updated_at: string }>(
      ({ from, to }) => supabase.from("fhfh_player_identities").select("id,nhl_player_id,canonical_name,verified_at,updated_at")
        .eq("verification_status", "verified").order("id").range(from, to)),
    fetchAllSupabasePages<{ fhfh_player_id: number; alias: string; updated_at: string }>(
      ({ from, to }) => supabase.from("fhfh_player_identity_aliases").select("fhfh_player_id,alias,updated_at")
        .eq("verification_status", "verified").order("id").range(from, to)),
  ]);
  const byIdentity = new Map<number, DatedName[]>();
  for (const alias of aliases) {
    const names = byIdentity.get(Number(alias.fhfh_player_id)) ?? [];
    names.push({ name: alias.alias, availableAt: micros(alias.updated_at) });
    byIdentity.set(Number(alias.fhfh_player_id), names);
  }
  const byPlayer = new Map<number, DatedName[]>();
  for (const row of identities) {
    if (!row.nhl_player_id) continue;
    // The verified row’s last revision proves the stored status; an explicit later verification moves the boundary.
    const revised = micros(row.updated_at);
    const mappingAt = row.verified_at == null ? revised : Math.max(revised, micros(row.verified_at));
    if (!Number.isFinite(mappingAt)) continue;
    byPlayer.set(Number(row.nhl_player_id), [{ name: row.canonical_name, availableAt: mappingAt },
      ...(byIdentity.get(Number(row.id)) ?? []).map((alias) => ({ ...alias, availableAt: Math.max(alias.availableAt, mappingAt) }))]);
  }
  return byPlayer;
}

async function fetchSeason(supabase: any, teamIds: number[], season: number) {
  const interpretation = tweetPipelineFlags().interpretation;
  const [rows, verified, registered] = await Promise.all([
    fetchAllSupabasePages<any>(({ from, to }) => supabase.from("rosters").select("*,players!inner(fullName,lastName,position)")
      .in("teamId", teamIds).eq("seasonId", season).order("teamId").order("playerId").order("created_at").range(from, to)),
    interpretation ? fetchAllSupabasePages<any>(({ from, to }) => supabase.from("tweet_player_memberships")
      .select("player_id,team_id,verified_at,expires_at,membership_kind,players!inner(fullName,lastName,position)")
      .eq("season_id", season).order("team_id").order("player_id").order("membership_kind").range(from, to)) : [],
    interpretation ? fetchRegistryNames(supabase) : new Map<number, DatedName[]>(),
  ]);
  const memberships: Membership[] = [];
  for (const row of rows) {
    if (row.ended_at == null && !row.is_current) continue;
    memberships.push({ playerId: Number(row.playerId), teamId: Number(row.teamId), players: row.players,
      start: row.created_at, end: row.ended_at, officialSeenAt: row.official_seen_at, roster: true });
  }
  for (const row of verified) if (teamIds.includes(Number(row.team_id))) {
    memberships.push({ playerId: Number(row.player_id), teamId: Number(row.team_id), players: row.players,
      start: row.verified_at, end: row.expires_at, roster: row.membership_kind === "roster" });
  }
  return { memberships, identities: registered };
}

function rosterAt(season: Awaited<ReturnType<typeof fetchSeason>>, at: string) {
  const instant = micros(at);
  const active = season.memberships.filter((row) => micros(row.start) <= instant && (row.end == null || micros(row.end) > instant));
  const owners = new Map<number, Set<number>>();
  const latestOfficial = new Map<number, number>();
  for (const row of active) {
    const teams = owners.get(row.playerId) ?? new Set<number>();
    teams.add(row.teamId);
    owners.set(row.playerId, teams);
    const seen = micros(row.officialSeenAt);
    if (seen <= instant) latestOfficial.set(row.teamId, Math.max(seen, latestOfficial.get(row.teamId) ?? seen));
  }
  const rosterPlayers = new Set(active.filter((row) => row.roster).map((row) => row.playerId));
  const ordinary: RosterMap = new Map();
  const inference: RosterMap = new Map();
  for (const row of active) {
    const aliases = season.identities.get(row.playerId)?.filter((name) => name.availableAt <= instant).map((name) => name.name);
    const seen = micros(row.officialSeenAt);
    const entry: RosterNameEntry = { playerId: row.playerId, teamId: row.teamId, ...row.players,
      ...(seen <= instant && seen >= (latestOfficial.get(row.teamId) ?? Infinity) - 12 * 3_600_000_000 ? { onOfficialRoster: true } : {}),
      ...(aliases?.length ? { aliases } : {}) };
    const ambiguous = owners.get(row.playerId)!.size > 1;
    if (!ambiguous) {
      const entries = ordinary.get(row.teamId) ?? [];
      if (!entries.some((other) => other.playerId === row.playerId)) entries.push(entry);
      ordinary.set(row.teamId, entries);
    }
    // Leave competing at-publication memberships visible to the initials resolver's ambiguity check.
    if (row.roster || (ambiguous && rosterPlayers.has(row.playerId))) {
      const entries = inference.get(row.teamId) ?? [];
      if (!entries.some((other) => other.playerId === row.playerId)) {
        entries.push(entry);
      }
      inference.set(row.teamId, entries);
    }
  }
  return { ordinary, inference };
}

/** Seasonal history is shared within a queue batch. Every selected primary post gets its own interval slice. */
export function createLineSourceRosterContext(supabase: any, teams: TeamDirectoryEntry[], requestedDate: string) {
  const teamIds = teams.map((team) => team.id);
  const loadedTeams = new Set<number>();
  const seasons = new Map<number, ReturnType<typeof fetchSeason>>();
  const contexts = new Map<string, SourceContext>();
  let aliases: ReturnType<typeof fetchPlayerNameAliases> | undefined;
  let legacy: Promise<RosterMap> | undefined;

  async function forReport(event: LinesCccIftttEventInput, source?: ParsedLinesCccSource): Promise<SourceContext> {
    const { publishedAt } = primaryReport(event, source);
    const key = publishedAt ?? "unknown";
    const existing = contexts.get(key);
    if (existing) return existing;
    if (!teamIds.length) return { rosterByTeam: new Map() };
    aliases ??= fetchPlayerNameAliases({ supabase, teamIds });
    let context: SourceContext;
    if (publishedAt && Number.isFinite(micros(publishedAt))) {
      const season = rosterSeasonForDate(moment(publishedAt).tz("America/New_York").format("YYYY-MM-DD"));
      if (!seasons.has(season)) seasons.set(season, fetchSeason(supabase, teamIds, season));
      const { ordinary, inference } = rosterAt(await seasons.get(season)!, publishedAt);
      const aliasRows: (PlayerNameAliasRow & { updated_at?: string })[] = await aliases;
      const datedAliases = aliasRows.filter((row) => micros(row.updated_at) <= micros(publishedAt));
      context = {
        rosterByTeam: applyPlayerNameAliasesToRosterMap({ rosterByTeam: ordinary, aliases: datedAliases }),
        inferenceRosterByTeam: applyPlayerNameAliasesToRosterMap({ rosterByTeam: inference, aliases: datedAliases }),
        inferencePublishedAt: publishedAt,
      };
    } else {
      // Preserve ordinary explicit name/alias parsing for legacy wrappers without an original publication clock.
      legacy ??= fetchRosterEntriesByTeam({ supabase, teamIds, seasonId: rosterSeasonForDate(requestedDate) });
      context = { rosterByTeam: applyPlayerNameAliasesToRosterMap({ rosterByTeam: await legacy, aliases: await aliases }) };
    }
    for (const team of context.rosterByTeam.keys()) loadedTeams.add(team);
    contexts.set(key, context);
    return context;
  }
  const beatCache = new Map<string, { until: number; rows: PriorBeatRow[] | null }>();
  let beatLookups = 0;
  async function refresh(event: LinesCccIftttEventInput, source: ParsedLinesCccSource, gameIdByTeamId: Map<number, number>) {
    const context = await forReport(event, source);
    const args = { source, teams, ...context, gameIdByTeamId };
    const candidate = refreshLinesCccSourceFromPrimaryText(args);
    const review = candidate.metadata?.name_inference_review;
    const { id, handle, publishedAt } = primaryReport(event, source);
    const author = handle?.replace(/^@/, "").toLowerCase() ?? "";
    const needsBeat = Array.isArray(review) && review.some((hit) =>
      ["team_unresolved", "fuzzy_name", "ambiguous_name", "ambiguous_initials"].includes(hit.reason));
    if (!candidate.team && needsBeat && id && publishedAt && canInferBeat(author)) {
      const at = micros(publishedAt);
      const day = new Date(Date.parse(publishedAt)).toISOString().slice(0, 10);
      const key = `${author}:${day}`;
      let cached = beatCache.get(key);
      let status: string | undefined;
      // A complete cached result can serve an earlier post after filtering every evidence clock.
      // A later post needs another read so newly conflicting coverage cannot be hidden.
      if (!cached || (cached.rows && (at > cached.until || (at < cached.until && cached.rows.length === BEAT_ROW_LIMIT)))) {
        if (beatLookups >= BEAT_LOOKUP_BUDGET) {
          status = "budget_reached";
        } else {
          beatLookups += 1;
          let rows: PriorBeatRow[] | null = null;
          try {
            rows = await fetchPriorBeatRows(supabase, author, day, publishedAt);
          } catch {
            // History only proposes review candidates. Preserve the primary interpretation on read failure.
          }
          cached = { until: at, rows };
          beatCache.set(key, cached);
        }
      }
      if (!status && cached?.rows) {
        const inferredBeatTeamIds = priorBeatTeams(cached.rows, teams, author, publishedAt, id);
        if (inferredBeatTeamIds.length) {
          return { candidate: refreshLinesCccSourceFromPrimaryText({ ...args, inferredBeatTeamIds }), context };
        }
      } else {
        candidate.metadata = { ...candidate.metadata, inferred_beat_history_status: status ?? "unavailable" };
      }
    }
    return { candidate, context };
  }
  return { forReport, refresh, loadedTeams };
}
