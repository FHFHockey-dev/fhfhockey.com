import moment from "moment-timezone";
import { LANDING_DAYS, landingCard, landingToday, landingWeekStart, type PostedWeek } from "./landingCatalog";
import { SHARE_TIME_ZONE } from "./types";

/**
 * The automatic source for the landing page's week strip: which card a post was, and each New York day's status.
 * A post is matched on the start of its alt text. "Copy alt text" does not always start with the card's name, and
 * one prefix can cover several tiles, so each rule below is the wording that card's altText really produces.
 * postedWeek.test.ts checks every rule against its source file and every landing card against a rule.
 */
const ALT_TEXT_RULES: readonly (readonly [RegExp, string])[] = [
  [/^Best schedules, Monday streamer grid\b/, "game-grid"],
  [/^Best schedules, Wednesday streamer grid\b/, "remaining-week"],
  [/^Best schedules,[^.]*, covering\b/, "remaining-week"],
  [/^Best schedules\b/, "game-grid"],
  [/^Off-Night Edge, rest of week\b/, "off-night-rest"],
  [/^Off-Night Edge, full week\b/, "off-night-weekly"],
  [/^completed games per team\b/, "team-games"],
  [/^Top Multi-Cat Stars of the Week\b/, "stars-total"],
  [/^Top Points-First Stars of the Week\b/, "stars-total-points-first"],
  [/^Top Multi-Cat Stars Per Game\b/, "stars-per-game"],
  [/^Top Points-First Stars Per Game\b/, "stars-per-game-points-first"],
  [/^goalies, Week \d/, "goalie-of-week"],
  [/^goalies, [A-Z][a-z]+\b/, "goalie-of-month"],
  [/^BSH leaders\b/, "bsh-leaders"],
  [/^BSH risers and fallers\b/, "bsh-risers"],
  [/^Multi Cat Monsters\b/, "multi-cat-monsters"],
  [/^Points-First Multi Cat Monsters\b/, "multi-cat-points-first"],
  [/^Nightly Floor: Cardio Masters\b/, "cardio-masters"],
  [/^Nightly Floor\b/, "nightly-floor"],
  [/^Tuesday trends\b/, "tuesday-trends"],
  [/^What Changed\b/, "what-changed"],
  [/^Role Watch\b/, "role-watch"],
  [/^Last Nights Standouts, No roster limit\b/, "standouts-all"],
  [/^Last Nights Standouts, Under \d/, "standouts-under"],
  [/^Last Nights Standouts, Top forwards\b/, "standouts-forwards"],
  [/^Last Nights Standouts, Top defensemen\b/, "standouts-defensemen"],
  [/^Last Nights Standouts, Goalies\b/, "standouts-goalies"],
  [/^Crease Shift\b/, "crease-shift"],
  [/^GSAx\b/, "goalie-gsax"],
  [/^busy and quiet goalies\b/, "busy-quiet"],
  [/^goalie category rescue\b/, "goalie-rescue"],
  [/^hypothetical ratio scenario\b/, "ratio-impact"],
  [/^Risky Starts\b/, "risky-starts"],
  [/^Start\/Sit\b/, "start-sit"],
  [/^Player vs Player\b/, "player-vs-player"],
  // The Player Cards studio has no Copy alt text, so this only matches alt text typed in this form.
  [/^Player Cards?\b/, "player-cards"],
];

/** The landing card a post's alt text names, or null. A post with no match stays unmatched; nothing guesses. */
export function matchPostedCard(altText: string | null | undefined): string | null {
  const body = altText?.trim().match(/^FHFH\s+([\s\S]*)/)?.[1];
  if (!body) return null;
  return ALT_TEXT_RULES.find(([rule]) => rule.test(body))?.[1] ?? null;
}

/** The New York week's bounds as instants. A Sunday the clocks change on is 23 or 25 hours long, so this is not 7 x 24. */
export function postedWeekRange(week: string) {
  const start = moment.tz(week, "YYYY-MM-DD", true, SHARE_TIME_ZONE);
  return { from: start.toISOString(), to: start.clone().add(7, "days").toISOString() };
}

const addDays = (week: string, days: number) => new Date(Date.UTC(Number(week.slice(0, 4)), Number(week.slice(5, 7)) - 1, Number(week.slice(8, 10)) + days)).toISOString().slice(0, 10);
const newYorkDate = (instant: Date) => moment(instant).tz(SHARE_TIME_ZONE).format("YYYY-MM-DD");

export type PostedRow = { posted_at: string; matched_card: string | null };

/**
 * This week's Mon to Sun status from the week's rows. `earliest` is the oldest post on record: a day before it is
 * "untracked", because the source did not exist yet and silence there says nothing. Today with no post is "notYet".
 */
export function buildPostedWeek(rows: readonly PostedRow[], now: Date, earliest: string, latest: string): PostedWeek {
  const week = landingWeekStart(now), today = landingToday(now), todayDate = newYorkDate(now), trackedFrom = newYorkDate(new Date(earliest));
  const posts = new Map<string, number>(), cards = new Map<string, number>();
  let unmatched = 0;
  for (const row of rows) {
    const instant = new Date(row.posted_at);
    if (landingWeekStart(instant) !== week) continue;
    const date = newYorkDate(instant);
    posts.set(date, (posts.get(date) ?? 0) + 1);
    if (row.matched_card) cards.set(row.matched_card, (cards.get(row.matched_card) ?? 0) + 1);
    else unmatched += 1;
  }
  return {
    available: true, week, today, trackedFrom, latest,
    days: LANDING_DAYS.map((day, index) => {
      const date = addDays(week, index), count = posts.get(date) ?? 0;
      const status = date > todayDate ? "upcoming" : count > 0 ? "done" : date === todayDate ? "notYet" : date < trackedFrom ? "untracked" : "missed";
      return { id: day.id, date, posts: count, status };
    }),
    cards: [...cards].map(([card, count]) => ({ card, name: landingCard(card)?.name ?? card, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    unmatched,
  };
}
