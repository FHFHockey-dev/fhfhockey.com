import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, useCurrentSeasonMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  useCurrentSeasonMock: vi.fn(),
}));

vi.mock("lib/supabase", () => ({
  default: { from: fromMock },
}));

vi.mock("hooks/useCurrentSeason", () => ({
  default: useCurrentSeasonMock,
}));

import { buildLeaderHeadshotSources, TeamLeaders } from "./TeamLeaders";

type QueryResult = {
  data: Record<string, any>[] | null;
  error: Error | null;
};

function installQueries({
  skaters,
  skatersError = null,
  images = [],
  imagesError = null,
  skatersPromise,
}: {
  skaters: Record<string, any>[] | null;
  skatersError?: Error | null;
  images?: Record<string, any>[];
  imagesError?: Error | null;
  skatersPromise?: Promise<QueryResult>;
}) {
  const skaterQuery: any = {};
  skaterQuery.select = vi.fn(() => skaterQuery);
  skaterQuery.eq = vi.fn(() => skaterQuery);
  skaterQuery.gte = vi.fn(() =>
    skatersPromise
      ? skatersPromise
      : Promise.resolve({ data: skaters, error: skatersError }),
  );

  const imageQuery: any = {};
  imageQuery.select = vi.fn(() => imageQuery);
  imageQuery.in = vi.fn(() =>
    Promise.resolve({ data: images, error: imagesError }),
  );

  fromMock.mockImplementation((table: string) => {
    if (table === "wgo_skater_stats_totals") return skaterQuery;
    if (table === "players") return imageQuery;
    throw new Error(`Unexpected table: ${table}`);
  });

  return { skaterQuery, imageQuery };
}

function categoryByName(name: string) {
  const heading = screen.getByRole("heading", { name });
  if (!heading.parentElement) throw new Error(`Missing ${name} container`);
  return heading.parentElement;
}

function categoryPlayerNames(name: string) {
  return within(categoryByName(name))
    .getAllByText(/^(Alpha|Beta|Gamma)$/)
    .map((element) => element.textContent);
}

describe("TeamLeaders", () => {
  beforeEach(() => {
    fromMock.mockReset();
    useCurrentSeasonMock.mockReset();
    useCurrentSeasonMock.mockReturnValue({ seasonId: 20252026 });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("accepts only trusted sources and keeps the local placeholder terminal", () => {
    const cms =
      "https://cms.nhl.bamgrid.com/images/headshots/current/168x168/42.jpg";

    expect(
      buildLeaderHeadshotSources("https://assets.nhle.com/headshot.png", 42),
    ).toEqual([
      "https://assets.nhle.com/headshot.png",
      cms,
      "/pictures/player-placeholder.jpg",
    ]);
    expect(buildLeaderHeadshotSources(cms, 42)).toEqual([
      cms,
      "/pictures/player-placeholder.jpg",
    ]);
    expect(
      buildLeaderHeadshotSources("https://nhl.bamcontent.com/headshot.png", 42),
    ).toEqual([
      "https://nhl.bamcontent.com/headshot.png",
      cms,
      "/pictures/player-placeholder.jpg",
    ]);
    expect(buildLeaderHeadshotSources("/pictures/custom.jpg", 0)).toEqual([
      "/pictures/custom.jpg",
      "/pictures/player-placeholder.jpg",
    ]);
    expect(
      buildLeaderHeadshotSources("/pictures/player-placeholder.jpg", 42),
    ).toEqual([cms, "/pictures/player-placeholder.jpg"]);

    for (const source of [
      "http://assets.nhle.com/headshot.png",
      "https://example.com/headshot.png",
      "//assets.nhle.com/headshot.png",
      "/\\example.com/headshot.png",
      "pictures/headshot.png",
      "not a URL",
    ]) {
      expect(buildLeaderHeadshotSources(source, 42)).toEqual([
        cms,
        "/pictures/player-placeholder.jpg",
      ]);
    }
  });

  it("owns loading, query filters, category order, and intrinsic image attributes", async () => {
    let resolveSkaters: ((result: QueryResult) => void) | undefined;
    const skatersPromise = new Promise<QueryResult>((resolve) => {
      resolveSkaters = resolve;
    });
    const rows = [
      {
        player_id: 1,
        player_name: "Alpha",
        position_code: "C",
        games_played: 20,
        points: 3,
        goals: 9,
        blocked_shots: 1,
        shots: 1,
        hits: 1,
      },
      {
        player_id: 2,
        player_name: "Beta",
        position_code: "L",
        games_played: 20,
        points: 9,
        goals: 3,
        blocked_shots: 2,
        shots: 2,
        hits: 2,
      },
      {
        player_id: 3,
        player_name: "Gamma",
        position_code: "R",
        games_played: 20,
        points: 6,
        goals: 6,
        blocked_shots: 3,
        shots: 3,
        hits: 3,
      },
    ];
    const { skaterQuery, imageQuery } = installQueries({
      skaters: rows,
      images: [{ id: 2, image_url: "https://assets.nhle.com/beta.png" }],
      skatersPromise,
    });

    render(<TeamLeaders teamAbbrev="BOS" seasonId="2025" />);
    expect(screen.getByText("Loading team leaders...")).toBeTruthy();

    resolveSkaters?.({ data: rows, error: null });

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Points Leaders" }),
      ).toBeTruthy();
    });

    expect(categoryPlayerNames("Points Leaders")).toEqual([
      "Beta",
      "Gamma",
      "Alpha",
    ]);
    expect(categoryPlayerNames("Goals Leaders")).toEqual([
      "Alpha",
      "Gamma",
      "Beta",
    ]);
    expect(categoryPlayerNames("BSH Leaders")).toEqual([
      "Gamma",
      "Beta",
      "Alpha",
    ]);
    expect(skaterQuery.eq).toHaveBeenNthCalledWith(
      1,
      "current_team_abbreviation",
      "BOS",
    );
    expect(skaterQuery.eq).toHaveBeenNthCalledWith(2, "season", "20252026");
    expect(skaterQuery.gte).toHaveBeenCalledWith("games_played", 5);
    expect(imageQuery.in).toHaveBeenCalledWith("id", [1, 2, 3]);

    const image = categoryByName("Points Leaders").querySelector("img");
    expect(image?.getAttribute("src")).toBe("https://assets.nhle.com/beta.png");
    expect(image?.getAttribute("alt")).toBe("");
    expect(image?.getAttribute("width")).toBe("80");
    expect(image?.getAttribute("height")).toBe("80");
    expect(image?.getAttribute("loading")).toBe("lazy");
    expect(image?.getAttribute("decoding")).toBe("async");
    expect(image?.getAttribute("referrerpolicy")).toBe("no-referrer");
  });

  it("uses a bounded fallback sequence and removes a terminally failed image", async () => {
    installQueries({
      skaters: [
        {
          player_id: 42,
          player_name: "Alpha",
          position_code: "C",
          games_played: 20,
          points: 10,
          goals: 4,
          blocked_shots: 1,
          shots: 2,
          hits: 3,
        },
      ],
      images: [{ id: 42, image_url: "https://assets.nhle.com/custom.png" }],
    });

    render(<TeamLeaders teamAbbrev="BOS" seasonId="20252026" />);
    const category = await waitFor(() => categoryByName("Points Leaders"));
    const currentImage = () => category.querySelector("img");

    expect(currentImage()?.getAttribute("src")).toBe(
      "https://assets.nhle.com/custom.png",
    );
    fireEvent.error(currentImage() as HTMLImageElement);
    expect(currentImage()?.getAttribute("src")).toBe(
      "https://cms.nhl.bamgrid.com/images/headshots/current/168x168/42.jpg",
    );
    fireEvent.error(currentImage() as HTMLImageElement);
    expect(currentImage()?.getAttribute("src")).toBe(
      "/pictures/player-placeholder.jpg",
    );
    fireEvent.error(currentImage() as HTMLImageElement);
    expect(currentImage()).toBeNull();
  });

  it("renders a stable missing-season error instead of an infinite spinner", () => {
    useCurrentSeasonMock.mockReturnValue(undefined);

    render(<TeamLeaders teamAbbrev="BOS" />);

    expect(screen.queryByText("Loading team leaders...")).toBeNull();
    expect(
      screen.getByText("Team leaders require a team and season selection."),
    ).toBeTruthy();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("ignores stale results after the selected team changes", async () => {
    let resolveBoston: ((result: QueryResult) => void) | undefined;
    const bostonPromise = new Promise<QueryResult>((resolve) => {
      resolveBoston = resolve;
    });
    const bostonRows = [
      {
        player_id: 1,
        player_name: "Alpha",
        position_code: "C",
        games_played: 20,
        points: 10,
        goals: 5,
        blocked_shots: 1,
        shots: 1,
        hits: 1,
      },
    ];
    const torontoRows = [
      {
        player_id: 2,
        player_name: "Beta",
        position_code: "C",
        games_played: 20,
        points: 12,
        goals: 6,
        blocked_shots: 2,
        shots: 2,
        hits: 2,
      },
    ];
    let totalsRequest = 0;

    fromMock.mockImplementation((table: string) => {
      if (table === "players") {
        const imageQuery: any = {};
        imageQuery.select = vi.fn(() => imageQuery);
        imageQuery.in = vi.fn(() => Promise.resolve({ data: [], error: null }));
        return imageQuery;
      }

      const requestIndex = totalsRequest++;
      const skaterQuery: any = {};
      skaterQuery.select = vi.fn(() => skaterQuery);
      skaterQuery.eq = vi.fn(() => skaterQuery);
      skaterQuery.gte = vi.fn(() =>
        requestIndex === 0
          ? bostonPromise
          : Promise.resolve({ data: torontoRows, error: null }),
      );
      return skaterQuery;
    });

    const { rerender } = render(
      <TeamLeaders teamAbbrev="BOS" seasonId="2025" />,
    );
    rerender(<TeamLeaders teamAbbrev="TOR" seasonId="2025" />);

    await waitFor(() => expect(screen.getAllByText("Beta")).toHaveLength(3));
    resolveBoston?.({ data: bostonRows, error: null });
    await Promise.resolve();

    expect(screen.queryByText("Alpha")).toBeNull();
    expect(screen.getAllByText("Beta")).toHaveLength(3);
  });

  it("does not surface a stale failure after the selected team changes", async () => {
    let resolveBoston: ((result: QueryResult) => void) | undefined;
    const bostonPromise = new Promise<QueryResult>((resolve) => {
      resolveBoston = resolve;
    });
    const torontoRows = [
      {
        player_id: 2,
        player_name: "Beta",
        position_code: "C",
        games_played: 20,
        points: 12,
        goals: 6,
        blocked_shots: 2,
        shots: 2,
        hits: 2,
      },
    ];
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    let totalsRequest = 0;

    fromMock.mockImplementation((table: string) => {
      if (table === "players") {
        const imageQuery: any = {};
        imageQuery.select = vi.fn(() => imageQuery);
        imageQuery.in = vi.fn(() => Promise.resolve({ data: [], error: null }));
        return imageQuery;
      }

      const requestIndex = totalsRequest++;
      const skaterQuery: any = {};
      skaterQuery.select = vi.fn(() => skaterQuery);
      skaterQuery.eq = vi.fn(() => skaterQuery);
      skaterQuery.gte = vi.fn(() =>
        requestIndex === 0
          ? bostonPromise
          : Promise.resolve({ data: torontoRows, error: null }),
      );
      return skaterQuery;
    });

    const { rerender } = render(
      <TeamLeaders teamAbbrev="BOS" seasonId="2025" />,
    );
    rerender(<TeamLeaders teamAbbrev="TOR" seasonId="2025" />);

    await waitFor(() => expect(screen.getAllByText("Beta")).toHaveLength(3));
    resolveBoston?.({ data: null, error: new Error("Stale query failed") });
    await Promise.resolve();

    expect(screen.queryByText("Stale query failed")).toBeNull();
    expect(screen.getAllByText("Beta")).toHaveLength(3);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("renders empty and query-error states without issuing image work", async () => {
    installQueries({ skaters: [] });
    const firstRender = render(
      <TeamLeaders teamAbbrev="BOS" seasonId="2025" />,
    );

    await waitFor(() =>
      expect(screen.getAllByText("No data available")).toHaveLength(3),
    );
    expect(fromMock).toHaveBeenCalledTimes(1);
    firstRender.unmount();

    cleanup();
    fromMock.mockReset();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    installQueries({ skaters: null, skatersError: new Error("Query failed") });
    render(<TeamLeaders teamAbbrev="BOS" seasonId="2025" />);

    await waitFor(() => expect(screen.getByText("Query failed")).toBeTruthy());
    expect(
      screen.getByRole("heading", { name: /error loading team leaders/i }),
    ).toBeTruthy();
    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it("keeps leaders usable and logs only a bounded diagnostic when images fail", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    installQueries({
      skaters: [
        {
          player_id: 42,
          player_name: "Alpha",
          position_code: "C",
          games_played: 20,
          points: 10,
          goals: 4,
          blocked_shots: 1,
          shots: 2,
          hits: 3,
        },
      ],
      imagesError: new Error("sensitive upstream detail"),
    });

    render(<TeamLeaders teamAbbrev="BOS" seasonId="2025" />);

    await waitFor(() => expect(screen.getAllByText("Alpha")).toHaveLength(3));
    expect(consoleWarn).toHaveBeenCalledWith(
      "Team leader image metadata is unavailable; using fallback images.",
    );
    expect(JSON.stringify(consoleWarn.mock.calls)).not.toContain(
      "sensitive upstream detail",
    );
    expect(
      categoryByName("Points Leaders")
        .querySelector("img")
        ?.getAttribute("src"),
    ).toBe(
      "https://cms.nhl.bamgrid.com/images/headshots/current/168x168/42.jpg",
    );
  });
});
