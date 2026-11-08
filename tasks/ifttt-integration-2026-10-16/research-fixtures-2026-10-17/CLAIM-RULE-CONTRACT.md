# FHFH IFTTT per-claim processing: bounded contract

15 October 2026. Design from retained local cloud files only. No application source was changed, no database or network was used, and no production or Mac behavior was tested.

## Decision and immediate implementation boundary

Keep the existing immutable report, player-event and capture keys. Add a **separate source-claim occurrence registry**, versioned evidence/interpretations, and a compatibility/effect planner. First implement these as pure, offline modules with supplied registry state and memory-only fixtures. Do not wire them to publishing or change existing storage identities in this slice.

The unit of meaning is one subject/predicate occurrence in a source, not a whole tweet and not a resolved proposition hash. A source occurrence can survive a later identity, time or game resolution. A different source occurrence can state the same proposition. Neither relationship can be represented safely by hashing the resolved proposition alone.

A widened evidence excerpt is a new evidence version of an existing occurrence. It cannot authorize another downstream effect. Correcting an already-actioned interpretation is a reviewable transition, not a newly discovered independent fact.

## 1. Verified integration seams

Paths below are relative to `ifttt-cloud-fixes-2026-10-15/independent-review-artifacts/composed/source/`.

- `web/lib/sources/tweetProjectionStorage.ts:233–258`: `projectionReportFromSource` hashes original ID, team, date, full text and the complete interpretation. Evidence wording/offsets and interpretation versions therefore change the report identity.
- Same file, `persistTweetProjectionReports`, approximately lines 289–300: injury child key is `report.key + playerId + evidence.start`. Changing only the child suffix leaves the changed parent prefix unresolved.
- Same file, `projectedSetsToForecastRows`, approximately lines 15–36: unit capture identity hashes contributing report keys. Event captures use `report.key + kind`, approximately line 326. Fixing only the injury-history table leaves capture/forecast duplicates possible.
- Same file, `retainedProjectionLineage` and `persistProjectionSourceSnapshots`: exact retained lineage, versioned derivations, immutable readback, and reporting-origin publication holds already exist. Preserve them.
- `web/lib/sources/tweetSemanticEvents.ts`: private pure reducer already separates scenario/revision, groups original-source support and holds changed facts/corrections. It consumes bound observations; it neither extracts claims nor provides durable action delivery. Reuse its tests/semantics rather than create a competing reducer. Its immutable observation ID must identify an evidence/interpretation derivation, **not** the stable `sourceClaimId`, because evidence changes are otherwise identity collisions.
- `web/lib/lines/sourceClaims.ts`: existing line-claim IDs include report/binding/context/unit content; these are versioned derivation IDs, not stable source occurrence IDs. Relationship keys include evidence offsets. Leave this contract unchanged in the first slice.
- `web/lib/player-forecasts/sourceObservations.ts:337–505`: downstream captures use source capture keys, then queue game/team-horizon work. Sink idempotency must cover observations, assignments and queues, not merely report insertions.
- `supabase/migrations/20260919005608_tweet_pipeline_reports_and_review.sql`: report and injury-event primary keys exist; no source-occurrence registry or semantic effect ledger is defined here. The supplied migrations do not prove the live schema or all consumers.

The retained diagnostic `evidence-context/identity-hazard-proof.json` reproduces G005040 changing the Staal span from 73–126 to 65–126, changing both report and child keys. Its memory-only historical replay inserts two reports and two player-event rows. These are diagnostic reconstructed fixture keys, not authenticated historical report keys.

## 2. Five minimal modules and contracts

### A. Extract source claims

Input: immutable retained source-text version and its source/relay/time references. Output: independent lexical claims and unresolved fragments.

Each claim carries:

- `sourceTextVersionId`: exact immutable bytes plus encoding; text hashes are valid version identifiers, not occurrence or action identities.
- `subjectSpan`, `predicateSpan`, `governingClauseSpan`, optional `contextSpans`: exact text and half-open offsets into that one source version. Use JavaScript UTF-16 code-unit offsets to match current slicing; validate `source.slice(start,end) === text`. Preserve raw UTF-8 byte hash separately.
- `subjectText`, lexical predicate and value, `polarity` (`affirmed`, `negated`, `unresolved`).
- `assertionStrength` (`unqualified_assertion`, `projected`, `tentative`, `direct_observation`, `unresolved`), attached to that predicate, not the post.
- Source publication, wrapper publication, receipt and interpretation times kept separately; raw time precision and missing values retained.
- Clause-local language/support status and reasons. Unsupported or unknown language stays unresolved, without guessed English semantics.

Do not change the source to make evidence fit. Subject highlighting is separate from the governing clause. A clause may support multiple independently represented subject claims; shared clause evidence does not merge their identities. Unknown fragments remain visible and do not invalidate an unrelated complete claim unless they actually govern it.

### B. Bind and validate each claim

Input: lexical claim, source-time roster/league context, event/session candidates and provenance evidence. Output: `ClaimInterpretation` with `interpretationVersionId`, `sourceClaimId`, `evidenceVersionId`, resolved subject or candidates, predicate/value/polarity/strength, exact applicability scope, effective interval, validity and independent gate decisions.

Each gate has status and evidence: provenance, subject identity, source-time team/league, predicate meaning, role admissibility, game/session/period, time precision and evidence integrity. Role is context for identity and plausibility; an explicit unusual practice role remains an observation and cannot alter fantasy eligibility. Health, practice attendance, game selection and goalie-start confirmation are different predicates.

A negative reason qualifier can affect reason confidence without weakening an independently explicit OUT. Strength expresses what the source asserted. `disputeStatus` is a separate reconciliation result; two explicit reports can disagree.

### C. Track stable source occurrences and immutable derivations

`sourceClaimId`: durable namespaced token allocated once in registry state for one lexical subject/predicate occurrence in one source statement. It does **not** include resolved player ID, resolved team/game, final predicate/value, evidence excerpt bounds, parser version or current roster. Multiple same-player clauses in one source are distinct occurrences; multiple players in one clause have distinct subject slots.

`sourceRootId`: stable retained source object. Prefer a verified platform original ID with attribution proof. If unavailable, use the persisted ingress/source record identity, marked provisional; do not fabricate an original from a handle or RT text. Provisional identity permits retention, not qualified publication.

`evidenceVersionId`: immutable derivation for a source-text version, exact subject/predicate/context spans and representation version. `interpretationVersionId` separately versions binding and semantic decisions. Existing report/event/capture keys are retained in `legacyRefs`, never overwritten or silently rekeyed.

Registry allocation is stateful: persist/reuse the occurrence token and its initial anchors. Do not recompute the token from the newest interpretation or newest display span. A lexical anchor may contain source-relative offsets at first allocation; those offsets are matching evidence, not the ongoing identity formula.

### D. Reconcile bound claims

`scenarioId`: cross-source question/slot under a fully bound scope. Examples: game+team+phase+starter slot; game+team+phase+player+availability; session+group+player+practice attendance. Team+date alone is insufficient for split-squad games or multiple practice sessions.

`scenarioRevisionId`: material answer/value and effective interval within that scenario, with correction/retraction lineage where applicable. It excludes evidence wording, parser version, relay count and arrival refreshes. Independent sources/occurrences may corroborate one revision. Same-original relays form one origin and never independent confirmation votes.

`relation`: a new source occurrence can state `correction` or `retraction`, with `targetSourceClaimIds` and evidence establishing the relationship. A parser's revised interpretation of the same old wording is a derivation revision, not a new reporter correction. A later assertion is not automatically a correction merely because it is later.

First slice: retain initial acceptance; agreeing claims corroborate without re-action or validity extension. Contrary sufficiently bound claims make the scenario disputed/unresolved. Preserve historical acceptance and any actual action receipt. Correction/retraction, changed effective fact, or material accepted subject/scope rebind stays held for explicit resolution. Do not silently undo, replace or compensate an earlier effect. Do not resolve disputes by tweet count, timestamp alone or unconfigured source authority.

### E. Plan compatibility and effects

Input: registry, derived associations, explicit legacy coverage and effect-ledger state. Output: append-only proposed records and decisions (`record_evidence`, `reuse_effect`, `hold`, `propose_effect`) with reasons. No I/O or dispatch in the first slice.

`transitionId`: an allocated durable acceptance/transition record, not a hash of current value alone. `actionId = effectKind + scenarioId + transitionId`. Parser/evidence versions and source occurrence count cannot mint a transition. A later authorized A→B→A change must be representable as distinct transitions, even though A's value repeats.

Initial acceptance is the only effect proposal supported in this slice. An eligible unknown→known interpretation can propose its first effect once every gate is resolved and no prior/legacy effect is uncertain. Repeated matching evidence reuses that acceptance. The pure planner may return a reserved transition/action in `nextRegistry`; a reservation is not delivery. `reuse_effect` must expose whether the effect is only reserved, requested, acknowledged or verified, and must never imply a reserved effect reached its sink. Evidence-only changes may change an immutable interpretation derivation ID when it references new evidence; compare material binding/semantics separately.

## 3. Matching and revision rules

1. On the same immutable text version, reuse a registry occurrence only when the subject and predicate anchors identify one unique existing occurrence. Expanded governing evidence does not change those anchors. A second identical-looking clause has its own lexical occurrence.
2. Across wrapper/full-text/truncated variants, require verified source lineage and an explicit unique one-to-one anchor alignment. Preserve both source versions and the alignment proof. Text resemblance, resolved player ID or matching final value is insufficient. Missing/truncated anchors, repeated ambiguous clauses, claim splits/merges and conflicting alignments return `hold`; they must not allocate an apparently new actionable occurrence.
3. When original provenance resolves, attach aliases/lineage to the retained provisional occurrence after unique mapping. Do not replace its ID. Separate relays can converge on a canonical original occurrence only with original-source/occurrence proof; keep all local IDs and receipts as aliases. If convergence reveals duplicate prior effects, hold for remediation rather than erase history.
4. Unknown subject/game→known subject/game preserves `sourceClaimId` and adds a new interpretation. A change between already-qualified identities/scopes or a material predicate/value reinterpretation requires a resolution decision; after an effect it cannot be treated as a fresh initial acceptance in another scenario.
5. Same immutable derivation ID with different payload is a collision: retain the old record, hold the proposal and block new effects. Same `sourceClaimId` with a distinct, correctly versioned evidence/interpretation payload is expected history, not an immutable-ID collision.
6. Rule-version changes never bypass provenance, applicability or legacy-effect holds. Historical replay remains historical; it cannot become today's forecast update.

## 4. Legacy coexistence and delivery protocol

Bootstrap by **planning** an append-only map from exact retained report/event/capture keys to source occurrences and derivations. Require a unique retained source relationship and lexical occurrence match. Legacy offsets alone, player ID alone or report text alone cannot prove that match. If a legacy row has insufficient source evidence, multiple matches, or incompatible payloads, hold it and report the bounded ambiguity.

Two evidence/report versions can coexist, but do not publish both independently. A future consumer must resolve their compatibility aliases and action coverage before emitting effects. Merely adding metadata to the producer while leaving an old publisher active does not solve duplicate effects.

A legacy report/event row is evidence, not an acknowledged action receipt. The audit found downstream rows despite failed ingress status, and did not export final applied-state evidence. Therefore:

- Verified sink acknowledgement/readback for the same scoped effect: record legacy coverage and reuse it; preserve its original source/effective/available times.
- Verified unissued effect plus complete qualification: a first acceptance may be proposed.
- Incomplete/unknown legacy action state: `hold: legacy_effect_unknown`; no blind replay. Do not infer absence from a failed receipt or absent injury-history row for a goalie event.

For later durable wiring, atomically claim a transition and write an outbox request with a unique action ID. Each sink must dedupe that action ID or expose an equivalent verified receipt. Track requested→acknowledged→verified separately from ingestion/parsing. Lost acknowledgement retries reuse the same action ID; before any non-idempotent resend, reconcile the sink receipt. Concurrent workers, parent write failure, child success/ack loss and queue failure must be fault-tested. Pure/memory tests do not establish PostgreSQL transaction safety or end-to-end exactly-once delivery.

Open compatibility decisions before wiring: deployed schema and all readers, whether legacy IDs are externally exposed, full snapshot-key uniqueness and RPC behavior, effect receipt availability, attribution-hold upgrade policy, registry retention/concurrency, and authorized correction/compensation policy. No historical migration, destructive cleanup or live backfill is implied.

## 5. Concrete regression and adversarial acceptance

Use exact retained bytes with source links/hashes. Treat the historical corpus as discovery/regression data, not untouched evaluation. Minimal rosters are extraction fixtures, not full historical roster replay.

- **G005040**: baseline Staal evidence 73–126 and widened `without` evidence 65–126. Same occurrence, two evidence versions, unchanged legacy rows, at most one scoped effect proposal/receipt. Old→new, new→old, repeated retries, interpretation-version-only and restart-with-retained-registry orders converge. Staal cannot enter goalie fields; Kochetkov remains the goalie.
- **G003095 / G003366**: preserve “Don’t see” and “not optimistic … able to play” in exact governing evidence. Current frozen extractor emits no events for these texts; do not call a passing identity test an extraction fix. Later rule work must separately demonstrate claim extraction without promoting absence/forecast to confirmed injury or availability.
- **G000259**: “out for warmups” is presence, not injured/out. **G000999**: Kapanen absence remains separate from Veleno; uncertain injury reason does not globally weaken an explicit absence.
- **G005488**: incomplete Ekholm partner remains incomplete; explicit forward practice-on-defense is a scoped role observation, not fantasy eligibility or automatic game-day defense assignment. **G000065**: historical Canadiens source cannot resolve familiar surnames using Edmonton's later roster.
- **G003259 / G004083 / G004129**: AHL/affiliate scope never becomes the parent NHL club/game solely through affiliation.
- Synthetic supplements: same player repeated twice with identical wording (two occurrences, one matching scenario revision); two players sharing one clause; ambiguous duplicate clause alignment; truncated→full alignment; quote/wrapper prefix shifts; provisional→verified original; two relays converging on one original; unknown→known subject/game; known player A→B or game A→B after effect; split/merge; unknown language; same ID/different payload collision; two explicit conflicting sources; uncertain repetitions; explicit correction and bare retraction; distinct same-day games/sessions; genuinely later effective interval; A→B→A transition identity.
- Delivery supplements: legacy+new coexistence, unknown legacy coverage, lost acknowledgements, partial parent/child/queue failure, concurrent initial claims, state reload, and reporting-time cutoff. Evidence-only versions and corroboration never refresh availability, expiry or action time.

## 6. Finite next slice and stopping condition

Implement only a new isolated occurrence registry, legacy compatibility planner, and a small adapter/fixture model for existing derivations. Supply all state and alignment/coverage evidence explicitly. Do not modify `projectionReportFromSource`, current keys, storage schemas, publishing calls or the private semantic reducer in this slice. Do not implement a general multilingual parser or new source-authority policy.

Deliver source, test fixtures, reproducible offline test command, baseline/candidate hashes, and a machine-readable decision trace. Include the actual G005040 baseline/candidate extraction results plus adversarial identity fixtures. Run the existing relevant evidence, immutable-parent and semantic-reducer tests unchanged alongside new tests, distinguishing inherited failures and unrun build/lint stages.

Stop after independent review verifies the isolated contract: representation-only changes preserve occurrence/effect identity; legacy ambiguity and material rebinds hold; independent claims remain distinguishable; original data/keys are unchanged; all effects are proposals only. The next decision is then a separately scoped persistence/outbox integration design with real constraints and consumer inventory. Passing this slice does not clear the evidence-context patch for production or authorize live replay.

## Sources read

- `ifttt-real-corpus-2026-10-15/deliverables/IFTTT-REASONING-AUDIT.md`
- `ifttt-corpus-fixes-2026-10-15/evidence-context/FOLLOWUP-PROPOSAL.md`, `REPORT.md`, `identity-hazard-proof.json`, `harness/identity-hazard.test.ts`, exact excerpt fixtures
- The source paths listed in section 1, and `projectedLineups.test.ts`, `tweetSemanticEvents.test.ts`, `tweetInterpretation.ts`, `tweetPlayerEvents.ts`

All paths are retained cloud inputs from the original cloud workspace; no independent authentication of historical player facts was attempted.
