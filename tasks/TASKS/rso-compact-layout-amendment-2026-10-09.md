# RSO compact layout — design amendment

Date: October 9, 2026. Status: documentation complete; implementation proposed and unstarted.

This amendment supplements the [audited RSO PRD](prd-rso.md), [existing task history](../tasks-prd-rso.md), and [local implementation evidence](rso-implementation-2026-10-08.md). Its [companion task list](../tasks-rso-compact-layout-2026-10-09.md) is a separate extension, not a replacement or reset of that history. The accepted layout and day-selection requirements below refine PRD requirement 23 and acceptance AC-08 while preserving requirements 1, 8–9, 13–14, and 17–20 and all release gates.

## 1. Scope and authority

The original RSO goal `01a11d48-c845-7454-90da-8784ecd1201b` is **hard-stopped and must remain stopped**. This document neither resumes it nor dispatches its owner. Release integration is independently active in `01a1195f-d79e-71f4-ab3d-723b8676d00e`; its files and worktree are outside this amendment's ownership.

Only this file and `tasks/tasks-rso-compact-layout-2026-10-09.md` are owned by this documentation task. Later implementation requires a separately authorized scope and clean base coordinated with the release owner. No application changes, push, remote build, deployment, provider refresh, transaction, or desktop mouse/keyboard use is authorized or performed here.

Latest branch direction: the user requests RSO work on, or merged into and continued on, **`octoberBranch`** so it is visible in the expected checkout. That is the requested later implementation destination; its verified base commit is pending integration owner `01a1195f-d79e-71f4-ab3d-723b8676d00e`. The parent reports that owner is reconciling the branch after independent review of `ec212566113385e1d183666c482f3c8cddda6ab5`; this task did not inspect that candidate or the release worktree. The two new documents currently reside as untracked files in the shared `master` documentation checkout. Their branch placement belongs to the integration handoff; this task does not switch or merge branches, and no layout implementation is claimed.

The supplied accepted decisions provide the needed product clarification. This follows the repository's [create-prd](rules/create-prd.mdc) and [generate-tasks](rules/generate-tasks.mdc) rules without repeating answered questions. The requested amendment filenames take precedence over their generic naming templates. The repository `.agents/skills` location is absent; the two applicable planning rule sheets were found at the linked paths and read. No workers were requested or created.

### Existing completion states retained

The existing task list contains **23 checked and 18 unchecked items**. Parent tasks 1–3 are checked; parents 4–9 remain open. Tasks 4.1–4.3, 5.1, and 6.1–6.6 retain their local completion; 4.4, 5.2–5.4, and the provider/forecast/freshness/release/weekly/commercial dependencies remain open. Neither old checkbox states nor source documents were edited.

Historical completion of task 6.4/AC-08 describes the prior interface. It does not verify this amendment's new player grid, twenty-row density, group bands, or day slider. All new implementation tasks and acceptance cases remain unverified. The settled **A — Wait for both** daily-beta decision, actual weekly qualification, and separate release authorization remain binding.

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

**CL-09 — Positional group bands.** Each positional group is one separate rounded container with **one continuous, flat left color band** shared by all its rows. The band extends from top to bottom of that container, follows its outer left corner radius, and has a straight inner edge. Do not apply individual rounded row strokes (the rejected “toenail” treatment), gaps between row bands, or a gradient. Keep row content inset from the band. Decoration must not clip names, logos, focus outlines, sticky identity/date headings, menus, or expanded details. Clip/mask only the decorative layer if needed, not the interactive content. Retain visible separators and textual slot labels so color is not the sole grouping cue.

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

Start Chart already has a container-level left pseudo-element at `start-chart.module.scss:1330`, but its surrounding container uses `overflow: hidden`. This is a useful geometry lead, not proof that copying it preserves RSO focus/sticky content. Test the resulting decoration independently.

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

These are source observations, not newly executed runtime tests.

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

All cases below are **not run for the amendment**. Use synthetic fixture data without provider refreshes or writes. UI cases extend old AC-08; assignment and continuity cases also preserve AC-02/03/05/06/10/11.

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
| CL-A11 | Multirow RW and other groups; scroll/focus/expanded details | Exactly one flat continuous band per group, rounded outer left edge/straight inner edge; no row strokes or content/focus/sticky clipping; accepted SuggestedPicks tokens with labelled proposed neutral fallbacks | CL-09; accepted palette |
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

Documentation checks passed: local Markdown links resolve, code fences/whitespace and requirement/acceptance IDs are consistent, all proposed implementation tasks are open, and SHA-256 comparison confirms the three source documents and the pre-existing `web/next-env.d.ts` change are byte-identical to the initial read. Final scope inspection shows only the two owned documents added by this task; the checkout remains `master`. The requested `octoberBranch` placement and verified base remain an integration-owner handoff.
