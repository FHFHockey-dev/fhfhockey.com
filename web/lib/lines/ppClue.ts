/**
 * A specific penalty clue in a reporter's original post: a named penalized player plus the infraction, or a named player
 * who drew the call. A bare player mention or "another look" is not a clue. Names resolve only on the supplied game roster,
 * by a full name or a surname unique on that roster; the PP unit list itself is never read as a clue.
 */
export type PenaltyClue = {
  committedByPlayerId: number | null; drawnByPlayerId: number | null; infraction: string | null;
  evidence: { start: number; end: number; text: string }[];
};
type RosterPlayer = { playerId: number; name: string; teamId: number };
type Span = { start: number; end: number; text: string };

/** Phrase → NHL play-by-play `descKey`. */
const INFRACTIONS: [RegExp, string][] = [
  [/\bhigh[- ]?stick(?:ing|ed)?\b/g, "high-sticking"],
  [/\btrip(?:ping|ped)?\b/g, "tripping"],
  [/\bhook(?:ing|ed)?\b/g, "hooking"],
  [/\binterference\b/g, "interference"],
  [/\bslash(?:ing|ed)?\b/g, "slashing"],
  [/\bholding\b/g, "holding"],
  [/\broughing\b/g, "roughing"],
  [/\bcross[- ]?check(?:ing|ed)?\b/g, "cross-checking"],
  [/\btoo many men\b/g, "too-many-men-on-the-ice"],
  [/\bdelay of game\b/g, "delay-of-game"],
];
const DRAWN_AFTER = /\bdrawn by\b/g;
const DRAWN_BEFORE = /\b(?:draws|drew|drawing)\b/g;
const TAKES_DOWN = /\b(?:takes|took) down\b/g;
const UNIT_LIST = /\bPP\s*[12]?\s*:|\bPP\s*(?:unit|units)\b\s*:/i;

/** Lower-case and strip diacritics one character at a time, so offsets match the original text. */
const fold = (text: string) => [...text].map((char) => char.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()[0] ?? char).join("");
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const all = (pattern: RegExp, text: string) => [...text.matchAll(new RegExp(pattern.source, "g"))];

function segments(text: string): Span[] {
  const out: Span[] = [];
  for (const match of text.matchAll(/[^.!?\n]+/g)) {
    const value = match[0];
    if (!value.trim() || UNIT_LIST.test(value)) continue;
    out.push({ start: match.index!, end: match.index! + value.length, text: value });
  }
  return out;
}

type Mention = Span & { playerId: number | null };
function mentions(folded: string, original: string, roster: RosterPlayer[]): Mention[] {
  const surnames = new Map<string, number[]>();
  for (const player of roster) {
    const surname = fold(player.name.trim().split(/\s+/).at(-1) ?? "");
    if (surname) surnames.set(surname, [...surnames.get(surname) ?? [], player.playerId]);
  }
  const found: Mention[] = [];
  const taken = (start: number, end: number) => found.some((item) => start < item.end && end > item.start);
  // Full names first, so "Nikita Nesterenko" is one mention.
  for (const player of roster) for (const match of all(new RegExp(`\\b${escape(fold(player.name.trim()))}\\b`), folded)) {
    const start = match.index!, end = start + match[0].length;
    if (!taken(start, end)) found.push({ start, end, text: original.slice(start, end), playerId: player.playerId });
  }
  for (const [surname, ids] of surnames) for (const match of all(new RegExp(`\\b${escape(surname)}\\b`), folded)) {
    const start = match.index!, end = start + match[0].length;
    if (!taken(start, end)) found.push({ start, end, text: original.slice(start, end), playerId: ids.length === 1 ? ids[0]! : null });
  }
  return found.sort((a, b) => a.start - b.start);
}

export function hasPenaltyCuePhrase(text: string): boolean {
  return segments(text).some((segment) => {
    const folded = fold(segment.text);
    return [...INFRACTIONS.map(([pattern]) => pattern), DRAWN_AFTER, DRAWN_BEFORE, TAKES_DOWN].some((pattern) => all(pattern, folded).length > 0);
  });
}

export function readPenaltyClue(text: string, roster: RosterPlayer[]): PenaltyClue | null {
  const clues: PenaltyClue[] = [];
  for (const segment of segments(text)) {
    const folded = fold(segment.text);
    const shift = (span: Span): Span => ({ start: span.start + segment.start, end: span.end + segment.start, text: span.text });
    const named = mentions(folded, segment.text, roster);
    const infractions = INFRACTIONS.flatMap(([pattern, key]) => all(pattern, folded).map((match) => ({ key, start: match.index!, end: match.index! + match[0].length })));
    const keys = [...new Set(infractions.map((item) => item.key))];
    const infraction = keys.length === 1 ? keys[0]! : null;
    let drawn: Mention | null = null, committed: Mention | null = null, roleBound = false;
    for (const match of all(DRAWN_AFTER, folded)) drawn = named.find((item) => item.start >= match.index! + match[0].length) ?? null;
    for (const match of all(DRAWN_BEFORE, folded)) drawn = [...named].reverse().find((item) => item.end <= match.index!) ?? null;
    for (const match of all(TAKES_DOWN, folded)) {
      committed = [...named].reverse().find((item) => item.end <= match.index!) ?? null;
      drawn = named.find((item) => item.start >= match.index! + match[0].length) ?? null;
      roleBound = true;
    }
    if (!roleBound && infraction) {
      const others = named.filter((item) => item !== drawn);
      const ids = new Set(others.map((item) => item.playerId));
      committed = ids.size === 1 ? others[0]! : null;
    }
    const committedId = committed?.playerId ?? null, drawnId = drawn?.playerId ?? null;
    if (!(committedId != null && infraction) && drawnId == null) continue;
    const used = infractions.filter((item) => item.key === infraction).slice(0, 1);
    clues.push({ committedByPlayerId: committedId, drawnByPlayerId: drawnId, infraction,
      evidence: [...[committed, drawn].filter((item): item is Mention => !!item && item.playerId != null).map(shift),
        ...used.map((item) => shift({ start: item.start, end: item.end, text: segment.text.slice(item.start, item.end) }))].sort((a, b) => a.start - b.start) });
  }
  const distinct = new Set(clues.map((clue) => JSON.stringify([clue.committedByPlayerId, clue.drawnByPlayerId, clue.infraction])));
  return distinct.size === 1 ? clues[0]! : null;
}
