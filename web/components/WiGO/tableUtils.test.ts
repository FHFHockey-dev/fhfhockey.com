import { describe, expect, it } from "vitest";

import type { TableAggregateData } from "./types";
import { computeDiffColumn, formatCell } from "./tableUtils";

describe("computeDiffColumn", () => {
  it("computes per-game diffs for count stats using GP context", () => {
    const rows: TableAggregateData[] = [
      { label: "GP", STD: 20, CA: 10 },
      { label: "Goals", STD: 20, CA: 5 }
    ];

    const withDiff = computeDiffColumn(rows, "STD", "CA");
    const goalsRow = withDiff.find((row) => row.label === "Goals");

    expect(goalsRow?.DIFF).toBeCloseTo(100);
  });

  it("computes direct diffs for rate and percentage stats", () => {
    const rows: TableAggregateData[] = [
      { label: "S%", STD: 15, CA: 10 },
      { label: "ATOI", STD: 930, CA: 900 }
    ];

    const withDiff = computeDiffColumn(rows, "STD", "CA");

    expect(withDiff.find((row) => row.label === "S%")?.DIFF).toBeCloseTo(50);
    expect(withDiff.find((row) => row.label === "ATOI")?.DIFF).toBeCloseTo(
      3.333333,
      4
    );
  });
});

describe("formatCell", () => {
  it("formats time and percentage values from normalized data", () => {
    expect(formatCell({ label: "ATOI", STD: 930 }, "STD")).toBe("15:30");
    expect(formatCell({ label: "PPTOI", STD: 75 }, "STD")).toBe("01:15");
    expect(formatCell({ label: "IPP", STD: 58.62 }, "STD")).toBe("58.6%");
  });

  it("formats integer, decimal, and per-60 values consistently", () => {
    expect(formatCell({ label: "Goals", STD: 12.4 }, "STD")).toBe("12");
    expect(formatCell({ label: "ixG", STD: 9.44 }, "STD")).toBe("9.4");
    expect(formatCell({ label: "PTS/60", STD: 2.456 }, "STD")).toBe("2.46");
  });
});

describe("DIFF boundary cases", () => {
  it("keeps zero, unavailable baselines, equal selections and direction distinct", () => {
    const data: TableAggregateData[] = [
      { label: "GP", STD: 10, CA: 20 },
      { label: "Goals", STD: 0, CA: 0 },
      { label: "Assists", STD: 5, CA: 0 },
      { label: "SOG", STD: 10, CA: 40 },
      { label: "IPP", STD: null, CA: 40 },
      { label: "S%", STD: Infinity, CA: 10 },
    ];
    expect(computeDiffColumn(data, "STD", "CA").map(row => row.DIFF)).toEqual([undefined, 0, undefined, -50, undefined, undefined]);
    expect(computeDiffColumn(data, "STD", "STD")[3].DIFF).toBe(0);
    expect(data[3].DIFF).toBeUndefined();
    expect(formatCell({ label: "Goals", STD: 0 }, "STD")).toBe("0");
    expect(formatCell({ label: "Goals", STD: null }, "STD")).toBe("-");
  });
});
