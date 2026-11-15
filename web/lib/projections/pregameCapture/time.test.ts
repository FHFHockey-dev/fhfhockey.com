import { describe, expect, it } from "vitest";
import { formatMicros, latestInstant, parseInstantMicros } from "./time";
import { ackQualifies, decideStart, effectiveStartMicros } from "./deadline";

describe("parseInstantMicros", () => {
  it("treats equivalent offsets as the same instant", () => {
    const utc = parseInstantMicros("2026-11-15T00:00:00Z");
    expect(parseInstantMicros("2026-11-14T19:00:00-05:00")).toBe(utc);
    expect(parseInstantMicros("2026-11-15T05:30:00+0530")).toBe(utc);
    expect(parseInstantMicros("2026-11-15 00:00:00+00")).toBe(utc);
  });

  it("keeps sub-second precision that string order and Date.parse lose", () => {
    const a = parseInstantMicros("2026-11-15T00:00:00.000001Z");
    const b = parseInstantMicros("2026-11-15T00:00:00.0000009Z", "ceil");
    expect(a > parseInstantMicros("2026-11-15T00:00:00Z")).toBe(true);
    expect(b).toBe(a); // ceil keeps an upper bound conservative
    expect(parseInstantMicros("2026-11-15T00:00:00.0000009Z")).toBe(parseInstantMicros("2026-11-15T00:00:00Z"));
  });

  it("orders instants where string comparison is wrong", () => {
    // Lexically "...00:30:00+01:00" > "...00:15:00Z", yet it is 23:30Z the previous day.
    const texts = ["2026-11-15T00:30:00+01:00", "2026-11-15T00:15:00Z"];
    expect(texts[0] > texts[1]).toBe(true);
    expect(latestInstant(texts, "2026-11-14T00:00:00Z")).toBe("2026-11-15T00:15:00Z");
  });

  it("rolls over UTC midnight and month/year ends", () => {
    expect(formatMicros(parseInstantMicros("2026-12-31T19:30:00.5-05:00"))).toBe("2027-01-01T00:30:00.500000Z");
    expect(() => parseInstantMicros("2026-02-29T00:00:00Z")).toThrow();
  });

  it("rejects instants without an explicit offset", () => {
    expect(() => parseInstantMicros("2026-11-15T00:00:00")).toThrow();
    expect(() => parseInstantMicros("2026-11-15")).toThrow();
  });
});

describe("deadline policy", () => {
  const start = "2026-11-15T00:00:00Z";
  const t60 = parseInstantMicros("2026-11-14T23:00:00Z");

  it("accepts an acknowledgement exactly at T−60 and refuses one microsecond later", () => {
    expect(ackQualifies(t60, { scheduledStart: start })).toBe(true);
    expect(ackQualifies(t60 + 1n, { scheduledStart: start })).toBe(false);
  });

  it("tightens on an earlier reschedule or actual start", () => {
    const clocks = { scheduledStart: start, currentScheduledStart: "2026-11-14T18:30:00-05:00" };
    expect(effectiveStartMicros(clocks)).toBe(parseInstantMicros("2026-11-14T23:30:00Z"));
    expect(ackQualifies(t60, clocks)).toBe(false);
    expect(ackQualifies(t60, { scheduledStart: start, actualStart: "2026-11-14T23:59:00Z" })).toBe(false);
  });

  it("refuses late starts and starts without time for read + save + verify", () => {
    const base = { readMs: 60_000, saveMs: 10_000, verifyMs: 10_000, marginMs: 30_000 };
    expect(decideStart({ scheduledStart: start }, { ...base, nowUpper: t60 })).toMatchObject({ ok: false, reason: "late_start" });
    expect(decideStart({ scheduledStart: start }, { ...base, nowUpper: t60 - 100_000_000n })).toMatchObject({ ok: false, reason: "insufficient_time" });
    expect(decideStart({ scheduledStart: start }, { ...base, nowUpper: t60 - 110_000_000n })).toMatchObject({ ok: true, slackMicros: 0n });
  });
});
