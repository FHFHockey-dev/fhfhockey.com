import { describe, expect, it } from "vitest";

import { STRENGTH_VERSION } from "../supabase/Upserts/nhlRawGamecenter.mjs";
import {
  assertBuildableXgFeatureVersion,
  CURRENT_XG_FEATURE_STRENGTH_VERSION,
  CURRENT_XG_FEATURE_VERSION,
} from "./featureVersion";

describe("xG feature-version contract (rule 21)", () => {
  it("tracks the event layer's strength version: an L1 bump without an xG feature bump fails here", () => {
    expect(CURRENT_XG_FEATURE_STRENGTH_VERSION).toBe(STRENGTH_VERSION);
  });

  it("refuses to rebuild the champion's feature version 1 under the new definitions", () => {
    expect(() => assertBuildableXgFeatureVersion({ featureVersion: 1, strengthVersion: 1 })).toThrow("read-only history");
    expect(() => assertBuildableXgFeatureVersion({ featureVersion: 1, strengthVersion: 2 })).toThrow("read-only history");
  });

  it("refuses the current feature version from old PBP strength rows", () => {
    expect(() => assertBuildableXgFeatureVersion({ featureVersion: CURRENT_XG_FEATURE_VERSION, strengthVersion: 1 })).toThrow(
      "strength_version 2"
    );
    expect(() => assertBuildableXgFeatureVersion({ featureVersion: CURRENT_XG_FEATURE_VERSION, strengthVersion: 2 })).not.toThrow();
  });
});
