# Astra audit addendum: PR #434

**Verdict: accept the verified code fixes with findings. Do not certify the power ratings v4 rebuild or the version labels currently attached to older ratings.** This is a read-only audit of the release delta, not a production sign-off or a revision of the frozen #433 audit.

## Provenance and boundaries

- Base `4d9b6a10d2c8100bb5551e7034afaa4467a08fa7`; release `496ab37665f1098c496e4273645c897c0b9dbf4a`, whose sole parent is the base. 150 paths changed.
- Candidate `01ed7f7bc` and the release have identical tree `39b584b893893d22993e6f4a98f63725e7d63c46`. The raw `6873c28ce` tree is not identical: a 41-path delta includes diaries **and** the held implementation/test/migration files, not just diaries.
- For all four held commits (Codex items 1/2/6 and CTPI beta), all touched paths in #434 match the #433 base; their held changes were not shipped. No migration is in the release delta.
- Decisions 144–149 are in the pinned tree. Decision 150 and the #434 deployment/smoke record were added after the release. Read them only to establish the documented intent/reported status, not to expand the audited code range. The record reports a 16:01:05 UTC FHFH deployment, three expected cancels and five expected GET responses; this audit did not repeat hosted checks.
- Item 5 was authored by Astra and **needs another reviewer**. Only its drafted-prospects skip interaction is covered here. No repository, diary, shared mailbox or database writes; no production calls or rebuild. The requested handoff is provided in the report instead of writing to the mailbox.

## Findings and gates

| Priority | Finding | Evidence and next action |
|---|---|---|
| P1 | **Power reader calls pre-v4 goaltending “5v5.”** Code shipped before the rebuild, and even after a rebuild the 47 legacy carries are intentionally retained. | `web/lib/teamRatingsService.ts:15–33,51–93,112+` does not carry version or source date into the rating read model. `TeamPowerTerminal.tsx:174` and `TeamPowerCard.tsx:471–475` label numeric values “5v5 Goalie” without checking version, and `web/lib/underlying-stats/teamRatingNarrative.ts:266–271` makes the same assertion. Propagate version/source date, label v4 as 5-on-5 only when verified, and show v3/legacy as such or withhold the incompatible component. Test mixed v3, legacy carry, v4 and unknown rows. This is a source-confirmed reachable path, not a live screen observation. |
| P1 / rebuild gate | **Pinned rebuild runner can make its first write before proving the writer is v4 and can print DONE without exact carry validation.** | `production/power-g5v5-2026-11-13/power-g5v5-loop.py:147–164` skips backup creation if a file exists and exits preflight without checking deployed version; :173 calls the mutating route before checking response version at :179. :200–202 groups legacy rows; :225–229 logs sample mismatches then prints DONE. Before approving execution, bind the live route to v4 without a write, verify the backup and an exact 47-key value/version/source-date manifest, and fail closed on mismatches, including served readback. Newer F9 preflight work is outside this audit. |

## Lane verdicts

| Finding or lane | Verdict | Evidence and remaining boundary |
|---|---|---|
| AF-01 (P0), F12 | **Closed in #434 code and focused tests** | `forgeDailyBridge.ts` and `laterImpactInputs.ts` now consume the per-candidate FORGE contract. Distinct goalie lines remain distinct; an unlisted candidate is unknown instead of inheriting the game mixture; partial mass is not renormalized. This does not certify hosted roster output. |
| AF-02, F13 | Code fix supported | `opponentGoalieQuality.ts` rejects missing history inputs before conversion; unknown GA does not become zero. |
| AF-03/04, F14 | Code fixes supported; market unverified live | `goalieOutcomes.ts` uses shared 50/50 regulation-tie treatment; (4,2) fixture is ~0.71475431. `market-queries.ts` pairs complete fresh same-observation lines, removes vig per book, then takes the median. No independent coverage or dormancy claim. |
| AF-05, F7 | Code fix supported | Version-aware PK known/unknown admission, unknown propagates into three-head total, PP points remain PP-only; bridge carries the distinction. |
| AF-06, F13 | Neutral mitigation supported | Goal and assist factors remain 1.0; posterior remains labeled `neutral_unvalidated` context. Predictive approval still requires the held-out output study. |
| AF-07, F15 | **Partial, intentional** | Shared strength adapter excludes regulation penalty shots from strength buckets; deployed builder remains unchanged, preserving current all-situation sums. Keep builder switch, storage columns/RPC, reader sums and separately authorized eight-game rebuild together. |
| AF-08, F7 | Named consumers fixed; not global | Stored finality used by summary/queries/windows/helpers/backfills/`/db` in the reviewed changes. Nightly unit TOI and settlement exclusions remain distinct; no universal finality closure. |
| Game Grid, F6 | Supported | Withheld odds path stays “Odds n/a”; transposed matchup uses the actual away team. |
| Reserve, F6 | Supported in scoped code/tests | Zero-shot observed exposure contributes; scratched skaters carry explicit availability/absence information through stage wiring. Not a hosted issuance or admission readback. |
| Lines, F8 | Supported with limits | Source labels, unknown per-GP withholding, season-scoped latest unit snapshot, and 5v5 share on the 5v5 board. Raw-null skater TOI handling is a pre-existing residual, not a #434 regression. |
| Power v4, F9 | Writer calculation supported; reader and rebuild gates open | Genuine `gp = 1` rows only; same NST 5v5 GA/SA/xGA/exposure; incomplete goalie window stays unknown. Carry branch preserves source fields. See findings above. No rebuild readback. |
| SOS v2, F10 | Supported | Opponent points% across four surfaces; completed results, unknown remains null; landing preserves labelled 2:1 weighting, and Trends remains neutral. As-of snapshot is not historical pregame information. |
| PP clock, F11 | MAT/15 fixed; PP share stays withheld | One 300-second nonreleasable major. C1 (official-total qualification) and C2 (audit vs solver strictness) remain open. O1 tolerance, O2 placeholder references, O3 six clock refusals and O4 five scrum mismatches still need decisions or evidence. Retained agreement numbers were not reproduced. |
| CTPI, F5 | Descriptive study only; no prediction approval | Retained study fails the unrounded non-inferiority threshold; distinguishes current v1 from issued v1 (reported reproducibility Pearson 0.746). PDO ablation and planned 10/20/30/40 looks do not justify prediction approval. Raw study inputs unavailable for independent replay; beta card held. |
| sKO | Gate supported | Off by default, labeled 503; explicit true flag reopens. Claimed traffic and observed smoke are retained/reported, not independently queried. |
| Codex 3 | Supported | Known opponent PK shots added without treating unmodeled PK as zero. |
| Codex 7/8 | Scoped support | Dated Yahoo roster/team evidence, missing participation remains unknown, category direction paths inspected/tested. No provider access. |
| Codex 9 | Scoped support | BLSH input admission and signed gaps supported in source/tests; no live capture or pilot. |
| Item 5 / test updates | Independent review still required for item 5 | Drafted-prospects skip expectation aligns with explicit skip; Yahoo lineup test expects the player’s own team or null, not a made-up team. Neither expectation change substitutes for source or hosted verification. |
| Social skater rankings | Out of range, ticket remains | Missing-stat vs known-zero scoring was not changed by #434. |

## Verification

**670 focused tests passed across 35 suites** in isolated exports of the pinned release, using existing dependencies and offline guards. This was not a full build or full test rerun.

- **18 suites / 439 tests:** both RSO readers, goalie pipeline/outcomes, market pairing, modeled heads, strength adapter and builder behavior, Yahoo roster and category handling, and seven finality suites. No independent fail-first replay; the reported fail-first counts are Chef's.
- **5 suites / 83 tests:** power writer/calculation, SOS helper/API, and PP clock.
- **12 suites / 148 tests:** Game Grid, Lines, reserve, sKO gate, BLSH, and drafted-prospects skip interaction. The Git-custody assertion was verified separately against the pinned tree when the initial scratch export lacked Git history. The final suite used scratch-only harness support.

## Handoff for Claude (not posted)

**ASTRA-FIX-SPRINT-AUDIT-ADDENDUM-434-2026-11-13:** AF-01 passes code and focused tests in both RSO readers. No new P0 found in the audited delta. Keep v4 rebuild on hold for exact preflight evidence, including version-aware served display: #434 currently gives pre-v4 ratings the 5v5 label. The pinned runner checks its writer version after its first write and does not fail on per-key carry or sample differences. Obtain independent review of cron skip item 5. Keep PP share and the CTPI beta card withheld; track the penalty-shot adapter as only partial until the coordinated writer/storage/readers and separately approved rebuild land.
