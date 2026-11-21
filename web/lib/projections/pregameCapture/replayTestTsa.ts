/**
 * Hosted FORGE replay only (pages/api/v1/db/forge-replay-run.ts): an in-process RFC 3161 test timestamp authority.
 * It is the test fixture's TSA (__fixtures__/testTsa.ts, CN "FHFH Test tsa" under "FHFH Test ca Root", policy
 * 1.3.6.1.4.1.99999.1) with the same certificate and key bytes embedded, because a deployed function cannot read
 * fixture files. Its key is already public in this repository and signs nothing real: no released TSA profile, pin or
 * verifier trusts this root, and the replay passes its trust explicitly to capture, the witness and the publisher.
 */
import { createHash, sign } from "node:crypto";
import { concatBytes, encodeOid, encodeUnsigned, kids, parseDerExact, readDer, seq, tlv, u8 } from "./der";
import type { TsaTrust } from "./rfc3161";
import { formatMicros, MICROS_PER_MS } from "./time";
import type { TsaClient } from "./verifier";

const REPLAY_TEST_TSA_POLICY = "1.3.6.1.4.1.99999.1";
const CA_PEM = `-----BEGIN CERTIFICATE-----
MIIC+DCCAeCgAwIBAgICEAAwDQYJKoZIhvcNAQELBQAwHDEaMBgGA1UEAwwRRkhG
SCBUZXN0IGNhIFJvb3QwIBcNMjAwMTAxMDAwMDAwWhgPMjEwMDAxMDEwMDAwMDBa
MBwxGjAYBgNVBAMMEUZIRkggVGVzdCBjYSBSb290MIIBIjANBgkqhkiG9w0BAQEF
AAOCAQ8AMIIBCgKCAQEAuEjOaiUPMaYn7k0SMKmCNYAkZb99h7VVyf806Br4nsLV
mnrmzrR1TxBvMiujqaqGKOCQmlx7Ncs3MGf3YWq7qdhwkpc2iuX/HmITcK0uz/fa
0SMhYVUNzgXCTPiJLzFLOTSEgJpXJ0TqbzRJBVOtJ6/TMidFsHhMYZnXYAuYETsq
08vnOyQqHpmMAhtOdx39o9vU0TbRWnbGG9BM7BEkwm6GFiH/+GWCfWOQmXF0VvGs
yYBj2QgSnsqcIp/1NqrPC52PRTMVVfFsK+AVwrefJ0H3UtrgmmY1AlX930cIynh+
OXdC0pi2VWJzzR+K2lUk3Xz9xp37pr/BB6l2F5lT4wIDAQABo0IwQDAPBgNVHRMB
Af8EBTADAQH/MA4GA1UdDwEB/wQEAwICBDAdBgNVHQ4EFgQUUeQs0A0ilRwML6Zp
ajVLzXBTKkowDQYJKoZIhvcNAQELBQADggEBAIDQc9t7arnVQ75lYxEy/GXYSleF
cxs4P40VYQFer3gATnO/WxTS+X6gJkmgWylJk1ByPm45pnHpiR0YZxoN+oo+RyKb
HdVOccUZHv1aCSfnERTaZvNIzuH2haHMvpAVL+QpN0z/otx2ZftlRGPzCI0tUubX
Undxie0K3Q+Xl6GEo9K25LLcjYl8b6d0GHiKEyylmZtCdnPnS0MXuxjlgw8I32mG
5umex56g7HeggVvQ0FgjXfGYfJR7IyHOZKMVq9mjxofxCIUuyrpj7N65kgUI9UdJ
CuZn4lGNeSQFqR43jo71PWm22JUWkuw8XGQMlJP+JdLgeNx3qfPfStYbU58=
-----END CERTIFICATE-----`;
const TSA_CERT_PEM = `-----BEGIN CERTIFICATE-----
MIIDKjCCAhKgAwIBAgICEAMwDQYJKoZIhvcNAQELBQAwHDEaMBgGA1UEAwwRRkhG
SCBUZXN0IGNhIFJvb3QwIBcNMjAwMTAxMDAwMDAwWhgPMjEwMDAxMDEwMDAwMDBa
MBgxFjAUBgNVBAMMDUZIRkggVGVzdCB0c2EwggEiMA0GCSqGSIb3DQEBAQUAA4IB
DwAwggEKAoIBAQChAZCvhmm9EAMEq4vSQlKOrNQiJVwc9nTt1k9SYqrlDE2Nyxq8
yxicWTNevfr8vto94pudXSlJ1ntqCCqVJkvVDqRNVDMKFv7wzFZ9WKmK70W8aIne
yY48tuZ5tHKKdAinM7f+6m9rRDj610s3CU6xCH0dseJ/0ogDzy1j+nUUU8alspK6
vk1QUvUC27Qt/kBbw5yVrXdQ5Fqr5CfEltp66RkDEmg6kFWgmIP6gP6rHc963kB4
Hwdx8zUDfpDorRwIWJM/G5TwRHk4z9v//gMEH8rGaAiEVL7q+FaF84GEf+invyId
DKivB8VH7xgdnwoxd9s2JSoE1ERDmvFQy3AHAgMBAAGjeDB2MAwGA1UdEwEB/wQC
MAAwDgYDVR0PAQH/BAQDAgeAMBYGA1UdJQEB/wQMMAoGCCsGAQUFBwMIMB0GA1Ud
DgQWBBTtWyOg/GDbVxahRBSM3KM3hXwZADAfBgNVHSMEGDAWgBRR5CzQDSKVHAwv
pmlqNUvNcFMqSjANBgkqhkiG9w0BAQsFAAOCAQEAPuQ72FbQH5y6WxR8RVAhP1Mw
7+GdOxWfpFvikK6kNkCaPhpCtkRdnGM9FeajZH7PzrwHg9Eoq1QuyaoRaFbLl5wq
PAp02cMqkASSI356qkUjHRXc8XggPGzcMQ+r32TUqjML04CFRAdIKlzEUE3Dcgdd
iWjnnI+I37bdzF5j7AkvD6u9J97pXn+rmZdxkmXr2Jk6r28xUxlQHohMC6sHZ20O
uOR9XvxHiqCt+jX48UAoGiMO2Q6niQKVv54NqcTzo4qdhkOUhecD6BSpOqziHl8s
LJQkbXOVpXvlAjJ9gC/evsPYWTaAPhiYHvvO6sntVL7wmYZjqYdid242d0QGLw==
-----END CERTIFICATE-----`;
const TSA_KEY_PEM = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQChAZCvhmm9EAME
q4vSQlKOrNQiJVwc9nTt1k9SYqrlDE2Nyxq8yxicWTNevfr8vto94pudXSlJ1ntq
CCqVJkvVDqRNVDMKFv7wzFZ9WKmK70W8aIneyY48tuZ5tHKKdAinM7f+6m9rRDj6
10s3CU6xCH0dseJ/0ogDzy1j+nUUU8alspK6vk1QUvUC27Qt/kBbw5yVrXdQ5Fqr
5CfEltp66RkDEmg6kFWgmIP6gP6rHc963kB4Hwdx8zUDfpDorRwIWJM/G5TwRHk4
z9v//gMEH8rGaAiEVL7q+FaF84GEf+invyIdDKivB8VH7xgdnwoxd9s2JSoE1ERD
mvFQy3AHAgMBAAECggEARiRPaxhsolACcJtne38nRj7m38VU3s1D3YV64xJXDxgQ
BVDRYiQ8oYh+x6yOVmOy4jkBwEmgvikxdNz/6CBZ8wTA8WtYHPItuKvclhj1K7DX
uZ/1SFiYnby0pZrGN6kbR/RRGT36sklzZVw7yUtFu/xNvY0MdtE6LiaoyKCJNwQj
YwLvoK4YV4rUWQJVgFApJhe085UYTCFC14vC9Z/a5+yHbttEXQTyWngnG+lCGDzY
3m27WIsQSH0XD8ASHGrS1VxDdhlYEqkXXfldYYu837lE7Zo12pI1JmlZXCgRlhME
5k8Cpu1JSClKRIzjdzDH1yOxrlHm13Kv4g/svXxryQKBgQDNnPJRNk2MSPKp9ncu
QUBBoff7m12ndKpYCK8EHPB4f9jeU7kbTJKWi0peRpGbb6rUlIwErv4bMsYHsCXx
ScesOfmKgoc7D6NNe1Msf1G4mH3G8G8HN9SHOFc1+LVuGjsR4VIV+6ntA4DJ8nZc
9yw3TyowsctTr/U8SMg87fqZswKBgQDIdjgRfycajX6CzZFgpUYgvfdSXd2Liwx2
EFmsQTON2vf9ZWWFDoui8607Guk6RzauFPxrBKu+DAB3MTpRe6ZdYOZCF23NjZcV
WbhfLGDzfvRGpU0/120F4kEnGgUvr1c4aEwhzYOxFe0x7D2LK5M6ZJk1rz2y/eRt
DSk9wbb+XQKBgQDMIqgJrSosvzf9Om91At9yygXUTZob6R4+LNDl+n1chUGg6ep7
ifh3cm8xTkq90Y3/ZEPnWn16L1ygwWfKOP/+o8h2lcUBBDOTd39KTFWsOemWG5t/
xRRB89PSB8zJNU20IMpIfQVmBPZWiVyuS9AgUX6Hvd0qhyWo5nG23GbTNQKBgGtw
WQqfoKCtl1GZxcILsrNXvVeK8XOZ2drpVnZpF61+340TLD8NFbAHdCAKg1f11Qum
OcdN4JJiMlmvq7cCU58WkTJ5BiO2MHSD+rofufKnZ1r5u5Zs6oTNx+eiHYd6LYAQ
/kTbtipSOyeXm0Cc4TLZufe47ZOiWixMcn8j9OUNAoGANKD54tHgnq8GDhhWhtST
yUttvkSgAHLQdTqpXQrdDKjQgh3vPQgr0U9kazNhZY/4yiQnzLHWfkd4aCHqmZ6X
cSzbRwt68RE8zNgbmNCH9OeuMUCquddsJ+j4XWk6gyH9PZBEyI1z6V75w6hfmvm5
0nfEfY3/3fgkrfnJFB5Y/qo=
-----END PRIVATE KEY-----`;

export const replayTestTsaTrust = (): TsaTrust => ({ anchorsPem: [CA_PEM], policies: [REPLAY_TEST_TSA_POLICY] });

const NULL = Buffer.from([0x05, 0x00]);
const sha256Alg = () => seq(encodeOid("2.16.840.1.101.3.4.2.1"), NULL);
const set = (...items: Buffer[]) => tlv(0x31, concatBytes([...items].map(u8).sort((a, b) => Buffer.compare(a, b))));
const octets = (data: Buffer) => tlv(0x04, data);
const pemToDer = (pem: string) => Buffer.from(pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, ""), "base64");

function generalizedTime(micros: bigint): Buffer {
  const text = formatMicros(micros);
  const digits = text.slice(0, 19).replace(/[-T:]/g, "");
  const fraction = text.slice(20, 26).replace(/0+$/, "");
  return tlv(0x18, Buffer.from(`${digits}${fraction ? `.${fraction}` : ""}Z`, "latin1"));
}

/** The fixture's mintTimeStampResponse for the "tsa" signer with Accuracy 500 ms (same DER, same ESS attributes). */
export function mintReplayTimestamp(request: Buffer, genTimeMicros: bigint, serial: bigint): Buffer {
  const parts = kids(parseDerExact(request), 0x30);
  const digest = Buffer.from(u8(kids(parts[1], 0x30)[1].value));
  const nonceNode = parts.slice(2).find((node) => node.tag === 0x02);
  let nonce: bigint | null = null;
  if (nonceNode) { nonce = BigInt(0); for (const byte of nonceNode.value) nonce = (nonce << BigInt(8)) | BigInt(byte); }
  const certDer = pemToDer(TSA_CERT_PEM);
  const tstInfo = seq(
    encodeUnsigned(BigInt(1)), encodeOid(REPLAY_TEST_TSA_POLICY), seq(sha256Alg(), octets(digest)), encodeUnsigned(serial),
    generalizedTime(genTimeMicros), seq(tlv(0x80, encodeUnsigned(BigInt(500)).subarray(2))),
    ...(nonce === null ? [] : [encodeUnsigned(nonce)]),
  );
  const attr = (oid: string, value: Buffer) => seq(encodeOid(oid), set(value));
  const signedAttrsSet = set(
    attr("1.2.840.113549.1.9.3", encodeOid("1.2.840.113549.1.9.16.1.4")),
    attr("1.2.840.113549.1.9.4", octets(createHash("sha256").update(u8(tstInfo)).digest())),
    attr("1.2.840.113549.1.9.16.2.47", seq(seq(seq(octets(createHash("sha256").update(u8(certDer)).digest()))))),
  );
  const signature = sign("sha256", u8(signedAttrsSet), TSA_KEY_PEM);
  const tbs = kids(kids(readDer(certDer), 0x30)[0], 0x30);
  const [serialNode, , issuerNode] = tbs[0].tag === 0xa0 ? tbs.slice(1) : tbs;
  const signerInfo = seq(
    encodeUnsigned(BigInt(1)), seq(issuerNode.bytes, serialNode.bytes), sha256Alg(),
    concatBytes([Buffer.from([0xa0]), signedAttrsSet.subarray(1)]),
    seq(encodeOid("1.2.840.113549.1.1.11"), NULL), octets(signature),
  );
  const signedData = seq(
    encodeUnsigned(BigInt(3)), set(sha256Alg()),
    seq(encodeOid("1.2.840.113549.1.9.16.1.4"), tlv(0xa0, octets(tstInfo))),
    tlv(0xa0, certDer), set(signerInfo),
  );
  return seq(seq(encodeUnsigned(BigInt(0))), seq(encodeOid("1.2.840.113549.1.7.2"), tlv(0xa0, signedData)));
}

/** A TsaClient that stamps in process at the host clock, counting calls. */
export function replayTestTsa(now: () => number = Date.now): TsaClient & { calls(): number } {
  let calls = 0;
  return {
    async stamp(request: Buffer, signal: AbortSignal) {
      if (signal.aborted) throw new Error("tsa_aborted");
      calls++;
      return mintReplayTimestamp(request, BigInt(now()) * MICROS_PER_MS, BigInt(calls));
    },
    calls: () => calls,
  };
}
