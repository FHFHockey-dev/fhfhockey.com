# Minimum rules needed to enable an acquisition comparison

Read-only follow-up; no application edits, manager changes, live requests or test reruns. Existing accepted source pins remain frozen.

The existing parser can retain `team.roster_adds.{coverage_type,coverage_value,value}` as weekly usage only when freshness, ownership, league/week and exact horizon containment pass. It also retains `settings.max_weekly_adds` as an **unverified reported value**, and matches `league.current_week` with stored Yahoo matchup dates. No current TJ raw payload proving these fields was found in the retained RSO evidence. Fixture values are not TJ's rules.

| Needed planner input | Existing payload evidence | Still needed |
| --- | --- | --- |
| `acquisitionTiming` | Settings parser has roster_type/weekly_deadline for lineup mode. These do not establish when an acquired player becomes usable. | Confirm same-day, next league day, or another cutoff. Other cutoffs require explicit support after evidence; do not force them into same_day. |
| `acquisitionCost` | No verified per-add allowance-counting rule is supplied by this adapter. A season move total or a weekly usage counter does not establish counting cost. | Confirm allowance units per add. This is separate from waiver bid dollars; do not default to1 or0. |
| `periods[].remaining` | A scoped weekly used count can be observed; remaining remains null because limit semantics/reset/counting are unverified. | Confirm remaining allowance for the current window and allowance in any later window touching the horizon. Do not infer unlimited from0 or use a very large finite substitute. |
| `periods[].start/end` | Matched week start/end are calendar dates; exact reset instants and timezone are not verified by those dates. | Confirm the reset window start/end date and time plus league timezone. Do not confuse weekly lineup locks with acquisition resets. |

## Exact short questions for TJ, only for fields still unknown

1. **When can a newly added free agent first play: the same day, the next league day, or a different cutoff?**
2. **How many acquisition-allowance units does one add consume?**
3. **What acquisition window applies (start/end date and time, league timezone), how many units remain now, and what allowance applies after any reset within the selected dates?**

Do not ask again for values already explicitly manager-confirmed or present as usable authoritative rules. Ask waiver policy/budget only if the named first candidate is actually on waivers; no waiver or goalie questions are necessary for a free-agent rules-only step.

## Minimum functional workflow

First use the pending source-state readback to establish an editable Manual or matching Provider snapshot. The existing **League settings → League rules and scoring → Acquisition timing** control and nested **Scoring, budgets, and lock windows → Acquisition cost / Add acquisition period / Moves left** controls already collect these values. The period UI currently supports local calendar dates at midnight; if TJ confirms an intraday reset, a focused time-input repair would be justified then. The schema already stores exact instants.

Use existing `updateRules` only for the missing confirmed fields. It stores `workspace.rules` plus the changed `managerRuleOverrides`; `supplementProviderRules` fills provider gaps, labels manager evidence and retains conflicting authoritative settings. Existing context-local autosave/Undo persists changes. Account saving stays the existing explicit version-checked action; no new account write, key, provider request, refresh button or persistence mechanism is needed. This investigation did not perform any save or edit.

A changed effective rules snapshot already invalidates `useCandidateMetrics` and starts a new worker calculation automatically; selected intent stays intact. The previous composed fixture shows a named candidate with explicit rules and fresh inputs reaches +1netAGP/nullpoints. Eligibility, ownership and schedule failures remain independent gates.

**Retained fallback deliberately clears transaction authority, even while manager choices remain stored; saved views are read-only.** Do not promise that filling the current form will activate suggestions in those branches, switch context automatically, or bypass that guard. If the pending source readback shows either branch, resolve that branch deliberately before proposing a rules application change. No adapter/UI repair is justified yet by actual TJ rule evidence.

Evidence: `rosterPlanning.ts:81–123,259–263`; main `updateRules:871–889`, rule controls around971 and1113–1130, snapshot composition554–581, autosave around274; `providerRules.ts:32–43`; `useCandidateMetrics.ts` snapshot-dependent effect; workspace schema acquisition fields already support nullable integers and exact period instants. Existing nearest tests were inspected, not rerun. The previous9-case composed receipt is reused, not rerun.
