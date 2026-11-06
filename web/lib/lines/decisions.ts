import type { ParsedLinesCccSource } from "lib/sources/linesCccIngestion";
import type { ProjectionReport } from "lib/sources/projectedLineups";
import { detectTweetLineContext, type EvidenceSpan, type TweetContextSignal, type TweetLineContextReading, type TweetUnit } from "lib/sources/tweetInterpretation";
import { teamsInfo } from "lib/teamsInfo";
import { NHL_TEAM_TIMEZONES_BY_ID } from "lib/xg/travelFatigue";
import { authorityTier, authorityWeight, sourceAttribution, type SourceAttribution } from "./authority";
import { relationshipClaimKey, type LineEvidenceContext } from "./sourceClaims";
import { unitKey, type ClaimContext, type LineClaim, type LineGame } from "./types";

export const LINE_DECISION_PRODUCER_VERSION = "lines-decisions:2026-11-06.1";
const TRUSTED_BASIS = ["provider_timestamp", "x_api_timestamp", "x_api"];

// Text cues stay the parser's (Lane D detectTweetLineContext); this file only turns them into claim decisions.
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const DATE = /\b(?:(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})|(\d{1,2})\/(\d{1,2}))\b/gi;

function spans(text: string, pattern: RegExp): EvidenceSpan[] {
  return [...text.matchAll(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`))]
    .map((match) => ({ start: match.index!, end: match.index! + match[0].length, text: match[0] }));
}
function escape(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

export type ContextDecision = { context: ClaimContext; phase: LineClaim["phase"]; spans: EvidenceSpan[]; basis: string };

const SIGNAL: Record<ClaimContext, TweetContextSignal["signal"]> = { practice: "practice", warmup: "warmup", projected: "projected", game: "game" };
/**
 * Whole-post context from explicit cues only (practice > in-game > warmup > projected > game).
 * No cue means a practice-level report with unresolved phase: it is never an IGA and never eligible on its own.
 */
export function decideContext(text: string, reading: TweetLineContextReading = detectTweetLineContext(text)): ContextDecision {
  if (!reading.context) return { context: "practice", phase: "unknown", spans: [], basis: "no_context_span" };
  const signal = reading.context === "game" && reading.phase === "in_game" ? "in_game" : SIGNAL[reading.context];
  const spans = reading.evidence.filter((cue) => cue.signal === signal && text.slice(cue.start, cue.end) === cue.text).map(({ start, end, text: span }) => ({ start, end, text: span }));
  if (!spans.length) return { context: "practice", phase: "unknown", spans: [], basis: "context_span_unverified" };
  return { context: reading.context, phase: reading.phase === "unknown" ? "unknown" : reading.phase, spans, basis: `${signal}_span` };
}

export type BindingDecision = { fields: Pick<LineEvidenceContext, "opponentId" | "date" | "relative" | "timezone">; spans: EvidenceSpan[]; basis: string[] };

/** Binding words only: opponent + calendar date, or a relative day with the team's timezone. Never a timestamp alone. */
export function decideBinding(text: string, teamId: number, games: LineGame[]): BindingDecision {
  const own = games.filter((game) => game.homeTeamId === teamId || game.awayTeamId === teamId);
  const opponents = new Map<number, EvidenceSpan[]>();
  for (const game of own) {
    const opponentId = game.homeTeamId === teamId ? game.awayTeamId : game.homeTeamId;
    if (opponents.has(opponentId)) continue;
    const info = Object.values(teamsInfo).find((team) => team.id === opponentId);
    const abbreviation = game.homeTeamId === teamId ? game.awayAbbreviation : game.homeAbbreviation;
    const names = [...new Set([info?.name, info?.shortName, info?.location, abbreviation].filter((value): value is string => !!value && value.length >= 3))];
    const found = names.flatMap((name) => spans(text, new RegExp(`\\b${escape(name)}\\b`, name === abbreviation ? "g" : "gi")));
    if (found.length) opponents.set(opponentId, found);
  }
  const opponent = opponents.size === 1 ? [...opponents.entries()][0]! : null;
  const dates = spans(text, DATE).flatMap((span) => {
    const match = span.text.match(new RegExp(DATE.source, "i"))!;
    const month = match[1] ? MONTHS.indexOf(match[1].slice(0, 3).toLowerCase()) + 1 : Number(match[3]);
    const day = Number(match[2] ?? match[4]);
    if (!(month >= 1 && month <= 12 && day >= 1 && day <= 31)) return [];
    const suffix = `-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const candidates = [...new Set(own.filter((game) => game.date.endsWith(suffix)).map((game) => game.date))];
    return candidates.length === 1 ? [{ span, date: candidates[0]! }] : [];
  });
  const relative = spans(text, /\b(?:tonight|today|tomorrow|yesterday)\b/gi);
  const relativeWords = [...new Set(relative.map((span) => span.text.toLowerCase()))];
  const timezone = NHL_TEAM_TIMEZONES_BY_ID[teamId];
  const fields: BindingDecision["fields"] = {}, used: EvidenceSpan[] = [], basis: string[] = [];
  if (opponent && dates.length === 1) {
    fields.opponentId = opponent[0]; fields.date = dates[0]!.date; used.push(...opponent[1], dates[0]!.span); basis.push("opponent_date_span");
  }
  if (relativeWords.length === 1 && timezone) {
    fields.relative = relativeWords[0] as LineEvidenceContext["relative"]; fields.timezone = timezone; used.push(...relative); basis.push(`relative_span:team_timezone:${timezone}`);
    if (opponent && !fields.opponentId) { fields.opponentId = opponent[0]; used.push(...opponent[1]); basis.push("opponent_span"); }
  }
  return { fields, spans: used.sort((a, b) => a.start - b.start), basis };
}

/** A partial PP change: players in for players out on one unit. Applied to a base unit only in reconcile. */
export type PPSwap = { unitNumber: 1 | 2; playersIn: Array<{ playerId: number | null; name: string; span: EvidenceSpan | null }>; playersOut: Array<{ playerId: number | null; name: string; span: EvidenceSpan | null }>; source: string };

export type ClaimDecision = Omit<LineEvidenceContext, "claimEvidence">;
export type ProducedLineEvidence = { context: LineEvidenceContext; attribution: SourceAttribution; contextDecision: ContextDecision; binding: BindingDecision;
  tier: ReturnType<typeof authorityTier>; decide: (claimKey: string, situation: TweetUnit["situation"] | null) => ClaimDecision };

/**
 * Per-claim LineEvidenceContext for one source. Kind, phase and context come from text spans;
 * binding only from binding spans; publication only from a trusted provider clock of the original.
 */
export function produceLineEvidence(source: ParsedLinesCccSource, report: ProjectionReport, games: LineGame[]): ProducedLineEvidence {
  const text = report.text;
  const attribution = sourceAttribution(source, text);
  const contextDecision = decideContext(text, report.interpretation.lineContext ?? detectTweetLineContext(text));
  const binding = decideBinding(text, report.teamId, games);
  const tier = authorityTier(attribution.originalAuthor);
  const trusted = TRUSTED_BASIS.includes(String(source.metadata?.publicationTimeBasis ?? ""));
  const originalIdentity = report.provenance?.originalTweetId ?? report.originalUrl;
  const posted = source.tweetPostedAt && /(?:Z|[+-]\d{2}:\d{2})$/i.test(source.tweetPostedAt) ? source.tweetPostedAt : null;
  const publication = trusted && attribution.timestampIsOriginal && posted && attribution.originalAuthor && originalIdentity
    ? { originalPublishedAt: posted, relayPublishedAt: null, originalIdentity, originalAuthor: attribution.originalAuthor,
      evidence: [`publication_basis:${source.metadata?.publicationTimeBasis}`, ...attribution.evidence] }
    : undefined;
  const decisionFor = (claimKey: string, kind: LineClaim["kind"]): ClaimDecision => ({
    ...binding.fields, kind, phase: contextDecision.phase, specificity: contextDecision.context === "warmup" ? "warmup" : contextDecision.context === "game" ? "game" : "practice",
    certainty: contextDecision.context === "projected" ? "projected" : "reported", authority: authorityWeight(tier),
    relationAuthority: "none",
    decisionEvidence: { producerVersion: LINE_DECISION_PRODUCER_VERSION, decisionId: `${claimKey}:${contextDecision.basis}`,
      sourceReferences: [`source:${source.tweetId ?? source.tweetUrl ?? report.key}`, ...binding.basis, contextDecision.basis],
      binding: binding.spans, phase: contextDecision.spans },
  });
  const kindFor = (situation: TweetUnit["situation"] | "pp" | null): LineClaim["kind"] =>
    situation === "pp" ? "pp" : contextDecision.phase === "in_game" && contextDecision.context === "game" ? "iga" : "entry";
  const claimEvidence: NonNullable<LineEvidenceContext["claimEvidence"]> = {};
  for (const unit of report.interpretation.units) claimEvidence[unitKey(unit)] = decisionFor(unitKey(unit), kindFor(unit.situation));
  for (const relationship of report.interpretation.relationships ?? []) {
    const key = relationshipClaimKey(relationship);
    claimEvidence[key] = decisionFor(key, kindFor(relationship.situation));
  }
  return { attribution, contextDecision, binding, tier, decide: (claimKey, situation) => decisionFor(claimKey, kindFor(situation)),
    context: { author: attribution.originalAuthor ?? undefined, publication, claimEvidence } };
}
