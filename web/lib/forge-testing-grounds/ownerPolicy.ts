/**
 * Server policy only. Integration must supply a request-scoped resolver backed by
 * trusted server authentication (for example auth.getUser), never decoded token
 * claims, getSession alone, request bodies, query parameters or an admin flag.
 * This module does not verify tokens, configure an owner, or activate a route.
 */
export type ServerVerifiedPrincipal = Readonly<{ userId: string }>;
export type ResolveServerPrincipal = () => Promise<ServerVerifiedPrincipal | null>;

type DenialCode = "server_context_required" | "owner_not_configured" | "unauthenticated"
  | "forbidden" | "verification_unavailable" | "resource_not_found";

export type OwnerAuthorization =
  | Readonly<{ allowed: true; ownerUserId: string }>
  | Readonly<{ allowed: false; status: 401 | 403 | 404 | 503; code: DenialCode }>;

// User identities are UUIDs, not display names, emails, role names or placeholders.
// Accept standard UUID versions/variants and canonicalize case; never coerce or
// trim configuration into an identity. Nil/all-zero placeholders are invalid.
function userIdentity(value: unknown): string | null {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value.toLowerCase() : null;
}

function deny(status: 401 | 403 | 404 | 503, code: DenialCode): OwnerAuthorization {
  return Object.freeze({ allowed: false, status, code });
}

/**
 * Construct for one server request using trusted server configuration. There is
 * no public request/principal argument and no admin, cron or localhost bypass.
 * No authorization result is cached: each call re-verifies the current session.
 * A worker requires its own separately reviewed authority; it cannot use this
 * owner policy merely because it holds a service-role or cron credential.
 */
export function createTestingGroundsOwnerPolicy(options: {
  configuredOwnerUserId: unknown;
  resolveServerPrincipal: ResolveServerPrincipal;
}) {
  const ownerUserId = userIdentity(options.configuredOwnerUserId);
  const resolveServerPrincipal = options.resolveServerPrincipal;

  async function authorizeOwner(): Promise<OwnerAuthorization> {
    if (typeof window !== "undefined") return deny(403, "server_context_required");
    if (ownerUserId === null) return deny(503, "owner_not_configured");
    if (typeof resolveServerPrincipal !== "function") return deny(503, "verification_unavailable");
    try {
      const principal = await resolveServerPrincipal();
      const verifiedUserId = userIdentity(principal?.userId);
      if (verifiedUserId === null) return deny(401, "unauthenticated");
      if (verifiedUserId !== ownerUserId) return deny(403, "forbidden");
      return Object.freeze({ allowed: true, ownerUserId });
    } catch {
      // Do not reflect upstream errors: they can contain tokens, URLs or PII.
      return deny(503, "verification_unavailable");
    }
  }

  /**
   * Use the owner ID from trusted stored metadata, never a client-supplied owner
   * field. Reads must still be owner-scoped at the storage boundary; this check
   * adds no permission to fetch another owner's payload or a sealed artifact.
   * All result/log/export/reveal gates remain independently required.
   */
  async function authorizeStoredResource(storedOwnerUserId: unknown): Promise<OwnerAuthorization> {
    const authorization = await authorizeOwner();
    if (!authorization.allowed) return authorization;
    const resourceOwner = userIdentity(storedOwnerUserId);
    if (resourceOwner === null || resourceOwner !== authorization.ownerUserId) {
      return deny(404, "resource_not_found");
    }
    return authorization;
  }

  return Object.freeze({ authorizeOwner, authorizeStoredResource });
}
