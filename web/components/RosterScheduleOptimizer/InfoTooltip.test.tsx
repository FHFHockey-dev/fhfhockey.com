import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import InfoTooltip from "./InfoTooltip";

afterEach(cleanup);
describe("RSO routine guidance", () => {
  it("opens on focus and dismisses repeatedly with Escape without moving focus", () => {
    render(<InfoTooltip label="About GP">Scheduled opportunities, not confirmed starts.</InfoTooltip>);
    const trigger = screen.getByRole("button", { name: "About GP" });
    for (let i = 0; i < 2; i++) {
      fireEvent.focus(trigger);
      const tooltip = screen.getByRole("tooltip");
      expect(trigger.getAttribute("aria-describedby")).toBe(tooltip.id);
      fireEvent.keyDown(document, { key: "Escape" });
      expect(screen.queryByRole("tooltip")).toBeNull();
      fireEvent.mouseEnter(trigger);
      expect(screen.queryByRole("tooltip")).toBeNull();
      fireEvent.blur(trigger);
    }
  });
  it("pins on tap, closes on another tap or outside pointer, and reopens", () => {
    render(<InfoTooltip label="About DUST">Evaluated bench games.</InfoTooltip>);
    const trigger = screen.getByRole("button", { name: "About DUST" });
    fireEvent.click(trigger);
    expect(screen.getByRole("tooltip")).toBeTruthy();
    fireEvent.click(trigger);
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.click(trigger);
    expect(screen.getByRole("tooltip")).toBeTruthy();
  });
  it("keeps hovered content open while the pointer moves onto it", () => {
    render(<InfoTooltip label="About points">Uses the selected scoring.</InfoTooltip>);
    const trigger = screen.getByRole("button", { name: "About points" });
    fireEvent.mouseEnter(trigger);
    const tooltip = screen.getByRole("tooltip");
    fireEvent.mouseLeave(trigger, { relatedTarget: tooltip });
    expect(screen.getByRole("tooltip")).toBeTruthy();
    fireEvent.mouseLeave(tooltip, { relatedTarget: document.body });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
