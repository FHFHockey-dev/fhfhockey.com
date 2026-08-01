import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Switch from "./Switch";
import Toggle from "./Toggle";

afterEach(cleanup);

describe("Game Grid shared switch controls", () => {
  it("exposes Switch state and supports pointer, Enter, and Space activation", () => {
    const onClick = vi.fn();

    render(<Switch checked aria-label="Sort direction" onClick={onClick} />);

    const control = screen.getByRole("switch", { name: "Sort direction" });
    expect(control.getAttribute("aria-checked")).toBe("true");

    fireEvent.click(control);
    fireEvent.keyDown(control, { key: "Enter" });
    fireEvent.keyDown(control, { key: " " });

    expect(onClick).toHaveBeenCalledTimes(3);
    expect(fireEvent.keyDown(control, { key: "Enter", repeat: true })).toBe(
      false,
    );
    expect(fireEvent.keyDown(control, { key: " ", repeat: true })).toBe(false);
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("puts Toggle labeling and state on its actual focusable switch", () => {
    const onChange = vi.fn();

    render(
      <Toggle
        checked={false}
        aria-label="Hide preseason games"
        onChange={onChange}
      />,
    );

    const control = screen.getByRole("switch", {
      name: "Hide preseason games",
    });
    expect(control.getAttribute("aria-checked")).toBe("false");

    fireEvent.click(control);
    fireEvent.keyDown(control, { key: "Enter" });
    fireEvent.keyDown(control, { key: " " });

    expect(onChange).toHaveBeenCalledTimes(3);
    expect(fireEvent.keyDown(control, { key: "Enter", repeat: true })).toBe(
      false,
    );
    expect(fireEvent.keyDown(control, { key: " ", repeat: true })).toBe(false);
    expect(onChange).toHaveBeenCalledTimes(3);
  });
});
