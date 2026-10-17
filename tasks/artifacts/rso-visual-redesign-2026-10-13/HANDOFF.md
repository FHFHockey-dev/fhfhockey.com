# RSO visual redesign — independent review handoff

Local implementation on `octoberBranch` in `/Users/tim/Code/fhfhockey.com`. No commit, push, deployment, install, credential use, production request, or account session.

## Superseding compiler fixture repair

FORGE's combined compiler found missing required NHL identity fields in presentation test fixtures. The bounded two-test-file repair is frozen in [compiler-fixture-repair/HANDOFF.md](compiler-fixture-repair/HANDOFF.md), with six passing affected tests, clean lint and revised exact hashes. Application presentation is unchanged. FORGE's compiler rerun awaits the separate main-test owner's final pin; earlier manifests remain historical checkpoints.

## Superseding review correction

The independent review requested a shared mixed-coverage display count and larger disclosure targets. Those corrections are frozen in [review-corrections/HANDOFF.md](review-corrections/HANDOFF.md), with an exact incremental three-file patch, 208 passing current focused tests, fresh browser/hit-area evidence and updated current 28-file visual/date/cache pins. The original 17-file patch and hashes below are historical first-pass evidence. Final independent acceptance and FORGE's combined TypeScript check are pending.

## Result

- Three desktop panels remain inside the 1440×900 frame with the individual-player schedule widest. Each panel retains its own scroll surface.
- Current roster rows align GP, AGP, DUST and active points, with persistent protection controls and an accessible Manage disclosure for the existing position/remove/evidence controls.
- The schedule reads the existing contribution ledger for selected-range totals. It does not derive a new forecast, change assignments, or treat the displayed week as the entire selected range.
- Individual best-fit acquisition cards show the complete ADD/DROP pair, paired net AGP/points, timed-plan detail and tradeoffs. Conditional availability, reserve prerequisites, missing comparison evidence, negative points and disabled selection remain truthful. Sort and selection guards are preserved.
- Routine comparison, metric and team-score explanations use hover/focus/tap help. Escape, outside pointer and repeated tap dismissal work; full accessible labels preserve unknown values. Critical readiness, availability, rule and forecast warnings stay visible.
- Canonical top-five context opens on desktop. Mobile keeps Itinerary/Roster/Candidates/Matchup workspaces and a horizontally scrollable player schedule.
- Saved/custom date provenance, current-week action semantics, protections, locks, account interactions and provider behavior are preserved. A compared-plan status is now tied to its intent revision so Undo dismisses the stale selected-plan message.

## Ownership and patch

`candidate.sha256` and `owned-files.json` contain all 17 exact final paths and SHA-256 hashes. The latter also records each released baseline hash. All hashes verified before release.

`visual.patch` is an **incremental patch against the explicitly released in-progress files**, not against HEAD/master. Existing pipeline/date changes were preserved. Do not apply it blindly over a newer Yahoo-cache integration. Baseline copies are retained at `/tmp/rso-redesign-ui-20261013/baseline/`.

Main page and nearest component test are released back to the RSO owner for its separate cache/loading integration. That integration must refresh their final hashes and the combined compiler receipt. The remaining presentation files are frozen.

## Verification

- Five focused Vitest files: **205 passed, 0 failed**. Existing date/provenance/preservation regressions remain covered; presentation assertions were updated for stronger accessible names and disclosure locations. See `tests.json`.
- After compacting unknown values: four relevant ledger/formatting checks passed. See `format-tests.json`. The later intent-status correction was verified by the final real-worker browser selection/Undo flow.
- Focused ESLint: exit 0, zero errors, four preexisting main-page hook-dependency warnings. See `lint.log`.
- Scoped `git diff --check`: passed.
- Fresh isolated Chromium contexts: complete, partial, conditional-only and empty inputs, each at 1440×900 and 390×844. Also checked document overflow at 320×844. All eight scenarios passed with no page errors, zero horizontal document overflow, no desktop vertical document overflow, and no outbound/account/provider requests. Mobile vertical document scrolling is intentional.
- Browser exercises: repeated keyboard Enter/Escape and touch open/dismiss; tooltip viewport bounds and retained focus; roster management and contribution disclosures; top-five expansion; net AGP/points alternatives; exact timed swap selection; Undo and status dismissal; selected dates retained; mobile tab visibility; roster vertical scrolling and mobile schedule horizontal scrolling.
- Actual page, Container, ClientOnly, components, styles and real planning/candidate workers are bundled. Auth/API/calendar, site header and Next image/metadata wrappers are fixture substitutes; remote font imports are removed. This does **not** validate the genuine signed-in Yahoo flow, production header, image assets or remote font metrics. See `browser-receipt.json` and retained fixture sources.
- TypeScript was not run by this consumer. FORGE is the designated single combined compiler owner after both visual and Yahoo-cache integration freezes.

## Reference limitation

Library resolved `libfile_4036088661688191bd99bb845190c3e5` to `Screenshot 2026-10-13 at 3.56.57 PM.png`, and `libfile_f6ad345cf52881918975b48e983fd6b9` to `Dark Fantasy Hockey Roster Optimizer Dashboard(1).png`. Supported byte transfer failed in the sandbox and with escalation. No bytes or pixels from those items are claimed verified.

The supplied fallback `/Users/tim/Desktop/FHFH Stuff/website stuff/Dark Fantasy Hockey Roster Optimizer Dashboard.png` was viewed. Before screenshots use the same synthetic catalog, with the concurrent date/schedule work underway. This is the first integrated redesign pass; it is not a pixel-identical recreation of the inaccessible updated image.

## Interface review

Full mode, confined to the requested RSO surface; React/Next with established SCSS and DraftDashboard tokens.

| Category | Evidence | Result |
| --- | --- | --- |
| Typography | Complete/partial/conditional desktop and mobile screenshots, numeric headers and unknown labels | Unknown word wrapping corrected; tabular values and readable metadata retained |
| Surfaces | Three panel frame, neutral structure, solid accent rails, candidate cards | No actionable issue observed |
| Animations | Static controls and disclosure transitions | No new staged animation; motion restraint retained |
| Icons | Help and row management controls; existing schedule logos remain unchanged | Accessible labels and focus cues verified; production logo rendering not verified |
| Performance | Portal/help lifecycle, real worker fixture, existing filters and bounded result count | No additional network reads from guidance or view selection; event listeners cleaned up |

Considered and rejected: reducing desktop row hit targets to the mockup's approximately 28px (kept 40px controls); adding decorative gradient/glow washes (retained canonical flat surfaces); manufacturing projected points for the conditional/missing fixtures (retained unavailable values).

Verdict: **Approve for independent local review**, with the reference, production framework/auth and pending combined TypeScript limits above. No blocking interface issue observed in the isolated requested surface.

## Review focus

Compare `before-1440.png` with `after-complete-1440.png`, and `before-390.png` with `after-complete-390.png`. Inspect candidate and mobile itinerary captures, then missing/conditional examples. Review the incremental diff for copied callbacks and preserved guards; confirm `?`, `—` and known-subtotal `+` retain their full accessible evidence labels. Reconcile any subsequent cache integration into the main page without losing the new view structure, date provenance or warning visibility.
