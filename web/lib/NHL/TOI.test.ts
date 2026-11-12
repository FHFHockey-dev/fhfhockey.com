import { describe, expect, it } from "vitest";

import { parseTime } from "./TOI";

// W2-3 A5: NST serves whole-minute TOI ("20"); the old parser read it as NaN
// and callers' `|| 0` showed 0 minutes.
describe("parseTime", () => {
  it("parses whole minutes, decimal minutes and mm:ss", () => {
    expect(parseTime("20")).toBe(20);
    expect(parseTime("20.5")).toBe(20.5);
    expect(parseTime("20:30")).toBe(20.5);
    expect(parseTime("0")).toBe(0);
  });

  it("returns NaN (unknown), never a number, for unknown time", () => {
    expect(parseTime("")).toBeNaN();
    expect(parseTime("-")).toBeNaN();
    expect(parseTime(undefined)).toBeNaN();
    expect(parseTime("20:75")).toBeNaN();
  });
});
