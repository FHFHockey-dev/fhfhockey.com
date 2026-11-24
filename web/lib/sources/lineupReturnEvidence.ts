import type { TweetPlayerEvent } from "./tweetPlayerEvents";

/** Limits on an announced return that must survive clipping a report to a player's clause. */
export function lineupReturnCaveat(evidence: string, precedingText = ""): "unknown_timeline" | "tentative" | null {
  if (!/\breturn(?:s|ing)?\s+to\s+(?:the\s+)?line[ -]?up\b/i.test(evidence)) return null;
  if (/\b(?:without\s+(?:a\s+)?|no\s+)(?:timeline|timetable)\s+(?:for\s+(?:a\s+)?|to\s+)return\b/i.test(evidence)) return "unknown_timeline";
  if (/\blooks?\s+like\s*$/i.test(precedingText) || /\blooks?\s+like\b[^.!?;\n]*\breturn(?:s|ing)?\b/i.test(evidence)) return "tentative";
  return null;
}

/** Keep the reporter's qualifier with the named player's prediction. */
export function reportedLineupExpectation(text: string, start: number, end: number) {
  const subject = text.slice(start, end);
  if (start < 0 || end <= start || !/^[\p{Lu}][\p{L}’'.-]*(?:[ -][\p{L}’'.-]+)*$/u.test(subject)) return null;
  const before = text.slice(0, start);
  const hedge = /\b(?:looks|sounds) like[ \t]+$/iu.exec(before);
  if (!hedge) return null;
  const lead = before.slice(0, hedge.index).split(/[.!?;\n]/u).at(-1)!.replace(/^\s*RT @\w+:\s*/iu, "").trim();
  if (lead && lead !== "-" && !/^(?:[\p{Lu}][\p{L}’'.-]*\s+){1,4}says it$/u.test(lead)) return null;
  const tail = text.slice(end);
  const verb = /^[ \t]+(will (play|return))\b/iu.exec(tail);
  if (!verb) return null;
  const after = tail.slice(verb[0].length), rest = after.split(/[.!;\n]/u, 1)[0]!;
  if (!/^(?:[.!]|[ \t]*(?:$|\n)|[ \t]+(?:tonight|today|tomorrow|to|for|against|vs\.?|on)\b)/iu.test(after)
    || /\?|\b(?:unless|if|instead|won't|will not|ruled out)\b/iu.test(rest)) return null;
  const surname = subject.trim().split(/\s+/u).at(-1)!.replace(/[.*+?^\${}()|[\]\\]/g, "\\$&");
  if (/\b(?:correction|retraction|disregard|previously|hypothetical)\b/iu.test(text)
    || new RegExp("(?:[.!;\\n]\\s*|\\bbut\\s+)(?:he|" + surname + ")\\s+(?:(?:is|was|has been)\\s+)?(?:out\\b|scratched\\b|ruled out\\b|will not play\\b|won['’]t play\\b)", "iu").test(after)) return null;
  const stop = end + verb[0].length;
  return { status: verb[2]!.toLowerCase() === "return" ? "possible_return" as const : "expected_in_lineup" as const,
    subjectSpan: { start, end, text: subject },
    predicateSpan: { start: stop - verb[1]!.length, end: stop, text: verb[1]! },
    evidence: { start: hedge.index, end: stop, text: text.slice(hedge.index, stop) } };
}

/** Re-read a stored affirmative claim against its source before displaying it. */
export function qualifyStoredReturn(event: TweetPlayerEvent, source: string) {
  if (event.kind !== "injury" || event.state !== "confirmed_return") return event;
  const excerpt = event.evidence?.text;
  if (!excerpt || !event.playerName) return event;
  const subject = event.claimAnchor?.subjectSpan;
  // Older "will return" rows had no predicate anchor. Require their exact full name at the start of the saved clause.
  const name = subject?.text ?? event.playerName;
  const offset = subject ? subject.start - event.evidence.start : 0;
  if (offset < 0 || excerpt.slice(offset, offset + name.length) !== name) return event;
  let at = source.indexOf(excerpt);
  if (at < 0) return event;
  let matches = 0, qualified: ReturnType<typeof reportedLineupExpectation> = null;
  while (at >= 0) {
    matches++;
    const parsed = reportedLineupExpectation(source, at + offset, at + offset + name.length);
    if (parsed && parsed.predicateSpan.end <= at + excerpt.length) qualified ??= parsed;
    at = source.indexOf(excerpt, at + excerpt.length);
  }
  if (!qualified) return event;
  if (matches !== 1) return null;
  const { status, evidence, subjectSpan, predicateSpan } = qualified;
  return { ...event, kind: status === "possible_return" ? "injury" as const : "participation" as const,
    state: status === "possible_return" ? "possible_return" as const : "projected" as const,
    availability: "uncertain" as const, modality: "tentative" as const, timeline: null, timelines: [],
    evidence, claimAnchor: { subjectSpan, predicateSpan } };
}
