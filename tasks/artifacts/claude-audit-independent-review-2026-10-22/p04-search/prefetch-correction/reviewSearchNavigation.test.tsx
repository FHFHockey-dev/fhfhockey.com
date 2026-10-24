import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { RouterContext } from "next/dist/shared/lib/router-context.shared-runtime";
const mocks = vi.hoisted(() => ({ from: vi.fn(), limit: vi.fn(), push: vi.fn(), prefetch: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn() }));
vi.mock("lib/supabase", () => ({ default: { from: mocks.from } }));
// Keep the installed Next router hook real; router operations are harmless spies.
// The prior no-hover/touch-prefetch oracle remains unchanged.
import PlayerSearchBar from "components/StatsPage/PlayerSearchBar";

const alice = { id: 101, fullName: "Alice Review", image_url: null, team_id: null };
const ben = { id: 102, fullName: "Ben Review", image_url: null, team_id: null };
const router: any = {
  pathname: "/stats", route: "/stats", query: {}, asPath: "/stats", basePath: "",
  isReady: true, isLocaleDomain: false, push: mocks.push, replace: mocks.replace, back: mocks.back, forward: mocks.forward,
  beforePopState: vi.fn(), prefetch: mocks.prefetch
};
function deferred() {
  let resolve!: (value: any) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<any>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const input = () => screen.getByLabelText("Search players") as HTMLInputElement;
const change = (value: string) => fireEvent.change(input(), { target: { value } });
const tick = async () => { await act(async () => { vi.advanceTimersByTime(200); }); };
const mount = () => render(<RouterContext.Provider value={router}><PlayerSearchBar /><button>Outside</button></RouterContext.Provider>);
beforeEach(() => {
  vi.useFakeTimers(); vi.resetAllMocks();
  mocks.prefetch.mockResolvedValue(undefined); mocks.push.mockResolvedValue(true);
  mocks.from.mockReturnValue({ select: () => ({ ilike: () => ({ limit: mocks.limit }) }) });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

it("keyboard-style activation pushes the selected fresh player once without replacing history", async () => {
  mocks.limit.mockResolvedValue({ data: [alice, ben], error: null });
  mount(); change("Review"); await tick();
  act(() => { input().focus(); });
  fireEvent.keyDown(input(), { key: "ArrowUp" });
  const link = screen.getByRole("link", { name: ben.fullName });
  expect(document.activeElement).toBe(link);
  fireEvent.click(link, { button: 0, detail: 0 });
  expect(mocks.push).toHaveBeenCalledTimes(1);
  expect(mocks.push.mock.calls[0][0]).toBe("/stats/player/102");
  expect(mocks.replace).not.toHaveBeenCalled();
  expect(mocks.back).not.toHaveBeenCalled();
  expect(mocks.forward).not.toHaveBeenCalled();
  expect(input().value).toBe(""); expect(screen.queryByRole("link")).toBeNull();
});

it.each(["ctrlKey", "metaKey", "shiftKey", "altKey"])("leaves %s activation to native navigation without clearing", async (modifier) => {
  mocks.limit.mockResolvedValue({ data: [alice], error: null });
  mount(); change("Alice"); await tick();
  const link = screen.getByRole("link", { name: alice.fullName });
  let prevented: boolean | undefined;
  const observe = (e: MouseEvent) => { prevented = e.defaultPrevented; e.preventDefault(); };
  document.addEventListener("click", observe, { once: true });
  fireEvent.click(link, { button: 0, [modifier]: true });
  expect(prevented).toBe(false); expect(mocks.push).not.toHaveBeenCalled();
  expect(input().value).toBe("Alice");
});

it.each(["empty", "error", "reject"])("stale %s cannot terminate newer loading or create navigable results", async (outcome) => {
  const old = deferred(); const current = deferred();
  mocks.limit.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
  mount(); change("Alice"); await tick(); change("Ben"); await tick();
  await act(async () => {
    if (outcome === "reject") old.reject(new Error("private obsolete error"));
    else old.resolve(outcome === "error" ? { data: [alice], error: new Error("obsolete") } : { data: [] });
  });
  expect(screen.getByRole("status").textContent).toBe("Searching players…");
  expect(screen.queryByRole("link")).toBeNull(); expect(mocks.push).not.toHaveBeenCalled();
  await act(async () => { current.resolve({ data: [ben], error: null }); });
  expect(screen.getByRole("link", { name: ben.fullName }).getAttribute("href")).toBe("/stats/player/102");
});

it("removes the old navigation target immediately and cancels the newer debounce on clear", async () => {
  mocks.limit.mockResolvedValueOnce({ data: [alice], error: null });
  mount(); change("Alice"); await tick();
  const old = screen.getByRole("link", { name: alice.fullName });
  change("Ben");
  expect(old.isConnected).toBe(false);
  fireEvent.keyDown(input(), { key: "ArrowDown" });
  expect(mocks.push).not.toHaveBeenCalled(); expect(screen.queryByRole("link")).toBeNull();
  change(""); await tick();
  expect(mocks.limit).toHaveBeenCalledTimes(1); expect(screen.getByRole("status").textContent).toBe("");
});

it("does not transfer pending state or navigation into a remount", async () => {
  const old = deferred(); mocks.limit.mockReturnValueOnce(old.promise);
  const view = mount(); change("Alice"); await tick(); view.unmount();
  mount(); await act(async () => { old.resolve({ data: [alice], error: null }); });
  expect(input().value).toBe(""); expect(screen.queryByRole("link")).toBeNull(); expect(mocks.push).not.toHaveBeenCalled();
});

it("keeps hover and touch from prefetching player pages", async () => {
  mocks.limit.mockResolvedValueOnce({ data: [alice], error: null });
  mount(); change("Alice"); await tick();
  const link = screen.getByRole("link", { name: alice.fullName });
  fireEvent.mouseEnter(link); fireEvent.touchStart(link);
  console.log("ROUTER_PREFETCH_OBSERVED", JSON.stringify(mocks.prefetch.mock.calls));
  expect(mocks.prefetch).not.toHaveBeenCalled();
  expect(mocks.push).not.toHaveBeenCalled();
});

it("leaves a previously prevented activation alone without clearing or navigation", async () => {
  mocks.limit.mockResolvedValueOnce({ data: [alice], error: null });
  render(<RouterContext.Provider value={router}><div onClickCapture={event => event.preventDefault()}><PlayerSearchBar /></div></RouterContext.Provider>);
  change("Alice"); await tick();
  const link = screen.getByRole("link", { name: alice.fullName });
  expect(fireEvent.click(link, { button: 0 })).toBe(false);
  expect(mocks.push).not.toHaveBeenCalled(); expect(mocks.replace).not.toHaveBeenCalled();
  expect(input().value).toBe("Alice"); expect(link.isConnected).toBe(true);
});

it("preserves middle-button native link activation without changing search or history", async () => {
  mocks.limit.mockResolvedValueOnce({ data: [alice], error: null });
  mount(); change("Alice"); await tick();
  const link = screen.getByRole("link", { name: alice.fullName });
  let prevented: boolean | undefined;
  document.addEventListener("auxclick", e => { prevented = e.defaultPrevented; e.preventDefault(); }, { once: true });
  fireEvent(link, new MouseEvent("auxclick", { button: 1, bubbles: true, cancelable: true }));
  expect(prevented).toBe(false); expect(link.getAttribute("href")).toBe("/stats/player/101");
  expect(mocks.push).not.toHaveBeenCalled(); expect(mocks.replace).not.toHaveBeenCalled();
  expect(input().value).toBe("Alice");
});

it("pointer activation prevents native duplicate navigation and pushes once", async () => {
  mocks.limit.mockResolvedValueOnce({ data: [alice], error: null });
  mount(); change("Alice"); await tick();
  const link = screen.getByRole("link", { name: alice.fullName });
  expect(link.tabIndex).toBe(0);
  expect(fireEvent.click(link, { button: 0, detail: 1 })).toBe(false);
  expect(mocks.push).toHaveBeenCalledTimes(1);
  expect(mocks.push.mock.calls[0][0]).toBe("/stats/player/101");
  expect(mocks.replace).not.toHaveBeenCalled(); expect(mocks.back).not.toHaveBeenCalled(); expect(mocks.forward).not.toHaveBeenCalled();
  expect(mocks.prefetch).not.toHaveBeenCalled(); expect(input().value).toBe("");
});
