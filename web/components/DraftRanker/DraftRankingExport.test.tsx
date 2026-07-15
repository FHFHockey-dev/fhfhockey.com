import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getSession } = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock("lib/supabase/client", () => ({
  default: { auth: { getSession } },
}));

import DraftRankingExport from "./DraftRankingExport";

describe("DraftRankingExport", () => {
  const fetchMock = vi.fn();
  const createObjectURL = vi.fn(() => "blob:ranking-export");
  const revokeObjectURL = vi.fn();
  const anchorClick = vi.fn();

  beforeEach(() => {
    getSession.mockReset();
    fetchMock.mockReset();
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    anchorClick.mockClear();
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      anchorClick,
    );
  });

  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(URL, "createObjectURL");
    Reflect.deleteProperty(URL, "revokeObjectURL");
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("states the privacy boundary and keeps optional lists excluded by default", () => {
    render(<DraftRankingExport rankingId="ranking-1" />);

    expect(
      screen.getByText(/Private pairwise responses are excluded/i),
    ).toBeTruthy();
    for (const checkbox of screen.getAllByRole("checkbox")) {
      expect((checkbox as HTMLInputElement).checked).toBe(false);
    }
  });

  it("downloads an authenticated versioned export with the selected options", async () => {
    getSession.mockResolvedValue({
      data: { session: { access_token: "access-token" } },
    });
    fetchMock.mockResolvedValue(
      new Response(new Blob(["rank,player\n1,Player"]), {
        status: 200,
        headers: {
          "Content-Disposition":
            'attachment; filename="fhfh-draft-rankings-2026-27.csv"',
          "Content-Type": "text/csv",
        },
      }),
    );
    render(<DraftRankingExport rankingId="ranking-1" />);

    fireEvent.click(
      screen.getByRole("checkbox", { name: /Candidates after No. 250/i }),
    );
    fireEvent.click(screen.getByRole("checkbox", { name: /Watchlist/i }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Rank-event summary/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Download CSV" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [path, options] = fetchMock.mock.calls[0];
    const requestUrl = new URL(String(path), "https://fhfhockey.com");
    expect(requestUrl.pathname).toBe("/api/v1/draft-ranker/export");
    expect(Object.fromEntries(requestUrl.searchParams)).toEqual({
      rankingId: "ranking-1",
      format: "csv",
      includeCandidates: "true",
      includeWatchlist: "true",
      includeEventSummary: "true",
    });
    expect(options).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: "text/csv",
          Authorization: "Bearer access-token",
        }),
      }),
    );
    await waitFor(() => expect(anchorClick).toHaveBeenCalledTimes(1));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:ranking-export");
  });

  it("does not call the export endpoint after the session expires", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    render(<DraftRankingExport rankingId="ranking-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Download JSON" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Sign in again to export your board.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
