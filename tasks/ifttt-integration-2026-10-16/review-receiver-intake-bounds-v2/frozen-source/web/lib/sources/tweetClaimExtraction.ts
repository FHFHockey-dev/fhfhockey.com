import { createHash } from "node:crypto";
import { getPrimaryTextForSource, type ParsedLinesCccSource } from "./linesCccIngestion";
import { completeEvenStrengthUnits, type TweetInterpretation } from "./tweetInterpretation";
import { easternReportDate, explicitPracticeSession } from "./projectedLineups";
import type { TweetSemanticFact, TweetSemanticObservation, TweetSemanticScope } from "./tweetSemanticEvents";
import { crossCheckTweetSourceCoverage, tweetClaimAttribution, type TweetSourceCoverage } from "./tweetSourceDirectory";
import type { TweetClaimGameApplicability } from "./tweetClaimApplicability";

export const TWEET_CLAIM_EXTRACTION_VERSION = "2026-10-16.4";
export function claimCanonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(claimCanonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => `${JSON.stringify(key)}:${claimCanonicalJson(item)}`).join(",")}}`;
  return JSON.stringify(value);
}
export const claimHash = (value: unknown) => createHash("sha256").update(claimCanonicalJson(value)).digest("hex");

export type TweetClaimGame = { id: number; date: string; startTime: string; homeTeamId: number; awayTeamId: number };
export type TweetClaimEnvelope = {
  identityVersion: 2;
  extractionVersion: string;
  contentHash: string;
  lineageKey: string;
  scopeKey: string;
  semantic: TweetSemanticObservation;
  claimAnchor?: NonNullable<TweetInterpretation["events"]>[number]["claimAnchor"];
  source: ParsedLinesCccSource;
  aliases: Array<{ key: string; version: 1 | 2 }>;
  attribution: ReturnType<typeof tweetClaimAttribution>;
  coverage: ReturnType<typeof crossCheckTweetSourceCoverage>;
  directoryEvidence: Array<{ id: string; accountKey: string; handle: string; accountId: string | null; role: string;
    status: "observed_context"; teamIds: number[]; league: string | null; sourceUrl: string | null; publishedAt: string | null }>;
  evaluation?: Record<string, unknown>;
  gameApplicability?: TweetClaimGameApplicability;
};

export function tweetClaimContentHash(claim: Pick<TweetClaimEnvelope, "semantic" | "claimAnchor" | "source" | "attribution" | "extractionVersion" | "gameApplicability">) {
  const { interpretedAt: _time, ...semantic } = claim.semantic;
  const source = claim.source;
  return claimHash([claim.extractionVersion, { ...semantic, id: "" }, claim.claimAnchor ?? null, claim.attribution,
    source.rawText, source.enrichedText, source.quotedRawText, source.quotedEnrichedText, source.metadata?.interpretation ?? null,
    source.metadata?.tweetSourceDirectoryHint ?? null,...(claim.gameApplicability?[claim.gameApplicability]:[])]);
}

/** Preserve v1 aliases before qualifier-preserving evidence changes report hashes. */
export function legacyTweetClaimAliases(source: ParsedLinesCccSource, interpretation: TweetInterpretation, originalId: string | null) {
  const text = getPrimaryTextForSource(source);
  const previous = { ...interpretation, events: interpretation.events?.map(event => {
    const { legacyEvidenceStart, claimAnchor: _anchor, ...rest } = event;
    return legacyEvidenceStart == null ? rest : { ...rest, evidence: { ...event.evidence, start: legacyEvidenceStart,
      text: text.slice(legacyEvidenceStart, event.evidence.end) } };
  }) };
  // v1 report identity used JSON insertion order, so retain its exact algorithm.
  const date = source.tweetPostedAt ? easternReportDate(source.tweetPostedAt) : source.snapshotDate;
  const fingerprint = createHash("sha256").update(JSON.stringify([originalId, source.team?.id, date, text, previous])).digest("hex");
  const reportKey = `${fingerprint}:${source.team?.id}:${interpretation.version}`;
  return [{ key: `report:${reportKey}`, version: 1 as const }, ...(interpretation.events ?? []).map(event => ({
    key: `event:${reportKey}:${event.playerId}:${event.legacyEvidenceStart ?? event.evidence.start}`, version: 1 as const,
  }))];
}

/** Software extraction and qualification. Unknown applicability is retained for exceptions. */
export function extractDurableTweetClaims(args: {
  source: ParsedLinesCccSource; game: TweetClaimGame | null; interpretedAt: string; directory?: readonly TweetSourceCoverage[];
}): TweetClaimEnvelope[] {
  const { source, game, interpretedAt } = args;
  const text = getPrimaryTextForSource(source), attribution = tweetClaimAttribution(source);
  const interpretation = source.metadata?.interpretation as TweetInterpretation | undefined;
  const lineageKey = `tweet-receipt-v2:${source.tweetId ?? claimHash([source.sourceUrl, source.rawText, source.observedAt])}`;
  const publishedAt = attribution.originalPublishedAt;
  const date = publishedAt && Number.isFinite(Date.parse(publishedAt)) ? easternReportDate(publishedAt) : source.snapshotDate;
  const coverage = crossCheckTweetSourceCoverage({ attribution, publishedAt, asOf: interpretedAt, teamIds: source.team ? [source.team.id] : [],
    league: source.detectedLeague ?? null, entries: args.directory ?? [] });
  const teamMention = source.team && [source.team.abbreviation, source.team.name].filter(Boolean).some(name =>
    new RegExp(`(?<![\\p{L}])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}])`, "iu").test(text));
  const gameBound = Boolean(game && source.team && game.id === source.gameId && [game.homeTeamId, game.awayTeamId].includes(source.team.id)
    && game.date === date && Number.isFinite(Date.parse(game.startTime)) && easternReportDate(game.startTime) === date);
  let gate: string | null = !interpretation ? "interpretation_missing" : source.nhlFilterStatus !== "accepted" ? "source_not_qualified"
    : attribution.status !== "resolved" ? "original_identity_unresolved"
    : source.detectedLeague?.toUpperCase() !== "NHL" ? "league_unresolved_or_non_nhl"
    : !teamMention ? "source_time_team_not_explicit" : coverage.status === "conflict" ? "source_coverage_conflict"
    : interpretation.unresolved.length ? "extraction_or_identity_unresolved" : null;
  // Current rosters are supporting identity evidence only for fresh same-day text.
  // Historical membership is never inferred from today's roster or directory.
  const identity = interpretation?.identityContext;
  if (!gate && (!publishedAt || !source.observedAt || date !== easternReportDate(source.observedAt)
    || Date.parse(source.observedAt) - Date.parse(publishedAt) > 6 * 3600_000
    || identity?.basis !== "current_membership" || identity.sourcePublishedAt !== source.tweetPostedAt)) gate = "source_time_identity_unverified";
  const scope: TweetSemanticScope | null = gameBound && interpretation?.context === "game" ? {
    kind: "game", teamId: source.team!.id, gameId: game!.id, phase: "entry", group: null,
  } : source.team && explicitPracticeSession(text) ? { kind: "session", teamId: source.team.id, date,
    sessionId: `${date}:${explicitPracticeSession(text)}`, group: null } : null;
  const claims: Array<{ fact: TweetSemanticFact | null; evidence: TweetSemanticObservation["evidence"];
    modality: TweetSemanticObservation["modality"]; reason: string | null; claimAnchor?: TweetClaimEnvelope["claimAnchor"] }> = [];
  for (const event of interpretation?.events ?? []) {
    let fact: TweetSemanticFact | null = null, reason: string | null = null;
    if (event.kind === "goalie" && event.goalieRole !== "backup" && event.state === "confirmed" && event.modality === "affirmative" && !event.observation) {
      fact = { kind: "starter", playerId: event.playerId };
    } else if (event.kind === "injury" && ["available", "out"].includes(event.availability)
      && /\b(tonight|today|this (?:afternoon|evening))\b/i.test(event.evidence.text)) {
      fact = { kind: "availability", playerId: event.playerId, status: event.availability as "available" | "out" };
    } else if (event.kind === "participation" && event.observation) {
      fact = { kind: "observation", playerId: event.playerId, activity: event.observation, present: event.modality !== "negated" };
      reason = "session_time_window_unverified";
    } else reason = "claim_not_actionable";
    if (event.teamId !== source.team?.id) reason = "claim_team_unresolved";
    if (event.reviewReason) reason = event.reviewReason;
    const uncertain = event.modality === "tentative" || event.state === "likely" || event.state === "projected" || event.availability === "uncertain";
    const modality = fact?.kind === "observation" ? "observation" : uncertain ? "uncertain" : fact ? "asserted" : "projected";
    claims.push({ fact, evidence: event.evidence, modality, reason, claimAnchor: event.claimAnchor });
  }
  if (interpretation) for (const situation of ["es", "pp", "pk"] as const) {
    for (const group of new Set(interpretation.units.map(unit => unit.group))) {
      const units = situation === "es" ? completeEvenStrengthUnits(interpretation, group)
        : interpretation.units.filter(unit => unit.situation === situation && unit.group === group && unit.complete);
      if (!units.length) continue;
      const complete = situation === "es" || (units.length === 2 && units.some(unit => unit.number === 1) && units.some(unit => unit.number === 2));
      claims.push({ fact: { kind: "lineup", situation, units: units.map(unit => ({ slot: `${unit.situation}:${unit.number}`, playerIds: unit.players.map(player => player.playerId) })) },
        // Full source retains governing headings, extras and unusual explicit roles.
        evidence: { start: 0, end: text.length, text }, modality: interpretation.certainty === "confirmed" ? "asserted" : "projected",
        reason: !complete ? "incomplete_units" : group ? "practice_group_not_game_entry" : null });
    }
  }
  if (!claims.length) claims.push({ fact: null, evidence: { start: 0, end: text.length, text }, modality: "projected", reason: "no_supported_claim_extracted" });
  const aliases = interpretation ? [...legacyTweetClaimAliases(source, interpretation, attribution.originalTweetId),
    ...(attribution.originalTweetId && attribution.relationship !== "direct" ? legacyTweetClaimAliases(source, interpretation, null) : [])] : [];
  const directoryEvidence = (["relay", "original", "quoted"] as const).flatMap(role => {
    const account = attribution[role];
    if (!account) return [];
    const evidence = { ...account, role, status: "observed_context" as const, teamIds: source.team ? [source.team.id] : [],
      league: source.detectedLeague ?? null, sourceUrl: role === "relay" ? source.sourceUrl ?? null : attribution.originalUrl, publishedAt };
    return [{ ...evidence, id: `source-context-v1:${claimHash([lineageKey, evidence])}` }];
  });
  return claims.map((claim, index) => {
    const reason = gate ?? claim.reason ?? (!gameBound || !scope ? "applicability_unresolved" : null);
    const semantic: TweetSemanticObservation = { id: "", reportId: lineageKey, sourceKey: source.sourceHandle ?? "ifttt",
      original: { tweetId: attribution.originalTweetId, author: attribution.original?.handle ?? null, publishedAt },
      wrapper: attribution.relationship !== "direct" && source.tweetId ? { tweetId: source.tweetId,
        publishedAt: typeof source.metadata?.wrapperPostedAt === "string" ? source.metadata.wrapperPostedAt : source.primaryTextSource === "quoted_oembed" ? null : source.tweetPostedAt ?? null } : null,
      receivedAt: source.observedAt ?? "", interpretedAt, evidence: claim.evidence, scope, fact: claim.fact,
      effectiveAt: gameBound ? game!.startTime : null, modality: claim.modality,
      support: reason ? { status: "pending", reason } : { status: "supported", basis: "explicit team and claim; fresh canonical identity; exact dated game", validUntil: game!.startTime }, relation: null };
    const contentHash = tweetClaimContentHash({ extractionVersion: TWEET_CLAIM_EXTRACTION_VERSION, semantic, claimAnchor: claim.claimAnchor, source, attribution });
    return { identityVersion: 2, extractionVersion: TWEET_CLAIM_EXTRACTION_VERSION, contentHash, lineageKey,
      scopeKey: scope ? `tweet-scope-v1:${claimHash(scope)}` : `tweet-pending-v2:${lineageKey}`,
      semantic: { ...semantic, id: `tweet-observation-v2:${contentHash}` }, ...(claim.claimAnchor ? { claimAnchor: claim.claimAnchor } : {}),
      source: structuredClone(source), attribution, coverage, directoryEvidence,
      aliases: [...aliases, { key: `receipt:${lineageKey}:claim:${index}`, version: 2 }] };
  });
}
