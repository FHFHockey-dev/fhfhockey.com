import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, useCurrentSeasonQueryMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  useCurrentSeasonQueryMock: vi.fn(),
}));

vi.mock("lib/supabase", () => ({
  default: { from: fromMock },
}));

vi.mock("hooks/useCurrentSeason", () => ({
  useCurrentSeasonQuery: useCurrentSeasonQueryMock,
}));

vi.mock("lib/fetchWithCache", () => ({
  default: vi.fn(),
}));

vi.mock("./GameByGameTimeline", () => ({
  GameByGameTimeline: () => <div>Game timeline</div>,
}));

vi.mock("./AdvancedL10Metrics", () => ({
  AdvancedL10Metrics: () => <div>Advanced metrics</div>,
}));

vi.mock("./TeamLeaders", () => ({
  TeamLeaders: () => <div>Team leaders</div>,
}));

import { TeamDashboard } from "./TeamDashboard";

type SummaryResult = {
  data: Record<string, unknown> | null;
  error: Error | null;
};

type SeasonQueryState = {
  data: Record<string, unknown> | null | undefined;
  error: Error | null;
  isError: boolean;
  isPending: boolean;
  status: "pending" | "success" | "error";
};

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

function createSummaryQuery(result: Promise<SummaryResult>) {
  const query: any = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.single = vi.fn(() => result);
  return query;
}

function installSummaryResults(...results: Promise<SummaryResult>[]) {
  const queries = results.map(createSummaryQuery);
  let index = 0;

  fromMock.mockImplementation((table: string) => {
    if (table !== "team_summary_years") {
      throw new Error(`Unexpected table: ${table}`);
    }

    const query = queries[index];
    index += 1;
    if (!query) throw new Error("Missing summary query result");
    return query;
  });

  return queries;
}

function pendingSeasonQuery(): SeasonQueryState {
  return {
    data: undefined,
    error: null,
    isError: false,
    isPending: true,
    status: "pending",
  };
}

function successfulSeasonQuery(
  data: Record<string, unknown> | null,
): SeasonQueryState {
  return {
    data,
    error: null,
    isError: false,
    isPending: false,
    status: "success",
  };
}

function failedSeasonQuery(error: Error): SeasonQueryState {
  return {
    data: undefined,
    error,
    isError: true,
    isPending: false,
    status: "error",
  };
}

describe("TeamDashboard season and request ownership", () => {
  beforeEach(() => {
    fromMock.mockReset();
    useCurrentSeasonQueryMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("keeps the loading state while season resolution is pending", () => {
    useCurrentSeasonQueryMock.mockReturnValue(pendingSeasonQuery());

    render(<TeamDashboard teamId="22" teamAbbrev="EDM" />);

    expect(screen.getByText("Loading team dashboard...")).toBeTruthy();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("terminates a successful empty season lookup without querying", async () => {
    useCurrentSeasonQueryMock.mockReturnValue(successfulSeasonQuery(null));

    render(<TeamDashboard teamId="22" teamAbbrev="EDM" />);

    expect(
      await screen.findByText("Team dashboard requires a season selection."),
    ).toBeTruthy();
    expect(screen.queryByText("Loading team dashboard...")).toBeNull();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("contains a terminal season-query failure behind a stable error", async () => {
    useCurrentSeasonQueryMock.mockReturnValue(
      failedSeasonQuery(new Error("upstream season details")),
    );

    render(<TeamDashboard teamId="22" teamAbbrev="EDM" />);

    expect(
      await screen.findByText("Unable to load the current season."),
    ).toBeTruthy();
    expect(screen.queryByText("upstream season details")).toBeNull();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("starts the exact season query after pending resolution", async () => {
    let seasonQuery = pendingSeasonQuery();
    useCurrentSeasonQueryMock.mockImplementation(() => seasonQuery);
    const query = installSummaryResults(
      Promise.resolve({
        data: null,
        error: new Error("dashboard unavailable"),
      }),
    )[0];
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const view = render(<TeamDashboard teamId="22" teamAbbrev="EDM" />);
    expect(fromMock).not.toHaveBeenCalled();

    seasonQuery = successfulSeasonQuery({ seasonId: 20252026 });
    view.rerender(<TeamDashboard teamId="22" teamAbbrev="EDM" />);

    await waitFor(() => {
      expect(query.single).toHaveBeenCalledOnce();
    });
    expect(query.eq).toHaveBeenCalledWith("team_id", 22);
    expect(query.eq).toHaveBeenCalledWith("season_id", 20252026);
  });

  it("lets an explicit season bypass pending current-season lookup", async () => {
    useCurrentSeasonQueryMock.mockReturnValue(pendingSeasonQuery());
    const query = installSummaryResults(
      Promise.resolve({
        data: null,
        error: new Error("dashboard unavailable"),
      }),
    )[0];
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(<TeamDashboard teamId="22" teamAbbrev="EDM" seasonId="20242025" />);

    await waitFor(() => {
      expect(query.single).toHaveBeenCalledOnce();
    });
    expect(query.eq).toHaveBeenCalledWith("season_id", 20242025);
  });

  it("lets an explicit season bypass a failed current-season lookup", async () => {
    useCurrentSeasonQueryMock.mockReturnValue(
      failedSeasonQuery(new Error("unrelated current-season failure")),
    );
    const query = installSummaryResults(
      Promise.resolve({
        data: null,
        error: new Error("dashboard unavailable"),
      }),
    )[0];
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(<TeamDashboard teamId="22" teamAbbrev="EDM" seasonId="20242025" />);

    await waitFor(() => {
      expect(query.single).toHaveBeenCalledOnce();
    });
    expect(query.eq).toHaveBeenCalledWith("season_id", 20242025);
    expect(screen.queryByText("Unable to load the current season.")).toBeNull();
  });

  it("terminates a missing team selection without querying", async () => {
    useCurrentSeasonQueryMock.mockReturnValue(pendingSeasonQuery());

    render(<TeamDashboard teamId="" teamAbbrev="" seasonId="20252026" />);

    expect(
      await screen.findByText(
        "Team dashboard requires a valid team selection.",
      ),
    ).toBeTruthy();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("ignores an older request after a team and season change", async () => {
    useCurrentSeasonQueryMock.mockReturnValue(pendingSeasonQuery());
    const older = createDeferred<SummaryResult>();
    const queries = installSummaryResults(
      older.promise,
      Promise.resolve({ data: null, error: new Error("Fresh request failed") }),
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const view = render(
      <TeamDashboard teamId="22" teamAbbrev="EDM" seasonId="20242025" />,
    );

    await waitFor(() => {
      expect(queries[0].single).toHaveBeenCalledOnce();
    });

    view.rerender(
      <TeamDashboard teamId="6" teamAbbrev="BOS" seasonId="20252026" />,
    );

    expect(await screen.findByText("Fresh request failed")).toBeTruthy();

    await act(async () => {
      older.resolve({ data: { games_played: 82 }, error: null });
      await older.promise;
    });

    expect(screen.getByText("Fresh request failed")).toBeTruthy();
    expect(fromMock).toHaveBeenCalledTimes(2);
  });

  it("ignores a rejected request after unmount", async () => {
    useCurrentSeasonQueryMock.mockReturnValue(pendingSeasonQuery());
    const pending = createDeferred<SummaryResult>();
    installSummaryResults(pending.promise);
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const view = render(
      <TeamDashboard teamId="22" teamAbbrev="EDM" seasonId="20242025" />,
    );

    await waitFor(() => {
      expect(fromMock).toHaveBeenCalledOnce();
    });
    view.unmount();

    await act(async () => {
      pending.reject(new Error("stale request detail"));
      await pending.promise.catch(() => undefined);
    });

    expect(errorSpy).not.toHaveBeenCalled();
  });
});
