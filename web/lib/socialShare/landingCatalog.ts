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

export const LANDING_CATEGORIES: readonly { id: string; label: string; cards: readonly string[] }[] = [
  { id: "schedule", label: "Schedule", cards: ["game-grid", "off-night-weekly", "off-night-rest", "team-games", "remaining-week"] },
  { id: "weekly", label: "Weekly", cards: ["game-grid", "off-night-weekly", "stars-total", "stars-total-points-first", "stars-per-game", "stars-per-game-points-first", "goalie-of-week"] },
  { id: "peripherals", label: "Peripherals", cards: ["bsh-leaders", "bsh-risers", "multi-cat-monsters", "multi-cat-points-first", "nightly-floor", "cardio-masters"] },
  { id: "trends", label: "Trends", cards: ["tuesday-trends", "what-changed", "role-watch"] },
  { id: "skaters", label: "Skaters", cards: ["what-changed", "role-watch", "stars-total", "stars-per-game", "bsh-leaders", "multi-cat-monsters", "nightly-floor", "standouts-forwards"] },
  { id: "defensemen", label: "Defensemen", cards: ["standouts-defensemen"] },
  { id: "standouts", label: "Standouts", cards: ["standouts-all", "standouts-under", "standouts-forwards", "standouts-defensemen", "standouts-goalies"] },
  { id: "goalies", label: "Goalies", cards: ["goalie-of-week", "goalie-of-month", "crease-shift", "goalie-gsax", "busy-quiet", "goalie-rescue", "ratio-impact", "risky-starts", "start-sit", "standouts-goalies"] },
  { id: "comparisons", label: "Comparisons", cards: ["player-vs-player"] },
  { id: "player-cards", label: "Player Cards", cards: ["player-cards"] },
];

export const LANDING_MISC = { id: "misc", label: "Misc", theme: "Fits any day", cards: ["standouts-all", "standouts-under", "standouts-forwards", "standouts-defensemen", "standouts-goalies", "player-vs-player", "team-games", "goalie-of-month"] } as const;

export const LANDING_DAYS: readonly { id: string; label: string; theme: string; cards: readonly string[] }[] = [
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

/** The ticks saved for `week`. Another week's ticks, or anything unreadable, count as none. */
export function readLandingChecklist(raw: string | null, week: string): ReadonlySet<string> {
  try {
    const saved = JSON.parse(raw ?? "null");
    return new Set(saved?.week === week && Array.isArray(saved.done) ? saved.done.filter((key: unknown) => typeof key === "string") : []);
  } catch { return new Set(); }
}
export const writeLandingChecklist = (week: string, done: ReadonlySet<string>) => JSON.stringify({ week, done: [...done] });
