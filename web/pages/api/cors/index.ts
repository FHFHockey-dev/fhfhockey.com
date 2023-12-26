import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const url = req.query.url as string;
  const method = (req.query.method ?? "GET") as string;

  try {
    const data = await fetch(decodeURIComponent(url), {
      method,
    }).then((res) => res.json());
    res.status(200).json(data);
  } catch (e: any) {
    res.status(400).json({
      url,
      success: false,
      message: "Error: " + e.message,
    });
  }
}
