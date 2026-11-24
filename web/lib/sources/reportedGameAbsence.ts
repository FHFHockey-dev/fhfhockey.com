import type { TweetPlayerEvent } from "./tweetPlayerEvents";
import { sourceLocalDate } from "../lines/binding";
import { teamsInfo } from "../teamsInfo";
import { NHL_TEAM_TIMEZONES_BY_ID } from "../xg/travelFatigue";

const absence = /^(?:is out|out|will not play|won['’]t play) (today|tonight|tomorrow)(?: (in|vs\.?) ([\p{L}][\p{L} .'-]*?))?$/iu;
const recovery = /^(?:(?:is |is listed as |is considered |considered |is out |out )?["“]?(day[ -]to[ -]day)["”]?)(?: with an? (?:UBI|LBI|(?:upper|lower)[- ]body injury)| \((?:upper|lower)[- ]body\))?$/i;
const qualifier = /\b(?:if|unless|hypothetical|rumou?r|unconfirmed|projection|prediction|yesterday|previously|last (?:night|week|season)|last year|previous game|practice lineup|practice lines|projected|correction|corrected|retracted|disregard|after all|not true|not confirmed|not clear|unverified|scratch that|that(?: is| was) (?:false|incorrect)|speculat\w*|doubt\w*|misquoted)\b|\b(?:he|they) (?:could|will|may|might|can) (?:still )?(?:play|dress)\b|[?]/iu;

/** Two literal predicates about one named subject. The indefinite recovery never supplies the game date. */
export function reportedGameAbsence(text: string, start: number, end: number) {
  if (start < 0 || end <= start || end > text.length || qualifier.test(text)) return null;
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const lineEnd = text.indexOf("\n", end);
  const prefix = text.slice(lineStart, start).replace(/^RT @[\w]{1,15}:\s*/iu, "").trim();
  if (!/^(?:[-•]?\s*(?:@[\w]{1,15}\s+)?(?:(?:forward|defen[cs]eman|defender|center|winger)\s*)?)$/iu.test(prefix)) return null;
  const before = text.slice(0, lineStart).trimEnd();
  if (before && !/[.!]$/u.test(before) && !/(?:^|\n|RT @[\w]{1,15}: )(?:INJURY UPDATES?|Lots of injury updates:)$/u.test(before)) return null;
  const suffix = text.slice(end, lineEnd < 0 ? text.length : lineEnd).trimEnd()
    .replace(/(?:\s+#[\p{L}\d_]+)+$/u, "").replace(/[.]$/, "").trimEnd();
  const clauses = suffix.replace(/^\s*\((?:undisclosed|(?:upper|lower)[- ]body)\)/iu, "").trim().split(/\s+and\s+|,\s*|\.[ \t]+(?=considered day[- ]to[- ]day\b)/iu);
  // An anatomical qualifier belongs to the adjoining absence, and never supplies a second subject.
  const missedText = clauses.map(clause => clause.replace(/ \((?:upper|lower)[- ]body\)$/iu, ""));
  if (clauses.length !== 2) return null;
  const which = missedText.findIndex(value => absence.test(value));
  if (which < 0 || !recovery.test(clauses[1 - which]!)) return null;
  const phrase = missedText[which]!, match = absence.exec(phrase)!;
  const offset = end + suffix.indexOf(phrase);
  const later = text.slice(lineEnd < 0 ? text.length : lineEnd + 1);
  const surname = text.slice(start, end).split(/\s+/u).at(-1)!;
  if ([before, later].some(part => part.toLowerCase().includes(surname.toLowerCase())) || /\b(?:he|they|his status)\b[^.\n]*(?:decision|available|return|cleared|instead|game[- ]time)\b/i.test(later)) return null;
  const place = match[3]?.toLowerCase();
  const venue = match[2]?.toLowerCase() === "in" ? match[3]! : null;
  const teams = place ? Object.values(teamsInfo).filter(team => (venue ? [team.location] : [team.shortName, team.abbrev, team.name])
    .some(value => value?.toLowerCase() === place)) : [];
  if (place && teams.length !== 1) return null;
  return { relative: match[1]!.toLowerCase() as "today" | "tonight" | "tomorrow", opponent: venue ? null : match[3] ?? null, opponentId: venue ? null : teams[0]?.id ?? null, venue, venueClubId: venue ? teams[0]!.id : null,
    namedClubHandle: /^@([\w]{1,15})\s+(?:forward|defen[cs]eman|defender|center|winger)$/iu.exec(prefix)?.[1]?.toLowerCase() ?? null,
    predicate: { start: offset, end: offset + phrase.length, text: phrase }, recovery: "day-to-day" as const };
}

export function reportedAbsenceDate(publishedAt: string | null, teamId: number | null, day: "today" | "tonight" | "tomorrow") {
  const timezone = teamId == null ? null : NHL_TEAM_TIMEZONES_BY_ID[teamId];
  const date = sourceLocalDate(publishedAt, timezone ?? "America/New_York");
  if (!date || (!timezone && date !== sourceLocalDate(publishedAt, "America/Vancouver"))) return null;
  if (day !== "tomorrow") return date;
  const next = new Date(date + "T12:00:00Z");
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

export function gameAbsenceFields(missed: NonNullable<ReturnType<typeof reportedGameAbsence>>, date: string,
  subjectSpan: NonNullable<TweetPlayerEvent["claimAnchor"]>["subjectSpan"]) {
  const timeline = { purpose: "absence" as const, minimum: null, maximum: null, unit: null, text: missed.relative, targetDate: date };
  return { availability: "out" as const, state: "ongoing" as const, modality: "affirmative" as const, availabilityScope: "game" as const,
    effectiveDate: date, claimAnchor: { subjectSpan, predicateSpan: missed.predicate }, timeline,
    timelines: [{ ...timeline, purpose: "unknown" as const, text: missed.recovery, targetDate: null }, timeline] };
}
