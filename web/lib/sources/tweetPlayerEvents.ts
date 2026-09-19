import { identityMentionPresent } from "./tweetInterpretation";
import { normalizeIdentityName, resolvePlayerIdentity, type PlayerIdentity } from "./playerIdentity";

export type InjuryEventState = "new_injury" | "ongoing" | "setback" | "possible_return" | "confirmed_return" | "unknown";
export type InjuryTimeline = {
  purpose: "return" | "reassessment" | "absence" | "unknown";
  minimum: number | null;
  maximum: number | null;
  unit: "days" | "weeks" | "months" | null;
  targetDate: string | null;
  text: string;
};
export type TweetPlayerEvent = {
  playerId: number;
  playerName: string;
  kind: "injury" | "goalie";
  state: InjuryEventState | "projected" | "likely" | "confirmed" | "ruled_out";
  evidence: { start: number; end: number; text: string };
  timeline: InjuryTimeline | null;
  timelines: InjuryTimeline[];
  availability: "out" | "available" | "uncertain" | "unknown";
};

export function injuryAvailability(text: string): TweetPlayerEvent["availability"] {
  if (/\b(if|could|may|might|possibly|expected|questionable|not ruled out|not out|game.time decision|day.to.day)\b/i.test(text)) return "uncertain";
  if (/\b(will not play|won't play|not available|ruled out|remains out|still out|out tonight|out for|placed on (?:ir|ltir|injured reserve))\b/i.test(text)) return "out";
  if (classifyInjuryEvent(text) === "confirmed_return") return "available";
  return "unknown";
}

const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
export function extractInjuryTimeline(text: string, publishedAt: string | null): InjuryTimeline | null {
  const range = text.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(?:\s*(?:[-–—]|to)\s*(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve))?\s*(days?|weeks?|months?)\b/i);
  const relative = text.match(/\b(tomorrow|tonight|today)\b/i);
  const weekday = text.match(/\b(?:(next|last)\s+)?(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\b/i);
  const vague = text.match(/\b(day.to.day|week.to.week|indefinitely|indefinite|next week|next month|rest of (?:the )?season|after (?:the )?break)\b/i);
  if (!range && !relative && !weekday && !vague) return null;
  const number = (value: string) => NUMBER_WORDS[value.toLowerCase()] ?? Number(value);
  const timeIndex = range?.index ?? relative?.index ?? weekday?.index ?? vague?.index ?? 0;
  const leadIn = text.slice(0, timeIndex).split(/[.;]|\band\b/i).at(-1) ?? text;
  const purpose = /re[ -]?evaluat|reassess|check[ -]?up/i.test(leadIn) ? "reassessment" : /\breturn|back in|will play|available/i.test(leadIn) ? "return" : /\b(out|miss|sidelined)\b/i.test(leadIn) ? "absence" : "unknown";
  let targetDate: string | null = null;
  if ((relative || weekday) && publishedAt && Number.isFinite(Date.parse(publishedAt))) {
    const eastern = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(publishedAt));
    const date = new Date(`${eastern}T12:00:00Z`);
    if (relative?.[1]?.toLowerCase() === "tomorrow") date.setUTCDate(date.getUTCDate() + 1);
    if (weekday && !relative) {
      const target = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].indexOf(weekday[2]!.toLowerCase());
      let delta = (target - date.getUTCDay() + 7) % 7;
      if (weekday[1]?.toLowerCase() === "last") delta -= 7;
      if (weekday[1]?.toLowerCase() === "next" && delta === 0) delta = 7;
      date.setUTCDate(date.getUTCDate() + delta);
    }
    targetDate = date.toISOString().slice(0, 10);
  }
  return { purpose, minimum: range ? number(range[1]!) : null, maximum: range ? number(range[2] ?? range[1]!) : null,
    unit: range ? `${range[3]!.toLowerCase().replace(/s$/, "")}s` as InjuryTimeline["unit"] : null,
    targetDate, text: range?.[0] ?? relative?.[0] ?? weekday?.[0] ?? vague![0] };
}

export function classifyInjuryEvent(text: string, previous?: "injured" | "healthy"): InjuryEventState {
  const negatedReturn = /\b(?:not|never|won't|will not|cannot|can't)\b[^.;\n]{0,35}\b(?:return|play|available|cleared|back in)\b/i.test(text);
  if (/\b(?:no|not|without) (?:a )?(?:new )?(?:injury|injured|setback)\b/i.test(text)) return "unknown";
  if (/\b(setback|re[ -]?injur|aggravat)/i.test(text)) return "setback";
  if (!negatedReturn && /\b(could|might|may|hopes?|targeting|expected|possible|close|if)\b[^.;\n]{0,65}\b(return|play|available|back)\b/i.test(text)) return "possible_return";
  if (!negatedReturn && /\b(will play|will return|returns? (?:tonight|to the lineup)|back in the lineup|cleared to play|available tonight|good to go)\b/i.test(text)) return "confirmed_return";
  if (/\b(still out|remains out|continues? (?:to|rehab)|recovering|recovery)\b/i.test(text)) return "ongoing";
  if (negatedReturn || /\b(injur\w*|out|sidelined|ruled out|surgery|day.to.day|week.to.week)\b/i.test(text)) {
    if (previous === "injured") return "ongoing";
    if (previous === "healthy" || /\b(suffered|sustained|left (?:the )?(?:game|practice)|new injury)\b/i.test(text)) return "new_injury";
  }
  return "unknown";
}

export function extractInjuryTimelines(text: string, publishedAt: string | null): InjuryTimeline[] {
  return text.split(/[.;]|\s+(?:and|but)\s+/i).map((clause) => extractInjuryTimeline(clause, publishedAt))
    .filter((timeline): timeline is InjuryTimeline => timeline != null);
}

export function extractTweetPlayerEvents(args: {
  text: string; players: PlayerIdentity[]; publishedAt: string | null;
  priorStatus?: Map<number, "injured" | "healthy">;
}): TweetPlayerEvent[] {
  // Retain source offsets while matching accent/punctuation variants.
  let normalizedText = "", sourceOffset = 0;
  const sourcePositions: number[] = [];
  for (const character of args.text) {
    const normalized = character === "." ? "" : /\s|[‐‑–—−-]/u.test(character) ? " " : normalizeIdentityName(character);
    if (!(normalized === " " && normalizedText.endsWith(" "))) {
      normalizedText += normalized;
      for (let index = 0; index < normalized.length; index++) sourcePositions.push(sourceOffset);
    }
    sourceOffset += character.length;
  }
  const mentions: Array<{ player: PlayerIdentity; start: number; end: number }> = [];
  for (const player of args.players) {
    for (const name of [player.fullName, ...(player.aliases ?? []), player.lastName]) {
      if (!identityMentionPresent(args.text, name) || resolvePlayerIdentity(name, args.players).status !== "matched") continue;
      const escaped = normalizeIdentityName(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(`(?<![\\p{L}])${escaped}(?![\\p{L}])`, "giu");
      for (const match of normalizedText.matchAll(pattern)) {
        const start = sourcePositions[match.index!]!;
        const end = (sourcePositions[match.index! + match[0].length - 1] ?? start) + 1;
        if (!mentions.some((entry) => entry.player.playerId === player.playerId && start >= entry.start && start < entry.end)) mentions.push({ player, start, end });
      }
    }
  }
  mentions.sort((a, b) => a.start - b.start);
  return mentions.flatMap(({ player, start }, index): TweetPlayerEvent[] => {
    const end = mentions[index + 1]?.start ?? args.text.length;
    const text = args.text.slice(start, end).trimEnd();
    const evidence = { start, end: start + text.length, text };
    const events: TweetPlayerEvent[] = [];
    if (player.position === "G" && (/\b(starts?|starting|starter|in net|gets the nod|first off)\b/i.test(text) || (/\bconfirmed\b/i.test(text) && !/\b(injur\w*|out|surgery|return\w*)\b/i.test(text)))) {
      const state = /\b(not ruled out|could|may|might|if|projected|expected)\b/i.test(text) ? "projected" : /\b(will not|won't|not starting|ruled out)\b/i.test(text) ? "ruled_out" : /\b(likely|probable|first off)\b/i.test(text) ? "likely" : /\b(confirmed|will start|gets the start|starts tonight)\b/i.test(text) ? "confirmed" : "projected";
      events.push({ playerId: player.playerId, playerName: player.fullName, kind: "goalie", state, evidence, timeline: null, timelines: [], availability: state === "ruled_out" ? "out" : "unknown" });
    }
    const hasInjuryContext = events.length === 0 || /\b(injur\w*|surgery|recover\w*|re[ -]?evaluat\w*|setback)\b/i.test(text) || args.priorStatus?.get(player.playerId) === "injured";
    if (hasInjuryContext && /\b(injur\w*|return\w*|out|play|surgery|re[ -]?evaluat\w*|setback|available|recover\w*)\b/i.test(text)) events.push({ playerId: player.playerId, playerName: player.fullName, kind: "injury", state: classifyInjuryEvent(text, args.priorStatus?.get(player.playerId)), evidence,
      timeline: extractInjuryTimeline(text, args.publishedAt), timelines: extractInjuryTimelines(text, args.publishedAt), availability: injuryAvailability(text) });
    return events;
  });
}
