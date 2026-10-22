import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("next/head", () => ({ default: () => null }));
vi.mock("contexts/AuthProviderContext", () => ({
  useAuth: () => ({ isLoading: false, user: { id: "admin", role: "admin" } })
}));
vi.mock("lib/supabase", () => ({
  default: { auth: { getSession: async () => ({ data: { session: null } }) } }
}));

import PlayerAliasesPage from "pages/db/player-aliases";

const lomberg = { id: 8479066, fullName: "Ryan Lomberg", lastName: "Lomberg", position: "L", team_id: 29 };
const heinen = { id: 8478046, fullName: "Danton Heinen", lastName: "Heinen", position: "L", team_id: 29 };
const unresolvedNames = ["Lomberg-Heinen", "Soucy-Andrae"].map((raw_name, index) => ({
  id: `pending-${index}`, raw_name, normalized_name: raw_name.toLowerCase(),
  team_id: 29, team_abbreviation: "CBJ", source: "fixture", source_url: null,
  tweet_id: null, context_text: raw_name, status: "pending", metadata: null,
  created_at: "2026-09-30T16:37:00Z"
}));
const fetchMock = vi.fn();

function searchFor(value: string) {
  fireEvent.change(screen.getByLabelText("Search all players by name or NHL ID"), { target: { value } });
}

function selectPlayer(label: string, id: number) {
  fireEvent.change(screen.getByLabelText(label), { target: { value: String(id) } });
}

function expectSelected(label: string, player: typeof lomberg) {
  const select = screen.getByLabelText(label) as HTMLSelectElement;
  expect(select.value).toBe(String(player.id));
  expect(select.selectedOptions[0]?.textContent).toContain(player.fullName);
  expect(Array.from(select.options).filter((option) => option.value === String(player.id))).toHaveLength(1);
}

async function openPage() {
  render(<PlayerAliasesPage />);
  await screen.findByLabelText("Match player");
}

function openSplit(firstAlias = "Lomberg", secondAlias = "Heinen") {
  fireEvent.click(screen.getByRole("button", { name: "Assign two players" }));
  fireEvent.change(screen.getByLabelText("Alias 1"), { target: { value: firstAlias } });
  fireEvent.change(screen.getByLabelText("Alias 2"), { target: { value: secondAlias } });
}

async function expectPost(body: Record<string, unknown>) {
  await waitFor(() => {
    const posts = fetchMock.mock.calls.filter(([, options]) => options?.method === "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0][0]).toBe("/api/v1/db/player-name-aliases");
    expect(JSON.parse(posts[0][1].body)).toEqual(body);
  });
}

describe("player alias selection across searches", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/db/player-aliases");
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, unresolvedNames, players: [lomberg, heinen] })
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it.each(["Lomberg first", "Heinen first"])("retains both split selections and submits their IDs: %s", async (order) => {
    await openPage();
    openSplit();
    const first = order === "Lomberg first" ? lomberg : heinen;
    const second = first === lomberg ? heinen : lomberg;
    searchFor(first.lastName);
    const firstLabel = first === lomberg ? "Player 1" : "Player 2";
    const secondLabel = second === lomberg ? "Player 1" : "Player 2";
    selectPlayer(firstLabel, first.id);
    expectSelected(firstLabel, first);

    searchFor(second.lastName);
    expectSelected(firstLabel, first);
    selectPlayer(secondLabel, second.id);
    expectSelected("Player 1", lomberg);
    expectSelected("Player 2", heinen);

    searchFor("no matching player");
    expectSelected("Player 1", lomberg);
    expectSelected("Player 2", heinen);
    expect((screen.getByLabelText("Player 1") as HTMLSelectElement).options).toHaveLength(2);
    expect((screen.getByLabelText("Player 2") as HTMLSelectElement).options).toHaveLength(2);
    const save = screen.getByRole("button", { name: "Save as two players" }) as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    await expectPost({ unresolvedId: "pending-0", action: "split", parts: [
      { alias: "Lomberg", playerId: lomberg.id }, { alias: "Heinen", playerId: heinen.id }
    ] });
  });

  it("retains the individual selection when another player or no players match and submits its ID", async () => {
    await openPage();
    searchFor("Lomberg");
    selectPlayer("Match player", lomberg.id);
    searchFor("Heinen");
    expectSelected("Match player", lomberg);
    searchFor("no matching player");
    expectSelected("Match player", lomberg);
    searchFor("");
    expectSelected("Match player", lomberg);
    searchFor("no matching player");
    fireEvent.click(screen.getByRole("button", { name: "Save alias" }));
    await expectPost({ unresolvedId: "pending-0", playerId: lomberg.id, importNhlIdentity: false, alias: "Lomberg-Heinen" });
  });

  it.each(["sidebar", "pending-name dropdown"])("clears individual and split selections when switching via %s", async (control) => {
    await openPage();
    selectPlayer("Match player", lomberg.id);
    openSplit();
    selectPlayer("Player 1", lomberg.id);
    selectPlayer("Player 2", heinen.id);
    searchFor("no matching player");

    if (control === "sidebar") fireEvent.click(screen.getByRole("button", { name: /Soucy-Andrae/ }));
    else fireEvent.change(screen.getByLabelText("Pending name"), { target: { value: "pending-1" } });

    expect((screen.getByLabelText("Match player") as HTMLSelectElement).value).toBe("");
    expect(screen.queryByLabelText("Player 1")).toBeNull();
    expect((screen.getByRole("button", { name: "Save alias" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Pending name"), { target: { value: "pending-0" } });
    openSplit();
    expect((screen.getByLabelText("Player 1") as HTMLSelectElement).value).toBe("");
    expect((screen.getByLabelText("Player 2") as HTMLSelectElement).value).toBe("");
    expect(fetchMock.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
  });

  it.each(["Zucker  Grzelcyk", "Zucker-Grzelcyk", "Zucker – Grzelcyk", "Zucker—Grzelcyk"])("assigns explicit separate aliases regardless of punctuation: %s", async (raw_name) => {
    window.history.replaceState({}, "", "/db/player-aliases?unresolvedId=pending-0&reviewToken=review-fixture");
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true, unresolvedNames: [{ ...unresolvedNames[0], raw_name }], players: [lomberg, heinen] }) });
    await openPage();
    openSplit(" Zucker ", "Grzelcyk");
    selectPlayer("Player 1", lomberg.id);
    selectPlayer("Player 2", heinen.id);
    fireEvent.click(screen.getByRole("button", { name: "Save as two players" }));
    await expectPost({ unresolvedId: "pending-0", action: "split", reviewToken: "review-fixture", parts: [
      { alias: "Zucker", playerId: lomberg.id }, { alias: "Grzelcyk", playerId: heinen.id },
    ] });
  });

  it("keeps compound surnames intact until the reviewer explicitly enters separate aliases", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true, unresolvedNames: [{ ...unresolvedNames[0], raw_name: "Aube-Kubel" }], players: [lomberg, heinen] }) });
    await openPage();
    expect((screen.getByLabelText("Alias to save") as HTMLInputElement).value).toBe("Aube-Kubel");
    expect(screen.queryByRole("button", { name: "Save as two players" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Assign two players" }));
    expect((screen.getByLabelText("Alias 1") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Alias 2") as HTMLInputElement).value).toBe("");
    selectPlayer("Player 1", lomberg.id);
    selectPlayer("Player 2", heinen.id);
    expect((screen.getByRole("button", { name: "Save as two players" }) as HTMLButtonElement).disabled).toBe(true);
    expect(fetchMock.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
  });

  it("prevents assigning the same player twice", async () => {
    await openPage();
    openSplit();
    selectPlayer("Player 1", lomberg.id);
    selectPlayer("Player 2", lomberg.id);
    expect(screen.getByRole("alert").textContent).toBe("Choose two different players.");
    expect((screen.getByRole("button", { name: "Save as two players" }) as HTMLButtonElement).disabled).toBe(true);
    expect(fetchMock.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
  });

  it("shows a persisted identity and retains the chosen queue item after save/reload", async () => {
    let saved = false;
    fetchMock.mockImplementation(async (_url, options) => {
      if (options?.method === "POST") { saved = true; return { ok: true, json: async () => ({ success: true, message: "Identity saved; membership needs review." }) }; }
      return { ok: true, json: async () => ({ success: true, players: [lomberg, heinen], unresolvedNames: [unresolvedNames[0], {
        ...unresolvedNames[1], ...(saved ? { resolved_player_id: heinen.id, resolved_alias_id: "saved-alias", metadata: { identityResolved: true, reviewKind: "missing_membership", savedAlias: "Heiny" } } : {}),
      }] }) };
    });
    await openPage();
    fireEvent.change(screen.getByLabelText("Pending name"), { target: { value: "pending-1" } });
    selectPlayer("Match player", heinen.id);
    fireEvent.change(screen.getByLabelText("Alias to save"), { target: { value: "Heiny" } });
    fireEvent.click(screen.getByRole("button", { name: "Save alias" }));
    await screen.findByText(/Alias saved for Danton Heinen/);
    expect((screen.getByLabelText("Pending name") as HTMLSelectElement).value).toBe("pending-1");
    expectSelected("Match player", heinen);
    expect((screen.getByLabelText("Alias to save") as HTMLInputElement).value).toBe("Heiny");
    expect(screen.getByText(/you do not need to assign these identities again/)).toBeTruthy();
    expect(screen.getByLabelText("2 names remaining")).toBeTruthy();
  });

  it("retains both saved split aliases and identities after a membership-pending reload", async () => {
    let saved = false;
    fetchMock.mockImplementation(async (_url, options) => {
      if (options?.method === "POST") { saved = true; return { ok: true, json: async () => ({ success: true }) }; }
      return { ok: true, json: async () => ({ success: true, players: [lomberg, heinen], unresolvedNames: [{ ...unresolvedNames[0], ...(saved ? {
        resolved_player_id: lomberg.id, metadata: { identityResolved: true, reviewKind: "missing_membership", splitPlayerIds: [lomberg.id, heinen.id], splitAliases: ["Lomby", "Heiny"] },
      } : {}) }] }) };
    });
    await openPage();
    openSplit("Lomby", "Heiny");
    selectPlayer("Player 1", lomberg.id);
    selectPlayer("Player 2", heinen.id);
    fireEvent.click(screen.getByRole("button", { name: "Save as two players" }));
    await screen.findByText(/Aliases saved for Ryan Lomberg and Danton Heinen/);
    expectSelected("Player 1", lomberg);
    expectSelected("Player 2", heinen);
    expect((screen.getByLabelText("Alias 1") as HTMLInputElement).value).toBe("Lomby");
    expect((screen.getByLabelText("Alias 2") as HTMLInputElement).value).toBe("Heiny");
  });

  it("removes a resolved supported-membership item from the reloaded pending queue", async () => {
    let saved = false;
    fetchMock.mockImplementation(async (_url, options) => {
      if (options?.method === "POST") { saved = true; return { ok: true, json: async () => ({ success: true }) }; }
      return { ok: true, json: async () => ({ success: true, players: [lomberg, heinen], unresolvedNames: saved ? [unresolvedNames[1]] : unresolvedNames }) };
    });
    await openPage();
    selectPlayer("Match player", lomberg.id);
    fireEvent.click(screen.getByRole("button", { name: "Save alias" }));
    await screen.findByLabelText("1 names remaining");
    expect((screen.getByLabelText("Pending name") as HTMLSelectElement).value).toBe("pending-1");
    expect(screen.queryByRole("button", { name: /Lomberg-Heinen/ })).toBeNull();
  });

  it("highlights only the exact repeated Hughes occurrence and shows its source-role preference without selecting it", async () => {
    const jack = { id: 8481559, fullName: "Jack Hughes", lastName: "Hughes", position: "C", team_id: 1 };
    const luke = { id: 8482684, fullName: "Luke Hughes", lastName: "Hughes", position: "D", team_id: 1 };
    const text = "Mantha - Hughes - Bratt\nHughes - Pesce\nJ. Hughes is not on the ice.";
    const start = text.indexOf("Hughes - Pesce");
    const row = { ...unresolvedNames[0], raw_name: "Hughes", context_text: text, team_id: 1, metadata: { evidence: { start, end: start + 6 }, situation: "es_defense", sourceOrdinal: 1, candidates: [jack.id, luke.id] }, review: {
      sourceDate: "2026-10-06", seasonId: 20262027, candidates: [jack, luke], preferredPlayerId: luke.id, ambiguousSurname: true, preferenceReason: "Parsed defense pair favors this candidate. Review before assigning.", scopeMessage: "Dated team candidates.",
    } };
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true, unresolvedNames: [row], players: [jack, luke] }) });
    await openPage();
    const mark = screen.getByLabelText("Selected unresolved occurrence");
    expect(mark.textContent).toBe("Hughes");
    expect(mark.parentElement?.querySelectorAll("mark")).toHaveLength(1);
    expect(mark.previousSibling?.textContent).toBe(text.slice(0, start));
    const match = screen.getByLabelText("Match player") as HTMLSelectElement;
    expect(match.options[1].textContent).toContain("Luke Hughes");
    expect(match.value).toBe("");
    expect((screen.getByRole("button", { name: "Assign this occurrence" }) as HTMLButtonElement).disabled).toBe(true);
    selectPlayer("Match player", luke.id);
    fireEvent.click(screen.getByRole("button", { name: "Assign this occurrence" }));
    await expectPost({ unresolvedId: "pending-0", action: "assign_occurrence", playerId: luke.id, importNhlIdentity: false, alias: "Hughes" });
  });

  it("preserves the exact B. Tkachuk token and initial in the alias submission", async () => {
    const text = "B. Tkachuk - Eller - Reinhart\nVerhaeghe - Bennett - M. Tkachuk";
    const start = text.indexOf("Tkachuk");
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true, unresolvedNames: [{ ...unresolvedNames[0], raw_name: "Tkachuk", context_text: text, metadata: { evidence: { start, end: start + 7 } } }], players: [lomberg, heinen] }) });
    await openPage();
    expect(screen.getByLabelText("Selected unresolved occurrence").textContent).toBe("B. Tkachuk");
    expect((screen.getByLabelText("Alias to save") as HTMLInputElement).value).toBe("B. Tkachuk");
    selectPlayer("Match player", lomberg.id);
    fireEvent.click(screen.getByRole("button", { name: "Save alias" }));
    await expectPost({ unresolvedId: "pending-0", playerId: lomberg.id, importNhlIdentity: false, alias: "B. Tkachuk" });
  });

  it("discloses repeated legacy occurrences without highlighting or permitting a guessed assignment", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true, unresolvedNames: [{ ...unresolvedNames[0], raw_name: "Hughes", context_text: "Mantha - Hughes - Bratt\nHughes - Pesce", metadata: { candidates: [1, 2] } }], players: [lomberg, heinen] }) });
    await openPage();
    expect(screen.queryByLabelText("Selected unresolved occurrence")).toBeNull();
    expect(screen.getByLabelText("Possible unresolved occurrences").querySelectorAll("li")).toHaveLength(2);
    expect(screen.getByText(/none is highlighted/)).toBeTruthy();
    selectPlayer("Match player", lomberg.id);
    expect((screen.getByRole("button", { name: "Assign this occurrence" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("uses a disclosed defense-row fallback without assuming four forward lines", async () => {
    const text = "Lineup\nMantha - Hughes - Bratt\n\nHughes - Pesce";
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true, unresolvedNames: [{ ...unresolvedNames[0], raw_name: "Hughes", context_text: text, metadata: { reason: "pair_1_null_id" } }], players: [lomberg, heinen] }) });
    await openPage();
    const mark = screen.getByLabelText("Selected unresolved occurrence");
    expect(mark.previousSibling?.textContent).toBe("Lineup\nMantha - Hughes - Bratt\n\n");
    expect(screen.getByText(/Contextual row fallback/)).toBeTruthy();
  });
});
