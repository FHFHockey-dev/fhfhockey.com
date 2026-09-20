import { describe, expect, it } from "vitest";
import { formatHeight, formatWeight, formatPosition, getAge } from "./playerBiography";

describe("player biography", () => {
  it.each([
    ["2026-06-14", 25], ["2026-06-15", 26], ["2026-06-16", 26]
  ])("calculates age on UTC date %s", (date, age) => {
    expect(getAge("2000-06-15", new Date(`${date}T00:00:00Z`))).toBe(age);
  });
  it("uses March 1 for leap-day birthdays in non-leap years", () => {
    expect(getAge("2000-02-29", new Date("2025-02-28T23:59:59Z"))).toBe(24);
    expect(getAge("2000-02-29", new Date("2025-03-01T00:00:00Z"))).toBe(25);
    expect(getAge("2000-02-29", new Date("2024-02-29T00:00:00Z"))).toBe(24);
  });
  it.each([null, undefined, "", "invalid", "2000-02-30", "2001-02-29", "2030-01-01"])(
    "rejects invalid or future birth date %s", birth => {
      expect(getAge(birth, new Date("2026-01-01T00:00:00Z"))).toBe("—");
    }
  );
  it("converts documented metric measurements and carries inches into feet", () => {
    expect(formatHeight(182)).toBe('6\' 0"');
    expect(formatHeight(180)).toBe('5\' 11"');
    expect(formatWeight(78)).toBe("172 lbs");
  });
  it.each([null, undefined, 0, -1, NaN, Infinity])("rejects missing or invalid measurement %s", value => {
    expect(formatHeight(value)).toBe("—");
    expect(formatWeight(value)).toBe("—");
  });
  it("shows only recognized positions", () => {
    expect(formatPosition("RW")).toBe("RW");
    expect(formatPosition("C")).toBe("C");
    expect(formatPosition("unknown")).toBe("—");
    expect(formatPosition(null)).toBe("—");
  });
});
