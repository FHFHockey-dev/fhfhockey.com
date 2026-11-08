import { describe, expect, it } from "vitest";
import { mapNstCapture, type NstCapture } from "./nstCapture";
import { adaptLocalSnapshot } from "./adapter";
import { METRICS } from "./registry";
import type { MetricId } from "./contracts";

function fixture(): NstCapture {
  const appearances = [20, 21].map(day => ({ playerId: 1001, gameId: 2026020000 + day, season: 20262027, gameType: "regular" as const, date: `2026-10-${day}`, played: true, completion: { status: "verified-final" as const, completedAt: `2026-10-${day}T23:00:00Z`, reference: "synthetic final evidence" } }));
  const rows = appearances.map(game => ({ player_id: 1001, season: game.season, date_scraped: game.date, gp: 1, toi: 1200 }));
  const batch = { toiUnit: "seconds" as const, capturedAt: "2026-10-24T01:00:00Z", reference: "synthetic capture receipt", readStatus: "ok" as const, identity: { mode: "row-player-id" as const } };
  return {
    id: "mapping-contract-fixture", capturedAt: "2026-10-24T02:00:00Z",
    settings: { season: 20262027, gameType: "regular", strength: "all", cutoff: "2026-10-24T00:00:00Z", period: { mode: "appearances", count: 5 }, seasonPolicy: "season-only-proposed", shortSamplePolicy: "allow-known-short-proposed", rankPolicy: "competition-midrank-proposed" },
    source: { definition: "synthetic NST definition", version: "test-v1", definitionReference: "synthetic definition receipt", verifiedMetrics: METRICS.map(m => m.id) },
    population: { scope: "all-nhl", complete: false, expectedPlayerIds: [1001], reference: "Single-player fixture; not a league population" },
    frames: [{ playerId: 1001, season: 20262027, gameType: "regular", dateBasis: "UTC", completeHistory: true, historyThrough: "2026-10-24T00:00:00Z", historyReference: "synthetic history evidence", appearances }],
    individual: { ...batch, table: "nst_gamelog_as_counts", rows: rows.map(row => ({ ...row, shots: 4, goals: 1, total_points: 1, icf: 8, iscfs: 3, ixg: .4 })) },
    onIce: { ...batch, table: "nst_gamelog_as_counts_oi", rows: rows.map(row => ({ ...row, cf: 20, scf: 10, xgf: 1, xga: .5, gf: 2, sf: 15 })) },
  };
}
function mapped(capture = fixture()) {
  const result = mapNstCapture(capture); if (result.state !== "mapped") throw new Error(result.reason); return result;
}
function reading(capture: NstCapture, id: MetricId) {
  const result = adaptLocalSnapshot(mapped(capture).input, 1001); if (result.state === "rejected") throw new Error(result.reason);
  return result.readings.find(row => row.id === id)!;
}

describe("supplied NST capture mapping, with synthetic proof receipts", () => {
  it("preserves seconds, canonical components and unknown population without mutating or aliasing the capture", () => {
    const capture = fixture(), before = JSON.stringify(capture), result = mapped(capture);
    expect(JSON.stringify(capture)).toBe(before); expect(result.issues).toEqual([]);
    expect(result.input.players[0].records[0].individual.shots).toBe(4);
    expect(reading(capture, "sog60")).toMatchObject({ value: 12, state: "valid", rank: null });
    expect(reading(capture, "atoi").value).toBe(20);
    capture.frames[0].appearances[0].completion = { status: "unverified" };
    expect(result.input.players[0].frame.appearances[0].completion.status).toBe("verified-final");
    expect(result.liveActivation).toBe(false); expect(result.premiumActivation).toBe(false);
  });
  it("requires an explicit single-player query receipt when row IDs were omitted and rejects conflicting IDs", () => {
    const capture = fixture(); capture.individual.rows = capture.individual.rows.map(({ player_id: _id, ...row }) => row);
    expect(reading(capture, "sog60").state).toBe("missing");
    capture.individual.identity = { mode: "single-player-query", playerId: 1001, reference: "Pinned query WHERE player_id = 1001" };
    expect(reading(capture, "sog60").value).toBe(12);
    capture.individual.rows = [{ ...capture.individual.rows[0], player_id: 1002 }, capture.individual.rows[1]];
    expect(reading(capture, "sog60").state).toBe("missing");
  });
  it("refuses wrong strength tables, minutes, failed reads and later capture metadata without suppressing independent groups", () => {
    for (const change of [{ table: "nst_gamelog_5v5_counts" }, { toiUnit: "minutes" as const }, { readStatus: "error" as const }, { capturedAt: "2026-10-25T00:00:00Z" }]) {
      const capture = fixture(); Object.assign(capture.individual, change);
      expect(reading(capture, "sog60").state).toBe("missing"); expect(reading(capture, "xgf60").state).toBe("valid");
    }
  });
  it("joins exact season/date rather than independently selecting latest rows or using prior-season totals", () => {
    const capture = fixture(); capture.individual.rows = [{ ...capture.individual.rows[0], season: 20252026 }, capture.individual.rows[1]];
    expect(reading(capture, "sog60").state).toBe("missing");
    expect(mapped(capture).issues.some(issue => issue.gameId === 2026020020 && issue.reason.includes("No captured"))).toBe(true);
  });
  it("preserves independent metrics when one on-ice source row is missing, and does not pool duplicate rows", () => {
    const capture = fixture(); capture.onIce.rows = capture.onIce.rows.slice(1);
    expect(reading(capture, "sog60").value).toBe(12); expect(reading(capture, "ipp").state).toBe("missing"); expect(reading(capture, "xgf60").state).toBe("missing");
    capture.individual.rows = [...capture.individual.rows, capture.individual.rows[0]];
    expect(reading(capture, "atoi").state).toBe("missing");
  });
  it("refuses a date-only join when two official games share the same day", () => {
    const capture = fixture(); const first = capture.frames[0].appearances[0];
    capture.frames[0].appearances = [first, { ...first, gameId: first.gameId + 100 }];
    expect(mapped(capture).issues.filter(issue => issue.reason.includes("Multiple official")).length).toBe(2);
    expect(reading(capture, "sog60").state).toBe("missing");
  });
  it("does not manufacture history, completion or provider-definition evidence", () => {
    const capture = fixture(); capture.frames[0].completeHistory = false;
    expect(reading(capture, "sog60").state).toBe("missing");
    capture.frames[0].completeHistory = true; capture.frames[0].appearances[0].completion = { status: "unverified" };
    expect(reading(capture, "sog60").state).toBe("missing");
    const unverified = fixture(); unverified.source.verifiedMetrics = [];
    expect(reading(unverified, "ixg60").state).toBe("missing");
  });
  it("retains explicit zero PP exposure appearances without inventing a defined shooting ratio", () => {
    const capture = fixture(); capture.settings.strength = "pp";
    for (const group of ["individual", "onIce"] as const) {
      capture[group].table = `nst_gamelog_pp_counts${group === "onIce" ? "_oi" : ""}`;
      capture[group].rows = capture[group].rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, ["player_id", "season", "date_scraped"].includes(key) ? value : 0])));
    }
    expect(reading(capture, "atoi")).toMatchObject({ value: 0, state: "valid" }); expect(reading(capture, "shPct").state).toBe("undefined");
    expect(mapped(capture).input.players[0].frame.appearances).toHaveLength(2);
  });
  it("retains missing/nonnumeric fields and impossible per-game ratios for the accepted validity gates", () => {
    const capture = fixture(); capture.individual.rows = [{ ...capture.individual.rows[0], shots: "4", ixg: null }, capture.individual.rows[1]];
    expect(reading(capture, "sog60").state).toBe("missing"); expect(reading(capture, "ixg60").state).toBe("missing");
    capture.individual.rows = [{ ...capture.individual.rows[0], shots: 0, goals: 1 }, capture.individual.rows[1]];
    expect(reading(capture, "shPct").state).toBe("missing");
  });
  it("rejects invalid root scope/time and prevents pre-completion rows being hidden by another group's later capture", () => {
    const capture = fixture(); capture.individual.capturedAt = "2026-10-20T12:00:00Z";
    expect(reading(capture, "sog60").state).toBe("missing"); expect(reading(capture, "xgf60").state).toBe("valid");
    expect(mapNstCapture({ ...capture, capturedAt: "2026-10-23T00:00:00Z" }).state).toBe("rejected");
    capture.population.scope = "synthetic-all-values"; expect(mapNstCapture(capture).state).toBe("rejected");
  });
});
