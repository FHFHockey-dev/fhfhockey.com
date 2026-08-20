export const SKO_OUTPUT_ARTIFACT_NAMES = [
  "sko_features.parquet",
  "sko_holdout_predictions.parquet",
  "sko_metrics.parquet",
  "sko_step_timings.csv",
] as const;

export type SkoOutputArtifactName =
  (typeof SKO_OUTPUT_ARTIFACT_NAMES)[number];

export interface SkoOutputArtifactMetadata {
  sha256: string;
  sizeBytes: number;
}

export interface SkoOutputArtifactSet {
  id: string;
  role: "authoritative" | "historical";
  root: string;
  runMetadataStatus: "unknown";
  runMetadataNote: string;
  artifacts: Record<SkoOutputArtifactName, SkoOutputArtifactMetadata>;
}

export interface SkoOutputAuthority {
  schemaVersion: 1;
  workingDirectory: "web";
  authoritativeRoot: "scripts/output";
  producerStatus: "no-current-executable-producer";
  consumerStatus: "no-current-runtime-consumer";
  artifactSets: readonly SkoOutputArtifactSet[];
}

export const SKO_OUTPUT_AUTHORITY: SkoOutputAuthority = {
  schemaVersion: 1,
  workingDirectory: "web",
  authoritativeRoot: "scripts/output",
  producerStatus: "no-current-executable-producer",
  consumerStatus: "no-current-runtime-consumer",
  artifactSets: [
    {
      id: "retained-sko-output-canonical-2026-08-19",
      role: "authoritative",
      root: "scripts/output",
      runMetadataStatus: "unknown",
      runMetadataNote:
        "The deleted modeling implementation left no trustworthy run identifier; hashes preserve the retained artifact identity.",
      artifacts: {
        "sko_features.parquet": {
          sha256:
            "f857dc15ba0eb667aa02f59c9eb26c5223e34cf96e02dbff5625d72fdd7db4a5",
          sizeBytes: 8_149_757,
        },
        "sko_holdout_predictions.parquet": {
          sha256:
            "5470f2aa8a2db12602a5170dd69f8fe7d97bed6f61d4e64fb6dcc5539c8e10bb",
          sizeBytes: 5_148_288,
        },
        "sko_metrics.parquet": {
          sha256:
            "fb1d87570e5da7752dc43ae8b975644ac703b24b0edc672a6c77d591a6f9a16f",
          sizeBytes: 9_738,
        },
        "sko_step_timings.csv": {
          sha256:
            "01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b",
          sizeBytes: 1,
        },
      },
    },
    {
      id: "retained-sko-output-nested-history-2026-08-19",
      role: "historical",
      root: "web/scripts/output",
      runMetadataStatus: "unknown",
      runMetadataNote:
        "No producer, consumer, or trustworthy run identifier is evidenced for this older nested artifact set.",
      artifacts: {
        "sko_features.parquet": {
          sha256:
            "8dc4893b58176fdcada015c062ccc74910a2172051449a7674373e30696f03d3",
          sizeBytes: 7_720_797,
        },
        "sko_holdout_predictions.parquet": {
          sha256:
            "8d2995c10d3b48a5c24e5a9383450a032520fa1ea26dbbe4a2fcc01415aaee45",
          sizeBytes: 3_203_990,
        },
        "sko_metrics.parquet": {
          sha256:
            "6c0d8cd48909b032a1b61b657f54cf6e46704e79cc9788cda269a12ca0fb26f7",
          sizeBytes: 9_002,
        },
        "sko_step_timings.csv": {
          sha256:
            "01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b",
          sizeBytes: 1,
        },
      },
    },
  ],
};

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function assertRepositoryRelativeRoot(root: string): void {
  if (
    root.length === 0 ||
    root.startsWith("/") ||
    root.split("/").includes("..")
  ) {
    throw new Error(`Invalid repository-relative sKO output root: ${root}`);
  }
}

export function validateSkoOutputAuthority(
  authority: SkoOutputAuthority,
): void {
  if (authority.workingDirectory !== "web") {
    throw new Error("The sKO output working directory must remain web.");
  }

  if (authority.authoritativeRoot !== "scripts/output") {
    throw new Error("The canonical sKO output root must remain scripts/output.");
  }

  if (
    authority.producerStatus !== "no-current-executable-producer" ||
    authority.consumerStatus !== "no-current-runtime-consumer"
  ) {
    throw new Error(
      "Producer and consumer status require a new evidenced provenance decision.",
    );
  }

  const ids = new Set<string>();
  const roots = new Set<string>();
  let authoritativeSetCount = 0;

  for (const artifactSet of authority.artifactSets) {
    assertRepositoryRelativeRoot(artifactSet.root);

    if (!artifactSet.id || ids.has(artifactSet.id)) {
      throw new Error("Each retained sKO artifact set needs a unique identity.");
    }
    ids.add(artifactSet.id);

    if (roots.has(artifactSet.root)) {
      throw new Error("Each retained sKO artifact set needs a unique root.");
    }
    roots.add(artifactSet.root);

    if (artifactSet.role === "authoritative") {
      authoritativeSetCount += 1;
      if (artifactSet.root !== authority.authoritativeRoot) {
        throw new Error("The authoritative artifact set and root diverge.");
      }
    }

    if (
      artifactSet.runMetadataStatus !== "unknown" ||
      artifactSet.runMetadataNote.trim().length === 0
    ) {
      throw new Error(
        "Unknown historical run metadata must remain explicit and explained.",
      );
    }

    const artifactNames = Object.keys(artifactSet.artifacts).sort();
    const requiredNames = [...SKO_OUTPUT_ARTIFACT_NAMES].sort();
    if (artifactNames.join("\n") !== requiredNames.join("\n")) {
      throw new Error(
        `Artifact set ${artifactSet.id} does not have the required inventory.`,
      );
    }

    for (const artifact of Object.values(artifactSet.artifacts)) {
      if (!SHA256_PATTERN.test(artifact.sha256)) {
        throw new Error(`Artifact set ${artifactSet.id} has an invalid hash.`);
      }
      if (!Number.isSafeInteger(artifact.sizeBytes) || artifact.sizeBytes < 1) {
        throw new Error(`Artifact set ${artifactSet.id} has an invalid size.`);
      }
    }
  }

  if (authoritativeSetCount !== 1) {
    throw new Error("Exactly one retained sKO artifact set must be authoritative.");
  }
}

export function getAuthoritativeSkoOutputPath(
  artifactName: SkoOutputArtifactName,
): string {
  return `${SKO_OUTPUT_AUTHORITY.authoritativeRoot}/${artifactName}`;
}
