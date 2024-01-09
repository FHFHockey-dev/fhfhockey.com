import type { NextApiRequest, NextApiResponse } from "next";
import { createClientWithToken } from "lib/supabase";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const access_token = req.headers.authorization?.split(" ")[1] ?? "";
    const client = createClientWithToken(access_token);
    const { data } = await client.from("users").select("role").single();
    if (data?.role !== "admin") {
      return res.status(403).json({
        message: "Failed to update the table, you are not an admin",
        success: false,
      });
    }

    return res.json({
      data: data,
      message: "Successfully updated the players & rosters tables.",
      success: true,
    });
  } catch (e: any) {
    res.status(400).json({
      message: "Failed to update " + e.message,
      success: false,
    });

    console.table(e);
  }
}
