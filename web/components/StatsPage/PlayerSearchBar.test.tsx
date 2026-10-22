import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, limitMock, ilikeMock, pushMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  limitMock: vi.fn(),
  ilikeMock: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock("lib/supabase", () => ({ default: { from: fromMock } }));
vi.mock("next/router", () => ({ useRouter: () => ({ push: pushMock }) }));
vi.mock("next/link", () => ({
  default: React.forwardRef<HTMLAnchorElement, React.ComponentProps<"a"> & { prefetch?: boolean }>(function MockLink(
    { children, onClick, prefetch: _prefetch, ...props }, ref,
  ) { return (
    <a {...props} ref={ref} onClick={(event) => { onClick?.(event); event.preventDefault(); }}>
      {children}
    </a>
  ); }),
}));

import PlayerSearchBar from "./PlayerSearchBar";

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
    expect((input as HTMLInputElement).value).toBe("");
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("keeps new-tab navigation native without clearing the current search", async () => {
    limitMock.mockResolvedValue({ data: [alice] });
    render(<PlayerSearchBar />);
    change("Al");
    await debounce();
    fireEvent.click(screen.getByRole("link", { name: alice.fullName }), { ctrlKey: true });
    expect((screen.getByLabelText("Search players") as HTMLInputElement).value).toBe("Al");
    expect(screen.getByRole("link", { name: alice.fullName })).toBeTruthy();
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
