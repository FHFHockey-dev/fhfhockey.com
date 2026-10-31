import { normalizeEvDeploymentBucket } from "lib/rankings/skaterDeploymentAggregation";
import { defineShareModule, type SharePostLoadResult, type SharePostSource } from "./contract";
import { competitionRanks, versusSeason } from "./shared/definitions";
import { appearancesByPlayer, type SkaterAppearance } from "./shared/skaterAppearances";
import { formatSeconds, gameCoverage, listedRanks, newestDate, teamChangeOf, windowLabel, windowSize, type TeamChange, type WhatChangedWindow } from "./whatChanged";

/** Role Watch (SS 4.0): observed TOI and PP TOI change against a baseline that shares no game with the recent window. */
export type RoleWatchSettings = { window: WhatChangedWindow; minToiChange: number; minPpChange: number };
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
export type RoleWatchRow = RoleWatchPlayer & { rank: number };
export type RoleWatchData = {
  through: string; window: WhatChangedWindow; requested: number; minToiChange: number; minPpChange: number;
  toiMovers: RoleWatchRow[]; ppMovers: RoleWatchRow[];
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
    return { player, short };
  });
}
function movers(players: readonly RoleWatchPlayer[], change: (player: RoleWatchPlayer) => RoleChange) {
  const ranked = competitionRanks(players.filter(player => change(player).qualifies), player => Math.abs(change(player).changeSeconds!), player => player.playerId).map(({ row, rank }): RoleWatchRow => ({ ...row, rank }));
  return { total: ranked.length, listed: listedRanks(ranked) };
}
const comparable = (players: ReturnType<typeof comparePlayers>) => players.filter(entry => !entry.short).map(entry => entry.player);
/** The games the role read needs: each listed player's latest game and last game before the window. */
export function roleWatchShown(appearances: readonly SkaterAppearance[], settings: RoleWatchSettings) {
  const players = comparable(comparePlayers(appearances, settings));
  const listed = [...movers(players, player => player.toi).listed, ...movers(players, player => player.pp).listed];
  return { playerIds: [...new Set(listed.map(player => player.playerId))], gameIds: [...new Set(listed.flatMap(player => [player.latest.gameId, ...(player.before ? [player.before.gameId] : [])]))] };
}

export type RoleWatchInput = { appearances: readonly SkaterAppearance[]; evidence: RoleEvidence; completedTeamGames: readonly { gameId: number }[]; scheduledGameIds: readonly number[]; through: string; settings: RoleWatchSettings };
export function buildRoleWatch(input: RoleWatchInput): SharePostLoadResult<RoleWatchData> {
  const { appearances, settings } = input, requested = windowSize(settings.window), entries = comparePlayers(appearances, settings), players = comparable(entries);
  const toi = movers(players, player => player.toi), pp = movers(players, player => player.pp), slot = roleSlotReader(input.evidence);
  const withRole = (row: RoleWatchRow): RoleWatchRow => ({ ...row, latest: { ...row.latest, role: slot(row.playerId, row.latest.gameId) }, before: row.before && { ...row.before, role: slot(row.playerId, row.before.gameId) } });
  const toiMovers = toi.listed.map(withRole), ppMovers = pp.listed.map(withRole), shown = [...toiMovers, ...ppMovers];
  const games = gameCoverage({ appearances, completedTeamGames: input.completedTeamGames, scheduledGameIds: input.scheduledGameIds });
  const unknownChange = players.filter(player => player.toi.direction === "unknown" || player.pp.direction === "unknown").length;
  const reasons = [...games.reasons, ...(unknownChange ? [`${unknownChange} skaters have a missing NHL.com TOI or PP TOI value in their windows.`] : [])];
  const slots = shown.flatMap(row => [row.latest.role, ...(row.before ? [row.before.role] : [])]);
  const unknownLines = slots.filter(role => role.line === "unknown").length, unknownPp = slots.filter(role => role.pp === "unknown").length;
  const sources: SharePostSource[] = [
    { name: "NHL.com skater game stats", tables: ["wgo_skater_stats"], state: reasons.length ? "partial" : "ready", asOf: newestDate(appearances.map(game => game.date)), updatedAt: null },
    { name: "NHL.com team game stats", tables: ["wgo_team_stats", "games"], state: games.missing ? "partial" : "ready", asOf: input.through, updatedAt: null },
    { name: "FHFH rolling line combinations", tables: ["rolling_player_game_metrics"], state: unknownLines ? "partial" : "ready", asOf: null, updatedAt: null, reasons: unknownLines ? [`${unknownLines} line slots are unknown; rolling has no first-week rows.`] : [] },
    { name: "Power-play combinations", tables: ["powerPlayCombinations"], state: unknownPp ? "partial" : "ready", asOf: null, updatedAt: null, reasons: unknownPp ? [`${unknownPp} PP slots are unknown: those games have no PP rows.`] : [] },
  ];
  const shortSample = entries.length - players.length, windowName = windowLabel(settings.window), unlisted = toi.total + pp.total - toiMovers.length - ppMovers.length;
  const moves = [...new Set(shown.flatMap(row => row.teamChange ? [`${row.name ?? row.playerId} ${row.teamChange.from} to ${row.teamChange.to}, ${row.teamChange.recentGamesWithNewTeam} of ${row.recentGames} recent games`] : []))];
  return {
    state: reasons.length ? "partial" : "ready", reasons,
    data: { through: input.through, window: settings.window, requested, minToiChange: settings.minToiChange, minPpChange: settings.minPpChange, toiMovers, ppMovers,
      cohort: { players: entries.length, compared: players.length, shortSample, unknownChange, qualified: new Set([...players.filter(player => player.toi.qualifies || player.pp.qualifies).map(player => player.playerId)]).size, unlisted } },
    teams: [...new Set(shown.flatMap(row => row.team ? [row.team] : []))].sort(),
    evidence: {
      sources,
      sample: `${windowName} versus the season before it, through ${input.through}. No game is in both; each row shows its actual samples. Unknown means no source row for that game; Off PP means the game has PP rows and this skater is not on PP1 or PP2${moves.length ? `. New team: ${moves.join("; ")}` : ""}`,
      strength: "TOI all situations; PP TOI power play",
      cohort: `${entries.length} skaters this season: ${players.length} with a full ${windowName} and at least ${requested} baseline games, ${shortSample} short sample${unlisted ? `, ${unlisted} more not listed` : ""}`,
      coverage: { observed: games.observed, expected: games.expected, missing: games.missing, unit: "team games" },
    },
  };
}

const altRow = (row: RoleWatchRow, change: RoleChange) => `${row.rank}. ${row.name ?? `Player ${row.playerId}`}: ${formatSeconds(change.recentSeconds)} versus ${formatSeconds(change.baselineSeconds)}, ${formatSeconds(change.changeSeconds, true)} (${row.recentGames} and ${row.baselineGames} GP; ${roleSlotLabel(row.latest.role)})`;
export const roleWatchModule = defineShareModule<RoleWatchSettings, RoleWatchData>({
  id: "role-watch", title: "Role Watch", summary: "Observed TOI and power-play time changes, with samples and line and unit context.", group: "skaters", basis: "observed",
  fields: [
    { id: "window", label: "Recent window", kind: "select", default: "l5", options: [{ value: "l5", label: "L5" }, { value: "l10", label: "L10" }] },
    { id: "minToiChange", label: "Min TOI change (seconds)", kind: "number", default: 60, min: 0, max: 600, step: 5 },
    { id: "minPpChange", label: "Min PP TOI change (seconds)", kind: "number", default: 30, min: 0, max: 600, step: 5 },
  ],
  load: () => import("./roleWatch.sources").then(sources => sources.loadRoleWatch),
  card: () => import("components/SocialShare/modules/RoleWatchCard").then(card => card.default),
  hasRows: data => data.toiMovers.length + data.ppMovers.length > 0,
  altText: (snapshot, data) => `FHFH Role Watch. TOI: ${data.toiMovers.map(row => altRow(row, row.toi)).join("; ") || "none"}. PP TOI: ${data.ppMovers.map(row => altRow(row, row.pp)).join("; ") || "none"}. ${ROLE_WATCH_COPY} ${snapshot.evidence.sample}. ${snapshot.evidence.cohort}.`,
});
