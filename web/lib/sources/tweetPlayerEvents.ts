import { identityMentionPresent } from "./tweetInterpretation";
import { normalizeIdentityName, resolvePlayerIdentity, type PlayerIdentity, type PlayerIdentityResolution } from "./playerIdentity";

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
  teamId?: number | null;
  kind: "injury" | "goalie" | "participation";
  state: InjuryEventState | "projected" | "likely" | "confirmed" | "ruled_out" | "observed";
  evidence: { start: number; end: number; text: string; offsetBasis?: "unsanitized_source" };
  goalieRole?: "starter" | "backup";
  effectiveDate?: string | null;
  availabilityScope?: "game" | "unspecified";
  observation?: "warmup" | "first_off" | "practice";
  reviewReason?: "conflicting_claims" | "conflicting_history";
  modality?: "tentative" | "negated" | "affirmative" | "observation";
  resolutionBasis?: Extract<PlayerIdentityResolution, { status: "matched" }>["basis"];
  times?: { observation: string | null; reference: string | null; applicability: "unresolved" };
  timeline: InjuryTimeline | null;
  timelines: InjuryTimeline[];
  availability: "out" | "available" | "uncertain" | "unknown";
};

function isQuestionedClaim(text: string): boolean {
  return /\?(?=\s|["'’”)]|$)/.test(text);
}
const TENTATIVE_AVAILABILITY = /\b(if|could|may|might|possibly|expected|expect|would|gtd|hopeful|hopes?|should|think|speculation|speculates?|hypothetical|assuming|not confirmed|no decision|undecided|questionable|not (?:yet |been )?ruled out|hasn.t been ruled out|not out|game.time decision|day.to.day|too early to (?:tell|know))\b/i;

export function injuryAvailability(text: string): TweetPlayerEvent["availability"] {
  if (isQuestionedClaim(text)) return "uncertain";
  if (TENTATIVE_AVAILABILITY.test(text)) return "uncertain";
  const availabilityText = text.replace(/\b(?:not|no longer)\s+(?:(?:currently|listed)\s+)?on (?:ir|ltir|injured reserve)\b/gi, "");
  if (/\b(will not play|won't play|not available|ruled out|remains out|still out|out tonight|out (?:for )?(?:a minimum of |at least )?(?:the (?:rest of (?:the )?)?season|\d+|one|two|three|four|weeks?|months?|tonight|tomorrow)|will not return to (?:tonight.s|the) game|(?:placed )?on (?:ir|ltir|injured reserve))\b/i.test(availabilityText)) return "out";
  if (classifyInjuryEvent(availabilityText) === "confirmed_return") return "available";
  return "unknown";
}

const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
export function extractInjuryTimeline(text: string, publishedAt: string | null): InjuryTimeline | null {
  const range = text.match(/\b(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(?:\s*(?:[-–—]|to)\s*(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve))?\s*(days?|weeks?|months?)\b/i);
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
  return { purpose, minimum: range ? number(range[1]!) : null, maximum: range && !/\b(minimum(?: of)?|at least)\s*$/i.test(text.slice(0, range.index)) ? number(range[2] ?? range[1]!) : null,
    unit: range ? `${range[3]!.toLowerCase().replace(/s$/, "")}s` as InjuryTimeline["unit"] : null,
    targetDate, text: range?.[0] ?? relative?.[0] ?? weekday?.[0] ?? vague![0] };
}

export function classifyInjuryEvent(text: string, previous?: "injured" | "healthy"): InjuryEventState {
  if (isQuestionedClaim(text)) return "unknown";
  const negatedReturn = /\b(?:not|never|isn't|isn’t|won't|will not|cannot|can't)\b[^.;\n]{0,35}\b(?:return\w*|play\w*|available|cleared|healthy|ready|back in)\b/i.test(text);
  if (/\b(?:no|not|without) (?:a )?(?:new )?(?:injury|injured|setback)\b/i.test(text)) return "unknown";
  if (/\b(setback|re[ -]?injur|aggravat)/i.test(text)) return "setback";
  if (!negatedReturn && /\b(could|might|may|hopes?|hopeful|should|think|not confirmed|no decision|undecided|targeting|expected|possible|close|if)\b[^.;\n]{0,65}\b(return|play|available|back)\b/i.test(text)) return "possible_return";
  if (!negatedReturn && TENTATIVE_AVAILABILITY.test(text) && /\b(return\w*|play\w*|available|back|fully healthy)\b/i.test(text)) return "possible_return";
  if (!negatedReturn && /\b(will play|will return|returns? (?:tonight|to the lineup)|back in the lineup|cleared to play|available tonight|good to go)\b/i.test(text)) return "confirmed_return";
  if (!negatedReturn && /\bfully healthy\b.{0,80}\bready (?:to go )?for (?:training )?camp\b/i.test(text) && !TENTATIVE_AVAILABILITY.test(text)) return "confirmed_return";
  if (/\b(still out|remains out|(?:still )?day[ -]to[ -]day|continues? (?:to|rehab)|recovering|recovery)\b/i.test(text)) return "ongoing";
  if (negatedReturn || /\b(injur\w*|out (?:tonight|tomorrow|(?:for )?(?:the (?:rest of (?:the )?)?season|\d+))|sidelined|ruled out|surgery|day.to.day|week.to.week)\b/i.test(text)) {
    if (previous === "injured") return "ongoing";
    if ((previous === "healthy" && /\b(injur\w*|surgery|setback)\b/i.test(text)) || /\b(suffered|sustained|left (?:the )?(?:game|practice)|new injury)\b/i.test(text)) return "new_injury";
  }
  return "unknown";
}

export function extractInjuryTimelines(text: string, publishedAt: string | null): InjuryTimeline[] {
  return text.replace(/\b(Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\./gi, "$1").split(/(?<!\d)\.|\.(?!\d)|;|\s+(?:and|but)\s+/i).map((clause) => extractInjuryTimeline(clause, publishedAt))
    .filter((timeline): timeline is InjuryTimeline => timeline != null);
}

function injuryEffectiveDate(text: string, publishedAt: string | null): string | null {
  const match = text.match(/\bretroactive to (Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?\b/i);
  if (!match) return null;
  const year = match[3] ? Number(match[3]) : publishedAt && Number.isFinite(Date.parse(publishedAt)) ? Number(publishedAt.slice(0, 4)) : null;
  if (year == null) return null;
  const month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(match[1]!.slice(0, 3).toLowerCase());
  const date = new Date(Date.UTC(year, month, Number(match[2])));
  return date.getUTCMonth() === month && date.getUTCDate() === Number(match[2]) ? date.toISOString().slice(0, 10) : null;
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
  const mentions: Array<{ player: PlayerIdentity; start: number; end: number; basis: Extract<PlayerIdentityResolution, { status: "matched" }>["basis"] }> = [];
  const unresolvedMentions: Array<{ start: number; end: number }> = [];
  for (const player of args.players) {
    for (const name of [player.fullName, ...(player.aliases ?? []), player.lastName]) {
      if (!identityMentionPresent(args.text, name)) continue;
      const resolution = resolvePlayerIdentity(name, args.players);
      const escaped = normalizeIdentityName(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(`(?<![\\p{L}])${escaped}(?![\\p{L}])`, "giu");
      for (const match of normalizedText.matchAll(pattern)) {
        const start = sourcePositions[match.index!]!;
        const end = (sourcePositions[match.index! + match[0].length - 1] ?? start) + 1;
        // A lower-case noun inside prose is not evidence of a surname subject.
        const rawMention = args.text.slice(start, end);
        if (!/\s/.test(name) && rawMention === rawMention.toLocaleLowerCase() && /\p{L}/u.test(rawMention)) continue;
        if (resolution.status !== "matched") {
          unresolvedMentions.push({ start, end });
          continue;
        }
        if (!mentions.some((entry) => entry.player.playerId === player.playerId && start >= entry.start && start < entry.end)) mentions.push({ player, start, end, basis: resolution.basis });
      }
    }
  }
  // Full-name spans take precedence over contained aliases/surnames, including
  // aliases belonging to a different player.
  const contained = mentions.filter((mention) => mentions.some((other) => other !== mention && other.start <= mention.start && other.end >= mention.end && other.end - other.start > mention.end - mention.start));
  for (const mention of contained) mentions.splice(mentions.indexOf(mention), 1);
  mentions.sort((a, b) => a.start - b.start);
  const unresolvedStarts = unresolvedMentions.filter((unresolved) => !mentions.some((mention) => unresolved.start >= mention.start && unresolved.end <= mention.end)).map((mention) => mention.start);
  const extracted = mentions.flatMap(({ player, start, end: mentionEnd, basis }, index): TweetPlayerEvent[] => {
    // Anatomical notes can qualify a shared claim; a parenthetical predicate cannot.
    const coordinated = (left: number, right: number) => /^(?:[ \t]|,|&|\band\b)+$/i.test(args.text.slice(mentions[left]!.end, mentions[right]!.start)
      .replace(/\(\s*(?:(?:upper|lower)[ -]body|(?:(?:left|right)[ -])?(?:ankle|arm|back|foot|hand|hip|knee|leg|shoulder|wrist))(?:[ -]injury)?\s*\)/gi, "")
      .replace(/\b(?:forward|defenseman|defenceman|goaltender)\b/gi, ""));
    let first = index, last = index;
    while (first > 0 && coordinated(first - 1, first)) first--;
    while (last + 1 < mentions.length && coordinated(last, last + 1)) last++;
    start = mentions[first]!.start;
    mentionEnd = mentions[last]!.end;
    const nextMention = Math.min(mentions[last + 1]?.start ?? args.text.length, ...unresolvedStarts.filter((position) => position >= mentionEnd));
    const previousEnd = mentions[first - 1]?.end ?? 0;
    const prefix = args.text.slice(previousEnd, start);
    const clausePrefix = prefix.split(/[.;\n]|\b(?:and|but|while|whereas)\b/i).at(-1) ?? "";
    const evidenceStart = /\b(too early to (?:tell|know)|hopeful|hopes?|expected|expect|would|should|could|might|may|if|think|speculation|speculates?|hypothetical|assuming|not confirmed|did not confirm|confirmed|starting goalie|starting goaltender|starter)\b/i.test(clausePrefix)
      ? start - clausePrefix.length : start;
    // A sentence boundary also stops evidence before an unresolved subject.
    const remainder = args.text.slice(mentionEnd, nextMention);
    const sentenceBoundary = [...remainder.matchAll(/[.!?](?:\s+(?!(?:org|the organization|no decision)\b)|$)|[;\n]/gi)]
      .find((match) => !(match[0].startsWith(".") && /\b(?:Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)$/i.test(remainder.slice(0, match.index))))?.index ?? -1;
    // An unrecognized proper name or pronoun after a conjunction cannot lend its predicate to this subject.
    const subjectBoundary = remainder.search(/\b(?:[Aa][Nn][Dd]|[Bb][Uu][Tt]|[Ww][Hh][Ii][Ll][Ee]|[Ww][Hh][Ee][Rr][Ee][Aa][Ss])\s+(?=[\p{Lu}]|he\b|she\b|they\b|his\b|her\b|their\b)/u);
    const delimitedSubjectBoundary = remainder.search(/(?:[,–—]|\b(?:and|but|while|whereas)\b)\s+(?!(?:org|the organization|no decision)\b)(?=(?:[\p{L}'’.-]+\s+){1,4}(?:will|won't|is|was|remains|could|may|might|should)\b)/iu);
    const boundaries = [sentenceBoundary < 0 ? -1 : sentenceBoundary + 1, subjectBoundary, delimitedSubjectBoundary].filter((position) => position >= 0);
    const boundary = boundaries.length ? Math.min(...boundaries) : -1;
    // Only a sole named goalie leading onto the ice anchors this immediate
    // explicit pronoun claim; intervening sentences/subjects remain unresolved.
    const startContinuation = player.position === "G" && first === last && boundary === sentenceBoundary + 1
      && /\bleads?\b[^.;\n]*\b(?:on|in)to the ice\b/i.test(args.text.slice(start, mentionEnd + boundary))
      ? remainder.slice(sentenceBoundary + 1).match(/^\s*(?:he|she)(?:['’]ll|\s+will)\s+(?:get the start|start)\b[^.;\n]*(?:[.!?]|$)/i) : null;
    const end = startContinuation ? mentionEnd + sentenceBoundary + 1 + startContinuation[0].length
      : boundary < 0 ? nextMention : mentionEnd + boundary;
    const text = args.text.slice(evidenceStart, end).trimEnd();
    const evidence = { start: evidenceStart, end: evidenceStart + text.length, text };
    const events: TweetPlayerEvent[] = [];
    const observation = /\bfirst (?:goalie|goaltender) off|\bfirst off\b/i.test(text) ? "first_off" as const
      : /\bleads?\b[^.;\n]*\bout(?: for warmups)?\b|\bout for warmups\b/i.test(text) ? "warmup" as const : undefined;
    if (player.position === "G" && (observation || (/\b(starts?|starting|starter|in net|in goal|backs? (?:him|her|them) up|backup|gets the nod|first off)\b/i.test(text) || (/\bconfirmed\b/i.test(text) && !/\b(injur\w*|out|surgery|return\w*)\b/i.test(text))))) {
      const predicate = args.text.slice(mentions[last]!.end, evidence.end).replace(/^\s*\(\s*/, "");
      const historical = /\b(yesterday|last (?:night|game|season|week)|this season)\b/i.test(text)
        && !/\b(tonight|today|tomorrow|this (?:afternoon|evening))\b/i.test(text);
      const affirmative = Boolean(startContinuation) || /\b(confirmed|starting goal(?:ie|tender))\b/i.test(clausePrefix)
        || /^\s*(?:(?:will|to)\s+start\b|(?:(?:is|will be)\s+)?(?:starting|(?:the\s+)?starter|in (?:net|goal))\b|gets? the (?:start|nod)\b|backs? (?:him|her|them) up\b|(?:is\s+)?(?:the\s+)?backup\b|confirmed\b|starts?(?:\s+in (?:net|goal)\b|\s+(?:tonight|today|tomorrow|this (?:afternoon|evening))\b|(?=\s*(?:[.!?]|$))))/i.test(predicate);
      const state = observation || historical || /\b(practice|morning skate|camp)\b/i.test(text) || isQuestionedClaim(text) || TENTATIVE_AVAILABILITY.test(text) ? "projected"
        : /\b(did(?:n.t| not) confirm|projected)\b/i.test(text) ? "projected"
        : /\b(will not|won't|not (?:the )?(?:starting|starter|in (?:net|goal))|ruled out)\b/i.test(text) ? "ruled_out"
        : /\b(likely|probable|first off)\b/i.test(text) ? "likely" : affirmative ? "confirmed" : "projected";
      events.push({ playerId: player.playerId, playerName: player.fullName, kind: "goalie", state, goalieRole: /\b(backs? (?:him|her|them) up|backup)\b/i.test(text) ? "backup" : "starter", observation, evidence, timeline: null, timelines: [], availability: state === "ruled_out" ? "out" : "unknown" });
    }
    const hasInjuryContext = events.length === 0 || /\b(injur\w*|surgery|recover\w*|re[ -]?evaluat\w*|setback)\b/i.test(text) || args.priorStatus?.get(player.playerId) === "injured";
    if (hasInjuryContext && (injuryAvailability(text) === "out" || /\b(injur\w*|return\w*|(?:remains|still) out|out (?:tonight|tomorrow|(?:for )?(?:the (?:rest of (?:the )?)?season|\d+))|will play|suit up|will not play|won't play|surgery|re[ -]?evaluat\w*|setback|available|fully healthy|recover\w*|day[ -]to[ -]day|placed on (?:ir|ltir))\b/i.test(text))) events.push({ playerId: player.playerId, playerName: player.fullName, kind: "injury", state: classifyInjuryEvent(text, args.priorStatus?.get(player.playerId)), evidence,
      timeline: extractInjuryTimeline(text, args.publishedAt), timelines: extractInjuryTimelines(text, args.publishedAt), availability: injuryAvailability(text) });
    if (/\b(?:took|taking) rushes\b/i.test(text)) events.push({ playerId: player.playerId, playerName: player.fullName,
      kind: "participation", state: "observed", observation: "practice", evidence, timeline: null, timelines: [], availability: /\b(no decision|undecided)\b/i.test(text) ? "uncertain" : "unknown" });
    for (const event of events) {
      if (event.kind === "injury") {
        event.effectiveDate = injuryEffectiveDate(text, args.publishedAt);
        event.availabilityScope = /\bwill not return to (?:tonight.s|the) game\b/i.test(text) ? "game" : "unspecified";
      }
      event.teamId = player.teamId;
      event.modality = event.observation ? "observation" : /\b(not|isn.t|won.t|cannot|can.t|never)\b/i.test(text) ? "negated"
        : event.state === "possible_return" || event.state === "projected" || event.availability === "uncertain" ? "tentative" : "affirmative";
      event.resolutionBasis = basis;
      event.times = { observation: args.publishedAt, reference: event.timeline?.targetDate ?? null, applicability: "unresolved" };
    }
    return events;
  });
  for (const playerId of new Set(extracted.map((event) => event.playerId))) {
    const claims = extracted.filter((event) => event.playerId === playerId && event.kind === "injury");
    const relativeDate = (event: TweetPlayerEvent) => {
      const markers = [...event.evidence.text.matchAll(/\b(today|tonight|tomorrow|yesterday)\b/gi)].map((match) => /today|tonight/i.test(match[1]!) ? "current" : match[1]!.toLowerCase());
      return new Set(markers).size === 1 ? markers[0] : undefined;
    };
    const conflicting = claims.filter((event) => claims.some((other) => event !== other &&
      ((event.availability === "out" && other.availability === "available") || (event.availability === "available" && other.availability === "out")) &&
      (!relativeDate(event) || !relativeDate(other) || relativeDate(event) === relativeDate(other))));
    for (const event of conflicting) {
      event.availability = "uncertain"; event.state = "unknown"; event.reviewReason = "conflicting_claims";
    }
  }
  return extracted;
}
