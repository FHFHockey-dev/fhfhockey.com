import type { SeasonDetails } from "lib/NHL/server";

const DAY_MS = 86400000;

function dateMs(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T00:00:00\.000Z)?$/.test(value)) return null;
  const date = value.slice(0, 10);
  const ms = Date.parse(`${date}T00:00:00.000Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === date ? ms : null;
}

/** Event dates remain unchanged. Only authoritative regular-season intervals age evidence. */
export function regularSeasonRecencyDays(args: {
  eventDate: string;
  eventSeasonId: number;
  eventGameType: number;
  asOfDate: string;
  currentSeasonId: number;
  seasons: readonly SeasonDetails[];
}): number | null {
  const event = dateMs(args.eventDate), cutoff = dateMs(args.asOfDate);
  if (event === null || cutoff === null || event >= cutoff || args.seasons.length === 0) return null;
  const seasons = [...args.seasons].sort((a, b) => a.id - b.id);
  const intervals: Array<{ id: number; start: number; end: number; seasonEnd: number }> = [];
  for (const season of seasons) {
    const year = Math.floor(season.id / 10000);
    const start = dateMs(season.startDate), end = dateMs(season.regularSeasonEndDate), seasonEnd = dateMs(season.endDate);
    const previous = intervals.at(-1);
    if (!Number.isSafeInteger(season.id) || season.id !== year * 10000 + year + 1
      || start === null || end === null || seasonEnd === null || start >= end || end > seasonEnd
      || previous && (season.id !== previous.id + 10001 || start <= previous.seasonEnd)) return null;
    intervals.push({ id: season.id, start, end, seasonEnd });
  }
  const current = intervals.at(-1)!;
  if (current.id !== args.currentSeasonId || cutoff < current.start || cutoff > current.seasonEnd) return null;
  // Preseason/playoff rows cannot masquerade as regular-season recency evidence.
  if (args.eventGameType !== 2 || !intervals.some(s => s.id === args.eventSeasonId && s.start <= event && event <= s.end)) return null;
  return intervals.reduce((days, s) => days + Math.max(0, Math.min(cutoff, s.end) - Math.max(event, s.start)) / DAY_MS, 0);
}

/** Resolve every intervening season through the existing native server reader. */
export async function loadSkaterRecencySeasons(args: {
  currentSeasonId: number;
  latestEventDates: readonly string[];
  readSeason: (id: number) => Promise<SeasonDetails | null>;
}): Promise<SeasonDetails[]> {
  const seasons: SeasonDetails[] = [];
  const eventDates = args.latestEventDates.map(dateMs);
  if (eventDates.some(date => date === null)) throw new Error("Invalid skater recency event date");
  const earliest = eventDates.length ? Math.min(...eventDates as number[]) : Infinity;
  let id = args.currentSeasonId;
  for (let count = 0; count < 8; count++, id -= 10001) {
    const season = await args.readSeason(id);
    if (!season || season.id !== id || dateMs(season.startDate) === null) throw new Error(`Missing skater recency season boundary: ${id}`);
    seasons.unshift(season);
    if (earliest >= dateMs(season.startDate)!) return seasons;
  }
  throw new Error("Skater recency exceeds bounded season history");
}
