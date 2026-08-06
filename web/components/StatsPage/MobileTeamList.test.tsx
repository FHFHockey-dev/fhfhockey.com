import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import MobileTeamList from "./MobileTeamList";

vi.mock("next/image", () => ({
  default: ({
    priority: _priority,
    fill: _fill,
    alt = "",
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & {
    fill?: boolean;
    priority?: boolean;
  }) => React.createElement("img", { ...props, alt }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
});

describe("MobileTeamList", () => {
  it("falls back to the proven local team logo and never constructs default.png", () => {
    render(
      <MobileTeamList
        teams={[
          {
            team_id: 6,
            name: "Boston Bruins",
            abbreviation: "BOS",
          },
          {
            team_id: 999,
            name: "Unknown Team",
            abbreviation: "",
          },
        ]}
        hoveredTeam={null}
        teamsGridState="expanded"
        activeTeamColors={null}
        animationState="resting"
        onTeamMouseEnter={vi.fn()}
        onTeamMouseLeave={vi.fn()}
        generateTeamColorStyles={() => ({})}
      />,
    );

    const bruinsLogo = screen.getByRole("img", { name: "Boston Bruins" });
    expect(bruinsLogo.getAttribute("src")).toBe("/teamLogos/BOS.png");

    fireEvent.error(bruinsLogo);

    expect(
      screen.getByRole("img", { name: "Boston Bruins" }).getAttribute("src"),
    ).toBe("/teamLogos/FHFH.png");
    expect(
      screen.getByRole("img", { name: "Unknown Team" }).getAttribute("src"),
    ).toBe("/teamLogos/FHFH.png");
    expect(document.querySelector('img[src*="default.png"]')).toBeNull();
  });
});
