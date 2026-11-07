# Roster Autopsy — local manual foundation

Date: 2026-10-29. This is a local implementation slice, not a deployment or acceptance of the full product. The source of the complete product direction remains [the PRD](../TASKS/prd-roster-autopsy.md) and its [evidence manifest](../TASKS/prd-roster-autopsy.sha256); neither is changed by this slice.

## What exists locally

- `/roster-autopsy` is a direct local route; no shared navigation file was changed. A manager can add players, enter their fantasy positions and roster status, enter starting-slot counts, explicitly review both inputs, and inspect C/LW/RW/D/G coverage.
- The position cards show known eligible-player counts and dedicated-slot gaps, with separate flex-only/no-slot states. They are structural coverage, not player-quality grades or league ranks. A shared RSO matching function computes the maximum simultaneous slot assignment, so a C/LW player cannot fill both slots at once. The cards disclose that per-position counts overlap. Unreviewed, unresolved, generic or invalid eligibility prevents definitive gap claims where it can affect them. Bench players participate in the structural check; IR, IR+ and NA do not. Games, locks, actual participation and player performance are outside this calculation.
- To bound the matching work, this initial workspace permits at most 100 players and 40 active starting slots. Calculation is memoized across unrelated form edits; larger leagues need a separately assessed limit.
- A user can review and merge their own current **manual** RSO workspace from browser storage into an empty or populated autopsy roster. Existing entries and scoring are preserved; possible duplicate names require explicit selection, and replacing existing starting-slot counts is a separate explicit choice. This uses the existing principal-scoped RSO reader and neither modifies the RSO workspace nor triggers a provider/data read. Missing or ambiguous copied players remain visible for review. Imported slots and roster require new confirmation. Non-manual/provider workspaces are not imported.
- On phone-sized screens, fixed Roster and Coverage links jump between the two sections without discarding the roster.
- When an imported manual RSO record has supported points scoring and recent totals, the page uses RSO's existing `recentPointsPerGame` helper for a historical per-appearance hint, showing sample size and unknown stat date. Unsupported scoring, missing totals or incompatible player class return no value. No forecast, market price, grade, acceptance probability or current provider fact is inferred.
- The inspected RSO recent-form loader uses bounded, capped game-log reads and its form evidence has a null as-of time. Saved `recentTotals` do not establish a complete, timestamped reference universe, so they cannot support the PRD's league/pool quality grades by themselves.
- The manual autopsy workspace is versioned and stored separately by signed-in principal or anonymous browser. An unreadable saved workspace is not overwritten. A detected change from another tab stops further writes and retains current edits in memory; browser storage does not provide an atomic compare-and-swap guarantee across simultaneous tabs. No provider tokens or raw provider payloads are stored.

## Paths and coordination

New source: `web/pages/roster-autopsy.tsx`, `web/components/RosterAutopsy/` and `web/lib/rosterAutopsy/`. The work reads existing RSO contracts and helpers but does not edit RSO/FORGE, Player Card, shared navigation, database, CI or package files. The checkout had substantial unrelated ongoing changes before this work. Recheck current ownership before any subsequent edits.

## Verification and limits

- The usability follow-up passed 18 focused tests, scoped TypeScript, Sass compilation and CSS Modules pure-mode checks against a source-hashed snapshot. Scoped ESLint also passed on the five new TypeScript/TSX files in the checkout.
- The earlier foundation passed whole-project TypeScript; the changed version was scoped to the affected surface. Isolated Chromium desktop and phone checks for the follow-up passed. See the [usability verification report](roster-autopsy-usability-2026-10-29/REPORT.md) and [earlier verification report](roster-autopsy-verification-2026-10-29/REPORT.md). Browser evidence does not establish deployment or live-provider behavior.
- No production or provider requests, database writes, migrations, Git mutations, deployments or deletions were performed. Read-only Git status/HEAD inspection established the working baseline.

## Path to the next stages

1. Qualify a public historical player universe, stat timestamps and actual league-scoring/eligibility coverage; then implement the PRD's clearly labeled manual roster and position **quality grades** with reproducible scoring and appropriate missing-data states. Structural slot coverage here is not that grade.
2. Add league-wide peer comparison and compact peer views, initially using reviewed manual peers and then separately qualified Yahoo/Fantrax adapters. Fantrax draft/settings imports do not establish current roster or availability. Keep account isolation and completeness evidence.
3. Add bounded, advisory trade-partner search and independent before/after roster evaluations for both teams, with a useful one-sided fallback. Reuse RSO and BLSH only through compatible, qualified contracts; do not infer acceptance or fair value.
4. Add playoff periods and scheduled versus net usable games through the qualified RSO schedule and lineup rules. Mark unsupported weekly locks, acquisition timing and data gaps.
5. Add optional Yahoo Trade Market observation context only after source behavior, bounded collection, deduplication, retention and attribution are qualified. Preserve complete bundles and picks; TJ reports specific permission subject to Yahoo logo attribution. The previous request returned 429, so live coverage remains unverified and sparse examples cannot establish fair market value.

## Initial foundation source pins

These historical SHA-256 hashes identify the initial foundation before the usability follow-up; current pins are in the [follow-up manifest](roster-autopsy-usability-2026-10-29/SOURCE-MANIFEST.sha256). Neither is evidence of a deployment.

```text
bb3f08300113a5f0c690a0d7452ac63adb0f67d1422c1d29a5eaec84ac9a2ace  web/pages/roster-autopsy.tsx
1375392a91a3c665d5003da4b1f10fa917ffb32e2dfb7a13b60423c3ddb981bc  web/lib/rosterAutopsy/manual.ts
994ef72d4a6063c5b3d695231bb402f939f09dae7193ecb26d572c8c97972be8  web/lib/rosterAutopsy/manual.test.ts
c451d8b595123ebcccfd48223f49b663c5f52cb425279241c165445d7dee74a1  web/components/RosterAutopsy/RosterAutopsy.tsx
8636915e41a2202526bb55ef5a2feb98cf71b9456f968140d9caff6b28252adc  web/components/RosterAutopsy/RosterAutopsy.module.scss
4bbc9b83bc181ee699456e882664d8eabfd93220e5bc6629f7570e8983215d5c  web/components/RosterAutopsy/RosterAutopsy.test.tsx
```
