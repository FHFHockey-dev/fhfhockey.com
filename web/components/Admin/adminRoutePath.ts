// Shared by the "Run any route" panel and the route runner (lib/routeRunner),
// which must not import the panel's React/MUI/browser-client module.

// Fixed base used only to resolve and check a relative path; never requested.
const VALIDATION_BASE = "https://same-origin.invalid";

export type AdminRoutePathResult =
  | { ok: true; path: string }
  | { ok: false; error: string };

/**
 * Accept only a same-origin relative path under /api/, so the admin bearer
 * token can never be sent to another host. Leading/trailing whitespace from a
 * paste is trimmed; any other whitespace or control character is rejected.
 */
export function validateAdminRoutePath(input: string): AdminRoutePathResult {
  const value = input.trim();
  if (!value) return { ok: false, error: "Enter a route path." };
  if (/[\s\u0000-\u001f\u007f-\u009f]/.test(value)) {
    return {
      ok: false,
      error: "Whitespace and control characters are not allowed."
    };
  }
  if (value.includes("\\")) {
    return { ok: false, error: "Backslashes are not allowed." };
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    return { ok: false, error: "Absolute URLs are not allowed." };
  }
  if (value.startsWith("//")) {
    return { ok: false, error: "Protocol-relative URLs are not allowed." };
  }
  if (!value.startsWith("/api/")) {
    return { ok: false, error: "The path must start with /api/." };
  }

  let resolved: URL;
  try {
    resolved = new URL(value, VALIDATION_BASE);
  } catch {
    return { ok: false, error: "The path is not a valid URL path." };
  }
  if (
    resolved.origin !== VALIDATION_BASE ||
    !resolved.pathname.startsWith("/api/")
  ) {
    return { ok: false, error: "The path must stay under /api/." };
  }

  return { ok: true, path: `${resolved.pathname}${resolved.search}` };
}
