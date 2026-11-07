// The Social Share card matcher for the x-timeline-poll Deno function: an exact copy of ALT_TEXT_RULES and
// matchPostedCard from web/lib/socialShare/postedWeek.ts, which the edge runtime cannot import (it pulls in moment and
// the landing catalog). web/__tests__/lib/xTimelineFxtwitter.test.ts fails if the two rule lists ever differ, so edit
// postedWeek.ts first and copy the change here. Import-free, so web/ Vitest can load it.

export const ALT_TEXT_RULES: readonly (readonly [RegExp, string])[] = [
  [/^Best schedules, Monday streamer grid\b/, "game-grid"],
  [/^Best schedules, Wednesday streamer grid\b/, "remaining-week"],
  [/^Best schedules,[^.]*, covering\b/, "remaining-week"],
  [/^Best schedules\b/, "game-grid"],
  [/^Off-Night Edge, rest of week\b/, "off-night-rest"],
  [/^Hits, shots and blocks specialists\b/, "specialists-rest"],
  [/^Off-Night Edge, full week\b/, "off-night-weekly"],
  [/^Team Stream, Rest of week\b/, "team-stream-rest"],
  [/^Team Stream, Week \d/, "team-stream-matchup"],
  [/^completed games per team\b/, "team-games"],
  [/^Top Multi-Cat Stars\b(?! Per Game)/, "stars-total"],
  [/^Top Points-First Stars\b(?! Per Game)/, "stars-total-points-first"],
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
