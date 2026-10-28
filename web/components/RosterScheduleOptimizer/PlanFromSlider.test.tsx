import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PlanFromSlider, { PLAN_FROM_SETTLE_MS } from "./PlanFromSlider";

afterEach(() => { cleanup(); vi.useRealTimers(); });
// Mon 10-26 … Sun 11-01; today is Tuesday.
const week = Array.from({ length: 7 }, (_, index) => new Date(Date.UTC(2026, 9, 26 + index)).toISOString().slice(0, 10));
const show = (from = "2026-10-27", onChange = vi.fn()) => {
  render(<PlanFromSlider days={week} from={from} min="2026-10-27" max="2026-11-01" onChange={onChange} />);
  return { onChange, slider: screen.getByRole("slider", { name: "Plan from day" }) as HTMLInputElement };
};

describe("Plan-from slider", () => {
  it("snaps over the plan's first day and greys the track left of it", () => {
    const { slider } = show("2026-10-29");
    expect(slider.value).toBe("3");
    expect(slider.getAttribute("aria-valuetext")).toBe("Plan from Thu, Oct 29");
    const wrapper = slider.parentElement!;
    expect(wrapper.getAttribute("data-plan-from")).toBe("2026-10-29");
    expect(wrapper.style.getPropertyValue("--greyed")).toBe("0.5");
    expect(wrapper.style.getPropertyValue("--slider-day-count")).toBe("7");
  });

  it("commits a drag once, on release", () => {
    const { slider, onChange } = show();
    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: "2" } });
    fireEvent.change(slider, { target: { value: "3" } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.pointerUp(slider);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("2026-10-29");
  });

  it("commits keyboard steps once they settle and never before today", () => {
    vi.useFakeTimers();
    const { slider, onChange } = show();
    fireEvent.change(slider, { target: { value: "0" } });
    expect(slider.value).toBe("1");
    fireEvent.change(slider, { target: { value: "4" } });
    fireEvent.change(slider, { target: { value: "5" } });
    act(() => { vi.advanceTimersByTime(PLAN_FROM_SETTLE_MS - 1); });
    expect(onChange).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("2026-10-31");
  });

  it("does nothing when the chosen day is already the plan's first day, and hides when no day is plannable", () => {
    vi.useFakeTimers();
    const { slider, onChange } = show("2026-10-29");
    fireEvent.change(slider, { target: { value: "3" } });
    act(() => { vi.advanceTimersByTime(PLAN_FROM_SETTLE_MS); });
    expect(onChange).not.toHaveBeenCalled();
    cleanup();
    render(<PlanFromSlider days={week} from="2026-11-02" min="2026-11-02" max="2026-11-01" onChange={onChange} />);
    expect(screen.queryByRole("slider")).toBeNull();
  });
});
