import { normalizeIdentityName, positionSlotRole } from "./playerIdentity";
import { lineReportTimeScope } from "./lineReportTime";
import type { TweetInterpretation, TweetUnit } from "./tweetInterpretation";
import { tweetPublicationFromUrl } from "./tweetPublicationTime";

/** Additional lines printed at practice belong to this source only. Never use these rows to select a game formation. */
export function reportedPracticeDepth(reading: Partial<TweetInterpretation>, teamId: number | null, text: string,
  originalUrl: string | null, originalTime: string | null, reviewSpans: { start: number; end: number }[] = []): TweetUnit[] {
  if (!Array.isArray(reading.excludedUnits) || !reading.excludedUnits.length || !Array.isArray(reading.units)
    || reading.context !== "practice" || reading.lineContext?.context !== "practice" || reading.lineContext.phase !== "pregame"
    || reading.identityContext?.basis !== "publication_roster" || !Number.isSafeInteger(teamId)
    || !Array.isArray(reading.lineContext.evidence) || !reading.lineContext.evidence.some(span => span.signal === "practice"
      && text.slice(span.start, span.end) === span.text && /\b(?:practice|morning skate)\b/i.test(span.text))
    || !originalTime || !reading.identityContext.sourcePublishedAt || typeof reading.rosterRevision !== "string") return [];
  const clock = tweetPublicationFromUrl(originalUrl);
  if (!clock || Math.floor(Date.parse(clock) / 1000) !== Math.floor(Date.parse(originalTime) / 1000)
    || Date.parse(reading.identityContext.sourcePublishedAt) !== Date.parse(originalTime)
    || lineReportTimeScope(text)?.historical) return [];

  const roster = new Map<number, { full: string; names: string[]; role: ReturnType<typeof positionSlotRole> }>();
  for (const entry of reading.rosterRevision.split("|")) {
    const [id, full, surname, team, position, ...aliases] = entry.split(":");
    if (Number(team) === teamId && full && surname) roster.set(Number(id), {
      full, names: [full, surname, ...aliases].map(normalizeIdentityName), role: positionSlotRole(position),
    });
  }
  const all = [...reading.units, ...reading.excludedUnits];
  return reading.excludedUnits.filter(unit => {
    const size = unit?.situation === "es_forward" ? 3 : unit?.situation === "es_defense" ? 2 : 0;
    if (!size || unit.complete !== true || unit.group != null || !Number.isSafeInteger(unit.number) || unit.number! <= (size === 3 ? 4 : 3)
      || !Array.isArray(unit.players) || unit.players.length !== size || !Array.isArray(unit.evidence) || unit.evidence.length !== size
      || all.some(other => other !== unit && other?.situation === unit.situation && other.number === unit.number && other.group == null)
      || reading.unresolved?.some(issue => issue.situation === unit.situation && (issue.number == null || issue.number === unit.number))) return false;
    const seen = new Set<number>();
    for (const [i, player] of unit.players.entries()) {
      const span = unit.evidence[i];
      const member = roster.get(player?.playerId);
      if (!member || member.full !== player.name || member.role !== unit.situation || seen.has(player.playerId) || !span || !Number.isSafeInteger(span.start)
        || !Number.isSafeInteger(span.end) || span.start < 0 || span.end <= span.start || text.slice(span.start, span.end) !== span.text
        || typeof span.text !== "string" || !member.names.includes(normalizeIdentityName(span.text))
        || [...roster.values()].some(other => other !== member && other.role === member.role && other.names.includes(normalizeIdentityName(span.text)))
        || reviewSpans.some(review => span.start < review.end && review.start < span.end)
        || all.some(other => other !== unit && (other?.situation === "scratch" || other?.situation === "es_forward" || other?.situation === "es_defense")
          && other.players?.some(member => member?.playerId === player.playerId))) return false;
      if (i && !/^[ \t]*[-–—][ \t]*$/.test(text.slice(unit.evidence[i - 1]!.end, span.start))) return false;
      seen.add(player.playerId);
    }
    const first = unit.evidence[0]!.start, last = unit.evidence[size - 1]!.end;
    return !text.slice(text.lastIndexOf("\n", first - 1) + 1, first).trim()
      && /^[ \t]*(?:https:\/\/t\.co\/\w+)?[ \t]*$/.test(text.slice(last).split(/\r?\n/, 1)[0]!);
  });
}
