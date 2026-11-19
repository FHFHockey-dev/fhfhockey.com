// Parser revisions use YYYY-MM-DD.N. A date-scoped rereading keeps its base
// parser revision and adds its own YYYY-MM-DD.N revision.
const datedVersion = /^(\d{4}-\d{2}-\d{2})\.(\d+)(?:-line-date\.(\d{4}-\d{2}-\d{2})\.(\d+))?$/;

export function isDatedInterpretationVersion(version: string): boolean {
  return datedVersion.test(version);
}

export function compareInterpretationVersions(a: string, b: string): number {
  const left = datedVersion.exec(a);
  const right = datedVersion.exec(b);
  if (!left || !right) return 0;
  return left[1]!.localeCompare(right[1]!)
    || Number(left[2]) - Number(right[2])
    || (left[3] ?? "").localeCompare(right[3] ?? "")
    || Number(left[4] ?? 0) - Number(right[4] ?? 0);
}
