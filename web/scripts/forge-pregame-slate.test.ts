// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseSlateArgs, planSlateText, rehearseSlate } from "./forge-pregame-slate";

describe("forge-pregame-slate script", () => {
  it("defaults to a network-free plan and refuses a live mode, ambiguous modes and unknown arguments", () => {
    expect(parseSlateArgs([]).mode).toBe("plan");
    expect(planSlateText(parseSlateArgs([]), 0).text).toContain("plan only");
    expect(() => parseSlateArgs(["--execute"])).toThrow("no live mode");
    expect(() => parseSlateArgs(["--plan", "--rehearse"])).toThrow("Choose one mode");
    expect(() => parseSlateArgs(["--live"])).toThrow("Unknown argument");
    expect(() => parseSlateArgs(["--games", "abc"])).toThrow("Bad --games entry");
  });

  it("plans a slate: simultaneous starts staggered, a game too close to T−60 skipped", () => {
    const options = parseSlateArgs(["--games", "11@2026-11-21T00:30:00Z,12@2026-11-21T00:30:00Z,13@2026-11-21T00:30:00Z,14@2026-11-20T22:30:00Z",
      "--slate-date", "2026-11-20", "--now", "2026-11-20T21:30:00Z"]);
    const { plan, text } = planSlateText(options, options.now!);
    expect(plan!.dispatches.map((d) => d.game.gameId).sort()).toEqual([11, 12, 13]);
    expect(plan!.skipped).toEqual([expect.objectContaining({ reason: "no_time_before_t_minus_60" })]);
    expect(text).toContain("14  never_dispatched: no_time_before_t_minus_60");
  });

  it("rehearses a whole slate offline with no network: one outcome per game, never more than 2 in flight, no double claim", async () => {
    const result = await rehearseSlate();
    expect(result.networkAttempts).toBe(0);
    for (const c of result.cases) expect(c, c.name).toMatchObject({ ok: true, invariants: [] });
    expect(result.cases.map((c) => c.name)).toEqual(["three-simultaneous-cap-2", "mixed-failures", "crash-after-claim-and-after-save-reentry"]);
    expect(result.cases[0].maxInFlight).toBe(2);
    expect(result.ok).toBe(true);
  });
});
