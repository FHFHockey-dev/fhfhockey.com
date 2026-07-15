export type TweetNewsCategory =
  | "LINE COMBINATION"
  | "GOALIE START"
  | "INJURY"
  | "REPORTED INJURY"
  | "RETURN"
  | "SCRATCHES"
  | "TRANSACTION"
  | "SIGNING"
  | "NEWS UPDATE"
  | "TRADE"
  | "RETIREMENT"
  | "LINE CHANGE"
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
    id: "return-projected-timeline",
    category: "RETURN",
    subcategory: "PROJECTED RETURN",
    confidence: "auto",
    autoPublish: true,
    phrases: ["return around", "targeting a return"],
    regexes: [
      "\\b(?:puts?|projects?) (?:a |the )?return around\\b",
      "\\btargeting a return (?:in|around|by)\\b",
    ],
    requiredEvidence: ["player"],
    corpusMatches: 1,
    notes:
      "Projected return dates are publishable when the player can be identified; unresolved wrapper tweets remain in review.",
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
  {
    id: "contract-extension-progress",
    category: "NEWS UPDATE",
    subcategory: "CONTRACT NEGOTIATION",
    confidence: "auto",
    autoPublish: true,
    phrases: [
      "getting an extension done",
      "closing in on a contract extension",
      "closing in on an extension",
    ],
    regexes: [
      "\\bgetting an extension done\\b",
      "\\bclosing in on\\b.{0,100}\\b(?:contract )?extension\\b",
      "\\blanguage and details (?:are |being )?worked on\\b.{0,160}\\bextension\\b",
    ],
    requiredEvidence: [],
    corpusMatches: 2,
    notes:
      "Credible contract-progress reporting is publishable as a news update, while completed or officially announced contracts remain signings.",
  },
  {
    id: "signing-official",
    category: "SIGNING",
    subcategory: "OFFICIAL SIGNING",
    confidence: "auto",
    autoPublish: true,
    phrases: [
      "signed",
      "re-signed",
      "signs a contract",
      "signs with",
      "agrees to a deal",
      "agreed to terms",
      "contract settlement",
      "contract official",
    ],
    regexes: [
      "\\b(?:re-?signed|signed)\\b",
      "\\bsigns?\\b.{0,80}\\b(?:contract|deal|extension)\\b",
      "\\bsigns? with\\b",
      "\\bare signing\\b",
      "\\bagrees? to\\b.{0,50}\\bdeal\\b",
      "\\bagreed to terms\\b",
      "\\bhave a settlement\\b",
      "\\bsettlement\\b.{0,40}\\b(?:year|years|\\$|million|m\\b)",
      "\\bcontract official\\b",
      "\\bofficially announce\\b.{0,50}\\bsigning\\b",
      "\\bdeal with\\b.{0,100}\\b(?:years?|aav|\\$|million)\\b",
      "\\b(?:one|two|three|four|five|six|seven|eight)[- ]years?\\b.{0,50}\\b(?:aav|\\$|million)\\b",
      "\\b\\d+\\s*x\\s*\\$?\\d+(?:\\.\\d+)?\\s*[mk]\\b",
      "\\b\\d+\\s*x\\s*\\$?\\d+(?:\\.\\d+)?\\b",
      "\\b\\$?\\d+(?:\\.\\d+)?\\s*[mk]\\s*x\\s*\\d+ years?\\b",
      "\\b(?:goes to|stays in)\\b.{0,60}\\b\\d+ years?\\b",
      "\\bto\\b.{0,40}\\b(?:one|two|three|four|five|six|seven|eight) years?\\b.{0,30}\\$",
    ],
    requiredEvidence: [],
    corpusMatches: 97,
    notes:
      "Official contract language is sufficiently precise for publication even when a newly signed player is not yet present on the destination roster.",
  },
  {
    id: "trade-official",
    category: "TRADE",
    subcategory: "COMPLETED TRADE",
    confidence: "auto",
    autoPublish: true,
    phrases: [
      "have acquired",
      "has acquired",
      "traded to",
      "in exchange for",
    ],
    regexes: [
      "\\b(?:have|has) acquired\\b",
      "\\b(?:was|were|has been|have been) traded\\b",
      "\\btraded\\b.{0,100}\\b(?:to|for)\\b",
      "\\bin exchange for\\b",
      "\\btrade details\\b",
      "\\bacquires?\\b",
    ],
    requiredEvidence: [],
    corpusMatches: 17,
    notes:
      "Completed acquisition and exchange language is distinct from trade-talk or no-trade-clause reporting.",
  },
  {
    id: "transaction-offer-sheet",
    category: "TRANSACTION",
    subcategory: "OFFER SHEET",
    confidence: "auto",
    autoPublish: true,
    phrases: ["tendered an offer sheet", "offer-sheeting", "matched the offer sheet"],
    regexes: [
      "\\btendered an offer sheet\\b",
      "\\boffer[- ]sheeting\\b",
      "\\bmatched\\b.{0,50}\\boffer sheet\\b",
    ],
    requiredEvidence: [],
    corpusMatches: 3,
    notes: "Explicit offer-sheet submissions and match decisions are completed transactions.",
  },
  {
    id: "transaction-arbitration-filed",
    category: "TRANSACTION",
    subcategory: "ARBITRATION",
    confidence: "auto",
    autoPublish: true,
    phrases: ["filed for arbitration", "will be filing for arbitration"],
    regexes: [
      "\\b(?:has|have) filed for arbitration\\b",
      "\\bwill be filing\\b.{0,30}\\barbitration\\b",
      "\\bwill file for arbitration\\b",
    ],
    requiredEvidence: [],
    corpusMatches: 4,
    notes: "Only player-specific filings qualify; deadline explainers remain excluded.",
  },
  {
    id: "transaction-draft-pick",
    category: "TRANSACTION",
    subcategory: "DRAFT PICK",
    confidence: "auto",
    autoPublish: true,
    phrases: ["have selected", "selected overall"],
    regexes: [
      "\\bhave selected\\b.{0,100}\\b(?:overall|nhl draft)\\b",
      "\\bselected\\b.{0,70}\\boverall in the\\b.{0,20}\\bnhl draft\\b",
    ],
    requiredEvidence: [],
    corpusMatches: 1,
    notes: "Explicit team draft selections are completed roster transactions.",
  },
  {
    id: "reported-injury-awaiting-confirmation",
    category: "REPORTED INJURY",
    subcategory: "AWAITING OFFICIAL CONFIRMATION",
    confidence: "auto",
    autoPublish: true,
    phrases: ["report out", "awaiting more information"],
    regexes: [
      "\\b(?:there is |there's )?a report\\b.{0,180}\\b(?:torn|ruptured|injur(?:y|ed))\\b",
      "\\bteam\\b.{0,100}\\baware\\b.{0,100}\\bawaiting (?:more )?(?:information|confirmation)\\b",
    ],
    requiredEvidence: [],
    corpusMatches: 1,
    notes:
      "Specific injury reporting may be shown before club confirmation, but must remain visibly distinct from a confirmed injury.",
  },
  {
    id: "injury-surgery-rehab",
    category: "INJURY",
    subcategory: "SURGERY / REHAB",
    confidence: "auto",
    autoPublish: true,
    phrases: ["having surgery", "procedure done", "has been rehabbing"],
    regexes: [
      "\\b(?:having|undergo(?:ing)?)\\b.{0,40}\\bsurgery\\b",
      "\\bconfirm(?:s|ed)?\\b.{0,50}\\bsurgery\\b",
      "\\bprocedure done\\b",
      "\\bhas been rehabbing\\b",
      "\\brehabbing (?:his|her|the)\\b",
    ],
    requiredEvidence: [],
    corpusMatches: 3,
    notes: "Procedure and active-rehabilitation language is current health news.",
  },
  {
    id: "injury-timeline",
    category: "INJURY",
    subcategory: "OUT",
    confidence: "auto",
    autoPublish: true,
    phrases: ["will miss at least", "expected to miss"],
    regexes: [
      "\\bwill miss at least\\b",
      "\\bexpected to miss\\b",
      "\\bwill be out\\b.{0,30}\\b(?:weeks?|months?)\\b",
    ],
    requiredEvidence: [],
    corpusMatches: 1,
    notes: "Explicit absence timelines are publishable even when player lookup is unavailable.",
  },
  {
    id: "injury-practice-exit-ltir",
    category: "INJURY",
    subcategory: "INJURY UPDATE",
    confidence: "auto",
    autoPublish: true,
    phrases: ["leaving practice with an injury", "back on LTIR"],
    regexes: [
      "\\bleav(?:es|ing) practice\\b.{0,60}\\binjur",
      "\\bback on ltir\\b",
    ],
    requiredEvidence: [],
    corpusMatches: 2,
    notes: "Direct practice exits and confirmed LTIR placement are current injury events.",
  },
  {
    id: "transaction-staffing",
    category: "TRANSACTION",
    subcategory: "STAFFING",
    confidence: "auto",
    autoPublish: true,
    phrases: ["named assistant coaches", "named to our coaching staff", "hiring an assistant"],
    regexes: [
      "\\bhave named\\b.{0,100}\\bcoaches?\\b",
      "\\bnamed to (?:our|the) coaching staff\\b",
      "\\bare hiring\\b.{0,100}\\bcoaching staff\\b",
    ],
    requiredEvidence: [],
    corpusMatches: 3,
    notes: "Official coaching appointments are completed team transactions.",
  },
  {
    id: "transaction-roster-status",
    category: "TRANSACTION",
    subcategory: "ROSTER STATUS",
    confidence: "auto",
    autoPublish: true,
    phrases: ["will not be back", "won't return", "leaving to pursue NHL opportunities"],
    regexes: [
      "\\bwill not be back\\b",
      "\\bwon't return\\b",
      "\\bleaving\\b.{0,80}\\bto pursue nhl opportunities\\b",
    ],
    requiredEvidence: [],
    corpusMatches: 3,
    notes: "Direct roster-departure and NHL-arrival statements are actionable status changes.",
  },
  {
    id: "deployment-role-update",
    category: "LINE CHANGE",
    subcategory: "PROJECTED ROLE",
    confidence: "auto",
    autoPublish: true,
    phrases: ["play him on the wing", "moving to center", "top-six", "everyday player", "backup goaltender"],
    regexes: [
      "\\bplan is to play him on the wing\\b",
      "\\banticipates moving to c\\b",
      "\\bviews?\\b.{0,50}\\btop[- ]six\\b",
      "\\bhe'll be an everyday player\\b",
      "\\bwill be the\\b.{0,30}\\bbackup goaltender\\b",
    ],
    requiredEvidence: [],
    corpusMatches: 5,
    notes: "Direct statements about a concrete projected role are fantasy-relevant deployment news.",
  },
  {
    id: "retirement-announced",
    category: "RETIREMENT",
    subcategory: "RETIRED",
    confidence: "auto",
    autoPublish: true,
    phrases: ["announces retirement", "has retired", "is retiring"],
    regexes: [
      "\\bannounc(?:es|ed|ing) (?:his |her )?retirement\\b",
      "\\bhas retired\\b",
      "\\bis retiring\\b",
    ],
    requiredEvidence: [],
    corpusMatches: 1,
    notes: "Explicit retirement announcements are safe to publish without roster evidence.",
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
      "\\bSHL\\b",
      "\\bLiiga\\b",
      "\\bCzechia\\b",
      "\\bCzech Republic\\b",
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
    id: "historical-position-usage-recap",
    reason:
      "Position-usage and goalie-appearance recaps are reference statistics, not current news cards.",
    regexes: [
      "\\bplayed \\d+ games?\\b.{0,180}\\blining ?up\\b",
      "\\bplayed \\d+ games? in goal\\b.{0,180}\\bstarting \\d+",
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
  {
    id: "roundup-link-or-social-reply",
    reason:
      "Roundup links, generic thread promos, condolences, and contextless social replies are not standalone news cards.",
    regexes: [
      "^\\s*(?:recap of|the free agents|the trades|substack ongoing thread|recap of today's transactions)\\b",
      "^\\s*(?:rt )?@[^:]+:\\s*#thanks",
      "^\\s*@[^ ]+\\s+(?:so sorry|all thoughts)",
      "\\bdeadline for players to file for arbitration\\b",
    ],
  },
] satisfies TweetNewsExclusionRule[];
