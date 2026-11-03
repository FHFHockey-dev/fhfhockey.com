import type { CardSettings, PlayerCardSnapshot, Strength } from "./contracts";
import type { AdaptedCard } from "./adapter";
import { EXAMPLE_PLAYERS, FIXTURE_CUTOFF, type FixtureScenario } from "./interactionFixtures";

export type FlowState = { playerId: number; mode: "appearances" | "calendar"; count: 5 | 10 | 20; start: string; end: string; strength: Strength; scenario: FixtureScenario; fullN: boolean };
export const INITIAL_FLOW: FlowState = { playerId: 1001, mode: "appearances", count: 10, start: "2026-10-10", end: "2026-10-23", strength: "all", scenario: "complete", fullN: false };
export function readFlow(search: string): FlowState {
  const p = new URLSearchParams(search), count = Number(p.get("n")), playerId = Number(p.get("player"));
  return { ...INITIAL_FLOW, playerId: EXAMPLE_PLAYERS.some(player => player.id === playerId) ? playerId : INITIAL_FLOW.playerId, mode: p.get("mode") === "calendar" ? "calendar" : "appearances", count: [5, 10, 20].includes(count) ? count as 5 | 10 | 20 : 10, start: p.get("start") || INITIAL_FLOW.start, end: p.get("end") || INITIAL_FLOW.end, strength: ["all", "5v5", "pp"].includes(p.get("strength") || "") ? p.get("strength") as Strength : "all", scenario: ["complete", "metric-gap", "unknown-pool", "history-gap", "stale", "source-error"].includes(p.get("case") || "") ? p.get("case") as FixtureScenario : "complete", fullN: p.get("full") === "1" };
}
export function flowSearch(state: FlowState) { return `?${new URLSearchParams({ player: String(state.playerId), mode: state.mode, n: String(state.count), start: state.start, end: state.end, strength: state.strength, case: state.scenario, full: state.fullN ? "1" : "0" })}`; }
export function flowSettings(state: FlowState): CardSettings {
  return { season: 20262027, gameType: "regular", strength: state.strength, cutoff: FIXTURE_CUTOFF, period: state.mode === "appearances" ? { mode: "appearances", count: state.count } : { mode: "calendar", start: state.start, end: state.end, timezone: "UTC" }, seasonPolicy: "season-only-proposed", shortSamplePolicy: state.fullN ? "require-full-proposed" : "allow-known-short-proposed", rankPolicy: "competition-midrank-proposed" };
}
export type FlowSnapshot = Omit<PlayerCardSnapshot, "sample"> & { sample: Omit<PlayerCardSnapshot["sample"], "toiSeconds" | "gp"> & { toiSeconds: number | null; gp: number | null } };
export function pngContext(snapshot: FlowSnapshot): PlayerCardSnapshot | null {
  return snapshot.sample.toiSeconds === null || snapshot.sample.gp === null ? null : { ...snapshot, sample: { ...snapshot.sample, gp: snapshot.sample.gp, toiSeconds: snapshot.sample.toiSeconds } };
}
export function displaySnapshot(card: AdaptedCard): FlowSnapshot {
  const player = EXAMPLE_PLAYERS.find(player => player.id === card.selection.playerId)!;
  const atoi = card.readings.find(row => row.id === "atoi")?.value;
  return { id: card.snapshotId, renderVersion: "player-card-v0", registryVersion: "proposed-nst-v0", source: "synthetic", capturedAt: card.capturedAt, settings: card.settings, player: { id: String(player.id), name: player.name, team: `${player.team} · example`, position: player.position }, sample: { gp: card.selection.state === "missing" ? null : card.selection.actualGp, requested: card.selection.requestedN ?? card.selection.actualGp, toiSeconds: atoi == null ? null : atoi * 60 * card.selection.actualGp, firstDate: card.selection.firstDate || "unverified", lastDate: card.selection.lastDate || "unverified", gameIds: card.selection.games.map(game => String(game.gameId)), ...(card.selection.knownShort ? { warning: "Known short season · proposed policy" } : {}) }, poolId: `${card.snapshotId}:all-valid-by-metric`, sourceVersion: card.source.version, readings: card.readings };
}
