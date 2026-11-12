import type {
  ProcessedPlayer,
  TableDataRow
} from "hooks/useProcessedProjectionsData";
import { fantasyPointsComplete } from "lib/draftDashboard/fantasyPointRecalculation";

type RankSide = "projected" | "actual";

export interface ProjectionRankOptions {
  /**
   * True when skater and goalie fantasy points come from one points-league
   * scoring configuration, so an overall rank compares like with like
   * (decision 115). Otherwise only within-position ranks are shown.
   */
  sharedPointsScoring: boolean;
  skaterPointValues: Record<string, number>;
  goaliePointValues: Record<string, number>;
}

/**
 * Competition ranks (1, 2, 2, 4), highest score first. Non-finite scores are
 * unranked (null). The result depends only on the scores, never on order.
 */
export function competitionRanks(
  scores: ReadonlyArray<number | null | undefined>
): Array<number | null> {
  const ranked = scores
    .map((score, index) => ({ score, index }))
    .filter(
      (entry): entry is { score: number; index: number } =>
        typeof entry.score === "number" && Number.isFinite(entry.score)
    )
    .sort((a, b) => b.score - a.score);
  const ranks: Array<number | null> = scores.map(() => null);
  ranked.forEach((entry, position) => {
    const previous = ranked[position - 1];
    ranks[entry.index] =
      previous && previous.score === entry.score
        ? ranks[previous.index]
        : position + 1;
  });
  return ranks;
}

/** First listed position (C, LW, RW, D, G), or null when unknown. */
export function primaryPosition(
  displayPosition: string | null | undefined
): string | null {
  const first = String(displayPosition ?? "")
    .split(/[,/]/)[0]
    ?.trim()
    .toUpperCase();
  return first ? first : null;
}

const hasNonZeroScoring = (pointValues: Record<string, number>) =>
  Object.values(pointValues).some(
    (value) => typeof value === "number" && Number.isFinite(value) && value !== 0
  );

/**
 * Overall and within-position ranks for the projections page. Returns new
 * player objects; the caller's players are never mutated (W3-1 D2).
 */
export function assignGlobalRanks(
  skaters: ProcessedPlayer[],
  goalies: ProcessedPlayer[],
  options: ProjectionRankOptions
): ProcessedPlayer[] {
  const entries = [
    ...skaters.map((player) => ({ player, pointValues: options.skaterPointValues })),
    ...goalies.map((player) => ({ player, pointValues: options.goaliePointValues }))
  ];
  const overallComparable =
    options.sharedPointsScoring &&
    hasNonZeroScoring(options.skaterPointValues) &&
    hasNonZeroScoring(options.goaliePointValues);
  const positions = entries.map(({ player }) => primaryPosition(player.displayPosition));

  const qualifiedScore = (side: RankSide) =>
    entries.map(({ player, pointValues }) =>
      fantasyPointsComplete(player, pointValues, side)
        ? player.fantasyPoints[side]
        : null
    );

  const ranksFor = (side: RankSide) => {
    const scores = qualifiedScore(side);
    const overall = overallComparable
      ? competitionRanks(scores)
      : scores.map(() => null);
    const byPosition: Array<number | null> = scores.map(() => null);
    const groups = new Map<string, number[]>();
    positions.forEach((position, index) => {
      if (!position) return;
      groups.set(position, [...(groups.get(position) ?? []), index]);
    });
    for (const indices of groups.values()) {
      const ranks = competitionRanks(indices.map((index) => scores[index]));
      indices.forEach((index, i) => {
        byPosition[index] = ranks[i];
      });
    }
    return { overall, byPosition };
  };

  const projected = ranksFor("projected");
  const actual = ranksFor("actual");

  return entries.map(({ player }, index) => ({
    ...player,
    projectedRank: projected.overall[index],
    actualRank: actual.overall[index],
    projectedPositionRank: projected.byPosition[index],
    actualPositionRank: actual.byPosition[index],
    rankPosition: positions[index]
  }));
}

/** Copy ranks onto table rows by player id; unknown players stay unranked. */
export function injectRanks(
  rows: TableDataRow[],
  ranked: ProcessedPlayer[]
): TableDataRow[] {
  const byId = new Map(ranked.map((player) => [player.playerId, player]));
  return rows.map((row) => {
    if ("type" in row) return row;
    const master = byId.get(row.playerId);
    return {
      ...row,
      projectedRank: master?.projectedRank ?? null,
      actualRank: master?.actualRank ?? null,
      projectedPositionRank: master?.projectedPositionRank ?? null,
      actualPositionRank: master?.actualPositionRank ?? null,
      rankPosition: master?.rankPosition ?? null
    };
  });
}
