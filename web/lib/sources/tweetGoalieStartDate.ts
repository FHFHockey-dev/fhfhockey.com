import { teamsInfo } from "lib/teamsInfo";
import { tweetPublicationFromUrl } from "./tweetPublicationTime";
import { compareInterpretationVersions } from "./interpretationVersion";
import { relativeSourceDate, sourceLocalDate } from "../lines/binding";
import { NHL_TEAM_TIMEZONES_BY_ID } from "../xg/travelFatigue";
import type { EvidenceSpan, TweetInterpretation } from "./tweetInterpretation";

export type GoalieStartDay = { relative: "today" | "tonight" | "tomorrow"; evidence: EvidenceSpan; timezone: string | null; date: string | null };
export function goalieDateRevision(version: string) {
  const dated = version.replace(/-line-date\.\d{4}-\d{2}-\d{2}\.\d+$/, "") + "-line-date.2026-11-22.1";
  return compareInterpretationVersions(version, dated) > 0 ? version : dated;
}

export type ReportedGoalieStart = { playerId: number; playerName: string; subject: EvidenceSpan; evidence: EvidenceSpan; day: GoalieStartDay };

export function verifiedGoaliePostTime(url: string | null, publishedAt: string | null) {
  const created = tweetPublicationFromUrl(url);
  return created && publishedAt && /(?:Z|[+-]\d{2}:\d{2})$/i.test(publishedAt)
    && Math.floor(Date.parse(created) / 1000) === Math.floor(Date.parse(publishedAt) / 1000) ? publishedAt : null;
}

const clubNames = new Set(Object.values(teamsInfo).flatMap(team =>
  [team.abbrev, team.name, team.shortName, team.location].filter((v): v is string => Boolean(v))
    .flatMap(name => [name.toLowerCase(), name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()])));

// A named opponent can precede or follow the day. It supports the wording only and never selects a game.
export function isGoalieMatchupPhrase(value: string) {
  const m = /^(?:vs\.?|versus|against|at|in)\s+(?:the\s+)?(.+)$/i.exec(value);
  return Boolean(m && clubNames.has(m[1]!.toLowerCase()));
}

/** A complete present-tense weekday matchup, measured from the end of its resolved subject. */
export function readWeekdayGoalieMatchup(suffix: string, publishedAt: string | null, teamId?: number | null, gameTeamIds?: readonly number[]) {
  const match = /^( +starts +(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday) +vs\.? +(?:the +)?([\p{L} .'-]+?)\.?)(?: +https:\/\/t\.co\/[A-Za-z0-9]+)?\s*$/iu.exec(suffix);
  if (!match || !publishedAt || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(publishedAt)) return null;
  const label = match[3]!.toLowerCase();
  const opponents = Object.values(teamsInfo).filter(team =>
    [team.name, team.abbrev, team.shortName, team.location].some(name => name?.toLowerCase() === label));
  if (opponents.length !== 1 || opponents[0]!.id === teamId) return null;
  if (gameTeamIds && (gameTeamIds.length !== 2 || !teamId || !gameTeamIds.includes(teamId) || !gameTeamIds.includes(opponents[0]!.id))) return null;
  // A draft may have a name but no dated team. Its calendar day must then agree across NHL markets.
  const timezone = teamId == null ? null : NHL_TEAM_TIMEZONES_BY_ID[teamId];
  const date = sourceLocalDate(publishedAt, timezone ?? "America/New_York");
  if (!date || (!timezone && date !== sourceLocalDate(publishedAt, "America/Vancouver"))) return null;
  const weekday = new Date(date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
  return weekday.toLowerCase() === match[2]!.toLowerCase() ? { date, length: match[1]!.length } : null;
}

/** Read the day governed by this subject's starter predicate. A bare name/day pair has no predicate. */
export function readGoalieStartDay(text: string, subject: EvidenceSpan, clause: EvidenceSpan, publishedAt: string | null, teamId?: number | null): GoalieStartDay | null {
  if (!subject.text || ![subject, clause].every(span => Number.isInteger(span.start) && Number.isInteger(span.end)
    && span.start >= 0 && span.end > span.start && text.slice(span.start, span.end) === span.text && span.end <= text.length)
    || subject.start !== clause.start || subject.end > clause.end) return null;
  const suffix = text.slice(subject.end, clause.end);
  const predicate = /^\s+(?:(?:will\s+start|starts?|(?:is\s+)?starting)(?:\s+in\s+(?:goal|net))?|(?:will\s+get|gets?)\s+the\s+(?:start|nod))\s+/i.exec(suffix);
  if (!predicate) return null;
  const detail = suffix.slice(predicate[0].length);
  const markers = [...detail.matchAll(/\b(today|tonight|tomorrow)\b/gi)];
  if (markers.length !== 1) return null;
  const marker = markers[0]!, literal = marker[0];
  const before = detail.slice(0, marker.index).trim();
  const after = detail.slice(marker.index + literal.length).replace(/^\s+night\b/i, "").replace(/[.,;!]\s*$/, "").trim();
  if ((before && !isGoalieMatchupPhrase(before)) || (after && !isGoalieMatchupPhrase(after)) || (before && after)) return null;
  // A saved span can end early. Keep conditions, alternatives and speculation in their governing sentence.
  const previous = text.slice(0, subject.start).split(/[.!?;\n]/).at(-1) ?? "";
  if (/\b(?:if|unless|could|might|may|probably|likely|maybe|expect(?:ed|ing)?|perhaps|assuming|think|should|would|not|practice|projected|look(?:s)? (?:for|like)|hope(?:s|ful)?|unsure|uncertain|unlikely)\b/i.test(previous)) return null;
  const rest = text.slice(clause.end);
  if ((!/[.,;!]\s*$/.test(clause.text) && !/^\s*(?:$|[.,;!\n])/.test(rest))
    || /^[ \t]*[,;]?[ \t]*(?:or|unless|if|except|actually|instead|rather|but|not)\b/i.test(rest)) return null;
  const start = subject.end + predicate[0].length + marker.index;
  const relative = literal.toLowerCase() as GoalieStartDay["relative"];
  const timezone = teamId ? NHL_TEAM_TIMEZONES_BY_ID[teamId] ?? null : null;
  return { relative, evidence: { start, end: start + literal.length, text: literal }, timezone, date: relativeSourceDate(publishedAt, timezone, relative) };
}

export function reportedGoalieStarts(text: string, reading: TweetInterpretation, publishedAt: string | null, teamId?: number | null): ReportedGoalieStart[] {
  const identity = reading.identityContext;
  if (!teamId || !publishedAt || identity?.basis !== "publication_roster" || identity.sourcePublishedAt !== publishedAt || !identity.eventRosterRevision) return [];
  const events = reading.events ?? [];
  if ((reading.context !== "game" && reading.context !== "unknown") || reading.units.some(unit => unit.listing === "pipe_pair")) return [];
  return events.flatMap(event => {
    if (event.kind !== "goalie" || event.state !== "confirmed" || event.goalieRole !== "starter" || event.teamId !== teamId
      || event.modality !== "affirmative" || event.observation || event.reviewReason || !event.playerName?.trim()
      || !Number.isSafeInteger(event.playerId) || event.playerId <= 0) return [];
    const clause = event.evidence;
    const names = [event.playerName, event.playerName.split(" ").at(-1)!];
    const name = names.find(value => clause.text.toLowerCase().startsWith(value.toLowerCase() + " "));
    const subject = event.claimAnchor?.subjectSpan ?? (name && { start: clause.start, end: clause.start + name.length, text: clause.text.slice(0, name.length) });
    if (!subject) return [];
    if (events.some(other => other.kind === "goalie" && other.playerId === event.playerId && (other.reviewReason
      || other.state === "ruled_out" || other.goalieRole === "backup"))) return [];
    const day = readGoalieStartDay(text, subject, clause, publishedAt, teamId);
    return day?.date ? [{ playerId: event.playerId, playerName: event.playerName, subject, evidence: clause, day }] : [];
  });
}
