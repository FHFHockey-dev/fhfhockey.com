import { describe, expect, it } from "vitest";
import { completeThrough, completeThroughNote, type NightCoverage } from "./completeThrough";

const night = (date: string, observed: number, expected = 8): NightCoverage => ({ date, expected, observed });
const week = [night("2026-10-28", 8), night("2026-10-29", 8), night("2026-10-30", 8), night("2026-10-31", 8), night("2026-11-01", 8), night("2026-11-02", 8)];

describe("complete through", () => {
  it("ends at the night before a late newest night", () => {
    const result = completeThrough([...week.slice(0, 5), night("2026-11-02", 0)], "2026-11-02");
    expect(result).toEqual({ through: "2026-11-01", trimmed: ["2026-11-02"], olderMissing: [] });
    expect(completeThroughNote(result)).toBe("Nov 2 is not fully reported yet, so this card ends Nov 1.");
  });
  it("cuts two late nights, in any order given", () => {
    const result = completeThrough([night("2026-11-02", 2), night("2026-11-01", 6), ...week.slice(0, 4)], "2026-11-02");
    expect(result).toEqual({ through: "2026-10-31", trimmed: ["2026-11-01", "2026-11-02"], olderMissing: [] });
    expect(completeThroughNote(result)).toBe("Nov 1 and Nov 2 are not fully reported yet, so this card ends Oct 31.");
  });
  it("still names an older gap, which blocks export", () => {
    const result = completeThrough([week[0], night("2026-10-29", 6), ...week.slice(2, 5), night("2026-11-02", 0)], "2026-11-02");
    expect(result).toEqual({ through: "2026-11-01", trimmed: ["2026-11-02"], olderMissing: ["2026-10-29"] });
    expect(completeThrough([week[0], night("2026-10-29", 6), ...week.slice(2)], "2026-11-02")).toEqual({ through: "2026-11-02", trimmed: [], olderMissing: ["2026-10-29"] });
  });
  it("leaves a complete window alone, and ignores nights after it", () => {
    const result = completeThrough([...week, night("2026-11-03", 0)], "2026-11-02");
    expect(result).toEqual({ through: "2026-11-02", trimmed: [], olderMissing: [] });
    expect(completeThroughNote(result)).toBeNull();
  });
  it("treats a night with no games as complete, so it can end the card", () => {
    expect(completeThrough([week[0], night("2026-10-29", 0, 0), night("2026-10-30", 3)], "2026-10-30")).toEqual({ through: "2026-10-29", trimmed: ["2026-10-30"], olderMissing: [] });
    expect(completeThrough([night("2026-10-29", 0, 0), night("2026-10-30", 0, 0)], "2026-10-30")).toEqual({ through: "2026-10-30", trimmed: [], olderMissing: [] });
    expect(completeThrough([], "2026-10-30")).toEqual({ through: "2026-10-30", trimmed: [], olderMissing: [] });
  });
  it("has no end date when every night is late", () => {
    const result = completeThrough([night("2026-11-01", 3), night("2026-11-02", 0)], "2026-11-02");
    expect(result).toEqual({ through: null, trimmed: ["2026-11-01", "2026-11-02"], olderMissing: [] });
    expect(completeThroughNote(result)).toBeNull();
  });
});
