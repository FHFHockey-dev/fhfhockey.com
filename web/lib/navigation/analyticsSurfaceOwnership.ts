export type AnalyticsSurfaceId =
  | "uls-landing"
  | "uls-team-explorer"
  | "uls-skater-explorer"
  | "uls-goalie-explorer"
  | "trends"
  | "sandbox";

export type AnalyticsSurfaceContract = {
  id: AnalyticsSurfaceId;
  href: string;
  label: string;
  shortLabel: string;
  pillar: "uls" | "trends" | "sandbox";
  purpose: string;
  owns: readonly string[];
  defers: readonly string[];
};

export type AnalyticsGlossaryTermId =
  | "rating"
  | "trend"
  | "baseline"
  | "sustainability-state"
  | "source-provenance";

export const ANALYTICS_SURFACE_CONTRACTS = [
  {
    id: "uls-landing",
    href: "/underlying-stats",
    label: "Underlying Stats Dashboard",
    shortLabel: "ULS Landing",
    pillar: "uls",
    purpose:
      "Own the team-intelligence snapshot: what the current team profile means, which strengths look real, how schedule context changes the read, and where model or market signals belong beside the snapshot.",
    owns: [
      "Team-first quality and process diagnosis",
      "Current offensive, defensive, and team-strength reads",
      "Past and future strength-of-schedule context",
      "Snapshot-era model and market context tied to today's board"
    ],
    defers: [
      "Movement-first recent-form storytelling",
      "Sustainability lab experimentation and threshold-band exploration"
    ]
  },
  {
    id: "uls-team-explorer",
    href: "/underlying-stats/teamStats",
    label: "Team Table Explorer",
    shortLabel: "Team Explorer",
    pillar: "uls",
    purpose:
      "Own the raw filtered team table explorer for counts, rates, score states, venues, and opponent-context slicing after the landing page establishes the team thesis.",
    owns: [
      "Filtered team table exploration across seasons and contexts",
      "Raw team counts/rates validation after the dashboard read"
    ],
    defers: [
      "Primary team-intelligence storytelling",
      "Recent-movement ownership that belongs on Trends"
    ]
  },
  {
    id: "uls-skater-explorer",
    href: "/underlying-stats/playerStats",
    label: "Skater Stats",
    shortLabel: "Skater Stats",
    pillar: "uls",
    purpose:
      "Own the skater advanced-metrics explorer where offensive and defensive ratings, usage context, and table-level player comparisons are reviewed.",
    owns: [
      "Skater offensive and defensive rating exploration",
      "Raw skater table comparison and player drill-in"
    ],
    defers: [
      "League-wide movement storytelling",
      "Entity sustainability classification and threshold-band narratives"
    ]
  },
  {
    id: "uls-goalie-explorer",
    href: "/underlying-stats/goalieStats",
    label: "Goalie Stats",
    shortLabel: "Goalie Stats",
    pillar: "uls",
    purpose:
      "Own the goalie advanced-metrics explorer where goalie ratings, workload context, and table-level goalie comparisons are reviewed.",
    owns: [
      "Goalie rating exploration and goalie-specific table comparisons",
      "Goalie drill-in after the team landing sets the matchup context"
    ],
    defers: [
      "Movement-first hot/cold workflow",
      "Cross-entity sustainability meter ownership"
    ]
  },
  {
    id: "trends",
    href: "/trends",
    label: "Trends Dashboard",
    shortLabel: "Trends",
    pillar: "trends",
    purpose:
      "Own movement and directionality for teams, skaters, and goalies through rolling windows, risers/fallers, recent-form context, and projection-vs-form staging.",
    owns: [
      "Team, skater, and goalie movement reads",
      "Rolling-average directionality and hot/cold scanning",
      "Recent-form context that supports slate and projection workflows"
    ],
    defers: [
      "Snapshot-first team diagnosis",
      "Sustainability-band interpretation that belongs in Sandbox"
    ]
  },
  {
    id: "sandbox",
    href: "/trendsSandbox",
    label: "Sustainability Sandbox",
    shortLabel: "Sandbox",
    pillar: "sandbox",
    purpose:
      "Own the sustainability-meter lab for teams, skaters, and goalies by comparing rolling output against baseline expectation bands and highlighting overperformance or underperformance.",
    owns: [
      "Baseline-vs-recent expectation analysis",
      "Threshold-band and sustainability-state interpretation",
      "Prototype sustainability concepts before production promotion"
    ],
    defers: [
      "Primary team-quality storytelling",
      "General movement scanning that belongs on Trends"
    ]
  }
] as const satisfies readonly AnalyticsSurfaceContract[];

export const ANALYTICS_GLOSSARY = [
  {
    id: "rating",
    label: "Rating",
    definition:
      "A current snapshot score that summarizes quality within an entity class rather than recent movement by itself."
  },
  {
    id: "trend",
    label: "Trend",
    definition:
      "A rolling movement read that describes direction and momentum over a recent window instead of a static season-total snapshot."
  },
  {
    id: "baseline",
    label: "Baseline",
    definition:
      "The expectation anchor built from season-long and longer-horizon context before recent rolling output is judged."
  },
  {
    id: "sustainability-state",
    label: "Sustainability State",
    definition:
      "The overperforming, underperforming, or stable classification produced by comparing current output against baseline expectation bands."
  },
  {
    id: "source-provenance",
    label: "Source Provenance",
    definition:
      "The recorded origin, freshness, and fallback rank of lineup, goalie, injury, odds, props, or model inputs."
  }
] as const satisfies ReadonlyArray<{
  id: AnalyticsGlossaryTermId;
  label: string;
  definition: string;
}>;

export const UNDERLYING_STATS_NAV_LINKS = ANALYTICS_SURFACE_CONTRACTS.filter(
  (surface) =>
    surface.id === "uls-skater-explorer" ||
    surface.id === "uls-goalie-explorer" ||
    surface.id === "uls-team-explorer"
).map((surface) => ({
  href: surface.href,
  label: surface.shortLabel
}));

export const getAnalyticsSurfaceContract = (
  surfaceId: AnalyticsSurfaceId
): AnalyticsSurfaceContract =>
  ANALYTICS_SURFACE_CONTRACTS.find((surface) => surface.id === surfaceId) ??
  ANALYTICS_SURFACE_CONTRACTS[0];
