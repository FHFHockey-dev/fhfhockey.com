export const ROLLING_PLAYER_PP_UNIT_CONTRACT = {
  labelKey: "pp_unit",
  semanticType: "contextual_power_play_unit_label",
  description:
    "Contextual PP unit label sourced from the PP combinations builder. Not a rolling metric.",
  authoritativeSource: {
    unitField: "powerPlayCombinations.unit"
  },
  freshnessDependencies: ["powerPlayCombinations"],
  validationRequirements: [
    "Validate pp_unit against refreshed powerPlayCombinations rows for the same player/game window.",
    "Do not infer pp_unit from pp_share_pct, PPTOI, or WGO PP usage fields.",
    "Treat null or non-positive unit values as untrusted contextual labels."
  ],
  staleRefreshActions: [
    "Rerun update-power-play-combinations/[gameId].ts for affected validation games before trusting pp_unit.",
    "If builder rows are broadly stale, rerun the PP combinations refresh workflow before revalidating rolling rows."
  ]
} as const;

export function hasTrustedPpUnitContext(args: {
  originalGameId: number | null | undefined;
  unit: number | null | undefined;
}): boolean {
  return (
    typeof args.originalGameId === "number" &&
    typeof args.unit === "number" &&
    Number.isInteger(args.unit) &&
    args.unit > 0
  );
}

export function resolvePpUnitLabel(args: {
  originalGameId: number | null | undefined;
  unit: number | null | undefined;
}): number | null {
  return hasTrustedPpUnitContext(args) ? args.unit ?? null : null;
}
