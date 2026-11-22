# BLSH v6 hosted fixture replay: approval batch R2b (R′ re-merged onto the off-day release, 2026-11-21)

**Status: proven locally only, on 2026-11-21 UTC.** Nothing has been pushed, built, deployed, installed, exposed, armed or written in production.
- This is a **PARTIAL-fixture hosted replay**, not live acceptance. The public gate stays closed.
- This is the variant for the case TJ chose at 12:05 CT: FORGE takes the first slot, and master fast-forwards to the off-day release before BLSH.
- [APPROVAL-BATCH-R2.md](APPROVAL-BATCH-R2.md) is the companion batch for unchanged master. Its §1 scope note, its §3 step table and its §6 residuals apply here word for word. The only changes are the SHA, the precondition and the hashes below.
- Chef owns the release. This lane never pushes.

## Precondition: `origin/master` == `096b78b622a72a8378b8f60c0c7704fc4e2fee41` exactly

If master is anywhere else when step 0 runs, **R″ is void**: do not push it and do not run this batch.
- If master is still `f47905d28`, use R2 (R′ `0d8b141bc…`).
- Otherwise, re-merge and re-gate.

**Remaining time:** the arm deadline is **23:20Z today**, so the context firing lands by 23:50Z.
- The whole run takes about 45–60 min: preflight, install and checks ~15 min, the build ~10–15 min, fire and readback ~10 min, cleanup ~5 min.
- So it must start by about **22:20Z**.
- After today the window closes on 2026-11-26. Avoid the Nov 22 11:45–13:00Z pilot window and the 10:00–10:30Z FORGE daily window.

## 1. Candidate

| | |
|---|---|
| **R″** | **`39a15979651e004dad235fe70d86089595ec1092`** = `refs/rc/blsh-replay-ctxgate-20261121-onoffday` |
| Parents | 1. `096b78b622a72a8378b8f60c0c7704fc4e2fee41`, the off-day release (parent `e2f8c6bc9`, on `f47905d28`)<br>2. `0d8b141bc43750cc4da6c932d6fcaa87b0094f23` (R′) |
| Tree | `5d31e2020a3897450467ee00f2cee5ab23feab64`, from `git merge-tree --write-tree 096b78b62 0d8b141bc`: clean, no conflicts. The Chef got the same tree independently. |
| Made with | `commit-tree` from that tree. The main repository got no branch, worktree or checkout. Author TJ. No AI attribution. |
| Push shape | a fast-forward of `096b78b62` |
| R″ vs R′ | exactly the off-day release's 5 files (`evidence-r2b/R2b-vs-R2-files.txt`):<br>- `web/pages/api/v1/db/update-nst-gamelog.ts`;<br>- its test;<br>- `web/lib/projections/verifiedForgeReleases.ts`;<br>- its test;<br>- the `e2f8c6bc9…json` receipt. |
| R″ vs `096b78b62` | 50 files: `cda345c4f`'s BLSH content over `f47905d28` plus R′'s 9 files. This is what the build adds on top of the off-day release. |

**Unchanged from R2, byte for byte.**
- The 9 R′ files: R″ carries the same blobs.
- The three `hosted-r2/` operator files, checked by `git hash-object` against R″'s tree:
  - `arm-replay-get-dated.sql` `fb52ffb7…c445`;
  - `arm-replay-get-repeat-dated.sql` `7d98f348…1a56`;
  - `readback_export_dated.py` `4d1cd538…fe44`.
- `operator/local_proof_r2.sh` `8cfe586d…c9ac`.
- Envelope `f2525c71…6d44`, `install.sql` `766aec3b…519b`, `reset.sql` `8a763406…916e`, labels `ed13c5ff…567e`.
- The installer evidence (reused, not rerun), every kit file, and the pinned original arm SQL.

Full hashes are in R2 §1.

## 2. Gates on exact R″ (all run 2026-11-21 ~18:09–18:20Z, real clock)

| Gate | Result | Evidence (`evidence-r2b/`) |
|---|---|---|
| `local_proof_r2.sh` on a throwaway repo at R″ (HEAD = R″, 0 tracked diffs), with the `99fb9638a` harness and kit overlaid as untracked files (no path overlap) | **24/24** `proof.json`, exit 0 | `local-proof-r2-39a159796/` |
| Negative controls in the same run | **11/11**. The live route given a signed live-key grant on Nov 21 returned 200 `outside_approved_date`, with no writes. The tampered, other-key and Nov 18 grants were refused. | as above |
| Dated SQL on disposable PG15 | 13/13 refusals; arm, repeat and rerun accepted | `sql-refusals.jsonl` |
| Route responses | All 6 report `sha` `39a15979…`. Native 22.4 s / 20 objects, context 0.1 s / 8 objects. The repeat was `already_claimed` ×2 with counts unchanged. The rerun completed, and the final reset brought everything back to the pre-install state. | `response-*.json`, `rerun.json` |
| Readers | Stage 1 refuses `capture_ingress_window_unconfirmed`; the TLS rule refuses `tls_peer_unauthorized`; the context reader and the operator reader are ok, with `replayCaptureDay` `2026-11-21` | `operator-readback.json` |
| Focused vitest (replay, nativeCaptureV6, both readers) | **210/210**, 16 files | `vitest-focused.txt` |
| `vitest related` on the 3 changed BLSH sources (includes `prepareV6Observation`) | **152/152**, 5 files | `vitest-related.txt` |
| The off-day side's own tests (`update-nst-gamelog`, `verifiedForgeReleases`) | **156/156**, 2 files | `vitest-offday-side.txt` |
| Stage-2 `SOURCE_PINS` at R″ | **10/10** | `source-pins.json` |
| **FORGE gate:** `verify-forge-release-sha.ts 39a15979…` | **VERIFIED, closure `0446100e09f468bc061dbc7049ddc1fddec54237a617d7e63ca4835a66b48223`**, the off-day `e2f8c6bc9` closure listed in `VERIFIED_FORGE_PRODUCER_CLOSURES`. 243 modules, 0 findings, 25 dynamic table sites. | `forge-release-verify-R2b.json` (sha256 `9d2c2ac141b738a3e3a523daf2649aff166e19b4c80047611b0720b67023288d`), `forge-release-verify.out` |
| `npm run typecheck` | **exit 0** | `typecheck.txt` |
| `npm run lint` | **exit 0**: 0 errors, 69 pre-existing warnings, none in touched files | `eslint.txt` |
| CSS-module pure check | **241/241** | `css-pure-check.json` |

**What the FORGE result means.** The registry admits runs by closure hash, not by commit, and R″ reproduces the listed closure. FORGE runs stamped by an R″ deployment therefore stay admitted, and R″ does not need a registry entry of its own.

## 3. The batch

**These are R2 §3, steps 0–9, unchanged, with these substitutions:**
- **Step 0:** `git ls-remote origin master` must return `096b78b622a72a8378b8f60c0c7704fc4e2fee41`. Production must be on that SHA, READY and verified by FORGE's own read-back. The off-day release lane must have finished its readback, and no FORGE live run or recovery run may be in progress. R2's step-0 checks apply as written: the capture kill switch `blsh_capture_control.enabled = false` with jobs 404–407 unchanged (ids, schedules, active); the pre-install `outsideNarrowFingerprint` `4eebb9633ba7e4718a82f12435ea4ecb` (17:01Z and 18:16Z) recorded, with the post-reset probe required to equal the step-0 value; and `cron.timezone` reads null through the pooler, which the dated arm SQL coalesces to GMT (confirmed).
- **Step 4:** a fast-forward push of **`39a15979651e004dad235fe70d86089595ec1092`**, as a separate push approval (Chef). The READY deployment must be exactly that SHA, with 1 fhfhockey build plus the other projects' canceled or ignored entries (re-inventory first).
- **Step 6:** every route response must report `sha` `39a15979…`.
- **Step 8:** `readback_export_dated.py export.json OUT <deploymentId> 39a15979651e004dad235fe70d86089595ec1092 <run_date>`.

The dated SQL, the variables, the pass conditions, the rerun rule, the cleanup order and the footprint are identical to R2.

## 4. Stop conditions

These are R2 §4, plus:
- `origin/master` ≠ `096b78b62` at step 0 or step 4;
- `public.blsh_capture_control.enabled` is true, or jobs 404–407 differ from step 0;
- the post-reset `outsideNarrowFingerprint` differs from the step-0 value;
- the off-day release has not finished verifying, or a FORGE recovery run is mid-flight;
- any route `sha` ≠ `39a15979…`;
- it is past 22:20Z at step 0, or past 23:20Z at step 5.

## 5. Slot

- **Off-day release:** FORGE goes first and fast-forwards master to `096b78b62` at about 18:50Z (Chef's ticket).
- **FORGE recovery run:** latest start 20:10Z.
- **The 13 games:** start between 20:30Z and 03:00Z. This replay makes 0 NST requests and writes nothing live.
- **Codex repair slot:** 18:10–18:15Z, already past by then.
- **Earliest BLSH start:** after the off-day deployment is READY and read back, and after any recovery run is read back. That is about 20:30Z if the recovery runs at 20:10Z, or earlier if TJ skips it.
- **Latest:** start by ~22:20Z; arm by 23:20Z.

## 6. Superseded

Neither of these should ever be used. Neither has a ref.
- `a2002688…`: an empty commit.
- `1a77df8b…`: a pre-fix version of the repeat SQL.

R′ `0d8b141bc…` stays valid only for the R2 case (master unchanged at `f47905d28`).
