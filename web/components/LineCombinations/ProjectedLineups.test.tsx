// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("next/script", () => ({ default: () => null }));
import { ProjectedLineupsContent } from "./ProjectedLineups";

afterEach(cleanup);
describe("retained report date disclosure", () => {
  it("labels older reports rather than presenting them as today's lineup", () => {
    render(<ProjectedLineupsContent data={{ enabled: true, reports: [], sets: [],
      reportScope: { requestedDate: "2026-11-12", reportDate: "2026-11-11", fallback: true } }} />);
    expect(screen.getByRole("heading", { name: "Latest reported line combinations" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("older reports, not a confirmed lineup for today");
    expect(screen.getByRole("status").querySelectorAll("time")).toHaveLength(2);
  });
  it("preserves current and older-server response presentation", () => {
    render(<ProjectedLineupsContent data={{ enabled: true, reports: [], sets: [] }} />);
    expect(screen.getByRole("heading", { name: "Projected line combinations" })).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });
  it("does not show retained reports when publishing is disabled", () => {
    const view = render(<ProjectedLineupsContent data={{ enabled: false, reports: [], sets: [],
      reportScope: { requestedDate: "2026-11-12", reportDate: "2026-11-11", fallback: true } }} />);
    expect(view.container.textContent).toBe("");
  });
});
