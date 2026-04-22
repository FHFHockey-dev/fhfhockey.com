import type { AnalyticsSurfaceId } from "lib/navigation/analyticsSurfaceOwnership";

export type EdgeEntityClass = "team" | "skater" | "goalie";

export type EdgeMetricCatalogEntry = {
  key: string;
  label: string;
  endpointFamily: string;
  entityClasses: readonly EdgeEntityClass[];
  surfaceIds: readonly AnalyticsSurfaceId[];
  strengths: readonly string[];
  supports: readonly ("ratings" | "movement" | "sustainability-context")[];
  launchFit: "ready-now" | "supporting-context" | "not-baseline-grade";
  notes: string;
};

export const EDGE_METRIC_CATALOG = [
  {
    key: "skater-shot-location-leaders",
    label: "Skater Shot Location Leaders",
    endpointFamily: "/edge/skater-shot-location-top-10/all/{stat}/all/{seasonId}/{gameType}",
    entityClasses: ["skater"],
    surfaceIds: ["uls-skater-explorer", "trends", "sandbox"],
    strengths: ["location finishing context", "shot-volume profile"],
    supports: ["ratings", "movement", "sustainability-context"],
    launchFit: "supporting-context",
    notes:
      "Useful for percentile-style shot profile context, but not reliable enough by itself to replace the existing per-game sustainability baseline pipeline."
  },
  {
    key: "skater-detail",
    label: "Skater Edge Detail",
    endpointFamily: "/edge/skater-detail/{playerId}/{seasonId}/{gameType}",
    entityClasses: ["skater"],
    surfaceIds: ["uls-skater-explorer", "trends", "sandbox"],
    strengths: [
      "top-shot-speed",
      "skating-speed",
      "distance-skated",
      "shot-on-goal summary",
      "zone-time details"
    ],
    supports: ["ratings", "movement", "sustainability-context"],
    launchFit: "ready-now",
    notes:
      "Best single official NHL Edge skater endpoint for augmenting ULS ratings context, Trends movement reads, and Sandbox explanatory overlays."
  },
  {
    key: "team-detail",
    label: "Team Edge Detail",
    endpointFamily: "/edge/team-detail/{teamId}/{seasonId}/{gameType}",
    entityClasses: ["team"],
    surfaceIds: ["uls-landing", "uls-team-explorer", "trends", "sandbox"],
    strengths: [
      "team-shot-speed",
      "team-skating-speed",
      "team-distance-skated",
      "team-shot summary",
      "team-zone-time details"
    ],
    supports: ["ratings", "movement", "sustainability-context"],
    launchFit: "ready-now",
    notes:
      "Strongest official team Edge payload for adding public NHL context without fragmenting the existing team SoS and process modules."
  },
  {
    key: "goalie-detail",
    label: "Goalie Edge Detail",
    endpointFamily: "/edge/goalie-detail/{goalieId}/{seasonId}/{gameType}",
    entityClasses: ["goalie"],
    surfaceIds: ["uls-goalie-explorer", "trends", "sandbox"],
    strengths: ["goalie-stats", "save-location summary", "save-location details"],
    supports: ["ratings", "movement", "sustainability-context"],
    launchFit: "ready-now",
    notes:
      "This closes the biggest official NHL Edge gap in the current context doc because goalie coverage is much lighter than skater and team coverage today."
  }
] as const satisfies readonly EdgeMetricCatalogEntry[];

export const getEdgeMetricsForSurface = (
  surfaceId: AnalyticsSurfaceId
): EdgeMetricCatalogEntry[] =>
  EDGE_METRIC_CATALOG.filter((entry) => entry.surfaceIds.includes(surfaceId));

export const getEdgeMetricsForEntityClass = (
  entityClass: EdgeEntityClass
): EdgeMetricCatalogEntry[] =>
  EDGE_METRIC_CATALOG.filter((entry) =>
    entry.entityClasses.includes(entityClass)
  );

