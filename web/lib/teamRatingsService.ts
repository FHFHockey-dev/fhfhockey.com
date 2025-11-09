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
  }
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

  let query = supabase
    .from("team_power_ratings_daily")
    .select(
      [
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
      ].join(",")
    )
    .eq("date", date)
    .order("off_rating", { ascending: false })
    .order("team_abbreviation", { ascending: true });

  if (normalizedTeamAbbr) {
    query = query.eq("team_abbreviation", normalizedTeamAbbr);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
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
