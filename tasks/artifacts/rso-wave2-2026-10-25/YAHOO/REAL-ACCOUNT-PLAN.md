# RSO-YAHOO: real-account verification plan (plan only, no calls made)

This plan is for a later, TJ-approved read-only window on TJ's own connected Yahoo daily league. It confirms the parts
of the offline packet that synthetic mocks cannot prove: real payload shapes, freshness headers, ownership and scope
fields, and the goalie starting mark.

**Nothing here was executed.**

## Preconditions (all required before any request)

1. TJ approves the window in a pop-up, naming the league and team, the date, and the request budget below.
2. The account is TJ's own connected Yahoo account, with an owned team in a **daily** league for the current season.
3. Everything is read-only. There are no transactions, lineup edits, waiver claims or OAuth scope changes.
4. Requests go through the existing authorized app path on a local dev server (`npm run dev:stable`, signed in as TJ).
   They use the RSO provider route, which runs `loadYahooPlanningSnapshot`, and the current-data route, which runs
   `loadYahooPlanningConfirmations`. No direct Yahoo calls are scripted, and nothing runs on production or a Vercel
   preview.
5. Run one request at a time, with at least 60 s between snapshot loads.
6. Stop on any `yahoo_rate_limited`, `yahoo_reauth_required` or `yahoo_access_denied`, or on a non-200.
7. **Evidence policy:** record only booleans, counts, field presence and the limitation strings. No league names, team
   names, player names, rosters, standings or tokens go into the repo, diaries or chat.

## Request budget

| Unit | Yahoo reads (provider client) | Count |
|---|---|---|
| One snapshot load, horizon = today → week end (no elapsed days, so no past-roster reads) | settings 1, roster(today) 1, scoreboard 1, league_rosters 1, league 1, team 1, available pages *n* | 6 + *n* |
| Available pages | `players;status=A;sort=OR;start=k;count=25/ownership`. The loader stops at the first short page or failure, with a hard cap of 81 pages and 8 s. | expected 3–20 (the 25-row list length) |
| One confirmations read | roster(today) 1 | 1 |

**Planned total:** 3 snapshot loads plus 2 confirmations reads, at most **2 × (6 + 20) + (6 + 20) + 2 = 80 reads**,
with a stated ceiling of **100**. If the available list is longer than 20 pages, stop after the first load and ask TJ
to approve the larger budget.

## Minimal scenarios

| # | When | Action | Confirms (offline scenario) | Record |
|---|---|---|---|---|
| R1 | Morning, before any puck drop | One snapshot load | (a) roster entries and positions map; eligibility and `is_undroppable` become `canDrop`; IR/IR+ eligibility comes from `eligible_positions`; `capabilities.rules === false`; `acquisitionTiming === "unknown"`; time zone present or absent | the `capabilities` object, `rules.acquisitionTiming`, `goalieMinimum.counts/penalty`, roster completeness, `limitations` strings (Y1 check: is any rules limitation present?) |
| R1 | same response | | (c) discovery stop reason and completeness | the three `capabilities.diagnostics` lines (counts only) |
| R1 | same response | | (d) `acquisitionEvidence` counter `coverageType/coverageWeek/used`, `limit.verified`, `remaining`, `period.containsHorizon` | numbers and booleans only |
| R1 | same response | | (f) `ownership` presence versus `availability` for 3 sampled non-owned players | per sample: availability value plus ownership-known boolean |
| R2 | After Yahoo posts goalie marks (afternoon), before the owned goalie's game | One confirmations read | (e) `starting_status` shape (`coverage_type: date`, `date`, `is_starting` 1/0); a fresh mark sets bridge start chance 1/0 and keeps the per-start line; `expiresAt` within 2 min | `startProbability` before and after, `confirmedStart`, `expiresAt − observed` |
| R3 | ≥ 60 s after R2, same horizon | One snapshot load (refresh) | (g) the refresh keeps the selected moves; reconciliation issues for any changed facts (counter or availability) | issue messages, and whether `suggestedSteps` is null |
| R4 | After the owned goalie's game starts | One confirmations read | (e) a started game is withheld; rows unchanged | unchanged boolean |

**Not in scope for the window:**
- weekly leagues and Fantrax;
- any transaction, to prove effective timing (the manager supplies timing in beta);
- a second account or principal. The wrong-principal case stays offline-only.

## Pass and stop criteria

- **Pass:** each recorded field matches the offline packet's expectation. Specifically, Y1 reproduces or is shown
  fixed, no unseen player is `free_agent`, and the allowance comes only from the week counter.
- **Stop:**
  - on any write-capable path or error class listed above;
  - if the request count would exceed 100;
  - if any private league data would need to be stored to proceed.
