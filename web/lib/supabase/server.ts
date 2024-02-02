import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database-generated.types";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://fyhftlxokyjtpndbkfse.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
// https://supabase.com/docs/reference/javascript/auth-api?example=create-auth-client-server-side
const supabase =
  typeof window === "undefined"
    ? createClient<Database>(supabaseUrl, supabaseKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      })
    : null;

export default supabase!;
