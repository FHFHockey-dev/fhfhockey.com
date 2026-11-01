import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parseShareSettings } from "./contract";
import { buildCreaseShift, colorDistance, CREASE_MIN_COLOR_DISTANCE, creaseColors, creaseShiftModule, editionCutoff, reconcileSchedule, type CreaseShiftData, type ScheduledGame } from "./creaseShift";
import type { CompletedTeamGame, GoalieAppearance } from "./shared/goalieLedger";
import { contrast, NEON_CARD } from "lib/socialShare/teamNeon";
import { teamsInfo } from "lib/teamsInfo";

const NJD = teamsInfo.NJD.id, NYR = teamsInfo.NYR.id;
const date = (index: number) => `2026-10-${String(index + 1).padStart(2, "0")}`;
const game = (team: string, index: number, gameId = 1000 + index): CompletedTeamGame => ({ gameId, date: date(index), team });
const row = (goalieId: number, team: string, index: number, started: boolean | null = true, gameId = 1000 + index): GoalieAppearance => ({
  goalieId, name: `G${goalieId}`, gameId, date: date(index), team, opponent: null, home: null, started, wins: 0, losses: 0, otLosses: 0, saves: 20, shotsAgainst: 22, goalsAgainst: 2, toiSeconds: 3600, shutouts: 0, qualityStart: 0,
});
const schedule = (games: readonly CompletedTeamGame[]): ScheduledGame[] => games.map(entry => ({ id: entry.gameId, date: entry.date, homeTeamId: teamsInfo[entry.team as "NJD"].id, awayTeamId: null })).map(entry => ({ ...entry, awayTeamId: entry.homeTeamId === NJD ? NYR : NJD }));
/** NJD games only, with NYR's side reported too, so the schedule reconciles. */
const reportBoth = (games: readonly CompletedTeamGame[]) => games.flatMap(entry => [entry, { ...entry, team: entry.team === "NJD" ? "NYR" : "NJD" }]);
const base = { teams: ["NJD"], window: 5, comparison: "previous" as const, minComparisonGames: 1, through: "2026-10-30" };
const twenty = Array.from({ length: 10 }, (_, index) => game("NJD", index));

describe("crease shift", () => {
  it("uses completed team games as the denominator, not appearances, and counts relief apart", () => {
    // Goalie 1 starts games 0-5, 7 and 9; goalie 2 starts 6 and 8 and relieves in 9.
    const appearances = [...twenty.map((_, index) => row(index === 6 || index === 8 ? 2 : 1, "NJD", index)), row(2, "NJD", 9, false)];
    const result = buildCreaseShift({ ...base, reported: reportBoth(twenty), appearances, scheduled: schedule(twenty) });
    const njd = result.data!.teams[0];
    expect(njd.games).toBe(5);
    expect(njd.startersUsed).toBe(2);
    const one = njd.goalies.find(goalie => goalie.goalieId === 1)!, two = njd.goalies.find(goalie => goalie.goalieId === 2)!;
    expect(one.starts).toBe(3);
    expect(one.share).toBe(0.6);
    expect(two.starts).toBe(2);
    expect(two.relief).toBe(1);
    expect(two.share).toBe(0.4);
    expect(one.share! + two.share!).toBe(1);
    expect(one.comparisonShare).toBe(1);
    expect(one.change).toBe(-40);
    expect(njd.shift).toBe(40);
    expect(result.state).toBe("ready");
  });
  it("binds a traded goalie's games to the team he played for", () => {
    const games = [game("NJD", 0), game("NJD", 1), game("NYR", 2, 2000), game("NYR", 3, 2001)];
    const appearances = [row(1, "NJD", 0), row(1, "NJD", 1), row(1, "NYR", 2, true, 2000), row(3, "NYR", 3, true, 2001)];
    const scheduled = [{ id: 1000, date: date(0), homeTeamId: NJD, awayTeamId: teamsInfo.PHI.id }, { id: 1001, date: date(1), homeTeamId: NJD, awayTeamId: teamsInfo.PHI.id }, { id: 2000, date: date(2), homeTeamId: NYR, awayTeamId: teamsInfo.PHI.id }, { id: 2001, date: date(3), homeTeamId: NYR, awayTeamId: teamsInfo.PHI.id }];
    const phi = scheduled.map(entry => ({ gameId: entry.id, date: entry.date, team: "PHI" }));
    const result = buildCreaseShift({ ...base, teams: ["NJD", "NYR"], window: 2, reported: [...games, ...phi], appearances, scheduled });
    const nyr = result.data!.teams.find(team => team.team === "NYR")!, njd = result.data!.teams.find(team => team.team === "NJD")!;
    expect(nyr.goalies.find(goalie => goalie.goalieId === 1)).toMatchObject({ starts: 1, share: 0.5, otherTeams: ["NJD"] });
    expect(njd.goalies.find(goalie => goalie.goalieId === 1)).toMatchObject({ starts: 2, share: 1, otherTeams: ["NYR"] });
  });
  it("withholds a window with a doubled or missing starter, and never reports its share as 0", () => {
    for (const appearances of [
      [...twenty.map((_, index) => row(1, "NJD", index)), row(2, "NJD", 9)],
      twenty.slice(0, 9).map((_, index) => row(1, "NJD", index)),
      [...twenty.slice(0, 9).map((_, index) => row(1, "NJD", index)), row(1, "NJD", 9, null)],
    ]) {
      const result = buildCreaseShift({ ...base, reported: reportBoth(twenty), appearances, scheduled: schedule(twenty) });
      const njd = result.data!.teams[0];
      expect(njd.rank).toBeNull();
      expect(njd.shift).toBeNull();
      expect(njd.withheld).toMatch(/1 of 5 window games lack exactly one labeled starter/);
      expect(njd.goalies.every(goalie => goalie.share === null && goalie.change === null)).toBe(true);
      expect(result.state).toBe("partial");
    }
  });
  it("shows a short team window at its actual count", () => {
    const games = twenty.slice(0, 7), appearances = games.map((_, index) => row(1, "NJD", index));
    const njd = buildCreaseShift({ ...base, reported: reportBoth(games), appearances, scheduled: schedule(games) }).data!.teams[0];
    expect(njd).toMatchObject({ games: 5, short: false, comparisonGames: 2, comparisonShort: true, shift: 0, rank: 1 });
    const few = buildCreaseShift({ ...base, reported: reportBoth(games.slice(0, 3)), appearances: appearances.slice(0, 3), scheduled: schedule(games.slice(0, 3)) }).data!.teams[0];
    expect(few).toMatchObject({ games: 3, short: true, comparisonGames: 0, rank: null, withheld: "No completed games in the comparison window." });
  });
  it("discloses the overlap when comparing with season to date", () => {
    const appearances = twenty.map((_, index) => row(1, "NJD", index));
    const result = buildCreaseShift({ ...base, comparison: "std", reported: reportBoth(twenty), appearances, scheduled: schedule(twenty) });
    expect(result.data!.teams[0]).toMatchObject({ comparisonGames: 10, overlap: 5 });
    expect(result.evidence.sample).toMatch(/season to date, which contains the recent games/);
  });
  it("shares a rank when changes are equal on different denominators", () => {
    // Both go from 50% to 100%: NJD on 1 of 2 comparison games, NYR on 2 of 4.
    const teamGames = (team: string, count: number, offset: number) => Array.from({ length: count }, (_, index) => game(team, index, offset + index));
    const njd = teamGames("NJD", 7, 3000), nyr = teamGames("NYR", 9, 4000);
    const appearances = [...njd.map((entry, index) => row(index === 0 ? 2 : 1, "NJD", index, true, entry.gameId)), ...nyr.map((entry, index) => row(index < 2 ? 4 : 3, "NYR", index, true, entry.gameId))];
    const result = buildCreaseShift({ ...base, teams: ["NJD", "NYR"], reported: [...njd, ...nyr], appearances, scheduled: [...njd, ...nyr].map(entry => ({ id: entry.gameId, date: entry.date, homeTeamId: teamsInfo[entry.team as "NJD"].id, awayTeamId: null })) });
    expect(result.data!.teams.map(team => [team.team, team.comparisonGames, team.shift, team.rank])).toEqual([["NJD", 2, 50, 1], ["NYR", 4, 50, 1]]);
  });
});

describe("blocks and share by game", () => {
  /** Ten games in the window, ten before, so the window's values stand alone. */
  const twentyGames = Array.from({ length: 20 }, (_, index) => game("NJD", index));
  const goalie = (team: { goalies: { goalieId: number; byGame: (number | null)[]; share: number | null }[] }, id: number) => team.goalies.find(entry => entry.goalieId === id)!;
  const run = (starter: (index: number) => number, extra: GoalieAppearance[] = [], overrides: Partial<Parameters<typeof buildCreaseShift>[0]> = {}) => buildCreaseShift({ ...base, window: 10, minComparisonGames: 1, reported: reportBoth(twentyGames), appearances: [...twentyGames.map((_, index) => row(starter(index), "NJD", index)), ...extra], scheduled: schedule(twentyGames), ...overrides }).data!;
  const render = async (data: CreaseShiftData) => {
    const Card = await creaseShiftModule.card();
    return new DOMParser().parseFromString(renderToStaticMarkup(createElement(Card, { data, logos: {}, settings: { window: "10", comparison: "previous", minComparisonGames: 1 }, snapshot: {} as never })), "text/html");
  };
  const heads = (root: Document) => [...root.querySelectorAll('[class*="head"]')].map(entry => entry.textContent);
  it("names each game's one starter, oldest to newest", () => {
    const team = run(index => index < 13 ? 1 : 2).teams[0];
    expect(team.series.map(point => point.date)).toEqual(twentyGames.slice(10).map(entry => entry.date));
    expect(team.series.map(point => point.starterId)).toEqual([1, 1, 1, 2, 2, 2, 2, 2, 2, 2]);
  });
  it("gives 100% or 0% at every game, starting at game 1", () => {
    const team = run(index => index === 11 || index >= 15 ? 2 : 1).teams[0];
    expect(goalie(team, 1).byGame).toEqual([1, 0, 1, 1, 1, 0, 0, 0, 0, 0]);
    expect(goalie(team, 2).byGame).toEqual([0, 1, 0, 0, 0, 1, 1, 1, 1, 1]);
  });
  it("does not count relief as a start", () => {
    const team = run(() => 1, [row(2, "NJD", 12, false), row(2, "NJD", 13, false)]).teams[0];
    expect(goalie(team, 2)).toMatchObject({ starts: 0, relief: 2 });
    expect(goalie(team, 2).byGame.every(value => value === 0)).toBe(true);
    expect(goalie(team, 1).byGame.every(value => value === 1)).toBe(true);
    expect(team.series.every(point => point.starterId === 1)).toBe(true);
  });
  it("binds a traded goalie's games to the team in that row", () => {
    const other = game("NYR", 11, 5000);
    const scheduled = [...twentyGames.slice(0, 4).map(entry => ({ id: entry.gameId, date: entry.date, homeTeamId: NJD, awayTeamId: null })), { id: 5000, date: other.date, homeTeamId: NYR, awayTeamId: null }];
    const both = buildCreaseShift({ ...base, teams: ["NJD", "NYR"], window: 2, minComparisonGames: 1, reported: [...twentyGames.slice(0, 4), other], appearances: [...twentyGames.slice(0, 4).map((_, index) => row(1, "NJD", index)), row(1, "NYR", 11, true, 5000)], scheduled }).data!;
    expect(both.teams.find(entry => entry.team === "NJD")!.series.map(point => point.gameId)).toEqual([1002, 1003]);
    expect(both.teams.find(entry => entry.team === "NYR")!.series.map(point => point.gameId)).toEqual([5000]);
  });
  it("never guesses: a game with no resolved starter is a gap at that game only", () => {
    for (const appearances of [
      twentyGames.map((_, index) => row(1, "NJD", index)).filter((_, index) => index !== 12),
      [...twentyGames.map((_, index) => row(1, "NJD", index)), row(2, "NJD", 12)],
    ]) {
      const team = run(() => 1, [], { appearances }).teams[0];
      expect(team.series[2]).toMatchObject({ state: "unresolved", starterId: null });
      expect(goalie(team, 1).byGame).toEqual([1, 1, null, 1, 1, 1, 1, 1, 1, 1]);
      expect(goalie(team, 1).share).toBeNull();
    }
  });
  it("marks a scheduled game with no report as an empty block, and breaks the line there", async () => {
    const data = run(() => 1, [], { reported: reportBoth(twentyGames).filter(entry => !(entry.team === "NJD" && entry.gameId === 1015)) });
    const team = data.teams.find(entry => entry.team === "NJD")!, point = team.series.findIndex(entry => entry.state === "missing");
    expect(team.series[point]).toMatchObject({ gameId: 1015, starterId: null });
    expect(team.goalies[0].byGame[point]).toBeNull();
    const root = await render({ ...data, teams: [team] }), blocks = [...root.querySelectorAll("rect[data-block]")];
    expect(blocks).toHaveLength(team.series.length);
    expect(blocks[point].getAttribute("data-block")).toBe("empty");
    expect(blocks[point].getAttribute("fill")).toBe("none");
    const line = root.querySelector('g[data-goalie="1"]')!;
    expect(line.querySelector("path")!.getAttribute("d")!.match(/M/g)).toHaveLength(2);
    expect(line.querySelectorAll("circle")).toHaveLength(team.series.length - 1);
  });
  it("colours each block by its starter with SVG attributes: G1, G2, then grey", async () => {
    const root = await render(run(index => index % 10 < 5 ? 1 : index % 10 < 8 ? 2 : 3)), colors = creaseColors("NJD");
    expect([...root.querySelectorAll("rect[data-block]")].map(block => block.getAttribute("fill"))).toEqual([...Array(5).fill(colors.g1), ...Array(3).fill(colors.g2), ...Array(2).fill("#9aa3ad")]);
    const line = (id: number) => root.querySelector(`g[data-goalie="${id}"]`)!;
    expect(line(1).querySelector("path")!.getAttribute("stroke")).toBe(colors.g1);
    expect(line(2).querySelector("path")!.getAttribute("stroke")).toBe(colors.g2);
    expect(line(3).querySelector("path")!.getAttribute("stroke-dasharray")).toBe("4 3");
    expect(line(1).getAttribute("data-values")).toBe("1,1,1,1,1,0,0,0,0,0");
    expect([...root.querySelectorAll(`[data-goalie-color="${colors.g1}"]`)].map(entry => entry.textContent)).toEqual(["G1", "50%"]);
    expect(root.querySelector("svg [class]")).toBeNull();
  });
  it("fills the chart edge to edge, with each point over its block", async () => {
    const root = await render(run(index => index < 15 ? 1 : 2)), svg = root.querySelector("svg[role=img]")!, width = Number(svg.getAttribute("width"));
    const blocks = [...svg.querySelectorAll("rect[data-block]")].map(block => ({ left: Number(block.getAttribute("x")), right: Number(block.getAttribute("x")) + Number(block.getAttribute("width")) }));
    expect(blocks).toHaveLength(10);
    expect(blocks[0].left).toBe(0);
    expect(blocks[9].right).toBeCloseTo(width);
    const line = svg.querySelector('g[data-goalie="1"]')!, d = line.querySelector("path")!.getAttribute("d")!;
    expect(d.startsWith("M0 ")).toBe(true);
    expect(d).toContain(`L${width} `);
    [...line.querySelectorAll("circle")].forEach((dot, index) => {
      const cx = Number(dot.getAttribute("cx"));
      expect(cx).toBeGreaterThan(blocks[index].left);
      expect(cx).toBeLessThan(blocks[index].right);
    });
  });
  it("keeps the legend to one line, with the full method in the evidence", async () => {
    const result = buildCreaseShift({ ...base, window: 10, minComparisonGames: 1, reported: reportBoth(twentyGames), appearances: twentyGames.map((_, index) => row(1, "NJD", index)), scheduled: schedule(twentyGames) });
    const root = await render(result.data!), note = root.querySelector("p")!;
    expect(root.querySelectorAll("p")).toHaveLength(1);
    // About 5.8px a character at 14px condensed, in 1008px.
    expect(note.textContent!.length).toBeLessThanOrEqual(170);
    expect(note.textContent).toContain("Describes past starts only");
    for (const method of ["Official starts ÷ completed team games", "no resolved starter", "relief is not a start", "guides at 0, 50 and 100%", "describes past starts only"]) expect(result.evidence.sample).toContain(method);
    expect(root.body.textContent).not.toContain("RELIEF");
    expect(root.body.textContent).not.toMatch(/probab|likely|odds|will start/i);
  });
  it("puts the real comparison span in the header when every team shown shares it", async () => {
    expect(heads(await render(run(() => 1)))).toContain("PREV 10 GP");
    const short = twentyGames.slice(0, 14), overrides = { reported: reportBoth(short), appearances: short.map((_, index) => row(1, "NJD", index)), scheduled: schedule(short) };
    const root = await render(run(() => 1, [], overrides));
    expect(heads(root)).toContain("PREV 4 GP");
    expect(root.querySelector('[data-testid="crease-shift-span"]')).toBeNull();
    expect(heads(await render(run(() => 1, [], { comparison: "std" })))).toContain("STD 20 GP");
  });
  it("prints the span per team when it varies, so one header can't mislead", async () => {
    const data = run(() => 1), root = await render({ ...data, teams: [data.teams[0], { ...data.teams[0], team: "NYR", comparisonGames: 6 }] });
    expect(heads(root)).toContain("PREV");
    expect(heads(root).some(head => /GP/.test(head ?? ""))).toBe(false);
    expect([...root.querySelectorAll('[data-testid="crease-shift-span"]')].map(entry => entry.textContent)).toEqual(["10 GP", "6 GP"]);
  });
  it("leaves out a goalie with only relief in both windows, who has no line and nothing to show", async () => {
    const root = await render(run(() => 1, [row(2, "NJD", 12, false)]));
    expect(root.querySelector('g[data-goalie="2"]')).toBeNull();
    expect(root.querySelector('g[data-goalie="1"]')).not.toBeNull();
    expect(root.body.textContent).not.toContain("G2");
  });
  it("sizes the chart to fit twelve rows in the 820px budget, and grows it for fewer", async () => {
    const height = async (count: number) => {
      const data = run(() => 1), teams = Array.from({ length: count }, (_, index) => ({ ...data.teams[0], team: `T${index}` }));
      return Number((await render({ ...data, teams })).querySelector("svg[role=img]")!.getAttribute("height"));
    };
    expect(await height(12)).toBe(60);
    expect(await height(6)).toBe(128);
    expect(await height(12) + 5).toBeLessThanOrEqual(820 / 12);
  });
});

describe("goalie colours", () => {
  it("uses primary and secondary when both read on the card and differ", () => {
    expect(creaseColors("PHI")).toMatchObject({ g1From: "primaryColor", g2From: "secondaryColor" });
    expect(creaseColors("DET")).toEqual({ g1: creaseColors("DET").g1, g2: "#ffffff", g1From: "primaryColor", g2From: "secondaryColor" });
  });
  it("lifts a dark colour to the contrast floor, keeping its hue", () => {
    const { g1, g1From } = creaseColors("TOR");
    expect(g1From).toBe("primaryColor");
    expect(g1).not.toBe(teamsInfo.TOR.primaryColor.toLowerCase());
    expect(contrast(g1, NEON_CARD)).toBeGreaterThanOrEqual(4.49);
  });
  it("skips a black primary, which lifts only to grey, and moves to the next colour", () => {
    expect(creaseColors("BOS").g1From).toBe("secondaryColor");
    expect(creaseColors("NJD")).toMatchObject({ g1From: "secondaryColor" });
    expect(creaseColors("VGK").g1From).toBe("secondaryColor");
  });
  it("moves on when primary and secondary are too close", () => {
    const { g1From, g2From } = creaseColors("MTL");
    expect([g1From, g2From]).toEqual(["primaryColor", "jersey"]);
  });
  it("keeps every team's pair legible and apart", () => {
    for (const team of Object.keys(teamsInfo)) {
      const { g1, g2 } = creaseColors(team);
      expect(contrast(g1, NEON_CARD), team).toBeGreaterThanOrEqual(4.49);
      expect(contrast(g2, NEON_CARD), team).toBeGreaterThanOrEqual(4.49);
      expect(colorDistance(g1, g2), team).toBeGreaterThanOrEqual(CREASE_MIN_COLOR_DISTANCE);
    }
  });
});

describe("minimum comparison games", () => {
  const games = (count: number) => Array.from({ length: count }, (_, index) => game("NJD", index));
  /** Goalie 2 starts only before the recent window, so any comparison shows a real shift. */
  const run = (count: number, minComparisonGames: number, comparison: "previous" | "std" = "previous") => {
    const list = games(count), appearances = list.map((_, index) => row(index === 0 ? 2 : 1, "NJD", index));
    return buildCreaseShift({ ...base, comparison, minComparisonGames, reported: reportBoth(list), appearances, scheduled: schedule(list) });
  };
  it("ranks a team at exactly the minimum and not one game under it", () => {
    expect(run(10, 5).data!.teams[0]).toMatchObject({ comparisonGames: 5, shortComparison: false, shift: 20, rank: 1, withheld: null });
    const short = run(9, 5);
    expect(short.data!.teams[0]).toMatchObject({ comparisonGames: 4, shortComparison: true, shift: null, rank: null, withheld: "Only 4 comparison games outside the window, under the minimum of 5." });
    expect(short.data!.teams[0].goalies.every(goalie => goalie.change === null)).toBe(true);
    expect(short.evidence.cohort).toBe("0 of 1 teams ranked; 1 short comparison");
    expect(creaseShiftModule.hasRows(short.data, { window: "5", comparison: "previous", minComparisonGames: 5 })).toBe(false);
  });
  it("never ranks a 1-game comparison at the default, however large the swing", () => {
    const team = run(6, 5).data!.teams[0];
    expect(team.goalies.find(goalie => goalie.goalieId === 2)).toMatchObject({ comparisonShare: 1, change: null });
    expect(team).toMatchObject({ comparisonGames: 1, shift: null, rank: null });
    expect(run(6, 1).data!.teams[0]).toMatchObject({ shift: 100, rank: 1 });
  });
  it("counts only games outside the window for season to date, which contains the recent games", () => {
    const at = run(10, 5, "std").data!.teams[0];
    expect(at).toMatchObject({ comparisonGames: 10, overlap: 5, shortComparison: false, rank: 1 });
    const under = run(9, 5, "std").data!.teams[0];
    expect(under).toMatchObject({ comparisonGames: 9, overlap: 5, shortComparison: true, shift: null, rank: null });
    expect(under.withheld).toBe("Only 4 comparison games outside the window, under the minimum of 5.");
  });
  it("does not count a team with no games as short, and names the cohort when some are", () => {
    const list = games(10), appearances = list.map((_, index) => row(1, "NJD", index));
    const result = buildCreaseShift({ ...base, teams: ["NJD", "PHI"], minComparisonGames: 5, reported: reportBoth(list), appearances, scheduled: schedule(list) });
    expect(result.evidence.cohort).toBe("1 of 2 teams ranked; 0 short comparison");
  });
  it("defaults to 5 and leaves the window at L10", () => {
    expect(parseShareSettings(creaseShiftModule, {})).toEqual({ window: "10", comparison: "previous", minComparisonGames: 5 });
    expect(() => parseShareSettings(creaseShiftModule, { minComparisonGames: "0" })).toThrow();
  });
  const render = async (result: ReturnType<typeof run>) => {
    const Card = await creaseShiftModule.card();
    return renderToStaticMarkup(createElement(Card, { data: result.data, logos: {}, settings: { window: "5", comparison: "previous", minComparisonGames: 5 }, snapshot: {} as never }));
  };
  it("shows short teams only as a count in the note", async () => {
    const list = games(10), other = Array.from({ length: 6 }, (_, index) => game("NYR", index, 2000 + index));
    const appearances = [...list.map((_, index) => row(index === 0 ? 2 : 1, "NJD", index)), ...other.map((entry, index) => row(9, "NYR", index, true, entry.gameId))];
    const scheduled = [...list, ...other].map(entry => ({ id: entry.gameId, date: entry.date, homeTeamId: teamsInfo[entry.team as "NJD"].id, awayTeamId: null }));
    const result = buildCreaseShift({ ...base, teams: ["NJD", "NYR"], minComparisonGames: 5, reported: [...list, ...other], appearances, scheduled });
    const html = await render(result);
    expect(html).not.toContain("G9");
    expect(html).not.toContain("NYR");
    expect(result.evidence.cohort).toBe("1 of 2 teams ranked; 1 short comparison");
  });
  it("puts unresolved teams and the fine print in the evidence, with one note line on the card", async () => {
    const list = games(10), appearances = list.slice(0, 9).map((_, index) => row(1, "NJD", index));
    const result = buildCreaseShift({ ...base, minComparisonGames: 1, reported: reportBoth(list), appearances, scheduled: schedule(list) });
    expect(result.evidence.sample).toContain("Unranked: NJD");
    expect(result.evidence.sample).toContain("relief is not a start");
    const full = run(10, 5), root = new DOMParser().parseFromString(await render(full), "text/html");
    expect(root.querySelectorAll("p")).toHaveLength(1);
    expect(root.body.textContent).not.toMatch(/Showing|Unranked/);
  });
  it("uses larger type when few teams rank, and fills the rows at any count", async () => {
    const root = new DOMParser().parseFromString(await render(run(10, 5)), "text/html");
    expect(root.querySelector('[data-testid="crease-shift-card"]')!.getAttribute("data-size")).toBe("large");
    expect(root.querySelector('[class*="table"], div[style]')!.getAttribute("style")).toContain("repeat(1, minmax(min-content, 1fr))");
  });
  it("uses the honest empty state when nothing qualifies", async () => {
    expect(await render(run(9, 5))).toContain("No team has both windows resolved");
  });
});

describe("schedule reconciliation", () => {
  it("compares team games with the schedule, and one missing team game is partial", () => {
    const appearances = twenty.map((_, index) => row(1, "NJD", index)), reported = reportBoth(twenty).slice(0, -1);
    expect(reconcileSchedule(schedule(twenty), reported)).toMatchObject({ scheduledGames: 10, expected: 20, observed: 19, missing: 1 });
    const result = buildCreaseShift({ ...base, reported, appearances, scheduled: schedule(twenty) });
    expect(result.state).toBe("partial");
    expect(result.reasons?.[0]).toMatch(/1 of 20 scheduled team games/);
    expect(result.evidence.coverage).toEqual({ observed: 19, expected: 20, missing: 1, unit: "team games" });
  });
  it("drops a reported game the regular-season schedule does not list", () => {
    const preseason = { gameId: 9, date: "2026-09-20", team: "NJD" };
    expect(reconcileSchedule(schedule(twenty), [...reportBoth(twenty), preseason]).games).toHaveLength(20);
  });
  it("runs through yesterday in New York", () => {
    expect(editionCutoff("2026-11-01T02:00:00Z")).toBe("2026-10-30");
  });
});

describe("crease shift card", () => {
  const appearances = twenty.map((_, index) => row(index < 7 ? 1 : 2, "NJD", index));
  const load = buildCreaseShift({ ...base, reported: reportBoth(twenty), appearances, scheduled: schedule(twenty) });
  const render = async (data: CreaseShiftData) => {
    const Card = await creaseShiftModule.card();
    return renderToStaticMarkup(createElement(Card, { data, logos: {}, settings: { window: "5", comparison: "previous", minComparisonGames: 1 }, snapshot: {} as never }));
  };
  it("names official starts and team games, and claims nothing about the next start", async () => {
    const html = await render(load.data!);
    expect(load.evidence.sample).toContain("Official starts ÷ completed team games");
    expect(html).toContain("60%");
    expect(html).not.toMatch(/probab|likely|odds|expected to start|will start|appearance share/i);
    expect(creaseShiftModule.altText({ evidence: load.evidence } as never, load.data, { window: "5", comparison: "previous", minComparisonGames: 1 })).not.toMatch(/probab|likely|odds|will start/i);
  });
  it("has nothing to export when no team resolves", async () => {
    const empty = buildCreaseShift({ ...base, reported: [], appearances: [], scheduled: [] });
    expect(creaseShiftModule.hasRows(empty.data, { window: "5", comparison: "previous", minComparisonGames: 1 })).toBe(false);
    expect(await render(empty.data!)).toContain("No team has both windows resolved");
  });
  it("leaves the appearance pie alone: this post reads no appearance share", () => {
    expect(readFileSync("lib/socialShare/modules/creaseShift.ts", "utf8")).not.toMatch(/goalieWorkload|GoalieShareChart"/);
  });
});
