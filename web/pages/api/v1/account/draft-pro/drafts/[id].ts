import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { requireApiUser } from "lib/api/requireApiUser";
import { getDraftProFeatureFlags } from "lib/draft-pro/features";
import { commitSavedDraft, mutateSavedDraft, readSavedDraft } from "lib/draft-pro/savedDraftsServer";
import { saveDraftProDraftSchema } from "lib/draft-pro/contracts";
import { loadDraftProAccess, requireDraftProServerCapability } from "lib/draft-pro/server";

const idSchema = z.string().uuid();
const mutateSchema = z.object({ action: z.enum(["rename", "duplicate"]), name: z.string().trim().min(1).max(120), expectedVersion: z.number().int().nonnegative() }).strict();
const deleteSchema = z.object({ expectedVersion: z.number().int().nonnegative() }).strict();
const saveSchema = saveDraftProDraftSchema.extend({ attemptKey: z.string().min(1).max(120), uploadIds: z.array(z.string().uuid()).max(100).optional(), importIds: z.array(z.string().uuid()).max(100).optional() });
const fail = (res: NextApiResponse, status: number, code: string, message: string) => res.status(status).json({ error: { code, message } });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  if (!["GET", "PUT", "PATCH", "POST", "DELETE"].includes(req.method ?? "")) { res.setHeader("Allow", "GET, PUT, PATCH, POST, DELETE"); return fail(res, 405, "method_not_allowed", "GET, PUT, PATCH, POST, or DELETE is required."); }
  const user = await requireApiUser(req, res, { onUnauthorized: (message) => fail(res, 401, "authentication_required", message) });
  if (!user) return;
  try {
    const access = await loadDraftProAccess(user.id, { now: new Date(), flags: getDraftProFeatureFlags(), patreonVerificationAvailable: true });
    requireDraftProServerCapability(access, "saved_drafts");
    const id = idSchema.parse(req.query.id);
    if (req.method === "GET") return res.status(200).json({ data: await readSavedDraft(user.id, id) });
    if (req.method === "PUT") {
      const input = saveSchema.parse(req.body ?? {});
      const result = await commitSavedDraft({ userId: user.id, draftId: id, name: input.name, expectedVersion: input.expectedVersion, snapshot: input.snapshot, attemptKey: input.attemptKey, importIds: input.importIds });
      return result.conflict ? res.status(409).json({ data: { current: result.current } }) : res.status(200).json({ data: result.draft });
    }
    if (req.method === "DELETE") {
      const input = deleteSchema.parse(req.body ?? {});
      const result = await mutateSavedDraft({ userId: user.id, draftId: id, action: "delete", expectedVersion: input.expectedVersion });
      return result.conflict ? res.status(409).json({ data: { current: result.current } }) : res.status(200).json({ data: result.draft });
    }
    const input = mutateSchema.parse(req.body ?? {});
    const result = await mutateSavedDraft({ userId: user.id, draftId: id, action: input.action, name: input.name, expectedVersion: input.expectedVersion });
    return result.conflict ? res.status(409).json({ data: { current: result.current } }) : res.status(200).json({ data: result.draft });
  } catch (cause) {
    const error = cause as { statusCode?: number; code?: string; message?: string };
    if (error.statusCode) return fail(res, error.statusCode, error.code ?? "draft_pro_required", error.message ?? "Draft Pro access is required.");
    if (cause instanceof z.ZodError) return fail(res, 400, "invalid_request", cause.issues[0]?.message ?? "Invalid saved draft request.");
    return fail(res, 500, "saved_drafts_unavailable", "Saved Drafts are unavailable. Your local draft is unchanged.");
  }
}
