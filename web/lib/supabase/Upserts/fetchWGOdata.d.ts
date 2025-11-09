// /web/types/fetchWGOdata.d.ts

declare module "lib/supabase/Upserts/fetchWGOdata.js" {
  export function main(options?: {
    /** Process all dates for each season in scope */
    allDates?: boolean;
    /** Process only from last processed date up to today (default) */
    recent?: boolean;
    /** Process a single specific date (YYYY-MM-DD) */
    date?: string;
    /** Include all seasons (historical + current) */
    allSeasons?: boolean;
  }): Promise<void>;
}
