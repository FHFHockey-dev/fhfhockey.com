# Integration notes: `universe` stage → `web/scripts/forge-daily.ts`

**For:** TJ's FORGE Chef session. **When:** after 2026-10-20 17:00 UTC (the driver is frozen until then).

**Status:** nothing is wired, committed or run live. All new code is in new files, and no frozen or Yahoo-integration file was edited.

## New files (this session)

| File | What |
|---|---|
| `web/lib/player-forecasts/yahooUniverse.ts` | Offline core: URL plan, original-receipt verification, identity SQL builder, identity resolution, injury evidence, proposed conflict policy (`PROPOSED_YAHOO_KNOWN_CONFLICT_POLICY`, hash `9a50f265…8a66`), universe diff, `buildYahooUniverse` |
| `web/lib/player-forecasts/yahooUniverseCapture.ts` | Live-capable capture (not run): owned-team, league and game-context checks, then 3 GETs through `fetchYahooBoardResource` with the existing token manager. A tee `fetchImpl` retains only the three planned bodies |
| `web/scripts/forge-daily-universe.ts` | CLI: `capture` (plan-only unless `--execute true`), `query`, `resolve`. Exports `runForgeDailyUniverse(argv, now)` |
| `web/lib/player-forecasts/yahooUniverse.fixtures.ts` | Synthetic Yahoo standard-JSON builders, with no account data |
| `…/yahooUniverse.test.ts`, `…/yahooUniverseCapture.test.ts`, `web/scripts/forge-daily-universe.test.ts` | 13 offline tests. The two 2026-10-16 replay tests read `FHFH-private` (override with `FHFH_PRIVATE_DIR`) and are skipped when it is absent |

**Why not `loadYahooPlanningSnapshot`.** It reads up to 81 availability pages plus settings, scoreboard, league, team and league rosters, and maps through `yahoo_nhl_player_map_read`. That is outside the bounded scope and is not the canonical identity path. The stage uses the same `providerClient` and `tokenManager` underneath it, with no raw token RPCs.

## Wiring steps

1. **Dispatch.** In `runForgeDaily`, add `if (stage === "universe") return runForgeDailyUniverse(rest, now);`, then update the header comment. The CLI also works standalone.
2. **Allocation (one-time, private).** Create `$P/forge-daily-universe-allocation-v1.json`:
   - from `yahoo-original-sources-v1/allocation.json` (`teamId` → `externalTeamId`, `yahooLeagueKey`, `yahooTeamKey`, `targetSeasonId`)
   - plus `receipt.json` `owner.userId`, with `"version": "forge-daily-yahoo-universe-allocation-v1"`
   - It holds account identifiers, so keep it under `FHFH-private`.
3. **`capture`.**
   - Add `--universe/--universe-sha256`.
   - Gate: `universe.date === --date` and U3/U4 (DESIGN §2).
   - Plan club rosters from the universe players' `teamId`s instead of `retained.participationInputs`.
   - `dailyCapturePlan` maps club IDs to abbreviations from retained schedule parents. A new club would fail `club_abbreviation_unknown`. Map from the fresh schedule capture instead, or plan the schedule first.
4. **`inputs`, while v1 retained templates are used.**
   - Require the universe player set to equal the retained native scope (69 players) on `(playerId, nhlPlayerId, teamId)`.
   - Fail `universe_changed_requires_v2_inputs` on any added or removed member or any `rosterRevision` difference.
   - Consumers exclude a stale revision, so publishing would not help those players.
5. **`knownConflicts`, only after TJ approves the policy hash.**
   ```ts
   const injury = proposeYahooKnownConflicts(universe.injury.evidence, universe.players, seasonId, cutoffAt); // inputs cutoff, ≤24 h
   if (injury.policyHash !== APPROVED_YAHOO_KNOWN_CONFLICT_POLICY_HASH) fail("injury_policy_not_approved");
   buildDailyParticipationInputs({ ..., knownConflicts: injury.proposedKnownConflicts });
   ```
   - **Semantics to keep.** `nativeDailyPipeline.ts:154` uses `hasOwnProperty`, so an explicit `null` replaces a carried `true`. That is correct for a fresh read: Fiala's conflict clears if his status clears. If the universe stage did not run, pass nothing, and the v1 carry rule applies.
   - **Null gate.** Change it together with the policy (INJURY-POLICY-PROPOSAL.md): count only nulls not caused by `known_current_roster_conflict`.
6. **Fresh means (v2).** Pass `universe.injury.evidence` as `injuryEvidence` to `assembleCurrentRosterNativeInputs`. It stays within that function's bounds (≤100 rows, ≤16 KiB each; 14 rows on Oct 16), and its use there is diagnostic labels only.
7. **Traceability.**
   - Record `universeSha256` and `identityRowsSha256` in `coverage.json` and the preparation command, so the reviewer can tie the plan to the day's universe.
   - Keep the last published `universe.json` as `--previous` for the next day's diff.

## Unverified items to check on the first live run

- **Identity SQL never executed.** The extended query adds `canonical_position`, `lifecycle_status`, `canonical_name` and current `rosters` membership to the 2026-10-16 query, and it has not run against hosted Supabase. The test proves only that its keys equal the 2026-10-16 query's keys, in the same order.
- **`rosterRevision` formatting.** The value hashes the `rosters.created_at` JSON text. The query pins `SET LOCAL TimeZone = 'UTC'` to match PostgREST's default on hosted Supabase. If every carried member's revision differs from the retained or consumer value, the cause is formatting, not a roster change: stop and fix the query.
- **Live capture path never run.** Tests mock the token manager and the network.
- **Account-side writes.** The existing token manager may write a refreshed token, and a `401` after refresh marks the account `reauth required`. These are the only account-side writes, and both are existing client behavior.
- **Private data.**
  - `receipts.json` keeps whole original Yahoo bodies, including the roster's `managers` block. Keep it under `FHFH-private`: the CLI writes 0600 files in 0700 dirs.
  - `universe.json` holds only player rows.

## Checks run (this session)

| Check | Result |
|---|---|
| `npx vitest run` on the 3 new test files | Passed: 13/13 (with private fixtures) |
| The same with `FHFH_PRIVATE_DIR=/nonexistent` | Passed: 7, plus 2 skipped |
| `npx eslint` on the 7 new TS files | Clean |
| ts-node plan-only `capture` (synthetic allocation, no network) | Exit 0 |
| Full `tsc --noEmit` (one 8 GB run) | 5 errors, all in these new files (null narrowing, fixture literal type, test cast); none elsewhere. Fixed |
| Scoped `tsc` over the 7 new files and their import graph, after the fixes | Exit 0 (the full run was not repeated, per the one-run limit) |
| Live Yahoo, Supabase or NHL calls | **None** |

## Decisions for TJ

1. Injury policy hash `9a50f265d169817dd24fef6b6f5154deafe47a4104cd6880d28549f7775e8a66`, and the null-gate change.
2. Whether the two read-only SQL reads per day (head preflight and identity) are within the standing "provider reads" bound.
3. Thresholds U4 (≤5 unresolved candidates) and U5 (≤10 added members per day, v2).
4. Scheduler binding for the draft task (DESIGN §5), after the v2 stages land.
