import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { requireApiUser } from "lib/api/requireApiUser";
import { getDraftProFeatureFlags } from "lib/draft-pro/features";
import { readPrivateImportChunk } from "lib/draft-pro/privateImportTransport";
import { loadDraftProAccess, requireDraftProServerCapability } from "lib/draft-pro/server";
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "GET") return res.status(405).end();
  const user = await requireApiUser(req, res, { onUnauthorized: (message) => res.status(401).json({ error: { code: "authentication_required", message } }) });
  if (!user) return;
  try {
    const access = await loadDraftProAccess(user.id, { now: new Date(), flags: getDraftProFeatureFlags(), patreonVerificationAvailable: true });
    requireDraftProServerCapability(access, "private_imports");
    const input = z.object({ id: z.string().uuid(), importId: z.string().uuid(), ordinal: z.string().regex(/^\d+$/).transform(Number).refine(Number.isSafeInteger) }).parse(req.query);
    const chunk = await readPrivateImportChunk({ userId: user.id, draftId: input.id, importId: input.importId, ordinal: input.ordinal });
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("X-Draft-Pro-Total-Bytes", String(chunk.totalBytes));
    res.setHeader("X-Draft-Pro-Total-Chunks", String(chunk.totalChunks));
    res.setHeader("X-Draft-Pro-SHA256", chunk.sha256);
    res.setHeader("X-Draft-Pro-Row-Count", String(chunk.rowCount));
    return res.status(200).send(chunk.bytes);
  } catch (cause) {
    const error = cause as { statusCode?: number; code?: string; message?: string };
    if (error.statusCode) return res.status(error.statusCode).json({ error: { code: error.code ?? "draft_pro_required", message: error.message ?? "Draft Pro access is required." } });
    if (cause instanceof z.ZodError) return res.status(400).json({ error: { code: "invalid_request", message: cause.issues[0]?.message ?? "Invalid private import request." } });
    return res.status(404).json({ error: { code: "private_import_unavailable", message: "Private import is unavailable." } });
  }
}
