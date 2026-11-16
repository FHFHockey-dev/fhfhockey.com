import { createHash, X509Certificate } from "node:crypto";
import { generalizedTimeMicros, integer, kids, oid, parseDerExact, u8, type DerNode } from "./der";
import { formatMicros } from "./time";

/**
 * Non-throwing structural report of an RFC 3161 TimeStampResp or token, for the live probe: every property the strict
 * verifier gates on, reported separately so a failing probe still says exactly which rule a real TSA token trips.
 * It decides nothing; verifyTimeStampToken is the only acceptance path.
 */
export interface TokenInspection {
  status: number | null;
  signedDataVersion: number | null;
  digestAlgorithms: string[];
  tstInfo: {
    policy: string | null; imprintAlgorithm: string | null; genTime: string | null; genTimeUtc: string | null;
    accuracy: { present: boolean; seconds: number | null; millis: number | null; micros: number | null; totalMicros: number | null };
    noncePresent: boolean; orderingPresent: boolean; tsaNamePresent: boolean; extensionsPresent: boolean;
  };
  certificates: Array<{ subject: string; issuer: string; serial: string; sha256: string; validFrom: string; validTo: string;
    ca: boolean; ekuCritical: boolean | null; eku: string[] }>;
  signer: {
    version: number | null; sidType: "issuerAndSerial" | "subjectKeyIdentifier" | "other" | null; digestAlgorithm: string | null;
    signatureAlgorithm: string | null; signedAttributes: string[]; essVersion: "v1" | "v2" | null;
    unsignedAttributesPresent: boolean; trailingElements: number;
  };
  errors: string[];
}

const ESS_V1 = "1.2.840.113549.1.9.16.2.12";
const ESS_V2 = "1.2.840.113549.1.9.16.2.47";

export function inspectTimeStampResponse(der: Buffer): TokenInspection {
  const report: TokenInspection = {
    status: null, signedDataVersion: null, digestAlgorithms: [],
    tstInfo: { policy: null, imprintAlgorithm: null, genTime: null, genTimeUtc: null,
      accuracy: { present: false, seconds: null, millis: null, micros: null, totalMicros: null },
      noncePresent: false, orderingPresent: false, tsaNamePresent: false, extensionsPresent: false },
    certificates: [],
    signer: { version: null, sidType: null, digestAlgorithm: null, signatureAlgorithm: null, signedAttributes: [], essVersion: null,
      unsignedAttributesPresent: false, trailingElements: 0 },
    errors: [],
  };
  const attempt = (label: string, fn: () => void) => {
    try { fn(); } catch (error) { report.errors.push(`${label}:${error instanceof Error ? error.message : String(error)}`); }
  };
  let token: DerNode | null = null;
  attempt("envelope", () => {
    const root = parseDerExact(der);
    const parts = kids(root, 0x30);
    if (parts[0]?.tag === 0x30 && parts[0].children?.[0]?.tag === 0x02) {
      report.status = Number(integer(parts[0].children[0]));
      token = parts[1] ?? null;
    } else token = root;
  });
  if (!token) return report;
  let signedData: DerNode[] = [];
  attempt("signedData", () => {
    const contentInfo = kids(token!, 0x30);
    signedData = kids(kids(contentInfo[1], 0xa0)[0], 0x30);
    report.signedDataVersion = Number(integer(signedData[0]));
    report.digestAlgorithms = kids(signedData[1], 0x31).map((alg) => oid(kids(alg, 0x30)[0]));
  });
  let i = 2;
  attempt("tstInfo", () => {
    const encap = kids(signedData[i++], 0x30);
    const tst = kids(parseDerExact(Buffer.from(u8(kids(encap[1], 0xa0)[0].value))), 0x30);
    report.tstInfo.policy = oid(tst[1]);
    report.tstInfo.imprintAlgorithm = oid(kids(kids(tst[2], 0x30)[0], 0x30)[0]);
    const gen = generalizedTimeMicros(tst[4]);
    report.tstInfo.genTime = gen.text;
    report.tstInfo.genTimeUtc = formatMicros(gen.micros);
    for (const node of tst.slice(5)) {
      if (node.tag === 0x30) {
        report.tstInfo.accuracy.present = true;
        let total = 0;
        for (const part of kids(node)) {
          const value = Number(integer(part));
          if (part.tag === 0x02) { report.tstInfo.accuracy.seconds = value; total += value * 1_000_000; }
          else if (part.tag === 0x80) { report.tstInfo.accuracy.millis = value; total += value * 1_000; }
          else if (part.tag === 0x81) { report.tstInfo.accuracy.micros = value; total += value; }
        }
        report.tstInfo.accuracy.totalMicros = total;
      } else if (node.tag === 0x01) report.tstInfo.orderingPresent = true;
      else if (node.tag === 0x02) report.tstInfo.noncePresent = true;
      else if (node.tag === 0xa0) report.tstInfo.tsaNamePresent = true;
      else if (node.tag === 0xa1) report.tstInfo.extensionsPresent = true;
    }
  });
  attempt("certificates", () => {
    if (signedData[i]?.tag !== 0xa0) return;
    for (const node of kids(signedData[i++])) {
      const cert = new X509Certificate(u8(node.bytes));
      report.certificates.push({
        subject: cert.subject.replace(/\n/g, ", "), issuer: cert.issuer.replace(/\n/g, ", "), serial: cert.serialNumber,
        sha256: createHash("sha256").update(u8(cert.raw)).digest("hex"), validFrom: cert.validFrom, validTo: cert.validTo,
        ca: cert.ca, ekuCritical: ekuCritical(cert), eku: cert.keyUsage ?? [],
      });
    }
  });
  if (signedData[i]?.tag === 0xa1) i++;
  attempt("signer", () => {
    const signer = kids(kids(signedData[i], 0x31)[0], 0x30);
    report.signer.version = Number(integer(signer[0]));
    report.signer.sidType = signer[1].tag === 0x30 ? "issuerAndSerial" : signer[1].tag === 0x80 ? "subjectKeyIdentifier" : "other";
    report.signer.digestAlgorithm = oid(kids(signer[2], 0x30)[0]);
    let s = 3;
    if (signer[s]?.tag === 0xa0) {
      for (const attr of kids(signer[s++])) {
        const type = oid(kids(attr, 0x30)[0]);
        report.signer.signedAttributes.push(type);
        if (type === ESS_V2) report.signer.essVersion = "v2";
        else if (type === ESS_V1 && !report.signer.essVersion) report.signer.essVersion = "v1";
      }
    }
    report.signer.signatureAlgorithm = oid(kids(signer[s++], 0x30)[0]);
    s++; // signature
    report.signer.unsignedAttributesPresent = signer[s]?.tag === 0xa1;
    report.signer.trailingElements = Math.max(0, signer.length - s);
  });
  return report;
}

function ekuCritical(cert: X509Certificate): boolean | null {
  try {
    const tbs = kids(kids(parseDerExact(Buffer.from(u8(cert.raw))), 0x30)[0], 0x30);
    const extWrapper = tbs.find((node) => node.tag === 0xa3);
    if (!extWrapper) return null;
    for (const ext of kids(kids(extWrapper)[0], 0x30)) {
      const parts = kids(ext, 0x30);
      if (oid(parts[0]) === "2.5.29.37") return parts.length === 3 && parts[1].tag === 0x01 && parts[1].value[0] === 0xff;
    }
    return null;
  } catch { return null; }
}
