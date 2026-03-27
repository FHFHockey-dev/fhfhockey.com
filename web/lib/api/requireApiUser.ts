import type { NextApiRequest, NextApiResponse } from "next";

import { createClientWithToken } from "lib/supabase";

type ApiUser = {
  id: string;
  email?: string | null;
};

export async function requireApiUser(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<ApiUser | null> {
  const authorization = req.headers.authorization;
  const accessToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (!accessToken) {
    res.status(401).json({ error: "Authentication required." });
    return null;
  }

  const client = createClientWithToken(accessToken);
  const { data, error } = await client.auth.getUser(accessToken);

  if (error || !data.user) {
    res.status(401).json({ error: "Invalid or expired session." });
    return null;
  }

  return {
    id: data.user.id,
    email: data.user.email ?? null,
  };
}
