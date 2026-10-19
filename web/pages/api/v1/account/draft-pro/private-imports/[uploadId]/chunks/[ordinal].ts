import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "lib/api/requireApiUser";
import { getDraftProFeatureFlags } from "lib/draft-pro/features";
import { PRIVATE_IMPORT_CHUNK_BYTES, putPrivateImportChunk } from "lib/draft-pro/privateImportTransport";
import { DraftProRequestError } from "lib/draft-pro/requestError";
import { loadDraftProAccess, requireDraftProServerCapability } from "lib/draft-pro/server";

export const config = { api: { bodyParser: false } };
async function body(req: NextApiRequest) { const pieces: Uint8Array<ArrayBuffer>[] = []; let bytes = 0; for await (const piece of req) { const value = new Uint8Array(piece); bytes += value.byteLength; if (bytes > PRIVATE_IMPORT_CHUNK_BYTES) throw new DraftProRequestError(400, "Chunk exceeds 750 KiB."); pieces.push(value); } const result = new Uint8Array(bytes); let offset = 0; for (const piece of pieces) { result.set(piece, offset); offset += piece.byteLength; } return result; }
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PUT") return res.status(405).json({ error: { code: "method_not_allowed" } });
  const user = await requireApiUser(req, res, { onUnauthorized: (message) => res.status(401).json({ error: { code: "authentication_required", message } }) }); if (!user) return;
  try { const access = await loadDraftProAccess(user.id, { now: new Date(), flags: getDraftProFeatureFlags(), patreonVerificationAvailable: true }); requireDraftProServerCapability(access, "private_imports"); const prefix = req.headers["x-draft-pro-upload-prefix"]; if (typeof prefix !== "string" || !prefix) throw new DraftProRequestError(400, "Upload prefix is required."); const ordinal = Number(req.query.ordinal); const path = await putPrivateImportChunk({ userId: user.id, uploadId: String(req.query.uploadId), prefix, ordinal, bytes: await body(req) }); return res.status(201).json({ data: { path } }); }
  catch (cause) {
    // Typed access/validation errors keep their status and safe message; anything else is an
    // unexpected storage/RPC failure whose details stay in the server log.
    if (cause instanceof DraftProRequestError) return res.status(cause.statusCode).json({ error: { code: cause.code ?? "private_import_chunk_invalid", message: cause.message } });
    console.error("Draft Pro private import chunk upload failed", cause);
    return res.status(500).json({ error: { code: "PRIVATE_IMPORT_CHUNK_UNAVAILABLE", message: "Private imports are unavailable. Your local draft is unchanged." } });
  }
}
