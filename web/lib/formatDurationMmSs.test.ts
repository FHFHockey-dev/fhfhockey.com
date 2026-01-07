import { describe, expect, it } from "vitest";
import { formatDurationMsToMMSS } from "lib/formatDurationMmSs";

describe("formatDurationMsToMMSS", () => {
  it("formats ms as MM:SS (floors seconds)", () => {
    expect(formatDurationMsToMMSS(0)).toBe("00:00");
    expect(formatDurationMsToMMSS(999)).toBe("00:00");
    expect(formatDurationMsToMMSS(1000)).toBe("00:01");
    expect(formatDurationMsToMMSS(61_962)).toBe("01:01");
    expect(formatDurationMsToMMSS(161_962)).toBe("02:41");
  });
});

