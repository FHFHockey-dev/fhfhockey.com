# Addendum to PILOT-PACKET.md: the pilot re-date candidate (Nov 22 slate, capture Mon 2026-11-23)

Written Sat 2026-11-21 about 21:45Z (15:45 CT). This follows TJ's R0 approval (about 20:1xZ): Sun Nov 22 slate, games 2026020373–377, capture 2026-11-23 12:05Z, edits and tests only. Nothing was applied, staged, pushed, built or armed, and there was no production access. The only git writes in the canonical repo are the rc ref below and its objects. Times are UTC with CT (UTC−6) in brackets.

## 1. Candidate

| Item | Value |
| --- | --- |
| **Candidate SHA** | **`16f5c46030a8d619b8be153bb79cbbf9f1e9baa2`** |
| Ref | `refs/rc/blsh-pilot-redate-20261122` (created; it did not exist before) |
| Parent | R′ `0d8b141bc43750cc4da6c932d6fcaa87b0094f23` (cda345c4f plus the replay seam) |
| Tree | `d6ee4807966b102af9cd8bc057aa323df90f9feb` |
| Scope | 23 files, +856/−48. No attribution trailer. |

**How it was built.** I exported R′ with `git archive`, made the edits there, and committed in a throwaway repo under `/private/tmp/blsh-pilot-redate/gate`, with fixed author and date. All gates ran on that commit. I then rebuilt the identical tree and commit in the canonical repo with a temporary index file and `commit-tree`. The SHA and tree match the gated commit byte for byte.

**Merging onto master happens at push time, not now.** A throwaway preview merge onto current master `096b78b62` is clean: tree `95dff97c…`, no conflicts. Master's off-day files (`update-nst-gamelog.*`, `verifiedForgeReleases.*`, one receipt JSON) do not overlap this candidate.

## 2. What changed

**Official step: slate 2026-11-22, slot 2026-11-23T12:45Z.**
- `officialPilotHandler.ts` (`SOURCE`), `officialPilotStore.ts` (`SOURCE_DATE`), `officialPilotAcquisition.ts` (`OFFICIAL_SLOT`) and `scripts/blsh/readHostedOfficialV6.mjs` (slate, slot opens/expires). These are date literals only.
- **Tests,** shifted one day:
  - `officialPilotHandler.test.ts`, `.testHelper.ts`, `officialPilotStore.test.ts`, `prepareV6Observation.test.ts`, and the `officialPilotDates` in `prepareV6ObservationCapture.testHelper.ts`. The helper's default Nov 20/21 fixture is unchanged.
  - The refusal cases now cover the **retired slate 2026-11-21**, the **retired slot 2026-11-22 12:45:02Z**, the wrong slate 2026-11-23, and the older 2026-11-20.

**Migration `20261121210000_blsh_official_pilot_redate_20261122.sql` (chain (a), not applied).**
- It runs **after** `20261120143000`, and its guard requires that migration's reviewed result: check `2026-11-21` plus claim-function hash `4efee291…`. It refuses if any official run exists.
- It changes only the three date literals: the check becomes `2026-11-22`, and the slot becomes `2026-11-23 12:45`/`12:46`. `CREATE OR REPLACE` keeps the owner and the service_role-only execute grant.
- **Why chain (a):**
  - Both files land in the repo's migration tree in order, so the tree matches what production will run.
  - The second migration can't apply out of order; PG15 proves it refuses on the released schema.
  - `20261120143000` is already reviewed and pinned (`ce14c532…`) and unchanged.
  - A single migration straight from `5893416f…` would leave a reviewed file in the tree that must never run, which is a trap for a later `db push`.
- Claim-function definition hashes on PostgreSQL 15.19:

  | State | Hash |
  | --- | --- |
  | Released | `5893416f…` |
  | After `20261120143000` | `4efee291…` |
  | After both | **`03a29fd4ecff446f593cd561a5f6fc0ee4a47b6548e804f6be951c8915311855`** |

  If production's `pg_get_functiondef` text differed, PRECHECK would report `stop_definition_mismatch` and the migration would refuse. Both fail closed.

**Operator SQL in `redate-20261123/`** (in the commit, and copied beside this file):
- INSTALL, ARM, DISARM-ROLLBACK, SCHEDULE-ONCE and CANCEL-OFFICIAL-ONCE are mechanical one-day copies of the `redate-20261122` templates, which are untouched. Outside comments, only date tokens differ:
  - capture 2026-11-23;
  - slate 2026-11-22;
  - permit objects `blsh_pilot_20261123` / `blsh_pilot_claim_20261123`;
  - official objects `blsh_official_dispatch_20261122` / `blsh-official-once-20261122`;
  - cron `45 12 23 11 *`;
  - Vault `blsh_official_grant_20261122`.
- `PRECHECK-READONLY.sql` is rewritten for the chain. It returns:
  - `apply_20261120143000_first` on the released schema;
  - `ready_to_apply` after the first migration;
  - `already_redated` after both;
  - otherwise `stop_*`.
- `SWITCH-OFF.sql` is reused unchanged (`19abbc7f…`).

**L7.** The four NST registry files held out by `eb7f9f97c` are restored: `nstClassification.ts`/`.test.ts` and `nstCoordination.ts`/`.test.ts`. Their blobs are identical to `1a6e54239` and to the readiness RC `26f7aec97`. The rest of L7 (the cron audit scanner, frozen counts and cron-schedule.md) was already in R′. **The L7 sign-off (G1) still needs the L7 reviewer and the shared NST owner.**

## 3. sha256 of every artifact

| File (at `16f5c4603`) | sha256 |
| --- | --- |
| `supabase/migrations/20261120143000_blsh_official_pilot_redate_20261121.sql` (unchanged, applies first) | `ce14c532f1b9169e52a310e7a3affb29c27b37a00f0bcf08e022de539e7f0f7b` |
| `supabase/migrations/20261121210000_blsh_official_pilot_redate_20261122.sql` (**new**) | `4035c5c9a7bd95fc5d6e3aba1ddb8c7b5bda5e03d9e35eae0b0fc1e5f59cd09e` |
| `redate-20261123/PRECHECK-READONLY.sql` | `6a3ff5961903f6f0bbda4871c04bd3a0920695509b3d6a0f0be28f68bfb32994` |
| `redate-20261123/INSTALL.sql` | `7eeb75ea2d38d732b0277e3061219f0ce59af5957c8e92b38a299c737019a9c7` |
| `redate-20261123/ARM.sql` | `873991e6d16ceb2193d60af6f2e673c58629579aa9a6e682090668e74a3674b1` |
| `redate-20261123/DISARM-ROLLBACK.sql` | `8b4d6ee06cde02f0a08811dd6d24151bca06dc16898202376fbea882d82536aa` |
| `redate-20261123/SCHEDULE-ONCE.sql` | `33b1ead00cdceb2f32936cd9132dc0bb925a8e4767c78bba5de15f6520e06591` |
| `redate-20261123/CANCEL-OFFICIAL-ONCE.sql` | `c3fe32174b9fa6490ea4e7b9ea021fd83adb8d30ef802db3eb222cc53e5151dc` |
| `…/live-readiness-2026-11-19/SWITCH-OFF.sql` (reused) | `19abbc7f23ec69df490dd5ca4bd226353c421fe72bdf51460ad155c6f5c0ed33` |
| `redate-20261123/pg15-validate.py` | `e400a900d8841c9abb117456eae5a13d03914e752df007ae610735384cf0c779` |
| `redate-20261123/pg15-validate.out` | `053a3e9972f8970af2572facd930e61625c76e9f4e4a6b4bbd5a8ba0478c7318` |
| `supabase/tests/blsh_official_pilot.py` | `0fa0d143562066983de3b7c1aea4789e09d7fcdddcbc4fd9e9ab2aafd66e627f` |
| `web/lib/blsh/nativeCaptureV6/officialPilotHandler.ts` | `38be8fc3bdecd207075a1718152867d95dd22c103d03fb5140f942855fbf150b` |
| `web/lib/blsh/nativeCaptureV6/officialPilotStore.ts` | `e647a6ee33b7a6473137fa38001964389524cb31d51c1f4568019ff091a271a5` |
| `web/lib/blsh/nativeCaptureV6/officialPilotAcquisition.ts` | `5a2d0bc254fe25706bc57147c7cabce7773c55a4e4b8769cdc48f7112233dba8` |
| `web/scripts/blsh/readHostedOfficialV6.mjs` | `75da134c7dc1329f4afacec95d029c73f89d1880409bbef089af6776e577f47d` |
| `web/lib/cron/nstClassification.ts` | `8de2c89e83f2fcc811afd1ec3bc223fd443947acac8e97af54f600925d5cd308` |
| `web/lib/cron/nstCoordination.ts` | `ea7e2b6837825b643feaf3ad34f6428dbf7d433fd1d4f87fc43cbe7a8a536c95` |

**Do not run for this target:** the Nov 21-slate templates in `live-readiness-2026-11-20/redate-20261122/` (for example INSTALL `e51a9a96…`).

**Evidence in [evidence-redate/](evidence-redate/):**

| File | sha256 |
| --- | --- |
| `vitest-focused.txt` | `07a51a0902286990fb3ce90b1cfa1d8300bda0dc436f8a2a9ceccdc2364b035a` |
| `vitest-related.txt` | `3c7597f7c67eb07bea8aa0e562a71c4759031dbdcf6eb807523218c975d8fda9` |
| `blsh_official_pilot.out` | `dbd3551bea80cf1641499aaf3982066746cc8e20767135638042a5958d459994` |
| `typecheck.txt` | `f403a6a519689c38e21135a2ac6c0673568ba3050f4a8eeb6964eb7d82eabcc3` |
| `eslint.txt` | `d6af2cfc8d8b6e6772a8cadd657adcec4981504bd8f42130a4aeb09c16e1cd6d` |
| `css-pure-check.json` | `ee2e0a1a760d4a8fffbf56ff447d54c824daf59b1143ecb0733a0d3b3f32b314` |
| `forge-release-verify-candidate.json` | `957fd32b028fd29f0fb44f376e8001772ecdbc381dfe49ad9fe7c620fe10167a` |
| `forge-release-verify-Rprime.json` | `e73d07da71c6ccb33a784d2d7b602b73136c5d07643c4aa3e156b5978811647b` |
| `forge-release-verify-preview-merge-096b78b62.json` | `97dfa805d46d8c8448f568c82fe7c815d5ebec6c30a331765f82bc3a14e8ac92` |

## 4. Gates (all on exact `16f5c4603` in a clean throwaway repo: HEAD = candidate, 0 tracked diffs)

| Gate | Result |
| --- | --- |
| **PG15 harness** `redate-20261123/pg15-validate.py` (PostgreSQL 15.19, Unix socket only, stubs for pg_cron, pg_net, Vault and storage) | **69/69 PASS, exit 0.** It was rerun on the committed bytes, and the output is identical to the committed `.out`. Details below. |
| **`supabase/tests/blsh_official_pilot.py`** (disposable PG15; all real BLSH migrations plus both re-dates) | **3/3 groups PASS, exit 0.** It includes **official acceptance at 2026-11-23 12:45:05 for slate 2026-11-22**, four concurrent claims, refusal of the retired 11-22 slot and the 11-21 and 11-23 slates, the journal, 4 MiB readback and terminal controls. |
| **Focused vitest** (`lib/blsh`, `scripts/blsh`, `lib/cron`, `cron-audit-wrappers`) | **890 passed,** 3 skipped. 19 failed, **all in `scripts/blsh/nativeProcessCaptureBootstrap.test.ts` (`bootstrap_wrong_checkout`).** That test accepts only the canonical checkout path, and the same 19 fail identically on unmodified R′ in the same location. This is pre-existing and was documented in the Nov 20 receipt. |
| **Related vitest** (the 6 changed sources) | **451/451 passed, 16 files.** |
| `npm run typecheck` | **exit 0** (exit code read) |
| `npm run lint` | **exit 0.** There are 70 pre-existing warnings, none in a touched file. |
| CSS Modules pure check (Next's plugin over every `*.module.scss`) | **241/241** (no SCSS touched) |
| SOURCE_PINS (`reviewNativeV6Packet.mjs`, read from git blobs at the candidate) | **10/10** (`source-pins.json` `603e9d14…`) |
| **Not run** | `local_proof_r2` (the replay proof; this candidate does not touch the replay path). Production checks of any kind. |
| FORGE `verify-forge-release-sha.ts` | Details below. |

**What the PG15 harness proves:**
- **Pins:** six migrations and seven operator files.
- **The full exact and shifted operator sequence** on the chained schema: INSTALL, ARM, the native claim at 12:05:30, SCHEDULE-ONCE as job 409 `blsh-official-once-20261122` `45 12 23 11 *`, the fired job queuing exactly one GET, and DISARM plus CANCEL returning to zero jobs with 404–408 unchanged. SWITCH-OFF is also covered.
- **The chain:**
  - The check is `2026-11-22`, the claim function hash is `03a29fd4…`, and the grant is kept.
  - A rerun of either migration fails closed.
  - **The second migration refuses on the released schema.**
  - PRECHECK states: `apply_20261120143000_first` → `ready_to_apply` → `already_redated`; with a run present, `stop_official_runs_exist`, and the migration refuses.
- **Official claim:** refuses slates 11-20, 11-21 and 11-23. The function text holds only the 11-23 12:45/12:46 slot.
- **Native window:**
  - accepts slate 11-22 at exactly 2026-11-23 12:05:00.000;
  - refuses the retired window (11-22 12:05:30 / slate 11-21);
  - refuses the retired and wrong slates inside the new window;
  - refuses at 12:04:59.999 and at 12:07:00.
- **Cutoffs:** INSTALL refuses at or after 2026-11-23 12:05. SCHEDULE-ONCE refuses in the retired 11-22 window.

**FORGE verifier results:**
- **Candidate:** VERIFIED, 243 modules, 0 findings. Closure **`0bc861de96cbbf44218c2f182e0edc3a8b31bb9a7ea8e6993b87a8c33d6f3648`**.
- **R′, the same base without L7:** closure `cdf87b73…`. **So restoring L7 changes the FORGE producer closure,** as expected, because the `nstClassification`/`nstCoordination` files are inside it.
- **Preview merge onto master `096b78b62`** (throwaway only): VERIFIED, 0 findings, closure **`d6520f1c72711fcd151c1484f81c0379fc15c57e80963e72e024c1cd4e23e1e2`**.

## 5. FORGE registry entry: prepared, NOT committed (needs TJ's own approval, line F)

FORGE runs are served without a captured input snapshot only when their producer closure is listed in `web/lib/projections/verifiedForgeReleases.ts`. The pushed pilot build will have a **new** closure. Until an entry for it is admitted, FORGE runs produced by that build are not covered by an existing verification, and FORGE must decide whether it arms against the build without it.

**The closure is illustrative until push time.** `d6520f1c…` is the closure only if master is still `096b78b62`. Other pushes (Yahoo, News, the R″ replay) are queued ahead of BLSH, so master is expected to move and the closure will be whatever the verifier reports then.

**At push time there are two commits, following the `096b78b62` / `e2f8c6bc9` precedent:**
- **X** = `16f5c4603` merged onto actual master. This is the commit that is verified and receipted.
- **Y** = X plus the registry entry and its receipt. This is the commit that is pushed, read back, and pinned by INSTALL as `release_sha`.

The registry and its test sit outside the closure, so Y's closure equals X's. Re-verify Y to confirm. One build total (Y).

Draft entry, added in Y. Commit X's receipt at `tasks/artifacts/blsh-replay-2026-11-20/live-pilot-20261121/<X>.json`:

```ts
  {
    closureSha256: "<closure the verifier reports for X>",
    commit: "<X: the merge of 16f5c4603 onto actual master>",
    receipt: "tasks/artifacts/blsh-replay-2026-11-20/live-pilot-20261121/<X>.json",
    receiptSha256: "<sha256 of that receipt>",
    verifierVersion: "forge-release-sha-verifier-v1",
    note: "November 21 BLSH live-pilot build: restores the L7 NST registry entries (nstClassification/nstCoordination). The verifier found no excluded projection inputs in the 243-module producer closure.",
  },
```

Also add the matching `["<closure>", "<X>"]` row to `verifiedForgeReleases.test.ts`.

## 6. Approval lines (each separate; none implies another)

- **F. FORGE registry:** "I approve adding the verified producer closure `<hash>` of commit X `<sha>` (receipt `<path>`, sha256 `<…>`) to `VERIFIED_FORGE_PRODUCER_CLOSURES`, as commit Y on top of X, in the pilot build."
- **2. Migration:** "I approve the read-only `PRECHECK-READONLY.sql` (`6a3ff596…`) on `fyhftlxokyjtpndbkfse`. Then I approve applying `20261120143000` (`ce14c532…`) and then `20261121210000` (`4035c5c9…`), in that order. I expect `apply_20261120143000_first` → `ready_to_apply` → `already_redated|…|03a29fd4…|0`, and stop on anything else."
- **3. Keys and release:** "I approve staging the two public keys with fingerprints `<request-context>` and `<official>`, then one push to master of commit Y `<sha>`: X (`16f5c4603` merged onto actual master, verified, closure `<hash>`) plus the line-F entry. The push lands in gap A or B once P4 shows no armed FORGE run."
- **4. INSTALL and freeze:** "I approve INSTALL `7eeb75ea…` with `<release_sha>`/`<deployment_id>` from the release readback. I hold every fhfhockey production deployment from INSTALL until 2026-11-23 12:50Z, or an earlier completed disarm."
- **5. Go/no-go** for capture 2026-11-23, signed after G1–G3 and P6, with 0373–0377 all `OFF`/`FINAL`/`OK`.
- **6. ARM** `873991e6…` for capture 2026-11-23 only.
- **7. SCHEDULE-ONCE** `33b1ead0…` (Vault `blsh_official_grant_20261122`) for the official run at 2026-11-23 12:45Z only. The disarm set is DISARM-ROLLBACK `8b4d6ee0…`, CANCEL-OFFICIAL-ONCE `c3fe3217…` and SWITCH-OFF `19abbc7f…`.

## 7. Still open

These come from PILOT-PACKET §5 and §11 and are unchanged:
- G1, the L7 sign-off, now on these exact files;
- G2, the keypairs and fingerprints;
- G3: Part B, the ingress check, and review of the disarm-set pins above;
- P4, no armed FORGE run at push time;
- the push gap (gap A needs a push by 11-22 15:00Z, which is 09:00 CT).

More points:
- **Master will move.** Yahoo, News and possibly the R″ replay push are queued ahead of BLSH. At push time, re-merge, rerun the gates and re-verify the closure (X, then Y).
- **Stale custody documents (owner: BLSH Chef; not edited here, other lane's files).** At the candidate, `live-readiness-2026-11-19/CUSTODY.md` line 3 still names the 2026-11-22 window and the 2026-11-21 slate. Line 53 still names Vault `blsh_official_grant_20261121`. The new SCHEDULE-ONCE requires **`blsh_official_grant_20261122`** and refuses otherwise, inside the 12:35–12:44:59Z window. `STEPS-L7-AND-CUSTODY.md` (lines 27, 85, 93, 110) still points the L7 review at `refs/rc/blsh-release-20261120`; for G1 it should point at `refs/rc/blsh-pilot-redate-20261122`. Update both before G1 and the window.
- **Running the PG15 harness.** The working-tree copy of `redate-20261123/pg15-validate.py` resolves migrations from the repo root, so it only runs from a checkout of the candidate (where `20261121210000` exists).
- **The migration-authority registry.** `lib/supabase/supportedBaselineMigration.test.ts` fails 1 of 21 both on R′ and on the candidate (checked): the migration list is longer than `migration-authority.json`, and on the candidate it holds 165 entries against 156. This adds one more migration file, and the migration owner reconciles the registry; I did not edit it.
