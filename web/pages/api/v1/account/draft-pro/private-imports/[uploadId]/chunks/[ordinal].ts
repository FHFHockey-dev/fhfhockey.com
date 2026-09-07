import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "lib/api/requireApiUser";
import { getDraftProFeatureFlags } from "lib/draft-pro/features";
import { PRIVATE_IMPORT_CHUNK_BYTES, putPrivateImportChunk } from "lib/draft-pro/privateImportTransport";
import { loadDraftProAccess, requireDraftProServerCapability } from "lib/draft-pro/server";

export const config = { api: { bodyParser: false } };
async function body(req: NextApiRequest) { const pieces: Uint8Array<ArrayBuffer>[] = []; let bytes = 0; for await (const piece of req) { const value = new Uint8Array(piece); bytes += value.byteLength; if (bytes > PRIVATE_IMPORT_CHUNK_BYTES) throw new Error("Chunk exceeds 750 KiB."); pieces.push(value); } const result = new Uint8Array(bytes); let offset = 0; for (const piece of pieces) { result.set(piece, offset); offset += piece.byteLength; } return result; }
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PUT") return res.status(405).json({ error: { code: "method_not_allowed" } });
  const user = await requireApiUser(req, res, { onUnauthorized: (message) => res.status(401).json({ error: { code: "authentication_required", message } }) }); if (!user) return;
  try { const access = await loadDraftProAccess(user.id, { now: new Date(), flags: getDraftProFeatureFlags(), patreonVerificationAvailable: true }); requireDraftProServerCapability(access, "private_imports"); const prefix = req.headers["x-draft-pro-upload-prefix"]; if (typeof prefix !== "string" || !prefix) throw new Error("Upload prefix is required."); const ordinal = Number(req.query.ordinal); const path = await putPrivateImportChunk({ userId: user.id, uploadId: String(req.query.uploadId), prefix, ordinal, bytes: await body(req) }); return res.status(201).json({ data: { path } }); }
  catch (error) { const e = error as { statusCode?: number; code?: string; message?: string }; return res.status(e.statusCode ?? 400).json({ error: { code: e.code ?? "private_import_chunk_invalid", message: e.message ?? "Private import chunk is invalid." } }); }
}
