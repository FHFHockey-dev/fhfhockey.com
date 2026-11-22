// PROOF-ONLY stand-in for AWS KMS (ECC_NIST_EDWARDS25519). Same call shapes as @aws-sdk/client-kms GetPublicKey / Sign.
// Non-exportable stand-in: each private KeyObject is created in memory and held only in this closure's Map. The returned
// objects expose no export, no key material and no way to read the Map; nothing is written to disk.
// Policy evaluated per call, modelling the proposed key policy:
//   - kms:Sign only for the signer Lambda's role ARN (caller identity is passed by the harness, as STS would establish it);
//   - kms:MessageType = RAW and kms:SigningAlgorithm = ED25519_SHA_512 only;
//   - aws:CurrentTime inside [notBefore, notAfter) (the per-day fence TJ sets);
//   - key Enabled (DisableKey is the AWS-side stop switch).
import { generateKeyPairSync, sign as edSign } from "node:crypto";

export function createMockKms({ now }) {
  const keys = new Map(); // keyId -> { privateKey, der, enabled, policy }
  const calls = [];
  const fail = (name) => { const e = new Error(name); e.name = name; throw e; };
  const admin = {
    createKey(alias, policy) {
      const { privateKey, publicKey } = generateKeyPairSync("ed25519");
      keys.set(alias, { privateKey, der: new Uint8Array(publicKey.export({ type: "spki", format: "der" })), enabled: true, policy: { ...policy } });
      return alias;
    },
    disableKey(alias) { keys.get(alias).enabled = false; },
    enableKey(alias) { keys.get(alias).enabled = true; },
    putKeyPolicy(alias, policy) { keys.get(alias).policy = { ...policy }; },
    calls: () => calls.map((c) => ({ ...c })),
  };
  function clientFor(principal) {
    return {
      async getPublicKey({ KeyId }) {
        const k = keys.get(KeyId) ?? fail("NotFoundException");
        calls.push({ op: "GetPublicKey", principal, KeyId, ok: true });
        return { KeyId, KeySpec: "ECC_NIST_EDWARDS25519", KeyUsage: "SIGN_VERIFY", SigningAlgorithms: ["ED25519_SHA_512", "ED25519_PH_SHA_512"], PublicKey: k.der };
      },
      async sign({ KeyId, Message, MessageType, SigningAlgorithm }) {
        const k = keys.get(KeyId) ?? fail("NotFoundException");
        const t = now();
        const record = { op: "Sign", principal, KeyId, MessageType, SigningAlgorithm, atUTC: new Date(t).toISOString(), ok: false };
        calls.push(record);
        if (!k.enabled) fail("DisabledException");
        if (principal !== k.policy.signPrincipal) fail("AccessDeniedException");
        if (MessageType !== "RAW" || SigningAlgorithm !== "ED25519_SHA_512") fail("AccessDeniedException");
        if (!(t >= Date.parse(k.policy.notBefore) && t < Date.parse(k.policy.notAfter))) fail("AccessDeniedException");
        if (!(Message instanceof Uint8Array) || Message.length < 1 || Message.length > 4096) fail("ValidationException");
        record.ok = true;
        return { KeyId, SigningAlgorithm, Signature: new Uint8Array(edSign(null, Message, k.privateKey)) };
      },
    };
  }
  return { admin, clientFor };
}

// PROOF-ONLY stand-in for the DynamoDB issuance ledger: durable (file-backed) conditional put.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
export function createFileLedger(path) {
  const load = () => (existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {});
  return {
    async reserve(id, attrs) { const db = load(); if (Object.hasOwn(db, id)) return false; db[id] = attrs; writeFileSync(path, JSON.stringify(db)); return true; },
    async complete(id, attrs) { const db = load(); if (!Object.hasOwn(db, id)) throw new Error("ConditionalCheckFailedException"); db[id] = attrs; writeFileSync(path, JSON.stringify(db)); },
    async get(id) { return load()[id] ?? null; },
    dump: load,
  };
}
