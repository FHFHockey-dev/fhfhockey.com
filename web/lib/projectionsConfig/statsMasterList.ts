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
    category: "Standard"
  },

  // --- Skater Stats ---
  {
    key: "GOALS",
    displayName: "G",
    dataType: "numeric",
    higherIsBetter: true,
    isSkaterStat: true,
    isGoalieStat: false,
    defaultVisible: true,
    category: "Standard"
  },
  {
    key: "ASSISTS",
    displayName: "A",
    dataType: "numeric",
    higherIsBetter: true,
    isSkaterStat: true,
    isGoalieStat: false,
    defaultVisible: true,
    category: "Standard"
  },
  {
    key: "POINTS",
    displayName: "P",
    dataType: "numeric",
    higherIsBetter: true,
    isSkaterStat: true,
    isGoalieStat: false,
    defaultVisible: true,
    category: "Standard"
  },
  {
    key: "PLUS_MINUS",
    displayName: "+/-",
    dataType: "numeric",
    higherIsBetter: false,
    isSkaterStat: true,
    isGoalieStat: false,
    defaultVisible: true,
    category: "Standard"
  }, // Note: lower is generally better for fantasy
  {
    key: "SHOTS_ON_GOAL",
    displayName: "SOG",
    dataType: "numeric",
    higherIsBetter: true,
    isSkaterStat: true,
    isGoalieStat: false,
    defaultVisible: true,
    category: "Standard"
  },
  {
    key: "HITS",
    displayName: "HIT",
    dataType: "numeric",
    higherIsBetter: true,
    isSkaterStat: true,
    isGoalieStat: false,
    defaultVisible: true,
    category: "Standard"
  },
  {
    key: "BLOCKED_SHOTS",
    displayName: "BLK",
    dataType: "numeric",
    higherIsBetter: true,
    isSkaterStat: true,
    isGoalieStat: false,
    defaultVisible: true,
    category: "Standard"
  },
  {
    key: "PENALTY_MINUTES",
    displayName: "PIM",
    dataType: "numeric",
    higherIsBetter: false,
    isSkaterStat: true,
    isGoalieStat: false,
    defaultVisible: true,
    category: "Standard"
  }, // Lower PIM can be better in some formats, but for display, more is more. Sorting will handle.
  {
    key: "PP_POINTS",
    displayName: "PPP",
    dataType: "numeric",
    higherIsBetter: true,
    isSkaterStat: true,
    isGoalieStat: false,
    defaultVisible: true,
    category: "Power Play"
  },

  {
    key: "SH_POINTS",
    displayName: "SHP",
    dataType: "numeric",
    higherIsBetter: true,
    isSkaterStat: true,
    isGoalieStat: false,
    category: "Short Handed"
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
    formatter: formatToMMSS
  },
  {
    key: "FACEOFFS_WON",
    displayName: "FOW",
    dataType: "numeric",
    higherIsBetter: true,
    isSkaterStat: true,
    isGoalieStat: false,
    category: "Faceoffs"
  },
  {
    key: "FACEOFFS_LOST",
    displayName: "FOL",
    dataType: "numeric",
    higherIsBetter: false,
    isSkaterStat: true,
    isGoalieStat: false,
    category: "Faceoffs"
  },

  // --- Goalie Stats ---
  {
    key: "WINS_GOALIE",
    displayName: "W",
    dataType: "numeric",
    higherIsBetter: true,
    isGoalieStat: true,
    isSkaterStat: false,
    defaultVisible: true,
    category: "Standard Goalie"
  },
  {
    key: "LOSSES_GOALIE",
    displayName: "L",
    dataType: "numeric",
    higherIsBetter: false,
    isGoalieStat: true,
    isSkaterStat: false,
    defaultVisible: true,
    category: "Standard Goalie"
  },
  {
    key: "OTL_GOALIE",
    displayName: "OTL",
    dataType: "numeric",
    higherIsBetter: false,
    isGoalieStat: true,
    isSkaterStat: false,
    category: "Standard Goalie"
  }, // Overtime Losses
  {
    key: "SAVES_GOALIE",
    displayName: "SV",
    dataType: "numeric",
    higherIsBetter: true,
    isGoalieStat: true,
    isSkaterStat: false,
    defaultVisible: true,
    category: "Standard Goalie"
  },
  {
    key: "SHOTS_AGAINST_GOALIE",
    displayName: "SA",
    dataType: "numeric",
    higherIsBetter: false,
    isGoalieStat: true,
    isSkaterStat: false,
    category: "Standard Goalie"
  },
  {
    key: "GOALS_AGAINST_GOALIE",
    displayName: "GA",
    dataType: "numeric",
    higherIsBetter: false,
    isGoalieStat: true,
    isSkaterStat: false,
    defaultVisible: true,
    category: "Standard Goalie"
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
    category: "Standard Goalie"
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
    category: "Standard Goalie"
  },
  {
    key: "SHUTOUTS_GOALIE",
    displayName: "SO",
    dataType: "numeric",
    higherIsBetter: true,
    isGoalieStat: true,
    isSkaterStat: false,
    defaultVisible: true,
    category: "Standard Goalie"
  }
];

// Helper function to get a stat definition by its key
export const getStatDefinition = (key: string): StatDefinition | undefined =>
  STATS_MASTER_LIST.find((stat) => stat.key === key);
