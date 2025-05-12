// /Users/tim/Desktop/fhfhockey.com/web/utils/projectionsRanking.ts

import {
  ProcessedPlayer,
  TableDataRow
} from "hooks/useProcessedProjectionsData";

export function assignGlobalRanks(
  skaters: ProcessedPlayer[],
  goalies: ProcessedPlayer[]
): ProcessedPlayer[] {
  const all = [...skaters, ...goalies];

  all
    .sort(
      (a, b) =>
        (b.fantasyPoints.projected ?? 0) - (a.fantasyPoints.projected ?? 0)
    )
    .forEach((p, i) => (p.projectedRank = i + 1));

  all
    .sort(
      (a, b) => (b.fantasyPoints.actual ?? 0) - (a.fantasyPoints.actual ?? 0)
    )
    .forEach((p, i) => (p.actualRank = i + 1));

  return all;
}

export function injectRanks(
  rows: TableDataRow[],
  ranked: ProcessedPlayer[]
): TableDataRow[] {
  return rows.map((r) => {
    if ("type" in r) return r;
    const p = r as ProcessedPlayer;
    const master = ranked.find((x) => x.playerId === p.playerId)!;
    return {
      ...p,
      projectedRank: master.projectedRank,
      actualRank: master.actualRank
    };
  });
}
