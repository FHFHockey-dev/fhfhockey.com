#!/usr/bin/env node
// Operator-only (with TJ's approval). Generates the independent witness's Ed25519 key pair and hands the PRIVATE key to
// the Edge Function's secrets over stdin (`supabase secrets set --env-file /dev/stdin`): it is never printed, written to
// disk, put in argv, Vercel, the database or Vault. Prints only the key id and public key, and pins the public key in
// web/lib/projections/pregameCapture/witnessSigningKeys.ts for a reviewed commit (then rebuild the bundle and deploy).
//   node tasks/artifacts/forge-witness-signed-2026-11-19/witness_signing_keygen.mjs --project-ref fyhftlxokyjtpndbkfse [--supabase supabase]
//   ... --dry-run    # generates a throwaway pair, sends the secret line to a sink, pins nothing
import { createHash, generateKeyPairSync } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const arg = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const dryRun = process.argv.includes("--dry-run");
const ref = arg("--project-ref"), cli = arg("--supabase") ?? "supabase";
if (!dryRun && !/^[a-z]{20}$/.test(ref ?? "")) throw new Error("--project-ref <20-letter ref> is required");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const keysFile = join(root, "web/lib/projections/pregameCapture/witnessSigningKeys.ts");

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const x = publicKey.export({ format: "jwk" }).x;
const keyId = createHash("sha256").update(Buffer.from(x, "base64url")).digest("hex").slice(0, 16);
const der = privateKey.export({ format: "der", type: "pkcs8" });
const line = Buffer.from(`FORGE_WITNESS_SIGNING_KEY=${der.toString("base64")}\n`);
der.fill(0);
const done = dryRun
  ? spawnSync("cat", [], { input: line, stdio: ["pipe", "ignore", "pipe"] })
  : spawnSync(cli, ["secrets", "set", "--project-ref", ref, "--env-file", "/dev/stdin"], { input: line, stdio: ["pipe", "ignore", "pipe"] });
line.fill(0);
if (done.status !== 0) throw new Error(`secret not set (exit ${done.status}): ${String(done.stderr).slice(-400)}`);
if (!dryRun) {
  const text = readFileSync(keysFile, "utf8");
  const entries = [...text.matchAll(/"([0-9a-f]{16})": "([A-Za-z0-9_-]{43})"/g)].map(m => [m[1], m[2]]);
  entries.push([keyId, x]);
  const map = `{\n${entries.map(([k, v]) => `  "${k}": "${v}",`).join("\n")}\n}`;
  writeFileSync(keysFile, text.replace(/export const WITNESS_SIGNING_KEYS: Record<string, string> = \{[\s\S]*?\};/,
    `export const WITNESS_SIGNING_KEYS: Record<string, string> = ${map};`));
}
console.log(JSON.stringify({ dryRun, secret: "FORGE_WITNESS_SIGNING_KEY", keyId, publicKey: x,
  next: dryRun ? "nothing pinned" : "commit witnessSigningKeys.ts, rebuild the edge bundle, deploy the function and the release" }));
