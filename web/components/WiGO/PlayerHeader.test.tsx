import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import PlayerHeader from "./PlayerHeader";
import { defaultColors, type Player } from "./types";

vi.mock("next/image", () => ({ default: ({ fill, sizes, priority, ...props }: any) => <img {...props} /> }));
afterEach(cleanup);

const player = { id: 1, fullName: "Test Player" } as Player;
const props = {
  selectedPlayer: player, headshotUrl: "/headshot.png", teamName: "Team One",
  teamAbbreviation: "ONE", teamColors: defaultColors, placeholderImage: "/placeholder.png"
};

describe("PlayerHeader image fallbacks", () => {
  it("replaces a failed headshot with an accurately labeled placeholder", () => {
    render(<PlayerHeader {...props} />);
    fireEvent.error(screen.getByAltText("Test Player headshot"));
    expect(screen.getByAltText("Placeholder headshot").getAttribute("src")).toBe("/placeholder.png");
  });

  it("allows the next player's image after an earlier failure", () => {
    const { rerender } = render(<PlayerHeader {...props} />);
    fireEvent.error(screen.getByAltText("Test Player headshot"));
    rerender(<PlayerHeader {...props} selectedPlayer={{ ...player, id: 2, fullName: "Next Player" }} headshotUrl="/next.png" />);
    expect(screen.getByAltText("Next Player headshot").getAttribute("src")).toBe("/next.png");
  });

  it("replaces a failed logo and allows a different team logo", () => {
    const { rerender } = render(<PlayerHeader {...props} />);
    fireEvent.error(screen.getByAltText("Team One logo"));
    expect(screen.getByText("No Logo")).toBeTruthy();
    rerender(<PlayerHeader {...props} teamName="Team Two" teamAbbreviation="TWO" />);
    expect(screen.getByAltText("Team Two logo").getAttribute("src")).toBe("/teamLogos/TWO.png");
  });

  it("handles missing team and image without broken requests", () => {
    render(<PlayerHeader {...props} headshotUrl={null} teamAbbreviation={null} />);
    expect(screen.getByText("No Logo")).toBeTruthy();
    expect(screen.getByAltText("Placeholder headshot").getAttribute("src")).toBe("/placeholder.png");
    expect(screen.queryByAltText("Team One logo")).toBeNull();
  });
});
