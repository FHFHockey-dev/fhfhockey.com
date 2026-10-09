import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("next/head", () => ({ default: () => null }));
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
  await screen.findByLabelText("Lomberg");
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
    const first = order === "Lomberg first" ? lomberg : heinen;
    const second = first === lomberg ? heinen : lomberg;
    searchFor(first.lastName);
    selectPlayer(first.lastName, first.id);
    expectSelected(first.lastName, first);

    searchFor(second.lastName);
    expectSelected(first.lastName, first);
    selectPlayer(second.lastName, second.id);
    expectSelected("Lomberg", lomberg);
    expectSelected("Heinen", heinen);

    searchFor("no matching player");
    expectSelected("Lomberg", lomberg);
    expectSelected("Heinen", heinen);
    expect((screen.getByLabelText("Lomberg") as HTMLSelectElement).options).toHaveLength(2);
    expect((screen.getByLabelText("Heinen") as HTMLSelectElement).options).toHaveLength(2);
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
    selectPlayer("Lomberg", lomberg.id);
    selectPlayer("Heinen", heinen.id);
    selectPlayer("Match player", lomberg.id);
    searchFor("no matching player");

    if (control === "sidebar") fireEvent.click(screen.getByRole("button", { name: /Soucy-Andrae/ }));
    else fireEvent.change(screen.getByLabelText("Pending name"), { target: { value: "pending-1" } });

    expect((screen.getByLabelText("Match player") as HTMLSelectElement).value).toBe("");
    expect((screen.getByLabelText("Soucy") as HTMLSelectElement).value).toBe("");
    expect((screen.getByLabelText("Andrae") as HTMLSelectElement).value).toBe("");
    expect((screen.getByRole("button", { name: "Save as two players" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Save alias" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Pending name"), { target: { value: "pending-0" } });
    expect((screen.getByLabelText("Lomberg") as HTMLSelectElement).value).toBe("");
    expect((screen.getByLabelText("Heinen") as HTMLSelectElement).value).toBe("");
    expect(fetchMock.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
  });
});
