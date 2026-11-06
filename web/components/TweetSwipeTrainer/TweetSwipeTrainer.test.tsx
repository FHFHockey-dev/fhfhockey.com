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
    pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.pointerType = init.pointerType ?? "";
    }
  }
  (window as any).PointerEvent = PointerEventPolyfill;
}

const fetchSpy = vi.fn();

// Dropped names are placed by picking them; fixing one goes through "Fix this name".
function openFixFor(name: RegExp) {
  fireEvent.click(screen.getAllByRole("button", { name })[0]!);
  fireEvent.click(screen.getByRole("button", { name: "Fix this name" }));
}
const posts = () => fetchSpy.mock.calls.filter(([, init]) => init?.method === "POST").map(([url, init]) => ({ url, body: JSON.parse(init.body) }));

beforeEach(() => {
  fetchSpy.mockImplementation(async (url: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      const body = JSON.parse(String(init.body));
      // A re-read returns the same tweet with a fresh parse.
      if (body.action === "trainer-reparse") return { ok: true, json: async () => ({ success: true, card: cardFor(body.reviewItemId, "Oilers lines\nHyman - McDavid - Draisaitl") }) };
      return { ok: true, json: async () => ({ success: true, message: "ok" }) };
    }
    return {
      ok: true,
      json: async () => ({
        success: true,
        type: "line_combination",
        cards: [cardFor("row-1", "Oilers lines\nHyman - McDavid - Drai"), cardFor("row-2", "Oilers lines\nZach Hyman - Connor McDavid - Leon Draisaitl")],
        remainingByType: { line_combination: 2, goalie: 0 },
        players: [
          ...roster.map((player) => ({ id: player.playerId, fullName: player.fullName, lastName: player.lastName, position: player.position, team_id: 22 })),
          // Traded elsewhere: only "Search all players" finds him from an Oilers tweet.
          { id: 50, fullName: "Matthew Wood", lastName: "Wood", position: "R", team_id: 55 }
        ],
        teams: [
          { id: 22, abbreviation: "EDM", name: "Edmonton Oilers" },
          { id: 10, abbreviation: "TOR", name: "Toronto Maple Leafs" }
        ],
        categoryOptions: [
          { category: "LINE COMBINATION", subcategories: ["FORWARD LINES", "POWER PLAY"] },
          { category: "RETURN", subcategories: ["RETURNING TO LINEUP"] },
          { category: "OTHER", subcategories: [] }
        ]
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
    // A cold first run can take over the default 1s here.
    await waitFor(() => expect(posts()).toHaveLength(1), { timeout: 3000 });
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
    const chip = screen.getAllByRole("button", { name: /^Pick Zach Hyman to place/ })[0]!;
    fireEvent.pointerDown(chip, { button: 0, pointerId: 1, pointerType: "touch", clientX: 100, clientY: 100 });
    fireEvent.pointerMove(chip, { pointerId: 1, pointerType: "touch", clientX: 160, clientY: 102 });
    fireEvent.pointerMove(chip, { pointerId: 1, pointerType: "touch", clientX: 240, clientY: 104 });
    fireEvent.pointerUp(chip, { pointerId: 1, pointerType: "touch", clientX: 240, clientY: 104 });
    fireEvent.click(chip);
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0]).toMatchObject({ body: { action: "trainer-verdict", reviewItemId: "row-1", verdict: "correct" } });
    expect(screen.queryByPlaceholderText("Type a player name")).toBeNull();
  });

  it("does not swipe on a mouse drag, so desktop text can be selected", async () => {
    render(<TweetSwipeTrainer />);
    await screen.findByText(/card 1 of 2/);
    const text = screen.getByText(/Oilers lines/, { selector: "p" });
    fireEvent.pointerDown(text, { button: 0, pointerId: 3, pointerType: "mouse", clientX: 100, clientY: 100 });
    fireEvent.pointerMove(text, { pointerId: 3, pointerType: "mouse", clientX: 300, clientY: 100 });
    fireEvent.pointerUp(text, { pointerId: 3, pointerType: "mouse", clientX: 300, clientY: 100 });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(posts()).toHaveLength(0);
    expect(screen.getByText(/card 1 of 2/)).toBeTruthy();
  });

  it("still picks a dropped name on a plain tap, and can fix it from there", async () => {
    render(<TweetSwipeTrainer />);
    await screen.findByText(/card 1 of 2/);
    const chip = screen.getAllByRole("button", { name: /^Pick Zach Hyman to place/ })[0]!;
    fireEvent.pointerDown(chip, { button: 0, pointerId: 2, pointerType: "touch", clientX: 100, clientY: 100 });
    fireEvent.pointerUp(chip, { pointerId: 2, pointerType: "touch", clientX: 101, clientY: 100 });
    fireEvent.click(chip);
    expect(screen.getByText(/Placing/).textContent).toContain("Zach Hyman");
    fireEvent.click(screen.getByRole("button", { name: "Fix this name" }));
    expect(await screen.findByPlaceholderText("Type a player name")).toBeTruthy();
    expect(posts()).toHaveLength(0);
  });

  it("places missed names on the card's dotted spots and saves them as the answer", async () => {
    render(<TweetSwipeTrainer />);
    await screen.findByText(/card 1 of 2/);
    // Click a dropped name, then its spot.
    fireEvent.click(screen.getAllByRole("button", { name: /^Pick Zach Hyman to place/ })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Extra forwards: place Zach Hyman here" }));
    // Drag another onto the backup goalie spot.
    const transfer = { data: {} as Record<string, string>, types: [] as string[], effectAllowed: "", setData(type: string, value: string) { this.data[type] = value; this.types.push(type); }, getData(type: string) { return this.data[type] ?? ""; } };
    fireEvent.dragStart(screen.getAllByRole("button", { name: /^Pick Connor McDavid to place/ })[0]!, { dataTransfer: transfer });
    fireEvent.drop(screen.getByRole("button", { name: /^Backup goalie:/ }), { dataTransfer: transfer });
    expect(screen.getByRole("button", { name: "Remove Zach Hyman from extra forwards" })).toBeTruthy();
    // Any placement makes the verdict a correction.
    const save = screen.getAllByRole("button", { name: /Save with placements/ })[0]!;
    fireEvent.click(save);
    await waitFor(() => expect(posts()).toHaveLength(1));
    const { body } = posts()[0]!;
    expect(body).toMatchObject({ action: "trainer-verdict", verdict: "wrong" });
    expect(body.correction.extraForwards).toEqual([{ playerId: 1, name: "Zach Hyman" }]);
    expect(body.correction.goalies).toEqual([{ playerId: 2, name: "Connor McDavid" }]);
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
    fireEvent.click(screen.getByLabelText("New extra forwards spot: place Drai here"));
    fireEvent.click(screen.getByRole("button", { name: "Save correction" }));
    await waitFor(() => expect(posts()).toHaveLength(1));
    const { correction } = posts()[0]!.body;
    expect(correction.forwards[0].slice(0, 2)).toEqual([{ playerId: 1, name: "Zach Hyman" }, { playerId: 2, name: "Connor McDavid" }]);
    expect(correction.extraForwards).toEqual([{ playerId: null, name: "Drai" }]);
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

  it("records the team in a correction, starting from the parser's team", async () => {
    render(<TweetSwipeTrainer />);
    await screen.findByText(/card 1 of 2/);
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    const team = (await screen.findByLabelText("Team")) as HTMLSelectElement;
    expect(team.value).toBe("22");
    // e.g. a Leafs return tweet the parser read as a lineup with no team.
    fireEvent.change(team, { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "RETURN" } });
    fireEvent.change(screen.getByLabelText("Subcategory"), { target: { value: "RETURNING TO LINEUP" } });
    fireEvent.click(screen.getByRole("button", { name: "Save correction" }));
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0]!.body.correction).toMatchObject({ teamId: 10, category: "RETURN", subcategory: "RETURNING TO LINEUP", type: "injury" });
  });

  it("swaps the spots when the category changes: a power-play tweet clears the lines and fills PP1", async () => {
    render(<TweetSwipeTrainer />);
    await screen.findByText(/card 1 of 2/);
    fireEvent.keyDown(window, { key: "ArrowUp" });
    await screen.findByText(/card 2 of 2/);
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(((await screen.findByLabelText("Line 1 LW")) as HTMLInputElement).value).toBe("Zach Hyman");
    fireEvent.change(screen.getByLabelText("Subcategory"), { target: { value: "POWER PLAY" } });
    // The line spots are gone; the names they held fill PP1 in the order they were listed.
    expect(screen.queryByLabelText("Line 1 LW")).toBeNull();
    expect(within(screen.getByRole("region", { name: "Correct the parser's answer" })).queryByText("Goalies")).toBeNull();
    expect((screen.getByLabelText("PP1 QB") as HTMLInputElement).value).toBe("Zach Hyman");
    expect((screen.getByLabelText("PP1 LW") as HTMLInputElement).value).toBe("Connor McDavid");
    expect((screen.getByLabelText("PP1 RW") as HTMLInputElement).value).toBe("Leon Draisaitl");
    expect((screen.getByLabelText("PP2 QB") as HTMLInputElement).value).toBe("");
    // Back to lines: the PP spots clear and the parser's line returns.
    fireEvent.change(screen.getByLabelText("Subcategory"), { target: { value: "FORWARD LINES" } });
    expect(screen.queryByLabelText("PP1 QB")).toBeNull();
    expect((screen.getByLabelText("Line 1 C") as HTMLInputElement).value).toBe("Connor McDavid");
    fireEvent.change(screen.getByLabelText("Subcategory"), { target: { value: "POWER PLAY" } });
    fireEvent.click(screen.getByRole("button", { name: "Save correction" }));
    await waitFor(() => expect(posts()).toHaveLength(1));
    const { correction } = posts()[0]!.body;
    expect(correction).toMatchObject({ category: "LINE COMBINATION", subcategory: "POWER PLAY", forwards: [], defensePairs: [], goalies: [] });
    expect(correction.powerPlay).toEqual([[
      { playerId: 1, name: "Zach Hyman" }, { playerId: 2, name: "Connor McDavid" }, { playerId: 3, name: "Leon Draisaitl" }
    ]]);
  });

  it("records who came off the power play, a name the parser missed, and drops a name that isn't a player", async () => {
    render(<TweetSwipeTrainer />);
    await screen.findByText(/card 1 of 2/);
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    await screen.findByLabelText("Subcategory");
    fireEvent.change(screen.getByLabelText("Subcategory"), { target: { value: "POWER PLAY" } });
    const tray = screen.getByRole("group", { name: "Names to place" });
    // "Drai" isn't a player here: drop it from the tray.
    fireEvent.click(within(tray).getByRole("button", { name: "Drai isn't a player in this tweet" }));
    expect(within(tray).queryByRole("button", { name: "Drai" })).toBeNull();
    // A misspelt name the parser never saw: add it as written, then resolve it from a close-spelling suggestion.
    fireEvent.change(within(tray).getByLabelText("Add a name the parser missed"), { target: { value: "Draisatl" } });
    fireEvent.click(within(tray).getByRole("button", { name: "Add name" }));
    expect(within(screen.getByRole("group", { name: "Resolve Draisatl" })).getByRole("button", { name: "Leon Draisaitl" })).toBeTruthy();
    // McDavid came off the unit; Hyman joins PP2.
    fireEvent.click(within(tray).getByRole("button", { name: "Connor McDavid" }));
    fireEvent.click(screen.getByLabelText(/New off the power play spot/));
    fireEvent.click(within(tray).getByRole("button", { name: "Zach Hyman" }));
    fireEvent.click(screen.getByLabelText(/PP2 QB/));
    fireEvent.click(screen.getByRole("button", { name: "Save correction" }));
    await waitFor(() => expect(posts()).toHaveLength(1));
    const { correction } = posts()[0]!.body;
    expect(correction.offPowerPlay).toEqual([{ playerId: 2, name: "Connor McDavid" }]);
    // PP2 stays PP2 when PP1 is left empty.
    expect(correction.powerPlay).toEqual([[], [{ playerId: 1, name: "Zach Hyman" }]]);
    expect(correction.players.map((player: { name: string }) => player.name)).not.toContain("Drai");
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
    openFixFor(/^Pick “?Drai”? to place/);
    fireEvent.change(screen.getByPlaceholderText("Type a player name"), { target: { value: "Leon Draisaitl" } });
    fetchSpy.mockImplementationOnce(async () => ({ ok: true, json: async () => ({ success: true, unresolvedId: "u-1" }) }));
    fireEvent.click(screen.getByRole("button", { name: "Save alias" }));
    await waitFor(() => expect(posts()).toHaveLength(2));
    expect(posts()[0]).toMatchObject({ body: { action: "trainer-queue-alias", rawName: "Drai", teamId: 22, reason: "trainer_unmatched" } });
    expect(posts()[1]).toMatchObject({ url: "/api/v1/db/player-name-aliases", body: { unresolvedId: "u-1", playerId: 3, alias: "Drai" } });
    // The card is re-read with the new alias, so "Correct" judges the reading TJ now sees.
    await waitFor(() => expect(posts()[2]).toMatchObject({ body: { action: "trainer-reparse", reviewItemId: "row-1" } }));
    expect(await screen.findByText(/The card now shows the new reading/)).toBeTruthy();
  });

  it("offers a team-and-position alias, then 'use for this tweet only', when the alias tool refuses a shared surname", async () => {
    const defaults = fetchSpy.getMockImplementation()!;
    fetchSpy.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        if (body.action === "trainer-queue-alias") return { ok: true, json: async () => ({ success: true, unresolvedId: "u-7" }) };
        if (url === "/api/v1/db/player-name-aliases" && !body.action && body.positionGroup === "F") {
          return { ok: false, json: async () => ({ success: false, message: "This surname has multiple identities on this team and position group. Assign this occurrence instead of learning a blanket alias." }) };
        }
        if (url === "/api/v1/db/player-name-aliases" && !body.action) {
          return { ok: false, json: async () => ({ success: false, message: "This surname has multiple identities. Assign this occurrence instead of learning a blanket alias." }) };
        }
        if (body.action === "assign_occurrence") return { ok: true, json: async () => ({ success: true, message: "Assigned this occurrence to Leon Draisaitl." }) };
      }
      return defaults(url, init);
    });
    render(<TweetSwipeTrainer />);
    await screen.findByText(/card 1 of 2/);
    openFixFor(/^Pick “?Drai”? to place/);
    fireEvent.change(screen.getByPlaceholderText("Type a player name"), { target: { value: "Leon Draisaitl" } });
    fireEvent.click(screen.getByRole("button", { name: "Save alias" }));
    expect(await screen.findByText(/Learn it for EDM forwards only, or use Leon Draisaitl for this tweet only/)).toBeTruthy();
    // The narrower alias: this team's forwards. Here it's refused too, so only this tweet is left.
    fireEvent.click(screen.getByRole("button", { name: "Learn for EDM forwards only" }));
    await waitFor(() =>
      expect(posts().map((post) => post.body)).toContainEqual(
        expect.objectContaining({ unresolvedId: "u-7", playerId: 3, alias: "Drai", positionGroup: "F" })
      )
    );
    expect(await screen.findByText(/on this team and position group/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Learn for EDM forwards only" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Use for this tweet only" }));
    await waitFor(() =>
      expect(posts().map((post) => post.body)).toContainEqual(
        expect.objectContaining({ action: "assign_occurrence", unresolvedId: "u-7", playerId: 3, alias: "Drai" })
      )
    );
    expect(await screen.findByText(/Assigned this occurrence to Leon Draisaitl/)).toBeTruthy();
  });

  it("searches the tweet's team first, then all players when nobody on the team matches", async () => {
    render(<TweetSwipeTrainer />);
    await screen.findByText(/card 1 of 2/);
    openFixFor(/^Pick “?Drai”? to place/);
    const field = screen.getByRole("combobox", { name: "Player Drai means" });
    fireEvent.change(field, { target: { value: "Wood" } });
    const list = screen.getByRole("listbox");
    expect(within(list).getByText(/No EDM players match/)).toBeTruthy();
    fireEvent.click(within(list).getByRole("option", { name: "Search all players" }));
    fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: /Matthew Wood/ }));
    expect((field as HTMLInputElement).value).toBe("Matthew Wood");
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
