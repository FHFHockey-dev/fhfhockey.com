import type { NextApiRequest, NextApiResponse } from "next";
import { CookieOptions, createServerClient, serialize } from "@supabase/ssr";
import { SupabaseClient } from "@supabase/supabase-js";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const supabase: SupabaseClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_KEY!,
      {
        cookies: {
          get(name: string) {
            return req.cookies[name];
          },
          set(name: string, value: string, options: CookieOptions) {
            res.setHeader("Set-Cookie", serialize(name, value, options));
          },
          remove(name: string, options: CookieOptions) {
            res.setHeader("Set-Cookie", serialize(name, "", options));
          },
        },
      }
    );
    const seassion = supabase.auth.session();

    res.json({
      data: seassion,
      message: "Successfully updated the players & rosters tables.",
      success: true,
    });
  } catch (e: any) {
    res.status(400).json({
      message: "Failed to update " + e.message,
      success: false,
    });

    console.table(e);
  }
}
