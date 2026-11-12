// lib/config/statsMasterList.ts
import { formatToMMSS } from "./formatToMMSS";

export interface StatDefinition {
  key: string;
  /** Default display name for table headers (e.g., 'G', 'A', 'SV%') */
  displayName: string;
  shortDisplayName?: string;
  dataType: "numeric" | "text" | "percentage";
  /** True if a higher value of this stat is generally considered better */
  higherIsBetter: boolean;
  /** True if this stat applies to goalies */
  isGoalieStat: boolean;
  isSkaterStat: boolean;
  decimalPlaces?: number;
  defaultVisible?: boolean;
  /** Optional: Category for grouping stats in UI (e.g., "Standard", "Advanced", "Power Play") */
  category?: string;
  /** Input stat keys for values derived after source aggregation. */
  derivedFrom?: readonly string[];
  formatter?: (value: number | null | undefined) => string;
}

export const STATS_MASTER_LIST: StatDefinition[] = [
  // --- Common Skater & Goalie Stats ---
  {
    key: "GAMES_PLAYED",
    displayName: "GP",
    dataType: "numeric",
    higherIsBetter: true,
    isSkaterStat: true,
    isGoalieStat: true,
    defaultVisible: true,
    category: "Standard",
  },

  // --- Skater Stats ---
  {
    key: "SHOOTING_PERCENTAGE",
    displayName: "SH%",
    dataType: "percentage",
    higherIsBetter: true,
    isSkaterStat: true,
    isGoalieStat: false,
    decimalPlaces: 3,
    category: "Standard",
  },
  {
    key: "FACEOFF_PERCENTAGE",
    displayName: "FO%",
    dataType: "percentage",
    higherIsBetter: true,
    isSkaterStat: true,
    isGoalieStat: false,
    decimalPlaces: 3,
    category: "Faceoffs",
  },
  {
    key: "GAME_WINNING_GOALS",
    displayName: "GWG",
    dataType: "numeric",
    higherIsBetter: true,
    isSkaterStat: true,
    isGoalieStat: false,
    category: "Standard",
  },
  {
    key: "GOALS",
    displayName: "G",
    dataType: "numeric",
    higherIsBetter: true,
    isSkaterStat: true,
    isGoalieStat: false,
    defaultVisible: true,
    category: "Standard",
  },
  {
    key: "DEFENSE_POINTS",
    displayName: "DPTS",
    dataType: "numeric",
    higherIsBetter: true,
    isSkaterStat: true,
    isGoalieStat: false,
    defaultVisible: false,
    category: "Derived",
  },
  {
    key: "ASSISTS",
    displayName: "A",
    dataType: "numeric",
    higherIsBetter: true,
    isSkaterStat: true,
    isGoalieStat: false,
    defaultVisible: true,
    category: "Standard",
  },
  {
    key: "POINTS",
    displayName: "P",
    dataType: "numeric",
    higherIsBetter: true,
    isSkaterStat: true,
    isGoalieStat: false,
    defaultVisible: true,
    category: "Standard",
  },
  {
    key: "PLUS_MINUS",
    displayName: "+/-",
    dataType: "numeric",
    higherIsBetter: true, // Higher is better (e.g. +20 is better than -10)
    isSkaterStat: true,
    isGoalieStat: false,
    defaultVisible: true,
    category: "Standard",
  },
  {
    key: "SHOTS_ON_GOAL",
    displayName: "SOG",
    dataType: "numeric",
    higherIsBetter: true,
    isSkaterStat: true,
    isGoalieStat: false,
    defaultVisible: true,
    category: "Standard",
  },
  {
    key: "HITS",
    displayName: "HIT",
    dataType: "numeric",
    higherIsBetter: true,
    isSkaterStat: true,
    isGoalieStat: false,
    defaultVisible: true,
    category: "Standard",
  },
  {
    key: "BLOCKED_SHOTS",
    displayName: "BLK",
    dataType: "numeric",
    higherIsBetter: true,
    isSkaterStat: true,
    isGoalieStat: false,
    defaultVisible: true,
    category: "Standard",
  },
  {
    key: "PENALTY_MINUTES",
    displayName: "PIM",
    dataType: "numeric",
    higherIsBetter: true, // For display/common understanding, more is more; fantasy value can vary.
    isSkaterStat: true,
    isGoalieStat: false,
    defaultVisible: true,
    category: "Standard",
  },
  {
    key: "PP_POINTS",
    displayName: "PPP",
    dataType: "numeric",
    higherIsBetter: true,
    isSkaterStat: true,
    isGoalieStat: false,
    defaultVisible: true,
    category: "Power Play",
  },

  {
    key: "PP_GOALS",
    displayName: "PPG",
    dataType: "numeric",
    higherIsBetter: true,
    isSkaterStat: true,
    isGoalieStat: false,
    defaultVisible: false, // Often part of PPP, can be enabled
    category: "Power Play",
  },
  {
    key: "PP_ASSISTS",
    displayName: "PPA",
    dataType: "numeric",
    higherIsBetter: true,
    isSkaterStat: true,
    isGoalieStat: false,
    defaultVisible: false, // Often part of PPP, can be enabled
    category: "Power Play",
  },

  {
    key: "SH_POINTS",
    displayName: "SHP",
    dataType: "numeric",
    higherIsBetter: true,
    isSkaterStat: true,
    isGoalieStat: false,
    category: "Short Handed",
  },
  {
    key: "SH_GOALS",
    displayName: "SHG",
    dataType: "numeric",
    higherIsBetter: true,
    isSkaterStat: true,
    isGoalieStat: false,
    defaultVisible: false,
    category: "Short Handed",
  },
  {
    key: "SH_ASSISTS",
    displayName: "SHA",
    dataType: "numeric",
    higherIsBetter: true,
    isSkaterStat: true,
    isGoalieStat: false,
    defaultVisible: false,
    category: "Short Handed",
    derivedFrom: ["SH_POINTS", "SH_GOALS"],
  },
  {
    key: "TIME_ON_ICE_PER_GAME",
    displayName: "TOI/G",
    dataType: "numeric",
    higherIsBetter: true,
    isSkaterStat: true,
    isGoalieStat: false,
    decimalPlaces: 2,
    category: "Ice Time",
    formatter: formatToMMSS,
  },
  {
    key: "FACEOFFS_WON",
    displayName: "FOW",
    dataType: "numeric",
    higherIsBetter: true,
    isSkaterStat: true,
    isGoalieStat: false,
    category: "Faceoffs",
  },
  {
    key: "FACEOFFS_LOST",
    displayName: "FOL",
    dataType: "numeric",
    higherIsBetter: false,
    isSkaterStat: true,
    isGoalieStat: false,
    category: "Faceoffs",
  },

  // --- Goalie Stats ---
  {
    key: "GAMES_STARTED_GOALIE",
    displayName: "GS",
    dataType: "numeric",
    higherIsBetter: true,
    isGoalieStat: true,
    isSkaterStat: false,
    defaultVisible: true,
    category: "Standard Goalie",
  },
  {
    key: "WINS_GOALIE",
    displayName: "W",
    dataType: "numeric",
    higherIsBetter: true,
    isGoalieStat: true,
    isSkaterStat: false,
    defaultVisible: true,
    category: "Standard Goalie",
  },
  {
    key: "LOSSES_GOALIE",
    displayName: "L",
    dataType: "numeric",
    higherIsBetter: false,
    isGoalieStat: true,
    isSkaterStat: false,
    defaultVisible: true,
    category: "Standard Goalie",
  },
  {
    key: "OTL_GOALIE",
    displayName: "OTL",
    dataType: "numeric",
    higherIsBetter: false,
    isGoalieStat: true,
    isSkaterStat: false,
    category: "Standard Goalie",
  }, // Overtime Losses
  {
    key: "SAVES_GOALIE",
    displayName: "SV",
    dataType: "numeric",
    higherIsBetter: true,
    isGoalieStat: true,
    isSkaterStat: false,
    defaultVisible: true,
    category: "Standard Goalie",
  },
  {
    key: "SHOTS_AGAINST_GOALIE",
    displayName: "SA",
    dataType: "numeric",
    higherIsBetter: false,
    isGoalieStat: true,
    isSkaterStat: false,
    category: "Standard Goalie",
  },
  {
    key: "GOALS_AGAINST_GOALIE",
    displayName: "GA",
    dataType: "numeric",
    higherIsBetter: false,
    isGoalieStat: true,
    isSkaterStat: false,
    defaultVisible: true,
    category: "Standard Goalie",
  },
  {
    key: "GOALS_AGAINST_AVERAGE",
    displayName: "GAA",
    dataType: "numeric",
    higherIsBetter: false,
    isGoalieStat: true,
    isSkaterStat: false,
    decimalPlaces: 2,
    defaultVisible: true,
    category: "Standard Goalie",
  },
  {
    key: "SAVE_PERCENTAGE",
    displayName: "SV%",
    dataType: "percentage",
    higherIsBetter: true,
    isGoalieStat: true,
    isSkaterStat: false,
    decimalPlaces: 3,
    defaultVisible: true,
    category: "Standard Goalie",
  },
  {
    key: "SHUTOUTS_GOALIE",
    displayName: "SO",
    dataType: "numeric",
    higherIsBetter: true,
    isGoalieStat: true,
    isSkaterStat: false,
    defaultVisible: true,
    category: "Standard Goalie",
  },
];

// Helper function to get a stat definition by its key
export const getStatDefinition = (key: string): StatDefinition | undefined =>
  STATS_MASTER_LIST.find((stat) => stat.key === key);

// ---------------------------------------------------------------------------
// Category stat registry (owner decision 55; audit BC W1-12 D6).
// One place for a category's role, default direction and counting/ratio type.
// Every category reader (category value, standings, Draft Pro reports and
// scenarios, RSO, social) takes role and direction from here. A league's own
// direction (Yahoo `sort_order`, ESPN reverse flag) is passed as an override;
// it is never inferred from a key list elsewhere.
// ---------------------------------------------------------------------------

export type StatRole = "skater" | "goalie" | "shared";
export type StatDirection = "higher" | "lower";

/**
 * A ratio category's components. `numerator` and `denominator` are counting
 * keys; the rate is `scale × Σnumerator ÷ Σdenominator`. A denominator listed
 * as several keys is their sum (faceoff attempts = won + lost). Units:
 * SV%, SH% and FO% are fractions (0–1); GAA is per 60 minutes with TOTAL_TOI
 * in seconds; TIME_ON_ICE_PER_GAME uses TOTAL_TOI seconds per game played.
 */
export interface RatioComponents {
  numerator: string;
  denominator: readonly string[];
  scale: number;
  /** True when a supplied rate value may be used with one known component. */
  rateUnitsDeclared: boolean;
}

export interface CategoryRegistryEntry {
  key: string;
  role: StatRole;
  direction: StatDirection;
  aggregation: "count" | "ratio";
  ratio?: RatioComponents;
}

const RATIO_COMPONENTS: Record<string, RatioComponents> = {
  SAVE_PERCENTAGE: {
    numerator: "SAVES_GOALIE",
    denominator: ["SHOTS_AGAINST_GOALIE"],
    scale: 1,
    rateUnitsDeclared: true,
  },
  GOALS_AGAINST_AVERAGE: {
    numerator: "GOALS_AGAINST_GOALIE",
    denominator: ["TOTAL_TOI"],
    scale: 3600,
    rateUnitsDeclared: true,
  },
  SHOOTING_PERCENTAGE: {
    numerator: "GOALS",
    denominator: ["SHOTS_ON_GOAL"],
    scale: 1,
    rateUnitsDeclared: false,
  },
  FACEOFF_PERCENTAGE: {
    numerator: "FACEOFFS_WON",
    denominator: ["FACEOFFS_WON", "FACEOFFS_LOST"],
    scale: 1,
    rateUnitsDeclared: false,
  },
  TIME_ON_ICE_PER_GAME: {
    numerator: "TOTAL_TOI",
    denominator: ["GAMES_PLAYED"],
    scale: 1,
    rateUnitsDeclared: false,
  },
};

/** Keys used by readers that are not display columns in STATS_MASTER_LIST. */
const EXTRA_REGISTRY_ENTRIES: CategoryRegistryEntry[] = [
  { key: "TOTAL_TOI", role: "shared", direction: "higher", aggregation: "count" },
];

/** Alternative spellings readers and provider maps use for the same stat. */
const REGISTRY_ALIASES: Record<string, string> = {
  GAMES_STARTED: "GAMES_STARTED_GOALIE",
  TOI_PER_GAME: "TIME_ON_ICE_PER_GAME",
};

const CATEGORY_REGISTRY: ReadonlyMap<string, CategoryRegistryEntry> = new Map(
  [
    ...STATS_MASTER_LIST.map((stat): CategoryRegistryEntry => {
      const ratio = RATIO_COMPONENTS[stat.key];
      return {
        key: stat.key,
        role:
          stat.isGoalieStat && stat.isSkaterStat
            ? "shared"
            : stat.isGoalieStat
              ? "goalie"
              : "skater",
        direction: stat.higherIsBetter ? "higher" : "lower",
        aggregation: ratio ? "ratio" : "count",
        ...(ratio ? { ratio } : {}),
      };
    }),
    ...EXTRA_REGISTRY_ENTRIES,
  ].map((entry) => [entry.key, entry]),
);

export function canonicalStatKey(key: string): string {
  return REGISTRY_ALIASES[key] ?? key;
}

/** Registry entry for a category key (aliases resolved), or null if unknown. */
export function getCategoryRegistryEntry(
  key: string,
): CategoryRegistryEntry | null {
  const canonical = canonicalStatKey(key);
  const entry = CATEGORY_REGISTRY.get(canonical);
  if (entry) return entry;
  // Provider keys with the goalie suffix are goalie counting stats.
  if (canonical.endsWith("_GOALIE")) {
    return { key: canonical, role: "goalie", direction: "higher", aggregation: "count" };
  }
  return null;
}

export function statAppliesToRole(key: string, role: "skater" | "goalie") {
  const entry = getCategoryRegistryEntry(key);
  // Unknown keys are treated as skater categories (the provider maps only
  // emit goalie keys with the _GOALIE suffix or a registry entry).
  const statRole = entry?.role ?? "skater";
  return statRole === "shared" || statRole === role;
}

/**
 * Effective direction of a category in one league. `overrides` carries the
 * league's own provider direction (decision 55); a legacy negative category
 * weight (written by older provider adapters) reverses the default. The
 * weight's magnitude is importance only.
 */
export function resolveStatDirection(
  key: string,
  options: { overrides?: Readonly<Record<string, StatDirection>>; weight?: number } = {},
): StatDirection {
  const override = options.overrides?.[key] ?? options.overrides?.[canonicalStatKey(key)];
  if (override === "higher" || override === "lower") return override;
  const base = getCategoryRegistryEntry(key)?.direction ?? "higher";
  if (typeof options.weight === "number" && options.weight < 0) {
    return base === "higher" ? "lower" : "higher";
  }
  return base;
}

export function isLowerBetterStat(
  key: string,
  options?: { overrides?: Readonly<Record<string, StatDirection>>; weight?: number },
) {
  return resolveStatDirection(key, options) === "lower";
}
