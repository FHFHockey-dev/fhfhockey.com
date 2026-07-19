import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import NewsCard from "./NewsCard";

vi.mock("next/legacy/image", () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

describe("NewsCard", () => {
  it("shows useful details and an accessible original-post icon in rail mode", () => {
    render(
      <NewsCard
        compact
        rail
        item={
          {
            headline: "Pavel Mintyukov news update",
            blurb:
              "RT @FriedgeHNIC: Hearing Pavel Mintyukov and Anaheim are getting an extension done.",
            category: "NEWS UPDATE",
            subcategory: "CONTRACT NEGOTIATION",
            team_abbreviation: "ANA",
            source_label: "Elliotte Friedman",
            source_account: "@FriedgeHNIC",
            source_url: "https://x.com/FriedgeHNIC/status/2073877758803935434",
            published_at: "2026-07-14T18:19:20.000Z",
            created_at: "2026-07-14T18:19:20.000Z",
            card_status: "published",
            metadata: null,
            players: [
              {
                player_name: "Pavel Mintyukov",
              },
            ],
          } as any
        }
      />,
    );

    expect(
      screen.getByText(
        "Hearing Pavel Mintyukov and Anaheim are getting an extension done.",
      ),
    ).toBeTruthy();
    const sourceLink = screen.getByRole("link", {
      name: "View original post for Pavel Mintyukov news update",
    });
    expect(sourceLink.getAttribute("href")).toBe(
      "https://x.com/FriedgeHNIC/status/2073877758803935434",
    );
    expect(sourceLink.getAttribute("target")).toBe("_blank");
    expect(screen.queryByText("Source")).toBeNull();
    expect(screen.getByText("7/14/2026, 2:19:20 PM")).toBeTruthy();
  });
});
