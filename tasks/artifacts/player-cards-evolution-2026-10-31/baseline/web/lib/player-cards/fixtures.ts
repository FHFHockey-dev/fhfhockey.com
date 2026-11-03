import type { MetricId, PlayerCardSnapshot } from "./contracts";
import { METRICS } from "./registry";
import { rankMetric } from "./ranking";

const exampleValues: Record<MetricId, number> = { atoi: 21.35, sog60: 11.8, icf60: 19.1, iscf60: 9.4, ixg60: 1.24, cf60: 67.2, scf60: 31.4, xgf60: 3.62, xgPct: 58.7, ipp: 76.9, shPct: 14.6, oiShPct: 10.8 };
export type FixtureKind = "curated" | "long-name" | "partial" | "missing";

// Fabricated cohort, identities and values. No NHL row or provider is queried.
export function fixtureSnapshot(kind: FixtureKind = "curated"): PlayerCardSnapshot {
  const partial = kind === "partial";
  const playerId = "example-alex-morgan";
  const readings = METRICS.map((metric, index) => {
    const value = exampleValues[metric.id];
    const definitionKey = `synthetic-v0:L10:all:20262027:${metric.id}`;
    const population = 812 - index * 3;
    const rows = Array.from({ length: population }, (_, n) => ({ playerId: n === 0 ? playerId : `example-${n}`, value: n === 0 ? value : value * (0.2 + ((n * 37 + index * 13) % 101) / 100), state: "valid" as const, definitionKey }));
    const result = rankMetric(playerId, rows, { fullEligiblePopulationVerified: true, definitionKey });
    if (kind === "missing" && metric.id === "ixg60") return { id: metric.id, value: null, state: "missing" as const, reason: "Example: 1 source game missing", rank: null };
    if (kind === "missing" && metric.id === "xgPct") return { id: metric.id, value, state: "valid" as const, rank: null, rankReason: "Example: comparison coverage incomplete" };
    return { id: metric.id, value, state: "valid" as const, rank: result.rank };
  });
  return {
    id: `synthetic-player-card-v0-${kind}`, renderVersion: "player-card-v0", registryVersion: "proposed-nst-v0", source: "synthetic",
    capturedAt: "2026-10-24T12:00:00Z", sourceVersion: "fabricated-design-fixture-v0", poolId: "synthetic-cohort-v0",
    settings: { season: 20262027, gameType: "regular", strength: "all", cutoff: "2026-10-23T23:59:59Z", period: { mode: "appearances", count: 10 }, seasonPolicy: "season-only-proposed", shortSamplePolicy: "allow-known-short-proposed", rankPolicy: "competition-midrank-proposed" },
    player: { id: playerId, name: kind === "long-name" ? "Alexandria Montgomery-Sutherland" : "Alex Morgan", team: "Example Hockey Club", position: "RW" },
    sample: { gp: partial ? 3 : 10, requested: 10, toiSeconds: partial ? 3843 : 12810, firstDate: partial ? "2026-10-18" : "2026-10-03", lastDate: "2026-10-23", gameIds: Array.from({ length: partial ? 3 : 10 }, (_, i) => `synthetic-game-${i + 1}`), ...(partial ? { warning: "3 of 10 appearances · known short season example" } : {}) },
    readings,
  };
}

