// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\lib\supabase\client.ts

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database-generated.types";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://fyhftlxokyjtpndbkfse.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_KEY || "";

const supabase: SupabaseClient<Database> = createClient<Database>(
  supabaseUrl,
  supabaseKey
);

export type SupabaseType = typeof supabase;
export default supabase;
