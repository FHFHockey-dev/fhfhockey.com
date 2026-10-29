# RSO design review after the UI pass (2026-10-29)

This review used three skills from the Design plugin: design-critique, ux-copy and design-system. It covers the finished page after steps 1–7, using fresh screenshots of the fictional offline fixture at 2056 px and 1600 px desktop and at 390 px phone width, in Yahoo-connected and manual modes. It is review only: nothing was edited.

## 1. Critique (design-critique)

**First impression.** The command bar now reads in clear groups: context, then status, then Save. The three columns are calmer than before. On a desktop the eye lands on the **Streaming plan**, not the week grid, because the plan is open by default. It fills the Optimized Week column, and the grid starts below the fold (at about y = 930 of 1180 at 2056 px).

| Finding | Severity | Recommendation |
| --- | --- | --- |
| The open Streaming plan pushes the week grid below the fold on desktop. | 🟡 Moderate | Open the Streaming plan collapsed on desktop (its toggle already exists), or cap its height and let it scroll. The grid is the panel's main object. |
| "Confirm planning inputs" appears twice: as the Best Fit bar and at the foot of the Streaming plan. | 🟡 Moderate | Keep both reasons (the tests pin them and Preview swap and Use plan reference them), but make the Streaming plan's prompt a reason line only, with no second button. The Best Fit bar holds the one button. |
| When no drop is found, a 4–5 line jargon paragraph sits above the roster rows ("No drop suggested: projected points are unknown (Planning schedule coverage is incomplete…"). | 🟡 Moderate | Always use the existing one-line `<details>` summary ("No drop suggested · why"); today it only collapses when there are more than 2 reasons. The text itself comes from `lib`, which is read-only. |
| In Yahoo mode without projections, every Best Fit card repeats "Not enough projection data yet" and a yellow "Recheck availability before adding". | 🟢 Minor | Keep the recheck line: it is a protection on conditional moves. Make it muted instead of yellow while the card can't be previewed, and say "projection data" once in the status slot. |
| On phones in manual mode, ☰ wraps onto its own row under the search box. | 🟢 Minor | Let the search box shrink (`flex: 1 1 0`) so ☰ shares the row. That saves about 40 px. |

**Hierarchy that works.** Save is the only filled action. Toasts don't take a slot in the bar. DROP and its "?" stay visible. The summary cards are compact. The team strip reads as one band.

**Consistency.** Segmented controls now look alike: lineup goal, sort, and the By Team / All players views. The view switch (By position / By player / Itinerary / Plan details) is still separate buttons; it could use the same segmented style.

**Accessibility:** see `A11Y-2026-10-29.md`. All checked contrast passes after step 7.

## 2. Copy (ux-copy)

| Where | Now | Suggested | Pinned by tests? |
| --- | --- | --- | --- |
| Refresh toast | "Provider inputs refreshed. Selected moves were kept." | "Yahoo roster refreshed. Your selected moves were kept." (provider name filled in) | Yes, 4 tests. They would need updating. |
| Confirm reasons | "Confirm planning inputs to enable Preview swap." | "Confirm your league inputs to preview swaps." | Yes, 1 test (3 assertions). |
| Strip summary | "Top five team schedules · Oct 7–Oct 11 · Team context" | Drop "· Team context" (repeats the title). | The RSO test pins only "Top five team schedules"; "Team context" in the other test is an account page. Safe. |
| Best Fit header | "NET PTS / NET AGP" (all caps) | "Net pts / Net starts", with the AGP explanation kept in the tooltip. | No (built from parts). Safe. |
| Streaming summary | "Adds 3/3 · +3 AGP · unknown proj FPts · +1.4 blended FPts" | Plain words: "3 of 3 adds · +3 starts · projected points unknown · +1.4 blended points" | "blended" appears in 8 tests and the lib. Needs a careful pass. |
| Card disclosure | "Other drop" | "Other drop option" | 1 test. Small update. |
| Refresh button | "Refresh" (accessible name "Refresh provider") | Keep it. The label is within the accessible name. | n/a |

**Voice.** The good lines are plain and specific: "Synced · 3 adds left this week" and "Some team schedules for these dates aren't confirmed yet, so a few game counts are estimates." The heavy ones are in `lib`-generated reasons (read-only for this lane).

## 3. Design-system audit (design-system)

**Token coverage after step 5:**

| Category | State |
| --- | --- |
| Font size and weight | 100% from `_scale.scss` (six sizes, two weights). |
| Radii | 100% from the scale, plus 50% for circles and 0. |
| Text colour | From the scale's roles. |
| Non-text colour (borders, backgrounds, accents) | Global `vars` tokens (about 95 uses), and no hard-coded hex. |
| Spacing | 195 uses of `v.$space-*`. About 160 literal values sit on the 2/4/8 grid (2, 4, 8 px). **About 95 are off-grid:** 3, 5, 6, 7, 9, 10 and 12 px. |
| Line height | Mixed px (14, 12, 16, 13) and unitless (1.15–1.5). |
| Motion | Ad hoc durations: 620 ms, 200 ms, 0.15 s and 7 s. |

**Naming inconsistency (the main finding).** The local scale's names collide with the global ones but mean different sizes:

| Local | Size | Global | Size |
| --- | --- | --- | --- |
| `s.$text-xs` | 11 px | `v.$font-size-xs` | 12 px |
| `s.$text-sm` | 12 px | `v.$font-size-sm` | 14 px |
| `s.$text-md` | 14 px | `v.$font-size-md` | 18 px |
| `s.$text-lg` | 16 px | `v.$font-size-lg` | 20 px |

Someone switching between files will pick the wrong one. **Fix:** rename the local steps by size (`$text-10`, `$text-11`, `$text-12`, `$text-14`, `$text-16`, `$text-20`), or alias them to the global names where the sizes match. This is a mechanical rename with zero visual change.

**Structure.** `RosterScheduleOptimizer.module.scss` is 657 lines of layered overrides. `.rosterSummary`, `.navBar`, `.metrics` and `.candidateToolbar` are each restyled in several blocks across many media queries, and 17 `!important`s remain across the RSO files. A later consolidation pass, folding each component's rules into one block, would make the cascade predictable. That is a larger, separate task.

**Score:** about 72/100. Type, radius and colour are now tokenised. The gaps are spacing, line height, naming and stacked overrides.

## Suggested next steps (each would be its own approve/edit step)

1. Rename the local scale steps by size: no visual change, removes the naming trap.
2. Collapse the Streaming plan by default on desktop so the week grid is visible.
3. Always fold the "No drop suggested" reasons into the one-line disclosure.
4. One confirm button: the Streaming plan keeps its reason line, and the button stays in the Best Fit bar.
5. Safe copy edits: drop "· Team context", and change "NET PTS / NET AGP" to "Net pts / Net starts".
6. Phone, manual mode: keep ☰ on the search row.

These need more care: the toast and confirm wording (tests pin them), the "blended FPts" wording (lib and 8 tests), spacing and line-height tokens, and consolidating the big stylesheet.
