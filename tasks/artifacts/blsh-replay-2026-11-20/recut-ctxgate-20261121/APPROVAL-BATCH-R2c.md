# BLSH v6 hosted fixture replay: approval batch R2c (R′ re-merged onto master `b37a0180d`, 2026-11-21)

**Status: proven locally only, on 2026-11-21 UTC.** Nothing has been pushed, built, deployed, installed, exposed, armed or written in production.
- This is a **PARTIAL-fixture hosted replay**, not live acceptance. The public gate stays closed.
- This is the variant for TJ's order: Yahoo `2236ecb7` first, then News (`54a1cf2c`, rebased if master moved), then BLSH.
- [APPROVAL-BATCH-R2.md](APPROVAL-BATCH-R2.md) is the companion batch. Its §1 scope note, its §3 step table and its §6 residuals apply here word for word, with R2b's step-0 additions. The only changes are the SHA, the precondition and the hashes below.
- Chef owns the release. This lane never pushes.

## Precondition: `origin/master` == `b37a0180d106412ede28cf7b6e5d73c89ffdae7e` exactly

If master is anywhere else when step 0 runs, **R‴ is void**: do not push it and do not run this batch. Re-merge and re-gate instead.

**Remaining time:** the arm deadline is **23:20Z today**, so the context firing lands by 23:50Z.
- The whole run takes about 45–60 min: preflight, install and checks ~15 min, the build ~10–15 min, fire and readback ~10 min, cleanup ~5 min.
- So it must start by about **22:20Z**.
- After today the window closes on 2026-11-26. Avoid the Nov 22 11:45–13:00Z pilot window and the 10:00–10:30Z FORGE daily window.

## 1. Candidate

| | |
|---|---|
| **R‴** | **`c922514df647ca30ae5b64dfa0f0fd32a754aeb1`** = `refs/rc/blsh-replay-ctxgate-20261121-final` |
| Parents | 1. `b37a0180d106412ede28cf7b6e5d73c89ffdae7e`, master after the Yahoo and News releases<br>2. `0d8b141bc43750cc4da6c932d6fcaa87b0094f23` (R′) |
| Tree | `ddb7f2088f0345378e0b44a9261e75e4cedcf9f7`, from `git merge-tree --write-tree b37a0180d 0d8b141bc`: clean, no conflicts. |
| Made with | `commit-tree` from that tree. The main repository got no branch, worktree or checkout. Author TJ. No AI attribution. |
| Push shape | a fast-forward of `b37a0180d` |
| R‴ vs R′ | 13 files: exactly what master adds over `f47905d28` (`evidence-r2c/R2c-vs-R2-files.txt`) |
| R‴ vs `b37a0180d` | 50 files: `cda345c4f`'s BLSH content over `f47905d28` plus R′'s 9 files. This is what the build adds on top of master. |

**Unchanged from R2, byte for byte.**
- The 9 R′ files: R‴ carries the same blobs (checked file by file against `0d8b141bc`).
- The three `hosted-r2/` operator files, checked against R‴'s tree: `arm-replay-get-dated.sql` `fb52ffb7…c445`, `arm-replay-get-repeat-dated.sql` `7d98f348…1a56`, `readback_export_dated.py` `4d1cd538…fe44`.
- `operator/local_proof_r2.sh` `8cfe586d…c9ac`.
- Envelope `f2525c71…6d44`, `install.sql` `766aec3b…519b`, `reset.sql` `8a763406…916e`, labels `ed13c5ff…567e`.
- **Installer `766aec3b…519b` and the step-3 script `tj-step3-token-and-probes.sh` `3ef6a45c510b9a073ec08dadf37b9d3159477b656a3fee33875b2e892dedf55f` are unchanged** (`install.sql` regenerated from the envelope in this run's proof: sha256 `766aec3b…`; the step-3 script's sha256 re-checked at 20:31Z).
- The installer evidence (reused, not rerun), every kit file, and the pinned original arm SQL.

Full hashes are in R2 §1.

## 2. Gates on exact R‴ (all run 2026-11-21 ~20:29–20:31Z, real clock)

| Gate | Result | Evidence (`evidence-r2c/`) |
|---|---|---|
| `local_proof_r2.sh` on a throwaway repo at R‴ (HEAD = R‴, 0 tracked diffs), with the `99fb9638a` harness and kit overlaid as untracked files (no path overlap) | **24/24** `proof.json`, exit 0 | `local-proof-r2-c922514df/` |
| Negative controls in the same run | **11/11**. The live route given a signed live-key grant on 2026-11-21 returned 200 `outside_approved_date`, with no writes. The tampered, other-key and Nov 18 grants were refused. | as above |
| Dated SQL on disposable PG15 | 13/13 refusals; arm, repeat and rerun accepted | `sql-refusals.jsonl` |
| Route responses | All 6 report `sha` `c922514df…`. The repeat was `already_claimed` ×2 with counts unchanged; the rerun completed; the final reset brought everything back to the pre-install state (proof checks). | `response-*.json`, `rerun.json` |
| Focused vitest (replay, nativeCaptureV6, both readers) | **210/210, 16 files** | `vitest-focused.txt` |
| `vitest related` on the 3 changed BLSH sources | **152/152, 5 files** | `vitest-related.txt` |
| Stage-2 `SOURCE_PINS` at R‴ | **10/10** | `source-pins.json` |
| **FORGE closure:** `verify-forge-release-sha.ts` on R‴ and on `b37a0180d` | **Closures equal: `0446100e09f468bc061dbc7049ddc1fddec54237a617d7e63ca4835a66b48223`** on both (243 modules). Verifier: R‴ VERIFIED (0 findings), master VERIFIED (0 findings). That closure is listed in `VERIFIED_FORGE_PRODUCER_CLOSURES`. | `forge-release-verify-R2c.json` (sha256 `ab22dea31721986bc6d3994f73e06575330f923f1165563418fa85b230c85b7a`), `forge-release-verify-master.json` (sha256 `8d8b8066d99df5eb2b9adff0b96064914233cf5e19574b5fe0c571608d34a694`), `forge-closure-compare.json` |
| `npm run typecheck` | **exit 0** | `typecheck.txt` |
| `npm run lint` | **exit 0: 0 errors, 69 pre-existing warnings, none in BLSH-touched files** | `eslint.txt` |
| CSS-module pure check | **241/241** | `css-pure-check.json` |

**What the FORGE result means.** The registry admits runs by closure hash, not by commit. R‴ reproduces master's own closure, so merging BLSH changes nothing FORGE admits: FORGE runs stamped by an R‴ deployment are admitted exactly as runs stamped by `b37a0180d` would be.

## 3. The batch

**These are R2 §3, steps 0–9, unchanged, with R2b's step-0 additions and these substitutions:**
- **Step 0:** `git ls-remote origin master` must return `b37a0180d106412ede28cf7b6e5d73c89ffdae7e`. Production must be on that SHA, READY and read back by the News release lane. No FORGE live run or recovery run may be in progress. R2's step-0 checks apply as written: the capture kill switch `blsh_capture_control.enabled = false` with jobs 404–407 unchanged (ids, schedules, active); outsideNarrowFingerprint: re-recorded read-only at step 0 of this run (pre-Yahoo value `4eebb963…`). The post-reset probe must equal the step-0 value of this run; and `cron.timezone` reads null through the pooler, which the dated arm SQL coalesces to GMT (confirmed).
- **Step 4:** a fast-forward push of **`c922514df647ca30ae5b64dfa0f0fd32a754aeb1`**, as a separate push approval (Chef). The READY deployment must be exactly that SHA, with 1 fhfhockey build plus the other projects' canceled or ignored entries (re-inventory first).
- **Step 6:** every route response must report `sha` `c922514df…`.
- **Step 8:** `readback_export_dated.py export.json OUT <deploymentId> c922514df647ca30ae5b64dfa0f0fd32a754aeb1 <run_date>`.

The dated SQL, the variables, the pass conditions, the rerun rule, the cleanup order and the footprint are identical to R2.

## 4. Stop conditions

These are R2 §4, plus:
- `origin/master` ≠ `b37a0180d` at step 0 or step 4;
- `public.blsh_capture_control.enabled` is true, or jobs 404–407 differ from step 0;
- the post-reset `outsideNarrowFingerprint` differs from the step-0 value of this run;
- the News release has not finished its readback, or a FORGE recovery run is mid-flight;
- any route `sha` ≠ `c922514df…`;
- it is past 22:20Z at step 0, or past 23:20Z at step 5.

## 5. Slot

- **Yahoo** `2236ecb7` (20:05–20:30Z, includes a migration), then **News**, then BLSH.
- **Earliest BLSH start:** after the News deployment is READY and read back.
- **Latest:** start by ~22:20Z; arm by 23:20Z.

## 6. Superseded

None of these should be used.
- `39a15979…` (R″, `refs/rc/blsh-replay-ctxgate-20261121-onoffday`): void, master moved past `096b78b62`.
- `0d8b141bc…` (R′): void as a push candidate, master moved past `f47905d28`. It stays as R‴'s second parent.
- `a2002688…` (an empty commit) and `1a77df8b…` (a pre-fix repeat SQL): no ref.
