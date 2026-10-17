import { closeSync, constants, fstatSync, openSync, readSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { assembleCurrentSeasonSogBaseline } from "../lib/player-forecasts/currentSeasonSogBaseline";

/** Explicit local assembly from supplied response receipts; never collects sources. */
export function runCurrentSeasonSogAssembly(argv: string[]) {
  const usage = "capture-current-season-sog-baseline.ts --responses APPROVED_RESPONSE_RECEIPTS_JSON --out NEW_PRIVATE_JSON";
  if (argv.length !== 4 || argv[0] !== "--responses" || argv[2] !== "--out" || !argv[1] || !argv[3]) throw new Error(usage);
  const inputPath = resolve(argv[1]), outputPath = resolve(argv[3]);
  if (inputPath === outputPath) throw new Error("Output must be a new file.");
  const fd = openSync(inputPath, constants.O_RDONLY | constants.O_NOFOLLOW);
  let input: unknown;
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size <= 0 || stat.size > 6 * 1024 * 1024) throw new Error("Input JSON exceeds the bounded regular-file scope.");
    const bytes = Buffer.alloc(stat.size + 1);
    let count = 0, length = 0;
    while (length < bytes.length && (count = readSync(fd, bytes, length, bytes.length - length, null)) > 0) length += count;
    const after = fstatSync(fd);
    if (length !== stat.size || after.size !== stat.size || after.mtimeMs !== stat.mtimeMs) throw new Error("Response input changed during bounded read.");
    input = JSON.parse(bytes.subarray(0, length).toString("utf8"));
  } finally { closeSync(fd); }
  const packet = assembleCurrentSeasonSogBaseline(input as Parameters<typeof assembleCurrentSeasonSogBaseline>[0]);
  const output = openSync(outputPath, "wx", 0o600);
  try { writeFileSync(output, JSON.stringify(packet, null, 2)); } finally { closeSync(output); }
  return { status: packet.status, payloadHash: packet.payloadHash, localFilesWritten: 1,
    databaseWrites: 0, sourceRequests: 0, publicUsesApproved: false };
}

if (require.main === module) {
  try { console.log(JSON.stringify(runCurrentSeasonSogAssembly(process.argv.slice(2)))); }
  catch (error) { console.error(error instanceof Error ? error.message : "Offline SOG assembly failed"); process.exitCode = 1; }
}
