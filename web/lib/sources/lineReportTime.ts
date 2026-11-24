import { compareInterpretationVersions } from "./interpretationVersion";
import { teamsInfo } from "lib/teamsInfo";
import { requiresRelativeGameDateReview, type EvidenceSpan, type TweetInterpretation } from "./tweetInterpretation";

// This applies to the date selection only. Keep the classifier version in the immutable report key.
const temporalRevision = "-line-date.2026-11-18.1";

/** Check the game explicitly named in a standalone injury exit, without treating a matchup mention as the subject. */
export function injuryExitConflict(text: string, date: string, teamId: number, gameTeams?: number[]) {
  if (!text || !/\b(?:left|exited)\b/i.test(text)) return null;
  const body = text.replace(/(?:\s+(?:https?:\/\/\S+|pic\.twitter\.com\/\S+))+\s*$/i, "").trim();
  const description = body.replace(/^(?:RT\s+@\w+:\s*)?(?:[\p{L}.’'-]+(?: [\p{L}.’'-]+){0,4}:\s*)?(?:Injury:\s*)?/iu, "");
  const exit = /^[\p{L}’'-]+(?: [\p{L}’'-]+){0,3}(?:\s+\([^()\n]{1,50}\))?\s+(?:left|exited)\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)['’]s\s+game\s+(?:vs\.?|versus|against)\s+(?:the\s+)?(#?[\p{L}. ’'-]+?)\s+and\s+(?:did not|didn['’]t) return[.!]?$/iu.exec(description);
  if (!exit) return null;
  const named = exit[2]!.replace(/^#/, "").toLowerCase();
  const matches = Object.values(teamsInfo).filter(team => [team.abbrev, team.name, team.shortName, team.location]
    .some(label => label?.toLowerCase() === named));
  const opponent = matches.length === 1 ? matches[0]!.id : null;
  if (opponent === teamId) return "assigned_team_named_as_opponent";
  const day = new Date(date + "T12:00:00Z");
  if (Number.isFinite(day.getTime()) && day.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }).toLowerCase() !== exit[1]!.toLowerCase()) {
    return "reported_game_weekday_mismatch";
  }
  if (gameTeams?.length === 2 && opponent != null && !gameTeams.includes(opponent)) return "reported_opponent_mismatch";
  return null;
}

export function lineReportTimeScope(text: string) {
  function priorHeading(line: string): boolean {
    // "From Saturday's game" is retrospective. Another Saturday does not identify that game.
    return /^\s*(?:projected\s+)?(?:lines?|lineups?|pairings?|units?)\s+from\s+(?:the\s+)?(?:(?:last|previous)\s+(?:game|night|\w+day)\b|(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:['’]s)?\s+game\b)/i.test(line);
  }
  const sections: { start: number; prior: boolean }[] = [];
  for (const line of text.matchAll(/[^\n]+/g)) {
    const prior = priorHeading(line[0]);
    if (prior || /^\s*(?:(?:today|tonight)(?:['’]s)?\s+(?:projected\s+)?(?:lines?|lineup|matchup|units?|starters?)\b|(?:lines?|lineup|units?|starters?)\s+(?:for\s+)?(?:today|tonight)\b)/i.test(line[0])) {
      sections.push({ start: line.index, prior });
    }
  }
  const historical = sections.some(section => section.prior);
  if (!historical && !requiresRelativeGameDateReview(text)) return null;

  // A later historical heading ends a current lineup, even if the document header says "tonight".
  function current(span: EvidenceSpan, structured: boolean): boolean {
    if (span.start < 0 || span.end <= span.start || text.slice(span.start, span.end) !== span.text) return false;
    if (requiresRelativeGameDateReview(span.text) || span.text.split("\n").some(priorHeading)) return false;
    if (historical && sections.filter(section => section.start <= span.start).at(-1)?.prior) return false;
    if (/\b(today|tonight)\b/i.test(span.text)) return true;
    if (!structured) return false;
    const heading = text.slice(0, span.start).split("\n").filter(line =>
      priorHeading(line) || /\b(today|tonight|tomorrow|yesterday)\b/i.test(line)).at(-1) ?? "";
    return !priorHeading(heading) && !requiresRelativeGameDateReview(heading) && /\b(today|tonight)\b/i.test(heading)
      && /\b(lines?|lineup|units?|pp[12]?|power[ -]?play|pairings?)\b/i.test(heading);
  }

  function select(original: TweetInterpretation): TweetInterpretation {
    const supported = (unit: TweetInterpretation["units"][number]) => Array.isArray(unit.evidence) && unit.evidence.length > 0
      && unit.evidence.every(span => current(span, true));
    const baseVersion = original.version.replace(/-line-date\.\d{4}-\d{2}-\d{2}\.\d+$/, "");
    const revision = baseVersion + temporalRevision;
    return { ...original, version: compareInterpretationVersions(original.version, revision) > 0 ? original.version : revision,
      units: original.units.filter(supported), excludedUnits: original.excludedUnits?.filter(supported),
      events: original.events?.filter(event => current(event.evidence, false)) ?? [],
      changes: original.changes?.filter(change => current(change.evidence, false)),
      unresolved: (original.unresolved ?? []).filter(span => current(span, true)),
      relationships: original.relationships?.filter(relation => current(relation.evidence, false)) ?? [],
      // A confirmation elsewhere in the document cannot confirm a retained lineup.
      certainty: original.certainty === "confirmed" ? "reported" : original.certainty,
    };
  }
  return { historical, select, current };
}
