import { localDate } from "lib/rosterScheduleOptimizer/planningDates";
import { SHARE_TIME_ZONE } from "lib/socialShare/types";

/** Shared definitions (CONTRACT.md §2). The one producer of each; posts import these and never restate them. */
export const editionDate = (generatedAt: string) => localDate(generatedAt, SHARE_TIME_ZONE);

/** Yahoo rostered %. 0 is a known value when the source states it; null or out of range is unknown, never 0. */
export type OwnershipState = { state: "known"; pct: number; asOf: string | null } | { state: "unknown"; pct: null; asOf: null };
export function ownershipOf(value: number | null | undefined, asOf: string | null = null): OwnershipState {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100 ? { state: "known", pct: value, asOf } : { state: "unknown", pct: null, asOf: null };
}
export const OWNERSHIP_UNKNOWN_LABEL = "—";
export const ownershipLabel = (ownership: OwnershipState) => ownership.state === "known" ? `${ownership.pct}%` : OWNERSHIP_UNKNOWN_LABEL;
/** Inclusive range filter. Unknown ownership matches only when the editor explicitly includes it. */
export function ownershipInRange(ownership: OwnershipState, min: number, max: number, includeUnknown = false) {
  return ownership.state === "known" ? ownership.pct >= min && ownership.pct <= max : includeUnknown;
}

/** A window that says what it holds: `actual` below `requested` is a short sample, shown as such. */
export type ShareWindow<T> = { rows: T[]; requested: number | null; actual: number; short: boolean };
const windowOf = <T>(rows: T[], requested: number | null): ShareWindow<T> => ({ rows, requested, actual: rows.length, short: requested !== null && rows.length < requested });
/** The last N of rows sorted oldest first. For skaters a row is a completed appearance; for goalie share, a completed team game. */
export const lastN = <T>(rows: readonly T[], n: number) => windowOf(n > 0 ? rows.slice(-n) : [], n);
/** The N before the last `skip`, with no game in both: the matched recent/previous pair. */
export const previousN = <T>(rows: readonly T[], skip: number, n: number) => windowOf(rows.slice(Math.max(0, rows.length - skip - n), Math.max(0, rows.length - skip)), n);
/** Recent versus season to date. The season contains the recent games, so the overlap is always disclosed. */
export function versusSeason<T>(rows: readonly T[], n: number) {
  const recent = lastN(rows, n);
  return { recent, season: windowOf([...rows], null), overlap: recent.actual, seasonExcludingRecent: windowOf(rows.slice(0, Math.max(0, rows.length - n)), null) };
}

/** Strictly above X: exactly X fails. A missing value is neither a pass nor a fail. */
export const strictlyAbove = (value: number | null | undefined, x: number): boolean | null => value == null || !Number.isFinite(value) ? null : value > x;
/** BLK + SOG + HITS. Any missing component makes it unknown, never a smaller total. */
export const bsh = (row: { blocks: number | null; shots: number | null; hits: number | null }) => row.blocks === null || row.shots === null || row.hits === null ? null : row.blocks + row.shots + row.hits;

const positive = (value: number | null | undefined): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;
const known = (value: number | null | undefined): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
/** Pooled rates from summed parts, never a mean of percentages. A zero or missing denominator is unknown. */
export const pooledSavePct = (saves: number | null | undefined, shotsAgainst: number | null | undefined) => positive(shotsAgainst) && known(saves) && saves <= shotsAgainst ? saves / shotsAgainst : null;
export const pooledGaa = (goalsAgainst: number | null | undefined, toiSeconds: number | null | undefined) => positive(toiSeconds) && known(goalsAgainst) ? goalsAgainst * 3600 / toiSeconds : null;
export const per60 = (count: number | null | undefined, toiSeconds: number | null | undefined) => positive(toiSeconds) && known(count) ? count * 3600 / toiSeconds : null;

/** Competition ranks (1, 2, 2, 4): ties share a rank and unknown values get none. `id` only orders ties for display. */
export function competitionRanks<T>(rows: readonly T[], value: (row: T) => number | null, id: (row: T) => number | string, direction: "high" | "low" = "high") {
  const sign = direction === "high" ? -1 : 1;
  const ranked = rows.flatMap(row => { const score = value(row); return score === null || !Number.isFinite(score) ? [] : [{ row, score }]; })
    .sort((a, b) => sign * (a.score - b.score) || String(id(a.row)).localeCompare(String(id(b.row)), undefined, { numeric: true }));
  let rank = 0;
  return ranked.map(({ row, score }, index) => {
    if (index === 0 || score !== ranked[index - 1].score) rank = index + 1;
    return { row, score, rank };
  });
}
