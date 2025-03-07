// /pages/api/v1/db/update-rolling-games.ts

// /api/v1/db/update-rolling-games
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ message: string }>
) {
  try {
    const { main } = await import("lib/supabase/Upserts/fetchRollingGames");
    await main();
    res
      .status(200)
      .json({ message: `Rolling games data processed successfully.` });
  } catch (error: any) {
    console.error("Error processing rolling games data:", error);
    res.status(500).json({ message: `Error: ${error.message}` });
  }
}
