import { timestampMicros } from "../projections/evidenceTime";
import { BILINGUAL_GAME_CLAIM_VERSION, bulletinFitsMatchup, pairedEventStatus, readBilingualGameReport } from "./bilingualGameReport";
import { reportedGoalieStart } from "./reportedGoalieStart";
import { hasNonPlayerSubject } from "./playerNameInProse";
import { reportedGameAbsence } from "./reportedGameAbsence";
import clubHandles from "../lines/fixtures/clubHandles.ledger.json";
import { goalieDateRevision, reportedGoalieStarts, verifiedGoaliePostTime, type GoalieStartDay } from "./tweetGoalieStartDate";
import { createHash } from "node:crypto";
import { getPrimaryTextForSource, type ParsedLinesCccSource } from "./linesCccIngestion";
import { completeEvenStrengthUnits, requiresRelativeGameDateReview, type TweetInterpretation } from "./tweetInterpretation";
import { easternReportDate, explicitPracticeSession } from "./projectedLineups";
import type { TweetSemanticFact, TweetSemanticObservation, TweetSemanticScope } from "./tweetSemanticEvents";
import { bulletinNamesClub, readClubMedicalBulletin } from "./clubMedicalBulletin";
import { crossCheckTweetSourceCoverage, tweetClaimAttribution, verifiedFxSnapshotUrl, type TweetSourceCoverage } from "./tweetSourceDirectory";
import { printedPowerPlayUnits, readNumberedPowerPlayReport } from "./reportedPowerPlay";
import { verifiedFxRelayQuoteClocks } from "./fxtwitterQueuePayload";
import type { TweetClaimGameApplicability } from "./tweetClaimApplicability";

export const TWEET_CLAIM_EXTRACTION_VERSION = "2026-11-23.11";
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
function pregameReceipt(published: string, received: string, interpreted: string, puckDrop: string) {
  const post = timestampMicros(published), intake = timestampMicros(received), reading = timestampMicros(interpreted);
  const start = timestampMicros(puckDrop.replace(" ", "T"));
  return post !== null && intake !== null && reading !== null && start !== null && post <= intake && intake <= reading && intake <= start;
}

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
  const translated = readBilingualGameReport(text);
  const teamMention = source.team && [source.team.abbreviation, source.team.name].filter(Boolean).some(name =>
    new RegExp(`(?<![\\p{L}])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}])`, "iu").test(text));
  const gameBound = Boolean(game && source.team && game.id === source.gameId && [game.homeTeamId, game.awayTeamId].includes(source.team.id)
    && game.date === date && Number.isFinite(Date.parse(game.startTime)) && easternReportDate(game.startTime) === date);
  const pairedClub = translated && gameBound && game && source.team && publishedAt && source.observedAt
    && pregameReceipt(publishedAt, source.observedAt, interpretedAt, game.startTime)
    && attribution.original?.handle && (!translated.wrapper || translated.wrapper.toLowerCase() === attribution.original.handle.toLowerCase())
    && interpretation?.identityContext?.basis === "publication_roster" && interpretation.identityContext.sourcePublishedAt
    && Date.parse(interpretation.identityContext.sourcePublishedAt) === Date.parse(publishedAt) && !interpretation.units.length && interpretation.events?.length
    && bulletinFitsMatchup(translated.opponent, source.team.id, game.homeTeamId === source.team.id ? game.awayTeamId : game.homeTeamId,
      attribution.original?.handle ?? null, publishedAt)
    && interpretation.events.every(e => e.teamId === source.team!.id && e.effectiveDate === game.date && !e.reviewReason && !e.observation
      && translated.pairs.some(p => p.name === e.playerName && p.status === pairedEventStatus(e) && p.english.evidence.text === e.evidence.text && p.english.subject.start === e.claimAnchor?.subjectSpan.start
        && p.english.predicate.text === e.claimAnchor?.predicateSpan.text && p.french.evidence.text === e.translatedEvidence?.text));
  // A lone injury bulletin can name its subject's club as "@club forward Full Name".
  // The handle must belong to the same team as the dated roster and bound game.
  const single = interpretation?.events?.length === 1 && !interpretation.units.length ? interpretation.events[0] : undefined;
  const subject = single?.claimAnchor?.subjectSpan;
  const club = source.team && clubHandles.teams[source.team.abbreviation as keyof typeof clubHandles.teams];
  const goalieCredit = subject && single?.kind === "goalie" && single.state === "confirmed" && single.modality === "affirmative"
    && single.goalieRole === "starter" && !single.observation && !single.reviewReason && single.teamId === source.team?.id
    && text.slice(subject.start, subject.end) === subject.text ? reportedGoalieStart(text, subject.start, subject.end) : null;
  const creditedClub = goalieCredit && goalieCredit.teamId === source.team?.id && goalieCredit.opponentId
    && single?.claimAnchor?.predicateSpan.start === goalieCredit.predicate.start && single.claimAnchor.predicateSpan.end === goalieCredit.predicate.end
    && interpretation?.identityContext?.basis === "publication_roster";
  const namedClub = gameBound && publishedAt && date > clubHandles.checkedAt && club && single?.kind === "injury"
    && single.availabilityScope === "game" && single.availability === "out" && single.modality === "affirmative" && single.effectiveDate === game?.date && single.teamId === source.team?.id && !single.reviewReason
    && subject && subject.text === single.playerName && text.slice(subject.start, subject.end) === subject.text
    && reportedGameAbsence(text, subject.start, subject.end)?.namedClubHandle === club.handle;
  // A complete medical bulletin identifies its NHL subject club in the recall. Only
  // named medical events already received at puck drop can use that evidence for game entry.
  const bulletin = gameBound && game && source.team && publishedAt && source.observedAt
    && Date.parse(source.observedAt) >= Date.parse(publishedAt) && Date.parse(source.observedAt) <= Date.parse(game.startTime)
    && !interpretation?.units.length && attribution.originalUrl && verifiedFxSnapshotUrl(source) === attribution.originalUrl
    ? readClubMedicalBulletin(text) : null;
  const medicalClub = bulletin && publishedAt && source.team && bulletinNamesClub(bulletin.handle, source.team.name, source.team.abbreviation, publishedAt)
    && interpretation?.identityContext?.basis === "publication_roster" && interpretation.events?.length
    && interpretation.events.every(e => e.kind === "injury" && !e.reviewReason && e.teamId === source.team?.id
      && e.resolutionBasis === "full_name" && text.slice(e.evidence.start, e.evidence.end) === e.evidence.text
      && bulletin.updates.some(u => u.subject.text === e.playerName && u.subject.start === e.evidence.start
        && e.evidence.end <= u.evidence.end));
  // A club named in a PP report identifies the subject. A same-date schedule row alone cannot
  // turn these personnel into an entry lineup or an effective-at-puck-drop assignment.
  const ppReport = interpretation?.units.some(unit => unit.situation === "pp" && unit.explicitNumber) && readNumberedPowerPlayReport(text,
    attribution.relationship === "retweet" && attribution.originalUrl && verifiedFxSnapshotUrl(source) === attribution.originalUrl ? attribution.original?.handle : null);
  const taggedPP = Boolean(ppReport && ppReport.clubSpan && ppReport.teamId === source.team?.id && interpretation
    && !interpretation.events?.length && interpretation.units.length
    && printedPowerPlayUnits(text, interpretation, ppReport).length === interpretation.units.length);
  const ppHold = taggedPP && ppReport ? (ppReport.phase === "practice" ? "reported_pp_practice_only" : "reported_pp_game_unverified") : null;
  let gate: string | null = !interpretation ? "interpretation_missing" : source.nhlFilterStatus !== "accepted" ? "source_not_qualified"
    : attribution.status !== "resolved" ? "original_identity_unresolved"
    : source.detectedLeague?.toUpperCase() !== "NHL" ? "league_unresolved_or_non_nhl"
    : !teamMention && !pairedClub && !namedClub && !creditedClub && !medicalClub && !taggedPP ? "source_time_team_not_explicit" : coverage.status === "conflict" ? "source_coverage_conflict"
    : interpretation.unresolved.length ? "extraction_or_identity_unresolved" : null;
  // Current rosters are supporting identity evidence only for fresh same-day text.
  // Historical membership is never inferred from today's roster or directory.
  const identity = interpretation?.identityContext;
  if (!gate && (!publishedAt || !source.observedAt || date !== easternReportDate(source.observedAt)
    || Date.parse(source.observedAt) - Date.parse(publishedAt) > 6 * 3600_000
    || !identity || !["current_membership", "publication_roster"].includes(identity.basis) || identity.sourcePublishedAt !== source.tweetPostedAt)) gate = "source_time_identity_unverified";
  const scope: TweetSemanticScope | null = gameBound && interpretation?.context === "game" ? {
    kind: "game", teamId: source.team!.id, gameId: game!.id, phase: "entry", group: null,
  } : source.team && explicitPracticeSession(text) ? { kind: "session", teamId: source.team.id, date,
    sessionId: `${date}:${explicitPracticeSession(text)}`, group: null } : null;
  // The serving projection contains only the current game. The retained reading also includes other days.
  const originalReading = (source.metadata?.temporalReview as { interpretation?: TweetInterpretation } | undefined)?.interpretation;
  const sourceTime = verifiedGoaliePostTime(attribution.originalUrl, publishedAt);
  const datedStarts = interpretation ? reportedGoalieStarts(text, originalReading ?? interpretation, sourceTime, source.team?.id) : [];
  const events = [...(interpretation?.events ?? [])];
  for (const event of originalReading?.events ?? []) {
    if (interpretation?.reportedGoalieDates?.some(start => start.playerId === event.playerId && start.evidence.start === event.evidence.start)
      && datedStarts.some(start => start.playerId === event.playerId && start.evidence.start === event.evidence.start)
      && !events.some(current => current.playerId === event.playerId && current.evidence.start === event.evidence.start)) events.push(event);
  }
  const claims: Array<{ fact: TweetSemanticFact | null; evidence: TweetSemanticObservation["evidence"];
    modality: TweetSemanticObservation["modality"]; reason: string | null; claimAnchor?: TweetClaimEnvelope["claimAnchor"]; reportedDay?: GoalieStartDay; otherDay?: boolean }> = [];
  for (const event of events) {
    if (hasNonPlayerSubject(event, text)) continue;
    let fact: TweetSemanticFact | null = null, reason: string | null = null;
    if (event.kind === "goalie" && event.goalieRole !== "backup" && event.state === "confirmed" && event.modality === "affirmative" && !event.observation) {
      fact = { kind: "starter", playerId: event.playerId };
    } else if (pairedClub && event.translatedEvidence && event.kind === "participation" && event.availabilityScope === "game"
      && event.modality === "affirmative" && (event.availability === "available" || event.availability === "out")) {
      fact = { kind: "availability", playerId: event.playerId, status: event.availability };
    } else if ((event.kind === "injury" || (event.kind === "participation" && event.state === "will_play" && event.modality === "affirmative"
      && event.availabilityScope === "game" && event.availability === "available")) && ["available", "out"].includes(event.availability)
      && /\b(tonight|today|this (?:afternoon|evening))\b/i.test(event.evidence.text)) {
      fact = { kind: "availability", playerId: event.playerId, status: event.availability as "available" | "out" };
    } else if (event.kind === "participation" && event.observation) {
      fact = { kind: "observation", playerId: event.playerId, activity: event.observation, present: event.modality !== "negated" };
      reason = "session_time_window_unverified";
    } else reason = "claim_not_actionable";
    if (fact?.kind === "availability" && event.kind === "injury" && event.availabilityScope === "game"
      && event.effectiveDate && event.effectiveDate !== game?.date) {
      fact = null;
      reason = "reported_absence_game_date_mismatch";
    }
    if (creditedClub && event === single && (!gameBound || !game || ![game.homeTeamId, game.awayTeamId].includes(goalieCredit.opponentId!)
      || !publishedAt || !source.observedAt || !(Date.parse(publishedAt) <= Date.parse(source.observedAt) && Date.parse(source.observedAt) <= Date.parse(game.startTime)))) {
      reason = "credited_start_game_unverified";
    }
    if (event.translatedEvidence && !pairedClub) reason = "translated_game_scope_unverified";
    if (event.teamId !== source.team?.id) reason = "claim_team_unresolved";
    if (event.reviewReason) reason = event.reviewReason;
    const uncertain = event.modality === "tentative" || event.state === "likely" || event.state === "projected" || event.availability === "uncertain";
    const modality = fact?.kind === "observation" ? "observation" : uncertain ? "uncertain" : fact ? "asserted" : "projected";
    const start = event.kind === "goalie" ? datedStarts.find(item => item.playerId === event.playerId && item.evidence.start === event.evidence.start) : undefined;
    // Never let a report-wide game assign an unsupported future or historical goalie claim.
    const otherDay = event.kind === "goalie" && (start ? start.day.date !== game?.date : requiresRelativeGameDateReview(event.evidence.text));
    claims.push({ fact, evidence: event.evidence, modality, reason, claimAnchor: event.claimAnchor, reportedDay: start?.day, otherDay });
  }
  if (interpretation) for (const situation of ["es", "pp", "pk"] as const) {
    for (const group of new Set(interpretation.units.map(unit => unit.group))) {
      const units = situation === "es" ? completeEvenStrengthUnits(interpretation, group)
        : interpretation.units.filter(unit => unit.situation === situation && unit.group === group && unit.complete
          && (situation !== "pp" || unit.explicitNumber && (unit.number === 1 || unit.number === 2)));
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
  const nativeRepost = attribution.relationship === "retweet" && source.rawPayload?.provider === "fxtwitter"
    && attribution.originalTweetId === source.tweetId;
  const nativeWrapperId = (source.rawPayload?.fx as { repost_wrapper_id?: unknown } | undefined)?.repost_wrapper_id;
  const wrapperId = nativeRepost ? (typeof nativeWrapperId === "string" && /^[0-9]+$/.test(nativeWrapperId)
    && nativeWrapperId !== source.tweetId ? nativeWrapperId : null) : source.tweetId;
  const nativeQuote = attribution.relationship === "quote" && source.rawPayload?.provider === "fxtwitter";
  const relayPublishedAt = nativeQuote ? verifiedFxRelayQuoteClocks(source, text)?.relayPublishedAt ?? null : nativeRepost ? null : publishedAt;
  const directoryEvidence = (["relay", "original", "quoted"] as const).flatMap(role => {
    const account = attribution[role];
    if (!account) return [];
    const relayUrl = nativeRepost && wrapperId ? `https://x.com/${account.handle}/status/${wrapperId}` : source.sourceUrl ?? null;
    const evidence = { ...account, role, status: "observed_context" as const, teamIds: source.team ? [source.team.id] : [],
      league: source.detectedLeague ?? null, sourceUrl: role === "relay" ? (nativeRepost && !wrapperId ? null : relayUrl) : attribution.originalUrl,
      publishedAt: role === "relay" ? relayPublishedAt : publishedAt };
    return [{ ...evidence, id: `source-context-v1:${claimHash([lineageKey, evidence])}` }];
  });
  return claims.map((claim, index) => {
    const claimScope = claim.otherDay || taggedPP ? null : scope;
    const reason = gate ?? ppHold ?? claim.reason ?? (claim.otherDay ? "goalie_date_requires_separate_game" : null) ?? (!gameBound || !claimScope ? "applicability_unresolved" : null);
    const semantic: TweetSemanticObservation = { id: "", reportId: lineageKey, sourceKey: source.sourceHandle ?? "ifttt",
      original: { tweetId: attribution.originalTweetId, author: attribution.original?.handle ?? null, publishedAt },
      wrapper: attribution.relationship !== "direct" && wrapperId ? { tweetId: wrapperId,
        publishedAt: typeof source.metadata?.wrapperPostedAt === "string" ? source.metadata.wrapperPostedAt : nativeRepost || source.primaryTextSource === "quoted_oembed" ? null : source.tweetPostedAt ?? null } : null,
      receivedAt: source.observedAt ?? "", interpretedAt, evidence: claim.evidence, scope: claimScope, fact: claim.fact,
      ...(claim.reportedDay ? { reportedDay: claim.reportedDay } : {}),
      effectiveAt: gameBound && !claim.otherDay && !taggedPP ? game!.startTime : null, modality: claim.modality,
      support: reason ? { status: "pending", reason } : { status: "supported", basis: pairedClub ? "matching English and French clauses, publication roster and dated matchup" : "explicit team and claim; fresh canonical identity; exact dated game", validUntil: game!.startTime }, relation: null };
    const extractionVersion = pairedClub ? BILINGUAL_GAME_CLAIM_VERSION : creditedClub && claim.fact?.kind === "starter" ? "2026-11-23.14" : taggedPP && ppReport ? (ppReport.clubSpan?.text.startsWith("#") ? "2026-11-23.12" : "2026-11-23.13") : claim.reportedDay || claim.otherDay
      ? goalieDateRevision(TWEET_CLAIM_EXTRACTION_VERSION) : TWEET_CLAIM_EXTRACTION_VERSION;
    const contentHash = tweetClaimContentHash({ extractionVersion, semantic, claimAnchor: claim.claimAnchor, source, attribution });
    return { identityVersion: 2, extractionVersion, contentHash, lineageKey,
      scopeKey: claimScope ? `tweet-scope-v1:${claimHash(claimScope)}` : `tweet-pending-v2:${lineageKey}`,
      semantic: { ...semantic, id: `tweet-observation-v2:${contentHash}` }, ...(claim.claimAnchor ? { claimAnchor: claim.claimAnchor } : {}),
      source: structuredClone(source), attribution, coverage, directoryEvidence,
      aliases: [...aliases, { key: `receipt:${lineageKey}:claim:${index}`, version: 2 }] };
  });
}
