/** Offline read/build of a single immutable skater snapshot. Run from web/. */
import { linkSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { inspectArmCExport } from "../../lib/buyLowSellHigh/armCExport.server";

export async function armCSnapshot(args: string[], evaluatedAtUTC: string, inspect = inspectArmCExport) {
  const [operation, directory, nhlId, eventThroughDate] = args;
  if (args.length !== 4 || !["build", "read"].includes(operation) || !directory ||
    !/^[1-9]\d{0,8}$/.test(nhlId) || !/^\d{4}-\d{2}-\d{2}$/.test(eventThroughDate) ||
    !Number.isFinite(Date.parse(eventThroughDate)) || new Date(eventThroughDate).toISOString().slice(0, 10) !== eventThroughDate)
    throw Error("Usage: armCSnapshot.ts build|read DIRECTORY NHL_PLAYER_ID EVENT_THROUGH_DATE");
  const target = { playerId: Number(nhlId), eventThroughDate };
  const result = await inspect(directory, target, evaluatedAtUTC, operation === "build" ? "build" : "read");
  if (result.status === "withheld") return { ...target, evaluatedAtUTC, status: result.status, reasons: result.reasons, score: null };
  if (operation === "build") {
    // Publish complete bytes exclusively. An interrupted build or a second writer cannot replace a vintage.
    const temp = mkdtempSync(join(directory, ".arm-c-"));
    try {
      writeFileSync(join(temp, "snapshot.json"), JSON.stringify(result.package), { flag: "wx", mode: 0o600 });
      linkSync(join(temp, "snapshot.json"), join(directory, "snapshot.json"));
    } finally { rmSync(temp, { recursive: true, force: true }); }
  }
  return { ...target, evaluatedAtUTC, status: result.status, packageSHA256: result.packageSHA256,
    referenceGames: result.profile.evidence.reference.personalGames,
    score: result.profile.score.directionWithheldReason ? null : result.profile.score.value,
    directionWithheldReason: result.profile.score.directionWithheldReason, leagueRank: null, publicRelease: false };
}

if (require.main === module) {
  armCSnapshot(process.argv.slice(2), new Date().toISOString()).then(result => {
    process.stdout.write(JSON.stringify(result) + "\n");
    if (result.status === "withheld") process.exitCode = 2;
  }).catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
