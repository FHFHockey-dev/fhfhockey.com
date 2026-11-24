import { isGoalieMatchupPhrase, readGoalieStartDay, verifiedGoaliePostTime } from "./tweetGoalieStartDate";
import { reportedLineupExpectation } from "./lineupReturnEvidence";
import { z } from "zod";
import { timestampMicros } from "lib/projections/evidenceTime";
import { identityDigest, indexPlayerIdentitySnapshot } from "./playerIdentitySnapshot";
import { projectSavedPlayerIdentityEvidence, type IdentityEvidenceEvaluation } from "./playerIdentitySnapshotEvidence";
import { exactIdentitySpan, namedDfoSubject, prepareFixtureIdentityRequest, validateFixtureIdentityProposal,
  type FixtureIdentityMention, type FixtureIdentityRequest } from "./tweetIdentityProposal";
import { mapTweetDecisionReview, DECISION_REVIEW_BINDING_VERSION, type DecisionStatementBinding } from "./tweetDecisionReviewMapping";
import { validateTweetDecisionReviewResult } from "./tweetDecisionReviewResults";
import { createShadowAdapter } from "./decisionsReference/adapter.mjs";
import { LUNA_MODEL, type LunaTransport } from "./tweetLunaTransport";
import type { TweetReviewPacket } from "./tweetReviewSidecar";
import { reportedGameTimeDecision, taggedGameTimeDecision } from "./reportedGameTimeDecision";
import { reportedGoalieStart } from "./reportedGoalieStart";
import { extractTweetPlayerEvents } from "./tweetPlayerEvents";
import { interpretTweetUnits } from "./tweetInterpretation";
import { printedPowerPlayUnits, readNumberedPowerPlayReport } from "./reportedPowerPlay";
import { reportedGameAbsence, reportedAbsenceDate } from "./reportedGameAbsence";
import { absenceCoachCredit, reportedAbsenceDuration } from "./tweetAbsenceDuration";
import { bulletinNamesClub, readClubMedicalBulletin } from "./clubMedicalBulletin";
import { reportedClubRosterMoves, rosterMoveClub } from "./reportedClubRosterMoves";
import { BILINGUAL_GAME_CLAIM_VERSION, bilingualRosterPosition, bulletinFitsMatchup, readBilingualGameReport } from "./bilingualGameReport";
import { bilingualAbsenceBulletin } from "./bilingualAbsenceBulletin";
import { rosterSeasonForDate } from "./playerIdentity";
import { teamsInfo, teamHashtagsByAbbreviation } from "../teamsInfo";
import clubHandles from "../lines/fixtures/clubHandles.ledger.json";
import { tweetPublicationFromUrl } from "./tweetPublicationTime";
import { isRelayAccount } from "lib/lines/authority";
import { assertLunaGoalieWording } from "./tweetLunaGoalieWording";
import { buildLunaReferenceInput, buildLunaReviewInstructions, getLunaReferencePackage, LUNA_REFERENCE_PACKAGE, type LunaReferenceMode, type LunaSuppliedSourcePolicy } from "./tweetLunaReference";

export const LUNA_REVIEW_VERSION = "ifttt-luna-review-v1";
export const LUNA_REVIEW_AUTHORITY = { canPublish: false, canWriteAliases: false, canChangeStatus: false, canExecuteReplacement: false } as const;
const span = z.object({ start: z.number().int().nonnegative(), end: z.number().int().positive(), text: z.string().min(1) }).strict();
export const lunaGoalieStatusesSchema = z.array(z.object({ occurrenceId: z.string(), canonicalId: z.string(),
  status: z.enum(["confirmed", "ruled_out", "likely", "projected", "unknown"]), evidence: span,
}).strict()).max(32);
export type LunaReviewInput = {
  packet: TweetReviewPacket; extractionVersion: string; statements: DecisionStatementBinding[];
  identity?: { evidence: unknown; evaluation: IdentityEvidenceEvaluation; asOf: string; mentions: FixtureIdentityMention[] };
  decisions?: boolean;
  referenceMode?: LunaReferenceMode;
};

export function buildLunaReviewRequest(request: FixtureIdentityRequest, context: LunaSuppliedSourcePolicy, referenceMode?: LunaReferenceMode) {
  const enumString = (values: string[]) => ({ type: "string", enum: values });
  const object = (properties: Record<string, unknown>) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });
  const evidence = object({ start: { type: "integer" }, end: { type: "integer" }, text: { type: "string" } });
  const occurrenceIds = request.content.occurrences.map(o => o.id);
  const ids = [...new Set(request.content.occurrences.flatMap(o => o.candidateSet.candidates.map(c => c.row.canonicalId)))];
  const schema = object({ identity: object({ version: enumString([request.content.version]), requestHash: enumString([request.hash]),
    directoryHash: enumString([request.content.directory.hash]), occurrences: { type: "array", items: object({
      occurrenceId: enumString(occurrenceIds), canonicalId: { type: ["string", "null"], enum: [...ids, null] },
      status: enumString(["matched", "ambiguous", "missing", "conflicting", "not_player", "needs_widening"]),
      evidence, identityConfidence: enumString(["strong", "tentative", "unknown"]),
    }) } }), goalieStatuses: { type: "array", items: object({ occurrenceId: enumString(occurrenceIds),
    canonicalId: { type: "string" }, status: enumString(["confirmed", "ruled_out", "likely", "projected", "unknown"]), evidence }) } });
  return { model: LUNA_MODEL, input: JSON.stringify(buildLunaReferenceInput(request, context, referenceMode)),
    instructions: buildLunaReviewInstructions(),
    text: { format: { type: "json_schema", name: "ifttt_luna_review_v1", strict: true, schema } } };
}

/** The repeated subject is safe only when the complete DFO bulletin contains one dated start statement. */
function isSingleDfoStart(request: FixtureIdentityRequest, occurrence: FixtureIdentityRequest["content"]["occurrences"][number],
  identity: ReturnType<typeof validateFixtureIdentityProposal>, proposal: z.infer<typeof lunaGoalieStatusesSchema>[number]) {
  const { text } = request.content.source;
  if (!text.slice(0, occurrence.span.start).endsWith(": Goalie Start: ") || proposal.evidence.start !== occurrence.span.start
    || !/^(?: https:\/\/t\.co\/[A-Za-z0-9]+)?\s*$/u.test(text.slice(proposal.evidence.end))) return false;
  const subject = namedDfoSubject(request, occurrence);
  if (subject?.canonicalId !== proposal.canonicalId || !identity.occurrences.some(o =>
    o.occurrenceId === subject.occurrenceId && o.status === "matched" && o.canonicalId === subject.canonicalId)) return false;
  const clause = text.slice(occurrence.span.end, proposal.evidence.end);
  const predicate = /^ (will start|starts|is expected to start|will likely start) (.+)\.$/u.exec(clause);
  if (!predicate) return false;
  const status = predicate[1] === "is expected to start" ? "projected" : predicate[1] === "will likely start" ? "likely" : "confirmed";
  if (status !== proposal.status) return false;
  const fixture = /^(.+) on (\w+)$|^(\w+) (.+)$/u.exec(predicate[2]!);
  if (!fixture || !/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/u.test((fixture[2] ?? fixture[3])!)) return false;
  return isGoalieMatchupPhrase((fixture[1] ?? fixture[4])!);
}

/** Validates a proposal, not truth. Verified 100/0 must come through the existing accepted-evidence workflow. */
export function validateLunaGoalieStatuses(request: FixtureIdentityRequest, identity: ReturnType<typeof validateFixtureIdentityProposal>, value: unknown, projection?: IdentityProjection) {
  const result = lunaGoalieStatusesSchema.parse(value);
  if (new Set(result.map(s => s.occurrenceId)).size !== result.length) throw new Error("duplicate_goalie_subject");
  const translations = result.length ? deriveLunaBilingualGameAssignments(request, identity, projection) : [];
  return result.map(proposal => {
    const occurrence = request.content.occurrences.find(o => o.id === proposal.occurrenceId);
    const selected = identity.occurrences.find(o => o.occurrenceId === proposal.occurrenceId);
    const candidate = occurrence?.candidateSet.candidates.find(c => c.row.canonicalId === proposal.canonicalId);
    if (!occurrence || selected?.status !== "matched" || selected.canonicalId !== proposal.canonicalId
      || !candidate?.row.positions.includes("G") || !exactIdentitySpan(request.content.source.text, proposal.evidence)
      || proposal.evidence.start > occurrence.span.start || proposal.evidence.end < occurrence.span.end
      || request.content.occurrences.some(o => o.id !== occurrence.id && o.span.start < proposal.evidence.end && o.span.end > proposal.evidence.start)) {
      throw new Error("goalie_subject_binding_invalid");
    }
    const translated = proposal.status === "confirmed" && translations.find(t => t.status === "starter" && t.occurrenceId === occurrence.id
      && t.canonicalId === proposal.canonicalId && proposal.evidence.start <= t.subject.start && proposal.evidence.end >= t.predicate.end);
    const repeatedIdentity = request.content.occurrences.some(o => o.id !== occurrence.id
      && (o.span.text === occurrence.span.text || o.candidateSet.candidates.some(c => c.row.canonicalId === proposal.canonicalId)))
      || request.content.source.text.split(occurrence.span.text).length > 2;
    assertLunaGoalieWording({ source: request.content.source.text, subject: occurrence.span, evidence: proposal.evidence,
      status: proposal.status, repeatedIdentity: repeatedIdentity && !translated && !isSingleDfoStart(request, occurrence, identity, proposal) });
    if (["confirmed", "ruled_out"].includes(proposal.status)
      && /\b(first off|first (?:goalie|goaltender) off|practice|morning skate|could|might|may|likely|projected|expected|probably|if|not confirmed|no decision|undecided)\b|\?/iu.test(proposal.evidence.text)) {
      throw new Error("goalie_certainty_inflation");
    }
    const teamId = candidate.activeTeamIds?.length === 1 ? candidate.activeTeamIds[0] : null;
    const original = request.content.source;
    const credit = proposal.status === "confirmed" ? reportedGoalieStart(original.text, occurrence.span.start, occurrence.span.end) : null;
    const roster = credit && datedOriginalPost(original) && original.publishedAt && timestampMicros(original.receivedAt) != null
      && timestampMicros(original.receivedAt)! >= timestampMicros(original.publishedAt)! && !occurrence.candidateSet.truncated && occurrence.candidateSet.exactStatus === "matched"
      && occurrence.candidateSet.candidates.length === 1
      && (candidate.basis === "full_name" || (candidate.basis === "surname" && (credit.teamId != null || occurrence.candidateSet.completeness.status === "complete")))
      ? reportRosterRecord(request, candidate.row.nhlPlayerId, projection) : null;
    // The quoted predicate must be complete. The original supplies the speaker even when
    // quoting the speaker's name would cross a different, unresolved identity occurrence.
    const credited = credit && roster && (!credit.teamId || credit.teamId === roster.teamId) && roster.teamId !== credit.opponentId
      && candidate.activeTeamIds.every(id => id === roster.teamId) && proposal.evidence.end >= credit.predicate.end;
    if (["confirmed", "ruled_out"].includes(proposal.status)) {
      const players = [{ playerId: candidate.row.nhlPlayerId, fullName: candidate.row.fullName, lastName: candidate.row.lastName,
        position: "G", teamId, aliases: [occurrence.span.text] }];
      const supports = (e: ReturnType<typeof extractTweetPlayerEvents>[number]) => e.kind === "goalie"
        && e.playerId === candidate.row.nhlPlayerId && e.state === proposal.status && e.goalieRole !== "backup";
      const literal = extractTweetPlayerEvents({ text: proposal.evidence.text, publishedAt: request.content.source.publishedAt, players, claimAware: true });
      // The full report must agree: a clipped span must not remove a governing "if".
      const context = extractTweetPlayerEvents({ text: request.content.source.text, publishedAt: request.content.source.publishedAt, players, claimAware: true });
      if (!translated && !credited && (!literal.some(supports) || !context.some(e => supports(e)
        && e.evidence.start <= occurrence.span.start && e.evidence.end >= occurrence.span.end))) {
        throw new Error("goalie_definite_wording_unsupported");
      }
    }
    const source = request.content.source;
    const reportedDay = proposal.status === "confirmed"
      ? readGoalieStartDay(source.text, occurrence.span, proposal.evidence, verifiedGoaliePostTime(source.url, source.publishedAt), teamId) : null;
    return { ...proposal, ...(credited ? { reportedStart: { playerId: candidate.row.nhlPlayerId, teamId: roster.teamId, gameId: null,
      roster, speaker: credit.speaker, opponent: credit.opponent, evidence: credit.evidence, subject: occurrence.span, predicate: credit.predicate,
      originalPostId: original.originalPostId, author: original.authorId, sourceUrl: original.url, publishedAt: original.publishedAt,
      receivedAt: original.receivedAt, canApply: false as const } } : {}), ...(reportedDay ? { reportedDay } : {}), verified: false as const, gameId: null, teamId: null, appliedOverride: null,
      policyFloorAfterAcceptance: proposal.status === "likely" ? 0.8 : proposal.status === "projected" ? 0.65 : null,
      holds: ["human_review_required", "game_and_source_time_binding_required", "conflict_retraction_check_required"] };
  });
}

function outputJson(body: any) {
  if (body.status !== "completed" || !Array.isArray(body.output)) throw new Error("luna_response_incomplete");
  const content = body.output.flatMap((item: any) => item.type === "message" && item.role === "assistant" && Array.isArray(item.content) ? item.content : []);
  if (content.length !== 1 || content[0].type !== "output_text" || typeof content[0].text !== "string") throw new Error("luna_response_shape");
  return z.object({ identity: z.unknown(), goalieStatuses: z.unknown() }).strict().parse(JSON.parse(content[0].text));
}

type IdentityProjection = ReturnType<typeof projectSavedPlayerIdentityEvidence>;

// A stored roster row can corroborate the club in this report. It cannot establish an active roster interval.
function reportRosterRecord(request: FixtureIdentityRequest, playerId: number, projection?: IdentityProjection) {
  const { source } = request.content;
  if (!source.publishedAt || !projection || projection.evaluation.mode !== "causal_as_of"
    || projection.snapshot.hash !== request.content.directory.hash
    || timestampMicros(projection.knowledgeCutoff) !== timestampMicros(source.publishedAt)) return null;
  const at = timestampMicros(source.publishedAt)!;
  const season = rosterSeasonForDate(source.publishedAt);
  const rows = projection.evidence.memberships.filter(row => {
    const record = row.recordInterval;
    return row.nhlId === playerId && record?.seasonId === season && row.knownAt && timestampMicros(row.knownAt)! <= at
      && timestampMicros(record.createdAt)! <= at && (record.endedAt ? timestampMicros(record.endedAt)! > at : record.isCurrent);
  });
  const row = rows[0];
  if (!row || rows.some(other => other.teamId !== row.teamId)) return null;
  // These are the two roster witnesses retained by the historical and FxTwitter input builders.
  const record = rows.find(r => r.provenance === `retained NHL roster ${season}/${r.teamId}/${playerId}`
    || r.provenance === `Dated public.rosters membership for the ${String(season).slice(0, 4)}–${String(season).slice(-2)} season`);
  if (!record) return null;
  return { teamId: row.teamId, season, rosterSource: record.provenance, rosterRecordedAt: record.recordInterval!.createdAt,
    rosterKnownAt: record.knownAt!, scope: "this_report" as const };
}

function reportedAbsenceClub(request: FixtureIdentityRequest, start: number, playerId: number, projection?: IdentityProjection, namedClubHandle?: string | null,
  moves?: NonNullable<ReturnType<typeof reportedClubRosterMoves>>) {
  const { source } = request.content;
  const facts = reportRosterRecord(request, playerId, projection);
  const club = facts && Object.values(teamsInfo).find(team => team.id === facts.teamId);
  if (!facts || !club || !source.publishedAt) return null;
  if (namedClubHandle) {
    if (moves && !rosterMoveClub(moves, facts.teamId, source.publishedAt)) return null;
    if (!moves && !bulletinNamesClub(namedClubHandle, club.name, club.abbrev, source.publishedAt)) return null;
    return { ...facts, basis: moves?.basis === "byline" ? "club_medical_bulletin" as const : "club_named_in_report" as const,
      reportingClub: moves?.basis === "club_text" ? namedClubHandle
        : (source.text.toLowerCase().includes("#" + namedClubHandle) ? "#" : "@") + namedClubHandle };
  }
  const originalAuthor = source.authorId.replace(/^@/, "").toLowerCase();
  const official = Object.entries(clubHandles.teams).some(([abbreviation, account]) =>
    abbreviation === club.abbrev && account.handle === originalAuthor);
  if (official && source.publishedAt.slice(0, 10) > clubHandles.checkedAt
    && bilingualAbsenceBulletin(source.text)?.reports.some(r => r.start === start)) {
    return { ...facts, basis: "club_medical_bulletin" as const, reportingClub: originalAuthor };
  }
  const lead = source.text.slice(0, start).trimEnd();
  const token = absenceCoachCredit(lead)?.club;
  if (!token) return null;
  const names = [club.name, club.shortName, club.abbrev, ...(teamHashtagsByAbbreviation[club.abbrev] ?? [])];
  if (club.abbrev === "COL") names.push("Avs");
  if (!names.some(name => name.toLowerCase() === token.toLowerCase())) return null;
  return { ...facts, basis: "club_coach_report" as const, reportingClub: token,
    attributionSpan: { start: 0, end: lead.length, text: lead } };
}

function datedOriginalPost(source: FixtureIdentityRequest["content"]["source"]) {
  const url = /^https:\/\/(?:x|twitter)\.com\/([\w]{1,15})\/status\/(\d+)$/.exec(source.url);
  const clock = tweetPublicationFromUrl(source.url);
  return Boolean(url && clock && source.publishedAt && !isRelayAccount(source.authorId)
    && url[1]!.toLowerCase() === source.authorId.replace(/^@/, "").toLowerCase() && url[2] === source.originalPostId
    && Math.floor(Date.parse(clock) / 1000) === Math.floor(Date.parse(source.publishedAt) / 1000));
}

/** Two language occurrences can establish one assignment on the retained original. */
export function deriveLunaBilingualGameAssignments(request: FixtureIdentityRequest, identity: ReturnType<typeof validateFixtureIdentityProposal>,
  projection?: IdentityProjection, packet?: TweetReviewPacket) {
  const { source, occurrences } = request.content;
  const report = readBilingualGameReport(source.text), publishedAt = source.publishedAt;
  const received = timestampMicros(source.receivedAt);
  if (!report || report.wrapper || !datedOriginalPost(source) || !publishedAt || received == null || received < timestampMicros(publishedAt)!
    || !projection || projection.evidence.truncated || identity.requestHash !== request.hash || identity.directoryHash !== projection.snapshot.hash) return [];
  const samePacket = packet && !packet.holds.length && packet.source.retainedSourceId === source.id
    && packet.source.originalPostId === source.originalPostId && packet.source.url === source.url && packet.source.text === source.text
    && packet.source.author?.replace(/^@/, "").toLowerCase() === source.authorId.replace(/^@/, "").toLowerCase()
    && packet.source.publishedAt && timestampMicros(packet.source.publishedAt) === timestampMicros(publishedAt) && timestampMicros(packet.source.ingestedAt) === received;
  return report.pairs.flatMap(pair => {
    const bindings = [pair.french, pair.english].flatMap(clause => {
      const matches = occurrences.filter(o => o.span.start === clause.subject.start && o.span.end === clause.subject.end && o.span.text === pair.name);
      const o = matches[0], set = o?.candidateSet;
      const selected = identity.occurrences.find(s => s.occurrenceId === o?.id), candidate = set?.candidates[0];
      if (matches.length !== 1 || !o || o.kind !== "name" || !set || set.truncated || set.omittedCount || set.exactStatus !== "matched"
        || set.candidates.length !== 1 || candidate?.basis !== "full_name" || candidate.row.fullName !== pair.name
        || selected?.status !== "matched" || selected.canonicalId !== candidate.row.canonicalId) return [];
      return [{ o, candidate }];
    });
    if (bindings.length !== 2) return [];
    const { row } = bindings[0]!.candidate;
    const sameId = (o: typeof occurrences[number]) => o.candidateSet.candidates.some(c => c.row.canonicalId === row.canonicalId);
    if (bindings[1]!.candidate.row.canonicalId !== row.canonicalId || occurrences.some(o => !bindings.some(b => b.o.id === o.id)
      && (sameId(o) || o.span.text === pair.name))) return [];
    const roster = reportRosterRecord(request, row.nhlPlayerId, projection);
    if (!roster || bindings.some(b => b.candidate.activeTeamIds.some(id => id !== roster.teamId))
      || !bilingualRosterPosition(pair, row.positions)) return [];
    const teams = Object.values(teamsInfo);
    // Without a schedule the printed opponent is text only. A same-club or ambiguous name is a hold.
    const opponents = teams.filter(other => bulletinFitsMatchup(report.opponent, roster.teamId, other.id, source.authorId, publishedAt));
    if (!opponents.length || (report.opponent && opponents.length !== 1)) return [];
    const date = reportedAbsenceDate(publishedAt, roster.teamId, "tonight");
    const claims = samePacket ? packet.candidates.filter(c => c.fact && "playerId" in c.fact && c.fact.playerId === row.nhlPlayerId) : [];
    const claim = claims.length === 1 ? claims[0] : undefined;
    const scope = claim?.scope, anchor = claim?.anchor, fact = claim?.fact;
    const start = claim?.effectiveAt?.replace(/^(\d{4}-\d{2}-\d{2}) /u, "$1T");
    const correct = pair.status === "starter" ? fact?.kind === "starter" : fact?.kind === "availability" && fact.status === (pair.status === "in" ? "available" : "out");
    const bound = claim?.extractionVersion === BILINGUAL_GAME_CLAIM_VERSION && !claim.holds.length && claim.modality === "asserted" && correct && scope?.kind === "game" && scope.phase === "entry"
      && scope.teamId === roster.teamId && scope.group == null && start && timestampMicros(start) != null && timestampMicros(start)! >= received
      && reportedAbsenceDate(start, roster.teamId, "today") === date && anchor?.subjectSpan.start === pair.english.subject.start
      && anchor.subjectSpan.end === pair.english.subject.end && anchor.subjectSpan.text === pair.name
      && anchor.predicateSpan.start === pair.english.predicate.start && anchor.predicateSpan.end === pair.english.predicate.end && anchor.predicateSpan.text === pair.english.predicate.text;
    return [{ playerId: row.nhlPlayerId, teamId: roster.teamId, roster, occurrenceId: bindings[1]!.o.id, canonicalId: row.canonicalId,
      status: pair.status, gameId: bound ? scope.gameId : null, observationId: bound ? claim.observationId : null, date,
      subject: pair.english.subject, predicate: pair.english.predicate, evidence: pair.english.evidence, translation: pair.french.evidence,
      reportedOpponent: report.opponent, originalPostId: source.originalPostId, author: source.authorId, sourceUrl: source.url,
      publishedAt, receivedAt: source.receivedAt, canApply: false as const }];
  });
}

/** Preserve a reporter's uncertain availability decision with the exact player and clause that support it. */
export function deriveLunaAvailabilityReports(request: FixtureIdentityRequest, identity: ReturnType<typeof validateFixtureIdentityProposal>,
  projection: IdentityProjection) {
  const { source, occurrences } = request.content, received = timestampMicros(source.receivedAt);
  if (!datedOriginalPost(source) || !source.publishedAt || received == null || received < timestampMicros(source.publishedAt)!
    || /^\s*(?:RT|QT) @/iu.test(source.text) || projection.evidence.truncated || identity.requestHash !== request.hash
    || identity.directoryHash !== projection.snapshot.hash) return [];
  const decisions = identity.occurrences;
  return occurrences.flatMap(o => {
    const { candidateSet: set, span } = o;
    const selected = decisions.find(d => d.occurrenceId === o.id);
    if (o.kind !== "name" || !exactIdentitySpan(source.text, span) || selected?.status !== "matched" || set.truncated
      || set.omittedCount || set.exactStatus !== "matched") return [];
    const exact = set.candidates.filter(c => c.basis === "full_name" || c.basis === "surname");
    const candidate = exact[0];
    if (exact.length !== 1 || !candidate || candidate.row.canonicalId !== selected.canonicalId) return [];
    const decision = reportedGameTimeDecision(source.text, span.start, span.end);
    const expectation = reportedLineupExpectation(source.text, span.start, span.end);
    const clause = decision ?? expectation;
    if (!clause) return [];
    const row = candidate.row, roster = reportRosterRecord(request, row.nhlPlayerId, projection);
    if (!roster || candidate.activeTeamIds.some(id => id !== roster.teamId)) return [];
    // A bare surname and a partial historical list alone cannot exclude a namesake.
    if (!(candidate.basis === "full_name" && span.text === row.fullName) && !candidate.activeTeamIds.length) return [];
    const club = taggedGameTimeDecision(source.text);
    if (club && (club.teamId !== roster.teamId || club.name !== row.fullName)) return [];
    const teamId = club || candidate.activeTeamIds.length === 1 ? roster.teamId : null;
    return [{ playerId: row.nhlPlayerId, canonicalId: row.canonicalId, occurrenceId: o.id, teamId, roster,
      gameId: null, status: expectation?.status ?? "game_time_decision" as const, availability: "uncertain" as const, ...clause,
      originalPostId: source.originalPostId, sourceUrl: source.url, author: source.authorId, publishedAt: source.publishedAt,
      receivedAt: source.receivedAt, canApply: false as const }];
  });
}

export function deriveLunaGameTimeDecisions(...args: Parameters<typeof deriveLunaAvailabilityReports>) {
  return deriveLunaAvailabilityReports(...args).filter(report => report.status === "game_time_decision");
}

/** A numbered five is a report-level draft. Admission, game binding and carry-forward are separate decisions. */
export function deriveLunaReportedPowerPlays(request: FixtureIdentityRequest, identity: ReturnType<typeof validateFixtureIdentityProposal>,
  projection: IdentityProjection) {
  const { source, occurrences } = request.content;
  if (!source.publishedAt || !datedOriginalPost(source) || projection.evaluation.mode !== "causal_as_of"
    || request.hash !== identity.requestHash || identity.directoryHash !== projection.snapshot.hash || projection.evidence.truncated
    || projection.snapshot.hash !== request.content.directory.hash || timestampMicros(source.publishedAt)! > timestampMicros(source.receivedAt)!) return [];
  const report = readNumberedPowerPlayReport(source.text);
  if (!report) return [];
  const records = new Map(projection.snapshot.content.rows.map(row => [row.nhlPlayerId, reportRosterRecord(request, row.nhlPlayerId, projection)]));
  const roster = projection.snapshot.content.rows.filter(row => report.teamId === null || records.get(row.nhlPlayerId)?.teamId === report.teamId)
    .map(row => ({ playerId: row.nhlPlayerId, fullName: row.fullName, lastName: row.lastName, position: row.positions[0] }));
  const reading = interpretTweetUnits(source.text, roster);
  return printedPowerPlayUnits(source.text, reading, report).flatMap(({ unit, heading }) => {
    const players = unit.players.flatMap((player, index) => {
      const span = unit.evidence[index]!;
      const mention = occurrences.find(o => o.kind === "name" && o.span.start === span.start && o.span.end === span.end && o.span.text === span.text);
      const selected = mention && identity.occurrences.find(o => o.occurrenceId === mention.id);
      const record = records.get(player.playerId);
      if (!record || !mention || !selected || mention.candidateSet.truncated || mention.candidateSet.omittedCount !== 0) return [];
      const exact = mention.candidateSet.candidates.filter(c => ["full_name", "surname", "alias"].includes(c.basis));
      if (!exact.some(c => c.row.nhlPlayerId === player.playerId && c.basis !== "alias")) return [];
      const oneDatedMatch = exact.length > 1 && report.teamId === record.teamId && exact.every(c => records.get(c.row.nhlPlayerId))
        && exact.filter(c => records.get(c.row.nhlPlayerId)?.teamId === record.teamId).length === 1;
      if (exact.length > 1 && !oneDatedMatch) return [];
      const matched = selected.status === "matched" && selected.canonicalId === `nhl:${player.playerId}`;
      // A model abstention stays in the identity result. An independent report-only match needs a named club,
      // a complete set of exact candidates with dated teams, and corroborating teammates in the same five.
      if (!matched && !(selected.status === "ambiguous" && selected.canonicalId === null && oneDatedMatch)) return [];
      return [{ ...player, occurrenceId: mention.id, span, roster: record,
        identityBasis: matched ? "validated_identity" as const : "dated_team_roster" as const }];
    });
    const teamId = players[0]?.roster.teamId;
    if (players.length !== 5 || !teamId || players.some(p => p.roster.teamId !== teamId)
      || (report.teamId !== null && report.teamId !== teamId)
      || players.filter(p => p.identityBasis === "validated_identity").length < 2) return [];
    return [{ number: unit.number!, heading, teamId, clubSpan: report.clubSpan, phase: report.phase, certainty: "reported" as const, players,
      originalPostId: source.originalPostId, sourceUrl: source.url, author: source.authorId, publishedAt: source.publishedAt!,
      receivedAt: source.receivedAt, gameId: null, canApply: false as const }];
  });
}

/** A named NHL roster move can be reported without assigning a game or a return date. */
export function deriveLunaRosterMoves(request: FixtureIdentityRequest, identity: ReturnType<typeof validateFixtureIdentityProposal>,
  projection: IdentityProjection) {
  const { source, occurrences } = request.content;
  if (!datedOriginalPost(source) || !source.publishedAt || /^(?:RT|QT) @/i.test(source.text)) return [];
  const bulletin = reportedClubRosterMoves(source.text, source.authorId);
  if (!bulletin) return [];
  return bulletin.moves.flatMap(update => {
    const occurrence = occurrences.find(o => o.span.start === update.subject.start && o.span.end === update.subject.end
      && o.span.text === update.subject.text);
    if (!occurrence || occurrence.kind !== "name" || occurrence.candidateSet.truncated || occurrence.candidateSet.exactStatus !== "matched"
      || occurrence.candidateSet.candidates.length !== 1) return [];
    const [candidate] = occurrence.candidateSet.candidates;
    const selected = identity.occurrences.find(o => o.occurrenceId === occurrence.id);
    if (!candidate || candidate.basis !== "full_name" || candidate.activeTeamIds.length > 1
      || selected?.status !== "matched" || selected.canonicalId !== candidate.row.canonicalId) return [];
    const teamEvidence = reportedAbsenceClub(request, update.subject.start, candidate.row.nhlPlayerId, projection, bulletin.handle, bulletin);
    if (!teamEvidence || (candidate.activeTeamIds.length && !candidate.activeTeamIds.includes(teamEvidence.teamId))) return [];
    return [{ occurrenceId: occurrence.id, playerId: candidate.row.nhlPlayerId, teamEvidence, teamId: candidate.activeTeamIds[0] ?? null,
      gameId: null, move: update.move, retroactiveAsReported: update.retroactive, subject: update.subject, evidence: update.evidence,
      ...(update.reportedDestination ? { reportedDestination: update.reportedDestination } : {}),
      originalPostId: source.originalPostId, author: source.authorId, sourceUrl: source.url, publishedAt: source.publishedAt,
      receivedAt: source.receivedAt, canApply: false as const }];
  });
}

/** The original may establish who will miss a game even when the request contains no verified game or team. */
export function deriveLunaGameAbsences(request: FixtureIdentityRequest, identity: ReturnType<typeof validateFixtureIdentityProposal>,
  projection: IdentityProjection, packet?: TweetReviewPacket) {
  const { source, occurrences } = request.content;
  const bulletin = readClubMedicalBulletin(source.text);
  const publishedAt = source.publishedAt;
  if (!publishedAt || !datedOriginalPost(source) || /^(?:RT|QT) @/i.test(source.text) || projection.evaluation.mode !== "causal_as_of" || projection.snapshot.hash !== request.content.directory.hash
    || timestampMicros(projection.knowledgeCutoff) !== timestampMicros(publishedAt)) return [];
  return occurrences.flatMap(occurrence => {
    const { span, candidateSet } = occurrence;
    const reading = reportedGameAbsence(source.text, span.start, span.end);
    const proposed = identity.occurrences.find(o => o.occurrenceId === occurrence.id);
    const [candidate] = candidateSet.candidates;
    if (!reading || proposed?.status !== "matched" || candidateSet.truncated || candidateSet.exactStatus !== "matched"
      || candidateSet.candidates.length !== 1 || candidate?.basis !== "full_name" || proposed.canonicalId !== candidate.row.canonicalId
      || candidate.activeTeamIds.length > 1 || occurrences.some(other => other.id !== occurrence.id && other.span.text === span.text)) return [];
    const teamId = candidate.activeTeamIds[0] ?? null;
    const clubHandle = reading.namedClubHandle ?? (bulletin?.updates.some(u => u.subject.start === span.start && u.subject.end === span.end) ? bulletin.handle : null);
    const teamEvidence = clubHandle ? reportedAbsenceClub(request, span.start, candidate.row.nhlPlayerId, projection, clubHandle) : null;
    if (reading.namedClubHandle && teamId && !teamEvidence) return [];
    const reportTeam = teamId ?? teamEvidence?.teamId ?? null;
    const date = reportedAbsenceDate(source.publishedAt, reportTeam, reading.relative);
    if ((teamEvidence && teamId && teamId !== teamEvidence.teamId) || (reading.opponentId && reading.opponentId === reportTeam)) return [];
    // Only the sealed packet can supply a game. An identity wire, club name or relative day alone cannot.
    const samePacket = packet && !packet.holds.length && packet.source.retainedSourceId === source.id
      && packet.source.originalPostId === source.originalPostId && packet.source.url === source.url && packet.source.text === source.text
      && packet.source.publishedAt && timestampMicros(packet.source.publishedAt) === timestampMicros(publishedAt)
      && timestampMicros(packet.source.ingestedAt) === timestampMicros(source.receivedAt);
    const subjectClaims = samePacket ? packet.candidates.filter(c => c.fact?.kind === "availability" && c.fact.playerId === candidate.row.nhlPlayerId) : [];
    const claim = subjectClaims.length === 1 ? subjectClaims[0] : null;
    const scope = claim?.scope, anchor = claim?.anchor;
    const start = claim?.effectiveAt?.replace(/^(\d{4}-\d{2}-\d{2}) /u, "$1T") ?? "";
    const startAt = timestampMicros(start), receivedAt = timestampMicros(source.receivedAt);
    const gameEvidence = reportTeam && date && claim && !claim.holds.length && claim.modality === "asserted" && claim.fact?.kind === "availability"
      && claim.fact.status === "out" && scope?.kind === "game" && scope.phase === "entry" && scope.group === null && scope.teamId === reportTeam
      && anchor?.subjectSpan.start === span.start && anchor.subjectSpan.end === span.end && anchor.subjectSpan.text === span.text
      && anchor.predicateSpan.start === reading.predicate.start && anchor.predicateSpan.end === reading.predicate.end
      && anchor.predicateSpan.text === reading.predicate.text && startAt !== null && receivedAt !== null && startAt >= receivedAt
      && reportedAbsenceDate(start, reportTeam, "today") === date
      ? { teamId: scope.teamId, gameId: scope.gameId, observationId: claim.observationId, startTime: claim.effectiveAt } : null;
    return [{ occurrenceId: occurrence.id, playerId: candidate.row.nhlPlayerId, teamId, gameId: gameEvidence?.gameId ?? null, gameEvidence, ...(teamEvidence ? { teamEvidence } : {}),
      relativeDay: reading.relative, date,
      reportedClubHandle: clubHandle, reportedOpponent: reading.opponent, reportedVenue: reading.venue,
      dateBasis: date ? "original_publication_in_nhl_timezones" as const : null, availability: "out" as const, recovery: reading.recovery,
      subject: span, predicate: reading.predicate, originalPostId: source.originalPostId, author: source.authorId,
      sourceUrl: source.url, publishedAt: source.publishedAt, receivedAt: source.receivedAt, canApply: false as const }];
  });
}

/** A validated name can support a private draft when the dated team and the actual predicate agree. */
export function deriveLunaAbsenceDrafts(request: FixtureIdentityRequest, identity: ReturnType<typeof validateFixtureIdentityProposal>,
  projection?: IdentityProjection) {
  const { source, occurrences } = request.content;
  if (!datedOriginalPost(source)) return [];
  const named = occurrences.flatMap(occurrence => {
    const proposed = identity.occurrences.find(o => o.occurrenceId === occurrence.id);
    const candidate = occurrence.candidateSet.candidates.find(c => c.row.canonicalId === proposed?.canonicalId);
    if (proposed?.status !== "matched" || occurrence.candidateSet.truncated || occurrence.candidateSet.exactStatus !== "matched"
      || candidate?.basis !== "full_name" || candidate.activeTeamIds.length > 1) return [];
    if (occurrences.some(other => other.span.text === occurrence.span.text && !identity.occurrences.some(o =>
      o.occurrenceId === other.id && o.status === "matched" && o.canonicalId === proposed.canonicalId))) return [];
    const evidence = candidate.activeTeamIds.length ? null : reportedAbsenceClub(request, occurrence.span.start, candidate.row.nhlPlayerId, projection);
    const teamId = candidate.activeTeamIds[0] ?? evidence?.teamId ?? null;
    if (!teamId) {
      const { span } = occurrence;
      const reading = reportedAbsenceDuration(source.text, span.start, span.end);
      if (!reading || !("irContinuation" in reading) || occurrence.candidateSet.candidates.length !== 1
        || span.text !== candidate.row.fullName || /^(?:RT|QT) @/i.test(source.text)
        || projection?.evaluation.mode !== "causal_as_of" || projection.snapshot.hash !== request.content.directory.hash
        || !source.publishedAt || timestampMicros(projection.knowledgeCutoff) !== timestampMicros(source.publishedAt)) return [];
    }
    return [{ occurrence, teamEvidence: evidence, player: { playerId: candidate.row.nhlPlayerId, fullName: candidate.row.fullName, lastName: candidate.row.lastName,
      teamId, position: candidate.row.positions[0] } }];
  });
  if (!named.some(({ occurrence: { span } }) => reportedAbsenceDuration(source.text, span.start, span.end))) return [];
  const players = [...new Map(named.map(({ player }) => [player.playerId, player])).values()];
  const events = extractTweetPlayerEvents({ text: source.text, publishedAt: source.publishedAt, players, includeClaimAnchors: true });
  return named.flatMap(({ occurrence, player, teamEvidence }) => {
    const claims = events.filter(e => e.kind === "injury" && e.playerId === player.playerId);
    const [event] = claims;
    const { span } = occurrence;
    const absence = reportedAbsenceDuration(source.text, span.start, span.end);
    if (!absence || claims.length !== 1 || !event || event.reviewReason || event.claimAnchor?.subjectSpan.start !== span.start
      || event.claimAnchor.subjectSpan.end !== span.end || event.evidence.end !== absence.predicate.end
      || event.modality !== (absence.tentative ? "tentative" : "affirmative")) return [];
    return [{ occurrenceId: occurrence.id, playerId: player.playerId, teamId: teamEvidence ? null : player.teamId,
      ...(teamEvidence ? { teamEvidence } : {}), gameId: null, modality: event.modality,
      availability: event.availability, timeline: absence.timeline, subject: span, predicate: absence.predicate,
      evidence: event.evidence, originalPostId: source.originalPostId, sourceUrl: source.url, author: source.authorId,
      publishedAt: source.publishedAt, receivedAt: source.receivedAt, canApply: false as const }];
  });
}

/** Explicit post-retention caller. Deterministic packet is immutable; Luna suggestions
 * are never fed back as canonical claims to the reviewer or to the publication path.
 * One Responses call and optionally one Decisions call; no paid widening/retries.
 */
export async function runRetainedTweetLunaReview(args: {
  enabled?: boolean; input: LunaReviewInput; transport?: LunaTransport; now?: () => string;
}) {
  const base = { version: LUNA_REVIEW_VERSION, ...LUNA_REVIEW_AUTHORITY, status: "disabled", holds: [] as string[],
    referencePackage: LUNA_REFERENCE_PACKAGE, responsesRequestHash: null as string | null,
    lineage: null as null | { originalPostId: string | null; author: string | null; url: string | null; textVersion: string; packetHash: string },
    identity: null as ReturnType<typeof validateFixtureIdentityProposal> | null,
    goalieStatuses: [] as ReturnType<typeof validateLunaGoalieStatuses>, decisionReview: null as ReturnType<typeof validateTweetDecisionReviewResult> | null,
    attempts: 0, requestIds: [] as (string | null)[], reviewQueueKey: null as string | null };
  if (args.enabled !== true) return base;
  const now = args.now ?? (() => new Date().toISOString());
  let availability: ReturnType<typeof deriveLunaAvailabilityReports> = [];
  let powerPlays: ReturnType<typeof deriveLunaReportedPowerPlays> = [];
  let paired: ReturnType<typeof deriveLunaBilingualGameAssignments> = [];
  let gameAbsences: ReturnType<typeof deriveLunaGameAbsences> = [];
  let rosterMoves: ReturnType<typeof deriveLunaRosterMoves> = [];
  let absenceDrafts: ReturnType<typeof deriveLunaAbsenceDrafts> = [];
  try {
    const input = structuredClone(args.input), packet = input.packet;
    base.referencePackage = getLunaReferencePackage(input.referenceMode);
    if (Buffer.byteLength(JSON.stringify(input)) > 512_000) throw new Error("review_input_too_large");
    const mapped = mapTweetDecisionReview({ enabled: true, packet, extractionVersion: input.extractionVersion, statements: input.statements });
    if (mapped.status !== "mapped") return { ...base, status: "held", holds: ["retained_packet_unresolved"] };
    if (timestampMicros(now()) === null || timestampMicros(now())! < timestampMicros(packet.source.ingestedAt)!) throw new Error("review_clock_invalid");
    base.lineage = { originalPostId: packet.source.originalPostId, author: packet.source.author, url: packet.source.url,
      textVersion: packet.source.sourceTextVersionId, packetHash: mapped.packetHash };
    base.reviewQueueKey = identityDigest([LUNA_REVIEW_VERSION, base.referencePackage, mapped.packetHash, input]);
    base.status = "review_only";
    if (!args.transport) return { ...base, status: "held", holds: ["explicit_transport_required"] };
    if (input.identity) {
      const id = input.identity;
      if (timestampMicros(id.evaluation.sourcePublishedAt) !== timestampMicros(packet.source.publishedAt!)
        || timestampMicros(id.asOf) === null || timestampMicros(id.asOf)! > timestampMicros(now())!) throw new Error("identity_source_clock_mismatch");
      // Rebuild for this source: never reuse a later-cutoff bare snapshot.
      const projection = projectSavedPlayerIdentityEvidence(id.evidence, { asOf: id.asOf, evaluation: id.evaluation });
      const index = indexPlayerIdentitySnapshot(projection.snapshot);
      if (!index.snapshot.content.rows.length) throw new Error("dated_identity_evidence_unavailable");
      const prepared = prepareFixtureIdentityRequest({ enabled: true, index, mentions: id.mentions, source: {
        id: packet.source.retainedSourceId, text: packet.source.text, originalPostId: packet.source.originalPostId!,
        authorId: packet.source.author!, url: packet.source.url!, publishedAt: packet.source.publishedAt, receivedAt: packet.source.ingestedAt,
        provenance: { kind: "approved_local", label: `retained-sidecar:${mapped.packetHash}`, lineageKey: packet.source.originalPostId! },
      } });
      if (prepared.status !== "prepared") throw new Error("identity_preparation_held");
      const wire = buildLunaReviewRequest(prepared.request, { source: {
        retainedSourceId: packet.source.retainedSourceId, sourceTextVersionId: packet.source.sourceTextVersionId,
        originalPostId: packet.source.originalPostId, author: packet.source.author, url: packet.source.url,
        publishedAt: packet.source.publishedAt, ingestedAt: packet.source.ingestedAt, provenance: packet.source.provenance,
      }, packetHash: mapped.packetHash, identityEvaluation: projection.evaluation, identityAsOf: id.asOf }, input.referenceMode);
      base.responsesRequestHash = identityDigest(wire);
      const receipt = await args.transport("responses", wire, { onAdmitted: () => { base.attempts++; } });
      base.requestIds.push(receipt.requestId);
      const raw = outputJson(receipt.body);
      base.identity = validateFixtureIdentityProposal(prepared.request, raw.identity);
      base.goalieStatuses = validateLunaGoalieStatuses(prepared.request, base.identity, raw.goalieStatuses, projection);
      if (projection.evaluation.mode === "causal_as_of") {
        paired = deriveLunaBilingualGameAssignments(prepared.request, base.identity, projection, packet);
        availability = deriveLunaAvailabilityReports(prepared.request, base.identity, projection);
        powerPlays = deriveLunaReportedPowerPlays(prepared.request, base.identity, projection);
        rosterMoves = deriveLunaRosterMoves(prepared.request, base.identity, projection);
        absenceDrafts = deriveLunaAbsenceDrafts(prepared.request, base.identity, projection);
        gameAbsences = deriveLunaGameAbsences(prepared.request, base.identity, projection, packet);
      }
      if (base.identity.occurrences.some(o => o.status !== "matched")) base.holds.push("identity_abstention_or_widening_requires_review");
      if (projection.evaluation.mode === "retrospective") base.holds.push("retrospective_development_evidence");
    }
    if (input.decisions === true) {
      const transport = args.transport;
      let transportError: unknown = null;
      const adapter = createShadowAdapter({ now, config: { enabled: true, maxRequests: 1, maxInputTokens: 70_000,
        maxEstimatedUsd: 1, maxInputBytesPerRequest: 65_536, maxReservedTokensPerRequest: 70_000, timeoutMs: 16_000 },
      transport: async (request) => {
        try {
          const receipt = await transport("decisions", request, { onAdmitted: () => { base.attempts++; } });
          base.requestIds.push(receipt.requestId);
          return { body: receipt.body, requestId: receipt.requestId ?? undefined };
        } catch (error) { transportError = error; throw error; }
      } });
      const sidecar = await adapter.evaluate(mapped.input);
      base.decisionReview = validateTweetDecisionReviewResult(mapped, { bindingVersion: DECISION_REVIEW_BINDING_VERSION,
        planHash: mapped.planHash, packetHash: mapped.packetHash, sidecar });
      if (base.decisionReview.status !== "bound_review") base.holds.push("decisions_unresolved");
      // The adapter absorbs transport errors as unknown/skipped; an unusable leg is held, never review_only.
      if (base.decisionReview.status === "unknown") throw transportError ?? new Error("decisions_reference_unavailable");
    }
    base.holds.push("human_review_required", "no_publication_authority");
    const gameTimeDecisions = availability.filter(report => report.status === "game_time_decision");
    const expectations = availability.filter(report => report.status !== "game_time_decision");
    return { ...base,
      ...(expectations.length ? { reportedLineupExpectations: expectations } : {}),
      ...(gameTimeDecisions.length ? { reportedGameTimeDecisions: gameTimeDecisions } : {}),
      ...(paired.length ? { reportedGameAssignments: paired } : {}),
      ...(powerPlays.length ? { reportedPowerPlays: { version: "reported-power-play-v1", units: powerPlays } } : {}),
      ...(rosterMoves.length ? { reportedRosterMoves: { version: "reported-roster-move-v1", assignments: rosterMoves } } : {}),
      ...(absenceDrafts.length ? { reportedAbsences: { version: "reported-absence-draft-v1", assignments: absenceDrafts } } : {}),
      ...(gameAbsences.length ? { reportedGameAbsences: { version: "reported-game-absence-v1", assignments: gameAbsences } } : {}) };
  } catch (error) {
    // Do not propagate provider errors, input text or credentials into operational logs.
    const safeReasons = new Set(["review_input_too_large", "review_clock_invalid", "identity_source_clock_mismatch",
      "dated_identity_evidence_unavailable", "identity_preparation_held", "goalie_subject_binding_invalid", "goalie_certainty_inflation",
      "goalie_definite_wording_unsupported", "goalie_context_unresolved", "goalie_conflict_or_correction_unresolved", "goalie_tentative_wording_unsupported",
      "luna_reference_mode_invalid", "luna_response_incomplete", "luna_response_shape", "luna_dispatch_disabled",
      "luna_budget_stopped", "luna_budget_exhausted", "luna_unsettled_attempt", "luna_attempt_held_no_retry", "luna_request_too_large", "decisions_reference_unavailable"]);
    const reason = error instanceof Error && safeReasons.has(error.message) ? error.message : "invalid_or_unavailable_review";
    return { ...base, status: "held", holds: [...base.holds, reason] };
  }
}
