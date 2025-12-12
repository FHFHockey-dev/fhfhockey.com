import type { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const date =
    req.method === "GET"
      ? (req.query.date as string | undefined)
      : req.body?.date;

  if (!date || typeof date !== "string") {
    return res.status(400).json({ error: "Date is required (YYYY-MM-DD)" });
  }

  try {
    console.log(`Calculating goalie projections for ${date}...`);

    const { error } = await supabase.rpc("calculate_goalie_start_projections", {
      target_date: date
    });

    if (error) {
      console.error("Error calculating goalie projections:", error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({
      success: true,
      message: `Goalie projections updated for ${date}`
    });
  } catch (err: any) {
    console.error("Unexpected error:", err);
    return res.status(500).json({ error: err.message });
  }
}
