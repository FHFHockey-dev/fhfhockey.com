import { UNKNOWN_EVIDENCE, defineShareModule, type SharePostLoadResult } from "./contract";
import type { GoalieConfirmation, GoalieGameSignals, GoalieInventory, InventoryMetric } from "./shared/goalieInventory";
import { confirmationLabel, confirmationLegend, inventoryEvidence, isUpcomingGame, metricLabel, type GoalieInventoryDetail, type InventoryConflict } from "./shared/goalieInventory.sources";

/**
 * Risky Starts (SS 11.0, SS-R14) mirrors Cherry-Picked Matchups from the goalie's chair: one tile per team-night, a pairing
 * of the opponent's rate against this team's, flagged when both sit in the league's top third. Each lens is read alone.
 */
export const RISKY_LENSES = ["volume", "ratio", "win"] as const;
export type RiskyLens = typeof RISKY_LENSES[number];
export const RISKY_LENS_LABELS: Record<RiskyLens, string> = { volume: "Volume upside", ratio: "Ratio exposure", win: "Win support" };
const LENS_MEANINGS: Record<RiskyLens, string> = { volume: "more shots to save", ratio: "more danger against", win: "goals in the goalie's favor" };
export const RISKY_CORRELATION_NOTE = "These signals are correlated: shots, xG and chances overlap, and penalties feed all three. Each lens stands alone, flags are never added across lenses, and no win or start odds are given.";
export const RISKY_TILE_LIMIT = 8;

export type RiskyStartsSettings = { days: number; lens: RiskyLens };
export type RiskySide = { team: string; label: string; metric: InventoryMetric; digits: number };
export type RiskyPair = { id: string; label: string; sides: RiskySide[]; flagged: boolean };
export type RiskyGoalie = { goalieId: number; name: string; starts: number | null; teamGames: number; confirmation: GoalieConfirmation };
export type RiskyRow = { gameId: number; date: string; startTimeUtc: string | null; team: string; opponent: string; home: boolean; teamSecondNight: boolean | null; opponentSecondNight: boolean | null; conflicting: boolean; goalies: RiskyGoalie[]; lenses: Record<RiskyLens, RiskyPair[]> };
export type RiskyStartsData = { from: string; through: string; rows: RiskyRow[]; confirmationLegend: string };

const topThird = ({ leagueRank, leagueCohort }: InventoryMetric) => leagueRank !== null && leagueCohort !== null && leagueRank <= Math.ceil(leagueCohort / 3);
const bottomThird = ({ leagueRank, leagueCohort }: InventoryMetric) => leagueRank !== null && leagueCohort !== null && leagueRank > leagueCohort - Math.ceil(leagueCohort / 3);

/** Every pairing for one side of a game. Mirror the two teams and each pairing's sides swap to the other team's rates. */
export function riskyPairs(team: string, opponent: string, { volume, ratioExposure: ratio, winSupport: win }: GoalieGameSignals): Record<RiskyLens, RiskyPair[]> {
  const pair = (id: string, label: string, flagged: boolean, ...sides: [string, string, InventoryMetric, number][]): RiskyPair => ({ id, label, flagged, sides: sides.map(([owner, name, metric, digits]) => ({ team: owner, label: name, metric, digits })) });
  return {
    volume: [pair("shots", "Shots", topThird(volume.opponentShotsForPerGame) && topThird(volume.teamShotsAgainstPerGame), [opponent, "SF/GP", volume.opponentShotsForPerGame, 1], [team, "SA/GP", volume.teamShotsAgainstPerGame, 1])],
    ratio: [
      pair("xg", "xG", topThird(ratio.opponentXgfPerGame) && topThird(ratio.teamXgaPerGame), [opponent, "xGF/GP", ratio.opponentXgfPerGame, 2], [team, "xGA/GP", ratio.teamXgaPerGame, 2]),
      pair("chances", "Chances", topThird(ratio.opponentScoringChancesPerGame) && topThird(ratio.teamScoringChancesAgainstPerGame), [opponent, "SCF/GP", ratio.opponentScoringChancesPerGame, 1], [team, "SCA/GP", ratio.teamScoringChancesAgainstPerGame, 1]),
      pair("special-teams", "PP v PK", topThird(ratio.opponentPowerPlayPct) && bottomThird(ratio.teamPenaltyKillPct), [opponent, "PP%", ratio.opponentPowerPlayPct, 1], [team, "PK%", ratio.teamPenaltyKillPct, 1]),
      pair("penalties", "Penalties", topThird(ratio.opponentPowerPlayPct) && topThird(ratio.teamTimesShorthandedPerGame), [opponent, "PP%", ratio.opponentPowerPlayPct, 1], [team, "TSH/GP", ratio.teamTimesShorthandedPerGame, 1]),
    ],
    win: [
      pair("goals", "Goals", topThird(win.teamGoalsForPerGame) && topThird(win.opponentGoalsAgainstPerGame), [team, "GF/GP", win.teamGoalsForPerGame, 2], [opponent, "GA/GP", win.opponentGoalsAgainstPerGame, 2]),
      pair("differential", "Goal diff", topThird(win.teamGoalDifferentialPerGame), [team, "GD/GP", win.teamGoalDifferentialPerGame, 2]),
    ],
  };
}
export function riskyRows(inventory: GoalieInventory, conflicts: readonly InventoryConflict[] = []): RiskyRow[] {
  const rows = new Map<string, RiskyRow>();
  for (const goalie of inventory.goalies) for (const game of goalie.games) {
    if (!isUpcomingGame(game, inventory.generatedAt)) continue;
    const key = `${game.gameId}:${game.team}`;
    const row = rows.get(key) ?? { gameId: game.gameId, date: game.date, startTimeUtc: game.startTimeUtc, team: game.team, opponent: game.opponent, home: game.home, teamSecondNight: game.teamSecondNight, opponentSecondNight: game.opponentSecondNight, conflicting: conflicts.some(item => item.gameId === game.gameId && item.team === game.team), goalies: [], lenses: riskyPairs(game.team, game.opponent, game.signals) };
    row.goalies.push({ goalieId: goalie.goalieId, name: goalie.name, starts: goalie.recentStarts.starts, teamGames: goalie.recentStarts.teamGames, confirmation: game.confirmation });
    rows.set(key, row);
  }
  return [...rows.values()];
}
export const riskyFlags = (row: RiskyRow, lens: RiskyLens) => row.lenses[lens].filter(pair => pair.flagged).length;
/** Team-nights with a flagged pairing in this lens alone, most flags first. Another lens never moves a row. */
export const riskyRowsForLens = (rows: readonly RiskyRow[], lens: RiskyLens) => rows.filter(row => riskyFlags(row, lens) > 0)
  .sort((a, b) => riskyFlags(b, lens) - riskyFlags(a, lens) || a.date.localeCompare(b.date) || a.gameId - b.gameId || a.team.localeCompare(b.team));
export const riskyLensMeaning = (lens: RiskyLens) => LENS_MEANINGS[lens];

export function riskyStartsResult({ inventory, coverage, conflicts }: GoalieInventoryDetail): SharePostLoadResult<RiskyStartsData> {
  if (inventory.state === "missing") return { state: "missing", reasons: [...inventory.reasons], evidence: UNKNOWN_EVIDENCE, data: null };
  const rows = riskyRows(inventory, conflicts), cohort = rows[0]?.lenses.volume[0].sides[0].metric.leagueCohort ?? null;
  return {
    state: inventory.state, reasons: inventory.state === "ready" ? [] : [...inventory.reasons],
    data: { from: inventory.from, through: inventory.through, rows, confirmationLegend: confirmationLegend(inventory) },
    teams: [...new Set(rows.flatMap(row => [row.team, row.opponent]))].sort(),
    evidence: inventoryEvidence({ inventory, coverage }, `${rows.length} team-nights in the window; ranks ${cohort === null ? "withheld without a complete league" : `over all ${cohort} teams`}. ${RISKY_CORRELATION_NOTE}`, rows.length),
  };
}

export const riskyStartsModule = defineShareModule<RiskyStartsSettings, RiskyStartsData>({
  id: "risky-starts", title: "Risky Starts", summary: "Goalie matchups by volume upside, ratio exposure and win support, as three separate lenses.", group: "goalies", basis: "observed",
  suggestedUse: "Works before a busy night, or for a week's goalie planning.",
  fields: [
    { id: "days", label: "Days ahead", kind: "number", default: 7, min: 1, max: 14, step: 1 },
    { id: "lens", label: "Lens", kind: "select", default: "ratio", clientOnly: true, options: RISKY_LENSES.map(value => ({ value, label: RISKY_LENS_LABELS[value] })) },
  ],
  load: () => import("./riskyStarts.sources").then(sources => sources.loadRiskyStarts),
  card: () => import("components/SocialShare/modules/RiskyStartsCard").then(card => card.default),
  hasRows: (data, settings) => riskyRowsForLens(data.rows, settings.lens).length > 0,
  altText: (snapshot, data, settings) => {
    const rows = riskyRowsForLens(data.rows, settings.lens), side = (pair: RiskyPair) => pair.sides.map(item => `${item.team} ${item.label} ${metricLabel(item.metric, item.digits)}`).join(" against ");
    return `FHFH Risky Starts, ${RISKY_LENS_LABELS[settings.lens]}, ${data.from} to ${data.through}. ${rows.slice(0, RISKY_TILE_LIMIT).map(row => `${row.team} ${row.home ? "vs" : "at"} ${row.opponent} on ${row.date}: ${row.lenses[settings.lens].filter(pair => pair.flagged).map(side).join("; ")}. Goalies: ${row.goalies.map(goalie => `${goalie.name}, ${confirmationLabel(goalie.confirmation, row.conflicting)}`).join(", ")}`).join(". ")}. ${RISKY_CORRELATION_NOTE} ${snapshot.evidence.sample}.`;
  },
});
