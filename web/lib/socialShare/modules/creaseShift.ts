import { currentSeason } from "lib/socialShare/schedule";
import { luminance, withNeonFloor } from "lib/socialShare/teamNeon";
import { activeTeamAbbreviations, teamsInfo } from "lib/teamsInfo";
import { defineShareModule, type SharePostLoadResult } from "./contract";
import { competitionRanks, lastN } from "./shared/definitions";
import { completeThrough, completeThroughNote, countNights, teamGameDates, type NightCoverage } from "./shared/completeThrough";
import { editionCutoff } from "./shared/periodWindow";
import { teamStartShare, type CompletedTeamGame, type GoalieAppearance, type TeamStartShare } from "./shared/goalieLedger";

/**
 * Crease Shift (SS 8.0): official start share over a team's last N completed games, against a labeled comparison window.
 * The denominator is completed team games, so this is not the appearance share in GoalieShareChart's pie. Descriptive only.
 */
/** `teams` is up to `CREASE_SHIFT_SHOWN` picks, comma-joined; blank shows the top `CREASE_SHIFT_SHOWN` by shift. */
export type CreaseShiftSettings = { window: number; comparison: string; minComparisonGames: number; teams: string };
export type CreaseShiftGoalie = {
  goalieId: number; name: string | null; starts: number; relief: number;
  /** Null unless every game in the window has exactly one labeled starter. */
  share: number | null; comparisonStarts: number | null; comparisonRelief: number | null; comparisonShare: number | null;
  /** Share change in percentage points; null when either window is withheld. */
  change: number | null;
  /** Other teams this goalie appeared for this season. Each game binds to the team he played for. */
  otherTeams: string[];
  /** Running start share at each `CreaseShiftTeam.series` game: starts so far ÷ team games so far, ending at `share` when the window is complete. */
  runningShare: (number | null)[];
};
export type CreaseShiftTeam = {
  team: string; rank: number | null;
  /** Largest absolute goalie share change on the team, in percentage points. */
  shift: number | null;
  games: number; short: boolean; firstDate: string | null; lastDate: string | null;
  comparisonGames: number; comparisonShort: boolean;
  /** Games shared by both windows: the recent games when comparing with season to date, otherwise 0. */
  overlap: number;
  /** Fewer comparison games outside the recent window than the minimum: unranked, with no shift. */
  shortComparison: boolean;
  /** Goalies with at least one start in the window; two or more is a split crease. */
  startersUsed: number; goalies: CreaseShiftGoalie[];
  unresolvedGames: number; comparisonUnresolvedGames: number; missingGames: number;
  /** The window's games, oldest first. A scheduled game with no report, or without one labeled starter, is a gap. */
  series: CreaseShiftPoint[];
  withheld: string | null;
};
/** `starterId` is the one labeled starter, null unless the game is resolved: a starter is never guessed. */
export type CreaseShiftPoint = { gameId: number; date: string; state: "resolved" | "unresolved" | "missing"; starterId: number | null };
/** `teams` is every team, ranked first, so a picked team keeps its league rank; `picked` is empty unless the editor chose teams. */
export type CreaseShiftData = { window: number; comparison: "previous" | "std"; minComparisonGames: number; through: string; teams: CreaseShiftTeam[]; picked: string[] };

/** A `games` row: proves a game was scheduled, not that it finished. */
export type ScheduledGame = { id: number; date: string; homeTeamId: number | null; awayTeamId: number | null };
export type ScheduleGap = { team: string; gameId: number; date: string };
export type ScheduleReconciliation = { scheduledGames: number; expected: number; observed: number; missing: number; gaps: ScheduleGap[]; games: CompletedTeamGame[] };

const teamById = new Map(Object.entries(teamsInfo).map(([abbreviation, team]) => [team.id, abbreviation]));

/** Through yesterday in New York: today's games may not be final. One definition, shared with the matchup pager. */
export { editionCutoff };
export function seasonScope(generatedAt: string) {
  const through = editionCutoff(generatedAt), season = currentSeason(through);
  return { through, season, from: `${String(season).slice(0, 4)}-07-01` };
}

/** Completed team games against the regular-season schedule for the same dates: expected is games × 2, and `games` keeps only scheduled ones. */
export function reconcileSchedule(scheduled: readonly ScheduledGame[], reported: readonly CompletedTeamGame[]): ScheduleReconciliation {
  const seen = new Set(reported.map(game => `${game.team}:${game.gameId}`)), ids = new Set(scheduled.map(game => game.id));
  const gaps = scheduled.flatMap(game => [game.homeTeamId, game.awayTeamId].flatMap(id => {
    const team = teamById.get(id ?? -1) ?? "Unknown team";
    return seen.has(`${team}:${game.id}`) ? [] : [{ team, gameId: game.id, date: game.date }];
  }));
  const expected = scheduled.length * 2;
  return { scheduledGames: scheduled.length, expected, observed: expected - gaps.length, missing: gaps.length, gaps, games: reported.filter(game => ids.has(game.gameId)) };
}

/** Each scheduled night's team games against those reported, for `completeThrough`: the same matching as `reconcileSchedule`. */
export function scheduleNights(scheduled: readonly ScheduledGame[], reported: readonly CompletedTeamGame[]): NightCoverage[] {
  const seen = new Set(reported.map(game => `${game.team}:${game.gameId}`));
  return countNights(teamGameDates(scheduled), scheduled.flatMap(game => [game.homeTeamId, game.awayTeamId].flatMap(id => seen.has(`${teamById.get(id ?? -1) ?? "Unknown team"}:${game.id}`) ? [game.date] : [])));
}
/** Rows dated on or before `through`. */
export const datedThrough = <Row extends { date: string }>(rows: readonly Row[], through: string) => rows.filter(row => row.date <= through);

/** The exact share change, divided once, so equal changes on different denominators stay tied. */
const shareChange = (starts: number, games: number, baseStarts: number, baseGames: number) => (starts * baseGames - baseStarts * games) * 100 / (games * baseGames);

/** The window's games with any schedule gap inside them, each with its one starter, for this team's games only. */
function shareSeries(team: string, recent: TeamStartShare, input: { games: readonly CompletedTeamGame[]; appearances: readonly GoalieAppearance[]; window: number }, gaps: readonly ScheduleGap[]) {
  const reported = lastN(input.games.filter(game => game.team === team), input.window).rows, unresolved = new Set(recent.unresolvedGames);
  const starterOf = (gameId: number) => input.appearances.find(row => row.team === team && row.gameId === gameId && row.started === true)?.goalieId ?? null;
  const points: CreaseShiftPoint[] = [
    ...reported.map(game => unresolved.has(game.gameId) ? { gameId: game.gameId, date: game.date, state: "unresolved" as const, starterId: null } : { gameId: game.gameId, date: game.date, state: "resolved" as const, starterId: starterOf(game.gameId) }),
    ...recent.firstDate ? gaps.filter(gap => gap.team === team && gap.date >= recent.firstDate!).map(gap => ({ gameId: gap.gameId, date: gap.date, state: "missing" as const, starterId: null })) : [],
  ];
  return points.sort((a, b) => a.date.localeCompare(b.date) || a.gameId - b.gameId);
}

/** A completed game with no resolved starter counts as a team game and credits no one. A game with no report is not in LAST n's denominator either, so the value holds across it. */
function runningShare(points: readonly CreaseShiftPoint[], goalieId: number) {
  let games = 0, starts = 0;
  return points.map(point => {
    if (point.state !== "missing") games++;
    if (point.starterId === goalieId) starts++;
    return games ? starts / games : null;
  });
}

function teamRow(team: string, input: { games: readonly CompletedTeamGame[]; appearances: readonly GoalieAppearance[]; window: number; comparison: "previous" | "std"; minComparisonGames: number }, gaps: readonly ScheduleGap[]): Omit<CreaseShiftTeam, "rank"> {
  const recent: TeamStartShare = teamStartShare(team, input.games, input.appearances, input.window);
  const base: TeamStartShare = input.comparison === "std" ? teamStartShare(team, input.games, input.appearances, null) : teamStartShare(team, input.games, input.appearances, input.window, input.window);
  // Season to date contains the recent games, so only the games outside them can be evidence of a change.
  const overlap = input.comparison === "std" ? recent.teamGames : 0, shortComparison = recent.teamGames > 0 && base.teamGames - overlap < input.minComparisonGames;
  const points = shareSeries(team, recent, input, gaps);
  const ids = [...new Set([...recent.goalies, ...base.goalies].map(goalie => goalie.goalieId))];
  const goalies = ids.map((goalieId): CreaseShiftGoalie => {
    const now = recent.goalies.find(goalie => goalie.goalieId === goalieId), then = base.goalies.find(goalie => goalie.goalieId === goalieId);
    const starts = now?.starts ?? 0, baseStarts = then?.starts ?? 0;
    return {
      goalieId, name: now?.name ?? then?.name ?? null, starts, relief: now?.reliefAppearances ?? 0,
      // A complete window proves an absent goalie's 0 starts; teamStartShare's 0 on an incomplete window proves nothing.
      share: recent.complete ? starts / recent.teamGames : null,
      comparisonStarts: base.complete ? baseStarts : null, comparisonRelief: base.complete ? then?.reliefAppearances ?? 0 : null, comparisonShare: base.complete ? baseStarts / base.teamGames : null,
      change: recent.complete && base.complete && !shortComparison ? shareChange(starts, recent.teamGames, baseStarts, base.teamGames) : null,
      otherTeams: [...new Set(input.appearances.filter(row => row.goalieId === goalieId && row.team !== team).map(row => row.team))].sort(),
      // Official starts only, on this team only: relief and a traded goalie's other team never move this line.
      runningShare: runningShare(points, goalieId),
    };
  }).sort((a, b) => b.starts - a.starts || (b.comparisonStarts ?? 0) - (a.comparisonStarts ?? 0) || a.goalieId - b.goalieId);
  const changes = goalies.flatMap(goalie => goalie.change === null ? [] : [Math.abs(goalie.change)]);
  const withheld = !recent.teamGames ? "No completed games in this window."
    : recent.unresolvedGames.length ? `${recent.unresolvedGames.length} of ${recent.teamGames} window games lack exactly one labeled starter.`
    : !base.teamGames ? "No completed games in the comparison window."
    : base.unresolvedGames.length ? `${base.unresolvedGames.length} of ${base.teamGames} comparison games lack exactly one labeled starter.`
    : shortComparison ? `Only ${base.teamGames - overlap} comparison games outside the window, under the minimum of ${input.minComparisonGames}.`
    : null;
  return {
    team, shift: withheld === null && changes.length ? Math.max(...changes) : null,
    games: recent.teamGames, short: recent.short, firstDate: recent.firstDate, lastDate: recent.lastDate,
    comparisonGames: base.teamGames, comparisonShort: input.comparison === "previous" && base.short, overlap, shortComparison,
    startersUsed: recent.complete ? goalies.filter(goalie => goalie.starts > 0).length : 0, goalies,
    unresolvedGames: recent.unresolvedGames.length, comparisonUnresolvedGames: base.unresolvedGames.length,
    missingGames: gaps.filter(gap => gap.team === team).length, series: points, withheld,
  };
}

/** `teams` are ranked together; `picked`, a subset of them, are the ones shown. */
type CreaseShiftInput = { reported: readonly CompletedTeamGame[]; appearances: readonly GoalieAppearance[]; scheduled: readonly ScheduledGame[]; teams: readonly string[]; picked?: readonly string[]; window: number; comparison: "previous" | "std"; minComparisonGames: number; through: string };
/** A late newest night ends the windows at the last complete one, with a page note; an older gap still makes the post partial. */
export function buildCreaseShift(input: CreaseShiftInput): SharePostLoadResult<CreaseShiftData> {
  const cut = completeThrough(scheduleNights(input.scheduled, input.reported), input.through);
  if (!cut.trimmed.length) return buildCreaseWindow(input);
  if (!cut.through) return { ...buildCreaseWindow(input), state: "missing", reasons: ["No night this season is fully reported yet."], data: null };
  const result = buildCreaseWindow({ ...input, reported: datedThrough(input.reported, cut.through), appearances: datedThrough(input.appearances, cut.through), scheduled: datedThrough(input.scheduled, cut.through), through: cut.through });
  return { ...result, pageNotes: [completeThroughNote(cut)!, ...result.pageNotes ?? []] };
}
function buildCreaseWindow(input: CreaseShiftInput): SharePostLoadResult<CreaseShiftData> {
  const schedule = reconcileSchedule(input.scheduled, input.reported);
  const rows = input.teams.map(team => teamRow(team, { games: schedule.games, appearances: input.appearances, window: input.window, comparison: input.comparison, minComparisonGames: input.minComparisonGames }, schedule.gaps));
  const ranked = competitionRanks(rows, row => row.shift, row => row.team), ranks = new Map(ranked.map(entry => [entry.row.team, entry.rank]));
  const teams: CreaseShiftTeam[] = rows.map(row => ({ ...row, rank: ranks.get(row.team) ?? null })).sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || a.team.localeCompare(b.team));
  const picked = (input.picked ?? []).filter(team => input.teams.includes(team)), shown = creaseShiftShown({ teams, picked });
  const unresolved = rows.filter(row => row.unresolvedGames || row.comparisonUnresolvedGames).length;
  const reasons = [
    ...schedule.missing ? [`${schedule.missing} of ${schedule.expected} scheduled team games have no reported result, so windows may be off.`] : [],
    ...unresolved ? [`Share withheld for teams with a game lacking exactly one labeled starter: ${unresolved}.`] : [],
  ];
  const state = reasons.length ? "partial" : "ready";
  const asOf = schedule.games.reduce<string | null>((latest, game) => !latest || game.date > latest ? game.date : latest, null);
  const others = rows.filter(row => row.withheld !== null && !row.shortComparison).map(row => row.team);
  const words = creaseShiftWords({ window: input.window, comparison: input.comparison, teams, picked });
  const compared = input.comparison === "std" ? "SEASON is the season to date, which contains the recent games" : `PRIOR is up to the ${input.window} games before them`;
  // A picked team that cannot rank still shows, so the editor sees why beside the card; RK and CHANGE print "—".
  const pageNotes = shown.filter(team => team.rank === null).map(team => `${team.team} is unranked: ${team.withheld ?? "no share change to rank."}`);
  return {
    state, reasons, ttlSeconds: 900, teams: shown.map(team => team.team), ...pageNotes.length ? { pageNotes } : {},
    data: { window: input.window, comparison: input.comparison, minComparisonGames: input.minComparisonGames, through: input.through, teams, picked },
    evidence: {
      sources: [
        { name: "NHL.com team game stats", tables: ["wgo_team_stats", "games"], state: schedule.missing ? "partial" : "ready", asOf, updatedAt: null },
        { name: "NHL.com goalie game stats", tables: ["wgo_goalie_stats"], state: unresolved ? "partial" : "ready", asOf: input.appearances.reduce<string | null>((latest, row) => !latest || row.date > latest ? row.date : latest, null), updatedAt: null },
      ],
      sample: `Official starts ÷ completed team games. ${words.last} is each team's last ${input.window} through ${input.through}; ${compared}; ${input.comparison === "std" ? "the subtitle" : "the header"} gives its games, or each row as GP when teams differ. CHANGE is ${words.last} minus ${words.prior} in percentage points. Blocks show who started each game, oldest to newest, and an empty block has no resolved starter. The line is the running start share, starts so far ÷ team games so far, ending at ${words.last}, with guides at 0, 50 and 100%; a game with no resolved starter counts as a team game and credits no one; relief is not a start; describes past starts only${picked.length ? `. Teams picked: ${picked.join(", ")}; RK is each team's rank among all ${input.teams.length}` : ""}${others.length ? `. Unranked: ${others.join(", ")}` : ""}`,
      strength: "All situations (official starter labels)", cohort: `${ranked.length} of ${input.teams.length} teams ranked; ${rows.filter(row => row.shortComparison).length} short comparison`,
      coverage: { observed: schedule.observed, expected: schedule.expected, missing: schedule.missing, unit: "team games" },
    },
  };
}

type ColorField = "primaryColor" | "secondaryColor" | "lightColor" | "jersey" | "accent" | "alt" | "darkColor";
const COLOR_ORDER: readonly ColorField[] = ["primaryColor", "secondaryColor", "lightColor", "jersey", "accent", "alt", "darkColor"];
/** Black or charcoal lifted to the contrast floor is plain grey, which is no team colour and is G3's line. Navy keeps its hue. */
const isGreyOnceLifted = (color: string) => {
  const parts = [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16));
  return luminance(color) < 0.05 && Math.max(...parts) - Math.min(...parts) < 24;
};
/** Perceptual "redmean" distance between #rrggbb colours; below this, two lines read as one on the dark card. */
export const CREASE_MIN_COLOR_DISTANCE = 180;
export function colorDistance(a: string, b: string) {
  const parts = (hex: string) => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
  const [r1, g1, b1] = parts(a), [r2, g2, b2] = parts(b), mean = (r1 + r2) / 2;
  return Math.sqrt((2 + mean / 256) * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + (2 + (255 - mean) / 256) * (b1 - b2) ** 2);
}
export type CreaseColors = { g1: string; g2: string; g1From: ColorField; g2From: ColorField };
/** G1 and G2 from the team's own colours, in `teamsInfo` order, lifted to the Tuesday floor. A too-dark or too-close colour moves to the next. */
export function creaseColors(team: string): CreaseColors {
  const info = teamsInfo[team], fallback = { g1: "#ffffff", g2: "#63d2f5", g1From: "primaryColor" as const, g2From: "secondaryColor" as const };
  if (!info) return fallback;
  const usable = COLOR_ORDER.flatMap(field => { const value = info[field]; return value && !isGreyOnceLifted(value) ? [{ field, color: withNeonFloor(value) }] : []; });
  const first = usable[0], second = usable.slice(1).find(entry => colorDistance(entry.color, first.color) >= CREASE_MIN_COLOR_DISTANCE);
  return first && second ? { g1: first.color, g2: second.color, g1From: first.field, g2From: second.field } : first ? { ...fallback, g1: first.color, g1From: first.field } : fallback;
}

/** Teams shown on the card, and the most that may be picked; the rest stay in the snapshot and are counted on it. */
export const CREASE_SHIFT_SHOWN = 12;
/** The NHL regular season: the longest window and comparison minimum. */
export const CREASE_SHIFT_MAX_GAMES = 84;
/** The picked teams, ranked ones first by league rank, then the rest by name; with none picked, the top `CREASE_SHIFT_SHOWN` ranked. */
export function creaseShiftShown(data: Pick<CreaseShiftData, "teams" | "picked">) {
  return data.picked.length ? data.teams.filter(team => data.picked.includes(team.team)) : data.teams.filter(team => team.rank !== null).slice(0, CREASE_SHIFT_SHOWN);
}
/** A picked card needs one team with a completed game in its window; an unpicked one needs a ranked team. */
export const creaseShiftHasRows = (data: Pick<CreaseShiftData, "teams" | "picked">) => data.picked.length ? creaseShiftShown(data).some(team => team.games > 0) : creaseShiftShown(data).length > 0;
const TEAM_CHOICES = [...activeTeamAbbreviations].map(String).sort().map(team => ({ value: team, label: team }));
/** The picked team abbreviations, in the field's order. */
export const creaseShiftPicks = (teams: string | null | undefined) => (teams ?? "").split(",").filter(Boolean);
/**
 * The card's plain words (TJ, 2026-11-11), shared by its headers, subtitle and note, the alt text and the evidence. `span` is
 * the comparison's games when every team shown has the same number, else null and each row prints its own.
 */
export function creaseShiftWords(data: Pick<CreaseShiftData, "window" | "comparison" | "teams" | "picked">) {
  const spans = new Set(creaseShiftShown(data).map(team => team.comparisonGames)), span = spans.size === 1 ? [...spans][0] : null;
  const last = `LAST ${data.window}`, prior = data.comparison === "std" ? "SEASON" : span === null ? "PRIOR" : `PRIOR ${span}`;
  const games = (count: number) => count === 1 ? "1 game" : `${count} games`;
  const recent = data.window === 1 ? "last game" : `last ${data.window} games`;
  const against = data.comparison === "std" ? `the season so far${span ? ` (${games(span)})` : ""}`
    : span === null ? `up to the ${data.window} before` : span === 0 ? "no earlier games" : span === 1 ? "the game before" : `the ${span} before`;
  const compared = `${recent} vs ${against}`;
  return { span, last, prior, compared, subtitle: `Share of each team's starts in net: ${compared}` };
}
export const creaseShiftWindowLabel = (team: Pick<CreaseShiftTeam, "games" | "short">, requested: number) => team.short ? `${team.games} of ${requested}` : `${team.games}`;

export const creaseShiftModule = defineShareModule<CreaseShiftSettings, CreaseShiftData>({
  id: "crease-shift", title: "Crease Shift", summary: "Official start share over completed team games, against a labeled comparison window. Describes past starts only.", group: "goalies", basis: "observed",
  fields: [
    // A number since 11-11; the old L5, L10 and L20 values ("5", "10", "20") parse as their numbers.
    { id: "window", label: "Window (team games)", kind: "number", default: 10, min: 1, max: CREASE_SHIFT_MAX_GAMES, step: 1 },
    { id: "comparison", label: "Comparison", kind: "select", default: "previous", options: [{ value: "previous", label: "Previous N team games" }, { value: "std", label: "Season to date" }] },
    { id: "minComparisonGames", label: "Min comparison games outside the window", kind: "number", default: 5, min: 1, max: CREASE_SHIFT_MAX_GAMES, step: 1 },
    { id: "teams", label: `Teams (up to ${CREASE_SHIFT_SHOWN})`, kind: "text", default: "", maxLength: CREASE_SHIFT_SHOWN * 4 - 1, choices: TEAM_CHOICES, maxChoices: CREASE_SHIFT_SHOWN, blank: `the top ${CREASE_SHIFT_SHOWN} by share change` },
  ],
  validate: settings => {
    if (!Number.isInteger(settings.window) || !Number.isInteger(settings.minComparisonGames)) return "Use whole numbers of games.";
    const picks = creaseShiftPicks(settings.teams);
    if (picks.some(team => !TEAM_CHOICES.some(choice => choice.value === team)) || new Set(picks).size !== picks.length) return "Pick teams from the list.";
    return picks.length > CREASE_SHIFT_SHOWN ? `Pick up to ${CREASE_SHIFT_SHOWN} teams.` : null;
  },
  load: () => import("./creaseShift.sources").then(sources => sources.loadCreaseShift),
  card: () => import("components/SocialShare/modules/CreaseShiftCard").then(card => card.default),
  hasRows: creaseShiftHasRows,
  altText: (snapshot, data) => `FHFH Crease Shift: share of each team's starts in net, ${creaseShiftWords(data).compared}, through ${data.through}. ${creaseShiftShown(data).map(team => `${team.rank === null ? `${team.team} (unranked)` : `${team.rank}. ${team.team}`}: ${team.goalies.filter(goalie => goalie.starts > 0).map(goalie => `${goalie.name ?? goalie.goalieId} ${goalie.starts} of ${team.games}`).join(", ") || "no starts in the window"}`).join("; ")}. Describes past starts only. ${snapshot.evidence.sample}.`,
});
