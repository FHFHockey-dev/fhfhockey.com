// /Users/tim/Desktop/FHFH/fhfhockey.com/web/pages/api/v1/db/run-fetch-wgo-data.ts
import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import type { NextApiRequest, NextApiResponse } from "next";
import { main } from "lib/supabase/Upserts/fetchWGOdata.js";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Allow GET and POST for testing
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // Look at the query parameter "date"
  // ?date=all     -> allDates = true (fetch all dates for each included season)
  // ?date=recent  -> recent = true (fetch only between last processed date and today)
  // ?date=YYYY-MM-DD -> date = that specific day only
  // Otherwise (or if absent) default to recent
  const dateRaw = Array.isArray(req.query.date)
    ? req.query.date[0]
    : (req.query.date as string | undefined);

  const options: {
    allDates?: boolean;
    recent?: boolean;
    date?: string;
    allSeasons?: boolean;
  } = {};

  if (dateRaw === "all") {
    options.allDates = true;
  } else if (!dateRaw || dateRaw === "recent") {
    options.recent = true;
  } else {
    options.date = dateRaw;
  }

  // Optional: include all seasons if explicitly requested (default false for "recent")
  const allSeasonsRaw = Array.isArray(req.query.allSeasons)
    ? req.query.allSeasons[0]
    : (req.query.allSeasons as string | undefined);
  if (allSeasonsRaw === "true" || allSeasonsRaw === "1") {
    options.allSeasons = true;
  }

  console.log(`API called with date param: ${dateRaw}`);
  console.log("Resolved options for main():", options);

  try {
    // Pass the flags to main with the correct option names expected by fetchWGOdata.js
    await main(options);
    res.status(200).json({ message: "Data fetch/upsert complete." });
  } catch (err: any) {
    console.error("Error in run-fetch-wgo-data API:", err);
    res.status(500).json({ error: err.message });
  }
}

export default withCronJobAudit(handler);
