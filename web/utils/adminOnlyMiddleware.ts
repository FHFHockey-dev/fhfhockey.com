import { SupabaseClient } from "@supabase/supabase-js";
import { createClientWithToken } from "lib/supabase";
import { NextApiRequest, NextApiResponse } from "next";

interface ApiRequest extends NextApiRequest {
  supabase: SupabaseClient<any, "public", any>;
}

type Handler = (req: ApiRequest, res: NextApiResponse) => Promise<any>;

export default function adminOnly(handler: Handler): Handler {
  return async (req, res) => {
    // authentication check
    const access_token = req.headers.authorization?.split(" ")[1] ?? "";
    const client = createClientWithToken(access_token);
    const { error: userError } = await client.auth.getUser();
    if (userError) {
      return res.status(401).json({
        message: userError.message,
        success: false,
      });
    }

    const { data } = await client.from("users").select("role").single();
    if (data?.role !== "admin") {
      return res.status(403).json({
        message: "You are not an Admin.",
        success: false,
      });
    }

    // attach supabase client to request object
    req.supabase = client;
    await handler(req, res);
  };
}
