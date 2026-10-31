import { currentSeason } from "lib/socialShare/schedule";
import { defineShareModule, type SharePostEvidence, type SharePostLoadResult, type SharePostSource } from "./contract";
import { competitionRanks, editionDate, lastN, per60 } from "./shared/definitions";
import type { CompletedTeamGame, GoalieAppearance } from "./shared/goalieLedger";

/** Busy and Quiet goalies (SS 10.0, SS-R12): how much work each goalie faced, kept apart from how well he played. */
export type GoalieWindowKey = "l5" | "l10" | "std";
export const GOALIE_WINDOW_OPTIONS = [{ value: "l5", label: "Last 5 appearances" }, { value: "l10", label: "Last 10 appearances" }, { value: "std", label: "Season to date" }] as const;
export type BusyQuietBasis = "start" | "appearance" | "per60";
export const BUSY_QUIET_BASIS_OPTIONS = [{ value: "start", label: "Per start" }, { value: "appearance", label: "Per appearance" }, { value: "per60", label: "Per 60" }] as const;
export const BASIS_LABELS: Record<BusyQuietBasis, string> = { start: "/GS", appearance: "/GP", per60: "/60" };
export type BusyQuietSettings = { basis: BusyQuietBasis; window: GoalieWindowKey; minStarts: number };

/** Fills the card's 860px body per side. Ties may run past the size; the hard cap keeps them from clipping, and the sample names any left out. */
export const BUSY_QUIET_LIST_SIZE = 11;
/** (845px body - 53 legend and side head) / 63px minimum row. */
const BUSY_QUIET_MAX_ROWS = 12;
/** CONTRACT §2 coverage admission: below this share of window games, an NST value is not shown. */
export const NST_MIN_COVERAGE = 0.9;
export const VOLUME_NOTE = "Workload only, not how well a goalie played.";
export const TEAM_CHANCES_NOTE = "TEAM columns are team totals per team game, including time another goalie was in net.";

/** One goalie's window. Appearances are oldest first, and the team shown is the team of the latest one. */
export type GoalieWindow = { goalieId: number; name: string | null; team: string; teams: string[]; rows: GoalieAppearance[]; requested: number | null; actual: number; short: boolean; firstDate: string; lastDate: string; starts: number; relief: number; unlabeled: number };
export function goalieWindows(appearances: readonly GoalieAppearance[], window: GoalieWindowKey): GoalieWindow[] {
  const byGoalie = new Map<number, GoalieAppearance[]>();
  for (const row of appearances) byGoalie.set(row.goalieId, [...(byGoalie.get(row.goalieId) ?? []), row]);
  return [...byGoalie.entries()].map(([goalieId, all]) => {
    const picked = window === "std" ? { rows: all, requested: null, actual: all.length, short: false } : lastN(all, window === "l5" ? 5 : 10);
    const rows = picked.rows, last = rows[rows.length - 1];
    return { goalieId, name: [...rows].reverse().find(row => row.name)?.name ?? null, team: last.team, teams: [...new Set(rows.map(row => row.team))], rows, requested: picked.requested, actual: picked.actual, short: picked.short, firstDate: rows[0].date, lastDate: last.date,
      starts: rows.filter(row => row.started === true).length, relief: rows.filter(row => row.started === false).length, unlabeled: rows.filter(row => row.started === null).length };
  });
}
export const windowLabel = (window: GoalieWindowKey) => GOALIE_WINDOW_OPTIONS.find(option => option.value === window)!.label;
/** Season to date through yesterday in New York: today's games may not be final. */
export function goalieLedgerScope(generatedAt: string) {
  const today = editionDate(generatedAt), through = new Date(Date.parse(`${today}T00:00:00Z`) - 86400000).toISOString().slice(0, 10), season = currentSeason(through);
  return { today, through, season, from: `${String(season).slice(0, 4)}-08-01` };
}
/**
 * WGO windows must be complete (CONTRACT §2): from the oldest window date on, every scheduled game has both team rows
 * and every team game has exactly one labeled starter. Older games no window reads cannot block the post.
 */
export function ledgerCoverage(input: { scheduledDates: readonly string[]; teamGames: readonly CompletedTeamGame[]; appearances: readonly GoalieAppearance[]; since: string | null }) {
  const since = input.since ?? "";
  const expected = input.scheduledDates.filter(date => date >= since).length * 2, games = input.teamGames.filter(game => game.date >= since);
  const starters = new Map<string, number>(), unlabeled = new Set<string>();
  for (const row of input.appearances) {
    const key = `${row.team}:${row.gameId}`;
    if (row.started === null) unlabeled.add(key);
    if (row.started) starters.set(key, (starters.get(key) ?? 0) + 1);
  }
  const resolved = games.filter(game => { const key = `${game.team}:${game.gameId}`; return !unlabeled.has(key) && starters.get(key) === 1; }).length;
  const missing = Math.max(0, expected - resolved), reasons: string[] = [];
  if (games.length < expected) reasons.push(`${expected - games.length} of ${expected} scheduled team games have no reported result.`);
  if (resolved < games.length) reasons.push(`${games.length - resolved} of ${games.length} team games lack exactly one labeled starter.`);
  return { coverage: { observed: resolved, expected, missing, unit: "team games with one labeled starter" }, reasons, complete: reasons.length === 0 };
}

/** NST goalie rows are keyed by goalie and date. Their `toi` is minutes (and a string in the API), unlike WGO's seconds. */
export type NstGoalieRow = { player_id: number; date_scraped: string; toi: number | string | null; hd_shots_against: number | null; md_shots_against: number | null; ld_shots_against: number | null };
export type NstTeamRow = { team_abbreviation: string; date: string; sca: number | null; hdca: number | null };
export const NST_GOALIE_COLUMNS = "player_id,date_scraped,toi,hd_shots_against,md_shots_against,ld_shots_against";
export const NST_TEAM_COLUMNS = "team_abbreviation,date,sca,hdca";
export const nstToiSeconds = (toi: number | string | null | undefined) => {
  const minutes = toi === null || toi === undefined || toi === "" ? NaN : Number(toi);
  return Number.isFinite(minutes) && minutes >= 0 ? minutes * 60 : null;
};

/** A volume with the counts behind it, so a rate never travels without its denominator. */
export type BasisVolume = { value: number | null; shots: number; denominator: number; unit: string; missing: number };
const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);
const basisRows = (rows: readonly GoalieAppearance[], basis: BusyQuietBasis) => basis === "start" ? rows.filter(row => row.started === true) : [...rows];
/** Per start reads official starts only, so relief shots stay out of it. Per appearance and per 60 read every appearance. */
export function shotsOnBasis(rows: readonly GoalieAppearance[], basis: BusyQuietBasis): BasisVolume {
  const pool = basisRows(rows, basis), known = pool.filter(row => row.shotsAgainst !== null && (basis !== "per60" || row.toiSeconds !== null));
  const shots = sum(known.map(row => row.shotsAgainst!)), missing = pool.length - known.length;
  if (basis === "per60") { const seconds = sum(known.map(row => row.toiSeconds!)); return { value: per60(shots, seconds), shots, denominator: seconds, unit: "seconds", missing }; }
  return { value: known.length ? shots / known.length : null, shots, denominator: known.length, unit: basis === "start" ? "starts" : "appearances", missing };
}

/** Shots by danger zone are shots, not chances. No goalie-level chances source exists (SOURCES fact 2). */
export type DangerZoneShots = { hd: number | null; md: number | null; ld: number | null; covered: number; expected: number; missing: number; admitted: boolean };
export function dangerZoneShots(rows: readonly GoalieAppearance[], basis: BusyQuietBasis, nst: ReadonlyMap<string, NstGoalieRow> | null): DangerZoneShots {
  const pool = basisRows(rows, basis);
  const covered = nst === null ? [] : pool.flatMap(row => {
    const match = nst.get(`${row.goalieId}:${row.date}`);
    if (!match || match.hd_shots_against === null || match.md_shots_against === null || match.ld_shots_against === null) return [];
    const seconds = nstToiSeconds(match.toi);
    return basis === "per60" && seconds === null ? [] : [{ hd: match.hd_shots_against, md: match.md_shots_against, ld: match.ld_shots_against, seconds: seconds ?? 0 }];
  });
  const expected = pool.length, admitted = expected > 0 && covered.length / expected >= NST_MIN_COVERAGE;
  const rate = (total: number) => !admitted ? null : basis === "per60" ? per60(total, sum(covered.map(row => row.seconds))) : total / covered.length;
  return { hd: rate(sum(covered.map(row => row.hd))), md: rate(sum(covered.map(row => row.md))), ld: rate(sum(covered.map(row => row.ld))), covered: covered.length, expected, missing: expected - covered.length, admitted };
}

/** Team-level, per team game, and never switched by basis: these are the team's chances, not this goalie's. */
export type TeamChances = { sca: number | null; hdca: number | null; covered: number; expected: number; missing: number; admitted: boolean; sharedNetGames: number };
export function teamChances(rows: readonly GoalieAppearance[], all: readonly GoalieAppearance[], nst: ReadonlyMap<string, NstTeamRow> | null): TeamChances {
  const covered = nst === null ? [] : rows.flatMap(row => { const match = nst.get(`${row.team}:${row.date}`); return match && match.sca !== null && match.hdca !== null ? [{ sca: match.sca, hdca: match.hdca }] : []; });
  const expected = rows.length, admitted = expected > 0 && covered.length / expected >= NST_MIN_COVERAGE;
  const sharedNetGames = rows.filter(row => all.some(other => other.gameId === row.gameId && other.team === row.team && other.goalieId !== row.goalieId)).length;
  return { sca: admitted ? sum(covered.map(row => row.sca)) / covered.length : null, hdca: admitted ? sum(covered.map(row => row.hdca)) / covered.length : null, covered: covered.length, expected, missing: expected - covered.length, admitted, sharedNetGames };
}

/** One appearance on the sparkline. Null shots are a gap, never 0, and relief stays marked. */
export type ShotPoint = { gameId: number; date: string; shots: number | null; relief: boolean };
export type BusyQuietRow = {
  goalieId: number; name: string | null; team: string; rank: number;
  appearances: number; requested: number | null; short: boolean; starts: number; relief: number; unlabeled: number;
  /** Every shot in the window, and the part of it faced in relief. */
  totalShots: number | null; reliefShots: number | null; series: ShotPoint[]; volume: BasisVolume; danger: DangerZoneShots; teamChances: TeamChances;
};
export type BusyQuietData = { basis: BusyQuietBasis; window: GoalieWindowKey; through: string; busy: BusyQuietRow[]; quiet: BusyQuietRow[]; eligible: number; appeared: number; unranked: number; dangerUnadmitted: number; teamChancesUnadmitted: number };

const knownSum = (values: readonly (number | null)[]) => values.some(value => value === null) ? null : sum(values as number[]);
export function buildBusyQuiet(input: {
  settings: BusyQuietSettings; appearances: readonly GoalieAppearance[]; teamGames: readonly CompletedTeamGame[]; scheduledDates: readonly string[];
  /** Null means that read failed: shots still stand, and these columns say unknown. */
  nstGoalie: readonly NstGoalieRow[] | null; nstTeam: readonly NstTeamRow[] | null; through: string;
}): SharePostLoadResult<BusyQuietData> {
  const { settings, appearances } = input;
  const windows = goalieWindows(appearances, settings.window), eligible = windows.filter(window => window.starts >= settings.minStarts);
  const since = eligible.reduce<string | null>((oldest, window) => !oldest || window.firstDate < oldest ? window.firstDate : oldest, null);
  const ledger = ledgerCoverage({ scheduledDates: input.scheduledDates, teamGames: input.teamGames, appearances, since });
  const nstGoalie = input.nstGoalie && new Map(input.nstGoalie.map(row => [`${row.player_id}:${row.date_scraped}`, row]));
  const nstTeam = input.nstTeam && new Map(input.nstTeam.map(row => [`${row.team_abbreviation}:${row.date}`, row]));
  const built = eligible.map(window => ({
    goalieId: window.goalieId, name: window.name, team: window.team, appearances: window.actual, requested: window.requested, short: window.short, starts: window.starts, relief: window.relief, unlabeled: window.unlabeled,
    totalShots: knownSum(window.rows.map(row => row.shotsAgainst)), reliefShots: knownSum(window.rows.filter(row => row.started === false).map(row => row.shotsAgainst)),
    series: window.rows.map(row => ({ gameId: row.gameId, date: row.date, shots: row.shotsAgainst, relief: row.started === false })),
    volume: shotsOnBasis(window.rows, settings.basis), danger: dangerZoneShots(window.rows, settings.basis, nstGoalie), teamChances: teamChances(window.rows, appearances, nstTeam),
  }));
  const ranked = (direction: "high" | "low") => competitionRanks(built, row => row.volume.value, row => row.goalieId, direction).filter(entry => entry.rank <= BUSY_QUIET_LIST_SIZE).map(({ row, rank }): BusyQuietRow => ({ ...row, rank }));
  const allBusy = ranked("high"), busy = allBusy.slice(0, BUSY_QUIET_MAX_ROWS), shown = new Set(busy.map(row => row.goalieId));
  // A small pool would otherwise list the same goalie as both busy and quiet.
  const allQuiet = ranked("low").filter(row => !shown.has(row.goalieId)), quiet = allQuiet.slice(0, BUSY_QUIET_MAX_ROWS);
  const listed = new Set([...busy, ...quiet].map(row => row.goalieId));
  const tiedOut = new Set([...allBusy, ...allQuiet].map(row => row.goalieId).filter(id => !listed.has(id))).size, shared = [...busy, ...quiet].reduce((total, row) => total + row.teamChances.sharedNetGames, 0);
  const unranked = built.filter(row => row.volume.value === null).length, missingShots = built.reduce((total, row) => total + row.volume.missing, 0);
  const dangerUnadmitted = built.filter(row => !row.danger.admitted).length, teamChancesUnadmitted = built.filter(row => !row.teamChances.admitted).length;
  const reasons = [...ledger.reasons, ...(missingShots ? [`${missingShots} window appearances have no recorded shots against or time on ice.`] : [])];
  const complete = reasons.length === 0;
  const newest = (dates: readonly string[]) => dates.reduce<string | null>((latest, date) => !latest || date > latest ? date : latest, null);
  const nstSource = (name: string, table: string, rows: readonly unknown[] | null, asOf: string | null, unadmitted: number, what: string): SharePostSource => rows === null
    ? { name, tables: [table], state: "missing", asOf: null, updatedAt: null, reasons: [`${name} could not be read, so ${what} are unknown.`] }
    : { name, tables: [table], state: unadmitted ? "partial" : "ready", asOf, updatedAt: null, reasons: unadmitted ? [`${unadmitted} of ${built.length} goalies are below ${NST_MIN_COVERAGE * 100}% coverage, so their ${what} are not shown.`] : [] };
  const evidence: SharePostEvidence = {
    sources: [
      { name: "NHL.com goalie and team game stats", tables: ["wgo_goalie_stats", "wgo_team_stats", "games"], state: complete ? "ready" : "partial", asOf: newest(appearances.map(row => row.date)), updatedAt: null, reasons },
      nstSource("Natural Stat Trick goalie shots by danger zone", "nst_gamelog_goalie_all_counts", input.nstGoalie, newest((input.nstGoalie ?? []).map(row => row.date_scraped)), dangerUnadmitted, "danger-zone shots"),
      nstSource("Natural Stat Trick team chances against", "nst_team_gamelogs_as_counts", input.nstTeam, newest((input.nstTeam ?? []).map(row => row.date)), teamChancesUnadmitted, "team chances"),
    ],
    sample: `${windowLabel(settings.window)} through ${input.through}: ${built.reduce((total, row) => total + row.appearances, 0)} appearances, ${built.reduce((total, row) => total + row.starts, 0)} starts, ${built.reduce((total, row) => total + row.relief, 0)} relief. ${settings.basis === "start" ? "Per start reads official starts only; relief is counted apart. " : ""}HD SHOTS are shots from the high-danger zone, not chances, shown at ${NST_MIN_COVERAGE * 100}% coverage, otherwise as covered/expected games. ${TEAM_CHANCES_NOTE}${shared ? ` ${shared} listed ${shared === 1 ? "appearance" : "appearances"} shared the net.` : ""}${tiedOut ? ` ${tiedOut} more tied ${tiedOut === 1 ? "goalie is" : "goalies are"} not listed.` : ""}`,
    strength: "All situations",
    cohort: `${eligible.length} of ${windows.length} goalies with at least ${settings.minStarts} official starts in the window`,
    coverage: ledger.coverage,
  };
  return { state: complete ? "ready" : "partial", reasons, evidence, teams: [...new Set([...busy, ...quiet].map(row => row.team))],
    data: { basis: settings.basis, window: settings.window, through: input.through, busy, quiet, eligible: eligible.length, appeared: windows.length, unranked, dangerUnadmitted, teamChancesUnadmitted } };
}

export const formatVolume = (value: number | null) => value === null ? "—" : value.toFixed(1);
/** One shots-against scale for every line on the card, so a busier goalie's line sits higher. Null when no game has a value. */
export function shotScale(rows: readonly BusyQuietRow[]) {
  const known = rows.flatMap(row => row.series.flatMap(point => point.shots === null ? [] : [point.shots]));
  return known.length ? { low: Math.min(...known), high: Math.max(...known) } : null;
}
/** Share of the shown range, 0 to 1, for the tile's single-hue fill. More workload is a stronger fill, not a better goalie. */
export function workloadLevel(value: number | null, low: number, high: number) {
  if (value === null) return null;
  return high === low ? 0.5 : (value - low) / (high - low);
}
const altRow = (row: BusyQuietRow, basis: BusyQuietBasis) => `${row.rank}. ${row.name ?? `Goalie ${row.goalieId}`} (${row.team}): ${formatVolume(row.volume.value)} shots against ${BASIS_LABELS[basis]}, ${row.starts} starts, ${row.relief} relief, shots by game ${row.series.map(point => point.shots ?? "no data").join(", ")}`;

export const busyQuietModule = defineShareModule<BusyQuietSettings, BusyQuietData>({
  id: "busy-quiet-goalies", title: "Busy and Quiet Goalies", summary: "Shots faced, starts and relief, kept apart from how a goalie played.", group: "goalies", basis: "observed",
  suggestedUse: "Works for a Thursday or Friday post.",
  fields: [
    { id: "basis", label: "Basis", kind: "select", default: "start", options: BUSY_QUIET_BASIS_OPTIONS },
    { id: "window", label: "Window", kind: "select", default: "l10", options: GOALIE_WINDOW_OPTIONS },
    { id: "minStarts", label: "Min starts in window", kind: "number", default: 3, min: 1, max: 82, step: 1 },
  ],
  load: () => import("./busyQuiet.sources").then(sources => sources.loadBusyQuiet),
  card: () => import("components/SocialShare/modules/BusyQuietCard").then(card => card.default),
  hasRows: data => data.busy.length + data.quiet.length > 0,
  altText: (snapshot, data) => `FHFH busy and quiet goalies, ${windowLabel(data.window)} through ${data.through}. Busy: ${data.busy.map(row => altRow(row, data.basis)).join("; ")}. Quiet: ${data.quiet.map(row => altRow(row, data.basis)).join("; ")}. ${VOLUME_NOTE} ${snapshot.evidence.cohort}.`,
});
