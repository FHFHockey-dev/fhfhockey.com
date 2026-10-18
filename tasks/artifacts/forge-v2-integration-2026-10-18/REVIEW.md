# Independent review: FORGE v2 driver integration (patches 01–04), 2026-10-18

**Reviewer:** the universe-stage session (`forge-universe-automation`), read-only.
**Scope:** `CHECKPOINT-DIARY-2026-10-18.md`, `README.md`, patches 01–04 and the replay receipt. The focus is the universe wiring, identity rules, flags and gates.
**Rules followed:** no network calls, no commits, and no edits to the real checkout. Patches were applied only in a scratch copy, `…/scratchpad/v2review/repo`, which is disposable.

## Verdict: **needs changes**. 2 blocking issues, both small; 4 non-blocking

Line numbers refer to the files **after all four patches are applied**.

### Blocking

**B1. The v1 participation-coverage gate is gone, and lost participation is invisible to the null gate.**
- **Where:**
  - v1 stops at `scripts/forge-daily.ts:133` (`participation_coverage_incomplete`).
  - In v2, `scripts/forge-daily-v2.ts:70-73` (frozen branch) and `:85` (rolling branch) never check `participation.coverage`.
  - The frozen branch also silently drops every universe member whose `(playerId, nhlPlayerId, teamId, rosterRevision)` differs from its retained template. Those players are labelled `no_frozen_window_template_or_identity_changed`.
- **Why it matters:** players with no participation inputs produce no receipts, and `nativeDailyNullParticipation` (`lib/player-forecasts/nativeDailyPipelineV2.ts:78-85`) counts only null receipts. A whole-universe loss therefore reads as 0 nulls.
- **Failure scenario:** the first live identity query formats `rosters.created_at` differently from the retained revisions; this risk is already flagged in the universe notes and the README. Then:
  1. Every `rosterRevision` differs and every template is filtered out, so about 0 participation inputs are built.
  2. Outputs report 0 nulls and pass `--max-null-participation 100`.
  3. A means-only plan goes to the reviewer and can publish under the standing approval.
- **The same silent path exists for** a missing official club roster (frozen: `missing_official_club_roster` from the v1 builder, never checked) and for a missing roster or rolling history (`nativeDailyPipelineV2.ts:110-111`).
- **Fix:**
  - Restore the v1 rule on the builder's coverage: fail if any covered row has `reasons` or 0 games.
  - Separately, count *lost templates*: universe members that **had** a retained template but were filtered out. Fail on any lost template. The 11 Oct 16 players that never had a template stay reported only.
  - For rolling, fail on any coverage row with reasons, or gate the count behind a stated ceiling (a TJ decision).

**B2. Policy rows under the standing approval do not pin the definition hash.**
- **Where:**
  - `lib/player-forecasts/nativeCadenceOutputPreparation.ts:152-176` mints `status: "owner_approved"` policy rows with `ownerApprovalRef = tj-standing-approval-2026-10-17:forge-daily`, for every `policyVersion` that has a template.
  - The only definition check is `:99` (`snapshot.definitionHash !== payload.definitionHash`). That is self-consistency: the means stage and the output builder both run the current code.
  - The template policy rows carry no `definitionHash`. Verified on `candidate-conditional-publication-candidate-v2/final-publication-plan.json`: the policy payload keys are `allowedPublicUses, approvedAt, candidateInputHash, ownerApprovalRef, policyVersion, prospectiveEvidenceRef, seasonId, status, version`.
- **Failure scenario:** any later edit to a rate builder or its definition constants changes `definitionHash`. The run still publishes under the standing approval, guarded only by the reviewer agent noticing. PRD v2 decision 3 makes a changed definition hash a TJ decision, so this is TJ-gated behaviour reachable without a flag.
- **Fix:** pin an approved `{policyVersion → definitionHash}` map, plus the participation method versions, before minting any row. Use either a constant or a sha256-pinned `approved-methods-v1.json` passed to `outputs-v2` (DESIGN §2 "method gate"). On a mismatch, fail with `method_not_in_standing_approval`.

### Non-blocking

- **N1. Thresholds can be bypassed by omitting `--previous`.**
  - `nativeDailyPipelineV2.ts:60` uses `universe.change?.added?.length ?? 0`. If `universe resolve` ran without `--previous`, `change` is `null` and U5 sees 0 added, even with `universeThresholds` on.
  - Suggest: when the flag is on, fail with `universe_previous_required` if `change` is null.
- **N2. No carry rule in the rolling branch** (`nativeDailyPipelineV2.ts:112`). With `injuryPolicy` off after Oct 27, every `knownConflict` is `null`, so Fiala's conservative withhold disappears.
  - This is defensible, since the Oct 16 evidence would be 11 days old.
  - It should be stated in the `rollingFirstIssuance` request to TJ: rolling with `injuryPolicy` off means no conflicts at all.
- **N3. The `prospectiveEvidenceRef` rewrite is a no-op.** The rewrite at `nativeCadenceOutputPreparation.ts:170` matches `candidate:<64 hex>`. The current templates' refs (`private:existing-unvalidated-native-policy;…` and `private:native-use-policy-proposal-v1:41b90c81…`) contain no such token, so policy rows re-cite the template ref unchanged. Either drop the rewrite or document the intent.
- **N4. No CLI-level tests for the `inputs-v2` / `outputs-v2` gates.** That covers date/season, means/universe conflict, flag parsing and the null gate. Only the library functions are tested. B1 and B2 deserve CLI tests.

### Accepted

- **Wiring.** `forge-daily.ts` dispatches `universe` to `runForgeDailyUniverse(rest, now)` (patch 04, 3 lines). The universe CLI is unchanged.
- **Identity rules.**
  - `nativeDailyUniverse` (`nativeDailyPipelineV2.ts:56-67`) consumes only `players`, which were already resolved by the strict mapping (counts = 1, verified, active, unique club).
  - U3 (`ownedComplete`) always gates.
  - U4 counts unmapped + ambiguous + membership-unresolved + excluded.
  - The `means_universe_conflict` check (`forge-daily-v2.ts:53-56`) binds every fresh-means payload to the universe on `playerId`, `nhlPlayerId`, `teamId` and `rosterRevision`.
  - The frozen-template filter uses the same 4-tuple.
- **Injury flag.**
  - Off (`nativeDailyPipelineV2.ts:71`): no `knownConflicts` are passed, and the v1 carry rule applies.
  - On: it requires `--approved-injury-policy-hash` to equal the code's `PROPOSED_YAHOO_KNOWN_CONFLICT_POLICY_HASH` (`:73`), and it re-proposes at the inputs cutoff. That is correct: evidence is valid for ≤24 h from the Yahoo response.
- **Null-gate flag.** Off counts every null (`:85`).
- **`rollingFirstIssuance`.** Fails closed after `2026-10-27T04:00Z` (`nativeDailyParticipationMethod`).
- **Flag parsing.** Strict: an unknown key or a non-boolean fails, and the flags file is sha256-pinned.
- **Universe date.** `universe.date` must equal `--date` (`forge-daily-v2.ts:49`).

## Checks run

| Check | Result |
|---|---|
| Patch and receipt sha256 values against the diary | All 6 match |
| `base-blobs.txt` against the current tree | 1 drift: `web/lib/projections/startChartContract.ts` (edited since the cut) |
| `git apply --check` and apply of 01→04 on a scratch copy of current `web/` (HEAD `0de97e77d` plus the working tree) | **All 4 apply cleanly**, despite that drift |
| The README's 21 focused Vitest files, in scratch | 979 passed, 7 skipped, 0 failed. One test (`qualify-native-players-offline`) failed at first only because the scratch copy had no `.git` (`git rev-parse HEAD`); with a throwaway scratch repo it passes 56/56 |
| Replay receipt (`replay-receipt-20261021.json`) | Matches the diary. Re-reading only; **the replay itself was not re-executed** |

What the replay receipt shows:
- method `frozen_window`; universe 69 (19 owned), 0 unresolved
- nulls 100 total / 100 gated / 20 conflict-withheld, against a gate of 100: exactly at the limit
- reviewed plan valid at 94 rows; cadence valid at 94 rows
- expiry `2026-10-21T23:29:59.999Z`
- 0 network calls, 0 writes

The replay cannot exercise B1, because its universe is the retained scope and every template matches by construction.

**Not run:** full `tsc`, ESLint, the replay harness, and anything live.
