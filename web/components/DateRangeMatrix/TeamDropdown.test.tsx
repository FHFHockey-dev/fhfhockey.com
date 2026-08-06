import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TeamDropdown from "./TeamDropdown";

afterEach(() => cleanup());

describe("TeamDropdown", () => {
  it("forwards native labels and ARIA props while preserving both style classes", () => {
    render(
      <>
        <label htmlFor="team-choice">Team</label>
        <p id="team-help">Choose one NHL team.</p>
        <TeamDropdown
          id="team-choice"
          name="team"
          aria-describedby="team-help"
          aria-required="true"
          className="provided-select-class"
          selectedTeam="EDM"
          onSelect={vi.fn()}
        />
      </>,
    );

    const select = screen.getByLabelText("Team") as HTMLSelectElement;
    expect(select.id).toBe("team-choice");
    expect(select.name).toBe("team");
    expect(select.getAttribute("aria-describedby")).toBe("team-help");
    expect(select.getAttribute("aria-required")).toBe("true");
    expect(select.className).toContain("provided-select-class");
    expect(select.className.split(/\s+/)).toHaveLength(2);
  });

  it("keeps native keyboard focus and emits canonical or empty selections", () => {
    const onSelect = vi.fn();
    const { rerender } = render(
      <TeamDropdown
        aria-label="Opponent team"
        selectedTeam=""
        onSelect={onSelect}
      />,
    );

    const select = screen.getByLabelText("Opponent team") as HTMLSelectElement;
    select.focus();
    fireEvent.keyDown(select, { key: "ArrowDown" });
    expect(document.activeElement).toBe(select);

    fireEvent.change(select, { target: { value: "EDM" } });
    expect(onSelect).toHaveBeenLastCalledWith("EDM");
    rerender(
      <TeamDropdown
        aria-label="Opponent team"
        selectedTeam="EDM"
        onSelect={onSelect}
      />,
    );
    expect(select.value).toBe("EDM");

    fireEvent.change(select, { target: { value: "" } });
    expect(onSelect).toHaveBeenLastCalledWith("");
  });
});
