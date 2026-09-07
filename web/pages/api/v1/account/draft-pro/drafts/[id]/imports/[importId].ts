import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "lib/api/requireApiUser";
import { getDraftProFeatureFlags } from "lib/draft-pro/features";
import { readPrivateImportChunk } from "lib/draft-pro/privateImportTransport";
import { loadDraftProAccess, requireDraftProServerCapability } from "lib/draft-pro/server";
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end(); const user = await requireApiUser(req,res,{onUnauthorized:(message)=>res.status(401).json({error:{code:"authentication_required",message}})}); if(!user)return;
  try { const access=await loadDraftProAccess(user.id,{now:new Date(),flags:getDraftProFeatureFlags(),patreonVerificationAvailable:true}); requireDraftProServerCapability(access,"private_imports"); const chunk=await readPrivateImportChunk({userId:user.id,draftId:String(req.query.id),importId:String(req.query.importId),ordinal:Number(req.query.ordinal ?? 0)}); res.setHeader("Content-Type","application/octet-stream"); res.setHeader("X-Draft-Pro-Total-Bytes",String(chunk.totalBytes)); res.setHeader("X-Draft-Pro-Total-Chunks",String(chunk.totalChunks)); res.setHeader("X-Draft-Pro-SHA256",chunk.sha256); res.setHeader("X-Draft-Pro-Row-Count",String(chunk.rowCount)); return res.status(200).send(chunk.bytes); } catch { return res.status(404).json({error:{code:"private_import_unavailable",message:"Private import is unavailable."}}); }
}
