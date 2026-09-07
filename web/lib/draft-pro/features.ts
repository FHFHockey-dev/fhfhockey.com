import type { DraftProFeatureFlags } from "./server";

/**
 * Server-only Draft Pro rollout flags. Only the exact string "true" enables a
 * flag; missing, malformed, and client-shaped values fail closed. Private
 * imports depend on Saved Drafts so they cannot be enabled independently.
 */
export const DRAFT_PRO_FEATURE_ENV_NAMES = {
  checkout: "DRAFT_PRO_CHECKOUT_ENABLED",
  recommendations: "DRAFT_PRO_RECOMMENDATIONS_ENABLED",
  dust: "DRAFT_PRO_DUST_ENABLED",
  blended_csv: "DRAFT_PRO_BLENDED_CSV_ENABLED",
  saved_drafts: "DRAFT_PRO_SAVED_DRAFTS_ENABLED",
  private_imports: "DRAFT_PRO_PRIVATE_IMPORTS_ENABLED",
  scenarios: "DRAFT_PRO_SCENARIOS_ENABLED",
  reports: "DRAFT_PRO_REPORTS_ENABLED",
} as const;

export function getDraftProFeatureFlags(
  env: Readonly<Record<string, string | undefined>> = process.env,
): DraftProFeatureFlags {
  const enabled = (name: keyof typeof DRAFT_PRO_FEATURE_ENV_NAMES) =>
    env[DRAFT_PRO_FEATURE_ENV_NAMES[name]] === "true";
  const savedDrafts = enabled("saved_drafts");
  return {
    checkout: enabled("checkout"),
    recommendations: enabled("recommendations"),
    dust: enabled("dust"),
    blended_csv: enabled("blended_csv"),
    saved_drafts: savedDrafts,
    private_imports: savedDrafts && enabled("private_imports"),
    scenarios: enabled("scenarios"),
    reports: enabled("reports"),
  };
}
