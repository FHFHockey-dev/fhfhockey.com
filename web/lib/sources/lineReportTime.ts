import { requiresRelativeGameDateReview, type EvidenceSpan, type TweetInterpretation } from "./tweetInterpretation";

// This applies to the date selection only. Keep the classifier version in the immutable report key.
const temporalRevision = "-line-date.2026-11-18.1";

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
    return { ...original, version: original.version.endsWith(temporalRevision) ? original.version : original.version + temporalRevision,
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
