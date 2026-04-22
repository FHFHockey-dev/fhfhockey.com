import { METRIC_SPECS } from "lib/sustainability/bands";

export type SandboxEntityType = "team" | "skater" | "goalie";

export type SandboxMetricDefinition = {
  key: string;
  label: string;
  description: string;
};

export type SandboxEntityConfig = {
  type: SandboxEntityType;
  label: string;
  description: string;
  searchPlaceholder: string;
  readinessCopy: string;
  metrics: SandboxMetricDefinition[];
};

export type SandboxExpectationState =
  | "overperforming"
  | "stable"
  | "underperforming";

export type SandboxScoreRow = {
  entityType: SandboxEntityType;
  entityId: number;
  entityName: string;
  entitySubtitle: string | null;
  teamId: number | null;
  playerId: number | null;
  snapshotDate: string;
  seasonId: number | null;
  metricScope: string;
  windowCode: string;
  baselineValue: number | null;
  recentValue: number | null;
  expectedValue: number | null;
  zScore: number | null;
  rawScore: number;
  score: number;
  expectationState: SandboxExpectationState;
  components: Record<string, unknown>;
  provenance: Record<string, unknown>;
  computedAt: string | null;
};

export type SandboxBandRow = {
  entityType: SandboxEntityType;
  entityId: number;
  entityName: string;
  metricKey: string;
  metricLabel: string;
  windowCode: string;
  snapshotDate: string;
  seasonId: number | null;
  baseline: number | null;
  ewma: number | null;
  value: number;
  ciLower: number;
  ciUpper: number;
  zScore: number | null;
  percentile: number | null;
  exposure: number | null;
  distribution: Record<string, unknown> | null;
  provenance: Record<string, unknown>;
};

export type ReasonHighlight = {
  key: string;
  label: string;
  value: number;
  direction: "positive" | "negative";
  sentence: string;
};

const SKATER_METRICS: SandboxMetricDefinition[] = [
  {
    key: "ixg_per_60",
    label: "ixG / 60",
    description: "Chance creation compared against the skater's baseline expectation."
  },
  {
    key: "shots_per_60",
    label: "Shots / 60",
    description: "Shot volume sustainability over recent rolling windows."
  },
  {
    key: "pp_toi_pct",
    label: "PP TOI %",
    description: "Usage sustainability and deployment drift."
  },
  {
    key: "points_per_60_5v5",
    label: "Points / 60 (5v5)",
    description: "Recent even-strength point production versus expected scoring pace."
  },
  {
    key: "sh_pct",
    label: "Shooting %",
    description: "Finishing sustainability and conversion pressure."
  },
  {
    key: "on_ice_sh_pct",
    label: "On-Ice SH%",
    description: "Team finishing environment around the skater."
  }
];

const TEAM_METRICS: SandboxMetricDefinition[] = [
  {
    key: "xgf_pct",
    label: "xGF%",
    description: "Territorial control versus the club's season expectation."
  },
  {
    key: "scf_pct",
    label: "SCF%",
    description: "Chance-share sustainability within the recent rolling window."
  },
  {
    key: "hdcf_pct",
    label: "HDCF%",
    description: "High-danger chance share relative to team baseline."
  },
  {
    key: "on_ice_sh_pct",
    label: "Team SH%",
    description: "Finishing sustainability for the current team environment."
  },
  {
    key: "on_ice_sv_pct",
    label: "Team SV%",
    description: "Save environment sustainability behind the team structure."
  },
  {
    key: "pdo",
    label: "PDO",
    description: "Combined finishing and save variance against expected levels."
  }
];

const GOALIE_METRICS: SandboxMetricDefinition[] = [
  {
    key: "save_pct",
    label: "Save %",
    description: "Shot-stopping sustainability relative to baseline efficiency."
  },
  {
    key: "quality_starts_pct",
    label: "Quality Starts %",
    description: "Recent quality-start share against expected stability."
  },
  {
    key: "goals_against_avg",
    label: "GAA",
    description: "Goals-against trend relative to expected workload outcome."
  },
  {
    key: "shots_against_per_60",
    label: "Shots Against / 60",
    description: "Workload pressure and shot volume sustainability."
  },
  {
    key: "saves",
    label: "Saves",
    description: "Recent save volume versus historical workload expectation."
  },
  {
    key: "shutouts",
    label: "Shutouts",
    description: "Clean-sheet spike risk relative to baseline expectation."
  }
];

export const SANDBOX_ENTITY_CONFIG: Record<SandboxEntityType, SandboxEntityConfig> =
  {
    team: {
      type: "team",
      label: "Teams",
      description:
        "Use season baseline plus rolling team output to determine whether a club is sustaining current performance.",
      searchPlaceholder: "Select a team",
      readinessCopy:
        "Team sustainability is wired into the unified contract and will read from the cross-entity tables as those rows populate.",
      metrics: TEAM_METRICS
    },
    skater: {
      type: "skater",
      label: "Skaters",
      description:
        "Use rolling production, usage, and finishing pressure to classify whether a skater is sustaining current form.",
      searchPlaceholder: "Search skaters by name",
      readinessCopy:
        "Skater sustainability is live through the legacy production tables while the unified entity contract comes online.",
      metrics: SKATER_METRICS
    },
    goalie: {
      type: "goalie",
      label: "Goalies",
      description:
        "Use workload and save-efficiency bands to test whether a goaltender is sustaining current results.",
      searchPlaceholder: "Search goalies by name",
      readinessCopy:
        "Goalie sustainability is wired into the unified contract and will read from the cross-entity tables as those rows populate.",
      metrics: GOALIE_METRICS
    }
  };

const LEGACY_COMPONENT_LABELS: Record<string, string> = {
  z_ixg60: "Chance creation",
  z_icf60: "Shot volume",
  z_hdcf60: "High-danger creation",
  z_shp: "Shooting percentage",
  z_oishp: "On-ice shooting percentage",
  z_ipp: "IPP",
  z_ppshp: "PP shooting percentage"
};

export function getSandboxMetricLabel(
  entityType: SandboxEntityType,
  metricKey: string
): string {
  const fromEntityConfig = SANDBOX_ENTITY_CONFIG[entityType].metrics.find(
    (metric) => metric.key === metricKey
  );
  if (fromEntityConfig) return fromEntityConfig.label;

  const skaterMetric = (METRIC_SPECS as Record<string, { label?: string }>)[
    metricKey
  ];
  return skaterMetric?.label ?? metricKey;
}

export function deriveLegacyExpectationState(
  rawScore: number
): SandboxExpectationState {
  if (rawScore >= 0.75) return "overperforming";
  if (rawScore <= -0.75) return "underperforming";
  return "stable";
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function humanizeComponentKey(key: string): string {
  return (
    LEGACY_COMPONENT_LABELS[key] ??
    key
      .replace(/^z_/, "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (chunk) => chunk.toUpperCase())
  );
}

export function extractReasonHighlights(
  components: Record<string, unknown> | null | undefined,
  limit = 4
): ReasonHighlight[] {
  if (!components || typeof components !== "object") {
    return [];
  }

  const highlights = Object.entries(components)
    .map(([key, value]) => {
      const numeric = toFiniteNumber(value);
      if (numeric === null) return null;
      const label = humanizeComponentKey(key);
      const direction = numeric >= 0 ? "positive" : "negative";
      return {
        key,
        label,
        value: numeric,
        direction,
        sentence: `${label} is ${numeric >= 0 ? "running above" : "running below"} baseline by ${Math.abs(numeric).toFixed(2)} standard deviations.`
      } satisfies ReasonHighlight;
    })
    .filter((entry): entry is ReasonHighlight => entry != null)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, limit);

  if (highlights.length > 0) {
    return highlights;
  }

  const nestedWeights = components.weights;
  if (
    nestedWeights &&
    typeof nestedWeights === "object" &&
    !Array.isArray(nestedWeights)
  ) {
    return Object.entries(nestedWeights as Record<string, unknown>)
      .flatMap(([groupKey, groupValue]) => {
        if (!groupValue || typeof groupValue !== "object") return [];
        return Object.entries(groupValue as Record<string, unknown>)
          .map(([childKey, childValue]) => {
            const numeric = toFiniteNumber(childValue);
            if (numeric === null) return null;
            const label = `${humanizeComponentKey(groupKey)}: ${humanizeComponentKey(
              childKey
            )}`;
            return {
              key: `${groupKey}.${childKey}`,
              label,
              value: numeric,
              direction: numeric >= 0 ? "positive" : "negative",
              sentence: `${label} carries a ${numeric >= 0 ? "positive" : "negative"} weight of ${Math.abs(numeric).toFixed(2)} in the expectation model.`
            } satisfies ReasonHighlight;
          })
          .filter((entry): entry is ReasonHighlight => entry != null);
      })
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
      .slice(0, limit);
  }

  return [];
}
