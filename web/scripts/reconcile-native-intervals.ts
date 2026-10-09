import { readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { projectionInputHash } from "../lib/projections/inputCapture";
import { NATIVE_INTERVAL_RECONCILIATION_VERSION, reconcileNativeIntervalGame, verifyIntervalRevision } from "../lib/projections/nativeIntervalReconciliation";

const digest = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
function localJson(path: string) {
  if (statSync(path).size > 32 * 1024 * 1024) throw new Error("Retained local file exceeds 32 MiB");
  const bytes = readFileSync(path);
  return { path, sha256: digest(new Uint8Array(bytes)), value: JSON.parse(bytes.toString("utf8")) };
}
const equal = (left: unknown, right: unknown) => projectionInputHash(left) === projectionInputHash(right);
const sorted = (ids: number[]) => [...ids].sort((a, b) => a - b);

/** Offline only: no network, DB client, source freeze, estimator or issued projection. */
export function runNativeIntervalReconciliation(args: string[]) {
  const usage = "Use --ledger FILE --pbp-revisions DIR --supplemental DIR --output NEW_FILE";
  const options = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    if (!["--ledger", "--pbp-revisions", "--supplemental", "--output"].includes(args[index]) || !args[index + 1] || options.has(args[index]))
      throw new Error(usage);
    options.set(args[index], resolve(args[index + 1]));
  }
  if (options.size !== 4) throw new Error(usage);
  const ledgerFile = localJson(options.get("--ledger")!), ledger = ledgerFile.value;
  const manifestFile = localJson(resolve(options.get("--supplemental")!, "manifest.json")), manifest = manifestFile.value;
  if (ledger.version !== "native-goal-ledger-local-receipt-v1" || ledger.sourceDirty !== false || ledger.resultHash !== projectionInputHash(ledger.result)
    || ledger.result.version !== "native-goal-ledger-audit-v1" || ledger.result.acceptanceEligible !== false
    || manifest.version !== "official-supplemental-observations-v1" || manifest.acceptanceEligible !== false
    || !equal(ledger.result.scope, manifest.prospectiveScope)) throw new Error("Ledger receipt, supplemental manifest or prospective scope mismatch");
  const scope = ledger.result.scope;
  if (!Array.isArray(manifest.games) || !Array.isArray(manifest.gameIds) || !Array.isArray(ledger.result.games)
    || !equal(sorted(manifest.games.map((game: any) => game.gameId)), sorted(ledger.result.games.map((game: any) => game.gameId)))
    || !equal(sorted(manifest.gameIds), sorted(manifest.games.map((game: any) => game.gameId)))
    || new Set(manifest.gameIds).size !== manifest.gameIds.length) throw new Error("Retained historical game population mismatch");
  const inputFiles: { path: string; sha256: string }[] = [ledgerFile, manifestFile].map(({ path, sha256 }) => ({ path, sha256 }));
  const sourceReceipts: any[] = [];
  const readRevision = (directory: string, id: string) => {
    if (!/^[A-Za-z0-9-]{1,128}$/.test(id)) throw new Error("Unsafe retained revision filename");
    const file = localJson(resolve(directory, `${id}.json`));
    inputFiles.push({ path: file.path, sha256: file.sha256 });
    const provenance = verifyIntervalRevision(file.value, scope.cutoffAt);
    if (file.value.revisionId !== id) throw new Error("Retained revision filename/identity mismatch");
    sourceReceipts.push({ revisionId: id, fileSha256: file.sha256, rawBytesHash: file.value.rawBytesHash,
      payloadHash: provenance.payloadHash, source: provenance.source, firstReceivedAt: provenance.firstReceivedAt, verifiedAt: provenance.verifiedAt });
    return file;
  };
  const usedSupplementalIds = new Set<string>();
  const supplemental = (id: string) => {
    if (usedSupplementalIds.has(id)) throw new Error("Duplicate supplemental revision identity");
    usedSupplementalIds.add(id); return readRevision(options.get("--supplemental")!, id).value;
  };
  const games = [...manifest.games].sort((a: any, b: any) => a.gameId - b.gameId).map((game: any) => {
    const prior = ledger.result.games.find((row: any) => row.gameId === game.gameId);
    const pbpFile = readRevision(options.get("--pbp-revisions")!, prior.revisionId), pbp = pbpFile.value;
    if (!ledger.inputFiles.some((file: any) => file.sha256 === pbpFile.sha256)
      || pbp.rawBytesHash !== prior.rawBytesHash || pbp.provenance.payloadHash !== prior.canonicalPayloadHash
      || pbp.url !== `https://api-web.nhle.com/v1/gamecenter/${game.gameId}/play-by-play`
      || pbp.payload.id !== game.gameId) throw new Error("PBP revision differs from retained goal-ledger input");
    const box = supplemental(game.boxscoreRevisionId);
    if (box.kind !== "official_boxscore" || box.gameId !== game.gameId
      || box.url !== `https://api-web.nhle.com/v1/gamecenter/${game.gameId}/boxscore`) throw new Error("Supplemental boxscore identity mismatch");
    if (!Array.isArray(game.shiftRevisionIds) || !game.shiftRevisionIds.length) throw new Error("Missing retained shift pages");
    const pages = game.shiftRevisionIds.map(supplemental).sort((a: any, b: any) => a.page - b.page);
    const total = pages[0].payload.total;
    if (!Number.isSafeInteger(total) || total <= 0 || total !== game.declaredShiftTotal || total !== game.retainedShiftRows
      || pages.length !== Math.ceil(total / 1000)) throw new Error("Incomplete declared shift pagination");
    for (const [pageIndex, page] of pages.entries()) {
      if (page.kind !== "official_shift_page" || page.gameId !== game.gameId || page.page !== pageIndex || page.payload.total !== total
        || !Array.isArray(page.payload.data) || page.payload.data.length !== Math.min(1000, total - pageIndex * 1000)
        || page.url !== `https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId=${game.gameId}&start=${pageIndex * 1000}&limit=1000`)
        throw new Error("Retained shift page identity, order or row coverage mismatch");
    }
    const result = reconcileNativeIntervalGame({ playByPlay: pbp.payload, boxscore: box.payload,
      shiftPages: pages.map((page: any) => ({ revisionId: page.revisionId, rows: page.payload.data })) });
    return { ...result, sourceRevisionIds: { playByPlay: pbp.revisionId, boxscore: box.revisionId, shifts: pages.map((page: any) => page.revisionId) },
      availableBeforeHistoricalStart: [pbp, box, ...pages].every(source => Date.parse(source.provenance.verifiedAt) < Date.parse(pbp.payload.startTimeUTC)) };
  });
  const result = {
    version: NATIVE_INTERVAL_RECONCILIATION_VERSION, evidenceKind: "retained_historical_interval_mechanics", scope, acceptanceEligible: false,
    units: { clocks: "seconds per played period, half-open interval measure", presence: "seconds per historical player-game",
      cellClock: "seconds per historical team-game in disjoint period/net/skater-count cells", cellSkaters: "sum of on-ice skater seconds; not team-clock seconds" },
    policy: { sourceRows: "retained verbatim, never deleted or rewritten", overlaps: "presence union counted once",
      conflicts: "enumerate endpoint and start-plus-declared-duration candidates; accept one distinct box-TOI-matching presence union",
      variantBound: 64, unresolvedPlayer: "quarantine full-game joint state; total TOI discrepancy cannot locate the erroneous interval",
      eventBoundaries: "record compatibility with adjacent states; no invented ordering or goal-to-exposure assignment",
      shootout: "excluded from playing-time exposure" },
    sourceReceipts, games,
    summary: {
      gameCount: games.length, retainedRowCount: games.reduce((sum, game) => sum + game.sourceRows.length, 0),
      eventMarkerRows: games.reduce((sum, game) => sum + game.sourceRows.filter(row => row.disposition === "event_marker").length, 0),
      durationConflictRows: games.reduce((sum, game) => sum + game.sourceRows.filter(row => row.disposition === "duration_conflict").length, 0),
      reconciledPlayerGames: games.reduce((sum, game) => sum + game.players.filter(row => row.status === "reconciled").length, 0),
      quarantinedPlayerGames: games.reduce((sum, game) => sum + game.players.filter(row => row.status === "quarantined").length, 0),
      reconciledStateClockSeconds: games.reduce((sum, game) => sum + game.reconciledStateClockSeconds, 0),
      quarantinedStateClockSeconds: games.some(game => game.quarantinedStateClockSeconds === null) ? null
        : games.reduce((sum, game) => sum + game.quarantinedStateClockSeconds!, 0),
    },
    remainingRequirements: ["Resolve quarantined rows, player totals and event-state conflicts without discarding source observations.",
      "Prove provider shift/net-state semantics and event ordering before joining event credits to exposure cells.",
      "Prove the native last-ten window, roster and as-of feature lineage; these eight games establish a different bounded research population.",
      "Select and approve an estimator and appearance basis; no rate, goal mean or new forecast head is implemented here.",
      "Prove prospective cutoff and historical pregame availability separately; fresh retained receipts cannot establish earlier availability."],
  };
  const root = resolve(__dirname, "../.."), git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  const sourceHashes = Object.fromEntries(["web/lib/projections/nativeIntervalReconciliation.ts", "web/scripts/reconcile-native-intervals.ts",
    "web/lib/projections/inputCapture.ts", "web/lib/forecast-diagnostics/pairedInputs.ts"].map(path => [path, digest(new Uint8Array(readFileSync(resolve(root, path))))]));
  const receipt = { version: "native-interval-local-receipt-v1", codeCommit: git("rev-parse", "HEAD"), sourceDirty: Boolean(git("status", "--porcelain")),
    nodeVersion: process.version, sourceHashes, lockfileHash: digest(new Uint8Array(readFileSync(resolve(root, "web/package-lock.json")))),
    inputFiles, precedingLedgerResultHash: ledger.resultHash, resultHash: projectionInputHash(result), result };
  writeFileSync(options.get("--output")!, JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
  return receipt;
}

if (require.main === module) {
  try {
    const receipt = runNativeIntervalReconciliation(process.argv.slice(2));
    console.log(JSON.stringify({ codeCommit: receipt.codeCommit, resultHash: receipt.resultHash, ...receipt.result.summary, acceptanceEligible: false }));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1;
  }
}
