export function getSingleQueryParam(
  value: string | string[] | undefined
): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export function parseQueryString(
  value: string | string[] | undefined
): string | undefined {
  return getSingleQueryParam(value);
}

export function parseQueryNumber(
  value: string | string[] | undefined
): number | undefined {
  const raw = getSingleQueryParam(value);
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseQueryBoolean(
  value: string | string[] | undefined
): boolean | undefined {
  const raw = getSingleQueryParam(value);
  if (raw === undefined) return undefined;
  return ["1", "true", "yes", "y"].includes(raw.toLowerCase());
}

export function parseQueryPositiveInt(
  value: string | string[] | undefined
): number | undefined {
  const parsed = parseQueryNumber(value);
  if (parsed === undefined) return undefined;
  if (!Number.isInteger(parsed) || parsed <= 0) return undefined;
  return parsed;
}
