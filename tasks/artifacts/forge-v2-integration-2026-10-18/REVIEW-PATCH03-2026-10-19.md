# Re-review: FORGE v2 integration patch 03 (B1/B2 fixes), 2026-10-19

**Reviewer:** Sous (fresh context, read-only), assigned by Chef.
**Scope:** `REVIEW.md` B1/B2 and N1–N4, the patched `03-v2-composition-new-files.patch` (sha256 `806ef0ec…c539`), and an apply check of 01–04 against HEAD `317f8f57e`.
**Scratch:** `/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/0e9c1ed5-887f-4fcd-b829-eab529141de5/scratchpad/v2rereview/repo`. It is a `git archive HEAD` copy with a throwaway local git repo, which the `qualify-native-players-offline` test needs. The only edit in the real checkout is this file.

Line numbers refer to the scratch copy **after all four patches are applied**. Paths are relative to `web/`.

## Verdict: **accept**

B1 and B2 are both resolved. Nothing blocks applying the patches after 2026-10-20 17:00Z. Three items should still be handled at apply time; see the last section.

## B1: participation coverage gate, **resolved**

| Requirement | Evidence |
|---|---|
| v1 rule restored | `lib/player-forecasts/nativeDailyPipelineV2.ts:109-112`: `assertParticipationCoverage` fails `participation_coverage_incomplete` when any row has `reasons.length` or `!row.games`. This is the same predicate as v1's `scripts/forge-daily.ts:133` |
| Lost templates counted and failing (frozen) | `scripts/forge-daily-v2.ts:71-72`: `templated` is every retained template's playerId and `kept` is the identity-matched subset. The universe members in `templated` but not in `kept` go to `assertParticipationCoverage`, which fails first with `participation_template_lost:<n>` (`nativeDailyPipelineV2.ts:110`) |
| Members that never had a template | Reported only, appended after the gate (`forge-daily-v2.ts:73-75`) |
| Missing official club roster (frozen) | v1 builder pushes `missing_official_club_roster` into the coverage reasons (`lib/player-forecasts/nativeDailyPipeline.ts:150`). The gate at `forge-daily-v2.ts:72` then fails |
| Rolling coverage reasons fail | `forge-daily-v2.ts:88` calls `assertParticipationCoverage(participation.coverage)`. Coverage rows get `missing_official_club_roster` / `missing_rolling_history` (`nativeDailyPipelineV2.ts:147-148`) and `games` (`:144`) |
| Review failure scenario | If every `rosterRevision` differs, all 69 templated members count as lost and the run stops at `inputs-v2` before any request is written |
| Unit tests | `nativeDailyPipelineV2.test.ts:53-58` and `:74-85` |

Observations (non-blocking):
- `missing_rolling_history` cannot be reached today. `buildRollingParticipationHistories` sets a history for every player (`lib/player-forecasts/rollingParticipationFrame.ts:159`).
- Per-game frame reasons such as `missing_original_boxscore` and `not_listed_…` reach `coverage.json` (`rollingFrame`) only, and do not hit the coverage gate. They still produce null receipts, so the null gate counts them; the loss is not silent.
- The lost-template computation in the CLI (`forge-daily-v2.ts:71-72`) has no test, because N4 is still open.
- Operationally, during the frozen window, one templated member's team or revision change (a trade, say) now halts the whole daily run. That is fail-closed, as the review asked, but Chef and TJ should expect it.

## B2: standing-approval method gate, **resolved**

| Requirement | Evidence |
|---|---|
| Pinned map: policyVersion → definitionHash | `nativeDailyPipelineV2.ts:34-45` (`NATIVE_DAILY_APPROVED_METHODS`): season `20262027` and 6 policy → hash pairs |
| Participation method versions pinned | `:42-45`: 3 roster-observation dataset keys. The 3 rolling-14d keys count only with `rollingFirstIssuance` (`:95`) |
| Mismatch fails `method_not_in_standing_approval` | `:96` (season), `:99` (each `player` input's `definitionHash` must equal the pin), `:100` (policy rows), `:101` (bundle manifests), `:102` (participation dataset keys) |
| Runs before anything is written | `scripts/forge-daily-v2.ts:121` runs before `output()` / `privateWrite` (`:123-126`). The only earlier side effect is `persistContributionBundle` with `dryRun` and a DB stub that throws |
| Pins match the current code | Combined with `nativeCadenceOutputPreparation.ts:99` (`snapshot.definitionHash !== payload.definitionHash`), a code change to a definition now fails one of the two checks. A scratch-only test, `zzReviewPinnedHashes.test.ts`, confirmed all 6 pins equal `currentAppearanceDefinitionHash`, `priorAppearanceDefinitionHash`, and `nativeGoalie{Win,Volume,Shutout,SummaryWin}DefinitionHash(20262027)`: 1/1 passed. The test lives only in the scratch copy and is not part of the patches |
| Unit tests | `nativeDailyPipelineV2.test.ts:60-72` |

Limitations (non-blocking):
- **Pin provenance not verified.** I could not check that the pins are the hashes *approved* on 2026-10-16. Apart from the patch itself, no repo file records them, and access to the private artifacts was denied in this session. The pins match the current code, so the claim holds only if the code has not changed since 10-16.
- **Undefined-hash case.** `:99` compares `approved.policies[undefined] !== undefined`, so a `player` row with neither `policyVersion` nor `definitionHash` would pass this check. In practice `nativeSnapshot` (`nativeCadenceOutputPreparation.ts:91-99`) rejects such a row first. Optional hardening: require `typeof payload.definitionHash === "string"`.
- **Participation pinned by version key only.** Participation methods are pinned by dataset/version key, not by a code content hash. That is the same exposure as v1.

## N1–N4 status (all open, left open by direction per the diary)

| Item | Status | Evidence |
|---|---|---|
| N1 thresholds bypassable without `--previous` | **Open** | `nativeDailyPipelineV2.ts:75` still uses `universe.change?.added?.length ?? 0`. There is no `universe_previous_required` |
| N2 no carry rule in rolling with `injuryPolicy` off | **Open** (documentation item) | `:149` defaults to `null`. The `rollingFirstIssuance` request to TJ must state it |
| N3 `prospectiveEvidenceRef` rewrite is a no-op | **Open** | `nativeCadenceOutputPreparation.ts:170` (the patch 04 file) is unchanged |
| N4 no CLI-level tests for the `inputs-v2` / `outputs-v2` gates | **Open** | Only library tests exist. The B1 lost-template wiring and the B2 call site are untested at CLI level |

## Apply result (scratch copy of HEAD `317f8f57e`)

| Patch | sha256 (verified) | `git apply --check` | Apply |
|---|---|---|---|
| 01-kernel-export | `37150f82…3d05` | OK | OK |
| 02-integration-rebased | `3d1e2b0a…752f` | OK | OK |
| 03-v2-composition-new-files | `806ef0ec…c539` | OK | OK |
| 04-v2-driver-wiring | `9a1ebfc8…795` | OK | OK |

Drift:
- `base-blobs.txt` (sha256 `aa220cbc…cd1e`) matches HEAD for every existing file, including `startChartContract.ts` = `7a2618ec`, the refreshed value.
- So there is **no drift** against current HEAD. The real checkout's working tree has no edits to any touched file; `git status` shows one unrelated untracked file.
- The 3 new files are absent, as expected. The result is 22 modified files plus 3 new ones.

## Tests run (scratch, synthetic Supabase env)

| Check | Result |
|---|---|
| README's 21 focused Vitest files, including `nativeDailyPipelineV2.test.ts` | **21 files passed; 981 passed, 7 skipped, 0 failed** |
| Scratch-only pinned-hash check | 1/1 passed |
| Offline replay `replay-20261021.ts` | **Blocked, not run.** It needs `PRIVATE_ROOT=/Users/tim/Documents/FHFH-private/…`, and this session's permission check denied access. Receipt sha256 `b230a208…675b` matches the diary, but I did not re-execute the replay or compare its output |

The diary's count was 975 passed. My 981 most likely reflects tests added at HEAD since the cut; there were no failures.

Not run: full `tsc`, ESLint, full Vitest, and anything live.

## Still needed before applying after 2026-10-20 17:00Z

1. **Update the stale README.** `README.md` still lists the pre-fix 03 sha256 (`990a4e86…`) and the old receipt sha (`89f0c518…`). The correct values are `806ef0ec…c539` and `b230a208…675b` (diary update section). Whoever runs the apply should check the diary values, not the README's.
2. **Re-verify `base-blobs.txt` against the files at apply time,** since other sessions may touch `workspaceSchema.ts`, `startChartContract.ts` or `planning.test.ts` before then. After apply, run the README's post-apply Vitest list and then full `tsc`, behind `/private/tmp/fhfh-heavy.lock`.
3. **Optionally, re-run the Oct 21 replay** in a session with private-root access, to independently confirm `b230a208…`. Before the first live run, get TJ or the 10-16 approval record to confirm the 6 pinned hashes are the approved ones, not just the current-code ones.
4. **Bring the open non-blocking items to TJ:**
   - N1, before `universeThresholds` is enabled;
   - N2, in the `rollingFirstIssuance` request;
   - N4 CLI tests, which are recommended before the Oct 27 rolling switch.
