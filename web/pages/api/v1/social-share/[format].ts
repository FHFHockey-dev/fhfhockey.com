import type { NextApiRequest, NextApiResponse } from "next";
import { loadScheduleShareSnapshot, SocialShareRequestError } from "lib/socialShare/server";
import { isSocialShareFormat } from "lib/socialShare/types";
import { requireSocialShareAccess, SOCIAL_SHARE_CACHE_CONTROL } from "lib/socialShare/access";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", SOCIAL_SHARE_CACHE_CONTROL);
  res.setHeader("Vary", "Authorization");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ error: "Use GET." }); }
  const { format, weekStart, selectedDates } = req.query;
  if (typeof format !== "string" || !isSocialShareFormat(format)) return res.status(404).json({ error: "Unknown social-share format." });
  if ((weekStart !== undefined && typeof weekStart !== "string") || (selectedDates !== undefined && typeof selectedDates !== "string") || Object.keys(req.query).some(key => !["format", "weekStart", "selectedDates"].includes(key))) return res.status(400).json({ error: "Invalid query parameters." });
  if (!await requireSocialShareAccess(req, res)) return;
  try {
    const dates = selectedDates === undefined ? undefined : selectedDates === "" ? [] : (selectedDates as string).split(",");
    const snapshot = await loadScheduleShareSnapshot(format, weekStart as string | undefined, dates);
    return res.status(200).json(snapshot);
  } catch (error) {
    return res.status(error instanceof SocialShareRequestError ? error.status : 503).json({ error: error instanceof SocialShareRequestError ? error.message : "NHL schedule unavailable." });
  }
}
