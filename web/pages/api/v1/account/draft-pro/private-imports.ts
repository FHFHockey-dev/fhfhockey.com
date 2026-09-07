import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { requireApiUser } from "lib/api/requireApiUser";
import { getDraftProFeatureFlags } from "lib/draft-pro/features";
import { beginPrivateImport } from "lib/draft-pro/privateImportTransport";
import { loadDraftProAccess, requireDraftProServerCapability } from "lib/draft-pro/server";

const mapping = z.object({ sourceId: z.string().trim().min(1).max(160), headers: z.array(z.object({ original: z.string().trim().min(1).max(160), standardized: z.string().trim().min(1).max(160), selected: z.boolean() }).strict()).max(200) }).strict();
const input = z.object({ draftId: z.string().uuid().nullable(), expectedVersion: z.number().int().nonnegative().nullable(), attemptKey: z.string().min(1).max(120), name: z.string().trim().min(1).max(160), mapping, declaredMaxBytes: z.number().int().min(1).max(10 * 1024 * 1024), replacementImportId: z.string().uuid().nullable().optional() }).strict();
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "POST") return res.status(405).json({ error: { code: "method_not_allowed" } });
  const user = await requireApiUser(req, res, { onUnauthorized: (message) => res.status(401).json({ error: { code: "authentication_required", message } }) }); if (!user) return;
  try {
    const access = await loadDraftProAccess(user.id, { now: new Date(), flags: getDraftProFeatureFlags(), patreonVerificationAvailable: true }); requireDraftProServerCapability(access, "private_imports");
    const result = await beginPrivateImport({ userId: user.id, ...input.parse(req.body) });
    if (result.status === "busy" || result.status === "conflict") {
      const draftId = result.session.draft_id;
      if (!draftId) throw new Error("Private import conflict returned no draft.");
      return res.status(409).json({ data: { current: { id: draftId, lockVersion: result.session.current_version } } });
    }
    return res.status(201).json({ data: result });
  }
  catch (error) { const e = error as { statusCode?: number; code?: string; message?: string }; return res.status(e.statusCode ?? 400).json({ error: { code: e.code ?? "private_import_invalid", message: e.message ?? "Private import is invalid." } }); }
}
