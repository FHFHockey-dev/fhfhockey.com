import supabaseServer from "./supabase/server";

export type SpecialTeamTier = 1 | 2 | 3;

export type RatingComponents = {
  xgf60: number;
  gf60: number;
  sf60: number;
  xga60: number;
  ga60: number;
  sa60: number;
  pace60: number;
};

export type TeamRating = {
  teamAbbr: string;
  date: string;
  offRating: number;
  defRating: number;
  paceRating: number;
  ppTier: SpecialTeamTier;
  pkTier: SpecialTeamTier;
  trend10: number;
  components: RatingComponents;
  finishingRating: number | null;
  goalieRating: number | null;
  dangerRating: number | null;
  specialRating: number | null;
  disciplineRating: number | null;
  varianceFlag: number | null;
};

type CacheEntry = {
  expiresAt: number;
  payload: TeamRating[];
};

const CACHE_TTL_MS = Number(process.env.TEAM_RATINGS_CACHE_TTL_MS ?? 60_000);
const cache = new Map<string, CacheEntry>();

const buildCacheKey = (date: string, teamAbbr?: string): string =>
  [date, teamAbbr ?? ""].join("|");

const mapRowToTeamRating = (row: Record<string, unknown>): TeamRating => ({
  teamAbbr: String(row.team_abbreviation),
  date: String(row.date),
  offRating: Number(row.off_rating),
  defRating: Number(row.def_rating),
  paceRating: Number(row.pace_rating),
  ppTier: Number(row.pp_tier) as SpecialTeamTier,
  pkTier: Number(row.pk_tier) as SpecialTeamTier,
  trend10: Number(row.trend10),
  components: {
    xgf60: Number(row.xgf60),
    gf60: Number(row.gf60),
    sf60: Number(row.sf60),
    xga60: Number(row.xga60),
    ga60: Number(row.ga60),
    sa60: Number(row.sa60),
    pace60: Number(row.pace60)
  },
  finishingRating:
    row.finishing_rating !== undefined && row.finishing_rating !== null
      ? Number(row.finishing_rating)
      : null,
  goalieRating:
    row.goalie_rating !== undefined && row.goalie_rating !== null
      ? Number(row.goalie_rating)
      : null,
  dangerRating:
    row.danger_rating !== undefined && row.danger_rating !== null
      ? Number(row.danger_rating)
      : null,
  specialRating:
    row.special_rating !== undefined && row.special_rating !== null
      ? Number(row.special_rating)
      : null,
  disciplineRating:
    row.discipline_rating !== undefined && row.discipline_rating !== null
      ? Number(row.discipline_rating)
      : null,
  varianceFlag:
    row.variance_flag !== undefined && row.variance_flag !== null
      ? Number(row.variance_flag)
      : null
});

export const isValidIsoDate = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(value);

export const fetchTeamRatings = async (
  date: string,
  teamAbbr?: string
): Promise<TeamRating[]> => {
  const normalizedTeamAbbr = teamAbbr?.toUpperCase();
  const cacheKey = buildCacheKey(date, normalizedTeamAbbr);
  const cached = cache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.payload;
  }

  const supabase = supabaseServer;

  const coreColumns = [
    "team_abbreviation",
    "date",
    "off_rating",
    "def_rating",
    "pace_rating",
    "pp_tier",
    "pk_tier",
    "trend10",
    "xgf60",
    "gf60",
    "sf60",
    "xga60",
    "ga60",
    "sa60",
    "pace60"
  ];

  const extendedColumns = [
    "finishing_rating",
    "goalie_rating",
    "danger_rating",
    "special_rating",
    "discipline_rating",
    "variance_flag"
  ];

  const selectColumns = (includeExtended: boolean): string =>
    includeExtended
      ? [...coreColumns, ...extendedColumns].join(",")
      : coreColumns.join(",");

  const runQuery = async (
    tableName: "team_power_ratings_daily" | "team_power_ratings_daily__new",
    includeExtended: boolean
  ) => {
    let query = supabase
      .from(tableName)
      .select(selectColumns(includeExtended))
      .eq("date", date)
      .order("off_rating", { ascending: false })
      .order("team_abbreviation", { ascending: true });

    if (normalizedTeamAbbr) {
      query = query.eq("team_abbreviation", normalizedTeamAbbr);
    }

    return query;
  };

  const isMissingColumnError = (err: { message?: string } | null): boolean =>
    Boolean(
      err?.message &&
        err.message.includes("column") &&
        err.message.includes("does not exist")
    );

  const isMissingRelationError = (err: { message?: string } | null): boolean =>
    Boolean(
      err?.message &&
        err.message.includes("does not exist") &&
        (err.message.includes("relation") || err.message.includes("table"))
    );

  const tablesWithExtended: Array<
    "team_power_ratings_daily" | "team_power_ratings_daily__new"
  > = ["team_power_ratings_daily", "team_power_ratings_daily__new"];

  let data: unknown[] | null = null;
  let error: { message?: string } | null = null;
  let fetchedExtended = false;

  for (const tableName of tablesWithExtended) {
    const response = await runQuery(tableName, true);
    data = response.data;
    error = response.error;

    if (!error) {
      fetchedExtended = true;
      break;
    }

    if (isMissingRelationError(error) || isMissingColumnError(error)) {
      data = null;
      error = null;
      continue;
    }

    throw error;
  }

  if (!fetchedExtended) {
    const fallbackResponse = await runQuery(
      "team_power_ratings_daily",
      false
    );
    data = fallbackResponse.data;
    error = fallbackResponse.error;

    if (error) {
      throw error;
    }
  }

  const rows = Array.isArray(data) ? data : [];
  const payload = rows.map((row) =>
    mapRowToTeamRating(row as unknown as Record<string, unknown>)
  );

  cache.set(cacheKey, { payload, expiresAt: Date.now() + CACHE_TTL_MS });
  return payload;
};

export const clearTeamRatingsCache = (): void => {
  cache.clear();
};
