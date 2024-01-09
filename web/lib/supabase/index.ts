import { IncomingMessage } from "http";
import { SupabaseClient, createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://fyhftlxokyjtpndbkfse.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export function createClientWithToken(
  access_token: string
): SupabaseClient<any, "public", any>;
export function createClientWithToken(
  req: IncomingMessage
): SupabaseClient<any, "public", any>;
export function createClientWithToken(...args: any) {
  let access_token = "";
  if (typeof args[0] === "string") {
    access_token = args[0];
  } else if (args[0] instanceof IncomingMessage) {
    const req = args[0] as IncomingMessage;
    access_token = req.headers["authorization"]?.split(" ")[1] ?? "";
  }

  const client = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    },
  });

  return client;
}

export default supabase;
