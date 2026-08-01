import path from "path";
import { describe, expect, it } from "vitest";

import { normalizeReleaseArtifactReference } from "./releaseArtifactReference";

describe("normalizeReleaseArtifactReference", () => {
  const repositoryRoot = path.resolve("/workspace/fhfhockey.com");

  it("keeps repository-relative evidence portable", () => {
    expect(
      normalizeReleaseArtifactReference(
        "tasks/artifacts/xg-release-verdict.md",
        repositoryRoot,
      ),
    ).toBe("tasks/artifacts/xg-release-verdict.md");
  });

  it("converts an in-repository absolute path to repository-relative form", () => {
    expect(
      normalizeReleaseArtifactReference(
        path.join(repositoryRoot, "tasks/artifacts/xg-release-verdict.md"),
        repositoryRoot,
      ),
    ).toBe("tasks/artifacts/xg-release-verdict.md");
  });

  it("rejects machine-local evidence outside the repository", () => {
    expect(() =>
      normalizeReleaseArtifactReference(
        "/Users/example/Desktop/xg-release-verdict.md",
        repositoryRoot,
      ),
    ).toThrow("inside the repository");
  });
});
