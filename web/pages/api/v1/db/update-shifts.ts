import type { NextApiRequest, NextApiResponse } from "next";
import adminOnly from "utils/adminOnlyMiddleware";
import shiftChartsHandler from "./shift-charts";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    req.method = "POST";
  }

  // Explicitly cast `req` to `ApiRequest` before passing it to `shiftChartsHandler`
  return shiftChartsHandler(req as any, res);
}

export default adminOnly(handler);