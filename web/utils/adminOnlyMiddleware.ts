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
      const access_token = authHeader.split(" ")[1] ?? "";
      const authClient = createClientWithToken(access_token);
      const { error: userError } = await authClient.auth.getUser();
      if (userError) {
        return res.status(401).json({
          message: userError.message,
          success: false
        });
      }

      const { data } = await authClient.from("users").select("role").maybeSingle();
      if (data?.role !== "admin") {
        return res.status(403).json({
          message: "You are not an Admin.",
          success: false
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
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

function isLocalHostHeader(hostHeader: string | undefined) {
  if (typeof hostHeader !== "string" || hostHeader.length === 0) {
    return false;
  }

  const normalizedHost = hostHeader.toLowerCase().split(":")[0];
  return normalizedHost === "localhost" || normalizedHost === "127.0.0.1" || normalizedHost === "::1";
}

export function invokedByLocalDev(req: NextApiRequest) {
  return process.env.NODE_ENV !== "production" && isLocalHostHeader(req.headers.host);
}
