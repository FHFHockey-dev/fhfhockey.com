import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { requireApiUser } from "lib/api/requireApiUser";
import { saveDraftProDraftSchema } from "lib/draft-pro/contracts";
import { getDraftProFeatureFlags } from "lib/draft-pro/features";
import { commitSavedDraft, listSavedDrafts } from "lib/draft-pro/savedDraftsServer";
import { loadDraftProAccess, requireDraftProServerCapability } from "lib/draft-pro/server";

const createSchema = saveDraftProDraftSchema.extend({ attemptKey: z.string().min(1).max(120), uploadIds: z.array(z.string().uuid()).max(100).optional(), importIds: z.array(z.string().uuid()).max(100).optional() });
const fail = (res: NextApiResponse, status: number, code: string, message: string) => res.status(status).json({ error: { code, message } });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  if (!["GET", "POST"].includes(req.method ?? "")) { res.setHeader("Allow", "GET, POST"); return fail(res, 405, "method_not_allowed", "GET or POST is required."); }
  const user = await requireApiUser(req, res, { onUnauthorized: (message) => fail(res, 401, "authentication_required", message) });
  if (!user) return;
  try {
    if (req.method === "GET") return res.status(200).json({ data: await listSavedDrafts(user.id) });
    const access = await loadDraftProAccess(user.id, { now: new Date(), flags: getDraftProFeatureFlags(), patreonVerificationAvailable: true });
    requireDraftProServerCapability(access, "saved_drafts");
    const input = createSchema.parse(req.body ?? {});
    const result = await commitSavedDraft({ userId: user.id, draftId: null, name: input.name, expectedVersion: input.expectedVersion, snapshot: input.snapshot, attemptKey: input.attemptKey, importIds: input.importIds });
    return result.conflict ? res.status(409).json({ data: { current: result.current } }) : res.status(201).json({ data: result.draft });
  } catch (cause) {
    const error = cause as { statusCode?: number; code?: string; message?: string };
    if (error.statusCode) return fail(res, error.statusCode, error.code ?? "draft_pro_required", error.message ?? "Draft Pro access is required.");
    if (cause instanceof z.ZodError) return fail(res, 400, "invalid_request", cause.issues[0]?.message ?? "Invalid saved draft.");
    return fail(res, 500, "saved_drafts_unavailable", "Saved Drafts are unavailable. Your local draft is unchanged.");
  }
}
