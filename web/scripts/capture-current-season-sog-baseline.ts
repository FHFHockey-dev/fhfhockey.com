import { closeSync, constants, fstatSync, openSync, readSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { assembleCurrentRosterNativeInputs, type CurrentRosterNativeScope, type CurrentRosterNativeInputs } from "../lib/player-forecasts/currentRosterNativeInputs";
import { assembleCurrentSeasonSogBaseline, type CurrentSeasonSogGameScope } from "../lib/player-forecasts/currentSeasonSogBaseline";

function readBoundedJson(inputPath: string, maximumBytes: number): unknown {
  const fd = openSync(inputPath, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size <= 0 || stat.size > maximumBytes) throw new Error("Input JSON exceeds the bounded regular-file scope.");
    const bytes = new Uint8Array(stat.size + 1);
    let count = 0, length = 0;
    while (length < bytes.length && (count = readSync(fd, bytes, length, bytes.length - length, null)) > 0) length += count;
    const after = fstatSync(fd);
    if (length !== stat.size || after.size !== stat.size || after.mtimeMs !== stat.mtimeMs) throw new Error("Response input changed during bounded read.");
    return JSON.parse(Buffer.from(bytes.subarray(0, length)).toString("utf8"));
  } finally { closeSync(fd); }
}

/** Explicit local assembly from supplied response receipts; never collects sources. */
export function runCurrentSeasonSogAssembly(argv: string[]) {
  const usage = "capture-current-season-sog-baseline.ts --responses APPROVED_RESPONSE_RECEIPTS_JSON --out NEW_PRIVATE_JSON [--scope APPROVED_GAME_SCOPE_JSON | --roster-scope APPROVED_ROSTER_SCOPE_JSON]";
  if (![4, 6].includes(argv.length) || argv[0] !== "--responses" || argv[2] !== "--out" || !argv[1] || !argv[3]
    || (argv.length === 6 && (!["--scope", "--roster-scope"].includes(argv[4]) || !argv[5]))) throw new Error(usage);
  const inputPath = resolve(argv[1]), outputPath = resolve(argv[3]), scopePath = argv.length === 6 ? resolve(argv[5]) : null;
  if (inputPath === outputPath || scopePath === outputPath) throw new Error("Output must be a new file.");
  const rosterMode = argv[4] === "--roster-scope";
  const input = readBoundedJson(inputPath, (rosterMode ? 64 : 6) * 1024 * 1024);
  if (rosterMode) {
    const scope = readBoundedJson(scopePath!, 128 * 1024) as CurrentRosterNativeScope;
    const collector = input as Pick<CurrentRosterNativeInputs, "receipts" | "failures">;
    if (!collector || !Array.isArray(collector.receipts) || collector.failures !== undefined && !Array.isArray(collector.failures)) {
      throw new Error("Roster assembly requires explicit collected receipt/failure arrays.");
    }
    const packet = assembleCurrentRosterNativeInputs({ ...scope, receipts: collector.receipts, failures: collector.failures }, new Date());
    const output = openSync(outputPath, "wx", 0o600);
    try { writeFileSync(output, JSON.stringify(packet, null, 2)); } finally { closeSync(output); }
    return { status: "unreleased_roster_inputs", rosterPlayers: packet.coverage.length,
      skaterObservations: packet.skaters.length, goalieWinObservations: packet.goalieWins.length,
      goalieVolumeObservations: packet.goalieVolume.length,
      playersWithoutVerifiedAppearances: packet.coverage.filter(row => !row.observationEmitted).length,
      sourceReceiptCoverage: packet.sourceReceiptCoverage, missingSources: packet.missingSources.length,
      localFilesWritten: 1, databaseWrites: 0, sourceRequests: 0, publicUsesApproved: false };
  }
  const scope = scopePath ? readBoundedJson(scopePath, 64 * 1024) as CurrentSeasonSogGameScope : undefined;
  const packet = assembleCurrentSeasonSogBaseline(input as Parameters<typeof assembleCurrentSeasonSogBaseline>[0], new Date(), scope);
  const output = openSync(outputPath, "wx", 0o600);
  try { writeFileSync(output, JSON.stringify(packet, null, 2)); } finally { closeSync(output); }
  return { status: packet.status, payloadHash: packet.payloadHash, localFilesWritten: 1,
    databaseWrites: 0, sourceRequests: 0, publicUsesApproved: false };
}

if (require.main === module) {
  try { console.log(JSON.stringify(runCurrentSeasonSogAssembly(process.argv.slice(2)))); }
  catch (error) { console.error(error instanceof Error ? error.message : "Offline SOG assembly failed"); process.exitCode = 1; }
}
