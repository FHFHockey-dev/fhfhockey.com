export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function normalizeSustainabilityDate(
  value: string | Date | null | undefined,
  fallback = todayIsoDate()
): string {
  if (!value) return fallback;

  if (value instanceof Date) {
    const iso = value.toISOString();
    return Number.isNaN(value.getTime()) ? fallback : iso.slice(0, 10);
  }

  const candidate = String(value).trim();
  if (!candidate) return fallback;
  if (/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return candidate;

  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toISOString().slice(0, 10);
}

export function parseSustainabilityDateParam(
  value: string | string[] | undefined,
  fallback = todayIsoDate()
): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return normalizeSustainabilityDate(candidate, fallback);
}

export function normalizeGameDate(
  source: { date?: string | null; date_scraped?: string | null } | null | undefined,
  fallback?: string
): string | null {
  if (!source) return fallback ?? null;
  const wgoDate = normalizeSustainabilityDate(source.date, "");
  if (wgoDate) return wgoDate;
  const nstDate = normalizeSustainabilityDate(source.date_scraped, "");
  if (nstDate) return nstDate;
  return fallback ?? null;
}
