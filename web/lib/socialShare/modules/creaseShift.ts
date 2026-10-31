import { currentSeason } from "lib/socialShare/schedule";
import { teamsInfo } from "lib/teamsInfo";
import { defineShareModule, type SharePostLoadResult } from "./contract";
import { competitionRanks, editionDate } from "./shared/definitions";
import { teamStartShare, type CompletedTeamGame, type GoalieAppearance, type TeamStartShare } from "./shared/goalieLedger";
import { shiftDays } from "./teamGames";

/**
 * Crease Shift (SS 8.0): official start share over a team's last N completed games, against a labeled comparison window.
 * The denominator is completed team games, so this is not the appearance share in GoalieShareChart's pie. Descriptive only.
 */
export type CreaseShiftSettings = { window: string; comparison: string };
export type CreaseShiftGoalie = {
  goalieId: number; name: string | null; starts: number; relief: number;
  /** Null unless every game in the window has exactly one labeled starter. */
  share: number | null; comparisonStarts: number | null; comparisonRelief: number | null; comparisonShare: number | null;
  /** Share change in percentage points; null when either window is withheld. */
  change: number | null;
  /** Other teams this goalie appeared for this season. Each game binds to the team he played for. */
  otherTeams: string[];
};
export type CreaseShiftTeam = {
  team: string; rank: number | null;
  /** Largest absolute goalie share change on the team, in percentage points. */
  shift: number | null;
  games: number; short: boolean; firstDate: string | null; lastDate: string | null;
  comparisonGames: number; comparisonShort: boolean;
  /** Games shared by both windows: the recent games when comparing with season to date, otherwise 0. */
  overlap: number;
  /** Goalies with at least one start in the window; two or more is a split crease. */
  startersUsed: number; goalies: CreaseShiftGoalie[];
  unresolvedGames: number; comparisonUnresolvedGames: number; missingGames: number;
  withheld: string | null;
};
export type CreaseShiftData = { window: number; comparison: "previous" | "std"; through: string; teams: CreaseShiftTeam[] };

/** A `games` row: proves a game was scheduled, not that it finished. */
export type ScheduledGame = { id: number; date: string; homeTeamId: number | null; awayTeamId: number | null };
export type ScheduleGap = { team: string; gameId: number; date: string };
export type ScheduleReconciliation = { scheduledGames: number; expected: number; observed: number; missing: number; gaps: ScheduleGap[]; games: CompletedTeamGame[] };

const teamById = new Map(Object.entries(teamsInfo).map(([abbreviation, team]) => [team.id, abbreviation]));

/** Through yesterday in New York: today's games may not be final. */
export const editionCutoff = (generatedAt: string) => shiftDays(editionDate(generatedAt), -1);
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

/** The exact share change, divided once, so equal changes on different denominators stay tied. */
const shareChange = (starts: number, games: number, baseStarts: number, baseGames: number) => (starts * baseGames - baseStarts * games) * 100 / (games * baseGames);

function teamRow(team: string, input: { games: readonly CompletedTeamGame[]; appearances: readonly GoalieAppearance[]; window: number; comparison: "previous" | "std" }, gaps: readonly ScheduleGap[]): Omit<CreaseShiftTeam, "rank"> {
  const recent: TeamStartShare = teamStartShare(team, input.games, input.appearances, input.window);
  const base: TeamStartShare = input.comparison === "std" ? teamStartShare(team, input.games, input.appearances, null) : teamStartShare(team, input.games, input.appearances, input.window, input.window);
  const ids = [...new Set([...recent.goalies, ...base.goalies].map(goalie => goalie.goalieId))];
  const goalies = ids.map((goalieId): CreaseShiftGoalie => {
    const now = recent.goalies.find(goalie => goalie.goalieId === goalieId), then = base.goalies.find(goalie => goalie.goalieId === goalieId);
    const starts = now?.starts ?? 0, baseStarts = then?.starts ?? 0;
    return {
      goalieId, name: now?.name ?? then?.name ?? null, starts, relief: now?.reliefAppearances ?? 0,
      // A complete window proves an absent goalie's 0 starts; teamStartShare's 0 on an incomplete window proves nothing.
      share: recent.complete ? starts / recent.teamGames : null,
      comparisonStarts: base.complete ? baseStarts : null, comparisonRelief: base.complete ? then?.reliefAppearances ?? 0 : null, comparisonShare: base.complete ? baseStarts / base.teamGames : null,
      change: recent.complete && base.complete ? shareChange(starts, recent.teamGames, baseStarts, base.teamGames) : null,
      otherTeams: [...new Set(input.appearances.filter(row => row.goalieId === goalieId && row.team !== team).map(row => row.team))].sort(),
    };
  }).sort((a, b) => b.starts - a.starts || (b.comparisonStarts ?? 0) - (a.comparisonStarts ?? 0) || a.goalieId - b.goalieId);
  const changes = goalies.flatMap(goalie => goalie.change === null ? [] : [Math.abs(goalie.change)]);
  const withheld = !recent.teamGames ? "No completed games in this window."
    : recent.unresolvedGames.length ? `${recent.unresolvedGames.length} of ${recent.teamGames} window games lack exactly one labeled starter.`
    : !base.teamGames ? "No completed games in the comparison window."
    : base.unresolvedGames.length ? `${base.unresolvedGames.length} of ${base.teamGames} comparison games lack exactly one labeled starter.`
    : null;
  return {
    team, shift: withheld === null && changes.length ? Math.max(...changes) : null,
    games: recent.teamGames, short: recent.short, firstDate: recent.firstDate, lastDate: recent.lastDate,
    comparisonGames: base.teamGames, comparisonShort: input.comparison === "previous" && base.short, overlap: input.comparison === "std" ? recent.teamGames : 0,
    startersUsed: recent.complete ? goalies.filter(goalie => goalie.starts > 0).length : 0, goalies,
    unresolvedGames: recent.unresolvedGames.length, comparisonUnresolvedGames: base.unresolvedGames.length,
    missingGames: gaps.filter(gap => gap.team === team).length, withheld,
  };
}

export function buildCreaseShift(input: { reported: readonly CompletedTeamGame[]; appearances: readonly GoalieAppearance[]; scheduled: readonly ScheduledGame[]; teams: readonly string[]; window: number; comparison: "previous" | "std"; through: string }): SharePostLoadResult<CreaseShiftData> {
  const schedule = reconcileSchedule(input.scheduled, input.reported);
  const rows = input.teams.map(team => teamRow(team, { games: schedule.games, appearances: input.appearances, window: input.window, comparison: input.comparison }, schedule.gaps));
  const ranked = competitionRanks(rows, row => row.shift, row => row.team), ranks = new Map(ranked.map(entry => [entry.row.team, entry.rank]));
  const teams: CreaseShiftTeam[] = rows.map(row => ({ ...row, rank: ranks.get(row.team) ?? null })).sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || a.team.localeCompare(b.team));
  const unresolved = rows.filter(row => row.unresolvedGames || row.comparisonUnresolvedGames).length;
  const reasons = [
    ...schedule.missing ? [`${schedule.missing} of ${schedule.expected} scheduled team games have no reported result, so windows may be off.`] : [],
    ...unresolved ? [`Share withheld for teams with a game lacking exactly one labeled starter: ${unresolved}.`] : [],
  ];
  const state = reasons.length ? "partial" : "ready";
  const asOf = schedule.games.reduce<string | null>((latest, game) => !latest || game.date > latest ? game.date : latest, null);
  const compared = input.comparison === "std" ? "season to date, which contains the recent games" : `the ${input.window} games before them`;
  return {
    state, reasons, ttlSeconds: 900, teams: teams.slice(0, CREASE_SHIFT_SHOWN).map(team => team.team),
    data: { window: input.window, comparison: input.comparison, through: input.through, teams },
    evidence: {
      sources: [
        { name: "NHL.com team game stats", tables: ["wgo_team_stats", "games"], state: schedule.missing ? "partial" : "ready", asOf, updatedAt: null },
        { name: "NHL.com goalie game stats", tables: ["wgo_goalie_stats"], state: unresolved ? "partial" : "ready", asOf: input.appearances.reduce<string | null>((latest, row) => !latest || row.date > latest ? row.date : latest, null), updatedAt: null },
      ],
      sample: `Last ${input.window} completed team games per team through ${input.through}, compared with ${compared}`,
      strength: "All situations (official starter labels)", cohort: `${ranked.length} of ${input.teams.length} teams with both windows resolved`,
      coverage: { observed: schedule.observed, expected: schedule.expected, missing: schedule.missing, unit: "team games" },
    },
  };
}

/** Teams shown on the card; the rest stay in the snapshot and are counted on it. */
export const CREASE_SHIFT_SHOWN = 8;
export const creaseShiftWindowLabel = (team: Pick<CreaseShiftTeam, "games" | "short">, requested: number) => team.short ? `${team.games} of ${requested}` : `${team.games}`;

export const creaseShiftModule = defineShareModule<CreaseShiftSettings, CreaseShiftData>({
  id: "crease-shift", title: "Crease Shift", summary: "Official start share over completed team games, against a labeled comparison window. Describes past starts only.", group: "goalies", basis: "observed",
  fields: [
    { id: "window", label: "Window", kind: "select", default: "10", options: [{ value: "5", label: "L5 team games" }, { value: "10", label: "L10 team games" }, { value: "20", label: "L20 team games" }] },
    { id: "comparison", label: "Comparison", kind: "select", default: "previous", options: [{ value: "previous", label: "Previous N team games" }, { value: "std", label: "Season to date" }] },
  ],
  load: () => import("./creaseShift.sources").then(sources => sources.loadCreaseShift),
  card: () => import("components/SocialShare/modules/CreaseShiftCard").then(card => card.default),
  hasRows: data => data.teams.some(team => team.rank !== null),
  altText: (snapshot, data) => `FHFH Crease Shift: official start share over each team's last ${data.window} completed games through ${data.through}. ${data.teams.filter(team => team.rank !== null).slice(0, CREASE_SHIFT_SHOWN).map(team => `${team.rank}. ${team.team}: ${team.goalies.filter(goalie => goalie.starts > 0).map(goalie => `${goalie.name ?? goalie.goalieId} ${goalie.starts} of ${team.games}`).join(", ")}`).join("; ")}. Describes past starts only. ${snapshot.evidence.sample}.`,
});
