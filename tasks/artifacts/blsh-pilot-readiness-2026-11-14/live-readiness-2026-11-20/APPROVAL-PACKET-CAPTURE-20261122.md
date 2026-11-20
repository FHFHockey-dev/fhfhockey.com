# BLSH v6 first live capture: approval packet for the earliest eligible non-empty window

**Proposal for TJ, not approved.** Written 2026-11-20 around 13:45Z. Nothing in it has been re-dated, applied, armed, deployed, pushed or enabled, and the public gate stays closed. Each line in section 6 is a separate approval. All times are UTC; ET is UTC−5.

## 1. The current window is empty; the earliest eligible non-empty window is capture 2026-11-22 12:05Z

**Capture 2026-11-21 12:05Z (source 2026-11-20) is not eligible.** The public NHL schedule (`api-web.nhle.com/v1/schedule/2026-11-20`, read once around 13:35Z on Nov 20) lists **0 games on Nov 20**. The native route sets its source date to the capture day minus one (`web/lib/blsh/nativeCaptureV6/sourceDate.ts`). In that window:
- **Native step:** ends `no_slate` (`core.ts:410`).
- **Request-context step:** refuses, because it needs a native manifest in state `packet_complete_pending_review` (`requestContextHandler.ts:98`).
- **Official step:** refuses, because it needs 1–16 game IDs (`officialPilotStore.ts:47`).
- **Net:** the window would spend a keyed build, a release freeze and four DB transactions to yield zero appearances.

**Recommendation:** let the Nov 20 proposal expire unused. `PILOT-APPROVAL.md` already says "Expiration consumes this proposal". Its other preparation carries forward:
- the L7 registration;
- the custody procedure;
- the disarm findings;
- the PG15 harness.

The candidate windows, from the same schedule read:

| Capture (12:05Z) | Source date | Regular-season games | Puck range (UTC) | Eligible? |
| --- | --- | --- | --- | --- |
| Sat 2026-11-21 | Fri 11-20 | 0 | none | **No** (empty) |
| **Sun 2026-11-22** | **Sat 11-21** | **14** | 11-21 18:00 → 11-22 03:00 | **Earliest eligible** (14 ≤ the 16-game cap) |
| Mon 2026-11-23 | Sun 11-22 | 5 | 11-22 17:30 → 11-23 01:00 | Fallback 1 |
| Tue 2026-11-24 | Mon 11-23 | 7 | 11-24 00:00 → 03:00 | Fallback 2 |
| Wed 2026-11-25 | Tue 11-24 | 1 | 11-25 01:00 | Fallback 3 (one game) |
| Thu 2026-11-26 | Wed 11-25 | 14 | 11-26 00:00 → 03:00 | Fallback 4 |
| Fri 2026-11-27 | Thu 11-26 | 0 | none | No (empty) |

**Day-of caveat.** The native step requires every scheduled game to be `OFF` or `FINAL` with schedule state `OK` (`core.ts:189`). A postponed or unfinished game fails the run closed with `schedule_game_incomplete`. Confirm the slate from the public schedule (not NST) at go/no-go.

## 2. Moving the window is a re-date, and this is what it changes

The native and request-context steps take any date. **The official step and the operator SQL hold Nov 20/21 as literals.** None of the following has been edited or drafted here.

| Layer | Exact location (now) | Owner | What a re-date needs |
| --- | --- | --- | --- |
| **Production DB** (applied 2026-11-18; readback 16:40:12.984415Z) | `supabase/migrations/20261118155445_blsh_official_pilot.sql`: line 12 `check (source_date = date '2026-11-20')`; line 100, the claim function's date; line 118, the claim window `2026-11-21 12:45:00`–`12:46:00`; line 124, the after-write fence | BLSH migration owner, then the DB owner | A new forward migration replacing that check and function for the new date. One DDL transaction under separate approval. No destructive rollback. |
| **Web code** | `web/lib/blsh/nativeCaptureV6/officialPilotAcquisition.ts:11` `OFFICIAL_SLOT = 2026-11-21T12:45:00Z`; `officialPilotHandler.ts:7` `SOURCE = "2026-11-20"`; `officialPilotStore.ts:7` `SOURCE_DATE = "2026-11-20"`; their tests (`officialPilotHandler.test.ts`, `officialPilotHandler.testHelper.ts`, `officialPilotStore.test.ts`) | Handler lane (`blsh-sandbox-run`, which is mid-replay on these files today) | Edit and focused tests. Ships in the **same single keyed build** as the L7 registration and any fix from the replay. |
| **Operator SQL** (pinned) | `pilot-control/INSTALL.sql` lines 21, 24, 29–62 (source date, the 12:05–12:07 fence, objects named `_20261121`); `ARM.sql` lines 11–21; `DISARM-ROLLBACK.sql` lines 21–23; `official-dispatch/SCHEDULE-ONCE.sql` lines 10–67 (the 12:35–12:44:59 window, cron `45 12 21 11 *`, Vault name `blsh_official_grant_20261120`, dispatch table); this lane's `CANCEL-OFFICIAL-ONCE.sql` (job name, schedule, table) and `pg15-validate.py` | BLSH Chef or the DB owner | Re-dated files, a PG15 rerun and new SHA-256 pins. **Blocker 7's pins and the 41/41 PG15 result cover only the Nov 20-dated bytes.** |
| **Documents** | `PILOT-APPROVAL.md` (dated proposal, D−28…D read Oct 23–Nov 20); [CUSTODY.md](../live-readiness-2026-11-19/CUSTODY.md) header dates; Vault grant name | BLSH Chef | A new dated proposal for TJ. The context read becomes Oct 24–Nov 21 for source Nov 21. |
| **Not date-bound** | Native route (capture day − 1, fence ≥ 2026-11-19); request-context handler (the date comes from the signed grant, and the claim must fall on the same UTC day); pg_cron jobs 404–407 (daily); the L7 registration (daily 12:05); both public keys and fingerprints | — | Nothing. |

## 3. Timeline for capture 2026-11-22 (recommended push slot B): feasible if the re-date is approved by Nov 21 14:00Z

**The keyed push must not land while a FORGE live game is armed.** FORGE live runs record `expected_code_version`. Every stage RPC returns `release_mismatch` when the deployed commit differs (`supabase/migrations/20261119230000_forge_live_pregame_run.sql`, lines 156–166 and 209). A BLSH push at, for example, Nov 21 19:30Z would therefore void FORGE's Nov 21 evening games.

FORGE stages run from about T−120 (capture) to T+1 (close). That puts Nov 21 games, with puck 18:00Z → 03:00Z, at about **Nov 21 16:00Z → Nov 22 03:01Z**, and Nov 22 games, with puck from 17:30Z, from about **Nov 22 15:30Z**. Two push slots avoid both:

| Slot | Keyed push (freeze starts) | Freeze length | FORGE effect | Earlier BLSH deadlines |
| --- | --- | --- | --- | --- |
| **B (recommended)** | **Nov 22 03:15Z** (22:15 ET Nov 21), after FORGE reads back its last Nov 21 close | about 9 h 35 min | None. No FORGE game is armed between 03:01Z and 15:30Z Nov 22. | Re-date approval by Nov 21 14:00Z |
| A | Nov 21 15:00Z, READY before FORGE's first Nov 21 arming | about 21 h 50 min | Nov 21 FORGE games must arm against the BLSH keyed SHA (master + BLSH). FORGE decides whether that needs its own approval. | Re-date approval by Nov 21 06:00Z |

Slot B's timeline runs backward from job 404 at 2026-11-22 12:05:00Z, about 46 h after this packet. "Plan" leaves margin. "Hard" is where a script, handler or the chain refuses, or where the chain stops fitting.

| Step | Owner and action | Plan | Hard latest |
| --- | --- | --- | --- |
| R0 | **TJ approves the re-date** (6.1) | Nov 20 22:00 | **Nov 21 14:00** (slot A: 06:00); otherwise target capture Nov 23 |
| 1 | L7 sign-off ([STEPS A](STEPS-L7-AND-CUSTODY.md)). Independent of the window. | Nov 20 (today) | Before the keyed push |
| 2 | Keypairs, fingerprints, independent recompute ([STEPS B0–B5](STEPS-L7-AND-CUSTODY.md)). Independent of the window. | Nov 20 (today) | Before B6 staging |
| 3 | Part B receipts for Nov 19 jobs 404/405 (still unanswered in the mailbox at 13:40Z Nov 20) | Nov 21 | Before go/no-go |
| 6 | DB owner confirms read-only that managed PostgREST accepts a 5,592,690-byte RPC body. Independent of the window. | Nov 20 (today) | Before INSTALL |
| R1 | Re-date engineering: web edit and tests, forward migration file, re-dated SQL, PG15 rerun, new pins, new dated proposal. About 6 h. | Nov 21 18:00 | Nov 21 22:00 |
| 7 | Review and pin the re-dated disarm set (DISARM-ROLLBACK, CANCEL-OFFICIAL-ONCE, SWITCH-OFF) | Nov 21 22:00 | Before ARM |
| R2 | **Apply the forward migration** (6.2) and read back the catalog | Nov 21 22:00 | Before INSTALL |
| F0 | **Last other production push READY** (FORGE included). In practice FORGE's own armed games already rule out pushes between about 16:00Z Nov 21 and 03:01Z Nov 22. | Nov 21 15:30 | Before B6 starts |
| 4a | **Stage both public keys and read them back** (6.3, STEPS B6). Staging is not a deployment; it is safe once F0 is READY and nothing else will deploy before 4b. | Nov 21 20:00 | Before the keyed push |
| 4b | **Keyed push** of the integrated SHA (master + L7 + re-date + any replay fixes) (6.3). **The freeze starts here.** Read back the READY deployment ID, Git SHA, alias and region. | Nov 22 03:15, once FORGE's last Nov 21 close is read back (READY about 03:30) | Nov 22 09:00 (leaves a rebuild margin) |
| 8 | **INSTALL** (re-dated) with those pins (6.5) | Nov 22 04:00 | Nov 22 12:04:59.999 |
| 9 | NST day-of clearance: no manual `/db`, other-lane or ad-hoc NST work 11:05–12:07; job 408 identified | Nov 22 11:00 | Nov 22 11:00 |
| 10 | **TJ dated go/no-go**, including the public-schedule slate check from section 1 | Nov 22 11:30 | Nov 22 11:30 |
| 11 | **ARM** (6.6) | Nov 22 11:45–12:00 | Nov 22 12:04:59.999 |
| 12 | **Window, Sun Nov 22 12:00–12:50 (07:00–07:50 ET).** Job 404 runs at 12:05. Disarm after the primary disposition and before 12:20. Request-context POST 12:35:00–12:35:59.999. Vault grant, then **SCHEDULE-ONCE** (6.7) 12:35:00–12:44:59. Official run at 12:45. CANCEL-OFFICIAL-ONCE after 12:46 if 12:45 did not fire, and at close in every case. | Present 12:00–12:50 | — |

If R0 or R1 misses its hard time, the same chain shifts +24 h to **capture Nov 23** (source Nov 22, 5 games). That needs its own re-date approval, because the date is a literal in every file above, and its own FORGE gap check: Nov 22 games end about 01:01Z Nov 23.

## 4. Release freeze: when FORGE can push

- **Start (slot B):** the moment the integrated keyed SHA is pushed to master, **planned Nov 22 03:15Z**. INSTALL and both signed grants bind that deployment ID, so any later production deployment voids them. Slot A instead starts at Nov 21 15:00Z.
- **Last FORGE push:** must be READY before BLSH key staging (4a). If keys are staged before a FORGE push, that FORGE build becomes the keyed build.
  - Under slot B this means **READY by Nov 21 15:30Z**, which is before FORGE's own Nov 21 arming in any case.
  - After that, FORGE pushes only once BLSH's freeze ends.
- **End:** **Nov 22 12:50:00Z**, once the official run has a terminal disposition and CANCEL-OFFICIAL-ONCE reads back no remaining job. On an abort, it ends earlier, as soon as the disarm set (DISARM-ROLLBACK, CANCEL-OFFICIAL-ONCE, and SWITCH-OFF if DISARM refuses) has committed and read back.
- **Length:** about 9 h 35 min for slot B, about 21 h 50 min for slot A. If the keyed push slips, the start slips with it; the end does not move.
- **Covered:** any new production deployment or alias change of the `fhfhockey` web project. That includes a Git push to master, a CLI deploy, an env-variable redeploy, a promotion, an instant rollback or an alias repoint. The one exception is the stop procedure's release-owner-approved alias repoint (`PILOT-APPROVAL.md`, item 6).
- **Not covered:** FORGE DB-only arming and its per-game pg_cron jobs. Nov 22 games start their stages around 15:30Z, after the freeze ends. They must still keep NST quiet 11:05–12:07 on Nov 22 (step 9). A text search of the forge-live files found no NST reference. Also not covered: local work and `refs/rc/` commits.
- **FORGE after the freeze.** From 12:50Z Nov 22, production runs the BLSH keyed SHA. FORGE arms Nov 22 games against it, or pushes its own release between 12:50Z and about 15:00Z, before its first Nov 22 arming.
- **FORGE push windows (slot B):** until Nov 21 15:30Z (READY); then none until Nov 22 12:50Z, or the earlier abort end.

## 5. Cost

- **Builds:** 1 production web build. The Nov 18 inventory also showed 3 ignored or canceled entries (cms, functions, root); re-inventory every linked project before the push. **Waiting for the re-date decision before the keyed push avoids a second build.**
- **Environment:** 2 production variables (public keys only).
- **Database:** 1 forward migration, INSTALL, ARM, DISARM-ROLLBACK, SCHEDULE-ONCE and CANCEL-OFFICIAL-ONCE, plus SWITCH-OFF only if needed. All short transactions on `fyhftlxokyjtpndbkfse`.
- **In the window:**
  - 2 NST GETs and 2 shared admissions;
  - 1 schedule GET;
  - 3 function invocations (≤250 s, 240 s, 240 s);
  - 1 pg_net GET;
  - up to 14 official boxscore GETs (cap 16), giving 44 official objects (3N+2) for 14 games;
  - storage up to 64 MiB of context and at most 71.125 MiB of official custody.
- **People:** TJ, the signer, the independent verifier, the DB owner, the operator and the shared NST owner. All must be present Sun Nov 22 12:00–12:50 (07:00–07:50 ET). Under slot B, TJ (push) and the DB owner (INSTALL) also act around Nov 22 03:15–04:00Z (22:15–23:00 ET Nov 21).

## 6. Approval lines for TJ (answer each on its own; none implies another)

1. **Re-date:** "I approve re-dating the BLSH v6 first live pilot from capture 2026-11-21 (source 2026-11-20) to capture 2026-11-22 (source 2026-11-21). The owners edit the three official-step files and their tests, write the forward migration, and re-date and re-pin the operator SQL. Nothing is applied, armed or pushed under this approval."
2. **Migration:** "I approve applying exactly the pinned forward re-date migration `<file, sha256>` to `fyhftlxokyjtpndbkfse`, with catalog readback."
3. **Keys and keyed release:** "I approve staging the two public keys with fingerprints `<request-context>` and `<official>` as fhfhockey production variables, then one push of integrated SHA `<sha>` to master."
4. **Freeze and push slot:** "I choose push slot B. I hold every fhfhockey production deployment from the keyed push (planned 2026-11-22 03:15Z, after FORGE's last Nov 21 close) until 2026-11-22 12:50Z, or an earlier completed disarm. FORGE pushes must be READY by 2026-11-21 15:30Z." (Slot A: push 2026-11-21 15:00Z, same end.)
5. **INSTALL** (re-dated, pinned) on `<release_sha>`, `<deployment_id>`.
6. **ARM** for capture 2026-11-22 only.
7. **SCHEDULE-ONCE** for the official run at 2026-11-22 12:45Z only.
8. **Go/no-go** for capture 2026-11-22, signed after blockers 1–9 and the slate check.

## 7. Still unknown

- **Production identity.** origin/master is `aa49b6c5e` as of Nov 20 about 13:40Z, after FORGE releases. Take every pin from step 4b's readback.
- **Part B outcomes** for Nov 19.
- **Job 408.** Not in the cron inventory; the DB owner identifies it read-only at step 9.
- **Managed pg_cron, pg_net, Vault and PostgREST behavior.** Proven only against stubs.
- **The replay.** Today's Nov 19 replay (`blsh-sandbox-run`) may require handler fixes; they ride in the same keyed build.
