import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { AcquisitionPeriod } from "lib/rosterScheduleOptimizer/planningTypes";
import AcquisitionPeriodTimes from "./AcquisitionPeriodTimes";

afterEach(cleanup);
const period: AcquisitionPeriod = { id: "Current week", start: "2026-10-12T00:00:00Z", end: "2026-10-19T00:00:00Z",
  remaining: null, source: "unknown", lineupLockAt: "2026-10-18T23:00:00Z" };
function edit(start = "2026-10-12T03:00", end = "2026-10-19T03:00", timeZone = "America/New_York") {
  fireEvent.change(screen.getByLabelText("Boundary time zone"), { target: { value: timeZone } });
  fireEvent.change(screen.getByLabelText("Exact start"), { target: { value: start } });
  fireEvent.change(screen.getByLabelText("Exact end"), { target: { value: end } });
}
function apply() { fireEvent.click(screen.getByRole("button", { name: "Apply exact boundaries" })); }

it("applies both Monday 03:00 boundaries together without inventing an allowance or losing the lock", () => {
  const onApply = vi.fn();
  render(<AcquisitionPeriodTimes period={period} leagueTimeZone="UTC" onApply={onApply} />);
  fireEvent.click(screen.getByText("Exact period times", { selector: "summary" }));
  edit();
  expect(onApply).not.toHaveBeenCalled();
  apply();
  expect(onApply).toHaveBeenCalledExactlyOnceWith({ ...period, start: "2026-10-12T07:00:00.000Z",
    end: "2026-10-19T07:00:00.000Z", timeZone: "America/New_York", source: "manager" });
});

it.each([
  ["", "2026-10-19T03:00", "America/New_York", /complete local date and time/],
  ["2026-10-12T03:00", "", "America/New_York", /complete local date and time/],
  ["2026-10-12T03:00", "2026-10-19T03:00", "EST", /explicit IANA time zone/],
  ["2026-03-08T02:30", "2026-03-09T03:00", "America/New_York", /does not exist/],
  ["2026-11-01T01:30", "2026-11-02T03:00", "America/New_York", /occurs twice/],
  ["2026-10-19T03:00", "2026-10-12T03:00", "America/New_York", /end must be after/],
  ["2026-10-12T03:00", "2026-10-12T03:00", "America/New_York", /end must be after/],
  ["2026-10-12T03:00", "2026-10-18T03:00", "America/New_York", /existing lineup lock/],
] as const)("keeps the saved period intact for an invalid boundary draft %s / %s / %s", (start, end, zone, message) => {
  const onApply = vi.fn();
  render(<AcquisitionPeriodTimes period={period} leagueTimeZone="UTC" onApply={onApply} />);
  fireEvent.click(screen.getByText("Exact period times", { selector: "summary" }));
  edit(start, end, zone); apply();
  expect(screen.getByRole("alert").textContent).toMatch(message);
  expect(onApply).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Exact start").getAttribute("aria-describedby")).toBe(screen.getByRole("alert").id);
});

it("reopens exact instants in their saved zone independently of the league display zone", () => {
  const saved: AcquisitionPeriod = { ...period, start: "2026-10-26T07:00:00.000Z", end: "2026-11-02T08:00:00.000Z",
    timeZone: "America/New_York", remaining: 2, source: "manager" };
  const onApply = vi.fn();
  const first = render(<AcquisitionPeriodTimes period={saved} leagueTimeZone="UTC" onApply={onApply} />);
  expect(screen.getByLabelText("Boundary time zone")).toHaveProperty("value", "America/New_York");
  expect(screen.getByLabelText("Exact start")).toHaveProperty("value", "2026-10-26T03:00");
  expect(screen.getByLabelText("Exact end")).toHaveProperty("value", "2026-11-02T03:00");
  expect(screen.getByText("Exact period times").closest("details")?.open).toBe(true);
  first.unmount();
  render(<AcquisitionPeriodTimes period={JSON.parse(JSON.stringify(saved))} leagueTimeZone="America/Chicago" onApply={onApply} />);
  apply();
  expect(onApply).toHaveBeenCalledExactlyOnceWith(saved);
});
