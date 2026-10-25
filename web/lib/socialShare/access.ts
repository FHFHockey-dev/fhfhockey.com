import type { NextApiRequest, NextApiResponse } from "next";

export type SocialShareRole = "social_editor" | "admin";
export const SOCIAL_SHARE_CACHE_CONTROL = "private, no-store, max-age=0";

export function isSocialShareRole(role: unknown): role is SocialShareRole {
  return role === "social_editor" || role === "admin";
}

/** Authorizes edition reads only; this does not confer any publishing or admin permission. */
export async function requireSocialShareAccess(req: NextApiRequest, res: NextApiResponse) {
  const authorization = req.headers.authorization;
  const rawHeaders = req.rawHeaders ?? [];
  let authorizationCount = 0;
  for (let index = 0; index < rawHeaders.length; index += 2) {
    if (rawHeaders[index].toLowerCase() === "authorization") authorizationCount++;
  }
  if (authorizationCount > 1 || typeof authorization !== "string" || !/^Bearer [A-Za-z0-9._~+/-]+=*$/.test(authorization)) {
    res.status(401).json({ error: "Sign in to use the share studio." });
    return null;
  }

  try {
    const { createClientWithToken } = await import("lib/supabase");
    const token = authorization.slice("Bearer ".length);
    const client = createClientWithToken(token);
    const { data: auth, error: authError } = await client.auth.getUser(token);
    if (authError || !auth.user?.id) {
      res.status(401).json({ error: "Invalid or expired session." });
      return null;
    }
    const { data, error } = await client.from("users").select("role").eq("user_id", auth.user.id).maybeSingle();
    if (error) throw error;
    if (!isSocialShareRole(data?.role)) {
      res.status(403).json({ error: "Social editor access is required." });
      return null;
    }
    return { userId: auth.user.id, role: data.role };
  } catch {
    res.status(503).json({ error: "Share studio access could not be verified. Try again." });
    return null;
  }
}
