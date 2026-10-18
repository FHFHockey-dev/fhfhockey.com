import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Header } from "pages/lines/[abbreviation]";

afterEach(cleanup);

describe("team lines header", () => {
  it("offers the logo image download as a named keyboard-reachable button", () => {
    const onTeamLogoClick = vi.fn();
    render(
      <Header
        teamName="Florida Panthers"
        teamAbbreviation="FLA"
        lastUpdated="2026-10-17T12:00:00.000Z"
        sourceUrl="https://example.invalid/source"
        onTeamLogoClick={onTeamLogoClick}
      />,
    );

    const button = screen.getByRole("button", { name: "Download Florida Panthers line combinations image" });
    expect(button.getAttribute("type")).toBe("button");
    fireEvent.click(button);
    expect(onTeamLogoClick).toHaveBeenCalledTimes(1);
  });
});
