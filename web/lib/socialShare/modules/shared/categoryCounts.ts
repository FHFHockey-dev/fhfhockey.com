import { competitionRanks, pooledGaa, pooledSavePct } from "./definitions";
import type { GoalieAppearance } from "./goalieLedger";

/**
 * Category Counts (CONTRACT §3): a new, separately labeled goalie method. It reports above, below and tied apart, keeps a
 * real zero baseline and has no grades or borrowed thresholds. Existing TGV grades stay in goalieCalculations.ts.
 */
export const CATEGORY_COUNTS_LABEL = "Category Counts";
export type CategoryId = "wins" | "saves" | "svPct" | "gaa" | "shutouts" | "goalsAgainst" | "losses" | "qualityStarts";
export type CategoryDirection = "higher" | "lower";
export type CategoryDefinition = { id: CategoryId; label: string; direction: CategoryDirection; kind: "count" | "rate"; decimals: number | null; default: boolean };
export const CATEGORIES: readonly CategoryDefinition[] = [
  { id: "wins", label: "W", direction: "higher", kind: "count", decimals: null, default: true },
  { id: "saves", label: "SV", direction: "higher", kind: "count", decimals: null, default: true },
  { id: "svPct", label: "SV%", direction: "higher", kind: "rate", decimals: 3, default: true },
  { id: "gaa", label: "GAA", direction: "lower", kind: "rate", decimals: 2, default: true },
  { id: "shutouts", label: "SO", direction: "higher", kind: "count", decimals: null, default: true },
  { id: "goalsAgainst", label: "GA", direction: "lower", kind: "count", decimals: null, default: false },
  { id: "losses", label: "L+OTL", direction: "lower", kind: "count", decimals: null, default: false },
  { id: "qualityStarts", label: "QS", direction: "higher", kind: "count", decimals: null, default: false },
];
export const DEFAULT_CATEGORY_IDS = CATEGORIES.filter(category => category.default).map(category => category.id);
export const categoryById = (id: CategoryId) => CATEGORIES.find(category => category.id === id)!;

/** Summed parts of one or more rows. Any row's null stat makes that part null: missing is never zero. */
export type CategoryParts = { wins: number | null; saves: number | null; shotsAgainst: number | null; goalsAgainst: number | null; toiSeconds: number | null; shutouts: number | null; losses: number | null; qualityStarts: number | null };
const add = (a: number | null, b: number | null) => a === null || b === null ? null : a + b;
export function partsOf(rows: readonly GoalieAppearance[]): CategoryParts {
  const parts: CategoryParts = { wins: 0, saves: 0, shotsAgainst: 0, goalsAgainst: 0, toiSeconds: 0, shutouts: 0, losses: 0, qualityStarts: 0 };
  for (const row of rows) {
    parts.wins = add(parts.wins, row.wins); parts.saves = add(parts.saves, row.saves); parts.shotsAgainst = add(parts.shotsAgainst, row.shotsAgainst);
    parts.goalsAgainst = add(parts.goalsAgainst, row.goalsAgainst); parts.toiSeconds = add(parts.toiSeconds, row.toiSeconds); parts.shutouts = add(parts.shutouts, row.shutouts);
    parts.losses = add(parts.losses, add(row.losses, row.otLosses)); parts.qualityStarts = add(parts.qualityStarts, row.qualityStart);
  }
  return parts;
}
const COUNT_PART = { wins: "wins", saves: "saves", shutouts: "shutouts", goalsAgainst: "goalsAgainst", losses: "losses", qualityStarts: "qualityStarts" } as const;
const RATE_PARTS = { svPct: ["saves", "shotsAgainst"], gaa: ["goalsAgainst", "toiSeconds"] } as const;

/** Half-up in integer arithmetic, so a binary float can neither break nor fake a tie at the contract's precision. */
const roundedRatio = (numerator: number, denominator: number, decimals: number) => { const scale = 10 ** decimals; return Math.floor((2 * scale * numerator + denominator) / (2 * denominator)); };
/** The category's value, and the same value at its comparison precision. Null is unavailable: a null stat, SA of 0 or TOI of 0. */
function measure(id: CategoryId, parts: CategoryParts): { value: number; comparable: number } | null {
  if (id === "svPct") {
    const value = pooledSavePct(parts.saves, parts.shotsAgainst);
    return value === null ? null : { value, comparable: roundedRatio(parts.saves!, parts.shotsAgainst!, 3) };
  }
  if (id === "gaa") {
    const value = pooledGaa(parts.goalsAgainst, parts.toiSeconds);
    return value === null ? null : { value, comparable: roundedRatio(parts.goalsAgainst! * 3600, parts.toiSeconds!, 2) };
  }
  const value = parts[COUNT_PART[id]];
  return value === null ? null : { value, comparable: value };
}

export type CategoryBaseline = {
  value: number | null; comparable: number | null;
  /** Rows or goalies whose known values formed the baseline, and those left out for a null stat. */
  known: number; excluded: number;
};
const NO_BASELINE = (excluded: number): CategoryBaseline => ({ value: null, comparable: null, known: 0, excluded });
/** Count: Σvalue ÷ known members (starts for a game baseline, pool goalies for a week baseline). Rate: pooled over members. Never a mean of rates. */
export function categoryBaseline(id: CategoryId, members: readonly CategoryParts[]): CategoryBaseline {
  if (id === "svPct" || id === "gaa") {
    const [top, bottom] = RATE_PARTS[id];
    const known = members.filter(parts => parts[top] !== null && parts[bottom] !== null);
    const pooled = measure(id, partsSum(known));
    return pooled ? { ...pooled, known: known.length, excluded: members.length - known.length } : NO_BASELINE(members.length - known.length);
  }
  const part = COUNT_PART[id], known = members.filter(parts => parts[part] !== null);
  if (!known.length) return NO_BASELINE(members.length);
  // Division is correctly rounded, so a baseline that is truly an integer compares exactly with a goalie's integer.
  const value = known.reduce((total, parts) => total + parts[part]!, 0) / known.length;
  return { value, comparable: value, known: known.length, excluded: members.length - known.length };
}
function partsSum(members: readonly CategoryParts[]): CategoryParts {
  const total: CategoryParts = { wins: 0, saves: 0, shotsAgainst: 0, goalsAgainst: 0, toiSeconds: 0, shutouts: 0, losses: 0, qualityStarts: 0 };
  for (const parts of members) (Object.keys(total) as (keyof CategoryParts)[]).forEach(key => { total[key] = add(total[key], parts[key]); });
  return total;
}

export type CellResult = "above" | "below" | "tied" | "unavailable";
export type CellOutcome = "better" | "worse" | "tied" | "unavailable";
export type CategoryCell = { category: CategoryId; unit: "game" | "week"; week: number; gameId: number | null; date: string | null; result: CellResult; outcome: CellOutcome; value: number | null; baseline: number | null };
export const cellOutcome = (result: CellResult, direction: CategoryDirection): CellOutcome =>
  result === "tied" || result === "unavailable" ? result : (result === "above") === (direction === "higher") ? "better" : "worse";
export function compareToBaseline(id: CategoryId, parts: CategoryParts, baseline: CategoryBaseline): Pick<CategoryCell, "result" | "outcome" | "value" | "baseline"> {
  const measured = measure(id, parts);
  if (!measured || baseline.comparable === null) return { result: "unavailable", outcome: "unavailable", value: measured?.value ?? null, baseline: baseline.value };
  const result: CellResult = measured.comparable > baseline.comparable ? "above" : measured.comparable < baseline.comparable ? "below" : "tied";
  return { result, outcome: cellOutcome(result, categoryById(id).direction), value: measured.value, baseline: baseline.value };
}

export type MatchupWeek = { week: number; start: string; end: string };
/** `yahoo_matchup_weeks` rows, validated. Overlapping weeks would make a game's baseline ambiguous, so they fail closed. */
export function toMatchupWeeks(rows: readonly { week: number; start_date: string | null; end_date: string | null }[]): MatchupWeek[] {
  const weeks = rows.flatMap(row => row.start_date && row.end_date ? [{ week: row.week, start: row.start_date, end: row.end_date }] : []).sort((a, b) => a.start.localeCompare(b.start));
  weeks.forEach((week, index) => { if (week.end < week.start || (index > 0 && week.start <= weeks[index - 1].end)) throw new Error("Matchup weeks overlap or run backwards."); });
  return weeks;
}

type GameRef = { gameId: number; date: string };
export type WeekGoalie = { goalieId: number; name: string | null; teams: string[]; starts: GameRef[]; relief: GameRef[]; gameCells: CategoryCell[]; weekCells: CategoryCell[] };
export type ReliefOnlyGoalie = { goalieId: number; name: string | null; teams: string[]; relief: GameRef[] };
export type WeekLedger = {
  week: MatchupWeek; officialStarts: number; poolGoalies: number; goalies: WeekGoalie[];
  /** Relief-only weeks give no cells and are counted apart. */
  reliefOnly: ReliefOnlyGoalie[];
  /** Rows with no starter label: neither a start nor relief. They leave the goalie out of cells and make the period partial upstream. */
  unlabeled: number;
  gameBaselines: Record<string, CategoryBaseline>; weekBaselines: Record<string, CategoryBaseline>;
};

/** One week's cells and baselines, recomputed from that week's appearances. The pool is everyone with an official start, including the goalie compared. */
export function buildWeekLedger(week: MatchupWeek, rows: readonly GoalieAppearance[], categories: readonly CategoryId[]): WeekLedger {
  const byGoalie = new Map<number, GoalieAppearance[]>();
  for (const row of rows) byGoalie.set(row.goalieId, [...byGoalie.get(row.goalieId) ?? [], row]);
  const starts = rows.filter(row => row.started === true);
  const pool = [...byGoalie.entries()].filter(([, own]) => own.some(row => row.started === true));
  const totals = new Map(pool.map(([goalieId, own]) => [goalieId, partsOf(own)]));
  const startParts = starts.map(row => partsOf([row])), weekParts = [...totals.values()];
  const gameBaselines = Object.fromEntries(categories.map(id => [id, categoryBaseline(id, startParts)]));
  const weekBaselines = Object.fromEntries(categories.map(id => [id, categoryBaseline(id, weekParts)]));
  const ref = (row: GoalieAppearance): GameRef => ({ gameId: row.gameId, date: row.date });
  const teamsOf = (own: readonly GoalieAppearance[]) => [...new Set(own.map(row => row.team))];
  const nameOf = (own: readonly GoalieAppearance[]) => own.reduce<string | null>((name, row) => row.name ?? name, null);
  const goalies = pool.map(([goalieId, own]): WeekGoalie => ({
    goalieId, name: nameOf(own), teams: teamsOf(own), starts: own.filter(row => row.started === true).map(ref), relief: own.filter(row => row.started === false).map(ref),
    gameCells: own.filter(row => row.started === true).flatMap(row => categories.map(id => ({ category: id, unit: "game" as const, week: week.week, gameId: row.gameId, date: row.date, ...compareToBaseline(id, partsOf([row]), gameBaselines[id]) }))),
    weekCells: categories.map(id => ({ category: id, unit: "week" as const, week: week.week, gameId: null, date: null, ...compareToBaseline(id, totals.get(goalieId)!, weekBaselines[id]) })),
  }));
  const reliefOnly = [...byGoalie.entries()].filter(([goalieId, own]) => !totals.has(goalieId) && own.some(row => row.started === false))
    .map(([goalieId, own]) => ({ goalieId, name: nameOf(own), teams: teamsOf(own), relief: own.filter(row => row.started === false).map(ref) }));
  return { week, officialStarts: starts.length, poolGoalies: pool.length, goalies, reliefOnly, unlabeled: rows.filter(row => row.started === null).length, gameBaselines, weekBaselines };
}
/** Ledgers for the given weeks, and the rows dated in none of them, which are counted rather than dropped silently. */
export function buildWeekLedgers(weeks: readonly MatchupWeek[], appearances: readonly GoalieAppearance[], categories: readonly CategoryId[]) {
  const inWeek = (week: MatchupWeek, row: GoalieAppearance) => row.date >= week.start && row.date <= week.end;
  return {
    ledgers: weeks.map(week => buildWeekLedger(week, appearances.filter(row => inWeek(week, row)), categories)),
    unassigned: appearances.filter(row => !weeks.some(week => inWeek(week, row))).length,
  };
}

const monthDays = (month: string) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
const monthRange = (month: string) => ({ start: `${month}-01`, end: `${month}-${String(monthDays(month)).padStart(2, "0")}` });
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const monthName = (month: string) => `${MONTH_NAMES[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
/** The month holding most of a week's days; an even split goes to the later month. */
export function weekMonth(week: MatchupWeek) {
  const days = new Map<string, number>();
  for (let time = Date.parse(`${week.start}T00:00:00Z`); time <= Date.parse(`${week.end}T00:00:00Z`); time += 86400000) {
    const month = new Date(time).toISOString().slice(0, 7);
    days.set(month, (days.get(month) ?? 0) + 1);
  }
  return [...days.entries()].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0][0];
}

export type SharePeriod = {
  kind: "week" | "month"; key: string; label: string;
  /** Past the cutoff: its label says "through <date>". */
  inProgress: boolean; through: string;
  /** Game cells cover starts dated here. */
  gameFrom: string; gameTo: string;
  /** Week cells cover these weeks. */
  cellWeeks: MatchupWeek[];
  /** Every week whose baseline this period uses, so every game the read must prove. */
  touchedWeeks: MatchupWeek[];
};
export function weekPeriod(week: MatchupWeek, through: string): SharePeriod {
  const inProgress = week.end > through;
  return { kind: "week", key: String(week.week), label: `Week ${week.week}, ${week.start} to ${week.end}${inProgress ? `, through ${through}` : ""}`, inProgress, through, gameFrom: week.start, gameTo: week.end, cellWeeks: [week], touchedWeeks: [week] };
}
export function monthPeriod(weeks: readonly MatchupWeek[], month: string, through: string): SharePeriod {
  const { start, end } = monthRange(month);
  const cellWeeks = weeks.filter(week => weekMonth(week) === month);
  const touchedWeeks = weeks.filter(week => cellWeeks.includes(week) || (week.start <= end && week.end >= start));
  const inProgress = end > through || cellWeeks.some(week => week.end > through);
  return { kind: "month", key: month, label: `${monthName(month)}${inProgress ? `, through ${through}` : ""}`, inProgress, through, gameFrom: start, gameTo: end, cellWeeks, touchedWeeks };
}
/** The last completed week; before any completes, the first one under way, which its label marks as in progress. */
export const defaultWeek = (weeks: readonly MatchupWeek[], through: string) => [...weeks].reverse().find(week => week.end <= through) ?? weeks.find(week => week.start <= through) ?? null;
/** The last completed month, its assigned weeks finished too; before any completes, the first one under way. */
export function defaultMonth(weeks: readonly MatchupWeek[], through: string): string | null {
  const months: string[] = [];
  for (const week of weeks) for (const date of [week.start, week.end]) if (!months.includes(date.slice(0, 7))) months.push(date.slice(0, 7));
  const started = months.filter(month => monthRange(month).start <= through).sort();
  return [...started].reverse().find(month => !monthPeriod(weeks, month, through).inProgress) ?? started[0] ?? null;
}

export type CellCounts = { above: number; below: number; tied: number; unavailable: number; better: number; worse: number; compared: number };
const emptyCounts = (): CellCounts => ({ above: 0, below: 0, tied: 0, unavailable: 0, better: 0, worse: 0, compared: 0 });
export function countCells(cells: readonly CategoryCell[]): CellCounts {
  const counts = emptyCounts();
  for (const cell of cells) {
    if (cell.result === "unavailable") { counts.unavailable++; continue; }
    counts[cell.result]++; counts.compared++;
    if (cell.outcome === "better") counts.better++;
    if (cell.outcome === "worse") counts.worse++;
  }
  return counts;
}
export type PeriodGoalie = {
  goalieId: number; name: string | null; teams: string[];
  /** Official starts and relief appearances in the period's game dates. Relief has no game cells. */
  starts: number; relief: number;
  /** Assigned weeks where this goalie's only appearances were relief: no cells. */
  reliefOnlyWeeks: number[];
  game: CellCounts; week: CellCounts; byCategory: { category: CategoryId; game: CellCounts; week: CellCounts }[];
  gameNet: number; weekNet: number; betterRate: number | null;
  /** Null below the minimum starts or with no compared game cell. Worst is the same ranking from the bottom. */
  eligible: boolean; rank: number | null; worstRank: number | null;
};
const dated = (period: SharePeriod, game: GameRef) => game.date >= period.gameFrom && game.date <= period.gameTo && game.date <= period.through;
/** The cells a period counts: game cells for its dates, each against its own week's baseline, plus its assigned weeks' cells. */
export function periodGoalies(ledgers: readonly WeekLedger[], period: SharePeriod, categories: readonly CategoryId[]): Omit<PeriodGoalie, "eligible" | "rank" | "worstRank">[] {
  const assigned = new Set(period.cellWeeks.map(week => week.week));
  const goalies = new Map<number, { goalieId: number; name: string | null; teams: Set<string>; starts: number; relief: number; reliefOnlyWeeks: number[]; gameCells: CategoryCell[]; weekCells: CategoryCell[] }>();
  const entry = (goalie: { goalieId: number; name: string | null }) => {
    const found = goalies.get(goalie.goalieId) ?? { goalieId: goalie.goalieId, name: goalie.name, teams: new Set<string>(), starts: 0, relief: 0, reliefOnlyWeeks: [], gameCells: [], weekCells: [] };
    goalies.set(goalie.goalieId, found);
    return found;
  };
  for (const ledger of ledgers) {
    for (const goalie of ledger.goalies) {
      const starts = goalie.starts.filter(game => dated(period, game)), relief = goalie.relief.filter(game => dated(period, game));
      const countsWeek = assigned.has(ledger.week.week);
      if (!starts.length && !relief.length && !countsWeek) continue;
      const row = entry(goalie);
      goalie.teams.forEach(team => row.teams.add(team));
      row.starts += starts.length; row.relief += relief.length;
      row.gameCells.push(...goalie.gameCells.filter(cell => dated(period, { gameId: cell.gameId!, date: cell.date! })));
      if (countsWeek) row.weekCells.push(...goalie.weekCells);
    }
    for (const goalie of ledger.reliefOnly) {
      const relief = goalie.relief.filter(game => dated(period, game)), countsWeek = assigned.has(ledger.week.week);
      if (!relief.length && !countsWeek) continue;
      const row = entry(goalie);
      goalie.teams.forEach(team => row.teams.add(team));
      row.relief += relief.length;
      if (countsWeek) row.reliefOnlyWeeks.push(ledger.week.week);
    }
  }
  return [...goalies.values()].map(row => {
    const game = countCells(row.gameCells), week = countCells(row.weekCells);
    return {
      goalieId: row.goalieId, name: row.name, teams: [...row.teams], starts: row.starts, relief: row.relief, reliefOnlyWeeks: row.reliefOnlyWeeks, game, week,
      byCategory: categories.map(category => ({ category, game: countCells(row.gameCells.filter(cell => cell.category === category)), week: countCells(row.weekCells.filter(cell => cell.category === category)) })),
      gameNet: game.better - game.worse, weekNet: week.better - week.worse, betterRate: game.compared ? game.better / game.compared : null,
    };
  });
}
/** Game net, then week net, then better ÷ compared at game level; anything still equal shares the rank. */
export function rankPeriodGoalies(goalies: ReadonlyArray<Omit<PeriodGoalie, "eligible" | "rank" | "worstRank">>, minStarts: number): PeriodGoalie[] {
  const eligible = goalies.filter(goalie => goalie.starts >= minStarts && goalie.game.compared > 0);
  const order = (a: typeof goalies[number], b: typeof goalies[number]) => a.gameNet - b.gameNet || a.weekNet - b.weekNet || a.betterRate! - b.betterRate!;
  const levels = [...eligible].sort(order).filter((goalie, index, sorted) => index === 0 || order(sorted[index - 1], goalie) !== 0);
  const level = (goalie: typeof goalies[number]) => levels.findIndex(other => order(other, goalie) === 0);
  const id = (goalie: typeof goalies[number]) => goalie.goalieId;
  const best = new Map(competitionRanks(eligible, level, id, "high").map(entry => [entry.row.goalieId, entry.rank]));
  const worst = new Map(competitionRanks(eligible, level, id, "low").map(entry => [entry.row.goalieId, entry.rank]));
  return goalies.map(goalie => ({ ...goalie, eligible: best.has(goalie.goalieId), rank: best.get(goalie.goalieId) ?? null, worstRank: worst.get(goalie.goalieId) ?? null }))
    .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || b.starts - a.starts || a.goalieId - b.goalieId);
}
