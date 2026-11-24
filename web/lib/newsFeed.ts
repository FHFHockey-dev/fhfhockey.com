import { verifiedGameTimeDecision } from "./sources/reportedGameTimeDecision";
import { pendingNewsAssignments, readTweetNewsRosterEvidence } from "./sources/tweetNewsRosterEvidence";
import { clubRosterMoveLabel, hasMixedMedicalMoves, selectClubRosterMoves } from "./sources/reportedClubRosterMoves";
import { hasNonPlayerSubject } from "./sources/playerNameInProse";
import { getTeamLogoSvg, fallbackNHLLogo } from "lib/images";
import { teamsInfo } from "lib/teamsInfo";
import { canonicalAcronymMatches } from "./sources/tweetNameLexicon";
import { tweetPublicationFromUrl } from "./sources/tweetPublicationTime";
import { lineupReturnCaveat, qualifyStoredReturn, reportedLineupExpectation } from "./sources/lineupReturnEvidence";
import { reportedGameAbsence, reportedAbsenceDate } from "./sources/reportedGameAbsence";
import { reportedAbsenceDuration } from "./sources/tweetAbsenceDuration";
import { bilingualRosterPosition, bulletinFitsMatchup, pairedEventStatus, readBilingualGameReport } from "./sources/bilingualGameReport";
import { bilingualAbsenceBulletin } from "./sources/bilingualAbsenceBulletin";
import { expectedLineupBulletin, playingTonightSubjects } from "./sources/reportedLineupEntry";
import { publishedLineupGameId, selectPublishedNewsLineup, selectReportedLineupEntries, selectReportedGameAbsences, type NewsMatchup, type NewsLineupGame } from "./newsLineupRead";
import { getTeamMetaByAbbr } from "lib/dashboard/teamMetadata";
import type { TweetPlayerEvent } from "lib/sources/tweetPlayerEvents";
import type { TweetInterpretation } from "lib/sources/tweetInterpretation";

export type NewsFeedItemPlayer = {
  id: string;
  news_item_id: string;
  player_id: number | null;
  player_name: string;
  team_id: number | null;
  role: string;
};

export type NewsFeedItemRow = {
  id: string;
  source_review_item_id: string | null;
  source_tweet_id: string | null;
  source_url: string | null;
  tweet_url: string | null;
  source_label: string | null;
  source_account: string | null;
  team_id: number | null;
  team_abbreviation: string | null;
  headline: string;
  blurb: string;
  category: string;
  subcategory: string | null;
  card_status: "draft" | "published" | "archived";
  observed_at: string | null;
  published_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type NewsFeedItem = NewsFeedItemRow & {
  players: NewsFeedItemPlayer[];
  source_attribution?: PublicNewsSourceDecision;
  source_posted_at?: string | null;
  lineup_matchup?: NewsMatchup | null;
  reported_game_absences?: ReturnType<typeof selectReportedGameAbsences>;
  reported_roster_moves?: ReturnType<typeof selectClubRosterMoves>;
  reported_lineup_entries?: ReturnType<typeof selectReportedLineupEntries>;
};

/** Card text for the claim check: URLs stripped (the card blurb never shows them), whitespace collapsed. */
function claimText(value: string | null | undefined): string {
  return normalizeWhitespace(sanitizePublicNewsText(value).replace(/https?:\/\/\S+/gi, " "));
}

const NAME_SUFFIXES = new Set(["jr", "jr.", "sr", "sr.", "ii", "iii", "iv"]);

/** A player's surname: the last word of the name, skipping a suffix such as "Jr.". */
function claimSurname(playerName: string): string | null {
  const words = playerName.trim().split(/\s+/);
  while (words.length > 1 && NAME_SUFFIXES.has(words[words.length - 1]!.toLowerCase())) words.pop();
  return words.length > 1 ? words[words.length - 1]! : null;
}

function containsWord(text: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])${escaped}(?![\\p{L}\\p{M}\\p{N}])`, "u").test(text);
}

function withoutNameAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function sameReportSecond(observation: string | null | undefined, postedAt: string | null | undefined): boolean {
  return Boolean(observation && postedAt && Math.floor(Date.parse(observation) / 1000) === Math.floor(Date.parse(postedAt) / 1000));
}

/** Verify the spelling on an already-resolved, dated event. Keep the original evidence and offsets. */
function matchesAccentedSubject(event: TweetPlayerEvent, name: string, postedAt: string | null): boolean {
  if (!Number.isSafeInteger(event.teamId) || event.teamId == null || event.teamId <= 0 || !sameReportSecond(event.times?.observation, postedAt)) return false;
  const { evidence } = event;
  if (!Number.isSafeInteger(evidence.start) || evidence.start < 0 || evidence.end !== evidence.start + evidence.text.length) return false;
  const subject = event.claimAnchor?.subjectSpan;
  const expected = withoutNameAccents(name);
  if (subject) {
    const from = subject.start - evidence.start;
    const to = subject.end - evidence.start;
    return Number.isSafeInteger(subject.start) && Number.isSafeInteger(subject.end) && from >= 0 && to <= evidence.text.length &&
      evidence.text.slice(from, to) === subject.text && withoutNameAccents(subject.text) === expected &&
      !/[\p{L}\p{M}\p{N}'’\-]$/u.test(evidence.text.slice(0, from)) &&
      !/^[\p{L}\p{M}\p{N}'’\-]/u.test(evidence.text.slice(to));
  }
  // Older events can omit the anchor. Only the opening name of the exact clause qualifies.
  const clause = withoutNameAccents(evidence.text);
  return clause.startsWith(expected) && /^[ \t]/u.test(clause.slice(expected.length));
}

export function getPublicNewsClaimPresentation(
  item: Pick<NewsFeedItem, "headline" | "blurb" | "metadata" | "source_attribution"> &
    Partial<Pick<NewsFeedItem, "reported_game_absences" | "source_url" | "source_posted_at" | "source_tweet_id">> & { players?: Array<Partial<NewsFeedItemPlayer>> | null },
) {
  const interpretation = item.metadata?.interpretation as Record<string, unknown> | undefined;
  const storedEvents = interpretation?.events;
  const events = Array.isArray(storedEvents) ? storedEvents.filter(event => !hasNonPlayerSubject(event, item.blurb ?? "")) : storedEvents;
  const unresolved = interpretation?.unresolved;
  const sourceText = claimText(item.blurb);
  const claims: TweetPlayerEvent[] = [];
  const unverified = { headline: "Source report", claims: [] as TweetPlayerEvent[], unresolvedReason: "Subject-to-claim evidence unavailable" as string | null };
  // No interpretation: nothing was checked, so no claim and no "couldn't verify" line.
  if (!interpretation || typeof interpretation !== "object") return { ...unverified, unresolvedReason: null };
  if (item.source_attribution?.state === "conflict") return unverified;
  // An interpretation that is malformed or leaves names unresolved fails the check.
  if (typeof interpretation.version !== "string" || !Array.isArray(events) || !Array.isArray(unresolved) || unresolved.length > 0) {
    return unverified;
  }
  // The card's player context for the surname rule: every player its events and its player rows name.
  const contextPlayers = [
    ...events.map((candidate) => candidate as Partial<TweetPlayerEvent> | null)
      .map((event) => ({ id: event?.playerId ?? null, name: typeof event?.playerName === "string" ? event.playerName : null })),
    ...(item.players ?? []).map((player) => ({ id: player?.player_id ?? null, name: player?.player_name ?? null })),
  ].filter((player): player is { id: number | null; name: string } => typeof player.name === "string" && Boolean(player.name.trim()));
  // The evidence names the player in full, or by a surname no other player in the card's context shares (TJ,
  // 2026-11-09). The event must carry a resolved playerId, which the check below already requires.
  const postedAt = item.source_posted_at ?? tweetPublicationFromUrl(item.source_url ?? null);
  const nameKey = (name: string) => withoutNameAccents(name).toLowerCase();
  const namesPlayer = (evidence: string, event: TweetPlayerEvent) => {
    const fullName = sanitizePublicNewsText(event.playerName);
    if (containsWord(evidence, fullName) || (event.resolutionBasis === "full_name" && matchesAccentedSubject(event, fullName, postedAt))) {
      return !contextPlayers.some(other => other.id !== event.playerId && nameKey(other.name) === nameKey(fullName));
    }
    const hit = event.uniqueInitials;
    if (hit && event.resolutionBasis === "alias" && event.times?.observation && Number.isFinite(Date.parse(event.times.observation))
      && hit.playerId === event.playerId && hit.teamId === event.teamId && Number.isSafeInteger(hit.teamId)
      && typeof hit.text === "string" && canonicalAcronymMatches(hit.text, fullName)
      && Number.isInteger(hit.start) && Number.isInteger(hit.end) && hit.start >= event.evidence.start && hit.end <= event.evidence.end
      && event.evidence.text.slice(hit.start - event.evidence.start, hit.end - event.evidence.start) === hit.text
      && containsWord(evidence, hit.text) && item.players?.some(player => player.player_id === hit.playerId
        && player.team_id === hit.teamId && player.player_name === event.playerName)) return true;
    const surname = claimSurname(fullName);
    if (!surname || !(containsWord(evidence, surname) ||
      (event.resolutionBasis === "surname" && matchesAccentedSubject(event, surname, postedAt)))) return false;
    return !contextPlayers.some((other) => other.id !== event.playerId &&
      nameKey(claimSurname(sanitizePublicNewsText(other.name)) ?? "") === nameKey(surname));
  };
  for (const candidate of events) {
    const event = candidate as TweetPlayerEvent | null;
    const states = event?.kind === "goalie" ? ["projected", "likely", "confirmed", "ruled_out"]
      : event?.kind === "injury" ? ["new_injury", "ongoing", "setback", "possible_return", "confirmed_return", "unknown"]
      : event?.kind === "participation" ? ["observed", "projected", "will_play", "ruled_out", "game_time_decision"] : [];
    if (!event || !Number.isSafeInteger(event.playerId) || event.playerId <= 0 ||
      typeof event.playerName !== "string" || !sanitizePublicNewsText(event.playerName).trim() || event.reviewReason ||
      (event.observation != null && !["warmup", "first_off", "practice"].includes(event.observation)) ||
      !states.includes(event.state) || !["out", "available", "uncertain", "unknown"].includes(event.availability) ||
      !["tentative", "negated", "affirmative", "observation"].includes(event.modality ?? "") ||
      typeof event.evidence?.text !== "string" || !claimText(event.evidence.text) ||
      !sourceText.includes(claimText(event.evidence.text)) ||
      !namesPlayer(claimText(event.evidence.text), event) ||
      (["confirmed", "confirmed_return"].includes(event.state) && event.modality !== "affirmative")) {
      return unverified;
    }
    if (event.state === "game_time_decision" && (item.source_attribution?.state !== "resolved"
      || !sameReportSecond(event.times?.observation, item.source_posted_at)
      || !verifiedGameTimeDecision(event, item.blurb ?? "", true))) continue;
    if (event.translatedEvidence) {
      const pair = readBilingualGameReport(item.blurb ?? "")?.pairs.find(p => p.name === event.playerName);
      if (!pair || pair.status !== pairedEventStatus(event) || !event.teamId || !sameReportSecond(event.times?.observation, postedAt)
        || !event.effectiveDate || event.effectiveDate !== reportedAbsenceDate(postedAt ?? null, event.teamId, "tonight")
        || event.evidence.text !== pair.english.evidence.text || event.translatedEvidence.text !== pair.french.evidence.text
        || event.claimAnchor?.subjectSpan.text !== pair.name || event.claimAnchor?.predicateSpan.text !== pair.english.predicate.text) return unverified;
    } else if (event.kind === "participation" && event.state === "ruled_out") return unverified;
    else if (event.kind === "participation" && event.state === "will_play") {
      const subjects = playingTonightSubjects(event.evidence.text, event.teamId);
      const identifies = (subject: string, name: string) => subject === name || subject === claimSurname(name);
      if (event.availabilityScope !== "game" || event.modality !== "affirmative" || event.availability !== "available" || event.observation
        || !sameReportSecond(event.times?.observation, postedAt) || !subjects.some(subject => identifies(subject, event.playerName))
        || !subjects.every(subject => contextPlayers.some(player => identifies(subject, player.name)))) return unverified;
    }
    if (event.kind === "participation" && event.state === "projected") {
      const source = item.blurb ?? "", anchor = event.claimAnchor;
      const at = source.indexOf(event.evidence.text), offset = (anchor?.subjectSpan.start ?? -1) - event.evidence.start;
      const expected = anchor && at >= 0 && at === source.lastIndexOf(event.evidence.text) && offset >= 0
        ? reportedLineupExpectation(source, at + offset, at + offset + anchor.subjectSpan.text.length) : null;
      if (expected?.status === "expected_in_lineup" && expected.evidence.text === event.evidence.text
        && expected.subjectSpan.text === anchor?.subjectSpan.text && expected.predicateSpan.text === anchor?.predicateSpan.text
        && event.modality === "tentative" && event.availability === "uncertain" && !event.observation
        && item.source_attribution?.state === "resolved" && sameReportSecond(event.times?.observation, postedAt)
        && item.players?.some(row => row.player_id === event.playerId && row.team_id === event.teamId && row.player_name === event.playerName)) {
        claims.push({ ...event, playerName: sanitizePublicNewsText(event.playerName) });
        continue;
      }
      const report = expectedLineupBulletin((item.blurb ?? "").trim());
      const bulletinTime = tweetPublicationFromUrl(`https://x.com/i/web/status/${item.source_tweet_id}`);
      if (!report || report.fullName !== event.playerName || report.evidence.text !== event.evidence.text
        || event.evidence.start !== 0 || event.evidence.end !== report.evidence.end || event.observation
        || !Number.isSafeInteger(event.teamId) || !sameReportSecond(event.times?.observation, bulletinTime)
        || event.modality !== "tentative" || event.availability !== "uncertain" || event.availabilityScope !== "game"
        || !item.players?.some(row => row.player_id === event.playerId && row.team_id === event.teamId && row.player_name === event.playerName)) return unverified;
    }
    if (event.kind === "injury" && event.state === "confirmed_return") {
      const qualified = qualifyStoredReturn(event, item.blurb ?? "");
      if (qualified !== event) {
        if (qualified && item.source_attribution?.state === "resolved" && sameReportSecond(event.times?.observation, postedAt)
          && Number.isSafeInteger(event.teamId) && (qualified.state === "possible_return" && qualified.claimAnchor?.subjectSpan.text === event.playerName
            || item.players?.some(row => row.player_id === event.playerId && row.team_id === event.teamId && row.player_name === event.playerName))) {
          claims.push({ ...qualified, playerName: sanitizePublicNewsText(event.playerName) });
        }
        continue;
      }
      const excerpt = claimText(event.evidence.text);
      // Some old events start immediately after the reporter's hedge. Recover it
      // only when the literal excerpt still occupies its original coordinates.
      const prefixes = sourceText.split(excerpt).slice(0, -1);
      if (prefixes.some(prefix => lineupReturnCaveat(excerpt, prefix) === "tentative")) {
        const { start, end, text } = event.evidence;
        const blurb = item.blurb ?? "";
        const hedge = blurb.slice(0, start).match(/\blooks?\s+like\s*$/i);
        if (prefixes.length === 1 && sameReportSecond(event.times?.observation, postedAt)
          && Number.isSafeInteger(start) && start >= 0 && end === start + text.length && blurb.slice(start, end) === text
          && (hedge || lineupReturnCaveat(text) === "tentative")) {
          const from = hedge?.index ?? start;
          claims.push({ ...event, playerName: sanitizePublicNewsText(event.playerName), state: "possible_return",
            modality: "tentative", availability: "uncertain", evidence: { ...event.evidence, start: from, text: blurb.slice(from, end) } });
        }
        continue;
      }
      if (lineupReturnCaveat(excerpt) === "unknown_timeline") {
        claims.push({ ...event, playerName: sanitizePublicNewsText(event.playerName), state: "unknown", availability: "unknown" });
        continue;
      }
    }
    const missed = event.kind === "injury" && item.reported_game_absences?.find(a => a.playerId === event.playerId && a.start === event.evidence.start);
    const playerName = sanitizePublicNewsText(event.playerName);
    if (missed) {
      claims.push({ ...event, ...missed.fields, playerName, times: { ...event.times!, reference: missed.fields.effectiveDate } });
    } else if (event.kind === "injury" && event.state === "possible_return" && event.evidence.text.startsWith(playerName + " ")
      && reportedGameAbsence(event.evidence.text, 0, playerName.length)) {
      // A legacy chip can say “Possible return” when the only play predicate in its evidence is negative.
      claims.push({ ...event, playerName, state: "ongoing", availability: "uncertain", modality: "tentative" });
    } else claims.push({ ...event, playerName });
  }
  // A valid interpretation with no player events has nothing to verify.
  return {
    headline: claims.length === 1 ? `${claims[0].playerName} source report` : "Source report",
    claims,
    unresolvedReason: null,
  };
}

/** Labels what the passage discusses, not whether an event happened or a player is resolved. */
export function getPublicNewsReportTopic(item: Pick<NewsFeedItem, "blurb">): string {
  const text = sanitizePublicNewsText(item.blurb)
    .replace(/^RT\s+@[A-Za-z0-9_]+:\s*/i, "")
    .replace(/https?:\/\/\S+|@[A-Za-z0-9_]+/gi, "");
  const topics = [
    ["Trade", /\btrad(?:e|ed|es|ing)\b/i],
    ["Contract", /\b(?:contract|extension|re-sign(?:ed|ing)?|get (?:him|her|them) signed|signed (?:a|an|with|for)|completed a signing)\b/i],
    ["Transaction", /\b(?:waivers?|(?:was |been |being )recalled|(?:re)?assigned to|released from (?:his|her|the) contract|transaction)\b/i],
    ["Injury", /\b(?:injur(?:y|ies|ed)|concussion|surgery|upper[- ]body|lower[- ]body|day[- ]to[- ]day)\b/i],
    ["Lineup", /\b(?:lineup|line combinations?|defen[sc]e pairs?|starts? in (?:net|goal)|starting (?:goalie|goaltender)|power[- ]play|practice lines?)\b/i],
    ["Availability", /\b(?:out tonight|won['’]t play|will not play|scratched|unavailable|available tonight)\b/i],
  ] as const;
  const labels = topics.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
  return labels.length ? `${labels.join(" / ")} report` : "Report";
}

export type NewsFeedSourceProvenance = {
  parser_filter_status?: string | null;
  review_status?: string | null;
  review_assignments?: unknown[] | null;
  raw_text?: string | null;
  enriched_text?: string | null;
  quoted_text?: string | null;
  review_text?: string | null;
  source_handle?: string | null;
  author_name?: string | null;
  source_url?: string | null;
  tweet_url?: string | null;
  quoted_tweet_url?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type PublicNewsSourceAttribution = {
  displayName: string | null;
  account: string | null;
  url: string | null;
};

// Public display transport only; this is never claim or publication authority.
export type PublicNewsSourceDecision = PublicNewsSourceAttribution & {
  version: "public-news-source-v1";
  state: "resolved" | "unavailable" | "conflict";
  basis: "quote" | "text" | "post" | null;
};

export type NewsFeedKeywordPhrase = {
  id: string;
  source_review_item_id: string | null;
  source: string;
  phrase: string;
  normalized_phrase: string;
  scope_key: string;
  category: string | null;
  subcategory: string | null;
  notes: string | null;
  status: "active" | "ignored";
  created_at: string;
  updated_at: string;
};

export type PlayerNewsFlag = {
  category: string;
  subcategory: string | null;
  label: string;
  headline: string;
  sourceUrl: string | null;
  publishedAt: string | null;
  tone: "danger" | "success" | "info" | "warning" | "neutral";
};

export type TeamOption = {
  id: number;
  abbreviation: string;
  name: string;
  shortName: string;
  primaryColor: string;
  secondaryColor: string;
  accent: string;
  logoUrl: string;
};

export function normalizeNewsTeamId(
  teamId: number | null | undefined,
  validTeamIds: ReadonlySet<number>,
): number | null {
  return typeof teamId === "number" && validTeamIds.has(teamId) ? teamId : null;
}

export function resolveAutomatedNewsCardStatus(args: {
  existingStatus: "draft" | "published" | "archived" | null | undefined;
  candidateStatus: "draft" | "published";
}): "draft" | "published" | "archived" {
  return args.existingStatus === "published" || args.existingStatus === "archived"
    ? args.existingStatus
    : args.candidateStatus;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

const NEWS_RELAY_HANDLES = new Set([
  "cccmiddleton",
  "linescccmiddleton",
  "gamedaygoalies",
  "gamedaylines",
  "gamedaynewsnhl",
  "gamedaystatsnhl",
  "dfofantasy",
  "nhl_rosters",
  "gdl", "gdg", "gdnnhl", "ccc", "gdl_suite", "ifttt", "source_account",
]);

const NEWS_RELAY_MENTION_PATTERN =
  /@?(?:CcC\s*Middleton|Lines\s*CcC\s*Middleton|Game\s*Day\s*Goalies|Game\s*Day\s*Lines|Game\s*Day\s*News\s*NHL|NHL\s*Game\s*Day\s*News|Game\s*Day\s*Stats\s*NHL|DFOFantasy|NHL_Rosters)/gi;

const NEWS_RELAY_BYLINE_PATTERN =
  /\s*[—–-]\s*(?:CcC\s*Middleton|Lines\s*CcC\s*Middleton|Game\s*Day\s*Goalies|Game\s*Day\s*Lines|Game\s*Day\s*News\s*NHL|NHL\s*Game\s*Day\s*News|Game\s*Day\s*Stats\s*NHL)(?:\s*\([^)]*\))?(?:\s+[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})?\s*$/gi;

function normalizeSourceHandle(value: string | null | undefined): string | null {
  const normalized = value?.trim().replace(/^@/, "").toLowerCase();
  return normalized || null;
}

export function isNewsRelayAccount(
  value: string | null | undefined,
): boolean {
  const normalized = normalizeSourceHandle(value);
  return normalized ? NEWS_RELAY_HANDLES.has(normalized) : false;
}

export function sanitizePublicNewsText(
  value: string | null | undefined,
): string {
  if (isNewsRelayAccount(value)) return "";
  return normalizeWhitespace(
    String(value ?? "")
      // Quote-tweet captures arrive as "Wrapper text\n…\n\nQuoted text\n…"
      // (lib/sources/tweetPatternReview.ts); fans see the post followed by
      // the quoted post as plain sentences, no label (TJ, 2026-11-15).
      .replace(/^\s*Wrapper text\s+/i, "")
      .replace(/([.!?])?\s+Quoted text\s+/i, (_match, end?: string) => `${end ?? "."} `)
      .replace(NEWS_RELAY_BYLINE_PATTERN, "")
      .replace(NEWS_RELAY_MENTION_PATTERN, "")
      .replace(/\s+([,.;:!?])/g, "$1")
      .replace(/(?:^|\s)(?:via|from|by)\s*(?=$|[,.])/gi, " ")
      .replace(/^\s*[:;,\-–—]+\s*/, ""),
  );
}

export function getPublicNewsItemDetails(
  item: Pick<
    NewsFeedItemRow,
    "headline" | "blurb" | "metadata" | "category" | "subcategory"
  >,
): string {
  const automation = item.metadata?.automation;
  const summary =
    automation && typeof automation === "object"
      ? (automation as Record<string, unknown>).summary
      : null;
  const category = normalizeNewsCategory(item.category);
  const subcategory = normalizeNewsCategory(item.subcategory);
  const isLineupCard =
    category === "LINEUP" ||
    category === "LINE COMBINATION" ||
    category === "PRACTICE LINES" ||
    subcategory === "LINEUP" ||
    subcategory === "PRACTICE LINES" ||
    subcategory === "FORWARD LINES" ||
    subcategory === "DEFENSE PAIRS";
  const candidates = isLineupCard
    ? [item.blurb, item.headline]
    : [summary, item.blurb, item.headline];

  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const sanitized = normalizeWhitespace(
      sanitizePublicNewsText(candidate)
        .replace(/^RT\s+@[A-Z0-9_]+:\s*/i, "")
        .replace(/(?:https?:\/\/|pic\.twitter\.com\/)\S+/gi, ""),
    );
    if (sanitized) return sanitized;
  }

  return "News update";
}

function parseTweetUrl(value: string | null | undefined): {
  handle: string | null;
  tweetId: string | null;
} {
  if (!value) return { handle: null, tweetId: null };
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password ||
      !/^(?:(?:www|mobile)\.)?(?:x|twitter)\.com$/i.test(url.hostname)) {
      return { handle: null, tweetId: null };
    }
    const identityOnly = url.pathname.match(/^\/i\/web\/status\/(\d+)(?:\/|$)/i);
    if (identityOnly) return { handle: null, tweetId: identityOnly[1] };
    const match = url.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/(?:status|statuses)\/(\d+)(?:\/|$)/i);
    const handle = match?.[1] && match[1].toLowerCase() !== "i" ? match[1] : null;
    return { handle, tweetId: match?.[2] ?? null };
  } catch {
    return { handle: null, tweetId: null };
  }
}

function readMetadataString(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function firstOriginalHandle(
  values: Array<string | null | undefined>,
): string | null {
  for (const value of values) {
    const handle = typeof value === "string" ? value.trim().replace(/^@/, "") || null : null;
    if (handle && /^[A-Za-z0-9_]{1,15}$/.test(handle) &&
      !/^(?:i|null|undefined|unknown|none|n_?a|source_account)$/i.test(handle) &&
      !isNewsRelayAccount(handle)) {
      return handle;
    }
  }
  return null;
}

function safeOriginalSourceUrl(
  value: string | null | undefined,
  originalHandle: string | null,
  verifiedOriginal = false,
): string | null {
  if (typeof value !== "string" || !value || NEWS_RELAY_MENTION_PATTERN.test(value)) {
    NEWS_RELAY_MENTION_PATTERN.lastIndex = 0;
    return null;
  }
  NEWS_RELAY_MENTION_PATTERN.lastIndex = 0;

  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
  } catch {
    return null;
  }

  const parsed = parseTweetUrl(value);
  if (parsed.handle && isNewsRelayAccount(parsed.handle)) return null;
  if (parsed.handle && !firstOriginalHandle([parsed.handle])) return null;
  if (!parsed.handle && parsed.tweetId) {
    return verifiedOriginal && originalHandle ? `https://x.com/${originalHandle}/status/${parsed.tweetId}` : null;
  }
  return value;
}

function unresolvedPublicNewsSource(state: "unavailable" | "conflict" = "unavailable"): PublicNewsSourceDecision {
  return { version: "public-news-source-v1", state, basis: null, displayName: "Source link pending", account: null, url: null };
}

function readPublicNewsSourceDecision(value: unknown): PublicNewsSourceDecision {
  const pending = unresolvedPublicNewsSource();
  if (!value || typeof value !== "object") return pending;
  const decision = value as Partial<PublicNewsSourceDecision>;
  if (decision.version !== "public-news-source-v1") return pending;
  if (decision.state === "conflict") return unresolvedPublicNewsSource("conflict");
  if (decision.state !== "resolved" || !["quote", "text", "post"].includes(decision.basis ?? "")) return pending;
  const handle = firstOriginalHandle([typeof decision.account === "string" ? decision.account : null]);
  if (!handle || (decision.displayName !== null && typeof decision.displayName !== "string") ||
    (decision.url !== null && typeof decision.url !== "string")) return pending;
  const post = parseTweetUrl(decision.url);
  if (decision.url && (!post.tweetId || post.handle?.toLowerCase() !== handle.toLowerCase() ||
    safeOriginalSourceUrl(decision.url, handle) !== decision.url)) return pending;
  return {
    version: "public-news-source-v1", state: "resolved", basis: decision.basis as "quote" | "text" | "post",
    displayName: sanitizePublicNewsText(decision.displayName) || null, account: `@${handle}`, url: decision.url,
  };
}

type PublicNewsSourceInput = {
  item: Pick<
    NewsFeedItemRow,
    | "source_label"
    | "source_account"
    | "source_url"
    | "tweet_url"
    | "metadata"
  > & { blurb?: string | null; source_attribution?: PublicNewsSourceDecision };
  provenance?: NewsFeedSourceProvenance | null;
};

export function getPublicNewsSourceAttribution(args: PublicNewsSourceInput): PublicNewsSourceAttribution {
  const { displayName, account, url } = resolvePublicNewsSourceDecision(args);
  return { displayName, account, url };
}

function resolvePublicNewsSourceDecision(args: PublicNewsSourceInput): PublicNewsSourceDecision {
  // Subsequent display passes preserve the loader's decision, including rejection.
  // Fresh loader records explicitly discard this transport field before resolution.
  if (args.provenance == null && args.item.source_attribution !== undefined) {
    return readPublicNewsSourceDecision(args.item.source_attribution);
  }
  const metadata = { ...args.provenance?.metadata, ...args.item.metadata };
  const quotedTweetUrl =
    args.provenance?.quoted_tweet_url ??
    readMetadataString(metadata, "quotedTweetUrl");
  const usesQuote = readMetadataString(metadata, "primaryTextSource") === "quoted_oembed";
  const selectedUrl = usesQuote ? quotedTweetUrl : args.provenance?.source_url ?? args.item.source_url ?? args.item.tweet_url;
  const selectedPost = parseTweetUrl(selectedUrl);
  const selectedHandle = selectedPost.handle;
  const claimedHandle = usesQuote ? readMetadataString(metadata, "quotedAuthorHandle")
    : args.provenance?.source_handle ?? args.item.source_account;
  const pending = unresolvedPublicNewsSource();
  const conflict = unresolvedPublicNewsSource("conflict");
  const originalHandle = firstOriginalHandle([selectedHandle]);
  const quotedHandle = firstOriginalHandle([claimedHandle]);
  const inconsistentPost = usesQuote && [args.provenance?.metadata, args.item.metadata].some(retained => {
    const id = readMetadataString(retained, "quotedTweetId");
    const url = readMetadataString(retained, "quotedTweetUrl");
    return Boolean(id && selectedPost.tweetId && id !== selectedPost.tweetId) ||
      Boolean(url && parseTweetUrl(url).tweetId !== selectedPost.tweetId);
  });
  if (usesQuote) {
    // An old review row can choose a longer quote while retaining the carrier's
    // player assignments. Its evidence clock identifies which report was read.
    const intakeField = readMetadataString(metadata, "originalPrimaryTextSource");
    const reading = (metadata.retainedInterpretation ?? metadata.interpretation) as Partial<TweetInterpretation> | undefined;
    const quoteTime = tweetPublicationFromUrl(selectedUrl);
    if (intakeField && intakeField !== "quoted_oembed") {
      const shown = claimText(args.item.blurb);
      const quote = args.provenance?.quoted_text;
      if (!shown || !quote || (shown !== claimText(quote) && shown !== claimText(newsReportBlurb(quote)))) return conflict;
      if (quoteTime && Array.isArray(reading?.events) && reading.events.some(event => event?.times?.observation &&
        Math.floor(Date.parse(event.times.observation) / 1000) !== Math.floor(Date.parse(quoteTime) / 1000))) return conflict;
    }
    // Compare retained evidence before the item metadata can override provenance.
    const retainedAuthors = [
      originalHandle,
      ...[args.provenance?.metadata, args.item.metadata].flatMap(retained => [
        firstOriginalHandle([readMetadataString(retained, "quotedAuthorHandle")]),
        firstOriginalHandle([parseTweetUrl(readMetadataString(retained, "quotedTweetUrl")).handle]),
      ]),
    ].filter((handle): handle is string => Boolean(handle));
    const inconsistentAuthor = new Set(retainedAuthors.map(handle => handle.toLowerCase())).size > 1;
    if (inconsistentAuthor || inconsistentPost) return conflict;
    if (!quotedHandle || (selectedUrl && !selectedPost.tweetId)) return pending;
    return {
      version: "public-news-source-v1", state: "resolved", basis: "quote",
      displayName: sanitizePublicNewsText(readMetadataString(metadata, "quotedAuthorName")) || null,
      account: `@${quotedHandle}`,
      url: safeOriginalSourceUrl(selectedUrl, quotedHandle, true),
    };
  }

  // Only grammatical attribution counts. An arbitrary @mention is not a byline.
  const text = args.item.blurb ?? "";
  const textAuthors = [
    text.match(/^\s*RT\s+@([A-Za-z0-9_]{1,15}):/i)?.[1],
    text.match(/^\s*(?:per|via|according to)\s+@([A-Za-z0-9_]{1,15})[:,]\s/i)?.[1],
    text.match(/\b(?:per|via)\s+@([A-Za-z0-9_]{1,15})\)?[.!]?\s*$/i)?.[1],
  ].map(handle => firstOriginalHandle([handle])).filter((handle): handle is string => Boolean(handle));
  if (new Set(textAuthors.map(handle => handle.toLowerCase())).size > 1) return conflict;
  const textAuthor = textAuthors[0];
  if (textAuthor) {
    if (originalHandle && originalHandle.toLowerCase() !== textAuthor.toLowerCase()) return conflict;
    const originalLinks = [selectedUrl, ...(text.match(/https?:\/\/[^\s<>]+/gi) ?? [])]
      .filter((value): value is string => typeof value === "string")
      .map(value => value.replace(/[),.!?;]+$/, ""))
      .filter(value => parseTweetUrl(value).handle?.toLowerCase() === textAuthor.toLowerCase());
    const originalIds = new Set(originalLinks.map(value => parseTweetUrl(value).tweetId));
    return {
      version: "public-news-source-v1", state: "resolved", basis: "text",
      displayName: null,
      account: `@${textAuthor}`,
      // A wrapper or identity-only URL is not proof of the original post ID.
      url: originalIds.size === 1 ? safeOriginalSourceUrl(originalLinks[0], textAuthor) : null,
    };
  }
  if (!originalHandle || !selectedPost.tweetId) return pending;
  if (claimedHandle && claimedHandle.replace(/^@/, "").toLowerCase() !== originalHandle.toLowerCase()) return conflict;
  const originalName = [args.provenance?.author_name, args.item.source_label].find(value =>
    Boolean(value?.trim()) && !isNewsRelayAccount(value) && sanitizePublicNewsText(value) !== "");
  const url = safeOriginalSourceUrl(selectedUrl, originalHandle);
  return url ? {
    version: "public-news-source-v1", state: "resolved", basis: "post",
    displayName: originalName ? sanitizePublicNewsText(originalName) : null,
    account: `@${originalHandle}`,
    url,
  } : pending;
}

function sanitizePublicMetadataValue(value: unknown): unknown {
  if (typeof value === "string") {
    if (NEWS_RELAY_MENTION_PATTERN.test(value)) {
      NEWS_RELAY_MENTION_PATTERN.lastIndex = 0;
      if (/^https?:\/\//i.test(value)) return null;
      const sanitized = sanitizePublicNewsText(value);
      return sanitized || null;
    }
    NEWS_RELAY_MENTION_PATTERN.lastIndex = 0;
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .map(sanitizePublicMetadataValue)
      .filter((item) => item != null);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, item]) => [key, sanitizePublicMetadataValue(item)])
        .filter(([, item]) => item != null),
    );
  }
  return value;
}

export function sanitizePublicNewsFeedItem(
  item: NewsFeedItem,
  provenance?: NewsFeedSourceProvenance | null,
): NewsFeedItem {
  const source = resolvePublicNewsSourceDecision({ item, provenance });
  return {
    ...item,
    source_attribution: source,
    headline: sanitizePublicNewsText(item.headline),
    blurb: sanitizePublicNewsText(item.blurb),
    source_label: source.displayName,
    source_account: source.account,
    source_url: source.url,
    tweet_url: source.url,
    // Raw ingest lineage remains in storage, never in the public display DTO.
    metadata: sanitizePublicMetadataValue(item.metadata ? {
      interpretation: item.metadata.interpretation,
      // Validated at render; raw text-split lineupCard strings never reach the public DTO.
      newsLineup: item.metadata.newsLineup,
      automation: item.metadata.automation && typeof item.metadata.automation === "object"
        ? { summary: (item.metadata.automation as Record<string, unknown>).summary } : undefined,
    } : null) as Record<
      string,
      unknown
    > | null,
  };
}

export function normalizeNewsText(value: string | null | undefined): string {
  return normalizeWhitespace(String(value ?? ""));
}

// The card has already qualified an absence from this game. Restore a clipped source
// only if all its medical events have one dated subject and still occupy their original bytes.
function completeMedicalBlurb(blurb: string, review: NewsFeedSourceProvenance, teamId: number | null,
  events: readonly TweetPlayerEvent[]) {
  if (!blurb.endsWith("...") || events.length < 2) return blurb;
  const roster = readTweetNewsRosterEvidence({ metadata: review.metadata ?? null, parser_filter_status: review.parser_filter_status ?? null,
    enriched_text: review.enriched_text ?? null, raw_text: review.raw_text ?? null, quoted_text: review.quoted_text ?? null });
  if (!roster?.publishedAt || roster.text.length > 600 || roster.reviewSpans.length
    || blurb !== sanitizePublicNewsText(newsReportBlurb(roster.text))) return blurb;
  for (const e of events) {
    if (e?.kind !== "injury" || e.reviewReason || e.observation || e.teamId !== teamId || e.resolutionBasis !== "full_name"
      || !sameReportSecond(e.times?.observation, roster.publishedAt) || !e.evidence || typeof e.evidence.text !== "string"
      || !e.evidence.text.startsWith(e.playerName + " ") || e.evidence.start < 0 || roster.text.slice(e.evidence.start, e.evidence.end) !== e.evidence.text) return blurb;
    const matches = roster.players.filter(p => p.fullName === e.playerName);
    if (matches.length !== 1 || matches[0]!.id !== e.playerId || matches[0]!.team_id !== teamId) return blurb;
  }
  return sanitizePublicNewsText(roster.text.replace(/https?:\/\/\S+/gi, ""));
}

function pendingAutomatedReview(review: NewsFeedSourceProvenance | undefined | null) {
  return review?.review_status === "pending" && (review.review_assignments == null ||
    Array.isArray(review.review_assignments) && review.review_assignments.every(value => {
    const a = value as { id?: string; ruleId?: string } | null;
    return a?.ruleId && a.id === `auto-${a.ruleId}`;
  }));
}

// The source and current review must still support every machine-generated translated event.
function retainReviewedBilingualEvents(item: NewsFeedItemRow, publicItem: NewsFeedItem, review: NewsFeedSourceProvenance | null,
  game: NewsLineupGame | undefined) {
  const interpretation = publicItem.metadata?.interpretation as Partial<TweetInterpretation> | undefined;
  if (!Array.isArray(interpretation?.events) || !interpretation.events.some(e => e?.translatedEvidence)) return;
  const evidence = review && readTweetNewsRosterEvidence({ metadata: review.metadata ?? null, parser_filter_status: review.parser_filter_status ?? null,
    enriched_text: review.enriched_text ?? null, raw_text: review.raw_text ?? null, quoted_text: review.quoted_text ?? null });
  const url = evidence?.source === "quoted" ? review?.quoted_tweet_url : review?.source_url;
  const team = item.team_id;
  const opponent = team === game?.homeTeamId ? game?.awayTeamId : team === game?.awayTeamId ? game?.homeTeamId : null;
  const paired = evidence?.publishedAt && readBilingualGameReport(evidence.text);
  const author = parseTweetUrl(publicItem.source_url).handle;
  const allowed = review && (!review.review_text || review.review_text.trim() === evidence?.text) && pendingNewsAssignments(item.metadata, review) && paired && publicItem.source_url && url === publicItem.source_url
    && team && opponent && game && parseTweetUrl(url).tweetId === item.source_tweet_id && (!paired.wrapper || paired.wrapper.toLowerCase() === author?.toLowerCase())
    && sameReportSecond(evidence!.publishedAt, publicItem.source_posted_at)
    && bulletinFitsMatchup(paired.opponent, team, opponent, author, evidence!.publishedAt!);
  interpretation.events = interpretation.events.filter(e => {
    if (!e?.translatedEvidence) return true;
    const players = evidence?.players.filter(p => p.fullName === e.playerName);
    const pair = paired && paired.pairs.find(p => p.name === e.playerName);
    return allowed && pair && e.effectiveDate === game.date && e.teamId === team
      && players?.length === 1 && players[0]!.id === e.playerId && players[0]!.team_id === team
      && bilingualRosterPosition(pair, [players[0]!.position ?? ""])
      && pair.english.subject.start === e.claimAnchor?.subjectSpan.start && pair.english.predicate.start === e.claimAnchor?.predicateSpan.start
      && pair.french.evidence.start === e.translatedEvidence.start && pair.french.evidence.text === e.translatedEvidence.text
      && ![pair.french, pair.english].some(c => evidence!.reviewSpans.some(r => r.start < c.subject.end && c.subject.start < r.end));
  });
}

function readCardRosterMoves(item: Pick<NewsFeedItem, "blurb" | "source_tweet_id" | "team_id" | "metadata">,
  review: NewsFeedSourceProvenance | undefined | null, url: string | null) {
  if (!url || !review || !hasMixedMedicalMoves(item.blurb) || !pendingNewsAssignments(item.metadata, review)) return [];
  const roster = readTweetNewsRosterEvidence({ metadata: review.metadata ?? null, parser_filter_status: review.parser_filter_status ?? null,
    raw_text: review.raw_text ?? null, enriched_text: review.enriched_text ?? null, quoted_text: review.quoted_text ?? null });
  if (!roster || (roster.source === "quoted" ? review.quoted_tweet_url : review.source_url) !== url
    || sanitizePublicNewsText(newsReportBlurb(roster.text)) !== sanitizePublicNewsText(item.blurb)) return [];
  return selectClubRosterMoves(roster, item.team_id, url, item.source_tweet_id);
}

export function newsReportBlurb(text: string): string {
  const normalized = normalizeNewsText(text).replace(/https?:\/\/\S+/gi, "").trim();
  if (normalized.length > 280 && normalized.length <= 600 && bilingualAbsenceBulletin(normalized)?.reports.length) return normalized;
  return normalized.length > 280 ? `${normalized.slice(0, 277)}...` : normalized;
}

export function normalizeNewsCategory(value: string | null | undefined): string {
  return normalizeNewsText(value).replace(/[_-]+/g, " ").toUpperCase();
}

const NEWS_CLAIM_STATE_LABELS: Record<string, Record<string, string>> = {
  injury: {
    new_injury: "New injury",
    ongoing: "Injured",
    setback: "Setback",
    possible_return: "Possible return",
    confirmed_return: "Returning",
    unknown: "Status unknown",
  },
  goalie: {
    projected: "Projected starter",
    likely: "Likely starter",
    confirmed: "Confirmed starter",
    ruled_out: "Not starting",
  },
};
const NEWS_CLAIM_OBSERVATION_LABELS: Record<string, string> = {
  warmup: "In warmups",
  first_off: "First off the ice",
  practice: "At practice",
};

const NEWS_BACKUP_STATE_LABELS: Record<string, string> = {
  projected: "Projected backup",
  likely: "Likely backup",
  confirmed: "Confirmed backup",
};

/** Fan-facing label for a checked claim: "Status unknown", not "Unknown report". */
export function formatNewsClaimLabel(claim: {
  kind: string;
  state: string;
  goalieRole?: TweetPlayerEvent["goalieRole"] | null;
  observation?: string | null;
} & Partial<Pick<TweetPlayerEvent, "playerId" | "playerName" | "evidence" | "times" | "modality" | "availability" | "availabilityScope" | "claimAnchor">>,
  item?: Pick<NewsFeedItem, "source_posted_at" | "blurb" | "reported_lineup_entries" | "reported_game_absences">, nextClaim?: TweetPlayerEvent): string {
  if (claim.kind === "participation") {
    if (claim.state === "ruled_out" && claim.availabilityScope === "game" && claim.availability === "out") return "Out for this game";
    if (claim.state === "game_time_decision" && claim.modality === "tentative" && claim.availability === "uncertain") return "Game-time decision";
    if (claim.state === "will_play") return "Will play tonight";
    if (claim.state === "projected" && claim.modality === "tentative" && claim.availability === "uncertain") return "Expected in lineup";
    if (!claim.observation && claim.availabilityScope === "game") return "Lineup participation reported";
    return (claim.observation && NEWS_CLAIM_OBSERVATION_LABELS[claim.observation]) || "Seen at the rink";
  }
  const missed = claim.kind === "injury" && item?.reported_game_absences?.find(a => a.playerId === claim.playerId && a.start === claim.evidence?.start);
  if (missed) return `Out ${missed.relative} · day-to-day`;
  let label = NEWS_CLAIM_STATE_LABELS[claim.kind]?.[claim.state] ?? formatNewsFeedLabel(claim.state);
  if (claim.kind === "goalie" && claim.goalieRole !== "starter") {
    // Older interpretations can have a certainty without a role.
    label = (claim.goalieRole === "backup" && NEWS_BACKUP_STATE_LABELS[claim.state]) || "Goalie status reported";
  }
  if (claim.kind === "injury" && claim.state === "unknown" && item && claim.evidence
    && lineupReturnCaveat(claim.evidence.text) === "unknown_timeline"
    && claimText(item.blurb).includes(claimText(claim.evidence.text))) return "No return timeline reported";
  // Unknown injury type can coexist with a precise availability statement.
  // Quote the reporter's wording, including its time scope, on the dated card.
  if (claim.kind === "injury" && claim.state === "unknown" && item && sameReportSecond(claim.times?.observation, item.source_posted_at)) {
    const { evidence, claimAnchor } = claim;
    const subject = claimAnchor?.subjectSpan?.text ?? claim.playerName;
    if (subject && claimAnchor?.predicateSpan?.text?.toLowerCase() !== "out" && evidence && evidence.text.startsWith(subject + " ")) {
      // News collapses newlines in its preview. Keep visible list markers as subject boundaries.
      const shown = (item.blurb ?? "").replace(/[ \t](?=[-•‼]\s*\p{Lu})/gu, "\n");
      const start = shown.indexOf(evidence.text);
      if (start >= 0 && start === shown.lastIndexOf(evidence.text)) {
        const absence = reportedAbsenceDuration(shown, start, start + subject.length);
        if (absence && absence.predicate.end <= start + evidence.text.length
          && (absence.tentative ? claim.modality === "tentative" && claim.availability === "uncertain"
            : claim.modality === "affirmative" && claim.availability === "out")) return `“${absence.predicate.text}”`;
      }
    }
    if (claim.modality === "affirmative" && claim.availability === "unknown" && claim.playerName && evidence
      && evidence.text === `injured ${claim.playerName}` && item.reported_lineup_entries?.some(entry => entry.playerId !== claim.playerId
        && claimText(item.blurb).includes(claimText(`${entry.evidence.text} for the ${evidence.text}`)))) return "Reported injured";
    if (claim.availability === "out" && claim.modality === "affirmative" && evidence &&
        Number.isSafeInteger(evidence.start) && evidence.start >= 0 && evidence.end === evidence.start + evidence.text.length &&
        claimAnchor?.subjectSpan && claimAnchor.predicateSpan) {
      const { subjectSpan, predicateSpan } = claimAnchor;
      const excerpt = claimText(evidence.text);
      const source = claimText(item.blurb);
      const start = source.indexOf(excerpt);
      const before = source.slice(0, start).trimEnd();
      const after = source.slice(start + excerpt.length).trimStart();
      // A clipped excerpt can omit a condition or an additional day.
      const startsEntry = !before || /[.!?;]$|(?:^|\s)[/-]$/u.test(before);
      const nextExcerpt = nextClaim?.playerId !== claim.playerId && claimText(nextClaim?.evidence.text);
      const endsEntry = !after || /[.!?;]$/u.test(excerpt) || /^(?:[/-]\s*\p{Lu})/u.test(after) ||
        (nextExcerpt && after.startsWith(nextExcerpt));
      if (start >= 0 && start === source.lastIndexOf(excerpt) && startsEntry && endsEntry &&
          subjectSpan.start === evidence.start && subjectSpan.end > subjectSpan.start && subjectSpan.end <= predicateSpan.start &&
          evidence.text.slice(0, subjectSpan.end - evidence.start) === subjectSpan.text &&
          evidence.text.slice(predicateSpan.start - evidence.start, predicateSpan.end - evidence.start) === predicateSpan.text &&
          /^out$/i.test(predicateSpan.text)) {
        return `“${claimText(evidence.text.slice(subjectSpan.end - evidence.start))}”`;
      }
    }
    if (claim.availability === "unknown" || claim.availability === "out") return "Source report";
  }
  return claim.observation && NEWS_CLAIM_OBSERVATION_LABELS[claim.observation]
    ? `${label} · ${NEWS_CLAIM_OBSERVATION_LABELS[claim.observation].toLowerCase()}`
    : label;
}

export function formatNewsFeedLabel(value: string | null | undefined): string {
  return normalizeNewsCategory(value)
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

export function normalizeKeywordScopeKey(args: {
  phrase: string;
  category?: string | null;
  subcategory?: string | null;
}): string {
  const phrase = normalizeNewsText(args.phrase).toLowerCase();
  const category = normalizeNewsCategory(args.category).toLowerCase();
  const subcategory = normalizeNewsCategory(args.subcategory).toLowerCase();
  return [phrase, category, subcategory].join("::");
}

export function getTeamOptions(): TeamOption[] {
  return Object.values(teamsInfo)
    .map((team) => ({
      id: team.id,
      abbreviation: team.abbrev,
      name: team.name,
      shortName: team.shortName,
      primaryColor: team.primaryColor,
      secondaryColor: team.secondaryColor,
      accent: team.accent,
      logoUrl: getTeamLogoSvg(team.abbrev),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function getNewsItemTone(category: string | null | undefined): PlayerNewsFlag["tone"] {
  switch (normalizeNewsCategory(category)) {
    case "INJURY":
    case "WAIVER":
      return "danger";
    case "REPORTED INJURY":
      return "warning";
    case "RETURN":
    case "RETURNING":
      return "success";
    case "GOALIE START":
    case "LINE COMBINATION":
    case "LINE CHANGE":
      return "info";
    case "TRANSACTION":
    case "TRADE":
    case "SIGNING":
    case "NEWS UPDATE":
    case "ROSTER MOVE":
      return "warning";
    default:
      return "neutral";
  }
}

export function buildNewsFlagLabel(args: {
  category: string;
  subcategory?: string | null;
}): string {
  const category = formatNewsFeedLabel(args.category);
  const subcategory = formatNewsFeedLabel(args.subcategory);
  return subcategory ? `${category} · ${subcategory}` : category;
}

export function buildNewsFeedHeadline(args: {
  playerNames: string[];
  category?: string | null;
  subcategory?: string | null;
  teamAbbreviation?: string | null;
}): string {
  const category = normalizeNewsCategory(args.category);
  const subcategory = normalizeNewsCategory(args.subcategory);
  const primaryName = args.playerNames.find(Boolean)?.trim() ?? "";
  const team = args.teamAbbreviation?.trim() ?? "";

  if (category === "INJURY" && primaryName) return `${primaryName} injury update`;
  if (category === "REPORTED INJURY" && primaryName) return `${primaryName} reported injury`;
  if (category === "REPORTED INJURY" && team) return `${team} reported injury`;
  if (category === "NEWS UPDATE" && primaryName) return `${primaryName} news update`;
  if (category === "NEWS UPDATE" && team) return `${team} news update`;
  if ((category === "RETURN" || category === "RETURNING") && primaryName) {
    return `${primaryName} return update`;
  }
  if (category === "GOALIE START" && primaryName) return `${primaryName} goalie update`;
  if (category === "LINE COMBINATION" && team) return `${team} line combination update`;
  if (category === "LINE CHANGE" && team) return `${team} line change`;
  if ((category === "TRADE" || category === "SIGNING" || category === "ROSTER MOVE") && primaryName) {
    return `${primaryName} ${category.toLowerCase()}`;
  }
  if (category === "RETIREMENT" && primaryName) return `${primaryName} retires`;
  if (primaryName && category) return `${primaryName} ${category.toLowerCase()}`;
  if (team && category) return `${team} ${category.toLowerCase()}`;
  if (subcategory) return subcategory;
  return "Update";
}

export function getNewsItemTeamColors(teamAbbreviation: string | null | undefined) {
  const identity = getTeamMetaByAbbr(teamAbbreviation?.trim() ?? "");
  const team = identity ? teamsInfo[identity.abbr] : null;
  return {
    abbreviation: identity?.abbr ?? null,
    lineupPrimary: team?.primaryColor ?? "#56606c",
    lineupSecondary: team?.jersey ?? "#88939e",
    primary: team?.primaryColor ?? "#14a2d2",
    secondary: team?.secondaryColor ?? "#24282e",
    accent: team?.accent ?? "#14a2d2",
    stripe: team?.jersey ?? team?.secondaryColor ?? "#14a2d2",
    surface: team?.primaryColor ?? "#0b1821",
    logoUrl: team ? getTeamLogoSvg(team.abbrev) : fallbackNHLLogo,
    shortName: team?.shortName ?? teamAbbreviation ?? "NHL",
    name: team?.name ?? teamAbbreviation ?? "NHL",
  };
}

async function fetchReviewProvenance(supabase: any, reviewItemIds: string[], includeGameEvidence: boolean) {
  const provenanceByReviewItemId = new Map<string, NewsFeedSourceProvenance>();
  if (reviewItemIds.length > 0) {
    const { data: provenanceRows, error: provenanceError } = await supabase
      .from("tweet_pattern_review_items" as any)
      .select(
        "id, source_handle, author_name, source_url, tweet_url, quoted_tweet_url, quoted_text, metadata"
          + (includeGameEvidence ? ", raw_text, enriched_text, review_text, parser_filter_status, review_status, review_assignments" : ""),
      )
      .in("id", reviewItemIds);
    if (provenanceError) throw provenanceError;
    for (const row of (provenanceRows ?? []) as Array<
      NewsFeedSourceProvenance & { id: string }
    >) {
      provenanceByReviewItemId.set(row.id, row);
    }
  }
  return provenanceByReviewItemId;
}

export async function fetchNewsFeedItems(args: {
  supabase: any;
  status?: "draft" | "published" | "archived" | "all";
  limit?: number;
  categories?: string[];
  reviewItemId?: string | null;
}): Promise<NewsFeedItem[]> {
  let query = args.supabase
    .from("news_feed_items" as any)
    .select(
      "id, source_review_item_id, source_tweet_id, source_url, tweet_url, source_label, source_account, team_id, team_abbreviation, headline, blurb, category, subcategory, card_status, observed_at, published_at, metadata, created_at, updated_at"
    )
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(args.limit ?? 100);

  if (args.reviewItemId) {
    query = query.eq("source_review_item_id", args.reviewItemId);
  }
  if (args.status && args.status !== "all") {
    query = query.eq("card_status", args.status);
  }
  if (args.categories?.length) {
    query = query.in("category", args.categories);
  }

  const { data: itemRows, error: itemError } = await query;
  if (itemError) throw itemError;

  const items = (itemRows ?? []) as NewsFeedItemRow[];
  if (items.length === 0) return [];

  const gameIds = [...new Set(items.map(publishedLineupGameId).filter((id): id is number => id != null))];
  const reviewItemIds = items
    .map((item) => item.source_review_item_id)
    .filter((id): id is string => Boolean(id));
  const provenanceByReviewItemId = await fetchReviewProvenance(args.supabase, reviewItemIds,
    gameIds.length > 0 || items.some(item => hasMixedMedicalMoves(item.blurb)));

  const { data: playerRows, error: playerError } = await args.supabase
    .from("news_feed_item_players" as any)
    .select("id, news_item_id, player_id, player_name, team_id, role")
    .in(
      "news_item_id",
      items.map((item) => item.id)
    )
    .order("created_at", { ascending: true });
  if (playerError) throw playerError;

  const playersByItemId = new Map<string, NewsFeedItemPlayer[]>();
  for (const row of (playerRows ?? []) as NewsFeedItemPlayer[]) {
    const bucket = playersByItemId.get(row.news_item_id) ?? [];
    bucket.push(row);
    playersByItemId.set(row.news_item_id, bucket);
  }

  const games = new Map<number, NewsLineupGame>();
  if (gameIds.length) {
    const { data, error } = await args.supabase.from("games").select("id, date, homeTeamId, awayTeamId").in("id", gameIds);
    // A missing matchup leaves the source readable even when its lineup cannot be substantiated.
    if (!error) for (const game of data ?? []) games.set(game.id, game);
  }
  return items.map(item => {
    const review = item.source_review_item_id ? provenanceByReviewItemId.get(item.source_review_item_id) ?? null : null;
    const publicItem = sanitizePublicNewsFeedItem({
      ...item, source_attribution: undefined, players: playersByItemId.get(item.id) ?? [],
    }, review);
    publicItem.source_posted_at = tweetPublicationFromUrl(publicItem.source_url);
    retainReviewedBilingualEvents(item, publicItem, review, games.get(publishedLineupGameId(item) ?? -1));
    const moves = readCardRosterMoves(item, review, publicItem.source_url);
    if (moves.length) publicItem.reported_roster_moves = moves;
    const automation = item.metadata?.automation as { primaryRuleId?: string } | undefined;
    if (automation?.primaryRuleId === "transaction-roster-move" && hasMixedMedicalMoves(item.blurb) && pendingAutomatedReview(review)) {
      publicItem.players = publicItem.players.filter(p => moves.some(m => m.playerId === p.player_id));
      publicItem.headline = "Source report";
    }
    const gameId = publishedLineupGameId(item);
    if (gameId != null) {
      const game = games.get(gameId), originalId = parseTweetUrl(publicItem.source_url).tweetId;
      const selected = selectPublishedNewsLineup(item, game, review, originalId, publicItem.source_posted_at);
      if (game && selected.matchup && review && originalId && publicItem.source_url && publicItem.source_posted_at && publicItem.source_attribution?.state !== "conflict") {
        const entries = selectReportedLineupEntries(item, game, review, originalId, publicItem.source_url, publicItem.source_posted_at);
        if (entries.length) publicItem.reported_lineup_entries = entries;
        const events = (item.metadata?.interpretation as Partial<TweetInterpretation> | null)?.events;
        if (Array.isArray(events)) {
          const absences = selectReportedGameAbsences(item, game, review, publicItem.source_url, publicItem.source_posted_at, events);
          if (absences.length) {
            publicItem.reported_game_absences = absences;
            publicItem.blurb = completeMedicalBlurb(publicItem.blurb, review, item.team_id, events);
          }
        }
      }
      if (publicItem.metadata) publicItem.metadata.newsLineup = sanitizePublicMetadataValue(selected.newsLineup);
      publicItem.lineup_matchup = selected.matchup;
    }
    return publicItem;
  });
}

export async function fetchNewsFeedKeywordPhrases(args: {
  supabase: any;
  reviewItemId?: string | null;
  limit?: number;
}): Promise<NewsFeedKeywordPhrase[]> {
  let query = args.supabase
    .from("news_feed_keyword_phrases" as any)
    .select(
      "id, source_review_item_id, source, phrase, normalized_phrase, scope_key, category, subcategory, notes, status, created_at, updated_at"
    )
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(args.limit ?? 100);

  if (args.reviewItemId) {
    query = query.eq("source_review_item_id", args.reviewItemId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as NewsFeedKeywordPhrase[];
}

export async function fetchLatestPlayerNewsFlags(args: {
  supabase: any;
  playerIds: number[];
}): Promise<Map<number, PlayerNewsFlag>> {
  const playerIds = Array.from(new Set(args.playerIds.filter((id) => Number.isFinite(id))));
  if (playerIds.length === 0) return new Map();

  const { data: playerRows, error: playerError } = await args.supabase
    .from("news_feed_item_players" as any)
    .select("news_item_id, player_id")
    .in("player_id", playerIds);
  if (playerError) throw playerError;

  const itemIds = Array.from(
    new Set(
      (playerRows ?? [])
        .map((row: any) => row.news_item_id)
        .filter((value: unknown): value is string => typeof value === "string")
    )
  );
  if (itemIds.length === 0) return new Map();

  const { data: itemRows, error: itemError } = await args.supabase
    .from("news_feed_items" as any)
    .select("id, source_review_item_id, source_tweet_id, team_id, category, subcategory, headline, blurb, metadata, source_url, published_at, created_at, card_status")
    .in("id", itemIds)
    .eq("card_status", "published");
  if (itemError) throw itemError;

  const itemById = new Map<string, any>((itemRows ?? []).map((row: any) => [row.id, row]));
  const mixedQuoteReviews = [...new Set<string>((itemRows ?? []).filter((item: NewsFeedItemRow) =>
    item.source_review_item_id && item.metadata?.primaryTextSource === "quoted_oembed" &&
    item.metadata.originalPrimaryTextSource && item.metadata.originalPrimaryTextSource !== "quoted_oembed"
  ).map((item: NewsFeedItemRow) => item.source_review_item_id!))];
  const medicalReviews = (itemRows ?? []).filter((item: NewsFeedItemRow) => item.source_review_item_id && hasMixedMedicalMoves(item.blurb))
    .map((item: NewsFeedItemRow) => item.source_review_item_id!);
  const provenance = await fetchReviewProvenance(args.supabase, [...new Set<string>([...mixedQuoteReviews, ...medicalReviews])], medicalReviews.length > 0);
  const flags = new Map<number, PlayerNewsFlag>();

  const rows = ((playerRows ?? []) as Array<{ news_item_id: string; player_id: number | null }>).sort(
    (left, right) => {
      const leftItem = itemById.get(left.news_item_id);
      const rightItem = itemById.get(right.news_item_id);
      const leftTime = Date.parse(leftItem?.published_at ?? leftItem?.created_at ?? "");
      const rightTime = Date.parse(rightItem?.published_at ?? rightItem?.created_at ?? "");
      return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
    }
  );

  for (const row of rows) {
    if (!row.player_id || flags.has(row.player_id)) continue;
    const item = itemById.get(row.news_item_id);
    if (!item) continue;
    const source = resolvePublicNewsSourceDecision({ item, provenance: provenance.get(item.source_review_item_id) });
    if (source.state === "conflict") continue;
    if (hasMixedMedicalMoves(item.blurb)) {
      const move = readCardRosterMoves(item, provenance.get(item.source_review_item_id), source.url).find(m => m.playerId === row.player_id);
      if (move) {
        const label = clubRosterMoveLabel(move);
        flags.set(row.player_id, { category: "TRANSACTION", subcategory: "ROSTER MOVE", label,
          headline: `${move.playerName} · ${label}`, sourceUrl: source.url, publishedAt: item.published_at, tone: "neutral" });
        continue;
      }
      if (!source.url) continue;
    }
    const presentation = getPublicNewsClaimPresentation(item);
    const claim = presentation.claims.find(event => event.playerId === row.player_id);
    if (!claim) continue;
    // These flags follow the player's latest article across games.
    let reportLabel: string | null = null;
    if (claim.kind === "goalie" && claim.goalieRole !== "starter") {
      reportLabel = claim.goalieRole === "backup" && claim.state !== "ruled_out" ? "Backup report" : "Goalie report";
    }
    flags.set(row.player_id, {
      category: claim.kind.toUpperCase(),
      subcategory: reportLabel?.toUpperCase() ?? claim.state.toUpperCase(),
      label: reportLabel ?? `${formatNewsFeedLabel(claim.state)} report`,
      headline: presentation.headline,
      sourceUrl: source.url,
      publishedAt: Number.isFinite(Date.parse(item.published_at ?? "")) ? item.published_at : null,
      tone: "neutral",
    });
  }

  return flags;
}
