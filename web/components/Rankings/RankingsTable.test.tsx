import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  ContextualRankingApiRow,
  ContextualRankingsRequest,
} from "lib/rankings/rankingTypes";

import RankingsTable from "./RankingsTable";

afterEach(() => {
  cleanup();
});

const request: ContextualRankingsRequest = {
  entity: "skaters",
  season: 20252026,
  asOfDate: null,
  window: "last10",
  position: "F",
  deployment: "L3",
  strength: "ev",
  metric: "goals_per_60",
  minGp: 1,
  minToiSeconds: 300,
  teamId: null,
  peerGroupType: "deployment",
  sort: "percentile",
  direction: "desc",
  limit: 100,
  entityIds: null,
};

const row: ContextualRankingApiRow = {
  entity: {
    id: 1,
    name: "Matt Savoie",
    position: "C",
    positionGroup: "forward",
    imageUrl: null,
  },
  team: {
    id: 7,
    abbreviation: "BUF",
    name: "Buffalo Sabres",
  },
  deployment: {
    ev: "L3",
    pp: "PP2",
    pk: null,
    confidence: "medium",
  },
  sample: {
    gamesPlayed: 9,
    toiSeconds: 5400,
    toiPerGameSeconds: 600,
    confidence: "medium",
    minimumSampleMet: true,
  },
  metric: {
    key: "goals_per_60",
    value: 1.44,
    formattedValue: "1.44",
    rawRank: 3,
    percentile: 89.2,
    qualifiedPeerCount: 22,
  },
  peerGroup: {
    type: "deployment",
    key: "L3",
  },
  tags: ["L3", "PP2"],
  warnings: ["small_peer_group"],
  explanationItems: ["Rank 3 of 22 in deployment:L3."],
};

describe("RankingsTable", () => {
  it("renders sortable ranking columns, deployment labels, tags, and explanations", () => {
    const onSort = vi.fn();
    render(
      <RankingsTable
        rows={[row]}
        request={request}
        sort="percentile"
        direction="desc"
        isLoading={false}
        onSort={onSort}
      />,
    );

    expect(screen.getByText("Matt Savoie")).toBeTruthy();
    expect(screen.getByText("L3 / PP2")).toBeTruthy();
    expect(screen.getByText("Medium sample")).toBeTruthy();
    expect(screen.getByText("Small peer")).toBeTruthy();
    expect(screen.getByText("Soon")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Sort by GP/i }));
    expect(onSort).toHaveBeenCalledWith("gp");

    fireEvent.click(screen.getByText("Explain"));
    expect(
      screen.getByText("Window: last 10 player games at EV strength."),
    ).toBeTruthy();
    expect(screen.getByText("Peer group: deployment:L3.")).toBeTruthy();
  });

  it("renders table-contained loading, unavailable, and empty states", () => {
    const onSort = vi.fn();
    const { rerender } = render(
      <RankingsTable
        rows={[]}
        request={request}
        sort="percentile"
        direction="desc"
        isLoading={true}
        onSort={onSort}
      />,
    );

    expect(screen.getByText("Loading rankings...")).toBeTruthy();

    rerender(
      <RankingsTable
        rows={[]}
        request={request}
        sort="percentile"
        direction="desc"
        isLoading={false}
        unavailableMessage="Requested metric is not available."
        onSort={onSort}
      />,
    );
    expect(screen.getByText("Requested metric is not available.")).toBeTruthy();

    rerender(
      <RankingsTable
        rows={[]}
        request={request}
        sort="percentile"
        direction="desc"
        isLoading={false}
        onSort={onSort}
      />,
    );
    expect(
      within(screen.getByRole("table")).getByText("No skaters matched these filters."),
    ).toBeTruthy();
  });

  it("shows low-sample warnings without hiding the row", () => {
    render(
      <RankingsTable
        rows={[
          {
            ...row,
            sample: {
              ...row.sample,
              gamesPlayed: 1,
              confidence: "low",
              minimumSampleMet: false,
            },
            metric: {
              ...row.metric,
              rawRank: null,
              percentile: null,
            },
            tags: ["low-sample", "L3"],
            warnings: ["sample_below_minimum"],
          },
        ]}
        request={request}
        sort="percentile"
        direction="desc"
        isLoading={false}
        onSort={vi.fn()}
      />,
    );

    expect(screen.getByText("Matt Savoie")).toBeTruthy();
    expect(screen.getByText("Low sample")).toBeTruthy();
    expect(screen.getByText("low-sample")).toBeTruthy();

    fireEvent.click(screen.getByText("Explain"));
    expect(
      screen.getByText("Sample caveat: minimum GP or TOI was not met before ranking."),
    ).toBeTruthy();
  });

  it("toggles comparison selection when comparison controls are enabled", () => {
    const onToggleComparison = vi.fn();
    render(
      <RankingsTable
        rows={[row]}
        request={request}
        sort="percentile"
        direction="desc"
        isLoading={false}
        onSort={vi.fn()}
        selectedEntityIds={[row.entity.id]}
        onToggleComparison={onToggleComparison}
      />,
    );

    const checkbox = screen.getByRole("checkbox", {
      name: /Compare Matt Savoie/i,
    });
    expect(checkbox).toHaveProperty("checked", true);

    fireEvent.click(checkbox);
    expect(onToggleComparison).toHaveBeenCalledWith(row.entity.id);
  });
});
