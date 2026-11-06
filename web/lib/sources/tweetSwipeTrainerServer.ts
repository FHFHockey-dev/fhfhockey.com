// Loads what the swipe trainer needs (rosters, review rows, shadow posts) and writes its verdicts.
// Verdicts land in tweet_pattern_review_items (answer key in metadata.answerKey); name fixes are queued into
// lineup_unresolved_player_names so the existing alias API resolves them.
import { getCurrentSeason, getTeams } from "lib/NHL/server";
import {
  applyPlayerNameAliasesToRosterMap,
  fetchPlayerNameAliases,
  fetchRosterEntriesByTeam
} from "./lineSourceProcessing";
import { buildTeamDirectory, type RosterNameEntry, type TeamDirectoryEntry } from "./lineupSourceIngestion";
import { findAliasReviewOccurrences } from "./playerAliasReview";
import { rosterSeasonForDate } from "./playerIdentity";
import { buildUnresolvedPlayerNameDedupeKey, normalizePlayerNameAlias } from "./playerNameAliases";
import { buildTweetPatternReviewDedupeKey } from "./tweetPatternReview";
import {
  assignmentsFromExtraction,
  buildAnswerKeyRecord,
  extractionFromParse,
  parseTweetForTrainer,
  quickTrainerType,
  readAnswerKeyRecord,
  TRAINER_TYPE_ORDER,
  type TrainerExtraction,
  type TrainerInput,
  type TrainerParse,
  type TrainerType,
  type TweetAnswerKeyRecord
} from "./tweetSwipeTrainer";

export type TrainerContext = {
  teams: TeamDirectoryEntry[];
  rosterByTeam: Map<number, RosterNameEntry[]>;
  /** Parses made with these rosters; the production parser takes hundreds of milliseconds per tweet. */
  parses: Map<string, TrainerParse>;
};

export type TrainerUnresolvedName = { id: string; rawName: string; teamId: number | null; status: string };

export type TrainerCard = {
  key: string;
  reviewItemId: string | null;
  shadowPostId: string | null;
  tweetId: string | null;
  tweetUrl: string | null;
  authorName: string | null;
  authorHandle: string | null;
  sourceAccount: string | null;
  repostedBy: string | null;
  originalAuthor: string | null;
  quotedAuthor: string | null;
  postKind: "post" | "repost" | "quote" | null;
  postedAt: string | null;
  text: string;
  quotedText: string | null;
  input: TrainerInput;
  parse: TrainerParse;
  /** The parser's answer in answer-key shape; the correction editor starts from it. */
  extraction: TrainerExtraction;
  unresolvedNames: TrainerUnresolvedName[];
  answerKey: TweetAnswerKeyRecord | null;
};

type ReviewRow = {
  id: string;
  dedupe_key: string;
  source_key: string | null;
  source_account: string | null;
  source_handle: string | null;
  author_name: string | null;
  source_created_at: string | null;
  tweet_id: string | null;
  tweet_url: string | null;
  source_url: string | null;
  quoted_tweet_id: string | null;
  review_text: string | null;
  raw_text: string | null;
  enriched_text: string | null;
  quoted_text: string | null;
  review_status: string;
  metadata: Record<string, unknown> | null;
};

type ShadowRow = {
  id: string;
  source_group: string;
  source_key: string;
  source_account: string;
  tweet_id: string;
  post_kind: "post" | "repost" | "quote";
  author_handle: string;
  reposted_by_handle: string | null;
  original_author_handle: string | null;
  quoted_tweet_id: string | null;
  quoted_author_handle: string | null;
  quoted_text: string | null;
  full_text: string | null;
  text: string | null;
  link_to_tweet: string;
  tweet_created_at: string | null;
  has_media: boolean;
};

const REVIEW_COLUMNS =
  "id, dedupe_key, source_key, source_account, source_handle, author_name, source_created_at, tweet_id, tweet_url, source_url, quoted_tweet_id, review_text, raw_text, enriched_text, quoted_text, review_status, metadata";
const SHADOW_COLUMNS =
  "id, source_group, source_key, source_account, tweet_id, post_kind, author_handle, reposted_by_handle, original_author_handle, quoted_tweet_id, quoted_author_handle, quoted_text, full_text, text, link_to_tweet, tweet_created_at, has_media";

const CLASSIFICATIONS_BY_TYPE: Partial<Record<TrainerType, string[]>> = {
  line_combination: ["lineup", "practice_lines", "power_play"],
  goalie: ["goalie_start"],
  injury: ["injury"]
};
const TRANSACTION_TERMS = ["recalled", "assigned", "traded", "waivers", "signed", "loaned", "call-up", "called up", "acquired"];

const CONTEXT_TTL_MS = 30 * 60 * 1000;
const contextCache = new Map<number, { loadedAt: number; context: Promise<TrainerContext> }>();

async function loadSeasonContext(supabase: any, seasonId: number): Promise<TrainerContext> {
  const current = await getCurrentSeason();
  const teams = buildTeamDirectory(await getTeams(current.seasonId, { mode: "current-canonical" }));
  const teamIds = teams.map((team) => team.id);
  const [rosters, aliases] = await Promise.all([
    fetchRosterEntriesByTeam({ supabase, teamIds, seasonId }),
    fetchPlayerNameAliases({ supabase, teamIds })
  ]);
  return { teams, rosterByTeam: applyPlayerNameAliasesToRosterMap({ rosterByTeam: rosters, aliases }), parses: new Map() };
}

/** Teams plus the rosters (with learned aliases) for the season a tweet was posted in. Cached for 30 minutes. */
export async function loadTrainerContext(supabase: any, publishedAt: string | null, options: { fresh?: boolean } = {}) {
  const seasonId = rosterSeasonForDate(publishedAt ?? new Date().toISOString());
  const cached = contextCache.get(seasonId);
  if (!options.fresh && cached && Date.now() - cached.loadedAt < CONTEXT_TTL_MS) return cached.context;
  const context = loadSeasonContext(supabase, seasonId).catch((error) => {
    contextCache.delete(seasonId);
    throw error;
  });
  contextCache.set(seasonId, { loadedAt: Date.now(), context });
  return context;
}

export function clearTrainerContextCache() {
  contextCache.clear();
}

function handleOf(value: string | null | undefined): string | null {
  const trimmed = value?.trim().replace(/^@/, "");
  return trimmed ? `@${trimmed}` : null;
}

/** Text the parser is replayed on. Shadow posts keep IFTTT's shape; quotes add the quoted post's text. */
function inputFor(row: ReviewRow | null, shadow: ShadowRow | null): TrainerInput {
  const base = shadow
    ? shadow.text ?? shadow.full_text ?? ""
    : row?.enriched_text ?? row?.raw_text ?? row?.review_text ?? "";
  const quoted = shadow?.quoted_text ?? row?.quoted_text ?? null;
  const text = quoted && !base.includes(quoted) ? `${base}\n${quoted}` : base;
  const handles = [shadow?.source_key ?? row?.source_key ?? row?.source_account, shadow?.author_handle ?? row?.source_handle]
    .map((value) => value?.replace(/^@/, "") ?? null)
    .filter((value): value is string => Boolean(value));
  return {
    text: text.trim(),
    handles,
    publishedAt: shadow?.tweet_created_at ?? row?.source_created_at ?? null,
    hasMedia: shadow?.has_media ?? false
  };
}

async function buildCard(args: {
  supabase: any;
  row: ReviewRow | null;
  shadow: ShadowRow | null;
  unresolved: TrainerUnresolvedName[];
}): Promise<TrainerCard> {
  const { row, shadow } = args;
  const input = inputFor(row, shadow);
  const parse = await cachedParse(args.supabase, input);
  const authorHandle = handleOf(shadow?.original_author_handle ?? shadow?.author_handle ?? row?.source_handle);
  return {
    key: row ? row.id : `shadow:${shadow!.id}`,
    reviewItemId: row?.id ?? null,
    shadowPostId: shadow?.id ?? null,
    tweetId: shadow?.tweet_id ?? row?.tweet_id ?? null,
    tweetUrl: shadow?.link_to_tweet ?? row?.source_url ?? row?.tweet_url ?? null,
    authorName: row?.author_name ?? null,
    authorHandle,
    sourceAccount: shadow?.source_account ?? row?.source_account ?? null,
    repostedBy: shadow?.post_kind === "repost" ? handleOf(shadow.reposted_by_handle ?? shadow.source_account) : null,
    originalAuthor: shadow?.post_kind === "repost" ? handleOf(shadow.original_author_handle ?? shadow.author_handle) : null,
    quotedAuthor: handleOf(shadow?.quoted_author_handle),
    postKind: shadow?.post_kind ?? null,
    postedAt: input.publishedAt,
    text: shadow?.full_text ?? row?.review_text ?? input.text,
    quotedText: shadow?.quoted_text ?? (row?.quoted_text && row.quoted_text !== row.review_text ? row.quoted_text : null),
    input,
    parse,
    extraction: extractionFromParse(parse),
    unresolvedNames: args.unresolved,
    answerKey: readAnswerKeyRecord(row?.metadata)
  };
}

async function cachedParse(supabase: any, input: TrainerInput): Promise<TrainerParse> {
  const context = await loadTrainerContext(supabase, input.publishedAt);
  const key = JSON.stringify([input.text, input.handles, input.publishedAt, input.hasMedia]);
  const cached = context.parses.get(key);
  if (cached) return cached;
  const parse = parseTweetForTrainer({ input, teams: context.teams, rosterByTeam: context.rosterByTeam });
  if (context.parses.size > 2000) context.parses.clear();
  context.parses.set(key, parse);
  return parse;
}

async function fetchShadowByTweetIds(supabase: any, tweetIds: string[]): Promise<Map<string, ShadowRow>> {
  if (!tweetIds.length) return new Map();
  const { data, error } = await supabase.from("x_timeline_shadow_posts").select(SHADOW_COLUMNS).in("tweet_id", tweetIds);
  if (error) throw error;
  const result = new Map<string, ShadowRow>();
  for (const shadow of (data ?? []) as ShadowRow[]) if (!result.has(shadow.tweet_id)) result.set(shadow.tweet_id, shadow);
  return result;
}

async function fetchUnresolvedByTweet(supabase: any, tweetIds: string[]): Promise<Map<string, TrainerUnresolvedName[]>> {
  if (!tweetIds.length) return new Map();
  const { data, error } = await supabase
    .from("lineup_unresolved_player_names")
    .select("id, raw_name, team_id, status, tweet_id")
    .in("tweet_id", tweetIds)
    .eq("status", "pending")
    .limit(500);
  if (error) throw error;
  const result = new Map<string, TrainerUnresolvedName[]>();
  for (const name of data ?? []) {
    const list = result.get(name.tweet_id) ?? [];
    list.push({ id: name.id, rawName: name.raw_name, teamId: name.team_id, status: name.status });
    result.set(name.tweet_id, list);
  }
  return result;
}

async function fetchPendingReviewRows(args: {
  supabase: any;
  type: TrainerType;
  limit: number;
  excludeIds: string[];
}): Promise<ReviewRow[]> {
  if (args.limit <= 0) return [];
  let query = args.supabase
    .from("tweet_pattern_review_items")
    .select(REVIEW_COLUMNS)
    .eq("review_status", "pending")
    .order("source_created_at", { ascending: false, nullsFirst: false })
    .limit(args.limit);
  const classifications = CLASSIFICATIONS_BY_TYPE[args.type];
  if (classifications) query = query.in("parser_classification", classifications);
  else if (args.type === "transaction")
    query = query
      .or("parser_classification.is.null,parser_classification.eq.other")
      .or(TRANSACTION_TERMS.map((term) => `review_text.ilike.*${term}*`).join(","));
  else query = query.or("parser_classification.is.null,parser_classification.eq.other");
  if (args.excludeIds.length) query = query.not("id", "in", `(${args.excludeIds.join(",")})`);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ReviewRow[];
}

/** Shadow posts with no review row yet. They become review rows only when TJ gives a verdict. */
async function fetchShadowOnlyPosts(supabase: any, excludeKeys: Set<string>): Promise<ShadowRow[]> {
  const { data, error } = await supabase
    .from("x_timeline_shadow_posts")
    .select(SHADOW_COLUMNS)
    .order("first_seen_at", { ascending: false })
    .limit(300);
  if (error) throw error;
  const shadows = ((data ?? []) as ShadowRow[]).filter((shadow) => !excludeKeys.has(`shadow:${shadow.id}`));
  const tweetIds = [...new Set(shadows.flatMap((shadow) => [shadow.tweet_id, shadow.quoted_tweet_id].filter(Boolean) as string[]))];
  const reviewed = new Set<string>();
  for (let index = 0; index < tweetIds.length; index += 100) {
    const batch = tweetIds.slice(index, index + 100);
    const { data: rows, error: reviewError } = await supabase
      .from("tweet_pattern_review_items")
      .select("tweet_id, quoted_tweet_id")
      .or(`tweet_id.in.(${batch.join(",")}),quoted_tweet_id.in.(${batch.join(",")})`);
    if (reviewError) throw reviewError;
    for (const row of rows ?? []) {
      if (row.tweet_id) reviewed.add(row.tweet_id);
      if (row.quoted_tweet_id) reviewed.add(row.quoted_tweet_id);
    }
  }
  return shadows.filter((shadow) => !reviewed.has(shadow.tweet_id));
}

export type TrainerQueueResult = {
  type: TrainerType;
  cards: TrainerCard[];
  remainingByType: Partial<Record<TrainerType, number>>;
};

/**
 * One batch of cards for a type. With type "auto", walks TRAINER_TYPE_ORDER and returns the first type that still
 * has unlabelled tweets: line combinations first, then goalies, injuries and transactions.
 */
export async function fetchTrainerQueue(args: {
  supabase: any;
  type: TrainerType | "auto";
  limit: number;
  excludeKeys: string[];
}): Promise<TrainerQueueResult> {
  const excludeKeys = new Set(args.excludeKeys);
  const excludeIds = args.excludeKeys.filter((key) => /^[0-9a-f-]{36}$/i.test(key));
  const shadowOnly = await fetchShadowOnlyPosts(args.supabase, excludeKeys);
  const order: TrainerType[] = args.type === "auto" ? TRAINER_TYPE_ORDER : [args.type];

  for (const type of order) {
    const shadowMatches = shadowOnly.filter((shadow) => quickTrainerType(inputFor(null, shadow).text) === type).length;
    const rows = await fetchPendingReviewRows({ supabase: args.supabase, type, limit: Math.max(0, args.limit - shadowMatches), excludeIds });
    const tweetIds = [...new Set(rows.flatMap((row) => [row.tweet_id, row.quoted_tweet_id].filter(Boolean) as string[]))];
    const shadowByTweet = await fetchShadowByTweetIds(args.supabase, tweetIds);
    const allTweetIds = [...tweetIds, ...shadowOnly.map((shadow) => shadow.tweet_id)];
    const unresolved = await fetchUnresolvedByTweet(args.supabase, allTweetIds);
    const reviewCards = await Promise.all(
      rows.map((row) => {
        const shadow = (row.tweet_id && shadowByTweet.get(row.tweet_id)) || (row.quoted_tweet_id && shadowByTweet.get(row.quoted_tweet_id)) || null;
        return buildCard({ supabase: args.supabase, row, shadow, unresolved: unresolved.get(row.tweet_id ?? "") ?? [] });
      })
    );
    const shadowCards = (
      await Promise.all(
        shadowOnly
          .filter((shadow) => quickTrainerType(inputFor(null, shadow).text) === type)
          .slice(0, args.limit)
          .map((shadow) => buildCard({ supabase: args.supabase, row: null, shadow, unresolved: unresolved.get(shadow.tweet_id) ?? [] }))
      )
    ).filter((card) => card.parse.type === type);
    // Amber first (labels there move the parser most), then red, then green, per the audit's queue order.
    const bandOrder = { mid: 0, low: 1, high: 2 } as const;
    const cards = [...shadowCards, ...reviewCards]
      .sort((left, right) => bandOrder[left.parse.confidence.band] - bandOrder[right.parse.confidence.band])
      .slice(0, args.limit);
    if (cards.length || args.type !== "auto") {
      return { type, cards, remainingByType: await countRemainingByType(args.supabase) };
    }
  }
  return { type: order[order.length - 1]!, cards: [], remainingByType: await countRemainingByType(args.supabase) };
}

/** Pending review rows per trainer type: the swipe trainer's "left in queue" counts, also read by the cron report. */
export async function countRemainingByType(supabase: any): Promise<Partial<Record<TrainerType, number>>> {
  const counts: Partial<Record<TrainerType, number>> = {};
  for (const type of TRAINER_TYPE_ORDER) {
    let query = supabase.from("tweet_pattern_review_items").select("id", { count: "exact", head: true }).eq("review_status", "pending");
    const classifications = CLASSIFICATIONS_BY_TYPE[type];
    if (classifications) query = query.in("parser_classification", classifications);
    else
      query = query
        .or("parser_classification.is.null,parser_classification.eq.other")
        .or(TRANSACTION_TERMS.map((term) => `review_text.ilike.*${term}*`).join(","));
    const { count, error } = await query;
    if (error) throw error;
    counts[type] = count ?? 0;
  }
  return counts;
}

async function loadCardForWrite(supabase: any, card: { reviewItemId?: string | null; shadowPostId?: string | null }) {
  let row: ReviewRow | null = null;
  let shadow: ShadowRow | null = null;
  if (card.reviewItemId) {
    const { data, error } = await supabase.from("tweet_pattern_review_items").select(REVIEW_COLUMNS).eq("id", card.reviewItemId).single();
    if (error) throw error;
    row = data as ReviewRow;
  }
  if (card.shadowPostId) {
    const { data, error } = await supabase.from("x_timeline_shadow_posts").select(SHADOW_COLUMNS).eq("id", card.shadowPostId).single();
    if (error) throw error;
    shadow = data as ShadowRow;
  }
  if (!row && !shadow) throw new Error("Missing reviewItemId or shadowPostId.");
  return { row, shadow };
}

/** Inserts the review row for a shadow-only tweet (or finds the one a sync created since). */
async function ensureReviewRowForShadow(supabase: any, shadow: ShadowRow, parse: TrainerParse): Promise<ReviewRow> {
  const dedupeKey = buildTweetPatternReviewDedupeKey({
    sourceKey: shadow.source_key,
    sourceAccount: shadow.source_account,
    tweetId: shadow.tweet_id,
    tweetUrl: shadow.link_to_tweet,
    sourceRowKey: shadow.id
  });
  const { data: existing, error: existingError } = await supabase
    .from("tweet_pattern_review_items")
    .select(REVIEW_COLUMNS)
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return existing as ReviewRow;
  const { data, error } = await supabase
    .from("tweet_pattern_review_items")
    .insert({
      dedupe_key: dedupeKey,
      source_table: "x_timeline_shadow_posts",
      source_row_key: shadow.id,
      source_group: shadow.source_group,
      source_key: shadow.source_key,
      source_account: shadow.source_account,
      source_handle: handleOf(shadow.original_author_handle ?? shadow.author_handle),
      source_created_at: shadow.tweet_created_at,
      tweet_id: shadow.tweet_id,
      tweet_url: shadow.link_to_tweet,
      source_url: shadow.link_to_tweet,
      quoted_tweet_id: shadow.quoted_tweet_id,
      team_id: parse.teamId,
      team_abbreviation: parse.teamAbbreviation,
      parser_classification: parse.classification,
      parser_filter_status: parse.filterStatus,
      parser_filter_reason: parse.filterReason,
      review_text: shadow.full_text ?? shadow.text,
      raw_text: shadow.text,
      quoted_text: shadow.quoted_text,
      metadata: { shadowPostId: shadow.id, shadowPostKind: shadow.post_kind }
    })
    .select(REVIEW_COLUMNS)
    .single();
  if (error) throw error;
  return data as ReviewRow;
}

/** Saves one verdict as an answer-key record. The parser is re-run server-side so the stored snapshot is exact. */
export async function saveTrainerVerdict(args: {
  supabase: any;
  reviewItemId?: string | null;
  shadowPostId?: string | null;
  verdict: "correct" | "wrong";
  correction?: TrainerExtraction | null;
  notes?: string | null;
}): Promise<{ reviewItemId: string; record: TweetAnswerKeyRecord }> {
  if (args.verdict === "wrong" && !args.correction) throw new Error("A wrong verdict needs the corrected answer.");
  const { row: loadedRow, shadow } = await loadCardForWrite(args.supabase, args);
  const input = inputFor(loadedRow, shadow);
  const parse = await cachedParse(args.supabase, input);
  const row = loadedRow ?? (await ensureReviewRowForShadow(args.supabase, shadow!, parse));
  const record = buildAnswerKeyRecord({
    verdict: args.verdict,
    tweetId: shadow?.tweet_id ?? row.tweet_id,
    input,
    parse,
    correction: args.correction ?? null,
    notes: args.notes ?? null
  });
  const assignments = assignmentsFromExtraction(record.expected);
  const nowIso = new Date().toISOString();
  const { error } = await args.supabase
    .from("tweet_pattern_review_items")
    .update({
      review_status: "reviewed",
      reviewed_category: record.expected.category,
      reviewed_subcategory: record.expected.subcategory,
      review_assignments: assignments,
      selected_highlights: [],
      notes: record.notes,
      metadata: { ...(row.metadata ?? {}), answerKey: record },
      reviewed_at: nowIso,
      updated_at: nowIso
    })
    .eq("id", row.id);
  if (error) throw error;
  return { reviewItemId: row.id, record };
}

/**
 * Queues a name from a card into the alias review queue and returns its id, so the card can resolve it through
 * /api/v1/db/player-name-aliases (which learns the alias for future mentions).
 */
export async function queueTrainerAliasName(args: {
  supabase: any;
  reviewItemId?: string | null;
  shadowPostId?: string | null;
  rawName: string;
  teamId: number | null;
  reason: "trainer_wrong_match" | "trainer_near_match" | "trainer_unmatched";
}): Promise<{ unresolvedId: string }> {
  const rawName = args.rawName.trim();
  const normalizedName = normalizePlayerNameAlias(rawName);
  if (!normalizedName) throw new Error("Missing name.");
  const { row, shadow } = await loadCardForWrite(args.supabase, args);
  const input = inputFor(row, shadow);
  const tweetId = shadow?.tweet_id ?? row?.tweet_id ?? null;
  const dedupeKey = buildUnresolvedPlayerNameDedupeKey({ source: "tweet-trainer", tweetId, teamId: args.teamId, normalizedName });
  const { data: existing, error: existingError } = await args.supabase
    .from("lineup_unresolved_player_names")
    .select("id")
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return { unresolvedId: existing.id };
  const [occurrence] = findAliasReviewOccurrences(rawName, input.text);
  const { data, error } = await args.supabase
    .from("lineup_unresolved_player_names")
    .insert({
      dedupe_key: dedupeKey,
      source: "tweet-trainer",
      source_url: shadow?.link_to_tweet ?? row?.source_url ?? row?.tweet_url ?? null,
      tweet_id: tweetId,
      raw_name: rawName,
      normalized_name: normalizedName,
      team_id: args.teamId,
      context_text: input.text,
      status: "pending",
      metadata: {
        reason: args.reason,
        sourceKey: shadow?.source_key ?? row?.source_key ?? null,
        sourcePublishedAt: input.publishedAt,
        reviewItemId: row?.id ?? null,
        ...(occurrence ? { evidence: { start: occurrence.start, end: occurrence.end, text: occurrence.text, origin: "unique_token" } } : {})
      }
    })
    .select("id")
    .single();
  if (error) throw error;
  return { unresolvedId: data.id };
}
