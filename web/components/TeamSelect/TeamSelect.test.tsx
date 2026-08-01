import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TeamSelect from "./TeamSelect";

vi.mock("next/legacy/image", () => ({
  default: ({ alt }: { alt: string }) => <span data-image-alt={alt} />,
}));

vi.mock("lib/NHL/server", () => ({
  getTeamLogo: (abbreviation: string) => `/logos/${abbreviation}.png`,
}));

afterEach(() => cleanup());

const teams = [
  { abbreviation: "EDM", name: "Edmonton Oilers" },
  { abbreviation: "TOR", name: "Toronto Maple Leafs" },
];

describe("TeamSelect", () => {
  it("labels the team group and exposes one pressed native team button", () => {
    const { rerender } = render(
      <TeamSelect teams={teams} team="EDM" onTeamChange={vi.fn()} />,
    );

    expect(
      screen.getByRole("group", { name: "Team selection" }),
    ).not.toBeNull();
    expect(
      screen.getByRole("group", { name: "Available teams" }),
    ).not.toBeNull();

    const previous = screen.getByRole("button", {
      name: "Show previous teams",
    });
    const next = screen.getByRole("button", { name: "Show next teams" });
    const edmonton = screen.getByRole("button", {
      name: "Select Edmonton Oilers",
    });
    const toronto = screen.getByRole("button", {
      name: "Select Toronto Maple Leafs",
    });

    for (const button of [previous, next, edmonton, toronto]) {
      expect(button.getAttribute("type")).toBe("button");
    }
    expect(edmonton.getAttribute("aria-pressed")).toBe("true");
    expect(toronto.getAttribute("aria-pressed")).toBe("false");

    rerender(<TeamSelect teams={teams} team="TOR" onTeamChange={vi.fn()} />);
    expect(edmonton.getAttribute("aria-pressed")).toBe("false");
    expect(toronto.getAttribute("aria-pressed")).toBe("true");
  });

  it("preserves focusable selection and labeled scroll behavior", () => {
    const onTeamChange = vi.fn();
    render(<TeamSelect teams={teams} team="EDM" onTeamChange={onTeamChange} />);

    const logos = screen.getByRole("group", { name: "Available teams" });
    const scrollBy = vi.fn();
    Object.defineProperty(logos, "scrollBy", {
      configurable: true,
      value: scrollBy,
    });

    const previous = screen.getByRole("button", {
      name: "Show previous teams",
    });
    previous.focus();
    fireEvent.keyDown(previous, { key: "Enter" });
    expect(document.activeElement).toBe(previous);
    fireEvent.click(previous);
    expect(scrollBy).toHaveBeenLastCalledWith({ left: -180 });

    fireEvent.click(screen.getByRole("button", { name: "Show next teams" }));
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 180 });

    const toronto = screen.getByRole("button", {
      name: "Select Toronto Maple Leafs",
    });
    toronto.focus();
    fireEvent.keyDown(toronto, { key: " " });
    expect(document.activeElement).toBe(toronto);
    fireEvent.click(toronto);
    expect(onTeamChange).toHaveBeenCalledWith("TOR");
  });
});
