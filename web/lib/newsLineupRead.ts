import { getTeamInfoById } from "./teamsInfo";
import { lineReportTimeScope } from "./sources/lineReportTime";
import type { NewsFeedItemRow, NewsFeedSourceProvenance } from "./newsFeed";
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
