// Shared missing-head contract for FORGE skater projection readers (A-08).
//
// ES and PP are modeled heads: a null head is unknown (withheld), so any total
// that needs it is unknown rather than a partial sum. PK is not modeled
// (writers store null) and adds nothing until it is.

export const sumModeledHeads = (
  es: number | null | undefined,
  pp: number | null | undefined,
  pk: number | null | undefined = null,
): number | null =>
  es == null || pp == null ? null : es + pp + (pk ?? 0);

export type SkaterModeledHeadRow = {
  proj_goals_es?: number | null;
  proj_goals_pp?: number | null;
  proj_goals_pk?: number | null;
  proj_assists_es?: number | null;
  proj_assists_pp?: number | null;
  proj_assists_pk?: number | null;
  proj_shots_es?: number | null;
  proj_shots_pp?: number | null;
  proj_shots_pk?: number | null;
};

export type SkaterModeledHeadTotals = {
  goals: number | null;
  assists: number | null;
  points: number | null;
  shots: number | null;
  ppPoints: number | null;
};

export const buildSkaterModeledHeadTotals = (
  row: SkaterModeledHeadRow,
): SkaterModeledHeadTotals => {
  const goals = sumModeledHeads(
    row.proj_goals_es,
    row.proj_goals_pp,
    row.proj_goals_pk,
  );
  const assists = sumModeledHeads(
    row.proj_assists_es,
    row.proj_assists_pp,
    row.proj_assists_pk,
  );
  return {
    goals,
    assists,
    points: goals == null || assists == null ? null : goals + assists,
    shots: sumModeledHeads(
      row.proj_shots_es,
      row.proj_shots_pp,
      row.proj_shots_pk,
    ),
    ppPoints: sumModeledHeads(row.proj_goals_pp, row.proj_assists_pp),
  };
};

export const hasKnownModeledHeadTotals = (
  totals: SkaterModeledHeadTotals,
): totals is { [K in keyof SkaterModeledHeadTotals]: number } =>
  totals.goals != null &&
  totals.assists != null &&
  totals.points != null &&
  totals.shots != null &&
  totals.ppPoints != null;
