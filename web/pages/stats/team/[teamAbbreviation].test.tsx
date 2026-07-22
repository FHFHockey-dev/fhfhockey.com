import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, headerHookMock, shotHookMock, tabPropsMock } = vi.hoisted(
  () => ({
    fromMock: vi.fn(),
    headerHookMock: vi.fn(),
    shotHookMock: vi.fn(),
    tabPropsMock: vi.fn(),
  }),
);

vi.mock("lib/supabase", () => ({ default: { from: fromMock } }));
vi.mock("hooks/useTeamStatsHeaderData", () => ({
  useTeamStatsHeaderData: headerHookMock,
}));
vi.mock("hooks/useShotData", () => ({ useShotData: shotHookMock }));
vi.mock("components/TeamTabNavigation/TeamTabNavigation", () => ({
  TeamTabNavigation: (props: unknown) => {
    tabPropsMock(props);
    return <div>Team tabs</div>;
  },
}));
vi.mock("components/LineCombinations/LineCombinationsGrid", () => ({
  LineCombinationsGrid: () => null,
}));
vi.mock("components/TeamDropdown", () => ({ default: () => null }));
vi.mock("components/SurfaceWorkflowLinks", () => ({ default: () => null }));
vi.mock("lib/NHL/server", () => ({ getTeams: vi.fn() }));

import TeamStatsPage, {
  formatOrdinal,
  getServerSideProps,
} from "./[teamAbbreviation]";

function emptyQuery() {
  const chain: any = {};
  for (const method of ["select", "eq", "order", "limit", "in"]) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve({ data: [], error: null }).then(resolve);
  return chain;
}

describe("TeamStatsPage", () => {
  beforeEach(() => {
    fromMock.mockReset();
    headerHookMock.mockReset();
    shotHookMock.mockReset();
    tabPropsMock.mockReset();
    fromMock.mockImplementation(() => emptyQuery());
    headerHookMock.mockReturnValue({ data: null, loading: false, error: null });
    shotHookMock.mockReturnValue({
      shotData: [],
      opponentShotData: [],
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => cleanup());

  it("rejects inherited route keys before any database query", async () => {
    const result = await getServerSideProps({
      query: { teamAbbreviation: "toString" },
    } as any);

    expect(result).toEqual({ notFound: true });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("formats ordinary, teen, and unavailable rankings", () => {
    expect(formatOrdinal(1)).toBe("1st");
    expect(formatOrdinal(2)).toBe("2nd");
    expect(formatOrdinal(3)).toBe("3rd");
    expect(formatOrdinal(11)).toBe("11th");
    expect(formatOrdinal(12)).toBe("12th");
    expect(formatOrdinal(13)).toBe("13th");
    expect(formatOrdinal(21)).toBe("21st");
    expect(formatOrdinal(null)).toBe("—");
    expect(formatOrdinal(0)).toBe("—");
  });

  it("uses the newest persisted summary season across page consumers", async () => {
    render(
      <TeamStatsPage
        teamName="Edmonton Oilers"
        teamAbbreviation="EDM"
        teamColors={null}
        teams={[]}
        summaries={[
          {
            season_id: 20242025,
            team_id: 22,
            team_full_name: "Edmonton Oilers",
          } as any,
        ]}
      />,
    );

    expect(screen.getByText("2024-25 Season")).toBeTruthy();
    expect(headerHookMock).toHaveBeenCalledWith(22, "EDM", 20242025);
    expect(shotHookMock).toHaveBeenCalledWith(
      22,
      "20242025",
      expect.any(Object),
    );
    await waitFor(() =>
      expect(tabPropsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          teamId: "22",
          teamAbbrev: "EDM",
          seasonId: "20242025",
          currentSeason: { seasonId: 20242025 },
        }),
      ),
    );
  });
});
