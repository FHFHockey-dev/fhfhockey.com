#!/usr/bin/env node
// Local check of a BLSH approval PUBLIC key before it is staged on Vercel.
// Mirrors the acceptance rule in both handlers (web/lib/blsh/nativeCaptureV6/requestContextHandler.ts
// approvalPublicKey and officialPilotHandler.ts readGrant):
//   raw value length <= 512; trimmed value matches the one-block SPKI PEM pattern;
//   crypto.createPublicKey(raw) succeeds; type "public"; asymmetricKeyType "ed25519".
// Fingerprint = "sha256:" + lowercase hex SHA-256 of the key's SPKI DER encoding (44 bytes for Ed25519).
// Equivalent: openssl pkey -pubin -in key.pem -outform DER | shasum -a 256
//
// Usage:
//   node verify-approval-public-key.mjs --name <ENV_NAME> --file <public.pem> [--expect sha256:<hex>]
//   node verify-approval-public-key.mjs --name <ENV_NAME> --stdin [--expect sha256:<hex>]   (paste, then Ctrl-D)
//   node verify-approval-public-key.mjs --selftest   (throwaway keys only)
// Exit codes: 0 accepted; 1 rejected; 2 usage; 3 private key material refused (never echoed).
// It never prints the input. Public keys are not secret, but a pasted private key would be.
import { createHash, createPublicKey, generateKeyPairSync, sign, verify } from "node:crypto";
import { readFileSync } from "node:fs";

export const APPROVAL_KEY_NAMES = {
  BLSH_REQUEST_CONTEXT_APPROVAL_PUBLIC_KEY: "fhfh.blsh.request-context-approval.v1",
  BLSH_OFFICIAL_PILOT_APPROVAL_PUBLIC_KEY: "fhfh.blsh.official-pilot-approval.v1",
};
const PEM_PATTERN = /^-----BEGIN PUBLIC KEY-----\r?\n[A-Za-z0-9+/=\r\n]+\r?\n-----END PUBLIC KEY-----$/;

/** Returns { ok, fingerprint?, problems[], hints[] }. Never includes the input text. */
export function checkApprovalPublicKey(raw) {
  const problems = [], hints = [];
  if (typeof raw !== "string" || raw.length === 0) return { ok: false, problems: ["empty"], hints };
  if (/PRIVATE KEY/.test(raw)) return { ok: false, privateMaterial: true, problems: ["private_key_material_refused"], hints };
  if (raw.length > 512) problems.push(`raw_length_${raw.length}_exceeds_512`);
  const trimmed = raw.trim();
  if (!PEM_PATTERN.test(trimmed)) {
    problems.push("pem_pattern_mismatch");
    if (/\\n/.test(raw)) hints.push("contains a literal backslash-n; paste real line breaks into Vercel");
    if (/^["'`]/.test(trimmed) || /["'`]$/.test(trimmed)) hints.push("surrounding quotes; paste the PEM without quotes");
    if (/^-----BEGIN PUBLIC KEY-----[^\r\n]/.test(trimmed)) hints.push("no line break after the BEGIN header");
    if (/[^\r\n]-----END PUBLIC KEY-----$/.test(trimmed)) hints.push("no line break before the END footer");
    if (/BEGIN (RSA |EC )?PUBLIC KEY/.test(trimmed) && !/BEGIN PUBLIC KEY/.test(trimmed)) hints.push("not an SPKI 'PUBLIC KEY' block");
    if (/BEGIN CERTIFICATE|BEGIN SSH|^ssh-ed25519 /.test(trimmed)) hints.push("certificate or OpenSSH format; export SPKI PEM");
    if ((trimmed.match(/-----BEGIN /g) ?? []).length > 1) hints.push("more than one PEM block");
  }
  let key;
  try { key = createPublicKey(raw); } catch { problems.push("node_createPublicKey_failed"); }
  if (key) {
    if (key.type !== "public") problems.push(`key_type_${key.type}`);
    if (key.asymmetricKeyType !== "ed25519") problems.push(`algorithm_${key.asymmetricKeyType}_not_ed25519`);
  }
  if (problems.length) return { ok: false, problems, hints };
  const der = key.export({ type: "spki", format: "der" });
  const canonical = key.export({ type: "spki", format: "pem" }).toString().trim() === trimmed.replace(/\r\n/g, "\n");
  if (!canonical) hints.push("accepted, but not byte-identical to Node's canonical SPKI PEM export");
  return { ok: true, fingerprint: "sha256:" + createHash("sha256").update(der).digest("hex"), derBytes: der.length, canonical, problems, hints };
}

// Byte layouts copied from the handlers; selftest proves a matching key verifies them.
const requestContextApprovalBytes = (a) => new TextEncoder().encode(JSON.stringify(["fhfh.blsh.request-context-approval.v1",
  a.sourceDate, a.nativeRunId, a.nativeManifestSHA256, a.deploymentId, a.gitCommitSha]));
const officialPilotApprovalBytes = (a) => new TextEncoder().encode(JSON.stringify(["fhfh.blsh.official-pilot-approval.v1",
  a.sourceDate, a.nativeRunId, a.nativeManifestSHA256, a.scheduleSHA256, a.deploymentId, a.gitCommitSha, a.gameIds]));
export const approvalBytes = { requestContextApprovalBytes, officialPilotApprovalBytes };

function selftest() {
  const out = [];
  const expect = (label, cond) => { out.push(`${cond ? "PASS" : "FAIL"} ${label}`); if (!cond) process.exitCode = 1; };
  const pem = (k) => k.export({ type: "spki", format: "pem" }).toString();
  const ed = generateKeyPairSync("ed25519");
  const good = checkApprovalPublicKey(pem(ed.publicKey));
  expect("throwaway Ed25519 SPKI PEM accepted", good.ok && good.derBytes === 44 && good.canonical);
  expect("fingerprint is sha256 of SPKI DER", good.fingerprint === "sha256:" + createHash("sha256").update(ed.publicKey.export({ type: "spki", format: "der" })).digest("hex"));
  expect("trailing newline and CRLF accepted", checkApprovalPublicKey(pem(ed.publicKey) + "\n").ok && checkApprovalPublicKey(pem(ed.publicKey).replace(/\n/g, "\r\n")).ok);
  const approval = { sourceDate: "2026-11-20", nativeRunId: "11111111-1111-4111-8111-111111111111", nativeManifestSHA256: "a".repeat(64),
    scheduleSHA256: "b".repeat(64), deploymentId: "dpl_fixture", gitCommitSha: "c".repeat(40), gameIds: [2026020001, 2026020002] };
  for (const [name, bytes] of [["request-context", requestContextApprovalBytes(approval)], ["official", officialPilotApprovalBytes(approval)]]) {
    const sig = sign(null, bytes, ed.privateKey);
    expect(`${name} grant verifies with the matching public key`, sig.length === 64 && verify(null, bytes, createPublicKey(pem(ed.publicKey)), sig));
    expect(`${name} grant fails with a different key`, !verify(null, bytes, generateKeyPairSync("ed25519").publicKey, sig));
  }
  const rejected = (label, value, problem) => { const r = checkApprovalPublicKey(value); expect(`${label} rejected (${problem})`, !r.ok && r.problems.some((p) => p.includes(problem))); return r; };
  rejected("RSA-2048 SPKI", pem(generateKeyPairSync("rsa", { modulusLength: 2048 }).publicKey), "not_ed25519");
  rejected("RSA-4096 SPKI", pem(generateKeyPairSync("rsa", { modulusLength: 4096 }).publicKey), "exceeds_512");
  rejected("ECDSA P-256 SPKI", pem(generateKeyPairSync("ec", { namedCurve: "P-256" }).publicKey), "not_ed25519");
  rejected("X25519 SPKI", pem(generateKeyPairSync("x25519").publicKey), "not_ed25519");
  rejected("Ed448 SPKI", pem(generateKeyPairSync("ed448").publicKey), "not_ed25519");
  const priv = checkApprovalPublicKey(ed.privateKey.export({ type: "pkcs8", format: "pem" }).toString());
  expect("private PKCS#8 key refused without echo", !priv.ok && priv.privateMaterial === true && !JSON.stringify(priv).includes("MC4C"));
  const literal = rejected("literal \\n paste", pem(ed.publicKey).trim().replace(/\n/g, "\\n"), "pem_pattern_mismatch");
  expect("literal \\n hint", literal.hints.some((h) => h.includes("backslash-n")));
  const quoted = rejected("quoted paste", `"${pem(ed.publicKey).trim()}"`, "pem_pattern_mismatch");
  expect("quote hint", quoted.hints.some((h) => h.includes("quotes")));
  rejected("header joined to body", pem(ed.publicKey).replace("-----\n", "-----"), "pem_pattern_mismatch");
  rejected("two concatenated keys", pem(ed.publicKey) + pem(generateKeyPairSync("ed25519").publicKey), "pem_pattern_mismatch");
  rejected("OpenSSH format", ed.publicKey.export({ type: "spki", format: "der" }).toString("base64"), "pem_pattern_mismatch");
  rejected("empty", "", "empty");
  console.log(out.join("\n"));
  console.log(process.exitCode ? "SELFTEST FAILED" : `SELFTEST PASS (${out.length} checks, throwaway keys only, none written to disk)`);
}

function main(argv) {
  const arg = (flag) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : undefined; };
  if (argv.includes("--selftest")) return selftest();
  const name = arg("--name"), file = arg("--file"), expected = arg("--expect");
  if (!name || !(name in APPROVAL_KEY_NAMES) || (!file && !argv.includes("--stdin")) || (expected && !/^sha256:[0-9a-f]{64}$/.test(expected))) {
    console.error("usage: --name BLSH_REQUEST_CONTEXT_APPROVAL_PUBLIC_KEY|BLSH_OFFICIAL_PILOT_APPROVAL_PUBLIC_KEY (--file public.pem | --stdin) [--expect sha256:<64 hex>]");
    process.exitCode = 2; return;
  }
  const raw = file ? readFileSync(file, "utf8") : readFileSync(0, "utf8");
  const result = checkApprovalPublicKey(raw);
  if (result.privateMaterial) { console.error("REFUSED: input contains private key material. Nothing was printed. Destroy this paste and re-export the PUBLIC key only."); process.exitCode = 3; return; }
  console.log(`${name} (signs namespace ${APPROVAL_KEY_NAMES[name]})`);
  if (!result.ok) { console.log(`REJECTED: ${result.problems.join(", ")}`); for (const h of result.hints) console.log(`hint: ${h}`); process.exitCode = 1; return; }
  console.log(`ACCEPTED by the handler rule: Ed25519 SPKI PEM, ${result.derBytes}-byte DER, canonical=${result.canonical}`);
  console.log(`fingerprint ${result.fingerprint}`);
  for (const h of result.hints) console.log(`hint: ${h}`);
  if (expected) {
    const match = expected === result.fingerprint;
    console.log(match ? "MATCHES the custody-recorded fingerprint" : `MISMATCH: custody record says ${expected}`);
    if (!match) process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2));
