// /Users/tim/Desktop/FHFH/fhfhockey.com/web/pages/api/v1/db/run-fetch-wgo-data.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { main } from "lib/supabase/Upserts/fetchWGOdata.js";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Allow GET and POST for testing
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // Look at the query parameter "date"
  // ?date=all  -> processAllDates = true (fetch all dates from season start)
  // ?date=recent -> processRecentDates = true (fetch only between last processed date and today)
  // Otherwise (or if absent) use the default behavior (processRecentDates)
  const dateParam = req.query.date;
  const processAllDates = dateParam === "all";
  const processRecentDates = dateParam === "recent" || !dateParam;

  console.log(`API called with date param: ${dateParam}`);
  console.log(
    `processAllDates: ${processAllDates}, processRecentDates: ${processRecentDates}`
  );

  try {
    // Pass the flags to main as an options object
    // Set processAllSeasons to true to fetch all game types (preseason, regular, postseason)
    await main({
      processAllDates,
      processRecentDates,
      processAllSeasons: true // This ensures we fetch all seasons including past ones
    });
    res.status(200).json({ message: "Data fetch/upsert complete." });
  } catch (err: any) {
    console.error("Error in run-fetch-wgo-data API:", err);
    res.status(500).json({ error: err.message });
  }
}
