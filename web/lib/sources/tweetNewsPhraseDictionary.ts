export type TweetNewsCategory =
  | "LINE COMBINATION"
  | "GOALIE START"
  | "INJURY"
  | "RETURN"
  | "SCRATCHES"
  | "TRANSACTION"
  | "OTHER";

export type TweetNewsRuleConfidence = "auto" | "review" | "support";

export type TweetNewsPhraseRule = {
  id: string;
  category: TweetNewsCategory;
  subcategory: string | null;
  confidence: TweetNewsRuleConfidence;
  autoPublish: boolean;
  phrases: string[];
  regexes: string[];
  requiredEvidence: Array<"team" | "player" | "goalie" | "lineupStructure">;
  corpusMatches: number;
  notes: string;
};

export type TweetNewsExclusionRule = {
  id: string;
  reason: string;
  regexes: string[];
};

export const tweetNewsPhraseDictionary = [
  {
    id: "goalie-start-confirmed",
    category: "GOALIE START",
    subcategory: "CONFIRMED STARTER",
    confidence: "auto",
    autoPublish: true,
    phrases: [
      "starting goalie",
      "confirmed starter",
      "gets the start",
      "will start",
      "starts",
      "in net",
      "between the pipes",
    ],
    regexes: [
      "\\bstarting goalie\\b",
      "\\bconfirmed starter\\b",
      "\\bgets? the start\\b",
      "\\bwill start\\b",
      "\\bstarts\\b",
      "\\bin net\\b",
      "\\bbetween the pipes\\b",
    ],
    requiredEvidence: ["team", "goalie"],
    corpusMatches: 318,
    notes:
      "Strongest cluster in the audit. 'starting goalie' alone matched 286 unique records.",
  },
  {
    id: "goalie-start-expected-warmup",
    category: "GOALIE START",
    subcategory: "EXPECTED STARTER",
    confidence: "review",
    autoPublish: false,
    phrases: [
      "first goalie off",
      "led the team out",
      "leads the team out",
      "leads onto the ice",
      "starter's crease",
      "expected starter",
      "expected to start",
    ],
    regexes: [
      "\\bfirst (?:goalie )?off\\b",
      "\\bled the team out\\b",
      "\\bleads? (?:the )?.{0,40}\\b(?:out|onto the ice)\\b",
      "\\bstarter'?s crease\\b",
      "\\bexpected starter\\b",
      "\\bexpected to start\\b",
    ],
    requiredEvidence: ["team", "goalie"],
    corpusMatches: 3,
    notes:
      "Reviewed examples used 'led the team out' and 'leads ... on to the ice'; keep review-gated until false positives are measured.",
  },
  {
    id: "line-combination-forward-lines",
    category: "LINE COMBINATION",
    subcategory: "FORWARD LINES",
    confidence: "auto",
    autoPublish: true,
    phrases: [
      "line rushes",
      "projected lines",
      "forward lines",
      "line combinations",
      "line combos",
      "lines remain the same",
    ],
    regexes: [
      "\\bline rushes\\b",
      "\\bprojected lines?\\b",
      "\\bforward lines?\\b",
      "\\bline combinations?\\b",
      "\\bline combos?\\b",
      "\\blines? remain(?:s)? the same\\b",
    ],
    requiredEvidence: ["team", "lineupStructure"],
    corpusMatches: 29,
    notes:
      "Use with parsed three-player line structure. Avoid auto-publishing headline-only wrappers without quoted/original text.",
  },
  {
    id: "line-combination-practice-warmup",
    category: "LINE COMBINATION",
    subcategory: "PRACTICE LINES",
    confidence: "auto",
    autoPublish: true,
    phrases: [
      "warmup lines",
      "practice lines",
      "morning skate",
      "pregame warmup",
      "rushes were",
      "skated with",
    ],
    regexes: [
      "\\bwarmups?\\b.{0,40}\\blines?\\b",
      "\\blines?\\b.{0,40}\\bwarmups?\\b",
      "\\bpractice lines?\\b",
      "\\bmorning skate\\b",
      "\\bpregame warmups?\\b",
      "\\brushes were\\b",
      "\\bskated with\\b",
    ],
    requiredEvidence: ["team", "lineupStructure"],
    corpusMatches: 125,
    notes:
      "Warmup/morning-skate phrases were frequent but can describe injuries or goalie starts; require either lineup structure or player assignment before publish.",
  },
  {
    id: "line-combination-defense-pairs",
    category: "LINE COMBINATION",
    subcategory: "DEFENSE PAIRS",
    confidence: "auto",
    autoPublish: true,
    phrases: ["defense pairs", "defence pairs", "defense pairings", "d pairs"],
    regexes: [
      "\\bdefen[cs]e\\s*(?:pairs?|pairings?)\\b",
      "\\bd\\s*(?:pairs?|pairings?)\\b",
    ],
    requiredEvidence: ["team", "lineupStructure"],
    corpusMatches: 3,
    notes:
      "Lower volume in the audit, but reliable when two-player pair structure is present.",
  },
  {
    id: "line-combination-power-play",
    category: "LINE COMBINATION",
    subcategory: "POWER PLAY",
    confidence: "auto",
    autoPublish: true,
    phrases: [
      "power play",
      "power-play",
      "power play units",
      "pp1",
      "pp2",
      "pp units",
    ],
    regexes: [
      "\\bpower[- ]play\\b",
      "\\bpower play units?\\b",
      "\\bpp\\s*[12]\\b",
      "\\bpp units?\\b",
    ],
    requiredEvidence: ["team"],
    corpusMatches: 15,
    notes:
      "Good candidate for cards, but should render as line-combination subtype rather than injury/news if players resolve.",
  },
  {
    id: "injury-out",
    category: "INJURY",
    subcategory: "OUT",
    confidence: "auto",
    autoPublish: true,
    phrases: [
      "will not play",
      "won't play",
      "ruled out",
      "is out",
      "out tonight",
      "out for Game",
      "not a possibility",
      "unavailable",
    ],
    regexes: [
      "\\b(?:will not|won't|does not|doesn't) play\\b",
      "\\bruled out\\b",
      "\\bis out\\b",
      "\\bout tonight\\b",
      "\\bout for Games?\\b",
      "\\bnot a possibility\\b",
      "\\bunavailable\\b",
    ],
    requiredEvidence: ["player"],
    corpusMatches: 8,
    notes:
      "Reviewed misses included 'not a possibility', 'out tonight', and 'out for Games 1 and 2'.",
  },
  {
    id: "injury-questionable-practice",
    category: "INJURY",
    subcategory: "QUESTIONABLE",
    confidence: "review",
    autoPublish: false,
    phrases: [
      "game time decision",
      "not practicing",
      "not at practice",
      "not on the ice",
      "not doing any drills",
      "limited participant",
      "working with goalie",
    ],
    regexes: [
      "\\bgame[- ]time decision\\b",
      "\\bnot practicing\\b",
      "\\bnot at practice\\b",
      "\\bnot on the ice\\b",
      "\\bnot doing any drills\\b",
      "\\blimited participant\\b",
      "\\bworking with goalie\\b",
    ],
    requiredEvidence: ["player"],
    corpusMatches: 7,
    notes:
      "Practice absence is meaningful but context-sensitive; publish as draft/review unless the tweet also says out, doubtful, or unavailable.",
  },
  {
    id: "injury-day-to-day",
    category: "INJURY",
    subcategory: "DAY TO DAY",
    confidence: "auto",
    autoPublish: true,
    phrases: ["day to day", "day-to-day"],
    regexes: ["\\bday[- ]to[- ]day\\b"],
    requiredEvidence: ["player"],
    corpusMatches: 12,
    notes:
      "Clear phrase. Audit found parser sometimes classified these as line/practice context.",
  },
  {
    id: "injury-type-support",
    category: "INJURY",
    subcategory: "INJURY TYPE",
    confidence: "support",
    autoPublish: false,
    phrases: ["upper body", "lower body", "illness", "maintenance"],
    regexes: [
      "\\bupper[- ]body\\b",
      "\\blower[- ]body\\b",
      "\\billness\\b",
      "\\bmaintenance\\b",
    ],
    requiredEvidence: ["player"],
    corpusMatches: 18,
    notes:
      "Support phrases should enrich an injury card, not create one unless paired with out/questionable/left practice language.",
  },
  {
    id: "return-available",
    category: "RETURN",
    subcategory: "RETURNING",
    confidence: "review",
    autoPublish: false,
    phrases: ["good to go", "available", "will play", "back in"],
    regexes: [
      "\\bgood to go\\b",
      "\\bavailable\\b",
      "\\bwill play\\b",
      "\\bback in\\b",
    ],
    requiredEvidence: ["player"],
    corpusMatches: 31,
    notes:
      "'Good to go' appeared 31 times but can attach to goalies or lineup context; review-gate until player role extraction is reliable.",
  },
  {
    id: "return-lineup-activated",
    category: "RETURN",
    subcategory: "RETURNING TO LINEUP",
    confidence: "auto",
    autoPublish: true,
    phrases: [
      "returns to lineup",
      "returning to lineup",
      "activated from IR",
      "activated off IR",
    ],
    regexes: [
      "\\breturns? to (?:the )?lineup\\b",
      "\\breturning to (?:the )?lineup\\b",
      "\\bactivated (?:from|off) (?:IR|injured reserve)\\b",
    ],
    requiredEvidence: ["player"],
    corpusMatches: 3,
    notes:
      "Low count but precise enough for auto-publish with player evidence.",
  },
  {
    id: "scratches-confirmed",
    category: "SCRATCHES",
    subcategory: "CONFIRMED SCRATCH",
    confidence: "auto",
    autoPublish: true,
    phrases: [
      "healthy scratch",
      "scratched",
      "not dressed",
      "will sit",
      "comes out",
    ],
    regexes: [
      "\\bhealthy scratch(?:ed)?\\b",
      "\\bscratched\\b",
      "\\bnot dressed\\b",
      "\\bwill sit\\b",
      "\\bcomes out\\b",
    ],
    requiredEvidence: ["player"],
    corpusMatches: 0,
    notes:
      "Needed for card automation even though current corpus has low explicit scratch-rule coverage.",
  },
  {
    id: "transaction-roster-move",
    category: "TRANSACTION",
    subcategory: "ROSTER MOVE",
    confidence: "auto",
    autoPublish: true,
    phrases: [
      "recalled",
      "called up",
      "assigned to",
      "sent down",
      "loaned",
      "waivers",
      "claimed off waivers",
    ],
    regexes: [
      "\\brecalled\\b",
      "\\bcalled up\\b",
      "\\bassigned to\\b",
      "\\bsent down\\b",
      "\\bloaned\\b",
      "\\bwaivers?\\b",
      "\\bclaimed off waivers\\b",
    ],
    requiredEvidence: ["player"],
    corpusMatches: 2,
    notes:
      "Low volume in this corpus, but these phrases are precise enough with player evidence.",
  },
] satisfies TweetNewsPhraseRule[];

export const tweetNewsExclusionRules = [
  {
    id: "non-nhl-leagues",
    reason: "Avoid publishing AHL/ECHL/junior/KHL items into NHL news cards.",
    regexes: [
      "\\bAHL\\b",
      "\\bECHL\\b",
      "\\bOHL\\b",
      "\\bWHL\\b",
      "\\bQMJHL\\b",
      "\\bKHL\\b",
      "\\bPWHL\\b",
    ],
  },
  {
    id: "stat-recap-top-performers",
    reason:
      "CCC stat recap tweets dominated raw n-grams but are not actionable news cards.",
    regexes: [
      "\\btop performers\\b",
      "\\bsaves goals? against\\b",
      "\\bgoals? assists?\\b",
      "\\bshots? on goal\\b",
    ],
  },
  {
    id: "headline-only-wrapper",
    reason:
      "Wrapper tweets such as 'Lightning lines https://t.co/...' need quoted/oEmbed text before publishing.",
    regexes: [
      "^.{0,80}\\b(?:lines?|goalie|starter|warmups?)\\b\\s+https?://t\\.co/",
    ],
  },
] satisfies TweetNewsExclusionRule[];
