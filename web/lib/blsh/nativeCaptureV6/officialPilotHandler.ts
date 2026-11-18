import { createPublicKey, timingSafeEqual, verify } from "node:crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { decodeReviewedEvidenceJSON } from "../../buyLowSellHigh/reviewedFiveGameWindow.server";
import type { OfficialPilotStore, OfficialPilotTarget } from "./officialPilotStore";
import { OFFICIAL_ORIGIN, OFFICIAL_SLOT, officialRuntime, officialSlot, outerRemaining, outerTime, pilotClock, pilotDigest, runOfficialPilot, type FixtureSocket, type PilotIntake } from "./officialPilotAcquisition";

const SOURCE = "2026-11-20";
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/, sha = /^[a-f0-9]{64}$/;
function need(ok: unknown): asserts ok { if (!ok) throw new Error("official_approval_invalid"); }
export const officialPilotApprovalBytes = (a: OfficialPilotTarget) => new TextEncoder().encode(JSON.stringify(["fhfh.blsh.official-pilot-approval.v1",
  a.sourceDate, a.nativeRunId, a.nativeManifestSHA256, a.scheduleSHA256, a.deploymentId, a.gitCommitSha, a.gameIds]));

function readGrant(grant: unknown, pem: string): PilotIntake {
  need(typeof grant === "string" && grant.length > 0 && grant.length <= 4096);
  const bytes = Buffer.from(grant, "base64");
  need(bytes.toString("base64") === grant && pem.length <= 512 && /^-----BEGIN PUBLIC KEY-----\r?\n[A-Za-z0-9+/=\r\n]+\r?\n-----END PUBLIC KEY-----$/.test(pem.trim()));
  const key = createPublicKey(pem);
  need(key.type === "public" && key.asymmetricKeyType === "ed25519");
  const envelope = decodeReviewedEvidenceJSON<{ approval: OfficialPilotTarget; signature: string }>(new Uint8Array(bytes));
  need(envelope && Object.keys(envelope).sort().join(",") === "approval,signature");
  const a = envelope.approval;
  need(a && Object.keys(a).sort().join(",") === "deploymentId,gameIds,gitCommitSha,nativeManifestSHA256,nativeRunId,scheduleSHA256,sourceDate");
  need(a.sourceDate === SOURCE && typeof a.nativeRunId === "string" && uuid.test(a.nativeRunId)
    && typeof a.nativeManifestSHA256 === "string" && sha.test(a.nativeManifestSHA256) && typeof a.scheduleSHA256 === "string" && sha.test(a.scheduleSHA256)
    && typeof a.deploymentId === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(a.deploymentId) && a.deploymentId === process.env.VERCEL_DEPLOYMENT_ID
    && typeof a.gitCommitSha === "string" && /^[a-f0-9]{40}$/.test(a.gitCommitSha) && a.gitCommitSha === process.env.VERCEL_GIT_COMMIT_SHA
    && Array.isArray(a.gameIds) && a.gameIds.length > 0 && a.gameIds.length <= 16 && a.gameIds.every((id, i) =>
      Number.isSafeInteger(id) && /^202602\d{4}$/.test(String(id)) && (i === 0 || id > a.gameIds[i - 1])));
  need(typeof envelope.signature === "string" && /^[A-Za-z0-9+/]{86}==$/.test(envelope.signature));
  const sig = Buffer.from(envelope.signature, "base64");
  need(sig.length === 64 && sig.toString("base64") === envelope.signature && verify(null, officialPilotApprovalBytes(a), key, new Uint8Array(sig)));
  return { approval: a, grantBase64: grant, acquisitionPinsSHA256: pilotDigest(bytes) };
}
function cron(header: string | undefined) {
  const secret = process.env.CRON_SECRET;
  if (!secret?.trim() || typeof header !== "string") return false;
  const a = new Uint8Array(Buffer.from(header)), b = new Uint8Array(Buffer.from("Bearer " + secret));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function officialPilotHandler(routePath: string, fixture?: { socket: FixtureSocket; store: OfficialPilotStore }) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const ingress = pilotClock();
    res.setHeader("Cache-Control", "no-store");
    if (!cron(req.headers.authorization)) return res.status(403).json({ state: "refused", reason: "cron_bearer_required" });
    if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ state: "refused", reason: "method_not_allowed" }); }
    if (Object.keys(req.query ?? {}).length || req.body !== undefined || req.headers["transfer-encoding"] !== undefined
      || (req.headers["content-length"] !== undefined && req.headers["content-length"] !== "0") || req.readableLength > 0) {
      return res.status(400).json({ state: "refused", reason: "unexpected_parameters" });
    }
    const pem = process.env.BLSH_OFFICIAL_PILOT_APPROVAL_PUBLIC_KEY;
    if (!pem) return res.status(200).json({ state: "skipped", reason: "disabled" });
    if (!officialSlot(ingress.wall)) return res.status(409).json({ state: "refused", reason: "outside_official_slot" });
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (process.env.VERCEL_ENV !== "production" || process.env.NEXT_PUBLIC_SUPABASE_URL !== OFFICIAL_ORIGIN || !serviceKey) {
      return res.status(503).json({ state: "refused", reason: "environment_mismatch" });
    }
    let intake: PilotIntake;
    try { intake = readGrant(req.headers["x-blsh-official-grant"], pem); } catch { return res.status(403).json({ state: "refused", reason: "approval_invalid" }); }
    let runtime: ReturnType<typeof officialRuntime>, store: OfficialPilotStore;
    try {
      runtime = officialRuntime(routePath, ingress, fixture?.socket);
      store = fixture?.store ?? (await import("./officialPilotStore")).createOfficialPilotStore({ serviceKey });
      outerTime(ingress, 130000);
      if (!officialSlot(Date.now())) return res.status(409).json({ state: "refused", reason: "outside_official_slot" });
    } catch { return res.status(503).json({ state: "refused", reason: "official_runtime_unverified" }); }
    let claim: Awaited<ReturnType<OfficialPilotStore["claim"]>>;
    const related = { sourceDate: SOURCE, nativeRunId: intake.approval.nativeRunId, nativeManifestSHA256: intake.approval.nativeManifestSHA256 };
    try { claim = await store.claim(intake.approval, () => Math.min(OFFICIAL_SLOT + 60000 - Date.now(), outerRemaining(ingress) - 125000)); }
    catch { return res.status(503).json({ state: "uncertain", reason: "claim_unacknowledged", ...related }); }
    if (!claim.claimed) return res.status(200).json({ state: "skipped", reason: "already_claimed", ...related });
    const runId = claim.runId;
    let packet: Awaited<ReturnType<typeof runOfficialPilot>>;
    try {
      packet = await runOfficialPilot(store, runId, intake, runtime, ingress, fixture?.socket);
    }
    catch {
      try { outerTime(ingress,1); await store.close(runId, "failed", "official_capture_failed", null, null, () => outerRemaining(ingress)); outerTime(ingress); }
      catch { return res.status(503).json({ state: "uncertain", reason: "failure_close_unacknowledged", ...related, runId }); }
      return res.status(502).json({ state: "failed", reason: "official_capture_failed", ...related, runId });
    }
    try {
      need(packet.closeRemaining() > 0);
      await store.close(runId, "packet_complete_pending_review", null, packet.manifestSHA256, packet.manifest, packet.closeRemaining);
      need(packet.closeRemaining() >= 0);
    } catch { return res.status(503).json({ state: "uncertain", reason: "completion_close_unacknowledged", ...related, runId }); }
    return res.status(200).json({ state: "packet_complete_pending_review", sourceDate: SOURCE, runId, manifestSHA256: packet.manifestSHA256, requests: intake.approval.gameIds.length });
  };
}
