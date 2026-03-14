import type { RatioComponents } from "./rollingMetricAggregation";
import { resolvePreferredShareComponents } from "./rollingPlayerMetricMath";

export type RollingPlayerPpContextRow = {
  gameId: number;
  playerId: number;
  PPTOI: number | null;
  unit: number | null;
  pp_share_of_team: number | null;
  pp_unit_usage_index: number | null;
  pp_unit_relative_toi: number | null;
  pp_vs_unit_avg: number | null;
};

type PowerPlayCombinationSourceRow = RollingPlayerPpContextRow & {
  percentageOfPP?: number | null;
  pp_unit_usage_index?: number | null;
  pp_unit_relative_toi?: number | null;
  pp_vs_unit_avg?: number | null;
};

export const ROLLING_PLAYER_PP_SHARE_CONTRACT = {
  metricKey: "pp_share_pct",
  semanticType: "team_power_play_share",
  description: "Player share of total team power-play TOI over the selected scope.",
  authoritativeSource: {
    numeratorField: "powerPlayCombinations.PPTOI",
    shareField: "powerPlayCombinations.pp_share_of_team"
  },
  fallbackSource: {
    numeratorField: "wgo_skater_stats.pp_toi",
    shareField: "wgo_skater_stats.pp_toi_pct_per_game"
  },
  explicitlyExcludedUnitRelativeFields: [
    "powerPlayCombinations.percentageOfPP",
    "powerPlayCombinations.pp_unit_usage_index",
    "powerPlayCombinations.pp_unit_relative_toi",
    "powerPlayCombinations.pp_vs_unit_avg"
  ],
  contextualFields: ["powerPlayCombinations.unit"],
  optionalContextFields: [
    "powerPlayCombinations.pp_share_of_team",
    "powerPlayCombinations.pp_unit_usage_index",
    "powerPlayCombinations.pp_unit_relative_toi",
    "powerPlayCombinations.pp_vs_unit_avg"
  ],
  storagePolicy: "single_team_share_contract_with_fallback"
} as const;

export function toRollingPlayerPpContextRow(
  row: PowerPlayCombinationSourceRow
): RollingPlayerPpContextRow {
  return {
    gameId: row.gameId,
    playerId: row.playerId,
    PPTOI: row.PPTOI ?? null,
    unit: row.unit ?? null,
    pp_share_of_team: row.pp_share_of_team ?? null,
    pp_unit_usage_index: row.pp_unit_usage_index ?? null,
    pp_unit_relative_toi: row.pp_unit_relative_toi ?? null,
    pp_vs_unit_avg: row.pp_vs_unit_avg ?? null
  };
}

export function resolvePpShareComponents(args: {
  builderPlayerPpToi: number | null | undefined;
  builderTeamShare: number | null | undefined;
  wgoPlayerPpToi?: number | null | undefined;
  wgoTeamShare?: number | null | undefined;
}): RatioComponents | null {
  // `pp_share_pct` stores team-share semantics only. Builder-derived
  // `pp_share_of_team` is authoritative because it directly represents the
  // player's share of total team PP TOI. WGO can reconstruct the same contract
  // when builder coverage is missing, but unit-relative fields such as
  // `percentageOfPP` are not valid substitutes for this metric.
  return resolvePreferredShareComponents({
    primaryNumeratorValue: args.builderPlayerPpToi,
    primaryShare: args.builderTeamShare,
    fallbackNumeratorValue: args.wgoPlayerPpToi,
    fallbackShare: args.wgoTeamShare
  });
}

export function resolvePlayerPpToiSeconds(args: {
  strength: "all" | "ev" | "pp" | "pk";
  builderPlayerPpToi: number | null | undefined;
  wgoPlayerPpToi?: number | null | undefined;
}): number | null {
  if (args.strength !== "all" && args.strength !== "pp") {
    return null;
  }

  if (args.builderPlayerPpToi != null) {
    return args.builderPlayerPpToi;
  }

  return args.wgoPlayerPpToi ?? null;
}
