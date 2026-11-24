import { qualifyStoredReturn, reportedLineupExpectation } from "./lineupReturnEvidence";
import { verifiedGameTimeDecision } from "./reportedGameTimeDecision";
import { reportedPracticeDepth } from "./reportedPracticeDepth";
import { hasNonPlayerSubject } from "./playerNameInProse";
import { readGoalieStartDay, verifiedGoaliePostTime } from "./tweetGoalieStartDate";
import { isNewsRelayAccount, sanitizePublicNewsText } from "lib/newsFeed";
import { completeEvenStrengthUnits, detectTweetLineContext, fiveForwardWorkHeading, reportedPowerPlayPenalty, type TweetInterpretation, type TweetUnit } from "./tweetInterpretation";
import { tweetPublicationFromUrl } from "./tweetPublicationTime";
import { lineReportTimeScope } from "./lineReportTime";

export type ProjectionReport = {
  key: string;
  teamId: number;
  teamAbbreviation: string;
  gameId: number | null;
  session: string | null;
  date: string;
  publishedAt: string | null;
  originalPublishedAt: string | null;
  receivedAt: string;
  interpretedAt?: string;
  originalUrl: string | null;
  verifiedOriginalAuthor?: string;
  reportedPracticeDepth?: TweetUnit[];
  reportedLineupExpectations?: Array<{ playerId: number; playerName: string; status: "possible_return" | "expected_in_lineup" }>;
  reportedInGamePP?: Array<{ number: number; players: TweetUnit["players"] }>;
  reviewReason?: "conflicting_claims";
  text: string;
  interpretation: TweetInterpretation;
  provenance?: { relayTweetId: string | null; originalTweetId: string | null; attributionStatus: "resolved" | "pending" };
};
export type ProjectedUnitSet = {
  key: string;
  situation: "es" | "pp" | "pk";
  group: string | null;
  units: TweetUnit[];
  reports: ProjectionReport[];
  publishedAt: string;
};

export function verifiedOriginalTweetUrl(url: string | null, originalHandle?: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !/^(?:www\.)?(?:x|twitter)\.com$/.test(parsed.hostname)) return null;
    const match = parsed.pathname.match(/^\/([A-Za-z0-9_]+)\/(?:web\/)?status\/(\d+)$/);
    if (!match || isNewsRelayAccount(match[1])) return null;
    const handle = match[1] === "i" ? originalHandle : match[1];
    if (!handle || handle === "i" || isNewsRelayAccount(handle) || !/^[A-Za-z0-9_]+$/.test(handle)) return null;
    return `https://x.com/${handle}/status/${match[2]}`;
  } catch { return null; }
}

export function easternReportDate(timestamp: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(timestamp));
}

/** A calendar date alone is deliberately insufficient to pair practice reports. */
export function explicitPracticeSession(text: string): string | null {
  const session = text.match(/\b(morning skate|morning practice|afternoon practice|evening practice|camp day\s*\d+|day\s*\d+\s+of camp)\b/i)?.[0];
  return session?.toLowerCase().replace(/\s+/g, " ") ?? null;
}

function scope(report: ProjectionReport, group: string | null): string {
  return [report.teamId, report.date, report.gameId != null ? `game:${report.gameId}` : report.session ?? `report:${report.key}`, group ?? "main"].join(":");
}

function validUnit(unit: TweetUnit) {
  const expected = unit.situation === "pp" ? 5 : unit.situation === "pk" ? 4 : unit.situation === "es_forward" ? 3 : unit.situation === "es_defense" ? 2 : 1;
  return unit.complete && unit.players.length === expected && unit.players.every((player) => Number.isSafeInteger(player.playerId) && player.playerId > 0)
    && new Set(unit.players.map((player) => player.playerId)).size === expected;
}

export function selectProjectedUnitSets(reports: ProjectionReport[]): ProjectedUnitSet[] {
  const sets: ProjectedUnitSet[] = [];
  const usable = reports.filter((report) => report.publishedAt && Number.isFinite(Date.parse(report.publishedAt)) && easternReportDate(report.publishedAt) === report.date);
  const duringPlay = new Set(usable.filter(report => report.interpretation.lineContext?.phase === "in_game"
    || reportedPowerPlayPenalty(report.text)).map(report => report.key));
  for (const report of usable) {
    for (const group of new Set(report.interpretation.units.map((unit) => unit.group))) {
      const units = report.interpretation.units.filter((unit) => unit.group === group && validUnit(unit));
      const es = completeEvenStrengthUnits(report.interpretation, group);
      if (es.length) {
        sets.push({ key: `${scope(report, group)}:es`, situation: "es", group, units: es, reports: [report], publishedAt: report.publishedAt! });
      }
      for (const situation of ["pp", "pk"] as const) {
        if (situation === "pp" && duringPlay.has(report.key)) continue;
        const own = units.filter((unit) => unit.situation === situation && (situation !== "pp" || unit.explicitNumber));
        if (own.length === 2 && own.some((unit) => unit.number === 1) && own.some((unit) => unit.number === 2)) {
          sets.push({ key: `${scope(report, group)}:${situation}`, situation, group, units: own, reports: [report], publishedAt: report.publishedAt! });
          continue;
        }
        if (own.length !== 1 || !own[0]!.explicitNumber || ![1, 2].includes(own[0]!.number ?? 0) || (report.gameId == null && !report.session) || !report.originalPublishedAt) continue;
        const candidates = usable.filter((other) => other.key !== report.key && scope(other, group) === scope(report, group)
          && (situation !== "pp" || !duringPlay.has(other.key))
          && other.originalPublishedAt && Number.isFinite(Date.parse(other.originalPublishedAt)) && Number.isFinite(Date.parse(report.originalPublishedAt!))
          && easternReportDate(other.originalPublishedAt) === other.date && easternReportDate(report.originalPublishedAt!) === report.date
          && Math.abs(Date.parse(other.originalPublishedAt) - Date.parse(report.originalPublishedAt!)) <= 90 * 60_000);
        const contributions = candidates.flatMap((other) => other.interpretation.units.filter((unit) => unit.situation === situation && unit.group === group && unit.explicitNumber && validUnit(unit)).map((unit) => ({ other, unit })));
        // Do not choose a convenient companion from contradictory reports of either unit.
        const signatures = new Map<number, Set<string>>();
        for (const unit of [own[0]!, ...contributions.map((entry) => entry.unit)]) {
          const signaturesForNumber = signatures.get(unit.number!) ?? new Set<string>();
          signaturesForNumber.add(unit.players.map((player) => player.playerId).join(","));
          signatures.set(unit.number!, signaturesForNumber);
        }
        if ([...signatures.values()].some((values) => values.size > 1)) continue;
        const companion = contributions.filter(({ unit }) => unit.number === (own[0]!.number === 1 ? 2 : 1)).sort((a, b) => Date.parse(b.other.publishedAt!) - Date.parse(a.other.publishedAt!))[0];
        if (!companion) continue;
        sets.push({ key: `${scope(report, group)}:${situation}`, situation, group, units: [own[0]!, companion.unit].sort((a, b) => a.number! - b.number!),
          reports: [report, companion.other], publishedAt: new Date(Math.max(Date.parse(report.publishedAt!), Date.parse(companion.other.publishedAt!))).toISOString() });
      }
    }
  }
  const latest = new Map<string, ProjectedUnitSet>();
  const conflicts = new Set<string>();
  const signature = (set: ProjectedUnitSet) => set.units.map((unit) => [unit.situation, unit.number, unit.players.map((player) => player.playerId).join(",")].join(":")).sort().join("|");
  for (const set of sets.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || a.reports[0]!.key.localeCompare(b.reports[0]!.key))) {
    const previous = latest.get(set.key);
    if (!previous) latest.set(set.key, set);
    else if (Date.parse(previous.publishedAt) === Date.parse(set.publishedAt) && signature(previous) !== signature(set)) conflicts.add(set.key);
  }
  return [...latest.values()].filter((set) => !conflicts.has(set.key));
}

export function publicProjectionReport(report: ProjectionReport): ProjectionReport {
  // Old immutable reports can still contain another game's lineup. Retain the source and its actual parser version.
  const scope = lineReportTimeScope(report.text);
  const reading = scope?.historical ? scope.select(report.interpretation) : report.interpretation;
  const sourceOnly = scope?.historical && !reading.units.length && !reading.events?.length;
  const noGame = sourceOnly || (reading.context === "game" && fiveForwardWorkHeading(report.text)
    && !detectTweetLineContext(report.text).context);
  const originalUrl = verifiedOriginalTweetUrl(report.originalUrl);
  const original = originalUrl?.match(/^https:\/\/x\.com\/([^/]+)\/status\/(\d+)$/);
  const verifiedOriginalAuthor = original && report.provenance?.attributionStatus === "resolved" && report.provenance.originalTweetId === original[2]
    ? original[1] : undefined;
  const postTime = tweetPublicationFromUrl(originalUrl);
  const reportedInGamePP = verifiedOriginalAuthor && postTime && report.originalPublishedAt && !report.reviewReason
    && reading.identityContext?.basis === "publication_roster" && reading.identityContext.sourcePublishedAt
    && Date.parse(reading.identityContext.sourcePublishedAt) === Date.parse(report.originalPublishedAt)
    && reading.lineContext?.phase === "in_game" && !scope?.historical && reportedPowerPlayPenalty(report.text)
    && Math.floor(Date.parse(postTime) / 1000) === Math.floor(Date.parse(report.originalPublishedAt) / 1000)
    ? reading.units.filter(unit => {
      if (unit.situation !== "pp" || !unit.explicitNumber || ![1, 2].includes(unit.number ?? 0) || !validUnit(unit)
        || unit.evidence.length !== 5 || reading.units.filter(other => other.situation === "pp" && other.number === unit.number).length !== 1) return false;
      const first = unit.evidence[0]!.start;
      const lineStart = report.text.lastIndexOf("\n", first - 1) + 1;
      const lineEnd = report.text.indexOf("\n", first);
      const prefix = report.text.slice(lineStart, first).trim();
      return /^PP\s*([12])\s*(?::|is)$/i.exec(prefix)?.[1] === String(unit.number)
        && unit.evidence.every((span, i) => span.start >= (i ? unit.evidence[i - 1]!.end : first) && span.end > span.start
          && (lineEnd < 0 || span.end <= lineEnd) && report.text.slice(span.start, span.end) === span.text);
    }).map(unit => ({ number: unit.number!, players: unit.players })) : [];
  const dated = reading.reportedGoalieDates;
  const validSourceClock = verifiedGoaliePostTime(originalUrl, report.originalPublishedAt);
  const starts = Array.isArray(dated) && verifiedOriginalAuthor && validSourceClock && !scope?.historical && !report.reviewReason && (reading.context === "game" || reading.context === "unknown")
    ? dated.filter(start => {
      if (!Number.isSafeInteger(start?.playerId) || start.playerId <= 0 || typeof start.playerName !== "string"
        || typeof start.subject?.text !== "string" || !start.evidence || !start.day) return false;
      if (![start.playerName, start.playerName.split(" ").at(-1)].some(name => name?.toLowerCase() === start.subject.text?.toLowerCase())) return false;
      const day = readGoalieStartDay(report.text, start.subject, start.evidence, report.originalPublishedAt, report.teamId);
      return day?.date && day.date === start.day.date && day.relative === start.day.relative && day.timezone === start.day.timezone
        && day.evidence.start === start.day.evidence?.start && day.evidence.end === start.day.evidence?.end
        && day.evidence.text === start.day.evidence?.text;
    }) : [];
  const undisputed = starts.filter(start => !starts.some(other => other.day.date === start.day.date && other.playerId !== start.playerId));
  const decisionSource = verifiedOriginalAuthor && !report.reviewReason && !scope?.historical && postTime && report.originalPublishedAt
    && reading.identityContext?.basis === "publication_roster" && reading.identityContext.sourcePublishedAt
    && Date.parse(reading.identityContext.sourcePublishedAt) === Date.parse(report.originalPublishedAt)
    && Math.floor(Date.parse(postTime) / 1000) === Math.floor(Date.parse(report.originalPublishedAt) / 1000)
    && Date.parse(report.receivedAt) >= Date.parse(report.originalPublishedAt);
  const events = reading.events?.flatMap(event => qualifyStoredReturn(event, report.text) ?? []);
  const expectations = decisionSource ? events?.flatMap(event => {
    const anchor = event.claimAnchor;
    if (event.teamId !== report.teamId || !anchor || anchor.subjectSpan.text !== event.playerName || event.observation || event.reviewReason
      || event.modality !== "tentative" || event.availability !== "uncertain" || !event.times?.observation
      || Date.parse(event.times.observation) !== Date.parse(report.originalPublishedAt!)) return [];
    const source = reportedLineupExpectation(report.text, anchor.subjectSpan.start, anchor.subjectSpan.end);
    if (!source || source.subjectSpan.text !== event.playerName
      || !(event.kind === "participation" && event.state === "projected" && source.status === "expected_in_lineup"
        || event.kind === "injury" && event.state === "possible_return" && source.status === "possible_return")) return [];
    return [{ playerId: event.playerId, playerName: event.playerName, status: source.status }];
  }) : [];
  const practiceDepth = verifiedOriginalAuthor && report.gameId == null && !report.reviewReason
    && report.originalPublishedAt && Date.parse(report.receivedAt) >= Date.parse(report.originalPublishedAt)
    ? reportedPracticeDepth(reading, report.teamId, report.text, originalUrl, report.originalPublishedAt) : [];
  return { ...report, reportedLineupExpectations: expectations?.length ? expectations : undefined, reportedPracticeDepth: practiceDepth.length ? practiceDepth.map(unit => ({ ...unit, evidence: [] })) : undefined, gameId: noGame ? null : report.gameId, provenance: undefined, originalUrl, verifiedOriginalAuthor,
    reportedInGamePP: reportedInGamePP.length ? reportedInGamePP : undefined,
    text: report.text.split("\n").map((line) => sanitizePublicNewsText(line)).join("\n"),
    interpretation: { ...reading, ...(dated ? { reportedGoalieDates: undisputed } : {}), version: report.interpretation.version, context: noGame ? "unknown" : reading.context,
      rosterRevision: undefined, identityContext: undefined, unresolved: [], relationships: undefined,
      units: reading.units.map((unit) => ({ ...unit, number: unit.situation === "pp" && !unit.explicitNumber ? null : unit.number, evidence: [] })),
      events: events?.filter(event => !hasNonPlayerSubject(event, report.text) && (event.state !== "game_time_decision"
        || decisionSource && event.teamId === report.teamId && event.times?.observation && report.originalPublishedAt
          && Date.parse(event.times.observation) === Date.parse(report.originalPublishedAt) && verifiedGameTimeDecision(event, report.text))).map((event) => ({ ...event, evidence: { ...event.evidence, offsetBasis: "unsanitized_source" as const, text: sanitizePublicNewsText(event.evidence.text) } })),
    },
  };
}
