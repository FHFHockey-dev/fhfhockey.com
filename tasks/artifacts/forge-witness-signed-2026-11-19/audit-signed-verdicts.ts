// Offline acceptance audit of signed FORGE witness verdicts (read-only; no database or network access). Input: the JSON
// written by export-signed-verdicts.sql. A game passes only if its verdict's Ed25519 signature verifies under a key
// pinned in web/lib/projections/pregameCapture/witnessSigningKeys.ts, the verdict is "accepted", it was decided at or
// before its deadline (official start − 60), and the signed hashes equal the custody hashes as stored now, with the raw
// hash recomputed from the stored packet. From web/:
//   node -r ts-node/register/transpile-only ../tasks/artifacts/forge-witness-signed-2026-11-19/audit-signed-verdicts.ts signed-verdicts.json
// Exit 0: every game passes. 2: at least one fails. 1: unreadable input.
import { readFileSync } from "node:fs";
import { checkSignedVerdict } from "lib/projections/pregameCapture/signedVerdict";
import { WITNESS_SIGNING_KEYS } from "lib/projections/pregameCapture/witnessSigningKeys";

export interface ExportedVerdict {
  gameId: number; claimId: string | null;
  custody: { rawSha256: string | null; packetSha256: string | null; canonicalSha256: string | null; tsaTokenSha256: string | null } | null;
  signed: { payload: string; signature: string } | null;
}

export function auditSignedVerdicts(records: ExportedVerdict[], keys: Readonly<Record<string, string>> = WITNESS_SIGNING_KEYS) {
  return records.map(r => {
    const c = r.custody;
    if (!r.claimId || !c || !c.rawSha256 || !c.canonicalSha256 || !c.tsaTokenSha256) {
      return { gameId: r.gameId, claimId: r.claimId, pass: false, reason: "custody_missing" };
    }
    if (c.packetSha256 !== c.rawSha256) return { gameId: r.gameId, claimId: r.claimId, pass: false, reason: "packet_bytes_changed" };
    const check = checkSignedVerdict(r.signed, { claimId: r.claimId, gameId: r.gameId, rawSha256: c.rawSha256,
      canonicalSha256: c.canonicalSha256, tsaTokenSha256: c.tsaTokenSha256 }, keys);
    return { gameId: r.gameId, claimId: r.claimId, pass: check.accepted, reason: check.reason,
      keyId: check.payload?.keyId ?? null, verifiedAt: check.payload?.verifiedAt ?? null, deadline: check.payload?.deadline ?? null,
      release: check.payload?.release ?? null };
  });
}

if (require.main === module) {
  try {
    const records = JSON.parse(readFileSync(process.argv[2], "utf8")) as ExportedVerdict[];
    if (!Array.isArray(records)) throw new Error("input");
    const results = auditSignedVerdicts(records);
    process.stdout.write(JSON.stringify({ pinnedKeys: Object.keys(WITNESS_SIGNING_KEYS), results }, null, 1) + "\n");
    process.exitCode = results.length && results.every(r => r.pass) ? 0 : 2;
  } catch {
    process.stderr.write("audit input unreadable\n");
    process.exitCode = 1;
  }
}
