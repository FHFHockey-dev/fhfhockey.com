import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Select from "./Select";

afterEach(() => {
  cleanup();
});

describe("Select", () => {
  it("uses a named native select and reports the chosen value", () => {
    const onOptionChange = vi.fn();

    render(
      <Select
        ariaLabel="Sort players"
        option="points"
        options={[
          { label: "Points", value: "points" },
          { label: "Goals", value: "goals" },
        ]}
        onOptionChange={onOptionChange}
      />,
    );

    const select = screen.getByRole("combobox", { name: "Sort players" });

    expect(select.tagName).toBe("SELECT");
    expect((select as HTMLSelectElement).value).toBe("points");
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Points",
      "Goals",
    ]);

    fireEvent.change(select, { target: { value: "goals" } });

    expect(onOptionChange).toHaveBeenCalledTimes(1);
    expect(onOptionChange).toHaveBeenCalledWith("goals");
  });
});
