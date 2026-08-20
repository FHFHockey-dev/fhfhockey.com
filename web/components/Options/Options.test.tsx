import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Options from "./Options";

afterEach(() => {
  cleanup();
});

describe("Options", () => {
  it("renders named native buttons with pressed state and one activation", () => {
    const onOptionChange = vi.fn();

    render(
      <Options
        ariaLabel="Chart metric"
        option="goals"
        options={[
          { label: "Goals", value: "goals" },
          { label: "Assists", value: "assists" },
        ]}
        onOptionChange={onOptionChange}
      />,
    );

    const group = screen.getByRole("group", { name: "Chart metric" });
    const goals = within(group).getByRole("button", { name: "Goals" });
    const assists = within(group).getByRole("button", { name: "Assists" });

    expect(goals.tagName).toBe("BUTTON");
    expect(goals.getAttribute("aria-pressed")).toBe("true");
    expect(assists.getAttribute("aria-pressed")).toBe("false");

    fireEvent.keyDown(assists, { key: "Enter" });
    fireEvent.click(assists);
    fireEvent.keyUp(assists, { key: "Enter" });

    expect(onOptionChange).toHaveBeenCalledTimes(1);
    expect(onOptionChange).toHaveBeenCalledWith("assists");
  });
});
