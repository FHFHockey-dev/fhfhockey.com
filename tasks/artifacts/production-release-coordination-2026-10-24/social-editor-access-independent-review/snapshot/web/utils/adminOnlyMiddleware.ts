// C:\Users\timbr\Desktop\FHFH\fhfhockey.com\web\utils\adminOnlyMiddleware.ts

import { SupabaseClient } from "@supabase/supabase-js";
import { createClientWithToken } from "lib/supabase";
import { NextApiRequest, NextApiResponse } from "next";
import serviceRoleClient from "lib/supabase/server";
import { Database } from "lib/supabase/database-generated.types";

interface ApiRequest extends NextApiRequest {
  supabase: SupabaseClient<Database>;
}

type Handler = (req: ApiRequest, res: NextApiResponse) => Promise<any>;

export default function adminOnly(handler: Handler): Handler {
  return async (req, res) => {
    const authHeader = req.headers.authorization ?? "";
    let client: SupabaseClient<Database>;
    // check if this is invoked by cron
    if (invokedByCron(authHeader) || invokedByLocalDev(req)) {
      client = serviceRoleClient;
    } else {
      // authentication check
      const bearerMatch = authHeader.match(/^Bearer ([^\s]+)$/);
      if (!bearerMatch) {
        return res.status(401).json({
          message: "Unauthorized.",
          success: false,
        });
      }
      const access_token = bearerMatch[1];
      const authClient = createClientWithToken(access_token);
      const { data: userData, error: userError } =
        await authClient.auth.getUser();
      const userId = userData?.user?.id;
      if (userError || !userId) {
        return res.status(401).json({
          message: "Unauthorized.",
          success: false,
        });
      }

      // Bind the role lookup to the verified user rather than relying on RLS alone.
      const { data } = await authClient
        .from("users")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();
      if (data?.role !== "admin") {
        return res.status(403).json({
          message: "You are not an Admin.",
          success: false,
        });
      }

      client = serviceRoleClient;
    }

    // attach supabase client to request object
    req.supabase = client;
    await handler(req, res);
  };
}

export function invokedByCron(authHeader: string) {
  const cronSecret = process.env.CRON_SECRET;
  if (typeof cronSecret !== "string" || cronSecret.trim().length === 0) {
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

const LOOPBACK_ADDRESSES = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

function isLocalHostHeader(hostHeader: string | string[] | undefined) {
  return (
    typeof hostHeader === "string" &&
    /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/.test(
      hostHeader.toLowerCase(),
    )
  );
}

// Next.js fills x-forwarded-* from the socket and Host when they are absent, so a
// direct local request carries only loopback/local values. Anything else means a
// relay (tunnel, reverse proxy) or the client claims another origin. These headers
// can only withdraw the local exception, never grant it.
function hasOnlyLocalForwarding(headers: NextApiRequest["headers"]) {
  if (headers["forwarded"] !== undefined || headers["via"] !== undefined) {
    return false;
  }
  const forwardedHost = headers["x-forwarded-host"];
  if (forwardedHost !== undefined && !isLocalHostHeader(forwardedHost)) {
    return false;
  }
  return ["x-forwarded-for", "x-real-ip"].every((name) => {
    const value = headers[name];
    return (
      value === undefined ||
      [value]
        .flat()
        .join(",")
        .split(",")
        .every((entry) => LOOPBACK_ADDRESSES.has(entry.trim()))
    );
  });
}

export function invokedByLocalDev(req: NextApiRequest) {
  // Host/forwarded headers cannot establish that a caller is local.
  const remoteAddress = req.socket?.remoteAddress;
  return (
    process.env.NODE_ENV === "development" &&
    typeof remoteAddress === "string" &&
    LOOPBACK_ADDRESSES.has(remoteAddress) &&
    isLocalHostHeader(req.headers.host) &&
    hasOnlyLocalForwarding(req.headers)
  );
}
