/**
 * Version-aware goaltending labels for team power ratings (Astra #434 P1, lane F16).
 *
 * `goalie_rating` is 5-on-5 goaltending only on verified v4 rows (decision 145).
 * v3 rows measure all situations; legacy carries keep their 2025-26 source date
 * (decision 150); a missing or unrecognised version is unverified. A non-v4 value
 * is never labelled 5v5. Pure module: client components import it directly.
 */

/** Must equal the writer's TEAM_POWER_RATING_CALCULATION_VERSION (tested). */
export const TEAM_POWER_V4_VERSION = "team-power-v4-5v5-goaltending";
export const TEAM_POWER_V3_VERSION =
  "team-power-v3-all-team-baseline-prior-after-norm-pooled-st";
export const TEAM_POWER_LEGACY_VERSION = "legacy_unversioned";

/** Absent fields mean "unverified": never 5v5. */
export type TeamPowerVersionFields = {
  /** team_power_ratings_daily.calculation_version; null when not recorded. */
  calculationVersion?: string | null;
  /** team_power_ratings_daily.source_through_date (last game the row reflects). */
  sourceThroughDate?: string | null;
};

export type GoaltendingScope =
  | "v4_5v5"
  | "v3_all_situations"
  | "legacy_carry"
  | "unverified";

export type GoaltendingBasis = {
  scope: GoaltendingScope;
  is5v5: boolean;
  /** Short per-row marker: "5v5", "all sit. · v3", "carried · Aug 29", "unverified". */
  tag: string;
  /** Phrase for labels, e.g. "Goalie (all situations, v3)". */
  note: string;
  /** Full sentence for tooltips and popovers. */
  detail: string;
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec"
];

const parseIsoDate = (
  value: string | null | undefined
): { year: number; month: number; day: number } | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? "");
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
};

/** "2026-08-29" -> "Aug 29" (no time zone shift). */
export const formatSourceMonthDay = (
  value: string | null | undefined
): string | null => {
  const parsed = parseIsoDate(value);
  return parsed ? `${MONTHS[parsed.month - 1]} ${parsed.day}` : null;
};

/** NHL season of a date: September onwards starts the next season. "2026-08-29" -> "2025-26". */
export const seasonLabelForDate = (
  value: string | null | undefined
): string | null => {
  const parsed = parseIsoDate(value);
  if (!parsed) return null;
  const startYear = parsed.month >= 9 ? parsed.year : parsed.year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
};

const describeLegacyCarry = (
  sourceThroughDate: string | null | undefined
): GoaltendingBasis => {
  const parsed = parseIsoDate(sourceThroughDate);
  const monthDay = formatSourceMonthDay(sourceThroughDate);
  const season = seasonLabelForDate(sourceThroughDate);
  if (!parsed || !monthDay || !season) {
    return {
      scope: "legacy_carry",
      is5v5: false,
      tag: "carried",
      note: "carried · source date unknown",
      detail:
        "Carried forward from an earlier stored rating with no recorded calculation version or source date. Not a 5-on-5 value."
    };
  }
  return {
    scope: "legacy_carry",
    is5v5: false,
    tag: `carried · ${monthDay}`,
    note: `carried from ${season} · as of ${monthDay}`,
    detail: `Carried from ${season}: the last stored rating, calculated through ${monthDay}, ${parsed.year}, with no recorded calculation version. Not a 5-on-5 value.`
  };
};

export const describeGoaltendingBasis = (
  row: TeamPowerVersionFields
): GoaltendingBasis => {
  switch (row.calculationVersion) {
    case TEAM_POWER_V4_VERSION:
      return {
        scope: "v4_5v5",
        is5v5: true,
        tag: "5v5",
        note: "5-on-5, empty-net goals excluded",
        detail:
          "5-on-5 goaltending: expected minus actual goals against at 5-on-5, empty-net goals excluded."
      };
    case TEAM_POWER_V3_VERSION:
      return {
        scope: "v3_all_situations",
        is5v5: false,
        tag: "all sit. · v3",
        note: "all situations, v3",
        detail:
          "All-situations goaltending (v3 calculation): expected minus actual goals against in all situations, empty-net goals included. Not a 5-on-5 value."
      };
    case TEAM_POWER_LEGACY_VERSION:
      return describeLegacyCarry(row.sourceThroughDate);
    default:
      return {
        scope: "unverified",
        is5v5: false,
        tag: "unverified",
        note: "version unverified",
        detail:
          "Calculation version not recorded or not recognised, so this is not a verified 5-on-5 value."
      };
  }
};

export type GoaltendingColumnBasis =
  | { kind: "uniform"; basis: GoaltendingBasis }
  | { kind: "mixed" }
  | { kind: "empty" };

/**
 * One basis for a view's goaltending column when every shown value shares it;
 * "mixed" means each value must carry its own label. Rows without a value
 * make no claim and are ignored.
 */
export const summarizeGoaltendingBasis = (
  rows: readonly (TeamPowerVersionFields & { goalieRating?: number | null })[]
): GoaltendingColumnBasis => {
  let first: GoaltendingBasis | null = null;
  for (const row of rows) {
    if (row.goalieRating == null || !Number.isFinite(row.goalieRating)) continue;
    const basis = describeGoaltendingBasis(row);
    if (!first) {
      first = basis;
    } else if (basis.note !== first.note) {
      return { kind: "mixed" };
    }
  }
  return first ? { kind: "uniform", basis: first } : { kind: "empty" };
};

export type GoaltendingColumnLabel = {
  /** "5v5 <noun>" only when every shown value is verified v4; otherwise the bare noun. */
  label: string;
  /** Shared non-5v5 basis to print with the header; null when 5v5, mixed or empty. */
  qualifier: GoaltendingBasis | null;
  /** True when each value must show its own tag. */
  perRowTags: boolean;
  title: string;
};

export const goaltendingColumnLabel = (
  column: GoaltendingColumnBasis,
  noun: string
): GoaltendingColumnLabel => {
  if (column.kind === "uniform") {
    return column.basis.is5v5
      ? {
          label: `5v5 ${noun}`,
          qualifier: null,
          perRowTags: false,
          title: column.basis.detail
        }
      : {
          label: noun,
          qualifier: column.basis,
          perRowTags: false,
          title: column.basis.detail
        };
  }
  if (column.kind === "mixed") {
    return {
      label: noun,
      qualifier: null,
      perRowTags: true,
      title:
        "Goaltending calculations differ by team in this view; each value carries its own label. Only values marked 5v5 are 5-on-5."
    };
  }
  return {
    label: noun,
    qualifier: null,
    perRowTags: false,
    title: "Goaltending: expected minus actual goals against."
  };
};
