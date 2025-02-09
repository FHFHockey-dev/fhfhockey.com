// /Users/tim/Desktop/FHFH/fhfhockey.com/web/pages/api/v1/db/run-fetch-wgo-data.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { main } from "/Users/tim/Desktop/FHFH/fhfhockey.com/web/lib/supabase/Upserts/fetchWGOdata.js";
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // For testing purposes, allow GET requests.
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    await main();
    res.status(200).json({ message: "Data fetch/upsert complete." });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
