import { reportedGameAbsence, reportedAbsenceDate, gameAbsenceFields } from "./sources/reportedGameAbsence";
import type { TweetPlayerEvent } from "./sources/tweetPlayerEvents";
import { getTeamInfoById } from "./teamsInfo";
import { lineReportTimeScope } from "./sources/lineReportTime";
import type { NewsFeedItemRow, NewsFeedSourceProvenance } from "./newsFeed";
import { pendingNewsAssignments, readTweetNewsRosterEvidence } from "./sources/tweetNewsRosterEvidence";
import { reportedLineupEntries } from "./sources/reportedLineupEntry";
import type { EvidenceSpan } from "./sources/tweetInterpretation";

export type NewsLineupGame = { id: number; date: string; homeTeamId: number; awayTeamId: number };
export type NewsMatchup = { gameId: number; opponent: string };

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function publishedLineupGameId(item: NewsFeedItemRow): number | null {
  const snapshot = record(item.metadata?.newsLineup);
  const binding = record(snapshot?.binding);
  if (item.card_status !== "published" || snapshot?.version !== 1 || record(snapshot.interpretation)?.context !== "game"
    || !Number.isSafeInteger(item.team_id) || !binding || binding.teamId !== item.team_id) return null;
  return typeof binding.gameId === "number" && Number.isSafeInteger(binding.gameId) ? binding.gameId : null;
}

const easternDay = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });

/** Select existing units against the intact source before public blurb normalization loses headings and offsets. */
export function selectPublishedNewsLineup(item: NewsFeedItemRow, game: NewsLineupGame | undefined,
  review: NewsFeedSourceProvenance | null, originalId: string | null, sourcePostedAt: string | null) {
  const snapshot = record(item.metadata?.newsLineup);
  const interpretation = record(snapshot?.interpretation);
  const boundPost = record(snapshot?.binding)?.sourceTweetId;
  if (!game || !boundPost || (boundPost !== originalId && boundPost !== item.source_tweet_id)) return { newsLineup: null, matchup: null };
  const opponentId = game.homeTeamId === item.team_id ? game.awayTeamId : game.awayTeamId === item.team_id ? game.homeTeamId : null;
  const opponent = opponentId == null ? null : getTeamInfoById(opponentId)?.name;
  const matchup = opponent ? { gameId: game.id, opponent } : null;
  const usesQuote = (review?.metadata?.primaryTextSource ?? item.metadata?.primaryTextSource) === "quoted_oembed";
  const sourceText = (usesQuote ? review?.quoted_text : review?.enriched_text ?? review?.raw_text) ?? review?.review_text
    ?? (item.blurb?.includes("\n") && !item.blurb.endsWith("...") ? item.blurb : null);
  if (!matchup || !sourceText?.trim() || !interpretation || !Array.isArray(interpretation.units)) return { newsLineup: null, matchup: null };

  const sourceDay = sourcePostedAt ? easternDay.format(new Date(sourcePostedAt)) : "";
  const scope = lineReportTimeScope(sourceText);
  if (!scope) return { newsLineup: snapshot, matchup };
  // Relative claims require both their original post's Eastern date and the actual scheduled game date.
  if (game.date !== sourceDay) return { newsLineup: null, matchup: null };
  const retainedSpan = (value: unknown): value is EvidenceSpan => {
    const span = record(value);
    return !!span && typeof span.text === "string" && typeof span.start === "number" && typeof span.end === "number"
      && Number.isInteger(span.start) && Number.isInteger(span.end) && span.start >= 0 && span.end > span.start
      && sourceText.slice(span.start, span.end) === span.text;
  };
  const current = (value: unknown, structured: boolean) => retainedSpan(value) && scope.current(value, structured);
  const units = interpretation.units.filter(value => {
    const spans = record(value)?.evidence;
    return Array.isArray(spans) && spans.length > 0 && spans.every(span => current(span, true));
  });
  if (!units.length) return { newsLineup: null, matchup: null };
  const events = Array.isArray(interpretation.events) ? interpretation.events.filter(value => current(record(value)?.evidence, false)) : [];
  // A legacy extraction flag without a verifiable offset still blocks the unit it names.
  const unresolved = Array.isArray(interpretation.unresolved)
    ? interpretation.unresolved.filter(value => !retainedSpan(value) || scope.current(value, true)) : [];
  return { newsLineup: { ...snapshot, interpretation: { ...interpretation, units, events, unresolved } }, matchup };
}

/** Verify a reported entry against the published card's frozen change and the original dated intake receipt. */
export function selectReportedLineupEntries(item: NewsFeedItemRow, game: NewsLineupGame, review: NewsFeedSourceProvenance,
  originalId: string, sourceUrl: string, postedAt: string) {
  const snapshot = record(item.metadata?.newsLineup);
  const binding = record(snapshot?.binding);
  const retained = record(item.metadata?.retainedInterpretation);
  const identity = record(retained?.identityContext);
  if (!Number.isFinite(Date.parse(postedAt)) || typeof retained?.version !== "string" || identity?.basis !== "publication_roster" || typeof identity.sourcePublishedAt !== "string"
    || Math.floor(Date.parse(identity.sourcePublishedAt) / 1000) !== Math.floor(Date.parse(postedAt) / 1000)
    || record(snapshot?.interpretation)?.version !== retained?.version || publishedLineupGameId(item) !== game.id || binding?.sourceTweetId !== originalId
    || ![game.homeTeamId, game.awayTeamId].includes(item.team_id!) || game.date !== easternDay.format(new Date(postedAt))
    || review.review_status !== "pending" || (review.review_assignments != null && (!Array.isArray(review.review_assignments) || review.review_assignments.length > 0))
    || record(retained?.lineContext)?.context !== "game" || !Array.isArray(retained?.changes)) return [];
  const roster = readTweetNewsRosterEvidence({ metadata: review.metadata ?? null, parser_filter_status: review.parser_filter_status ?? null,
    enriched_text: review.enriched_text ?? null, raw_text: review.raw_text ?? null, quoted_text: review.quoted_text ?? null });
  const receiptUrl = roster?.source === "quoted" ? review.quoted_tweet_url : review.source_url;
  if (!roster?.publishedAt || Math.floor(Date.parse(roster.publishedAt) / 1000) !== Math.floor(Date.parse(postedAt) / 1000)
    || receiptUrl !== sourceUrl || lineReportTimeScope(roster.text)) return [];
  return reportedLineupEntries(roster.text, retained.changes, retained.events, game.homeTeamId === item.team_id ? game.awayTeamId : game.homeTeamId).filter(entry => {
    const players = roster.players.filter(player => player.fullName === entry.playerName);
    return players.length === 1 && players[0]!.id === entry.playerId && players[0]!.team_id === item.team_id
      && !roster.reviewSpans.some(span => span.start < entry.evidence.end && entry.evidence.start < span.end);
  });
}

/** Recheck the original row before displaying a game absence, including cards stored by earlier interpreters. */
export function selectReportedGameAbsences(item: NewsFeedItemRow, game: NewsLineupGame, review: NewsFeedSourceProvenance,
  sourceUrl: string, postedAt: string, events: readonly TweetPlayerEvent[]) {
  if (!events.some(e => e?.kind === "injury") || !pendingNewsAssignments(item.metadata, review)) return [];
  const roster = readTweetNewsRosterEvidence({ metadata: review.metadata ?? null, parser_filter_status: review.parser_filter_status ?? null,
    enriched_text: review.enriched_text ?? null, raw_text: review.raw_text ?? null, quoted_text: review.quoted_text ?? null });
  if (!roster?.publishedAt || (roster.source === "quoted" ? review.quoted_tweet_url : review.source_url) !== sourceUrl
    || Math.floor(Date.parse(roster.publishedAt) / 1000) !== Math.floor(Date.parse(postedAt) / 1000)) return [];
  const retained = record(item.metadata?.retainedInterpretation);
  const identity = record(retained?.identityContext);
  if (identity?.basis !== "publication_roster" || typeof identity.sourcePublishedAt !== "string"
    || Math.floor(Date.parse(identity.sourcePublishedAt) / 1000) !== Math.floor(Date.parse(postedAt) / 1000)) return [];
  const carriedBy = /^RT @([\w]{1,15}):/iu.exec(roster.text);
  if (carriedBy && !sourceUrl.toLowerCase().includes("/" + carriedBy[1]!.toLowerCase() + "/status/")) return [];
  const opponent = game.homeTeamId === item.team_id ? game.awayTeamId : game.awayTeamId === item.team_id ? game.homeTeamId : null;
  if (!opponent || publishedLineupGameId(item) !== game.id || lineReportTimeScope(roster.text)) return [];
  return events.flatMap(e => {
    if (e?.kind !== "injury" || e.reviewReason || e.observation || e.availability === "available" || e.state === "confirmed_return" || e.teamId !== item.team_id || e.resolutionBasis !== "full_name"
      || !e.times?.observation || Math.floor(Date.parse(e.times.observation) / 1000) !== Math.floor(Date.parse(postedAt) / 1000)
      || !e.evidence || !Number.isSafeInteger(e.evidence.start) || e.evidence.start < 0 || !Number.isSafeInteger(e.evidence.end) || roster.text.slice(e.evidence.start, e.evidence.end) !== e.evidence.text
      || typeof e.playerName !== "string" || !e.evidence.text.startsWith(e.playerName + " ")
      || events.some(other => other !== e && other?.playerId === e.playerId && (other.kind === "injury" || other.state === "will_play"))) return [];
    const players = roster.players.filter(p => p.fullName === e.playerName);
    if (players.length !== 1 || players[0]!.id !== e.playerId || players[0]!.team_id !== item.team_id
      || roster.reviewSpans.some(span => span.start < e.evidence.end && span.end > e.evidence.start)) return [];
    const start = e.evidence.start, end = start + e.playerName.length;
    const missed = reportedGameAbsence(roster.text, start, end);
    if (!missed || (missed.venueClubId && missed.venueClubId !== game.homeTeamId) || missed.predicate.end > e.evidence.end || missed.relative === "tomorrow" || (missed.opponentId && missed.opponentId !== opponent)
      || reportedAbsenceDate(postedAt, item.team_id, missed.relative) !== game.date) return [];
    return [{ playerId: e.playerId, start, relative: missed.relative,
      fields: gameAbsenceFields(missed, game.date, { start, end, text: e.playerName }) }];
  });
}
