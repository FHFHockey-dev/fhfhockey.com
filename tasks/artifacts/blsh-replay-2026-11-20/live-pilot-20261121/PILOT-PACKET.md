# BLSH v6 first live pilot: the earliest eligible slate (packet for TJ's separate approval)

> **Update 2026-11-21 about 21:50Z (15:50 CT).** TJ approved R0 (the Nov 22 slate) at about 20:1xZ. The re-date is now built as candidate **`16f5c46030a8d619b8be153bb79cbbf9f1e9baa2`** (`refs/rc/blsh-pilot-redate-20261122`), with the migration chosen as chain (a). Its SHA, hashes, gates and approval lines are in [PILOT-PACKET-ADDENDUM-REDATE.md](PILOT-PACKET-ADDENDUM-REDATE.md), which **supersedes** this packet's "no pilot SHA exists yet" (§4), "no re-date was written" (§10) and the `<…>` placeholders in §12. Everything else stands.

**Proposal only, not approved.** Written Sat 2026-11-21 about 20:00Z (14:00 CT) for TJ's resume-plan step 4. Nothing in it has been re-dated, built, pushed, staged, applied, installed, armed or enabled. The public BLSH gate stays closed. The hosted fixture replay (steps 1–3, BLSH Chef) is a separate lane and is **never** live acceptance. Times are UTC with CT (UTC−6) in brackets.

## 1. Decision

**Nominate the Sun Nov 22 slate: 5 games, captured Mon 2026-11-23 12:05–12:07Z (06:05–06:07 CT).**

**The Nov 21 slate is not eligible under TJ's rule,** even though the code would still accept it:
- **The code** only needs every slate game to be `OFF`/`FINAL` with schedule state `OK` at 12:05Z the next morning (`core.ts:189`). When a game started does not matter to it.
- **TJ's step 4** asks for "the earliest game that has not started" and forbids backfilling an in-progress game. 2026020359 (EDM @ CAR) was `LIVE` at the 19:51:55Z read.
- **The native capture is the whole slate.** It takes the capture UTC day − 1 (`sourceDate.ts`) and requires every game on that date to be final (`core.ts:179–199`). It cannot leave 0359 out. Whether the official step's signed `gameIds` could be a subset of the slate (1–16 IDs) is **not verified**: the DB claim binds the native schedule hash, and I did not trace a slate-equality check either way. The native NST packet would contain 0359 regardless.
- **So any Nov 21 pilot includes a game that started before anything was approved.** Section 9 gives the Nov 21 hard times in case TJ overrules.

**Proposed reading of the rule, for TJ to confirm:** "not started" is tested at TJ's approval of this packet and the re-date (line 1). That must land before the first Nov 22 puck, 2026-11-22 17:30Z (11:30 CT Sun). If it misses that time, this nomination expires unused and rolls to the next slate in section 2.

**Two realistic paths, set by when R0 lands** (section 5 gives the full times):
- **Gap A (strict, tight):** approve by **Sun 11-22 05:00Z (23:00 CT Sat, tonight)**. The keyed build then lands before the first Nov 22 puck, if FORGE has nothing armed (P4).
- **Gap B (realistic default):** approve by **Sun 11-22 17:30Z (11:30 CT)**. The build lands Sun evening CT, after the Nov 22 games have started. The code permits that, because capture is post-game, and no game is backfilled. TJ should confirm that this satisfies the rule.

**The two blockers are TJ's R0 approval (by the deadline for gap A or gap B) and the new re-date engineering,** estimated at about 6–8 h.

**It needs a new re-date.** The pilot dates are literals in the code, the database and the operator SQL, and all of them currently say slate Nov 21, capture Nov 22. TJ's 17:40Z "do not re-date the live pilot" applied to the replay recut; this packet only proposes a re-date, as approval line 1.

## 2. Official schedule (read-only)

One public GET: `https://api-web.nhle.com/v1/schedule/2026-11-21`, at 2026-11-21 19:51:55Z, HTTP 200. Snapshot: [nhl-schedule-2026-11-21-read-195155Z.json](nhl-schedule-2026-11-21-read-195155Z.json), sha256 `e48fe8aa4d2d37caba07cc514d1201bd0fcad35410ce2f4213b0fc85d4787b52`, 113,826 B. There were no NST requests.

| Slate (ET date) | Games | Puck range UTC (CT) | State at read | Capture window | Eligible? |
| --- | --- | --- | --- | --- | --- |
| Sat 11-21 | 14 (0359–0372) | 11-21 18:00Z → 11-22 03:00Z (12:00 → 21:00 CT) | 0359 `LIVE`; 13 `FUT` | Sun 11-22 12:05Z | **No.** 0359 had started (section 1). |
| **Sun 11-22** | **5 (0373–0377)** | **11-22 17:30Z → 11-23 01:00Z (11:30 → 19:00 CT)** | all `FUT`/`OK` | **Mon 11-23 12:05Z (06:05 CT)** | **Earliest eligible** |
| Mon 11-23 | 7 (0378–0384) | 11-24 00:00Z → 03:00Z | `FUT` | Tue 11-24 12:05Z | Fallback 1 |
| Tue 11-24 | 1 (0385) | 11-25 01:00Z | `FUT` | Wed 11-25 12:05Z | Fallback 2 (one game) |
| Wed 11-25 | 14 (0386–0399) | 11-26 00:00Z → 03:00Z | `FUT` | Thu 11-26 12:05Z | Fallback 3 |
| Thu 11-26 | 0 | none | — | — | No (empty) |
| Fri 11-27 | 15 (0400–0414) | 11-27 18:00Z → 11-28 01:00Z | `FUT` | Sat 11-28 12:05Z | Fallback 4 (15 ≤ 16) |

**Target games (Nov 22 slate),** all regular season (`gameType` 2):

| Game | Matchup | Puck UTC (CT) |
| --- | --- | --- |
| 2026020373 | CAR @ NYR | 17:30Z (11:30) |
| 2026020374 | BUF @ TBL | 22:00Z (16:00) |
| 2026020375 | EDM @ STL | 11-23 00:00Z (18:00) |
| 2026020376 | PIT @ DAL | 11-23 00:00Z (18:00) |
| 2026020377 | CHI @ VAN | 11-23 01:00Z (19:00) |

The official grant's `gameIds` would be these five, ascending.

## 3. Cutoff rules, from the code at R″ `39a15979651e004dad235fe70d86089595ec1092`

| Rule | Source | Effect for the Nov 22 slate |
| --- | --- | --- |
| The native slate is the capture UTC day − 1. The window is [12:00, 12:30)Z, and jobs 404/405 fire at 12:05 and 12:20. | `sourceDate.ts` | Capture Mon 11-23 → slate 11-22. Not date-bound; no change needed. |
| Every slate game must be `OFF`/`FINAL` and `OK`, otherwise the run fails closed with `schedule_game_incomplete_or_wrong_scope`. | `core.ts:189` | All five must be final by 12:05Z Nov 23. The last puck is 01:00Z, so there is about 11 h of margin. A postponement kills the window. |
| The request-context signed slate must equal the ingress UTC day − 1, otherwise `skipped outside_approved_date`. The live route never passes `replayDateGate`. | `requestContextHandler.ts:203–210` | POST 12:35Z Nov 23 → slate 11-22. Not date-bound. |
| The official slate and slot are literals: `SOURCE`/`SOURCE_DATE = "2026-11-21"`, `OFFICIAL_SLOT = 2026-11-22T12:45:00Z`. | `officialPilotHandler.ts:7`, `officialPilotStore.ts:7`, `officialPilotAcquisition.ts:11` | **Re-date needed:** slate 2026-11-22, slot 2026-11-23T12:45Z. |
| The DB check and claim window are literals: `source_date = 2026-11-21` and claim [11-22 12:45, 12:46). They are not applied in production; production still holds the 11-18 version (11-20 / 11-21 12:45). | `20261118155445` (applied), `20261120143000` (not applied) | **A new forward migration is needed** (section 5, R3). |
| INSTALL refuses at or after capture 12:05; its permit is [12:05:00, 12:07:00) for that slate. ARM needs the same pins, before 12:04:59.999. | `redate-20261122/INSTALL.sql:21–55`, `ARM.sql` | **Operator SQL re-date needed** (capture 23, slate 22, objects `_20261123`). |
| SCHEDULE-ONCE is allowed 12:35:00–12:44:59, with cron `45 12 <day> 11 *` and Vault `blsh_official_grant_<slate>`. | `redate-20261122/SCHEDULE-ONCE.sql` | Re-date: `45 12 23 11 *`, `blsh_official_grant_20261122`. |
| **L7 NST registration is not in R″.** It was held out on purpose (`eb7f9f97c`: "ships in a later build, before INSTALL, with its own closure verification"). The runtime does not read it, but the readiness packet makes it blocker 1. | `web/lib/cron/nstCoordination.ts`, `nstClassification.ts` | **The pilot build must re-add it** and re-verify the FORGE producer closure. |
| INSTALL, both signed grants and the official claim bind one `deployment_id` and `release_sha`. | RELEASE-PLAN §1 | Any production deployment between INSTALL and the official close voids the run, so a freeze runs from INSTALL to 12:50Z. |
| A FORGE live run records `expected_code_version`, and any push while a FORGE run is armed returns `release_mismatch`. | `20261119230000_forge_live_pregame_run.sql` | The pilot push must land while no FORGE run is armed (precheck P4). |
| **Already-started games.** The code allows them, because capture is post-game. Do not backfill one. | TJ step 4 | That is the reason for this nomination. Nothing here re-runs or backfills 0359 or any game already played. |

## 4. The exact SHA and artifacts

**No pilot SHA exists yet.** R″ `39a159796` is the replay build. It can't run this pilot, because it carries the Nov 21/22 literals and omits L7. The pilot candidate is cut from **actual origin/master at cut time**. At 19:5xZ that was `096b78b622a72a8378b8f60c0c7704fc4e2fee41`, per `git ls-remote`; it becomes R″ or its merge if the replay push lands first. The cut is master plus the re-date (R1–R3) plus the L7 re-add, and its SHA and hashes go into a short addendum to this packet before lines 3–5.

**Templates.** These are Nov 21-slate files at R″, and the re-date copies them mechanically. **Do not run any of them for this target.** In particular, `INSTALL e51a9a96…` would still open a Nov 21-slate permit until 2026-11-22 12:05Z.

| Template at R″ (Nov 21 slate) | sha256 |
| --- | --- |
| `supabase/migrations/20261120143000_blsh_official_pilot_redate_20261121.sql` | `ce14c532f1b9169e52a310e7a3affb29c27b37a00f0bcf08e022de539e7f0f7b` |
| `…/live-readiness-2026-11-20/redate-20261122/INSTALL.sql` | `e51a9a967b8b72f8cdb9178f6f933ed80bdfd1cf6d28e1255fd532654297bc87` |
| `…/redate-20261122/ARM.sql` | `d28d1ef9bad47cf0eb0d66028e3150f2d91fced9d56bb4b8154ea455436f0f31` |
| `…/redate-20261122/DISARM-ROLLBACK.sql` | `513b28b5a82d58389a5b3df1de42265cc63e7928b76d3eedc6d27d95478fa30e` |
| `…/redate-20261122/SCHEDULE-ONCE.sql` | `600699bae9fb9a064fceea6563c662676388cdb7fbd4c9d24a41db5e93f49bf1` |
| `…/redate-20261122/CANCEL-OFFICIAL-ONCE.sql` | `a9b39d83cd2ae033cd6827bffcfbe2dc9b88bc69842dcfd4c3147b98d55cc81c` |
| `…/redate-20261122/PRECHECK-READONLY.sql` | `8a8e0732fd6f02a811065dfa69dc5fb1147c901e6cb98581c322b4aa58596932` |
| `…/redate-20261122/pg15-validate.py` | `ed6910baf911e3dffc686445f27bfd203720ec7a81f6e5f360d37ce14d0c7e39` |
| `…/live-readiness-2026-11-19/SWITCH-OFF.sql` (no date; **reused as is**) | `19abbc7f23ec69df490dd5ca4bd226353c421fe72bdf51460ad155c6f5c0ed33` |
| `…/live-readiness-2026-11-20/STEPS-L7-AND-CUSTODY.md` (L7 and keys procedure, reused) | `7fcb4a2a31ef48e87a1cec852cf955f298ba6bc84fdad14a663883555ac85962` |
| L7 registration source: readiness RC `26f7aec974b389f21f08de5a5cfd9dd4ba4c4adf` (commit `1a6e54239`), held out by `eb7f9f97c` | — |

`…` = `tasks/artifacts/blsh-pilot-readiness-2026-11-14`. The hashes match REDATE-RECEIPT.md.

**What the re-date must produce** (estimate **about 6–8 h** of engineering, from the ~6 h Nov 20 re-date plus L7 and closure gates):
- **Web:** the three official literals (slate 2026-11-22, slot 2026-11-23T12:45Z), their tests (add the retired 11-21 slate/11-22 slot as refusals), `readHostedOfficialV6.mjs`, and the `prepareV6Observation` test shift.
- **L7 re-add:** revert `eb7f9f97c`'s four files, then rerun `lib/cron` and the cron-audit suites.
- **FORGE closure:** recompute it on the exact candidate. It moves off `0446100e`/`cdf87b73` because the L7 files are inside it, and the FORGE lane must re-admit the new hash.
- **Migration:** a new forward migration (section 5, R3).
- **Operator SQL** in a new `redate-20261123/`: INSTALL, ARM, DISARM-ROLLBACK, SCHEDULE-ONCE, CANCEL-OFFICIAL-ONCE and PRECHECK-READONLY, each with new hashes.
- **Proof:** a PG15 harness rerun and `supabase/tests/blsh_official_pilot.py`.
- **Gates:** vitest (lib/blsh, scripts/blsh, lib/cron, cron-audit), `npm run typecheck` (read the exit code), lint, and the CSS pure check if any `.module.scss` is touched.

## 5. Ordered steps

Mark: **RO** = read-only, **W** = write, **TJ** = needs TJ's own approval (each line on its own; none implies another).

**Push gaps (assumed, not established).** These are inferred from puck times only, and P4 governs. The Chef diary shows FORGE armed 0359 at 15:17Z for an 18:00Z puck, so arming can come well before T−120. It records only 0359 armed on Nov 21, closed at 18:01Z.
- **Gap A** is after FORGE's last Nov 21 close and before any Nov 22 arming: assumed about **Sun 11-22 03:05Z → 15:15Z (21:05 Sat – 09:15 CT)**. A Nov 22 FORGE arming before 15:15Z shortens it.
- **Gap B** is after FORGE's last Nov 22 close and before INSTALL: assumed about **Mon 11-23 01:05Z → 08:00Z (19:05 Sun – 02:00 CT Mon)**.

| # | Step | Mark | Gap A: hard latest UTC (CT) | Gap B: hard latest UTC (CT) |
| --- | --- | --- | --- | --- |
| R0 | **TJ approves line 1 (re-date) and this packet's target.** | TJ | **Sun 11-22 05:00Z (23:00 Sat)** | **Sun 11-22 17:30Z (11:30)**, the proposed not-started cutoff; after that, roll to fallback 1 |
| R1 | Re-date engineering, local only, in a new lane (section 4 list). About 6–8 h; no production contact. | W (local) | 11-22 12:30Z (06:30) | 11-22 23:30Z (17:30) |
| R2 | Independent review of the re-date diff, the L7 re-add and the new SQL pins; then the FORGE lane re-admits its closure hash. | RO | 11-22 13:30Z (07:30) | 11-23 00:30Z (18:30) |
| G1 | **L7 sign-off**: the L7 reviewer and the shared NST owner review the re-added registration (STEPS A1–A5). About 20 min, after R1. | TJ | 11-22 14:00Z (08:00) | 11-23 00:45Z (18:45) |
| G2 | **Keypairs off-Mac** (STEPS B0–B5): two Ed25519 keypairs and their fingerprints, recomputed by the independent verifier. About 30 min, any time, independent of R1. Planned for Sun daytime CT. | TJ | 11-22 14:00Z (08:00) | 11-23 00:45Z (18:45) |
| G3 | Part B receipts (Nov 19 jobs 404/405); managed PostgREST 5,592,690-byte ingress check (DB owner); review and pin of the re-dated disarm set. | RO | Before INSTALL | Before INSTALL |
| R3 | **Migration (line 2).** First `PRECHECK-READONLY` (RO, needs TJ's OK for a production read). Then apply. The DB owner chooses the chain: **(a)** apply `20261120143000` (guard: definition hash `5893416f…`), then a new `20261122…` (guard: `4efee291…`), which keeps repo history linear and is recommended; or **(b)** one new migration straight from `5893416f…` → slate 11-22, leaving `20261120143000` unapplied. The guards make order matter, so do not mix the two. Read back the precheck. Either order relative to the push is safe. | TJ / W | Before INSTALL | Before INSTALL |
| K | **Keys and keyed release (line 3).** Stage both public keys as fhfhockey production variables (STEPS B6, `--stdin --expect` readback). Re-inventory every linked Vercel project. Then **one push of the exact pilot SHA** and read back the READY deployment ID, SHA, alias and region. Expect 1 web build plus the canceled/ignored entries (Nov 18: 1 + 3). Only once P4 passes. | TJ / W | Push by 11-22 15:00Z (09:00), READY before any Nov 22 FORGE arming | Push by 11-23 08:00Z (02:00 Mon); plan 01:30Z (19:30 Sun) |
| I | **INSTALL (line 4)** with pins from the K readback, repeated right before. **The freeze starts here.** | TJ / W | **11-23 12:04:59.999Z** (plan 03:00Z, 21:00 CT Sun, after FORGE's last Nov 22 close readback) | same |
| N | NST day-of clearance: no manual `/db` runner, other lane or ad-hoc NST work 11:05–12:07Z (05:05–06:07 CT). Identify job 408. | RO | Mon 11-23 11:00Z (05:00) | same |
| GO | **TJ's dated go/no-go (line 5)**, including a public-schedule check that 0373–0377 are all `OFF`/`FINAL` and `OK`. | TJ | 11-23 11:30Z (05:30) | same |
| A | **ARM (line 6)** for capture 2026-11-23 only. Plan 11:45–12:00Z (05:45–06:00). | TJ / W | 12:04:59.999Z | same |
| W1 | Job 404 at 12:05Z. Disarm after the primary disposition and before 12:20Z (06:20). | W | 12:20Z | same |
| W2 | Request-context POST, signed against the readback deployment. | TJ (signer) / W | 12:35:00–12:35:59.999Z (06:35) | same |
| W3 | **Vault `blsh_official_grant_20261122`, then SCHEDULE-ONCE (line 7).** | TJ / W | 12:35–12:44:59Z | same |
| W4 | Official run at 12:45Z. Run CANCEL-OFFICIAL-ONCE after 12:46Z if it did not fire, and at close in every case. Read back: no job remaining. | W | 12:50Z (06:50) | same |
| E | The freeze ends at 12:50Z (06:50 CT), or earlier at a completed disarm. | RO | — | — |

People present Mon 11-23 12:00–12:50Z (06:00–06:50 CT): TJ, the signer or custodian, the independent verifier, the DB owner, the operator and the shared NST owner.

## 6. Prechecks (all read-only; each blocks its step)

- **P1 (before R1):** `git ls-remote origin refs/heads/master` and the READY production SHA. Cut the candidate from that exact SHA. If master moves before step K, re-merge and rerun the gates.
- **P2 (before R3):** `PRECHECK-READONLY` (re-dated). The expected result depends on the chain chosen. Anything else means stop.
- **P3 (before step K):** the L7 sign-off is recorded; the key fingerprints are recomputed and match; the FORGE lane re-admits the new closure hash.
- **P4 (immediately before step K):** **no FORGE live run is armed** (`live_runs` open = 0, no forge-live jobs) and no other push is in flight. This packet cannot see FORGE's Nov 22 arming plan, so P4 is a live check, not an assumed window.
- **P5 (before INSTALL):** repeat the release readback. Read `blsh_capture_control.enabled = false`, jobs 404–407 unchanged, no permit installed, and the migration readback in the expected state.
- **P6 (at GO):** all 5 games `OFF`/`FINAL`/`OK` (public schedule, never NST); the NST clearance is confirmed; G3 has cleared.

## 7. Stop conditions (no ARM, or disarm immediately)

Stop on any of these:
- R0 is not approved by 2026-11-22 17:30Z (11:30 CT). The nomination expires; re-propose fallback 1, which needs its own re-date.
- A precheck or readback mismatch: migration state, fingerprints, deployment ID or SHA, the closure hash, or the permit row.
- A FORGE run is armed at push time, or any production deployment or alias change between INSTALL and close.
- A slate game is postponed or not final at GO; the native step would fail closed anyway.
- The NST clearance is not confirmed, or any NST traffic is outside the shared admission ledger.
- Any hard-latest time is missed. Never extend a window.
- Any step would need a write this packet did not name.

## 8. Disarm and rollback

- **Disarm set (pinned, re-dated):** DISARM-ROLLBACK, then SWITCH-OFF if DISARM refuses (raw switch on, no permit), then CANCEL-OFFICIAL-ONCE (DISARM never touches `cron.job`). Read back raw and effective switch off, no permit, no `blsh-official-once-*` job, and jobs 404–407 unchanged.
- **Migration:** forward-only, with no destructive rollback. Leaving the check at slate 11-22 is inert: the official route refuses without a grant signed by TJ's keys, and the claim window passes once 11-23 12:46Z is over.
- **Release:** no rollback is needed for safety, because production runs BLSH closed until INSTALL. Before INSTALL, a later push simply supersedes it. After INSTALL, only the stop procedure's release-owner-approved alias repoint applies.
- **Keys:** the public keys alone grant nothing. Remove them only on TJ's instruction; an env-only change of unchanged web code is canceled by the Ignored Build Step.

## 9. If TJ overrules and wants the Nov 21 slate anyway (not recommended)

Capture Sun 11-22 12:05Z (06:05 CT), window 06:00–06:50 CT. It is still technically possible only if all of the following hold:
- **The keyed build is R″ plus L7.** R″ alone lacks L7, so this means a second build after the replay's R″ push, or one replacing it, with its own closure verification. The keys (G1, G2, B6) are staged before it.
- **It pushes only outside armed FORGE runs.** FORGE's Nov 21 games are assumed to close about 03:01Z Nov 22 (puck-based, not established; P4 governs), which leaves about 11-22 03:05Z → 08:00Z (21:05 Sat – 02:00 CT Sun).
- **The migration `20261120143000` (`ce14c532…`) is applied** after PRECHECK `ready_to_apply`.
- **INSTALL `e51a9a96…` runs by 11-22 12:04:59.999Z,** then GO at 11:30Z, ARM by 12:04:59.999Z, and SCHEDULE-ONCE `600699ba…` at 12:35–12:44:59Z.
- **The cost:** the pilot then contains 0359, which had started before approval, against TJ's step-4 rule. It also puts TJ and the DB owner at work overnight Sat→Sun CT.

## 10. Explicitly NOT done or included

- No public BLSH: the public gate stays closed before, during and after.
- The hosted fixture replay (R″ `39a159796`, its installer and receipts) is **not** live acceptance and is not counted toward this pilot.
- No backfill or re-run of 2026020359 or any game already started or played.
- **This lane did none of the following:** arming, INSTALL, migration, key staging, Vercel env change, deploy, push or production SQL. Its only external request was one public NHL schedule GET, and it sent no NST requests.
- No re-date was written; that is approval line 1's work, done in its own lane.
- No change to FORGE's schedule or arming. P4 only reads it.

## 11. Unknown (searched, no receipt found)

Searched: the BLSH Chef diary `2026-11-19-claude-forge-blsh-chef.md`, the readiness receipt and handovers in `side-session-notes/local_23eb6989…`, and the recut handover in `side-session-notes/local_f83c2634…`.
- **G2 keypairs/fingerprints and whether either public key is on Vercel.** The last readback, Nov 18, showed both absent.
- **G1 L7 sign-off.**
- **Part B receipts** for Nov 19 jobs 404/405.
- **The managed PostgREST ingress check.**
- **Job 408's identity.** The Chef diary shows it off on Nov 21.
- **Whether the replay lane's R″ push lands, and when.** It changes the base for P1, not this plan.
- **FORGE's Nov 22 arming times.** They decide whether gap A is fully free; checked live at P4.

Known (Chef diary 18:16Z and 19:32Z Nov 21, read-only):
- `20261120143000` is not applied;
- `blsh_capture_control.enabled = false`;
- jobs 404–407 are active but no-op;
- 0 replay jobs and the sandbox reset;
- master and production are `096b78b62`.

## 12. Approval lines for TJ (each separate)

1. **Re-date:** "I approve re-dating the BLSH v6 first live pilot to capture 2026-11-23 12:05–12:07Z on the 2026-11-22 slate (games 2026020373–2026020377), and re-adding the L7 NST registration, as local edits, tests and pins only. Nothing is applied, staged, pushed or armed under this line." Due by 2026-11-22 17:30Z (11:30 CT).
2. **Migration:** "I approve a read-only precheck, then applying exactly `<chain (a) or (b), file(s), sha256>` to `fyhftlxokyjtpndbkfse`, with precheck readback."
3. **Keys and release:** "I approve staging the two public keys with fingerprints `<request-context>` and `<official>`, then one push of pilot SHA `<sha>` to master, in gap A (or B), once P4 shows no armed FORGE run."
4. **INSTALL and freeze:** "I approve INSTALL `<sha256>` with `<release_sha>`/`<deployment_id>`, and I hold every fhfhockey production deployment from INSTALL until 2026-11-23 12:50Z, or an earlier completed disarm."
5. **Go/no-go** for capture 2026-11-23, signed after G1–G3 and P6.
6. **ARM** `<sha256>` for capture 2026-11-23 only.
7. **SCHEDULE-ONCE** `<sha256>` for the official run at 2026-11-23 12:45Z only.
