import type { NextApiRequest, NextApiResponse } from "next";
import { handleHostedCapture } from "./forge-pregame-capture";

export const config = { maxDuration: 240, api: { bodyParser: { sizeLimit: "1kb" } } };

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return handleHostedCapture(req, res, 2);
}
