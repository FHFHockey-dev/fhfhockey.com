/** The one Supabase project whose ledger enforces the global NST rate windows.
 * Any other project would hold a separate ledger, so NST admission and job
 * lifecycle refuse it: no admission POST and no provider GET. */
export const NST_ADMISSION_PROJECT_HOST = "fyhftlxokyjtpndbkfse.supabase.co";

/** Test seam: hosts under the reserved `.invalid` TLD (RFC 6761) never resolve,
 * so they cannot reach any ledger or NST. Offline tests point at one and mock
 * fetch. A production deployment configured this way still fails closed. */
function isReservedOfflineHost(host: string): boolean {
  return host === "invalid" || host.endsWith(".invalid");
}

/** Returns the validated HTTPS origin for NST admission/lifecycle RPCs, or null. */
export function nstAdmissionOrigin(raw: string | undefined): URL | null {
  const value = raw?.trim();
  if (!value) return null;
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== "https:" || url.username || url.password || url.port || (url.pathname !== "/" && url.pathname !== "")) return null;
  const host = url.hostname.toLowerCase();
  return host === NST_ADMISSION_PROJECT_HOST || isReservedOfflineHost(host) ? new URL(url.origin) : null;
}
