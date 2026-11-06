import type { GoalieTrendCategoryId } from "./goalieMetricConfig";
import type { SkaterTrendCategoryId, SkaterWindowSize } from "./skaterMetricConfig";

export type LockedPlayerBaselineMode = "season" | "3ya" | "career" | "all";
export type PlayerQuickViewId = "l7" | "l14" | "l30" | "rolling10";

export const LOCKED_PLAYER_BASELINES = [
  {
    key: "season",
    label: "Season",
    description: "Required current-season baseline for recent-form checks."
  },
  {
    key: "3ya",
    label: "3-Year",
    description: "Stable longer-horizon blend when season context is too thin."
  },
  {
    key: "career",
    label: "Career",
    description: "Required long-term anchor for role and talent checks."
  },
  {
    key: "all",
    label: "Cumulative",
    description: "Full tracked-history average for broader trend context."
  }
] as const satisfies ReadonlyArray<{
  key: LockedPlayerBaselineMode;
  label: string;
  description: string;
}>;

// Reader-facing summary of the baselines the trend views compare against.
export const describeLockedBaselines = () =>
  `Compared with ${new Intl.ListFormat("en", { type: "conjunction" }).format(
    LOCKED_PLAYER_BASELINES.map((baseline) => baseline.label)
  )} baselines`;

export const PLAYER_QUICK_VIEWS = [
  {
    id: "l7",
    label: "L7",
    description: "Average observed game values from the last 7 calendar days."
  },
  {
    id: "l14",
    label: "L14",
    description: "Average observed game values from the last 14 calendar days."
  },
  {
    id: "l30",
    label: "L30",
    description: "Average observed game values from the last 30 calendar days."
  },
  {
    id: "rolling10",
    label: "Rolling 10",
    description: "Latest rolling 10-game value from the trend history."
  }
] as const satisfies ReadonlyArray<{
  id: PlayerQuickViewId;
  label: string;
  description: string;
}>;

type LeaderEntry = {
  playerId: number;
  fullName: string;
  teamAbbrev: string | null;
  position: string | null;
  percentile: number;
  delta: number;
  latestValue: number | null;
};

type SkaterSummaryCard = {
  categoryId: SkaterTrendCategoryId;
  label: string;
  description: string;
  windowLabel: string;
  leaders: LeaderEntry[];
};

type SkaterSummaryInput = {
  categories: Record<string, unknown>;
  playerMetadata: Record<
    string,
    {
      id: number;
      fullName: string;
      position: string | null;
      teamAbbrev: string | null;
      imageUrl: string | null;
    }
  >;
  windowSize: SkaterWindowSize;
};

const RECENT_FORM_SCAN_ORDER: SkaterTrendCategoryId[] = [
  "timeOnIce",
  "shotsPer60",
  "powerPlayTime",
  "ixgPer60"
];

export const formatSkaterTrendWindowLabel = (
  windowSize: SkaterWindowSize
): string => `${windowSize} GP`;

export const isLockedPlayerBaselineMode = (
  value: unknown
): value is LockedPlayerBaselineMode =>
  typeof value === "string" &&
  LOCKED_PLAYER_BASELINES.some((baseline) => baseline.key === value);

export const isPlayerQuickViewId = (value: unknown): value is PlayerQuickViewId =>
  typeof value === "string" &&
  PLAYER_QUICK_VIEWS.some((view) => view.id === value);

// The scan's headline figure is the stat itself (percentiles saturate at 100 for
// every leader). TOI fields arrive as seconds per game.
const formatClock = (seconds: number) => {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

export const formatPercentileOrdinal = (percentile: number): string => {
  const n = Math.round(percentile);
  const lastTwo = n % 100;
  const suffix =
    lastTwo >= 11 && lastTwo <= 13
      ? "th"
      : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
};

export const formatRecentFormValue = (
  categoryId: SkaterTrendCategoryId,
  value: number | null
): { value: string; unit: string } | null => {
  if (value === null || !Number.isFinite(value)) return null;
  switch (categoryId) {
    case "timeOnIce":
      return { value: formatClock(value), unit: "TOI/GP" };
    case "powerPlayTime":
      return { value: formatClock(value), unit: "PP TOI/GP" };
    case "shotsPer60":
      return { value: value.toFixed(1), unit: "shots/60" };
    case "ixgPer60":
      return { value: value.toFixed(2), unit: "ixG/60" };
  }
};

export const formatGoalieTrendValue = (
  categoryId: GoalieTrendCategoryId,
  value: number | null
): { value: string; unit: string } | null => {
  if (value === null || !Number.isFinite(value)) return null;
  switch (categoryId) {
    case "savePct":
      // Hockey style: .921, not 92.1% or 0.921.
      return { value: value.toFixed(3).replace(/^0(?=\.)/, ""), unit: "SV%" };
    case "qualityStartsPct":
      return { value: `${Math.round(value * 100)}%`, unit: "QS" };
    case "goalsAgainstAvg":
      return { value: value.toFixed(2), unit: "GAA" };
    case "saveVolume":
      return { value: value.toFixed(1), unit: "saves/GP" };
  }
};

export const buildSkaterRecentSummaryCards = ({
  categories,
  playerMetadata,
  windowSize
}: SkaterSummaryInput): SkaterSummaryCard[] =>
  RECENT_FORM_SCAN_ORDER.map((categoryId) => {
    const category = categories[categoryId] as
      | {
          rankings?: Array<{
            playerId: number;
            percentile: number;
            delta: number;
            latestValue: number | null;
          }>;
        }
      | undefined;

    const meta = {
      timeOnIce: {
        label: "TOI Deployment",
        description: "Ice-time leaders and movers."
      },
      shotsPer60: {
        label: "Shot Pressure",
        description: "Shot generation rate leaders."
      },
      powerPlayTime: {
        label: "PP Usage",
        description: "Power-play opportunity leaders."
      },
      ixgPer60: {
        label: "Chance Creation",
        description: "Expected-goal generation leaders."
      }
    }[categoryId];

    return {
      categoryId,
      label: meta.label,
      description: meta.description,
      windowLabel: formatSkaterTrendWindowLabel(windowSize),
      // Percentiles tie at 100 for many leaders; break ties on the stat itself so
      // each card reads highest first.
      leaders: [...(category?.rankings ?? [])]
        .sort(
          (a, b) =>
            b.percentile - a.percentile ||
            (b.latestValue ?? -Infinity) - (a.latestValue ?? -Infinity)
        )
        .slice(0, 3)
        .map((row) => {
          const player = playerMetadata[String(row.playerId)];
          return {
            playerId: row.playerId,
            fullName: player?.fullName ?? `Player ${row.playerId}`,
            teamAbbrev: player?.teamAbbrev ?? null,
            position: player?.position ?? null,
            percentile: row.percentile,
            delta: row.delta,
            latestValue: row.latestValue ?? null
          };
        })
    };
  });
