import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import PlayerCardPreview, { cardPng } from "./PlayerCardPreview";
import { fixtureSnapshot } from "../../lib/player-cards/fixtures";
import { PLAYER_CARD_CAPABILITIES } from "../../lib/player-cards/contracts";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("synthetic player-card preview", () => {
  it("includes essential card context and a prominent synthetic label", () => {
    const { container } = render(<PlayerCardPreview />);
    const card = container.querySelector("svg")!;
    expect(card.textContent).toContain("SYNTHETIC EXAMPLE");
    for (const text of ["OPPORTUNITY", "INDIVIDUAL GENERATION", "ON-ICE CONTEXT", "FINISHING & INVOLVEMENT", "10 of 10 GP", "213.5 min TOI", "Game cutoff", "Snapshot", "no GP, TOI or position filter"])
      expect(card.textContent).toContain(text);
    expect(card.getAttribute("aria-label")).toContain("rank");
    expect(card.textContent).not.toContain("Download");
    expect(Object.values(PLAYER_CARD_CAPABILITIES).every(value => !value)).toBe(true);
  });
  it("changes scenario and optional card without dropping missing-data explanations", () => {
    const { container } = render(<PlayerCardPreview />);
    fireEvent.change(screen.getByLabelText("Example scenario"), { target: { value: "missing" } });
    expect(container.querySelector("svg")!.textContent).toContain("Value and rank unavailable");
    expect(container.querySelector("svg")!.textContent).toContain("Rank unavailable · coverage incomplete");
    fireEvent.change(screen.getByLabelText("Example scenario"), { target: { value: "partial" } });
    expect(container.querySelector("svg")!.textContent).toContain("3 of 10 appearances");
    fireEvent.change(screen.getByLabelText("Card content · proposed"), { target: { value: "extra" } });
    expect(container.querySelector("svg")!.textContent).toContain("On-ice CF/60");
  });
  it("searches only synthetic identities and shows no-results feedback", () => {
    render(<PlayerCardPreview />);
    fireEvent.change(screen.getByLabelText("Search example players"), { target: { value: "unmatched" } });
    expect(screen.getByText("No example players found.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Search example players"), { target: { value: "Alex" } });
    fireEvent.click(screen.getByRole("button", { name: "Alex Morgan · Example Hockey Club · RW" }));
    expect((screen.getByLabelText("Search example players") as HTMLInputElement).value).toBe("");
  });
  it("rejects mismatched snapshots before rasterizing", async () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    await expect(cardPng(svg, fixtureSnapshot())).rejects.toThrow("displayed snapshot changed");
  });
  it("reports export failure and allows retry", async () => {
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:example"), revokeObjectURL: vi.fn() });
    vi.stubGlobal("Image", class { onerror: (() => void) | null = null; set src(_value: string) { queueMicrotask(() => this.onerror?.()); } });
    render(<PlayerCardPreview />);
    fireEvent.click(screen.getByRole("button", { name: "Download example PNG" }));
    await waitFor(() => expect(screen.getByText("The card could not be rendered. Please retry.")).toBeTruthy());
    expect((screen.getByRole("button", { name: "Download example PNG" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Download example PNG" }));
    await waitFor(() => expect(screen.getByText("The card could not be rendered. Please retry.")).toBeTruthy());
  });
});
