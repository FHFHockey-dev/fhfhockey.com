import type { NextApiRequest, NextApiResponse } from "next";
import { createTestingGroundsOwnerPolicy } from "./ownerPolicy";

export function privateTestingGroundsResponse(res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("Vary", "Authorization");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
}

/** Server configuration only. Never populate these values from a request. */
export type OwnerBoundaryConfig = { ownerUserId: unknown };

export async function authorizeTestingGroundsOwner(
  req: NextApiRequest,
  res: NextApiResponse,
  config: OwnerBoundaryConfig = { ownerUserId: process.env.FORGE_TESTING_GROUNDS_OWNER_USER_ID },
) {
  privateTestingGroundsResponse(res);
  const policy = createTestingGroundsOwnerPolicy({
    configuredOwnerUserId: config.ownerUserId,
    resolveServerPrincipal: async () => {
      // Reject ambiguous/normalized duplicate credentials before the shared helper.
      const authorization = req.headers.authorization;
      const raw = req.rawHeaders ?? [];
      let headerCount = 0;
      for (let i = 0; i < raw.length; i += 2) {
        if (raw[i].toLowerCase() === "authorization") headerCount++;
      }
      if (headerCount > 1 || typeof authorization !== "string"
        || !/^Bearer [A-Za-z0-9._~+/-]+=*$/.test(authorization)) return null;

      // Missing/invalid owner configuration never initializes a provider client.
      // This helper verifies getUser(token), not decoded claims or getSession.
      const { requireApiUser } = await import("../api/requireApiUser");
      const user = await requireApiUser(req, res, { onUnauthorized: () => undefined });
      return user ? { userId: user.id } : null;
    },
  });
  const authorization = await policy.authorizeOwner();
  if (!authorization.allowed) {
    res.status(authorization.status).json({ error: authorization.code });
    return null;
  }
  return authorization;
}
