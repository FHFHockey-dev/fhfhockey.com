/** TEST-ONLY RFC 3161 signer over the fixture CA. Never used outside tests; its key signs nothing real. */
import { createHash, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { concatBytes, encodeOid, encodeUnsigned, kids, parseDerExact, readDer, seq, tlv, u8 } from "../der";
import { formatMicros } from "../time";

const dir = join(__dirname, "tsa");
export const TEST_TSA_POLICY = "1.3.6.1.4.1.99999.1";
export const testTsaTrust = () => ({ anchorsPem: [readFileSync(join(dir, "ca.crt"), "utf8")], policies: [TEST_TSA_POLICY] });

const NULL = Buffer.from([0x05, 0x00]);
const sha256Alg = () => seq(encodeOid("2.16.840.1.101.3.4.2.1"), NULL);
const set = (...items: Buffer[]) => tlv(0x31, concatBytes([...items].map(u8).sort((a, b) => Buffer.compare(a, b))));
const octets = (data: Buffer) => tlv(0x04, data);

function generalizedTime(micros: bigint): Buffer {
  const text = formatMicros(micros); // YYYY-MM-DDTHH:MM:SS.ffffffZ
  const digits = text.slice(0, 19).replace(/[-T:]/g, "");
  const fraction = text.slice(20, 26).replace(/0+$/, "");
  return tlv(0x18, Buffer.from(`${digits}${fraction ? `.${fraction}` : ""}Z`, "latin1"));
}

function pemToDer(pem: string): Buffer {
  return Buffer.from(pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, ""), "base64");
}

/** Parses a TimeStampReq; returns digest and nonce. */
export function parseTimeStampRequest(request: Buffer): { digest: Buffer; nonce: bigint | null } {
  const parts = kids(parseDerExact(request), 0x30);
  const digest = Buffer.from(u8(kids(parts[1], 0x30)[1].value));
  const nonceNode = parts.slice(2).find((node) => node.tag === 0x02);
  let nonce: bigint | null = null;
  if (nonceNode) { nonce = BigInt(0); for (const byte of nonceNode.value) nonce = (nonce << BigInt(8)) | BigInt(byte); }
  return { digest, nonce };
}

export interface TestTsaOptions {
  genTimeMicros: bigint; accuracyMillis?: number | null; serial?: bigint; policy?: string; status?: number;
  /** Adversarial knobs: raw GeneralizedTime text, raw Accuracy DER, a signer without the timestamping EKU, a wrong sid serial. */
  rawGenTime?: string; rawAccuracy?: Buffer; signer?: "tsa" | "plain"; sidSerial?: bigint;
}

/** Mints a TimeStampResp for a TimeStampReq, signed by the fixture TSA key with ESS signingCertificateV2. */
export function mintTimeStampResponse(request: Buffer, options: TestTsaOptions): Buffer {
  if (options.status && options.status !== 0) return seq(seq(encodeUnsigned(BigInt(options.status))));
  const { digest, nonce } = parseTimeStampRequest(request);
  const certDer = pemToDer(readFileSync(join(dir, `${options.signer ?? "tsa"}.crt`), "utf8"));
  const key = readFileSync(join(dir, `${options.signer ?? "tsa"}.key`), "utf8");
  const accuracy = options.rawAccuracy ? [options.rawAccuracy]
    : options.accuracyMillis === null ? [] : [seq(tlv(0x80, encodeUnsigned(BigInt(options.accuracyMillis ?? 500)).subarray(2)))];
  const tstInfo = seq(
    encodeUnsigned(BigInt(1)), encodeOid(options.policy ?? TEST_TSA_POLICY), seq(sha256Alg(), octets(digest)),
    encodeUnsigned(options.serial ?? BigInt(1)),
    options.rawGenTime ? tlv(0x18, Buffer.from(options.rawGenTime, "latin1")) : generalizedTime(options.genTimeMicros), ...accuracy,
    ...(nonce === null ? [] : [encodeUnsigned(nonce)]),
  );
  const attr = (oid: string, value: Buffer) => seq(encodeOid(oid), set(value));
  const signedAttrsSet = set(
    attr("1.2.840.113549.1.9.3", encodeOid("1.2.840.113549.1.9.16.1.4")),
    attr("1.2.840.113549.1.9.4", octets(createHash("sha256").update(u8(tstInfo)).digest())),
    attr("1.2.840.113549.1.9.16.2.47", seq(seq(seq(octets(createHash("sha256").update(u8(certDer)).digest()))))),
  );
  const signature = sign("sha256", u8(signedAttrsSet), key);
  const tbs = kids(kids(readDer(certDer), 0x30)[0], 0x30);
  const [serialNode, , issuerNode] = tbs[0].tag === 0xa0 ? tbs.slice(1) : tbs;
  const signerInfo = seq(
    encodeUnsigned(BigInt(1)), seq(issuerNode.bytes, options.sidSerial === undefined ? serialNode.bytes : encodeUnsigned(options.sidSerial)), sha256Alg(),
    concatBytes([Buffer.from([0xa0]), signedAttrsSet.subarray(1)]),
    seq(encodeOid("1.2.840.113549.1.1.11"), NULL), octets(signature),
  );
  const signedData = seq(
    encodeUnsigned(BigInt(3)), set(sha256Alg()),
    seq(encodeOid("1.2.840.113549.1.9.16.1.4"), tlv(0xa0, octets(tstInfo))),
    tlv(0xa0, certDer), set(signerInfo),
  );
  const token = seq(encodeOid("1.2.840.113549.1.7.2"), tlv(0xa0, signedData));
  return seq(seq(encodeUnsigned(BigInt(0))), token);
}
