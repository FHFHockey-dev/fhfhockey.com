// @vitest-environment node
import { describe, expect, it } from "vitest";
import { assertSlateLiveGates, parseSlateArgs, planSlateText, rehearseSlate } from "./forge-pregame-slate";

describe("forge-pregame-slate script", () => {
  it("defaults to a network-free plan and refuses a live mode, ambiguous modes and unknown arguments", () => {
    expect(parseSlateArgs([]).mode).toBe("plan");
    expect(planSlateText(parseSlateArgs([]), 0).text).toContain("plan only");
    expect(parseSlateArgs(["--execute"]).mode).toBe("execute");
    expect(() => parseSlateArgs(["--plan", "--rehearse"])).toThrow("Choose one mode");
    expect(() => parseSlateArgs(["--rehearse", "--execute"])).toThrow("Choose one mode");
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

  it("refuses a live slate unless every gate holds, including an exact confirmed game list", () => {
    const base = parseSlateArgs(["--execute", "--games", "2026020329@2026-11-16T02:00:00Z,2026020330@2026-11-16T02:00:00Z", "--slate-date", "2026-11-15",
      "--confirm-game-ids", "2026020329,2026020330", "--approval", "t", "--code-version", "a".repeat(40), "--tsa-profile", "digicert-g4-v1",
      "--out", "/nonexistent/forge-slate-out", "--gate", __filename]);
    const env = { FORGE_PREGAME_CAPTURE_ENABLED: "true", FORGE_PREGAME_CAPTURE_APPROVAL: "t" };
    expect(() => assertSlateLiveGates(base, env)).not.toThrow();
    expect(() => assertSlateLiveGates({ ...base, confirmGameIds: [2026020329, 2026020331] }, env)).toThrow("--confirm-game-ids");
    expect(() => assertSlateLiveGates({ ...base, confirmGameIds: [2026020329, 2026020330, 2026020331] }, env)).toThrow("--confirm-game-ids");
    expect(() => assertSlateLiveGates({ ...base, concurrency: 3 }, env)).toThrow("--concurrency");
    expect(() => assertSlateLiveGates({ ...base, gate: "/nonexistent/gate.sh" }, env)).toThrow("--gate");
    expect(() => assertSlateLiveGates(base, { ...env, FORGE_PREGAME_CAPTURE_ENABLED: "false" })).toThrow("FORGE_PREGAME_CAPTURE_ENABLED");
  });

  it("rehearses a whole slate offline with no network: one outcome per game, never more than 2 in flight, no double claim", async () => {
    const result = await rehearseSlate();
    expect(result.networkAttempts).toBe(0);
    for (const c of result.cases) expect(c, c.name).toMatchObject({ ok: true, invariants: [] });
    expect(result.cases.map((c) => c.name)).toEqual(["three-simultaneous-cap-2", "mixed-failures", "crash-after-claim-and-after-save-reentry",
      "stop-on-save-unknown-pauses-later-games"]);
    // The --execute wiring on fakes: gates refuse before anything is built, the shell gate fails closed, the schedule reader
    // touches only games + roster_optimizer_team_games, receipts are written, a closed gate stops without claims.
    for (const c of result.execute) expect(c, c.name).toMatchObject({ ok: true });
    expect(result.execute.map((c) => c.name)).toEqual(["gate-refuses-enabled", "gate-refuses-confirm-ids", "gate-refuses-approval",
      "gate-refuses-code-version", "gate-refuses-out-exists", "gate-refuses-cap", "shell-gate-exit-codes", "execute-qualifies-both",
      "schedule-reads-only-two-tables", "receipt-written-metadata-only", "closed-gate-stops-without-claims", "refuses-schedule-not-as-approved"]);
    expect(result.cases[0].maxInFlight).toBe(2);
    expect(result.ok).toBe(true);
  });
});
