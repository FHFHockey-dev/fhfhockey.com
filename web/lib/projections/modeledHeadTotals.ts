// Shared missing-head contract for FORGE skater projection readers (A-08, AF-05).
//
// ES, PP and PK are modeled heads: a null head is unknown (withheld), so any
// total that needs it is unknown rather than a partial sum (rules 5 and 13).
// Which heads a total needs depends on the row's strength accounting
// (version-aware admission, AF-05):
// - "pk_head": the all-situations contract. The row's strength accounting says
//   `es_definition: "even_strength"`, or the row carries any PK head. Totals
//   are ES + PP + PK, and a missing PK head withholds every total that needs it.
// - "pk_unmodelled": the row has no PK bucket and its ES head holds all non-PP
//   time, with PK time at ES rates: rows written before the PK bucket
//   (9cf384ff4), a team whose PK exposure is unknown
//   (`es_definition: "all_non_pp_time"`) and FORGE reserve lines (the reserve
//   rows carry no PK columns). Totals are ES + PP and
//   readers label them with SKATER_PK_BASIS_NOTES, never as an
//   all-situations total.
// PP-only totals (ppPoints) need only the PP heads.

export const SKATER_PK_BASES = ["pk_head", "pk_unmodelled"] as const;
export type SkaterPkBasis = (typeof SKATER_PK_BASES)[number];

/** Reader labels for each basis; the "pk_unmodelled" note must travel with the totals. */
export const SKATER_PK_BASIS_NOTES: Record<SkaterPkBasis, string> = {
  pk_head: "Even-strength, power-play and penalty-kill heads.",
  pk_unmodelled:
    "Penalty kill not modelled: the even-strength head covers all non-power-play time at even-strength rates.",
};

/** ES + PP + PK under the all-situations contract: any missing head makes the sum unknown. */
export const sumModeledHeads = (
  es: number | null | undefined,
  pp: number | null | undefined,
  pk: number | null | undefined,
): number | null =>
  es == null || pp == null || pk == null ? null : es + pp + pk;

const sumKnownHeads = (
  first: number | null | undefined,
  second: number | null | undefined,
): number | null => (first == null || second == null ? null : first + second);

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
  /** FORGE skater uncertainty; `model.skater_selection.strength_accounting` is the version marker. */
  uncertainty?: unknown;
};

export type SkaterModeledHeadTotals = {
  goals: number | null;
  assists: number | null;
  points: number | null;
  shots: number | null;
  ppPoints: number | null;
  /** How PK entered goals, assists, points and shots (AF-05). */
  pkBasis: SkaterPkBasis;
};

const esDefinitionOf = (uncertainty: unknown): string | null => {
  const esDefinition = (uncertainty as {
    model?: { skater_selection?: { strength_accounting?: { es_definition?: unknown } } };
  } | null)?.model?.skater_selection?.strength_accounting?.es_definition;
  return typeof esDefinition === "string" ? esDefinition : null;
};

export const resolveSkaterPkBasis = (row: SkaterModeledHeadRow): SkaterPkBasis => {
  const esDefinition = esDefinitionOf(row.uncertainty);
  if (esDefinition === "even_strength") return "pk_head";
  if (esDefinition === "all_non_pp_time") return "pk_unmodelled";
  return row.proj_goals_pk != null ||
    row.proj_assists_pk != null ||
    row.proj_shots_pk != null
    ? "pk_head"
    : "pk_unmodelled";
};

export const buildSkaterModeledHeadTotals = (
  row: SkaterModeledHeadRow,
): SkaterModeledHeadTotals => {
  const pkBasis = resolveSkaterPkBasis(row);
  const total = (
    es: number | null | undefined,
    pp: number | null | undefined,
    pk: number | null | undefined,
  ) => (pkBasis === "pk_head" ? sumModeledHeads(es, pp, pk) : sumKnownHeads(es, pp));
  const goals = total(row.proj_goals_es, row.proj_goals_pp, row.proj_goals_pk);
  const assists = total(
    row.proj_assists_es,
    row.proj_assists_pp,
    row.proj_assists_pk,
  );
  return {
    goals,
    assists,
    points: sumKnownHeads(goals, assists),
    shots: total(row.proj_shots_es, row.proj_shots_pp, row.proj_shots_pk),
    ppPoints: sumKnownHeads(row.proj_goals_pp, row.proj_assists_pp),
    pkBasis,
  };
};

type KnownModeledHeadTotals = SkaterModeledHeadTotals & {
  [K in Exclude<keyof SkaterModeledHeadTotals, "pkBasis">]: number;
};

export const hasKnownModeledHeadTotals = (
  totals: SkaterModeledHeadTotals,
): totals is KnownModeledHeadTotals =>
  totals.goals != null &&
  totals.assists != null &&
  totals.points != null &&
  totals.shots != null &&
  totals.ppPoints != null;
