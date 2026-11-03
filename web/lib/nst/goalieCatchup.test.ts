import { describe, expect, it } from "vitest";
import {
  acknowledgeGoalieUnit, buildGoalieCatchupManifest, completedGoalieDate,
  GOALIE_DATASETS, planGoalieCatchupStep,
  type GoalieCatchupManifest, type GoalieCompletionReceipt
} from "./goalieCatchup";

const season = "20262027";
const sourceVersion = "goalie-v1";
function receipt(date: string, dataset: typeof GOALIE_DATASETS[number], rows = 1): GoalieCompletionReceipt {
  return { season, sourceVersion, date, dataset, status: rows ? "complete" : "empty_valid",
    parsedRows: rows, mappedRows: rows, writtenRows: rows,
    outputAcknowledged: true, checkpointAcknowledged: true };
}
function manifest(options: Partial<Parameters<typeof buildGoalieCatchupManifest>[0]> = {}) {
  return buildGoalieCatchupManifest({ season, sourceVersion, seasonStartDate: "2026-10-07",
    regularSeasonEndDate: "2027-04-15", startDate: "2026-10-28", now: new Date("2026-11-01T08:30:00Z"),
    days: ["2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31"].map(date => ({ date, calendar: "final", allCounts: "complete" })),
    receipts: [], holds: [], readsComplete: true, ...options });
}
function step(work: GoalieCatchupManifest, overrides: Partial<Parameters<typeof planGoalieCatchupStep>[0]> = {}) {
  return planGoalieCatchupStep({ manifest: work, now: new Date("2026-11-01T08:30:00Z"),
    budget: { utcDate: "2026-11-01", steps: 0, attempts: 0 }, sharedJobActive: false,
    lastDirectJobFinishedAt: null, ...overrides });
}

describe("goalie catch-up manifest", () => {
  it("excludes the current NHL date across UTC midnight and DST", () => {
    expect(completedGoalieDate(new Date("2026-11-01T01:00:00Z"))).toBe("2026-10-30");
    expect(completedGoalieDate(new Date("2026-11-01T08:30:00Z"))).toBe("2026-10-31");
    expect(completedGoalieDate(new Date("2026-11-02T04:30:00Z"))).toBe("2026-10-31");
    expect(manifest().units).toHaveLength(40);
    expect(manifest().endDate).toBe("2026-10-31");
  });

  it("retains old and interior gaps when allCounts is newer", () => {
    const work = manifest({ receipts: [receipt("2026-10-31", "allCounts"), receipt("2026-10-28", "5v5Counts")] });
    expect(work.plannedRequestCount).toBe(38);
    expect(work.units.find(unit => unit.key.endsWith("2026-10-28/evRates"))?.state).toBe("pending");
    expect(work.units.find(unit => unit.key.endsWith("2026-10-29/allCounts"))?.state).toBe("pending");
    expect(work.units.find(unit => unit.key.endsWith("2026-10-31/allCounts"))?.state).toBe("complete");
  });

  it("reopens partial allCounts coverage and persists legitimate PP empty completion", () => {
    const work = manifest({
      days: [{ date: "2026-10-28", calendar: "final", allCounts: "incomplete" }],
      receipts: [receipt("2026-10-28", "allCounts"), receipt("2026-10-28", "ppCounts", 0)]
    });
    expect(work.units.find(unit => unit.dataset === "allCounts")?.state).toBe("pending");
    expect(work.units.find(unit => unit.dataset === "ppCounts")?.state).toBe("empty_valid");
    expect(work.units.filter(unit => unit.date === "2026-10-29").every(unit => unit.state === "held")).toBe(true);
  });

  it("does not fetch on incomplete reads or conflicting no-game observations", () => {
    expect(manifest({ readsComplete: false }).units.every(unit => unit.state === "held")).toBe(true);
    const work = manifest({ days: [{ date: "2026-10-28", calendar: "no_games", allCounts: "incomplete" }] });
    expect(work.units.every(unit => unit.state === "held")).toBe(true);
    const empty = manifest({ days: [{ date: "2026-10-28", calendar: "no_games", allCounts: "complete" }] });
    expect(empty.units.slice(0, 10).every(unit => unit.state === "no_games")).toBe(true);
  });

  it("bounds discovery to14dates and retains the next unplanned date", () => {
    const work = manifest({ startDate: "2026-09-01", now: new Date("2026-11-15T13:00:00Z") });
    expect(work.startDate).toBe("2026-10-07");
    expect(work.units).toHaveLength(140);
    expect(work.endDate).toBe("2026-10-20");
    expect(work.nextUnplannedDate).toBe("2026-10-21");
    expect(manifest({ startDate: "2027-05-01" }).units).toHaveLength(0);
  });

  it("rejects duplicate/malformed evidence instead of choosing an arbitrary receipt", () => {
    expect(() => manifest({ startDate: "2026-02-30" })).toThrow("Invalid goalie calendar date");
    const row = receipt("2026-10-28", "allCounts");
    expect(() => manifest({ receipts: [row, row] })).toThrow("Duplicate goalie completion receipt");
    const stale = manifest({ receipts: [{ ...row, sourceVersion: "old" }] });
    expect(stale.plannedRequestCount).toBe(40);
  });

  it("holds lost output/checkpoint acknowledgement without advancing other work", () => {
    const original = manifest();
    const held = acknowledgeGoalieUnit(original, { ...receipt("2026-10-28", "5v5Counts"), checkpointAcknowledged: false }, "complete");
    expect(held.scope).toBe(original.scope);
    expect(held.plannedRequestCount).toBe(40);
    expect(held.units[0].state).toBe("held");
    const decision = step(held);
    expect(decision.allowed).toBe(true);
    if (decision.allowed) expect(decision.units[0].dataset).toBe("5v5Rates");
    expect(() => acknowledgeGoalieUnit(held, receipt("2026-10-28", "5v5Counts"), "complete")).toThrow("holds need reconciliation");
    const mismatch = acknowledgeGoalieUnit(original, { ...receipt("2026-10-28", "evCounts"), writtenRows: 0 }, "complete");
    expect(mismatch.units.find(unit => unit.dataset === "evCounts")?.state).toBe("held");
  });

  it("holds empty allCounts when expected goalie coverage is still missing", () => {
    const work = acknowledgeGoalieUnit(manifest(), receipt("2026-10-28", "allCounts", 0), "incomplete");
    expect(work.units.find(unit => unit.dataset === "allCounts")?.state).toBe("held");
  });

  it("retains persisted review holds across day and parser-version rollover", () => {
    const work = manifest({ now: new Date("2026-11-02T08:30:00Z"), sourceVersion: "goalie-v2",
      receipts: [receipt("2026-10-28", "allCounts")],
      holds: [{ season, date: "2026-10-28", dataset: "allCounts", reason: "Prior output acknowledgement was lost." }] });
    expect(work.units.find(unit => unit.key.endsWith("2026-10-28/allCounts"))?.state).toBe("held");
    const decision = step(work);
    expect(decision.allowed && decision.units.some(unit => unit.key.endsWith("2026-10-28/allCounts"))).toBe(false);
  });
});

describe("bounded goalie worker decisions", () => {
  it("uses the immutable full job at39/40 boundaries, even after a chunk succeeds", () => {
    const thirtyNine = manifest({ receipts: [receipt("2026-10-28", "5v5Counts")] });
    const small = step(thirtyNine);
    expect(small.allowed && [small.minIntervalMs, small.units.length]).toEqual([0, 20]);
    const original = manifest();
    let progressed = original;
    for (const unit of original.units.slice(0, 6)) progressed = acknowledgeGoalieUnit(progressed, receipt(unit.date, unit.dataset), "complete");
    const large = step(progressed);
    expect(large.allowed && [large.minIntervalMs, large.units.length, large.plannedRequestCount]).toEqual([21000, 6, 40]);
    expect(progressed.scope).toBe(original.scope);
  });

  it("requires the shared daily counter and caps retries as well as URL count", () => {
    const work = manifest();
    expect(step(work, { budget: { utcDate: "2026-10-31", steps: 0, attempts: 0 } }).allowed).toBe(false);
    expect(step(work, { budget: { utcDate: "2026-11-01", steps: 7, attempts: 0 } }).allowed).toBe(false);
    expect(step(work, { budget: { utcDate: "2026-11-01", steps: 0, attempts: 60 } }).allowed).toBe(false);
    const finalAttempt = step(work, { budget: { utcDate: "2026-11-01", steps: 3, attempts: 59 } });
    expect(finalAttempt.allowed && [finalAttempt.units.length, finalAttempt.maxAttempts]).toEqual([1, 1]);
  });

  it("honors shared-job exclusion, completion cooldown and end-of-window headroom", () => {
    const work = manifest();
    expect(step(work, { sharedJobActive: true }).allowed).toBe(false);
    expect(step(work, { lastDirectJobFinishedAt: "unknown" }).allowed).toBe(false);
    const cooldown = step(work, { lastDirectJobFinishedAt: "2026-11-01T08:25:00Z" });
    expect(!cooldown.allowed && cooldown.notBefore).toBe("2026-11-01T08:35:00.000Z");
    for (const time of ["08:34", "10:11", "12:49", "23:59"]) {
      expect(step(work, { now: new Date(`2026-11-01T${time}:00Z`) }).allowed).toBe(false);
    }
    expect(step(work, { now: new Date("2026-11-01T11:10:00Z") }).allowed).toBe(true);
  });

  it("drains a37URLbacklog plus10new per day within two healthy daily windows", () => {
    const dates = ["2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"];
    const receipts = GOALIE_DATASETS.slice(0, 3).map(dataset => receipt(dates[0], dataset));
    const options = { now: new Date("2026-11-02T08:30:00Z"),
      days: dates.map(date => ({ date, calendar: "final" as const, allCounts: "complete" as const })), receipts };
    let work = manifest(options);
    expect(work.plannedRequestCount).toBe(47);
    let attempts = 0;
    for (const [index, time] of ["08:30", "11:10", "11:24", "11:38", "11:52", "12:06", "12:20"].entries()) {
      const decision = step(work, { now: new Date(`2026-11-02T${time}:00Z`), budget: { utcDate: "2026-11-02", steps: index, attempts } });
      expect(decision.allowed).toBe(true);
      if (!decision.allowed) throw new Error(decision.reason);
      for (const unit of decision.units) {
        const ack = receipt(unit.date, unit.dataset);
        work = acknowledgeGoalieUnit(work, ack, "complete");
        receipts.push(ack);
        attempts++;
      }
      expect(decision.minIntervalMs).toBe(21000);
    }
    expect(attempts).toBe(42);
    expect(work.units.filter(unit => unit.state === "pending")).toHaveLength(5);
    work = manifest({ ...options, now: new Date("2026-11-03T08:30:00Z"), receipts,
      days: [...options.days, { date: "2026-11-02", calendar: "final", allCounts: "complete" }] });
    expect(work.plannedRequestCount).toBe(15);
    const decision = step(work, { now: new Date("2026-11-03T08:30:00Z"), budget: { utcDate: "2026-11-03", steps: 0, attempts: 0 } });
    expect(decision.allowed).toBe(true);
    if (!decision.allowed) throw new Error(decision.reason);
    for (const unit of decision.units) work = acknowledgeGoalieUnit(work, receipt(unit.date, unit.dataset), "complete");
    expect(work.units.every(unit => unit.state === "complete")).toBe(true);
    expect(decision.units).toHaveLength(15);
  });
});
