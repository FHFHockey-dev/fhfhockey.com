import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { join } from "node:path";
import { projectionInputHash } from "../lib/projections/inputCapture";
import { goalHistoryFromOfficialFinal, pairScopeSchema, scoreTeamGoals, type HistoricalGoalGame } from "../lib/forecast-diagnostics/pairedInputs";

/** Public official reads only. A new receipt proves current availability for a future cutoff, never a historical cutoff. */
async function main() {
  const [scopeFile, homeAbbreviation, awayAbbreviation, destination] = process.argv.slice(2);
  if (!destination || !/^[A-Z]{3}$/.test(homeAbbreviation ?? "") || !/^[A-Z]{3}$/.test(awayAbbreviation ?? ""))
    throw new Error("Usage: capture-team-goals-history.ts SCOPE_JSON HOME_ABBREVIATION AWAY_ABBREVIATION EXCLUSIVE_PRIVATE_DIRECTORY");
  const scope = pairScopeSchema.parse(JSON.parse(readFileSync(scopeFile, "utf8")));
  if (Date.now() >= Date.parse(scope.cutoffAt)) throw new Error("Cannot collect new inputs at or after cutoff");
  mkdirSync(destination, { mode: 0o700 });
  const save = (name: string, value: unknown) => writeFileSync(join(destination, name), JSON.stringify(value, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  const startedAt = Date.now(), deadline = Math.min(startedAt + 90_000, Date.parse(scope.cutoffAt));
  async function get(path: string) {
    const url = `https://api-web.nhle.com/v1/${path}`;
    if (Date.now() >= deadline) throw new Error("History acquisition deadline exceeded");
    const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(Math.min(15_000, deadline - Date.now())) });
    if (!response.ok) throw new Error(`Official source status ${response.status}`);
    if (Number(response.headers.get("content-length")) > 8 * 1024 * 1024) throw new Error("Oversized official response");
    const bodyUtf8 = await response.text(), firstReceivedAt = new Date().toISOString();
    if (Buffer.byteLength(bodyUtf8) > 8 * 1024 * 1024 || Date.now() >= deadline) throw new Error("Oversized or late official response");
    const payload = JSON.parse(bodyUtf8), revisionId = randomUUID();
    const rawBytesHash = createHash("sha256").update(bodyUtf8).digest("hex");
    const provenance = { revisionId, payloadHash: projectionInputHash(payload), source: url, firstReceivedAt,
      verifiedAt: new Date().toISOString(), publishedAt: null, availabilityBasis: "retained_capture" as const, correctionOf: null };
    const source = { revisionId, payload, bodyUtf8, rawBytesHash };
    save(`${revisionId}.json`, { url, provenance, ...source });
    return { source, provenance };
  }
  const schedules = await Promise.all([homeAbbreviation, awayAbbreviation].map(abbreviation => get(`club-schedule-season/${abbreviation}/${scope.seasonId}`)));
  const history: HistoricalGoalGame[] = [], sources: Array<{ revisionId: string; payload: unknown; bodyUtf8: string; rawBytesHash: string }> = [];
  const population: Array<{ teamId: number; selectedGameIds: number[]; incompleteGameIds: number[] }> = [];
  for (const [index, retained] of schedules.entries()) {
    const teamId = index === 0 ? scope.homeTeamId : scope.awayTeamId;
    const games = retained.source.payload.games;
    if (!Array.isArray(games) || games.length > 200 || games.some((game: any) => game.homeTeam.id !== teamId && game.awayTeam.id !== teamId))
      throw new Error("Official club schedule identity or population is invalid");
    const prior = games.filter((game: any) => game.gameType === 2 && game.season === scope.seasonId && Date.parse(game.startTimeUTC) < Date.parse(scope.cutoffAt) && game.id !== scope.gameId);
    const selected = prior.filter((game: any) => ["OFF", "FINAL"].includes(game.gameState))
      .sort((a: any, b: any) => Date.parse(b.startTimeUTC) - Date.parse(a.startTimeUTC)).slice(0, 20);
    population.push({ teamId, selectedGameIds: selected.map((game: any) => game.id), incompleteGameIds: prior.filter((game: any) => !["OFF", "FINAL"].includes(game.gameState)).map((game: any) => game.id) });
    for (const game of selected) {
      const retainedGame = await get(`gamecenter/${game.id}/play-by-play`);
      const fact = goalHistoryFromOfficialFinal(retainedGame.source.payload, retainedGame.provenance).find(row => row.teamId === teamId);
      if (!fact || fact.gameId !== game.id || fact.seasonId !== scope.seasonId) throw new Error("Official schedule and completed facts differ");
      history.push(fact); sources.push(retainedGame.source);
    }
  }
  save("history.json", { scope, history, retainedHistorySources: sources, scheduleSources: schedules.map(row => row.source), population,
    draftExploratoryBaseline: scoreTeamGoals(scope, history), acceptanceEligible: false, capturedAt: new Date().toISOString() });
  console.log(JSON.stringify({ status: "history_captured", rows: history.length, acceptanceEligible: false, destination }));
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
