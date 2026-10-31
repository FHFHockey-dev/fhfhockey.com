import { UNKNOWN_EVIDENCE, defineShareModule, type SharePostLoadResult } from "./contract";
import type { GoalieInventory, GoalieInventoryEntry, GoalieInventoryGame } from "./shared/goalieInventory";
import { confirmationLabel, confirmationNote, forecastLabel, inventoryEvidence, isUpcomingGame, searchGoalieInventory, FORECAST_CLOSED_REASON, type GoalieInventoryDetail, type InventoryConflict } from "./shared/goalieInventory.sources";

/**
 * Start/Sit (SS 11.0, SS-R16): a searchable game-by-game goalie schedule. A source's confirmation and a qualified
 * conditional forecast are separate columns, neither implies the other, and the three lenses stay three columns.
 */
export const START_SIT_ROW_LIMIT = 12;
const START_CHART_SOURCE = "Start Chart start participation";
export const FORECAST_ADMITTED_NOTE = "A forecast is a conditional, uncalibrated Start Chart value, separate from source status.";
export type StartSitSettings = { days: number; search: string };
export type StartSitData = { from: string; through: string; inventory: GoalieInventory; confirmationNote: string; forecastNote: string; conflicts: readonly InventoryConflict[] };
export type StartSitRow = { key: string; goalie: GoalieInventoryEntry; game: GoalieInventoryGame };

/** Only games still to start; a goalie with none left drops out. */
export function upcomingInventory(inventory: GoalieInventory): GoalieInventory {
  return { ...inventory, goalies: inventory.goalies.map(goalie => ({ ...goalie, games: goalie.games.filter(game => isUpcomingGame(game, inventory.generatedAt)) })).filter(goalie => goalie.games.length > 0) };
}
/** One row per goalie and game, by date, then team, then the goalie with more recent starts. Search only narrows. */
export function startSitRows(data: StartSitData, search: string): StartSitRow[] {
  return searchGoalieInventory(data.inventory, search).flatMap(goalie => goalie.games.map(game => ({ key: `${game.gameId}:${goalie.goalieId}`, goalie, game })))
    .sort((a, b) => a.game.date.localeCompare(b.game.date) || a.game.gameId - b.game.gameId || a.goalie.team.localeCompare(b.goalie.team) || (b.goalie.recentStarts.starts ?? -1) - (a.goalie.recentStarts.starts ?? -1) || a.goalie.goalieId - b.goalie.goalieId);
}
export const startSitConflicting = (data: Pick<StartSitData, "conflicts">, game: Pick<GoalieInventoryGame, "gameId" | "team">) => data.conflicts.some(item => item.gameId === game.gameId && item.team === game.team);
export function startSitResult({ inventory, coverage, conflicts }: GoalieInventoryDetail): SharePostLoadResult<StartSitData> {
  if (inventory.state === "missing") return { state: "missing", reasons: [...inventory.reasons], evidence: UNKNOWN_EVIDENCE, data: null };
  const upcoming = upcomingInventory(inventory), teamGames = new Set(upcoming.goalies.flatMap(goalie => goalie.games.map(game => `${game.gameId}:${game.team}`))).size;
  return {
    state: inventory.state, reasons: inventory.state === "ready" ? [] : [...inventory.reasons],
    data: { from: inventory.from, through: inventory.through, inventory: upcoming, conflicts, confirmationNote: confirmationNote(inventory), forecastNote: inventory.sources.some(source => source.name === START_CHART_SOURCE && source.state === "ready") ? FORECAST_ADMITTED_NOTE : FORECAST_CLOSED_REASON },
    teams: [...new Set(upcoming.goalies.flatMap(goalie => goalie.games.flatMap(game => [game.team, game.opponent])))].sort(),
    evidence: inventoryEvidence({ inventory, coverage }, `${upcoming.goalies.length} goalies with an appearance in their team's last 10 games, on teams scheduled in the window`, teamGames),
  };
}
export const startSitModule = defineShareModule<StartSitSettings, StartSitData>({
  id: "start-sit", title: "Start/Sit", summary: "Search a goalie's schedule, game by game: source status, forecast state and three separate lenses.", group: "goalies", basis: "observed",
  suggestedUse: "Works for one goalie or team, by search.",
  fields: [
    { id: "days", label: "Days ahead", kind: "number", default: 7, min: 1, max: 14, step: 1 },
    { id: "search", label: "Search goalie or team", kind: "text", default: "", maxLength: 40, clientOnly: true },
  ],
  load: () => import("./startSit.sources").then(sources => sources.loadStartSit),
  card: () => import("components/SocialShare/modules/StartSitCard").then(card => card.default),
  hasRows: (data, settings) => startSitRows(data, settings.search).length > 0,
  altText: (snapshot, data, settings) => {
    const rows = startSitRows(data, settings.search);
    return `FHFH Start/Sit, ${data.from} to ${data.through}${settings.search ? `, search "${settings.search}"` : ""}. ${rows.slice(0, START_SIT_ROW_LIMIT).map(({ goalie, game }) => `${goalie.name} ${game.home ? "vs" : "at"} ${game.opponent} on ${game.date}: ${confirmationLabel(game.confirmation, startSitConflicting(data, game))}; ${forecastLabel(game.forecast)}`).join(". ")}. ${snapshot.evidence.sample}.`;
  },
});
