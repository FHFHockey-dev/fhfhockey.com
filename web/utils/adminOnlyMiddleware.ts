import { SupabaseClient } from "@supabase/supabase-js";
import { createClientWithToken } from "lib/supabase";
import { NextApiRequest, NextApiResponse } from "next";
import serviceRoleClient from "lib/supabase/server";

interface ApiRequest extends NextApiRequest {
  supabase: SupabaseClient<any, "public", any>;
}

type Handler = (req: ApiRequest, res: NextApiResponse) => Promise<any>;

export default function adminOnly(handler: Handler): Handler {
  return async (req, res) => {
    const authHeader = req.headers.authorization ?? "";
    let client: SupabaseClient;
    // check if this is invoked by cron
    if (invokedByCron(authHeader)) {
      client = serviceRoleClient;
    } else {
      // authentication check
      const access_token = authHeader.split(" ")[1] ?? "";
      client = createClientWithToken(access_token);
      const { error: userError } = await client.auth.getUser();
      if (userError) {
        return res.status(401).json({
          message: userError.message,
          success: false,
        });
      }

      const { data } = await client.from("users").select("role").maybeSingle();
      if (data?.role !== "admin") {
        return res.status(403).json({
          message: "You are not an Admin.",
          success: false,
        });
      }
    }

    // attach supabase client to request object
    req.supabase = client;
    await handler(req, res);
  };
}

function invokedByCron(authHeader: string) {
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}
