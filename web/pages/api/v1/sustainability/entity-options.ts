import type { NextApiRequest, NextApiResponse } from "next";

import {
  searchSandboxEntities
} from "lib/sustainability/entitySurfaceServer";
import type { SandboxEntityType } from "lib/sustainability/entitySurface";

function parseEntityType(value: string | string[] | undefined): SandboxEntityType {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (candidate === "team" || candidate === "goalie") return candidate;
  return "skater";
}

function parseLimit(value: string | string[] | undefined, fallback = 12) {
  const candidate = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(candidate ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(25, parsed));
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const entityType = parseEntityType(req.query.entityType);
    const query =
      typeof req.query.q === "string"
        ? req.query.q
        : Array.isArray(req.query.q)
          ? req.query.q[0] ?? ""
          : "";
    const limit = parseLimit(req.query.limit);

    const options = await searchSandboxEntities({
      entityType,
      query,
      limit
    });

    return res.status(200).json({
      success: true,
      entityType,
      options
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error?.message ?? "Failed to load entity options"
    });
  }
}
