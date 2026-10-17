import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { baselineAppearanceFromBoxscore } from "../../../web/lib/player-forecasts/baselineSourceLineage";
import { nativeGoalieShutoutDefinitionHash } from "../../../web/lib/player-forecasts/goalieBaselineRates";
import { deriveNativeGoalieShutoutCredit } from "../../../web/lib/player-forecasts/nativeGoalieOutcomes";
import { playerForecastSourcePayloadHash } from "../../../web/lib/player-forecasts/sourceSnapshot";
import { previewNativeGoalieShutouts } from "../../../web/scripts/preview-native-baseline";

// Offline only. Recover original retained bodies even when collection stopped on a schema assumption.
async function main() {
  const [root, capturePath, output, requestedId] = process.argv.slice(2);
  const nhlPlayerId = Number(requestedId);
  assert(root && capturePath && output && [8479394, 8479979].includes(nhlPlayerId));
  const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
  const sha = (bytes: string) => createHash("sha256").update(bytes).digest("hex");
  const allocation = read(join(capturePath, "allocation.json"));
  const capture = read(join(capturePath, "receipts.json"));
  const ledger = readFileSync(join(capturePath, "exposure-ledger.jsonl"), "utf8").trim().split("\n").map(line => JSON.parse(line));
  const retained = ledger.filter(row => row.action === "retained_whole_body_decode_intent" && row.nhlPlayerId === nhlPlayerId);
  assert.equal(retained.length, 1);
  const event = retained[0], rawBody = readFileSync(join(capturePath, `${nhlPlayerId}-summary.json`), "utf8");
  assert.equal(sha(rawBody), event.bodySHA256);
  assert.equal(Buffer.byteLength(rawBody), event.bodyBytes);
  const declared = allocation.players.find((row: any) => row.nhlPlayerId === nhlPlayerId);
  assert.equal(event.sourceURL, declared.url);
  const page = JSON.parse(rawBody), games = new Map(allocation.games.map((row: any) => [row.id, row]));
  assert.equal(page.total, page.data.length);
  assert(page.total < 50 && new Set(page.data.map((row: any) => row.gameId)).size === page.total);
  for (const row of page.data) {
    const game: any = games.get(row.gameId);
    assert(game && row.playerId === nhlPlayerId && row.gameDate === game.date);
    assert(row.seasonId === undefined || row.seasonId === game.seasonId);
  }
  const prior = read(join(root, "native-assembled-inputs-v2.json")).goalieWins.find((row: any) => row.payload.nhlPlayerId === nhlPlayerId);
  assert(prior);
  const cutoffAt = capture.completedAt;
  assert(Date.parse(cutoffAt) >= Date.parse(event.atUTC));
  const appearances = prior.payload.appearances.map((old: any) => {
    const original = old.finalBoxscore;
    const appearance = baselineAppearanceFromBoxscore({ rawRow: original.rawRow, game: original.game,
      nhlPlayerId, teamId: old.teamId, cutoffAt, population: "goalie" });
    assert(appearance);
    return appearance;
  });
  const shutoutSummary = { scope: { nhlPlayerId, seasonId: 20262027, startDate: "2026-09-29", endDate: "2026-10-12",
    approvedGameIds: allocation.games.map((row: any) => row.id) },
    receipts: [{ url: declared.url, capturedAt: event.atUTC, bodySha256: event.bodySHA256, rawBody }] };
  const credits = appearances.map((appearance: any) => deriveNativeGoalieShutoutCredit({ appearance, nhlPlayerId, cutoffAt, summary: shutoutSummary }));
  assert(credits.every((row: any) => row.shutoutCredit !== null), "A selected original appearance has no supported credit");
  const payload = { ...prior.payload, capturedAt: cutoffAt, appearances, shutoutSummary,
    policyVersion: "native-goalie-appearance-shutout-rates-v1", definitionHash: nativeGoalieShutoutDefinitionHash(20262027) };
  const observation = { ...prior, available_at: cutoffAt, payload, payload_hash: playerForecastSourcePayloadHash(payload) };
  const scope = read(join(root, `native-mean-previews-v2/goalieWins-team-${payload.teamId}-scope.json`));
  const now = new Date(), expiresAt = new Date(now.getTime() + 23 * 3600000).toISOString();
  const preview = await previewNativeGoalieShutouts([observation], scope, expiresAt, now);
  assert.equal(preview.publicUsesApproved, false);
  const sources = preview.bundle.sources;
  assert.equal(sources.length, 1);
  assert.equal(sources[0].targetKey, "SHUTOUTS_GOALIE");
  assert.equal(sources[0].released, false);
  const expected = credits.reduce((sum: number, row: any) => sum + row.shutoutCredit, 0) / credits.length;
  assert.equal(sources[0].mean, expected);
  mkdirSync(output, { mode: 0o700 });
  const save = (name: string, value: unknown) => writeFileSync(join(output, name), JSON.stringify(value, null, 2), { flag: "wx", mode: 0o600 });
  save("observation.json", [observation]); save("preview.json", preview);
  const report = { status: "genuine_credited_shutout_development_mean", nhlPlayerId, playerId: payload.playerId,
    checkedAt: now.toISOString(), captureCutoffAt: cutoffAt, summaryRows: page.total, verifiedSelectedAppearances: credits.length,
    sourceBodySha256: sha(rawBody), previewSha256: sha(JSON.stringify(preview, null, 2)), counterAndCreditChecksPassed: true,
    scheduledGameBindings: scope.games.length, publicUsesApproved: false, sourceRequests: 0, databaseWrites: 0,
    limitations: ["Conditional selected-appearance mean; no calibrated start/appearance probability or public admission.",
      "Retained provider roster and schedule metadata remain unverified/partial; not an issued game forecast."] };
  save("report.json", report); console.log(JSON.stringify(report));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
