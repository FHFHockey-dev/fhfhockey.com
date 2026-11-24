import { NHL_TEXT_HINTS, teamHashtagsByAbbreviation, teamsInfo } from "../teamsInfo";
import type { TweetPlayerEvent } from "./tweetPlayerEvents";

/** A decision about a named player's availability is reportable before either outcome is known. */
export function reportedGameTimeDecision(text: string, start: number, end: number) {
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end <= start || end > text.length) return null;
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const lineEnd = text.indexOf("\n", end);
  const before = text.slice(lineStart, start).split(/[.!][”"’]?[ \t]+/u).at(-1)!.replace(/^\s*RT @\w+:\s*/iu, "").trim();
  // Only a standalone subject, an attributed statement, or a DFO subject header.
  const lead = before.replace(/^(?:#\w+\s*)+/u, "").trim();
  const subject = text.slice(start, end);
  // A single named warmup participant can be the subject of the immediately following pronoun.
  const continued = /^(?:\s*RT @\w+:\s*)?$/iu.test(text.slice(0, start)) && /^[\p{Lu}][\p{L}’'.-]*(?:[ \t]+[\p{Lu}][\p{L}’'.-]*)+$/u.test(subject)
    && /^ is taking part in warmups\.[ \t]*\r?\n[ \t]*He (is a game[- ]time decision)\b([.!]?[ \t]*(?:\r?\n\s*@\w+[ \t]*)?\s*)$/iu.exec(text.slice(end));
  if (continued) {
    const stop = text.length - continued[2]!.length;
    return { subjectSpan: { start, end, text: subject },
      predicateSpan: { start: stop - continued[1]!.length, end: stop, text: continued[1]! },
      evidence: { start, end: stop, text: text.slice(start, stop) } };
  }
  const header = /^([\p{L}.’' -]+):\s*Injury:$/iu.exec(lead);
  if (lead && !(header && header[1]!.endsWith(" " + subject))
    && !/^(?:[\p{Lu}][\p{L}.’'-]*\s+){1,4}(?:says|said)$/u.test(lead)) return null;
  if (/\b(?:if|unless|yesterday|rumou?r|denies|hypothetical|correction|disregard|previously)\b/i.test(lead)
    || /(?:\b(?:if|hypothetical|correction|yesterday)\b[^\n]*:\s*)$/i.test(text.slice(0, lineStart))) return null;
  const tail = text.slice(end, lineEnd < 0 ? undefined : lineEnd);
  const match = /^[ \t]+(?:\((?:undisclosed|illness|LBI|UBI|upper[- ]body|lower[- ]body|hand|wrist|maintenance)\)[ \t]+)?((?:(?:is|will be)[ \t]+(?:a[ \t]+)?|[-–—][ \t]+)game[- ]time decision)\b/i.exec(tail);
  if (!match) return null;
  const rest = tail.slice(match[0].length);
  // Keep the reporter's time or hedge in the original and reject a conditional or superseding status.
  if (!/^(?:[.!]|\s*$|,\s*per\b|\s+(?:on|tonight\b|today\b|tomorrow\b|vs\.?\s|against\b|due to\b|but expects him to play\b|#|https?:))/iu.test(rest)
    || /\?|\b(?:unless|if|ruled out|will not play|won['’]t play|scratched|will play|correction|actually)\b/iu.test(rest.split(/\.(?:\s|$)/u)[0]!)) return null;
  const predicateEnd = end + match[0].length;
  const following = text.slice(predicateEnd);
  const surname = subject.trim().split(/\s+/u).at(-1)!.replace(/[.*+?^$\{\}()|[\]\\]/g, "\\$&");
  if (new RegExp("(?:(?:[.!;\\n]\\s*)|\\bbut\\s+)(?:he|" + surname + ")\\s+(?:(?:is|was|has been)\\s+)?(?:out\\b|scratched\\b|ruled out\\b|will (?:not )?play\\b|won['’]t play\\b)", "iu").test(following)
    || /\b(?:correction|retraction|disregard|now ruled out)\b/iu.test(following)) return null;
  return { subjectSpan: { start, end, text: subject },
    predicateSpan: { start: predicateEnd - match[1]!.length, end: predicateEnd, text: match[1]! },
    evidence: { start, end: predicateEnd, text: text.slice(start, predicateEnd) } };
}

/** A leading club tag can identify the subject's team in a single, present-day coach report. */
export function taggedGameTimeDecision(text: string) {
  const match = /^(?:RT @\w+:[ \t]*)?#(\w+)[ \t]+(?:[\p{Lu}][\p{L}’'.-]*[ \t]+){1,3}(?:says|said)[ \t]+([\p{Lu}][\p{L}’'-]*(?:[ \t]+[\p{Lu}][\p{L}’'-]*){1,3})[ \t]+(?:will be|is)[ \t]+a[ \t]+game[- ]time decision[ \t]+tonight[.!]?[ \t]*$/u.exec(text.trimEnd());
  if (!match) return null;
  const [tag, name] = [match[1]!.toLowerCase(), match[2]!];
  const clubs = Object.values(teamsInfo).filter(t => NHL_TEXT_HINTS[tag] === t.abbrev || t.abbrev.toLowerCase() === tag
    || teamHashtagsByAbbreviation[t.abbrev]?.some(h => h.replace(/^#/, "").toLowerCase() === tag));
  return clubs.length === 1 ? { teamId: clubs[0]!.id, name } : null;
}

/** Stored reader data must still cite the same subject and predicate, including after feed formatting. */
export function verifiedGameTimeDecision(event: TweetPlayerEvent, source: string, formatted = false) {
  const { claimAnchor: anchor, evidence } = event;
  if (!anchor?.subjectSpan || !anchor.predicateSpan || !evidence || event.kind !== "participation"
    || event.state !== "game_time_decision" || event.modality !== "tentative" || event.availability !== "uncertain"
    || event.reviewReason || event.observation || !Number.isSafeInteger(event.teamId) || !Number.isSafeInteger(event.playerId)
    || !Number.isSafeInteger(evidence.start) || evidence.end - evidence.start !== evidence.text.length
    || anchor.subjectSpan.start !== evidence.start || anchor.predicateSpan.end !== evidence.end) return false;
  const first = formatted ? source.indexOf(evidence.text) : evidence.start;
  if (first < 0 || (formatted && first !== source.lastIndexOf(evidence.text))) return false;
  const length = anchor.subjectSpan.end - anchor.subjectSpan.start;
  const parsed = reportedGameTimeDecision(source, first, first + length);
  return !!parsed && parsed.evidence.text === evidence.text && parsed.subjectSpan.text === anchor.subjectSpan.text
    && parsed.predicateSpan.text === anchor.predicateSpan.text && parsed.predicateSpan.start - first === anchor.predicateSpan.start - evidence.start;
}
