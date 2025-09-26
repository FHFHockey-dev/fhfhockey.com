import type { NextApiRequest, NextApiResponse } from "next";

function checkAuth(req: NextApiRequest): [boolean, string] {
  const expected = process.env.SKO_PIPELINE_SECRET;
  if (!expected) return [true, "no secret configured"];
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return [false, "missing bearer token"];
  const token = auth.split(" ", 2)[1];
  if (token !== expected) return [false, "invalid token"];
  return [true, "ok"];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res
      .status(405)
      .json({ success: false, error: "Method Not Allowed" });
  }

  const [ok, msg] = checkAuth(req);
  if (!ok) return res.status(401).json({ success: false, message: msg });

  const { step, asOfDate, as_of_date, horizon, seasonCutoff, season_cutoff } =
    req.body || {};
  const s = (step || "").trim();
  if (!s)
    return res
      .status(400)
      .json({ success: false, message: "Missing 'step' in payload" });
  const allowed = new Set(["backfill", "train", "score", "upload"]);
  if (!allowed.has(s)) {
    return res
      .status(400)
      .json({
        success: false,
        message: `Unknown step '${s}'. Allowed: ${Array.from(allowed).sort().join(", ")}`
      });
  }

  // Quick return — no long work here. Or enqueue lightweight task if needed.
  return res.status(200).json({
    success: true,
    message: `Accepted step '${s}'`,
    step: s,
    echo: {
      asOfDate: asOfDate || as_of_date,
      horizon,
      seasonCutoff: seasonCutoff || season_cutoff
    }
  });
}
