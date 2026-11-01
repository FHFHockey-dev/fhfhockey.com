import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LANDING_CARDS, landingDayStatus } from "./landingCatalog";
import { buildPostedWeek, latestLiveDelivery, matchPostedCard, POSTED_LIVE_WINDOW_HOURS, POSTED_STALE_AFTER_HOURS, postedWeekRange } from "./postedWeek";

const MODULES = "lib/socialShare/modules", OLD = "components/SocialShare/SocialShare.tsx";
// [alt text as posted, card, the file that writes it, the wording that file must still contain]
const POSTS: readonly (readonly [string, string, string, string])[] = [
  ["FHFH Best schedules, Monday streamer grid, Nov 2, 2026 through Nov 8, 2026. Teams ranked", "game-grid", OLD, "`FHFH Best schedules, ${editionDay(snapshot)} streamer grid,"],
  ["FHFH Best schedules, Wednesday streamer grid, Nov 2, 2026 through Nov 8, 2026, covering Thu–Sun. Teams", "remaining-week", OLD, "`, covering ${coveredDays(snapshot)}`"],
  ["FHFH Off-Night Edge, rest of week, 2026-11-05 to 2026-11-08. 1. TOR", "off-night-rest", `${MODULES}/offNightEdge.ts`, '`FHFH Off-Night Edge, ${data.dates === "weekly" ? "full week" : "rest of week"}'],
  ["FHFH Off-Night Edge, full week, 2026-11-02 to 2026-11-08. 1. TOR", "off-night-weekly", `${MODULES}/offNightEdge.ts`, '`FHFH Off-Night Edge, ${data.dates === "weekly" ? "full week" : "rest of week"}'],
  ["FHFH completed games per team, 2026-10-01 to 2026-11-01. 1. TOR: 12", "team-games", `${MODULES}/teamGames.ts`, "`FHFH completed games per team,"],
  ["FHFH Top Multi-Cat Stars of the Week, fantasy week", "stars-total", `${MODULES}/multiCatStars.ts`, '`Top ${settings.formula === "pointsFirst" ? "Points-First" : "Multi-Cat"} Stars`'],
  ["FHFH Top Points-First Stars of the Week, fantasy week", "stars-total-points-first", `${MODULES}/multiCatStars.ts`, 'return noun ? `${name} of the ${noun}` : name;'],
  ["FHFH Top Multi-Cat Stars Per Game, fantasy week", "stars-per-game", `${MODULES}/multiCatStars.ts`, '`${name} Per Game`'],
  ["FHFH Top Points-First Stars Per Game, fantasy week", "stars-per-game-points-first", `${MODULES}/multiCatStars.ts`, "`FHFH ${multiCatHeadline(settings, data)},"],
  ["FHFH goalies, Week 5, 2026-10-26 to 2026-11-01, by category counts.", "goalie-of-week", `${MODULES}/shared/categoryCounts.ts`, "label: `Week ${week.week}, ${week.start} to ${week.end}"],
  ["FHFH goalies, October, by category counts.", "goalie-of-month", `${MODULES}/goaliePeriod.ts`, "`FHFH goalies, ${data.period.label},"],
  ["FHFH BSH leaders, last 10 games, through 2026-11-01.", "bsh-leaders", `${MODULES}/bshBoard.ts`, '`FHFH BSH ${data.view === "leaders" ? "leaders" : "risers and fallers"},'],
  ["FHFH BSH risers and fallers, last 10 games versus season.", "bsh-risers", `${MODULES}/bshBoard.ts`, '`FHFH BSH ${data.view === "leaders" ? "leaders" : "risers and fallers"},'],
  ["FHFH Multi Cat Monsters, per game over the season.", "multi-cat-monsters", `${MODULES}/categoryBlueprint.ts`, '`FHFH ${data.view === "standard" ? "Multi Cat Monsters" : "Points-First Multi Cat Monsters"},'],
  ["FHFH Points-First Multi Cat Monsters, per game over the season.", "multi-cat-points-first", `${MODULES}/categoryBlueprint.ts`, '`FHFH ${data.view === "standard" ? "Multi Cat Monsters" : "Points-First Multi Cat Monsters"},'],
  ["FHFH Nightly Floor: SOG above 2, last 10 games, through 2026-11-01.", "nightly-floor", `${MODULES}/nightlyFloor.ts`, "`FHFH Nightly Floor: ${data.viewLabel},"],
  ["FHFH Nightly Floor: Cardio Masters, last 10 games, through 2026-11-01.", "cardio-masters", `${MODULES}/nightlyFloor.ts`, 'viewLabel: "Cardio Masters"'],
  ["FHFH Tuesday trends, hot and cold, week of Nov 2, 2026.", "tuesday-trends", OLD, "`FHFH Tuesday trends, ${trendTitles[kind].toLowerCase()},"],
  ["FHFH What Changed, points per game. Up: A.", "what-changed", `${MODULES}/whatChanged.ts`, "`FHFH What Changed, ${data.metricLabel}"],
  ["FHFH What Changed for Skater One. Points: 2.00", "what-changed", `${MODULES}/whatChanged.ts`, "`FHFH What Changed for "],
  ["FHFH Role Watch, TOI per game. Up: A.", "role-watch", `${MODULES}/roleWatch.ts`, "`FHFH Role Watch, "],
  ["FHFH Last Nights Standouts, No roster limit, Nov 1.", "standouts-all", `${MODULES}/lastNightsStandouts.ts`, 'all: "No roster limit"'],
  ["FHFH Last Nights Standouts, Under 25% rostered, Nov 1.", "standouts-under", `${MODULES}/lastNightsStandouts.ts`, "under: `Under ${settings.rosterMax}% rostered`"],
  ["FHFH Last Nights Standouts, Top forwards, Nov 1.", "standouts-forwards", `${MODULES}/lastNightsStandouts.ts`, 'forwards: "Top forwards"'],
  ["FHFH Last Nights Standouts, Top defensemen, Nov 1.", "standouts-defensemen", `${MODULES}/lastNightsStandouts.ts`, 'defensemen: "Top defensemen"'],
  ["FHFH Last Nights Standouts, Goalies, Nov 1.", "standouts-goalies", `${MODULES}/lastNightsStandouts.ts`, "`FHFH ${STANDOUTS_TITLE}, ${viewTitle(settings)},"],
  ["FHFH Crease Shift: official start share over each team's last 5.", "crease-shift", `${MODULES}/creaseShift.ts`, "`FHFH Crease Shift: "],
  ["FHFH GSAx, NST model, all situations.", "goalie-gsax", `${MODULES}/goalieGsax.ts`, "`FHFH GSAx, NST model,"],
  ["FHFH busy and quiet goalies, last 10 games through 2026-11-01.", "busy-quiet", `${MODULES}/busyQuiet.ts`, "`FHFH busy and quiet goalies,"],
  ["FHFH goalie category rescue by saves, last 10 games.", "goalie-rescue", `${MODULES}/goalieRescue.ts`, "`FHFH goalie category rescue by "],
  ["FHFH hypothetical ratio scenario. One start.", "ratio-impact", `${MODULES}/ratioImpact.ts`, "`FHFH hypothetical ratio scenario."],
  ["FHFH Risky Starts, volume, 2026-11-01 to 2026-11-02.", "risky-starts", `${MODULES}/riskyStarts.ts`, "`FHFH Risky Starts, "],
  ['FHFH Start/Sit, 2026-11-01 to 2026-11-02, search "tor".', "start-sit", `${MODULES}/startSit.ts`, "`FHFH Start/Sit, "],
  ["FHFH Player vs Player, A and B, last 10 games.", "player-vs-player", `${MODULES}/playerVsPlayer.ts`, "`FHFH Player vs Player, "],
  ["FHFH Player Card, Skater One.", "player-cards", "lib/socialShare/postedWeek.ts", "Player Cards?"],
];

// A delivery that arrived ten minutes after its post, which is what a working applet looks like.
const live = (at: string) => ({ posted_at: new Date(new Date(at).getTime() - 600000).toISOString(), received_at: at });

describe("matchPostedCard", () => {
  it.each(POSTS.map(([alt, card]) => [alt, card]))("%s is %s", (alt, card) => expect(matchPostedCard(alt)).toBe(card));

  it("each rule's wording is still what the card's own alt text writes", () => {
    for (const [, card, file, wording] of POSTS) expect(readFileSync(join(process.cwd(), file), "utf8"), card).toContain(wording);
  });

  it("a Multi-Cat Stars total counts as that card whatever period its headline names", () => {
    for (const alt of ["FHFH Top Multi-Cat Stars of the Matchup, ranked", "FHFH Top Multi-Cat Stars, ranked 2026-10-15 to 2026-10-25"]) expect(matchPostedCard(alt), alt).toBe("stars-total");
    expect(matchPostedCard("FHFH Top Points-First Stars, ranked 2026-10-15 to 2026-10-25")).toBe("stars-total-points-first");
  });

  it("every landing card can be matched", () => {
    expect(LANDING_CARDS.map(card => card.id).filter(id => !POSTS.some(([, card]) => card === id))).toEqual([]);
  });

  it("anything else stays unmatched, with no guessing from words later in the text", () => {
    for (const alt of [null, undefined, "", "   ", "FHFH", "FHFH ", "A chart of Role Watch", "Crease Shift this week", "fhfh role watch", "FHFH Role Watcher, a new card", "FHFH Weekly recap", "FHFH goalies, week 5"]) {
      expect(matchPostedCard(alt), String(alt)).toBeNull();
    }
  });

  it("Game Grid off its posting day: a full week is the grid, a part of the week is Remaining Week", () => {
    expect(matchPostedCard("FHFH Best schedules, This week streamer grid, Nov 2, 2026 through Nov 8, 2026. Teams")).toBe("game-grid");
    expect(matchPostedCard("FHFH Best schedules, This week streamer grid, Nov 2, 2026 through Nov 8, 2026, covering Thu–Sun. Teams")).toBe("remaining-week");
  });
});

describe("New York weeks", () => {
  it("bounds a week at New York midnight", () => {
    expect(postedWeekRange("2026-11-02")).toEqual({ from: "2026-11-02T05:00:00.000Z", to: "2026-11-09T05:00:00.000Z" });
  });

  it("keeps the extra hour when the clocks go back, and loses one when they go forward", () => {
    expect(postedWeekRange("2026-10-26")).toEqual({ from: "2026-10-26T04:00:00.000Z", to: "2026-11-02T05:00:00.000Z" });
    expect(postedWeekRange("2027-03-08")).toEqual({ from: "2027-03-08T05:00:00.000Z", to: "2027-03-15T04:00:00.000Z" });
  });

  const WED = new Date("2026-11-04T16:00:00Z"), OLD_POST = "2026-10-01T16:00:00Z", LATEST = [live("2026-11-04T15:00:00Z")];
  const status = (week: ReturnType<typeof buildPostedWeek>) => Object.fromEntries(week.days.map(day => [day.id, day.status]));

  it("a late evening post in New York counts for that New York day, though UTC is already tomorrow", () => {
    const week = buildPostedWeek([{ posted_at: "2026-11-03T04:30:00Z", matched_card: null }], WED, OLD_POST, LATEST);
    expect(week.days.find(day => day.id === "mon")).toMatchObject({ date: "2026-11-02", posts: 1, status: "done" });
    expect(week.days.find(day => day.id === "tue")).toMatchObject({ date: "2026-11-03", posts: 0, status: "missed" });
  });

  it("a post before Monday's New York midnight belongs to last week, and is left out", () => {
    const week = buildPostedWeek([{ posted_at: "2026-11-02T04:59:00Z", matched_card: "game-grid" }], WED, OLD_POST, LATEST);
    expect(week.days.every(day => day.posts === 0)).toBe(true);
    expect(week.cards).toEqual([]);
  });

  it("the Sunday the clocks go back runs to New York midnight, 25 hours long", () => {
    const week = buildPostedWeek([
      { posted_at: "2026-11-01T04:00:00Z", matched_card: null },
      { posted_at: "2026-11-02T04:59:00Z", matched_card: null },
    ], new Date("2026-11-02T04:59:30Z"), OLD_POST, LATEST);
    expect(week.week).toBe("2026-10-26");
    expect(week.today).toBe("sun");
    expect(week.days.find(day => day.id === "sun")).toMatchObject({ date: "2026-11-01", posts: 2, status: "done" });
  });

  it("today with no post is not yet, future days are neutral, and earlier days with none are missed", () => {
    expect(status(buildPostedWeek([{ posted_at: "2026-11-02T16:00:00Z", matched_card: "game-grid" }], WED, OLD_POST, LATEST)))
      .toEqual({ mon: "done", tue: "missed", wed: "notYet", thu: "upcoming", fri: "upcoming", sat: "upcoming", sun: "upcoming" });
  });

  it("today turns done on its first post, and not yet becomes missed when the day ends", () => {
    expect(status(buildPostedWeek([{ posted_at: "2026-11-04T15:00:00Z", matched_card: null }], WED, OLD_POST, LATEST)).wed).toBe("done");
    expect(status(buildPostedWeek([], new Date("2026-11-05T04:59:00Z"), OLD_POST, LATEST)).wed).toBe("notYet");
    expect(status(buildPostedWeek([], new Date("2026-11-05T05:00:00Z"), OLD_POST, [live("2026-11-05T05:00:00Z")])).wed).toBe("missed");
    expect(status(buildPostedWeek([], new Date("2026-11-05T05:00:00Z"), OLD_POST, LATEST)).wed).toBe("noRecord");
  });

  it("days before the first post on record are untracked, not missed", () => {
    expect(status(buildPostedWeek([{ posted_at: "2026-11-03T16:00:00Z", matched_card: null }], WED, "2026-11-03T16:00:00Z", LATEST)))
      .toMatchObject({ mon: "untracked", tue: "done", wed: "notYet" });
  });

  describe("what silence can prove", () => {
    const hoursBefore = (at: Date, hours: number) => new Date(at.getTime() - hours * 3600 * 1000).toISOString();

    it("the rule's edges: a delivery is live from its own time to 6 hours after, and stale after 72 hours", () => {
      expect(POSTED_LIVE_WINDOW_HOURS).toBe(6);
      expect(POSTED_STALE_AFTER_HOURS).toBe(72);
      const received = "2026-11-04T15:00:00Z", at = new Date(received);
      expect(latestLiveDelivery([{ posted_at: received, received_at: received }])).toBe(received);
      expect(latestLiveDelivery([{ posted_at: hoursBefore(at, 6), received_at: received }])).toBe(received);
      expect(latestLiveDelivery([{ posted_at: hoursBefore(at, 6.01), received_at: received }])).toBeNull();
      expect(latestLiveDelivery([{ posted_at: "2026-11-04T15:01:00Z", received_at: received }])).toBeNull();
      expect(latestLiveDelivery([])).toBeNull();
      expect(buildPostedWeek([], WED, OLD_POST, [live(hoursBefore(WED, 72))]).stale).toBe(false);
      expect(buildPostedWeek([], WED, OLD_POST, [live(hoursBefore(WED, 72.01))]).stale).toBe(true);
    });

    it("a live delivery after a day makes that empty day missed, and the day it arrived and any later stay no record", () => {
      const now = new Date("2026-11-07T14:00:00Z"), week = buildPostedWeek([{ posted_at: "2026-11-04T15:00:00Z", matched_card: null }], now, OLD_POST, [live("2026-11-04T15:10:00Z")]);
      expect(week.latest).toBe("2026-11-04T15:10:00Z");
      expect(week.stale).toBe(false);
      expect(status(week)).toEqual({ mon: "missed", tue: "missed", wed: "done", thu: "noRecord", fri: "noRecord", sat: "notYet", sun: "upcoming" });
    });

    it("an October backfill received this week proves nothing about empty days", () => {
      const week = buildPostedWeek([], WED, OLD_POST, [{ posted_at: "2026-10-20T16:00:00Z", received_at: "2026-11-04T15:00:00Z" }]);
      expect(week.latest).toBeNull();
      expect(week.stale).toBe(true);
      expect(status(week)).toMatchObject({ mon: "noRecord", tue: "noRecord", wed: "noRecord" });
    });

    it("an undated post proves nothing either: it is no delivery at all", () => {
      const week = buildPostedWeek([], WED, OLD_POST, [], 1);
      expect(week.undated).toBe(1);
      expect(status(week)).toMatchObject({ mon: "noRecord", tue: "noRecord", wed: "noRecord" });
      expect(week.days.every(day => day.posts === 0)).toBe(true);
      expect(week.cards).toEqual([]);
    });

    it("a backfilled post still marks its own day done, and days before tracking stay untracked", () => {
      const week = buildPostedWeek([{ posted_at: "2026-11-03T16:00:00Z", matched_card: null }], WED, "2026-11-03T16:00:00Z", [{ posted_at: "2026-11-03T16:00:00Z", received_at: "2026-11-04T15:00:00Z" }]);
      expect(status(week)).toMatchObject({ mon: "untracked", tue: "done", wed: "noRecord" });
    });

    it("a stopped applet leaves no ❌ from its last live delivery on, and earlier empty days stay missed", () => {
      const now = new Date("2026-11-08T16:00:00Z"), week = buildPostedWeek([{ posted_at: "2026-11-04T16:00:00Z", matched_card: null }], now, OLD_POST, [live("2026-11-04T16:10:00Z")]);
      expect(week.stale).toBe(true);
      expect(status(week)).toEqual({ mon: "missed", tue: "missed", wed: "done", thu: "noRecord", fri: "noRecord", sat: "noRecord", sun: "noRecord" });
    });
  });

  it("counts posts by card, most first, with unmatched posts apart", () => {
    const week = buildPostedWeek([
      { posted_at: "2026-11-02T16:00:00Z", matched_card: "game-grid" },
      { posted_at: "2026-11-03T16:00:00Z", matched_card: "role-watch" },
      { posted_at: "2026-11-03T17:00:00Z", matched_card: "role-watch" },
      { posted_at: "2026-11-03T18:00:00Z", matched_card: null },
    ], WED, OLD_POST, LATEST);
    expect(week.cards).toEqual([{ card: "role-watch", name: "Role Watch", count: 2 }, { card: "game-grid", name: "Game Grid", count: 1 }]);
    expect(week.unmatched).toBe(1);
  });
});

describe("the strip's status with and without the source", () => {
  const posted = buildPostedWeek([{ posted_at: "2026-11-03T16:00:00Z", matched_card: null }], new Date("2026-11-04T16:00:00Z"), "2026-10-01T16:00:00Z", [live("2026-11-04T15:00:00Z")]);

  it("the source decides when it answers, and hand marks do not count", () => {
    expect(landingDayStatus("mon", "wed", new Set(["mon"]), posted)).toBe("missed");
    expect(landingDayStatus("tue", "wed", new Set(), posted)).toBe("done");
    expect(landingDayStatus("wed", "wed", new Set(), posted)).toBe("notYet");
    expect(landingDayStatus("thu", "wed", new Set(["thu"]), posted)).toBe("upcoming");
  });

  it("without the source, hand marks decide", () => {
    for (const source of [null, undefined]) {
      expect(landingDayStatus("mon", "wed", new Set(["mon"]), source)).toBe("done");
      expect(landingDayStatus("tue", "wed", new Set(["mon"]), source)).toBe("missed");
      expect(landingDayStatus("wed", "wed", new Set(), source)).toBe("missed");
    }
  });
});
