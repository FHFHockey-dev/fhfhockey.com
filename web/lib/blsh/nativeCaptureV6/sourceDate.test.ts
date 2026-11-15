// @vitest-environment node
import { describe, expect, it } from "vitest";
import { selectSourceDate } from "./sourceDate";

const at = (iso: string) => selectSourceDate(Date.parse(iso));

describe("v6 source-date and window gates (clock only)", () => {
  it("selects yesterday's UTC date inside [12:00Z, 12:30Z)", () => {
    expect(at("2026-11-20T12:00:00.000Z")).toEqual({ ok: true, captureDateUTC: "2026-11-20", sourceDate: "2026-11-19" });
    expect(at("2026-11-20T12:05:00.000Z")).toMatchObject({ ok: true, sourceDate: "2026-11-19" });
    expect(at("2026-11-20T12:29:59.999Z")).toMatchObject({ ok: true, sourceDate: "2026-11-19" });
  });

  it("refuses the window edges outside [12:00Z, 12:30Z)", () => {
    expect(at("2026-11-20T11:59:59.999Z")).toEqual({ ok: false, reason: "outside_window" });
    expect(at("2026-11-20T12:30:00.000Z")).toEqual({ ok: false, reason: "outside_window" });
    expect(at("2026-11-20T00:05:00.000Z")).toEqual({ ok: false, reason: "outside_window" });
  });

  it("fences off the 11-17 pilot and the 11-18 fallback, even inside the window", () => {
    for (const day of ["2026-11-15", "2026-11-17", "2026-11-18"]) expect(at(`${day}T12:05:00.000Z`)).toEqual({ ok: false, reason: "pilot_fence" });
    expect(at("2026-11-19T12:05:00.000Z")).toMatchObject({ ok: true, sourceDate: "2026-11-18" });
  });

  it("rolls over months and years", () => {
    expect(at("2026-12-01T12:05:00.000Z")).toMatchObject({ ok: true, sourceDate: "2026-11-30" });
    expect(at("2027-01-01T12:05:00.000Z")).toMatchObject({ ok: true, sourceDate: "2026-12-31" });
    expect(at("2027-03-01T12:05:00.000Z")).toMatchObject({ ok: true, sourceDate: "2027-02-28" });
  });

  it("refuses outside the season bounds and on an invalid clock", () => {
    expect(at("2027-06-30T12:05:00.000Z")).toMatchObject({ ok: true, sourceDate: "2027-06-29" });
    expect(at("2027-07-01T12:05:00.000Z")).toEqual({ ok: false, reason: "outside_season" });
    expect(selectSourceDate(Number.NaN)).toEqual({ ok: false, reason: "invalid_clock" });
  });
});
