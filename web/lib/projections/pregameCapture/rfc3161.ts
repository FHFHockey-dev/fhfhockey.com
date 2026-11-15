import { createHash, verify as verifySignature, X509Certificate } from "node:crypto";
import { encodeOid, encodeUnsigned, generalizedTimeMicros, integer, kids, oid, parseDerExact, seq, tlv, type DerNode } from "./der";

/**
 * RFC 3161 trusted timestamp: request building and strict offline verification.
 * Only a SHA-256 digest leaves the process. The token's signer must chain to a
 * pinned trust anchor; its genTime plus accuracy gives the conservative bound.
 */

const OID = {
  sha256: "2.16.840.1.101.3.4.2.1", sha384: "2.16.840.1.101.3.4.2.2", sha512: "2.16.840.1.101.3.4.2.3",
  signedData: "1.2.840.113549.1.7.2", tstInfo: "1.2.840.113549.1.9.16.1.4",
  contentType: "1.2.840.113549.1.9.3", messageDigest: "1.2.840.113549.1.9.4",
  signingCertificate: "1.2.840.113549.1.9.16.2.12", signingCertificateV2: "1.2.840.113549.1.9.16.2.47",
  rsa: "1.2.840.113549.1.1.1", rsaSha256: "1.2.840.113549.1.1.11", rsaSha384: "1.2.840.113549.1.1.12", rsaSha512: "1.2.840.113549.1.1.13",
  ecdsaSha256: "1.2.840.10045.4.3.2", ecdsaSha384: "1.2.840.10045.4.3.3", ecdsaSha512: "1.2.840.10045.4.3.4",
  timeStamping: "1.3.6.1.5.5.7.3.8",
} as const;

const HASH_BY_OID: Record<string, string> = { [OID.sha256]: "sha256", [OID.sha384]: "sha384", [OID.sha512]: "sha512" };
const SIG_HASH: Record<string, string | null> = {
  [OID.rsa]: null, [OID.rsaSha256]: "sha256", [OID.rsaSha384]: "sha384", [OID.rsaSha512]: "sha512",
  [OID.ecdsaSha256]: "sha256", [OID.ecdsaSha384]: "sha384", [OID.ecdsaSha512]: "sha512",
};

export function buildTimeStampRequest(sha256Digest: Buffer, nonce: bigint): Buffer {
  if (sha256Digest.length !== 32) throw new Error("tsa_digest_not_sha256");
  const imprint = seq(seq(encodeOid(OID.sha256), Buffer.from([0x05, 0x00])), tlv(0x04, sha256Digest));
  return seq(encodeUnsigned(1n), imprint, encodeUnsigned(nonce), Buffer.from([0x01, 0x01, 0xff]));
}

export interface TsaTrust {
  /** PEM trust anchors (root or pinned intermediate). The signer must chain to one. */
  anchorsPem: string[];
  /** Accepted TSA policy OIDs; empty means any. */
  policies?: string[];
  /** Used only when a token omits Accuracy; recorded as accuracySource "pinned_policy". Absent → refuse. */
  fallbackAccuracyMicros?: bigint;
}

export interface VerifiedTimestamp {
  genTime: string; genTimeMicros: bigint;
  accuracyMicros: bigint; accuracySource: "token" | "pinned_policy";
  lowerMicros: bigint; upperMicros: bigint;
  policy: string; serial: string; nonce: string | null;
  signerSha256: string; tokenSha256: string;
}

/** Accepts either a full TimeStampResp or a bare TimeStampToken (ContentInfo). */
export function extractToken(der: Buffer): Buffer {
  const root = parseDerExact(der);
  const parts = kids(root, 0x30);
  if (parts[0]?.tag === 0x30 && parts[0].children?.[0]?.tag === 0x02) {
    const status = integer(parts[0].children[0]);
    if (status !== 0n && status !== 1n) throw new Error(`tsa_status_${status}`);
    if (!parts[1]) throw new Error("tsa_no_token");
    return Buffer.from(parts[1].bytes);
  }
  return Buffer.from(der);
}

export function verifyTimeStampToken(tokenDer: Buffer, expect: { sha256Digest: Buffer; nonce: bigint | null }, trust: TsaTrust): VerifiedTimestamp {
  const contentInfo = kids(parseDerExact(tokenDer), 0x30);
  if (oid(contentInfo[0]) !== OID.signedData) throw new Error("tsa_not_signed_data");
  const signedData = kids(kids(contentInfo[1], 0xa0)[0], 0x30);
  let i = 1; // skip version
  i++; // digestAlgorithms
  const encap = kids(signedData[i++], 0x30);
  if (oid(encap[0]) !== OID.tstInfo) throw new Error("tsa_not_tstinfo");
  const tstOctets = kids(encap[1], 0xa0)[0];
  if (tstOctets.tag !== 0x04) throw new Error("tsa_tstinfo_not_octets");
  const tstInfoDer = Buffer.from(tstOctets.value);
  let certs: X509Certificate[] = [];
  if (signedData[i]?.tag === 0xa0) certs = kids(signedData[i++]).map((node) => new X509Certificate(node.bytes));
  if (signedData[i]?.tag === 0xa1) i++;
  const signerInfos = kids(signedData[i], 0x31);
  if (signerInfos.length !== 1) throw new Error("tsa_signer_count");
  const signer = kids(signerInfos[0], 0x30);

  // --- TSTInfo ---
  const tst = kids(parseDerExact(tstInfoDer), 0x30);
  const policy = oid(tst[1]);
  if (trust.policies?.length && !trust.policies.includes(policy)) throw new Error("tsa_policy_not_pinned");
  const imprint = kids(tst[2], 0x30);
  if (oid(kids(imprint[0], 0x30)[0]) !== OID.sha256) throw new Error("tsa_imprint_alg");
  if (!Buffer.from(imprint[1].value).equals(expect.sha256Digest)) throw new Error("tsa_imprint_mismatch");
  const serial = integer(tst[3]).toString();
  const gen = generalizedTimeMicros(tst[4]);
  let accuracyMicros: bigint | null = null, nonce: bigint | null = null;
  for (const node of tst.slice(5)) {
    if (node.tag === 0x30) {
      accuracyMicros = 0n;
      for (const part of kids(node)) {
        if (part.tag === 0x02) accuracyMicros += integer(part) * 1_000_000n;
        else if (part.tag === 0x80) accuracyMicros += integer(part) * 1_000n;
        else if (part.tag === 0x81) accuracyMicros += integer(part);
      }
    } else if (node.tag === 0x02) nonce = integer(node);
  }
  if (expect.nonce !== null && nonce !== expect.nonce) throw new Error("tsa_nonce_mismatch");
  let accuracySource: VerifiedTimestamp["accuracySource"] = "token";
  if (accuracyMicros === null) {
    if (trust.fallbackAccuracyMicros === undefined) throw new Error("tsa_accuracy_missing");
    accuracyMicros = trust.fallbackAccuracyMicros; accuracySource = "pinned_policy";
  }

  // --- SignerInfo ---
  let s = 1; // version
  s++; // sid
  const digestAlg = HASH_BY_OID[oid(kids(signer[s++], 0x30)[0])];
  if (!digestAlg) throw new Error("tsa_digest_alg");
  if (signer[s]?.tag !== 0xa0) throw new Error("tsa_no_signed_attrs");
  const signedAttrsNode = signer[s++];
  const sigAlgOid = oid(kids(signer[s++], 0x30)[0]);
  const signature = Buffer.from(signer[s].value);
  const attrs = new Map<string, DerNode>();
  for (const attr of kids(signedAttrsNode)) {
    const [type, values] = kids(attr, 0x30);
    const key = oid(type);
    if (attrs.has(key)) throw new Error("tsa_duplicate_attr");
    attrs.set(key, kids(values, 0x31)[0]);
  }
  if (oid(attrs.get(OID.contentType)!) !== OID.tstInfo) throw new Error("tsa_attr_content_type");
  const md = attrs.get(OID.messageDigest);
  if (!md || !Buffer.from(md.value).equals(createHash(digestAlg).update(tstInfoDer).digest())) throw new Error("tsa_message_digest");

  // Identify the signer through the signed ESS certificate binding (not the unsigned sid alone).
  const signerCert = certs.find((cert) => essBinds(attrs, cert));
  if (!signerCert) throw new Error("tsa_signer_cert_unbound");
  const toVerify = Buffer.concat([Buffer.from([0x31]), signedAttrsNode.bytes.subarray(1)]);
  const sigHash = SIG_HASH[sigAlgOid] === null ? digestAlg : SIG_HASH[sigAlgOid];
  if (!sigHash) throw new Error("tsa_signature_alg");
  if (!verifySignature(sigHash, toVerify, signerCert.publicKey, signature)) throw new Error("tsa_bad_signature");

  // Signer must be a timestamping certificate valid at genTime and chain to a pinned anchor.
  if (!(signerCert.keyUsage ?? []).includes(OID.timeStamping)) throw new Error("tsa_signer_not_timestamping");
  const genMs = Number(gen.micros / 1000n);
  assertValidAt(signerCert, genMs);
  chainToAnchor(signerCert, certs, trust.anchorsPem.map((pem) => new X509Certificate(pem)), genMs);

  return {
    genTime: gen.text, genTimeMicros: gen.micros, accuracyMicros, accuracySource,
    lowerMicros: gen.micros - accuracyMicros, upperMicros: gen.micros + accuracyMicros,
    policy, serial, nonce: nonce === null ? null : nonce.toString(),
    signerSha256: createHash("sha256").update(signerCert.raw).digest("hex"),
    tokenSha256: createHash("sha256").update(tokenDer).digest("hex"),
  };
}

function essBinds(attrs: Map<string, DerNode>, cert: X509Certificate): boolean {
  const v2 = attrs.get(OID.signingCertificateV2);
  const v1 = attrs.get(OID.signingCertificate);
  const node = v2 ?? v1;
  if (!node) return false;
  const first = kids(kids(node, 0x30)[0], 0x30)[0]; // certs SEQUENCE OF ESSCertID(v2) → first
  const parts = kids(first, 0x30);
  let alg = v2 ? "sha256" : "sha1", hashNode = parts[0];
  if (v2 && parts[0].tag === 0x30) { alg = HASH_BY_OID[oid(kids(parts[0])[0])] ?? ""; hashNode = parts[1]; }
  if (!alg) return false;
  return Buffer.from(hashNode.value).equals(createHash(alg).update(cert.raw).digest());
}

function assertValidAt(cert: X509Certificate, ms: number) {
  if (ms < Date.parse(cert.validFrom) || ms > Date.parse(cert.validTo)) throw new Error("tsa_cert_not_valid_at_gentime");
}

function chainToAnchor(leaf: X509Certificate, pool: X509Certificate[], anchors: X509Certificate[], atMs: number) {
  if (anchors.length === 0) throw new Error("tsa_no_anchor");
  let current = leaf;
  for (let depth = 0; depth < 6; depth++) {
    const anchor = anchors.find((a) => a.raw.equals(current.raw) || (current.checkIssued(a) && current.verify(a.publicKey)));
    if (anchor) { assertValidAt(anchor, atMs); return; }
    const issuer = pool.find((c) => !c.raw.equals(current.raw) && current.checkIssued(c) && current.verify(c.publicKey));
    if (!issuer || !issuer.ca) throw new Error("tsa_chain_unanchored");
    assertValidAt(issuer, atMs);
    current = issuer;
  }
  throw new Error("tsa_chain_too_deep");
}
