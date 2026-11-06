import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

vi.mock("lib/supabase", () => ({
  default: { auth: { getSession: async () => ({ data: { session: { access_token: "token" } } }) } }
}));
vi.mock("next/link", () => ({ default: ({ children, href, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));

import { buildTeamDirectory, type RosterNameEntry } from "lib/sources/lineupSourceIngestion";
import { extractionFromParse, parseTweetForTrainer } from "lib/sources/tweetSwipeTrainer";
import type { TrainerCard } from "lib/sources/tweetSwipeTrainerServer";

import TweetSwipeTrainer from "./TweetSwipeTrainer";

const teams = buildTeamDirectory([{ id: 22, name: "Edmonton Oilers", abbreviation: "EDM", logo: "" }]);
const roster: RosterNameEntry[] = [
  { playerId: 1, fullName: "Zach Hyman", lastName: "Hyman", position: "L", teamId: 22 },
  { playerId: 2, fullName: "Connor McDavid", lastName: "McDavid", position: "C", teamId: 22 },
  { playerId: 3, fullName: "Leon Draisaitl", lastName: "Draisaitl", position: "C", teamId: 22 }
];

function cardFor(key: string, text: string): TrainerCard {
  const input = { text, handles: ["gamedaylines"], publishedAt: "2026-11-05T22:00:00Z", hasMedia: false };
  const parse = parseTweetForTrainer({ input, teams, rosterByTeam: new Map([[22, roster]]) });
  return {
    key, reviewItemId: key, shadowPostId: null, tweetId: "123", tweetUrl: "https://x.com/a/status/123",
    authorName: "Game Day Lines", authorHandle: "@gamedaylines", sourceAccount: "gamedaylines",
    repostedBy: "@gamedaylines", originalAuthor: "@OilersBeat", quotedAuthor: null, postKind: "repost",
    postedAt: input.publishedAt, text, quotedText: null, input, parse, extraction: extractionFromParse(parse),
    unresolvedNames: [], answerKey: null
  };
}

// jsdom has no PointerEvent, so pointer events would lose clientX and pointerId.
if (typeof window !== "undefined" && !("PointerEvent" in window)) {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
    }
  }
  (window as any).PointerEvent = PointerEventPolyfill;
}

const fetchSpy = vi.fn();
const posts = () => fetchSpy.mock.calls.filter(([, init]) => init?.method === "POST").map(([url, init]) => ({ url, body: JSON.parse(init.body) }));

beforeEach(() => {
  fetchSpy.mockImplementation(async (url: string, init?: RequestInit) => {
    if (init?.method === "POST") return { ok: true, json: async () => ({ success: true, message: "ok" }) };
    return {
      ok: true,
      json: async () => ({
        success: true,
        type: "line_combination",
        cards: [cardFor("row-1", "Oilers lines\nHyman - McDavid - Drai"), cardFor("row-2", "Oilers lines\nZach Hyman - Connor McDavid - Leon Draisaitl")],
        remainingByType: { line_combination: 2, goalie: 0 },
        players: roster.map((player) => ({ id: player.playerId, fullName: player.fullName, lastName: player.lastName, position: player.position, team_id: 22 })),
        categoryOptions: [{ category: "LINE COMBINATION", subcategories: ["FORWARD LINES"] }, { category: "OTHER", subcategories: [] }]
      })
    };
  });
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  fetchSpy.mockReset();
});

describe("TweetSwipeTrainer", () => {
  it("shows the repost's original author, the extraction and a confidence rating", async () => {
    render(<TweetSwipeTrainer />);
    expect(await screen.findByText(/Reposted by @gamedaylines · original by @OilersBeat/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Confidence \d+ of 100/ })).toBeTruthy();
    expect(screen.getByText(/^Line combination( › .+)?$/)).toBeTruthy();
    expect(screen.getByText(/EDM · NHL filter passed/)).toBeTruthy();
    expect(fetchSpy.mock.calls[0]![0]).toContain("mode=trainer");
  });

  it("saves the arrow-right verdict as correct and moves to the next card", async () => {
    render(<TweetSwipeTrainer />);
    await screen.findByText(/card 1 of 2/);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0]).toMatchObject({ url: "/api/v1/db/tweet-pattern-review", body: { action: "trainer-verdict", reviewItemId: "row-1", verdict: "correct" } });
    expect(await screen.findByText(/card 2 of 2/)).toBeTruthy();
    expect(await screen.findByText("Saved as correct. Card 2 of 2.")).toBeTruthy();
  });

  it("skips with arrow-up without saving", async () => {
    render(<TweetSwipeTrainer />);
    await screen.findByText(/card 1 of 2/);
    fireEvent.keyDown(window, { key: "ArrowUp" });
    expect(await screen.findByText(/card 2 of 2/)).toBeTruthy();
    expect(posts()).toHaveLength(0);
    expect(screen.getByText(/skipped/).textContent).toContain("1");
  });

  it("opens the correction editor on arrow-left and saves the fixed line as the answer", async () => {
    render(<TweetSwipeTrainer />);
    await screen.findByText(/card 1 of 2/);
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    const slot = await screen.findByLabelText("Line 1 LW");
    fireEvent.change(slot, { target: { value: "Zach Hyman" } });
    fireEvent.change(screen.getByLabelText("Line 1 C"), { target: { value: "Connor McDavid" } });
    fireEvent.change(screen.getByLabelText("Line 1 RW"), { target: { value: "Leon Draisaitl" } });
    fireEvent.click(screen.getByRole("button", { name: "Save correction" }));
    await waitFor(() => expect(posts()).toHaveLength(1));
    const { body } = posts()[0]!;
    expect(body).toMatchObject({ verdict: "wrong", correction: { category: "LINE COMBINATION", type: "line_combination" } });
    expect(body.correction.forwards).toEqual([[
      { playerId: 1, name: "Zach Hyman" }, { playerId: 2, name: "Connor McDavid" }, { playerId: 3, name: "Leon Draisaitl" }
    ]]);
  });

  it("swipes right from a drag that starts on a player chip, without opening its fix panel", async () => {
    render(<TweetSwipeTrainer />);
    await screen.findByText(/card 1 of 2/);
    const chip = screen.getAllByRole("button", { name: /^Fix Hyman:/ })[0]!;
    fireEvent.pointerDown(chip, { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(chip, { pointerId: 1, clientX: 160, clientY: 102 });
    fireEvent.pointerMove(chip, { pointerId: 1, clientX: 240, clientY: 104 });
    fireEvent.pointerUp(chip, { pointerId: 1, clientX: 240, clientY: 104 });
    fireEvent.click(chip);
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0]).toMatchObject({ body: { action: "trainer-verdict", reviewItemId: "row-1", verdict: "correct" } });
    expect(screen.queryByPlaceholderText("Type a player name")).toBeNull();
  });

  it("still opens the fix panel on a plain tap of a chip", async () => {
    render(<TweetSwipeTrainer />);
    await screen.findByText(/card 1 of 2/);
    const chip = screen.getAllByRole("button", { name: /^Fix Hyman:/ })[0]!;
    fireEvent.pointerDown(chip, { button: 0, pointerId: 2, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(chip, { pointerId: 2, clientX: 101, clientY: 100 });
    fireEvent.click(chip);
    expect(await screen.findByPlaceholderText("Type a player name")).toBeTruthy();
    expect(posts()).toHaveLength(0);
  });

  it("places dropped names by click, then by drag, including an extra skater, and saves them", async () => {
    render(<TweetSwipeTrainer />);
    await screen.findByText(/card 1 of 2/);
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    const tray = await screen.findByRole("group", { name: "Names to place" });
    // Click a name, then the spot.
    fireEvent.click(within(tray).getByRole("button", { name: "Zach Hyman" }));
    fireEvent.click(screen.getByLabelText("Line 1 LW: place Zach Hyman here"));
    expect((screen.getByLabelText("Line 1 LW") as HTMLInputElement).value).toBe("Zach Hyman");
    expect(within(tray).queryByRole("button", { name: "Zach Hyman" })).toBeNull();
    // Drag a name onto a spot.
    const transfer = { data: {} as Record<string, string>, types: [] as string[], effectAllowed: "", setData(type: string, value: string) { this.data[type] = value; this.types.push(type); }, getData(type: string) { return this.data[type] ?? ""; } };
    fireEvent.dragStart(within(tray).getByRole("button", { name: "Connor McDavid" }), { dataTransfer: transfer });
    fireEvent.drop(screen.getByLabelText("Line 1 C: place Connor McDavid here"), { dataTransfer: transfer });
    expect((screen.getByLabelText("Line 1 C") as HTMLInputElement).value).toBe("Connor McDavid");
    // An extra skater gets its own spot.
    fireEvent.click(within(tray).getByRole("button", { name: "Drai" }));
    fireEvent.click(screen.getByLabelText("New extra skaters spot: place Drai here"));
    fireEvent.click(screen.getByRole("button", { name: "Save correction" }));
    await waitFor(() => expect(posts()).toHaveLength(1));
    const { correction } = posts()[0]!.body;
    expect(correction.forwards[0].slice(0, 2)).toEqual([{ playerId: 1, name: "Zach Hyman" }, { playerId: 2, name: "Connor McDavid" }]);
    expect(correction.extraSkaters).toEqual([{ playerId: null, name: "Drai" }]);
  });

  it("resolves an unknown name from the editor through the alias API and swaps it into its spot", async () => {
    render(<TweetSwipeTrainer />);
    await screen.findByText(/card 1 of 2/);
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    const tray = await screen.findByRole("group", { name: "Names to place" });
    fireEvent.click(within(tray).getByRole("button", { name: "Drai" }));
    fireEvent.click(screen.getByLabelText("Line 1 RW: place Drai here"));
    const resolve = screen.getByRole("group", { name: "Resolve Drai" });
    fetchSpy.mockImplementationOnce(async () => ({ ok: true, json: async () => ({ success: true, unresolvedId: "u-9" }) }));
    // "Drai" is a surname prefix of Draisaitl, so he's offered first.
    fireEvent.click(within(resolve).getByRole("button", { name: "Leon Draisaitl" }));
    await waitFor(() => expect((screen.getByLabelText("Line 1 RW") as HTMLInputElement).value).toBe("Leon Draisaitl"));
    expect(posts().map((post) => post.body)).toEqual([
      expect.objectContaining({ action: "trainer-queue-alias", rawName: "Drai", reason: "trainer_unmatched" }),
      expect.objectContaining({ unresolvedId: "u-9", playerId: 3, alias: "Drai" })
    ]);
    expect(screen.queryByRole("group", { name: "Resolve Drai" })).toBeNull();
  });

  it("says what to do next when a type has nothing left to label", async () => {
    fetchSpy.mockImplementation(async () => ({
      ok: true,
      json: async () => ({ success: true, type: "goalie", cards: [], remainingByType: { goalie: 0 }, players: [], categoryOptions: [] })
    }));
    render(<TweetSwipeTrainer />);
    fireEvent.click(await screen.findByRole("button", { name: /Goalies/ }));
    expect(await screen.findByText(/All caught up on goalie tweets\. Pick another type above/)).toBeTruthy();
  });

  it("fixes an unmatched name through the alias API", async () => {
    render(<TweetSwipeTrainer />);
    await screen.findByText(/card 1 of 2/);
    fireEvent.click(screen.getAllByRole("button", { name: /^(Fix|Confirm or fix) Drai:/ })[0]!);
    fireEvent.change(screen.getByPlaceholderText("Type a player name"), { target: { value: "Leon Draisaitl" } });
    fetchSpy.mockImplementationOnce(async () => ({ ok: true, json: async () => ({ success: true, unresolvedId: "u-1" }) }));
    fireEvent.click(screen.getByRole("button", { name: "Save alias" }));
    await waitFor(() => expect(posts()).toHaveLength(2));
    expect(posts()[0]).toMatchObject({ body: { action: "trainer-queue-alias", rawName: "Drai", teamId: 22, reason: "trainer_unmatched" } });
    expect(posts()[1]).toMatchObject({ url: "/api/v1/db/player-name-aliases", body: { unresolvedId: "u-1", playerId: 3, alias: "Drai" } });
  });
});
