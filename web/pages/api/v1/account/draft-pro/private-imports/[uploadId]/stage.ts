import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { requireApiUser } from "lib/api/requireApiUser";
import { getDraftProFeatureFlags } from "lib/draft-pro/features";
import { stagePrivateImport } from "lib/draft-pro/privateImportTransport";
import { loadDraftProAccess, requireDraftProServerCapability } from "lib/draft-pro/server";
const input = z.object({ chunkPaths: z.array(z.string().min(1).max(500)).min(1).max(100) }).strict();
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: { code: "method_not_allowed" } }); const user = await requireApiUser(req, res, { onUnauthorized: (message) => res.status(401).json({ error: { code: "authentication_required", message } }) }); if (!user) return;
  try { const access = await loadDraftProAccess(user.id, { now: new Date(), flags: getDraftProFeatureFlags(), patreonVerificationAvailable: true }); requireDraftProServerCapability(access, "private_imports"); return res.status(201).json({ data: await stagePrivateImport({ userId: user.id, uploadId: String(req.query.uploadId), ...input.parse(req.body) }) }); }
  catch (cause) {
    // Typed access/validation errors keep their status and safe message; anything else is an
    // unexpected storage/RPC failure whose details stay in the server log.
    const e = cause as { statusCode?: number; code?: string; message?: string };
    if (e.statusCode) return res.status(e.statusCode).json({ error: { code: e.code ?? "private_import_stage_invalid", message: e.message ?? "Private import could not be staged." } });
    if (cause instanceof z.ZodError) return res.status(400).json({ error: { code: "private_import_stage_invalid", message: cause.issues[0]?.message ?? "Private import could not be staged." } });
    console.error("Draft Pro private import stage failed", cause);
    return res.status(500).json({ error: { code: "PRIVATE_IMPORT_STAGE_UNAVAILABLE", message: "Private imports are unavailable. Your local draft is unchanged." } });
  }
}
