import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "lib/supabase/database-generated.types";

export type YahooDraftPollObservationInsert =
  Database["public"]["Tables"]["yahoo_draft_poll_observations"]["Insert"];

export type YahooLiveDraftDatabase = Database;

export type YahooLiveDraftClient = SupabaseClient<YahooLiveDraftDatabase>;
