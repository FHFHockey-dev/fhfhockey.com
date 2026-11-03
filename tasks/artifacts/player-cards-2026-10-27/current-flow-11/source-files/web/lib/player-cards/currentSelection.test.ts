import { expect, it } from "vitest";
import { assertCurrentResponse, capturedWindow, currentSelectionUrl, readCurrentSelection, selectionRequest } from "./currentSelection";
import { buildCurrentNhlCard } from "./currentNhl";
const request = { playerId: 8476453, season: 20262027, count: 5 as const };
const sources = () => ({ identity: { playerId: 8476453, firstName: { default: "Captured" }, lastName: { default: "Player" }, currentTeamAbbrev: "TBL", position: "R", seasonTotals: [{ season: 20262027, gameTypeId: 2, leagueAbbrev: "NHL", gamesPlayed: 1 }] }, history: { seasonId: 20262027, gameTypeId: 2, gameLog: [{ gameId: 2026020167, gameDate: "2026-10-23", teamAbbrev: "TBL", goals: 1, assists: 0, points: 1, shots: 4, toi: "20:00" }] }, schedule: { games: [{ id: 2026020167, season: 20262027, gameType: 2, gameDate: "2026-10-23", startTimeUTC: "2026-10-24T01:00:00Z", gameState: "OFF", homeTeam: { abbrev: "TBL" }, awayTeam: { abbrev: "COL" } }] }, observedAt: "2026-10-27T00:42:33Z" });
import { currentNhlManifest } from "./currentNhlExport";
const selection = { playerId: "8476453", season: "20262027", count: "10", cardFormat: "rates-opportunity" as const };
it("uses stable IDs/FHFH URLs, preserves unrelated URL fields and refuses foreign or invalid identities", () => {
  for (const playerId of ["8476453", "/stats/player/8476453", "https://www.fhfhockey.com/stats/player/8476453"]) expect(selectionRequest({ ...selection, playerId }).playerId).toBe(8476453);
  expect(() => selectionRequest({ ...selection, playerId: "https://other.invalid/stats/player/8476453" })).toThrow("valid NHL ID");
  expect(() => selectionRequest({ ...selection, count: "100" })).toThrow();
  const url = currentSelectionUrl("http://localhost/player-cards?keep=1#card", selection); expect(url).toContain("keep=1"); expect(url).toContain("count=10"); expect(url).toContain("#card");
  expect(readCurrentSelection(url.split("?")[1].split("#")[0], selection)).toEqual(selection);
});
it("selects only same-player/season/source/capture windows and manifests only the displayed snapshot", () => {
  const first = buildCurrentNhlCard(request, sources()), windows = ([5, 10, 20] as const).map(count => buildCurrentNhlCard({ ...request, count }, sources())), bundle = { ...first, windows };
  assertCurrentResponse(bundle, request); const selected = capturedWindow(bundle, 10)!; expect(selected.request.count).toBe(10);
  const manifest = currentNhlManifest(selected, "results-milestones"); expect(manifest.card).not.toHaveProperty("windows"); expect(manifest.selectedMetrics).toContain("goals"); expect(manifest.card.evidence.selectedGames).toHaveLength(1);
  expect(capturedWindow({ ...bundle, windows: windows.map(view => ({ ...view, observedAt: "2020-01-01T00:00:00Z" })) }, 10)).toBeNull();
  expect(() => assertCurrentResponse({ ...bundle, windows: [windows[0]] }, request)).toThrow("inconsistent");
  expect(() => assertCurrentResponse({ ...bundle, values: { ...bundle.values, points: Infinity } }, request)).toThrow("metric");
});
