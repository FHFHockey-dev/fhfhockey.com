/**
 * Freezes the Full-NHL H1–H10 denominator from Astra's saved 2026-11-23 audit receipts. Local files only: no network,
 * no database. Each input's bytes must match the receipt MANIFEST.sha256. Run it twice; the outputs are byte-identical.
 *
 *   NODE_PATH=. npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' \
 *     scripts/forge-h10-freeze-denominator.ts <receipts-dir> <out-dir>
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { canonicalJson } from "../lib/forge-v2/identity";
import { serializeDenominator } from "../lib/forge-v2/denominator";
import { parseReceiptKeys, receiptDenominator, receiptStoredRows } from "../lib/forge-v2/denominatorReceipts";

const [receipts, out] = process.argv.slice(2);
if (!receipts || !out) throw new Error("usage: forge-h10-freeze-denominator.ts <receipts-dir> <out-dir>");
const manifest = new Map(readFileSync(join(receipts, "MANIFEST.sha256"), "utf8").trim().split("\n").map(line => {
  const [hash, path] = line.split(/\s+/); return [path.replace(/^\.\//, ""), hash] as const;
}));
function read(name: string) {
  const bytes = new Uint8Array(readFileSync(join(receipts, name)));
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (manifest.get(name) !== sha256) throw new Error(`${name} does not match MANIFEST.sha256`);
  return { text: Buffer.from(bytes).toString("utf8"), sha256 };
}
const reconciledFile = read("trade-reconciled-keys.csv"), enumeratedFile = read("player-game-keys.csv"), sqlFile = read("enumeration.sql");
const reconciled = parseReceiptKeys(reconciledFile.text), enumerated = parseReceiptKeys(enumeratedFile.text);
const denominator = receiptDenominator({
  reconciled, enumerated, seasonId: 20262027,
  inputs: [
    { name: "astra-audit-receipts/trade-reconciled-keys.csv", sha256: reconciledFile.sha256, rows: reconciled.length },
    { name: "astra-audit-receipts/player-game-keys.csv", sha256: enumeratedFile.sha256, rows: enumerated.length },
    { name: "astra-audit-receipts/enumeration.sql", sha256: sqlFile.sha256, rows: 1 },
  ],
});
const bytes = serializeDenominator(denominator);
const stored = receiptStoredRows(reconciled);
const summary = {
  version: "forge-full-nhl-h10-denominator-summary-v1",
  denominatorSha256: denominator.denominatorSha256,
  denominatorFileSha256: createHash("sha256").update(bytes).digest("hex"),
  evidenceClass: denominator.evidenceClass,
  counts: { players: denominator.counts.players, keys: denominator.counts.keys, expectedKeys: denominator.counts.expectedKeys, byClass: denominator.counts.byClass,
    teams: new Set(denominator.keys.map(key => key.teamId)).size, games: new Set(denominator.keys.map(key => key.gameId)).size,
    unresolved: denominator.counts.unresolved, conflicts: denominator.counts.conflicts, shortfallPlayers: denominator.counts.shortfallPlayers,
    keysWithoutOpponent: denominator.keys.filter(key => key.opponentId === null).length },
  astraBaseline: { expectedKeys: 8040, players: 804, storedRowsPerAstraWriterColumn: stored.reduce((sum, row) => sum + row.storedSkaters + row.storedGoalies, 0), byHorizon: stored },
  conflicts: denominator.conflicts,
  unresolvedReasons: Object.fromEntries([...new Set(denominator.unresolved.map(row => row.reason))].sort().map(reason => [reason, denominator.unresolved.filter(row => row.reason === reason).length])),
  limitations: denominator.limitations,
};
mkdirSync(out, { recursive: true });
writeFileSync(join(out, "denominator.json"), bytes);
writeFileSync(join(out, "summary.json"), `${canonicalJson(summary)}\n`);
process.stdout.write(`${JSON.stringify({ denominatorSha256: summary.denominatorSha256, denominatorFileSha256: summary.denominatorFileSha256, ...summary.counts }, null, 2)}\n`);
