import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import BusyQuietCard from "components/SocialShare/modules/BusyQuietCard";
import { busyQuietModule, buildBusyQuiet, dangerZoneShots, goalieLedgerScope, goalieWindows, ledgerCoverage, nstToiSeconds, shotsOnBasis, teamChances, VOLUME_NOTE, type BusyQuietData, type BusyQuietSettings, type NstGoalieRow, type NstTeamRow } from "./busyQuiet";
import { parseShareSettings, UNKNOWN_EVIDENCE, type SharePostSnapshot } from "./contract";
import type { CompletedTeamGame, GoalieAppearance } from "./shared/goalieLedger";

const appearance = (over: Partial<GoalieAppearance> & { goalieId: number; gameId: number; date: string }): GoalieAppearance => ({ name: `G${over.goalieId}`, team: "NJD", opponent: "NYR", home: true, started: true, wins: 1, losses: 0, otLosses: 0, saves: 27, shotsAgainst: 30, goalsAgainst: 3, toiSeconds: 3600, shutouts: 0, qualityStart: 1, ...over });
const date = (day: number) => `2026-10-${String(day).padStart(2, "0")}`;
/** G1 on NJD: 3 starts of 30 SA plus 1 relief of 10 SA in 1200 s, in a game G2 started. G2 on NJD: that one start. G3 on NYR: 3 starts of 20 SA. */
const rows: GoalieAppearance[] = [
  appearance({ goalieId: 1, gameId: 1, date: date(1) }), appearance({ goalieId: 1, gameId: 2, date: date(2) }), appearance({ goalieId: 1, gameId: 3, date: date(3) }),
  appearance({ goalieId: 2, gameId: 4, date: date(4), shotsAgainst: 20, saves: 18, goalsAgainst: 2, toiSeconds: 2400 }), appearance({ goalieId: 1, gameId: 4, date: date(4), started: false, shotsAgainst: 10, saves: 10, goalsAgainst: 0, toiSeconds: 1200 }),
  ...[5, 6, 7].map(day => appearance({ goalieId: 3, gameId: day, date: date(day), team: "NYR", shotsAgainst: 20, saves: 18, goalsAgainst: 2 })),
];
const games: CompletedTeamGame[] = [...[1, 2, 3, 4].map(id => ({ gameId: id, date: date(id), team: "NJD" })), ...[5, 6, 7].map(id => ({ gameId: id, date: date(id), team: "NYR" }))];
const scheduled = (count: number) => Array.from({ length: count }, (_, index) => date(index + 1));
const settings = (over: Partial<BusyQuietSettings> = {}): BusyQuietSettings => ({ basis: "start", window: "l10", minStarts: 3, ...over });
const nstGoalie = (goalieId: number, day: number, hd = 10): NstGoalieRow => ({ player_id: goalieId, date_scraped: date(day), toi: "60", hd_shots_against: hd, md_shots_against: 5, ld_shots_against: 5 });
const build = (over: Partial<Parameters<typeof buildBusyQuiet>[0]> = {}) => buildBusyQuiet({ settings: settings(), appearances: rows, teamGames: games, scheduledDates: [], nstGoalie: [], nstTeam: [], through: date(30), ...over });

afterEach(cleanup);

describe("busy and quiet basis", () => {
  const g1 = rows.filter(row => row.goalieId === 1);
  it("reads starts only per start, every appearance per appearance, and TOI per 60", () => {
    expect(shotsOnBasis(g1, "start")).toMatchObject({ value: 30, shots: 90, denominator: 3, unit: "starts" });
    expect(shotsOnBasis(g1, "appearance")).toMatchObject({ value: 25, shots: 100, denominator: 4, unit: "appearances" });
    expect(shotsOnBasis(g1, "per60")).toMatchObject({ shots: 100, denominator: 12000, unit: "seconds" });
    expect(shotsOnBasis(g1, "per60").value).toBeCloseTo(30);
  });
  it("switching basis changes the order, not the counts", () => {
    const perStart = build().data!, perAppearance = build({ settings: settings({ basis: "appearance" }) }).data!;
    expect(perStart.busy[0]).toMatchObject({ goalieId: 1, rank: 1, starts: 3, relief: 1, appearances: 4, totalShots: 100, reliefShots: 10 });
    expect(perStart.busy[0].volume.value).toBe(30);
    expect(perAppearance.busy[0].volume.value).toBe(25);
    expect(perAppearance.busy[0]).toMatchObject({ starts: 3, relief: 1, totalShots: 100 });
    expect(build({ settings: settings({ basis: "per60" }) }).data!.busy[0].volume.unit).toBe("seconds");
  });
  it("treats a missing stat as missing, never zero", () => {
    const volume = shotsOnBasis([appearance({ goalieId: 1, gameId: 1, date: date(1) }), appearance({ goalieId: 1, gameId: 2, date: date(2), shotsAgainst: null })], "start");
    expect(volume).toMatchObject({ value: 30, denominator: 1, missing: 1 });
    expect(shotsOnBasis([], "per60").value).toBeNull();
    expect(shotsOnBasis([appearance({ goalieId: 1, gameId: 1, date: date(1), toiSeconds: 0 })], "per60").value).toBeNull();
  });
});

describe("relief and windows", () => {
  it("counts relief apart from starts and never as a start", () => {
    const window = goalieWindows(rows, "std").find(entry => entry.goalieId === 1)!;
    expect(window).toMatchObject({ starts: 3, relief: 1, unlabeled: 0, actual: 4 });
  });
  it("excludes a goalie whose relief would be needed to reach min starts", () => {
    const result = build({ settings: settings({ minStarts: 4 }) }).data!;
    expect(result.eligible).toBe(0);
    expect(busyQuietModule.hasRows(result, settings({ minStarts: 4 }))).toBe(false);
  });
  it("shows a short window as its actual count", () => {
    expect(goalieWindows(rows, "l10").find(entry => entry.goalieId === 3)).toMatchObject({ actual: 3, requested: 10, short: true });
    expect(goalieWindows(rows, "l5").find(entry => entry.goalieId === 1)).toMatchObject({ actual: 4, short: true });
  });
  it("binds a traded goalie to the team of each game", () => {
    const window = goalieWindows([appearance({ goalieId: 9, gameId: 1, date: date(1), team: "NYR" }), appearance({ goalieId: 9, gameId: 2, date: date(2), team: "NJD" })], "std")[0];
    expect(window).toMatchObject({ team: "NJD", teams: ["NYR", "NJD"] });
  });
});

describe("danger-zone shots and team chances", () => {
  it("converts NST minutes, including the API's strings, to seconds once", () => {
    expect(nstToiSeconds("63.5")).toBe(3810);
    expect(nstToiSeconds(60)).toBe(3600);
    expect(nstToiSeconds(null)).toBeNull();
    expect(nstToiSeconds("")).toBeNull();
    const zone = dangerZoneShots([appearance({ goalieId: 1, gameId: 1, date: date(1) })], "per60", new Map([["1:2026-10-01", { ...nstGoalie(1, 1, 15), toi: "30" }]]));
    expect(zone.hd).toBe(30);
  });
  it("hides a goalie below 90% coverage and shows the count, with no zero fill", () => {
    const g3 = rows.filter(row => row.goalieId === 3), nst = new Map([[`3:${date(5)}`, nstGoalie(3, 5)], [`3:${date(6)}`, nstGoalie(3, 6)]]);
    expect(dangerZoneShots(g3, "start", nst)).toEqual({ hd: null, md: null, ld: null, covered: 2, expected: 3, missing: 1, admitted: false });
    expect(dangerZoneShots(g3, "start", null)).toMatchObject({ hd: null, covered: 0, missing: 3, admitted: false });
    nst.set(`3:${date(7)}`, nstGoalie(3, 7, 13));
    expect(dangerZoneShots(g3, "start", nst)).toMatchObject({ hd: 11, md: 5, ld: 5, admitted: true });
  });
  it("keeps team chances per team game, unswitched by basis, and discloses a shared net", () => {
    const g1 = rows.filter(row => row.goalieId === 1), nst = new Map<string, NstTeamRow>([1, 2, 3, 4].map(day => [`NJD:${date(day)}`, { team_abbreviation: "NJD", date: date(day), sca: 20 + day, hdca: 10 }]));
    expect(teamChances(g1, rows, nst)).toMatchObject({ sca: 22.5, hdca: 10, covered: 4, expected: 4, admitted: true, sharedNetGames: 1 });
    nst.delete(`NJD:${date(4)}`);
    expect(teamChances(g1, rows, nst)).toMatchObject({ sca: null, hdca: null, covered: 3, admitted: false });
  });
  it("keeps shots standing when an NST read fails and says so", () => {
    const result = build({ nstGoalie: null, nstTeam: null });
    expect(result.data!.busy[0].volume.value).toBe(30);
    expect(result.evidence.sources.slice(1).map(source => source.state)).toEqual(["missing", "missing"]);
  });
});

describe("completeness", () => {
  it("is ready when every scheduled game has both team rows and one labeled starter", () => {
    const full = rows.filter(row => row.goalieId !== 3), teamGames = [1, 2, 3, 4].flatMap(id => [{ gameId: id, date: date(id), team: "NJD" }, { gameId: id, date: date(id), team: "NYR" }]);
    const appearances = [...full, ...[1, 2, 3, 4].map(id => appearance({ goalieId: 3, gameId: id, date: date(id), team: "NYR" }))];
    const result = build({ appearances, teamGames, scheduledDates: scheduled(4) });
    expect(result.state).toBe("ready");
    expect(result.evidence.coverage).toEqual({ observed: 8, expected: 8, missing: 0, unit: "team games with one labeled starter" });
  });
  it("is partial when a team game is unreported or has no single labeled starter", () => {
    expect(ledgerCoverage({ scheduledDates: scheduled(1), teamGames: [{ gameId: 1, date: date(1), team: "NJD" }], appearances: [appearance({ goalieId: 1, gameId: 1, date: date(1) })], since: null }).reasons[0]).toMatch(/1 of 2 scheduled/);
    const both = [{ gameId: 1, date: date(1), team: "NJD" }, { gameId: 1, date: date(1), team: "NYR" }];
    expect(ledgerCoverage({ scheduledDates: scheduled(1), teamGames: both, appearances: [appearance({ goalieId: 1, gameId: 1, date: date(1) }), appearance({ goalieId: 2, gameId: 1, date: date(1), team: "NYR", started: null })], since: null }).reasons[0]).toMatch(/1 of 2 team games lack/);
    expect(build({ scheduledDates: scheduled(9) }).state).toBe("partial");
  });
  it("ignores older games no window reads", () => {
    expect(ledgerCoverage({ scheduledDates: [date(1), date(9)], teamGames: [{ gameId: 9, date: date(9), team: "NJD" }, { gameId: 9, date: date(9), team: "NYR" }], appearances: [appearance({ goalieId: 1, gameId: 9, date: date(9) }), appearance({ goalieId: 2, gameId: 9, date: date(9), team: "NYR" })], since: date(9) }).complete).toBe(true);
  });
  it("runs through yesterday in New York", () => {
    expect(goalieLedgerScope("2026-11-01T02:00:00Z")).toEqual({ today: "2026-10-31", through: "2026-10-30", season: 20262027, from: "2026-08-01" });
  });
});

describe("the list", () => {
  it("shares tied ranks and never lists a goalie as both busy and quiet", () => {
    const tied = build({ appearances: [...rows, ...[8, 9, 10].map(day => appearance({ goalieId: 4, gameId: day, date: date(day), team: "PHI", shotsAgainst: 20 }))] }).data!;
    expect(tied.busy.map(row => [row.goalieId, row.rank])).toEqual([[1, 1], [3, 2], [4, 2]]);
    expect(tied.quiet).toEqual([]);
    const ids = Array.from({ length: 14 }, (_, index) => index + 10), many = ids.flatMap(id => [0, 1, 2].map(game => appearance({ goalieId: id, gameId: id * 10 + game, date: date(game + 1), team: "PHI", shotsAgainst: id })));
    const data = build({ appearances: many }).data!;
    expect(data.busy.map(row => row.goalieId)).toEqual([23, 22, 21, 20, 19, 18]);
    expect(data.quiet.map(row => row.goalieId)).toEqual([10, 11, 12, 13, 14, 15]);
    expect(data.quiet.map(row => row.rank)).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it("names strength, cohort and source tables", () => {
    const { evidence } = build();
    expect(evidence.strength).toBe("All situations");
    expect(evidence.cohort).toBe("2 of 3 goalies with at least 3 official starts in the window");
    expect(evidence.sources.flatMap(source => source.tables)).toEqual(["wgo_goalie_stats", "wgo_team_stats", "games", "nst_gamelog_goalie_all_counts", "nst_team_gamelogs_as_counts"]);
  });
  it("defaults to the contract's settings and refuses others", () => {
    expect(parseShareSettings(busyQuietModule, {})).toEqual({ basis: "start", window: "l10", minStarts: 3 });
    expect(() => parseShareSettings(busyQuietModule, { basis: "good" })).toThrow();
    expect(() => parseShareSettings(busyQuietModule, { minStarts: "0" })).toThrow();
    expect(busyQuietModule).toMatchObject({ basis: "observed", group: "goalies", suggestedUse: "Works for a Thursday or Friday post." });
  });
});

const snapshot = (data: BusyQuietData, active: BusyQuietSettings): SharePostSnapshot<BusyQuietSettings, BusyQuietData> => ({ schemaVersion: 1, id: "e", post: "busy-quiet-goalies", state: "ready", reasons: [], generatedAt: "2026-10-31T12:00:00Z", expiresAt: null, timeZone: "America/New_York", settings: active, evidence: UNKNOWN_EVIDENCE, data, teams: [], fixture: true });
const renderCard = (data: BusyQuietData, active: BusyQuietSettings) => render(createElement(BusyQuietCard, { snapshot: snapshot(data, active), data, settings: active, logos: {} }));
/** Words that would turn workload into a verdict on goalie play. */
const GOODNESS = /\b(good|great|bad|best|worst|better|worse|elite|strong|weak|poor|struggl\w*|hot|cold|stud|dud|excellent)\b/i;

describe("busy and quiet card", () => {
  const full = build({ nstGoalie: [1, 2, 3].map(day => nstGoalie(1, day)), nstTeam: [1, 2, 3, 4].map(day => ({ team_abbreviation: "NJD", date: date(day), sca: 22, hdca: 9 })) }).data!;
  it("labels danger-zone shots as shots and team chances as team-level, with relief apart", () => {
    const { container } = renderCard(full, settings());
    const text = container.textContent!;
    for (const label of ["Busy", "RELIEF", "SA/GS", "HD SHOTS/GS", "TEAM SCA/GM", "TEAM HDCA/GM", VOLUME_NOTE, "not chances", "including time another goalie was in net", "Per start reads official starts only", "1 listed appearance shared the net."]) expect(text).toContain(label);
    expect(text).not.toMatch(/\bHD CHANCES\b|\bGOALIE CHANCES\b/i);
    expect(screen.getByText("G1")).toBeTruthy();
  });
  it("uses the plural for more than one shared net", () => {
    const [first, ...rest] = full.busy, shared = { ...full, busy: [{ ...first, teamChances: { ...first.teamChances, sharedNetGames: 2 } }, ...rest] };
    expect(renderCard(shared, settings()).container.textContent).toContain("2 listed appearances shared the net.");
  });
  it("shows coverage instead of a value when danger-zone shots are not admitted", () => {
    const thin = build({ nstGoalie: [nstGoalie(1, 1)] }).data!;
    expect(renderCard(thin, settings()).container.textContent).toContain("— 1/3");
  });
  it("changes its column labels with the basis", () => {
    const per60 = build({ settings: settings({ basis: "per60" }) }).data!;
    const text = renderCard(per60, settings({ basis: "per60" })).container.textContent!;
    expect(text).toContain("SA/60");
    expect(text).not.toContain("Per start reads");
  });
  it("uses no goodness wording in the card or alt text", () => {
    const active = settings();
    expect(renderCard(full, active).container.textContent).not.toMatch(GOODNESS);
    const alt = busyQuietModule.altText(snapshot(full, active), full, active);
    expect(alt).toContain(VOLUME_NOTE);
    expect(alt).not.toMatch(GOODNESS);
    expect(`${busyQuietModule.title} ${busyQuietModule.summary}`).not.toMatch(GOODNESS);
  });
  it("carries no performance figure", () => {
    expect(JSON.stringify(full)).not.toMatch(/savePct|gaa|wins|saves/i);
  });
  it("says why an empty pool is empty, with no filler", () => {
    const active = settings({ minStarts: 20 }), empty = build({ settings: active }).data!;
    expect(renderCard(empty, active).container.textContent).toBe("No goalie has 20 official starts in this window");
  });
});
