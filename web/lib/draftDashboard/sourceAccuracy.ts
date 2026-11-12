import type { ProcessedPlayer } from "hooks/useProcessedProjectionsData";
import { competitionRanks } from "utils/projectionsRanking";

/**
 * Retrospective source comparison (W2-5 D1, §1.2). Not wired into any page:
 * it compares the currently loaded source values with season-to-date actuals
 * and makes no preseason-vintage or held-out claim.
 *
 * - Like with like: counting stats are compared per game ("perGame") or as
 *   the season-to-date total against the source's projection pro-rated to
 *   actual games played ("proratedTotal"); rate stats compare directly.
 *   Season-to-date totals are never compared with full-season totals, and
 *   games played (workload) is not scored here.
 * - Proper score (decision 65): mean squared error per stat, in that stat's
 *   own units. No cross-stat composite, no percentage-error floor.
 * - Common support: within a stat, every source is scored on the same
 *   players (those every source supplying that stat projected). A source's
 *   missing projections are reported as unmatched, never as better accuracy.
 */
export type SourceAccuracyMode = "perGame" | "proratedTotal";

export type SourceStatAccuracy = {
  statKey: string;
  statLabel: string;
  sourceName: string;
  /** Players with a known actual (and, for counting stats, known games). */
  universePlayers: number;
  /** Players in the common support every supplying source is scored on. */
  comparedPlayers: number;
  /** Universe players this source did not project. */
  unmatchedPlayers: number;
  meanSquaredError: number | null;
  /** Competition rank by mean squared error within the stat (1 = lowest). */
  rank: number | null;
};

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isRateStat = (key: string, dataType?: string) =>
  dataType === "percentage" ||
  /(?:PER_GAME|PER_60|AVERAGE|PERCENTAGE|_PCT|RATE)/.test(key);

const isGamesStat = (key: string) =>
  key === "GAMES_PLAYED" || /GAMES.*GOALIE/.test(key);

type Observation = { actual: number; bySource: Map<string, number> };

export function calculateSourceAccuracy(
  players: ProcessedPlayer[],
  mode: SourceAccuracyMode
): SourceStatAccuracy[] {
  const allSources = new Set<string>();
  const stats = new Map<
    string,
    { label: string; observations: Observation[]; suppliers: Set<string> }
  >();

  for (const player of players) {
    const gamesStat =
      player.combinedStats.GAMES_PLAYED ??
      player.combinedStats.GAMES_GOALIE ??
      player.combinedStats.GAMES_PLAYED_GOALIE;
    const actualGames = gamesStat?.actual;
    const projectedGamesBySource = new Map<string, number>();
    for (const source of gamesStat?.projectedDetail?.contributingSources ?? []) {
      if (finite(source.value) && source.value > 0) {
        projectedGamesBySource.set(source.name, source.value);
      }
    }

    for (const [statKey, stat] of Object.entries(player.combinedStats)) {
      for (const source of stat?.projectedDetail?.contributingSources ?? []) {
        if (finite(source.value)) allSources.add(source.name);
      }
      if (isGamesStat(statKey)) continue;
      const definition = stat?.projectedDetail?.statDefinition;
      const entry = stats.get(statKey) ?? {
        label: definition?.displayName ?? statKey,
        observations: [],
        suppliers: new Set<string>()
      };
      stats.set(statKey, entry);

      const rate = isRateStat(statKey, definition?.dataType);
      if (!finite(stat.actual)) continue;
      if (!rate && !(finite(actualGames) && actualGames > 0)) continue;

      const actual =
        rate || mode === "proratedTotal"
          ? stat.actual
          : stat.actual / (actualGames as number);
      const bySource = new Map<string, number>();
      for (const source of stat.projectedDetail?.contributingSources ?? []) {
        if (!finite(source.value)) continue;
        let prediction = source.value;
        if (!rate) {
          const projectedGames = projectedGamesBySource.get(source.name);
          if (!finite(projectedGames)) continue;
          prediction =
            mode === "perGame"
              ? source.value / projectedGames
              : (source.value * (actualGames as number)) / projectedGames;
        }
        bySource.set(source.name, prediction);
        entry.suppliers.add(source.name);
      }
      entry.observations.push({ actual, bySource });
    }
  }

  const rows: SourceStatAccuracy[] = [];
  const sourceNames = Array.from(allSources).sort((a, b) => a.localeCompare(b));
  for (const statKey of Array.from(stats.keys()).sort()) {
    const { label, observations, suppliers } = stats.get(statKey)!;
    const common = observations.filter((observation) =>
      Array.from(suppliers).every((name) => observation.bySource.has(name))
    );
    const statRows = sourceNames.map((sourceName): SourceStatAccuracy => {
      const scored = suppliers.has(sourceName) ? common : [];
      const meanSquaredError = scored.length
        ? scored.reduce(
            (sum, observation) =>
              sum + (observation.bySource.get(sourceName)! - observation.actual) ** 2,
            0
          ) / scored.length
        : null;
      return {
        statKey,
        statLabel: label,
        sourceName,
        universePlayers: observations.length,
        comparedPlayers: scored.length,
        unmatchedPlayers: observations.filter(
          (observation) => !observation.bySource.has(sourceName)
        ).length,
        meanSquaredError,
        rank: null
      };
    });
    const ranks = competitionRanks(
      statRows.map((row) =>
        row.meanSquaredError == null ? null : -row.meanSquaredError
      )
    );
    statRows.forEach((row, index) => {
      row.rank = ranks[index];
    });
    rows.push(
      ...statRows.sort(
        (a, b) =>
          (a.rank ?? Infinity) - (b.rank ?? Infinity) ||
          a.sourceName.localeCompare(b.sourceName)
      )
    );
  }
  return rows;
}
