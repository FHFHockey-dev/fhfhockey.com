import { describe, expect, it } from "vitest";
import { resolveOfficialStarter, teamStartShare } from "./historyLedger";

const games = [1, 2, 3].map(gameId => ({ gameId, team: "NJD", date: `2026-10-0${gameId}` }));
const rows = [
  { gameId: 1, team: "NJD", date: "2026-10-01", goalieId: 1, name: "John", started: true },
  { gameId: 1, team: "NJD", date: "2026-10-01", goalieId: 2, name: "Backup", started: false },
  { gameId: 2, team: "NJD", date: "2026-10-02", goalieId: 2, name: "Backup", started: true },
  { gameId: 3, team: "NJD", date: "2026-10-03", goalieId: 1, name: "John", started: null }
];

describe("canonical goalie history", () => {
  it("separates relief from official starts and keeps unresolved games in the denominator", () => {
    const result = teamStartShare("NJD", games, rows, 10);
    expect(result).toMatchObject({ teamGames: 3, short: true, complete: false, unresolvedGames: [3] });
    expect(result.goalies).toEqual([
      { goalieId: 1, name: "John", starts: 1, reliefAppearances: 0, share: null, knownShare: 1 / 3 },
      { goalieId: 2, name: "Backup", starts: 1, reliefAppearances: 1, share: null, knownShare: 1 / 3 }
    ]);
  });
  it("sorts windows by date, independent of input order; does not mutate inputs", () => {
    const reverse = [...games].reverse();
    expect(teamStartShare("NJD", reverse, rows, 2, 1)).toMatchObject({ teamGames: 2, firstDate: "2026-10-01", lastDate: "2026-10-02", complete: true });
    expect(reverse[0].gameId).toBe(3);
  });
  it("never resolves conflicting duplicates or incomplete labels", () => {
    expect(resolveOfficialStarter([{ goalieId: 1, started: true }, { goalieId: 1, started: false }])).toBeNull();
    expect(resolveOfficialStarter([{ goalieId: 1, started: true }, { goalieId: 2, started: null }])).toBeNull();
    expect(resolveOfficialStarter([{ goalieId: 1, started: true }, { goalieId: 2, started: true }])).toBeNull();
    expect(resolveOfficialStarter([{ goalieId: 1, started: true }, { goalieId: 2, started: false }])).toBe(1);
  });
  it("does not award either conflicting starter a known portion", () => {
    const result = teamStartShare("NJD", [games[0]], [...rows.slice(0, 2), { ...rows[1], started: true }], null);
    expect(result.goalies.every(g => g.starts === 0 && g.share === null)).toBe(true);
  });
  it("rejects duplicated schedule identities and invalid windows", () => {
    expect(() => teamStartShare("NJD", [games[0], games[0]], rows, 2)).toThrow(/duplicate/i);
    expect(() => teamStartShare("NJD", games, rows, 0)).toThrow();
  });
  it("preserves a supported relief appearance even if the starter is unresolved", () => {
    const result = teamStartShare("NJD", [games[0]], [{ ...rows[0], started: null }, rows[1]], null);
    expect(result.goalies.find(g => g.goalieId === 2)).toMatchObject({ reliefAppearances: 1, starts: 0, share: null });
  });
});
