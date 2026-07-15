import type { NextApiRequest, NextApiResponse } from "next";

import { createClientWithToken } from "lib/supabase";

type ApiUser = {
  id: string;
  email?: string | null;
};

type RequireApiUserOptions = {
  onUnauthorized?: (message: string) => void;
};

export async function requireApiUser(
  req: NextApiRequest,
  res: NextApiResponse,
  options: RequireApiUserOptions = {},
): Promise<ApiUser | null> {
  const authorization = req.headers.authorization;
  const accessToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (!accessToken) {
    if (options.onUnauthorized) {
      options.onUnauthorized("Authentication required.");
    } else {
      res.status(401).json({ error: "Authentication required." });
    }
    return null;
  }

  const client = createClientWithToken(accessToken);
  const { data, error } = await client.auth.getUser(accessToken);

  if (error || !data.user) {
    if (options.onUnauthorized) {
      options.onUnauthorized("Invalid or expired session.");
    } else {
      res.status(401).json({ error: "Invalid or expired session." });
    }
    return null;
  }

  return {
    id: data.user.id,
    email: data.user.email ?? null,
  };
}
