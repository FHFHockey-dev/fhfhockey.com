# FHFH IFTTT: from retained tweets to dependable claims
## Scout's cloud audit • October 15, 2026

### Bottom line
The biggest improvement is not a longer list of regex exceptions. The pipeline needs to keep the meaning of each claim intact: who it concerns, what is asserted, what is uncertain or denied, which game/practice it concerns, and who originally reported it. Parsing structure and validating identities remain important, but they cannot replace those distinctions.

The full initial reading pass covers every group and text variant in the retained export. A separate comparison then examines actual stored outputs. Several concrete storage errors are verified; others are appropriate uncertainty holds or historical defects already addressed in the reviewed cloud code. This report does not claim a production accuracy percentage.

## 1. What was examined

Fixed export cutoff: 2026-10-15 16:46:08.331884 UTC. Pagination was reconciled but was not an atomic database snapshot.

- 5,494 incoming receipts: 3,420 general-source and 2,074 CCC.
- 5,834 parsed snapshot rows, 5,701 review rows, 2,176 interpretation reports and 236 player events.
- 19,441 content/context records; 3,337 job records retained separately.
- 5,489 exact-linked groups and 7,860 within-group text variants individually interpreted.
- All groups and variants accounted for without duplicate annotation coverage.

Sources actually present: CcCMiddleton, GameDayLines, GameDayGoalies and GameDayNewsNHL. DFOFantasy and NHL_Rosters are not represented in these raw source tables. This is complete coverage of the retained export, not proof every tweet from those accounts was ever ingested.

Full text, truncated relays, fetched variants, quotations and derived excerpts were preserved. Initial semantic annotations were written before stored parser/review labels were opened. These are reasoned AI interpretations, not independently authenticated facts about historical player status. The entire historical corpus is discovery material; it cannot also be claimed as untouched evaluation data.

## 2. Verified findings and their limits

### A. Injury events can contaminate goalie fields — defect in the frozen reviewed cloud source
A retained injury-derived snapshot names Jordan Staal in goalie_1 while the ordinary lineup/report names Kochetkov correctly (G005040). The frozen reviewed cloud source iterates injury and goalie events, then overwrites goalie fields for either kind. The same field pattern appears in all 41 injury-classified internal event snapshots. In 38 of those, the stored goalie ID belongs to a skater according to the same parent report’s retained roster context; the remaining three identify goalies.

An isolated patch has passed independent review: 221 focused tests pass, including eight new regressions that failed against the unchanged baseline. Additional preservation/immutable-key probes passed. The patch is ready for integration review; it is not deployed. Other consumers discriminate by event kind or classification, so this is proof of malformed storage, not proof a Staal goalie forecast was served. No production repair has run.

### B. Evidence snippets can drop negation or uncertainty
“Don't see Kiviranta out there” loses “Don't see” in its stored excerpt (G003095). Severson's “not optimistic ... will be able to play” loses the negative framing (G003366). A Staal excerpt drops “without” (G005040).

The examined event states remain unknown, so the excerpts do not prove those players were marked available. Nevertheless, a reviewer or future consumer reading only the excerpt can receive the opposite meaning. Store the complete governing clause and highlight the entity within it; keep exact original offsets and source identity.

### C. Historical accepted assignments misread presence and absence
G000259 puts Durzi, McBain and Sergachev into injured names despite the source saying they are “out for warmups,” meaning present. G000999 puts both Kapanen and Veleno into injured names although the absence applies only to Kapanen and a qualifier disputes the reason.

These are concrete retained assignment errors. They are not evidence that every current code path still makes the same error, or that a final applied player-state table was changed.

### D. Row shape can override hockey meaning
Today's G005488 includes four forward trios, then Jones-Hyman, an incomplete Ekholm partner, and RNH-Dach rotating through defense. A stored snapshot places Jones/Hyman in a defense pair. The report also preserves invalid_extraction and an incomplete unit; the current reviewed adapter excludes incomplete units, so this particular incomplete-unit serialization path is addressed in that source.

The broader lesson is nuanced: usual F/D position helps disambiguation, but an explicit report of forwards temporarily practicing on defense must remain representable. It must not silently change their fantasy eligibility or become a game-day defense assignment.

### E. Old snapshot corruption needs a separate remediation decision
One April Canadiens tweet was later bound to Edmonton, matching familiar surnames to Colton Dach, Kasperi Kapanen and Quinn Hutson (G000065). Its goalie field contains “per @SO_Lorange.” Another media-only caption stores TV listings as goalie text (G000054).

Current role checks address some malformed assignments, but fixing code does not repair old rows. Any historical repair needs a bounded candidate set, dry run, preserved originals and separately approved execution.

### F. Attribution is unresolved in the retained interpretation reports
All 2,176 report provenance objects say pending; original tweet ID, original URL and original publication time are absent, and recorded attribution attempts are zero. Some texts contain RT attribution or named reporters, but that is not the same as a resolved authenticated original source.

The earlier reviewed cloud fixes improve reporter provenance and publication holds. Integration and real-source acceptance remain necessary. Duplicate relays must never count as independent corroboration.

### G. Minor-league reports can leak into NHL representations
Retained Amerks text is associated with Buffalo and an NHL game (G003259), Roadrunners/Eagles text with Utah and an NHL game (G004083), and Hartford/AHL text with Rangers defense assignments (G004129). These are scope-binding defects in retained outputs, not proof of final consumer application. NHL-affiliate recognition must not override the actual team/league in the source. Current-code protection needs separate verification.

### H. Pipeline status is not an action receipt
All 171 failed ingress receipts still have parsed descendants; 169 also have interpretation reports and 44 have player events. A failed status therefore does not mean no downstream work exists. A naive replay could repeat downstream effects.

Conversely, all 236 interpreted injury events have exact matching stored player-event keys and audited fields. The other 330 interpreted events are goalie events, so their absence from the injury-event table is not a missing-action bug.

Two pending GameDayLines receipts have no parsed/report/event descendants (G002692 and G002698), despite meaningful practice/PP text. Those are bounded recovery candidates. Their SOURCE_ACCOUNT placeholder is common elsewhere, so it is not an established cause.

## 3. The semantic model to implement

Represent each independent claim with:

- Subject identity and source-time team/league context.
- Predicate: practice attendance, injury, medical clearance, game selection, role assignment, transaction or goalie start.
- Polarity and certainty attached to that proposition, not the whole tweet.
- Event/time scope, including practice group, strength state, game ID and applicability.
- Original reporter, relay, quotation and correction relationships.
- Full governing clause, exact evidence span, missing context and resolution state.

Keep these states separate:

1. Health is not selection. Healthy players can be scratched; practice absence can be maintenance; non-contact participation is not a game decision.
2. Observed is not confirmed. Starter's crease, first off, warmup order, season-long 1A/1B and actual game starter are different evidence.
3. Reason uncertainty is not outcome uncertainty. “Not necessarily injury-related” may leave an explicit OUT intact.
4. Historical is not current. Top-performer lists, offseason disclosures and past position counts must not become today's assignments.
5. A camp group is not a full game lineup. Four defense pairs, five forward lines, extras and rotating slots are valid camp observations.
6. Explicit unusual roles are valid observations. Preserve a defenseman practicing at forward or a two-defenseman PP unit with source scope.
7. An administrative event is specific. PTO, qualifying offer, waiver eligibility, actual waivers, rights trade, IR and LTIR are not interchangeable.
8. Game identity matters. Team plus date is insufficient for split-squad preseason games; session/group identifiers also matter in practice.

## 4. Deduplication and contradiction handling

Retain every incoming receipt and original variant. Deduplicate downstream actions by event, player, predicate, state and meaningful semantic correction/revision, with original-source lineage. A parser or report version change alone must not authorize a duplicate action. The first sufficiently supported claim can act; later matching evidence corroborates without repeating the action. A later correction or material role/state change creates a new transition.

Do not vote by tweet count. Multiple relays of one report are one origin. Keep disputed claims pending when source authority, identity, time or applicability is unresolved. Record why a claim was accepted, held, superseded or rejected.

A durable action ledger should separate received, interpreted, qualified, action-requested, acknowledged and verified states. This is essential because failed receipts already coexist with downstream records. Existing replay improvements help but do not establish a complete cross-source semantic action ledger.

## 5. Ordered implementation tasks

### P0: prevent wrong data and preserve meaning
- Integrate the independently reviewed injury-to-goalie adapter fix, then verify its full application path. Cloud tests cover injury-only, mixed injury/goalie and real goalie overrides; historical repair remains separate.
- Make evidence excerpts include governing negation, hedges and temporal clauses; entity highlighting must not replace context.
- Preserve complete authentic variants; do not automatically prefer a shorter enriched text over full raw text.
- Enforce original-source provenance before qualified publication, with explicit recoverable holds.
- Validate event-kind fields and reject cross-kind contamination at storage boundaries.

### P1: reduce false assignments and unnecessary holds
- Add claim-level availability/reason/selection states and correction links.
- Parse identity-aware grouping, including compound names, initials, aliases, slashes, extras and explicit cross-role practice.
- Require source-time team consistency and event binding before resolving common surnames.
- Treat PP, PK, 3v3, 6v5 and camp groups independently; do not infer ranking when source explicitly disclaims order.
- Improve media-only and missing-antecedent review states rather than treating them as generic parser failures.
- Add exact highlighted source spans and split-player resolution in review UI.

### P1: reliability and recovery
- Investigate the two specific pending ingress paths without bulk replay.
- Add source-coverage checks for DFOFantasy and NHL_Rosters.
- Design the durable semantic action ledger and partial-failure recovery protocol.
- Propose historical cleanup separately from new-code integration; preserve originals.

### P2: prove improvement
- Turn adjudicated examples into versioned regression fixtures with linked source records.
- Report claim extraction, identity, event binding, uncertainty preservation, action precision/recall, abstention and duplicate actions separately.
- Reserve genuinely new future source families for forward evaluation. Do not score the discovery corpus as an untouched test.
- Only consider selective online model review after an explicit cost, latency, failure and privacy design; it is not required to fix the concrete defects above.

## 6. What this does not establish

No final applied-state or consumer audit is included in the exported tables. Historical snapshots span several parser versions. Missing canonical representations are candidates for review, not automatically false negatives. Pending reviews are not proof of publishing, even when proposed automatic-assignment metadata exists. Public posts were not independently authenticated against X for every historical claim.

Cloud patches, regression tests, integration and production behavior are separate milestones. No deployment, bulk replay or database correction was performed by this audit.
