import React from "react";
import { act, cleanup, fireEvent, render as renderView, screen } from "@testing-library/react";
import { RouterContext } from "next/dist/shared/lib/router-context.shared-runtime";
import type { NextRouter } from "next/router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, limitMock, ilikeMock, pushMock, prefetchMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  limitMock: vi.fn(),
  ilikeMock: vi.fn(),
  pushMock: vi.fn(),
  prefetchMock: vi.fn(),
}));

vi.mock("lib/supabase", () => ({ default: { from: fromMock } }));

import PlayerSearchBar from "./PlayerSearchBar";

// Keep Next's hook and Link implementation real so event-triggered prefetch cannot hide behind a mock.
const router: NextRouter = {
  pathname: "/stats", route: "/stats", query: {}, asPath: "/stats", basePath: "",
  isReady: true, isLocaleDomain: false, isFallback: false, isPreview: false,
  push: pushMock, prefetch: prefetchMock, replace: vi.fn(), reload: vi.fn(),
  back: vi.fn(), forward: vi.fn(), beforePopState: vi.fn(),
  events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
};

function render(ui: React.ReactElement) {
  return renderView(<RouterContext.Provider value={router}>{ui}</RouterContext.Provider>);
}

const alice = { id: 1, fullName: "Alice Example", image_url: null, team_id: null };
const ben = { id: 2, fullName: "Ben Example", image_url: null, team_id: null };
type SearchResponse = { data: typeof alice[] | null; error?: { message: string } | null };

function deferred() {
  let resolve!: (value: SearchResponse) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<SearchResponse>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function change(value: string) {
  fireEvent.change(screen.getByLabelText("Search players"), { target: { value } });
}

async function debounce() {
  await act(async () => { vi.advanceTimersByTime(200); });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  limitMock.mockReset();
  pushMock.mockResolvedValue(true);
  prefetchMock.mockResolvedValue(undefined);
  fromMock.mockReturnValue({ select: () => ({ ilike: ilikeMock }) });
  ilikeMock.mockReturnValue({ limit: limitMock });
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network is forbidden in P04 fixtures"); }));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("PlayerSearchBar", () => {
  it("keeps the newer result when requests finish out of order", async () => {
    const older = deferred();
    const newer = deferred();
    limitMock.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    render(<PlayerSearchBar />);
    change("Al");
    await debounce();
    change("Be");
    await debounce();
    await act(async () => { newer.resolve({ data: [ben] }); });
    expect(screen.getByText(ben.fullName)).toBeTruthy();
    await act(async () => { older.resolve({ data: [alice] }); });
    expect(screen.queryByText(alice.fullName)).toBeNull();
    expect(screen.getByText(ben.fullName)).toBeTruthy();
  });

  it("invalidates the old request as soon as input changes, before the new debounce", async () => {
    const older = deferred();
    limitMock.mockReturnValueOnce(older.promise);
    render(<PlayerSearchBar />);
    change("Al");
    await debounce();
    change("Be");
    await act(async () => { older.resolve({ data: [alice] }); });
    expect(screen.queryByText(alice.fullName)).toBeNull();
    expect(limitMock).toHaveBeenCalledTimes(1);
  });

  it.each(["", "A"])("does not reopen results after input becomes %j", async (value) => {
    const request = deferred();
    limitMock.mockReturnValueOnce(request.promise);
    render(<PlayerSearchBar />);
    change("Al");
    await debounce();
    change(value);
    await act(async () => { request.resolve({ data: [alice] }); });
    expect(screen.queryByText(alice.fullName)).toBeNull();
    await debounce();
    expect(limitMock).toHaveBeenCalledTimes(1);
  });

  it("cancels a pending debounce on unmount", async () => {
    limitMock.mockResolvedValue({ data: [] });
    const { unmount } = render(<PlayerSearchBar />);
    change("Al");
    unmount();
    await debounce();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("debounces to one bounded query with a captured input value", async () => {
    limitMock.mockResolvedValue({ data: [] });
    render(<PlayerSearchBar />);
    change("Al");
    change("Ali");
    await debounce();
    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(fromMock).toHaveBeenCalledWith("players");
    expect(ilikeMock).toHaveBeenCalledWith("fullName", "%Ali%");
    expect(limitMock).toHaveBeenCalledWith(10);
  });

  it("handles a rejected request and ignores a rejection after unmount", async () => {
    const current = deferred();
    const disposed = deferred();
    limitMock.mockReturnValueOnce(current.promise).mockReturnValueOnce(disposed.promise);
    const { unmount } = render(<PlayerSearchBar />);
    change("Al");
    await debounce();
    await act(async () => { current.reject(new Error("private failure")); });
    expect(screen.getByRole("status").textContent).toContain("Unable to search");
    change("Be");
    await debounce();
    unmount();
    await act(async () => { disposed.reject(new Error("disposed failure")); });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("clears already displayed results while a new query is pending", async () => {
    limitMock.mockResolvedValueOnce({ data: [alice] });
    render(<PlayerSearchBar />);
    change("Al");
    await debounce();
    expect(screen.getByText(alice.fullName)).toBeTruthy();
    change("Be");
    expect(screen.queryByText(alice.fullName)).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("Searching");
  });

  it("shows loading, empty, error and recovered results distinctly", async () => {
    const empty = deferred();
    limitMock.mockReturnValueOnce(empty.promise);
    render(<PlayerSearchBar />);
    change("Al");
    expect(screen.getByRole("status").textContent).toContain("Searching");
    await debounce();
    await act(async () => { empty.resolve({ data: [] }); });
    expect(screen.getByRole("status").textContent).toContain("No players found");
    limitMock.mockResolvedValueOnce({ data: [alice], error: { message: "private backend detail" } });
    change("Be");
    await debounce();
    expect(screen.getByRole("status").textContent).toContain("Unable to search");
    expect(screen.queryByText(alice.fullName)).toBeNull();
    expect(screen.queryByText("private backend detail")).toBeNull();
    limitMock.mockResolvedValueOnce({ data: [ben] });
    change("Ben");
    await debounce();
    expect(screen.getByRole("link", { name: ben.fullName }).getAttribute("href")).toBe("/stats/player/2");
  });

  it("ignores stale errors while a newer search is successful", async () => {
    const older = deferred();
    limitMock.mockReturnValueOnce(older.promise).mockResolvedValueOnce({ data: [ben] });
    render(<PlayerSearchBar />);
    change("Al");
    await debounce();
    change("Be");
    await debounce();
    await act(async () => { older.resolve({ data: null, error: { message: "old error" } }); });
    expect(screen.getByText(ben.fullName)).toBeTruthy();
    expect(screen.getByRole("status").textContent).not.toContain("Unable");
  });

  it("lets keyboard users focus native result links and dismiss with Escape", async () => {
    limitMock.mockResolvedValue({ data: [alice, ben] });
    render(<PlayerSearchBar />);
    const input = screen.getByLabelText("Search players");
    act(() => { input.focus(); });
    change("Al");
    await debounce();
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/stats/player/1", "/stats/player/2"]);
    expect(links.every((link) => link.tabIndex === 0)).toBe(true);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(document.activeElement).toBe(links[0]);
    await debounce();
    expect(screen.getAllByRole("link")).toHaveLength(2);
    fireEvent.keyDown(links[0], { key: "ArrowDown" });
    expect(document.activeElement).toBe(links[1]);
    fireEvent.keyDown(links[1], { key: "ArrowUp" });
    expect(document.activeElement).toBe(links[0]);
    fireEvent.keyDown(links[0], { key: "Escape" });
    expect(document.activeElement).toBe(input);
    expect(screen.queryByRole("link")).toBeNull();
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(document.activeElement?.textContent).toBe(ben.fullName);
    fireEvent.click(screen.getByRole("link", { name: ben.fullName }));
    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock.mock.calls[0][0]).toBe("/stats/player/2");
    expect((input as HTMLInputElement).value).toBe("");
    expect(screen.queryByRole("link")).toBeNull();
  });

  it.each(["ctrlKey", "metaKey", "shiftKey", "altKey"])("keeps %s navigation native without clearing the current search", async (modifier) => {
    limitMock.mockResolvedValue({ data: [alice] });
    render(<PlayerSearchBar />);
    change("Al");
    await debounce();
    let prevented: boolean | undefined;
    document.addEventListener("click", (event) => {
      prevented = event.defaultPrevented;
      event.preventDefault(); // Stop jsdom navigation after observing the component's decision.
    }, { once: true });
    fireEvent.click(screen.getByRole("link", { name: alice.fullName }), { [modifier]: true });
    expect(prevented).toBe(false);
    expect(pushMock).not.toHaveBeenCalled();
    expect((screen.getByLabelText("Search players") as HTMLInputElement).value).toBe("Al");
    expect(screen.getByRole("link", { name: alice.fullName })).toBeTruthy();
  });

  it.each(["mouseEnter", "touchStart"] as const)("does not prefetch or navigate on %s", async (event) => {
    limitMock.mockResolvedValue({ data: [alice] });
    render(<PlayerSearchBar />);
    change("Al");
    await debounce();
    expect(prefetchMock).not.toHaveBeenCalled();
    fireEvent[event](screen.getByRole("link", { name: alice.fullName }));
    expect(prefetchMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
    expect((screen.getByLabelText("Search players") as HTMLInputElement).value).toBe("Al");
  });

  it("navigates once for a keyboard-style link activation", async () => {
    limitMock.mockResolvedValue({ data: [alice] });
    render(<PlayerSearchBar />);
    change("Al");
    await debounce();
    fireEvent.keyDown(screen.getByLabelText("Search players"), { key: "ArrowDown" });
    const link = screen.getByRole("link", { name: alice.fullName });
    expect(document.activeElement).toBe(link);
    expect(link.tabIndex).toBe(0);
    expect(link.getAttribute("href")).toBe("/stats/player/1");
    fireEvent.click(link, { button: 0, detail: 0 });
    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock.mock.calls[0][0]).toBe("/stats/player/1");
    expect((screen.getByLabelText("Search players") as HTMLInputElement).value).toBe("");
    expect(screen.queryByRole("link")).toBeNull();
  });

  it.each(["blur", "Escape"])("does not reopen a dismissed search after %s", async (action) => {
    const request = deferred();
    limitMock.mockReturnValueOnce(request.promise);
    render(<><PlayerSearchBar /><button>Outside</button></>);
    const input = screen.getByLabelText("Search players");
    act(() => { input.focus(); });
    change("Al");
    await debounce();
    if (action === "blur") act(() => { screen.getByRole("button").focus(); });
    else fireEvent.keyDown(input, { key: "Escape" });
    await debounce();
    await act(async () => { request.resolve({ data: [alice] }); });
    expect(screen.queryByText(alice.fullName)).toBeNull();
  });
});
