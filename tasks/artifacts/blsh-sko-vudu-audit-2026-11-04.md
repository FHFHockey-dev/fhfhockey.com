# BLSH, sKO and VuDu audit and local improvements

4 November 2026 · `octoberBranch` · base `152ee53b766d656d21154aacfe53ff2491a1bccf`

## Scope and evidence

Read `/Users/tim/Downloads/BLSH-research.md`, whose header dates the research 4 November 2026. This is the supplied local file; its equivalence to Space file `libfile_14f341a4925481918e61b598c85a93c2` was not independently established. Its proposed formulas and provider claims are hypotheses, not implementation or performance evidence.

Inspected the repository instructions, existing baseline/opportunity/list handoffs, relevant calculation modules, saved snapshot reader, preview pages, player-card consumer, trade arithmetic and tests. Used the interface-writing and React review skills. Existing unrelated dirty files, untracked process-evidence work, frozen snapshot bytes, scoring coefficients and production settings were preserved. No delegation: the runtime did not expose the verifiable lead-model/effort information required by the repository's delegation hierarchy.

## Actual implementation and representative traces

### BLSH

`currentInput.ts` qualifies identities, exposure, counts and NST matches. `currentWindows.ts` converts qualified rows into game slots, keeps missing measurements null and builds disjoint current/reference windows. `productionReference.ts` computes FHFH Standard points (3G + 2A + PPP + .2SOG + .2HIT + .25BLK), G+A and WiGO Game Score. The production reference uses personal/cohort shrinkage; `supportGap.ts` adjusts that comparison using changes in individual xG/60 and shared on-ice xGF/60 and xGA/60. The index is a bounded transform of a normalized gap, not a probability. Positive is buy-low evidence; negative is sell-high evidence.

The local preview reads a size/hash-pinned **October 28** snapshot through `researchSnapshot.server.ts`; it does not run the newer assembler or mapper at request time. Its older arm-A reference is 2022–24 development history. The newer arm-C weighted baseline and mapper-v3 list rules already exist but have not replaced that saved snapshot. Both preview pages return 404 in production. Legacy sKO formula/chart paths are separately quarantined by `lib/predictions/legacyQuarantine.ts`; the old `/buyLowSellHigh` bookmark is a retained raw skater table, not the new scorer.

Read-only trace: Nikita Kucherov, NHL ID **8476453**, saved window October 15–24, five appearances, **6,120 seconds**. The personal reference has 50 appearances ending April 17, 2024, **911 days before the current window**. The estimator's personal weight is .840118, not confidence. Saved FHFH points are **22.85 observed**, **24.386135 historical comparison at current TOI**, **24.943053 support comparison**, gap **+2.093053**. G+A is 6 versus support 7.958946; Game Score 5.85 versus support 7.365684. The resulting index is **+43.400342**, saved BL rank 89. This reproduces a dated research candidate, not a current recommendation or validated bargain. Total TOI fell from 1,296.8 to 1,224 seconds per appearance: opportunity direction remains context rather than a hard gate.

The four support families already have partially distinct representations:

- Opportunity: total/ES/PP minutes and per-appearance comparisons; no verified team PP-share or durable-role claim.
- Activity: shots and scoring-category totals; no admitted tracked-passing feed.
- Quality/environment: individual and shared on-ice xG explicitly separated; no causal teammate attribution.
- Conversion/allocation: finishing, on-ice conversion and assist involvement are context, not independent extra score votes. No universal secondary-assist luck adjustment was added.

### sKO and VuDu

`ObservedEvidence` and canonical FORGE game expectations feed `interpretPlayer`; `fixtureRecords` supplies the local preview. FORGE forecast totals remain unchanged. The forecast gap uses matching per-scheduled-team-game units; confirmed absences count as zero, unknown participation does not. The personal comparison added here uses the same player's **immediately preceding disjoint block**, in matching per-team-game and per-appearance units. It is explicitly a short observed reference, not a career estimator or a new predictive model. Changing future horizon does not change that reference. Contract version is now `sko-interpretation-v0.2`.

Executable local goalie trace (`fixtureRecords(10)`, `fx-g1`, synthetic): current October 5–14 has 7 appearances in 10 team games, 210 saves / 221 shots, 11 GA / 420 minutes: **SV% .9502262443**, **GAA 1.5714285714**. Prior September 25–October 4 has 196/214 and 18 GA/420 minutes: **.9158878505**, **2.5714285714**. The separate FORGE fixture supplies expected ratios .9285714286 and 2.1212121212, and 6.6 expected starts. Observed starts and relief appearances remain **unknown** because the input has no participation classification. The VuDu gap remains `pending_goalie_adapter`; there is no real goalie sustainability model to validate or promote in this path.

## Reproduced defects and implemented fixes

| Location under `web/` | Reproduction / previous behavior | Implemented result |
|---|---|---|
| `lib/skoElement/interpret.ts` | Advance fixture as-of to `2026-10-19T13:00Z`: forecast marked expired but goalie ratios/starts and skater conditional values remained numeric. | These derived forecast displays abstain with `forecast_expired`; observed results remain available. |
| `lib/skoElement/interpret.ts` | 31 saves on 30 shots yielded an impossible SV%; inconsistent saves+GA or positive shots at zero minutes were accepted. | Inconsistent goalie primitives are unavailable. Ratio aggregation stays saves/shots and 60×GA/minutes; relief outings are weighted by actual exposure. |
| `lib/skoElement/interpret.ts` | A negative numeric measurement caused a dated game to disappear, backfilling the recent window with an older game. | Retain that known game as unknown; the missingness remains in the window and prevents a false numeric gap. |
| `lib/buyLowSellHigh/displayProfile.ts` | `personalN=0`, empty source IDs, `historyStatus=unknown` was described as no personal history. | Use explicit assembler coverage status; preserve compatibility with old saved profiles lacking the field. Unknown history and confirmed absence remain different. |
| `lib/player-cards/retainedBlsh.ts` | A mapper-withheld direction could still become a positive/negative card from `gapSign`. | Respect the withholding reason and display its explanation. |
| `lib/buyLowSellHigh/researchSnapshot.ts` | A saved buy/sell sign could disagree with the numeric score; a supplied direction-withheld reason could coexist with a list membership. | Reject those contradictions without repairing or rescoring immutable evidence. |
| `lib/buyLowSellHigh/market.ts` | A nonfinite expectation or freshness budget could produce a misleading comparable result. | Reject nonfinite/overflow gaps, invalid common horizons, empty scoring basis and invalid freshness limits. Measured zero remains numeric; absent price remains unavailable. |

Additional contract improvement: `lib/sko/gap.ts::vuduSaveGap` now requires the expected rate's shot population. Unblocked-attempt/Fenwick or unknown populations return null when compared with ordinary SV%. Repository call-site search found only tests using this standalone utility; no live adapter was changed.

UI changes in `components/skoElement/SkoElementPreview.tsx` and `components/buyLowSellHigh/BlshPlayerDetail.tsx` expose the personal comparison, window/exposure, goalie prior ratios and start/relief uncertainty. The BLSH detail leads with native FHFH-point amounts, explains what evidence could change the assessment, and states that price evidence is absent. No opportunity gate, list reorder, new model coefficient, forecast adjustment or probability was introduced.

## Baselines, provenance and claims left unpromoted

The pre-existing arm-C baseline excludes the evaluated window and later games, weights prior seasons and pre-window current-season history, reports missing seasons, and supplies matching per-game/per-60 comparisons. The existing `blsh-baseline-2026-11-04/REPORT.md` compares prior-season, last-50, last-82 and weighted baselines. Its results are **development evidence**, not revalidated predictive performance in this audit: the current-season weight was selected on development results, the full three-season shape was not tested, recent-season history remains reserved, and complete-case/participation selection needs scrutiny. Its unweighted explanation context is disclosed separately from the weighted baseline. No reserve dataset was read or new model adopted.

Existing provenance carries source IDs, game dates, strength scope, exposure, capture hashes/times and calculation versions. NST revision identity and original publication times can still be unknown; reconstructed dates are not authentic as-issued history. Existing tests distinguish revisions and mixed provider evidence from corroboration. This audit does not add a new external dataset or assert commercial rights for retained WGO/NST data. Provider definitions, model versions, retention and commercial permission must be established for any new production admission; public access is insufficient. No provider claims from the independent research were imported as verified facts.

Still unavailable or unvalidated: persistent deployment/PP-share models, opponent/linemate causal effects, calibrated uncertainty, talent-adjusted finishing improvements, quality-adjusted goalie support and environment, real starter-status feeds, actionable market-price evidence and attainable roster-package evaluation. Trade arithmetic reuses shared FORGE totals and league-scoring contracts; it is a raw production comparison, not a roster/replacement optimizer or evidence of counterparty acceptance. Ownership is not substituted for availability or price. No new keeper/salary assumptions were introduced.

Streak rules were not changed. No new predictive or trade-return claim was made. A later predictive promotion needs chronological as-issued data, purged overlapping labels, date-safe transformations, retained injured/demoted/low-participation cases, separate played-game/calendar outcomes, paired incumbent comparisons, subgroup coverage and calibration. Opportunity contribution and alert episodes need their own ablations; attainable-price claims need a separate evaluation. Synthetic tests establish arithmetic and contracts only.

## Verification

All commands below ran from `web/` unless stated otherwise.

- Initial focused baseline: **8 files, 171 passed, 1 skipped**.
- Integration/regression run: `npm test -- --run lib/skoElement lib/sko lib/buyLowSellHigh lib/player-cards/retainedBlsh.test.ts components/skoElement components/buyLowSellHigh components/blshTrade --exclude '**/currentProcessEvidence.server.test.ts'` — **19 files, 404 passed, 4 skipped**.
- After the final shot-population contract and established-finisher regression: `npm test -- --run lib/sko/gap.test.ts lib/buyLowSellHigh/supportGap.test.ts` — **2 files, 86 passed, 2 skipped**. These overlap the integration tests; do not add their totals. An initial invocation from the repository root failed for lack of a root package manifest and was corrected to `web/`.
- Targeted ESLint on every changed TS/TSX file — **passed**. Final diff whitespace check — **passed**.
- `npm run typecheck` — **blocked by pre-existing unfinished work**: Buffer/Uint8Array and BigInt target errors in `lib/buyLowSellHigh/currentProcessEvidence.server.ts` and `.test.ts`. The unrelated files were present at task start and remain untouched. The existing Buffer issue in the edited `retainedBlsh.test.ts` was corrected using the repository's `Uint8Array` pattern.
- UI verification: React Testing Library exercises class/window controls, details, personal-reference text, missing starter evidence, research disclosures and saved BLSH previews. **Passed**. No full-browser responsive or real-account check was performed.
- No full application suite or production build: the change adds no build-specific behavior; repository instructions require narrower verification. No opt-in snapshot packaging, historical evaluation rerun, scraping, database call, production request, push, publication or deployment occurred.

Regression coverage includes sign/abstention consistency, zero versus missing, pre-window contamination, unchanged established finishing above ordinary xG, existing promotion/demotion cases, thin history, provider revisions, goalie denominators/relief, improving results with falling start share, and absent/non-comparable market evidence.

## Final diff, browser and report re-verification

Completed the requested follow-up against unchanged HEAD `152ee53b766d656d21154aacfe53ff2491a1bccf` and the local diff. The implementation footprint is 17 TS/TSX files, 276 insertions / 47 deletions. No changes appear in `productionReference.ts`, `currentWindows.ts`, `opportunity.ts`, `supportGap.ts` or the frozen snapshot files. Unrelated shared-tree changes remain outside this review.

**Checks rerun:** the same 19-file affected suite now reports **407 passed / 4 skipped** (including the final three regressions); targeted ESLint on all 17 changed files and `git diff --check` pass. Whole-project `npm run typecheck` exits 2 with exactly **50 diagnostics, all in the two existing process-evidence files**: 17 in `currentProcessEvidence.server.ts`, 33 in its test. Both files still hash-match their November 2 `current-process-gate-install-20261102-01/INSTALL-RECEIPT.json`. They were neither edited nor attributed to the new diff. The retained-card Buffer fix is present and produces no type diagnostic.

**Owner coordination:** sent a bounded read-only ownership/status and compiler-fix-plan request to the identified installer chat, **Finish BLSH current-season scoring**, ID `01a17e93-6d23-77b3-bb91-c200b28f80fc` on the durable host. No collection, reserved-history use, acceptance-policy changes or code edits were requested. The historical install receipt establishes provenance; a fresh owner response is tracked separately below.

### Actual browser result

Used installed Chromium against the already-running canonical `http://localhost:3000` development server, with a new unauthenticated browser context. Only the two local preview pages and local static resources were allowed; external assets/telemetry and application API calls were blocked. The existing server was preserved and the test browser was closed.

- `/buy-low-sell-high/preview`: HTTP 200; **729 profiles, 264 BL, 184 SH, 281 withheld**. Browser props and the UI agree on event-through **2026-10-28**, capture **2026-10-29T18:41:12.798646+00:00**, arm **A_development_reference**, and a **stale 2022–24 development baseline**. The visible capture banner correctly says current recommendations are unavailable.
- Exact file: `web/lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json`, **9,559,567 bytes**, SHA-256 `2f380c2539390f6931ec92ab1d0b1d8cced2b55f5f4cefb8c6e88a694909f2c8`. The weighted arm C and newer mapper/list rules are not the source of the displayed snapshot.
- Kucherov's selector/detail interaction rendered 22.85 observed FHFH points, 24.39 historical-at-current-TOI, 24.94 support comparison and +2.09 gap. The new explanation and missing-price text are visible.
- `/sko-element/preview`: the personal prior-block detail opens; switching to VuDu works. The browser explicitly labels **synthetic fixture data**. VuDu displays 210/221 SV%, GAA 1.57, prior .916/GAA 2.57, unknown observed starts/relief, and a pending goalie adapter. None of this is a live goalie feed.
- Desktop 1440×1000 and mobile 390×844 were exercised. No JavaScript page errors; document width stayed 390px on mobile. The wide goalie table scrolls horizontally within its wrapper. Fonts/third-party support-button art were intentionally blocked, so those assets are not visually validated.
- **Remaining P3 presentation finding:** `web/components/skoElement/SkoElementPreview.tsx:132–133` concatenates the team and evidence date (`FX22026-10-05`) because consecutive inline spans have no separator. Add a separator or line break before the date. This verification turn reports the issue without expanding into implementation.

Browser evidence and screenshots: [results.json](blsh-verification-2026-11-04/results.json), [BLSH desktop](blsh-verification-2026-11-04/blsh-desktop.png), [BLSH mobile detail](blsh-verification-2026-11-04/blsh-detail-mobile.png), [VuDu desktop](blsh-verification-2026-11-04/vudu-desktop.png), [VuDu mobile](blsh-verification-2026-11-04/vudu-mobile.png).

### Attached research reconciliation

TJ clarified that the filename has **no `(1)`** and reattached `/Users/tim/Downloads/BLSH-research.md`. This is the same local source used for the audit. Re-read its bytes: **56,176 bytes**, SHA-256 **`3fc07987534310531375b49303f1a0679e8d96a163d9e3260334c79a973c22f8`**, unchanged from the earlier verification. Its heading dates it November 4 and explicitly disclaims dataset fitting, demonstrated performance gain and tested trade recommendations. There is no content mismatch with the newly supplied attachment. The older Space library ID was not separately authenticated; it is unnecessary to identify the file now explicitly supplied by TJ.

The implementation follows its accounting/explanation principles, not its experimental prescriptions. Personal prior output, current support and market evidence remain separate. The short sKO prior block is not a validated multi-season baseline. Existing shrinkage, thresholds and weighted-baseline hypotheses are not justified by this report, and were not changed. Goalie opportunity/performance separation is implemented as observed context; real-input admission and predictive calibration remain unfinished. No research appendix instruction was treated as authorization for data access or model promotion.

### Smallest concrete next integration step (proposal only)

**A local, receipt-backed two-player adapter check: one skater and one goalie, current-season evidence only.** First have the process-evidence owner resolve the two-file compiler compatibility problem without weakening microsecond chronology checks or changing the closed acceptance policy. Fix the small team/date separator alongside the next local UI change.

1. Freeze one explicitly reviewed **2026–27** input packet for each player, with at most ten completed team-game slots each (five current, five preceding), canonical NHL/game IDs, source bytes/hashes, event and actual capture/availability times, units/strength and missingness. Reuse already retained eligible receipts. If they are stale, show stale; do not replace capture time with packaging time. If no suitable fresh packet exists, request a separately bounded acquisition rather than issuing collection from the preview.
2. For the skater, reuse `currentInput.ts` and the owner's process-evidence gate to expose current production and support availability in a **separate dated evidence view**. Keep the current pinned score and its older baseline explicitly separate. The default NST acceptance policy is empty: missing native receipts/review must remain missing support and must not produce a fresh score. This step does not adopt arm C or rescore historical snapshots.
3. For the goalie, reuse `baselineSourceLineage.ts::baselineGoalieComponents`/receipt verification and `nativeGoalieOutcomes.ts::deriveNativeGoalieOutcomes`, then map those observed receipts into `ObservedTeamGame`. Preserve explicit start/relief evidence, finality and timestamps; unknown team participation remains unknown. Supply a real canonical FORGE response only when qualified, otherwise show unavailable forecast fields—never relabel fixture forecasts as real. Show ratio totals, personal prior block and job share; keep the VuDu sustainability gap pending.
4. Acceptance: one actual skater and goalie render with traceable receipts; wrong identity, future/stale receipt, missing process support, zero exposure, relief and unknown start cases abstain correctly; no new coefficient, probability, roster-value model, source write or deployment. Add an adapter regression in the nearest relevant test and run the two browser views locally.

**Reserve trap:** `captureCurrentGoalieBaselineInputs` in `web/lib/player-forecasts/goalieBaselineInputCapture.ts` queries `[seasonId - 10001, seasonId]`. Calling it unchanged for 2026–27 would read reserved **2025–26** data. The proposed small adapter consumes explicit current-season receipts and must not call that broad capture helper. All reserve data remained untouched during this verification.
