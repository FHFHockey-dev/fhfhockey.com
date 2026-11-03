/**
 * A late feed at the end of a card's window (TJ, 2026-11-03): when only the newest night or nights are incomplete, the card
 * ends at the last complete date and stays exportable, with a page note saying so; any older gap still blocks export.
 */
export type NightCoverage = { date: string; expected: number; observed: number };
export type CompleteThrough = {
  /** The last date the card can claim; null when no night in the window is complete. */
  through: string | null;
  /** Incomplete newest nights cut from the end, oldest first. */
  trimmed: string[];
  /** Incomplete nights before the last complete one: these still block export. */
  olderMissing: string[];
};

/**
 * The one way every late-feed card counts its nights: one date per scheduled team game, and one per team game whose feed is
 * in. Each card decides which team games are in; a night never counts more than were scheduled, and a date with none is not a night.
 */
export function countNights(scheduled: Iterable<string>, reported: Iterable<string>): NightCoverage[] {
  const nights = new Map<string, NightCoverage>();
  for (const date of scheduled) { const night = nights.get(date) ?? { date, expected: 0, observed: 0 }; night.expected++; nights.set(date, night); }
  for (const date of reported) { const night = nights.get(date); if (night && night.observed < night.expected) night.observed++; }
  return [...nights.values()];
}
/** Both team games of each scheduled game, by date. */
export const teamGameDates = (games: Iterable<{ date: string }>) => [...games].flatMap(game => [game.date, game.date]);

/** A night with no games scheduled counts as complete, so it can end a card. Nights after `through` are ignored. */
export function completeThrough(nights: readonly NightCoverage[], through: string): CompleteThrough {
  const window = nights.filter(night => night.date <= through).sort((a, b) => a.date.localeCompare(b.date));
  const incomplete = (night: NightCoverage) => night.observed < night.expected;
  let last = window.length - 1;
  while (last >= 0 && incomplete(window[last])) last--;
  const trimmed = window.slice(last + 1).map(night => night.date);
  if (!trimmed.length) return { through, trimmed, olderMissing: window.filter(incomplete).map(night => night.date) };
  return { through: last < 0 ? null : window[last].date, trimmed, olderMissing: window.slice(0, last + 1).filter(incomplete).map(night => night.date) };
}

const SHORT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const shortDate = (date: string) => SHORT.format(new Date(`${date}T12:00:00Z`));
/** The page note for a trimmed card, or null when nothing was cut. Never printed on the PNG. */
export function completeThroughNote({ through, trimmed }: CompleteThrough) {
  if (!trimmed.length || !through) return null;
  const nights = trimmed.map(shortDate), named = nights.length === 1 ? nights[0] : `${nights.slice(0, -1).join(", ")} and ${nights[nights.length - 1]}`;
  return `${named} ${nights.length === 1 ? "is" : "are"} not fully reported yet, so this card ends ${shortDate(through)}.`;
}
