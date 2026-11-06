// Swipe trainer for tweet parsing: replays the current parser over one tweet, scores how sure it is, and defines the
// answer-key record TJ's verdicts produce so later parser changes can be scored against them.
// Pure: callers load teams and rosters (see tweetSwipeTrainerServer.ts).
import {
  buildLinesCccSourceFromIftttEvent,
  type ParsedLinesCccSource
} from "./linesCccIngestion";
import {
  classifyGameDayTweet,
  extractStructuredPlayerGroupsFromText,
  resolveTweetNameToRosterEntry,
  type RosterNameEntry,
  type TeamDirectoryEntry
} from "./lineupSourceIngestion";
import { normalizeIdentityName, resolvePlayerIdentity } from "./playerIdentity";
import { TWEET_INTERPRETATION_VERSION, tweetPipelineFlags } from "./tweetInterpretation";
import { matchTweetNewsPhrases } from "./tweetNewsAutomation";
import { createHash } from "crypto";
import {
  TWEET_PATTERN_CATEGORY_OPTIONS,
  type TweetPatternReviewAssignment
} from "./tweetPatternReview";

export type TrainerType = "line_combination" | "goalie" | "injury" | "transaction" | "other";

/** Queue order: line combinations first, then each next type as the previous one runs out. */
export const TRAINER_TYPE_ORDER: TrainerType[] = ["line_combination", "goalie", "injury", "transaction"];

export const TRAINER_TYPE_LABELS: Record<TrainerType, string> = {
  line_combination: "Line combinations",
  goalie: "Goalies",
  injury: "Injuries",
  transaction: "Transactions",
  other: "Other"
};

export type TrainerMatchBasis =
  | "full_name"
  | "alias"
  | "initial"
  | "surname"
  | "ambiguous"
  | "conflicting_membership"
  | "missing";

/**
 * Per-player match base score (0-100) by how the name was matched, after the audit's proposal
 * (tasks/artifacts/tweet-parsing-audit-2026-11-06.md section 5). Ambiguous names are capped at 40.
 */
export const MATCH_BASIS_CONFIDENCE: Record<TrainerMatchBasis, number> = {
  full_name: 100,
  alias: 90,
  initial: 85,
  surname: 75,
  ambiguous: 40,
  conflicting_membership: 30,
  missing: 0
};

/** A player whose position contradicts the slot (a D on a forward line) loses this much. */
export const POSITION_MISMATCH_PENALTY = 40;

/** Score bands: at or above HIGH is "likely correct"; below MID is red. Amber is in between. */
export const CONFIDENCE_BANDS = { high: 85, mid: 60 } as const;
export const TRAINER_CONFIDENCE_VERSION = "trainer-2026-11-06.3";

export type SlotRole = "forward" | "defense" | "goalie";

export type TrainerPlayerMatch = {
  raw: string;
  playerId: number | null;
  fullName: string | null;
  position: string | null;
  basis: TrainerMatchBasis;
  confidence: number;
  /** null when the slot has no role or the player's position is unknown. */
  positionFits: boolean | null;
  candidateIds: number[];
};

export type TrainerLine = { slots: TrainerPlayerMatch[]; kept: boolean };

export type TrainerPhraseHit = {
  ruleId: string;
  category: string;
  subcategory: string | null;
  tier: "auto" | "review" | "support";
  phrase: string;
};

/** One named penalty (points <= 0) or cap applied to the card score, in the order applied. */
export type TrainerConfidenceSignal = { label: string; points: number };

export type TrainerConfidence = {
  score: number;
  band: "high" | "mid" | "low";
  version: string;
  signals: TrainerConfidenceSignal[];
};

export type TrainerParse = {
  type: TrainerType;
  category: string;
  subcategory: string | null;
  classification: string | null;
  filterStatus: string;
  filterReason: string | null;
  teamId: number | null;
  teamAbbreviation: string | null;
  players: TrainerPlayerMatch[];
  forwards: TrainerLine[];
  defensePairs: TrainerLine[];
  /** Power-play units in order (PP1, PP2), up to five names each, in the order the tweet lists them. */
  powerPlay: TrainerLine[];
  goalies: TrainerPlayerMatch[];
  extras: TrainerPlayerMatch[];
  phraseHits: TrainerPhraseHit[];
  imageOnly: boolean;
  /** Names the interpretation path could not resolve (production runs that path). */
  unresolvedCount: number;
  publishedAtKnown: boolean;
  /** Answer-key v2 fields, as the trainer reads them from the tweet (see TrainerExtraction). */
  context: TrainerContext | null;
  scope: TrainerScope | null;
  game: TrainerGameBinding | null;
  powerPlaySwaps: TrainerPowerPlaySwap[];
  confidence: TrainerConfidence;
};

export type TrainerSlotValue = { playerId: number | null; name: string };

/**
 * Where a lineup report comes from (Lines decision 4). Warmup beats game, game beats practice, practice beats
 * projected. Practice reports are "Practice report, not game-confirmed": they never count as in-game changes.
 */
export type TrainerContext = "warmup" | "game" | "practice" | "projected";
export const TRAINER_CONTEXTS: TrainerContext[] = ["warmup", "game", "practice", "projected"];
export const TRAINER_CONTEXT_LABELS: Record<TrainerContext, string> = {
  warmup: "Warmup",
  game: "Game report",
  practice: "Practice report, not game-confirmed",
  projected: "Projected"
};

/** How much of a lineup the tweet gives: all of it, some units, or only a change to units given elsewhere. */
export type TrainerScope = "full" | "partial" | "change";
export const TRAINER_SCOPES: TrainerScope[] = ["full", "partial", "change"];
export const TRAINER_SCOPE_LABELS: Record<TrainerScope, string> = {
  full: "Full lineup",
  partial: "Partial lineup",
  change: "Change only"
};

/**
 * The game a tweet is about, only as far as the tweet says. A timestamp alone never binds a game: with no opponent,
 * date or game named, the binding is null. The trainer has no schedule lookup, so gameId stays null unless set.
 */
export type TrainerGameBinding = {
  gameId: number | null;
  opponentTeamId: number | null;
  /** The game's date (YYYY-MM-DD, Eastern), only when the tweet says it ("tonight", "today"). */
  date: string | null;
};

/**
 * One power-play change: who joins and who leaves one unit. Only the named players: the unit's other spots are never
 * filled from a swap ("Kulich and Krebs replace McLeod and Doan on PP2" is unit 2, in [Kulich, Krebs], out
 * [McLeod, Doan]).
 */
export type TrainerPowerPlaySwap = { unit: number; in: TrainerSlotValue[]; out: TrainerSlotValue[] };

/** What a tweet means, in a shape both the parser output and TJ's corrections share. */
export type TrainerExtraction = {
  type: TrainerType;
  category: string;
  subcategory: string | null;
  /**
   * The NHL team the tweet is about. Records saved before teams were labelled have none (undefined), and their team
   * isn't judged; null means "about no single team".
   */
  teamId?: number | null;
  players: TrainerSlotValue[];
  forwards: TrainerSlotValue[][];
  defensePairs: TrainerSlotValue[][];
  goalies: TrainerSlotValue[];
  /** Scratches and injured players listed with the lineup. */
  extras: TrainerSlotValue[];
  /** Extra forwards (13th F) listed after the lines. The parser has no field for them yet, so the key teaches it. */
  extraForwards: TrainerSlotValue[];
  /** Extra defensemen (7th D) listed after the pairs. */
  extraDefensemen: TrainerSlotValue[];
  /** Power-play units (PP1, PP2), five spots each in the tweet's order. Older records have none. */
  powerPlay: TrainerSlotValue[][];
  /** v1 only: players a power-play tweet said came off a unit. v2 records these as powerPlaySwaps[].out. */
  offPowerPlay: TrainerSlotValue[];
  /**
   * v2 fields. Undefined on v1 records, where they aren't judged. null means the tweet doesn't say.
   */
  context?: TrainerContext | null;
  scope?: TrainerScope | null;
  game?: TrainerGameBinding | null;
  powerPlaySwaps?: TrainerPowerPlaySwap[];
};

/** A power-play tweet: its spots are PP1 and PP2, not even-strength lines. */
export function isPowerPlaySubcategory(subcategory: string | null | undefined): boolean {
  return Boolean(subcategory?.startsWith("POWER PLAY"));
}

export type TrainerInput = {
  text: string;
  handles: string[];
  publishedAt: string | null;
  hasMedia: boolean;
};

/**
 * One answer-key record, stored in tweet_pattern_review_items.metadata.answerKey. A subset of the audit's sketch
 * (section 6): the exact text is pinned with its hash, lines are in tweet order, players are NHL ids plus the literal,
 * and the parser version and card confidence at label time are kept so later runs compare like with like.
 * Version 2 adds context, scope, game binding and power-play swaps to `parsed` and `expected`; version 1 records
 * still read, with those fields undefined and unjudged.
 */
export const ANSWER_KEY_VERSION = 2;
export type TweetAnswerKeyRecord = {
  version: 1 | 2;
  verdict: "correct" | "wrong";
  labeledAt: string;
  labeler: string;
  tweetId: string | null;
  input: TrainerInput;
  textSha256: string;
  parserAtLabel: { interpretation: boolean; interpretationVersion: string; confidence: TrainerConfidence };
  parsed: TrainerExtraction;
  parsedConfidence: number;
  expected: TrainerExtraction;
  notes: string | null;
};

const LINE_CLASSIFICATIONS = new Set(["lineup", "practice_lines", "power_play"]);
const TIER_RANK: Record<TrainerPhraseHit["tier"], number> = { auto: 3, review: 2, support: 1 };
const TYPE_CATEGORIES: Record<TrainerType, string[]> = {
  line_combination: ["LINE COMBINATION", "LINE CHANGE"],
  goalie: ["GOALIE START"],
  injury: ["INJURY", "REPORTED INJURY", "RETURN", "SCRATCHES"],
  transaction: ["TRANSACTION", "TRADE", "SIGNING"],
  other: []
};

function categoryOption(category: string) {
  return TWEET_PATTERN_CATEGORY_OPTIONS.find((option) => option.category === category) ?? null;
}

function knownSubcategory(category: string, subcategory: string | null | undefined): string | null {
  if (!subcategory) return null;
  return categoryOption(category)?.subcategories.includes(subcategory) ? subcategory : null;
}

export function isImageOnlyTweet(text: string, hasMedia: boolean): boolean {
  const hadLink = /https?:\/\/\S+/i.test(text);
  const words = text
    .replace(/^RT\s+@\w+:\s*/i, "")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/[@#]\w+/g, " ")
    .replace(/[^\p{L}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (hasMedia || hadLink) && words.length < 25;
}

function bestHit(hits: TrainerPhraseHit[], categories: string[]): TrainerPhraseHit | null {
  return hits
    .filter((hit) => categories.includes(hit.category))
    .sort((left, right) => TIER_RANK[right.tier] - TIER_RANK[left.tier])[0] ?? null;
}

function positionFits(position: string | null, role: SlotRole | null): boolean | null {
  const value = position?.toUpperCase();
  if (!role || !value) return null;
  if (role === "goalie") return value === "G";
  if (role === "defense") return value === "D";
  return ["C", "L", "R", "LW", "RW", "F"].includes(value);
}

function scoredMatch(args: {
  raw: string;
  player: RosterNameEntry | null;
  basis: TrainerMatchBasis;
  role: SlotRole | null;
  candidateIds: number[];
}): TrainerPlayerMatch {
  const position = args.player?.position ?? null;
  const fits = args.player ? positionFits(position, args.role) : null;
  const confidence = Math.max(0, MATCH_BASIS_CONFIDENCE[args.basis] - (fits === false ? POSITION_MISMATCH_PENALTY : 0));
  return {
    raw: args.raw,
    playerId: args.player?.playerId ?? null,
    fullName: args.player?.fullName ?? null,
    position,
    basis: args.basis,
    confidence,
    positionFits: fits,
    candidateIds: args.candidateIds
  };
}

function matchFromIdentity(raw: string, roster: RosterNameEntry[], role: SlotRole | null = null): TrainerPlayerMatch {
  const result = resolvePlayerIdentity(raw, roster);
  if (result.status === "matched") {
    const player = roster.find((entry) => entry.playerId === result.player.playerId) ?? (result.player as RosterNameEntry);
    return scoredMatch({ raw, player, basis: result.basis, role, candidateIds: [player.playerId] });
  }
  // The parser also applies its own alias overrides; a match only it finds is an alias match.
  const parserMatch = resolveTweetNameToRosterEntry(raw, roster);
  if (parserMatch) return scoredMatch({ raw, player: parserMatch, basis: "alias", role, candidateIds: [parserMatch.playerId] });
  return scoredMatch({
    raw,
    player: null,
    basis: result.status === "missing_player" ? "missing" : result.status,
    role,
    candidateIds: result.candidates.map((candidate) => candidate.playerId)
  });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** How a matched roster player appears in the text: the most specific form found wins. */
function mentionFor(text: string, entry: RosterNameEntry, role: SlotRole | null = null): TrainerPlayerMatch {
  const present = (needle: string) =>
    needle.trim().length > 0 &&
    new RegExp(`(?<![\\p{L}])${escapeRegExp(needle.trim()).replace(/\\?\s+/g, "\\s+")}(?![\\p{L}])`, "iu").test(text);
  const first = entry.fullName.trim().split(/\s+/)[0] ?? "";
  const forms: Array<[TrainerMatchBasis, string[]]> = [
    ["full_name", [entry.fullName]],
    ["alias", entry.aliases ?? []],
    ["initial", first ? [`${first[0]}. ${entry.lastName}`, `${first[0]}.${entry.lastName}`, `${first[0]} ${entry.lastName}`] : []],
    ["surname", [entry.lastName]]
  ];
  for (const [basis, needles] of forms) {
    const needle = needles.find(present);
    if (needle) return scoredMatch({ raw: needle, player: entry, basis, role, candidateIds: [entry.playerId] });
  }
  return scoredMatch({ raw: entry.fullName, player: entry, basis: "alias", role, candidateIds: [entry.playerId] });
}

function matchKeptName(text: string, name: string, roster: RosterNameEntry[], role: SlotRole | null): TrainerPlayerMatch {
  const entry = roster.find((player) => player.fullName === name);
  return entry ? mentionFor(text, entry, role) : matchFromIdentity(name, roster, role);
}

function sameIds(left: Array<number | null>, right: Array<number | null>) {
  return left.length === right.length && left.every((id, index) => id != null && id === right[index]);
}

/** Display lines: the parser's kept groups plus candidate groups it dropped, each slot with its match basis. */
function buildLines(args: {
  text: string;
  roster: RosterNameEntry[];
  kept: string[][];
  candidates: string[][];
  role: SlotRole;
}): TrainerLine[] {
  const candidateLines = args.candidates.map((group) => group.map((raw) => matchFromIdentity(raw, args.roster, args.role)));
  const used = new Set<number>();
  const lines: TrainerLine[] = args.kept.map((names) => {
    const ids = names.map((name) => resolveTweetNameToRosterEntry(name, args.roster)?.playerId ?? null);
    const index = candidateLines.findIndex(
      (line, candidateIndex) => !used.has(candidateIndex) && sameIds(line.map((slot) => slot.playerId), ids)
    );
    if (index >= 0) {
      used.add(index);
      return { slots: candidateLines[index]!, kept: true };
    }
    return { slots: names.map((name) => matchKeptName(args.text, name, args.roster, args.role)), kept: true };
  });
  candidateLines.forEach((slots, index) => {
    if (!used.has(index)) lines.push({ slots, kept: false });
  });
  return lines;
}

/** The parser's power-play units, PP1 before PP2 when it labelled them. */
function orderedPowerPlayUnits(metadata: Record<string, unknown> | null | undefined): string[][] {
  const units = Array.isArray(metadata?.powerPlayUnits) ? (metadata!.powerPlayUnits as string[][]) : [];
  const labels = Array.isArray(metadata?.powerPlayUnitLabels) ? (metadata!.powerPlayUnitLabels as Array<string | null>) : [];
  return units
    .map((names, index) => ({ names, rank: labels[index] === "pp1" ? 1 : labels[index] === "pp2" ? 2 : 3 + index }))
    .sort((left, right) => left.rank - right.rank)
    .map((unit) => unit.names.slice(0, 5));
}

function dedupePlayers(matches: TrainerPlayerMatch[]): TrainerPlayerMatch[] {
  const seen = new Map<string, TrainerPlayerMatch>();
  for (const match of matches) {
    const key = match.playerId != null ? `id:${match.playerId}` : `name:${normalizeIdentityName(match.raw)}`;
    const existing = seen.get(key);
    if (!existing || match.confidence < existing.confidence) seen.set(key, match);
  }
  return [...seen.values()];
}

function resolveType(args: {
  classification: string | null;
  filterStatus: string;
  hits: TrainerPhraseHit[];
}): TrainerType {
  if (args.filterStatus === "rejected_non_nhl") return "other";
  if (args.classification && LINE_CLASSIFICATIONS.has(args.classification)) return "line_combination";
  if (args.classification === "goalie_start") return "goalie";
  if (args.classification === "injury") return "injury";
  const scored = args.hits.filter((hit) => hit.tier !== "support");
  for (const type of ["transaction", "goalie", "injury"] as const) {
    if (bestHit(scored, TYPE_CATEGORIES[type])) return type;
  }
  return "other";
}

function resolveCategory(args: {
  type: TrainerType;
  classification: string | null;
  hits: TrainerPhraseHit[];
  text: string;
  filterStatus: string;
  filterReason: string | null;
  imageOnly: boolean;
  hasForwards: boolean;
  hasPairs: boolean;
}): { category: string; subcategory: string | null } {
  const hit = bestHit(args.hits, TYPE_CATEGORIES[args.type]);
  switch (args.type) {
    case "line_combination": {
      const subcategory =
        args.classification === "practice_lines"
          ? "PRACTICE LINES"
          : args.classification === "power_play"
            ? "POWER PLAY"
            : knownSubcategory("LINE COMBINATION", hit?.subcategory) ??
              (args.hasForwards ? "FORWARD LINES" : args.hasPairs ? "DEFENSE PAIRS" : null);
      return { category: "LINE COMBINATION", subcategory };
    }
    case "goalie":
      return { category: "GOALIE START", subcategory: knownSubcategory("GOALIE START", hit?.subcategory) };
    case "injury": {
      const category = hit && hit.category !== "REPORTED INJURY" ? hit.category : "INJURY";
      return { category, subcategory: knownSubcategory(category, hit?.subcategory) };
    }
    case "transaction": {
      const subcategory = /\btrade[ds]?\b/i.test(args.text)
        ? "TRADE"
        : /\bwaivers?\b/i.test(args.text)
          ? "WAIVER"
          : /\b(?:recalled|called up|call-up|call up)\b/i.test(args.text)
            ? "CALL UP"
            : /\b(?:assigned|sent down|reassigned|loaned)\b/i.test(args.text)
              ? "SENT DOWN"
              : "ROSTER MOVE";
      return { category: "TRANSACTION", subcategory };
    }
    default: {
      const subcategory =
        args.filterStatus === "rejected_non_nhl"
          ? "NON NHL"
          : args.imageOnly
            ? "UNSUPPORTED FORMAT"
            : args.filterReason === "ambiguous_multiple_team_labels"
              ? "MULTI TEAM ROUNDUP"
              : "AMBIGUOUS";
      return { category: "OTHER", subcategory };
    }
  }
}

/**
 * Card confidence (0-100), after the audit's proposal: start at 100, subtract named penalties, then apply caps.
 * Every input is a signal the parser already produces: NHL filter status, phrase-rule tier, structure (complete lines
 * and pairs), unresolved names and identity match quality. Image-only tweets are capped: text can't judge them.
 */
export function scoreTrainerConfidence(parse: Omit<TrainerParse, "confidence">): TrainerConfidence {
  const signals: TrainerConfidenceSignal[] = [];
  const penalize = (label: string, points: number) => {
    if (points < 0) signals.push({ label, points: Math.round(points) });
  };
  const isLineup = parse.type === "line_combination";
  const isPowerPlay = isLineup && isPowerPlaySubcategory(parse.subcategory);
  const powerPlayUnits = parse.powerPlay.filter((unit) => unit.kept).length;
  const keptUnits = [...parse.forwards, ...parse.defensePairs].filter((line) => line.kept).length + powerPlayUnits;

  if (!parse.publishedAtKnown) penalize("Publication time unknown", -10);

  const hit = bestHit(parse.phraseHits, TYPE_CATEGORIES[parse.type]);
  if (parse.type !== "other" && !(isLineup && keptUnits > 0)) {
    if (!hit) penalize("No phrase rule for this type", -10);
    else if (hit.tier === "review") penalize(`Phrase rule ${hit.ruleId} is review tier`, -10);
    else if (hit.tier === "support") penalize(`Only a support-tier rule (${hit.ruleId})`, -20);
  }
  const autoTypes = (Object.keys(TYPE_CATEGORIES) as TrainerType[]).filter((type) =>
    parse.phraseHits.some((entry) => entry.tier === "auto" && TYPE_CATEGORIES[type].includes(entry.category))
  );
  if (autoTypes.length > 1) penalize(`Rules from conflicting types (${autoTypes.join(", ")})`, -10);

  if (isLineup) {
    if (!keptUnits) penalize("Lineup type but no complete line or pair", -15);
    // A power-play tweet names two units, not seven even-strength ones.
    if (isPowerPlay) {
      penalize(`${Math.min(powerPlayUnits, 2)} of 2 power-play units complete`, -((2 - Math.min(powerPlayUnits, 2)) / 2) * 40);
    } else {
      penalize(`${Math.min(keptUnits, 7)} of 7 even-strength units complete`, -((7 - Math.min(keptUnits, 7)) / 7) * 40);
    }
  } else if (parse.type !== "other" && !parse.players.some((player) => player.playerId != null)) {
    penalize("No player matched for this claim", -30);
  }
  const unresolved = Math.max(parse.unresolvedCount, parse.players.filter((player) => player.playerId == null).length);
  if (unresolved) penalize(`${unresolved} unresolved name${unresolved === 1 ? "" : "s"}`, -Math.min(40, unresolved * 8));

  // A lineup tweet names everyone for a reason: a matched player left out of every spot (a missed backup goalie,
  // extras, a dropped line) means the reading is incomplete. Unmatched names are already counted above.
  if (isLineup) {
    const placed = new Set(
      [...parse.forwards, ...parse.defensePairs, ...parse.powerPlay]
        .filter((line) => line.kept)
        .flatMap((line) => line.slots)
        .concat(parse.goalies, parse.extras)
        .flatMap((match) => (match.playerId != null ? [match.playerId] : []))
    );
    const unplaced = parse.players.filter((player) => player.playerId != null && !placed.has(player.playerId)).length;
    if (unplaced) penalize(`${unplaced} named player${unplaced === 1 ? "" : "s"} not placed`, -Math.min(25, unplaced * 5));
  }

  const matched = parse.players.filter((player) => player.playerId != null);
  const mean = matched.length ? matched.reduce((sum, player) => sum + player.confidence, 0) / matched.length : 100;
  if (matched.length) penalize(`Name matches average ${Math.round(mean)}`, -(100 - mean) * 0.3);

  let score = 100 + signals.reduce((sum, signal) => sum + signal.points, 0);
  const cap = (limit: number, label: string) => {
    if (score > limit) {
      signals.push({ label, points: limit - Math.round(score) });
      score = limit;
    }
  };
  if (matched.length) {
    const weakest = Math.min(...matched.map((player) => player.confidence));
    cap(weakest + 20, `Capped at weakest name match (${weakest}) + 20`);
  }
  const filterCap: Record<string, string> = {
    rejected_ambiguous: "Capped: no single NHL team found",
    rejected_non_nhl: "Capped: not an NHL tweet",
    rejected_insufficient_text: "Capped: no text to read"
  };
  if (parse.filterStatus !== "accepted") cap(15, filterCap[parse.filterStatus] ?? `Capped: ${parse.filterStatus.replace(/_/g, " ")}`);
  if (parse.imageOnly) cap(15, "Image-only: text parsing can't judge it");

  const final = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score: final,
    band: final >= CONFIDENCE_BANDS.high ? "high" : final >= CONFIDENCE_BANDS.mid ? "mid" : "low",
    version: TRAINER_CONFIDENCE_VERSION,
    signals
  };
}

function phraseHitsFor(text: string): TrainerPhraseHit[] {
  return matchTweetNewsPhrases(text).map((match) => ({
    ruleId: match.ruleId,
    category: match.category,
    subcategory: match.subcategory,
    tier: match.confidence,
    phrase: match.phrase
  }));
}

/**
 * The trainer type without the full parse (which costs hundreds of milliseconds per tweet): the type comes from the
 * same legacy classifier and phrase rules the full parse uses. Only an NHL filter rejection can still turn it "other".
 */
export function quickTrainerType(text: string): TrainerType {
  return resolveType({ classification: classifyGameDayTweet(text), filterStatus: "accepted", hits: phraseHitsFor(text) });
}

/** Replays the current parser over one tweet. */
const EASTERN_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

type InterpretationView = {
  context?: "camp" | "practice" | "game" | "unknown";
  certainty?: "projected" | "confirmed" | "reported";
  relationships?: Array<{ kind: string; playerIds: number[]; situation: string | null; number: number | null }>;
};

/** Context applies to lineups and goalie starts; other tweets have none. Warmup beats the interpretation's "game". */
function readContext(args: { type: TrainerType; text: string; classification: string | null; interpretation: InterpretationView | null }): TrainerContext | null {
  if (args.type !== "line_combination" && args.type !== "goalie") return null;
  if (/\bwarm-?ups?\b/i.test(args.text)) return "warmup";
  const context = args.interpretation?.context ?? (args.classification === "practice_lines" ? "practice" : null);
  if (context === "practice" || context === "camp") return "practice";
  if (args.interpretation?.certainty === "projected" || /\b(projected|expected)\b/i.test(args.text)) return "projected";
  return context === "game" ? "game" : null;
}

/** "X will take Y's spot on the second unit power play": unit 2, in [X], out [Y]. Only fully resolved changes. */
function readPowerPlaySwaps(interpretation: InterpretationView | null, roster: RosterNameEntry[]): TrainerPowerPlaySwap[] {
  const slotFor = (playerId: number): TrainerSlotValue => ({
    playerId,
    name: roster.find((entry) => entry.playerId === playerId)?.fullName ?? String(playerId)
  });
  return (interpretation?.relationships ?? [])
    .filter((relation) => relation.kind === "substitution" && relation.situation === "pp" && relation.number != null && relation.playerIds.length === 2)
    .map((relation) => ({ unit: relation.number!, in: [slotFor(relation.playerIds[0]!)], out: [slotFor(relation.playerIds[1]!)] }));
}

function readScope(args: {
  type: TrainerType;
  subcategory: string | null;
  forwards: TrainerLine[];
  defensePairs: TrainerLine[];
  powerPlay: TrainerLine[];
  swaps: TrainerPowerPlaySwap[];
}): TrainerScope | null {
  if (args.type !== "line_combination") return null;
  if (args.swaps.length) return "change";
  if (isPowerPlaySubcategory(args.subcategory)) {
    const units = args.powerPlay.filter((unit) => unit.kept);
    if (!units.length) return null;
    return units.length >= 2 && units.every((unit) => unit.slots.length >= 5) ? "full" : "partial";
  }
  const lines = args.forwards.filter((line) => line.kept).length;
  const pairs = args.defensePairs.filter((line) => line.kept).length;
  if (!lines && !pairs) return null;
  return lines >= 4 && pairs >= 3 ? "full" : "partial";
}

/** "vs. Bruins", "against BOS", "at Boston Bruins": the opponent, when the tweet names one. */
function namesOpponent(text: string, team: TeamDirectoryEntry): boolean {
  const lead = String.raw`(?:\bvs\.?|\bversus|\bagainst|@|\bat)\s+(?:the\s+)?`;
  const words = [team.name, team.shortName].filter((word): word is string => Boolean(word)).map(escapeRegExp);
  if (words.length && new RegExp(`${lead}(?:${words.join("|")})\\b`, "i").test(text)) return true;
  // Abbreviations only in capitals, so "at sea" or "vs a" never read as a team.
  return new RegExp(`${lead}${escapeRegExp(team.abbreviation)}\\b`).test(text);
}

/** Only what the tweet says: a named opponent, and a date when it says "tonight" or "today". */
function readGame(args: {
  type: TrainerType;
  text: string;
  teamId: number | null;
  teams: TeamDirectoryEntry[];
  publishedAt: string | null;
}): TrainerGameBinding | null {
  if (args.type !== "line_combination" && args.type !== "goalie") return null;
  const opponent = args.teams.find((team) => team.id !== args.teamId && namesOpponent(args.text, team)) ?? null;
  const published = args.publishedAt ? new Date(args.publishedAt) : null;
  const date =
    published && !Number.isNaN(published.getTime()) && /\b(tonight|today|this (?:morning|afternoon|evening))\b/i.test(args.text)
      ? EASTERN_DATE.format(published)
      : null;
  if (!opponent && !date) return null;
  return { gameId: null, opponentTeamId: opponent?.id ?? null, date };
}

export function parseTweetForTrainer(args: {
  input: TrainerInput;
  teams: TeamDirectoryEntry[];
  rosterByTeam: Map<number, RosterNameEntry[]>;
}): TrainerParse {
  const text = args.input.text;
  const source: ParsedLinesCccSource = buildLinesCccSourceFromIftttEvent({
    event: {
      id: "trainer",
      source: "tweet-trainer",
      source_account: args.input.handles[0] ?? "unknown",
      username: args.input.handles[1] ?? args.input.handles[0] ?? null,
      text,
      link_to_tweet: null,
      tweet_id: null,
      tweet_created_at: args.input.publishedAt,
      created_at_label: null,
      raw_payload: {},
      received_at: args.input.publishedAt ?? new Date(0).toISOString()
    },
    snapshotDate: (args.input.publishedAt ?? new Date().toISOString()).slice(0, 10),
    teams: args.teams,
    rosterByTeam: args.rosterByTeam
  });
  const team = source.team ?? null;
  const roster = team ? args.rosterByTeam.get(team.id) ?? [] : [...args.rosterByTeam.values()].flat();
  const candidates = extractStructuredPlayerGroupsFromText(text);
  const forwards = buildLines({ text, roster, kept: source.forwards ?? [], candidates: candidates.forwards, role: "forward" });
  const defensePairs = buildLines({ text, roster, kept: source.defensePairs ?? [], candidates: candidates.defensePairs, role: "defense" });
  const goalies = (source.goalies ?? []).map((name) => matchKeptName(text, name, roster, "goalie"));
  const extras = [...(source.scratches ?? []), ...(source.injuries ?? [])].map((name) => matchKeptName(text, name, roster, null));
  const powerPlay = orderedPowerPlayUnits(source.metadata).map((names) => ({
    slots: names.map((name) => matchKeptName(text, name, roster, null)),
    kept: true
  }));
  // Production runs the interpretation path; its unresolved spans are the names it could not match.
  const interpretationUnresolved =
    (source.metadata?.interpretation as { unresolved?: Array<{ text: string; reason: string }> } | undefined)?.unresolved ?? [];
  const unresolvedNames = interpretationUnresolved
    .filter((issue) => issue.reason !== "invalid_extraction")
    .map((issue) => matchFromIdentity(issue.text, roster));
  const mentioned = (source.matchedPlayerIds ?? []).flatMap((id) => {
    const entry = roster.find((player) => player.playerId === id);
    return entry ? [mentionFor(text, entry)] : [];
  });
  const unmatched = (source.unmatchedNames ?? []).map((raw) => matchFromIdentity(raw, roster));
  const slotPlayers = [...forwards, ...defensePairs, ...powerPlay].filter((line) => line.kept).flatMap((line) => line.slots);
  const players = dedupePlayers([...slotPlayers, ...goalies, ...extras, ...mentioned, ...unmatched, ...unresolvedNames]);

  const phraseHits = phraseHitsFor(text);
  const imageOnly = isImageOnlyTweet(text, args.input.hasMedia);
  const classification = source.classification ?? null;
  const type = resolveType({ classification, filterStatus: source.nhlFilterStatus, hits: phraseHits });
  const { category, subcategory } = resolveCategory({
    type,
    classification,
    hits: phraseHits,
    text,
    filterStatus: source.nhlFilterStatus,
    filterReason: source.nhlFilterReason ?? null,
    imageOnly,
    hasForwards: forwards.some((line) => line.kept),
    hasPairs: defensePairs.some((line) => line.kept)
  });
  const interpretation = (source.metadata?.interpretation as InterpretationView | undefined) ?? null;
  const powerPlaySwaps = type === "line_combination" ? readPowerPlaySwaps(interpretation, roster) : [];
  const parse: Omit<TrainerParse, "confidence"> = {
    type,
    category,
    subcategory,
    classification,
    filterStatus: source.nhlFilterStatus,
    filterReason: source.nhlFilterReason ?? null,
    teamId: team?.id ?? null,
    teamAbbreviation: team?.abbreviation ?? null,
    players,
    forwards,
    defensePairs,
    powerPlay,
    goalies,
    extras,
    phraseHits,
    imageOnly,
    unresolvedCount: interpretationUnresolved.length,
    publishedAtKnown: Boolean(args.input.publishedAt),
    context: readContext({ type, text, classification, interpretation }),
    scope: readScope({ type, subcategory, forwards, defensePairs, powerPlay, swaps: powerPlaySwaps }),
    game: readGame({ type, text, teamId: team?.id ?? null, teams: args.teams, publishedAt: args.input.publishedAt }),
    powerPlaySwaps
  };
  return { ...parse, confidence: scoreTrainerConfidence(parse) };
}

function slotValue(match: TrainerPlayerMatch): TrainerSlotValue {
  return { playerId: match.playerId, name: match.fullName ?? match.raw };
}

/** The parser's answer in answer-key shape: only what it kept, not the dropped candidates. */
export function extractionFromParse(parse: TrainerParse): TrainerExtraction {
  return {
    type: parse.type,
    category: parse.category,
    subcategory: parse.subcategory,
    teamId: parse.teamId,
    players: parse.players.filter((player) => player.playerId != null).map(slotValue),
    forwards: parse.forwards.filter((line) => line.kept).map((line) => line.slots.map(slotValue)),
    defensePairs: parse.defensePairs.filter((line) => line.kept).map((line) => line.slots.map(slotValue)),
    goalies: parse.goalies.map(slotValue),
    extras: parse.extras.map(slotValue),
    extraForwards: [],
    extraDefensemen: [],
    powerPlay: parse.powerPlay.filter((unit) => unit.kept).map((unit) => unit.slots.map(slotValue)),
    offPowerPlay: [],
    context: parse.context,
    scope: parse.scope,
    game: parse.game,
    powerPlaySwaps: parse.powerPlaySwaps
  };
}

function slotKey(slot: TrainerSlotValue): string {
  return slot.playerId != null ? `id:${slot.playerId}` : `name:${normalizeIdentityName(slot.name)}`;
}

function sameSet(left: TrainerSlotValue[], right: TrainerSlotValue[]) {
  const a = new Set(left.map(slotKey));
  const b = new Set(right.map(slotKey));
  return a.size === b.size && [...a].every((key) => b.has(key));
}

/** Lines are ordered (L1 before L2); players within a line are compared as a set. */
function sameLines(left: TrainerSlotValue[][], right: TrainerSlotValue[][]) {
  return left.length === right.length && left.every((line, index) => sameSet(line, right[index]!));
}

/** Swaps are compared per unit; within a swap, who joins and who leaves are sets. */
function sameSwaps(left: TrainerPowerPlaySwap[], right: TrainerPowerPlaySwap[]) {
  const ordered = (swaps: TrainerPowerPlaySwap[]) => [...swaps].sort((a, b) => a.unit - b.unit);
  const a = ordered(left);
  const b = ordered(right);
  return a.length === b.length && a.every((swap, index) => swap.unit === b[index]!.unit && sameSet(swap.in, b[index]!.in) && sameSet(swap.out, b[index]!.out));
}

function sameGame(left: TrainerGameBinding | null, right: TrainerGameBinding | null) {
  return (left?.gameId ?? null) === (right?.gameId ?? null) &&
    (left?.opponentTeamId ?? null) === (right?.opponentTeamId ?? null) &&
    (left?.date ?? null) === (right?.date ?? null);
}

/** The v2 fields a comparison scores. Each is judged only when the answer key has it (v2 records). */
export const ANSWER_KEY_V2_FIELDS = ["contextMatch", "scopeMatch", "gameMatch", "swapsMatch"] as const;
export type AnswerKeyV2Field = (typeof ANSWER_KEY_V2_FIELDS)[number];

export type ExtractionComparison = {
  correct: boolean;
  typeMatch: boolean;
  categoryMatch: boolean;
  teamMatch: boolean;
  playersMatch: boolean;
  slotsMatch: boolean;
  /** null when the answer key doesn't have the field (v1 records). */
  contextMatch: boolean | null;
  scopeMatch: boolean | null;
  gameMatch: boolean | null;
  swapsMatch: boolean | null;
};

export function compareExtraction(expected: TrainerExtraction, actual: TrainerExtraction): ExtractionComparison {
  const typeMatch = expected.type === actual.type;
  const categoryMatch =
    expected.category === actual.category && (expected.subcategory ?? null) === (actual.subcategory ?? null);
  // Only judged when the answer names a team (older records don't).
  const teamMatch = expected.teamId === undefined || (expected.teamId ?? null) === (actual.teamId ?? null);
  const playersMatch = sameSet(expected.players, actual.players);
  const slotsMatch =
    sameLines(expected.forwards, actual.forwards) &&
    sameLines(expected.defensePairs, actual.defensePairs) &&
    expected.goalies.map(slotKey).join("|") === actual.goalies.map(slotKey).join("|") &&
    sameSet(expected.extras, actual.extras) &&
    sameSet(expected.extraForwards ?? [], actual.extraForwards ?? []) &&
    sameSet(expected.extraDefensemen ?? [], actual.extraDefensemen ?? []) &&
    sameLines(expected.powerPlay ?? [], actual.powerPlay ?? []) &&
    sameSet(expected.offPowerPlay ?? [], actual.offPowerPlay ?? []);
  const contextMatch = expected.context === undefined ? null : expected.context === (actual.context ?? null);
  const scopeMatch = expected.scope === undefined ? null : expected.scope === (actual.scope ?? null);
  const gameMatch = expected.game === undefined ? null : sameGame(expected.game, actual.game ?? null);
  const swapsMatch = expected.powerPlaySwaps === undefined ? null : sameSwaps(expected.powerPlaySwaps, actual.powerPlaySwaps ?? []);
  const v2Match = [contextMatch, scopeMatch, gameMatch, swapsMatch].every((match) => match !== false);
  return {
    correct: typeMatch && categoryMatch && teamMatch && playersMatch && slotsMatch && v2Match,
    typeMatch,
    categoryMatch,
    teamMatch,
    playersMatch,
    slotsMatch,
    contextMatch,
    scopeMatch,
    gameMatch,
    swapsMatch
  };
}

export function buildAnswerKeyRecord(args: {
  verdict: "correct" | "wrong";
  tweetId: string | null;
  input: TrainerInput;
  parse: TrainerParse;
  correction?: TrainerExtraction | null;
  notes?: string | null;
  labeledAt?: string;
}): TweetAnswerKeyRecord {
  const parsed = extractionFromParse(args.parse);
  // A correction made in an older editor may lack the v2 fields; they fall back to the parser's reading. Values
  // outside the unions (the API passes the body through) are stored as "the tweet doesn't say".
  const given = args.correction;
  const correction: TrainerExtraction | null = given
    ? {
        ...given,
        context: given.context === undefined ? parsed.context : TRAINER_CONTEXTS.includes(given.context as TrainerContext) ? given.context : null,
        scope: given.scope === undefined ? parsed.scope : TRAINER_SCOPES.includes(given.scope as TrainerScope) ? given.scope : null,
        game: given.game === undefined ? parsed.game : given.game ?? null,
        powerPlaySwaps: (given.powerPlaySwaps ?? parsed.powerPlaySwaps ?? []).filter(
          (swap) => Number.isInteger(swap.unit) && swap.unit >= 1 && swap.unit <= 2 && Array.isArray(swap.in) && Array.isArray(swap.out)
        )
      }
    : null;
  return {
    version: ANSWER_KEY_VERSION,
    verdict: args.verdict,
    labeledAt: args.labeledAt ?? new Date().toISOString(),
    labeler: "TJ",
    tweetId: args.tweetId,
    input: args.input,
    textSha256: createHash("sha256").update(args.input.text).digest("hex"),
    parserAtLabel: {
      interpretation: tweetPipelineFlags().interpretation,
      interpretationVersion: TWEET_INTERPRETATION_VERSION,
      confidence: args.parse.confidence
    },
    parsed,
    parsedConfidence: args.parse.confidence.score,
    expected: args.verdict === "correct" || !correction ? parsed : correction,
    notes: args.notes ?? null
  };
}

/** Review assignments for the existing review page, so a trainer verdict reads as an ordinary review. */
export function assignmentsFromExtraction(extraction: TrainerExtraction): TweetPatternReviewAssignment[] {
  const slots = [
    ...extraction.players,
    ...extraction.forwards.flat(),
    ...extraction.defensePairs.flat(),
    ...extraction.goalies,
    ...extraction.extras,
    ...(extraction.extraForwards ?? []),
    ...(extraction.extraDefensemen ?? []),
    ...(extraction.powerPlay ?? []).flat(),
    ...(extraction.offPowerPlay ?? []),
    ...(extraction.powerPlaySwaps ?? []).flatMap((swap) => [...swap.in, ...swap.out])
  ];
  const players = new Map<string, TrainerSlotValue>();
  for (const slot of slots) players.set(slotKey(slot), slot);
  const known = [...players.values()];
  return [
    {
      id: "trainer-1",
      category: extraction.category,
      subcategory: extraction.subcategory,
      playerIds: known.flatMap((slot) => (slot.playerId != null ? [slot.playerId] : [])),
      playerNames: known.map((slot) => slot.name),
      highlightPhrases: [],
      notes: null
    }
  ];
}

export function readAnswerKeyRecord(metadata: unknown): TweetAnswerKeyRecord | null {
  const record = (metadata as { answerKey?: TweetAnswerKeyRecord } | null)?.answerKey;
  if (!record || (record.version !== 1 && record.version !== 2) || !record.expected || !record.input) return null;
  // Records saved before extra forwards / defensemen or power-play units existed have none. v1 records keep the
  // v2 fields undefined, so comparisons don't judge them.
  const withExtras = (extraction: TrainerExtraction): TrainerExtraction => {
    const base: TrainerExtraction = {
      ...extraction,
      extraForwards: extraction.extraForwards ?? [],
      extraDefensemen: extraction.extraDefensemen ?? [],
      powerPlay: extraction.powerPlay ?? [],
      offPowerPlay: extraction.offPowerPlay ?? []
    };
    if (record.version === 1) return base;
    return {
      ...base,
      context: extraction.context ?? null,
      scope: extraction.scope ?? null,
      game: extraction.game ?? null,
      powerPlaySwaps: extraction.powerPlaySwaps ?? []
    };
  };
  return { ...record, parsed: withExtras(record.parsed), expected: withExtras(record.expected) };
}

export type RegressionCase = {
  id: string;
  type: TrainerType;
  baselineCorrect: boolean;
  comparison: ExtractionComparison;
};

export type RegressionSummary = {
  total: number;
  correct: number;
  accuracy: number;
  byType: Array<{ type: TrainerType; total: number; correct: number; accuracy: number }>;
  /** Per v2 field: how many v2 records were judged on it and how many matched. */
  byField: Array<{ field: AnswerKeyV2Field; total: number; correct: number; accuracy: number }>;
  newlyFixed: string[];
  newlyBroken: string[];
};

function ratio(correct: number, total: number) {
  return total ? Math.round((correct / total) * 1000) / 10 : 0;
}

export function summarizeRegression(cases: RegressionCase[]): RegressionSummary {
  const byType = (["line_combination", "goalie", "injury", "transaction", "other"] as TrainerType[])
    .map((type) => {
      const typed = cases.filter((entry) => entry.type === type);
      const correct = typed.filter((entry) => entry.comparison.correct).length;
      return { type, total: typed.length, correct, accuracy: ratio(correct, typed.length) };
    })
    .filter((entry) => entry.total > 0);
  const byField = ANSWER_KEY_V2_FIELDS.map((field) => {
    const judged = cases.filter((entry) => entry.comparison[field] !== null && entry.comparison[field] !== undefined);
    const matched = judged.filter((entry) => entry.comparison[field] === true).length;
    return { field, total: judged.length, correct: matched, accuracy: ratio(matched, judged.length) };
  }).filter((entry) => entry.total > 0);
  const correct = cases.filter((entry) => entry.comparison.correct).length;
  return {
    total: cases.length,
    correct,
    accuracy: ratio(correct, cases.length),
    byType,
    byField,
    newlyFixed: cases.filter((entry) => !entry.baselineCorrect && entry.comparison.correct).map((entry) => entry.id),
    newlyBroken: cases.filter((entry) => entry.baselineCorrect && !entry.comparison.correct).map((entry) => entry.id)
  };
}

export type RegressionResult = {
  id: string;
  tweetId: string | null;
  type: TrainerType;
  correct: boolean;
  baselineCorrect: boolean;
  comparison: ExtractionComparison;
  expected: TrainerExtraction;
  actual: TrainerExtraction;
};

/**
 * Replays the current parser over every labelled tweet and scores it against the answer key.
 * Baseline: a previous run's results (id -> correct) when given, otherwise the parser's verdict at label time.
 */
export async function replayAnswerKey(args: {
  entries: Array<{ id: string; record: TweetAnswerKeyRecord }>;
  contextFor: (record: TweetAnswerKeyRecord) => Promise<{ teams: TeamDirectoryEntry[]; rosterByTeam: Map<number, RosterNameEntry[]> }>;
  baseline?: Record<string, boolean> | null;
}): Promise<{ results: RegressionResult[]; summary: RegressionSummary }> {
  const results: RegressionResult[] = [];
  for (const { id, record } of args.entries) {
    const context = await args.contextFor(record);
    const actual = extractionFromParse(parseTweetForTrainer({ input: record.input, ...context }));
    const comparison = compareExtraction(record.expected, actual);
    results.push({
      id,
      tweetId: record.tweetId,
      type: record.expected.type,
      correct: comparison.correct,
      baselineCorrect: args.baseline?.[id] ?? record.verdict === "correct",
      comparison,
      expected: record.expected,
      actual
    });
  }
  return {
    results,
    summary: summarizeRegression(
      results.map((result) => ({ id: result.id, type: result.type, baselineCorrect: result.baselineCorrect, comparison: result.comparison }))
    )
  };
}
