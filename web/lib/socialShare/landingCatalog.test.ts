import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LANDING_CARDS, LANDING_CATEGORIES, LANDING_DAYS, LANDING_MISC, landingCard, landingCardHref, landingCardImage, landingDaySections, landingDayStatus, landingToday, landingWeekStart, readLandingChecklist, writeLandingChecklist } from "./landingCatalog";
import { parseShareSettings } from "./modules/contract";
import { SHARE_MODULES } from "./modules/registry";
import { isSocialShareFormat } from "./types";

const dayBuckets = [LANDING_MISC, ...LANDING_DAYS];

describe("landing tiles", () => {
  it("every post link names a registered post, and the studio keeps each view it asks for", () => {
    for (const card of LANDING_CARDS) {
      if (card.link.kind !== "post") continue;
      const entry = SHARE_MODULES.get(card.link.post);
      expect(entry, card.id).toBeDefined();
      const settings = card.link.settings ?? {};
      // The same parser the studio reads the URL with; an invalid value would throw and fall back to the defaults.
      const parsed = parseShareSettings(entry!, settings);
      for (const [field, value] of Object.entries(settings)) {
        expect(entry!.fields.some(item => item.id === field), `${card.id}: ${field}`).toBe(true);
        expect(parsed[field], `${card.id}: ${field}`).toBe(value);
      }
      const href = new URL(landingCardHref(card), "http://fhfh.invalid");
      expect(href.pathname).toBe("/social-share/posts");
      expect(Object.fromEntries(href.searchParams)).toEqual({ post: card.link.post, ...settings });
    }
  });

  it("older formats and Player Cards link to live routes, and the stubs stay out", () => {
    for (const card of LANDING_CARDS) if (card.link.kind === "format") expect(isSocialShareFormat(card.link.format), card.id).toBe(true);
    expect(landingCardHref(landingCard("player-cards")!)).toBe("/social-share/player-cards");
    expect(LANDING_CARDS.filter(card => card.link.kind === "format").map(card => landingCardHref(card)).sort()).toEqual(["/social-share/game-grid", "/social-share/remaining-week", "/social-share/remaining-week?card=specialists", "/social-share/tuesday-trends"]);
    for (const stub of ["player-spotlight", "category-rescue"]) expect(LANDING_CARDS.some(card => JSON.stringify(card).includes(stub)), stub).toBe(false);
  });

  it("no two tiles open the same card and view", () => {
    const hrefs = LANDING_CARDS.map(landingCardHref);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(new Set(LANDING_CARDS.map(card => card.id)).size).toBe(LANDING_CARDS.length);
  });

  it("every tile has an optimized example image on disk", () => {
    for (const card of LANDING_CARDS) {
      const file = join(process.cwd(), "public", landingCardImage(card));
      expect(existsSync(file), card.id).toBe(true);
      expect(statSync(file).size, card.id).toBeLessThan(80 * 1024);
    }
  });

  it("only the older formats and Player Cards are labelled as fixtures", () => {
    expect(LANDING_CARDS.filter(card => card.example === "fixture").map(card => card.id).sort()).toEqual(["game-grid", "player-cards", "remaining-week", "specialists-rest", "tuesday-trends"]);
  });
});

describe("landing maps", () => {
  const posts = (ids: readonly string[]) => ids.flatMap(id => { const link = landingCard(id)?.link; return link?.kind === "post" ? [link.post] : []; });

  it("the category and day maps name only real tiles, once per list", () => {
    for (const bucket of [...LANDING_CATEGORIES, ...dayBuckets]) {
      for (const id of bucket.cards) expect(landingCard(id), `${bucket.id}: ${id}`).toBeDefined();
      expect(new Set(bucket.cards).size, bucket.id).toBe(bucket.cards.length);
    }
  });

  it("every registered post has a tile in both maps", () => {
    const byCategory = new Set(posts(LANDING_CATEGORIES.flatMap(item => item.cards))), byDay = new Set(posts(dayBuckets.flatMap(item => item.cards)));
    for (const id of SHARE_MODULES.keys()) {
      expect(byCategory.has(id), `${id} by category`).toBe(true);
      expect(byDay.has(id), `${id} by day`).toBe(true);
    }
  });

  it("every tile lists under a category and exactly one day", () => {
    for (const { id } of LANDING_CARDS) {
      expect(LANDING_CATEGORIES.some(item => item.cards.includes(id)), id).toBe(true);
      expect(dayBuckets.filter(item => item.cards.includes(id)).length, id).toBe(1);
    }
  });

  it("follows TJ's plan: daily cards first, Standouts leads in its set order, and days keep their themes", () => {
    expect(LANDING_CATEGORIES.map(item => item.label)).toEqual(["Standouts", "Schedule", "Trends", "Peripherals", "Skaters", "Defensemen", "Goalies", "Weekly", "Comparisons", "Player Cards"]);
    expect(LANDING_CATEGORIES[0].cards).toEqual(["standouts-forwards", "standouts-defensemen", "standouts-goalies", "standouts-under", "standouts-all"]);
    const section = (id: string) => LANDING_CATEGORIES.find(item => item.id === id)!.cards;
    expect(section("skaters")[0]).toBe("standouts-forwards");
    expect(section("goalies")[0]).toBe("standouts-goalies");
    expect(section("defensemen")).toContain("standouts-defensemen");
    // Weekly-only cards follow the daily ones.
    expect(section("trends").indexOf("what-changed")).toBeLessThan(section("trends").indexOf("tuesday-trends"));
    expect(section("schedule").indexOf("team-games")).toBeLessThan(section("schedule").indexOf("game-grid"));
    expect(LANDING_DAYS.map(item => item.label)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    const day = (id: string) => LANDING_DAYS.find(item => item.id === id)!.cards;
    expect(day("mon")).toEqual(expect.arrayContaining(["game-grid", "off-night-weekly", "team-stream-matchup"]));
    expect(day("tue")).toContain("tuesday-trends");
    expect(day("wed")).toEqual(expect.arrayContaining(["remaining-week", "specialists-rest", "team-stream-rest"]));
    expect(day("thu")).toContain("player-cards");
    expect(day("fri")).toEqual(expect.arrayContaining(["goalie-rescue", "busy-quiet"]));
    for (const id of section("standouts")) expect(LANDING_MISC.cards, id).toContain(id);
  });
});

describe("landing day order", () => {
  it.each([
    ["mon", ["mon", "misc", "tue", "wed", "thu", "fri", "sat", "sun"]],
    ["wed", ["wed", "misc", "thu", "fri", "sat", "sun", "mon", "tue"]],
    ["fri", ["fri", "misc", "sat", "sun", "mon", "tue", "wed", "thu"]],
    ["sun", ["sun", "misc", "mon", "tue", "wed", "thu", "fri", "sat"]],
  ])("on %s: today, then Misc, then the rest from tomorrow", (today, expected) => {
    const sections = landingDaySections(today);
    expect(sections.map(item => item.id)).toEqual(expected);
    expect(sections.filter(item => item.today).map(item => item.id)).toEqual([today]);
  });
  it("names no day as today until the browser knows it", () => {
    expect(landingDaySections(null).map(item => item.id)).toEqual(["misc", "mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
    expect(landingDaySections(null).some(item => item.today)).toBe(false);
  });
});

describe("landing day status", () => {
  it("a past or current day is done or missed, and a future day is never missed", () => {
    const status = (day: string) => landingDayStatus(day, "wed", new Set(["mon"]));
    expect(LANDING_DAYS.map(day => status(day.id))).toEqual(["done", "missed", "missed", "upcoming", "upcoming", "upcoming", "upcoming"]);
    expect(landingDayStatus("wed", "wed", new Set(["wed"]))).toBe("done");
    // A stale mark on a day still ahead stays neutral too.
    expect(landingDayStatus("fri", "wed", new Set(["fri"]))).toBe("upcoming");
    expect(landingDayStatus("mon", null, new Set(["mon"]))).toBe("upcoming");
  });
});

describe("landing checklist week", () => {
  it("starts on Monday in New York, not in UTC", () => {
    expect(landingWeekStart(new Date("2026-11-01T16:00:00Z"))).toBe("2026-10-26"); // Sunday
    expect(landingWeekStart(new Date("2026-11-02T04:59:59Z"))).toBe("2026-10-26"); // Still Sunday, 23:59 in New York
    expect(landingWeekStart(new Date("2026-11-02T05:00:00Z"))).toBe("2026-11-02"); // Monday 00:00 in New York
    expect(landingWeekStart(new Date("2026-12-31T17:00:00Z"))).toBe("2026-12-28"); // Across a month
    expect(landingToday(new Date("2026-11-02T04:59:59Z"))).toBe("sun");
    expect(landingToday(new Date("2026-11-02T05:00:00Z"))).toBe("mon");
  });

  it("keeps this week's marks and resets on a new week or unreadable data", () => {
    const saved = writeLandingChecklist("2026-10-26", new Set(["mon"]));
    expect([...readLandingChecklist(saved, "2026-10-26")]).toEqual(["mon"]);
    expect(readLandingChecklist(saved, "2026-11-02").size).toBe(0);
    for (const raw of [null, "", "{", "null", "[]", '{"week":"2026-10-26"}', '{"week":"2026-10-26","done":"x"}']) expect(readLandingChecklist(raw, "2026-10-26").size, String(raw)).toBe(0);
    expect([...readLandingChecklist('{"week":"2026-10-26","done":["a",1]}', "2026-10-26")]).toEqual(["a"]);
  });
});
