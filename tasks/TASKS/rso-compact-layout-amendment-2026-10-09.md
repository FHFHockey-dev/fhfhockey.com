# RSO compact layout — design amendment

Date: October 9, 2026. Status: implemented and verified locally for the standard-slot fixtures. Sections 9–10 record the later authorized implementation and actual-border correction; sections 1 and 8 retain the original documentation handoff. Real-data access in the user's port-3000 worktree still requires private local configuration.

This amendment supplements the [audited RSO PRD](prd-rso.md), [existing task history](../tasks-prd-rso.md), and [local implementation evidence](rso-implementation-2026-10-08.md). Its [companion task list](../tasks-rso-compact-layout-2026-10-09.md) is a separate extension, not a replacement or reset of that history. The accepted layout and day-selection requirements below refine PRD requirement 23 and acceptance AC-08 while preserving requirements 1, 8–9, 13–14, and 17–20 and all release gates.

## 1. Original documentation scope and authority

The original RSO goal `01a11d48-c845-7454-90da-8784ecd1201b` is **hard-stopped and must remain stopped**. This document neither resumes it nor dispatches its owner. Release integration is independently active in `01a1195f-d79e-71f4-ab3d-723b8676d00e`; its files and worktree are outside this amendment's ownership.

At the original documentation handoff, this task owned only this file and `tasks/tasks-rso-compact-layout-2026-10-09.md`; no application changes were then authorized or performed. Later implementation required separate authorization and a clean base coordinated with the release owner, recorded in section 9. Push, remote build, deployment, live provider refresh, transaction, and desktop mouse/keyboard use remain outside this task.

At documentation delivery, the user requested later RSO work on **`octoberBranch`**, pending the integration owner's verified base. The parent reported review of `ec212566113385e1d183666c482f3c8cddda6ab5` before branch reconciliation; that candidate/worktree was not inspected by the documentation task. The two documents were then untracked in the preserved `master` checkout. Their later placement and the separate implementation authorization are recorded in section 9; these historical statements do not describe the current implementation status.

The supplied accepted decisions provide the needed product clarification. This follows the repository's [create-prd](rules/create-prd.mdc) and [generate-tasks](rules/generate-tasks.mdc) rules without repeating answered questions. The requested amendment filenames take precedence over their generic naming templates. The repository `.agents/skills` location is absent; the two applicable planning rule sheets were found at the linked paths and read. No workers were requested or created.

### Existing completion states retained

The existing task list contains **23 checked and 18 unchecked items**. Parent tasks 1–3 are checked; parents 4–9 remain open. Tasks 4.1–4.3, 5.1, and 6.1–6.6 retain their local completion; 4.4, 5.2–5.4, and the provider/forecast/freshness/release/weekly/commercial dependencies remain open. Neither old checkbox states nor source documents were edited.

Historical completion of task 6.4/AC-08 describes the prior interface. It does not verify this amendment's new player grid, twenty-row density, group bands, or day slider. New local acceptance is recorded separately in section 9. The settled **A — Wait for both** daily-beta decision, actual weekly qualification, and separate release authorization remain binding.

## 2. Overview, goals, and user stories

The manager should scan the roster, understand each player's weekly schedule, and inspect a selected day's legal local lineup within a compact desktop frame. The preferred second mockup supplies the intended three-column direction; written requirements remain authoritative where images or existing algorithms differ.

- As a manager, I can see Current Roster on the left, an individual-player schedule in the center, and Available Players on the right without moving between desktop workspaces.
- As a manager, I can change the selected day and see players in eligible fantasy slots, retained vacancies, and the reasons others remain on the bench or in reserves.
- As a manager using locks or saved choices, I can inspect a local lineup without a day-selection gesture changing my saved plan or provider roster.

Success means the acceptance matrix in section 7 passes at a later named candidate, including at least twenty visible compact rows at the declared desktop viewport, complete player accounting, and preserved mobile and authority behavior. This is a usability amendment; it promises no additional optimization or forecast accuracy.

## 3. Accepted requirements

**CL-01 — Desktop composition.** Use three columns in this order: **Current Roster / individual-player weekly schedule / Available Players**. The center receives the main reading width. Central schedule rows must represent individual players and configured slot vacancies, never NHL teams. Keep itinerary/actions, matchup, rules, and evidence accessible through existing disclosures/workspaces. Do not copy a second full seven-day schedule into Current Roster. Right-panel availability remains evidence-based, with partial/unknown/waiver states and exclusions preserved.

**CL-02 — Identity and schedule columns.** The center's first column shows assigned fantasy slot, surname, and NHL team logo; the following columns show Monday through Sunday with actual dates, then **GP**. Expose full name, team text, and separate multi-position eligibility accessibly; disambiguate shared surnames. A missing logo/team gets a truthful text fallback. Assigned `C#1` and eligibility `C/LW` are different fields. Color follows the assigned group, not the first eligibility label. GP must name its counting basis and must not imply legal fantasy starts, goalie confirmations, or credited results; the proposed basis is in section 5.

Current Roster uses compact identity/slot rows and may show selected-day status. An imported slot is displayed only if evidenced. A derived local slot must be labelled as local planning; an unknown current slot stays unknown. Do not infer a provider assignment from eligibility.

**CL-03 — Fixed slots and vacancies.** Maintain **C / LW / RW / D / UTIL / G / BN / IR / IR+** order, filtering out groups the league does not support. Preserve slot identities and numeric order within a group. Every configured starting slot gets a visible row, including **Open C**, **Open D**, etc., when genuinely vacant. A held slot occupied by a locked non-playing player is labelled held/no game, not open. Unknown/conflicting assignment is explicitly unresolved, not a fabricated vacancy. A player appears once in the center, even with dual eligibility. Left/right references to that player are not additional center assignments.

**CL-04 — Complete roster accounting and bench.** Account for every applicable roster player, including non-playing, unassigned, bench-locked, reserve, and unresolved players. BN is collapsible with a count chip reflecting actual players in that group, not bench capacity or scheduled games. Collapse changes visibility only; it preserves identities, selected player, lineup calculations, and focus. Reserve groups appear only when supported, with verified eligibility and truthful conflicts. Do not hide an unresolved player solely to make the rows fit. Keep no-game, capacity conflict, lock, missing eligibility, and unresolved evaluation distinguishable. Additional existing slot types require the dependency treatment in section 6.

**CL-05 — Compact density.** Target **at least twenty fully visible compact player/slot rows** in the center at a stated desktop viewport **including site navigation**, setup/summary controls, day selection, table headings, and group spacing. Count real occupied rows and visible configured starting vacancies; exclude group headers, count chips, collapsed rows, and partial bottom rows. A nineteen-player fixture must not fabricate a twentieth player. Bound dynamic row height for readability; once the lower bound is reached, scroll internally instead of shrinking text/controls indefinitely. Twenty-five-player rosters remain fully accessible through internal scrolling. Disclosure expansion may require scrolling; it must not clip content or make controls unreachable.

**CL-06 — Selected-day local planning lineup.** The slider and clickable date headings select one day in the displayed Monday–Sunday week. They reveal the existing selected plan's eligible assignments for that day, using the current effective roster, locks, verified rules, and protected/manager choices. Preserve fixed slot order and vacancies. Only the roster already in scope, plus explicitly planned moves at their verified effective times, may enter the lineup; candidate discovery is not an acquisition. Clearly label future planned additions/drops and their timing where they affect player membership.

Day selection is local view state. It must not silently alter `workspace.intent`, roster, protections, locks, undo history, a stored local/account plan, or the chosen objective; must not append a plan step; and must not trigger Yahoo lineup transactions, provider synchronization, or account-save requests. Preserve existing explicit edit/save flows separately. A stale or pending evaluation is labelled pending/unverified rather than displayed as a current legal lineup. Reuse existing context/result identity and cancellation safeguards.

Do not infer that all players with games can start, or that a protected player is automatically a starter. Respect explicit active/bench locks and manager choice semantics. Provider authority wins conflicting assignments; retained manager intent and the conflict remain visible. If the existing evaluator cannot meet this presentation contract, document and test the specific mismatch before a focused repair; do not create a second optimizer or promise the best possible lineup.

**CL-07 — Dates and input access.** Snap the slider to Monday–Sunday, with a labelled selected date and keyboard operation. Make date headings real interactive controls with keyboard focus and activation; both controls share one selected-day state. Highlight the selected column; preceding days are muted but readable and remain inspectable. On initial entry or week change, default to **today in the league time zone when inside the selected week**, otherwise **Monday for a future full week**. Preserve an explicit selection while navigating mobile workspaces within the same valid context. Do not use the Mac/browser time zone as league authority. Past/partial-week defaults remain proposed in section 5.

Week navigation is a view over the retained planning horizon. Do not truncate custom or multiweek dates or recompute a weekly plan as seven unrelated daily plans. Outside-horizon dates must not become actionable opportunities.

**CL-08 — Honest game/starter states.** Distinguish **has a scheduled game**, **assigned to a fantasy starting slot in this local plan**, and **confirmed NHL goalie starter**. They can coexist independently. A scheduled or fantasy-assigned goalie with unknown starter evidence stays **Starter unknown**; projected probability is not confirmation. Non-playing or postponed/cancelled status and unknown schedule/eligibility stay explicit. Missing evidence never becomes “no game,” a verified zero, eligibility, availability, or a confirmed appearance. Credited goalie-minimum progress retains its existing separate basis.

**CL-09 — Flat positional group borders.** Each positional group is one separate container with **one continuous, flat, actual CSS `border-left`** shared by all its rows. The colored left edge is straight for the full group height, with square upper/lower endpoints: no curved hooks or tapered “toenail” ends. The latest explicit user correction gives this flat edge priority over the earlier rounded-left-corner direction. Keep rounding on the right corners to retain coherent grouped containers. Pseudo-elements and absolute overlays are rejected, even if their appearance is similar; native `border-left` with curved left corners is also rejected. Do not apply individual rounded row strokes, gaps between row bands, or a gradient. Keep row content inset from the border without clipping names, logos, focus outlines, sticky identity/date headings, menus, or expanded details. Summary `<article>` accents must also use true, flat left borders; retaining article semantics is appropriate. Retain visible separators and textual slot labels so color is not the sole grouping cue.

Use the **SuggestedPicks / Draft Dashboard position map** as the accepted color guide. The user explicitly resolved precedence on October 9 at **16:40 UTC**: “I agree with the Suggested Picks being the guide”. Exact mappings and proposed treatment where the source lacks a direct slot mapping are recorded below.

**CL-10 — Weekly and mobile safety.** Selecting a day in a weekly-lock window only inspects that window's retained lineup. It cannot unlock, reshuffle, or infer new daily assignments; unknown windows/locks remain unsupported or unresolved. Preserve provider/manager provenance and acquisition-reset independence. Mobile retains **Itinerary as the default**, with Roster, Candidates, Matchup, and optional seven-day comparison; do not force three desktop columns onto a narrow screen. Preserve selected day/player and manager intent between workspaces, sensible scrolling, readable text at zoom, visible keyboard focus, and no document-level horizontal overflow.

## 4. Position-color source inspection

`SuggestedPicks.tsx:834` sets `data-position` from the display position. `DraftDashboard.module.scss:5` applies `vars.scss`'s `draft-position-colors` mixin; SuggestedPicks styles consume `--position-color`. Start Chart separately defines `.pos*` accents at `start-chart.module.scss:477–495`. Both source sets were inspected; values below are copied from existing tokens, not newly invented colors.

| Group | Draft Dashboard token / value | Start Chart token / value | Finding |
| --- | --- | --- | --- |
| C | `$info-color` / `#3b82f6` | `$info-color` / `#3b82f6` | Consistent |
| LW | `$color-orange-400` / `#FF9F43` | `$color-orange` / `#ff9f40` | Different |
| RW | `$color-violet-400` / `#A78BFA` | `$color-purple` / `#9b59b6` | Different |
| D | `$color-brand-primary` / `#07AAE2` | `$color-teal` / `#4bc0c0` | Different |
| G | `$color-teal-500` / `#00C896` | `$success-color` / `#00ff99` | Different |
| UTIL | `$color-gold-400` / `#FFC857` | No positional group | No common mapping |
| BN | Draft `BENCH`: `$color-neutral-400` / `#A7B4C0` | No positional group | Label normalization needed |
| IR / IR+ | No positional mapping | No positional group | Reserve treatment undecided |

**Accepted palette decision:** SuggestedPicks / Draft Dashboard is the guide, as explicitly selected by the user at 16:40 UTC. Reuse its existing map/mixin locally with RSO's assigned-slot labels rather than copy literal hex values or change global tokens. Its C/LW/RW/D/G/UTIL mappings are settled; C is also identical in Start Chart. **Proposed handling where direct slot mappings are absent:** normalize BN to the existing BENCH neutral token and use an existing neutral treatment for IR/IR+ rather than invent new hues. These fallback details remain proposed, not newly accepted positional colors. Leave SuggestedPicks, Start Chart, and global palettes unchanged; no palette-precedence question remains.

Start Chart has a container-level left pseudo-element at `start-chart.module.scss:1330` and uses `overflow: hidden`. This remains a read-only source observation. The latest explicit correction requires an actual CSS border in RSO; copying that pseudo-element treatment is not accepted.

## 5. Proposed measurements and defaults — not accepted decisions

| Item | Suggested starting point / limit |
| --- | --- |
| Desktop density viewport | **1440×900 CSS px at 100% zoom**, including navigation, normal compact state, bench expanded, setup/details collapsed. Declare this viewport in the later receipt; also check 1920×1080. Twenty visible rows is accepted; this exact measurement setup is proposed. |
| Row bounds | Start with **28–34 CSS px**, about **13 px text / 18 px line height**, and compact group gaps. Fit based on actual remaining height after all chrome and group spacing; never clamp below readable content or overlapping hit areas. These pixel values require visual/keyboard QA, not blind adoption. |
| Short desktop | **1440×720**: retain readable row floor and internal scrolling; twenty visible rows is not promised at this shorter height. |
| Mobile / reflow fixtures | Retain historical **390×844**, **320×844**, and **720×450** zoom-equivalent reflow checks. Viewport simulation is not a claim of actual browser zoom. |
| GP basis | Count known scheduled player/team opportunities in the displayed week, including known completed games, excluding cancelled/postponed games; label “Scheduled games this week.” Unknown/partial coverage must disclose incompleteness. Actual played games, legal starts, and confirmed goalie starts are separate measures. Confirm this label/basis before numeric acceptance. |
| Past / partial weeks | Recommend Monday for a past full week; for a partial custom week, the first included date, with outside-horizon headings clearly disabled/nonactionable. The accepted today/future-Monday rule applies to full weeks. Confirm boundary behavior before implementation. |
| Bench initial state | Recommend expanded on first desktop entry so density is measured honestly; remember collapse only within the valid view context. Default/persistence is not yet accepted. |

These are reversible implementation defaults, not mandatory user approvals. The later owner should tune row height, font size, gaps, and the measurement setup to satisfy readability and the twenty-row target, record the actual values, and proceed without asking for arbitrary pixel choices. Use the stated GP/date/bench defaults unless repository evidence or user direction requires a materially different behavior. Palette precedence is resolved in favor of SuggestedPicks. Neutral BN/reserve fallback details remain proposed implementation defaults. Additional F/W/NA presentation requires a scoped decision only if those profiles are included in the implementation cohort; it does not block the specified standard-slot layout.

## 6. Inspected algorithm dependencies and unresolved decisions

These are observations of the original inspected source revisions in section 8, before the implementation. Section 9 records the resulting display safeguards and runtime evidence; inherited engine/profile dependencies remain qualified there.

| Dependency | Observed source and required later action |
| --- | --- |
| Current slot identity | `planningTypes.ts` represents a roster entry as active/bench/IR/IR+/NA; it does not store an exact imported active slot. `PlanningAssignment` supplies a dated local `slotId` plus `gameId`. Audit available lock/provider evidence, then label local versus imported assignment honestly. Do not assign a provider slot by first eligibility. |
| Whole roster versus game assignments | `planning.ts` evaluates scheduled/live actionable games and emits game assignments, not every roster/slot row. Derive a complete display from roster, effective plan membership, configured slots, assignments, locks, bench/reserve state, and diagnostics. Account for no-game/past-only/unmatched players. Do not count this display as newly optimized assignments. |
| Non-playing locked slot | Daily `assign` requires a matching play unless its explicit no-game-lock path is used; invalid locks produce limitations. Weekly evaluation retains explicit slot owners separately. Prove that the display preserves held/non-playing slots; any daily computation mismatch is a targeted engine dependency, not permission to call the slot open or move someone into it. |
| Protection versus lineup locks | `protectedPlayerIds` blocks drops in `planningTimeline.ts` and drop candidates in `planning.ts`; it does not encode an active-slot lock. Preserve drop protection and existing explicit active/bench locks separately. No new implicit “protected starters” policy. |
| Presentation order / additional slots | `eligibility.ts` supports F/W between RW and D; `slots.ts` recognizes reserve aliases beyond the requested list, while the timeline has IR/IR+/NA-specific checks. Exact F/W/NA ordering and alias support in the compact interface remain unresolved. Never silently omit players, collapse F/W into C/UTIL, or claim alias legality. Qualify accepted standard profiles first; keep other supported data in labelled accounting/review until a scoped decision is recorded. |
| Day-selection integration | The current component defaults focused date to the first horizon date, starts with the streaming view, and displays center roster rows in source order without GP/slot vacancies. Reuse the existing result and worker guards while adding view state and a complete display; do not turn day selection into `edit`/`editIntent`. |
| Objective / incomplete evidence | The existing evaluator can choose projected outcome or maximum schedule capacity and can return incomplete search/quality evidence. Preserve the chosen objective and bench reasons; no automatic “Playing Today First” mode or guarantee that every game fills a slot. |
| Palette / visual reference | Use the accepted SuggestedPicks map and retain proposed neutral BN/reserve fallback handling. The parent has inspected both reference images and supplies external reviewed evidence below; this agent's local materialization failure does not block the documents. No RSO implementation screenshot or pixel-sampled color is claimed. |

**Playing Today First is unnecessary for this amendment.** It may be considered later only as an independently requested option; it must not change the accepted fixed slot order now.

## 7. Concise acceptance matrix for later implementation

These cases were unrun at specification delivery. Section 9 records their later scoped local evidence and limitations. Use synthetic fixture data without live provider refreshes or writes. UI cases extend old AC-08; assignment and continuity cases also preserve AC-02/03/05/06/10/11.

| ID | Fixture / action | Observable pass condition | Dependency |
| --- | --- | --- | --- |
| CL-A1 | 20-player roster, declared desktop viewport including navigation | Correct three-column order; center individual players, slot/surname/logo + Mon–Sun dates + GP; at least 20 fully visible meaningful compact rows; left has no second full schedule | CL-01/02/05; agreed measurements |
| CL-A2 | 19 players and one genuinely vacant D starting slot | Every player accounted for; the missing configured D row stays clearly Open; no invented player or eligibility; groups remain fixed | CL-03/04; complete display |
| CL-A3 | 25 players, bench/reserves occupied; short desktop | No player loss, duplication, overlap, unreadable shrinking, or clipped controls; internal scroll reaches final rows; no false twenty-row promise at short height | CL-04/05; row bounds |
| CL-A4 | C/LW dual eligibility, crowded UTIL, locks/manager protection, unknown eligibility | One center row per player; legal assigned slot distinct from eligibility; retained lock/protection semantics and truthful unresolved/capacity reasons | CL-03/06; engine dependencies |
| CL-A5 | Collapse/expand BN with six/nine actual bench players | Correct count chip and accessible expanded state; hidden rows not counted as visible; calculations/intent unchanged; focus remains reachable | CL-04/05 |
| CL-A6 | Slider and date headings; current/future week; rapid changes | Mon–Sun snapping, keyboard operation, selected-column agreement, readable muted preceding dates, today/future-Monday defaults; stale results cannot overwrite context | CL-06/07; agreed boundaries |
| CL-A7 | Day change → workspace switch → reopen; fictional manual/connected saved plan | Day change produces no edit/save/refresh/transaction request or silent stored-plan change; manager locks/protections/steps remain intact; explicit save/undo still works under existing rules | CL-06/10; continuity |
| CL-A8 | Scheduled goalie, fantasy-assigned goalie, confirmed goalie, unknown/conflicting starter evidence | Independent labels; unknown stays unknown; GP/assigned starts never become confirmed starts or credited minimum | CL-08; existing evidence permissions |
| CL-A9 | IR-only, IR+-only, neither, and NA/F/W or reserve-alias profile | Only league-supported standard groups; verified reserve capacity/eligibility respected; unsupported/undecided variants accounted for and labelled, never silently normalized | CL-03/04; slot decision |
| CL-A10 | Daily no-game active lock; weekly midpoint and bench locks | Held slot stays held; conflicts remain visible; weekly slider inspection cannot reshuffle the fixed window or infer it from acquisition resets | CL-06/10; targeted lock proof |
| CL-A11 | Multirow RW and other groups; summary articles; scroll/focus/expanded details | Exactly one continuous actual left border per group with square left endpoints and rounding only on the right; no curved/tapered hooks, pseudo-element/overlay or row strokes, no content/focus/sticky clipping; articles retain semantics and flat true borders; accepted SuggestedPicks tokens with labelled proposed neutral fallbacks | CL-09; accepted palette |
| CL-A12 | 320/390 mobile, zoom/reflow, keyboard-only navigation | Itinerary default and existing workspaces retained; selected context survives switching; accessible headings/slider/bench control, readable text, visible focus, no page horizontal overflow | CL-07/10 |

Fixture starting profiles, **proposed test data rather than new product rules**: 20 players use C:2/LW:2/RW:2/D:4/UTIL:2/G:2/BN:6 with supported IR:1/IR+:1 capacity; 19-player variant removes the fourth D and gives bench players no D eligibility. The 25-player profile uses the same 14 starting slots, BN:9, IR:1, IR+:1 with 14 active, 9 bench, and 2 verified reserve occupants. Vary scheduled/no-game days and use explicit locks when the fixture requires a particular retained vacancy/assignment. Do not use an invalid capacity fixture to claim a layout pass.

## 8. Source receipt and limitations

Repository inspected: `/Users/tim/Code/fhfhockey.com`, `master` at **`9b11d3607b5afe2d7c6dff6d6dd918c1bcff92c4`**, with pre-existing `web/next-env.d.ts` and unrelated untracked changes preserved. The three source documents were read in full from their working copies; they are untracked in this checkout. The stopped worktree `/tmp/fhf-rso-task-execution-20261008` was inspected read-only at **`72b9fa7618a4c89019dec2a0f931eb381cae13b7`**; its `web/` diff against application candidate **`2630a3377722ea08186b6a662e70ce17aed057f8`** is empty. No active release worktree was accessed.

Inspected code: RSO component and scoped SCSS, `planning.ts`, `planningTypes.ts`, `planningTimeline.ts`, `slots.ts`, `eligibility.ts`, and existing component test references in that stopped candidate; color sources `SuggestedPicks.tsx`, `SuggestedPicks.module.scss`, `DraftDashboard.module.scss`, `start-chart.module.scss`, and `styles/vars.scss` in the documentation checkout. The compared SuggestedPicks/Start Chart/token files match the stopped candidate. Root and stopped-worktree AGENTS instructions match; no applicable nested AGENTS file was found in the touched document paths.

The current [Library skill](skill://plugin_connector_1p_1b8ff8edfc1481918b252c8277e23125/library/SKILL.md) and its resolved-reference materialization instructions were read. Both known references resolved to version 0 and authenticated transfers; consumer-local preparation and the current helper were used. Each initial transfer and one bounded retry failed with `library file transfer failed: download failed`; both final local files are absent. This agent did not inspect image pixels and did not guess a storage URL:

- Preferred mockup: `libfile_1774293f6cb08191b9362e6e9ea3fad3`, **Neon Fantasy Hockey Roster Optimizer.png**; intended local destination `/tmp/fhf-rso-compact-layout-20261009/references/Neon Fantasy Hockey Roster Optimizer.png`.
- Band reference: `libfile_3c36155f262c819198c2d6a7826b7f88`, **Screenshot 2026-10-09 at 12.21.41 PM.png**; intended local destination `/tmp/fhf-rso-compact-layout-20261009/references/Screenshot 2026-10-09 at 12.21.41 PM.png` (Library filename contains a narrow no-break space before PM).

**External reviewed image evidence:** parent thread `01a10d0c-2480-73ea-aa65-3be0547bd0d5` reports successfully inspecting both actual images in its own workspace. Its pixel review confirms that the preferred mockup contains an NHL-team grid and reversed flank panels; those image details must be corrected to the accepted individual-player center, Current Roster left, and Available Players right. The band reference shows a purple RW band spanning the entire shared group inside a rounded outline with a flat inner edge. This is attributed parent pixel review, distinct from this agent's unsuccessful local materialization; readable local pixels in this executor are not a documentation blocker. No specific purple was sampled and no implemented visual match is claimed. Later candidate screenshots must still be inspected against the accepted layout and geometry.

Application/provider/browser tests were not run for this documentation-only amendment. Existing test/performance receipts remain attributed to their recorded revisions.

Original documentation checks passed: local Markdown links, fences, whitespace and IDs were consistent; proposed tasks were open; source documents and the pre-existing `web/next-env.d.ts` change remained byte-identical. Only the two owned documents were added in `master`. This is the historical documentation receipt; later execution follows below.

## 9. Authorized local implementation and acceptance receipt

Later user authorization, forwarded by the parent, allowed implementation on the release owner's verified clean handoff. Base: **`057390bd8024794e1534b4efed03a84527723091`**; application commit: **`9b0fee693799586aa3d57b0070077aa7f22e0b0e`** on **`octoberBranch`**, in `/tmp/fhf-october-reconciliation-20261009`. The original `master` checkout and hard-stopped goal were preserved. One owner changed five application/test files; these two documents record completion. No workers, live provider reads/writes, push, remote build or deployment were used.

The new `CompactSchedule.tsx` displays the current evaluation with complete roster/slot accounting, local day selection and shared group bands. The existing component/scoped SCSS provide the compact desktop default, retained mobile workspaces, accessible disclosures and read-only edit area. Existing component tests and the RSO E2E spec were extended. No planner, provider, storage, forecast-admission, global-palette, manifest or lockfile changes were required.

Actual reversible defaults: **1440×900 CSS px**, including navigation, with setup/advanced details collapsed and bench expanded; **26–32 px desktop rows**, **12 px table text**, **18 px logos**, **4 px bands**, **7 px group radius**, **44 px mobile rows/controls**. These supersede the suggested starting measurements for this candidate only. GP counts known non-cancelled/non-postponed schedule opportunities inside the displayed week and retained horizon, including known completed games; partial/unknown evidence is labelled. Current/future weeks use league-local today/Monday; partial weeks use the first included date. Bench visibility resets on context replacement and survives workspace switches.

Past assignment data is not reconstructed by the existing forward evaluator: show **Past lineup unverified**, Pending/Review rows and retained explicit locks, rather than fabricate historical vacancies or starters. Unassigned active players stay in Review, not an invented BN placement. Known held locks precede conflicting engine output; conflicts suppress dependent fantasy-assigned labels. Missing weekly windows, eligibility, reserve support/capacity and goalie evidence stay unresolved. Planned additions carry the timeline's effective time; planned drops remain accounted for with a timing-review pointer to Plan details. These are display safeguards, not a claim that all inherited engine/provider profiles are qualified.

### Acceptance at the application commit

| Cases | Local evidence / limit |
| --- | --- |
| CL-A1–A3 | 19/20/25-player browser fixtures account for every player once; genuine D vacancy retained. **20 complete rows measured at 1440×900**. The 25-player and 1440×720 cases reach final reserve rows through internal scrolling. |
| CL-A4–A5 | Component fixtures cover dual eligibility, lock conflicts, unknown eligibility, held/no-game slots, reserve capacity and complete accounting. Browser bench count/collapse and retained keyboard focus pass. Existing objective/protection/provider regressions pass. |
| CL-A6 | Slider, keyboard date headings, selected state, future Monday, league-local today across UTC midnight, week navigation and disabled partial-week dates pass. The full horizon is retained. |
| CL-A7 | Manual selected-day/bench gestures preserve stored workspace bytes and issue no mutation requests. Existing fictional connected save, refresh, undo, account-switch and reload regressions pass separately; no live connected-account qualification is claimed. |
| CL-A8 | Browser unknown/conflicting goalie coverage and unit confirmed/projected full-team evidence pass. Game presence, fantasy assignment and confirmed start remain independent. |
| CL-A9–A10 | Standard IR/IR+ fixtures pass; unsupported reserve and capacity conflicts are covered in component fixtures. Existing weekly midpoint/bench-lock browser regressions and compact held/window tests pass. F/W/NA/alias profile ordering and actual provider weekly qualification remain outside this accepted cohort. |
| CL-A11–A12 | Computed styles and actual desktop/mobile/focus screenshots were inspected. RW uses the accepted violet token; each group has one full flat band. Keyboard focus is visible; mobile 320/390 and 720×450 reflow retain workspaces/day state without page overflow. This is fixture/reflow acceptance, not a device or real browser-zoom claim. |

### Commands and retained evidence

All application commands ran from the worktree's `web/` with Node 22.11.0/npm and existing dependencies. Evidence directory: `/tmp/fhf-rso-compact-evidence-20261009`.

| Check | Actual outcome / receipt |
| --- | --- |
| Affected unit pack | Initial **135/135** passed: component 56, planner 72, provider rules 7. The final component-only suite passed **60/60** after extending display cases (`unit-delivery.log`); unchanged planner/provider results are reused. |
| TypeScript | `NODE_OPTIONS=--max-old-space-size=8192 npx --no-install tsc --noEmit --pretty false` **passed, exit 0**; `typescript-delivery.log` has no diagnostics. |
| Scoped lint | `npx --no-install eslint components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx components/RosterScheduleOptimizer/CompactSchedule.tsx __tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx e2e/roster-schedule-optimizer.spec.ts` **passed: zero errors, four inherited hook warnings** (`lint-delivery.log`). |
| RSO browser regression | `NEXT_PUBLIC_SUPABASE_URL=https://local-integration.invalid PLAYWRIGHT_BASE_URL=http://127.0.0.1:3141 PLAYWRIGHT_SKIP_WEB_SERVER=1 npm run test:e2e -- e2e/roster-schedule-optimizer.spec.ts --project=chromium` produced **34 passes / one fixture failure** (`browser-verified.log`): all 29 original cases and five compact cases passed. The new week fixture captured stored bytes before reopen settled its existing `asOf` update. |
| Final compact browser acceptance | The same browser command with `--grep 'compact '` and output `browser-delivery` **passed 6/6** after awaiting the correct pre-interaction persistence baseline. Thus all **35 unique cases** have retained passing evidence across those runs; no single 35/35 run is claimed. |
| Documentation/scope | Local links, fences, IDs, task states and final diff are checked. Original PRD/task/implementation fingerprints below are unchanged; their 23 checked / 18 open historical states remain intact. No build was run. |

Earlier density checks measured 16 then 19 full rows before compact chrome/header corrections; those failures are retained. Original regression failures from hidden disclosures, nested details selectors and mismatched fictional auth storage were corrected through explicit user-path fixture actions and matching the preview's fake URL. Read-only checks now verify the inert edit body while readiness remains usable. None of these failed/interrupted checks is counted as a passing run.

Final screenshot/measurement files under `browser-delivery/`:

- `roster-schedule-optimizer--06637--slots-and-continuous-bands-chromium/compact-20-1440x900.png` and `compact-20-metrics.json`.
- `roster-schedule-optimizer--46fdc-tent-and-keyboard-selection-chromium/compact-date-focus.png` and `compact-keyboard-focus.png`.
- `roster-schedule-optimizer--efc74-s-and-unknown-goalie-status-chromium/compact-short-desktop.png`, `compact-mobile-320.png`, `compact-mobile-390.png` and `compact-mobile-720.png`.

The original references remain attributed to parent pixel review; this candidate's screenshots were inspected locally. The interface/React review retained native controls, semantic table labels, stable player/slot identity and existing calculation boundaries. Desktop compact hit areas are a deliberate density choice; mobile controls retain 44 px. A global palette cleanup and a second assignment optimizer were considered unnecessary and excluded.

The executor disconnected after verification, before receipt/commit. After it reconnected, the unchanged staged five-file scope was reviewed and committed locally. The isolated preview was restarted using the existing provider-blocking wrapper with fictional credentials on `127.0.0.1:3141`; it is a local preview, not a deployment or live-data receipt. Preview availability can lapse with executor termination.

Original working-copy SHA-256 fingerprints retained unchanged:

| Source | SHA-256 |
| --- | --- |
| `prd-rso.md` | `f8f3cfc3724cf18ee82c4eb88446dd626e42328cfb5420df213b214dc644cd3f` |
| `../tasks-prd-rso.md` | `7191ef3a8867e9049ea53c4b246baf85e429716d633d9ddfcf8ef0f15f86aacc` |
| `rso-implementation-2026-10-08.md` | `2c168201cff10b74dc9fadf70c2732c316995b3d71e9dc5bdb10b801f696de70` |

Remaining gates are unchanged: actual Yahoo/manual/weekly profile qualification, positive compatible native forecasts/readbacks, freshness/revocation policy and evidence, commercial decisions, and separate release authorization. No source-image download was retried after its bounded failure, and no live provider transaction, credential operation, forecast issuance, push or deployment follows from this local receipt.

## 10. Flat-border correction and separate local runtime diagnosis

The user subsequently rejected composited left accents and then clarified that curved native-border ends also violate the flat-edge requirement. Actual-border commit `2719abf660bbceb1248c8311eca9cd33e0fbeebb` was an intermediate candidate; its rounded left corners are superseded by **`00c062e7dc5c63b6a48846a1c74223ddf09214b2`** on `octoberBranch`. This follow-up starts from documentation receipt `6ecb88cd5d27951b1cacd97ef3d6270b8950843d` and changes only the scoped SCSS and existing E2E spec, plus these two documentation receipts.

Every position group now has one **4 px actual solid left border**, **0 px upper/lower left radius**, and **7 px right radius**. Summary articles and the top bar use **3 px actual left borders**, square left endpoints and their existing right radius. No accent pseudo-element or absolute overlay remains. Native article/table semantics remain intact. Row/bench padding compensates for the border's layout width without clipping content or adding overflow masks. The latest flat-edge priority supersedes the earlier rounded-left-corner visual direction and the original CL-A11 appearance receipt.

Final checks at the flat-border source revision:

| Check | Result / evidence |
| --- | --- |
| Component suite | **60/60 passed** using the existing component command in section 9; `unit.log`. |
| Compact browser cases | **6/6 passed** using the section-9 browser command with `--grep 'compact '` and output `/tmp/fhf-rso-flat-border-evidence-20261009/browser`; `browser.log`. Covers 19/20/25 players, genuine vacancies, day/bench keyboard state, short desktop, reserves and mobile. |
| Actual border geometry | Browser styles verify solid real borders, both left radii zero, right radius 7 px for groups, and `::before`/`::after` content `none`; all seven summary articles have true 3 px borders and square left corners. Row content begins inside the border. |
| Density / pixels | **20 full rows remain visible at 1440×900**, including navigation. RW-group and article close-up screenshots were inspected at their upper/lower endpoints: straight colored edges, square ends, no curved hooks. Desktop, bench-focus, 320×844 and 720×450 screenshots were inspected; mobile captures bring the RW group into view. |
| TypeScript / scoped lint | TypeScript command from section 9 **passed, exit 0**; `npx --no-install eslint e2e/roster-schedule-optimizer.spec.ts` **passed, zero errors/warnings**. `typescript.log` and `lint.log` contain no diagnostics. No production build or broader suite was run. |

Evidence directory: `/tmp/fhf-rso-flat-border-evidence-20261009`. Under `browser/roster-schedule-optimizer--06637--slots-and-continuous-bands-chromium/`, `compact-rw-border.png` and `compact-article-border.png` show both endpoints; `compact-20-1440x900.png` and `compact-20-metrics.json` record density. The existing focus and short/mobile screenshot filenames from section 9 are retained under the corresponding final `browser/` case directories. Prior rounded-border receipts remain under `/tmp/fhf-rso-compact-border-evidence-20261009` and are not the final flat-edge acceptance.

### Port 3000 failure: configuration, not fixture acceptance

Read-only process inspection identified the user's **port 3000 PID 20689**, `next-server (v15.5.22)`, launched through Node PID 20688 and `npm run dev` PID 20671. Its cwd is `/private/tmp/fhf-october-reconciliation-20261009/web`, initially on `octoberBranch` at `6ecb88cd5d27951b1cacd97ef3d6270b8950843d`. It is the compact checkout, not the original `master` checkout. It has no inherited loopback guard or fixture environment. Port 3141 had no listener at diagnosis start; the separate provider-blocked wrapper was started for authorized tests as PID 22972. The two servers use `.next` and `.next-playwright` respectively; the user's server was not stopped or restarted.

Only environment filenames, variable presence and fixture/guard booleans were reported; no values were printed or copied. The worktree has `web/.env.development` with the public Supabase URL/key but **no `SUPABASE_SERVICE_ROLE_KEY`** and **no `web/.env.local`**. Its inherited process environment also lacks the required server key. The original `/Users/tim/Code/fhfhockey.com/web/.env.local` contains that server setting. Root `.env`/`.env.local` do not supply it. This separates missing ignored worktree configuration from the intentionally fake, externally blocked 3141 harness.

The exact public planning GET for season `20262027`, October 12–18 and `America/New_York` returned **503** with “Planning data is temporarily unavailable. Your saved manual workspace is preserved.” Unauthenticated access/workspace GETs returned **401**, as expected. The user's authenticated 503s were not replayed: access loading can reverify Patreon, so credentials/tokens were not extracted and no authenticated provider-dependent request was made. The handlers intentionally swallow underlying exceptions; the user's terminal is a TTY, not a readable log file. Source `getServiceRoleClient()` throws when the server key is absent, before its first database operation. Data, access and workspace routes all require that client; none of these routes or Supabase client code changed in the compact commits. The evidence establishes a required-configuration blocker; no compact application regression was reproduced. Database/schema or provider success after configuration is still unverified.

With the shared-data GET failing, the component has no current snapshot/evaluation. Compact `?` date/GP cells mean **schedule unknown**, not a forecast value or zero games. Pending/unverified slot status and **Slot unknown** mean no verified selected-day assignment; retained position eligibility and roster evidence cannot establish a fresh Yahoo lineup. A separate goalie `?` suffix means an unknown starter when a game is known. Missing forecasts can leave projected outcomes unavailable even after schedule access succeeds; they do not alone require every schedule date to become `?`. Saved workspace and manager choices remain preserved/read-only.

**Secure next step — user-owned:** privately restore the existing approved development configuration into `/tmp/fhf-october-reconciliation-20261009/web/.env.local` using the local editor or secret manager, with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLIC_KEY` and server-only `SUPABASE_SERVICE_ROLE_KEY` belonging to the same approved project. Use the existing private configuration as the source; do not paste values into chat or commit the ignored file. Once ready, restart only the user's port-3000 dev process from that `web/` directory with `npm run dev`. Verify the public planning GET and then ordinary account/workspace readiness in the existing UI, without clicking Yahoo refresh. Report any remaining error rather than bypassing access. This agent did not configure credentials, alter environment files, restart port 3000, refresh a provider, write a workspace, grant access, push or deploy. The hard-stopped goal and prior release gates remain unchanged.
