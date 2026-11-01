import { normalizeEvDeploymentBucket } from "lib/rankings/skaterDeploymentAggregation";
import { defineShareModule, type SharePostLoadResult, type SharePostSource } from "./contract";
import { competitionRanks, lastN, versusSeason } from "./shared/definitions";
import { appearancesByPlayer, type SkaterAppearance } from "./shared/skaterAppearances";
import { boardRanks, formatSeconds, gameCoverage, newestDate, teamChangeOf, WHAT_CHANGED_SERIES, windowLabel, windowSize, type SeriesPoint, type TeamChange, type WhatChangedWindow } from "./whatChanged";

/** Role Watch (SS 4.0): observed TOI and PP TOI change against a baseline that shares no game with the recent window. */
export type RoleWatchBoard = "toi" | "pp";
export type RoleWatchSettings = { window: WhatChangedWindow; board: RoleWatchBoard; minToiChange: number; minPpChange: number };
export const ROLE_WATCH_COPY = "Observed opportunity, not a forecast.";

export const ROLE_ROLLING_COLUMNS = ["player_id", "game_id", "line_combo_slot", "line_combo_group"] as const;
export const ROLE_PP_COLUMNS = ["gameId", "playerId", "unit"] as const;
export type RoleRollingRow = { player_id: number; game_id: number | null; line_combo_slot: number | null; line_combo_group: string | null };
export type RolePpRow = { gameId: number; playerId: number; unit: number | null };

/** "unknown" means no evidence for that game. "off" is a known state: the game has PP rows and this skater is not on PP1 or PP2. */
export type RoleSlot = { line: string | "unknown"; pp: 1 | 2 | "off" | "unknown" };
export type RoleChange = { recentSeconds: number | null; baselineSeconds: number | null; changeSeconds: number | null; direction: "up" | "down" | "flat" | "unknown"; qualifies: boolean };
export type RoleWatchPlayer = {
  playerId: number; name: string | null; position: string | null; team: string | null;
  /** Actual samples. The baseline is the season before the recent window, so no game is in both. */
  recentGames: number; baselineGames: number; overlap: number;
  toi: RoleChange; pp: RoleChange; teamChange: TeamChange | null;
  latest: { gameId: number; date: string; role: RoleSlot }; before: { gameId: number; date: string; role: RoleSlot } | null;
};
/** `series` is the board's measure over the last appearances; `recentFrom` is the index where the recent window starts. */
export type RoleWatchRow = RoleWatchPlayer & { rank: number; series: SeriesPoint[]; recentFrom: number };
export type RoleWatchData = {
  through: string; window: WhatChangedWindow; requested: number; board: RoleWatchBoard; minimum: number;
  risers: RoleWatchRow[]; fallers: RoleWatchRow[];
  /** Ranked players left off a side who share the last rank shown on it. */
  moreTied: { up: number; down: number };
  cohort: { players: number; compared: number; shortSample: number; unknownChange: number; qualified: number; unlisted: number };
};

/** One window's mean seconds per appearance. Any missing value makes it unknown: a WGO window must be complete. */
const meanSeconds = (values: readonly (number | null)[]) => !values.length || values.some(value => value === null) ? null : Math.round((values as number[]).reduce((total, value) => total + value, 0) / values.length);
/** A change meets its minimum at exactly the minimum. No change is flat, even with a minimum of 0. */
export function roleChange(recentSeconds: number | null, baselineSeconds: number | null, minimum: number): RoleChange {
  if (recentSeconds === null || baselineSeconds === null) return { recentSeconds, baselineSeconds, changeSeconds: null, direction: "unknown", qualifies: false };
  const changeSeconds = recentSeconds - baselineSeconds;
  return { recentSeconds, baselineSeconds, changeSeconds, direction: changeSeconds > 0 ? "up" : changeSeconds < 0 ? "down" : "flat", qualifies: changeSeconds !== 0 && Math.abs(changeSeconds) >= minimum };
}

export type RoleEvidence = { rolling: readonly RoleRollingRow[]; pp: readonly RolePpRow[] };
export function roleSlotReader(evidence: RoleEvidence) {
  const lines = new Map(evidence.rolling.map(row => [`${row.player_id}:${row.game_id}`, row])), units = new Map<number, Map<number, number | null>>();
  for (const row of evidence.pp) { const game = units.get(row.gameId) ?? new Map<number, number | null>(); game.set(row.playerId, row.unit); units.set(row.gameId, game); }
  return (playerId: number, gameId: number): RoleSlot => {
    const rolling = lines.get(`${playerId}:${gameId}`), game = units.get(gameId), unit = game?.get(playerId);
    const line = rolling ? normalizeEvDeploymentBucket({ lineComboGroup: rolling.line_combo_group, lineComboSlot: rolling.line_combo_slot }) : null;
    return { line: line ?? "unknown", pp: !game ? "unknown" : unit === 1 || unit === 2 ? unit : "off" };
  };
}
export const roleSlotLabel = (role: RoleSlot) => `${role.line === "unknown" ? "Line unknown" : role.line} · ${role.pp === "unknown" ? "PP unknown" : role.pp === "off" ? "Off PP" : `PP${role.pp}`}`;

const unitless: RoleSlot = { line: "unknown", pp: "unknown" };
/** Every player's changes before role context, so the loader reads context only for the listed players' two games. */
function comparePlayers(appearances: readonly SkaterAppearance[], settings: RoleWatchSettings) {
  const requested = windowSize(settings.window);
  return [...appearancesByPlayer(appearances)].map(([playerId, games]) => {
    const { recent, seasonExcludingRecent: baseline } = versusSeason(games, requested), last = games[games.length - 1], beforeGame = baseline.rows[baseline.rows.length - 1] ?? null;
    const inRecent = new Set(recent.rows.map(game => game.gameId));
    const short = recent.short || baseline.actual < requested;
    const player: RoleWatchPlayer = { playerId, name: last.name, position: last.position, team: last.team, recentGames: recent.actual, baselineGames: baseline.actual, overlap: baseline.rows.filter(game => inRecent.has(game.gameId)).length,
      toi: roleChange(meanSeconds(recent.rows.map(game => game.toiSeconds)), meanSeconds(baseline.rows.map(game => game.toiSeconds)), settings.minToiChange),
      pp: roleChange(meanSeconds(recent.rows.map(game => game.ppToiSeconds)), meanSeconds(baseline.rows.map(game => game.ppToiSeconds)), settings.minPpChange),
      teamChange: teamChangeOf(games, recent.rows), latest: { gameId: last.gameId, date: last.date, role: unitless }, before: beforeGame && { gameId: beforeGame.gameId, date: beforeGame.date, role: unitless } };
    return { player, short, games };
  });
}
export const boardChange = (board: RoleWatchBoard) => (player: RoleWatchPlayer) => board === "toi" ? player.toi : player.pp;
/** Rises and falls of the board's measure, each ranked on its own side. */
function movers(players: readonly RoleWatchPlayer[], board: RoleWatchBoard) {
  const change = boardChange(board);
  const side = (direction: "up" | "down") => {
    const ranked = competitionRanks(players.filter(player => change(player).qualifies && change(player).direction === direction), player => change(player).changeSeconds, player => player.playerId, direction === "up" ? "high" : "low").map(({ row, rank }) => ({ ...row, rank }));
    return { total: ranked.length, ...boardRanks(ranked) };
  };
  return { up: side("up"), down: side("down") };
}
const comparable = (players: ReturnType<typeof comparePlayers>) => players.filter(entry => !entry.short).map(entry => entry.player);
/** The games the role read needs: each listed player's latest game and last game before the window. */
export function roleWatchShown(appearances: readonly SkaterAppearance[], settings: RoleWatchSettings) {
  const { up, down } = movers(comparable(comparePlayers(appearances, settings)), settings.board), listed = [...up.listed, ...down.listed];
  return { playerIds: [...new Set(listed.map(player => player.playerId))], gameIds: [...new Set(listed.flatMap(player => [player.latest.gameId, ...(player.before ? [player.before.gameId] : [])]))] };
}

export type RoleWatchInput = { appearances: readonly SkaterAppearance[]; evidence: RoleEvidence; completedTeamGames: readonly { gameId: number; team: string }[]; scheduledGameIds: readonly number[]; through: string; settings: RoleWatchSettings };
export function buildRoleWatch(input: RoleWatchInput): SharePostLoadResult<RoleWatchData> {
  const { appearances, settings } = input, requested = windowSize(settings.window), entries = comparePlayers(appearances, settings), players = comparable(entries);
  const { up, down } = movers(players, settings.board), slot = roleSlotReader(input.evidence), gamesOf = new Map(entries.map(entry => [entry.player.playerId, entry.games]));
  const toBoardRow = (row: RoleWatchPlayer & { rank: number }): RoleWatchRow => {
    const last = lastN(gamesOf.get(row.playerId)!, WHAT_CHANGED_SERIES).rows;
    return { ...row, latest: { ...row.latest, role: slot(row.playerId, row.latest.gameId) }, before: row.before && { ...row.before, role: slot(row.playerId, row.before.gameId) },
      series: last.map(game => ({ gameId: game.gameId, date: game.date, value: settings.board === "toi" ? game.toiSeconds : game.ppToiSeconds })), recentFrom: Math.max(0, last.length - requested) };
  };
  const risers = up.listed.map(toBoardRow), fallers = down.listed.map(toBoardRow), shown = [...risers, ...fallers];
  const games = gameCoverage({ appearances, completedTeamGames: input.completedTeamGames, scheduledGameIds: input.scheduledGameIds });
  const unknownChange = players.filter(player => player.toi.direction === "unknown" || player.pp.direction === "unknown").length;
  const reasons = [...games.reasons, ...(unknownChange ? [`${unknownChange} skaters have a missing NHL.com TOI or PP TOI value in their windows.`] : [])];
  const slots = shown.flatMap(row => [row.latest.role, ...(row.before ? [row.before.role] : [])]);
  const unknownLines = slots.filter(role => role.line === "unknown").length, unknownPp = slots.filter(role => role.pp === "unknown").length;
  const sources: SharePostSource[] = [
    { name: "NHL.com skater game stats", tables: ["wgo_skater_stats"], state: reasons.length ? "partial" : "ready", asOf: newestDate(appearances.map(game => game.date)), updatedAt: null },
    { name: "NHL.com team game stats", tables: ["wgo_team_stats", "games"], state: games.noResult ? "partial" : "ready", asOf: input.through, updatedAt: null },
    { name: "FHFH rolling line combinations", tables: ["rolling_player_game_metrics"], state: unknownLines ? "partial" : "ready", asOf: null, updatedAt: null, reasons: unknownLines ? [`${unknownLines} line slots are unknown; rolling has no first-week rows.`] : [] },
    { name: "Power-play combinations", tables: ["powerPlayCombinations"], state: unknownPp ? "partial" : "ready", asOf: null, updatedAt: null, reasons: unknownPp ? [`${unknownPp} PP slots are unknown: those games have no PP rows.`] : [] },
  ];
  const shortSample = entries.length - players.length, windowName = windowLabel(settings.window), unlisted = up.total + down.total - shown.length;
  const moves = [...new Set(shown.flatMap(row => row.teamChange ? [`${row.name ?? row.playerId} ${row.teamChange.from} to ${row.teamChange.to}, ${row.teamChange.recentGamesWithNewTeam} of ${row.recentGames} recent games`] : []))];
  return {
    state: reasons.length ? "partial" : "ready", reasons,
    data: { through: input.through, window: settings.window, requested, board: settings.board, minimum: settings.board === "toi" ? settings.minToiChange : settings.minPpChange, risers, fallers, moreTied: { up: up.moreTied, down: down.moreTied },
      cohort: { players: entries.length, compared: players.length, shortSample, unknownChange, qualified: up.total + down.total, unlisted } },
    teams: [...new Set(shown.flatMap(row => row.team ? [row.team] : []))].sort(),
    evidence: {
      sources,
      sample: `${windowName} versus the season before it, through ${input.through}. No game is in both; each row shows its actual samples. Unknown means no source row for that game; Off PP means the game has PP rows and this skater is not on PP1 or PP2. The line is the board's measure over each player's last ${WHAT_CHANGED_SERIES} appearances, and a gap is a game with no value${moves.length ? `. New team: ${moves.join("; ")}` : ""}`,
      strength: "TOI all situations; PP TOI power play",
      cohort: `${entries.length} skaters this season: ${players.length} with a full ${windowName} and at least ${requested} baseline games, ${shortSample} short sample${unlisted ? `, ${unlisted} more not listed` : ""}`,
      coverage: { observed: games.observed, expected: games.expected, missing: games.missing, unit: "team games" },
    },
  };
}

const altRow = (row: RoleWatchRow, change: RoleChange) => `${row.rank}. ${row.name ?? `Player ${row.playerId}`}: ${formatSeconds(change.recentSeconds)} versus ${formatSeconds(change.baselineSeconds)}, ${formatSeconds(change.changeSeconds, true)} (${row.recentGames} and ${row.baselineGames} GP; before ${row.before ? roleSlotLabel(row.before.role) : "no game"}, latest ${roleSlotLabel(row.latest.role)}). Last ${row.series.length} games: ${row.series.map(point => point.value === null ? "gap" : formatSeconds(point.value)).join(", ")}`;
export const roleWatchModule = defineShareModule<RoleWatchSettings, RoleWatchData>({
  id: "role-watch", title: "Role Watch", summary: "Observed TOI and power-play time changes, with samples and line and unit context.", group: "skaters", basis: "observed",
  fields: [
    { id: "window", label: "Recent window", kind: "select", default: "l5", options: [{ value: "l5", label: "L5" }, { value: "l10", label: "L10" }] },
    { id: "board", label: "Board", kind: "select", default: "toi", options: [{ value: "toi", label: "TOI, all situations" }, { value: "pp", label: "PP TOI, power play" }] },
    { id: "minToiChange", label: "Min TOI change (seconds)", kind: "number", default: 60, min: 0, max: 600, step: 5 },
    { id: "minPpChange", label: "Min PP TOI change (seconds)", kind: "number", default: 30, min: 0, max: 600, step: 5 },
  ],
  load: () => import("./roleWatch.sources").then(sources => sources.loadRoleWatch),
  card: () => import("components/SocialShare/modules/RoleWatchCard").then(card => card.default),
  hasRows: data => data.risers.length + data.fallers.length > 0,
  altText: (snapshot, data) => `FHFH Role Watch, ${data.board === "toi" ? "TOI" : "PP TOI"} per game. Up: ${data.risers.map(row => altRow(row, boardChange(data.board)(row))).join("; ") || "none"}. Down: ${data.fallers.map(row => altRow(row, boardChange(data.board)(row))).join("; ") || "none"}. ${ROLE_WATCH_COPY} ${snapshot.evidence.sample}. ${snapshot.evidence.cohort}.`,
});
