import type { SocialShareFormat } from "./types";
import { SHARE_TIME_ZONE } from "./types";

/**
 * The /social-share landing page's one data file: every card, its deep link and example image, and where it lists
 * by category and by day. Plain data, so the page never loads the post registry; landingCatalog.test.ts checks every
 * link against that registry.
 */
export type LandingCardLink =
  | { kind: "post"; post: string; settings?: Readonly<Record<string, string>> }
  | { kind: "format"; format: SocialShareFormat }
  | { kind: "path"; path: string };

export type LandingCard = {
  id: string; name: string; purpose: string; link: LandingCardLink;
  /** Real editions come from the final local render; "fixture" images hold invented or unconfirmed data and say so. */
  example: "real" | "fixture";
  height?: number;
};

const post = (id: string, name: string, purpose: string, postId: string, settings?: Record<string, string>): LandingCard => ({ id, name, purpose, example: "real", link: { kind: "post", post: postId, settings } });

export const LANDING_CARDS: readonly LandingCard[] = [
  { id: "game-grid", name: "Game Grid", purpose: "Every team's week of games, ranked by schedule.", example: "fixture", link: { kind: "format", format: "game-grid" } },
  { id: "remaining-week", name: "Remaining Week", purpose: "The same grid for the days left this week.", example: "fixture", link: { kind: "format", format: "remaining-week" } },
  post("off-night-rest", "Off-Night Edge: Rest of Week", "Top schedules left, with a low-rostered forward and defenseman.", "off-night-edge", { dates: "rest-of-week" }),
  post("off-night-weekly", "Off-Night Edge: Weekly", "Top schedules for the full week, with a low-rostered pick per team.", "off-night-edge", { dates: "weekly" }),
  post("team-games", "Team Games Played", "Completed games per team over recent days.", "team-games"),
  post("stars-total", "Top Multi-Cat Stars: Week Total", "The fantasy week's top skaters by points, blocks, shots and hits.", "multi-cat-stars", { basis: "total", formula: "standard" }),
  post("stars-total-points-first", "Top Points-First Stars: Week Total", "The same week total, with points counted twice.", "multi-cat-stars", { basis: "total", formula: "pointsFirst" }),
  post("stars-per-game", "Top Multi-Cat Stars: Per Game", "The week's top skaters per game, minimum 2 games.", "multi-cat-stars", { basis: "perGame", formula: "standard" }),
  post("stars-per-game-points-first", "Top Points-First Stars: Per Game", "The per-game board, with points counted twice.", "multi-cat-stars", { basis: "perGame", formula: "pointsFirst" }),
  post("goalie-of-week", "Goalie of the Week", "Best and worst of the last completed matchup week, by category.", "goalie-period", { period: "week" }),
  post("goalie-of-month", "Goalie of the Month", "Best and worst of the last completed month, by category.", "goalie-period", { period: "month" }),
  post("bsh-leaders", "BSH Leaders", "Top blocks, shots and hits per game, with all three shown.", "bsh-board", { view: "leaders" }),
  post("bsh-risers", "BSH Risers and Fallers", "Who gained and lost the most BSH per game.", "bsh-board", { view: "movers" }),
  post("multi-cat-monsters", "Multi Cat Monsters", "Skaters ranked on percentiles in points, shots, hits and blocks.", "category-blueprint", { view: "standard" }),
  post("multi-cat-points-first", "Points-First Multi Cat Monsters", "The same ranking, with points counted twice.", "category-blueprint", { view: "points-first" }),
  post("nightly-floor", "Nightly Floor", "How often skaters clear a set line in a category.", "nightly-floor", { view: "sog" }),
  post("cardio-masters", "Cardio Masters", "Skaters who often finish a game with zero points.", "nightly-floor", { view: "cardio" }),
  { id: "tuesday-trends", name: "Tuesday Trends", purpose: "Hot and cold, deployment, rates and ownership movers.", example: "fixture", link: { kind: "format", format: "tuesday-trends" } },
  post("what-changed", "What Changed", "Recent production and usage against each skater's own baseline.", "what-changed"),
  post("role-watch", "Role Watch", "Who gained and lost ice time and power-play time.", "role-watch"),
  post("standouts-all", "Standouts: No Roster Limit", "Last night's results, hand-picked from everyone who played.", "last-nights-standouts", { view: "all" }),
  post("standouts-under", "Standouts: Under X% Rostered", "Last night's results, hand-picked from lower-rostered players.", "last-nights-standouts", { view: "under" }),
  post("standouts-forwards", "Standouts: Forwards", "Last night's top forwards against their own season.", "last-nights-standouts", { view: "forwards" }),
  post("standouts-defensemen", "Standouts: Defensemen", "Last night's top defensemen against their own season.", "last-nights-standouts", { view: "defensemen" }),
  post("standouts-goalies", "Standouts: Goalies", "Last night's goalies against their own season.", "last-nights-standouts", { view: "goalies" }),
  post("crease-shift", "Crease Shift", "How each team's starts have moved between its goalies.", "crease-shift"),
  post("goalie-gsax", "GSAx (NST model)", "Goals saved above expected, best and worst.", "goalie-gsax"),
  post("busy-quiet", "Busy and Quiet Goalies", "Shots faced, starts and relief, apart from how a goalie played.", "busy-quiet-goalies"),
  post("goalie-rescue", "Goalie Category Rescue", "Lower-rostered goalies by one category at a time.", "goalie-rescue"),
  post("ratio-impact", "Ratio Impact", "What one hypothetical start does to a goalie's SV% and GAA.", "ratio-impact"),
  post("risky-starts", "Risky Starts", "Goalie matchups by volume upside, ratio exposure and win support.", "risky-starts"),
  post("start-sit", "Start/Sit", "One goalie's schedule, game by game.", "start-sit"),
  post("player-vs-player", "Player vs Player", "Two players on one basis and strength.", "player-vs-player"),
  { id: "player-cards", name: "Player Cards", purpose: "A report card for one skater or goalie.", example: "fixture", height: 459, link: { kind: "path", path: "/social-share/player-cards" } },
];

export type LandingSection = { id: string; label: string; theme?: string; today?: boolean; cards: readonly string[] };

/** TJ's order: cards with daily opportunities first, and daily-use cards lead within a section. */
export const LANDING_CATEGORIES: readonly LandingSection[] = [
  { id: "standouts", label: "Standouts", cards: ["standouts-forwards", "standouts-defensemen", "standouts-goalies", "standouts-under", "standouts-all"] },
  { id: "schedule", label: "Schedule", cards: ["team-games", "off-night-rest", "remaining-week", "game-grid", "off-night-weekly"] },
  { id: "trends", label: "Trends", cards: ["what-changed", "role-watch", "tuesday-trends"] },
  { id: "peripherals", label: "Peripherals", cards: ["nightly-floor", "cardio-masters", "bsh-leaders", "bsh-risers", "multi-cat-monsters", "multi-cat-points-first"] },
  { id: "skaters", label: "Skaters", cards: ["standouts-forwards", "what-changed", "role-watch", "nightly-floor", "bsh-leaders", "multi-cat-monsters", "stars-total", "stars-per-game"] },
  { id: "defensemen", label: "Defensemen", cards: ["standouts-defensemen"] },
  { id: "goalies", label: "Goalies", cards: ["standouts-goalies", "risky-starts", "start-sit", "crease-shift", "busy-quiet", "goalie-rescue", "goalie-gsax", "ratio-impact", "goalie-of-week", "goalie-of-month"] },
  { id: "weekly", label: "Weekly", cards: ["game-grid", "off-night-weekly", "stars-total", "stars-total-points-first", "stars-per-game", "stars-per-game-points-first", "goalie-of-week"] },
  { id: "comparisons", label: "Comparisons", cards: ["player-vs-player"] },
  { id: "player-cards", label: "Player Cards", cards: ["player-cards"] },
];

export const LANDING_MISC: LandingSection = { id: "misc", label: "Misc", theme: "Fits any day", cards: ["standouts-forwards", "standouts-defensemen", "standouts-goalies", "standouts-under", "standouts-all", "player-vs-player", "team-games", "goalie-of-month"] };

export const LANDING_DAYS: readonly (LandingSection & { theme: string })[] = [
  { id: "mon", label: "Mon", theme: "Best schedules and streamers", cards: ["game-grid", "off-night-weekly", "multi-cat-monsters", "multi-cat-points-first", "bsh-leaders", "nightly-floor", "cardio-masters", "goalie-of-week"] },
  { id: "tue", label: "Tue", theme: "Trends", cards: ["tuesday-trends", "what-changed", "role-watch", "bsh-risers"] },
  { id: "wed", label: "Wed", theme: "Rest of week", cards: ["remaining-week", "off-night-rest"] },
  { id: "thu", label: "Thu", theme: "Player spotlight and goalie use", cards: ["player-cards", "crease-shift", "risky-starts", "start-sit", "goalie-gsax", "ratio-impact"] },
  { id: "fri", label: "Fri", theme: "Category rescue", cards: ["goalie-rescue", "busy-quiet"] },
  { id: "sat", label: "Sat", theme: "Light", cards: ["stars-per-game", "stars-per-game-points-first"] },
  { id: "sun", label: "Sun", theme: "Light", cards: ["stars-total", "stars-total-points-first"] },
];

const CARDS_BY_ID = new Map(LANDING_CARDS.map(card => [card.id, card]));
export const landingCard = (id: string) => CARDS_BY_ID.get(id);

export function landingCardHref({ link }: LandingCard) {
  if (link.kind === "format") return `/social-share/${link.format}`;
  if (link.kind === "path") return link.path;
  return `/social-share/posts?${new URLSearchParams({ post: link.post, ...link.settings })}`;
}
export const landingCardImage = ({ id }: LandingCard) => `/social-share/examples/${id}.webp`;

const newYorkDay = (now: Date) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: SHARE_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(now).map(part => [part.type, part.value]));
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day), weekday: parts.weekday.toLowerCase() };
};
/** Today's column id (mon to sun) in the app's New York week. */
export const landingToday = (now: Date) => newYorkDay(now).weekday;
/** This New York week's Monday, as YYYY-MM-DD. The checklist resets when it changes. */
export function landingWeekStart(now: Date) {
  const { year, month, day, weekday } = newYorkDay(now);
  const sinceMonday = LANDING_DAYS.findIndex(entry => entry.id === weekday);
  return new Date(Date.UTC(year, month - 1, day - sinceMonday)).toISOString().slice(0, 10);
}

/** By day's sections: today, then Misc, then the other days from tomorrow. Until the browser knows today, Misc and Mon to Sun. */
export function landingDaySections(today: string | null): readonly LandingSection[] {
  const at = LANDING_DAYS.findIndex(day => day.id === today);
  if (at < 0) return [LANDING_MISC, ...LANDING_DAYS];
  return [{ ...LANDING_DAYS[at], today: true }, LANDING_MISC, ...LANDING_DAYS.slice(at + 1), ...LANDING_DAYS.slice(0, at)];
}

export type LandingDayStatus = "done" | "missed" | "upcoming" | "notYet" | "untracked";
/** The automatic source's answer for one New York week (lib/socialShare/postedWeek.ts builds it on the server). */
export type PostedWeek = {
  available: true; week: string; today: string; trackedFrom: string; latest: string;
  days: readonly { id: string; date: string; posts: number; status: LandingDayStatus }[];
  cards: readonly { card: string; name: string; count: number }[];
  unmatched: number;
};
/**
 * One day's state in the top strip: the automatic source's answer when it has one for this week, otherwise the
 * hand-marked days, the fallback when the source is unavailable. A day that has not come yet is never "missed".
 */
export function landingDayStatus(day: string, today: string | null, marked: ReadonlySet<string>, posted?: PostedWeek | null): LandingDayStatus {
  const ids = LANDING_DAYS.map(entry => entry.id), now = today ? ids.indexOf(today) : -1;
  if (now < 0 || ids.indexOf(day) > now) return "upcoming";
  return posted?.days.find(entry => entry.id === day)?.status ?? (marked.has(day) ? "done" : "missed");
}

/** The days marked for `week`. Another week's marks, or anything unreadable, count as none. */
export function readLandingChecklist(raw: string | null, week: string): ReadonlySet<string> {
  try {
    const saved = JSON.parse(raw ?? "null");
    return new Set(saved?.week === week && Array.isArray(saved.done) ? saved.done.filter((key: unknown) => typeof key === "string") : []);
  } catch { return new Set(); }
}
export const writeLandingChecklist = (week: string, done: ReadonlySet<string>) => JSON.stringify({ week, done: [...done] });
