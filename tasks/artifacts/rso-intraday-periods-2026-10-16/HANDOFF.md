# Exact acquisition-period times

Local nine-file candidate is frozen for independent review. Exact source/test hashes are in `candidate.sha256` (manifest SHA256 `861e405f36b21d87e93e8083b62afecd6c800e79c330c81b4108e8fcd43d681a`). `increment.patch` reconstructs only this increment against the five intake copies and four new files. Existing dirty work was preserved.

The date-only acquisition controls could not express a Monday 03:00 reset. The new Exact period times disclosure accepts local start/end times plus an explicit IANA zone, validates both together, and applies exact UTC instants with optional display/edit zone metadata. Legacy date-only periods keep their controls and acquire no zone/default. An exact period retains its saved zone on reopen. Invalid, repeated or nonexistent local times, reversed bounds and an end before an existing lineup lock leave the saved period intact. Remaining allowance and independent lineup locks are preserved. No recurrence or future allowance is inferred.

`AcquisitionPeriod.timeZone` and the shared strict workspace period schema transport the optional zone through rules, manager overrides and account snapshot payloads. The planner still consumes the existing absolute start/end instants. No planner/resolver, provider adapter, candidate engine, schedule refresh or forecast behavior was changed.

Verification: 18 boundary tests and 44 component/schema/editor integration tests passed. The four integration cases include both existing date-only manual/Yahoo workflows and exact-time save/reopen for both providers, using isolated mocked requests and jsdom storage. Lint on the nine paths passed with zero errors and three preexisting main-component hook warnings. Scoped TypeScript passed with zero diagnostics across 61 project inputs / 1,029 total inputs and no input drift. This was a nine-root dependency check, not a full-tree compiler or production build. See `receipt.json`, logs and `typescript-receipt.json`. The React checklist was applied to the two edited components: local lazy draft state, functional updates, labeled controls, inline associated alerts, direct imports, no new effects or I/O.

## Manager-confirmed values prepared for the owner

Scout relayed TJ's clarification: Monday 03:00 **America/New_York**, keeping 03:00 through daylight saving changes. This is manager evidence, not Yahoo verification. The currently selected week is October 12–18, 2026.

| Field | Value |
| --- | --- |
| Acquisition timing | Same day |
| Acquisition cost | 1 per free-agent or waiver add |
| Current period local start, included | October 12, 2026 at 03:00 |
| Current period local end, excluded | October 19, 2026 at 03:00 |
| Boundary time zone | America/New_York |
| Exact start | `2026-10-12T07:00:00.000Z` |
| Exact end | `2026-10-19T07:00:00.000Z` |
| Moves left in this period | 2 |
| Provenance | Manager |
| Future total/remaining | Unknown; do not copy the current remaining value forward |

No actual workspace values were entered or saved by this worker. The rule establishes a weekly reset time, but this increment deliberately edits explicit periods only. Each subsequent period still needs its actual allowance.

## Remaining acceptance cases

1. In the owner's actual selected October 12–18 workspace, review any existing periods for overlaps, then enter or update the current period using the exact values above through League settings → Acquisition periods → Exact period times → Apply exact boundaries. Set timing, cost and moves left separately. Keep independent lineup lock values intact.
2. Reopen that workspace and confirm start/end still display 03:00 in America/New_York, remaining is 2, and manager provenance remains distinct from Yahoo's raw counter. Account save/reopen remains a human acceptance case; this worker tested its strict payload schema only.
3. For a future period, keep the allowance unknown until confirmed. A reset time does not establish next week's total. Spring and fall Monday intervals are 167 and 169 hours respectively; the passing tests preserve 03:00 rather than a fixed UTC offset.
4. Selected-week schedule freshness and complete provider/account acceptance remain separate gates. The accepted count diagnostic distinguishes the 652 known catalog candidates from 197 unknown local candidates and 123 unmatched Yahoo keys; this increment makes no new provider read or completeness claim.
5. Genuine admitted forecast inputs, consumer readback, release inclusion and deployment remain separately gated. No positive forecast/publication claim follows from this UI change.

No owner browser/storage/account access, real provider/database requests, cache writes, full compiler, build, commit, push, deployment or scheduler activation occurred in this increment. Accepted CandidateBrowser, Yahoo adapter, planner and recurring schedule source pins remained unchanged during this work.
