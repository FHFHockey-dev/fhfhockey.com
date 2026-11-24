// NHL surnames also occur in prose. Examine the literal occurrence before assigning a player.
export function isNonPlayerNameUse(name: string, after: string, before = "") {
  if (/^back$/i.test(name)) return /^[ \t]+at[ \t]+it[.!](?:\s|$)/i.test(after)
    && /(?:^|[.!?\n]|^\s*RT[ \t]+(?:@\w+)?:)[ \t]*$/i.test(before);
  if (/^day$/i.test(name)) return /^[ \t‐‑–—−-]+to[ \t‐‑–—−-]+day\b/i.test(after)
    || /\bday[ \t‐‑–—−-]+to[ \t‐‑–—−-]+$/i.test(before);
  return /^he$/i.test(name) && /^(?:[ \t]+(?:will|would|is|was|has|had|did|does|can|could|may|might|should|won['’]t|didn['’]t|checks a lot of boxes)\b|['’](?:s|ll|d)\b)/i.test(after)
    && !/(?:^|[.!?\n])[ \t]*(?:forward|winger|center|centre|defen[cs]eman|goaltender|goalie)[ \t]+$|\bKevin[ \t]+$|#\d+[ \t]+$/i.test(before);
}

/** Older rows can lack a subject anchor. In that case only suppress an excerpt with no other matching name. */
export function hasNonPlayerSubject(event: { playerName?: string; evidence?: { text?: string }; claimAnchor?: { subjectSpan?: { start: number; end: number; text: string } } } | null, source: string) {
  if (typeof event?.playerName !== "string") return false;
  const surname = event.playerName.split(" ").at(-1)?.toLowerCase();
  if (surname !== "he" && surname !== "day") return false;
  const span = event.claimAnchor?.subjectSpan;
  if (span && source.slice(span.start, span.end) === span.text)
    return span.text.toLowerCase() === surname && isNonPlayerNameUse(span.text, source.slice(span.end), source.slice(0, span.start));
  const excerpt = event.evidence?.text;
  if (typeof excerpt !== "string") return false;
  const mentions = [...excerpt.matchAll(surname === "day" ? /\bday\b/gi : /\bhe\b/gi)];
  return mentions.length > 0 && mentions.every(m => isNonPlayerNameUse(m[0], excerpt.slice(m.index + m[0].length), excerpt.slice(0, m.index)));
}
