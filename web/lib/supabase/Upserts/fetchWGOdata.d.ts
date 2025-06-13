// /web/types/fetchWGOdata.d.ts

declare module "lib/supabase/Upserts/fetchWGOdata.js" {
  export function main(options?: {
    processAllDates?: boolean;
    processRecentDates?: boolean;
    processOneDay?: boolean;
    processAllSeasons?: boolean;
  }): Promise<void>;
}
