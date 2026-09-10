import { describe, expect, it } from "vitest";

import { getDraftProFeatureFlags } from "./features";

describe("Draft Pro feature flags", () => {
  it("defaults every flag to false and keeps capabilities independent", () => {
    expect(getDraftProFeatureFlags({})).toEqual({
      checkout: false,
      recommendations: false,
      dust: false,
      blended_csv: false,
      saved_drafts: false,
      private_imports: false,
      scenarios: false,
      reports: false,
      god_view: false,
    });
    expect(getDraftProFeatureFlags({ DRAFT_PRO_GOD_VIEW_ENABLED: "true" }).god_view).toBe(true);
    expect(getDraftProFeatureFlags({ DRAFT_PRO_DUST_ENABLED: "true" })).toMatchObject({
      dust: true,
      recommendations: false,
      scenarios: false,
    });
  });

  it("requires Saved Drafts for private imports and rejects malformed values", () => {
    expect(getDraftProFeatureFlags({
      DRAFT_PRO_PRIVATE_IMPORTS_ENABLED: "true",
      DRAFT_PRO_PRIVATE_IMPORTS_ENABLED_EXTRA: "true",
    }).private_imports).toBe(false);
    expect(getDraftProFeatureFlags({
      DRAFT_PRO_SAVED_DRAFTS_ENABLED: "true",
      DRAFT_PRO_PRIVATE_IMPORTS_ENABLED: "TRUE",
    }).private_imports).toBe(false);
    expect(getDraftProFeatureFlags({
      DRAFT_PRO_SAVED_DRAFTS_ENABLED: "true",
      DRAFT_PRO_PRIVATE_IMPORTS_ENABLED: "true",
    }).private_imports).toBe(true);
  });
});
