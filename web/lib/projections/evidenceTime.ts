/** Preserve PostgreSQL sub-millisecond ordering without importing server clients or crypto. */
export function timestampMicros(value: string): bigint | null {
  const match = typeof value === "string" && value.match(/T\d{2}:\d{2}:\d{2}(?:\.(\d{1,6}))?(?:Z|[+-]\d{2}:\d{2})$/);
  const milliseconds = Date.parse(value);
  return match && Number.isFinite(milliseconds)
    ? BigInt(milliseconds) * BigInt(1000) + BigInt((match[1] ?? "").slice(3).padEnd(3, "0")) : null;
}

export function acceptedNewsSupersedes(acceptedAt: string, inputCutoff: string): boolean {
  const accepted = timestampMicros(acceptedAt), cutoff = timestampMicros(inputCutoff);
  return accepted === null || cutoff === null || accepted > cutoff;
}
