import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Header } from "pages/lines/[abbreviation]";

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
