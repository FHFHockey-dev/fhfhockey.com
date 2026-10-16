// @vitest-environment node
import { describe, expect, it } from "vitest";
import { normalizeIdentityName, resolvePlayerIdentity, type PlayerIdentity } from "./playerIdentity";
import { identityMentionPresent, segmentPlayerRow } from "./tweetInterpretation";

// Synthetic identities and team IDs, not assertions about any current NHL roster.
const players: PlayerIdentity[] = [
  { playerId: 9001, fullName: "Briar Tkachuk", lastName: "Tkachuk", position: "F", teamId: 901 },
  { playerId: 9002, fullName: "Morgan Tkachuk", lastName: "Tkachuk", position: "F", teamId: 902 },
];

describe("compact single-initial player identity", () => {
  it("keeps shared normalization unchanged for saved aliases and evidence-offset consumers", () => {
    expect(normalizeIdentityName("B.Tkachuk")).toBe("btkachuk");
    expect(normalizeIdentityName("B. Tkachuk")).toBe("b tkachuk");
  });

  it("preserves a compact alias mention inside prose", () => {
    expect(identityMentionPresent("Practice: B.Tkachuk is out.", "B.Tkachuk")).toBe(true);
  });

  it.each(["B.Tkachuk", "b.tkachuk", " B.Tkachuk ", "\tB.Tkachuk\n", "B. Tkachuk", "B.\u00a0Tkachuk"])(
    "resolves %j through the initial basis", (name) => {
      expect(resolvePlayerIdentity(name, players)).toMatchObject({
        status: "matched", basis: "initial", player: { playerId: 9001 },
      });
    },
  );

  it.each(["B.Tkachuk", "B. Tkachuk"])("keeps duplicate initials ambiguous for %s", (name) => {
    const duplicate = { playerId: 9003, fullName: "Blair Tkachuk", lastName: "Tkachuk", teamId: 901 };
    expect(resolvePlayerIdentity(name, [...players, duplicate], 901)).toMatchObject({
      status: "ambiguous", candidates: [{ playerId: 9001 }, { playerId: 9003 }],
    });
  });

  it("preserves bare-surname ambiguity and does not guess an unknown initial", () => {
    expect(resolvePlayerIdentity("Tkachuk", players).status).toBe("ambiguous");
    expect(resolvePlayerIdentity("C.Tkachuk", players).status).toBe("missing_player");
    expect(resolvePlayerIdentity("BTkachuk", players).status).toBe("missing_player");
  });

  it("preserves membership scoping instead of choosing the same-surname teammate", () => {
    expect(resolvePlayerIdentity("B.Tkachuk", players, 901)).toMatchObject({ status: "matched", player: { playerId: 9001 } });
    expect(resolvePlayerIdentity("B.Tkachuk", players, 902)).toMatchObject({
      status: "conflicting_membership", candidates: [{ playerId: 9001 }],
    });
    expect(resolvePlayerIdentity("B.Tkachuk", players.map((p) => ({ ...p, teamId: null })), 901).status).toBe("conflicting_membership");
  });

  it("keeps the existing explicit-alias precedence", () => {
    const aliased = [...players, { playerId: 9004, fullName: "Fixture Alias", lastName: "Alias", aliases: ["B.Tkachuk"] }];
    expect(resolvePlayerIdentity("B.Tkachuk", aliased)).toMatchObject({ status: "matched", basis: "alias", player: { playerId: 9004 } });
  });

  it.each([
    ["J.T. Miller", "jt miller"],
    ["J.J. Moser", "jj moser"],
    ["JT Miller", "jt miller"],
    ["J.T.Miller", "jtmiller"],
    ["St.Louis", "stlouis"],
    ["Hughes.", "hughes"],
    ["Dower-Nilsson", "dower nilsson"],
    ["Émile O’Connor", "emile o'connor"],
  ])("preserves existing normalization for %s", (name, expected) => {
    expect(normalizeIdentityName(name)).toBe(expected);
  });

  it.each(["J.T. Miller", "JT Miller"])("preserves multi-initial full-name matching for %s", (name) => {
    expect(resolvePlayerIdentity(name, [{ playerId: 9010, fullName: "JT Miller", lastName: "Miller" }])).toMatchObject({
      status: "matched", basis: "full_name", player: { playerId: 9010 },
    });
  });

  it.each([
    ["B.O’Connor", "Briar O'Connor", "O'Connor"],
    ["É.Öberg", "Émile Öberg", "Öberg"],
  ])("retains accent and apostrophe handling for compact %s", (raw, fullName, lastName) => {
    expect(resolvePlayerIdentity(raw, [{ playerId: 9011, fullName, lastName }])).toMatchObject({
      status: "matched", basis: "initial", player: { playerId: 9011 },
    });
  });

  it("retains the exact compact-initial source span while segmenting a lineup row", () => {
    const text = "  B.Tkachuk-Alpha-Beta";
    const roster = [players[0]!,
      { playerId: 9020, fullName: "Fixture Alpha", lastName: "Alpha", position: "F", teamId: 901 },
      { playerId: 9021, fullName: "Fixture Beta", lastName: "Beta", position: "F", teamId: 901 },
    ];
    const hits = segmentPlayerRow(text, roster, "es_forward");
    expect(hits?.map((hit) => hit.player.playerId)).toEqual([9001, 9020, 9021]);
    expect(hits?.[0]).toMatchObject({ start: 2, end: 11, text: "B.Tkachuk" });
    for (const hit of hits ?? []) expect(text.slice(hit.start, hit.end)).toBe(hit.text);
  });
});
