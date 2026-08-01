import path from "path";

function escapesRepository(relativePath: string): boolean {
  return relativePath === ".." || relativePath.startsWith(`..${path.sep}`);
}

export function normalizeReleaseArtifactReference(
  reference: string | null,
  repositoryRoot: string,
): string | null {
  if (reference == null) return null;

  const trimmed = reference.trim();
  if (!trimmed) return null;

  const root = path.resolve(repositoryRoot);
  const resolved = path.isAbsolute(trimmed)
    ? path.resolve(trimmed)
    : path.resolve(root, trimmed);
  const relative = path.relative(root, resolved);

  if (!relative || escapesRepository(relative)) {
    throw new Error(
      "Release artifact references must resolve to a file inside the repository.",
    );
  }

  return relative.split(path.sep).join("/");
}
