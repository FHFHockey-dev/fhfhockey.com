# Proposal: one bounded BLSH hosted fixture replay (Nov 21, 17:30Z; 11:30 am CT)

**Status: proposal only. Nothing has run on production, and nothing has been built, deployed, exposed, minted or armed.**
- This is a PARTIAL-fixture hosted replay. It is not live acceptance and must be reported separately from any live game.
- It supersedes the install-only [HOSTED-REPLAY-PROPOSAL.md](HOSTED-REPLAY-PROPOSAL.md). TJ's recorded approval of that install-only run ("after 18:20Z") is **held, not used**: this turn's instruction is no production retry.

## 1. Blocker: `cda345c4f` cannot finish the replay on any day except 2026-11-20

The installer and the inputs can stay exact. The release cannot, for the native → context replay.

- **Context handler.** At `cda345c4f`, `web/lib/blsh/nativeCaptureV6/requestContextHandler.ts` reads the real `Date.now()` at ingress. It accepts only `sourceDate == ingress UTC day − 1`. Otherwise it returns 200 `skipped: outside_approved_date`.
- **Replay route.** `web/lib/blsh/replay/hostedReplay.ts` gives a fixed clock (2026-11-20T12:05:03Z) to the **native** window gate only. The context stage runs on real time, with `REPLAY_SOURCE_DATE = "2026-11-19"` compiled in.
- **Operator SQL.** `arm-replay-get.sql` (`44c00e03…`) and `arm-replay-get-repeat.sql` (`ef988616…`) refuse unless the UTC date is 2026-11-20.
- **Approval batch.** Constraint 1 of `APPROVAL-BATCH.md` (`5347fc40…`, `refs/rc/blsh-v6-replay-20261120` = `99fb9638a`) already says this envelope is tied to its D + 1 day.

So on Nov 21 or later, `cda345c4f` can install and run the native stage, but it can never write a context packet or run the context reader. A full replay needs a new candidate SHA (section 4).

## 2. What is exact and verified

| Item | Value | Evidence |
|---|---|---|
| Installer | `install.sql` `766aec3bfbc3b766c113a5f25e64b35d9fbebf54083c2ef49c54cef84f24519b`, 376,877 B | `artifact/`; the same pin is in the approval batch and in `install-guarded.sh` |
| Reset | `reset.sql` `8a7634069a27eebc9c4800f7a8fbcf60df37201b2af72ae65a26d36edcf3916e` | `artifact/` |
| Generator | `sandbox_sql.py` `37cc8fad8e82d9b760f3d81d4cec3f8ea379e09492266b6ff73b033933723ab0` at `99fb9638a` | matches the batch |
| Frozen inputs | Fixture tree `59b8c68d…` (identical at fixture commit `8a8b56abb` and at `99fb9638a`), packed into bundle `f2525c71e662da43b0ac36ac479ac27c354044273c5f6b02c493d74eb3046d44` (66,623 B, 38 members) | Drive `1UG0nCC6mIh-dhbCrYNzbAgchz7UM76UD` |
| Envelope manifest | `d0a72075cb14ae813a4b494341a82175970de85dc4f6736c55ed66ac9b240f0b` | Drive `1xPN2dUKnN7vX4uYgTYbdVb3c-q_JvZDu` |
| Labels | `FIXTURE-LABELS.json` `ed13c5ffb0ae3d24af8a363f8af1c8d642013331cc8b97c17df52b8ca8b3567e` | Drive `17R0TwAHz8L0caJfcD2QQWQ1LcDFYT5vw` |
| Source migrations | Git blobs `0b833cc0`, `be17af9b`, `daa74d13`; baseline `b9c07133` | Identical at `99fb9638a` and `cda345c4f` |

**Input provenance (closed locally today, 17:2xZ; Drive was not touched).** From a `git archive` of `99fb9638a`:
- `bundle.py` rebuilt the bundle **byte-for-byte**: `f2525c71…6d44` and manifest `d0a72075…`, the hashes recorded for the Drive copies.
- `sandbox_sql.py` turned that bundle into `install.sql` **byte-identical** to `766aec3b…` (checked with `cmp`), and `reset.sql` `8a763406…`.

**Labels, as they travel with the fixture.**
- `reconstructed`: no original sealed packet exists.
- **PARTIAL**, with 6 `as_of_unverified` inputs. The NST pages are synthetic; the DB history is real game rows plus synthetic stats.
- The repaired WGO variant was never built.

**Installer tests (exact bytes, disposable PG 15.19).**
- **Disconnect faults: 9/9 plus 2 reference installs**, reused from [FAULT-TEST-RECEIPTS.md](FAULT-TEST-RECEIPTS.md). The receipt hashes recheck. They cover a cut before COMMIT (`rolled_back_clean`), a lost COMMIT reply (`committed_verified`), a held or reused pooler backend, partial state, drift, and a dead server. Every ambiguous case stops and never retries.
- **New today, duplicate install: 14/14** (`run-duplicate-install-check.sh`, `receipts/duplicate-install-check/RESULT.json`):
  - a second raw `psql -f install.sql` over a committed sandbox exits 3 with `blsh_replay_already_installed`, and every fingerprint (sandbox, narrow and full outside) is unchanged;
  - the guarded installer exits 11 (`not_clean_before_install`), makes no attempt and changes nothing;
  - `reset.sql` returns the cluster to the pre-install fingerprints;
  - a reinstall reproduces the reference fingerprint `4399436c…`, and a second reset is clean again;
  - the server log shows exactly 2 install transactions.

**Route duplicate no-op (local, `cda345c4f`, proof-12, 24/24, Nov 20 day only).** The repeat native and context both returned `already_claimed`, with `receiptWritten: false`. The sandbox counts stayed identical (storage 28, receipts 2, runs 1/1, objects 20/8). This must be re-proven on the new candidate.

**Limits.** Everything above is local. Hosted is PG 15.1 behind Supavisor, so a hosted fingerprint mismatch stops the run; it is never a retry trigger.

## 3. The bounded hosted run, for candidate R′

It runs only after R′ is cut, gated locally (section 4) and approved. It runs from this Mac, as `postgres` through the session pooler, with keep-awake on, and outside FORGE windows and the Codex repair slot.

| # | Step | Pass condition | On failure |
|---|---|---|---|
| 0 | **Read-only preflight.**<br>- `origin/master` is still R′'s fast-forward base.<br>- Production is on master.<br>- No FORGE live run is armed.<br>- Release hold posted.<br>- Vercel inventory of the 6 projects.<br>- `state-probe.sql`.<br>- No open transaction older than 1 h.<br>- Note the Exposed-schemas value. | All true; probe 0 roles, 0 schemas, 0 memberships, 0 lingering | Stop |
| 1 | **Guarded install, once:** `HOSTED=1 MAX_ATTEMPTS=1 LINGER_WAIT_S=180 bash install-guarded.sh` on `766aec3b…` | `committed_verified` (exit 0) | Exit 3: report and stop. Exit 4: STOP, no reset. |
| 1b | **Read-only checks:** `isolation-check.sql`, `denial-check.sql`, `reachability.sql` | All `"verdict":"ok"`. The only findings are the 2 accepted inherited grants, proven unreachable. | Reset, then stop |
| 2 | **Temporary access:** add `blsh_replay_api` to Exposed schemas; `notify pgrst` | The 9 HTTP probes (`probes.sh`) give `failures: 0` | Unexpose, reset, stop |
| 3 | **Token:** `BLSH_REPLAY_API_TOKEN`, 23 h, role `blsh_replay_api`, set before the build | The variable exists; its value is never printed | Stop |
| 4 | **Single build** of R′ (push approval is separate) | The deployment for R′'s exact SHA is READY; other projects canceled or ignored | Stop; no second build |
| 5 | **One-shot cron pair:** native at *M*, context at *M*+2 (new arm SQL, date as a parameter) | Both jobs fire once and unschedule themselves | Rerun rule below |
| 6 | **Readback** (`readback-replay-get.sql`) | **Native:** 200, `sha` = R′, `packet_complete_pending_review`, 20 objects, every fixture `ok`, outbound only `*.supabase.co`.<br>**Context:** 200, tampered grant 403, valid grant complete, 8 objects, context reader ok.<br>**Sandbox:** 28/2/1/1/20/8; PARTIAL labels; other cron jobs unchanged. | Rerun rule |
| 7 | **Duplicate trigger:** the same two GETs (new repeat SQL) | `already_claimed` ×2, `receiptWritten:false` ×2, counts **identical** to step 6 | Report; cleanup |
| 8 | **Offline readers** on `export_v1('2026-11-19')` | Stage 1 refuses `capture_ingress_window_unconfirmed`; the stage-2 TLS rule refuses `tls_peer_unauthorized`; the context reader is ok | Report |
| 9 | **Cleanup, in order:** disarm, unexpose and restore the noted value, `reset.sql`, `vercel env rm` | 0 roles, 0 schemas, 0 memberships, 0 replay jobs; post-reset probe equals step 0; token gets non-200 | Report the exact residue |

- **Rerun rule.** At most one same-build rerun, and only after a transient or `rolled_back_clean` failure: disarm, unexpose, reset, then steps 1, 1b, 2, 5 and 6. Never after an ambiguous verdict.
- **Footprint.** 1 fhfhockey production build plus the other projects' canceled entries. 4 function invocations: about 23 s native, under 1 s each for the rest. About 90 Data API calls and about 1,320 install statements. For under 1 h: 2 NOLOGIN roles, 2 private schemas, 1 exposed schema and 1 env var. No new paid resource.
- **Rides in the same build.** These are the non-`tasks/` files in `cda345c4f` over `f47905d28`.
  - **Replay:** `blsh-replay-{native,context}.ts`, `lib/blsh/replay/*`, the `requestContextHandler.ts` factory seam and `vercel.json`.
  - **Official-pilot re-date:** `officialPilot{Acquisition,Handler,Store}.ts`, `readHostedOfficialV6.mjs` and the migration file `20261120143000`.
  - **Cron audit inventory:** `lib/cron/cronAuditCoverage.ts`.
  - **Tests and test helpers.**
- **Taken from the diary, not rechecked today; step 0 must confirm them read-only:** the re-date migration is not applied on production, and no BLSH job is armed. FORGE's files are already in master.
- **Checked today at `cda345c4f`:**
  - **Native path:** `selectSourceDate` sees only the replay gate clock, and `prepareNativeProcessCapture` checks only the season. So the native stage is not date-locked, although that has never been run on a later day.
  - **Installer:** no RPC compares the slate date to `now()`. The `2026-11-21` lines are seed rows.
- **Never.** Live arming, NST registration, live migration, production signing keys, public-gate change, or a retry after an ambiguous verdict.

## 4. Choosing the candidate R′ (TJ decides)

- **A. Recommended.** R′ = `cda345c4f` plus a replay-only clock for the context date gate.
  - **What changes:**
    - inject the clock through the existing `createRequestContextHandler` deps, used only for the date gate, the same pattern as the native gate;
    - the live default export keeps `Date.now()`, and every timestamp stays real;
    - check that `nativeObservations`' same-day and `closed ≤ now` checks still use real time;
    - parameterise the date in the arm and repeat SQL.
  - **What stays:** envelope `f2525c71…`, `install.sql` `766aec3b…` and every installer receipt.
  - **Gates before proposing a push:**
    - vitest for the replay, handler and request-context tests;
    - `local_proof.sh` 24/24 on R′, with the duplicate no-op re-proven, run with the real clock set to a day other than 2026-11-20;
    - stage-2 `SOURCE_PINS` still 10/10 at R′;
    - the CSS-module pure check, eslint and tsc on a clean export;
    - a fast-forward check against `origin/master`.
  - **Caveat:** it edits a live file (`requestContextHandler.ts`), although the live behaviour is unchanged.
- **B.** A fresh envelope for the Nov 21 slate, with the context stage on Nov 22 UTC.
  - It needs a new capture, new install bytes and new route pins, so every installer test runs again.
  - Nov 22 12:05–12:07Z is also the re-dated live-pilot window on the same slate.
- **C.** Exact `cda345c4f`, reduced scope: install, native stage, a context date-fence refusal, the duplicate trigger and cleanup.
  - It needs a new date-parameter arm SQL and a local proof of that path first.
  - It cannot show a context packet or the context reader, so the reader requirement is not met.

**Watch:** the off-day pipeline fix (`37a43ad9a` on octoberBranch, `096b78b62` on `chef/forge-daily-offday-20261121`) may land on master first. If master moves, R′ must be re-merged, which gives a new SHA, and gated again.
