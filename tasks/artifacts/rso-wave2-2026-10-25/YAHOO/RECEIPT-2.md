# RSO-Y1 receipt: fix for YAHOO Y1 (unverified Yahoo rules are named)

- **Lane:** RSO-Y1 (CLAUDE-LEASES.json). **Date:** 2026-10-25.
- **Base HEAD:** `4f9fb95c3`. Every leased file matched its baseline sha256 before editing.
- **Status:** not committed. The orchestrator commits.
- **Untouched:** `RosterScheduleOptimizer.tsx` (owned by RSO-PRIVACY).

## Hash list

| File | Baseline sha256 | New sha256 |
|---|---|---|
| `web/lib/integrations/yahoo/rosterPlanning.ts` | `631ee6917cb67646695322d15ac280bf0b050e5a504e6cbb6d9dbf0d6e635e54` | `2e0119937949f558bb1328cd58435ef9b98fcebef340554c1a7a7000404cc84a` |
| `web/lib/integrations/yahoo/rosterPlanning.test.ts` | `08aab39c3f2f56ba96e221cf0c6c2c2a21d7641d4855c45a262c93c77a800636` | `32deab9f0c1757623ad06db2ed348eb9a6fb1613cdec1bca4d2463da5de35410` |
| `web/lib/rosterScheduleOptimizer/dailyAcceptance.yahoo.test.ts` | `f81cb3fcde13e043e94ca7bd7d37a8ad40fedfcc191d8b564c9a374a7747def7` | `207007ae2c721d3c08fd276e39ed50cd2c480e94e2815a9a4914fd1189ba1886` |

Diff: 3 files, +16 / −4.

## Change (`rosterPlanning.ts:471-476`)

`capabilities.rules` stays `false`. `loadYahooPlanningSnapshot` now always adds one limitation to the shared
`limitations` list, which is both `capabilities.limitations` and `evidence.roster.limitations`. The limitation names
exactly the rule facts the planner treats as unknown:

> Yahoo does not report these league rules; confirm them in League rules: `<list>`.

| Fact | Included when | Planner behaviour it matches |
|---|---|---|
| "when an add takes effect (same-day or next-day)" | always (`acquisitionTiming: "unknown"`) | the timeline rejects adds under unknown timing |
| "waiver mode and FAAB budget" | always (`rules.waivers` is not set) | the timeline marks waiver claims budget-unverified |
| "the exact weekly add reset time (league-local midnight is assumed)" | when a verified weekly period exists (`periods` built from local midnights; Yahoo doesn't report the reset instant) | — |
| "whether the league has a goalie minimum" | `minimumGoalieStarts === null` | — |
| "how the goalie minimum counts (starts or appearances) and its penalty" | `required > 0` (`counts` and `penalty` stay `"unknown"`) | the planner nulls projected coverage and notes "Goalie minimum semantics are incomplete." |

**What it builds on.**
- The existing "Verify remaining acquisitions, reset periods and counting rules…" limitation still names the weekly
  limit and remaining adds whenever the counter is unverified.
- The "goalie minimum progress" limitation still names credited starts.

**Why not `rules.unsupported`.** An `unsupported` entry blocks quality recommendations
(`inputEligible` requires `!rules.unsupported.length`). `supplementProviderRules` never removes it, so it would keep
blocking even after the manager supplies the missing rules. A limitation discloses the gap without that side effect.

## UI note (reported, not changed)

`RosterScheduleOptimizer.tsx:861-868` builds `healthItems` from `capabilities.limitations`. So the new item now keeps
`partialProviderInputs` true, and the league is no longer presented as complete. That meets Y1 with no component
change.

There is one follow-up for the UI owner (RSO-PRIVACY). Unlike the goalie-credited item, which the component hides once
`managerRuleOverrides.goalieMinimum.credited` is entered, this item stays visible after the manager enters timing,
waivers or goalie semantics. If that is unwanted, the component could filter the listed facts against
`workspace.managerRuleOverrides`, the same way it handles goalie credited. That is a copy/logic choice for that lane.

## Tests

- **`dailyAcceptance.yahoo.test.ts`:** the Y1 `it.fails` is now a plain `it` (regression for Y1). For the fully
  verified league it asserts:
  - the exact single limitation (timing, waivers, reset time, goalie semantics);
  - that `evidence.roster.limitations` equals `capabilities.limitations`;
  - that `rules.waivers` is undefined;
  - that goalie `counts` and `penalty` are unknown.
- **`rosterPlanning.test.ts`:** "reads nested roster collections and leaves acquisition timing unknown" now also
  asserts `capabilities.rules === false` and the exact limitation for a league with no verified counter and no goalie
  minimum read (timing, waivers, whether a goalie minimum exists).

## Checks (offline, from `web/`)

| Check | Result |
|---|---|
| Focused: `rosterPlanning.test.ts` and `dailyAcceptance.yahoo.test.ts` | **passed**, 112/112 |
| Regression proof: the same files against `git show HEAD:` `rosterPlanning.ts` (fixed file restored, hash re-verified) | **failed as expected**: exactly the 2 new assertions fail, 110 pass |
| Yahoo and RSO suites: `env -u GIT_DIR npx vitest run lib/integrations/yahoo lib/rosterScheduleOptimizer components/RosterScheduleOptimizer __tests__/components/RosterScheduleOptimizer` | **passed**, 56 files and 1,200 tests (`y1-suites.log`) |
| ESLint on the 3 changed files | **passed**, exit 0 (`y1-eslint.log`) |
| Whole-project tsc under `/private/tmp/fhfh-heavy.lock` (noclobber, released only by its owner) with `node --max-old-space-size=8192 node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` | **passed**, exit 0 (`y1-tsc-full.log`) |

No network, Yahoo, database, production, server, git mutation, `GIT_DIR` or real league data was used.
