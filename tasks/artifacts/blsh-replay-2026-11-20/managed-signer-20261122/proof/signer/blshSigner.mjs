// BLSH v6 managed signer: the evidence policy that decides whether to issue one of the two pilot approvals.
// Proposed to run as one AWS Lambda ("blsh-signer") whose execution role is the only principal the two KMS keys allow.
// It never receives a message to sign. It builds the exact verifier bytes itself from:
//   (a) TJ's mandate (Lambda configuration, set by TJ before ARM),
//   (b) the evidence the database pushes (built inside Postgres by the pg_cron step, not by the Vercel app),
//   (c) the public NHL schedule (third party), and
//   (d) its own one-shot issuance ledger (DynamoDB conditional put).
// Byte layouts below are copies of web/lib/blsh/nativeCaptureV6/{requestContextHandler,officialPilotHandler}.ts at Y 1efdfb436;
// the proof imports Y's own functions and asserts byte equality, so a drift fails the proof.
import { createHash, createPublicKey, timingSafeEqual, verify } from "node:crypto";

export const NS_RC = "fhfh.blsh.request-context-approval.v1";
export const NS_OFFICIAL = "fhfh.blsh.official-pilot-approval.v1";
export const requestContextBytes = (a) => new TextEncoder().encode(JSON.stringify([NS_RC,
  a.sourceDate, a.nativeRunId, a.nativeManifestSHA256, a.deploymentId, a.gitCommitSha]));
export const officialBytes = (a) => new TextEncoder().encode(JSON.stringify([NS_OFFICIAL,
  a.sourceDate, a.nativeRunId, a.nativeManifestSHA256, a.scheduleSHA256, a.deploymentId, a.gitCommitSha, a.gameIds]));

const NATIVE_NAMES = ["STARTED.json", "PLAN.json", "RUNTIME.json", "operation-1-STARTED.json", "operation-1-SETTLED.json",
  "schedule.raw.json", "schedule.TRANSPORT-OBSERVATION.json", "operation-2-STARTED.json", "operation-2-SETTLED.json",
  "operation-3-STARTED.json", "operation-3-SETTLED.json", "individual.parser-input.html", "individual.TRANSPORT-OBSERVATION.json",
  "operation-4-STARTED.json", "operation-4-SETTLED.json", "operation-5-STARTED.json", "operation-5-SETTLED.json",
  "onIce.parser-input.html", "onIce.TRANSPORT-OBSERVATION.json", "MANIFEST.json"];
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/, SHA256 = /^[0-9a-f]{64}$/, SHA1 = /^[0-9a-f]{40}$/;
const DEPLOYMENT = /^dpl_[A-Za-z0-9_-]{1,124}$/, DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86400000, MAX_BODY = 16384;
const KIND = { "/request-context": "request-context", "/official": "official" };

class Refusal extends Error { constructor(status, reason) { super(reason); this.status = status; this.reason = reason; } }
const need = (ok, status, reason) => { if (!ok) throw new Refusal(status, reason); };
const iso = (ms) => new Date(ms).toISOString();
const ms = (text) => { const t = typeof text === "string" ? Date.parse(text) : NaN; return Number.isFinite(t) ? t : NaN; };
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const exactKeys = (o, keys) => o !== null && typeof o === "object" && !Array.isArray(o) && Object.keys(o).sort().join(",") === [...keys].sort().join(",");

/** JSON.parse that refuses duplicate member names at any depth (same idea as core.ts's schedule scan). */
export function strictJSON(text) {
  const value = JSON.parse(text);
  const tokens = [...text.matchAll(/"(?:\\.|[^"\\])*"|[{}\[\]:,]/g)].map((m) => m[0]), stack = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === "{" || t === "[") { stack.push(t === "{" ? new Set() : null); if (stack.length > 32) throw new Error("depth"); }
    else if (t === "}" || t === "]") stack.pop();
    else if (t.startsWith('"') && tokens[i + 1] === ":") {
      const key = JSON.parse(t), keys = stack[stack.length - 1];
      if (!keys || keys.has(key)) throw new Error("duplicate_key"); keys.add(key);
    }
  }
  return value;
}

/** Fingerprint used throughout BLSH custody: sha256 of the 44-byte SPKI DER. */
export const fingerprintOfDer = (der) => "sha256:" + sha256(der);
export const pemOfDer = (der) => createPublicKey({ key: Buffer.from(der), format: "der", type: "spki" }).export({ type: "spki", format: "pem" }).toString();

/** The mandate is TJ's approval record. It is validated in full on every request; any defect disarms. */
export function checkMandate(m) {
  need(exactKeys(m, ["version", "armed", "sourceDate", "captureDate", "gameIds", "deploymentId", "gitCommitSha", "keys", "windows", "approvalRef"]),
    423, "mandate_invalid");
  need(m.version === "fhfh.blsh.signer-mandate.v1", 423, "mandate_invalid");
  need(m.armed === true, 423, "signer_disarmed");
  need(DAY.test(m.sourceDate) && DAY.test(m.captureDate) && iso(ms(m.sourceDate) + DAY_MS).slice(0, 10) === m.captureDate, 423, "mandate_invalid");
  need(Array.isArray(m.gameIds) && m.gameIds.length >= 1 && m.gameIds.length <= 16 && m.gameIds.every((id, i) =>
    Number.isSafeInteger(id) && /^202602\d{4}$/.test(String(id)) && (i === 0 || id > m.gameIds[i - 1])), 423, "mandate_invalid");
  need(DEPLOYMENT.test(m.deploymentId) && SHA1.test(m.gitCommitSha), 423, "mandate_invalid");
  need(exactKeys(m.keys, ["requestContext", "official"]) && ["requestContext", "official"].every((k) =>
    exactKeys(m.keys[k], ["keyId", "fingerprint"]) && typeof m.keys[k].keyId === "string" && /^sha256:[0-9a-f]{64}$/.test(m.keys[k].fingerprint))
    && m.keys.requestContext.fingerprint !== m.keys.official.fingerprint && m.keys.requestContext.keyId !== m.keys.official.keyId, 423, "mandate_invalid");
  // Windows are bounded by code, not only by the mandate: request-context inside 12:35-12:39, official inside 12:41-12:44:30,
  // both on the capture day. A mandate cannot widen them.
  const day = ms(m.captureDate), w = m.windows;
  need(exactKeys(w, ["requestContext", "official"]), 423, "mandate_invalid");
  const [r0, r1] = (w.requestContext ?? []).map(ms), [o0, o1] = (w.official ?? []).map(ms);
  need([r0, r1, o0, o1].every(Number.isFinite) && r0 < r1 && r1 <= o0 && o0 < o1
    && r0 >= day + 45300000 && r1 <= day + 45540000 && o0 >= day + 45660000 && o1 <= day + 45870000, 423, "mandate_invalid");
  need(typeof m.approvalRef === "string" && /^[A-Za-z0-9 ._:#-]{3,120}$/.test(m.approvalRef), 423, "mandate_invalid");
  return { rc: [r0, r1], official: [o0, o1] };
}

/** Public NHL schedule check: every game on the slate is final, regular season, and the set equals the mandate. */
function slateFromSchedule(data, date) {
  need(data && Array.isArray(data.gameWeek), 503, "third_party_schedule_invalid");
  const days = data.gameWeek.filter((d) => d && d.date === date);
  need(days.length === 1 && Array.isArray(days[0].games), 503, "third_party_schedule_invalid");
  const ids = [];
  for (const g of days[0].games) {
    need(g && Number.isSafeInteger(g.id) && /^202602\d{4}$/.test(String(g.id)), 503, "third_party_schedule_invalid");
    need(g.season === 20262027 && g.gameType === 2 && ["OFF", "FINAL"].includes(String(g.gameState)) && g.gameScheduleState === "OK",
      409, "slate_not_final");
    ids.push(g.id);
  }
  return ids.sort((a, b) => a - b);
}

function verifyNative(e, m, now, windows) {
  need(Array.isArray(e.nativeRuns), 422, "evidence_invalid");
  need(e.nativeRuns.length > 0, 409, "native_receipt_missing");
  need(e.nativeRuns.length === 1, 409, "evidence_conflict");   // (pipeline, source_date) is unique in the DB; two rows is a conflict
  const r = e.nativeRuns[0];
  need(exactKeys(r, ["runId", "sourceDate", "state", "reason", "manifestSHA256", "claimedAtUTC", "closedAtUTC", "prunedAtUTC", "deployment"]), 422, "evidence_invalid");
  need(r.state === "packet_complete_pending_review" && r.reason === null && r.prunedAtUTC === null, 409, "native_receipt_unverified");
  need(UUID.test(r.runId) && SHA256.test(r.manifestSHA256) && r.sourceDate === m.sourceDate, 409, "native_receipt_unverified");
  const claimed = ms(r.claimedAtUTC), closed = ms(r.closedAtUTC), day = ms(m.captureDate);
  // The native permit window is 12:05:00-12:07:00 on the capture day (INSTALL); closure must precede this request window.
  need(claimed >= day + 43500000 && claimed < day + 43620000 && closed >= claimed && closed < windows.rc[0], 409, "native_receipt_unverified");
  need(r.deployment !== null && typeof r.deployment === "object" && r.deployment.deploymentId === m.deploymentId
    && r.deployment.gitCommitSha === m.gitCommitSha, 409, "deployment_mismatch");
  const src = e.nativeSource;
  need(src && typeof src === "object", 409, "native_receipt_unverified");
  need(src.nativeRunId === r.runId && src.sourceDate === m.sourceDate && src.nativeManifestSHA256 === r.manifestSHA256
    && ms(src.closedAtUTC) === closed && ms(src.claimedAtUTC) === claimed, 409, "evidence_conflict");
  need(Array.isArray(src.objects) && src.objects.length === 20 && src.objects.every((o, i) => o && o.ordinal === i + 1
    && o.path === `native-v6/${m.sourceDate}/${r.runId}/${NATIVE_NAMES[i]}` && SHA256.test(o.sha256) && Number.isSafeInteger(o.bytes) && o.bytes > 0),
    409, "native_receipt_unverified");
  need(src.objects[19].sha256 === r.manifestSHA256, 409, "evidence_conflict");
  return { nativeRunId: r.runId, nativeManifestSHA256: r.manifestSHA256, scheduleSHA256: src.objects[5].sha256 };
}

/**
 * deps: { mandate(): object, now(): number, triggerSecret(): string, kms, ledger, nhlSchedule(date): Promise<object>, log(event) }
 * kms: { getPublicKey({KeyId}) -> {PublicKey: Uint8Array DER, KeySpec}, sign({KeyId, Message, MessageType, SigningAlgorithm}) -> {Signature} }
 * ledger: { reserve(id, attrs) -> Promise<boolean> (conditional put), complete(id, attrs), get(id) }
 */
export function createSigner(deps) {
  async function handle(req) {
    const kind = KIND[req.path];
    try {
      // 1. Transport: one fixed route per approval, POST only, no query, bearer from Vault, bounded JSON body.
      need(kind !== undefined, 404, "unknown_route");
      need(req.method === "POST", 405, "method_not_allowed");
      need(!req.rawQuery, 400, "unexpected_parameters");
      const secret = deps.triggerSecret(), auth = String(req.headers?.authorization ?? "");
      const a = Buffer.from(auth), b = Buffer.from("Bearer " + secret);
      need(typeof secret === "string" && secret.length >= 32 && a.length === b.length && timingSafeEqual(a, b), 403, "trigger_bearer_required");
      need(/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(String(req.headers?.["content-type"] ?? "")), 400, "evidence_invalid");
      need(typeof req.body === "string" && req.body.length > 0 && Buffer.byteLength(req.body) <= MAX_BODY, 400, "evidence_invalid");
      // 2. Mandate (TJ) and the clock window. Anything outside the approved minute range is refused before evidence is read.
      const m = deps.mandate();
      const windows = checkMandate(m);
      const now = deps.now(), [w0, w1] = kind === "request-context" ? windows.rc : windows.official;
      need(iso(now).slice(0, 10) === m.captureDate && now >= w0 && now < w1, 409, "outside_signing_window");
      // 3. Evidence, pushed by the database step. Its shape is fixed; it carries no field that names what to sign.
      let e;
      try { e = strictJSON(req.body); } catch { throw new Refusal(400, "evidence_invalid"); }
      need(exactKeys(e, kind === "request-context"
        ? ["version", "kind", "dbClockUTC", "pilotPin", "nativeRuns", "nativeSource"]
        : ["version", "kind", "dbClockUTC", "pilotPin", "nativeRuns", "nativeSource", "contextRuns", "officialRunCount"]), 400, "evidence_invalid");
      need(e.version === "fhfh.blsh.signer-evidence.v1" && e.kind === kind, 400, "evidence_invalid");
      need(Math.abs(ms(e.dbClockUTC) - now) <= 30000, 409, "evidence_stale");
      need(exactKeys(e.pilotPin, ["releaseSha", "deploymentId"]), 409, "deployment_mismatch");
      need(e.pilotPin.deploymentId === m.deploymentId && e.pilotPin.releaseSha === m.gitCommitSha, 409, "deployment_mismatch");
      const native = verifyNative(e, m, now, windows);
      let approval, bytes, keyRef;
      if (kind === "request-context") {
        approval = { sourceDate: m.sourceDate, nativeRunId: native.nativeRunId, nativeManifestSHA256: native.nativeManifestSHA256,
          deploymentId: m.deploymentId, gitCommitSha: m.gitCommitSha };
        bytes = requestContextBytes(approval); keyRef = m.keys.requestContext;
      } else {
        need(Array.isArray(e.contextRuns), 400, "evidence_invalid");
        need(e.contextRuns.length === 1 && e.contextRuns[0]?.state === "packet_complete_pending_review", 409, "context_incomplete");
        const c = e.contextRuns[0];
        need(c.nativeRunId === native.nativeRunId && c.nativeManifestSHA256 === native.nativeManifestSHA256 && c.sourceDate === m.sourceDate,
          409, "evidence_conflict");
        need(e.officialRunCount === 0, 409, "evidence_conflict");
        // Order: the request-context approval for this exact native receipt must have been issued by this signer.
        const prior = await deps.ledger.get(`request-context#${m.sourceDate}`);
        need(prior && prior.state === "issued" && prior.nativeRunId === native.nativeRunId && prior.nativeManifestSHA256 === native.nativeManifestSHA256,
          409, "evidence_conflict");
        let schedule;
        try { schedule = await deps.nhlSchedule(m.sourceDate); } catch { throw new Refusal(503, "third_party_schedule_unavailable"); }
        const ids = slateFromSchedule(schedule, m.sourceDate);
        need(JSON.stringify(ids) === JSON.stringify(m.gameIds), 409, "slate_mismatch");
        approval = { sourceDate: m.sourceDate, nativeRunId: native.nativeRunId, nativeManifestSHA256: native.nativeManifestSHA256,
          scheduleSHA256: native.scheduleSHA256, deploymentId: m.deploymentId, gitCommitSha: m.gitCommitSha, gameIds: [...m.gameIds] };
        bytes = officialBytes(approval); keyRef = m.keys.official;
      }
      // 4. Key identity: the KMS key must be the one whose fingerprint TJ approved and Vercel holds.
      let pub;
      try { pub = await deps.kms.getPublicKey({ KeyId: keyRef.keyId }); } catch { throw new Refusal(503, "kms_unavailable"); }
      need(pub && ["ECC_NIST_EDWARDS25519", "ED25519"].includes(pub.KeySpec) && fingerprintOfDer(pub.PublicKey) === keyRef.fingerprint, 503, "key_identity_mismatch");
      // 5. One shot: reserve before signing. A crash after this point leaves the slot reserved and every retry refused.
      const slot = `${kind}#${m.sourceDate}`;
      const reserved = await deps.ledger.reserve(slot, { state: "reserved", reservedAtUTC: iso(now), messageSHA256: sha256(bytes),
        nativeRunId: native.nativeRunId, nativeManifestSHA256: native.nativeManifestSHA256 });
      need(reserved === true, 409, "duplicate_request");
      let signature;
      try {
        const out = await deps.kms.sign({ KeyId: keyRef.keyId, Message: bytes, MessageType: "RAW", SigningAlgorithm: "ED25519_SHA_512" });
        signature = Buffer.from(out.Signature);
      } catch { throw new Refusal(503, "kms_sign_failed"); }
      need(signature.length === 64 && verify(null, bytes, createPublicKey(pemOfDer(pub.PublicKey)), signature), 503, "kms_signature_invalid");
      const envelope = { approval, signature: signature.toString("base64") };
      await deps.ledger.complete(slot, { state: "issued", nativeRunId: native.nativeRunId, nativeManifestSHA256: native.nativeManifestSHA256,
        messageSHA256: sha256(bytes), issuedAtUTC: iso(deps.now()) });
      deps.log?.({ decision: "issued", kind, sourceDate: m.sourceDate, messageSHA256: sha256(bytes), keyFingerprint: keyRef.fingerprint });
      const out = { state: "issued", kind, messageSHA256: sha256(bytes), envelope };
      // The official grant travels as the base64 of the exact envelope bytes; precomputed here so SQL never re-encodes it.
      if (kind === "official") out.grantBase64 = Buffer.from(JSON.stringify(envelope), "utf8").toString("base64");
      return { status: 200, body: out };
    } catch (error) {
      const refusal = error instanceof Refusal ? error : new Refusal(500, "signer_internal_error");
      deps.log?.({ decision: "refused", kind: kind ?? null, reason: refusal.reason });
      return { status: refusal.status, body: { state: "refused", reason: refusal.reason } };
    }
  }
  return { handle };
}
