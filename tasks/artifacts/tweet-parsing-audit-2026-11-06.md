# Tweet parsing audit — 2026-11-06

Read-only audit of how the FHFH tweet pipeline recognises and extracts line combinations, goalies, injuries and
roster moves. It also covers which confidence signals exist today, a proposed 0–100 confidence score, and an
answer-key schema for the swipe trainer on `/db/tweet-pattern-review`. No application code was changed.

All paths are relative to `web/lib/sources/` unless stated otherwise.

## How this was checked

- **Code:** the 13 named files, plus `tweetInterpretation.ts` (where most line and goalie extraction happens),
  `lineSourceFirstArrival.ts` and `tweetLunaEvaluationScoring.ts`.
- **Fixtures:** `tweetClassificationLabels.json` (35 records), `tweetLunaAdjudicatedLibrary.json` (10 groups, 50
  claims) and `october11TroublesomeTweets.json` (7 records).
- **Probe:** a read-only script ran the real exported functions on fixture tweets and on clearly labelled synthetic
  edge cases. It lives in the session scratchpad and was run with `vite-node`; nothing was written to the repo. Every
  case below marked **[probe]** was reproduced with the current code.
- **Production data:** bounded `SELECT`s against `line_source_snapshots` (aggregates plus samples of at most 45 rows)
  and one `players` lookup. Nothing was written. Cases marked **[prod]** are real tweets as stored.

### Key context: two parse paths, and production uses the newer one

- The **legacy path** (`classifyGameDayTweet`, `extractStructuredPlayerGroupsFromText`, `extractGoalieName`, …) always
  runs. Its `classification` field still sets the row type that downstream writers switch on.
- The **interpretation path** (`interpretTweetUnits`, `extractTweetPlayerEvents`) runs when
  `TWEET_PIPELINE_INTERPRETATION_ENABLED=true`. When it runs, it **replaces** the legacy lines, pairs, goalies,
  scratches and injuries (`linesCccIngestion.ts:1370-1386`, `linesCccIngestion.ts:2065-2070`).
- **Production has the flag on.** Every accepted `line_source_snapshots` row since 2026-10-07 carries
  `metadata.interpretation` (2,000+ rows checked). The flag is not set in the local `.env*` files, so a plain local
  run uses the legacy path. A regression runner must set the flag explicitly.

**Hybrid behaviour:** the row *type* comes from the legacy keyword classifier, but the row *content* comes from the
interpretation path. Several failures below come from the two disagreeing.

### Production volumes (accepted rows, 2026-10-07 → 2026-11-06)

| classification | rows | complete 12F+6D | with goalie_1 |
|---|---:|---:|---:|
| goalie_start | 1,422 | 31 | 1,319 |
| lineup | 717 | 296 (41%) | 258 |
| injury | 460 | 3 | 83 |
| practice_lines | 271 | 107 | 104 |
| other | 243 | 0 | 3 |
| power_play | 153 | 0 | 0 |

Another 307 `other`, 138 `injury` and 70 `lineup` rows were `rejected_ambiguous`, meaning no single team was resolved.

---

## 1. Line combinations

### Which functions do the work

| Step | Function | Location |
|---|---|---|
| Row type | `classifyGameDayTweet` (keyword lists plus a shape-only parse without a roster) | `lineupSourceIngestion.ts:1041`, keyword lists `:164-229` |
| Team | `resolveLinesCccTeam` (roster density, hashtags, handle hints, "X vs Y" lead) | `linesCccIngestion.ts:831` |
| Units (production) | `interpretTweetUnits`: line-by-line headings, then `segmentPlayerRow` finds a unique segmentation of each row against the team roster | `tweetInterpretation.ts:96`, `:75` |
| Same-surname tie-break | `resolveRowIdentity`: if several roster players share the surname, uses row position (F or D) | `tweetInterpretation.ts:54` |
| Name to player | `resolvePlayerIdentity`: tries full name, then alias, then initial plus surname, then surname alone | `playerIdentity.ts:34` |
| Aliases | `lineup_player_name_aliases` merged per team, plus verified `fhfh_player_identity_aliases` when the flag is on | `lineSourceProcessing.ts:221-250`, `:210-217`, `playerNameAliases.ts:34` |
| Extras | "X and Y are the extras" becomes a scratch unit | `tweetInterpretation.ts:148`, `linesCccIngestion.ts:1349` |
| Formation | "11F … 7D" sets `formation`; at most 4 F lines and 3 D pairs are kept otherwise | `tweetInterpretation.ts:104`, `:293-308` |
| Swaps and PP subs | three fixed regexes: "will take X's spot on the first unit power play", "have switched spots", "Same PP units" | `tweetInterpretation.ts:271-286` |
| Stored rows | `toLinesCccRow` stores complete units **in reverse order** (F as `[2,1,0]`, D as `[1,0]`) | `linesCccIngestion.ts:1678-1686`, `:2054` |
| Writes to line combinations | `buildLineCombinationSourceMutation` needs exactly 12 F and 6 D; `selectFirstArrivalBuckets` picks the earliest row per bucket | `lineSourceLineCombinations.ts:65`, `:114`; `lineSourceFirstArrival.ts:84` |
| Unresolved names to `/db/player-aliases` | `collectUnresolvedNamesFromLineRows` (interpretation `unresolved` with spans) | `lineSourceProcessing.ts:318` |

### What it handles well

- **Standard full lineups** separated by blank lines. The Canes fixture (S08) parses to 4 F lines and 3 D pairs with
  correct roles **[probe]**.
- **Accents.** `normalizeIdentityName` strips diacritics: "Markström" matches "Markstrom", "Lekkerimäki", "Stützle"
  **[probe, prod]**.
- **Row-position tie-breaks.** A surname shared by a forward and a defenceman resolves when the section heading
  ("Forwards:" / "Defense:") or a blank-line block fixes the row role **[probe]**.
- **Formatting.** Hyphenated and compound names, apostrophes, "B. Tkachuk / M. Tkachuk" initials (the Panthers row
  parsed **[prod]**), slash alternatives (`relationships.kind = "alternatives"`), "X is the extra", and "RT @x:"
  prefixes.
- **Safe failure.** Mixed-role or short rows go to `unresolved` with exact character spans instead of being guessed
  into a slot. Those spans feed the alias review queue.

### Where it guesses or relies on fragile patterns

1. **Section role carries from the F block into the first D pair.** After forward rows, `sectionRole` stays
   `es_forward` (`tweetInterpretation.ts:265`) until a blank line resets it (`:124`). The first D row is then resolved
   as a forward row (`identityRow`, `:166-167`). If a defenceman shares a surname with an organisation forward, the
   forward is chosen, the row becomes mixed-role, and the whole pair is rejected as `invalid_extraction`. The remaining
   pairs then **shift up one slot**.
2. **Goalie lines in `🥅: Name ✅` form are never read.** Only a leading `🥅` with whitespace is stripped (`:146`).
   "🥅: Annunen ✅" leaves ": Annunen ✅", which matches no heading and resolves to no player.
3. **Single or partial updates produce nothing.** Single-line, substitution, swap and in-game tweets yield no units,
   and the line-combination writer only accepts a full 12+6. Only three exact phrasings of change are recognised
   (`:271-286`).
4. **The formation header counts as a D row.** A header such as "11F/7D" contains "/", so `reviewShape` treats it as a
   D row, and `ordinals` advances (`:158`, `:180`).
5. **11F/7D lineups without an explicit "11F … 7D" phrase fail.** A two-man F row and a lone 7th D are rejected as
   short rows (`:177`). The legacy writer requires 12/6 regardless (`lineSourceLineCombinations.ts:114`).
6. **The earliest row per bucket wins before its completeness is checked.** `selectLineCombinationSourceMutations`
   chooses the first arrival per (date, team, game, type) and only then builds the mutation
   (`lineSourceLineCombinations.ts:147-154`). An early incomplete projection blocks a later complete warmup lineup.
7. **Surname-only matching has two loose fallbacks.**
   - `validateLineupNames` accepts the *last token* of an unmatched name when it matches one surname on the roster
     (`lineupSourceIngestion.ts:760-767`).
   - `extractOrderedRosterHitsFromTweet` uses `indexOf` with no word boundary (`:1139-1143`).
8. **Nicknames, numbers and acronyms only resolve through hand-entered aliases.** "MBN", "JT", "EP40"/"EP25",
   "Gabe-Mika-Laf" and "An. Johansson" fail. Fuzzy and acronym candidates exist only on the review side
   (`tweetIdentityCandidates.ts:45`), never in resolution.
9. **Roster coverage is the most common cause of `missing_player`.** Recent call-ups and trades are not yet in
   `rosters`/`tweet_player_memberships`: Hunt, Struble, Perron, Taylor, Quillan, Hallander, Tomasino, Blais, Englund
   **[prod]**.
10. **Duplicate or prospect `players` rows create false ambiguity.**
    - Two Vancouver players are both named "Elias Pettersson" (C 8480012 and D 8483678).
    - Same-team prospects share surnames: Edstrom ×2 (NSH), Hryckowian ×2 (DAL), Schwindt ×2 (FLA).
    - A second "Jack Hughes" record (8483456) has no team **[prod]**.
11. **Keyword classification uses substring matching** (`normalized.includes(keyword)`, `lineupSourceIngestion.ts:1054-1081`).
    - Any "pp1" or "power play" turns a full lineup into `power_play`, and the legacy goalie list is then emptied
      (`linesCccIngestion.ts:1281-1284`).
    - "pairings" or "rushes" turn a game-day tweet into `practice_lines`.
    - The "in-game" context is never detected.
12. **Dot-separated rows are skipped silently.** "DeBrusk. EP40. Boeser." produces no unit and no unresolved entry,
    so nothing reaches review **[prod]**.
13. **Stored order is the reverse of tweet order** (`linesCccIngestion.ts:1678`). Any answer key must state its order
    convention, or every row scores as wrong.

### Concrete failure cases

| # | Tweet (source) | What happens | Evidence |
|---|---|---|---|
| L1 | DFOFantasy "#NJDevils Lineup vs. STL … Lombardi - Glass - Brown\nHughes - Pesce\nSiegenthaler - Hamilton\nChisholm - Kovacevic\n🥅: Hellebuyck ✅" | "Hughes - Pesce" rejected (resolved as Jack Hughes); Siegenthaler–Hamilton stored as **pair 1**; no goalie | [prod] `pair_1_player_names = [Hamilton, Siegenthaler]`; [probe] with a blank line before the D rows, all 3 pairs parse |
| L2 | DFOFantasy Canucks "…Pettersson - Hronek…", Bruins "…Lindholm - McAvoy…", Avalanche "…Kulak - Makar…" | Same mechanism: Elias (C) vs Elias (D) Pettersson, Elias vs Hampus Lindholm, Cale vs Taylor Makar | [prod] `invalid_extraction` on each first pair |
| L3 | Every DFOFantasy lineup ending "🥅: Name ✅" | Goalie dropped | [prod] **80 DFOFantasy lineup rows, 0 with goalie_1; 63 contain 🥅** |
| L4 | Canes fixture (S08) last line "Bussi pic.twitter.com/iVLdaOV5Ir" | The "/" in the URL turns the goalie line into an `alternatives` relationship; legacy also returns `goalies: []` | [probe] |
| L5 | "Tonight's #GoBolts warmup lines … Viel-Geekie … Hedman-Carlson\nD'Astous" (11F/7D, no "11F" text) | `invalid_extraction` on both short rows, so the lineup is never complete | [prod] |
| L6 | Synthetic "Canes go 11F/7D tonight.\n…" | D pairs numbered 2, 3, 4; `completeEvenStrengthUnits` returns [] | [probe] |
| L7 | "#STLBlues lineup changes … IN ▲ Colton Parayko\nIN ▲ Aleksanteri Kaskimaki\nOUT ▽ Theo Lindstein…" (DFO) | No units, no events; classified `lineup` | [prod] |
| L8 | "Ryan Craig tells those in Detroit Victor Olofsson will return to the lineup tonight. Will skate with Hertl and Connelly." | Return detected; the line placement is lost | [prod] |
| L9 | "Line Change: Brunet will draw back into the lineup…" (DFO) | No units, no change claim | [prod] |
| L10 | "Jarvis in for Martinook tonight. Andersen starts." | No substitution; classified `goalie_start` | [probe] |
| L11 | "First three shifts of the third period:\nGabe-Mika-Laf\nKartye-JT-Bjorkstrand…" | Classified `lineup`; nicknames unresolved; context not marked in-game | [prod] |
| L12 | "The third period for Connelly-Eichel-Stone, per @NatStatTrick: CF: 7-1…" | A stats tweet classified `lineup` | [prod] |
| L13 | "Quinn Hughes" on a roster with one Hughes; "Kevin Hall" vs Carolina | Matched to Luke Hughes / Taylor Hall | [probe] `validateLineupNames` |
| L14 | "Projected #Canucks lines … DeBrusk. EP40. Boeser." | Rows skipped silently | [prod] |
| L15 | "Appleton-Kasper-Leonard (scratches, looks like)" | Treated as a line row, not scratches | [prod] |
| L16 | Jets tweet "…put Brad Lambert on waivers…" | "Kevin He" matched inside "t**he**" | [prod] `transactionSignals`; [probe] |

### Ranked fixes — line combinations

- **High**
  1. Read `🥅`/`G:` lines with a colon, emoji status markers (✅ 🅿️) and trailing URLs as goalie lines
     (`tweetInterpretation.ts:146`, `:134`). Strip media URLs before `/` splitting.
  2. Use player positions to switch the section: if a row resolves cleanly as D (two hits, both D), or as F, reset
     `sectionRole` instead of inheriting it. Alternatively, try the D row hint first for two-name rows after a full F
     block. Never renumber the remaining pairs after a rejected row (`:180-182`).
  3. Choose the first *complete and valid* candidate per bucket, not the first arrival
     (`lineSourceLineCombinations.ts:147`). Keep first arrival only as the tie-break.
  4. Clean up identity data: merge or flag duplicate `players` rows, and stop teamless prospect records from entering
     surname resolution. Refresh memberships from transactions (see section 4) so call-ups resolve on the day.
- **Medium**
  5. Add a partial-update model (`moves_to`, `in_for`, `draws_in`, `draws_out`, DFO `IN ▲` / `OUT ▽`) that patches the
     last known lineup, instead of requiring 12+6.
  6. Support 11F/7D and 13F/5D by shape (row counts) when explicit text is absent. Stop the formation header from
     counting as a row.
  7. Remove the last-token fallback in `validateLineupNames` and the boundary-less `indexOf` in
     `extractOrderedRosterHitsFromTweet`. Use the `identityMentionPresent` boundaries already used elsewhere.
  8. Classify by structure first and keywords second. Keep `power_play` as a sub-unit of a lineup, not a row type.
     Add an `in_game` context ("period", "shifts", "line change" during a game).
- **Low**
  9. Add jersey-number aliases ("EP40") and acronym aliases. Show the fuzzy candidates from
     `retrieveTweetIdentityCandidates` on the trainer card.
  10. Report dot- or comma-separated rows as `unresolved` so they reach review.
  11. Write down the reversed storage order next to `toLinesCccRow`.

---

## 2. Goalies

### Which functions do the work

- **Row type:** `classifyGameDayTweet` returns `goalie_start` on `GDT_GOALIE_KEYWORDS`, a substring list that includes
  "starting", "starts", "leads" and "our guess" (`lineupSourceIngestion.ts:192`).
- **Claim (production):** `extractTweetPlayerEvents` creates `kind: "goalie"` only for players with position G
  (`tweetPlayerEvents.ts:199`).
  - `observation` is `first_off` or `warmup` (`:197-198`).
  - `state` is chosen on a ladder (`:205-208`):
    - `projected` if there is an observation, historical wording, practice/camp, a question or tentative wording;
    - otherwise `ruled_out` on "will not / won't / not the starter";
    - otherwise `likely` on "likely / probable / first off";
    - otherwise `confirmed` if the text right after the name matches the affirmative regex (`:203-204`);
    - otherwise `projected`.
  - `goalieRole` is `backup` only when "backup" or "backs him up" appears.
- **Row goalies:** `buildStructuredContent` orders goalie events with non-backup first. **State is not used**
  (`linesCccIngestion.ts:1383`).
- **Multi-team goalie tweets:** `expandLinesCccGoalieClaims` splits them per team (`linesCccIngestion.ts:1639`).
- **Writes:** the line-combination writer stores goalies for `goalie_start` rows with no state check
  (`lineSourceLineCombinations.ts:88-94`). The claim layer is stricter: it only promotes `starter` when the state is
  confirmed, the modality affirmative and there is no observation (`tweetClaimExtraction.ts:97`).
- **Phrase rules:** `goalie-start-confirmed` (auto) and `goalie-start-expected-warmup` (review)
  (`tweetNewsPhraseDictionary.ts:38-94`).

### What it handles well

- Warmup "leads … out/onto/into the ice", and "first goalie off" become **observations** marked `projected`. They are
  never promoted to confirmed starts by the claim layer. The Meriläinen fixture, "leads the #Canucks into the ice … He'll
  get the start", links the pronoun sentence correctly.
- "X will not be in net; Y starts" gives X `ruled_out` and Y `confirmed` **[probe]**.
- Coordinated subjects ("Swayman and Korpisalo …") share a predicate, and two-team "confirmed X Starting Goalie: …"
  rows split per team.
- Production mix of goalie events since 10-07: 767 `confirmed`, 321 plain `projected`, 104 warmup, 71 first-off,
  11 backup.

### Where it guesses or relies on fragile patterns

1. **Confirmed status depends on the exact words straight after the name.** Anything between the name and the verb
   (hashtags, team tags, emoji) makes the claim `projected`. Examples:
   - "Vasilevskiy is the #Bolts starting goaltender tonight" → `projected` **[prod]**.
   - DFOFantasy "🥅: Dustin Wolf (CGY) ✅ will start Friday vs. ANA." → `projected` **[prod]**.
2. **The aggregator's own status marker is ignored.** DFO marks confirmed starts with ✅ and expected ones with 🅿️ —
   "Luukkonen (BUF) 🅿️ is expected to start". Both currently come out `projected`.
3. **A ruled-out goalie can be stored as the starter.** Row goalies ignore `state`, so "Markstrom will not be in net
   tonight; Allen starts" stores `goalies: [Markstrom, Allen]`, making the ruled-out goalie `goalie_1`.
   **[probe2, buildLinesCccSourceFromIftttEvent with the flag on]**
4. **Projected goalies and warmup observations are written as row goalies** and reach line combinations
   (`lineSourceLineCombinations.ts:88`). In a probe, "is expected to start" was even classified `other`, yet it still
   stored `goalies: [Markstrom]`.
5. **The "likely" tier never fires.** "first off" sets `observation` first, so the ladder returns `projected`.
   Production has **0** `likely` events.
6. **The keyword classifier misses common phrasings.** "Andersen gets the start tonight", "Confirmed: Andersen in goal
   tonight" and "is expected to start" are classified `other` **[probe]**. Fantasy-podcast promos with "goalie" are
   classified `goalie_start` **[prod]**.
7. **Phrase-rule tiers disagree with events.** "Andersen likely starts tomorrow" matches the **auto** confirmed rule
   (`\bstarts\b`). "won't be in net" would match the auto rule on `\bin net\b`.
8. **Who said it is not used.** A coach or team account and an aggregator projection get the same treatment, unless
   the word "confirmed" appears.
9. **Conflicting starters within a tweet or a day are not flagged for goalies.** The `conflicting_claims` check covers
   injuries only (`tweetPlayerEvents.ts:249-261`).

### Ranked fixes — goalies

- **High**
  1. Filter row goalies by state: confirmed starters first; drop `ruled_out`; keep projected and observation goalies
     in a separate `projectedGoalies` field (`linesCccIngestion.ts:1383`, `lineSourceLineCombinations.ts:88`).
  2. Allow up to about 40 characters of hashtags, parentheticals, team codes and emoji between the name and the
     predicate in the affirmative regex (`tweetPlayerEvents.ts:200-204`).
  3. Read DFO and GameDay status markers (✅ = confirmed, 🅿️ = projected or likely) as explicit modality.
- **Medium**
  4. Flag `conflicting_claims` when two non-backup goalies of the same team are claimed in one tweet, or when one
     claim conflicts with an earlier same-day claim. When a later confirmed claim arrives, it should replace a
     projected one.
  5. Fix the "likely" tier so first-off / likely / probable produce `likely`. Line up `goalie-start-confirmed` with
     the event state: demote to review when the event is not `confirmed`.
- **Low**
  6. Add a source-authority weight (team account / coach quote > beat writer > aggregator) to the confidence score.
  7. Add "gets the start", "in goal" and "expected to start" to the legacy goalie keywords until classification is
     structure-based.

---

## 3. Injuries

### Which functions do the work

- **State and availability:**
  - `classifyInjuryEvent` (`tweetPlayerEvents.ts:80`) sets the state to one of `new_injury`, `ongoing`, `setback`,
    `possible_return`, `confirmed_return` or `unknown`.
  - `injuryAvailability` (`:41`) sets availability to `out`, `available`, `uncertain` or `unknown`.
  - Both scan the event's **evidence span**, which runs from the name to the next sentence boundary, subject or name
    (`:179-185`).
- **Timeline:** `extractInjuryTimeline` / `extractInjuryTimelines` (`:51`, `:97`) read:
  - numeric ranges ("4-6 weeks", "3-3.5 months");
  - relative days and weekdays (resolved to a date in Eastern time);
  - vague terms: day-to-day, week-to-week, indefinitely, next week or month, rest of season, after the break.
  - `purpose` is set from the words before the time phrase.
- **Effective date:** "retroactive to Oct. 26" (`:102`).
- **Row injuries:** availability `out`, or the states new / ongoing / setback (`linesCccIngestion.ts:1379`).
- **Separate homepage status feed:**
  - `classifyGameDayTweetsNewsItem` (`injuryStatusIngestion.ts:393`) matches the whole league roster with "first name
    wins" (`:359`).
  - `inferInjuryAttributes` (`:177`) records body region, return window, severity and limitations.
- **Phrase rules:** `injury-out`, `injury-day-to-day`, `injury-questionable-practice`, `injury-type-support`,
  `injury-timeline`, `injury-surgery-rehab`, `return-*` (`tweetNewsPhraseDictionary.ts:191-350`).

### What it handles well

- Real October fixtures:
  - "Korpisalo (lower body) is out 4 weeks from today" → out, 4 weeks, target date.
  - "Veleno … out 3-3.5 months" → out, 3–3.5 months.
  - "Shesterkin … out for the rest of the season" → out, plus the vague "rest of the season" timeline.
- Negation guards stop "isn't close to returning" from becoming a return. Tentative wording ("hopeful", "expected",
  "GTD") makes availability `uncertain`. "will return Saturday" resolves to `confirmed_return` with a target date
  **[probe]**.
- Out and available claims for the same player and time in one tweet become `conflicting_claims`.

### Where it guesses or relies on fragile patterns

1. **New injuries are rarely labelled `new_injury`.** That needs "suffered", "sustained", "left the game" or a known
   prior healthy status (`:92`). Most new injuries come out as `unknown` + `out`.
   - Worse, "day-to-day" is checked *before* the new-injury cues (`:89` vs `:92`). "Slavin left the game in the second
     period and is day-to-day" becomes **`ongoing`** **[probe]**.
2. **Evidence stops at the first sentence, so the details are lost.** Examples:
   - The Lindgren fixture: "placed … Ryan Lindgren on injured reserve. **He** will miss approximately 4-6 weeks …" →
     evidence is "Ryan Lindgren on injured reserve.", so the timeline is lost **[probe]**.
   - "Parayko (upper-body) will return vs." — the period in "vs." is read as a sentence end, so the opponent and date
     are lost **[prod]**.
   - DFO's "Taylor Hall: Injury: Hall (upper-body) is hopeful …" creates an empty "Taylor Hall: Injury:" event for the
     first mention. This is the main reason **136 events are `unknown`/`unknown`**, the largest bucket **[prod]**.
3. **Returns to practice and activations are invisible to events.** "practiced in a regular jersey", "activated off
   IR", "back at practice with Red Wings after leaving Tuesday's game" and "appears set to return to the lineup" all
   give no event or `unknown` **[probe, prod]**. Only the phrase dictionary catches "activated".
4. **Common absence phrasings fail.** These give availability `unknown` and no timeline: "out at least a week",
   "out indefinitely" (`setback` but not out), "out until after Christmas", "out for the season" (no vague match),
   "will not return in Buffalo on Wednesday" **[probe, prod]**.
5. **Lineup decisions are recorded as injuries.**
   - "Florian Xhekaj and Owen Beck OUT for tonight's game vs Utah" (healthy scratches from the DFO IN/OUT tweet)
     → `kind: injury`, `availability: out` **[prod]**.
   - "Danielson may be coming out tonight for Leonard" → an injury event.
6. **In-game status has no scope.** `availabilityScope: "game"` is set only for "will not return to tonight's game".
   "we will see if he returns for the third period" becomes `possible_return` with no period or game scope.
7. **The homepage classifier is coarse.**
   - `\bout\b` and `\bir\b` decide "injury" (`injuryStatusIngestion.ts:409`), so "leads the team out" can mark a goalie
     injured.
   - The first full-name match in the tweet wins (`:359-391`), so "recalled X … placed Y on IR" can attach the injury
     to X.
   - `resolveRosterEntry` keeps the last-token surname fallback (`:352-356`).
8. **"Expected" makes everything tentative.** "is expected to miss 1-2 weeks" becomes availability `uncertain`, state
   `unknown`, although the absence is the reported fact.

### Ranked fixes — injuries

- **High**
  1. Let evidence run on into the next sentence when it starts with a pronoun subject ("He/She will miss …") or is
     the player's own continuation. Don't treat abbreviations (vs., St., Jr., No.) as sentence ends
     (`tweetPlayerEvents.ts:179-185`).
  2. Check new-injury cues (left the game / practice, suffered, sustained, placed on IR) **before** the
     ongoing / day-to-day branch (`:84-93`).
  3. Add return events: `return_to_practice` (regular / full-contact jersey, full participant, back at practice),
     `activated` (off / from IR or LTIR), `return_to_lineup` ("draws back in", "set to return"), with their own states.
  4. Separate lineup decisions from health. "OUT" in IN/OUT lists, "comes out for", "draws out" and "healthy scratch"
     should become `participation` / `scratch` claims, not `injury`.
- **Medium**
  5. Make the absence and timeline phrases complete: "for the season", "indefinitely", "at least a week / a month",
     "until <date / holiday / break>", "miss <n> games", "week-to-week". Treat "expected to miss" as a reported absence
     with a tentative timeline, not unknown availability.
  6. Skip the empty "Name: Injury:" DFO header mention (or merge it into the next mention of the same player).
  7. Add `availabilityScope` values `period` and `game` for in-game updates.
- **Low**
  8. Retire the last-token surname fallback and the substring `\bout\b` rule in `injuryStatusIngestion.ts`, or route
     that feed through `extractTweetPlayerEvents`.

---

## 4. Other moves (trades, call-ups, send-downs, waivers)

### Which functions do the work

- **Legacy signals:** `extractTransactionSignals` (`linesCccIngestion.ts:1010`) has 9 regexes (return, called_up,
  sent_down, healthy_scratch, trade, waiver, signing, activated, ir). Every signal found in a clause is attached to **up
  to 3 roster names** in that clause. The result is stored as `metadata.transactionSignals`, with no direction or
  destination.
- **Phrase rules:** `transaction-roster-move`, `trade-official`, `signing-official`, offer sheet, arbitration, draft,
  staffing, roster status, retirement (`tweetNewsPhraseDictionary.ts:376-670`).
- **Optional LLM:** `tweetNewsInference.ts` adds an optional model classification. It checks every evidence excerpt
  against the source text and has category-specific confidence floors (`:271-276`, `:298-406`).
- **Not modelled:** the interpretation path and the claim layer have no transaction claim type.

### What it handles well

- Single-player official releases ("Jaroslav Chmelar has been recalled … Taylor Raddysh has been assigned …") get
  correct per-clause signals **[prod]**.
- "cleared waivers" and "placed on waivers" are caught as `waiver`.
- The LLM path refuses to publish signings without completed-contract language.

### Where it guesses or relies on fragile patterns

1. **Transactions are classified as `injury`.** `GDT_INJURY_KEYWORDS` contains "recalled", "promoted", "signed" and
   "returns", and is checked by **substring** (`lineupSourceIngestion.ts:208-229`, `:1071`). So "assigned" contains
   "signed". In production:
   - "Minnesota has recalled Mason Shaw from Iowa" → `injury`
   - "Pittsburgh has assigned Jake Livanavage to Wilkes-Barre/Scranton" → `injury`
   - "Arsenii Sergeev has been assigned to the @AHLWranglers" → `injury`
2. **Call-ups are by definition not on the NHL roster, so their names never resolve.** Examples:
   - "Columbus has recalled Steven Lorentz and Jack Williams" → only Williams gets a signal.
   - "Sammy Blais has been recalled and Xavier Bourgault has been loaned" → `called_up` **and** `sent_down` both on
     Bourgault; Blais missing **[prod]**.
3. **Signals are attached to every name in the clause**, with no subject–verb link. "The Blackhawks have placed Bowen
   Byram on IR … They've also recalled Dillon Boucher" works only because the sentences split.
4. **Waivers are not distinguished.** "placed on waivers", "cleared waivers" and "claimed off waivers" are all
   `waiver`. "Reimer is being placed on waivers but still back up tonight" was classified `goalie_start` and `injury`.
5. **Destinations and leagues are not modelled.** "assigned … to Lukko (Liiga)" gives no signal. Assignments to an
   AHL affiliate can trip the non-NHL filter.
6. **Phrase-rule false positives.**
   - `\b\d+\s*x\s*\$?\d+(?:\.\d+)?\b` (`tweetNewsPhraseDictionary.ts:457`) makes "PP1 is a 4x1 …" a **SIGNING** **[probe]**.
   - `\bacquires?\b` (`:485`) makes any "acquire" a completed trade.
7. **Substring name match.** "Kevin He" is matched inside "the" in a Brad Lambert waivers tweet **[prod, probe]**.

### Ranked fixes — moves

- **High**
  1. Remove transaction verbs from the injury keywords and match keywords with word boundaries. Add a `transaction`
     row type before `injury` in `classifyGameDayTweet`.
  2. Add a transaction claim (kind, subject, from, to, effective date). Resolve subjects against **all organisation
     players** (`fetchPlayerIdentityDirectory`, `playerIdentity.ts:60`) and AHL affiliates, not the active roster.
- **Medium**
  3. Link each verb to its own subject: "X has been recalled and Y has been loaned" should give recall→X, loan→Y.
     Split waiver states into placed / cleared / claimed.
  4. Use completed moves to update `tweet_player_memberships` the same day, after review. This fixes much of the
     line-combination `missing_player` failure (§1, item 9).
- **Low**
  5. Tighten the signing "NxM" regexes to money context (`$`, `M`, `AAV`, `year`) and the trade rule to "have / has
     acquired". Keep `acquires?` at review tier.

---

## 5. Confidence

### Signals that exist today

| Signal | Where | Notes |
|---|---|---|
| `nhl_filter_status` / `nhl_filter_reason` (accepted / rejected_ambiguous / rejected_non_nhl / rejected_insufficient_text; `report_date_mismatch`, `relative_game_date_requires_review`) | `linesCccIngestion.ts:1448-1467`, `lineSourceProcessing.ts:553` | Gate, not a score |
| Team resolution margins (rosterLead, scoreLead, supportScore) | `linesCccIngestion.ts:704-829` | Computed, then thrown away; worth persisting |
| Phrase rule tier auto / review / support, plus `requiredEvidence` and `corpusMatches` | `tweetNewsPhraseDictionary.ts:16-29` | Per rule, with no link to the event state |
| Identity `basis` (full_name / alias / initial / surname) and status (matched / ambiguous / conflicting_membership / missing_player) | `playerIdentity.ts:13-16`; on events as `resolutionBasis` | Best per-player signal |
| Candidate retrieval: `quality` exact / weak / missing, rank (full 60, alias 50, initial / surname 40, acronym 30, fuzzy 20, context 0) − distance + team / position support | `tweetIdentityCandidates.ts:73-89` | Review side only |
| Interpretation `unresolved[]` with reason and span, `excludedUnits`, `relationships[].reviewReason`, unit `complete`, `context`, `certainty` | `tweetInterpretation.ts:6-36` | Structural completeness |
| Event `state`, `modality`, `availability`, `observation`, `reviewReason` | `tweetPlayerEvents.ts:13-34` | Claim certainty |
| Claim gate reasons (`source_time_team_not_explicit`, `extraction_or_identity_unresolved`, `source_time_identity_unverified`, …) and `support.status` | `tweetClaimExtraction.ts:78-142` | Publish gate |
| LLM `confidence` 0–1 plus validation errors | `tweetNewsInference.ts:119`, `:298-406` | Optional |
| `inferInjuryAttributes.confidence` high / medium / low | `injuryStatusIngestion.ts:283-290` | Homepage feed only |

### Proposed per-player match score (0–100)

Start from the **identity basis**, adjust for evidence, then clamp the result to 0–100.

| Component | Value |
|---|---|
| Base: `full_name` | 100 |
| Base: verified registry alias / team-scoped lineup alias | 95 / 90 |
| Base: `initial` + surname | 85 |
| Base: unique surname on team | 75 |
| Base: surname resolved only by row-position tie-break | 60 |
| Base: fuzzy distance 1 / 2 (review candidate) | 45 / 30 |
| Base: acronym / jersey-number hypothesis | 35 |
| Base: team-context-only suggestion | 10 |
| Base: missing_player | 0 |
| Team evidence: supported / unknown / conflicting | 0 / −10 / −30 |
| Position fits the slot: yes / unknown / no | 0 / −5 / −40 |
| Membership: current roster / membership expiring ≤ 7 days / none | 0 / −5 / −15 |
| Other org players with the same surname | −10 each, max −20 |
| `ambiguous` status | score capped at 40 |

The trainer can show each component as a chip, for example "surname-only · 2 Hughes in org · pos ✓ → 63", and link
any score below 70 to `/db/player-aliases` with the span pre-filled. That gives the "one-stop" alias fix TJ wants.

### Proposed per-tweet score (0–100)

Use one explainable formula: **start at 100, subtract named penalties, then apply caps.** The card shows the score
and the top three reasons.

```
score = 100
  − team:        rejected_* → cap 15; roster-density win without label/handle support −10
  − source text: headline-only wrapper / missing quoted text −30; relay attribution unresolved (source_account
                 'SOURCE_ACCOUNT') −5
  − time:        report_date_mismatch / relative_game_date_requires_review −20; publication time basis unknown −10
  − type agreement: legacy classification ≠ interpretation content (e.g. 'injury' row whose only claim is a
                 transaction; 'lineup' with 0 units) −15
  − phrase tier: best matching rule for the claimed type is auto 0 / review −10 / support only −20 / none −10;
                 rules from conflicting categories (e.g. SIGNING + POWER PLAY) −10
  − extraction:  lineup: (7 − complete ES units)/7 × 40; each unresolved span −8 (max −40); excludedUnits −5 each
                 goalie/injury/move: claim without subject −30; evidence cut before the predicate/timeline −10
  − modality:    projected −10; observation-only (warmup/first-off) −15; tentative −10; conflicting_claims −25
  − identity:    score ≤ (lowest player-match score + 20); also −(100 − mean player score) × 0.3
clamp 0..100
```

**Bands:** ≥ 85 green ("likely correct"); 60–84 amber; < 60 red.

**Queue order:** for the training queue, show **amber items first** — that is where labels shift parser behaviour the
most. Then red, then a random 10% sample of green so over-confidence gets measured. Persist the score and its
components on the row (`metadata.confidence = { score, version, components[] }`), so a parser change can be compared
score-for-score.

---

## 6. The answer key (input for the swipe trainer)

### Principles

1. **Pin the exact text.** Store `textSha256` and the exact text used (wrapper vs quoted, as `primaryTextSource`).
   The parser output depends on which text it read.
2. **Label what the tweet says, not the truth in the world.** This follows the Luna library's
   `source_semantics_reviewed_not_world_verified` convention. Keep `modality` separate from the fact.
3. **Identify players by NHL player ID, plus the literal span.** Unresolvable people (prospects, AHL players) keep
   `playerId: null` and a `literal`, so a later alias fix can be scored.
4. **Store lines in tweet order.** The scorer converts to the storage order (`linesCccIngestion.ts:1678`), not the
   labeler.
5. **Label negatives explicitly.** `expectEmpty` or `notNews` lets precision be measured. Swipe-right on a correct
   *empty* extraction is a valid label.
6. **Version everything:** parser version (`TWEET_INTERPRETATION_VERSION`, `TWEET_CLAIM_EXTRACTION_VERSION`), the
   roster revision hash at labelling time, labeller, timestamp, and split (dev / holdout).

### TypeScript sketch

```ts
// One record per tweet. A swipe-right writes verdict "confirmed_parser" and copies the
// parser output into `expected`; a swipe-left opens the editor and writes "corrected".
export type TweetAnswerKeyRecord = {
  schemaVersion: 1;
  tweetId: string;                       // original tweet id (not the relay)
  relayTweetId?: string | null;
  sourceAccount: string;                 // e.g. "DFOFantasy", or the original author handle
  primaryTextSource: "ifttt_text" | "wrapper_oembed" | "quoted_oembed" | "x_timeline_full_text";
  text: string;
  textSha256: string;
  publishedAt: string | null;            // ISO; drives relative dates ("tonight", "Saturday")
  labeledAt: string;
  labeler: string;                       // "TJ"
  verdict: "confirmed_parser" | "corrected" | "unscorable";
  unscorableReason?: "needs_image" | "needs_thread_context" | "non_nhl" | "duplicate" | "other";
  split: "dev" | "holdout";
  parserAtLabel: { interpretationVersion: string; claimVersion: string; rosterRevision: string | null;
                   confidence?: number };  // what the card showed
  expected: TweetExpected;
};

export type TweetExpected = {
  types: Array<"lineup" | "goalie" | "injury" | "move" | "other">; // multi-label; [] means not news
  expectEmpty: boolean;                  // true = parser should extract nothing
  teams: number[];                       // teams the tweet is *about* (1 or 2)
  context: "game" | "in_game" | "morning_skate" | "practice" | "camp" | "warmup" | "projection" | "unknown";
  lineup?: LineupExpected[];             // one per team
  goalies?: GoalieExpected[];
  injuries?: InjuryExpected[];
  moves?: MoveExpected[];
  mentions?: MentionExpected[];          // every player mention, for identity scoring
};

export type MentionExpected = {
  start: number; end: number; literal: string;   // UTF-16 offsets into `text`
  playerId: number | null;               // null = real person, not in directory
  teamId: number | null;
  aliasToAdd?: boolean;                  // labeller says "make this an alias" (feeds /db/player-aliases)
};

export type PlayerRef = { playerId: number | null; literal: string };

export type LineupExpected = {
  teamId: number;
  certainty: "confirmed" | "projected" | "reported";
  scope: "full" | "partial" | "change_only";   // single line / swap / IN-OUT list = partial / change_only
  formation: { forwards: number; defense: number } | null;   // e.g. {11, 7}; null if not stated / inferable
  forwardLines: Array<{ slot: 1 | 2 | 3 | 4; players: PlayerRef[] }>;  // tweet order
  defensePairs: Array<{ slot: 1 | 2 | 3 | 4; players: PlayerRef[] }>;
  extraSkaters: PlayerRef[];             // 7th D / 13th F listed after rows
  goalies: { starter: PlayerRef | null; backup: PlayerRef | null };
  scratches: PlayerRef[];
  injuredListed: PlayerRef[];
  powerPlay: Array<{ unit: 1 | 2; players: PlayerRef[] }>;
  penaltyKill: Array<{ unit: 1 | 2 | 3; players: PlayerRef[] }>;
  changes: Array<{                       // for single-line, swap, substitution and in-game tweets
    kind: "in_for" | "swap" | "moves_to" | "draws_in" | "draws_out" | "pp_replace";
    playerIn: PlayerRef | null; playerOut: PlayerRef | null;
    toSlot?: { situation: "es_forward" | "es_defense" | "pp" | "pk"; slot: number } | null;
    period?: 1 | 2 | 3 | "ot" | null;    // in-game changes
  }>;
};

export type GoalieExpected = {
  player: PlayerRef; teamId: number;
  gameDate: string | null;               // resolved from "tonight / Saturday" against publishedAt
  role: "starter" | "backup" | "emergency_backup";
  status: "confirmed" | "likely" | "projected" | "ruled_out";
  basis: "official_team" | "coach_quote" | "beat_report" | "aggregator" | "warmup_leads_out"
       | "first_off_ice" | "practice_net" | "unspecified";
  sourceMarker?: "check" | "p" | null;   // DFO ✅ / 🅿️ when present
};

export type InjuryExpected = {
  player: PlayerRef; teamId: number | null;
  event: "new_injury" | "status_update" | "setback" | "return_to_practice" | "return_to_lineup"
       | "activated" | "placed_on_ir" | "placed_on_ltir" | "surgery" | "illness" | "maintenance_rest";
  availability: "out" | "doubtful" | "questionable" | "probable" | "available" | "unknown";
  scope: "period" | "game" | "unspecified";
  certainty: "official" | "reported" | "tentative";
  bodyRegion: "upper_body" | "lower_body" | "head" | "illness" | "specific" | "undisclosed" | null;
  bodyDetail?: string | null;            // "left knee", "ACL"
  timeline: null | {
    purpose: "return" | "reassessment" | "absence";
    minimum: number | null; maximum: number | null; unit: "days" | "weeks" | "months" | "games" | null;
    vague: "day_to_day" | "week_to_week" | "indefinite" | "season" | "until_date" | null;
    targetDate: string | null;           // resolved date for "Saturday", "after Christmas" → labeller supplies
  };
  effectiveDate?: string | null;         // "retroactive to Oct. 26"
};

export type MoveExpected = {
  kind: "recall" | "assign" | "loan" | "conditioning_loan" | "waivers_placed" | "waivers_cleared"
      | "waivers_claimed" | "trade" | "signing" | "extension" | "release" | "ir_place" | "ir_activate"
      | "retire" | "suspension";
  player: PlayerRef;                     // call-ups often playerId null at label time: keep literal
  fromTeam: { nhlTeamId: number | null; literal: string | null } | null;   // "Iowa", "Lukko (Liiga)"
  toTeam: { nhlTeamId: number | null; literal: string | null } | null;
  effectiveDate: string | null;
  certainty: "official" | "reported";
};
```

### How a regression runner should score it

- **Per tweet:** type precision and recall (multi-label), and team exact match.
  - If `expectEmpty`, any extracted claim is a false positive.
- **Lineup:**
  - per unit, exact set match at the right slot (order inside a row does not matter);
  - separate scores for **row integrity** (set match, any slot) and **slot accuracy**;
  - goalie starter exact; scratch set F1; each `changes[]` item matched on (kind, in, out).
- **Goalie:** match on (playerId, role). Score `status` as exact, and as "safe" — projected-for-confirmed counts as a
  safe miss, confirmed-for-projected as an **unsafe** error, reported separately.
- **Injury:** match on (playerId, event). Then score availability exactly, and the timeline by bucket: minimum and
  maximum within ±0, unit exact, target date exact.
- **Move:** match on (kind, player literal or ID, toTeam).
- **Identity:** over `mentions`, compute accuracy of the resolved ID, plus a separate count of **wrong-player**
  matches (worse than misses). Unresolved mentions with `playerId: null` in the key are correct when the parser also
  leaves them unresolved.
- **Report** metrics per parser version, sliced by `sourceAccount` and confidence band. A good confidence score
  shows accuracy rising monotonically across the bands. The existing `scoreLunaEvaluation`
  (`tweetLunaEvaluationScoring.ts`) already applies the "order-insensitive, duplicates fail" rule and can be the
  model.

### Mapping from existing labels

- `tweetClassificationLabels.json`: records with `claims` (kind, modality, span) map to `mentions` plus a typed
  `expected` block. Records with only `expectedClassification` map to `types` alone.
- `tweetLunaAdjudicatedLibrary.json`: `observedSourceClaims` map to typed entries:
  - `lineup_row_membership` → `forwardLines` / `defensePairs`
  - `pp_group_membership` → `powerPlay`
  - `warmup_goaltender` → a goalie with basis `warmup_leads_out`
  - `injury_availability` → an injury
  - `pp_replacement` → `changes[]`

  Both files can seed the dev split on day one.

### Suggested first trainer batches, by expected yield

1. DFOFantasy full lineups: 80 rows with the 🥅 goalie gap and the first-D-pair gap.
2. GameDayGoalies and DFOFantasy goalie posts with ✅ / 🅿️ markers.
3. `classification = 'injury'` rows whose text matches recall / assign / waiver (transactions mislabelled as injury).
4. Injury rows with `unknown`/`unknown` events: the 136 DFO "Name: Injury:" header events.

---

## Top ten across all areas

1. **High** — Read `🥅: Name ✅` / `G:` goalie lines (§1 H1). Every DFOFantasy lineup currently loses its goalie.
2. **High** — Stop the F-section role carrying into the first D pair, and never shift pairs up (§1 H2).
3. **High** — Filter row goalies by state, so ruled-out and projected goalies are not stored as starters (§2 H1).
4. **High** — Choose the first *complete* lineup per bucket, not the first arrival (§1 H3).
5. **High** — Stop transactions being classified as injuries: remove the verbs from the injury keywords and use word
   boundaries (§4 H1).
6. **High** — Extend injury evidence across pronoun sentences and "vs." abbreviations; order new-injury cues before
   day-to-day (§3 H1–H2).
7. **High** — Separate lineup OUT / scratch decisions from injuries (§3 H4).
8. **High** — Fix identity data: duplicate players, prospects, and memberships updated from transactions (§1 H4, §4 M4).
9. **Medium** — Model partial and change-only lineup tweets (§1 M5). This is required for the trainer's single-line
   and in-game cases.
10. **Medium** — Persist a per-tweet confidence score with its components (§5), so the trainer and the regression
    runner share one number.

## Limitations

- Production reads were bounded samples, not a full census. The counts in the volume tables are complete aggregates
  for 2026-10-07 → 2026-11-06.
- Probe cases marked synthetic use invented sentences with real roster names. Each one isolates a single code path;
  none is presented as a real tweet.
- `x_timeline_shadow_posts` was not sampled. The audit used the processed `line_source_snapshots` rows, which carry
  the parser's own output. The new poller's full text and original authors should fix the `SOURCE_ACCOUNT` relay
  attribution gap noted in §5.
- The probe passes rosters to the interpretation path directly. In production the roster also merges aliases and
  memberships (`lineSourceProcessing.ts:153-219`), so a case that fails in the probe can succeed in production once
  an alias exists.
