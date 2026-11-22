> **SUPERSEDED, Sun 2026-11-22 02:20Z.** Master moved to `53f1929a1` (the FORGE daily acceptance route, approved by TJ), so Y `1efdfb436` no longer fast-forwards. With the pilot held, Y will not be pushed. The next BLSH candidate is a new re-date (planned slate Nov 27), cut on the then-current master with a fresh X/Y, closure, receipt, line F and A5 re-confirmation.

> **HOLD, Sun 2026-11-22 about 00:2xZ (Sat 18:2x CT). The gap-B push for the Nov 22 slate is not going ahead.**
> - **Why:** TJ requires a managed off-Mac signer: two non-exportable Ed25519 keys, workload-authenticated, issuing only the two pilot approvals on verified evidence. He also asked for no manual signing and no second computer.
> - **What that takes:** designing the signer, an isolated proof, TJ's custody review, setup, and a new pilot candidate (an automated request-context POST and Vault hand-off) with its own gates. That cannot finish by Sun 18:45 CT without rushing.
> - **Next:** the managed-signer lane brings the proposal, the proof and the earliest eligible slate.
> - **What still holds:** line F for Y `1efdfb436` and the NST-owner PASS. Astra's L7 review of the four NST files stays valid while those files are unchanged.
> - **Nothing reached production:** no key, migration, push, INSTALL, ARM or schedule.

# BLSH live pilot: exact approval packet (Nov 22 slate). NOTHING HERE IS APPROVED.

Written Sat 2026-11-21 about 23:10Z (17:10 CT) by BLSH Chef. Local prep and read-only checks only: no migration, key, push, build, INSTALL, ARM or schedule. The public gate stays closed. The hosted fixture replay (`c922514df`) is closed and **not** counted as live acceptance.

Target: slate 2026-11-22 (games 2026020373–2026020377). Native capture Mon 2026-11-23 12:05Z (06:05 CT). Request-context 12:35Z. Official dispatch 12:45Z (06:45 CT).

> **TJ, Sat ~23:3xZ: LINE F APPROVED for Y `1efdfb436`, registration only (no push). Never push X `b5e18f49` alone.**
>
> **TJ decision, Sat 23:15Z (17:15 CT): plan GAP B.** The push window is Sun 19:05 CT – Mon 02:00 CT, planned 19:30 CT, on the same slate with the same Mon 06:05 CT capture. The 09:00 CT plan is not used. The gap-B tripwires (Sun, CT) are:
> - G1 roles named by 12:00, and G1 sign-off (A1–A5) by 18:45;
> - G2 keypairs and verifier fingerprints by 18:45;
> - line F by 18:45, after the FORGE recompute;
> - K1 keys staged by 19:15;
> - P4 at 19:25;
> - K2 push by 19:30 (hard latest Mon 02:00);
> - line 2 migration about 20:00;
> - INSTALL about 21:00.
>
> If master moves before K2, Y is re-cut (X′/Y′) and line F is asked again. Missing the hard latest rolls the pilot to the Nov 23 slate (§6).

## 1. Call on the Sunday 09:00 CT (15:00Z) keyed-push cutoff: CONDITIONAL GO

Nothing on the engineering side blocks 09:00 CT: the candidate is merged onto actual master, gated and registry-ready. **Every remaining blocker before the push is TJ's**, so the GO holds only if each tripwire in §5 is met. **Missing any one is an automatic NO-GO for 09:00 CT. Nothing is rushed or extended.** The plan then rolls to gap B on the **same** slate (§6).

## 2. Exact candidate

| Item | Value |
|---|---|
| **Push candidate Y** | **`1efdfb4364dffa73a9c249f382dbfebe22ebbbd2`** (`refs/rc/blsh-pilot-redate-20261122-y`, tree `0b3ef7de…`). Its sole parent is X, so it fast-forwards master. |
| X (verified merge) | `b5e18f49078addde4bda3e5679e5602f8ed58393` (`refs/rc/blsh-pilot-redate-20261122-x`, tree `59691857…`). Parents: master `523ba0108` and pilot `16f5c4603`. Clean merge-tree, nothing resolved. |
| Y − X | The X receipt (`b5e18f49….json`, sha256 `8c2d3a3c…`), plus the registry entry appended last in `verifiedForgeReleases.ts` (+8), plus 1 test row. |
| Base checked | `origin/master` = `523ba01085776f9d2be345028bff919a243f77ae`. READY production `dpl_w4ThHx3Y9McLFEYUygUusxGPRfkh`, sha `523ba0108`, aliases fhfhockey.com and www (Vercel API, 23:0xZ). |
| Validity | **Y is valid only while master = `523ba0108`.** If any lane pushes first, the pilot lane re-cuts X′/Y′: merge, gates (about 15 min) and the FORGE recompute, and line F is asked again for the new closure. Budget about 45 min. |

**Gates on exact X** (clean export; all rerun; I read the outputs and exit codes myself; files in `evidence-rebase-523ba0108/`, `SHA256SUMS` `2919fc86…`):

| Gate | Result |
|---|---|
| `pg15-validate.py` | 69/69, exit 0, identical to the committed `.out` |
| `supabase/tests/blsh_official_pilot.py` | 3/3, exit 0 (official acceptance at 2026-11-23 12:45:05 for slate 2026-11-22) |
| Related vitest (8 sources) | 519/519, exit 0 |
| Registry test on Y | 28/28, exit 0 |
| typecheck | exit 0 |
| lint | exit 0 (69 pre-existing warnings, none in touched files) |
| CSS pure check | 241/241 |
| SOURCE_PINS | 10/10 |
| FORGE verifier | X closure **`d6520f1c72711fcd151c1484f81c0379fc15c57e80963e72e024c1cd4e23e1e2`**: 243 modules, 0 findings. It differs from master's `0446100e` only through the restored L7 files. Y has the same closure. |
| **Known red, not clean** | (1) Focused vitest has 19 failures, all `bootstrap_wrong_checkout` in `nativeProcessCaptureBootstrap.test.ts`. The test only accepts the canonical checkout path, and the same 19 fail on R′ and `16f5c4603`. Owner: BLSH Chef. Not a pilot blocker. (2) `supportedBaselineMigration.test.ts` fails 1/21: `migration-authority.json` has 156 entries against 168 migrations. It was red before this candidate. Owner: the migration-authority owner (unassigned; TJ to name). Not a pilot blocker. |

## 3. Read-only hosted checks (22:58–23:00Z; `evidence-ledger-20261121/`, `SHA256SUMS`)

- **PRECHECK-READONLY** (`6a3ff596…`, READ ONLY transaction): `apply_20261120143000_first | CHECK (source_date = '2026-11-20') | 5893416f… | 0`, the expected pre-migration state.
- **Ledger:** it matches Y's `supabase/migrations` exactly through `20261121205959` (Luna), the hosted maximum. Neither pilot migration is recorded.
  - **Correction to my earlier reading:** `20261121210000` sorts after the maximum, but **`20261120143000` is older than three applied versions** (`20261121184000`, `190000`, `205959`). `supabase db push` would refuse it as out of order unless forced, and a forced push from the canonical checkout would also pick up the untracked `20261121173000_sync_tweet_review_sources_v1.sql`.
  - **So line 2 uses the established per-file method, not `db push`.** Each file is applied from Y's exact blob in its own transaction, together with `insert into supabase_migrations.schema_migrations (version, name)`, the same pattern as `apply-visibility-156.sh`. Order: `20261120143000`, then `20261121210000`.
  - **The hash check is the catalog definition hash via PRECHECK, not a ledger-body match.** The BLSH and FORGE ledger rows store no statement bodies.
  - Each file's own guard refuses if run out of chain order.
- `blsh_capture_control.enabled = false`. Jobs 404–407 are active (no-op while the switch is off). Job 408 `forge-pregame-hosted-dispatch` is inactive.
- FORGE `forge_pregame_capture.live_runs`: 0 open (only 0359, succeeded). The FORGE Lane confirms **no Nov 22 FORGE arming is planned or approved**. Its 10:05Z daily run and 11:15Z read-only check end before any push.
- Vercel production: **`BLSH_REQUEST_CONTEXT_APPROVAL_PUBLIC_KEY` and `BLSH_OFFICIAL_PILOT_APPROVAL_PUBLIC_KEY` are both absent.**

## 4. Owners and status

| Item | Owner | Status |
|---|---|---|
| Re-merge and gates (X, Y) | blsh-live-pilot lane | **Done** (above) |
| FORGE registry entry (line F evidence) | 11/21 FORGE Lane | **ACCEPTED Y `1efdfb43` (owner-verified):** `daily-offday-release-2026-11-21/blsh-registry-review/VERDICT.md`. The owner recomputed X's closure as `d6520f1c` in a clean export, matched the receipt (`8c2d3a3c`), and ran the registry test on Y (28/28). Build admission passes on Y and fails on X alone, **so the pushed tip must be Y, never X.** Line F is still TJ's decision. |
| Custody docs, dated correction | BLSH Chef (designated owner, pilot addendum §7) | **Done in the working tree (uncommitted):** `CUSTODY.md` (window 11-23 / slate 11-22, Vault **`blsh_official_grant_20261122`**) and `STEPS-L7-AND-CUSTODY.md` (review X `b5e18f490`; A2 now expects 4 files, +48/−3; B0 checker blob unchanged). Y still carries the old text, so operators must use the working-tree copies. |
| G1 L7 sign-off | Reviewer: Codex Astra, for the code review (independence confirmed; the prompt is `L7-REVIEW-PROMPT-ASTRA.md`). Shared NST owner: 11/21 FORGE Lane. | **NST owner: PASS** (mailbox `BLSH-L7-NST-OWNER-20261121`; admission sign-off only). The FORGE Lane holds day-of 11:05–12:07Z for its own lanes; day-of N must also read the route-runner queue and audits at about 11:55Z. **L7 review: PASS** (Astra, independence confirmed; mailbox `BLSH-L7-REVIEW-20261121` 23:28Z; vitest 575/575 in 43 files; typecheck exit 0). **TJ A5 APPROVED** (Nov 22 about 00:4xZ): the L7 registration on X `b5e18f490` is approved for integration in the single keyed BLSH release, with Y `1efdfb436` as the reviewed push tip and no FORGE bundling. It does not approve a push, key staging, migration or arming. **G1 is complete.** If a re-date changes X or Y, A5 must be re-asked only if the four NST files change. |
| G2 keypairs | TJ, off-Mac (B0–B5, about 30 min), then the independent verifier recomputes the fingerprints | Not started (both keys absent) |
| Line 2 apply script | BLSH Chef (pilot lane wrote it) | **Done:** `redate-20261123/apply-pilot-migrations.sh` sha256 `26a0a326a39dcae29aae7de2e4c00a97e5dc6e2293b7633bac7f0988bcead914` (working tree, not in Y). PG15 rehearsal 51/51 (`rehearse-apply-pilot-migrations.out` `d05c340a…`).<br>**What it does:** reads both files and PRECHECK from Y's blobs and checks their hashes; requires the ledger-max pin `20261121205959`; commits each file together with its ledger row; reads back after each.<br>**Starting from `ready_to_apply`,** it requires the first file's ledger row, which is what a mid-chain stop leaves. Chef accepted this reading.<br>**Read-only hosted check (23:5xZ):** the `postgres` role is not a superuser but owns `blsh_official_claim_v1` and `blsh_official_runs`, and has INSERT on `supabase_migrations.schema_migrations`.<br>**Untested:** session-pooler behaviour (the existing `pgpool.sh` session mode). |
| G3 (Part B receipts 404/405, ingress check, disarm-set pin review) | read-only; DB owner for ingress | Before INSTALL, not before the push |

## 5. Gated steps with tripwires (CT, Sun Nov 22 unless noted; each line needs its own approval)

**Dependency:** the keys must be staged **before** the push, because environment variables bind at build time and an env-only redeploy is canceled by the Ignored Build Step. Keys added after the push would need a second build.

| # | Step | Who | Tripwire (miss = NO-GO for 09:00) |
|---|---|---|---|
| D1 | **First decision:** run the 09:00 CT plan, name the G1 roles, and commit to a G2 slot | TJ | Sat 23:00 CT (05:00Z) |
| G2 | Two Ed25519 keypairs off-Mac; the verifier recomputes the fingerprints | TJ + verifier | 07:30 (13:30Z) |
| G1 | L7 review of X (A1–A4) and **TJ line A5** | named reviewers + TJ | 08:00 (14:00Z) |
| F | **Line F:** admit closure `d6520f1c…` of X, as Y. Needs the FORGE recompute back first. | TJ | 08:00 (14:00Z) |
| K1 | **Keys line:** stage both public keys in fhfhockey production (`--stdin --expect` readback); **no build** | TJ | 08:30 (14:30Z) |
| P4 | Read-only, immediately before the push: master still `523ba0108`; live_runs open 0; forge-live jobs 0; no push in flight; both keys read back | BLSH Chef | 08:50 (14:50Z) |
| K2 | **Push line:** `git push origin 1efdfb4364dffa73a9c249f382dbfebe22ebbbd2:refs/heads/master` (fast-forward only). Expect 1 fhfhockey build plus 3 canceled. Then the READY readback (deployment, SHA, alias). | TJ approves; Chef runs | **Push by 09:00 (15:00Z)** |
| — | Build-slot hold from the push until 12:50Z Mon. Any other lane's push before INSTALL means P5 stops, unless the READY SHA descends from Y and its FORGE closure is registered. | mailbox (posted on approval) | — |
| 2 | **Migration line:** PRECHECK again (expect `apply_20261120143000_first`), apply `20261120143000` (`ce14c532…`) then `20261121210000` (`4035c5c9…`) per file with ledger rows, read back `already_redated|…|03a29fd4…|0` | TJ approves; DB owner | Before INSTALL; plan Sun 20:00 CT |
| G3 | Part B, ingress, disarm-set pins | RO | Before INSTALL |
| 4 | **INSTALL** `7eeb75ea…` with `release_sha`/`deployment_id` from the K2 readback (P5 repeated). The freeze starts here. | TJ / DB owner | Plan Sun 21:00 CT (03:00Z); hard latest Mon 06:04:59 CT |
| N, 5 | NST clearance 05:05–06:07 CT; **go/no-go line** with 0373–0377 all `OFF`/`FINAL`/`OK` (public schedule) | TJ | Mon 05:30 CT |
| 6 | **ARM** `873991e6…` (capture 2026-11-23 only) | TJ / DB owner | Mon 06:04:59 CT |
| 7 | Request-context POST 06:35 CT; Vault `blsh_official_grant_20261122`; **SCHEDULE-ONCE** `33b1ead0…` 06:35–06:44:59 CT; official 06:45 CT; CANCEL `c3fe3217…` and readback by 06:50 CT | TJ (signer) / DB owner | Mon 06:50 CT |

Disarm set: DISARM-ROLLBACK `8b4d6ee0…`, SWITCH-OFF `19abbc7f…`, CANCEL-OFFICIAL-ONCE `c3fe3217…`. All of the operator SQL and both migrations inside Y hash-match the pins above.

## 6. If a tripwire is missed

- **Gap B, same slate, same capture (Mon 06:05 CT):** after FORGE's last Nov 22 close. The last puck is 0377 at Mon 01:00Z, and FORGE has nothing armed. **Push Sun 19:05 CT – Mon 02:00 CT, planned for 19:30 CT,** with the same G1/G2/F/K1 order. Each gate gets about 10 more hours. The build then lands after Nov 22's games have started. Capture is post-game either way and nothing is backfilled, which was the packet's reading under R0 (TJ to confirm).
- **If gap B trips too (no push by Mon 02:00 CT, or no INSTALL by 06:04:59 CT):** the next eligible slate is **Mon Nov 23** (0378–0384, first puck 00:00Z Tue), captured **Tue 2026-11-24 12:05Z (06:05 CT)**. It needs its own re-date (literals, a new migration after `20261121210000`, operator SQL, gates; about 2–3 h now that the shift is mechanical), then the same gates. After that, Nov 24 has 1 game, Nov 25 has 14 and Nov 26 has 0 (19:51Z schedule read).
