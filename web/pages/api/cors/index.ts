import type { NextApiRequest, NextApiResponse } from "next";
import { fetchNhlProxyText, parseNhlProxyUrl } from "lib/NHL/corsProxy";

function summarizeHtmlError(value: string): string {
  const title = value.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? null;
  const host = title?.split("|")[0]?.trim() ?? null;
  const code = title?.match(/\|\s*(\d{3})\s*:/)?.[1]?.trim() ?? null;
  const reason =
    title?.match(/\|\s*\d{3}\s*:\s*([^|]+)/)?.[1]?.trim() ??
    "HTML error response";

  return [
    "Upstream returned HTML instead of JSON.",
    code ? `Code ${code}.` : null,
    reason ? `${reason}.` : null,
    host ? `Host: ${host}.` : null
  ]
    .filter((part): part is string => Boolean(part))
    .join(" ");
}

function truncate(value: string, max = 240): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

function tryParseJson(value: string): unknown | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, message: "Only GET is supported." });
  }
  const target = parseNhlProxyUrl(req.query.url);
  if (!target || (req.query.method !== undefined && req.query.method !== "GET")) {
    return res.status(400).json({
      success: false,
      message: "Only supported NHL HTTPS GET resources are allowed."
    });
  }

  try {
    const { upstream, bodyText } = await fetchNhlProxyText(target);
    const contentType = upstream.headers.get("content-type") ?? "";
    const trimmed = bodyText.trim();
    const parsed = tryParseJson(bodyText);
    const looksLikeHtml =
      trimmed.startsWith("<!DOCTYPE html") || trimmed.startsWith("<html");

    if (!upstream.ok) {
      return res.status(502).json({
        success: false,
        url: target.toString(),
        upstreamStatus: upstream.status,
        message: looksLikeHtml
          ? summarizeHtmlError(bodyText)
          : `Upstream request failed with status ${upstream.status}.`,
        detail:
          !looksLikeHtml && trimmed ? truncate(trimmed) : truncate(bodyText)
      });
    }

    if (parsed === null) {
      return res.status(502).json({
        success: false,
        url: target.toString(),
        message: looksLikeHtml
          ? summarizeHtmlError(bodyText)
          : `Expected JSON but received ${contentType || "unknown content type"}.`,
        detail: truncate(bodyText)
      });
    }

    res.status(200).json(parsed);
  } catch {
    res.status(502).json({
      success: false,
      message: "Unable to retrieve NHL data.",
    });
  }
}
