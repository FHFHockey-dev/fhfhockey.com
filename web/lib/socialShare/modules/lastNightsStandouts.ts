import { normalizeEvDeploymentBucket } from "lib/rankings/skaterDeploymentAggregation";
import { defineShareModule, shareSettingsKey, type ShareSettingField, type SharePostLoadResult, type SharePostSource } from "./contract";
import { toNstGoalieGames, type NstGsaxRow } from "./goalieGsax";
import { roleSlotReader, type RoleEvidence, type RoleRollingRow, type RoleSlot } from "./roleWatch";
import { ownershipOf, pooledGaa, pooledSavePct, type OwnershipState } from "./shared/definitions";
import type { GoalieAppearance } from "./shared/goalieLedger";
import { appearancesByPlayer, type SkaterAppearance } from "./shared/skaterAppearances";
import { coverageAdmits, formatSeconds, joinNst, WHAT_CHANGED_METRICS, type NstCountRow, type NstOnIceRow, type WhatChangedMetricId } from "./whatChanged";

/**
 * Last Nights Standouts: what happened on the latest completed slate, against each player's own season per game before it.
 * Views 1 and 2 are built by hand in the sidebar and start blank. Views 3 to 5 rank themselves. Observed only, no forecast.
 */
export type StandoutView = "under" | "all" | "goalies" | "forwards" | "defensemen";
export type StandoutStatId = "sog" | "toi" | "icf" | "iscf" | "xg" | "xgPct" | "ppToi";
export type StandoutSortKey = "points" | StandoutStatId;
export type StandoutSortMode = "average" | "value" | "jump";
export type LastNightsStandoutsSettings = { view: StandoutView; rosterMax: number; rankBy: StandoutSortKey; minShotsAgainst: number; minPriorGp: number; minCoverage: number; picks: string };

/** What fits the 860px body: two lines a skater, and one table line a goalie. The sidebar prints the skater limit. */
export const STANDOUT_MAX_ROWS = 8;
export const STANDOUT_GOALIE_ROWS = 8;

const STAT_METRICS: readonly { id: StandoutStatId; label: string; metric: WhatChangedMetricId }[] = [
  { id: "sog", label: "SOG", metric: "shots" }, { id: "toi", label: "TOI", metric: "toi" }, { id: "icf", label: "iCF", metric: "icf" }, { id: "iscf", label: "iSCF", metric: "iscf" },
  { id: "xg", label: "xG", metric: "ixg" }, { id: "xgPct", label: "xG%", metric: "xgfPct" }, { id: "ppToi", label: "PPTOI", metric: "ppToi" },
];
export const STANDOUT_STAT_LABELS = Object.fromEntries(STAT_METRICS.map(stat => [stat.id, stat.label])) as Record<StandoutStatId, string>;
export const STANDOUT_SORT_OPTIONS: readonly { value: StandoutSortKey; label: string }[] = [{ value: "points", label: "Points" }, ...STAT_METRICS.map(stat => ({ value: stat.id, label: stat.label }))];
export const isHandBuilt = (view: StandoutView) => view === "under" || view === "all";
export const isGoalieView = (view: StandoutView) => view === "goalies";

const metricOf = (id: WhatChangedMetricId) => WHAT_CHANGED_METRICS.find(metric => metric.id === id)!;
type Metric = typeof WHAT_CHANGED_METRICS[number];
type JoinedGame = Parameters<Metric["read"]>[0];

/** One game's value. A null is missing, never zero; an xG% with no xG either way has no value. */
function gameValue(metric: Metric, game: JoinedGame) {
  const value = metric.read(game);
  if (value === null || typeof value === "number") return value;
  return value.for + value.against > 0 ? value.for * 100 / (value.for + value.against) : null;
}
/** Per game over the games before the slate; xG% is pooled. NHL.com windows must be complete and NST windows must meet the post's coverage. */
function baselineOf(metric: Metric, prior: readonly JoinedGame[], settings: Pick<LastNightsStandoutsSettings, "minCoverage" | "minPriorGp">) {
  if (prior.length < settings.minPriorGp) return null;
  let observed = 0, sum = 0, against = 0;
  for (const game of prior) {
    const value = metric.read(game);
    if (value === null) continue;
    observed++;
    if (typeof value === "number") sum += value; else { sum += value.for; against += value.against; }
  }
  if (!coverageAdmits(observed, prior.length, metric.source === "wgo" ? 100 : settings.minCoverage)) return null;
  if (metric.kind === "share") return sum + against > 0 ? sum * 100 / (sum + against) : null;
  return sum / observed;
}
/** A zero or missing baseline has no percent change. */
export const percentChange = (last: number | null, baseline: number | null) => last === null || baseline === null || baseline === 0 ? null : (last - baseline) * 100 / baseline;
export function percentLabel(change: number | null) {
  if (change === null) return "—";
  const whole = Math.round(change);
  return whole > 0 ? `+${whole}%` : whole < 0 ? `−${-whole}%` : "0%";
}

export type StandoutStat = { id: StandoutStatId; label: string; last: number | null; baseline: number | null; change: number | null };
export function statText(stat: Pick<StandoutStat, "id" | "last">) {
  if (stat.last === null) return "—";
  if (stat.id === "toi" || stat.id === "ppToi") return formatSeconds(stat.last);
  if (stat.id === "xgPct") return `${stat.last.toFixed(1)}%`;
  return stat.id === "xg" ? stat.last.toFixed(2) : String(stat.last);
}
/** The player's season per game before this slate, one more decimal than a count so it reads as an average. */
export function stdText(stat: Pick<StandoutStat, "id" | "baseline">) {
  if (stat.baseline === null) return "—";
  if (stat.id === "toi" || stat.id === "ppToi") return formatSeconds(stat.baseline);
  if (stat.id === "xgPct") return `${stat.baseline.toFixed(1)}%`;
  return stat.id === "xg" ? stat.baseline.toFixed(2) : stat.baseline.toFixed(1);
}
/**
 * The sidebar's default order: the mean % change across the stats that have one and a meaningful STD, each capped at ±200%,
 * and only with at least 4 of the 7 left. Fewer means no average, sorted last. The floors leave out a baseline too small to
 * mean much, however true its %; chips still print that %. Set from every skater's baseline on 2026-10-31: about the 10th
 * percentile for SOG, iSCF and xG%, between the 10th and 25th for iCF and xG. PPTOI's percentiles are near zero, since most
 * skaters barely see the power play, so its floor is the 0:30 a PP unit needs. TOI's is about the 5th, because no skater's is tiny.
 */
export const STANDOUT_AVERAGE_CAP = 200, STANDOUT_AVERAGE_MIN_STATS = 4;
export const STANDOUT_AVERAGE_FLOORS: Record<StandoutStatId, number> = { sog: 0.75, toi: 600, icf: 2, iscf: 0.75, xg: 0.05, xgPct: 35, ppToi: 30 };
export const STANDOUT_AVERAGE_RULE = `Avg is the mean % change, each capped at ±${STANDOUT_AVERAGE_CAP}%, across stats with an STD of at least SOG 0.75, TOI 10:00, iCF 2.0, iSCF 0.75, xG 0.05, xG% 35.0%, PPTOI 0:30, with at least ${STANDOUT_AVERAGE_MIN_STATS} of 7 left.`;
export function averageChange(stats: readonly Pick<StandoutStat, "id" | "baseline" | "change">[]) {
  const changes = stats.flatMap(stat => stat.change === null || stat.baseline === null || stat.baseline < STANDOUT_AVERAGE_FLOORS[stat.id] ? [] : [Math.max(-STANDOUT_AVERAGE_CAP, Math.min(STANDOUT_AVERAGE_CAP, stat.change))]);
  return changes.length < STANDOUT_AVERAGE_MIN_STATS ? null : changes.reduce((total, change) => total + change, 0) / changes.length;
}
/** Exactly `1G-2A-3P-2PPP`, with PPP only above zero. A missing goal, assist or point is no line at all. */
export function goalLine(game: { goals: number | null; assists: number | null; points: number | null; ppPoints: number | null }) {
  if (game.goals === null || game.assists === null || game.points === null) return "—";
  return `${game.goals}G-${game.assists}A-${game.points}P${game.ppPoints !== null && game.ppPoints > 0 ? `-${game.ppPoints}PPP` : ""}`;
}
export const slateLabel = (slate: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${slate}T12:00:00Z`));
/** A line from an earlier game carries that game's date, so it cannot read as last night's. */
export const lineChipText = ({ role, lineAsOf }: { role: RoleSlot; lineAsOf: string | null }) => role.line === "unknown" ? "Line —" : lineAsOf ? `${role.line} · ${slateLabel(lineAsOf)}` : role.line;
export const ppChipText = (role: RoleSlot) => role.pp === "unknown" ? "PP —" : role.pp === "off" ? "Off PP" : `PP${role.pp}`;

/**
 * `powerPlayCombinations.unit` is a rank by the writer's own shift-derived PP time, and that time is wrong for some teams:
 * on 2026-10-31 Ottawa's was 10:00 of team PP against 2:54 at most on NHL.com. So a unit the skater's NHL.com PP time
 * contradicts prints as unknown. No unit is ever inferred from time, and an unknown time contradicts nothing.
 */
export const PP_OFF_MAX_SECONDS = 60, PP_ON_MIN_SECONDS = 30;
export function ppContradicted(pp: RoleSlot["pp"], ppToiSeconds: number | null) {
  if (ppToiSeconds === null || pp === "unknown") return false;
  return pp === "off" ? ppToiSeconds > PP_OFF_MAX_SECONDS : ppToiSeconds < PP_ON_MIN_SECONDS;
}

export type StandoutSkater = {
  playerId: number; name: string | null; position: string | null; group: "F" | "D" | null; team: string | null; opponent: string | null;
  ownership: OwnershipState; role: RoleSlot;
  /** The source's unit was dropped because this skater's NHL.com PP time contradicts it. */
  ppConflict: boolean;
  /** Null when `role.line` is from last night's game; otherwise the date of the earlier game it comes from. */
  lineAsOf: string | null;
  goalLine: string; points: number | null; priorGames: number; stats: StandoutStat[];
};
/**
 * A goalie's chip. Direction sets the colour: more is better, less is better, or workload with no good or bad. SV%, GAA and
 * GSAx change in their own units, because a percent of a rate misleads; the rest change in %.
 */
export type GoalieStatId = "saves" | "shotsAgainst" | "goalsAgainst" | "savePct" | "gaa" | "gsax";
export type GoalieDirection = "higher" | "lower" | "neutral";
export type GoalieStat = { id: GoalieStatId; label: string; direction: GoalieDirection; last: number | null; baseline: number | null; change: number | null };
const GOALIE_RATES: readonly GoalieStatId[] = ["savePct", "gaa", "gsax"];
const hundredths = (value: number) => Math.round(value * 100) / 100;
const signedDecimal = (value: number, digits: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(digits)}`;
const savePctText = (value: number) => value.toFixed(3).replace(/^0/, "");
function goalieNumber(id: GoalieStatId, value: number | null, std: boolean) {
  if (value === null) return "—";
  switch (id) {
    case "savePct": return savePctText(value);
    case "gaa": return value.toFixed(2);
    case "gsax": return signedDecimal(value, 2);
    default: return std ? value.toFixed(1) : String(value);
  }
}
export const goalieLastText = (stat: GoalieStat) => goalieNumber(stat.id, stat.last, false);
export const goalieStdText = (stat: GoalieStat) => goalieNumber(stat.id, stat.baseline, true);
/** SV% in points of save percentage (+.012), GAA and GSAx in goals (+0.85), the rest in %. */
export function goalieChangeText(stat: GoalieStat) {
  if (stat.change === null) return "—";
  if (stat.id === "savePct") return `${stat.change > 0 ? "+" : stat.change < 0 ? "−" : ""}${savePctText(Math.abs(stat.change))}`;
  return GOALIE_RATES.includes(stat.id) ? signedDecimal(stat.change, 2) : percentLabel(stat.change);
}
export function goalieTone(stat: GoalieStat): "good" | "bad" | "neutral" {
  const shown = stat.change === null ? 0 : GOALIE_RATES.includes(stat.id) ? stat.change : Math.round(stat.change);
  if (stat.direction === "neutral" || shown === 0) return "neutral";
  return (shown > 0) === (stat.direction === "higher") ? "good" : "bad";
}
/** Last night against the goalie's appearances before it. NHL.com windows must be complete, and NST's must meet the post's coverage. */
function goalieStats(row: GoalieAppearance, gsax: number | null, prior: readonly GoalieAppearance[], priorGsax: readonly (number | null)[], settings: Pick<LastNightsStandoutsSettings, "minCoverage" | "minPriorGp">): GoalieStat[] {
  const enough = prior.length >= settings.minPriorGp, total = (read: (game: GoalieAppearance) => number | null) => {
    const values = prior.map(read);
    return enough && values.every(value => value !== null) ? (values as number[]).reduce((sum, value) => sum + value, 0) : null;
  };
  const saves = total(game => game.saves), shots = total(game => game.shotsAgainst), goals = total(game => game.goalsAgainst), seconds = total(game => game.toiSeconds);
  const perGame = (sum: number | null) => sum === null ? null : sum / prior.length;
  const knownGsax = priorGsax.filter((value): value is number => value !== null);
  const baselineGsax = enough && coverageAdmits(knownGsax.length, prior.length, settings.minCoverage) ? knownGsax.reduce((sum, value) => sum + value, 0) / knownGsax.length : null;
  const percent = (id: GoalieStatId, label: string, direction: GoalieDirection, last: number | null, baseline: number | null): GoalieStat => ({ id, label, direction, last, baseline, change: percentChange(last, baseline) });
  const units = (id: GoalieStatId, label: string, direction: GoalieDirection, last: number | null, baseline: number | null, digits: number): GoalieStat => ({ id, label, direction, last, baseline, change: last === null || baseline === null ? null : Math.round((last - baseline) * 10 ** digits) / 10 ** digits });
  return [
    percent("saves", "SV", "higher", row.saves, perGame(saves)),
    percent("shotsAgainst", "SA", "neutral", row.shotsAgainst, perGame(shots)),
    percent("goalsAgainst", "GA", "lower", row.goalsAgainst, perGame(goals)),
    units("savePct", "SV%", "higher", pooledSavePct(row.saves, row.shotsAgainst), pooledSavePct(saves, shots), 3),
    units("gaa", "GAA", "lower", pooledGaa(row.goalsAgainst, row.toiSeconds), pooledGaa(goals, seconds), 2),
    units("gsax", "GSAx", "higher", gsax, baselineGsax, 2),
  ];
}
export type StandoutGoalie = {
  goalieId: number; name: string | null; team: string; opponent: string | null; started: boolean | null; ownership: OwnershipState;
  saves: number | null; shotsAgainst: number | null; goalsAgainst: number | null; savePct: number | null; toiSeconds: number | null;
  /** NST's xG against less its goals against, for this game. Null until NST has this goalie's row. */
  gsax: number | null;
  priorGames: number; stats: GoalieStat[];
};
export type LastNightsStandoutsData = {
  applied: string; view: StandoutView; slate: string; games: number;
  skaters: StandoutSkater[]; goalies: StandoutGoalie[];
};

export const parsePicks = (picks: string) => [...new Set(picks.split(",").map(text => text.trim()).filter(text => /^\d+$/.test(text)).map(Number))];
/** Adds at the end or removes in place. A pick past the card's limit is refused. */
export function togglePick(picks: string, playerId: number) {
  const current = parsePicks(picks);
  if (current.includes(playerId)) return current.filter(id => id !== playerId).join(",");
  return current.length >= STANDOUT_MAX_ROWS ? current.join(",") : [...current, playerId].join(",");
}

/** Who a view can show. "Under X%" is strict, and an unknown rostered % cannot prove it is under. */
export function standoutPool(data: Pick<LastNightsStandoutsData, "skaters">, settings: Pick<LastNightsStandoutsSettings, "view" | "rosterMax">) {
  switch (settings.view) {
    case "under": return data.skaters.filter(row => row.ownership.state === "known" && row.ownership.pct < settings.rosterMax);
    case "forwards": return data.skaters.filter(row => row.group === "F");
    case "defensemen": return data.skaters.filter(row => row.group === "D");
    case "all": return data.skaters;
    case "goalies": return [];
  }
}
const statOf = (row: StandoutSkater, id: StandoutStatId) => row.stats.find(stat => stat.id === id)!;
const sortValue = (row: StandoutSkater, key: StandoutSortKey, mode: StandoutSortMode) => mode === "average" ? averageChange(row.stats) : key === "points" ? (mode === "value" ? row.points : null) : mode === "value" ? statOf(row, key).last : statOf(row, key).change;
const highFirst = (a: number | null, b: number | null) => a === b ? 0 : a === null ? 1 : b === null ? -1 : b - a;
/** Largest first with missing values last, then points, SOG, xG and TOI, so a tie never depends on read order. */
export function sortStandouts(rows: readonly StandoutSkater[], key: StandoutSortKey, mode: StandoutSortMode) {
  return [...rows].sort((a, b) => highFirst(sortValue(a, key, mode), sortValue(b, key, mode)) || highFirst(a.points, b.points) || highFirst(statOf(a, "sog").last, statOf(b, "sog").last) || highFirst(statOf(a, "xg").last, statOf(b, "xg").last) || highFirst(statOf(a, "toi").last, statOf(b, "toi").last) || a.playerId - b.playerId);
}
/** The card's skaters: picks in pick order, dropping any that no longer meet the view, or the top of an auto-ranked view. */
export function standoutRows(data: LastNightsStandoutsData, settings: LastNightsStandoutsSettings) {
  const pool = standoutPool(data, settings);
  if (!isHandBuilt(settings.view)) return sortStandouts(pool, settings.rankBy, "value").slice(0, STANDOUT_MAX_ROWS);
  const byId = new Map(pool.map(row => [row.playerId, row]));
  return parsePicks(settings.picks).flatMap(id => byId.get(id) ?? []).slice(0, STANDOUT_MAX_ROWS);
}
/**
 * Ranked by GSAx among goalies who faced enough shots to mean something, then SV%, then saves. An unknown GSAx is not a low
 * one: it has no rank, and those goalies only fill what the ranked goalies leave of the card, by SV%, then saves. `ranked`
 * and `withoutGsax` count every qualified goalie, shown or not.
 */
export function goalieRanking(data: Pick<LastNightsStandoutsData, "goalies">, settings: Pick<LastNightsStandoutsSettings, "minShotsAgainst">) {
  const qualified = data.goalies.filter(row => row.savePct !== null && row.shotsAgainst !== null && row.shotsAgainst >= settings.minShotsAgainst).sort((a, b) => highFirst(a.gsax, b.gsax) || highFirst(a.savePct, b.savePct) || highFirst(a.saves, b.saves) || a.goalieId - b.goalieId);
  const ranked = qualified.filter(row => row.gsax !== null).length;
  return { rows: qualified.slice(0, STANDOUT_GOALIE_ROWS), qualified: qualified.length, ranked, withoutGsax: qualified.length - ranked };
}
/** A shown goalie's rank: known GSAx sorts first, so it is the row's place; an unknown GSAx has none. */
export const goalieRank = (row: Pick<StandoutGoalie, "gsax">, index: number) => row.gsax === null ? null : index + 1;
/** What the card claims about its order. With no GSAx at all it claims no GSAx ranking, and the unranked goalies still export. */
export function goalieRankingText(ranking: ReturnType<typeof goalieRanking>, minShotsAgainst: number) {
  const shownRanked = ranking.rows.filter(row => row.gsax !== null).length, shownUnranked = ranking.rows.length - shownRanked;
  if (!ranking.ranked) return { lead: `GSAx isn't available for this slate, so these ${ranking.rows.length} of ${ranking.qualified} goalies with ${minShotsAgainst}+ shots against are unranked, by SV%, then saves.`, note: null };
  return { lead: `Top ${shownRanked} of ${ranking.ranked} by GSAx, with ${minShotsAgainst}+ shots against.`, note: ranking.withoutGsax ? `${ranking.withoutGsax} of ${ranking.qualified} qualified goalies have no GSAx yet, so no rank${shownUnranked ? `; ${shownUnranked} shown last` : "; none shown"}.` : null };
}

const FIELDS: readonly ShareSettingField[] = [
  { id: "view", label: "View", kind: "select", default: "under", options: [{ value: "under", label: "Under X% rostered (by hand)" }, { value: "all", label: "No roster limit (by hand)" }, { value: "goalies", label: "Goalies" }, { value: "forwards", label: "Top forwards" }, { value: "defensemen", label: "Top defensemen" }] },
  { id: "rosterMax", label: "Under X% rostered", kind: "number", default: 50, min: 1, max: 100, step: 1, clientOnly: true },
  { id: "rankBy", label: "Rank forwards and defensemen by", kind: "select", default: "points", options: STANDOUT_SORT_OPTIONS, clientOnly: true },
  { id: "minShotsAgainst", label: "Min shots against (goalies)", kind: "number", default: 15, min: 0, max: 60, step: 1, clientOnly: true },
  { id: "minPriorGp", label: "Min prior GP for a % change", kind: "number", default: 3, min: 1, max: 82, step: 1 },
  { id: "minCoverage", label: "Min NST coverage %", kind: "number", default: 90, min: 50, max: 100, step: 1 },
  { id: "picks", label: "Picks", kind: "text", default: "", maxLength: 80, clientOnly: true, panelOnly: true },
];
const SERVER_FIELDS = FIELDS.filter(field => !field.clientOnly);
export const standoutsCurrent = (data: LastNightsStandoutsData, settings: LastNightsStandoutsSettings) => data.applied === shareSettingsKey(SERVER_FIELDS, settings);
export const viewTitle = (settings: Pick<LastNightsStandoutsSettings, "view" | "rosterMax">) => ({ under: `Under ${settings.rosterMax}% rostered`, all: "No roster limit", goalies: "Goalies", forwards: "Top forwards", defensemen: "Top defensemen" })[settings.view];
export const sortLabel = (key: StandoutSortKey) => STANDOUT_SORT_OPTIONS.find(option => option.value === key)!.label;
/** How an auto-ranked view orders its players, each key once. */
export const rankingText = (key: StandoutSortKey) => {
  const [first, ...rest] = [key, "points", "sog", "xg", "toi"].filter((entry, index, keys) => keys.indexOf(entry) === index).map(entry => sortLabel(entry as StandoutSortKey));
  return `${first === "Points" ? "points" : first}, then ${rest.map(entry => entry === "Points" ? "points" : entry).join(", ")}`;
};

type TeamGame = { gameId: number; team: string | null };
/** Counted per team game: a game with rows from only one team is half covered. Anything short is partial, so it cannot export. */
export function slateCoverage(input: { playerTeamGames: readonly TeamGame[]; completedTeamGames: readonly TeamGame[]; scheduledGameIds: readonly number[] }) {
  const key = (game: TeamGame) => `${game.gameId}:${game.team}`, scheduled = new Set(input.scheduledGameIds), withPlayers = new Set(input.playerTeamGames.map(key));
  const completed = input.completedTeamGames.filter(game => scheduled.has(game.gameId)), covered = completed.filter(game => withPlayers.has(key(game)));
  const expected = scheduled.size * 2, observed = covered.length, unreported = Math.max(0, expected - completed.length), noPlayerRows = completed.length - covered.length;
  return { observed, expected, missing: Math.max(0, expected - observed), reasons: [...(unreported ? [`${unreported} of ${expected} scheduled team games on this slate have no reported result.`] : []), ...(noPlayerRows ? [`${noPlayerRows} completed team games on this slate have no player rows.`] : [])] };
}

/**
 * Last night's lines from the game's own Gamecenter row, which the rolling writer also reads: forwards in threes and
 * defensemen in pairs, in order. It matched rolling on all 1,764 rows of 2026-10-24 to 10-30 and is there before rolling is.
 */
export const LINE_COMBO_COLUMNS = ["gameId", "forwards", "defensemen"] as const;
export type LineComboRow = { gameId: number; forwards: number[] | null; defensemen: number[] | null };
export function lineRowsFromCombinations(rows: readonly LineComboRow[]): RoleRollingRow[] {
  const slots = (row: LineComboRow, ids: number[] | null, size: number, group: string) => (ids ?? []).map((id, index) => ({ player_id: id, game_id: row.gameId, line_combo_slot: Math.floor(index / size) + 1, line_combo_group: group }));
  return rows.flatMap(row => [...slots(row, row.forwards, 3, "forward"), ...slots(row, row.defensemen, 2, "defense")]);
}
export type EarlierLineRow = { player_id: number; game_date: string; line_combo_slot: number | null; line_combo_group: string | null };
/** The newest known line for each player, from before the slate. Never a guess: no earlier line stays unknown. */
export function latestEarlierLines(rows: readonly EarlierLineRow[], slate: string) {
  const latest = new Map<number, { line: string; date: string }>();
  for (const row of rows) {
    const line = normalizeEvDeploymentBucket({ lineComboGroup: row.line_combo_group, lineComboSlot: row.line_combo_slot });
    if (line && row.game_date < slate && row.game_date > (latest.get(row.player_id)?.date ?? "")) latest.set(row.player_id, { line, date: row.game_date });
  }
  return latest;
}

const STRENGTH = "All situations; PP TOI on the power play; xG% on ice (NST)";
export type LastNightsStandoutsInput = {
  slate: string; season: number; settings: LastNightsStandoutsSettings; completedTeamGames: readonly TeamGame[]; scheduledGameIds: readonly number[];
  ownership: { byPlayer: ReadonlyMap<number, OwnershipState>; updatedAt: string | null };
  /** Skater views: every game this season of everyone on the slate, the slate included. */
  appearances?: readonly SkaterAppearance[]; nstCounts?: readonly NstCountRow[]; nstOnIce?: readonly NstOnIceRow[]; role?: RoleEvidence;
  /** Rolling rows for players with no line in last night's game. */
  earlierLines?: readonly EarlierLineRow[];
  /** Goalie view: every appearance this season of the goalies on the slate, the slate included, and their NST rows. */
  goalies?: readonly GoalieAppearance[]; nstGoalies?: readonly NstGsaxRow[];
};
const yahooSource = (input: LastNightsStandoutsInput, known: number, total: number): SharePostSource => ({ name: "Yahoo rostered %", tables: ["yahoo_players", "yahoo_nhl_player_map_read"], state: known < total ? "partial" : "ready", asOf: input.ownership.updatedAt?.slice(0, 10) ?? null, updatedAt: null, reasons: known < total ? [`${total - known} of ${total} have no rostered %.`] : [] });

function buildGoalieView(input: LastNightsStandoutsInput, applied: string): SharePostLoadResult<LastNightsStandoutsData> {
  const { slate, settings } = input, season = input.goalies ?? [], appearances = season.filter(row => row.date === slate);
  const nstGames = toNstGoalieGames(input.nstGoalies ?? [], { season: input.season, through: slate }), gsaxByGame = new Map(nstGames.map(game => [`${game.goalieId}:${game.date}`, game.xgAgainst !== null && game.goalsAgainst !== null ? game.xgAgainst - game.goalsAgainst : null]));
  const goalies = appearances.map((row): StandoutGoalie => {
    const prior = season.filter(game => game.goalieId === row.goalieId && game.date < slate), gsax = gsaxByGame.get(`${row.goalieId}:${slate}`) ?? null;
    return { goalieId: row.goalieId, name: row.name, team: row.team, opponent: row.opponent, started: row.started, ownership: input.ownership.byPlayer.get(row.goalieId) ?? ownershipOf(null), saves: row.saves, shotsAgainst: row.shotsAgainst, goalsAgainst: row.goalsAgainst, savePct: pooledSavePct(row.saves, row.shotsAgainst), toiSeconds: row.toiSeconds, gsax: gsax === null ? null : hundredths(gsax), priorGames: prior.length,
      stats: goalieStats(row, gsax, prior, prior.map(game => gsaxByGame.get(`${game.goalieId}:${game.date}`) ?? null), settings) };
  });
  const coverage = slateCoverage({ playerTeamGames: appearances, completedTeamGames: input.completedTeamGames, scheduledGameIds: input.scheduledGameIds });
  const wgoGaps = appearances.filter(row => row.saves === null || row.shotsAgainst === null || row.goalsAgainst === null || row.toiSeconds === null).length;
  const reasons = [...coverage.reasons, ...(wgoGaps ? [`${wgoGaps} goalies on this slate have a missing NHL.com stat.`] : [])];
  const withGsax = goalies.filter(row => row.gsax !== null).length, knownOwned = goalies.filter(row => row.ownership.state === "known").length;
  const sources: SharePostSource[] = [
    { name: "NHL.com", tables: ["wgo_goalie_stats", "wgo_team_stats", "games"], state: reasons.length ? "partial" : "ready", asOf: slate, updatedAt: null },
    { name: "Natural Stat Trick", tables: ["nst_gamelog_goalie_all_counts"], state: withGsax < goalies.length ? "partial" : "ready", asOf: withGsax ? slate : null, updatedAt: null, reasons: withGsax < goalies.length ? [`NST has no GSAx yet for ${goalies.length - withGsax} of ${goalies.length} goalies on this slate.`] : [] },
    yahooSource(input, knownOwned, goalies.length),
  ];
  return {
    state: reasons.length ? "partial" : "ready", reasons,
    data: { applied, view: settings.view, slate, games: input.scheduledGameIds.length, skaters: [], goalies },
    teams: [...new Set(goalies.map(row => row.team))].sort(),
    evidence: { sources, sample: `Slate of ${slate}, ${input.scheduledGameIds.length} games. STD is each goalie's appearances before that slate, last night excluded, with ${settings.minPriorGp}+ prior GP: per appearance, with SV% and GAA pooled. SV% changes in points of save percentage, GAA and GSAx in goals, the rest in %. GSAx is NST xG against less NST goals against; it prints — until NST has that goalie's row`, strength: "All situations", cohort: `${goalies.length} goalies on the slate, ${withGsax} with NST GSAx`, coverage: { observed: coverage.observed, expected: coverage.expected, missing: coverage.missing, unit: "team games" } },
  };
}

function buildSkaterViews(input: LastNightsStandoutsInput, applied: string): SharePostLoadResult<LastNightsStandoutsData> {
  const { slate, settings } = input, appearances = input.appearances ?? [], role = roleSlotReader(input.role ?? { rolling: [], pp: [] });
  const earlier = latestEarlierLines(input.earlierLines ?? [], slate);
  const counts = joinNst(appearances, input.nstCounts ?? []), onIce = joinNst(appearances, input.nstOnIce ?? []);
  const skaters = [...appearancesByPlayer(appearances)].flatMap(([playerId, games]): StandoutSkater[] => {
    const joined = games.map((game): JoinedGame => ({ ...game, nst: counts(game), onIce: onIce(game) }));
    const last = joined.find(game => game.date === slate);
    if (!last) return [];
    // Last night is never in its own baseline.
    const prior = joined.filter(game => game.date < slate), slot = role(playerId, last.gameId), fallback = slot.line === "unknown" ? earlier.get(playerId) : undefined, ppConflict = ppContradicted(slot.pp, last.ppToiSeconds);
    return [{ playerId, name: last.name, position: last.position, group: last.group, team: last.team, opponent: last.opponent, ownership: input.ownership.byPlayer.get(playerId) ?? ownershipOf(null), role: { line: fallback?.line ?? slot.line, pp: ppConflict ? "unknown" : slot.pp }, ppConflict, lineAsOf: fallback?.date ?? null, goalLine: goalLine(last), points: last.points, priorGames: prior.length,
      stats: STAT_METRICS.map(stat => {
        const metric = metricOf(stat.metric), value = gameValue(metric, last), baseline = baselineOf(metric, prior, settings);
        return { id: stat.id, label: stat.label, last: value, baseline, change: percentChange(value, baseline) };
      }) }];
  });
  const slateGames = appearances.filter(game => game.date === slate);
  const coverage = slateCoverage({ playerTeamGames: slateGames, completedTeamGames: input.completedTeamGames, scheduledGameIds: input.scheduledGameIds });
  const wgoGaps = slateGames.filter(game => [game.goals, game.assists, game.points, game.shots, game.toiSeconds, game.ppToiSeconds].some(value => value === null)).length;
  const reasons = [...coverage.reasons, ...(wgoGaps ? [`${wgoGaps} skaters on this slate have a missing NHL.com stat.`] : [])];
  const nstGaps = skaters.filter(row => (["icf", "iscf", "xg", "xgPct"] as const).some(id => statOf(row, id).last === null)).length;
  const unknownLines = skaters.filter(row => row.role.line === "unknown").length, unknownPp = skaters.filter(row => row.role.pp === "unknown").length, olderLines = skaters.filter(row => row.lineAsOf !== null).length, ppConflicts = skaters.filter(row => row.ppConflict).length;
  const knownOwned = skaters.filter(row => row.ownership.state === "known").length;
  const sources: SharePostSource[] = [
    { name: "NHL.com", tables: ["wgo_skater_stats", "wgo_team_stats", "games"], state: reasons.length ? "partial" : "ready", asOf: slate, updatedAt: null },
    { name: "Natural Stat Trick", tables: ["nst_gamelog_as_counts", "nst_gamelog_as_counts_oi"], state: nstGaps ? "partial" : "ready", asOf: nstGaps === skaters.length ? null : slate, updatedAt: null, reasons: nstGaps ? [`${nstGaps} of ${skaters.length} skaters have a missing NST value on this slate.`] : [] },
    { name: "FHFH lines and PP units", tables: ["lineCombinations", ...(olderLines ? ["rolling_player_game_metrics"] : []), "powerPlayCombinations"], state: unknownLines || unknownPp || olderLines ? "partial" : "ready", asOf: slate, updatedAt: null, reasons: [...(unknownLines ? [`${unknownLines} of ${skaters.length} skaters have no known line.`] : []), ...(olderLines ? [`${olderLines} of ${skaters.length} lines are from an earlier game, and the chip prints its date.`] : []), ...(unknownPp ? [`${unknownPp} of ${skaters.length} PP chips are unknown: ${ppConflicts} because NHL.com PP time contradicts the unit, ${unknownPp - ppConflicts} with no rows for the game.`] : [])] },
    yahooSource(input, knownOwned, skaters.length),
  ];
  return {
    state: reasons.length ? "partial" : "ready", reasons,
    data: { applied, view: settings.view, slate, games: input.scheduledGameIds.length, skaters, goalies: [] },
    teams: [...new Set(skaters.flatMap(row => row.team ? [row.team] : []))].sort(),
    evidence: { sources, sample: `Slate of ${slate}, ${input.scheduledGameIds.length} games. Each % compares that game with the skater's own season per game before it, last night excluded, with ${settings.minPriorGp}+ prior GP; xG% is pooled. A zero or missing baseline prints —. PP units are ranked from shift data; PP — means no rows, or NHL.com PP time contradicts the unit${isHandBuilt(settings.view) ? ". Skaters on this card are chosen by hand" : ""}`, strength: STRENGTH, cohort: `${skaters.length} skaters on the slate: ${skaters.filter(row => row.group === "F").length} F, ${skaters.filter(row => row.group === "D").length} D`, coverage: { observed: coverage.observed, expected: coverage.expected, missing: coverage.missing, unit: "team games" } },
  };
}
export function buildLastNightsStandouts(input: LastNightsStandoutsInput): SharePostLoadResult<LastNightsStandoutsData> {
  const applied = shareSettingsKey(SERVER_FIELDS, input.settings);
  return isGoalieView(input.settings.view) ? buildGoalieView(input, applied) : buildSkaterViews(input, applied);
}

const altSkater = (row: StandoutSkater) => `${row.name ?? `Player ${row.playerId}`} ${row.goalLine}, ${lineChipText(row)}, ${ppChipText(row.role)}: ${row.stats.map(stat => `${stat.label} ${statText(stat)}, STD ${stdText(stat)}, ${percentLabel(stat.change)}`).join(", ")}`;
const altGoalie = (row: StandoutGoalie, index: number) => `${goalieRank(row, index) ?? "Unranked"}. ${row.name ?? `Goalie ${row.goalieId}`}: ${row.stats.map(stat => `${stat.label} ${goalieLastText(stat)}, STD ${goalieStdText(stat)}, change ${goalieChangeText(stat)}`).join("; ")}; TOI ${formatSeconds(row.toiSeconds)}`;
export const lastNightsStandoutsModule = defineShareModule<LastNightsStandoutsSettings, LastNightsStandoutsData>({
  id: "last-nights-standouts", title: "Last Nights Standouts", summary: "Observed results from the latest completed slate, each against that player's own season per game before it. Two views are built by hand.", group: "skaters", basis: "observed",
  kicker: settings => isGoalieView(settings.view) ? "Goalies" : "Skaters",
  suggestedUse: "Fits any day after a slate.",
  fields: FIELDS,
  load: () => import("./lastNightsStandouts.sources").then(sources => sources.loadLastNightsStandouts),
  card: () => import("components/SocialShare/modules/LastNightsStandoutsCard").then(card => card.default),
  panel: () => import("components/SocialShare/modules/LastNightsStandoutsPanel").then(panel => panel.default),
  hasRows: (data, settings) => standoutsCurrent(data, settings) && (isGoalieView(settings.view) ? goalieRanking(data, settings).rows.length : standoutRows(data, settings).length) > 0,
  altText: (snapshot, data, settings) => {
    const goalies = isGoalieView(settings.view) ? goalieRanking(data, settings) : null, order = goalies ? goalieRankingText(goalies, settings.minShotsAgainst) : null;
    const rows = goalies ? goalies.rows.map(altGoalie) : standoutRows(data, settings).map(altSkater);
    return `FHFH Last Nights Standouts, ${viewTitle(settings)}, ${data.slate}. ${order ? `${order.lead} ${order.note ?? ""} ` : ""}${rows.join("; ") || "No one on the card yet"}. ${snapshot.evidence.sample}. ${snapshot.evidence.cohort}.`;
  },
});
