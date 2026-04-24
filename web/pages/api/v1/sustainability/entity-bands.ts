import type { NextApiRequest, NextApiResponse } from "next";

import {
  fetchSandboxBands
} from "lib/sustainability/entitySurfaceServer";
import type { SandboxEntityType } from "lib/sustainability/entitySurface";

function parseEntityType(value: string | string[] | undefined): SandboxEntityType {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (candidate === "team" || candidate === "goalie") return candidate;
  return "skater";
}

function parseEntityId(value: string | string[] | undefined): number | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  const parsed = Number(candidate);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDate(value: string | string[] | undefined): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : undefined;
}

function parseLimit(value: string | string[] | undefined, fallback = 160) {
  const candidate = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(candidate ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(500, parsed));
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
    const entityId = parseEntityId(req.query.entityId);
    if (entityId == null) {
      return res.status(400).json({
        success: false,
        message: "Missing or invalid entityId"
      });
    }

    const requestedDate = parseDate(req.query.date);
    const windowCode =
      typeof req.query.windowCode === "string"
        ? req.query.windowCode
        : Array.isArray(req.query.windowCode)
          ? req.query.windowCode[0]
          : undefined;
    const metricKey =
      typeof req.query.metricKey === "string"
        ? req.query.metricKey
        : Array.isArray(req.query.metricKey)
          ? req.query.metricKey[0]
          : undefined;
    const limit = parseLimit(req.query.limit);

    const payload = await fetchSandboxBands({
      entityType,
      entityId,
      requestedDate,
      windowCode,
      metricKey,
      limit
    });

    return res.status(200).json({
      success: true,
      ...payload
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error?.message ?? "Failed to load sustainability bands"
    });
  }
}
