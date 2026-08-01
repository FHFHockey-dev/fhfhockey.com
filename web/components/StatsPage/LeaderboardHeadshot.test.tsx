import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { getLocalTeamLogoPath } from "lib/images";
import TopMovers from "components/TopMovers/TopMovers";
import LeaderboardHeadshot from "./LeaderboardHeadshot";

afterEach(cleanup);

describe("LeaderboardHeadshot", () => {
  it("uses only validated local team-logo paths and the tracked fallback", () => {
    expect(getLocalTeamLogoPath("bos")).toBe("/teamLogos/BOS.png");
    expect(getLocalTeamLogoPath(null)).toBe("/teamLogos/FHFH.png");
    expect(getLocalTeamLogoPath("default")).toBe("/teamLogos/FHFH.png");
    expect(getLocalTeamLogoPath("../BOS")).toBe("/teamLogos/FHFH.png");
  });

  it("rejects an untrusted database URL and exhausts the bounded fallback sequence", () => {
    render(
      <LeaderboardHeadshot
        imageUrl="https://example.com/untrusted.jpg"
        playerId={42}
        playerName="Test Player"
      />,
    );

    const cmsSource =
      "https://cms.nhl.bamgrid.com/images/headshots/current/168x168/42.jpg";
    expect(
      screen.getByRole("img", { name: "Test Player" }).getAttribute("src"),
    ).toBe(cmsSource);
    expect(
      screen.getByRole("img", { name: "Test Player" }).getAttribute("width"),
    ).toBe("168");
    expect(
      screen.getByRole("img", { name: "Test Player" }).getAttribute("height"),
    ).toBe("168");

    fireEvent.error(screen.getByRole("img", { name: "Test Player" }));
    expect(
      screen.getByRole("img", { name: "Test Player" }).getAttribute("src"),
    ).toBe("/pictures/player-placeholder.jpg");

    fireEvent.error(screen.getByRole("img", { name: "Test Player" }));
    expect(screen.queryByRole("img", { name: "Test Player" })).toBeNull();
  });

  it("resets fallback state when the player source identity changes", () => {
    const { rerender } = render(
      <LeaderboardHeadshot
        imageUrl={null}
        playerId={42}
        playerName="First Player"
      />,
    );

    fireEvent.error(screen.getByRole("img", { name: "First Player" }));
    expect(
      screen.getByRole("img", { name: "First Player" }).getAttribute("src"),
    ).toBe("/pictures/player-placeholder.jpg");

    rerender(
      <LeaderboardHeadshot
        imageUrl="https://assets.nhle.com/mugs/nhl/20252026/43.png"
        playerId={43}
        playerName="Second Player"
      />,
    );

    expect(
      screen.getByRole("img", { name: "Second Player" }).getAttribute("src"),
    ).toBe("https://assets.nhle.com/mugs/nhl/20252026/43.png");
  });
});

describe("TopMovers logo fallback", () => {
  it("uses intrinsic dimensions and replaces a failed source once", () => {
    render(
      <TopMovers
        improved={[
          {
            id: "BOS",
            name: "Boston Bruins",
            logo: "https://example.com/missing.png",
            delta: 2,
          },
        ]}
        degraded={[]}
      />,
    );

    const logo = screen.getByRole("img", { name: "Boston Bruins logo" });
    expect(logo.getAttribute("width")).toBe("28");
    expect(logo.getAttribute("height")).toBe("28");

    fireEvent.error(logo);
    expect(logo.getAttribute("src")).toBe("/teamLogos/FHFH.png");
  });
});
