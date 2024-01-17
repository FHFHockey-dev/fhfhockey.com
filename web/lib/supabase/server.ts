import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database-generated.types";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://fyhftlxokyjtpndbkfse.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient<Database>(supabaseUrl, supabaseKey);

export default supabase;
