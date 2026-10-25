// @vitest-environment node
import { describe, expect, it } from "vitest";
import { allocatePkMinutes, combineStrengthHeads, projectAssists, projectShorthanded, reconcileTeamAssists, shrinkRate } from "./accounting";

describe("offline assist/PPP accounting candidates", () => {
  it("uses on-ice goals and direct assist share without an own-goal or per-two-goal scale", () => {
    const result = projectAssists({ expectedOnIceGoals: 2, history: { assists: 3, onIceGoals: 10 }, prior: { mean: 0.5, exposure: 10 } });
    expect(result).toEqual({ share: 0.4, assists: 0.8 });
    expect(projectAssists({ expectedOnIceGoals: 2, history: { assists: 0, onIceGoals: 10 }, prior: null }).assists).toBe(0);
  });

  it("distinguishes absent support, observed zero and no future opportunity", () => {
    expect(shrinkRate(null, null)).toBeNull();
    expect(projectAssists({ expectedOnIceGoals: 1, history: { assists: 0, onIceGoals: 0 }, prior: null }).assists).toBeNull();
    expect(projectAssists({ expectedOnIceGoals: 0, history: null, prior: null }).assists).toBe(0);
    expect(() => projectAssists({ expectedOnIceGoals: 1, history: { assists: 2, onIceGoals: 1 }, prior: null })).toThrow();
    expect(() => shrinkRate({ events: 1, exposure: 0 }, null)).toThrow();
    expect(() => shrinkRate(null, { mean: NaN, exposure: 10 })).toThrow();
  });

  const players = [
    { id: 1, goals: 0.8, onIceGoals: 1, assists: 3 },
    { id: 2, goals: 0.1, onIceGoals: 1, assists: 1 },
    { id: 3, goals: 0.1, onIceGoals: 1, assists: 1 },
  ];
  it("reconciles to an explicit observed team A/G while respecting own-goal exclusion", () => {
    const result = reconcileTeamAssists({ completeRoster: true, teamGoals: 1, observedTeamAssistsPerGoal: 1.8, players });
    expect(result.status).toBe("ok");
    expect(result.players!.map((p) => p.assists)).toEqual([expect.closeTo(0.2), expect.closeTo(0.8), expect.closeTo(0.8)]);
    expect(result.players!.reduce((s, p) => s + p.assists, 0)).toBeCloseTo(1.8);
    for (const player of result.players!) expect(player.goals + player.assists).toBeLessThanOrEqual(player.onIceGoals);
  });

  it("does not normalize a partial roster or invent weights to meet an impossible target", () => {
    const base = { completeRoster: true, teamGoals: 1, observedTeamAssistsPerGoal: 1.8, players };
    expect(reconcileTeamAssists({ ...base, completeRoster: false })).toMatchObject({ status: "blocked", reason: "incomplete_roster" });
    expect(reconcileTeamAssists({ ...base, players: players.slice(0, 1) })).toMatchObject({ reason: "player_goals_do_not_reconcile" });
    expect(reconcileTeamAssists({ ...base, players: players.map((p) => ({ ...p, assists: null })) })).toMatchObject({ reason: "missing_assist_support" });
    expect(reconcileTeamAssists({ ...base, players: players.map((p) => ({ ...p, assists: 0 })) })).toMatchObject({ reason: "insufficient_supported_assist_capacity" });
    expect(() => reconcileTeamAssists({ ...base, observedTeamAssistsPerGoal: 2.1 })).toThrow();
  });
});

describe("offline PK/SH contribution candidate", () => {
  it("allocates an exact skater-seconds budget and removes PK from total before ES", () => {
    const result = allocatePkMinutes({ teamPkSkaterSeconds: 300, players: [
      { id: 1, totalSeconds: 1000, ppSeconds: 100, pkWeight: 1 },
      { id: 2, totalSeconds: 1200, ppSeconds: 0, pkWeight: 2 },
      { id: 3, totalSeconds: 900, ppSeconds: 200, pkWeight: 0 },
    ] })!;
    expect(result).toEqual([
      { id: 1, esSeconds: 800, ppSeconds: 100, shSeconds: 100 },
      { id: 2, esSeconds: 1000, ppSeconds: 0, shSeconds: 200 },
      { id: 3, esSeconds: 700, ppSeconds: 200, shSeconds: 0 },
    ]);
    expect(result.reduce((sum, p) => sum + p.esSeconds + p.ppSeconds + p.shSeconds, 0)).toBe(3100);
  });

  it("redistributes after capacity binding and blocks insufficient deployment support", () => {
    const players = [{ id: 1, totalSeconds: 60, ppSeconds: 0, pkWeight: 100 }, { id: 2, totalSeconds: 240, ppSeconds: 0, pkWeight: 1 }];
    expect(allocatePkMinutes({ teamPkSkaterSeconds: 200, players })!.map((p) => p.shSeconds)).toEqual([60, 140]);
    expect(allocatePkMinutes({ teamPkSkaterSeconds: 301, players })).toBeNull();
    expect(allocatePkMinutes({ teamPkSkaterSeconds: 1, players: [{ ...players[0], pkWeight: 0 }] })).toBeNull();
    expect(() => allocatePkMinutes({ teamPkSkaterSeconds: 1, players: [players[0], players[0]] })).toThrow("duplicate");
  });

  it("adds SH counts using minutes and leaves PPP exclusively power play", () => {
    const sh = projectShorthanded({ pkSeconds: 120, history: { toiSeconds: 3600, goals: 2, assists: 4, shots: 20 },
      priors: { goals: { per60: 1, minutes: 60 }, assists: { per60: 2, minutes: 60 }, shots: { per60: 10, minutes: 60 } } });
    expect(sh).toEqual({ goals: 0.05, assists: 0.1, shots: 0.5 });
    const total = combineStrengthHeads({ ES: { goals: 0.2, assists: 0.3, shots: 2 }, PP: { goals: 0.1, assists: 0.2, shots: 1 }, SH: sh });
    expect(total.G).toBeCloseTo(0.35); expect(total.A).toBeCloseTo(0.6);
    expect(total.PPP).toBeCloseTo(0.3); expect(total.SHP).toBeCloseTo(0.15); expect(total.SOG).toBe(3.5);
  });

  it("preserves missing SH heads and permits structural zero only for zero PK exposure", () => {
    const priors = { goals: null, assists: null, shots: null };
    const unknown = projectShorthanded({ pkSeconds: 60, history: null, priors });
    expect(unknown).toEqual({ goals: null, assists: null, shots: null });
    expect(projectShorthanded({ pkSeconds: 60, history: { toiSeconds: 3600, goals: null, assists: 0, shots: null }, priors }))
      .toEqual({ goals: null, assists: 0, shots: null });
    expect(projectShorthanded({ pkSeconds: 0, history: null, priors })).toEqual({ goals: 0, assists: 0, shots: 0 });
    const totals = combineStrengthHeads({ ES: { goals: 1, assists: 1, shots: 2 }, PP: { goals: 0, assists: 0, shots: 0 }, SH: unknown });
    expect(totals).toEqual({ G: null, A: null, PPP: 0, SOG: null, SHP: null });
  });
});
