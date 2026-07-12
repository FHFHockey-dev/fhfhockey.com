// lib/supabase/server.ts

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database-generated.types";

let cachedServiceRoleClient: SupabaseClient<Database> | undefined;

export function getServiceRoleClient(): SupabaseClient<Database> {
  if (cachedServiceRoleClient) {
    return cachedServiceRoleClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Server-only Supabase access requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  cachedServiceRoleClient = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  return cachedServiceRoleClient;
}

// Keep imports side-effect free for tests and routes that inject their own
// client. Configuration is validated when a privileged method is first used.
const serviceRoleClient = new Proxy({} as SupabaseClient<Database>, {
  get(_target, property) {
    const client = getServiceRoleClient();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export default serviceRoleClient;
