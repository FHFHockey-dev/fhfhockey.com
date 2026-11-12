import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { getTeamsMock, getLineCombinationsMock } = vi.hoisted(() => ({
  getTeamsMock: vi.fn(),
  getLineCombinationsMock: vi.fn(),
}));

vi.mock("lib/NHL/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("lib/NHL/server")>()),
  getTeams: getTeamsMock,
}));

vi.mock("components/LineCombinations/utilities", async (importOriginal) => ({
  ...(await importOriginal<typeof import("components/LineCombinations/utilities")>()),
  getLineCombinations: getLineCombinationsMock,
}));

import { Header, getStaticProps } from "pages/lines/[abbreviation]";

afterEach(cleanup);

describe("team lines header", () => {
  it("offers a visible Save image button", () => {
    const onSaveImage = vi.fn();
    render(
      <Header
        teamName="Florida Panthers"
        teamAbbreviation="FLA"
        lastUpdated="2026-10-17T12:00:00.000Z"
        sourceUrl="https://example.invalid/source"
        onSaveImage={onSaveImage}
      />,
    );

    const button = screen.getByRole("button", { name: "Save image" });
    expect(button.getAttribute("type")).toBe("button");
    fireEvent.click(button);
    expect(onSaveImage).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading", { level: 2, name: "Florida Panthers" })).toBeTruthy();
  });

  it("labels the lines as the all-strength legacy grouping (decision 107)", () => {
    render(
      <Header
        teamName="Florida Panthers"
        teamAbbreviation="FLA"
        lastUpdated={null}
        sourceUrl="https://example.invalid/source"
        onSaveImage={vi.fn()}
      />,
    );
    expect(screen.getByText(/grouped by all-strength shared ice time\s+\(legacy view\)/)).toBeTruthy();
  });

  it("hides the updated line instead of inventing a fallback date", () => {
    render(
      <Header
        teamName="Florida Panthers"
        teamAbbreviation="FLA"
        lastUpdated={null}
        sourceUrl="https://example.invalid/source"
        onSaveImage={vi.fn()}
      />,
    );
    expect(screen.queryByText(/Updated/)).toBeNull();
  });
});

describe("team lines getStaticProps", () => {
  const team = { id: 22, abbreviation: "EDM", name: "Edmonton Oilers" };

  it("shows the no-games state only when the team has no game data", async () => {
    getTeamsMock.mockResolvedValue([team]);
    getLineCombinationsMock.mockRejectedValue(
      new Error("Cannot find at least 2 games for team 22"),
    );
    const result = await getStaticProps({ params: { abbreviation: "EDM" } } as any);
    expect(result).toMatchObject({
      props: { lineCombinations: null, loadError: false },
      revalidate: 60,
    });
  });

  it("throws on a query failure so ISR keeps the last good page", async () => {
    getTeamsMock.mockResolvedValue([team]);
    getLineCombinationsMock.mockRejectedValue(
      new Error("canceling statement due to statement timeout"),
    );
    await expect(
      getStaticProps({ params: { abbreviation: "EDM" } } as any),
    ).rejects.toThrow("statement timeout");
  });
});
