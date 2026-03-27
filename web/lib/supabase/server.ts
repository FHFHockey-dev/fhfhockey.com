// lib/supabase/server.ts

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database-generated.types";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://fyhftlxokyjtpndbkfse.supabase.co";
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_KEY ||
  "test-key";

// This module is intended for server-only imports. Keep the client stable so
// test and API modules never receive a nullable service-role wrapper.
const serviceRoleClient = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

export default serviceRoleClient;
