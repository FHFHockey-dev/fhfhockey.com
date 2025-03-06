import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ message: string }>
) {
  try {
    // Dynamically import the fetchPbP module (adjust the path if necessary)
    const { main } = await import("lib/supabase/Upserts/fetchPbP");

    // Invoke the main function from the JavaScript file
    await main();

    res
      .status(200)
      .json({ message: "Play-by-play data processed successfully." });
  } catch (error: any) {
    console.error("Error processing play-by-play data:", error);
    res.status(500).json({ message: `Error: ${error.message}` });
  }
}
