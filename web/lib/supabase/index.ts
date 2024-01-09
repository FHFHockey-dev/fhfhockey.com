import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://fyhftlxokyjtpndbkfse.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export function createClientWithToken(access_token: string) {
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
