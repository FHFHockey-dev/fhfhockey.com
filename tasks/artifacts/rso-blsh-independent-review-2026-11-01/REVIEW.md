# Independent resumed RSO and BLSH review — 2026-11-01

Outcome: no high-severity finding and no defect found in the bounded RSO diff. Two BLSH validation gaps reproduced below; neither changes the frozen numerical results. The retained BLSH results support retrospective mechanical comparisons, not predictive validation, half-life adoption, integrated-app acceptance or deployment.

## Findings

### P2 — Empty public proof list is labeled source-qualified

Location: `/Users/tim/Documents/Codex/2026-10-27/task-3/midseason-absence-cohort-20261101-01/cohort.py:58` and return at line 83.

`set(c['proof_ids']) <= set(proof_ids)` accepts an empty candidate list, including with an empty evidence registry. Using `CohortTests().fixture()`, changing candidate `proof_ids` to `[]` and calling `qualify_episode(candidate, games, facts, [])` returned:

```json
{"status":"retrospectively_source_qualified","preGapAppearancesObservedLowerBound":10,"preReplayAppearances":5,"postReplayAppearances":5,"confirmedMisses":3,"unknownOtherWindowGames":0}
```

Thus complete boxes plus bracketed endpoints alone can receive a qualified label and confirmed-miss count, contrary to the explicit-evidence contract. Existing `test_no_membership_from_endpoints` only checks a missing registry entry while the candidate still has proof IDs; it misses the empty-list case. Require nonempty evidence references before the subset test, preserve human verification of their episode-specific meaning, and add this negative case before reuse/integration.

Impact is contained: actual Connor/Kaprizov candidates have nonempty, relevant references. Empty membership proof would be rejected by the core at replay, and the replay retention assertion would fail; this is a qualification-stage false-positive, not demonstrated fabricated decay in completed output.

### P3 — Tanev metric team conflict is not rejected

Location: `/Users/tim/Documents/Codex/2026-10-27/task-3/absence-ledger-replay-20261101-01/ledger_replay.py:66` (and main endpoint checks at lines 126–132).

The row check binds player, season, date, game and calendar but never `team_abbrev`. `row = test_ledger_replay.stat(); row['team_abbrev'] = 'BOS'; event_from_row(test_ledger_replay.event(), row, KNOWN)` returns an appeared SEA event with observed value 0.0 instead of rejecting the conflicting source identity. The later official endpoint checks do not inspect this field either. The cohort adapter already includes the corresponding row-team guard at `cohort.py:131`.

Require the row team to match the qualified episode team and cover wrong/missing team cases. Both saved Tanev endpoints actually say SEA, and their game/player/count/TOI checks match official boxes, so the existing replay remains supported. This is a defensive identity-validation gap, not evidence that the current FP values belong to another player/team.

## RSO conclusions

- Inspected actual combined three-file diff, current implementation and downstream reconstruction. All three hashes match `participation-replay/EVIDENCE.json`; repository HEAD advanced from its historical evidence SHA, but candidate content did not drift.
- The native method-without-`@revision` case now denies use, while legacy exact-string method handling remains. Current native review catalog is still empty.
- Retained baseline participation checks its own issued revision and time window using only the existing participation/appearance/start suffixes. Aggregate rate revision/expiry cannot renew the participation. Current trusted reviews, scope/code/cutoff, downstream player/game/team/roster/schedule checks and manifest revision admission remain in force.
- The new resolve → JSON save/replay tests exercise skater and goalie baselines with native method-bound reviews, legal manual/Yahoo-shaped planning, wrong/missing/unknown suffixes, foreign player, future/expired participation and revoked reviews. These are offline fixtures, not a provider/UI acceptance flow.
- Exact ownership is recorded in `participation-replay/OWNERSHIP.json` and the November 1 coordination mailbox; the older Claude exact-file claim is released. No ownership conflict found in this slice.
- `rsoUsePolicy.ts` appears in the existing FORGE producer closure receipt. A separately selected committed release candidate still needs fresh exact closure verification/admission and release authorization; this audit did not produce or approve a release identity.

## BLSH evidence and interpretation

Both task folders' SOURCE-PINS and SHARED-SOURCE-PINS matched current files, including the frozen reference/scorer and saved current snapshot. The unchanged decay core remains pinned. Qualification precedes metric replay in retained contract/freeze records; the convenience player selection and lack of blinding are explicitly disclosed. Three named players were retained, two replayed, and Thompson stayed held for missing game 2023020348; no failed-case replacement is present. This does not establish representativeness or prove absence of prior human knowledge.

Independent local checks rehashed and interpreted 137 cohort boxes (1,827,391 bytes) plus 16 Tanev boxes (212,435 bytes), matched receipt transport/status, game/date/season/type/finality/calendar teams and unique lineup IDs, and reconciled the cohort's 141 scheduled game union including four missing cached boxes. The frozen qualification hash matched.

Recomputed the original final-50 row selection, FP means/sample SDs and all five policy traces independently from saved events, without calling the decay implementation. All 22 appearances matched released development rows and official overlapping counts/TOI; all 37 absences remained null-valued. Baselines retained exactly their original 150 rows. Confirmed the reported calendar links: Tanev 13/50, Connor 0/50, Kaprizov 4/50. The team-label gap above does not occur in these inputs.

The checked public reports support the reported spans: [Tanev's 14 missed games](https://www.nhl.com/kraken/news/final-buzzer-colorado-avalanche-vs-seattle-kraken-november-13); [Kaprizov's seven and Connor's 16](https://www.nhl.com/news/nhl-buzz-news-and-notes-january-13). The [Jets return preview](https://www.nhl.com/jets/news/gameday-islanders-at-jets) remains conditional; actual return is established by the retained final box, not the preview alone. Displayed article dates match the documented corrections. These are retrospective affiliation/absence proofs, not transaction-exact historical daily membership or historical knowledge timestamps.

Missing operands stay unavailable, observed zero remains a valid observation, and unproven omission is not numerically treated as absence by the core. PPP is independently checked only where zero assists makes official PP goals sufficient; other rows retain WGO PPP provenance. No current-window completeness label fixes the provisional baseline calendar gaps. Five pre-gap appearances are a limited initialization, and the injury-game exposure limitation remains material.

## Verification and boundaries

Newly run:
- 76/76 RSO tests across `rsoUsePolicy.test.ts` and `planningReproducibility.test.ts` passed.
- 12/12 Tanev adapter and 16/16 cohort tests passed.
- Two additional negative-case probes reproduced the findings above.
- Independent artifact/trace check passed; source/shared pins and scoped RSO diff whitespace check passed.

Supporting files here: `rso-tests.log`, `adapter-tests.log`, `cohort-tests.log`, `artifact-verification.json`, `verify_artifacts.py`. The existing 400-test/type/lint receipts were inspected/reused, not rerun or counted as new. Test runs used an atomically acquired shared heavy lock, released afterward. Arrow emitted nonfatal sandbox CPU-cache sysctl warnings during the local artifact check; it exited 0.

Source, scores and original research data were not modified. Only review artifacts and the required diary were added. No browser/UI test, dependency installation, production build, deployment, Git index/ref mutation, database/NST/provider API request or reserved-season read occurred. Public web usage was exactly three official article opens. 2024–25 remained excluded and 2025–26 holdout unopened.

Remaining prerequisites: repair the two local adapter guards before reuse; qualify the fixed historical baseline rows before empirical half-life comparison; predeclare a larger signed cohort/outcome protocol before any predictive claim; complete genuine RSO add/drop → refresh → Undo → save/reopen acceptance and exact committed producer closure/release gates separately. No denied/pending tool action or uncertain mutation. No broader correctness guarantee is implied.
