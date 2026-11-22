// Option V1 (Supabase only, no added cost): the same evidence policy (blshSigner.mjs, unchanged rules) hosted as one
// Supabase Edge Function. Differences from the AWS design:
//   - Keys: two Ed25519 private keys (PKCS#8, base64) held in the postgres-owned table fhfh_internal.blsh_signer_secrets
//     (option V1b; Vault was evaluated first and refuted because service_role can read it), read per request over the
//     function's own database connection. They are NOT non-exportable: see PROPOSAL-SUPABASE.md section 3 for who can read them.
//   - Evidence is PULLED by the signer from Postgres (fhfh_internal.blsh_signer_evidence_<slate>), so the trigger carries
//     no body at all: the only accepted request body is "{}" (what pg_net sends by default).
//   - The one-shot ledger is a Postgres table (insert ... on conflict do nothing), not DynamoDB.
// The adapters below are runtime-neutral; supabase-edge-index.ts wires them to Deno/WebCrypto and postgres.
import { createPrivateKey, createPublicKey, sign as edSign } from "node:crypto";
import { timingSafeEqual } from "node:crypto";
import { checkMandate, createSigner, fingerprintOfDer } from "./blshSigner.mjs";

/** Key adapter with the KMS call shapes the policy core expects. keyId = Vault secret name. */
export function vaultKeyAdapter(readSecret) {
  const load = async (name) => {
    const b64 = await readSecret(name);
    if (typeof b64 !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) throw new Error("vault_key_missing");
    const key = createPrivateKey({ key: Buffer.from(b64, "base64"), format: "der", type: "pkcs8" });
    if (key.asymmetricKeyType !== "ed25519") throw new Error("vault_key_type");
    return key;
  };
  return {
    async getPublicKey({ KeyId }) {
      const key = await load(KeyId);
      return { KeyId, KeySpec: "ED25519", PublicKey: new Uint8Array(createPublicKey(key).export({ type: "spki", format: "der" })) };
    },
    async sign({ KeyId, Message, MessageType, SigningAlgorithm }) {
      if (MessageType !== "RAW" || SigningAlgorithm !== "ED25519_SHA_512") throw new Error("unsupported");
      return { KeyId, Signature: new Uint8Array(edSign(null, Message, await load(KeyId))) };
    },
  };
}

/**
 * deps: { mandate(), now(), db: { evidence(kind) -> jsonText, readSecret(name), reserve(slot, attrs) -> bool,
 *         complete(slot, attrs), get(slot), selfcheck() -> { currentUser, ledgerWritable } }, nhlSchedule(date), log(event) }
 */
export const TRIGGER_SECRET_NAME = "blsh_signer_trigger_secret";
const refuse = (deps, kind, status, reason) => { deps.log?.({ decision: "refused", kind, reason }); return { status, body: { state: "refused", reason } }; };
/**
 * Order matters: route, method, query, body, BEARER, mandate and WINDOW are all checked before any database work beyond
 * reading the bearer, so an unauthenticated or out-of-window call never runs the evidence function or touches keys/ledger.
 */
export function createSupabaseSigner(deps) {
  async function handle(req) {
    const kind = { "/request-context": "request-context", "/official": "official", "/selfcheck": "selfcheck" }[req.path];
    if (kind === undefined) return refuse(deps, null, 404, "unknown_route");
    if (req.method !== "POST") return refuse(deps, kind, 405, "method_not_allowed");
    if (req.rawQuery) return refuse(deps, kind, 400, "unexpected_parameters");
    if (!(req.body === "" || req.body === "{}")) return refuse(deps, kind, 400, "unexpected_body");
    let secret = "";
    try { secret = (await deps.db.readSecret(TRIGGER_SECRET_NAME)) ?? ""; } catch { secret = ""; }
    const a = Buffer.from(String(req.headers?.authorization ?? "")), b = Buffer.from("Bearer " + secret);
    if (!(secret.length >= 32 && a.length === b.length && timingSafeEqual(a, b))) return refuse(deps, kind, 403, "trigger_bearer_required");
    if (kind === "selfcheck") return { status: 200, body: await selfcheck() };
    let windows;
    try { windows = checkMandate(deps.mandate()); } catch (e) { return refuse(deps, kind, e?.status ?? 423, e?.reason ?? "mandate_invalid"); }
    const now = deps.now(), m = deps.mandate(), [w0, w1] = kind === "request-context" ? windows.rc : windows.official;
    if (!(new Date(now).toISOString().slice(0, 10) === m.captureDate && now >= w0 && now < w1)) return refuse(deps, kind, 409, "outside_signing_window");
    let evidence = "";
    try { evidence = await deps.db.evidence(kind); } catch { evidence = ""; }   // the core refuses an empty body
    const core = createSigner({
      mandate: deps.mandate, now: deps.now, triggerSecret: () => secret, nhlSchedule: deps.nhlSchedule, log: deps.log,
      kms: vaultKeyAdapter(deps.db.readSecret),
      ledger: { reserve: deps.db.reserve, complete: deps.db.complete, get: deps.db.get },
    });
    return core.handle({ ...req, body: evidence });
  }
  /** No signature. Proves, on the real runtime, every privilege the 12:35/12:41 path needs; returns public facts only. */
  async function selfcheck() {
    const m = (() => { try { return deps.mandate(); } catch { return null; } })();
    const keys = {};
    for (const label of ["requestContext", "official"]) {
      const ref = m?.keys?.[label];
      try {
        const pub = await vaultKeyAdapter(deps.db.readSecret).getPublicKey({ KeyId: ref?.keyId });
        keys[label] = fingerprintOfDer(pub.PublicKey) === ref?.fingerprint ? "matches_mandate" : "mismatch";
      } catch { keys[label] = "unreadable"; }
    }
    const evidence = {};
    for (const k of ["request-context", "official"]) {
      try { const e = JSON.parse(await deps.db.evidence(k)); evidence[k] = e?.version === "fhfh.blsh.signer-evidence.v1" ? "ok" : "bad"; }
      catch { evidence[k] = "unavailable"; }
    }
    let probe;
    try { probe = await deps.db.selfcheck(); } catch { probe = { currentUser: null, ledgerWritable: false }; }
    deps.log?.({ decision: "selfcheck", keys, evidence, ledgerWritable: probe.ledgerWritable });
    return { state: "selfcheck", currentUser: probe.currentUser, ledgerWritable: probe.ledgerWritable, keys, evidence,
      mandateArmed: m?.armed === true };
  }
  return { handle };
}

/** One-shot key generation inside Supabase (run once per candidate, then the function is deleted). Returns public data only. */
export async function generateVaultKeys({ names, secretExists, createSecret }) {
  const out = {};
  for (const [label, name] of Object.entries(names)) {
    if (await secretExists(name)) throw new Error("keygen_refused_exists:" + name);
  }
  for (const [label, name] of Object.entries(names)) {
    const { generateKeyPairSync, createHash } = await import("node:crypto");
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    await createSecret(name, privateKey.export({ type: "pkcs8", format: "der" }).toString("base64"));
    const der = publicKey.export({ type: "spki", format: "der" });
    out[label] = { vaultName: name, publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
      fingerprint: "sha256:" + createHash("sha256").update(der).digest("hex") };
  }
  return out;
}
