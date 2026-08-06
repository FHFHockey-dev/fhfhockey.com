type Environment = Record<string, string | undefined>;

export type PlayerForecastDatabaseTarget = "local" | "hosted" | "other" | "missing";

export function playerForecastDatabaseTarget(
  environment: Environment = process.env,
): PlayerForecastDatabaseTarget {
  const rawUrl = environment.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!rawUrl) return "missing";
  try {
    const hostname = new URL(rawUrl).hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "host.docker.internal"
    ) return "local";
    if (hostname.endsWith(".supabase.co")) return "hosted";
    return "other";
  } catch {
    return "other";
  }
}

export function playerForecastRuntimeBoundary(
  environment: Environment = process.env,
) {
  const databaseTarget = playerForecastDatabaseTarget(environment);
  const localRequired = environment.NODE_ENV !== "production";
  const allowed = !localRequired || databaseTarget === "local";
  return {
    allowed,
    databaseTarget,
    localRequired,
    message: allowed
      ? null
      : databaseTarget === "missing"
        ? "Player Forecasts requires a local Supabase URL during development."
        : "Player Forecasts development is blocked from using a non-local Supabase database. Point the local environment at Supabase running on localhost.",
  };
}

export function playerForecastErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const code = typeof record.code === "string" ? record.code : null;
    const message = typeof record.message === "string" ? record.message : null;
    if (code === "42P01") {
      return "Player Forecasts database schema is unavailable (42P01). Run readiness against local Supabase and replay the local migrations.";
    }
    if (message) return code ? `${message} (${code})` : message;
  }
  return "Player Forecasts request failed without a structured error message.";
}
