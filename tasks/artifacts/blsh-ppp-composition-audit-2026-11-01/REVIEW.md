# Independent review: PPP composition and assist/faceoff consistency

No substantive findings. The composition and the separate assist/faceoff packet support their stated, bounded evidence claims. This accepts the reviewed evidence-only composition behavior and descriptive comparisons; it does not accept the entire earlier sidecar, qualify an overall profile, adopt undocumented provider semantics, or authorize score/application admission.

Reviewed the actual producer code, tests, retained inputs/receipts, output objects and checkpoint claims in:

- `/Users/tim/Documents/Codex/2026-10-27/task-3/ppp-sidecar-composition-20261101-01/`
- `/Users/tim/Documents/Codex/2026-10-27/task-3/assist-credit-consistency-20261101-01/`

All 20 focused tests passed: eight composition, seven assist, five faceoff. Independent verification authenticated 241 files and rechecked their hashes after execution. The separate recount parsed all 30 retained native HTML game reports; it did not invoke producer `main()` functions or reuse their attribution/parsing helpers. See [VERIFICATION.json](VERIFICATION.json), [TESTS.log](TESTS.log), [RECOUNT.log](RECOUNT.log), [PINS.json](PINS.json), and [verify.py](verify.py).

The composition correctly adds evidence to 195 PPP fields among 3,461 selected records in 740 profiles. I independently reconstructed each output row, including the old unknown-field evidence, distinct event method, accepted review hash, exact source identity/value and chronology. Every other field and every untouched row matches the previous sidecar. The 200 proof decisions contain 195 composed and five held records; 207 unresolved rows outside the retained event scope also remain unchanged, leaving 212 unresolved PPP fields.

- Only 190 of those 195 rows become corroborated for all six FP operands and exposure. The five other-field differences survive: 5599445 shots; 5599701 hits; 5599705 hits; 5599717 blocked shots; 5599839 hits.
- FP corroborated rows increase from 2,950 to 3,140, and windows from 379 to 482 (+103). The denominator is 740 selected windows, including short windows. Of the 482 corroborated windows, 393 contain five records, 21 four, 24 three, 19 two and 25 one. The full population contains 644 five-record windows.
- All captured FP/raw-point totals and rates, captured Game Score values/nulls, exact selections, source discrepancies and raw-point evidence remain identical. All 20 zero-shot windows remain present. This is corroboration of selected operands and exposure, not newly computed fantasy value or a validated buy/sell signal.
- Held PPP source IDs remain 5598688 and 5599832 (exposure), and 5600780, 5600805, 5600831 (the retained whole-game credit-method hold). No hold is inferred resolved by a different passing comparison.

The original WGO capture remains `2026-11-01T19:57:38.026058+00:00`, with event cutoff October 31. PPP event evidence is later, available between `21:05:25.836191` and `21:06:35.870477` UTC; composition as-of is `22:11:15.332663` UTC. Every profile's capture age is recomputed from the original capture, not reset to composition time. Mixed evidence vintages and unknown original publication remain explicit. These observations cannot establish what a historical ingestion or as-of decision knew.

The authenticated entrypoint pins the accepted PPP review and its entire manifest, the prior sidecar receipt/code, captured request, context, and exact proof set before composition. The pure helper is explicitly not an authenticator. Tests cover immutable zero/nonzero values, other-field differences, held/out-of-scope rows, identity/value drift including booleans, exposure/future evidence, duplicate/outside proofs, repeated composition and file tampering. `compose.py:65` is the authenticated entrypoint; the evidence-only output version is not registered in the bounded BLSH app modules. `web/lib/buyLowSellHigh/currentInput.ts:132` still requires its separate verified-overlay contract.

The independent assist/faceoff recount confirms the exact 30 reconciled games from the accepted PPP event packet, October 27–31, season 20262027; the held 31st game was not silently included. All 1,080 skater-game records are unique and belong to the saved selected windows. Both team rosters were enumerated for every game. Event numbers are complete and unique, with final-game ledger markers. Regulation/OT counts include all observed strengths.

All 1,080 captured primary/secondary assist pairs match the first/second credited actors in native goal descriptions. Of these, 249 unequal pairs distinguish the ordering hypotheses; 831 equal pairs cannot. There are 269 nonzero-assist records; all 1,080 primary+secondary sums match captured total assists and official box assists. The independent parse reproduced 152 EV, 51 PP and two SH goals. The source writer at `web/pages/api/v1/db/update-wgo-skaters.ts:618` maps the two total fields separately from rates, as claimed; that current source does not establish the original ingestion payload/version. The checkpoint correctly calls the agreement observational, not normative definition proof.

All 1,719 faceoffs have one identified winner and loser, and total wins equal total losses. Win and loss operands each match 1,078 of 1,080 records; the same two records differ in both. The independent parse reproduced all 52 faceoffs in game 2026020199 and these values:

| Player / source ID | Captured W–L | Event W–L | Official box win fraction |
| --- | ---: | ---: | ---: |
| Christian Dvorak / 5599478 | 13–4 | 12–5 | 0.705882 |
| Pierre-Luc Dubois / 5599416 | 4–11 | 5–10 | 0.333333 |

Both event fractions round to the six-decimal official box fractions; neither captured fraction does. Seven head-to-head events are correctly retained as context (5, 20, 38, 112, 222, 239, 252), without claiming which event changed. Cause and prior provider revision remain unestablished. These are already disclosed source discrepancies, not new review defects, and neither packet repairs them.

Count agreement is correctly separate from exposure qualification: 1,074 exact exposures and six held rows (5598839, 5598688, 5599762, 5599858, 5599832, 5599965). All 324 zero-shot records remain represented; 406 records have nonzero faceoff participation. Missing/invalid operands are tested as unknown rather than zero; zero assists or faceoffs do not imply a missed appearance. The five PPP holds and separately pinned 163-copy/117-hold Game Score trial remain unchanged.

Remaining gates and limits:

- Full independent acceptance of the previous field sidecar remains separate. This review does not clear that gate by implication. Any consumer must preserve the authenticated input boundary, provenance distinctions, exact selections and all per-field/exposure holds.
- Native NST date/strength/unit/model/receipt qualification and the outstanding source-owner evidence remain prerequisites for current combined scoring. These packets add no NST qualification or retrospective predictive validation.
- Original assist-order definition and ingestion vintage are not proved by observed agreement or today's writer source. Original faceoff revision/cause is unknown. Current evidence does not authorize replacement counts.
- Combined scores, buy/sell labels, confidence probabilities and baseline comparisons remain null; full-profile/application/production admission remains false. All ten shared scorer/preview/snapshot pins, including canonical snapshot `2f380c2539390f6931ec92ab1d0b1d8cced2b55f5f4cefb8c6e88a694909f2c8`, matched before/after.

No source/app edits, source repairs, provider/production/database requests, holdout access, build, deployment or Git mutations. Only own audit artifacts and diary were written. Networking was denied in the verification process; the task-owned heavy-work lock was released. There is no execution blocker or pending approval for this completed review.
