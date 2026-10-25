import type { CardSettings } from "./contracts";
import type { LocalCardInput } from "./adapter";
import type { GameMetricRecord } from "./aggregation";
import { METRICS } from "./registry";

export const EXAMPLE_PLAYERS = [
  { id: 1001, name: "Alex Morgan", team: "Harbour", position: "RW" },
  { id: 1002, name: "Alex Morgan", team: "Summit", position: "C" },
  { id: 1003, name: "Alexandria Montgomery-Sutherland", team: "North", position: "D" },
  { id: 1004, name: "Jamie Chen", team: "Harbour", position: "LW" },
] as const;
export type FixtureScenario = "complete" | "metric-gap" | "unknown-pool" | "history-gap" | "stale" | "source-error";
export const FIXTURE_CUTOFF = "2026-10-24T00:00:00Z";
export const FIXTURE_CAPTURED = "2026-10-24T02:00:00Z";

/** Entirely fabricated population, game histories, completion proofs and source fields. */
export function buildInteractionFixture(settings: CardSettings, scenario: FixtureScenario, selectedId: number): LocalCardInput {
  const definition = "synthetic-nst-shaped-v1", version = "interaction-fixtures-v1";
  const players = Array.from({ length: 18 }, (_, index) => {
    const id = 1001 + index;
    const days = id === 1004 ? [17, 20, 23] : Array.from({ length: 23 }, (_, i) => i + 1).filter(day => day % 7 !== index % 7);
    const appearances = days.map(day => ({ playerId: id, gameId: 2026000000 + id * 100 + day, season: 20262027, gameType: "regular" as const, date: `2026-10-${String(day).padStart(2, "0")}`, played: true, completion: { status: "verified-final" as const, completedAt: `2026-10-${String(day).padStart(2, "0")}T22:00:00Z`, reference: "fabricated-final-proof" } }));
    const records: GameMetricRecord[] = appearances.map((game, i) => {
      const seed = index * 17 + i * 7;
      const ppZero = settings.strength === "pp" && i % 3 === 0;
      const toi = ppZero ? 0 : settings.strength === "pp" ? 120 + seed % 90 : settings.strength === "5v5" ? 600 + seed % 200 : 1000 + seed % 400;
      const shots = ppZero ? 0 : seed % (settings.strength === "pp" ? 3 : 6);
      const goals = shots && seed % 3 === 0 ? 1 : 0;
      const points = ppZero ? 0 : goals + (seed % 4 === 0 ? 1 : 0);
      const gf = ppZero ? 0 : Math.max(points, 1 + seed % 4);
      return { playerId: id, gameId: game.gameId, season: game.season, date: game.date, strength: settings.strength, sourceDefinition: definition, sourceVersion: version, capturedAt: FIXTURE_CAPTURED, state: "ready", toiUnit: "seconds", individual: { toi, shots, goals, total_points: points, icf: ppZero ? 0 : shots + 2 + seed % 4, iscfs: ppZero ? 0 : 1 + seed % 4, ixg: ppZero ? 0 : 0.08 + (seed % 7) * 0.11 }, onIce: { toi, cf: ppZero ? 0 : 12 + seed % 20, scf: ppZero ? 0 : 6 + seed % 10, xgf: ppZero ? 0 : 0.6 + (seed % 10) * 0.13, xga: ppZero ? 0 : 0.7 + (seed % 10) * 0.07, gf, sf: ppZero ? 0 : gf + 10 + seed % 10 } };
    });
    if (id === selectedId) {
      if (scenario === "metric-gap") records[records.length - 1].individual.ixg = null;
      if (scenario === "stale" || scenario === "source-error") records.forEach(row => { row.state = scenario; });
    }
    return { frame: { playerId: id, season: 20262027, gameType: "regular" as const, dateBasis: "UTC" as const, completeHistory: !(id === selectedId && scenario === "history-gap"), historyThrough: FIXTURE_CUTOFF, historyReference: "fabricated-complete-season-history", appearances }, records };
  });
  const id = `synthetic-flow-v1-${selectedId}-${settings.period.mode === "appearances" ? `L${settings.period.count}` : `${settings.period.start}-${settings.period.end}`}-${settings.strength}-${settings.shortSamplePolicy}-${scenario}`;
  return { id, origin: "synthetic", capturedAt: FIXTURE_CAPTURED, settings, source: { definition, version, definitionReference: "fabricated-provider-and-model-definition", verifiedMetrics: METRICS.map(metric => metric.id) }, population: { scope: "synthetic-all-values", complete: scenario !== "unknown-pool", reference: "fabricated18-player-population-includes-all-compatible-values", expectedPlayerIds: players.map(player => player.frame.playerId) }, players };
}

