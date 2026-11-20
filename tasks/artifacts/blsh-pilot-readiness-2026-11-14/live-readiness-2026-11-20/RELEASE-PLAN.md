# BLSH v6 release and freeze plan for capture 2026-11-22

Written 2026-11-20 around 14:20Z. This replaces sections 3–4 of [the approval packet](APPROVAL-PACKET-CAPTURE-20261122.md). The FORGE 15:30Z cutoff and "slot B" are withdrawn. Nothing here is approved: each TJ line in section 5 is separate.

## 1. Verdict: the release can safely go out today

There is no engineering blocker. The release candidate is `refs/rc/blsh-release-20261120`, reported with the handoff. It goes out as soon as the five gates in section 3 clear, all of which are possible today.

**Why it is safe to deploy now.** No deployment is bound until INSTALL. These are all the places a deployment is bound:
- INSTALL's pins (`release_sha`, `deployment_id`);
- the native claim trigger, which compares the 12:05 claim's deployment with those pins;
- the request-context grant, signed in the window, which must equal the serving `VERCEL_DEPLOYMENT_ID` and `VERCEL_GIT_COMMIT_SHA`;
- the official grant, likewise in the window;
- the official DB claim, which compares the native run's deployment.

All of these happen at or after INSTALL. Until then, production runs BLSH closed:
- The native switch is off, so jobs 404/405 return `skipped: disabled` on Nov 21 and Nov 22, as they do today.
- No permit is installed.
- The context and official routes refuse anything without a grant signed by TJ's private keys. Only the public keys are on Vercel.
- The public gate stays closed.

**FORGE.** The Nov 20 slate is empty, so FORGE should have no live game armed today. FORGE must confirm this before the push. FORGE released `0b1a9c958` at about 14:05Z today; the candidate is merged on top of it.

## 2. Freeze: from INSTALL to the official close, inside FORGE's quiet gap

- **Start: INSTALL, proposed Sun 2026-11-22 09:00Z.** Allowed any time from FORGE's last Nov 21 close readback (about 03:05Z) to the go/no-go (11:30Z). Hard latest: 12:04:59.999.
- **End: 2026-11-22 12:50:00Z,** once the official run has a terminal disposition and CANCEL-OFFICIAL-ONCE reads back no job. On an abort it ends as soon as the disarm set commits and reads back: DISARM-ROLLBACK, CANCEL-OFFICIAL-ONCE, and SWITCH-OFF if DISARM refuses.
- **Length:** about 3 h 50 min. FORGE's Nov 21 games run about 16:00Z Nov 21 → 03:01Z Nov 22, and its Nov 22 games from about 15:30Z. The freeze sits in the gap between them, so **it imposes no cutoff on FORGE's work and collides with no armed FORGE run.**
- **Covered:** any new production deployment or alias change of the `fhfhockey` web project. That means a push to master, a CLI deploy, an env redeploy, a promotion, a rollback or an alias repoint. The one exception is the stop procedure's approved repoint.
- **Before INSTALL, other production pushes are fine,** FORGE's included. This holds as long as they go through master, which then contains the BLSH code, and the keys are project variables carried by every build. The release readback (step 4b) is then repeated right before INSTALL, and INSTALL takes the pins from that readback.

**Sequencing point for the parent and TJ.** After the BLSH push, every production build is a BLSH-including commit. A FORGE run armed after the push binds that commit as `expected_code_version`. That is automatic if FORGE arms against whatever is deployed. If FORGE's approval names a specific FORGE SHA, FORGE needs TJ to accept the merged SHA instead. FORGE should say which applies. Either way, the push must not land while a FORGE run is armed; today none should be.

## 3. Gates for a release today (in order; parallel where marked)

| # | Gate | Who | Time it takes | Notes |
| --- | --- | --- | --- | --- |
| G1 | **L7 sign-off** ([STEPS](STEPS-L7-AND-CUSTODY.md) A1–A5) | L7 reviewer and shared NST owner, then TJ | About 20 min | Parallel with G2 and G3 |
| G2 | **Keypairs, fingerprints, independent recompute** (STEPS B0–B5) | TJ off-Mac, then the verifier | About 30 min | Parallel. Without the keys, a later keyed build is needed. |
| G3 | **Replay result.** The Nov 19 replay (`blsh-sandbox-run`) reports. Any handler fix it needs goes into this candidate first. | Replay lane | Today | Releasing before the replay finishes risks a second build before INSTALL. That is allowed, but it costs one more build. |
| G4 | **FORGE confirmation.** Nothing armed at push time, and no FORGE push in flight. | FORGE lane | Minutes | — |
| G5 | **TJ 6.3:** stage both public keys (STEPS B6), then one push of the release SHA to master | TJ | About 15 min, plus the build | Re-inventory every linked Vercel project first. The Nov 18 push gave 1 web build plus 3 ignored or canceled entries. Then read back the READY deployment ID, SHA, alias and region. |

If master moves again before G5, the candidate must be re-merged and the affected suites rerun: L7, BLSH and typecheck. That takes about 10 minutes.

**Not release gates; these must clear before INSTALL:**
- **TJ 6.2: the forward migration.**
  1. The DB owner first runs `redate-20261122/PRECHECK-READONLY.sql`. It is read-only and needs TJ's OK for a production read. Expected: `ready_to_apply|CHECK ((source_date = '2026-11-20'::date))|5893416f…|0`.
  2. Then apply the migration.
  3. Rerun the precheck. Expected: `already_redated|…|4efee291…|0`.
  - The migration can go before or after the push. Either order is safe, because the official route refuses without a signed grant.
- **Part B receipts** for Nov 19 jobs 404/405 (still unanswered).
- **The 5,592,690-byte managed PostgREST ingress check** (DB owner, read-only).
- **Review and pin of the re-dated disarm set.**
- **NST day-of clearance**, including identifying job 408.

## 4. Timeline (UTC)

| When | Step |
| --- | --- |
| Fri Nov 20, now → evening | G1–G4 in parallel; G5 push once they clear; READY readback. Optionally the 6.2 precheck and apply. |
| Sat Nov 21 | Part B; ingress check; disarm-set pins; 6.2 if not yet done. Jobs 404/405 return `skipped: disabled`. FORGE's Nov 21 games run normally from about 16:00Z. |
| Sun Nov 22 about 03:05 | FORGE's last Nov 21 close is read back. |
| Sun Nov 22 09:00 | Repeat the release readback, then **INSTALL** (re-dated) with those pins. **Freeze starts.** |
| 11:00 | NST day-of clearance (11:05–12:07 quiet). |
| 11:30 | TJ dated go/no-go, including the public-schedule slate check: the Nov 21 games are all `OFF`/`FINAL`. |
| 11:45–12:00 | **ARM** (re-dated). Hard latest 12:04:59.999. |
| 12:05 | Job 404 runs. Disarm after the primary disposition and before 12:20. |
| 12:35:00–12:35:59.999 | Request-context POST, signed against the readback deployment. |
| 12:35–12:44:59 | Vault `blsh_official_grant_20261121`, then **SCHEDULE-ONCE** (re-dated, its own approval). |
| 12:45 | Official run. CANCEL-OFFICIAL-ONCE after 12:46 if it did not fire, and at close in every case. |
| 12:50 | **Freeze ends.** FORGE's Nov 22 arming (about 15:30Z on) binds whatever is deployed. |

## 5. TJ approval lines (each separate)

1. **6.3, keys and release (today):** "I approve staging the two BLSH public keys (fingerprints `<request-context>`, `<official>`) as fhfhockey production variables, then one push of `<release SHA>` to master."
2. **6.2, migration:** "I approve a read-only precheck, then applying `20261120143000_blsh_official_pilot_redate_20261121.sql` (sha256 `ce14c532…7f7b`) to `fyhftlxokyjtpndbkfse`, with precheck readback."
3. **Freeze:** "I hold every fhfhockey production deployment from INSTALL (planned 2026-11-22 09:00Z) until 2026-11-22 12:50Z, or an earlier completed disarm."
4. **INSTALL, ARM, SCHEDULE-ONCE and go/no-go** for capture 2026-11-22: each separate, unchanged from the packet.
