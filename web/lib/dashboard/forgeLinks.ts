const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type ForgeRouteContext = {
  date?: string | null;
  mode?: "tonight" | "week" | null;
  resolvedDate?: string | null;
  team?: string | null;
  position?: "all" | "f" | "d" | "g" | null;
  origin?: string | null;
  returnTo?: string | null;
};

function isDateOnly(value: string | null | undefined): value is string {
  return typeof value === "string" && DATE_ONLY_PATTERN.test(value);
}

function isInternalReturnPath(value: string | null | undefined): value is string {
  return (
    typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//")
  );
}

export function parseForgeOriginParam(
  value: string | string[] | undefined
): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate !== "string" || candidate.trim().length === 0) {
    return null;
  }
  return candidate.trim();
}

export function parseForgeReturnToParam(
  value: string | string[] | undefined
): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return isInternalReturnPath(candidate) ? candidate : null;
}

export function buildForgeHref(
  pathname: string,
  context: ForgeRouteContext = {}
): string {
  const params = new URLSearchParams();

  if (isDateOnly(context.date)) {
    params.set("date", context.date);
  }

  if (context.mode === "tonight" || context.mode === "week") {
    params.set("mode", context.mode);
  }

  if (
    isDateOnly(context.resolvedDate) &&
    context.resolvedDate !== context.date
  ) {
    params.set("resolvedDate", context.resolvedDate);
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
  fallback: string
): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return isDateOnly(candidate) ? candidate : fallback;
}

export function parseForgeResolvedDateParam(
  value: string | string[] | undefined
): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return isDateOnly(candidate) ? candidate : null;
}

export function parseForgeTeamParam(
  value: string | string[] | undefined
): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate !== "string" || candidate.trim().length === 0) return null;
  return candidate.trim().toUpperCase();
}

export function parseForgePositionParam(
  value: string | string[] | undefined
): "all" | "f" | "d" | "g" | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (candidate === "all" || candidate === "f" || candidate === "d" || candidate === "g") {
    return candidate;
  }
  return null;
}
