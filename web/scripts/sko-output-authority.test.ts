import { describe, expect, it } from "vitest";

import {
  getAuthoritativeSkoOutputPath,
  SKO_OUTPUT_ARTIFACT_NAMES,
  SKO_OUTPUT_AUTHORITY,
  validateSkoOutputAuthority,
} from "./sko-output-authority";
import type { SkoOutputAuthority } from "./sko-output-authority";

function copyAuthority(): SkoOutputAuthority {
  return structuredClone(SKO_OUTPUT_AUTHORITY);
}

describe("sKO output authority", () => {
  it("accepts the owner-approved canonical and retained historical roots", () => {
    expect(() => validateSkoOutputAuthority(SKO_OUTPUT_AUTHORITY)).not.toThrow();
    expect(SKO_OUTPUT_AUTHORITY.artifactSets.map(({ root }) => root)).toEqual([
      "scripts/output",
      "web/scripts/output",
    ]);
  });

  it("resolves every supported output beneath the canonical root", () => {
    expect(
      SKO_OUTPUT_ARTIFACT_NAMES.map(getAuthoritativeSkoOutputPath),
    ).toEqual([
      "scripts/output/sko_features.parquet",
      "scripts/output/sko_holdout_predictions.parquet",
      "scripts/output/sko_metrics.parquet",
      "scripts/output/sko_step_timings.csv",
    ]);
  });

  it("rejects authority drift to the nested historical root", () => {
    const authority = copyAuthority();
    Object.assign(authority, {
      authoritativeRoot: "web/scripts/output",
    });

    expect(() => validateSkoOutputAuthority(authority)).toThrow(
      "canonical sKO output root",
    );
  });

  it("rejects ambiguous artifact-set identities", () => {
    const authority = copyAuthority();
    authority.artifactSets[1].id = authority.artifactSets[0].id;

    expect(() => validateSkoOutputAuthority(authority)).toThrow(
      "unique identity",
    );
  });

  it("rejects missing or malformed provenance metadata", () => {
    const missingArtifact = copyAuthority();
    Reflect.deleteProperty(
      missingArtifact.artifactSets[0].artifacts,
      "sko_metrics.parquet",
    );
    expect(() => validateSkoOutputAuthority(missingArtifact)).toThrow(
      "required inventory",
    );

    const invalidHash = copyAuthority();
    invalidHash.artifactSets[0].artifacts["sko_metrics.parquet"].sha256 =
      "unknown";
    expect(() => validateSkoOutputAuthority(invalidHash)).toThrow(
      "invalid hash",
    );

    const unexplainedRun = copyAuthority();
    unexplainedRun.artifactSets[0].runMetadataNote = "";
    expect(() => validateSkoOutputAuthority(unexplainedRun)).toThrow(
      "must remain explicit",
    );
  });
});
