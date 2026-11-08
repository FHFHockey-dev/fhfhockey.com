The candidate has **two high and nine medium findings**. SS-R18 remains open: the requested commit has reproducible correctness defects, and the freeze does not bind its verification claims to this candidate.

All code references below refer to **`a398781fd34721632206d3136129620be98b1fe3`**.

**Evidence and scope**

- Read the pinned implementation, tests, task list, contract, source assessment, requirement/card reviews, read receipt, and lane receipts.
- The PRD is **absent from the pinned commit**. I read its working-tree copy as unpinned context and applied the TJ decisions supplied in your request.
- All 11 freeze-manifest entries match the older `066d80608` pin. At `a398781fd`, the nine listed E2E files still match, but both source trees differ:

  | Tree | FREEZE.md | Requested candidate |
  |---|---|---|
  | `web/lib/socialShare` | `519942374080c108d987a8bfb8837428a81c1113` | `160b55cb544252baa103b75b7a749884b240ba9e` |
  | `web/components/SocialShare` | `af960c642dbb2fd4abe70923c9449e52ada90424` | `f2b83f4ad4b4fec05d0ee964024574ab48658bd5` |

- All **26 frozen PNG SHA-256 hashes matched**. I also viewed **all 34 PNGs** in `integration/real-gate2-20261101/`. That newer directory is untracked and lacks a binding to the requested SHA.
- Ran bounded, in-memory probes of pinned functions, including the failure scenarios identified below. No files, databases, or services were written; no server, build, or production request was run.

**Findings, ranked by severity**

1. **F1 — High: Partial shift feeds can delete valid PP rows.**  
   `web/pages/api/v1/db/update-power-play-combinations/[gameId].ts:151–170`

   The missing-shifts guard rejects only a wholly empty result. Once any player produces a row, the writer deletes every other stored player for that game.

   **Observed:** An in-memory probe used the actual pinned PP calculation, matrix utilities, metrics builder, and writer, with stubbed input and a database spy. Both teams had PP intervals, but shifts existed only for one team’s player. The writer returned success with `rowCount: 1`, `teamCount: 2`, then issued deletion of every player except that one.

   A temporarily incomplete feed therefore removes valid opposing-team data. `web/lib/socialShare/modules/roleWatch.ts:47–53` can subsequently interpret the absent player as off the PP. The writer tests at `web/__tests__/pages/api/v1/db/update-power-play-combinations-game.test.ts:218` cover wholly missing shifts, not partial team coverage.

2. **F2 — High: Reversing competition ranks gives incorrect head-to-head winners when values tie.**  
   `web/lib/socialShare/modules/shared/goalieInventory.sources.ts:287–296`

   Defensive strength uses `cohort - rank + 1`, but the original ranks are competition ranks. That reversal does not preserve tied best/worst positions.

   **Observed:** For GA values `[1, 1, 2, 3]`, the tied best defenses have high-first rank 3. The function converts this to strength rank 2 instead of tied strength rank 1. Against an offense ranked first, `headToHeadWinner` awards the offense a win instead of a tie.

   This affects both Start/Sit and Risky Starts, including bars and winner colours. The direction assignments themselves are correct: higher GA, SA, xGA, chances against and TSH are weaker; higher PK% is stronger. Tests at `goalieInventory.sources.test.ts:315–347` use ordinal ranks without exercising tied underlying cohorts.

3. **F3 — Medium: Export remains enabled after puck drop.**  
   `web/lib/socialShare/modules/startSit.ts:22–39`  
   `web/lib/socialShare/modules/riskyStarts.ts:58`  
   `web/lib/socialShare/modules/contract.ts:149–157`

   Upcoming-game filtering uses snapshot generation time. Neither module shortens the default 15-minute expiry to puck drop, and export does not recheck game time.

   **Observed:** A snapshot generated at 18:59 retained a 19:00 game and passed the export guard at 19:01, with expiry at 19:14. Pregame status, matchup advice and market lines can therefore export after the game starts.

   Panel picks are included in the settings/capture token; I found no equivalent stale-pick defect in that path.

4. **F4 — Medium: Standouts ranks unknown GSAx as worse than every known value.**  
   `web/lib/socialShare/modules/lastNightsStandouts.ts:222–224`  
   `web/components/SocialShare/modules/LastNightsStandoutsCard.tsx:45–52`

   Goalies qualify without GSAx, sort below known values, and receive numeric ranks under “Top … by GSAx.”

   **Observed:** A probe ranked a goalie with GSAx `−3` above one with unknown GSAx and counted both as qualified. With enough known rows to fill the card, omitted unknown rows receive no PNG warning because the warning counts only displayed rows. An entirely unknown cohort can instead be ordered by SV% while labelled as GSAx-ranked.

   `lastNightsStandouts.test.ts:324–338` explicitly expects missing GSAx to rank last; the E2E tests also accept export. Those tests preserve the defect. TJ’s GSAx ranking decision does not establish that unknown GSAx is low GSAx.

5. **F5 — Medium: Player coverage can report complete when an entire team is missing.**  
   `web/lib/socialShare/modules/whatChanged.ts:178–183`  
   `web/lib/socialShare/modules/lastNightsStandouts.ts:247–252`

   These checks establish player-row presence by **game ID**, while reporting coverage in **team games**. Role Watch also uses the What Changed coverage helper.

   **Observed:** Two completed team rows plus one player row from only one team produced `observed: 2`, `expected: 2`, `missing: 0`, and no reasons. Missing all players from the other team does not invalidate coverage.

   This admits incomplete Standouts cohorts and can omit appearances from What Changed/Role Watch windows without a coverage warning. BSH and the boards using its team/game coverage helper do not share this specific defect.

6. **F6 — Medium: One fresh Yahoo row makes stale Goalie Rescue candidates appear current.**  
   `web/lib/socialShare/modules/goalieRescue.sources.ts:35–36`  
   `web/lib/socialShare/modules/goalieRescue.ts:69–88`

   Freshness uses the newest timestamp across all Yahoo goalie rows. Individual candidate timestamps do not affect admission.

   **Observed:** A probe supplied a qualifying 1%-rostered goalie last updated October 1 and an unrelated, nonqualifying goalie updated November 1. The result was `ready`, with no reasons, and advertised Yahoo evidence through November 1 while listing the October 1 ownership value.

   That stale percentage can incorrectly qualify someone under the ownership ceiling.

7. **F7 — Medium: Goalie Rescue’s “GMS LEFT” includes completed games today.**  
   `web/lib/socialShare/modules/goalieRescue.sources.ts:14–19,28`  
   `web/lib/socialShare/modules/goalieRescue.ts:20`

   The schedule query begins at today’s date and selects neither start time nor game state. Every returned game is counted.

   **Concrete scenario:** Refresh on Sunday evening after a team’s final game. Its completed Sunday game still contributes one “GMS LEFT.” This is wrong even in a newly fetched snapshot; the label only distinguishes team games from goalie starts, not completed games from remaining ones.

8. **F8 — Medium: Stored odds do not enforce DraftKings precedence and can misattribute another book.**  
   `web/lib/socialShare/modules/riskyStarts.sources.ts:37–41,52,75`

   Stored selection takes the newest valid row from any provider. The evidence source is always labelled “DraftKings market lines (stored).”

   **Observed:** With an older DraftKings row and a newer FanDuel row, the pinned selector chose FanDuel. The table schema permits other nonblank providers; it is not constrained to DraftKings.

   The retained source sample contains DraftKings rows, so this is a reproduced selection defect, not evidence that those retained prices were wrong. Capture-time filtering before puck drop and the NHL partner fallback’s team/moneyline checks otherwise behaved consistently with the intended contract.

9. **F9 — Medium: The checked freeze and verification claims do not cover the requested candidate.**  
   `tasks/artifacts/social-share-expansion-2026-10-31/FREEZE.md:3–30`  
   `tasks/tasks-prd-social-share-expansion-2026-10-31.md:110–115`

   FREEZE names `066d80608` and says later changes are documents/evidence only. The requested candidate changes 17 scoped files, including Standouts, panel handling and the PP writer. Both source-tree hashes differ.

   The retained 79-pass/1-skip E2E result supports the older tree. The newer untracked render set does not establish exact-candidate browser acceptance. In addition, the Standouts E2E spec checks enabled export controls and layout but performs no PNG download; enabled controls do not prove captured-image parity.

   Checked items 13.2–13.6 cannot establish those properties for `a398781fd`. Item 13.7 is correctly still open.

10. **F10 — Medium: “Full evidence” beside the preview omits source failure states and reasons.**  
    `web/components/SocialShare/PostStudio.tsx:29–35`  
    `web/lib/socialShare/modules/busyQuiet.ts:145–162`

    `PostEvidence` renders source names and timestamps but drops each source’s `state` and `reasons`.

    **Concrete scenario:** An NST read fails while WGO coverage is complete. Busy/Quiet remains ready, prints dashes, and stores the explanation only in the NST source reason. The preview’s evidence panel omits that explanation and still lists NST as a source.

    This fails the promised full-evidence disclosure supporting TJ’s compact PNG footer. The problem is not the footer decision itself.

11. **F11 — Medium, existing and disclosed: Bulk PP repair has no enforced read or concurrency bounds.**  
    `web/pages/api/v1/db/update-power-play-combinations/index.ts:30–55,102–104`

    Arbitrary date ranges or ID lists reach queries without an explicit result ceiling/pagination, followed by `Promise.allSettled` over every returned game.

    **Concrete scenario:** An administrator requests a season-wide repair; all returned games start their fetch/write work concurrently. Complete enumeration also depends on the database’s response limits.

    The PP lane receipt acknowledges this and prescribes one calendar day per call, sequentially. That is an operational instruction, not a code-enforced bound. I did not invoke the endpoint.

**Verdict per requirement**

“Conforms on inspection” below means no defect found in the inspected calculation/source path. It is not a claim that the exact candidate passed browser or deployment verification.

| Requirement | Verdict | Evidence or remaining issue |
|---|---|---|
| **SS-R01** Preserve existing suite/access/export | **Exact-pin regression verification incomplete** | Access boundary remains present; retained regression results belong to the earlier freeze, F9. |
| **SS-R02** What Changed | **Defective** | Window calculations distinguish actual samples, but incomplete team/player coverage can pass, F5. |
| **SS-R03** BSH leaders/risers | **Conforms on inspection** | Strict component/GP admission, separate comparison windows, missing values unranked, team/game coverage. |
| **SS-R04** Category Blueprint → Multi Cat Monsters | **Conforms to TJ override** | Average percentiles, tie handling, 2× points weighting and P85 points floor implemented and disclosed. |
| **SS-R05** Role Watch | **Defective; stored-data gate remains** | Coverage defect F5 and unsafe PP repair F1. Nonoverlapping baseline and observed-role wording are otherwise consistent. |
| **SS-R06** Player comparison/sourced selection | **Partly blocked, correctly disclosed** | Comparison exists; no sourced Dahlin/Hughes candidate was fabricated. Source discovery remains open. |
| **SS-R07** Off-Night Edge | **Conforms on inspection** | Selected date ranges, ownership distinctions, schedule scoring and deadline-based expiry are represented. |
| **SS-R08** Nightly Floor/Cardio | **Conforms on inspection** | Strict thresholds, known-value denominators and per-game averages preserve missingness. “# GP” approval remains separately qualified in the receipt. |
| **SS-R09** Crease Shift | **Conforms on inspection** | Running starts divided by cumulative team games; relief separate; final running share matches window share. |
| **SS-R10** Goalie of the Period | **Conforms on inspection** | Category directions, pooled ratios, ties and unavailable cases are explicit. |
| **SS-R11** GSAx | **Conforms for admitted NST data; FHFH model blocked** | `xGA − GA`, signed rates and minutes/seconds handling are consistent. Unavailable FHFH model is disclosed. |
| **SS-R12** Busy/Quiet | **Disclosure defect** | Workload denominators and shots-versus-chances distinctions are sound; failed-source explanation disappears, F10. |
| **SS-R13** Goalie Rescue | **Defective** | Per-candidate freshness and remaining-game count, F6–F7. Category separation and pooled ratios are otherwise consistent. |
| **SS-R14** Risky Starts | **Defective** | Tied-rank winner calculation, puck-drop expiry and DraftKings precedence, F2–F3/F8. Market prices are not converted into FHFH probabilities. |
| **SS-R15** Ratio Impact | **Conforms to TJ override** | Pooled before/after arithmetic, hypothetical labelling, denominator safeguards and one what-if chart; tables remain off PNG. |
| **SS-R16** Start/Sit | **Defective; source gates remain** | F2–F3. Search and source-status separation exist; unavailable forecasts remain unavailable. |
| **SS-R17** Evidence/missingness | **Incomplete** | False completeness F5 and omitted source failure details F10. Standouts also ranks unknown GSAx, F4. |
| **SS-R18** Integrated acceptance/audit | **Open** | Findings need correction and bounded rechecks against a newly frozen exact candidate. |

The additional **Top Multi-Cat Stars** views implement the disclosed weekly ranking/table/radar distinctions on inspection.

**Last Nights Standouts** has the five requested views and two hand-built sidebars. Its baseline excludes the slate; the sidebar average applies per-stat floors and a ±200% cap; missing/zero baselines do not become percentage gains. Goalie colour directions treat lower GA/GAA and higher SV%/GSAx as better, with SA neutral. Those decisions are carried out, but F4–F5 prevent a clean verdict for the feature.

**Other checks and unresolved gates**

- **PP mechanics:** Six in-memory cases passed: a minor ending on a goal, a major continuing, double-minor segments ending separately, single-counted 5-on-3 time, overlapping 4-on-4 producing no PP time, and no-penalty games. This does not resolve F1. Retained four-game replay evidence is owner evidence, not a replay I performed.
- **Stored PP/consumers:** The receipt identifies 226 games needing repair. Correcting the writer does not repair existing combinations or downstream rolling/unit outputs. The legacy helper retained for `powerPlayTimeFrame.ts` is explicitly separate. No backfill or consumer rebuild was verified here.
- **Access/security:** I found no source-confirmed posts-route bypass or credential exposure. Authentication and database-role checks precede loading; server-only goalie observations use explicit columns and bounded reads. Browser bundles, deployed authorization and live RLS were not tested.
- **Read bounds/retries:** New post readers have explicit ceilings or bounded pagination. The shared skater reader retries SQLSTATE `57014` once, then fails; other errors are not retried. This is bounded retry behavior, not evidence that the underlying query is fixed. F11 is the separate bulk-writer exception.
- **Source blockers:** Reporter conflict detection remains limited by null `source_account`; qualified forecast/FHFH-model data remain unavailable; sourced comparison discovery remains blocked. Historical NST lag, 937 missing first-week rolling appearances and the two June-dated goalie rows are recorded handoffs, not issues I verified as resolved.
- **Verification limits:** I read the tests and retained logs but did not run Vitest, Playwright, lint or type-check in this read-only session. I inspected the newer PNGs successfully; I could not establish their exact source SHA or reproduce browser-to-PNG parity. No deployed behavior, current database contents, provider freshness, backfill completion or production performance was verified.

**Severity counts: Blocker 0 · High 2 · Medium 9 · Low 0.**


Codex session ID: 01a197f0-ac5e-7d43-8bef-00e6fcb106a9
Resume in Codex: codex resume 01a197f0-ac5e-7d43-8bef-00e6fcb106a9

---

## Lead's disposition (2026-11-01)

Saved from Codex job task-mvy1nmhp-12z7mu. I checked the cited code. F1 to F8, F10 and F11 are confirmed and ticketed. F9 is mostly an artifact of my audit brief: it told the auditor to read files at the pin, and FREEZE.md was committed after the pin, so the auditor saw the previous freeze. FREEZE.md at 423a70cf7 holds the right hashes (160b55cb, f2b83f4a) and the evidence directory is committed. F9's real parts stand: the PRD was untracked, now committed, and the Standouts spec downloaded no PNG, now ticketed. A focused recheck follows the fixes.
