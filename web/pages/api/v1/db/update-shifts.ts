import type { NextApiRequest, NextApiResponse } from "next";

import shiftChartsHandler from "./shift-charts";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    req.method = "POST";
  }

  return shiftChartsHandler(req, res);
}

export default handler;
