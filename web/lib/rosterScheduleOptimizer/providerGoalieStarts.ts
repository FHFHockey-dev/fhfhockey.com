import type { GameForecast, PlanningGame, PlanningPlayer, ProviderStartingStatus } from "./planningTypes";

const round = (value: number) => Math.round(value * 10000) / 10000;
const readTime = (status: ProviderStartingStatus) => status.observedAt.slice(11, 16);

/** The note a FORGE bridge row carries when Yahoo's starting status set its start chance. */
export const providerStartNote = (name: string, status: ProviderStartingStatus) =>
  `Yahoo lists ${name} as ${status.isStarting ? "starting" : "not starting"} on ${status.date} (read ${readTime(status)} UTC); start chances for that game follow it.`;

/**
 * Yahoo's daily goalie mark is fresher than FORGE's start prior, so for that date's game only it replaces the chances in
 * the FORGE bridge rows, as the bridge does with confirmed and ruled-out news: "Starting" is a confirmed start (1) and
 * his teammates 0; "Not starting" is 0 and the rest of the team's chance is rescaled to 1. Expected stats follow as the
 * per-start line × the new chance; "if starts" stays the per-start line. A team-game is left as issued when Yahoo names
 * two starters, contradicts a confirmed starter, the game has started, or a row lacks its per-start line. Native rows
 * keep their own start contract and are untouched.
 */
export function applyProviderGoalieStarts(forecasts: GameForecast[], args: {
  /** Players carrying the provider's marks (the provider snapshot); `catalog` identifies every goalie's team. */
  marked: readonly PlanningPlayer[]; catalog: readonly PlanningPlayer[]; games: readonly PlanningGame[];
  bridgeRevisionIds: ReadonlySet<string>; now: number;
}): GameForecast[] {
  const marks = new Map<string, Array<{ player: PlanningPlayer; status: ProviderStartingStatus }>>();
  for (const player of args.marked) {
    const status = player.startingStatus;
    if (!status || player.playerClass !== "goalie" || !player.nhlTeamId) continue;
    const game = args.games.find(row => row.date === status.date && row.teamAbbreviation === player.teamAbbreviation);
    if (!game || game.status !== "scheduled" || !game.startsAt || Date.parse(game.startsAt) <= args.now) continue;
    const key = `${game.id}:${player.nhlTeamId}`;
    marks.set(key, [...(marks.get(key) ?? []), { player, status }]);
  }
  if (!marks.size) return forecasts;
  const catalog = new Map(args.catalog.map(player => [player.id, player]));
  const groupOf = (row: GameForecast) => {
    const player = catalog.get(row.playerId);
    return !row.rsoTargetBindings && args.bridgeRevisionIds.has(row.revisionId) && player?.playerClass === "goalie" && player.nhlTeamId
      ? `${row.gameId}:${player.nhlTeamId}` : null;
  };
  const changed = new Map<GameForecast, GameForecast>();
  for (const [key, group] of marks) {
    const rows = forecasts.filter(row => groupOf(row) === key);
    const starters = group.filter(mark => mark.status.isStarting).map(mark => mark.player.id);
    const out = new Set(group.filter(mark => !mark.status.isStarting).map(mark => mark.player.id));
    const usable = rows.every(row => row.startProbability !== null && row.conditionalStats
      && Object.keys(row.stats).every(target => target in row.conditionalStats!));
    const contradicted = starters.length > 1
      || rows.some(row => row.confirmedStart && (starters.length ? row.playerId !== starters[0] : out.has(row.playerId)));
    if (!rows.length || !usable || contradicted) continue;
    const rest = rows.filter(row => !out.has(row.playerId)), restMass = rest.reduce((sum, row) => sum + row.startProbability!, 0);
    const notes = group.map(mark => providerStartNote(mark.player.name, mark.status));
    for (const row of rows) {
      // Unrounded, so the team-game's chances still sum to at most 1.
      const probability = starters.length ? row.playerId === starters[0] ? 1 : 0
        : out.has(row.playerId) ? 0 : restMass > 0 ? row.startProbability! / restMass : row.startProbability!;
      changed.set(row, { ...row, startProbability: probability,
        confirmedStart: starters.length ? row.playerId === starters[0] : row.confirmedStart,
        stats: Object.fromEntries(Object.keys(row.stats).map(target => {
          const line = row.conditionalStats![target];
          return [target, line === null ? null : round(line * probability)];
        })),
        limitations: [...row.limitations, ...notes] });
    }
  }
  return changed.size ? forecasts.map(row => changed.get(row) ?? row) : forecasts;
}
