// @vitest-environment node
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assertCaptureMatchesPlanV2, runForgeDailyV2 } from "./forge-daily-v2";
import { NATIVE_DAILY_APPROVED_METHODS } from "../lib/player-forecasts/nativeDailyPipelineV2";

const dirs: string[] = [];
afterEach(() => { vi.useRealTimers(); for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const files = () => {
  const dir = mkdtempSync(join(tmpdir(), "forge-daily-v2-")); dirs.push(dir);
  return { dir, write: (name: string, value: unknown) => { const path = join(dir, name), body = JSON.stringify(value); writeFileSync(path, body);
    return [path, createHash("sha256").update(body).digest("hex")]; } };
};
const WEB = "https://api-web.nhle.com/v1";
const receipt = (url: string, body: unknown = {}, capturedAt = "2026-10-21T10:50:00Z") => { const rawBody = JSON.stringify(body);
  return { url, capturedAt, rawBody, bodySha256: createHash("sha256").update(rawBody).digest("hex") }; };
const shift = (date: string, days: number) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const game = (id: number, date: string, home: [number, string], away: [number, string]) => ({ id, gameType: 2, season: 20262027,
  startTimeUTC: `${date}T23:00:00Z`, gameState: "OFF", homeTeam: { id: home[0], abbrev: home[1] }, awayTeam: { id: away[0], abbrev: away[1] } });
const weekBody = (start: string, games: Record<string, any[]> = {}) =>
  ({ gameWeek: Array.from({ length: 7 }, (_, index) => ({ date: shift(start, index), games: games[shift(start, index)] ?? [] })) });
const players = [{ playerId: 7, nhlPlayerId: 77, teamId: 1, playerClass: "skater" as const, rosterRevision: "r7" },
  { playerId: 8, nhlPlayerId: 88, teamId: 2, playerClass: "goalie" as const, rosterRevision: "r8" }];
const universe = (date: string, overrides: Record<string, unknown> = {}) => ({ version: "forge-daily-yahoo-universe-v1", date, seasonId: 20262027,
  status: "complete", ownedComplete: true, counts: { owned: 2 }, unmapped: [], ambiguous: [], membershipUnresolved: [], excluded: [], change: null,
  injury: { evidence: [] }, players: players.map(({ playerClass, ...player }) => ({ ...player, class: playerClass, universe: "owned", yahooPlayerKey: `477.p.${player.playerId}` })),
  ...overrides });
// The retained frozen-window request: templates for clubs 1 and 2, history window from 2026-09-29.
const retained = { acquisition: { seasonId: 20262027 },
  parents: [{ original: { url: `${WEB}/schedule/2026-09-29`, rawBody: JSON.stringify({ gameWeek: [{ games: [game(2026020001, "2026-09-30", [1, "AAA"], [2, "BBB"])] }] }) } }],
  participationInputs: players.map(player => ({ scope: { playerId: player.playerId, teamId: player.teamId }, history: { windowStartAt: "2026-09-29T04:00:00.000Z" } })) };
const frozenUrls = [`${WEB}/roster/AAA/20262027`, `${WEB}/roster/BBB/20262027`, `${WEB}/schedule/2026-09-29`, `${WEB}/schedule/2026-10-06`,
  `${WEB}/schedule/2026-10-21`, `${WEB}/schedule/2026-10-28`];
// Rolling for 2026-10-27: window weeks Oct 13 and Oct 20 with two final games of the universe clubs.
const rollingBodies: Record<string, unknown> = {
  [`${WEB}/schedule/2026-10-13`]: weekBody("2026-10-13", { "2026-10-14": [game(2026020101, "2026-10-14", [1, "AAA"], [3, "CCC"])] }),
  [`${WEB}/schedule/2026-10-20`]: weekBody("2026-10-20", { "2026-10-22": [game(2026020201, "2026-10-22", [2, "BBB"], [1, "AAA"])] }),
  [`${WEB}/gamecenter/2026020101/boxscore`]: { id: 2026020101 }, [`${WEB}/gamecenter/2026020201/boxscore`]: { id: 2026020201 },
  [`${WEB}/schedule/2026-10-27`]: weekBody("2026-10-27"), [`${WEB}/schedule/2026-11-03`]: weekBody("2026-11-03"),
  [`${WEB}/roster/AAA/20262027`]: { forwards: [] }, [`${WEB}/roster/BBB/20262027`]: { goalies: [] } };
const rollingOrder = Object.keys(rollingBodies);

describe("v2 capture plan equality (A-16)", () => {
  const frozen = (urls: string[], extra: Record<string, unknown> = {}) => ({ method: "frozen_window" as const, retained, universe: players, seasonId: 20262027,
    date: "2026-10-21", capture: { receipts: urls.map(url => receipt(url)), ...extra } });

  it("accepts exactly v1's frozen plan and refuses a dropped roster or week", () => {
    expect(() => assertCaptureMatchesPlanV2(frozen(frozenUrls))).not.toThrow();
    expect(() => assertCaptureMatchesPlanV2(frozen(frozenUrls.slice(1)))).toThrow("capture_differs_from_plan");
    expect(() => assertCaptureMatchesPlanV2(frozen(frozenUrls.filter(url => !url.endsWith("2026-10-21"))))).toThrow("capture_differs_from_plan");
    // With the recorded week count, a dropped last week fails as well.
    expect(() => assertCaptureMatchesPlanV2(frozen(frozenUrls, { weeks: 2, method: "frozen_window" }))).not.toThrow();
    expect(() => assertCaptureMatchesPlanV2(frozen(frozenUrls.slice(0, -1), { weeks: 2 }))).toThrow("capture_differs_from_plan");
    expect(() => assertCaptureMatchesPlanV2(frozen(frozenUrls, { method: "rolling_14d" }))).toThrow("capture_differs_from_plan");
  });

  it("accepts exactly the rolling plan and refuses a dropped boxscore or roster", () => {
    const rolling = (urls: string[]) => ({ method: "rolling_14d" as const, retained: undefined, universe: players, seasonId: 20262027, date: "2026-10-27",
      capture: { weeks: 2, receipts: urls.map(url => receipt(url, rollingBodies[url], "2026-10-27T10:50:00Z")) } });
    expect(() => assertCaptureMatchesPlanV2(rolling(rollingOrder))).not.toThrow();
    expect(() => assertCaptureMatchesPlanV2(rolling(rollingOrder.filter(url => !url.includes("2026020201"))))).toThrow("capture_differs_from_plan");
    expect(() => assertCaptureMatchesPlanV2(rolling(rollingOrder.filter(url => !url.includes("roster/BBB"))))).toThrow("capture_differs_from_plan");
    expect(() => assertCaptureMatchesPlanV2(rolling(rollingOrder.filter(url => !url.endsWith("2026-11-03"))))).toThrow("capture_differs_from_plan");
  });
});

describe("capture-v2 (A-15)", () => {
  it("plans offline by default: the rolling window schedules first, nothing fetched", async () => {
    const { dir, write } = files(), [path, sha] = write("universe.json", universe("2026-10-27")), network = vi.fn() as unknown as typeof fetch;
    const result = await runForgeDailyV2("capture-v2", ["--universe", path, "--universe-sha256", sha, "--date", "2026-10-27", "--weeks", "2", "--out", join(dir, "out")],
      undefined, { network });
    expect(result).toMatchObject({ status: "plan_only", method: "rolling_14d", requests: 2, networkRequests: 0 });
    expect(JSON.parse(readFileSync(join(dir, "out", "plan.json"), "utf8")).urls).toEqual(rollingOrder.slice(0, 2));
    expect(network).not.toHaveBeenCalled();
    await expect(runForgeDailyV2("capture-v2", ["--universe", path, "--universe-sha256", sha, "--date", "2026-10-21", "--out", join(dir, "frozen")]))
      .rejects.toThrow("capture_not_on_run_date");
  });

  it("captures window schedules, their boxscores, future weeks, then rosters, and the result matches the plan", async () => {
    // Receipts carry the capture clock, so the run happens on the run date.
    vi.useFakeTimers({ now: Date.parse("2026-10-27T10:30:00Z"), toFake: ["Date"] });
    const { dir, write } = files(), [path, sha] = write("universe.json", universe("2026-10-27")), fetched: string[] = [];
    const network = vi.fn(async (url: string | URL | Request) => { fetched.push(String(url));
      return new Response(JSON.stringify(rollingBodies[String(url)] ?? {}), { status: 200 }); }) as unknown as typeof fetch;
    const result = await runForgeDailyV2("capture-v2", ["--universe", path, "--universe-sha256", sha, "--date", "2026-10-27", "--weeks", "2",
      "--out", join(dir, "out"), "--execute", "true"], undefined, { network, wait: async () => undefined });
    expect(result).toMatchObject({ status: "captured", method: "rolling_14d", requests: 8, receipts: 8 });
    expect(fetched).toEqual(rollingOrder);
    const capture = JSON.parse(readFileSync(join(dir, "out", "receipts.json"), "utf8"));
    expect(capture).toMatchObject({ version: "forge-daily-capture-v2", method: "rolling_14d", date: "2026-10-27", weeks: 2, failures: [] });
    expect(() => assertCaptureMatchesPlanV2({ method: "rolling_14d", capture, retained: undefined, universe: players, seasonId: 20262027, date: "2026-10-27" })).not.toThrow();
  });
});

describe("inputs-v2 gates", () => {
  const run = (overrides: { universe?: unknown; means?: Record<string, unknown>; capture?: unknown; flags?: unknown; extra?: string[] } = {}) => {
    const { dir, write } = files();
    const means = { seasonId: 20262027, cutoffAt: "2026-10-21T10:40:00Z", plan: { status: "complete" }, nativeSelection: [], additionalNativeObservations: [], parents: [],
      coverage: players.map(({ playerId, nhlPlayerId, teamId }) => ({ playerId, nhlPlayerId, teamId })), ...overrides.means };
    const args = (["universe", "means", "capture", "retained"] as const).flatMap(name => {
      const value = { universe: overrides.universe ?? universe("2026-10-21"), means, capture: overrides.capture ?? { receipts: frozenUrls.map(url => receipt(url)) }, retained }[name];
      const [path, sha] = write(`${name}.json`, value); return [`--${name}`, path, `--${name}-sha256`, sha];
    });
    if (overrides.flags) { const [path, sha] = write("flags.json", overrides.flags); args.push("--flags", path, "--flags-sha256", sha); }
    return runForgeDailyV2("inputs-v2", [...args, "--date", "2026-10-21", "--out", join(dir, "out"), ...(overrides.extra ?? [])]);
  };

  it("refuses universe thresholds without a previous universe (A-13)", async () => {
    await expect(run({ flags: { universeThresholds: true } })).rejects.toThrow("universe_previous_required");
  });

  it("refuses stale, incomplete or partial fresh means (A-17)", async () => {
    await expect(run({ means: { cutoffAt: "2026-10-12T15:00:00Z" } })).rejects.toThrow("means_cutoff_not_on_run_date");
    await expect(run({ means: { plan: { status: "requests_pending" } } })).rejects.toThrow("means_plan_incomplete");
    await expect(run({ means: { coverage: [{ playerId: 7, nhlPlayerId: 77, teamId: 1 }] } })).rejects.toThrow("means_coverage_differs_from_universe:1");
    await expect(run({ means: { coverage: [] }, extra: ["--means-uncovered-ceiling", "2"] })).rejects.toThrow("means_ceiling_requires_approval_ref");
  });

  it("refuses a capture that differs from the plan before building participation (A-16)", async () => {
    await expect(run({ capture: { receipts: frozenUrls.slice(1).map(url => receipt(url)) } })).rejects.toThrow("capture_differs_from_plan");
  });
});

describe("outputs-v2 gates (A-18)", () => {
  const run = (approvalRef: string, templates: unknown, command: Record<string, unknown> = {}) => {
    const { dir, write } = files();
    const args = Object.entries({ command: { freshMeans: { scheduleRevision: "daily-schedule:x" }, ...command }, proof: { rows: [] }, templates })
      .flatMap(([name, value]) => { const [path, sha] = write(`${name}.json`, value); return [`--${name}`, path, `--${name}-sha256`, sha]; });
    return runForgeDailyV2("outputs-v2", [...args, "--approval-ref", approvalRef, "--max-null-participation", "100", "--out", join(dir, "out")]);
  };
  const policy = { entity_kind: "baseline_evaluation_policy", payload: { version: "baseline-evaluation-policy-v1", seasonId: 20262027,
    policyVersion: "native-goalie-appearance-win-rates-v1", allowedPublicUses: ["assignment", "totals", "comparison", "conditionalTieBreak"] } };

  it("accepts only the pinned standing-approval ref", async () => {
    await expect(run("replay:any-string", { rows: [policy] })).rejects.toThrow("standing_approval_ref_not_pinned");
  });

  it("refuses duplicate policy templates instead of taking the first", async () => {
    await expect(run(NATIVE_DAILY_APPROVED_METHODS.standingApprovalRef, { rows: [policy, policy] })).rejects.toThrow("fresh_means_policy_template_ambiguous");
  });

  it("refuses a split day (A-14) without its goalie closure's proof", async () => {
    await expect(run(NATIVE_DAILY_APPROVED_METHODS.standingApprovalRef, { rows: [policy] }, { goalieMaterialization: { runId: "g" } }))
      .rejects.toThrow("split_materialization_proofs_required");
  });
});
