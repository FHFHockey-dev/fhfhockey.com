import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parseShareSettings } from "./contract";
import { buildCreaseShift, colorDistance, CREASE_MIN_COLOR_DISTANCE, creaseColors, creaseShiftModule, creaseShiftShown, creaseShiftWords, editionCutoff, reconcileSchedule, type CreaseShiftData, type ScheduledGame } from "./creaseShift";
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
/** Each game against PHI, with PHI's side reported too, so every night reconciles and none reads as late. */
const vsPhi = (games: readonly CompletedTeamGame[]) => ({ scheduled: games.map(entry => ({ id: entry.gameId, date: entry.date, homeTeamId: teamsInfo[entry.team as "NJD"].id, awayTeamId: teamsInfo.PHI.id })), reported: [...games, ...games.map(entry => ({ ...entry, team: "PHI" }))] });
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
    expect(result.evidence.sample).toMatch(/SEASON is the season to date, which contains the recent games/);
  });
  it("shares a rank when changes are equal on different denominators", () => {
    // Both go from 50% to 100%: NJD on 1 of 2 comparison games, NYR on 2 of 4.
    const teamGames = (team: string, count: number, offset: number) => Array.from({ length: count }, (_, index) => game(team, index, offset + index));
    const njd = teamGames("NJD", 7, 3000), nyr = teamGames("NYR", 9, 4000);
    const appearances = [...njd.map((entry, index) => row(index === 0 ? 2 : 1, "NJD", index, true, entry.gameId)), ...nyr.map((entry, index) => row(index < 2 ? 4 : 3, "NYR", index, true, entry.gameId))];
    const result = buildCreaseShift({ ...base, teams: ["NJD", "NYR"], appearances, ...vsPhi([...njd, ...nyr]) });
    expect(result.data!.teams.map(team => [team.team, team.comparisonGames, team.shift, team.rank])).toEqual([["NJD", 2, 50, 1], ["NYR", 4, 50, 1]]);
  });
});

describe("blocks and running share", () => {
  /** Ten games in the window, ten before, so the window's values stand alone. */
  const twentyGames = Array.from({ length: 20 }, (_, index) => game("NJD", index));
  const goalie = (team: { goalies: { goalieId: number; runningShare: (number | null)[]; share: number | null }[] }, id: number) => team.goalies.find(entry => entry.goalieId === id)!;
  const run = (starter: (index: number) => number, extra: GoalieAppearance[] = [], overrides: Partial<Parameters<typeof buildCreaseShift>[0]> = {}) => buildCreaseShift({ ...base, window: 10, minComparisonGames: 1, reported: reportBoth(twentyGames), appearances: [...twentyGames.map((_, index) => row(starter(index), "NJD", index)), ...extra], scheduled: schedule(twentyGames), ...overrides }).data!;
  const render = async (data: CreaseShiftData) => {
    const Card = await creaseShiftModule.card();
    return new DOMParser().parseFromString(renderToStaticMarkup(createElement(Card, { data, logos: {}, settings: { window: 10, comparison: "previous", minComparisonGames: 1, teams: "" }, snapshot: {} as never })), "text/html");
  };
  const heads = (root: Document) => [...root.querySelectorAll('[class*="head"]')].map(entry => entry.textContent);
  it("names each game's one starter, oldest to newest", () => {
    const team = run(index => index < 13 ? 1 : 2).teams[0];
    expect(team.series.map(point => point.date)).toEqual(twentyGames.slice(10).map(entry => entry.date));
    expect(team.series.map(point => point.starterId)).toEqual([1, 1, 1, 2, 2, 2, 2, 2, 2, 2]);
  });
  it("matches TJ's VAN example, LMMLMLMMMM, at every game", async () => {
    const earlier = Array.from({ length: 10 }, (_, index) => game("VAN", index)), order = [..."LMMLMLMMMM"], games = [...earlier, ...order.map((_, index) => game("VAN", index + 10))];
    const appearances = games.map((entry, index) => row(index < 10 || order[index - 10] === "L" ? 1 : 2, "VAN", index));
    const data = buildCreaseShift({ ...base, teams: ["VAN"], window: 10, minComparisonGames: 5, appearances, ...vsPhi(games) }).data!, team = data.teams[0];
    const percents = (id: number) => goalie(team, id).runningShare.map(value => Number((value! * 100).toFixed(1)));
    expect(percents(1)).toEqual([100, 50, 33.3, 50, 40, 50, 42.9, 37.5, 33.3, 30]);
    expect(percents(2)).toEqual([0, 50, 66.7, 50, 60, 50, 57.1, 62.5, 66.7, 70]);
    expect(goalie(team, 1).runningShare.at(-1)).toBe(goalie(team, 1).share);
    expect(goalie(team, 2).runningShare.at(-1)).toBe(goalie(team, 2).share);
    const root = await render(data);
    expect(root.querySelectorAll('g[data-goalie="2"] circle')).toHaveLength(10);
    expect(root.body.textContent).toContain("30%");
    expect(root.body.textContent).toContain("70%");
  });
  it("does not count relief as a start", () => {
    const team = run(() => 1, [row(2, "NJD", 12, false), row(2, "NJD", 13, false)]).teams[0];
    expect(goalie(team, 2)).toMatchObject({ starts: 0, relief: 2 });
    expect(goalie(team, 2).runningShare.every(value => value === 0)).toBe(true);
    expect(goalie(team, 1).runningShare.every(value => value === 1)).toBe(true);
    expect(team.series.every(point => point.starterId === 1)).toBe(true);
  });
  it("binds a traded goalie's games to the team in that row", () => {
    const other = game("NYR", 11, 5000);
    const both = buildCreaseShift({ ...base, teams: ["NJD", "NYR"], window: 2, minComparisonGames: 1, appearances: [...twentyGames.slice(0, 4).map((_, index) => row(1, "NJD", index)), row(1, "NYR", 11, true, 5000)], ...vsPhi([...twentyGames.slice(0, 4), other]) }).data!;
    expect(both.teams.find(entry => entry.team === "NJD")!.series.map(point => point.gameId)).toEqual([1002, 1003]);
    expect(both.teams.find(entry => entry.team === "NYR")!.series.map(point => point.gameId)).toEqual([5000]);
  });
  it("counts a game with no resolved starter as a team game, credits no one, and leaves its block empty", async () => {
    for (const appearances of [
      twentyGames.map((_, index) => row(1, "NJD", index)).filter((_, index) => index !== 12),
      [...twentyGames.map((_, index) => row(1, "NJD", index)), row(2, "NJD", 12)],
    ]) {
      const data = run(() => 1, [], { appearances }), team = data.teams[0];
      expect(team.series[2]).toMatchObject({ state: "unresolved", starterId: null });
      expect(goalie(team, 1).runningShare).toEqual([1, 1, 2 / 3, 3 / 4, 4 / 5, 5 / 6, 6 / 7, 7 / 8, 8 / 9, 9 / 10]);
      expect(goalie(team, 1).share).toBeNull();
      const blocks = [...(await render({ ...data, teams: [{ ...team, rank: 1 }] })).querySelectorAll("rect[data-block]")];
      expect(blocks[2].getAttribute("data-block")).toBe("empty");
      expect(blocks.filter(block => block.getAttribute("data-block") === "empty")).toHaveLength(1);
    }
  });
  it("holds across a scheduled game with no report, which LAST n does not count, so the line still ends at LAST n", async () => {
    const data = run(index => index === 9 ? 2 : 1, [], { reported: reportBoth(twentyGames).filter(entry => !(entry.team === "NJD" && entry.gameId === 1015)) });
    const team = data.teams.find(entry => entry.team === "NJD")!, point = team.series.findIndex(entry => entry.state === "missing");
    expect(team.series[point]).toMatchObject({ gameId: 1015, starterId: null });
    expect(goalie(team, 2).runningShare[point]).toBe(goalie(team, 2).runningShare[point - 1]);
    for (const id of [1, 2]) expect(goalie(team, id).runningShare.at(-1)).toBe(goalie(team, id).share);
    const root = await render({ ...data, teams: [team] }), blocks = [...root.querySelectorAll("rect[data-block]")];
    expect(blocks).toHaveLength(team.series.length);
    expect(blocks[point].getAttribute("data-block")).toBe("empty");
    expect(blocks[point].getAttribute("fill")).toBe("none");
    const line = root.querySelector('g[data-goalie="1"]')!;
    expect(line.querySelector("path")!.getAttribute("d")!.match(/M/g)).toHaveLength(1);
    expect(line.querySelectorAll("circle")).toHaveLength(team.series.length);
  });
  it("colours each block by its starter with SVG attributes: G1, G2, then grey", async () => {
    const root = await render(run(index => index % 10 < 5 ? 1 : index % 10 < 8 ? 2 : 3)), colors = creaseColors("NJD");
    expect([...root.querySelectorAll("rect[data-block]")].map(block => block.getAttribute("fill"))).toEqual([...Array(5).fill(colors.g1), ...Array(3).fill(colors.g2), ...Array(2).fill("#9aa3ad")]);
    const line = (id: number) => root.querySelector(`g[data-goalie="${id}"]`)!;
    expect(line(1).querySelector("path")!.getAttribute("stroke")).toBe(colors.g1);
    expect(line(2).querySelector("path")!.getAttribute("stroke")).toBe(colors.g2);
    expect(line(3).querySelector("path")!.getAttribute("stroke-dasharray")).toBe("4 3");
    expect(line(1).getAttribute("data-values")!.split(",").at(0)).toBe("1");
    expect(line(1).getAttribute("data-values")!.split(",").at(-1)).toBe("0.5");
    expect(line(3).getAttribute("data-values")!.split(",").at(-1)).toBe("0.2");
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
  it("keeps the subtitle and the note to a line each, in plain words, with the full method in the evidence", async () => {
    const result = buildCreaseShift({ ...base, window: 10, minComparisonGames: 1, reported: reportBoth(twentyGames), appearances: twentyGames.map((_, index) => row(1, "NJD", index)), scheduled: schedule(twentyGames) });
    const root = await render(result.data!), note = root.querySelector('[data-testid="crease-shift-note"]')!;
    expect(root.querySelectorAll("p")).toHaveLength(2);
    expect(root.querySelector('[data-testid="crease-shift-subtitle"]')!.textContent).toBe("Share of each team's starts in net: last 10 games vs the 10 before");
    // Two-digit windows are the longest; the export fits this 175 characters on the 1008px line at 14px (e2e checks the fit).
    expect(note.textContent!.length).toBeLessThanOrEqual(175);
    expect(note.textContent).toBe("Blocks show who started each game, oldest to newest. The line is the running share, ending at LAST 10. CHANGE is LAST 10 minus PRIOR 10 in percentage points. Past starts only.");
    for (const method of ["Official starts ÷ completed team games", "LAST 10 is each team's last 10", "PRIOR is up to the 10 games before them", "CHANGE is LAST 10 minus PRIOR 10 in percentage points", "no resolved starter", "starts so far ÷ team games so far", "ending at LAST 10", "relief is not a start", "guides at 0, 50 and 100%", "describes past starts only"]) expect(result.evidence.sample).toContain(method);
    expect(result.evidence.sample).not.toMatch(/\bPTS\b|\bSHARE\b|\bPREV\b/);
    expect(root.body.textContent).not.toContain("RELIEF");
    expect(root.body.textContent).not.toMatch(/probab|likely|odds|will start/i);
  });
  const subtitle = (root: Document) => root.querySelector('[data-testid="crease-shift-subtitle"]')!.textContent;
  it("names the columns in plain words, with the real comparison span in the header when every team shown shares it", async () => {
    const root = await render(run(() => 1));
    expect(heads(root)).toEqual(["RK", "TEAM", "GOALIE", "LAST 10", "PRIOR 10", "CHANGE"]);
    const short = twentyGames.slice(0, 14), overrides = { reported: reportBoth(short), appearances: short.map((_, index) => row(1, "NJD", index)), scheduled: schedule(short) };
    const four = await render(run(() => 1, [], overrides));
    expect(heads(four)).toContain("PRIOR 4");
    expect(subtitle(four)).toBe("Share of each team's starts in net: last 10 games vs the 4 before");
    expect(four.querySelector('[data-testid="crease-shift-span"]')).toBeNull();
  });
  it("calls season to date SEASON, with its games in the subtitle, and CHANGE the difference from it", async () => {
    const root = await render(run(() => 1, [], { comparison: "std" }));
    expect(heads(root)).toEqual(["RK", "TEAM", "GOALIE", "LAST 10", "SEASON", "CHANGE"]);
    expect(subtitle(root)).toBe("Share of each team's starts in net: last 10 games vs the season so far (20 games)");
    expect(root.querySelector('[data-testid="crease-shift-note"]')!.textContent).toContain("CHANGE is LAST 10 minus SEASON in percentage points");
    expect(root.querySelector('[data-testid="crease-shift-span"]')).toBeNull();
  });
  it("prints the span per team when it varies, so one header can't mislead", async () => {
    const data = run(() => 1), root = await render({ ...data, teams: [data.teams[0], { ...data.teams[0], team: "NYR", comparisonGames: 6 }] });
    expect(heads(root)).toContain("PRIOR");
    expect(heads(root).some(head => /GP|\d/.test(head?.replace("LAST 10", "") ?? ""))).toBe(false);
    expect(subtitle(root)).toBe("Share of each team's starts in net: last 10 games vs up to the 10 before");
    expect([...root.querySelectorAll('[data-testid="crease-shift-span"]')].map(entry => entry.textContent)).toEqual(["10 GP", "6 GP"]);
    const std = await render({ ...data, comparison: "std", teams: [data.teams[0], { ...data.teams[0], team: "NYR", comparisonGames: 6 }] });
    expect(heads(std)).toContain("SEASON");
    expect(subtitle(std)).toBe("Share of each team's starts in net: last 10 games vs the season so far");
    expect([...std.querySelectorAll('[data-testid="crease-shift-span"]')].map(entry => entry.textContent)).toEqual(["10 GP", "6 GP"]);
  });
  it("reads a change as an arrow and its points, in the row's own colour, and a change that rounds to 0 as 0", async () => {
    const data = run(() => 1), team = data.teams[0], at = (change: number | null) => ({ ...team.goalies[0], change });
    const root = await render({ ...data, teams: [{ ...team, goalies: [at(60), { ...at(-60), goalieId: 2 }, { ...at(0.4), goalieId: 3 }, { ...at(-0.4), goalieId: 4 }, { ...at(null), goalieId: 5 }] }] });
    const cells = [...root.querySelectorAll('[class*="cell"]')][5].querySelectorAll('[class*="lines"] > span');
    expect([...cells].map(cell => cell.textContent)).toEqual(["▲60", "▼60", "0", "0", "—"]);
    expect([...cells].every(cell => !cell.hasAttribute("style") && !cell.querySelector("[style]"))).toBe(true);
    expect(cells[0].querySelector('[class*="arrow"]')!.textContent).toBe("▲");
    expect(root.body.textContent).not.toMatch(/[+−]\d/);
  });
  it("leaves out a goalie with only relief in both windows, who has no line and nothing to show", async () => {
    const root = await render(run(() => 1, [row(2, "NJD", 12, false)]));
    expect(root.querySelector('g[data-goalie="2"]')).toBeNull();
    expect(root.querySelector('g[data-goalie="1"]')).not.toBeNull();
    expect(root.body.textContent).not.toContain("G2");
  });
  it("sizes the chart to fit twelve rows in the 768px under the subtitle and header, and grows it for fewer", async () => {
    const height = async (count: number) => {
      const data = run(() => 1), teams = Array.from({ length: count }, (_, index) => ({ ...data.teams[0], team: `T${index}` }));
      return Number((await render({ ...data, teams })).querySelector("svg[role=img]")!.getAttribute("height"));
    };
    expect(await height(12)).toBe(56);
    expect(await height(6)).toBe(120);
    // Each row: its chart and the cell's 5px of padding and rule, at five teams (the tallest side-by-side chart) and twelve.
    expect(await height(12) + 5).toBeLessThanOrEqual(768 / 12);
    expect(await height(5) + 5).toBeLessThanOrEqual(768 / 5);
  });
  it("stacks one to four teams over a full-width chart that grows as teams drop, inside the 765px under the subtitle and header", async () => {
    const sized = async (count: number) => {
      const data = run(() => 1), teams = Array.from({ length: count }, (_, index) => ({ ...data.teams[0], team: `T${index}` }));
      const root = await render({ ...data, teams }), svg = root.querySelector("svg[role=img]")!, card = root.querySelector('[data-testid="crease-shift-card"]')!;
      const band = Number(/minmax\((\d+)px, auto\)/.exec(root.querySelector("div[style]")!.getAttribute("style")!)?.[1] ?? 0);
      return { stacked: card.hasAttribute("data-stacked"), size: card.getAttribute("data-size"), width: Number(svg.getAttribute("width")), height: Number(svg.getAttribute("height")), band, heads: heads(root) };
    };
    const few = await Promise.all([1, 2, 3, 4].map(sized));
    few.forEach((size, index) => {
      expect(size).toMatchObject({ stacked: true, size: `rows-${index + 1}`, width: 1008 });
      // Each row: its band, its chart and the chart cell's 5px of padding and rule.
      expect((index + 1) * (size.band + size.height + 5)).toBeLessThanOrEqual(765);
      expect(size.heads).not.toContain("BY GAME");
    });
    expect(few.map(size => size.height)).toEqual([...few.map(size => size.height)].sort((a, b) => b - a));
    expect(few[0].height).toBeGreaterThan(600);
    expect(few[1].height).toBeGreaterThan(200);
    expect(few.map(size => size.band)).toEqual([...few.map(size => size.band)].sort((a, b) => b - a));
    expect(await sized(5)).toMatchObject({ stacked: false, size: "large", width: 410 });
    expect(await sized(12)).toMatchObject({ stacked: false, size: "small", width: 480, height: 56 });
  });
  /** One picked team over `count` games with `window` and a season-to-date comparison, dated past October. */
  const long = (count: number, window: number) => {
    const day = (index: number) => new Date(Date.UTC(2026, 9, 1 + index)).toISOString().slice(0, 10);
    const games = Array.from({ length: count }, (_, index) => ({ gameId: 9000 + index, date: day(index), team: "NJD" }));
    const appearances = games.map((entry, index) => ({ ...row(index % 3 ? 1 : 2, "NJD", 0, true, entry.gameId), date: entry.date }));
    return buildCreaseShift({ ...base, window, comparison: "std", minComparisonGames: 1, picked: ["NJD"], appearances, through: day(count), ...vsPhi(games) }).data!;
  };
  it("draws an 84-game window as 84 blocks edge to edge, with the line but no dot once a block is under 14px", async () => {
    const data = long(84, 84), root = await render(data), svg = root.querySelector("svg[role=img]")!, width = Number(svg.getAttribute("width"));
    const blocks = [...svg.querySelectorAll("rect[data-block]")].map(block => ({ left: Number(block.getAttribute("x")), right: Number(block.getAttribute("x")) + Number(block.getAttribute("width")) }));
    expect(data.teams.find(team => team.team === "NJD")!.rank).toBeNull();
    expect(blocks).toHaveLength(84);
    expect(blocks[0].left).toBe(0);
    expect(blocks[83].right).toBeCloseTo(width);
    expect(blocks.every((block, index) => !index || block.left > blocks[index - 1].right)).toBe(true);
    expect(svg.querySelectorAll("circle")).toHaveLength(0);
    expect(svg.querySelector('g[data-goalie="1"] path')!.getAttribute("d")).toContain(`L${width} `);
  });
  it("draws a 1-game window as one block across the chart and a level line to both edges", async () => {
    const root = await render(long(2, 1)), svg = root.querySelector("svg[role=img]")!, width = Number(svg.getAttribute("width"));
    const block = svg.querySelector("rect[data-block]")!;
    expect(svg.querySelectorAll("rect[data-block]")).toHaveLength(1);
    expect([Number(block.getAttribute("x")), Number(block.getAttribute("width"))]).toEqual([0, width]);
    const d = svg.querySelector("g[data-goalie] path")!.getAttribute("d")!;
    expect(d.startsWith("M0 ")).toBe(true);
    expect(d.endsWith(`L${width} ${d.split(" ")[1].split("L")[0]}`)).toBe(true);
    expect(svg.querySelectorAll("circle")).toHaveLength(1);
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
    expect(creaseShiftModule.hasRows(short.data, { window: 5, comparison: "previous", minComparisonGames: 5, teams: "" })).toBe(false);
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
  it("defaults to 5, a 10-game window and no picked teams", () => {
    expect(parseShareSettings(creaseShiftModule, {})).toEqual({ window: 10, comparison: "previous", minComparisonGames: 5, teams: "" });
    expect(() => parseShareSettings(creaseShiftModule, { minComparisonGames: "0" })).toThrow();
    expect(parseShareSettings(creaseShiftModule, { minComparisonGames: "84" }).minComparisonGames).toBe(84);
    expect(() => parseShareSettings(creaseShiftModule, { minComparisonGames: "85" })).toThrow();
  });
  const render = async (result: ReturnType<typeof run>) => {
    const Card = await creaseShiftModule.card();
    return renderToStaticMarkup(createElement(Card, { data: result.data, logos: {}, settings: { window: 5, comparison: "previous", minComparisonGames: 5, teams: "" }, snapshot: {} as never }));
  };
  it("shows short teams only as a count in the note", async () => {
    const list = games(10), other = Array.from({ length: 6 }, (_, index) => game("NYR", index, 2000 + index));
    const appearances = [...list.map((_, index) => row(index === 0 ? 2 : 1, "NJD", index)), ...other.map((entry, index) => row(9, "NYR", index, true, entry.gameId))];
    const result = buildCreaseShift({ ...base, teams: ["NJD", "NYR"], minComparisonGames: 5, appearances, ...vsPhi([...list, ...other]) });
    const html = await render(result);
    expect(html).not.toContain("G9");
    expect(html).not.toContain("NYR");
    expect(result.evidence.cohort).toBe("1 of 2 teams ranked; 1 short comparison");
  });
  it("puts unresolved teams and the fine print in the evidence, with one subtitle and one note line on the card", async () => {
    const list = games(10), appearances = list.slice(0, 9).map((_, index) => row(1, "NJD", index));
    const result = buildCreaseShift({ ...base, minComparisonGames: 1, reported: reportBoth(list), appearances, scheduled: schedule(list) });
    expect(result.evidence.sample).toContain("Unranked: NJD");
    expect(result.evidence.sample).toContain("relief is not a start");
    const full = run(10, 5), root = new DOMParser().parseFromString(await render(full), "text/html");
    expect(root.querySelectorAll("p")).toHaveLength(2);
    expect(root.body.textContent).not.toMatch(/Showing|Unranked/);
  });
  it("stacks a lone ranked team in its largest size, and fills the rows at any count", async () => {
    const root = new DOMParser().parseFromString(await render(run(10, 5)), "text/html");
    expect(root.querySelector('[data-testid="crease-shift-card"]')!.getAttribute("data-size")).toBe("rows-1");
    expect(root.querySelector('[class*="table"], div[style]')!.getAttribute("style")).toMatch(/repeat\(1, minmax\(\d+px, auto\) minmax\(min-content, 1fr\)\)/);
  });
  it("uses the honest empty state when nothing qualifies", async () => {
    expect(await render(run(9, 5))).toContain("No team has both windows resolved");
  });
});

describe("window and team settings", () => {
  const parse = (query: Record<string, string>) => parseShareSettings(creaseShiftModule, query);
  it("reads the old L5, L10 and L20 links as their numbers, and takes any whole window from 1 to 84", () => {
    expect(["5", "10", "20"].map(window => parse({ window }).window)).toEqual([5, 10, 20]);
    expect([parse({ window: "1" }).window, parse({ window: "84" }).window]).toEqual([1, 84]);
    for (const window of ["0", "85", "10.5", ""]) expect(() => parse({ window }), window).toThrow();
  });
  it("takes up to 12 known teams once each, and blank for the top 12", () => {
    expect(parse({ teams: "NJD,NYR" }).teams).toBe("NJD,NYR");
    expect(parse({ teams: "" }).teams).toBe("");
    const twelve = ["ANA", "BOS", "BUF", "CAR", "CBJ", "CGY", "CHI", "COL", "DAL", "DET", "EDM", "FLA"];
    expect(parse({ teams: twelve.join(",") }).teams).toBe(twelve.join(","));
    for (const teams of ["XXX", "NJD,NJD", "njd", [...twelve, "LAK"].join(",")]) expect(() => parse({ teams }), teams).toThrow();
    const field = creaseShiftModule.fields.find(entry => entry.id === "teams")!;
    expect(field).toMatchObject({ kind: "text", maxChoices: 12, blank: "the top 12 by share change" });
    expect(field.kind === "text" && field.choices?.length).toBe(32);
  });
});

describe("plain words", () => {
  /** Teams shown with these comparison spans; the words read only the spans, the window and the comparison. */
  const words = (window: number, comparison: "previous" | "std", ...spans: number[]) => creaseShiftWords({ window, comparison, picked: [], teams: spans.map((comparisonGames, index) => ({ team: `T${index}`, rank: 1, comparisonGames }) as CreaseShiftData["teams"][number]) });
  const lead = "Share of each team's starts in net: ";
  it("follows the window, the comparison and the span, in the singular where it is one game", () => {
    expect(words(10, "previous", 10)).toEqual({ span: 10, last: "LAST 10", prior: "PRIOR 10", compared: "last 10 games vs the 10 before", subtitle: `${lead}last 10 games vs the 10 before` });
    expect(words(1, "previous", 1)).toMatchObject({ span: 1, last: "LAST 1", prior: "PRIOR 1", subtitle: `${lead}last game vs the game before` });
    expect(words(20, "previous", 0)).toMatchObject({ prior: "PRIOR 0", subtitle: `${lead}last 20 games vs no earlier games` });
    expect(words(84, "std", 84)).toMatchObject({ span: 84, last: "LAST 84", prior: "SEASON", subtitle: `${lead}last 84 games vs the season so far (84 games)` });
    expect(words(1, "std", 1).subtitle).toBe(`${lead}last game vs the season so far (1 game)`);
  });
  it("leaves the span to each row when the teams shown differ", () => {
    expect(words(10, "previous", 10, 6)).toMatchObject({ span: null, last: "LAST 10", prior: "PRIOR", subtitle: `${lead}last 10 games vs up to the 10 before` });
    expect(words(10, "std", 20, 18)).toMatchObject({ span: null, last: "LAST 10", prior: "SEASON", subtitle: `${lead}last 10 games vs the season so far` });
  });
});

describe("picked teams", () => {
  const TEAMS = ["NJD", "NYR", "PHI", "PIT", "BOS", "BUF", "CAR"] as const;
  /** G2 takes this many of each team's last 5 starts after G1 took all 5 before, so the shift is 20 points a start. */
  const swing: Record<string, number> = { NJD: 1, NYR: 4, PHI: 2, PIT: 3, BOS: 0, BUF: 5 };
  /** Pairs play each other; BOS and BUF play 7, so their comparison is 2 games, short of 5. CAR has no games. */
  const pairs = [["NJD", "NYR", 10], ["PHI", "PIT", 10], ["BOS", "BUF", 7]] as const;
  const league = () => {
    const scheduled: ScheduledGame[] = [], reported: CompletedTeamGame[] = [], appearances: GoalieAppearance[] = [];
    pairs.forEach(([home, away, count], pair) => Array.from({ length: count }, (_, index) => {
      const gameId = 7000 + pair * 100 + index;
      scheduled.push({ id: gameId, date: date(index), homeTeamId: teamsInfo[home].id, awayTeamId: teamsInfo[away].id });
      for (const team of [home, away]) {
        const recent = index - (count - 5);
        reported.push(game(team, index, gameId));
        appearances.push(row(TEAMS.indexOf(team) * 10 + (recent >= 0 && recent < swing[team] ? 2 : 1), team, index, true, gameId));
      }
    }));
    return { scheduled, reported, appearances };
  };
  const build = (picked: string[], overrides: Partial<Parameters<typeof buildCreaseShift>[0]> = {}) => buildCreaseShift({ ...base, ...league(), teams: TEAMS, picked, window: 5, minComparisonGames: 5, ...overrides });
  const render = async (data: CreaseShiftData) => {
    const Card = await creaseShiftModule.card();
    return new DOMParser().parseFromString(renderToStaticMarkup(createElement(Card, { data, logos: {}, settings: { window: 5, comparison: "previous", minComparisonGames: 5, teams: data.picked.join(",") }, snapshot: {} as never })), "text/html");
  };
  const ranks = (root: Document) => [...root.querySelectorAll('[data-testid="crease-shift-rank"]')].map(cell => cell.textContent);
  const settings = (picked: string[]) => ({ window: 5, comparison: "previous", minComparisonGames: 5, teams: picked.join(",") });

  it("ranks all teams and, blank, shows only the ranked ones", () => {
    const result = build([]);
    expect(result.data!.teams.map(team => [team.team, team.rank])).toEqual([["NYR", 1], ["PIT", 2], ["PHI", 3], ["NJD", 4], ["BOS", null], ["BUF", null], ["CAR", null]]);
    expect(result.teams).toEqual(["NYR", "PIT", "PHI", "NJD"]);
    expect(result.pageNotes).toBeUndefined();
    expect(result.evidence.sample).not.toContain("Teams picked");
  });
  it("shows exactly the picked teams, ranked ones first by league rank, and lists them for logos and the evidence", () => {
    const result = build(["BUF", "NJD", "PIT"]);
    expect(creaseShiftShown(result.data!).map(team => [team.team, team.rank])).toEqual([["PIT", 2], ["NJD", 4], ["BUF", null]]);
    expect(result.teams).toEqual(["PIT", "NJD", "BUF"]);
    expect(result.data!.picked).toEqual(["BUF", "NJD", "PIT"]);
    expect(result.evidence.sample).toContain("Teams picked: BUF, NJD, PIT; RK is each team's rank among all 7");
    expect(result.evidence.cohort).toBe("4 of 7 teams ranked; 2 short comparison");
    expect(result.pageNotes).toEqual(["BUF is unranked: Only 2 comparison games outside the window, under the minimum of 5."]);
    expect(creaseShiftModule.hasRows(result.data, settings(["BUF", "NJD", "PIT"]))).toBe(true);
  });
  it("keeps RK as the league rank, never a rank among the picks, and prints a dash for an unranked pick", async () => {
    const result = build(["BOS", "NJD"]), root = await render(result.data!);
    expect(ranks(root)).toEqual(["4", "—"]);
    const alt = creaseShiftModule.altText({ evidence: result.evidence } as never, result.data, settings(["BOS", "NJD"]));
    expect(alt).toMatch(/^FHFH Crease Shift: share of each team's starts in net, last 5 games vs up to the 5 before, through \d{4}-\d{2}-\d{2}\. /);
    expect(alt).toContain("4. NJD: G1 4 of 5, G2 1 of 5");
    expect(alt).toContain("BOS (unranked): G41 5 of 5");
    expect(alt).not.toContain("NYR");
    // BOS's change is withheld, so its CHANGE reads "—", while its blocks and line draw as usual.
    const bos = root.querySelector('svg[aria-label^="BOS"]')!;
    expect(bos.querySelectorAll('rect[data-block="started"]')).toHaveLength(5);
    expect(bos.querySelectorAll("g[data-goalie]")).toHaveLength(1);
    expect(result.data!.teams.find(team => team.team === "BOS")!.goalies.every(goalie => goalie.change === null)).toBe(true);
    expect(root.body.textContent).toContain("▲20");
  });
  it("shows a pick with no games as dashes, and has nothing to export when no pick has a game", async () => {
    const lone = build(["CAR"]);
    expect(creaseShiftModule.hasRows(lone.data, settings(["CAR"]))).toBe(false);
    expect((await render(lone.data!)).body.textContent).toContain("No completed games in this window for CAR");
    const both = build(["CAR", "NJD"]), root = await render(both.data!);
    expect(creaseShiftModule.hasRows(both.data, settings(["CAR", "NJD"]))).toBe(true);
    expect(ranks(root)).toEqual(["4", "—"]);
    expect(both.pageNotes).toEqual(["CAR is unranked: No completed games in this window."]);
    expect(root.querySelector('svg[aria-label^="CAR"]')!.querySelectorAll("rect[data-block]")).toHaveLength(0);
  });
  it("adds an unranked pick's note after a late night's note", () => {
    const appearances = twenty.map((_, index) => row(1, "NJD", index)), reported = reportBoth(twenty).filter(entry => !(entry.gameId === 1009 && entry.team === "NJD"));
    const result = buildCreaseShift({ ...base, minComparisonGames: 10, picked: ["NJD"], reported, appearances, scheduled: schedule(twenty) });
    expect(result.pageNotes).toEqual(["Oct 10 is not fully reported yet, so this card ends Oct 9.", "NJD is unranked: Only 4 comparison games outside the window, under the minimum of 10."]);
  });
});

describe("schedule reconciliation", () => {
  it("compares team games with the schedule, and one missing older team game is partial", () => {
    const appearances = twenty.map((_, index) => row(1, "NJD", index)), reported = reportBoth(twenty).slice(1);
    expect(reconcileSchedule(schedule(twenty), reported)).toMatchObject({ scheduledGames: 10, expected: 20, observed: 19, missing: 1 });
    const result = buildCreaseShift({ ...base, reported, appearances, scheduled: schedule(twenty) });
    expect(result.state).toBe("partial");
    expect(result.reasons?.[0]).toMatch(/1 of 20 scheduled team games/);
    expect(result.evidence.coverage).toEqual({ observed: 19, expected: 20, missing: 1, unit: "team games" });
  });
  it("ends at the last complete night when only the newest is late, ready, with a page note", () => {
    const appearances = twenty.map((_, index) => row(index < 9 ? 1 : 2, "NJD", index)), reported = reportBoth(twenty).filter(entry => !(entry.gameId === 1009 && entry.team === "NJD"));
    const result = buildCreaseShift({ ...base, reported, appearances, scheduled: schedule(twenty) });
    expect(result.state).toBe("ready");
    expect(result.reasons).toEqual([]);
    expect(result.pageNotes).toEqual(["Oct 10 is not fully reported yet, so this card ends Oct 9."]);
    const njd = result.data!.teams[0];
    expect(result.data!.through).toBe("2026-10-09");
    expect(njd).toMatchObject({ games: 5, lastDate: "2026-10-09", missingGames: 0 });
    expect(njd.goalies.map(goalie => goalie.goalieId)).toEqual([1]);
    expect(result.evidence.coverage).toEqual({ observed: 18, expected: 18, missing: 0, unit: "team games" });
    expect(creaseShiftModule.hasRows(result.data, { window: 5, comparison: "previous", minComparisonGames: 1, teams: "" })).toBe(true);
  });
  it("still blocks an older gap when the newest night is also late", () => {
    const reported = reportBoth(twenty).filter(entry => entry.gameId !== 1009 && !(entry.gameId === 1002 && entry.team === "NYR"));
    const result = buildCreaseShift({ ...base, reported, appearances: twenty.map((_, index) => row(1, "NJD", index)), scheduled: schedule(twenty) });
    expect(result.state).toBe("partial");
    expect(result.reasons![0]).toMatch(/^1 of 18 scheduled team games have no reported result/);
    expect(result.pageNotes).toEqual(["Oct 10 is not fully reported yet, so this card ends Oct 9."]);
  });
  it("is missing when no night is fully reported", () => {
    const one = twenty.slice(0, 1);
    expect(buildCreaseShift({ ...base, reported: [], appearances: [], scheduled: schedule(one) })).toMatchObject({ state: "missing", data: null, reasons: ["No night this season is fully reported yet."] });
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
    return renderToStaticMarkup(createElement(Card, { data, logos: {}, settings: { window: 5, comparison: "previous", minComparisonGames: 1, teams: "" }, snapshot: {} as never }));
  };
  it("names official starts and team games, and claims nothing about the next start", async () => {
    const html = await render(load.data!);
    expect(load.evidence.sample).toContain("Official starts ÷ completed team games");
    expect(html).toContain("60%");
    expect(html).not.toMatch(/probab|likely|odds|expected to start|will start|appearance share/i);
    expect(creaseShiftModule.altText({ evidence: load.evidence } as never, load.data, { window: 5, comparison: "previous", minComparisonGames: 1, teams: "" })).not.toMatch(/probab|likely|odds|will start/i);
  });
  it("has nothing to export when no team resolves", async () => {
    const empty = buildCreaseShift({ ...base, reported: [], appearances: [], scheduled: [] });
    expect(creaseShiftModule.hasRows(empty.data, { window: 5, comparison: "previous", minComparisonGames: 1, teams: "" })).toBe(false);
    expect(await render(empty.data!)).toContain("No team has both windows resolved");
  });
  it("leaves the appearance pie alone: this post reads no appearance share", () => {
    expect(readFileSync("lib/socialShare/modules/creaseShift.ts", "utf8")).not.toMatch(/goalieWorkload|GoalieShareChart"/);
  });
});
