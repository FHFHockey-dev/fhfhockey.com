import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "lib/api/requireApiUser";
import { getDraftProFeatureFlags } from "lib/draft-pro/features";
import { readPrivateImportRows } from "lib/draft-pro/privateImportTransport";
import { loadDraftProAccess, requireDraftProServerCapability } from "lib/draft-pro/server";
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end(); const user = await requireApiUser(req,res,{onUnauthorized:(message)=>res.status(401).json({error:{code:"authentication_required",message}})}); if(!user)return;
  try { const access=await loadDraftProAccess(user.id,{now:new Date(),flags:getDraftProFeatureFlags(),patreonVerificationAvailable:true}); requireDraftProServerCapability(access,"private_imports"); return res.status(200).json({data:{rows:await readPrivateImportRows({userId:user.id,draftId:String(req.query.id),importId:String(req.query.importId)})}}); } catch { return res.status(404).json({error:{code:"private_import_unavailable",message:"Private import is unavailable."}}); }
}
