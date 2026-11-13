## Relevant Files

- `web/pages/api/toi.ts` - `/api/toi` PP share. It currently returns `powerPlayStatus.available = false`, and is to be gated on `pp_team_game_clock`.
- `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts` - The rolling writer. Its PP share denominator comes from the stored clock; its stored output must be unchanged with the flag off.
- `web/lib/supabase/Upserts/rollingPlayerPpShareContract.ts` - The rolling PP share contract (`percentageOfPP` is not a share).
- `web/components/PowerPlayCombos/PowerPlayCombos.tsx` - The Lines PP combinations; to be gated on clock availability.
- `web/components/LinemateMatrix/index.tsx`, `web/components/LinemateMatrix/utilities.ts` - The PP mode, which today computes from live NHL data on the old clock.
- `web/components/ShiftChart/model.ts` - The shift chart PP mode; same change as LinemateMatrix.
- `tasks/artifacts/calculation-inventory-2026-11-10/master/production/pp-clock-validation-2026-11-13/REPORT.md` - Decision 152 evidence: §11.3 names the readers; serving-review values go here.
- `tasks/artifacts/calculation-inventory-2026-11-10/master/production/PRODUCTION-QUEUE.md` - The record of every production action and readback.
- `tasks/artifacts/calculation-inventory-2026-11-10/master/production/RELEASE-NEXT-HANDOFF.md` - The release checklist and candidate record.
- `tasks/artifacts/calculation-inventory-2026-11-10/master/FIX-SPRINT-DEBRIEF.md` - The sprint status, release list and scheduled checks.

### Notes

- **Commands** (from `web/`):
  - `env -u GIT_DIR npm test -- <file>`;
  - `npm run typecheck` (read the exit code);
  - ESLint on changed files;
  - the CSS Modules pure check after any `.module.scss` edit.
- **Release gate:** a clean `git archive` export of the exact candidate: full Vitest, typecheck, ESLint, pytest. Known export-only failures: ArticleReader, the BLSH bootstrap, the 4 pytest git-pin tests, and requestBudget (a load flake that passes alone).
- **Owners:**
  - F11 (`local_efbef655`): the reader files in task 1, claimed in `CLAUDE-TO-CODEX.md`.
  - The Chef: verification, candidates, releases, production readbacks and records.
  - Codex: shift ingestion and shift fallback, `components/LineCombinations/utilities.ts` and `pages/lines/[abbreviation].tsx`. Don't touch these without the Chef's coordination.
- **Order and approvals:**
  - Task 4 is independent and can run beside tasks 1–3. Tasks 1 → 2 → 3 are sequential.
  - Every push, deploy, env change and production read or write needs TJ's own approval by pop-up. A relayed approval doesn't count.
- **Out of scope** (separate tickets):
  - Codex: the xG model (in progress), item 2's issuance contract, the goalie and starter refits, the Week Score study;
  - CTPI prediction checkpoints (games 20/30/40);
  - the 2020-21 to 2022-23 WGO identity backfill;
  - the 2025-26 penalty-shot games.

## Tasks

- [x] 1.0 Build the PP share reader gates offline (owner F11)
  - [x] 1.1 Gate `/api/toi`, the rolling writer, PowerPlayCombos, LinemateMatrix's PP mode and the shift chart model on `pp_team_game_clock`, behind `PP_SHARE_SERVING_ENABLED` (unset = today's behaviour).
    - Show only `available` rows; `not_applicable` shows "N/A", never 0%; `unavailable` shows its reason; nothing is capped.
    - Read stored shift rows only (no shift ingestion or fallback).
  - [x] 1.2 Pin flag-off parity: the rolling writer's stored rows for a fixture window are identical, field for field, to today's writer; the same for any other writer touched.
  - [x] 1.3 Cross-surface test with real stored fixtures: one qualified team-game (e.g. 2026020131 t18, 120 s) agrees across Lines, LinemateMatrix, the shift chart and `/api/toi`, and one zero-PP team-game (e.g. 2026020038 t55) shows "N/A" everywhere. Record each surface's values in REPORT. *(Done: F11 `05c43f981` + `aac8cf5a3`, REPORT §15–16. Chef reran 158 tests and matched 131 t18's seconds and shares and 038 t55's not-applicable to the accepted dry run.)*
  - [x] 1.4 Chef verifies: commits, ownership claims, the tests from 1.2 and 1.3, typecheck, ESLint and the CSS check, and no shift-ingestion files touched.
  - [x] 1.5 Serving review with TJ (pop-up): the evidence from 1.2 and 1.3, and the flag-off guarantee.
- [x] 2.0 Release the reader code with serving off (depends on 1.0 and TJ's approval)
  - [x] 2.1 Build the candidate on current master with only the reader files plus records (diaries at master's), and confirm no other app file differs.
  - [x] 2.2 Gate the exact candidate in a clean export (focused tests, typecheck, ESLint, CSS, full Vitest, pytest) and bring TJ the SHA. *(Candidate `28fdbadd6` on master `f5c7adc2d`: 26 app files, no scss. 265 focused tests; typecheck 0; ESLint 0. Full Vitest 19,965 passed: ArticleReader and BLSH are export-only; TweetSwipeTrainer is a load flake that passes 22/22 alone. pytest 213. 1.5 is covered by TJ's conditional approval, ~21:40Z and ~21:50Z.)*
  - [x] 2.3 After TJ's "Push and merge":
    - branch push with a 90 s no-build check, PR, squash-merge, and a tree-equality check;
    - 1 build plus 3 cancels;
    - a 5-GET smoke;
    - octoberBranch ours-merge with a no-build check.

    *Done: #442 → master `44de2f107`, build 22:07:23Z, smoke 5/5, octoberBranch `732468246`.*
  - [x] 2.4 Read back read-only that the next rolling run's stored output matches pre-release behaviour (flag off). *(Superseded: serving went on at 22:13Z, so no rolling run happened with the flag off in production. Flag-off parity is pinned offline by the field-for-field test from 1.2. The rolling writer's first run with serving on writes `pp_share_pct` with the clock denominator, as TJ approved.)*
- [x] 3.0 Serve PP share (depends on 2.0; **TJ approved 2026-11-13 ~21:40Z**, conditional on the reader candidate passing its release checks plus 1.2 and 1.3. Keep `PP_STORED_CALCULATION_WRITES_ENABLED=true`; stop on any disagreement; no refresh or cron rerun.)
  - [x] 3.1 TJ sets `PP_SHARE_SERVING_ENABLED=true` (Production). Run the approved clean-export CLI production deploy of the master SHA, then check the alias and a 3-GET smoke.
  - [x] 3.2 Verify served values with a bounded read-only budget agreed first: the qualified game agrees across the four surfaces, and the zero-PP game shows "N/A".

    *Done 22:13–22:16Z: the flag was set by the Chef through the CLI with TJ's approval. Serving deploy `dpl_3dTQdAD3`. The clock API, `/api/toi` ×2, the shift chart label and the line-combo PP matrix all agree with the dry run (PRODUCTION-QUEUE).*
  - [x] 3.3 Record it in the queue, debrief and REPORT, and close decision 152.
- [ ] 4.0 2026-11-14 scheduled readbacks (independent; read-only; each recorded separately; no manual reruns)
  - [ ] 4.1 08:05Z cron 388: audit `success`; the last 3 dates' rows stamped `pp-shifts-qualified-clock-v1`, with clock rows.
  - [ ] 4.2 10:05Z FORGE run: the first reserve rows.
  - [ ] 4.3 The same FORGE run: which `goalie_start_projections` rows it consumed, against cron 364's 09:30Z write under #439 (`a448842d1`).
  - [ ] 4.4 10:15Z cron 283: the first scheduled v4 power write.
  - [ ] 4.5 #440: the first natural update-stats-job write after tonight's games, with nulls only where the source is unknown and readers showing them as unavailable.
- [ ] 5.0 Records and housekeeping (Chef)
  - [ ] 5.1 Push the local record commits only with the next release, never alone.
  - [ ] 5.2 Update the debrief with #439–#441, migrations 147 and 149, the decision 152 refresh, and the results of 3.0 and 4.0.
  - [ ] 5.3 Ask TJ whether to have Astra recheck #439–#441, migrations 147/149 and the refresh. If yes, write the prompt pinned to a commit.
  - [ ] 5.4 Retire the Chef diary once 3.0 and 4.0 are recorded; keep it while any check is pending.
- [x] 6.0 NEW: flag-off client parity gap (found in F11 `05c43f981`)
  - [x] 6.1 *(Accepted: serving went on directly after #442, so no flag-off period exists. Reopen only if serving is ever turned off.)* With `PP_SHARE_SERVING_ENABLED` off, the client readers (PowerPlayCombos, LinemateMatrix, the shift chart) still make one cached request to `/api/v1/pp-share/team-game-clock` (a function invocation, ≤5 min cache). LinemateMatrix and the shift chart PP mode briefly show "Checking the stored power-play clock...". That isn't strictly today's behaviour. It matters only while serving is off: resolve it, or record it as accepted, before any future flag-off period. Serving is approved to follow the reader release directly.
- [x] 7.0 NEW, now blocking 2.0 (TJ, ~21:50Z): the shift chart withholds PP shading that doesn't reconcile with the qualified clock
  - [x] 7.1 With serving on, when a team-game's shift-chart PP intervals don't reconcile with the stored qualified clock:
    - withhold that team-game's PP shading and label it "PP timeline unavailable: timing mismatch.";
    - keep the verified share visible;
    - never stretch or rescale a band (the total doesn't say where the seconds belong).
    With serving off, behaviour stays as today.
  - [x] 7.2 Tests:
    - mismatch case 2026020131 t18 (shading withheld, label shown, 120 s share visible);
    - an unaffected available team-game (shading shown and equal to the clock);
    - the zero-PP case 2026020038 t55 (N/A);
    - flag off (today's output, pinned).

    *Done: F11 `486da9666`, REPORT §17. Chef reran 34 tests. Known limit: the check compares totals only, so right-total bands in the wrong place would still draw; Astra's parser fix (8.0) removes the gap.*
  - [x] 7.3 Chef verifies, then rebuilds and re-gates the reader candidate (supersedes `f848c3c2`).
- [ ] 8.0 NEW: the actual shift-chart parser fix (owner Astra/Codex, separate; TJ ~21:55Z)
  - [ ] 8.1 Astra fixes the root cause: the shift chart's play parser drops situation codes, so its PP bands come from the old algorithm. Astra doesn't touch F11's release files (7.0's ShiftChart files; the reader-gate files). The guard in 7.0 ships first. Once the fix lands and bands reconcile, the "timing mismatch" label disappears without a data change.
