const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type ForgeRouteContext = {
  date?: string | null;
  mode?: "tonight" | "week" | null;
  resolvedDate?: string | null;
  slate?: "main" | "all" | null;
  team?: string | null;
  position?: "all" | "f" | "d" | "g" | null;
  metricGroup?: string | null;
  metrics?: readonly string[] | null;
  origin?: string | null;
  returnTo?: string | null;
};

export function isRealUtcDateOnly(
  value: string | null | undefined,
): value is string {
  if (typeof value !== "string" || !DATE_ONLY_PATTERN.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function isInternalReturnPath(
  value: string | null | undefined,
): value is string {
  return (
    typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//")
  );
}

export function parseForgeOriginParam(
  value: string | string[] | undefined,
): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate !== "string" || candidate.trim().length === 0) {
    return null;
  }
  return candidate.trim();
}

export function parseForgeReturnToParam(
  value: string | string[] | undefined,
): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return isInternalReturnPath(candidate) ? candidate : null;
}

export function buildForgeHref(
  pathname: string,
  context: ForgeRouteContext = {},
): string {
  const params = new URLSearchParams();

  if (isRealUtcDateOnly(context.date)) {
    params.set("date", context.date);
  }

  if (context.mode === "tonight" || context.mode === "week") {
    params.set("mode", context.mode);
  }

  if (
    isRealUtcDateOnly(context.resolvedDate) &&
    context.resolvedDate !== context.date
  ) {
    params.set("resolvedDate", context.resolvedDate);
  }

  if (context.slate === "main" || context.slate === "all") {
    params.set("slate", context.slate);
  }

  if (context.team) {
    params.set("team", context.team);
  }

  if (
    context.position === "all" ||
    context.position === "f" ||
    context.position === "d" ||
    context.position === "g"
  ) {
    params.set("position", context.position);
  }

  if (context.metricGroup?.trim()) {
    params.set("metricGroup", context.metricGroup.trim());
  }

  const metrics = context.metrics
    ?.map((metric) => metric.trim())
    .filter((metric) => metric.length > 0);
  if (metrics?.length) {
    params.set("metrics", Array.from(new Set(metrics)).join(","));
  }

  if (context.origin) {
    params.set("origin", context.origin);
  }

  if (isInternalReturnPath(context.returnTo)) {
    params.set("returnTo", context.returnTo);
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function parseForgeDateParam(
  value: string | string[] | undefined,
  fallback: string,
): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return isRealUtcDateOnly(candidate) ? candidate : fallback;
}

export function parseForgeResolvedDateParam(
  value: string | string[] | undefined,
): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return isRealUtcDateOnly(candidate) ? candidate : null;
}

export function parseForgeTeamParam(
  value: string | string[] | undefined,
): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate !== "string" || candidate.trim().length === 0)
    return null;
  return candidate.trim().toUpperCase();
}

export function parseForgePositionParam(
  value: string | string[] | undefined,
): "all" | "f" | "d" | "g" | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (
    candidate === "all" ||
    candidate === "f" ||
    candidate === "d" ||
    candidate === "g"
  ) {
    return candidate;
  }
  return null;
}

export function parseForgeModeParam(
  value: string | string[] | undefined,
): "tonight" | "week" | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (candidate === "tonight" || candidate === "week") {
    return candidate;
  }
  return null;
}

export function parseForgeSlateParam(
  value: string | string[] | undefined,
): "main" | "all" | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (candidate === "main" || candidate === "all") {
    return candidate;
  }
  return null;
}
