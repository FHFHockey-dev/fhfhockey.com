import { fireEvent, render, screen } from "@testing-library/react";
import { getImageProps } from "next/image";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

import type { PlayoffBracketSeries } from "lib/NHL/server/playoffBracket";

import HomepagePlayoffBracket from "./HomepagePlayoffBracket";

vi.mock("next/link", () => ({
  default: ({ href, className, children }: any) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", async () => {
  const actual =
    await vi.importActual<typeof import("next/image")>("next/image");

  return {
    ...actual,
    default: ({ priority, fill: _fill, unoptimized, ...props }: any) =>
      createElement("img", {
        ...props,
        loading: props.loading ?? (priority ? "eager" : "lazy"),
        "data-unoptimized": unoptimized ? "true" : undefined,
      }),
  };
});

function makeSeries(
  overrides: Partial<PlayoffBracketSeries>,
): PlayoffBracketSeries {
  return {
    seriesTitle: "Round One",
    seriesAbbrev: "R1",
    seriesLetter: "E",
    playoffRound: 1,
    topSeedRank: 1,
    topSeedRankAbbrev: "1C",
    topSeedWins: 0,
    bottomSeedRank: 8,
    bottomSeedRankAbbrev: "WC2",
    bottomSeedWins: 0,
    ...overrides,
  };
}

describe("HomepagePlayoffBracket image contracts", () => {
  it("uses source-aware intrinsic dimensions and the production optimizer path", () => {
    render(
      <HomepagePlayoffBracket
        currentDate="2026-04-21"
        games={[]}
        playoffWeekGames={[]}
        playoffBracket={{
          bracketLogo:
            "https://assets.nhle.com/logos/playoffs/png/scp-20242025-horizontal-banner-en.png",
          series: [
            makeSeries({
              seriesLetter: "E",
              topSeedTeam: { id: 1, abbrev: "BOS" },
              bottomSeedTeam: { id: 2, abbrev: "NYR" },
            }),
            makeSeries({
              seriesTitle: "Eastern Conference Final",
              seriesAbbrev: "CF",
              seriesLetter: "M",
              playoffRound: 3,
              seriesLogo:
                "https://assets.nhle.com/logos/playoffs/png/ecf-wordmark-en.png",
            }),
            makeSeries({
              seriesTitle: "Stanley Cup Final",
              seriesAbbrev: "SCF",
              seriesLetter: "O",
              playoffRound: 4,
              seriesLogo:
                "https://assets.nhle.com/logos/playoffs/png/SCP%20Logo.png",
            }),
          ],
        }}
      />,
    );

    const bracketLogo = screen.getByRole("img", {
      name: "Stanley Cup Playoffs bracket",
    });
    expect(bracketLogo.getAttribute("width")).toBe("1993");
    expect(bracketLogo.getAttribute("height")).toBe("266");
    expect(bracketLogo.getAttribute("sizes")).toBe(
      "(max-width: 540px) 78vw, 420px",
    );
    expect(bracketLogo.getAttribute("data-unoptimized")).toBeNull();
    expect(bracketLogo.getAttribute("loading")).toBe("lazy");

    const conferenceLogo = screen.getByRole("img", {
      name: "Eastern Conference Final",
    });
    expect(conferenceLogo.getAttribute("width")).toBe("883");
    expect(conferenceLogo.getAttribute("height")).toBe("251");
    expect(conferenceLogo.getAttribute("sizes")).toBe("120px");
    expect(conferenceLogo.getAttribute("data-unoptimized")).toBeNull();

    const cupLogo = screen.getByRole("img", {
      name: "Stanley Cup Final",
    });
    expect(cupLogo.getAttribute("width")).toBe("361");
    expect(cupLogo.getAttribute("height")).toBe("537");
    expect(cupLogo.getAttribute("sizes")).toBe("120px");

    const bostonLogo = screen.getByRole("img", { name: "BOS logo" });
    expect(bostonLogo.getAttribute("width")).toBe("48");
    expect(bostonLogo.getAttribute("height")).toBe("32");

    fireEvent.error(conferenceLogo);
    expect(
      screen
        .getByRole("img", { name: "Eastern Conference Final" })
        .getAttribute("src"),
    ).toBe("https://assets.nhle.com/logos/nhl/svg/NHL_light.svg");
  });

  it("offers smaller optimizer candidates at the capped display widths", () => {
    const sizedBracket = getImageProps({
      src: "/test-bracket.png",
      alt: "",
      width: 1993,
      height: 266,
      sizes: "(max-width: 540px) 78vw, 420px",
    }).props.srcSet;
    const unsizedBracket = getImageProps({
      src: "/test-bracket.png",
      alt: "",
      width: 1993,
      height: 266,
    }).props.srcSet;
    const sizedSeries = getImageProps({
      src: "/test-series.png",
      alt: "",
      width: 883,
      height: 251,
      sizes: "120px",
    }).props.srcSet;
    const unsizedSeries = getImageProps({
      src: "/test-series.png",
      alt: "",
      width: 883,
      height: 251,
    }).props.srcSet;

    expect(sizedBracket).toContain("w=640");
    expect(unsizedBracket).not.toContain("w=640");
    expect(sizedSeries).toContain("w=128");
    expect(unsizedSeries).not.toContain("w=128");
  });

  it("uses the fallback asset instead of requesting HOME or AWAY sentinel logos", () => {
    const { container } = render(
      <HomepagePlayoffBracket
        currentDate="2026-04-21"
        games={[]}
        playoffBracket={{ series: [] }}
        playoffWeekGames={[
          {
            id: 42,
            scheduleDate: "2026-04-21",
            gameState: "FUT",
          },
        ]}
      />,
    );

    const sources = Array.from(container.querySelectorAll("img")).map((image) =>
      image.getAttribute("src"),
    );
    expect(sources).toEqual([
      "https://assets.nhle.com/logos/nhl/svg/NHL_light.svg",
      "https://assets.nhle.com/logos/nhl/svg/NHL_light.svg",
    ]);
    expect(sources.some((source) => /HOME|AWAY/.test(source ?? ""))).toBe(
      false,
    );
    expect(screen.getByText("HOME")).toBeTruthy();
    expect(screen.getByText("AWAY")).toBeTruthy();
  });
});
