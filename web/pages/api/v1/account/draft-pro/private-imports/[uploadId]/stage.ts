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
  catch (error) { const e = error as { statusCode?: number; code?: string; message?: string }; return res.status(e.statusCode ?? 400).json({ error: { code: e.code ?? "private_import_stage_invalid", message: e.message ?? "Private import could not be staged." } }); }
}
