export function canonicalOrLegacyFinite(
  canonical: number | null | undefined,
  legacy: number | null | undefined
): number | null | undefined {
  return typeof canonical === "number" && Number.isFinite(canonical)
    ? canonical
    : legacy;
}

export function canonicalOrLegacyNullable(
  canonical: number | null | undefined,
  legacy: number | null | undefined
): number | null | undefined {
  return canonical ?? legacy;
}
