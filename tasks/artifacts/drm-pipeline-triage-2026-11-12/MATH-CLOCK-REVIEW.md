# Independent penalty-clock mathematical review

2026-11-12; reviewer `gpt-6.1-sol` / `high`, Chef `gpt-6-astra` / `xhigh` (runtime settings verified earlier). Read-only application review on `octoberBranch`. Decision 70 requires matching penalty-context classification for events/exposure; decision 71 still withholds observed-clock qualification. `PP_CLOCK_QUALIFIED` remains false.

## Decision

The existing full simulator is **NOT safe to promote** into the shift strength timeline as part of the interval-union repair. Independent deterministic probes exposed failure modes absent from the five-game event-match sample. A narrowly gated, same-period expiry correction for an isolated, unambiguous two-minute minor has a smaller correctness boundary; this is a recommendation for a separately verified correction, not an implemented timer or proof of safety. Until that work is verified, strength timing remains a release blocker. This recommendation does not qualify either implementation as the canonical displayed PP clock.

## Actionable simulator findings

1. **[P1] Penalty-shot goals release running minor penalties** — `web/utils/getPowerPlayBlocks.ts:446–455`. The goal path checks only which team has fewer serving penalties; it never excludes penalty shots. Offline reproduction: away minor at P1 01:00, home penalty-shot goal at 01:30 (`situationCode: "0101"`), period ends at 20:00. Actual home PP block is **01:00–01:30 (30 s)**; a penalty-shot goal does not release the already-running minor, so the block should remain **01:00–03:00 (120 s)**. The module's own situation audit excludes penalty-shot codes, so that audit does not directly challenge this transition.

2. **[P2] Additional penalties to the same player at a later stoppage run concurrently** — `web/utils/getPowerPlayBlocks.ts:461–464`, supported by the loss of server identity in `TeamPenaltyBox`/`ServedPenalty` at lines 297–299. Grouping by offender applies only within one stoppage. Offline reproduction: the same away player gets a minor at P1 01:00 and an additional minor while serving it at 02:00. Actual home PP block is **01:00–04:00 (180 s)**. Serial service should produce **01:00–05:00 (240 s)**, consistent with this function's documented “one player's penalties run one after another” contract. The current boxes cannot append the new segment to the existing offender's service.

## Concrete qualification concern

**Same-stoppage cancellation depends on incoming event order** — `web/utils/getPowerPlayBlocks.ts:362–372`. At P1 01:00, away player A receives a minor plus a major, away player B a minor, and home player C a minor. With A's minor listed first, the simulator cancels A's minor and returns a five-minute home PP. With B's minor first, it cancels B's minor and returns a seven-minute home PP. Every penalty's identity, timestamp, duration and offender are unchanged. **Official-rules follow-up:** captain-selected cancellation/service arrangements exist (Table 13 examples 7 and 27). Therefore this permutation is a source-ambiguity concern, not proof that one uniquely mandatory arrangement was violated. Do not convert arbitrary event order into an asserted observed choice; use source evidence of service or report ambiguity. See the primary-source follow-up below.

## Passing controls

Direct execution of the actual default export, transpiled locally with non-calculation dependencies stubbed and remote calls blocked:

| Case | Expected and actual PP block |
| --- | --- |
| Same-stoppage minor + major, same offender, no opposing penalty | 01:00–08:00; major then minor |
| Three away minors at 01:00, 01:30, 02:00, distinct offenders | 01:00–05:00; third timer waits for first slot |
| Away double minor at 01:00; home goals at 01:30 and 02:30 | 01:00–02:30; each goal ends the current segment |
| Ordinary minor in regular-season OT at 01:00 | P4 01:00–03:00 |
| Delayed penalty goal at 01:30, no prior penalty and no assessed minor event | No PP block |
| Existing away minor at 01:00, delayed goal at 01:30, another offender's minor assessed then | 01:00–03:30 |

Delayed-goal controls assume the event feed omits a waived delayed minor and includes a genuinely assessed new minor. Provider representation was not independently checked. These controls are not complete delayed-penalty, overtime, queue or cancellation qualification.

## Boundary for a smaller expiry correction

The recorded 2026020009 example is an isolated minor at P1 07:19, nominal expiry 09:19, and the next ES-coded event at 09:24. Event-only interpolation carries PP through an extra five seconds. Inserting the supported expiry boundary can correct that specific gap without assuming that all simulator blocks are authoritative.

Keep the correction eligibility explicit: known offending team, ordinary two-minute minor, independently established post-assessment single-penalty PP/PK state, no coincidental/stacked/queued penalties, no intervening goal or other strength-changing penalty, and a same-period expiry within the validated period. Preserve source hashes. Split exposure with the existing classifier at that boundary; do not globally overwrite observed event states, invent missing penalties, or silently generalize ambiguous cases. Cross-period, double-minor, major, delayed-goal and mixed-service cases need separate fixtures or exclusion before inclusion.

Zero disagreements at sampled event timestamps cannot validate event-free intervals such as 09:19–09:24. It also does not establish complete source coverage or official PP-time parity under decision 71.

Chef separately reported exact simulator agreement with official game-summary team PP totals for 2026020009, 2026020115, 2026020159 and 2026020205. That is useful external evidence, not a check executed by this reviewer, and does not resolve the deterministic counterexamples above.

## Checks and limits

- Inspected the default simulator, its cancellation/queue helpers, situation-code audit, qualification contract, existing test file and owner decisions 70–71.
- Executed ten deterministic scenarios against the actual default export: two failing rule/contract cases, two permutations showing cancellation sensitivity, and six passing controls. No application files or tests were edited.
- No provider/DB calls, remote validation, production mutation, build or full suite. No official rulebook refresh was performed; the cancellation priority and delayed-penalty feed semantics remain explicitly unqualified.

## Primary 2026–27 NHL rules follow-up

The user subsequently authorized fixing the remaining clock defects. This is one primary-source pass for Chef's implementation; no application edits or DB/production calls. NHL's [official video-rulebook page](https://www.nhl.com/info/video-rulebook) links the [2026–27 Official Rules PDF](https://media.d3.nhle.com/image/private/t_document/prd/i9yumvyaojps5kixzaxz.pdf). The 232-page PDF was downloaded to `/tmp/fhfh-nhl-2026-27-rulebook.pdf`, extracted with macOS PDFKit, and Table 13 printed pages 150/152 were visually checked. PDF page numbers below are one-based and include the front matter.

### Sourced rules for implementation

- **Penalty-shot continuation:** Rules 16.2 and 24.6 explicitly preserve existing penalties after a penalty-shot goal; Rule 24.7 excludes the attempt from elapsed game time. The earlier penalty-shot finding is confirmed. [Printed 28–29 and 41; PDF 39–40 and 52](https://media.d3.nhle.com/image/private/t_document/prd/i9yumvyaojps5kixzaxz.pdf#page=39).
- **Later same-offender minor:** Rule 39.2(vi) adds an additional unsportsmanlike-conduct minor to the offender's remaining original penalty time, with consecutive service whether assessed before or after original service begins. Rule 70.4 separately requires consecutive service for premature exit from the box. The earlier generic fixture should specifically identify the additional minor as unsportsmanlike conduct or another supported serial infraction. [Printed 69, PDF 80](https://media.d3.nhle.com/image/private/t_document/prd/i9yumvyaojps5kixzaxz.pdf#page=80).
- **Major/minor ordering and goals:** Rule 20.1 serves a same-offender major before a minor unless the major is coincidental; then the recorded minor starts first. Rule 16.2 terminates the eligible running minor with the least time remaining when a goal is scored against a short-handed team; a future minor behind a major cannot end early. Table 12 B1/B2 and C6–C9 confirm this. [Printed 31–32 and 143–144; PDF 42–43 and 154–155](https://media.d3.nhle.com/image/private/t_document/prd/i9yumvyaojps5kixzaxz.pdf#page=154).
- **Coincidental service and queue:** Rule 19.1 preserves one visible minor per team as 4v4 when assessed at otherwise full strength. Equal substituted penalties in other coincidental cases do not occupy delayed-penalty slots. Rule 26.1 starts a third offender's clock only when a running slot expires; Rule 26.2 governs release after that expiry. The special visible 4v4 pair must remain distinguishable from substituted/canceled penalties and from goal-releasable minors. [Printed 30, 42–43; PDF 41, 53–54](https://media.d3.nhle.com/image/private/t_document/prd/i9yumvyaojps5kixzaxz.pdf#page=41).
- **Cancellation choice:** Rule 19.5 cancels as many majors as possible, then as many minors as possible. It does not supply a universally deterministic offender choice. Table 13 example 7 permits either one four-minute service or two two-minute services; example 27 permits either one seven-minute service or two services of five and two minutes. Without recorded choice or sufficient official manpower observations, these are multiple valid paths. [Printed 150–152; PDF 161–163](https://media.d3.nhle.com/image/private/t_document/prd/i9yumvyaojps5kixzaxz.pdf#page=161).
- **Late-game differential:** Rule 19.4 applies in the last five regulation minutes or any OT when one remaining offender's minor/double-minor opposes another offender's major/match at the same stoppage. The residual three/one minutes begin immediately and act as a major. It also applies after ordinary coincidental cancellation. Two different minor offenders do not equal one double-minor offender (Table 13 example 21); example 22 demonstrates qualifying residuals after cancellation. [Printed 31 and 151–152; PDF 42 and 162–163](https://media.d3.nhle.com/image/private/t_document/prd/i9yumvyaojps5kixzaxz.pdf#page=42).
- **Regular-season OT:** Rule 84.3 and Tables 15–16 govern carryover, 3v3/4v3/5v3, and restoring base strength at stoppages. Simultaneous minors with no other OT penalties preserve 3v3 rather than introducing regulation 4v4. Equal on-ice strength remains ES; extra-attacker state is separate under owner decision 70. [Printed 130 and 159–160; PDF 141 and 170–171](https://media.d3.nhle.com/image/private/t_document/prd/i9yumvyaojps5kixzaxz.pdf#page=141).

### Deterministic expected intervals supplied to Chef

These are arithmetic consequences of the rules above, assuming no unlisted goals/penalties and continuous play except the listed assessments. Team labels are independent of home/away.

| Input | Expected PP intervals / service |
| --- | --- |
| Team A minor P1 01:00; Team B penalty-shot goal 01:30 | B PP 01:00–03:00; goal releases nobody |
| A offender minor 01:00, then additional unsportsmanlike minor 02:00 | B PP 01:00–05:00; second service starts 03:00 |
| A offender major+minor 03:00; B goal 04:30 | Major continues; B PP through 10:00 absent another goal |
| A offender major+minor 03:00; B goal 08:30 | Major expires 08:00, running minor ends on goal; B PP 03:00–08:30 |
| Full strength; A1 and B1 minors 01:00; A2 minor 01:30; A3 minor 02:00 | Initial 4v4 clocks retained. A3 waits until 03:00 then serves to 05:00. B PP 01:30–05:00 |
| Full strength; A1 and B1 minors 01:00; A2 minor 01:30; B goal 02:00 | A2's minor ends, original pair continues. B PP 01:30–02:00 only |
| P3 16:00 A major vs B minor | B PP 16:00–19:00, major-like; no goal termination |
| P3 16:00 A major vs B double minor, one offender | B PP 16:00–17:00, major-like |
| P3 16:00 A major vs two distinct B minor offenders | No 19.4 reduction: A PP 16:00–18:00 (4v3), then B PP 18:00–20:00 in regulation (5v4); remaining major continues if OT follows |
| OT 00:30 A minor; 01:00 B minor; 01:30 another A minor | Per Table 16: B advantage 00:30–01:00 and 01:30–02:30; even 02:30–03:00; A advantage 03:00–03:30. Actual 3v3/4v4/5v4 counts depend on stoppages |

Delayed-goal handling must distinguish Rules 15.2/15.3/15.4: an otherwise unassessed minor can be washed out, a signaled double minor can reduce to one minor, while a short-handed team's running minor can terminate and the newly signaled minor still be assessed. Those rules determine the desired outcome, but the feed's representation of washed-out/double-minor remainder still needs evidence; do not infer it solely from duration or same-second event order.

**Handoff:** official rules confirm the two original failure mechanisms; cancellation is now correctly classified as ambiguity rather than a uniquely wrong arrangement. Chef owns the pure clock implementation and full end-to-end mathematical validation. This researcher has not qualified or accepted that implementation.

## Independent pure-engine review and red regressions

Reviewed the first `penaltyClock.ts` implementation independently of supplied test counts. Three further failures were reproduced against the actual pure export, then added to the existing `web/utils/getPowerPlayBlocks.test.ts` at Chef's explicit request:

1. **Double-minor goal release** (`penaltyClock.ts` initial lines 198–200): sorting current two-minute-half time released a lower-ID double-minor offender ahead of an equally aged single-minor offender. Table 12 C5 requires the single minor with less full penalty-clock time to end. P1 01:00 double+single, goal 02:00: actual PP ended 04:00; expected 05:00.
2. **Rule 19.4 after cancellation** (initial lines 87–105): the original two-event gate missed Table 13 example 22's four assessed penalties. P3 16:00 A major+minor vs B double-minor+minor, then 17:30 ES evidence: actual clock was empty; expected B PP 16:00–17:00. Table 13 explicitly mandates this residual differential rather than offering captain choice for this exact pattern.
3. **Regular-season OT coincidental slots** (initial lines 81–85): applying the regulation 4v4 slot exception in regular-season OT delayed a third timer incorrectly. OT 01:00 paired minors, A additional minors 01:30 and 02:00: actual B PP through 05:00; expected through 04:00. The regression supplies explicit `gameType: 2` and correct five-minute OT remaining clocks.

Before Chef's fixes, the narrow run `npm test -- --run utils/getPowerPlayBlocks.test.ts -t 'Table 12 C5|regular-season OT coincident|Table 13 example 22'` produced **3 failed, 26 skipped** in the existing 29-test file. This reviewer made only these three regression additions; ownership was then returned to Chef. No application implementation was edited.

An additional concrete goal-tie concern was supplied to Chef: A1 and A2 each get a single minor 01:00, B scores 02:00, then A1 gets a new unsportsmanlike minor 02:01. Rule 16.2/Table 12 C9 gives captain choice for the equal running minors at the goal. If A1 was released, the new clock ends 04:01; if A2 was released, A1's additional service ends 05:00. Without resolving evidence, those histories are ambiguous. A lexical offender-ID tie-breaker cannot establish the observed clock. This is separate from comparing the full remaining halves of one double-minor assessment.

One targeted simultaneous-expiry control passed: two A minors 01:00, two later queued minors 01:30/02:00, no goals, produced continuous B PP 01:00–05:00. This does not establish exhaustive queue correctness.

The first pure implementation is not accepted by this review. Chef owns fixes, subsequent green checks and end-to-end validation; decision-71 qualification remains open.

## Scoped correction verification

The corrected full-assessment remaining-time comparison, exact Table 13 example 22 differential, regular-OT initial-assessment exception, and `releaseForGoal` branching were reviewed. The exact example 22 special case now follows the official one-minute differential. Goal-release ties retain alternative histories rather than selecting an offender lexically.

At Chef's request, added three checks to the same existing utility test file: unresolved goal-tie histories throw; 04:30 ES evidence selects the PP ending 04:01; 04:30 PP evidence selects the PP ending 05:00. The future 02:01 minor explicitly carries an unsportsmanlike-conduct description. All prior workers' tests were preserved.

The narrow run covering those three tie checks plus the previous three counterexamples passed **6 tests, 26 skipped (32 total)**. `git diff --check` on the test file passed. Test ownership was returned to Chef after this receipt. This is local regression evidence for those six cases, not full mathematical qualification.

One remaining correction boundary was reported from source inspection: a visible regulation 4v4 pair that carries into regular-season OT is not removed from the service slots at the OT boundary. Rule 84.3/Table 15 example 1 removes those coincidental clock times as OT starts 3v3. With a P3 19:00 pair and two additional A minors at OT 00:10/00:20, the supported outcome is B PP 00:10–02:20; keeping the original slots queues the second new penalty until 01:00 and extends the clock to 03:00. No additional test or implementation edit was made for this boundary in this final scoped pass; Chef owns disposition.

## Final corrected-path disposition

This disposition supersedes the earlier stop recommendations for the old simulator and first pure-engine revisions. **No remaining concrete finding in the final paths reviewed below.** This is scoped code/regression review, not an independent repetition of Chef's complete official-source replay or a production release approval.

| Earlier issue | Current disposition and implementation |
| --- | --- |
| Penalty-shot goal ends a running minor | Closed: `penaltyClock.ts:178` skips penalty-shot release |
| Later same-offender unsportsmanlike minor runs concurrently | Closed: `penaltyClock.ts:210` appends to serving, waiting or held offender service |
| Arbitrary captain-choice cancellation | Closed for reviewed cases: `penaltyClock.ts:120` enumerates residual service; interior evidence and final-history checks reject unresolved exposure |
| Double-minor half compared as if it were the whole penalty clock | Closed: `penaltyClock.ts:169` sums the remaining halves sharing the assessment identity |
| Goal-release tie chosen lexically | Closed: `penaltyClock.ts:178` branches legal tied releases; unresolved/resolved regression cases passed |
| Table 13 example 22 omitted after cancellation | Closed: `penaltyClock.ts:120` includes its exact mandated differential and residual Rule 19.4 handling |
| Regular-OT initial coincident minors use regulation slots | Closed: assessment logic receives the regular-OT context; ingestion explicitly passes game type at `ingest/shifts.ts:714` and `:865` |
| Regulation 4v4 slots carried into regular-season OT | Closed: `penaltyClock.ts:279` moves personal coincident service off the manpower clock at OT start; it remains available for later serial service |
| Malformed terminal situation escapes qualification error handling | Closed during this review: `getPowerPlayBlocks.ts:466` now contains construction, audit and completeness validation in its error boundary; pure clock and completeness checks guard non-string situation codes |

Two small actual-code probes independently passed for held service: a carried pair plus the same offender's additional OT 00:10 minor produces B PP 01:00–03:00; adding another offender's minor at 00:20 produces B PP 00:20–03:00. Thus personal serial service continues off clock while independent new penalties can use available manpower slots.

A malformed terminal `situationCode: 1551` numeric probe now returns `seconds: null`, `qualified: false`, `audit: null` instead of throwing. The initial uncaught-audit concern was reported and corrected before this receipt. `git diff --check` passed for the pure engine, wrapper, existing utility tests and shift ingestion source. No application or test edits were made in this final pass; no web requests or additional rules inventory were performed.

The wrapper's algorithm flag is now true, with per-game qualification still requiring the complete-source predicate and zero audit disagreements (`getPowerPlayBlocks.ts:481`). Chef's final reported actual-route/production-HTML-parser offline replay matches all 190 official players' total/ES/PP/PK values (760 exact comparisons) after the ingestion lane repaired an OT-drop parser defect. The original JSON discrepancies remain recorded and uncapped; the tested candidate uses complete official HTML for the two affected games. That oracle and parser repair are outside this reviewer's independently executed evidence. Full end-to-end acceptance remains Chef's decision.
